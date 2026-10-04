// Quote verification: the model must back each statement with a verbatim quote from a
// numbered source block. A quote that cannot be found in the sources is discarded, and a
// statement left with no verified quote is removed from the answer.

const MIN_QUOTE = 20; // characters after normalisation

// Fold differences that do not change the wording: Unicode forms, curly quotes, dash
// variants, soft hyphens, whitespace and case.
export function norm(s) {
  return String(s)
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A quote may skip words with "..." or "…"; every part must then appear in the same block.
function parts(quote) {
  return norm(quote)
    .split(/\.{3,}|…/)
    .map((p) => p.replace(/^["'\s]+|["'\s]+$/g, ''))
    .filter(Boolean);
}

function inBlock(ps, block) {
  if (!block) return false;
  block._n ??= norm(block.text);
  return ps.every((p) => block._n.includes(p));
}

// Returns the id of the block that contains the quote (the cited one, or another supplied
// block if the model cited the wrong id), or null if the quote is not in the sources.
export function locate(quote, id, lookup) {
  const ps = parts(quote);
  if (!ps.length || ps.join(' ').length < MIN_QUOTE || ps.some((p) => p.length < 8)) return null;
  if (inBlock(ps, lookup.get(id))) return id;
  for (const [bid, block] of lookup) if (inBlock(ps, block)) return bid;
  return null;
}

// answer: [{text, cites: [{id, quote}]}]   lookup: Map(id -> block)
// -> { segments: [{text, cites: [n]}], sources: [{n, id, quote}], removed }
export function verifyAnswer(answer, lookup) {
  const segments = [];
  const sources = [];
  const seen = new Map();
  let removed = 0;
  for (const seg of Array.isArray(answer) ? answer : []) {
    const text = String(seg?.text ?? '').replace(/\s*\[(?:s\d+|p\d+\.\d+)\]/g, '').trim();
    if (!text) continue;
    const claimed = Array.isArray(seg.cites) ? seg.cites : [];
    const cites = [];
    for (const c of claimed) {
      const id = locate(c?.quote ?? '', c?.id, lookup);
      if (!id) continue;
      const quote = String(c.quote).replace(/\s+/g, ' ').trim();
      const key = `${id}|${norm(quote)}`;
      if (!seen.has(key)) {
        seen.set(key, sources.length + 1);
        sources.push({ n: sources.length + 1, id, quote });
      }
      if (!cites.includes(seen.get(key))) cites.push(seen.get(key));
    }
    if (claimed.length && !cites.length) {
      removed += 1;
      continue;
    }
    segments.push({ text, cites });
  }
  return { segments, sources, removed };
}
