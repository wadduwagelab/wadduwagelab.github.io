# Wadduwage Lab website: maintenance playbook

> **This is the copy kept in the website repository** so that any Claude session with access to
> this repo can maintain the site. The full maintenance folder lives on Dushan's Mac at
> `career/wadduwagelab-website/` inside the "Of Course I Still Have Time" folder; it adds
> `content-sources/`, `design/`, `tools/` and `related-repos.md`, which are **not** in this repo.
> Its `CLAUDE.md` is the same playbook; when you change one copy, update the other.
>
> **Path note:** below, `site/` means the root of this repository, and `../tools/…` refers to the
> Mac folder's `tools/`. If you are working from this repo alone, skip the tools steps (or take
> screenshots another way) and edit `_data/*.yml` at the repo root. This file is excluded from the
> Jekyll build (`exclude:` in `_config.yml`), so it is not published on the website.

This repository is what is deployed to **https://wadduwagelab.com**.
Read this file first; it is written for Claude. Last full review: 2026-10-03.

## Quick start

To update the site, tell Claude, for example:

- "Add a news item for Nov 2026: Dineth presented at <conference>, link <url>."
- "Add our new paper <DOI> to publications and a news item; link the press story <url>."
- "Add Sam Handel to the team as an M.S. student; headshot is <file>."
- "Add these three photos to Lab Life with captions …, then show me desktop and mobile screenshots."

Claude then follows **Workflow** below: pull, edit `site/_data/*.yml`, preview, screenshot,
commit as Dushan, push, verify.

## Folder map

| Path | What |
|---|---|
| `site/` | Git clone of the site repo (with history). **The only thing that is deployed.** |
| `content-sources/` | Raw material: `website-content-for-claude/` (original lab-life photos + Claude's photo review; `_claude_photo_review/web/meta.json` maps each gallery slug to its source photo), `bio-and-cv/` (NIH biosketch/CV text used for bios and research text, plus two NIH biosketch PDFs `cv-3233225.pdf` and `wadduwage-cv-3233225.pdf`), `research-text-drafts/` (drafts v1–v3 of the Research section, Sep 2026). |
| `content-sources/annual-review-2026/` | **Private.** Copy of the AY 2025–26 annual review package (final text in `text/*.md`, uploaded PDFs in `pdf/`): the richest fact source for publications, software, talks, students, courses and press. See its README for what may and may not go on the public site. Never copy into `site/` or commit to GitHub. |
| `design/` | Design history: `hero/` (chosen hero GIF, variant sheet, variant demo page, previous hero.js), `themes/` (theme CSS A/B/C, fonts, comps; C "Dither Lab" was chosen), `preview/` (standalone preview HTML), `screenshots/` (`current-2026-10-03/` = reference look of the live design; older sets), `old-site-build/` (the Feb 2026 site before the redesign). |
| `tools/` | Scripts: screenshots, render without Jekyll, link check, gallery images, hero bench. See `tools/README.md`. |
| `related-repos.md` | Lab software repos linked from the site, with DOIs and public/private status. |
| `_archive/` | Superseded website material. Do not edit. |
| `_transfer_archives/` | Leftovers from the 2026-10-03 consolidation (transfer tarballs, stale git locks). Safe to delete. |

## The site in one paragraph

Jekyll site, repo **https://github.com/wadduwagelab/wadduwagelab.github.io** (public), served by
**GitHub Pages from branch `main`** ("deploy from branch": the only workflow is GitHub's automatic
`pages-build-deployment`; there is no `.github/workflows/` in the repo). Custom domain via the
`CNAME` file (`wadduwagelab.com`); the domain is registered at Cloudflare (renewed through
Oct 21, 2027). It is a **single page**: `index.html` (sections) + `_layouts/default.html`
(head, nav, footer) + content in `_data/*.yml`, plus one sub-page, **`/resources/`**
(`resources.html`, content in `_data/resources.yml`, script `assets/js/resources.js`) for prospective and incoming students. Styling `assets/css/main.css`; scripts
`assets/js/hero.js` (hero animation), `scroll.js` (sticky-header offset, reveal on scroll),
`gallery.js` (Lab Life strip + lightbox). Fonts: Space Grotesk + Silkscreen (Google Fonts).
Pages builds with GitHub's own Jekyll 3.x and ignores the `Gemfile`; the Gemfile (Jekyll 4.4,
jekyll-feed, jekyll-sitemap) is for local preview only. Avoid plugins/Liquid that GitHub Pages
does not support.

## Where each section's content lives

Order on the page (`index.html`). Nav items come from `navigation:` in `_config.yml`.

