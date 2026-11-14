// Cell tracking viewer. Data: data/index.json, data/<clip>.json, media/<clip>/NNN.jpg.
// Written by ripple_agent.make_ctc_demo. No dependencies.
(async function () {
const $ = id => document.getElementById(id);
const BASE = document.currentScript ? document.currentScript.src.replace(/app\.js.*$/, "") : "";
const INDEX = await fetch(BASE + "data/index.json").then(r => r.json());
const TH = [1, 2, 4, 8, 16];
const AMBER = "#ffb000";

const LAYERS = {
  train: [
    {k:"ref", name:"Reference track of the same cell (not used for training)", color:"#f5f5f5", shape:"c", on:true},
    {k:"agent", name:"The model's track (the training label)", color:AMBER, shape:"s", on:true},
    {k:"start_only", name:"Tracker alone from the model's starting mark", color:"#f472b6", shape:"x", on:false},
    {k:"context", name:"Reference cells the model did not follow", color:"#7dd3fc", shape:"o", on:false}],
  heldout: [
    {k:"ref", name:"Reference track", color:"#f5f5f5", shape:"c", on:true},
    {k:"untrained", name:"CoTracker3 as released", color:"#f472b6", shape:"x", on:true},
    {k:"self_training", name:"Fine-tuned on its own tracks", color:"#22d3ee", shape:"d", on:false},
    {k:"label_free", name:"Fine-tuned on the label-free agent tracks", color:AMBER, shape:"s", on:true},
    {k:"gold15", name:"Fine-tuned on reference tracks of 15 cells", color:"#a3e635", shape:"t", on:false},
    {k:"gold_all", name:"Fine-tuned on reference tracks of all cells", color:"#c084fc", shape:"p", on:false}]
};
const ABOUT = {
  train: "Sequence 01. The model marked the cells in the first frame, then said where each one was every 10 frames; CoTracker3 filled in the frames between its marks. A cell that divides hands over to its daughters. The reference tracks are shown for comparison only: no part of the labelling read them.",
  heldout: "Sequence 02, which no training run saw. Every tracker starts each cell from its first reference position. The number beside a tracker is its position accuracy on this video."
};
const SVG = {c:'<circle cx="8" cy="8" r="5"/>', s:'<rect x="3.5" y="3.5" width="9" height="9"/>',
  x:'<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>', d:'<path d="M8 2l6 6-6 6-6-6z"/>', t:'<path d="M8 2.5l6 10.5H2z"/>',
  p:'<path d="M2 8h12M8 2v12"/>', o:'<circle cx="8" cy="8" r="3.2"/>'};

const cImg = $("img"), cOv = $("ov"), gImg = cImg.getContext("2d"), gOv = cOv.getContext("2d");
const cache = new Map();
let D = null, imgs = [], t = 0, follow = null, playing = false, timer = null, V = null, S = 1, cssW = 0, cssH = 0, token = 0;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2; };
const accAt256 = a => 100 * TH.reduce((s, th) => s + a.filter(e => e < th).length / a.length, 0) / TH.length;
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const fmt = (v, d = 1) => v == null ? "–" : v.toFixed(d);

// Distances from the reference, for each layer: per cell, per frame, and over the clip.
function prepare(d){
  const sx = d.native ? 1 : 256 / d.W, sy = d.native ? 1 : 256 / d.H;
  const acc = d.native ? (a => 100 * TH.reduce((s, th) => s + a.filter(e => e <= th).length / a.length, 0) / TH.length) : accAt256;
  d.tracks = Object.assign({ref: d.cells.map(c => c.ref)}, d.layers);
  d.primary = d.kind == "train" ? d.tracks.agent : d.cells.map((c, i) => c.ref || (d.layers.label_free || [])[i] || null);
  d.stats = {};
  d.cells.forEach(c => { c.err = {}; });
  for (const k in d.layers){
    const byF = Array.from({length: d.T}, () => []), all = [], allPx = [];
    d.cells.forEach((c, i) => {
      const P = d.layers[k][i], R = c.ref, px = [];
      if (R) for (let f = c.first + (d.kind == "train" ? 0 : 1); f < d.T; f++){
        if (!P[f] || !R[f]) continue;
        const es = Math.hypot((P[f][0]-R[f][0])*sx, (P[f][1]-R[f][1])*sy);
        px.push(dist(P[f], R[f])); byF[f].push(es); all.push(es);
      }
      c.err[k] = px.length ? {mean: mean(px), med: median(px), n: px.length} : null;
      allPx.push(...px);
    });
    d.stats[k] = {acc: all.length ? acc(all) : null, med: median(allPx), n: all.length,
                  byFrame: byF.map(a => a.length ? acc(a) : null)};
  }
  d.byId = new Map(d.cells.map((c, i) => [c.id, i]));
  if (d.kind == "train") d.cells.forEach((c, i) => {
    const P = d.tracks.agent[i];
    c.last = c.anchors[c.anchors.length - 1][0];
    c.frames = P.filter(Boolean).length;
    c.past = c.ref ? P.filter((p, f) => p && !c.ref[f]).length : null;
    c.gen = c.parent == null ? 0 : 1;
  });
}

function posAt(P, f){
  if (!P) return null;
  if (P[f]) return P[f];
  for (let k = 1; k < P.length; k++){ if (P[f-k]) return P[f-k]; if (P[f+k]) return P[f+k]; }
  return null;
}
function view(){
  if (follow == null) return {x0: 0, y0: 0, w: D.W, h: D.H};
  const c = posAt(D.primary[follow], t) || [D.W/2, D.H/2], w = Math.min(D.follow, D.W, D.H);
  return {x0: clamp(c[0] - w/2, 0, D.W - w), y0: clamp(c[1] - w/2, 0, D.H - w), w: w, h: w};
}
function size(){
  const stage = $("stage"), box = stage.parentElement, cs = getComputedStyle(box), r = devicePixelRatio || 1;
  const cw = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  cssW = follow == null ? cw : Math.min(cw, 640); cssH = Math.round(cssW * V.h / V.w);
  for (const c of [cImg, cOv]){
    const w = Math.round(cssW * r), h = Math.round(cssH * r);
    if (c.width != w || c.height != h){ c.width = w; c.height = h; }
    c.style.width = cssW + "px"; c.style.height = cssH + "px";
  }
  stage.style.width = cssW + "px";
  S = cssW / V.w;
}
const px = p => [(p[0] - V.x0 + 0.5) * S, (p[1] - V.y0 + 0.5) * S];

function shape(g, s, x, y, r){
  g.beginPath();
  if (s == "c") g.arc(x, y, r, 0, 7);
  else if (s == "s") g.rect(x - r, y - r, 2*r, 2*r);
  else if (s == "x"){ g.moveTo(x-r, y-r); g.lineTo(x+r, y+r); g.moveTo(x+r, y-r); g.lineTo(x-r, y+r); }
  else if (s == "d"){ const q = r*1.25; g.moveTo(x, y-q); g.lineTo(x+q, y); g.lineTo(x, y+q); g.lineTo(x-q, y); g.closePath(); }
  else if (s == "t"){ g.moveTo(x, y-r*1.2); g.lineTo(x+r*1.15, y+r); g.lineTo(x-r*1.15, y+r); g.closePath(); }
  else if (s == "p"){ const q = r*1.2; g.moveTo(x-q, y); g.lineTo(x+q, y); g.moveTo(x, y-q); g.lineTo(x, y+q); }
  else g.arc(x, y, Math.max(2.5, r*0.7), 0, 7);
}
function mark(g, m, p, r, lw, halo){
  const [x, y] = px(p);
  if (halo){ shape(g, m.shape, x, y, r); g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = lw + 2; g.stroke(); }
  shape(g, m.shape, x, y, r); g.strokeStyle = m.color; g.lineWidth = lw; g.stroke();
}
function text(g, s, x, y, color){
  g.font = "600 12px system-ui, sans-serif"; g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.8)"; g.fillStyle = color || "#fff";
  g.strokeText(s, x, y); g.fillText(s, x, y);
}
const divided = c => c.end && (c.end[1] == "divided" || (!D.one_answer && c.end[1] != "unsure" && c.gen == 0));
function endText(c){
  if (!c.end) return "";
  if (c.end[1] == "unsure") return "stopped: unsure";
  return divided(c) ? "divided" : "ended";
}

