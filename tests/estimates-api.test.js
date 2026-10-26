import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, createEstimateLimiter } from '../functions/api/estimate.js';
let ip = 0;
const address = '100 Example St, Niles, MI';
function request(body, { method = 'POST', headers = {}, raw } = {}) {
  return new Request('https://cleengreenz.example/api/estimate', { method,
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': `198.51.100.${++ip}`, ...headers },
    ...(method === 'POST' ? { body: raw ?? JSON.stringify(body) } : {}) });
}
const known = { address, lotSqft: 7840, lawnSqft: 5645, drivewaySqft: 706 };

test('public API uses approved model and all responses include security headers', async () => {
  const result = await onRequest({ request: request(known) });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(result.headers.get('x-frame-options'), 'DENY');
  const body = await result.json();
  assert.equal(body.estimates.grass.job.mid, 50);
  assert.equal(body.property.surfaceBasis.lawn, 'provided');
  assert.equal(body.ok, true);
});
test('API rejects wrong method, cross-site requests and media type', async () => {
  assert.equal((await onRequest({ request: request(null, { method: 'GET' }) })).status, 405);
  assert.equal((await onRequest({ request: request(known, { headers: { origin: 'https://other.example' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { origin: 'null' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { origin: 'invalid-origin' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { referer: 'https://other.example/page' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { referer: 'not-a-url' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { 'sec-fetch-site': 'cross-site' } }) })).status, 403);
  assert.equal((await onRequest({ request: request(known, { headers: { 'content-type': 'text/plain' } }) })).status, 415);
});
test('API rejects malformed, oversized, unknown and invalid user fields', async () => {
  for (const body of [null, [], { ...known, lotSqft: -1 }, { ...known, lawnSqft: '100' },
    { ...known, properties: 0 }, { ...known, cover: 'bad' }, { ...known, fetchImpl: 'cannot-inject' }]) {
    const result = await onRequest({ request: request(body) });
    assert.equal(result.status, 400);
    assert.equal((await result.json()).ok, false);
  }
  assert.equal((await onRequest({ request: request(null, { raw: '{bad json' }) })).status, 400);
  assert.equal((await onRequest({ request: request(null, { raw: ' '.repeat(4097) }) })).status, 413);
});
test('API provider failures keep manual surfaces and never expose provider error', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('secret provider config'); };
    const result = await onRequest({ request: request({ address, lawnSqft: 5000, drivewaySqft: 400 }) });
    assert.equal(result.status, 200);
    const text = await result.text();
    assert.ok(!text.includes('secret provider'));
    const body = JSON.parse(text);
    assert.equal(body.property.source, 'typical-lot-fallback');
    assert.equal(body.property.requiresConfirmation, true);
    assert.equal(body.estimates.grass.basisSqft, 5000);
    assert.ok(body.property.warnings.includes('address-lookup-unavailable'));
  } finally { globalThis.fetch = saved; }
});
test('API passes server parcel config, rather than accepting a user supplied provider URL', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async url => String(url).startsWith('https://geocoding.geo.census.gov/')
      ? new Response(JSON.stringify({ result: { addressMatches: [{ matchedAddress: address, coordinates: { x: -86, y: 41 } }] } }))
      : new Response(JSON.stringify({ features: [{ attributes: { LOT_ACRES: 0.2 } }] }));
    const result = await onRequest({ request: request({ address }), env: { PARCEL_LAYER_URL: 'https://county.example/query', PARCEL_ACRES_FIELD: 'LOT_ACRES' } });
    const body = await result.json();
    assert.equal(body.property.source, 'county-parcel');
    assert.equal(body.property.lotSqft, 8712);
    assert.equal(body.property.surfaceBasis.lawn, 'lot-share-assumption');
    assert.equal(body.property.requiresConfirmation, true);
  } finally { globalThis.fetch = saved; }
});
test('estimate throttle is isolated, expires and remains bounded', () => {
  const limited = createEstimateLimiter();
  for (let i = 0; i < 10; i++) assert.equal(limited('one', 0), false);
  assert.equal(limited('one', 0), true);
  assert.equal(limited('other', 0), false);
  assert.equal(limited('one', 60000), false);
  const full = createEstimateLimiter();
  for (let i = 0; i < 1000; i++) assert.equal(full(String(i), 0), false);
  assert.equal(full('new', 0), true);
  assert.equal(full('new', 60000), false);
});
test('HTTP throttle returns Retry-After on request eleven', async () => {
  const headers = { 'cf-connecting-ip': 'throttle-test-client' };
  for (let i = 0; i < 10; i++) assert.equal((await onRequest({ request: request(known, { headers }) })).status, 200);
  const result = await onRequest({ request: request(known, { headers }) });
  assert.equal(result.status, 429);
  assert.equal(result.headers.get('retry-after'), '60');
});


test('API defaults to verified Berrien acreage and keeps parcel confirmation required', async () => {
  const saved = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async url => {
      calls.push(String(url));
      if (String(url).startsWith('https://geocoding.geo.census.gov/')) {
        return new Response(JSON.stringify({ result: { addressMatches: [{ matchedAddress: address, coordinates: { x: -86.33962747319708, y: 42.156752052641565 } }] } }));
      }
      const parcelUrl = new URL(url);
      assert.equal(parcelUrl.origin + parcelUrl.pathname, 'https://gis.berriencountymi.gov/server/rest/services/Hosted/Parcels_Current/FeatureServer/0/query');
      assert.equal(parcelUrl.searchParams.get('outFields'), 'acres');
      assert.equal(parcelUrl.searchParams.get('returnGeometry'), 'false');
      return new Response(JSON.stringify({ features: [{ attributes: { acres: 1.7 } }] }));
    };
    const result = await onRequest({ request: request({ address }) });
    const body = await result.json();
    assert.equal(result.status, 200);
    assert.equal(calls.length, 2);
    assert.equal(body.property.lotSqft, 74052);
    assert.equal(body.property.source, 'county-parcel');
    assert.equal(body.property.confidence, 'medium');
    assert.equal(body.property.requiresConfirmation, true);
  } finally { globalThis.fetch = saved; }
});

test('a custom county URL retains the generic ACREAGE field unless overridden', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      if (String(url).startsWith('https://geocoding.geo.census.gov/')) return new Response(JSON.stringify({ result: { addressMatches: [{ matchedAddress: address, coordinates: { x: -86, y: 41 } }] } }));
      assert.equal(new URL(url).searchParams.get('outFields'), 'ACREAGE');
      return new Response(JSON.stringify({ features: [{ attributes: { ACREAGE: 0.2 } }] }));
    };
    const result = await onRequest({ request: request({ address }), env: { PARCEL_LAYER_URL: 'https://custom-county.example/query' } });
    assert.equal((await result.json()).property.source, 'county-parcel');
  } finally { globalThis.fetch = saved; }
});

test('API sanitizes internal runtime TypeError messages to prevent object/stack detail leakage', async () => {
  const resultInvalidOpt = await onRequest({ request: request({ address, cover: 'invalid_cover' }) });
  assert.equal(resultInvalidOpt.status, 400);
  const jsonInvalidOpt = await resultInvalidOpt.json();
  assert.equal(jsonInvalidOpt.ok, false);
  assert.equal(jsonInvalidOpt.message, 'Choose light, moderate or heavy tree cover.');
});