| Section (anchor) | In nav | Data file | Notes |
|---|---|---|---|
| Hero | – | text in `index.html` | canvas + 4 labels; see **Hero animation** |
| Research `#research` | yes | `_data/research.yml` | `subtitle`, 3 `thrusts` (label, title, text, papers[label,url]), `foundations` |
| News `#news` | yes | `_data/news.yml` | newest first |
| Team `#team` | yes | `_data/team.yml` | `current` (cards) + `alumni` (list) |
| Lab Life `#lab-life` | yes | `_data/gallery.yml` | images in `assets/img/lab-life/` |
| Publications `#publications` | yes | `preprints.yml`, `publications.yml`, `proceedings.yml` | proceedings sit in a collapsed `<details>` |
| Software & Data `#software` | yes | `_data/software.yml` | cards |
| Teaching `#teaching` | yes | `_data/teaching.yml` | |
| Patents `#patents` | no | `_data/patents.yml` | plain text items |
| Funding `#funding` | yes | `_data/funding.yml` | |
| Footer `#contact` | – | `_layouts/default.html` | email, X, GitHub, LinkedIn, YouTube |
| **Resources page** `/resources/` | yes (`Resources`) | `_data/resources.yml` | separate page (`resources.html`); hero button "Join Our Research" links to `/resources/#apply` |

## Schemas (copy the pattern of existing entries)

YAML strings are double-quoted; inside them escape `"` as `\"` and write `&` as `&amp;`
when it is HTML text. Links inside `text` fields are raw HTML: `<a href=\"URL\">words</a>`.

**News** (`news.yml`, newest at top; `date` is `"Mon YYYY"`, or `"YYYY"` if only the year is known):
```yaml
- date: "Nov 2026"
  text: "PhD student Dineth Jayakody presented <a href=\"https://…\">Title</a> at …."
- date: "May 2026"
  kind: press            # optional: shows a "Press" tag
  text: "MIT News: <a href=\"https://…\">Headline</a>, on our … work with the … lab. Also covered by <a href=\"…\">EurekAlert!</a>."
```

**Publication** (`publications.yml`; grouped by `year` automatically, newest first; put new entries at the top of their year):
```yaml
- year: 2026
  authors: "Lastname, F. M., Jayakody, D., & Wadduwage, D. N.*"   # * = corresponding author
  title: "Sentence-case or original title, ending with a period."
  journal: "Optics Express"
  volume: "34(1)"        # optional; pages show only when volume is present
  pages: "1-14"
  doi: "10.1364/oe.546074"   # bare DOI → "DOI" link; else use url: "https://…" → "Link"
  press:                 # optional
    - name: "MIT News"
      url: "https://news.mit.edu/…"
```

**Preprint** (`preprints.yml`, newest first): `year`, `authors`, `title`, `venue: "arXiv:2606.07896"`,
`url`, optional `code` (repo URL → "Code" button; must be public), optional `label` (button text, default "arXiv").
When a preprint is published, move it to `publications.yml`.

**Proceedings** (`proceedings.yml`): `year` + `text` (full citation, venue in `<i>…</i>`). File header says it was synced from Google Scholar (Sep 2026).

**Team member** (`team.yml` → `current`):
```yaml
  - name: "Firstname Lastname"
    role: "Ph.D. Student"                 # existing roles: "Principal Investigator", "Ph.D. Student"
    bio: "Researching on …."              # one short sentence
    image: "/assets/images/firstname-lastname.png"
```
Headshots: `site/assets/images/firstname-lastname.png`, roughly square, about 215×215 px
(existing: 213×218, 213×223, 216×213), face centered (shown as a circle). Without `image`
a placeholder silhouette is shown. A commented placeholder for "Kai" exists in `team.yml`.
**Alumni**: `name`, `role` (current position, e.g. "Ph.D. Student, Princeton"; may be `""`),
`past` (e.g. "Former Postbac Fellow"), optional `url`.

**Software** (`software.yml`, newest first): `name`, `year`, `description` (one sentence),
`repo` (public URL), optional `paper`, `demo`, `doi` (bare Zenodo DOI; `""` hides it).

**Teaching** (`teaching.yml`, newest first): `course: "DASC 428/528"`, `title`, `term`
(e.g. "Fall 2025", "Online, first offered Spring 2027"), optional `design`
("newly designed course" / "fully redesigned"), optional `podcast: {name, url}`.

**Funding**: `years: "2025–2029"` (en dash), `name` (agency). **Patent**: `text` (full citation).

**Lab Life photo**: run `python3 tools/make_gallery_image.py <photo> <slug> site`
(writes `<slug>.webp` ≤1600 px and `<slug>-thumb.webp` 560×420, metadata incl. GPS stripped), then add
```yaml
- slug: "odu-new-space"
  when: "Dec 2025"            # or "Harvard · 2018–24", "Spring 2025"
  caption: "One factual sentence, ending with a period."
```
Order is chronological (oldest first). Ask before posting photos of identifiable people who
are not lab members, and never post home addresses or GPS data.

