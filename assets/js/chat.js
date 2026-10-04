// "Ask the lab": chat widget for the assistant served by the Cloudflare Worker in worker/.
// Answers arrive as segments with numbered citations; each citation carries a quote that the
// Worker has checked against its source, the place in the source, and a link to it.
(function () {
  'use strict';

  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ENDPOINT = local ? 'http://localhost:8787/api/chat' : '/api/chat';
  var MAX_MESSAGES = 12;
  var EXAMPLES = ['What does the lab work on?', 'Explain the RIPPLE paper', 'How do I join the lab?'];

  var messages = [];   // [{role, content}] sent back to the Worker as conversation history
  var papers = [];     // papers whose full text the last answer used (kept for follow-ups)
  var busy = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  var launcher = el('button', 'chat-launcher');
  var mark = el('span', 'chat-launcher-mark', '?');
  mark.setAttribute('aria-hidden', 'true');
  launcher.appendChild(mark);
  launcher.appendChild(document.createTextNode('Ask the lab'));
  launcher.type = 'button';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');

  var panel = el('div', 'chat-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask the lab');
  panel.hidden = true;

  var head = el('div', 'chat-head');
  head.appendChild(el('h2', 'chat-title', 'Ask the lab'));
  var reset = el('button', 'chat-head-btn', 'New');
  reset.type = 'button';
  reset.setAttribute('aria-label', 'Start a new conversation');
  var close = el('button', 'chat-head-btn', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the assistant');
  head.appendChild(reset);
  head.appendChild(close);

  var log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-live', 'polite');

  var form = el('form', 'chat-form');
  var input = el('textarea', 'chat-input');
  input.rows = 2;
  input.maxLength = 1000;
  input.placeholder = 'Ask about our research, papers or joining the lab';
  input.setAttribute('aria-label', 'Your question');
  var send = el('button', 'chat-send', 'Ask');
  send.type = 'submit';
  form.appendChild(input);
  form.appendChild(send);

  var note = el('p', 'chat-note',
    'Experimental AI assistant. It answers from this website and the lab’s preprints, and every quote is checked against its source. ' +
    'It can still be wrong. Questions are sent to Google’s Gemini API; please do not enter personal information.');

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  panel.appendChild(note);

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function intro() {
    log.textContent = '';
    var m = el('div', 'chat-msg chat-bot');
    m.appendChild(el('p', '', 'Ask about the lab’s research, papers, software, teaching or how to join. For example:'));
    var list = el('div', 'chat-examples');
    EXAMPLES.forEach(function (q) {
      var b = el('button', 'chat-example', q);
      b.type = 'button';
      b.addEventListener('click', function () { ask(q); });
      list.appendChild(b);
    });
    m.appendChild(list);
    log.appendChild(m);
  }

  function renderAnswer(data) {
    var m = el('div', 'chat-msg chat-bot');
    var srcItems = {};
    var details = null;

    if (data.sources.length) {
      details = el('details', 'chat-sources');
      details.appendChild(el('summary', '', 'Sources (' + data.sources.length + ')'));
      var ol = el('ol');
      data.sources.forEach(function (s) {
        var li = el('li');
        li.tabIndex = -1;
        var where = el('div', 'chat-src-where', s.label + (s.where ? ' · ' + s.where : ''));
        var q = el('blockquote', 'chat-src-quote', s.quote);
        var a = el('a', 'chat-src-link', 'Open the source at this passage');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(where);
        li.appendChild(q);
        li.appendChild(a);
        ol.appendChild(li);
        srcItems[s.n] = li;
      });
      details.appendChild(ol);
    }

    data.segments.forEach(function (seg) {
      var p = el('p', '', seg.text);
      seg.cites.forEach(function (n) {
        var c = el('button', 'chat-cite', String(n));
        c.type = 'button';
        c.setAttribute('aria-label', 'Show source ' + n);
        c.addEventListener('click', function () {
          details.open = true;
          Object.keys(srcItems).forEach(function (k) { srcItems[k].classList.remove('chat-src-on'); });
          srcItems[n].classList.add('chat-src-on');
          srcItems[n].focus();
        });
        p.appendChild(document.createTextNode(' '));
        p.appendChild(c);
      });
      m.appendChild(p);
    });
    if (!data.segments.length) {
      m.appendChild(el('p', '', 'I could not find a supported answer in the lab’s pages or papers. Try rephrasing, or email the lab using the address at the bottom of the page.'));
    }
    if (data.removed) {
      m.appendChild(el('p', 'chat-removed', data.removed + (data.removed === 1 ? ' statement was' : ' statements were') +
        ' removed because the quote could not be found in the source.'));
    }
    if (details) m.appendChild(details);
    log.appendChild(m);
    m.scrollIntoView({ block: 'start' });
  }

  function ask(question) {
    question = question.trim();
    if (!question || busy) return;
    if (messages.length >= MAX_MESSAGES - 1) {
      log.appendChild(el('div', 'chat-msg chat-error', 'This conversation is long. Please start a new one with the New button.'));
      scrollDown();
      return;
    }
    busy = true;
    send.disabled = true;
    input.value = '';
    log.appendChild(el('div', 'chat-msg chat-user', question));
    var wait = el('div', 'chat-msg chat-bot chat-wait', 'Reading the sources…');
    log.appendChild(wait);
    scrollDown();
    messages.push({ role: 'user', content: question });

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages, papers: papers })
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (res) {
      wait.remove();
      if (!res.ok || !res.data.segments) throw new Error(res.data.error || '');
      papers = res.data.papers || [];
      messages.push({ role: 'assistant', content: res.data.segments.map(function (s) { return s.text; }).join(' ') || '(no supported answer)' });
      renderAnswer(res.data);
    }).catch(function (err) {
      wait.remove();
      messages.pop();
      log.appendChild(el('div', 'chat-msg chat-error', err.message || 'The assistant could not be reached. Please try again later.'));
      scrollDown();
    }).then(function () {
      busy = false;
      send.disabled = false;
      input.focus();
    });
  }

  function open() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    if (!log.childNodes.length) intro();
    input.focus();
  }

  function shut() {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
  }

  launcher.addEventListener('click', function () { if (panel.hidden) open(); else shut(); });
  close.addEventListener('click', shut);
  reset.addEventListener('click', function () { messages = []; papers = []; intro(); input.focus(); });
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); }
  });

  // Show the launcher only when the backend answers, so the site is unaffected if it is down.
  fetch(ENDPOINT).then(function (r) { return r.json(); }).then(function (status) {
    if (!status.ok) return;
    document.body.appendChild(launcher);
    document.body.appendChild(panel);
  }).catch(function () {});
})();
