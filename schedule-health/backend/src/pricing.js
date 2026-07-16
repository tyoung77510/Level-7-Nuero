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

// Self-serve tiers. Enterprise is intentionally not listed here — still a "Contact us"
// placeholder with no checkout wired up. Teams went live with an honest feature set: everything
// that's actually built (pooled credits, unwatermarked reports) and nothing that isn't yet —
// multi-seat invites and live review rooms are left off the pricing card entirely rather than
// advertised and gated behind something that doesn't work. Revisit this list once those exist.
const TIERS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    priceLabel: '$19.99/month',
    monthlyCredits: 150,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_STARTER'
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    priceLabel: '$49/month',
    monthlyCredits: 500,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_PRO'
  },
  teams: {
    key: 'teams',
    name: 'Teams',
    priceLabel: '$149/month',
    monthlyCredits: 2500,
    stripePriceEnvVar: 'STRIPE_PRICE_ID_TEAMS'
  }
};

// Seats beyond the owner's own account. Not tied to the $149 price point by any real cost model
// yet — it's a reasonable cap to launch with (prevents one Teams subscription from silently
// becoming unlimited-seat) and can move once real usage shows what's right.
const MAX_TEAM_MEMBERS = 9;

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
  for (const tier of Object.values(TIERS)) {
    if (priceId && process.env[tier.stripePriceEnvVar] === priceId) return tier.key;
  }
  return null;
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
  TIERS, FREE_SIGNUP_CREDITS, REFERRAL_BONUS_CREDITS, MARGIN_MULTIPLIER, CREDIT_VALUE_USD, MAX_TEAM_MEMBERS,
  TOPUP_CREDIT_PRICE_USD, TOPUP_MIN_USD, TOPUP_INCREMENT_USD,
  costUsd, creditsForUsage, tierForPriceId, creditsForTopupAmount, isValidTopupAmount
};