**Resources page** (`resources.yml`, added Oct 2026): sections `start` (5 cards), `apply`, `path` (`tracks[].items[]`
with `title`, `by`, optional `url`, `kind`, `time`, `note`, `ours: true` = assigned in the lab's courses, `core: true` = do first;
`exercises[]` with `from`, `time`, `text`), `papers` (per thrust: `label`, `url`, `why`), `code`, `work`, `writing`,
`arrival.groups[].items[]` (`text`, optional `intl: true`), `glossary`, `more`. Public links only (no Canvas, Drive,
Overleaf, Slack or private repos), no student names. Lab-practice statements were checked against the PI's own notes
and lab documents; keep them as stated practice, not promises (no funding or admission guarantees).
Review the page once a year and update `reviewed:`; re-run `../tools/check_links.py` (it scans `_data/*.yml`).

**Research thrust paper chips**: `label: "Short name · Venue Year"`, `url` (prefer `https://doi.org/…`).
Claims in `research.yml` were checked against the NIH biosketches (Feb 2026 and current); keep
aims phrased as aims, not results.

## Editing conventions

- Tone: formal, factual, third person ("Dushan Wadduwage was a delegate at …"; "PhD student X presented …"). No hype words, no informal asides.
- Dates: news `"Mon YYYY"`; year ranges with an en dash (`2025–2029`); terms "Fall 2025".
- Links: DOIs as bare DOI in `doi:` fields or `https://doi.org/…` in HTML; arXiv as `https://arxiv.org/abs/…`. Template-generated buttons open in a new tab; links written inside news `text` are plain `<a href>` (existing items do not add `target`), so keep that style.
- Names: use full names for lab members on first mention in an item; lab collaborators as "the Boyden and So labs".
- Images: WebP for photos, PNG for headshots; keep files small (gallery full ≤ ~400 KB, thumb ≤ ~60 KB). Always give `alt` text (templates use the caption/name).
- Accessibility: keep `aria-label`s on buttons, keep `prefers-reduced-motion` handling in `hero.js` and `scroll.js`.
- Layout: no horizontal overflow at 390 px (check `scrollWidth`). Long URLs or unbroken strings in text can break mobile.
- Do not add new sections or change the design unless asked; content changes go in `_data/`.
- CSS: `main.css` is layered; the active look is the **"Theme: Dither Lab"** block near the end (around line 584), which overrides earlier rules. Put new rules at the end.

## Hero animation (`assets/js/hero.js`)

Canvas `#hero-canvas` inside `.hero-band` draws scattering tissue → learned optics → sensor →
a small network (reconstruction) → image, with a 4×4 Bayer dither in the colors
`--hero-bg/--hero-c1/--hero-c2/--hero-c3` (set in the Dither Lab CSS block). It positions itself
to the right of `.hero-content` and places the four `.hero-label` spans from `index.html`
(`data-s` = short text used on narrow screens; ≤480 px CSS hides the middle labels).
It pauses off-screen, reacts to the pointer, and draws one still frame for reduced motion.
Do not rename `hero-canvas`, `hero-band`, `hero-content` or `hero-label`, and do not change
the number of labels without editing `hero.js`. After any change: screenshots at 1280 and 390,
no JS errors. The previous version is in `design/hero/hero_v5_before-sensor-stage_2026-10-01.js`;
`tools/hero_bench.py` benchmarks variants.

## Workflow for an update request

```bash
cd site
git pull --ff-only origin main          # others (e.g. Dineth, GitHub user dineth99-bit) also push to main
# edit _data/*.yml (and index.html / css only if needed)
bundle exec jekyll serve                # or ./serve.sh (no file watching) → http://localhost:4000
python3 ../tools/shot.py http://localhost:4000 ../_shots   # desktop 1280 + mobile 390, overflow + JS check
python3 ../tools/check_links.py .       # when links were added
git add -A && git commit                # see authorship rule
git push origin main                    # GitHub Pages rebuilds in ~1 min
```
Then open https://wadduwagelab.com (hard refresh) and confirm the change. Show the user the
screenshots for anything visual. For larger changes, work on a branch (e.g. `site-update-YYYY-MM`),
show screenshots, then merge to `main` when the user approves.

If Ruby/Jekyll is not available, `python3 ../tools/render.py . ../_render` then
`python3 ../tools/shot.py ../_render ../_shots` gives a close approximation.
`render.py` also renders `resources.html` to `_render/resources/index.html`; serve `_render` with
`python3 -m http.server 4173 --directory ../_render` and shoot `http://localhost:4173/resources/`.
Local Jekyll on a Mac: the system Ruby is too old for Jekyll 4.4, so use Homebrew Ruby
(`brew install ruby`, put it first on PATH), then `cd site && bundle install`. (A full local
Jekyll build was not run during the 2026 sessions; previews used `render.py`.)

