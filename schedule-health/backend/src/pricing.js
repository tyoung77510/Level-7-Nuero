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

// Self-serve tiers. Teams/Enterprise are intentionally not listed here — this app doesn't yet
// support multiple seats on one account, so those are "Contact us" placeholders in the UI with
// no checkout wired up, rather than half-built billing for a feature that doesn't exist.
const TIERS = {
  pro: {
    key: 'pro',
    name: 'Pro',
    priceLabel: '$50/month',
    monthlyCredits: 500,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_PRO'
  }
};

function costUsd(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * ANTHROPIC_INPUT_PER_1M + (outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_PER_1M;
}

function creditsForUsage(inputTokens, outputTokens) {
  const chargedUsd = costUsd(inputTokens, outputTokens) * MARGIN_MULTIPLIER;
  return Math.max(1, Math.ceil(chargedUsd / CREDIT_VALUE_USD));
}

function tierForPriceId(priceId) {
  for (const tier of Object.values(TIERS)) {
    if (priceId && process.env[tier.stripePriceEnvVar] === priceId) return tier.key;
  }
  return null;
}

module.exports = {
  TIERS, FREE_SIGNUP_CREDITS, MARGIN_MULTIPLIER, CREDIT_VALUE_USD,
  costUsd, creditsForUsage, tierForPriceId
};
