// pricing.js — subscription tiers and AI credit accounting.
//
// Customers spend "credits" on AI features (currently just the report narrative). Internally,
// every Claude API call's real cost (from Anthropic's per-token pricing) is converted to
// credits using a fixed markup, so credit consumption always reflects a margin over what
// Anthropic actually bills us — never a flat "1 call = 1 credit" guess.

// Anthropic's per-token price for the model ai.js calls (claude-haiku-4-5), $ per million tokens.
// Update these if ai.js's ANTHROPIC_MODEL changes to a different-priced model.
const ANTHROPIC_INPUT_PER_1M = 1.00;
const ANTHROPIC_OUTPUT_PER_1M = 5.00;

// What we charge relative to Anthropic's actual cost. 4 = we charge 4x what Anthropic bills us
// for that call, i.e. a 75% margin on every AI call. Tune this one number to retune margin
// across every tier at once.
const MARGIN_MULTIPLIER = 4;

// 1 credit = this many dollars of *charged* (post-margin) value. Smaller = more granular tiers.
const CREDIT_VALUE_USD = 0.001;

// Every new signup gets this many credits once, free, regardless of tier — lets people try the
// AI narrative before paying for anything.
const FREE_SIGNUP_CREDITS = 20;

// Referral incentive: both the referrer and the new signup get this many bonus credits, awarded
// once, the moment the referred signup completes (no purchase or verification required — keeps
// the loop simple and immediate rather than waiting on a conversion event).
const REFERRAL_BONUS_CREDITS = 25;

// Post-restructure self-serve tiers (see docs/pricing-restructure.md). Enterprise is
// intentionally not listed here — still a "Contact us" placeholder with no checkout wired up.
// Each paid tier carries TWO Stripe price IDs (monthly, annual — annual is 2 months free per the
// spec) rather than one; the checkout route picks whichever the user selected.
//
// monthlyCredits here is now a secondary safety-net refill for the AI credit-balance mechanic
// (ai.js's per-call cost metering), NOT the primary AI gate anymore — the primary gate is the
// per-tier monthly query caps (askOrdoPerMonth / aiNarrativePerMonth) in entitlements.js, enforced
// by counting ai_usage rows for the current calendar month. credit_balance/top-ups still exist as
// a real fair-use overflow valve underneath that cap, per the spec's "credit top-ups: all tiers."
const TIERS = {
  professional: {
    key: 'professional',
    name: 'Professional',
    priceLabel: '$79/month',
    priceLabelAnnual: '$790/year',
    monthlyCredits: 1000,
    stripePriceEnvVarMonthly: 'STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY',
    stripePriceEnvVarAnnual: 'STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL'
  },
  team: {
    key: 'team',
    name: 'Team',
    priceLabel: '$299/month',
    priceLabelAnnual: '$2,990/year',
    monthlyCredits: 5000,
    stripePriceEnvVarMonthly: 'STRIPE_PRICE_ID_TEAM_MONTHLY',
    stripePriceEnvVarAnnual: 'STRIPE_PRICE_ID_TEAM_ANNUAL'
  }
};

// Retired tiers — no longer offered at checkout (checkoutTierDef() below only resolves TIERS
// above), kept ONLY so tierForPriceId can still recognize a legacy Stripe subscription's price ID
// if a webhook ever replays an old event. Never read their stripePriceEnvVar for a NEW checkout.
// monthlyCredits values here are unchanged from the pre-restructure tiers on purpose — a legacy
// subscriber's renewal refill (see the invoice.payment_succeeded webhook in server.js) must keep
// giving them exactly what they always got, never silently drop to zero because their plan_tier
// no longer has an entry in the new TIERS object above.
const LEGACY_TIERS = {
  starter: { key: 'starter', name: 'Starter', priceLabel: '$19.99/month', monthlyCredits: 150, stripePriceEnvVar: 'STRIPE_PRICE_ID_STARTER' },
  pro: { key: 'pro', name: 'Pro', priceLabel: '$49/month', monthlyCredits: 500, stripePriceEnvVar: 'STRIPE_PRICE_ID_PRO' },
  teams: { key: 'teams', name: 'Teams', priceLabel: '$149/month', monthlyCredits: 2500, stripePriceEnvVar: 'STRIPE_PRICE_ID_TEAMS' }
};