function draw(){
  if (!D) return;
  V = view(); size();
  const r = devicePixelRatio || 1, im = imgs[t];
  gImg.imageSmoothingEnabled = S < 2;
  if (im && im.complete && im.naturalWidth) gImg.drawImage(im, V.x0, V.y0, V.w, V.h, 0, 0, cImg.width, cImg.height);
  else { gImg.fillStyle = "#000"; gImg.fillRect(0, 0, cImg.width, cImg.height); }
  const g = gOv; g.setTransform(r, 0, 0, r, 0, 0); g.clearRect(0, 0, cssW, cssH); g.lineJoin = "round";
  const L = LAYERS[D.kind], on = k => (L.find(m => m.k == k) || {}).on;
  const zoomed = follow != null, dense = D.cells.length > 80 && !zoomed;
  const R = zoomed ? 8 : dense ? 3.2 : 6, lw = zoomed ? 2 : dense ? 1.2 : 1.8, K = zoomed ? 30 : 15;
  const trail = $("trail").checked, links = $("links").checked, anch = $("anch").checked;
  const pad = 12 / S, inView = p => p && p[0] >= V.x0 - pad && p[0] <= V.x0 + V.w + pad && p[1] >= V.y0 - pad && p[1] <= V.y0 + V.h + pad;

  if (D.kind == "train" && on("context")){
    const m = L.find(q => q.k == "context");
    for (const P of D.context) if (inView(P[t])) mark(g, m, P[t], R, lw, !dense);
  }
  D.cells.forEach((c, i) => {
    const ref = c.ref && c.ref[t];
    for (const m of L){
      if (!m.on || m.k == "context" || !D.tracks[m.k]) continue;
      const P = D.tracks[m.k][i], p = P && P[t];
      if (!inView(p)) continue;
      if (trail){
        g.strokeStyle = m.color; g.globalAlpha = .5; g.lineWidth = Math.max(1, lw - .6); g.beginPath();
        let open = false;
        for (let f = Math.max(0, t - K); f <= t; f++){
          if (!P[f]){ open = false; continue; }
          const [x, y] = px(P[f]); open ? g.lineTo(x, y) : g.moveTo(x, y); open = true;
        }
        g.stroke(); g.globalAlpha = 1;
      }
      if (links && m.k != "ref" && on("ref") && ref){
        g.strokeStyle = m.color; g.lineWidth = 1; g.beginPath(); g.moveTo(...px(p)); g.lineTo(...px(ref)); g.stroke();
      }
      mark(g, m, p, m.k == "ref" ? R * 1.25 : R, lw, !dense);
    }
    if (D.kind == "train" && on("agent")) extras(g, c, i, R, anch);
    if (D.kind != "train" && c.anchors && anch) for (const a of c.anchors){
      const dt = Math.abs(a[0] - t); if (dt > 2 || !inView([a[1], a[2]])) continue;
      const [x, y] = px([a[1], a[2]]);
      g.globalAlpha = 1 - dt / 3; g.strokeStyle = "#4ade80"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, R * 2 + 4 + dt * 3, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
    const here = D.primary[i] && D.primary[i][t];
    if (inView(here) && !dense){
      const [x, y] = px(here);
      if (i == follow){ g.setLineDash([4, 4]); g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 26, 0, 7); g.stroke(); g.setLineDash([]); }
      text(g, String(c.id), x + R + 5, y - R - 3);
    }
  });
  $("num").textContent = `frame ${t} / ${D.T - 1}`;
  $("frame").value = t;
  charts();
}

