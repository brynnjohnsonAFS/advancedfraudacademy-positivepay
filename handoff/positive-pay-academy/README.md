# Modern Positive Pay Academy — homepage handoff

A working, single-file HTML implementation of the Academy homepage. Drop it into any stack (Next.js, Astro, plain HTML, Webflow embed, etc.) and refactor from there.

## What's in this folder

```
positive-pay-academy/
├── index.html              ← Self-contained. CSS inlined. Open it in a browser; it works.
├── README.md               ← This file.
├── CLAUDE.md               ← Instructions for Claude Code agents working on this site.
└── split/
    ├── index.html          ← Same page, but with the design tokens linked as a stylesheet.
    └── tokens.css          ← The AFS design system tokens (colors, type, spacing, primitives).
```

**Pick one of two integration paths:**

- **Quickest:** drop `index.html` into a static site / CMS / hand-off. Done.
- **Cleaner:** use `split/index.html` + `split/tokens.css` and treat `tokens.css` as your global design token sheet. Add `<link rel="stylesheet" href="tokens.css">` to every other page in the site so the brand stays consistent.

## Tech notes

- **No JavaScript.** The page is 100% static HTML + CSS. The enrollment form posts directly to Pardot.
- **No framework.** Plain semantic markup. Convert to JSX / Astro components by lifting each `<section>` into its own component if you like.
- **Mobile responsive.** Breakpoints at 980px and 760px.
- **System fonts with Google Fonts fallback.** Currently loads **Manrope** as a substitute for the licensed **Aileron** typeface. When you obtain Aileron `.woff2` files, drop them into a `/fonts` folder and update the `@font-face` block at the top of `tokens.css`.

## Pardot form

The enrollment form posts to `http://go.advancedfraudsolutions.com/l/783193/2026-05-13/672cl`. **Field names** in the form match the v1 spec:

| HTML name | Pardot mapping (verify in Pardot) |
|---|---|
| `first_name` | First Name |
| `last_name`  | Last Name |
| `email`      | Email |
| `company`    | Company / Institution |
| `role`       | Custom — Role |
| `asset_size` | Custom — Asset Size |
| `pp_status`  | Custom — Positive Pay Status |

⚠️ Confirm each field exists in the Pardot form handler before going live. Pardot silently drops unmatched fields.

## Section inventory

The page is composed of these distinct sections, each in its own `<section>` in source order:

1. `header.nav` — Sticky white nav
2. `section.hero` — Dark rounded hero panel with floating decision-card mock
3. `.stats-grid` — 4 stat cards (5 tracks / 25 lessons / 5hr / 2 certs)
4. `.why` — "Why we built this" gray rounded panel
5. `#curriculum` — 5-track curriculum grid
6. Peer quotes — 3 quote cards
7. `#about .built` — "Built by AFS" dark panel with 3 inline stats
8. `#enroll` — Split enrollment section (pitch left, Pardot form right)
9. FAQ — 5 `<details>` accordions
10. `footer.footer` — Dark 3-column footer

## Brand rules to maintain

When you extend this site with new pages or components, **do not break these:**

- **Red is the signal color.** Use `#C70200` for the one thing per layout that matters: CTA, flagged item, key metric. Never for body copy or backgrounds with text on top.
- **Green `#ADE25D` is the icon container color, NOT a UI surface.** Use it as the rounded tile behind linework icons. Don't use it for buttons, sections, or text.
- **Overlines (UPPERCASE, 2.8px tracking, red) appear above every heading.** This is the most recognizable AFS brand element. Don't drop them.
- **Pill buttons** (`border-radius: 999px`) are the Academy CTA style. The parent AFS brand uses 8px-radius buttons; the Academy sub-brand gets pills.
- **Icons are linework only.** 1.75 stroke-width. No filled icons, no emoji, no unicode-glyph substitutes.
- **No stock photography.** No AI-generated illustrations. No drop shadows that look like 2017.
- **No bouncy animations.** Transitions are 120ms ease for color, 80ms for transform.

## Customization quickstart

The design tokens live in `tokens.css` (or in the inline `<style id="afs-tokens">` block in the single-file version). Common things to tweak:

```css
:root {
  --afs-red:        #C70200;   /* Primary CTA color */
  --academy-green:  #ADE25D;   /* Accent for "Modern" in H1 + check-list icons */
  --font-sans:      "Aileron", "Manrope", -apple-system, ...;
}
```

Page-specific styles are at the top of `index.html` inside the page's own `<style>` block — those override the tokens for the Academy sub-brand specifically (pill button radii, decision-card layout, etc.).
