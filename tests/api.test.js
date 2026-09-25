import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { GreenwickAPI } from '../api.js';

function fakeStorage() {
  const data = new Map();
  return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function reply(data, status = 200) { return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) }; }
test('web terminal sends only the SHA-256 digest, matching the Android payment protocol', async () => {
  const calls = [];
  const api = new GreenwickAPI({ storage: fakeStorage(), cryptoAPI: webcrypto, fetcher: async (url, opts) => {
    calls.push({ url, opts });
    return reply({ request_id: 'request-1', expires_at: '2026-09-25T09:10:00Z' });
  } });
  api.session = { access_token: 'customer-unrelated-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600 };
  const request = await api.create('terminal-1', 2450, 'Coffee');
  const body = JSON.parse(calls[0].opts.body);
  assert.match(calls[0].url, /greenwick_create_terminal_request$/);
  assert.equal(request.token.length, 32);
  assert.equal(body.p_token_sha256_hex, createHash('sha256').update(Buffer.from(request.token, 'hex')).digest('hex'));
  assert.equal(body.p_amount_minor, 2450);
  assert.equal(body.p_terminal_id, 'terminal-1');
  assert.ok(!calls[0].opts.body.includes(request.token));
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer customer-unrelated-token');
});
test('an expired access token refreshes before a financial RPC and preserves the rotating token', async () => {
  const calls = [];
  const storage = fakeStorage();
  const api = new GreenwickAPI({ storage, cryptoAPI: webcrypto, fetcher: async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('grant_type=refresh_token')) return reply({ access_token: 'new-access', refresh_token: 'rotated', expires_in: 3600 });
    return reply({ registered: false });
  } });
  api.session = { access_token: 'expired', refresh_token: 'old', expires_at: 0 };
  await api.home();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].opts.headers.Authorization, 'Bearer new-access');
  assert.equal(JSON.parse(storage.getItem('greenwick-terminal-web-session-v1')).refresh_token, 'rotated');
});
test('payment limit is checked before a request is sent', async () => {
  let sent = false;
  const api = new GreenwickAPI({ storage: fakeStorage(), cryptoAPI: webcrypto, fetcher: async () => { sent = true; return reply({}); } });
  await assert.rejects(api.create('terminal', 0, ''), /Invalid amount/);
  await assert.rejects(api.create('terminal', 100000000001, ''), /Invalid amount/);
  assert.equal(sent, false);
});
