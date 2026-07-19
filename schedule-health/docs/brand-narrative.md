# Brand narrative — Ordo7 Founder Log

Context for anyone extending Ordo7's marketing: the story this product is told through, and how it should stay consistent across LinkedIn, the ordo7.pro blog, and social-ad assets.

## The narrative thesis

Ordo7 isn't marketed as a generic SaaS product. It's marketed as one founder's response to a problem he lived: scheduling and project-controls software has been powerful but hostile to use for years, and nobody who actually does the work built something for the person doing it at 4:45pm before a status meeting. Taj Young — Founder & Developer, with a real background in project management / project controls — is building Ordo7 in public and documenting the build as it happens.

This is a "build in public" strategy: the goal right now is **audience before ask**. The near-term CTA is "follow the journey," not "buy now." Trust and a following get built first; monetization/adoption asks come once there's an audience that's watched the thing get built and believes in it. Don't front-load a hard sell — it breaks the format and the trust it depends on.

## What's confirmed (do not deviate from this)

**Founder Log — 001** (first published entry):
- Headline: *"Scheduling's been broken for years. I decided to fix it."*
- Subhead: *"I'm a developer building Ordo7 in the open — the project-controls tool professionals keep asking for. Follow the build, step by step."*
- CTA: *"Follow the journey → ordo7.pro"*
- Byline: Taj Young, Founder & Developer
- Visual style: dark navy/near-black background, subtle grid pattern, founder headshot on the right in a bordered card, "Founder Log — 001" as a small tracked-letterspacing label above the headline.

This entry establishes the template for every future Founder Log post: numbered sequentially (002, 003, ...), each one documenting a real build milestone, decision, or problem encountered — not generic motivational content.

## Voice guidelines for Founder Log content

- **First person, not corporate.** This is Taj talking, not "Ordo7 the company." "I decided to fix it," not "Ordo7 was founded to address..."
- **Specific over vague.** Reference the actual thing that changed that week — a feature shipped, a real user's frustration, a design decision and why. Never a content-free "big things coming!" post.
- **Same bluntness as Level 7's brand voice**, but more personal — this is Taj's voice, not the institutional "Truth-Teller" voice used for Level 7 Consulting client-facing material. Direct, no jargon, contractions welcome, no corporate speak ("synergize," "leverage," "best-in-class" are still banned here).
- **Don't fabricate.** No invented metrics, no invented user testimonials, no invented milestones ahead of when they're real. This mirrors the product's own "don't fabricate metrics" rule in `design-notes.md` — the brand narrative holds itself to the same honesty standard the product does.

## Channel application

| Channel | Format | Notes |
|---|---|---|
| LinkedIn (Taj's personal profile) | Native post, Founder Log framing, image or short video | Primary channel — personal accounts get more organic reach for founder-led narrative than a company page |
| ordo7.pro blog (`backend/src/blog-content.js`) | Longer-form version of the same entry, SEO-oriented | Same story, more detail, more room to explain the "why" behind a build decision |
| Social ads (`marketing-assets/social-ads/`) | Short vertical video, same headline/hook | Visual-first, headline must survive without sound |
| Facebook (`marketing-assets/facebook/`) | Same asset library as social-ads | Same rule: consistent hook and CTA across placements |

The rule for "consistent across channels": **the hook, the core claim, and the CTA stay identical everywhere** — only the format and length adapt per channel. If a LinkedIn post says "Scheduling's been broken for years," the blog version and the ad script should open on the same claim, not a rephrased one. Drift here is how a brand narrative stops feeling like one person's story.

## What's needed from Taj to keep building this out

This doc can only go as far as confirmed facts. To draft more Founder Log entries or the long-form origin story, the following real specifics are needed — none of this should be invented:

- The actual project-controls/PM background (companies, roles, years — as much as you're comfortable sharing publicly)
- The specific recurring problem/moment that triggered building Ordo7 (a real project, a real frustration)
- A rough timeline of the build so far, for sequencing future Founder Log entries (002, 003, ...)
- What "support" concretely means once the audience-building phase converts — paid beta, waitlist-to-launch, pre-orders, something else — since the CTA evolves once it stops being pure "follow the journey"

## Obsidian / cross-references

- [[../CLAUDE.md]] — product overview and architecture
- [[design-notes.md]] — product thesis and UX principles this narrative should stay consistent with
- [[../marketing-assets/README.md]] — asset inventory this content plan feeds