// Looks up a plan_tier value against both price books — for call sites that need a tier's display
// name/monthlyCredits regardless of whether the account is on the new or the grandfathered book.
function anyTierDef(planTierValue) {
  return TIERS[planTierValue] || LEGACY_TIERS[planTierValue] || null;
}

// Included in the Team tier's own price; beyond this, $29/seat/mo (entitlements.js's
// additionalSeatPriceUsd) — NOTE: metered per-seat billing to Stripe is not wired up yet, only
// the entitlement number is defined here. Enforce the free-seat boundary; treat "charge for a
// seat beyond 10" as a known gap until a real Stripe seat-billing flow is built, not something to
// silently fake.
const TEAM_SEATS_INCLUDED = 10;
const ADDITIONAL_SEAT_PRICE_USD = 29;
// Hard technical ceiling regardless of billing state, so a runaway invite loop can't create an
// unbounded number of member rows before seat billing exists to charge for them.
const MAX_TEAM_MEMBERS = 50;

// One-time credit top-ups (no subscription required, stacks with any plan's monthly refill).
// Priced higher per credit than what a subscription implies (Pro: $50/500cr = $0.10/credit) —
// pay-as-you-go should cost more per unit than subscribing, or there'd be no reason to subscribe.
const TOPUP_CREDIT_PRICE_USD = 0.20; // $10 -> 50 credits
const TOPUP_MIN_USD = 10;
const TOPUP_INCREMENT_USD = 10;

function costUsd(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * ANTHROPIC_INPUT_PER_1M + (outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_PER_1M;
}

function creditsForUsage(inputTokens, outputTokens) {
  const chargedUsd = costUsd(inputTokens, outputTokens) * MARGIN_MULTIPLIER;
  return Math.max(1, Math.ceil(chargedUsd / CREDIT_VALUE_USD));
}

function tierForPriceId(priceId) {
  if (!priceId) return null;
  for (const tier of Object.values(TIERS)) {
    if (process.env[tier.stripePriceEnvVarMonthly] === priceId) return tier.key;
    if (process.env[tier.stripePriceEnvVarAnnual] === priceId) return tier.key;
  }
  // Legacy price IDs are recognized (so an old webhook replay doesn't silently no-op) but never
  // offered at new checkout — see LEGACY_TIERS above.
  for (const tier of Object.values(LEGACY_TIERS)) {
    if (process.env[tier.stripePriceEnvVar] === priceId) return tier.key;
  }
  return null;
}

// The single tier definition a NEW checkout is allowed to resolve to — deliberately excludes
// LEGACY_TIERS so nobody can start a brand-new Starter/Pro/Teams subscription post-restructure.
function checkoutTierDef(tierKey) {
  return TIERS[tierKey] || null;
}

function checkoutPriceId(tierKey, interval) {
  const tier = checkoutTierDef(tierKey);
  if (!tier) return null;
  const envVar = interval === 'annual' ? tier.stripePriceEnvVarAnnual : tier.stripePriceEnvVarMonthly;
  return process.env[envVar] || null;
}

function creditsForTopupAmount(usd) {
  return Math.round(usd / TOPUP_CREDIT_PRICE_USD);
}

// Cents-based comparison to avoid floating-point issues (e.g. 0.1 + 0.2 !== 0.3).
function isValidTopupAmount(usd) {
  if (!Number.isFinite(usd) || usd < TOPUP_MIN_USD) return false;
  const cents = Math.round(usd * 100);
  return cents % Math.round(TOPUP_INCREMENT_USD * 100) === 0;
}

module.exports = {
  TIERS, LEGACY_TIERS, FREE_SIGNUP_CREDITS, REFERRAL_BONUS_CREDITS, MARGIN_MULTIPLIER, CREDIT_VALUE_USD,
  MAX_TEAM_MEMBERS, TEAM_SEATS_INCLUDED, ADDITIONAL_SEAT_PRICE_USD,
  TOPUP_CREDIT_PRICE_USD, TOPUP_MIN_USD, TOPUP_INCREMENT_USD,
  costUsd, creditsForUsage, tierForPriceId, checkoutTierDef, checkoutPriceId, anyTierDef, creditsForTopupAmount, isValidTopupAmount
};
