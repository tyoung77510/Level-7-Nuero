// billing.js — Stripe subscription billing via Stripe's plain REST API (no stripe npm SDK).
// Reads STRIPE_SECRET_KEY and per-tier price IDs (see src/pricing.js) from the environment.
const crypto = require('node:crypto');

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function stripeRequest(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');

  let url = `${STRIPE_API}${path}`;
  let body;
  if (params && method === 'GET') {
    url += '?' + new URLSearchParams(params).toString();
  } else if (params) {
    body = new URLSearchParams(params).toString();
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Could not reach Stripe (unexpected response, status ${res.status})`);
  }
  if (!res.ok) throw new Error(data.error?.message || `Stripe API error (${res.status})`);
  return data;
}

function createCheckoutSession({ userId, email, customerId, priceId, successUrl, cancelUrl }) {
  const params = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: String(userId)
  };
  if (customerId) params.customer = customerId;
  else params.customer_email = email;

  return stripeRequest('POST', '/checkout/sessions', params);
}

// Expands both the subscription and the purchased line items — the line item's price ID is how
// we determine which tier was actually paid for (see pricing.tierForPriceId), rather than
// trusting a client-supplied tier value.
function retrieveCheckoutSession(sessionId) {
  return stripeRequest('GET', `/checkout/sessions/${sessionId}?expand[]=subscription&expand[]=line_items`);
}

// Verifies Stripe's webhook signature (HMAC-SHA256 of "{timestamp}.{rawBody}").
// Used by POST /api/billing/webhook once a webhook endpoint + signing secret are configured.
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parts.v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

module.exports = { stripeConfigured, createCheckoutSession, retrieveCheckoutSession, verifyWebhookSignature };
