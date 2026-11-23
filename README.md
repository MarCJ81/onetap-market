# OneTap Market · 원탭 마켓

A two-market shelf: **verified no-signup web apps**, readable in English and Korean,
with a liveness check stamped on every card. It is the global-facing counterpart of
`apps/portal-hub` (the Korean-only hub) — same catalogue, different job: a distribution
surface that outside makers can submit to.

- Live target: `https://marcj81.github.io/onetap-market/` (repository name `onetap-market`)
- Version: **1.4.0** (2026-11-23) — 29호기 `onetap-clip-factory` (OneTap Clip
  Factory / 원탭 클립 팩토리) joins the shelf, so the list is **29 listings**.
  The `Free AI taste` badge still follows the code instead of a guess: every app
  that really calls the free AI server carries it (16 of 29 — the 14 BYOK studios
  plus `ad-law-checker` and `price-radar-kr`, which call the same server while
  keeping the plain `free` price label). Also on the shelf: 27호기
  `onetap-team-room` and 28호기 `onetap-ad-audit`, the last check
  time printed on every card front (`Checked 11/23 18:58 KST` / `점검 11/23 18:58`),
  the full date and the age in the tooltip and the detail modal, and 1.1.0's
  per-app feedback, version history and creator update request
- Files: `index.html` · `privacy.html` · `styles.css` · `i18n.js` · `core.js` · `app.js`
  · `data/apps.json` · `data/apps.bundle.js` · `scripts/` · `.github/workflows/daily-verify.yml`
  · `assets/fonts/` (local PlexKR, no CDN)

## What makes it different from a link list

1. **Three badges plus one, backed by data** — `Live checked` (HTTP 200 from the checker),
   `No signup` (the URL opens the app, not a gate), `Free` or `Free · BYOK`
   (own API key optional), and `Free AI taste` on the 16 apps that finish in free
   mode without a key and take the visitor's own OpenAI · Gemini · Claude key for
   the Pro pass (14 studios on the `Free · BYOK` label, plus `ad-law-checker` and
   `price-radar-kr` on the plain `Free` label). The one paid service in the catalogue is labelled
   `Paid service` instead, so the badge never lies. Each card front also prints
   the time of that check (`Checked 11/23 10:08 KST` / `점검 11/23 10:08`), so a
   visitor can see how fresh the verdict is without opening anything.
2. **EN / KO in one tap** — the whole interface, the card copy, the badges, the filters,
   the submission form and the page `<title>`/meta description switch. Browser language
   decides the first load; the choice is remembered in `localStorage` (`otm.lang`).
3. **29 seeded listings** — 26 Korean + 3 global English (`ics-viewer-online`,
   `invoice-receipt-pl-generator`, `llm-cost-llms-txt`). Korean apps carry an English
   summary too, so an English visitor is never shown a blank card.
4. **A submission pipeline that works at zero cost** — the form builds a pre-filled
   GitHub issue URL *and* the exact JSON object to paste into `data/apps.json`.
5. **Feedback and version history on every card** — the detail modal lists the app's
   releases (version, date, EN/KO note), and its feedback is read from the public
   GitHub issues labelled `feedback`, filtered to that app. Nothing needs a server.
6. **Updates ship through the same door** — the submit modal's second tab asks for the
   app, the new version, the live URL and what changed, previews the JSON patch it
   would apply, and opens an issue labelled `update`.

## Layout

| Path | What it is |
| --- | --- |
| `data/apps.json` | Source of truth: meta, categories, 28 listings with `httpStatus` + `lastChecked` |
| `data/apps.bundle.js` | Generated from the JSON so the page also works opened from disk (`file://`) |
| `core.js` | Pure logic (UMD): filter, search, sort, stats, stamps, validation, issue URL |
| `i18n.js` | EN/KO strings, identical key sets |
| `app.js` | DOM wiring: render, language toggle, detail modal, submission modal, toasts |
| `scripts/verify-apps.mjs` | Real HEAD/GET check of every URL, rewrites JSON + bundle |
| `scripts/build-data.mjs` | Rebuilds the bundle from the JSON |
| `.github/workflows/daily-verify.yml` | Runs the checker at 04:10 KST and commits the new stamps |

## Data schema

```json
{
  "id": "price-radar-kr",
  "no": 26,
  "slug": "price-radar-kr",
  "url": "https://marcj81.github.io/price-radar-kr/",
  "name": { "en": "Price Radar KR", "ko": "깜깜이 시세 레이더" },
  "category": "business-docs",
  "languages": ["ko"],
  "noSignup": true,
  "pricing": "free",
  "short": { "en": "…", "ko": "…" },
  "long": { "en": "…", "ko": "…" },
  "features": { "en": ["…", "…", "…"], "ko": ["…", "…", "…"] },
  "httpStatus": 200,
  "lastChecked": "2026-11-22T02:05:41.000Z",
  "version": "v2.0.0",
  "changelog": [
    { "version": "v2.0.0", "date": "2026-11-22",
      "notes": { "en": "Pro mode: free without a key, higher quality with your own key.", "ko": "Pro 모드: 키 없이 무료, 내 키를 넣으면 더 높은 품질." } },
    { "version": "v1.0.0", "date": "2026-11-22",
      "notes": { "en": "Initial build on the shelf: …", "ko": "첫 공개 빌드: …" } }
  ]
}
```

