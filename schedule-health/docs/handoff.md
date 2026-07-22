# Handoff — Founder Log 005 (ready to publish)

**Status:** Staged, awaiting publish. Everything below is final; a new chat can pick this up and post it.
**Last Updated:** 2026-07-22

## Objective
Publish **Founder Log 005** to LinkedIn. It's the next episode in Ordo7's founder-led
"building in public" series (see the design kit at
`schedule-health/marketing-assets/linkedin-founder-log/README.md` and the voice rules in
`docs/brand-narrative.md`).

## What to post (final caption — post as-is)
Post to **Taj Young's personal LinkedIn profile** (founder voice). The third link points to the
Ordo7 **company page** on purpose — the personal post drives follows to the company page.

```
Founder Log 005

P6 was just the start. Ordo7 reads Microsoft Project now.

When I started, Ordo7 only spoke Primavera P6 — the tool most schedulers live in. But plenty of teams run Microsoft Project, and they were getting left out. So this week I shipped it: export your MS Project schedule to XML, drop it in, and get the same plain-language health check — what's actually wrong, scored 0–100, in about a minute. P6 or Microsoft Project, same 60 seconds.

→ Try it free: https://ordo7.pro
→ Read the blog: https://ordo7.pro/blog
→ Follow Ordo7 on LinkedIn: https://www.linkedin.com/company/ordo7/

#BuildInPublic #ProjectControls #Scheduling #MicrosoftProject #SaaS
```

### The three required links (confirmed)
| Link | URL |
|---|---|
| Try it free | `https://ordo7.pro` |
| Blog | `https://ordo7.pro/blog` |
| Ordo7 LinkedIn page | `https://www.linkedin.com/company/ordo7/` |

## Why this is the 005 topic (grounded, not fabricated)
005 is the **Microsoft Project support milestone**, which genuinely shipped this week: the backend
now parses MSPDI (MS Project "Save As → XML") in `backend/src/analyze.js`
(`parseMspXml`/`analyzeMspXml`), verified working end-to-end, with a regression test added in
`backend/test/analyze-msp.test.js` (PR #44). The brand-narrative voice rule is "reference the real
thing that changed that week — never fabricate," and this is real.

## How to publish (automated via Zapier)
Founder Logs 001–004 were posted through **Zapier automation** (not by hand), and 005 goes out the
same way. Two pieces have to line up:

1. **Host the image at a public URL.** Zapier can only attach an image it can *fetch from a URL* —
   it can't read a file straight from this repo. So the committed render (see "The image" below)
   must first be reachable at a public URL, hosted wherever 001–004's images were hosted.
   - **‹FILL IN: the public image URL / source the Founder Log Zap reads from (e.g. an
     `ordo7.pro/...` path, a CDN, or a Drive/Sheet the Zap watches)›** — this is the one field a
     picker-upper still needs from the owner.
2. **Post the caption + image through Zapier LinkedIn.** Call `list_enabled_zapier_actions` first,
   then **Create Share Update** (`linkedin_create_share_update`, an `execute_zapier_write_action`)
   to post to Taj's personal profile:
   - `comment` = the full caption above
   - `content__submitted_image_url` = the public 005 image URL from step 1
   - `content__submitted_url` = `https://ordo7.pro` (LinkedIn requires a Content URL whenever an
     image/title/description is set — this is what tripped an earlier attempt that passed an image
     field without it)
   - `visibility__code` = `anyone`
   - Company-page route instead: **Create Company Update** (`linkedin_create_company_update`) — if
     used, drop the redundant "Follow Ordo7 on LinkedIn" self-link.
   - Note: the MCP `share` action attaches the image as a link-preview. If the series' native 4:5
     look comes from a full Zap in the owner's Zapier account, that Zap consumes the *same* hosted
     image URL from step 1 — so hosting the render is the unblocking step either way.
- **This is a public, irreversible action.** Confirm the final copy with the owner (Taj) before
  posting — do not auto-publish without a go.

## The image — built and committed
The 005 graphic is done (Nocturne style, portrait upper-right, mirroring Log 002):
- **Render:** `marketing-assets/linkedin-founder-log/renders/founder-log-005-feed-1200x1500.png`
  — 1200×1500 (4:5), opaque PNG, LinkedIn-safe (no alpha). Post this as-is.
- **Source:** `marketing-assets/linkedin-founder-log/founder-log-005.html` — standalone; regenerate
  with headless Chromium (`chrome --headless=new --window-size=1200,1500 --screenshot=out.png
  file://…/founder-log-005.html`).

**To automate it, the render must be publicly hosted** (see "How to publish" step 1) so Zapier can
fetch it. The file is post-ready as-is; it just needs a URL.

_Fidelity note: the render environment blocked Google Fonts, so the type fell back to a system
sans-serif rather than Inter. Re-render the source in a design tool for pixel-perfect Inter if
desired._

## Series convention note
The design-kit caption formula currently lists only one link (`ordo7.pro`). This 005 post
establishes the **three-link CTA block** (try-free + blog + LinkedIn page) as the going-forward
standard for every Founder Log caption — worth folding back into
`marketing-assets/linkedin-founder-log/README.md`.
