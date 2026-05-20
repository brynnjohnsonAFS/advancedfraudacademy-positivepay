# Modern Positive Pay Academy

Source for **advancedfraudacademy.com** — a free educational platform for community FI treasury professionals, built and maintained by Advanced Fraud Solutions (AFS). The site is a top-of-funnel content play for AFS's Positive Pay product line.

This README is the cold-start handoff document. Anyone picking this up without prior context should be able to deploy a fix and understand the system within an hour.

---

## At a glance

| Item | Value |
|---|---|
| **Production URL** | https://advancedfraudacademy.com |
| **Live academy** | https://advancedfraudacademy.com/positivepay/ |
| **Hosting** | Vercel (auto-deploys from `main` on GitHub push, ~60s to live) |
| **Tech stack** | Static HTML + vanilla JS, no framework, no build step |
| **Serverless runtime** | Vercel Node.js (CommonJS handlers in `/api/`) |
| **Local dev** | Any static HTTP server on port 4200 (see "Running locally") |
| **Owner / lead** | Brynn Johnson, VP Marketing |
| **AI-assisted edits** | Most content changes are made via Claude Code (see "Editing workflow") |

---

## Repo layout

```
.
├── index.html                          # Root redirect to /positivepay/
├── api/                                # Vercel serverless functions
│   ├── track.js                        # Activity tracking proxy → Make webhook → Google Sheets
│   ├── fraud-news.js                   # News aggregator endpoint (returns JSON)
│   └── _lib/
│       └── fraud-news-core.js          # Shared aggregation logic
├── emails/
│   └── track-1-welcome.html            # Pardot-uploaded enrollment email template
├── positivepay/                        # All academy pages live here
│   ├── index.html                      # Homepage with hero, enrollment form, FAQ
│   ├── start/index.html                # Diagnostic flowchart ("Find your starting point")
│   ├── curriculum/index.html           # 5-track overview with lesson lists
│   ├── about/index.html                # About + Inc. 5000 mention
│   ├── product/index.html              # Product page with Objections section
│   ├── news/index.html                 # Fraud news feed (consumes /api/fraud-news)
│   ├── certificate/index.html          # Track 1 / Track 5 completion certificate
│   ├── thank-you/index.html            # Post-enrollment thank-you page
│   ├── terms/index.html                # Terms page
│   ├── track-1/ ... track-5/           # 5 tracks, each with index + lesson-N subfolders
│   │   └── lesson-N/index.html
│   ├── images/
│   │   ├── exceptions-lesson-NN-*.png  # Lesson screenshot assets
│   │   └── sources/                    # HTML sources for mockup images (Chrome-headless rendered)
│   └── assets/
│       ├── tokens.css                  # AFS brand tokens (colors, type, spacing)
│       ├── styles.css                  # Main stylesheet
│       ├── app.js                      # Progress tracking, quizzes, enrollment gate, news ticker
│       ├── afa-logo.png                # Academy logo (dark — invert for white)
│       ├── cert-og.html                # Source for certificate LinkedIn OG image
│       └── cert-og.png                 # Generated OG image (Chrome headless)
└── handoff/                            # Earlier handoff materials (largely archival)
```

---

## Deploy / release flow

1. Edit a file in your editor (or via Claude Code)
2. `git commit` and `git push` to `main`
3. Vercel detects the push, rebuilds (~30–60s)
4. Live at `advancedfraudacademy.com`

**There is currently an auto-commit watcher** that commits and pushes on every file save during Brynn's working sessions. This is why you'll see many small `Update <file>` commits in the log — that's the watcher, not a human. If Brynn isn't using it, manual `git push` works the same way.

**Rolling back:** Vercel keeps every deployment. To revert, find the previous deployment in the Vercel dashboard and click "Promote to Production." No git revert needed.

---

## Running locally

The repo has no `package.json` and no build step. Any static HTTP server works:

```bash
# Python (built into macOS)
cd "/path/to/repo"
python3 -m http.server 4200

# Or with Node's http-server (if installed)
npx http-server -p 4200 -c-1
```

Then open `http://localhost:4200/positivepay/`.

