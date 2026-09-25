import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentPayload, qrSvg, code39Svg } from '../payment-codes.js';

test('QR and barcode encode the same versioned token with no amount or account details', () => {
  const payload = paymentPayload('0123456789abcdef0123456789abcdef');
  assert.equal(payload, 'GW1-0123456789ABCDEF0123456789ABCDEF');
  const qr = qrSvg(payload), barcode = code39Svg(payload);
  assert.match(qr, /<svg /);
  assert.match(qr, /viewBox="0 0 \d+ \d+"/);
  assert.match(barcode, /<svg /);
  assert.ok((barcode.match(/<rect /g) || []).length > 100);
  assert.doesNotMatch(qr + barcode, /merchant|account|amount/i);
});

test('payment symbols refuse malformed or unversioned data', () => {
  assert.throws(() => paymentPayload('1234'), /Invalid/);
  assert.throws(() => qrSvg('https://example.com'), /Invalid/);
  assert.throws(() => code39Svg('GW2-' + 'A'.repeat(32)), /Invalid/);
});