**Git authorship rule (standing preference).** Commits are authored as the user, never as
Claude alone. `site/.git/config` already sets
`user.name = Dushan N. Wadduwage`, `user.email = 15632687+dushanw@users.noreply.github.com`
(the identity on all of his commits). End every commit message with
`Co-Authored-By: Claude <noreply@anthropic.com>`. Message style (from history): an imperative
summary naming the section, e.g. `News: add …`, `Software: add RIPPLE; add Zenodo DOIs …`,
with bullet details in the body for multi-part changes. Pushing needs the user's GitHub
credentials; if a push is not possible, leave the commit and tell the user to run `git push`.
Never force-push `main`.

**Running git from Claude's Cowork Linux VM (`device_bash`):** file deletion in connected folders
is off by default, and git must delete its `*.lock` files. A fetch/commit there leaves stale
`site/.git/index.lock` (and `objects/maintenance.lock`), which then blocks git on the Mac
("index.lock exists"). Before writing with git from the VM, ask the user for delete permission on
this folder (or have the user run git in Terminal). For read-only commands use
`GIT_OPTIONAL_LOCKS=0 git …`. If a stale lock is left behind, move it aside
(e.g. into `_transfer_archives/`), never leave it in `.git/`.

## Other web presence (keep consistent with the site)

| Item | Value | On the site? |
|---|---|---|
| Email | dwadduwa@odu.edu | footer |
| GitHub org | https://github.com/wadduwagelab | footer |
| X / Twitter | https://x.com/nawodya | footer |
| LinkedIn | https://www.linkedin.com/in/dushan-wadduwage-b496b82a/ | footer |
| YouTube | https://www.youtube.com/@WadduwageLab | footer |
| Course podcast "Tensor & Bias" (DASC 428/528) | https://open.spotify.com/show/033Aem6pMGVLeZftOmAEFj | Teaching ("Podcast" button) |
| Google Scholar | https://scholar.google.com/citations?user=LHmeoN4AAAAJ | **not linked** |
| ORCID | https://orcid.org/0000-0002-0689-9454 (from the CV) | **not linked** |
| Office | Room 217, Oceanography Building, Old Dominion University, 4600 Elkhorn Ave., Norfolk, VA 23529 | footer shows only "Old Dominion University, Norfolk, VA, USA" |
| Departments | School of Data Science, Department of Computer Science, Department of Physics | footer + JSON-LD in layout |

## Sources of truth

- **CV (current):** `career/ODU/_Watermark/2026_watermark/_upload_2026/CV - WADDUWAGE, DUSHAN.pdf`
  in the OCISHT folder (dated Oct 2, 2026). Publications, software, teaching, grants and titles should match it.
- **Publications:** Google Scholar (above); `reference/publications.md` in OCISHT is an older (Jun 2026) list.
- **Software DOIs:** Zenodo (see `related-repos.md`).
- **Annual review package (AY 2025–26, private):** `content-sources/annual-review-2026/` (text + PDFs). Use as a fact source only; do not publish pending grants, budgets, review scores, unpublished manuscripts or evaluation material.
- **Bios / research text:** `content-sources/bio-and-cv/` (NIH biosketches).
- **Photos:** `content-sources/website-content-for-claude/_photos/` (originals, HEIC/JPG).

## Known open issues (2026-10-03)

1. **Private repo linked:** `software.yml` (dbpm_d2nn `repo`) and `preprints.yml` ("Beyond the Thin-Layer
   Limit" `code`) point to `github.com/wadduwagelab/Differential-BPM-D2NN-official`, which is **private**
   (visitors get 404). A public repo `wadduwagelab/Differential-BPM-D2NN` (created 2026-10-01, same
   `dbpm_d2nn` package) exists; switch the links to it, or make `-official` public. Ask the user which.
2. **RIPPLE DOI missing:** the CV lists Zenodo DOI `10.5281/zenodo.23046883` for RIPPLE; `software.yml` has `doi: ""`.
3. **Team may be out of date:** M.S. student Sam Handel (joined 2026) is not listed; "Kai" is a commented
   placeholder; incoming PhD student Pabasara Jayawardhana starts Spring 2027. Confirm with the user before adding.
4. Google Scholar, ORCID and the office address are not on the site (see table above); add only if the user wants.
5. `site/README.md` still points to `wadduwagelab.github.io` rather than `wadduwagelab.com`.
6. The WACV 2025 entry in `publications.yml` has `pages` but no `volume` (so pages are not shown) and no `doi`/`url` (no link); the Research section links it as `https://doi.org/10.1109/WACV61041.2025.00067`.
7. Branch `site-update-2026-09` is fully merged into `main` (same commit); it can be deleted on GitHub when convenient.
