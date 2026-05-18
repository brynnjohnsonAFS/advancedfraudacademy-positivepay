# CLAUDE.md — Modern Positive Pay Academy site

You are working on the Modern Positive Pay Academy — a free educational platform for community FI treasury professionals, built and maintained by Advanced Fraud Solutions (AFS). The site lives at **advancedfraudacademy.com/positivepay**.

## Audience

VP Operations, Chief Retail Officers, Treasury Management Officers, and Cash Management Officers at community FIs ($250M–$5B+ asset size). **Smart, time-starved, allergic to vendor pitches.** They want real operator knowledge, not corporate fintech content.

## Voice and tone — non-negotiable

- **Peer-to-peer, conversational.** Sound like a smart colleague wrote it, not a marketing department.
- **Confident, never preachy.** State facts. Don't sell.
- **No vendor-speak.** Forbidden phrases: "leverage," "synergies," "transform your business," "best-in-class," "revolutionary," "next-generation," "empower," "unlock."
- **Stats are a brand staple.** Lead with the number, never invent the digits. When you don't have a real number, write the copy without one.
- **No emoji. No exclamation points. No ALL-LOWERCASE FRIENDLINESS.**

When in doubt, read the existing copy in `index.html` and match its register.

## Brand rules — non-negotiable

These translate directly to code. Don't break them.

| Rule | Implementation |
|---|---|
| Red `#C70200` is the **signal** color | Use for one thing per layout: primary CTA, flagged item, key metric. **Never** for body copy or section backgrounds with text on top. |
| Green `#ADE25D` is **icon-container only** | Soft-green rounded square behind linework icons. **Never** a button, surface, or text color. |
| Overlines above every H1/H2 | `font-weight: 700; font-size: 12px; letter-spacing: 2.4–2.8px; text-transform: uppercase; color: #C70200;` |
| Pill buttons | The Academy uses `border-radius: 999px` on CTAs. (The parent AFS brand uses 8px — the Academy is the exception.) |
| Linework icons only | 1.75 stroke-width, single color, housed in a rounded tile. No filled icons. No emoji. No unicode glyphs. |
| Body weight is **Medium 500**, never Thin | Brand guide says Thin 300; on screen Thin reads as washed-out. We standardize on 500 for legibility. |
| No bouncy animations | 120ms ease for color, 80ms for transform. No springs, no elastic, no scale > 1.05x. |
| No drop shadows that look 2017 | Either no shadow, or a single soft 0 30px 60px rgba(0,0,0,0.08–0.10). |
| No glassmorphism, gradient meshes, AI-illustration art | Period. |
| No stock photos of business people | Use real customer logos (provided separately) or no photo at all. |

## Design system

All design tokens live in `tokens.css` (or the inlined `<style id="afs-tokens">` block in the single-file build). When extending the site:

- Pull color, type, spacing, radius, and shadow values from the existing CSS custom properties (`--afs-red`, `--s-4`, `--r-md`, `--shadow-md`, etc.). Don't hardcode hex values inline.
- The full AFS design system lives in a separate project (not in this repo). If you need an asset that isn't here (logo lockups, abstract graphics, additional UI kit components), **ask** before improvising.

## Component vocabulary in this homepage

These patterns repeat across the page. Reuse them on new pages:

- **Eyebrow / Overline** — `<span class="eyebrow">` — UPPERCASE, red, 2.4–2.8px tracking
- **Section head pattern** — Eyebrow → H2 → optional one-line subhead. Always in that order.
- **Pill chip** — `<span class="pill">` — green-tinted background, soft border, used for status / category tags
- **Track / pricing card** — White or muted-gray card with red eyebrow, big title, body, footer row with lessons count + status badge
- **Quote card** — Large green opening quote mark, body, thin hairline top border, all-caps attribution
- **Decision-card mock** — White card with flagged header, key-value rows, large amount, dual action buttons. Used to make the abstract concept of "Positive Pay" concrete.

## Code style

- **Plain HTML + CSS.** No build step required.
- **Semantic tags.** `<header>`, `<main>`, `<section>`, `<footer>`, `<details>` for accordions, `<form>` with native validation.
- **No JavaScript unless absolutely necessary.** The form posts to Pardot natively. FAQ uses native `<details>`.
- **Responsive via CSS Grid + media queries.** Breakpoints at 980px and 760px.
- **No CSS frameworks.** No Tailwind, no Bootstrap. Custom CSS keyed off the design tokens.

If you migrate to a framework (Astro, Next.js, etc.), preserve the section structure 1:1 — each `<section>` should become a component.

## The Pardot form

The form posts to `http://go.advancedfraudsolutions.com/l/783193/2026-05-13/672cl`. **Don't change the action URL** without coordinating with the AFS marketing ops team — Pardot routes leads based on the form handler ID embedded in that URL.

**Field names must match Pardot exactly.** Current names: `first_name`, `last_name`, `email`, `company`, `role`, `asset_size`, `pp_status`. Add new fields only after they exist in the Pardot form handler.

## When adding new pages

New pages should:
1. Link `tokens.css` in the `<head>`.
2. Use the same `.nav` and `.footer` markup as `index.html` (lift them into a partial when you migrate to a framework).
3. Open with a hero panel — either the dark rounded panel pattern or a light section-head pattern. Don't invent a third hero style.
4. Keep the same content max-width of `1184px` and `28px` side padding.

## When adding new tracks

Each track is a card in `#curriculum`. To add Track 06+:
1. Copy a `.track.muted` card block.
2. Update the track number, title, description, lesson count.
3. Once the track is live, remove the `muted` class and swap the `<span class="badge soon">` for `<span class="badge live">`.
4. To set as the featured "Start here" track, add the `featured-tag` element inside the card and remove `muted`.

## Things you'll probably be asked next

Likely follow-up requests:
- **Track detail page** (`/positivepay/track/01-foundations`) — lesson list, intro, enrollment CTA. Reuse the dark hero pattern and the curriculum-card aesthetic.
- **Lesson reader page** — long-form content with sidebar nav.
- **Member dashboard** — progress per track, certifications earned, downloadable templates.
- **Embed code for partners** — small white-label "Take the Academy" widget for partner FIs to put on their intranets.

For any of these, ask before designing from scratch — the AFS design system likely has reference patterns.