- `version` is `vX.Y.Z` and always equals `changelog[0].version`; the changelog is
  newest-first, one to four releases, each with an EN and a KO note. Seven apps carry
  the Pro dual engine as `v2.0.0` and the rest started on the shelf at `v1.0.0`; a fix
  ships as a patch on top of that release (2026-11-22: one at `v2.0.1`, four at `v1.0.1`).

- `category` is one of six fields: `ai-content` · `marketing-sns` · `tax-finance` ·
  `business-docs` · `dev-security` · `life-utility` (0 listings, open for outside
  developers — the empty shelf shows a submission CTA instead of a dead end).
- `pricing` is `free`, `free-byok` (Pro output with your own key) or `paid`
  (a human service; add `priceNote` and the card turns amber).
- `freeAi: true` paints the `Free AI taste` badge and feeds the filter toggle: the
  app finishes in free mode with no key and takes the visitor's own OpenAI · Gemini ·
  Claude key for the Pro pass. Set it only after checking the app's own code calls
  `https://free-ai-taste.onetap-ai.workers.dev` (or `generateFree()`); it is not tied
  to the `free-byok` price label — 16 of 29 carry it, 14 `free-byok` studios plus
  `ad-law-checker` and `price-radar-kr`.
- `wide: true` makes the card span two grid columns (used by the three newest, 27, 28
  and 29, so the last row of the 4-column grid closes).
- `httpStatus` and `lastChecked` are written by the checker — do not hand-edit them.

## Run it

```bash
node scripts/build-data.mjs      # refresh the bundle after editing the JSON
node scripts/verify-apps.mjs     # real liveness check; rewrites JSON + bundle
node scripts/verify-apps.mjs --dry               # check only
node scripts/verify-apps.mjs --only price-radar-kr

node test.js                     # unit tests
python3 uitest.py                # real Chrome: EN/KO, filters, modals, 390px, screenshots
```

`uitest.py` serves the folder over HTTP (not `file://`) and writes
`preview-en.png`, `preview-ko.png`, `preview-submit.png`, `preview-mobile.png`
(plus `preview-full-en.png`, the whole desktop page).

The published repository carries the site only. The test harness (`test.js`,
`uitest.py`) and the preview PNGs stay in the local working folder and are listed in
`.gitignore` — they are shipped to nobody and served from nowhere.

Current state: **830 unit checks**, **316 browser checks**, 0 failures;
29/29 listings answered HTTP 200 on 2026-11-23 24:09 KST.

## Feedback and updates at zero cost

- The detail modal reads
  `https://api.github.com/repos/MarCJ81/onetap-market/issues?labels=feedback&state=open&per_page=30`
  once per card per visit, without credentials, and keeps only the issues whose body
  names that app's slug (or whose title names it). A 403 rate limit, an offline browser
  or an unexpected payload never breaks the card: the list is replaced by a notice and
  a link to the issue list, and the form below still builds its URL.
- The feedback form asks for an optional nickname, a kind (bug / feature / usage note)
  and the message, then opens an issue titled `[Feedback: <app>] <kind>` labelled
  `feedback`, with the slug, version and text in the body. A visitor without a GitHub
  account can copy the same text instead.
- The update tab builds `[Update] <app> <version>` labelled `update` plus the JSON patch
  (`version` + a prepended `changelog` entry dated in KST) that `data/apps.json` needs.
- This one GET is the only request the page makes, and `privacy.html` says so.

## Accepting a submission

0. The repository must exist first. Until `MarCJ81/onetap-market` is created, the
   prefilled issue URL answers 404 — the form still builds the correct URL, but GitHub
   has nowhere to put the issue.
1. The maker fills the form on the page → **Open prefilled GitHub issue** → the issue
   lands in `MarCJ81/onetap-market` with the JSON already in the body.
2. Paste that JSON object into `apps` in `data/apps.json`, then run
   `node scripts/verify-apps.mjs --only <id>` to stamp the real status.
3. `node scripts/build-data.mjs && node test.js`, commit, push.
4. The daily action keeps the timestamp honest from then on.

## Deploy (repository name `onetap-market`)

```bash
# new repository named onetap-market, folder published at /
gh repo create MarCJ81/onetap-market --public --source=. --remote=origin --push
# or: create it on GitHub, then from this folder
git init -b main && git add -A && git commit -m "feat(onetap-market): v1.0.0 verified market" \
  && git remote add origin https://github.com/MarCJ81/onetap-market.git && git push -u origin main
```

`.github/workflows/daily-verify.yml` travels with the commit; enable Actions so the
04:10 KST check can commit new timestamps back to `main`.

GitHub Pages: publish from `main` → `/ (root)`, then check
`UITEST_BASE=https://marcj81.github.io/onetap-market python3 uitest.py`.

## Rules this project keeps

- No tracker, no CDN, no analytics, no ad script, no remote font. The only third-party
  request is the read-only GitHub API call that loads a card's feedback — disclosed in
  `privacy.html` and made without credentials. The only outbound links are the listings
  themselves and the GitHub issue intake.
- No personal data in the source: no real names, phone numbers, account ids or blog
  names. Creator attribution is `OneTap Labs` / `MarCJ81`. `test.js` enforces this by
  string search over the shipped files.
- Everything is static: HTML, CSS, one JSON file and plain JS. Cost to run is zero, so
  listing stays free.
