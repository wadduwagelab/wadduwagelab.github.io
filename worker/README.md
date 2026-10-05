# Ask the lab: chat assistant backend

A Cloudflare Worker that answers visitors' questions about the lab from public sources only:
the site's own `_data` files and the lab's arXiv preprints. The widget is `assets/js/chat.js`.

## How it works

1. `tools/build_chat_corpus.py` (in the maintenance folder) turns `_data/*.yml` and the arXiv HTML
   of each preprint into numbered blocks: `assets/chat/index.json` (site blocks, paper abstracts)
   and `assets/chat/papers/<arXiv id>.json` (one block per paragraph or figure caption, each with
   the link to that paragraph on arXiv).
2. The Worker (`src/index.js`) sends the question, the site blocks and the abstracts to the
   Gemini API. If the question needs a paper's full text, the model asks for it and the Worker
   calls again with that paper's blocks.
3. The model must return each statement with a block id and a verbatim quote. `src/verify.js`
   checks every quote against the block. Quotes that are not found are discarded, and a statement
   left without a verified quote is removed.
4. The widget shows the answer with numbered citations: the quote, the section and paragraph or
   figure, and a link to that place in the source.

## Local test

```bash
cp .dev.vars.example .dev.vars        # add GEMINI_API_KEY, or set MOCK=1 to test without a key
npm install
npx wrangler dev --port 8787          # backend at http://localhost:8787/api/chat
# in the maintenance folder: render the site and serve it on port 4173 (see CLAUDE.md)
```

On `localhost` the widget calls `http://localhost:8787/api/chat`.

## Deploy

```bash
npx wrangler login                          # once, opens the browser
npx wrangler secret put GEMINI_API_KEY      # paste the key when asked; it is stored by Cloudflare
npx wrangler deploy
```

The Worker serves `wadduwagelab.com/api/*`. The widget shows its button only when
`GET /api/chat` answers `{"ok": true}`, so the site is unaffected while the Worker is not deployed.

## Settings (`wrangler.toml`)

| Setting | Meaning |
|---|---|
| `ENABLED` | `"0"` hides the widget's button on the site; `"1"` shows it |
| `GEMINI_MODEL` | Gemini model id |
| `CORPUS_BASE` | where the corpus JSON is served |
| `ALLOWED_ORIGINS` | sites allowed to call the endpoint |
| `DAILY_LIMIT` | questions per day across all visitors (needs the `QUOTA` KV binding) |
| `[[ratelimits]]` | questions per minute per IP address |
| `THINKING_LEVEL` | optional Gemini thinking level |

Limits in code: 1,000 characters per question, 12 messages per conversation, at most two papers'
full text per answer. The Worker stores no questions or answers; it keeps only the daily counter and the city counts below.

## Visitor locations (page loads by city)

The widget's status check (`GET /api/chat`) runs once per page load in a real browser. For those
requests the Worker adds one to a per-day, per-city count, using the approximate city Cloudflare
attaches to the request. It is stored in the `QUOTA` KV namespace under `geo:YYYY-MM-DD` as
`{"US|Virginia|Norfolk": {"n": 3, "lat": 36.9, "lon": -76.3}, ...}` and expires after 400 days.
No IP address, browser details or question text is stored. To read it:

```bash
npx wrangler kv key list --binding QUOTA --remote --prefix geo:
npx wrangler kv key get "geo:2026-10-05" --binding QUOTA --remote
```

## Keeping it current

Re-run `python3 tools/build_chat_corpus.py site` after any `_data` change or when a preprint is
added (add its arXiv id to `PAPERS` in the script), then commit `assets/chat/`. The Worker picks
up the new corpus within about ten minutes; no redeploy is needed.
