# Handoff — Founder Log 005 (ready to publish)

**Status:** Staged, awaiting publish. Everything below is final; a new chat can pick this up and post it.
**Last Updated:** 2026-07-21

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

## How to publish (mechanics)
- **Preferred: manual native image post.** Upload the committed 005 render (see "The image" below)
  on LinkedIn and paste the caption above under it. Native feed images can't be posted through
  Zapier (see that section), so this is the intended path and gives the full 4:5 visual.
- **Text-only fallback via Zapier → LinkedIn:** call `list_enabled_zapier_actions` first, then use
  the **Create Share Update** action (`linkedin_create_share_update`, an
  `execute_zapier_write_action`) to post to the personal profile.
  - `comment` = the full caption above (required).
  - `visibility__code` = `anyone`.
  - Alternative: **Create Company Update** (`linkedin_create_company_update`) posts to the Ordo7
    company page instead — if that route is chosen, drop the redundant "Follow Ordo7 on LinkedIn"
    self-link.
- **This is a public, irreversible action.** Confirm the final copy with the owner (Taj) before
  posting — do not auto-publish without a go.

## The image — built and committed
The 005 graphic is done (Nocturne style, portrait upper-right, mirroring Log 002):
- **Render:** `marketing-assets/linkedin-founder-log/renders/founder-log-005-feed-1200x1500.png`
  — 1200×1500 (4:5), opaque PNG, LinkedIn-safe (no alpha). Post this as-is.
- **Source:** `marketing-assets/linkedin-founder-log/founder-log-005.html` — standalone; regenerate
  with headless Chromium (`chrome --headless=new --window-size=1200,1500 --screenshot=out.png
  file://…/founder-log-005.html`).

**Why the native upload is manual:** Zapier's LinkedIn Create Share Update only attaches an image
as a *link-card thumbnail* via a public image URL — not a native feed image. So to get the real
4:5 visual, upload the PNG by hand and paste the caption (the design kit says renders "can be
posted as-is").

_Fidelity note: the render environment blocked Google Fonts, so the type fell back to a system
sans-serif rather than Inter. Re-render the source in a design tool for pixel-perfect Inter if
desired._

## Series convention note
The design-kit caption formula currently lists only one link (`ordo7.pro`). This 005 post
establishes the **three-link CTA block** (try-free + blog + LinkedIn page) as the going-forward
standard for every Founder Log caption — worth folding back into
`marketing-assets/linkedin-founder-log/README.md`.
