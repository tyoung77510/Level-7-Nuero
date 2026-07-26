# LinkedIn Developer App registration — ready-to-submit packet

> **Status:** 📋 Ready for the owner to submit | **Purpose:** Every field, value, and decision needed to register the LinkedIn developer app from `linkedin-direct-api-scope.md`, so it's a five-minute form-fill instead of a research task. This requires logging in as a human with admin rights on the Ordo7 LinkedIn page — no AI/automation can do this step. | **Last Updated:** 2026-07-26

## Before you start
You'll need to be logged into LinkedIn as an admin of the **Ordo7 Company Page** (`company_id: 142904113`) — app creation requires associating the app with a Page you administer.

## Step 1 — Create the app
Go to **linkedin.com/developers/apps** → **Create app**.

| Field | Value |
|---|---|
| App name | `Ordo7` |
| LinkedIn Page | Ordo7 (search and select the existing page — `company_id: 142904113`) |
| App logo | Square image, LinkedIn requires min 100×100px (300×300 recommended). **No dedicated app-icon asset exists in the repo yet** — use a square crop of the Ordo7 wordmark/icon, or I can generate one (navy `#476ab0` / orange `#f37443`, per brand) if you want — just ask. |
| Legal agreement | Check the box agreeing to the API Terms of Use — this has to be you, not something I can accept on your behalf. |

Click **Create app**.

## Step 2 — App settings tab
| Field | Value |
|---|---|
| Privacy policy URL | `https://www.ordo7.pro/privacy.html` |
| Business email | whatever inbox you want LinkedIn's API team to reach for this app — `admin@ordo7data.com` or `admin@level7data.com` per existing contact conventions, your call |

## Step 3 — Request products (this is where the two speeds diverge)
On the **Products** tab, request:

1. **"Share on LinkedIn"** — grants `w_member_social` (post to your personal profile). Historically fast/near-automatic approval. **Request this one first.**
2. **"Community Management API"** — grants `w_organization_social` (post to the Ordo7 company page) and is required for company-page video/comments too. **This is the slow, manual-review one** — LinkedIn will likely ask you to describe the use case. Suggested justification text, if prompted:

   > "Ordo7 is a project-schedule-health SaaS product with an associated company Page. We need to publish our own product-update and educational content (including video) to our company Page and respond to comments on our own posts, as part of our standard marketing operations. No third-party or end-user data is involved — this is exclusively for posting our own company's content."

   Submit this even though it'll take time to hear back — no reason to wait to start the clock on it.

## Step 4 — Auth tab — note these down, they're needed for the OAuth flow
- **Client ID** and **Client Secret** — copy both somewhere safe (a password manager, not this repo — never commit these).
- **Authorized redirect URLs** — add `https://www.ordo7.pro/oauth/linkedin-poster/callback` (a **new** callback path, deliberately different from whatever redirect URI Ordo7's existing customer-facing "Sign in with LinkedIn" already uses in `oauth.js` — these must stay two separate apps/flows, not share a callback).

## What to send back once you have it
Just the **Client ID** and confirmation of which products got approved (Share on LinkedIn is likely immediate; Community Management may take longer and arrive separately) — **not the Client Secret over chat**. Once "Share on LinkedIn" is approved, the OAuth flow + video-upload engineering (`linkedin-poster.js`, per the scope doc) can start immediately, even while the Community Management API request is still pending — personal-profile posting doesn't need it.