**Serverless functions don't run on a plain HTTP server.** To test `/api/track` or `/api/fraud-news` locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev      # runs on port 3000, serves the site + the API functions
```

---

## Editing workflow (the AI-assisted way)

Brynn's primary workflow is Claude Code (Anthropic's terminal-based agent). For any content edit, the pattern is:

1. Describe the change in plain English in a Claude Code session
2. Claude makes the edit, the auto-commit watcher pushes, Vercel deploys
3. Hard-refresh the page to verify

This is dev-friendly and very fast (multiple shipped changes per hour), but **every edit is a code edit** — there's no CMS layer. If a future maintainer prefers traditional CMS-driven editing, the academy would need a headless CMS (Sanity, Contentful) bolted on, or a full platform migration (Webflow, etc.).

---

## Integrations + secrets

| Integration | Where it lives | Secret material |
|---|---|---|
| **Pardot** (Salesforce marketing automation) | Tracking code on every page. Business Unit ID `784193` (piAId), Account `199064` (piCId). Forms POST to `https://go.advancedfraudsolutions.com/l/783193/...` | piAId + piCId are public client-side IDs. No secret to protect. |
| **Make webhook** | `api/track.js` forwards all tracked events as JSON to a Make webhook → Google Sheets pipeline | The webhook URL is **currently hardcoded in `api/track.js`**. Should be moved to a Vercel env var. |
| **News aggregator sources** | `api/_lib/fraud-news-core.js` defines 10 public RSS/Atom feeds (FBI, DOJ, Krebs, SecurityWeek, ABA Banking Journal, BleepingComputer + 4 Google News searches) | None — all sources are public. |
| **Google Sheets** (audit log destination) | Receives data via the Make webhook | No direct integration from this codebase. Lives in Make. |

**Vercel environment variables:** none configured today. The Make webhook URL is the one secret that should be moved to a Vercel env var (`MAKE_WEBHOOK_URL`) — see Tier 1 hardening below.

---

## Access list (who has what)

> **TODO** — fill in once the GitHub org transfer + Vercel team setup happens.

| System | Current owner | Should also have access |
|---|---|---|
| GitHub repo | `brynnjohnsonAFS` (personal-ish) | Transfer to AFS org; add Travis + leadership as admin |
| Vercel project | (whoever owns the linked account) | Add Travis to the Vercel team |
| Make scenario | Brynn | Add IT/Travis as collaborator |
| Pardot Business Unit | AFS Salesforce admin | (already org-wide) |
| Domain DNS for advancedfraudacademy.com | (verify) | Confirm AFS owns the domain registrar account |

---

## Site-wide invariants worth knowing

These are the things you might unintentionally break if you don't know they're there:

### Lesson count is 26 across 5 tracks
Currently: Track 1 (6 lessons), Tracks 2–5 (5 each). If you add/remove a lesson, the count must be updated in:
- `positivepay/index.html` (5 places)
- `positivepay/curriculum/index.html` (3 places)
- `positivepay/about/index.html` (2 places: "Twenty-six lessons" + "5 tracks, 26 lessons")
- `positivepay/start/index.html` (1 place)
- `positivepay/thank-you/index.html` (1 place)
- `positivepay/track-5/lesson-5/index.html` (closing prose)

### The exceptions lesson is currently suppressed
`/positivepay/track-2/exceptions/` exists but is unlinked from all navigation and has `<meta name="robots" content="noindex,nofollow">`. Source file has an HTML comment at the top explaining how to re-enable. Waiting on data-dictionary screenshot retakes (see below).

### Data dictionary swaps for product screenshots
The exceptions lesson contains 9 product screenshots. They were taken from a demo environment without applying the rename dictionary the brief specified. Before the lesson goes public, screenshots should be retaken with:

| Original | Replace with |
|---|---|
| Brynn Johnson (user name in UI) | Sarah Mitchell |
| Lile Distribution | Cedar Valley Distribution |
| Hamilton & Hammer Co. | Northbridge Manufacturing |
| Indiana Bones Doggy Daycare | Riverside Veterinary |
| Alex's Auto Repair | Metro Auto Service |
| Sunshine Flowers | Greenfield Florists |
| Joe's Custom Classics | Heritage Classic Cars |
| Jim's Automotive | Highway Auto Group |
| Real payee names (Javon Williams, John Tolkien, John Deer, etc.) | Stock names: John Smith, Jane Doe, Robert Johnson, Mary Williams, James Brown |

