# Funnel analytics — event instrumentation

> **Status:** ✅ Active | **Purpose:** Document the product-funnel events Ordo7 fires, so GA4/Meta can be configured to measure activation and conversion — not just pageviews. | **Last Updated:** 2026-07-23

## Why this exists

Turning GA4 on by itself only captures **pageviews** (plus GA4 Enhanced Measurement: scrolls, outbound clicks, file downloads, site search). That tells you traffic, not **where people fall out between landing and paying**. These custom events light up the real activation → revenue funnel.

The events are emitted by `trackEvent(name, params, metaStandard)` in `backend/public/index.html`. They fan out to GA4 (`gtag`) and Meta (`fbq`) **only if the visitor consented** — `consent.js` only defines those globals after the matching consent category is accepted, and only when the corresponding ID is configured server-side. If nothing is configured or the visitor declined, every call is a silent no-op. Analytics can never break the product flow (all calls are wrapped and never throw).

## The funnel

| # | Moment | GA4 event | Meta event | Key params | Fires where (`index.html`) |
|---|--------|-----------|------------|------------|-----------------------------|
| 1 | Account created | `sign_up` | `CompleteRegistration` | `method` | auth submit, signup branch |
| 1b | Returning login | `login` | *(custom)* | `method` | auth submit, login branch |
| 2 | **Activation** — a schedule is analyzed (first time they get real value) | `schedule_analyzed` | `Lead` *(first analysis only)* | `first_analysis`, `health_score` | `submitAnalysis` success |
| 3 | Pricing page viewed | `view_pricing` | *(custom)* | `tier` (current effectiveTier) | `setView('pricing')` |
| 4 | Subscription checkout started | `begin_checkout` | `InitiateCheckout` | `tier`, `interval`, `value`, `currency` | subscribe button, after Stripe returns a URL |
| 4b | Credit top-up checkout started | `begin_checkout` | `InitiateCheckout` | `content_type:'credits'`, `value` | `startTopup` |
| 5 | **Purchase** — subscription confirmed | `purchase` | `Purchase` | `transaction_id`, `tier`, `interval`, `value`, `currency` | `handleCheckoutRedirect`, subscription success |
| 5b | Credit top-up confirmed | `purchase` | `Purchase` | `transaction_id`, `content_type:'credits'`, `value` | `handleCheckoutRedirect`, topup success |

**Accurate purchase value:** `begin_checkout` stashes `{tier, interval, value}` in `sessionStorage`; the matching `purchase` event reads it back after the Stripe round-trip, so the reported value is the real charge, not a guess. Values are derived from `TIER_PRICES` in the frontend (Professional 79/790, Team 299/2990) and credits from `TOPUP_CREDIT_PRICE_USD` in `pricing.js` (5 credits per $1) — never from anything the client is trusted to set for a real charge (the server still derives the actual amount from Stripe).

## What to mark as a GA4 Key Event (conversion)

In GA4 → Admin → **Key events**, mark these once they appear in Events (they show up after real traffic):

- `sign_up` — top-of-funnel conversion.
- `schedule_analyzed` — **activation**; the single most important product metric. Create an audience/segment on `first_analysis = true` to separate activation from repeat use.
- `begin_checkout` — intent; the step before money. Watching the drop from here to `purchase` tells you about checkout friction.
- `purchase` — **the revenue conversion.** Import `value` for revenue reporting.

`view_pricing` and `login` are funnel/diagnostic events, not conversions — leave them unmarked.

## Meta / LinkedIn notes

- **Meta:** standard events (`CompleteRegistration`, `Lead`, `InitiateCheckout`, `Purchase`) map cleanly and will populate Events Manager once `META_PIXEL_ID` is set. Custom events (`view_pricing`, `login`) arrive as custom conversions.
- **LinkedIn:** the base Insight Tag (`LINKEDIN_PARTNER_ID`) tracks pageviews and builds retargeting audiences. Event-level LinkedIn conversions require **conversion IDs created in Campaign Manager** and a `lintrk('track', {conversion_id})` call — not wired yet; add per-conversion IDs when LinkedIn ads actually run.

## Known gaps / follow-ups

- **Per-feature paywall attribution.** The 8 tier-gate upgrade prompts (`sandboxSimulator`, `ganttTimeline`, `earnedValue`, `crossSnapshotVariance`, `fixGuidance`, `portfolioOverview`, `unrestrictedLeaderboard`, `unwatermarkedReports`) all route to `setView('pricing')` but don't yet record *which* locked feature drove the visit. Adding a `source` param would tell you which feature is the strongest upgrade motivator. Deferred to keep this first pass surgical.
- **LinkedIn conversion events** (see above).

## Turning it on

Set `GA4_MEASUREMENT_ID` (and optionally `META_PIXEL_ID`, `LINKEDIN_PARTNER_ID`) in the Railway environment. See `ga4-setup-checklist` chat runbook / `.env.example` for where to get each ID. Once set, the consent banner appears and — after a visitor accepts — these events flow.

> **Source files:** backend/public/index.html (`trackEvent` + call sites), backend/public/js/consent.js, backend/src/server.js (`/api/public/tracking-config`, CSP)
