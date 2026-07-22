# Handoff: Ordo7 LinkedIn "Founder Log" Marketing Series

## Overview
A repeatable set of LinkedIn marketing graphics for **Ordo7** (ordo7.pro) — a plain-language schedule health-check tool for project managers. The series is founder-led ("building in public"): each post is a numbered **Founder Log** episode featuring founder **Taj Young**, a headline, a short body, and a `Follow the journey → ordo7.pro` CTA. This bundle contains the design source plus ready-to-post image renders.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype (`LinkedIn Founder Log.dc.html`) showing the intended look, plus exported JPG renders. They are **not production code to copy directly**. If you are storing this in a repo to generate future posts programmatically (e.g. a small template renderer), **recreate the layout in your target environment** (React/HTML-to-image, a Figma template, an SVG/Canvas generator, etc.) using your established patterns. The JPGs in `renders/` are final and can be posted as-is.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and layout. Recreate pixel-accurately if rebuilding.

## Deliverables (in `renders/`)
| File | Size | LinkedIn placement |
| --- | --- | --- |
| `founder-log-001-feed-1200x1500.jpg` | 1200×1500 (4:5) | Feed image post — max vertical space, shown uncropped |
| `founder-log-002-feed-1200x1500.jpg` | 1200×1500 (4:5) | Feed image post |
| `founder-log-001-cover-1200x627.jpg`  | 1200×627 (1.91:1) | Article / shared-link cover (feed crops square images here — use this ratio) |

**Format rule:** LinkedIn feed shows 1:1 and 4:5 uncropped — prefer **4:5** for reach. Link/article previews crop to **1.91:1**, so always use the 1200×627 cover there. Export as flattened JPG (no alpha) — transparent PNGs are rejected by some LinkedIn uploaders.

## Layout spec (Founder Log feed post, 1200×1500)
- **Canvas:** 1200×1500, radial gradient ground `radial-gradient(90% 110% at 24% 20%, #1b1e30 0%, #141626 52%, #0d0f1a 100%)`, 6px radius. Faint 96px blueprint grid overlay at ~5% white. 5px accent spine down the left edge fading to transparent at top/bottom.
- **Top lockup** (left 88px, top 96px): Ordo7 ring mark (`assets/mark.png`, 44px) inside a 64px spinning 1px ring, + wordmark "Ordo7" at 34px / weight 500 / letter-spacing -0.03em.
- **Portrait card:** ~404×520 rounded 18px, `assets/ceo-portrait.png` cover at `50% 0%` (headroom at top so the head never clips), bottom gradient scrim, name "Taj Young" 22px + "Founder & Developer" 14px. Soft accent halo behind. (Log 001 = portrait upper-left; Log 002 = portrait upper-right — alternate for rhythm.)
- **Content block** (left 88px): episode label `[ FOUNDER LOG — 00N ]` 16px / weight 600 / letter-spacing 0.28em / color `#d2cefd`; headline ~82px / weight 500 / line-height 1.03 / letter-spacing -0.025em (key phrase in `#d2cefd`); body 26px / color `#b2b6ca` / line-height 1.5; outlined CTA button.
- **CTA button:** transparent with 1px `#9184d9` border, 10px radius, label "Follow the journey → ordo7.pro" (arrow + url in `#d2cefd`), 20×34px padding, 25px weight-600 text. (Per Nocturne: primary actions are accent outlines, never filled.)
- **Footer** (left 88px, bottom 88px): pulsing 9px accent dot + muted caption line `#75798c` 17px.

## Design Tokens (Nocturne design system)
- **Ground:** `#0d0f1a` / `#141626` / `#1b1e30` (gradient stops); page backing `#0e1019`
- **Text:** primary `#e9e9ed`, muted `#b2b6ca`, faint `#75798c`
- **Accent (blurple):** `#9184d9`; light accent (text/links on dark) `#d2cefd`; accent border/edge `#4a4470`; accent tint panel `#2b2741` / border `#423a6a`
- **Type:** Inter, headings weight 500 (never bolder), body weight 400. Kicker/label: 600, letter-spacing 0.24–0.28em, uppercase.
- **Radius:** cards 16–18px, buttons/inputs 10px, container 6px
- **Motion (ambient, freeze for static export):** grid drift 16s, halo pulse 5s, CTA glow pulse 3.4s, mark ring spin 22s, live-dot pulse 1.8s, CTA sheen sweep 3.4s

## Assets
- `assets/mark.png` — Ordo7 ring/"7" logo mark, white on transparent (extracted from the supplied brand logo)
- `assets/ceo-portrait.png` — founder Taj Young, retouched (blemish/scalp cleanup) and cropped 0.69:1 with headroom so the head never clips
- Fonts: **Inter** (Google Fonts). Icons if extended: **Phosphor**.
- Full Nocturne design system lives at `_ds/nocturne-59babb18-6293-4a31-97ad-0e5ef6b4459e/` in the source project — the prototype links its `styles.css` + `_ds_bundle.js`.

## Recreating / extending the series (future logs 003, 004…)
Each new episode only needs: a new episode number, a new headline (keep the key phrase in `#d2cefd`), a 2–3 sentence body, and optionally a portrait side-swap. Everything else stays fixed. Suggested caption formula: hook line → the problem/story → what Ordo7 does → `Try It For Free → https://ordo7.pro` → 4–5 hashtags (#BuildInPublic #ProjectControls #Scheduling #SaaS #FounderJourney). CTA changed from "Follow the journey" to "Try It For Free" as of 2026-07-20 (see `../../docs/brand-narrative.md`'s changelog) — Logs 001–003 keep the original CTA as an accurate historical record.

## Files
- `LinkedIn Founder Log.dc.html` — the design source (all three pieces on one canvas). Note: it references the Nocturne bundle via `_ds/…`; to render it standalone, copy that `_ds` folder alongside, or just use the JPGs in `renders/`.
- `renders/*.jpg` — final, post-ready images.
- `assets/*` — logo mark + founder portrait used by the design.