### Brand-neutral language ("FI" not "bank" / "credit union")
AFS serves both banks and credit unions. To stay rivalry-neutral, the site uses "financial institution," "FI," or "community FI" everywhere — never "bank" or "credit union" as a customer descriptor. Exceptions: "big banks" as a competitive segment (vs community FIs) is fine; product/feature names like "Credit Union Service Organization (CUSO)" are real industry terms.

### Inc. 5000 mention
AFS is an 8-time Inc. 5000 honoree. This appears as a small italicized byline on:
- Homepage "Built by AFS" section
- About page "Who's behind it" stat column

Keep it understated (italic, small, muted). Don't promote it to a hero claim.

### Fraud news ticker auto-injects via app.js
The footer ticker on every page is rendered client-side from `/api/fraud-news`. If you ever change the footer markup, make sure the ticker JS in `assets/app.js` can still find `footer.footer` to inject above it.

### Pages that don't load `app.js`
Most pages load `assets/app.js` for progress tracking, news ticker, etc. Pages that **don't need it** can skip it, but pages that **should have it and don't** will silently miss features. The top-level marketing pages (homepage, about, curriculum, product, news, start) all include it now.

---

## Known gotchas

1. **macOS screenshot filenames use U+202F (narrow no-break space)** before "PM" — not a regular space. Any script that processes screenshot filenames literally will fail. Use glob patterns or `find` instead.
2. **Vercel security checkpoint** can block headless curl/automated requests. Use a realistic browser User-Agent string if you need to script-fetch the site.
3. **`/api/track` accepts any payload from any origin** (CORS wildcard, no auth). Don't add anything sensitive to the request payload — assume it's public.
4. **The enrollment "gate" is localStorage-based** — not a security boundary, just UX. All lesson content is public if someone bypasses the gate.

---

## Tier 1 security hardening

| # | Item | Status |
|---|---|---|
| 1 | Move the Make webhook URL from `api/track.js` to a Vercel env var (`MAKE_WEBHOOK_URL`) | **Open** — requires setting up the env var in the Vercel dashboard, then updating `api/track.js` to read it |
| 2 | Restrict `Access-Control-Allow-Origin` on `/api/track` from `*` to a fixed allowlist | **Done** — `ALLOWED_ORIGINS` set covers `advancedfraudacademy.com` + `*.vercel.app` previews. Unallowed origins are server-rejected with 403 *before* the Make webhook is hit, so cross-site abuse can't pollute the audit log even if the browser CORS check is bypassed. |
| 3 | Add basic rate limiting to `/api/track` | **Open** — even a naive IP-based limit (10/min) would meaningfully raise the abuse cost |
| 4 | Add a Content Security Policy header via `vercel.json` | **Open** |
| 5 | Add hCaptcha or Cloudflare Turnstile to the enrollment form | **Open** — kills bot signups, helps Pardot list hygiene |

---

## Common edit patterns

### Adding a new lesson
1. Create `positivepay/track-N/lesson-X/index.html` (copy an existing lesson as a template)
2. Add the lesson card to `positivepay/track-N/index.html`
3. Update the previous lesson's "next" nav link
4. Add the lesson row to `positivepay/curriculum/index.html`
5. Bump the lesson count in the 6 places listed above

### Adding a fraud-news source
Edit the `FEEDS` array in `api/_lib/fraud-news-core.js`. Each entry: `{ name, type: 'rss' | 'atom', url, googleNews?: true }`. The aggregator handles parsing, deduplication, and audience filtering automatically.

### Renaming a lesson URL
Don't. The diagnostic at `/positivepay/start/` hardcodes paths like `/positivepay/track-1/lesson-1/`. If you rename, also update the `LEAVES` object at the top of `positivepay/start/index.html`. Search the repo for the old URL before renaming.

### Adding a new top-level page
1. Create the page HTML following the structure of existing pages (use about/index.html as a template)
2. Add to nav on all 6 top-level pages: homepage, about, curriculum, product, news, start
3. Add to the footer Academy column on the same 6 pages
4. Add to `positivepay/start/index.html` if it should appear in the diagnostic results

---

## Contacts

| Role | Person |
|---|---|
| Project owner / content lead | Brynn Johnson (VP Marketing, AFS) |
| Developer / IT | Travis |
| AFS organization | https://advancedfraudsolutions.com |
