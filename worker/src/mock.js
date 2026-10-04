// Stand-in for the model when MOCK=1 (local testing without an API key). It exercises the
// whole pipeline: asks for a paper's full text, then returns one statement with a correct
// quote, one whose quote carries the wrong block id, and one with an invented quote.

const words = (text, from, n) => text.split(' ').slice(from, from + n).join(' ');

export function mockModel({ question, index, loaded, lookup }) {
  const q = question.toLowerCase();
  const hit = index.papers.find((p) =>
    [p.title, ...p.aliases].some((a) => q.includes(a.toLowerCase())));
  if (hit && !loaded.includes(hit.prefix)) return { need_papers: [hit.prefix], answer: [] };

  const pool = [...lookup.values()].filter((b) => (hit ? b.id.startsWith(hit.prefix + '.') : b.id.startsWith('s')));
  const terms = q.split(/\W+/).filter((w) => w.length > 3);
  const ranked = pool
    .map((b) => ({ b, score: terms.filter((t) => b.text.toLowerCase().includes(t)).length }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.b);
  const [a, b] = [ranked[0], ranked[1] ?? ranked[0]];
  return {
    need_papers: [],
    answer: [
      { text: '(mock) First statement, backed by a real quote.', cites: [{ id: a.id, quote: words(a.text, 2, 12) }] },
      { text: '(mock) Second statement; the quote is real but cited to the wrong block.', cites: [{ id: a.id, quote: words(b.text, 3, 10) }] },
      { text: '(mock) Third statement with an invented quote; it must be removed.', cites: [{ id: a.id, quote: 'this sentence does not appear anywhere in the lab sources at all' }] },
      { text: '(mock) Closing remark without a citation.' },
    ],
  };
}
