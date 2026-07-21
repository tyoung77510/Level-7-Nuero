# Founder Log render pipeline

Turns a data file into pixel-consistent Nocturne-design-system JPGs. Any day's graphic is one command away — no manual recreation in a design tool.

## Usage

```bash
cd schedule-health/marketing-assets/linkedin-founder-log/render
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node render.js example-data.json
```

Renders every entry in the data file to `../renders/founder-log-<episode>-<type>-<size>.jpg`. Pass `--only=003,007` to render a subset by episode number.

`example-data.json` reproduces Founder Log 001 (portrait left, feed + cover) and 002 (portrait right, feed only) — the two hand-built reference posts — as a regression check: re-run it any time the templates change and diff the output against what's already committed in `../renders/`. **Caveat as of 2026-07-20:** the CTA button text changed from "Follow the journey" to "Try It For Free" in the templates (see `../../../docs/brand-narrative.md`'s changelog), so re-running this against 001/002's committed renders will now show that one intentional diff — not a regression. Days 001–003's actual published renders correctly still show the old CTA, since those are locked historical record.

## Data file format

An array of entries:

```json
{
  "day": 3,
  "headline": "Your schedule says green. **Reality says red.**",
  "body": "Plain body copy, HTML-escaped automatically.",
  "footer": "New from the build, every week · ordo7.pro",
  "portraitSide": "left",
  "types": ["feed", "cover"],
  "headlineSize": 82,
  "kicker": "[ FOUNDER LOG — 003 ]"
}
```

- `day` (required) drives the zero-padded episode number (`3` → `003`) and the default kicker.
- `headline` — wrap the accent phrase in `**double asterisks**`; everything else is plain text.
- `body`, `footer` — plain text.
- `portraitSide` — `"left"` or `"right"` (default `"right"`).
- `types` — which formats to render: `"feed"` (1200×1500, always) and/or `"cover"` (1200×627, for blog/article link previews). Default `["feed"]`.
- `headlineSize`, `kicker` — optional overrides; usually leave these to the defaults.

## Templates

- `template-feed.html` — 1200×1500 (4:5) LinkedIn feed post.
- `template-cover.html` — 1200×627 (1.91:1) link/article cover, used for blog cross-posts.

Both are plain HTML with `{{TOKEN}}` placeholders filled by `render.js` — no build step. The text block sits at a fixed vertical position (not tuned per-post) so 1-line and 2-line headlines both render consistently across all 90 days without manual adjustment.

Source of truth for the design tokens (colors, type scale, spacing) is `../README.md` (the original Nocturne design handoff) — if the two ever disagree, the handoff doc wins and these templates should be corrected to match.
