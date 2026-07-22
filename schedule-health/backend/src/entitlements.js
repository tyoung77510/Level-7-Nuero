// entitlements.js — resolves what a user is actually allowed to do, post-pricing-restructure.
//
// Two price books exist at once, permanently:
//   - NEW: what a signup after the restructure gets (users.plan_tier, one of
//     'free' | 'professional' | 'team' | 'enterprise').
//   - LEGACY: what an account that existed before the restructure keeps, "grandfathered
//     indefinitely on current terms" (see docs/pricing-restructure.md section 4). Their
//     users.plan_tier stays whatever it always was ('free' | 'starter' | 'pro' | 'teams') —
//     that value is still what billing.js/pricing.js match real Stripe subscriptions against,
//     so it must never be rewritten. users.legacy_plan is a separate snapshot of that same value,
//     set once at migration time (see db.js's ensureColumn backfill) — its presence is what
//     flags an account as grandfathered, independent of plan_tier's billing-critical meaning.
//
// Every caller — server.js routes, publicUser() — should go through resolveEntitlements(user)
// rather than reading plan_tier/legacy_plan directly, so there is exactly one place that knows
// how the two price books map onto each other.
const { getEffectiveTierUser } = require('./db');

const UNLIMITED = Infinity;

// The new price book's tier definitions. Every gate in docs/pricing-restructure.md section 3
// lives here as a plain data value — feature code checks entitlements.<name>, never a tier
// string directly, so a gate can move between tiers by editing one table, not hunting call sites.
const NEW_TIERS = {
  free: {
    tierKey: 'free',
    name: 'Free',
    priceLabel: '$0',
    projectLimit: 1,
    seatsIncluded: 1,
    additionalSeatPriceUsd: null,
    snapshotHistoryLimit: 3,
    workingTools: false,
    trendDays: 30,
    reportWatermarked: true,
    pdfPresentation: false,
    customBranding: false,
    portfolioOverview: false,
    multiProjectLeaderboard: false,
    crossProjectTrendRollup: false,
    sharedPortfolios: false,
    rolePermissions: false,
    askOrdoPerMonth: 10,
    aiNarrativePerMonth: 5,
    slackZapier: false,
    apiAccess: false,
    sso: false,
    support: 'community',
    dpa: false
  },
  professional: {
    tierKey: 'professional',
    name: 'Professional',
    priceLabel: '$79/month',
    priceLabelAnnual: '$790/year',
    projectLimit: 10,
    seatsIncluded: 1,
    additionalSeatPriceUsd: null,
    snapshotHistoryLimit: UNLIMITED,
    workingTools: true,
    trendDays: UNLIMITED,
    reportWatermarked: true,
    pdfPresentation: true,
    customBranding: false,
    portfolioOverview: true,
    multiProjectLeaderboard: false,
    crossProjectTrendRollup: false,
    sharedPortfolios: false,
    rolePermissions: false,
    askOrdoPerMonth: 200,
    aiNarrativePerMonth: 100,
    slackZapier: false,
    apiAccess: false,
    sso: false,
    support: 'email',
    dpa: false
  },
  team: {
    tierKey: 'team',
    name: 'Team',
    priceLabel: '$299/month',
    priceLabelAnnual: '$2,990/year',
    projectLimit: 40,
    seatsIncluded: 10,
    additionalSeatPriceUsd: 29,
    snapshotHistoryLimit: UNLIMITED,
    workingTools: true,
    trendDays: UNLIMITED,
    reportWatermarked: false,
    pdfPresentation: true,
    customBranding: true,
    portfolioOverview: true,
    multiProjectLeaderboard: true,
    crossProjectTrendRollup: true,
    sharedPortfolios: true,
    rolePermissions: false,
    askOrdoPerMonth: 1000,
    aiNarrativePerMonth: 500,
    slackZapier: true,
    apiAccess: false,
    sso: false,
    support: 'priority-email',
    dpa: 'on-request'
  },
  enterprise: {
    tierKey: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    projectLimit: UNLIMITED,
    seatsIncluded: UNLIMITED,
    additionalSeatPriceUsd: null,
    snapshotHistoryLimit: UNLIMITED,
    workingTools: true,
    trendDays: UNLIMITED,
    reportWatermarked: false,
    pdfPresentation: true,
    customBranding: true,
    portfolioOverview: true,
    multiProjectLeaderboard: true,
    crossProjectTrendRollup: true,
    sharedPortfolios: true,
    rolePermissions: true,
    askOrdoPerMonth: UNLIMITED,
    aiNarrativePerMonth: UNLIMITED,
    slackZapier: true,
    apiAccess: true,
    sso: true,
    support: 'dedicated-sla',
    dpa: true
  }
};

// Old plan_tier value -> which new-tier feature set a grandfathered account gets (section 4's
// migration table: Starter and Pro both "gain Professional features"; Teams gains Team features;
// Free stays Free). This is the ONLY place old tier names get interpreted — everywhere else in
// the app deals in the new tierKeys above.
const LEGACY_TIER_MAP = {
  free: 'free',
  starter: 'professional',
  pro: 'professional',
  teams: 'team'
};

// What a legacy subscriber's price actually stays at (their real Stripe subscription is
// untouched — this is display-only, for "you're grandfathered at your original price").
const LEGACY_PRICE_LABEL = {
  free: '$0',
  starter: '$19.99/month (grandfathered)',
  pro: '$49/month (grandfathered)',
  teams: '$149/month (grandfathered)'
};

// Resolves the full entitlement set for a user. Always resolves through getEffectiveTierUser
// first (unchanged team-membership behavior: a Team member's own row doesn't matter, the owner's
// plan governs) — legacy_plan/plan_tier are then read off whichever row actually applies.
function resolveEntitlements(user) {
  const billingUser = getEffectiveTierUser(user);
  const isLegacy = Boolean(billingUser.legacy_plan);
  const tierKey = isLegacy
    ? (LEGACY_TIER_MAP[billingUser.legacy_plan] || 'free')
    : (NEW_TIERS[billingUser.plan_tier] ? billingUser.plan_tier : 'free');
  const base = NEW_TIERS[tierKey] || NEW_TIERS.free;

  return {
    ...base,
    // Grandfathering's one hard override: "current terms" for every pre-restructure tier included
    // unlimited projects (section 1 — this was true account-wide before the restructure existed),
    // so a legacy account never gets newly capped by a limit that didn't exist when they signed up.
    projectLimit: isLegacy ? UNLIMITED : base.projectLimit,
    isLegacy,
    legacySourcePlan: isLegacy ? billingUser.legacy_plan : null,
    priceLabel: isLegacy ? LEGACY_PRICE_LABEL[billingUser.legacy_plan] : base.priceLabel
  };
}

module.exports = { NEW_TIERS, LEGACY_TIER_MAP, resolveEntitlements, UNLIMITED };
