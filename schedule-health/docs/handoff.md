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
- **Channel:** Zapier → LinkedIn. Call `list_enabled_zapier_actions` first, then use the
  **Create Share Update** action (`linkedin_create_share_update`, an `execute_zapier_write_action`)
  to post to the personal profile.
  - `comment` = the full caption above (required).
  - `visibility__code` = `anyone`.
  - Alternative: **Create Company Update** (`linkedin_create_company_update`) posts to the Ordo7
    company page instead — if that route is chosen, drop the redundant "Follow Ordo7 on LinkedIn"
    self-link.
- **This is a public, irreversible action.** Confirm the final copy with the owner (Taj) before
  posting — do not auto-publish without a go.

## Known limitation — text-only (no 005 graphic yet)
The series is normally an image post, but **renders exist only for 001 and 002**
(`marketing-assets/linkedin-founder-log/renders/`); there is no 005 graphic, and Zapier's share
action can only attach an image via a **public image URL** (a local repo file can't be attached).
So 005 posts as **text-only** unless someone first:
1. designs a Nocturne-style 005 graphic (spec + tokens in the design kit README), and
2. hosts it at a public URL to pass as `content__submitted_image_url`, **or** uploads the JPG
   manually as a native LinkedIn image using the caption above.

## Series convention note
The design-kit caption formula currently lists only one link (`ordo7.pro`). This 005 post
establishes the **three-link CTA block** (try-free + blog + LinkedIn page) as the going-forward
standard for every Founder Log caption — worth folding back into
`marketing-assets/linkedin-founder-log/README.md`.
