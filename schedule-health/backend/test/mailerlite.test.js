// Unit tests for src/mailerlite.js — the blog newsletter → MailerLite group client.
// Uses Node's built-in test runner (node --test) and node:assert, so there are no dependencies to
// install, consistent with the rest of this zero-dependency backend. `fetch` is stubbed per-test so
// nothing here touches the network or a real MailerLite account.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const mailerlite = require('../src/mailerlite');

const realFetch = globalThis.fetch;
const realKey = process.env.MAILERLITE_API_KEY;

beforeEach(() => {
  delete process.env.MAILERLITE_API_KEY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.MAILERLITE_API_KEY;
  else process.env.MAILERLITE_API_KEY = realKey;
});

test('mailerliteConfigured reflects whether the API key is set', () => {
  assert.strictEqual(mailerlite.mailerliteConfigured(), false);
  process.env.MAILERLITE_API_KEY = 'test-key';
  assert.strictEqual(mailerlite.mailerliteConfigured(), true);
});

test('addBlogSubscriber no-ops (returns null) without an API key and never calls fetch', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  const result = await mailerlite.addBlogSubscriber('reader@example.com');
  assert.strictEqual(result, null);
  assert.strictEqual(called, false, 'fetch must not be called when unconfigured');
});

test('addBlogSubscriber posts the email + blog group with bearer auth and returns the subscriber', async () => {
  process.env.MAILERLITE_API_KEY = 'test-key';
  let captured = null;
  globalThis.fetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ data: { id: '123', email: 'reader@example.com' } }) };
  };

  const result = await mailerlite.addBlogSubscriber('reader@example.com');

  assert.deepStrictEqual(result, { data: { id: '123', email: 'reader@example.com' } });
  assert.strictEqual(captured.url, 'https://connect.mailerlite.com/api/subscribers');
  assert.strictEqual(captured.opts.method, 'POST');
  assert.strictEqual(captured.opts.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(captured.opts.body);
  assert.strictEqual(body.email, 'reader@example.com');
  assert.deepStrictEqual(body.groups, [mailerlite.BLOG_GROUP_ID]);
});

test('addBlogSubscriber returns null on a non-2xx response', async () => {
  process.env.MAILERLITE_API_KEY = 'test-key';
  globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' });
  const result = await mailerlite.addBlogSubscriber('reader@example.com');
  assert.strictEqual(result, null);
});

test('addBlogSubscriber returns null (swallows) when fetch throws', async () => {
  process.env.MAILERLITE_API_KEY = 'test-key';
  globalThis.fetch = async () => { throw new Error('network down'); };
  const result = await mailerlite.addBlogSubscriber('reader@example.com');
  assert.strictEqual(result, null);
});

test('BLOG_GROUP_ID defaults to the Ordo7 Blog Subscribers group', () => {
  // No MAILERLITE_BLOG_GROUP_ID was set at require time, so it falls back to the known group id.
  assert.strictEqual(mailerlite.BLOG_GROUP_ID, '193524211311970129');
});