// Training clips: the model's marks, where a track stopped, and the link from a parent to its daughter.
function extras(g, c, i, R, anch){
  const P = D.tracks.agent[i];
  if (anch) for (const a of c.anchors){
    const dt = Math.abs(a[0] - t); if (dt > 2) continue;
    const [x, y] = px(dt == 0 ? [a[1], a[2]] : (P[t] || [a[1], a[2]]));
    g.globalAlpha = 1 - dt / 3; g.strokeStyle = AMBER; g.lineWidth = 2.2;
    if (a === c.anchors[0]) g.setLineDash([5, 4]);
    g.beginPath(); g.arc(x, y, R * 2 + 4 + dt * 3, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  }
  if (c.parent != null && t >= c.first && t <= c.first + 5){
    const pi = D.byId.get(c.parent), par = D.cells[pi], from = par && posAt(D.tracks.agent[pi], par.last);
    if (from){ g.setLineDash([3, 3]); g.strokeStyle = AMBER; g.lineWidth = 1.4; g.beginPath();
      g.moveTo(...px(from)); g.lineTo(...px([c.anchors[0][1], c.anchors[0][2]])); g.stroke(); g.setLineDash([]); }
  }
  if (c.end && t > c.last && t <= c.end[0] + 8 && P[c.last]){
    const [x, y] = px(P[c.last]);
    g.strokeStyle = AMBER; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, R, 0, 7); g.moveTo(x - R*.7, y + R*.7); g.lineTo(x + R*.7, y - R*.7); g.stroke();
    text(g, `${c.id}: ${endText(c)}`, x + R + 5, y + 4, AMBER);
  }
}

