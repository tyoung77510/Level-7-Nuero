# Direct LinkedIn API integration — scope

> **Status:** 📋 Scoped, not started | **Purpose:** What it would actually take to remove Zapier as the posting layer and support native video + comment posting, which the current integration cannot do. Referenced as "Phase 2" in `founder-log-posting-sop.md`; this is that plan, expanded. | **Last Updated:** 2026-07-26

## Why this exists
Checked directly (2026-07-26): the current Zapier LinkedIn connection exposes exactly two write actions (`create_share_update`, `create_company_update`), both link-card-only (text + a URL + an optional image URL). There is no field for a video file anywhere. The escape-hatch "raw API request" action only accepts a JSON body, and LinkedIn's native video upload requires a raw binary `PUT` as its middle step — so even that workaround can't reach it. **Native video posting is not achievable through the current integration, full stop, not a matter of finding the right parameters.** Comment-posting (needed for the Founder Log first-comment step) is a smaller gap of the same shape — no action exists for it either.

The only way to post real video, or post a comment programmatically, is LinkedIn's own API, direct, with our own registered app.

## What's actually required

### 1. LinkedIn Developer App
- Create an app at LinkedIn's Developer Portal, associated with the Ordo7 company page (already exists, `company_id: 142904113`).
- Request the **"Share on LinkedIn"** product for personal-profile posting (`w_member_social` scope) — historically near-instant/self-serve approval for basic posting.
- Request the **Community Management API** for company-page posting (`w_organization_social`) — this is **not self-serve**. It goes through LinkedIn's manual review. Approval timelines are opaque (historically anywhere from days to several weeks) and **not guaranteed**, especially for a small/new developer account with no prior API history. This is the real long pole, and the risk that this whole plan stalls indefinitely.
- Video posting access and comment-posting access both need to be confirmed against LinkedIn's *current* API docs before committing engineering time — LinkedIn has changed which products gate video access more than once, and what's true today may not match what's written in older documentation.

### 2. OAuth (separate from Ordo7's existing customer-facing LinkedIn login)
`backend/src/oauth.js` already has a LinkedIn OAuth flow — but that's for **Ordo7 customers signing into Ordo7 with their LinkedIn account**, a completely different app registration and purpose than **Taj's own app posting on Taj's own behalf**. These must not be conflated or share credentials.
- New 3-legged OAuth flow, scoped to `w_member_social` (+ whatever scope comment-posting turns out to need — verify, don't assume it's bundled).
- LinkedIn access tokens expire (historically 60 days); needs either refresh-token handling or a recurring re-auth reminder. No silent, indefinite automation without addressing this.

### 3. Video upload (3-step protocol)
1. `POST` to register the upload (owner URN, file size) → returns an `uploadUrl` and a video asset URN.
2. `PUT` the raw video bytes to that `uploadUrl` — this is the step nothing in the current Zapier setup can do.
3. Poll a status endpoint until LinkedIn finishes transcoding the video (not instant).
4. `POST` to create the actual post, referencing the video asset URN as its media.

### 4. Comment posting
A single `POST` to LinkedIn's comment/social-actions endpoint once auth is sorted — much simpler than video, contingent on that endpoint being available under whatever product tier gets approved.

### 5. Where this lives in the codebase
A new module, e.g. `backend/src/linkedin-poster.js`, separate from `oauth.js`'s customer-auth flow: token storage/refresh for Taj's posting app, the video upload sequence, post creation, comment posting. Token storage follows this repo's existing pattern — env vars / gitignored local secrets, never committed, everything degrades gracefully (posting features simply unavailable) if unset, consistent with how every other integration in this codebase already works.

## Realistic effort, split by what's actually uncertain
- **Engineering time, once API access is approved:** a few days — OAuth flow, the video upload sequence with polling, comment posting, testing against a real account. This part is bounded and predictable.
- **LinkedIn's approval process:** the actual unknown. Could be fast, could take weeks, could be denied outright for the company-page tier. This isn't something effort or time budget fixes — it's a third party's opaque review process.

## Recommendation
Not worth blocking the current 5-video trial on this — the approval step alone likely outlasts the trial's one-week window. Track this as a real next step once the trial's data is in and there's a decision to actually scale the raw-video series (or fix the Founder Log's first-comment gap) rather than starting the application process speculatively. Worth starting the LinkedIn Developer App registration and the "Share on LinkedIn" (personal-profile) request early, since that piece is usually fast and unblocks video-upload engineering work in parallel with waiting on the slower company-page review.