function setup(c){
  const r = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  c.width = W * r; c.height = H * r;
  const g = c.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0);
  g.fillStyle = "#141414"; g.fillRect(0, 0, W, H);
  return [g, W, H];
}
function lines(c, series, ymax, unit, ticks){
  const [g, W, H] = setup(c), X = f => 30 + (W - 38) * f / (D.T - 1), Y = v => H - 16 - (H - 26) * Math.min(v, ymax) / ymax;
  g.font = "10px system-ui, sans-serif"; g.fillStyle = "#9a9a9a"; g.strokeStyle = "#333"; g.lineWidth = 1;
  for (const v of [0, ymax / 2, ymax]){ g.beginPath(); g.moveTo(30, Y(v)); g.lineTo(W - 8, Y(v)); g.stroke(); g.fillText(String(Math.round(v)) + (v == ymax ? unit : ""), 4, Y(v) + 3); }
  g.fillText("0", 30, H - 3); g.fillText(String(D.T - 1), W - 26, H - 3);
  for (const s of series){
    g.strokeStyle = s.color; g.lineWidth = 1.6; g.beginPath(); let open = false;
    s.values.forEach((v, f) => { if (v == null){ open = false; return; } open ? g.lineTo(X(f), Y(v)) : g.moveTo(X(f), Y(v)); open = true; });
    g.stroke();
  }
  for (const f of ticks || []){ g.fillStyle = AMBER; g.beginPath(); g.arc(X(f), H - 19, 2.4, 0, 7); g.fill(); }
  g.strokeStyle = "#fff"; g.globalAlpha = .7; g.beginPath(); g.moveTo(X(t), 4); g.lineTo(X(t), H - 14); g.stroke(); g.globalAlpha = 1;
  c.onclick = e => { const b = c.getBoundingClientRect(); setT(Math.round((e.clientX - b.left - 30) / (b.width - 38) * (D.T - 1))); };
}
function charts(){
  const L = LAYERS[D.kind].filter(m => m.on && D.layers[m.k]);
  lines($("c1"), L.map(m => ({color: m.color, values: D.stats[m.k].byFrame})), 100, "", null);
  const box = $("c2-box");
  if (follow == null){ box.hidden = true; return; }
  box.hidden = false;
  const c = D.cells[follow];
  $("c2-title").textContent = `Cell ${c.id}: distance from the reference, in pixels`;
  if (!c.ref){ setup($("c2")); $("c2-note").textContent = "No reference cell lies near this cell's starting mark, so there is nothing to compare it with."; return; }
  const series = L.map(m => ({color: m.color, values: D.layers[m.k][follow].map((p, f) => p && c.ref[f] ? dist(p, c.ref[f]) : null)}));
  const top = Math.max(16, ...series.flatMap(s => s.values.filter(v => v != null)));
  lines($("c2"), series, Math.ceil(top / 8) * 8, " px", D.kind == "train" ? c.anchors.map(a => a[0]) : null);
  $("c2-note").textContent = D.kind == "train"
    ? `Dots mark the frames where the model placed the cell. ${c.past ? `The model's track runs ${c.past} frames beyond the reference cell's life.` : ""}`
    : "";
}

function setT(v){ t = clamp(v, 0, D.T - 1); draw(); }
function stop(){ playing = false; clearInterval(timer); $("play").textContent = "Play"; }
function toggle(){ if (playing) return stop(); playing = true; $("play").textContent = "Pause"; timer = setInterval(() => setT(t == D.T - 1 ? 0 : t + 1), 90); }
function setFollow(i, jump){
  follow = i; $("focus").value = i == null ? "" : String(i);
  $("all").disabled = i == null;
  if (i != null && jump && !D.primary[i][t]) t = D.cells[i].first;
  document.querySelectorAll("table.cells tr").forEach(tr => tr.classList.toggle("sel", tr.dataset.i === String(i)));
  draw();
}

function legend(){
  const L = LAYERS[D.kind], box = $("legend");
  box.innerHTML = `<div class="legend-head"><span>Show</span><span>${D.kind == "train" ? "Median distance from the reference" : "Score on this video"}</span></div>`;
  for (const m of L){
    let s = "";
    if (D.kind == "heldout" && D.scores[m.k] != null) s = D.scores[m.k].toFixed(1);
    if (D.kind == "train" && D.stats[m.k]) s = fmt(D.stats[m.k].med) + " px";
    if (m.k == "context") s = `${D.context.length} cells`;
    const l = document.createElement("label");
    if (m.k != "ref" && m.k != "context" && !D.layers[m.k]) continue;
    l.innerHTML = `<input type="checkbox" ${m.on ? "checked" : ""}><svg class="sw" viewBox="0 0 16 16" fill="none" stroke="${m.color}" stroke-width="1.8">${SVG[m.shape]}</svg><span>${(D.names && D.names[m.k]) || m.name}</span><span class="score">${s}</span>`;
    l.querySelector("input").onchange = e => { m.on = e.target.checked; draw(); };
    box.appendChild(l);
  }
}
function started(c){ return c.parent == null ? "first frame" : `frame ${c.first}, daughter of ${c.parent}`; }
function ended(c){
  if (!c.end) return "followed to the last frame";
  const f = c.end[0];
  if (c.end[1] == "unsure") return `stopped by frame ${f}: the model was unsure twice in a row`;
  if (divided(c)) return `divided by frame ${f}; ` + (c.kids && c.kids.length ? `daughters ${c.kids.join(", ")}` : "daughters not followed");
  return `died or left the image by frame ${f}`;
}
function lists(){
  const box = $("lists");
  if (D.kind == "train"){
    const C = D.cells, n0 = C.filter(c => c.gen == 0).length, st = D.stats, sparse = !!D.layers.marks, solo = st.start_only;
    const main = sparse ? "marks" : "agent", nMarks = C.reduce((s, c) => s + c.anchors.length, 0);
    const away = c => c.err[main] ? fmt(c.err[main].med) + " px" : "no reference cell nearby";
    box.innerHTML = `<h3>What the model labelled in this video</h3>
      <div class="stat-row">
        <div class="stat"><b>${C.length}</b><span>cells: ${n0} from the first frame, ${C.length - n0} daughters</span></div>
        <div class="stat"><b>${(sparse ? nMarks : C.reduce((s, c) => s + c.frames, 0)).toLocaleString()}</b><span>${sparse ? (D.marks_label || "marks (the training labels)") : "frames labelled"}</span></div>
        <div class="stat"><b>${C.reduce((s, c) => s + c.queries, 0)}</b><span>questions to the model</span></div>
        <div class="stat"><b>${C.filter(c => c.ref).length} of ${C.length}</b><span>cells that lie on a reference cell (${D.reference_cells} reference cells in all)</span></div>
        <div class="stat"><b>${fmt(st[main].med)} px</b><span>median distance of the ${sparse ? "marks" : "labels"} from the reference${solo ? ` (tracker alone: ${fmt(solo.med)} px)` : ""}</span></div>
      </div>
      <p class="sub">Click a row to follow that cell. Distances are medians over the ${sparse ? "marks" : "frames"} where the reference cell exists.</p>
      <div class="table-wrap"><table class="cells"><thead><tr><th>Cell</th><th>Started</th><th>${sparse ? "First to last mark" : "Frames labelled"}</th><th>Model's marks</th><th>How the track ended</th><th>${sparse ? "Marks from the reference" : "Model's track"}</th>${solo ? "<th>Tracker alone</th>" : ""}<th>Frames past the reference end</th></tr></thead><tbody>` +
      C.map((c, i) => `<tr data-i="${i}"><td>${c.id}</td><td style="text-align:left">${started(c)}</td><td>${c.first}–${c.last}${sparse ? "" : ` (${c.frames})`}</td><td>${c.anchors.length}</td><td style="text-align:left;white-space:normal">${ended(c)}</td><td>${away(c)}</td>${solo ? `<td>${c.err.start_only ? fmt(c.err.start_only.med) + " px" : "–"}</td>` : ""}<td>${c.past == null ? "–" : c.past}</td></tr>`).join("") +
      `</tbody></table></div>`;
    box.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => { setFollow(+tr.dataset.i, true); $("stage").scrollIntoView({behavior: "smooth", block: "center"}); });
  } else {
    const A = "untrained", B = "label_free";
    const rows = D.cells.map((c, i) => ({i, c, a: c.err[A], b: c.err[B]})).filter(q => q.a && q.b && q.a.n >= 10)
      .map(q => Object.assign(q, {gain: q.a.mean - q.b.mean}));
    const better = rows.filter(q => q.gain > 2).length, worse = rows.filter(q => q.gain < -2).length;
    const chip = q => `<button class="chip" data-i="${q.i}">cell <b>${q.c.id}</b>: ${q.a.mean.toFixed(0)} → ${q.b.mean.toFixed(0)} px</button>`;
    const top = [...rows].sort((x, y) => y.gain - x.gain).slice(0, 12).filter(q => q.gain > 0), bottom = [...rows].sort((x, y) => x.gain - y.gain).slice(0, 12).filter(q => q.gain < 0);
    box.innerHTML = `<h3>Where fine-tuning on the label-free tracks changed the result</h3>
      <p class="sub">Mean distance from the reference for each cell, released tracker → fine-tuned tracker. Of ${rows.length} cells with at least 10 scored frames, fine-tuning brought ${better} closer by more than 2 px and moved ${worse} farther by more than 2 px. Click a cell to follow it.</p>
      <h3>Largest gains</h3><div class="chips">${top.map(chip).join("")}</div>
      <h3>Largest losses</h3><div class="chips">${bottom.map(chip).join("") || "<span class='sub'>None.</span>"}</div>`;
    box.querySelectorAll(".chip").forEach(b => b.onclick = () => { setFollow(+b.dataset.i, true); $("stage").scrollIntoView({behavior: "smooth", block: "center"}); });
  }
}

async function load(entry){
  const mine = ++token;
  stop(); $("loading").hidden = false;
  document.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.slug == entry.slug));
  let c = cache.get(entry.slug);
  if (!c){
    const d = await fetch(`${BASE}data/${entry.slug}.json`).then(r => r.json());
    prepare(d);
    const im = Array.from({length: d.T}, (_, i) => { const g = new Image(); g.src = `${BASE}media/${entry.frames || entry.slug}/${String(i).padStart(3, "0")}.${entry.ext || "jpg"}`; g.onload = () => { if (D === d && t == i) draw(); }; return g; });
    c = {d, im}; cache.set(entry.slug, c);
  }
  if (mine != token) return;
  D = c.d; imgs = c.im; t = 0; follow = null;
  $("about").textContent = D.about || ABOUT[D.kind];
  $("frame").max = D.T - 1;
  $("anch-l").hidden = D.kind != "train" && !D.cells.some(c => c.anchors);
  $("c1-title").textContent = D.kind == "train" ? "Agreement with the reference, by frame (position accuracy)" : "Position accuracy by frame";
  $("bright").value = D.bright || (/Fluo/.test(D.name) ? 1.5 : 1); cImg.style.filter = `brightness(${$("bright").value})`;
  $("focus").innerHTML = '<option value="">whole frame</option>' + D.cells.map((q, i) => `<option value="${i}">cell ${q.id}${q.parent != null ? ` (daughter of ${q.parent})` : ""}</option>`).join("");
  legend(); lists(); setFollow(null);
  try { await imgs[0].decode(); } catch (e) {}
  if (mine != token) return;
  $("loading").hidden = true; draw();
}

for (const e of INDEX){
  const b = document.createElement("button"); b.type = "button"; b.textContent = e.title; b.dataset.slug = e.slug;
  b.onclick = () => load(e);
  const group = $(e.group ? "pick-" + e.group : e.kind == "train" ? "pick-train" : "pick-heldout");
  group.appendChild(b); group.parentElement.hidden = false;
}
$("play").onclick = toggle;
$("frame").oninput = e => setT(+e.target.value);
for (const id of ["trail", "links", "anch"]) $(id).onchange = draw;
$("bright").oninput = e => { cImg.style.filter = `brightness(${e.target.value})`; };
$("focus").onchange = e => setFollow(e.target.value === "" ? null : +e.target.value, true);
$("all").onclick = () => setFollow(null);
cOv.onclick = e => {
  const b = cOv.getBoundingClientRect(), x = (e.clientX - b.left) / S + V.x0 - 0.5, y = (e.clientY - b.top) / S + V.y0 - 0.5;
  let best = null, bd = 24 / S + 4;
  D.cells.forEach((c, i) => { const p = D.primary[i] && D.primary[i][t]; if (!p) return; const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd){ bd = d; best = i; } });
  if (best != null) setFollow(best);
};
addEventListener("keydown", e => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key != "Escape") return;
  if (e.key == "ArrowRight") setT(t + 1); else if (e.key == "ArrowLeft") setT(t - 1);
  else if (e.key == " "){ e.preventDefault(); toggle(); } else if (e.key == "Escape") setFollow(null);
});
addEventListener("resize", draw);
const first = INDEX.find(e => e.group == "final") || INDEX.find(e => e.kind == "train") || INDEX[0];
load(first);
})();
