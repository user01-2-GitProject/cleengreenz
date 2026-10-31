import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateFromAddress, estimateFromAreas } from '../estimates/index.js';
import { geocodeAddress } from '../estimates/address.js';
import { parcelSqftFromArcGIS, resolveLotSqft, surfaceAreas } from '../estimates/lot.js';
import { grassEstimate } from '../estimates/grass/grass.js';
import { leavesEstimate } from '../estimates/leaves/leaves.js';
import { snowEstimate } from '../estimates/snow/snow.js';
import { fetchJson } from '../estimates/validation.js';
const address = '100 Example Street, Niles, MI';
const geo = { result: { addressMatches: [{ matchedAddress: '100 EXAMPLE ST, NILES, MI', coordinates: { x: -86.25, y: 41.83 } }] } };
const response = data => new Response(JSON.stringify(data));

for (const value of [undefined, null, NaN, Infinity, -1, 0, '1000', {}, 10_000_001]) {
  test(`all pricing entry points reject invalid area ${String(value)}`, () => {
    for (const fn of [grassEstimate, leavesEstimate, snowEstimate, surfaceAreas]) assert.throws(() => fn(value), TypeError);
    assert.throws(() => estimateFromAreas({ lawnSqft: value, lotSqft: 7840, drivewaySqft: 700 }), TypeError);
  });
}
test('options reject invalid counts, enums and shapes instead of silently changing the job', async () => {
  for (const options of [null, [], { properties: 0 }, { properties: 1.5 }, { properties: 21 }, { cover: '__proto__' }, { amount: 'huge' }]) {
    assert.throws(() => grassEstimate(1000, options), TypeError);
    await assert.rejects(estimateFromAddress(address, options), TypeError);
  }
  assert.throws(() => leavesEstimate(7840, 'bad'), TypeError);
});
test('explicit zero lot is rejected without invoking a lookup', async () => {
  await assert.rejects(estimateFromAddress(address, { lotSqft: 0, fetchImpl: () => assert.fail('no lookup') }), TypeError);
});
test('known areas preserve exact values and need no lookup', async () => {
  const result = await estimateFromAddress(address, { lotSqft: 9000, lawnSqft: 6000, drivewaySqft: 500,
    fetchImpl: () => assert.fail('no lookup') });
  assert.equal(result.property.source, 'provided');
  assert.deepEqual(result.property.surfaceBasis, { lot: 'provided', lawn: 'provided', driveway: 'provided' });
  assert.equal(result.property.requiresConfirmation, false);
  assert.equal(result.estimates.snow.basisSqft, 500);
  assert.equal(result.estimates.grass.basisSqft, 6000);
});
test('known lot does not misrepresent derived surfaces as measured', async () => {
  const { property } = await estimateFromAddress(address, { lotSqft: 10000 });
  assert.equal(property.lawnSqft, 7200);
  assert.equal(property.surfaceBasis.lawn, 'lot-share-assumption');
  assert.equal(property.requiresConfirmation, true);
});
test('matched address without configured county uses labeled assumption', async () => {
  let calls = 0;
  const { property } = await estimateFromAddress(address, { fetchImpl: async url => {
    calls++; assert.match(url, /^https:\/\/geocoding\.geo\.census\.gov\//u); return response(geo);
  } });
  assert.equal(calls, 1);
  assert.equal(property.matchedAddress, geo.result.addressMatches[0].matchedAddress);
  assert.equal(property.source, 'typical-lot-fallback');
  assert.equal(property.confidence, 'low');
  assert.ok(property.warnings.includes('parcel-not-configured'));
  assert.equal(property.requiresConfirmation, true);
});
test('no match and failed lookup retain supplied service areas', async () => {
  for (const fetchImpl of [async () => response({ result: { addressMatches: [] } }), async () => { throw new Error('provider secret'); }]) {
    const { property, estimates } = await estimateFromAddress(address, { lawnSqft: 5000, drivewaySqft: 400, fetchImpl });
    assert.equal(property.source, 'typical-lot-fallback');
    assert.equal(property.surfaceBasis.lawn, 'provided');
    assert.equal(estimates.grass.basisSqft, 5000);
    assert.equal(estimates.snow.basisSqft, 400);
    assert.ok(property.warnings.length >= 1);
  }
});
test('geocoder validates bounds, response and unique matches', async () => {
  for (const value of ['', 'abcd', 'a'.repeat(201), '1234\nStreet', null]) {
    await assert.rejects(geocodeAddress(value, () => assert.fail('no lookup')), TypeError);
  }
  for (const data of [{}, { result: { addressMatches: [{ coordinates: { x: 0, y: 0 } }] } },
    { result: { addressMatches: [{ matchedAddress: address, coordinates: { x: Infinity, y: 0 } }] } },
    { result: { addressMatches: [geo.result.addressMatches[0], geo.result.addressMatches[0]] } }]) {
    await assert.rejects(geocodeAddress(address, async () => response(data)));
  }
});
test('lookups time out even when a provider ignores abort', async () => {
  await assert.rejects(fetchJson('https://example.test', () => new Promise(() => {}), 5), /timed out/u);
  const result = await estimateFromAddress(address, { timeoutMs: 5, fetchImpl: () => new Promise(() => {}) });
  assert.ok(result.property.warnings.includes('address-lookup-unavailable'));
});
test('parcelSqftFromArcGIS validates layerUrl domain and rejects untrusted or internal hosts', async () => {
  for (const untrustedUrl of [
    'https://evil.com/query',
    'https://internal.service/query',
    'https://169.254.169.254/latest/meta-data',
    'https://attacker.arcgis.com.evil.com/query',
    'http://gis.berriencountymi.gov/query',
  ]) {
    await assert.rejects(
      parcelSqftFromArcGIS(41.83, -86.25, async () => assert.fail('should not fetch untrusted host'), { layerUrl: untrustedUrl }),
      /Invalid parcel configuration/u
    );
  }

  for (const trustedUrl of [
    'https://gis.berriencountymi.gov/query',
    'https://county.example/query',
    'https://services.arcgis.com/query',
    'https://localhost/query',
  ]) {
    const sqft = await parcelSqftFromArcGIS(41.83, -86.25, async () => response({ features: [{ attributes: { ACREAGE: 0.25 } }] }), { layerUrl: trustedUrl });
    assert.equal(sqft, 10890);
  }
});

test('county query explicitly requests geographic coordinates and configured acreage', async () => {
  const config = { layerUrl: 'https://county.example/MapServer/0/query?existing=yes', acresField: 'ACRES' };
  const sqft = await parcelSqftFromArcGIS(41.83, -86.25, async url => {
    const query = new URL(url).searchParams;
    assert.equal(query.get('geometry'), '-86.25,41.83');
    assert.equal(query.get('inSR'), '4326');
    assert.equal(query.get('outFields'), 'ACRES');
    assert.equal(query.get('existing'), 'yes');
    return response({ features: [{ attributes: { ACRES: 0.25 } }] });
  }, config);
  assert.equal(sqft, 10890);
  const lot = await resolveLotSqft(41.83, -86.25, async () => response({ features: [{ attributes: { ACRES: 0.25 } }] }), config);
  assert.equal(lot.source, 'county-parcel');
  assert.equal(lot.confidence, 'medium');
});
test('county errors, ambiguous features and invalid acreage become explicit assumptions', async () => {
  for (const data of [{ error: { message: 'private internals' } }, { features: [] },
    { features: [{ attributes: { ACREAGE: 1 } }, { attributes: { ACREAGE: 2 } }] },
    { features: [{ attributes: { ACREAGE: 'one' } }] }]) {
    const lot = await resolveLotSqft(41, -86, async () => response(data), { layerUrl: 'https://county.example/query' });
    assert.equal(lot.source, 'typical-lot-fallback');
    assert.equal(lot.confidence, 'low');
    assert.ok(lot.warnings.length);
  }
  const lot = await resolveLotSqft(41, -86, async () => new Response('', { status: 503 }), { layerUrl: 'https://county.example/query' });
  assert.deepEqual(lot.warnings, ['parcel-lookup-unavailable']);
});
test('zeroed county acreage is measured from the parcel geometry instead', async () => {
  // Berrien County's live layer reports acres: 0 for whole neighborhoods
  // (found 2026-10-30); the parcel polygon still measures the lot.
  const ring = [[-86.25, 41.83], [-86.249, 41.83], [-86.249, 41.831], [-86.25, 41.831], [-86.25, 41.83]];
  const sqft = await parcelSqftFromArcGIS(41.8305, -86.2495,
    async () => response({ features: [{ attributes: { ACREAGE: 0 }, geometry: { rings: [ring] } }] }),
    { layerUrl: 'https://county.example/query' });
  assert.ok(sqft > 50_000 && sqft < 200_000, `expected roughly 99k sq ft, got ${sqft}`);
  const lot = await resolveLotSqft(41.8305, -86.2495,
    async () => response({ features: [{ attributes: { ACREAGE: 0 }, geometry: { rings: [ring] } }] }),
    { layerUrl: 'https://county.example/query' });
  assert.equal(lot.source, 'county-parcel');
});
test('catch-all placeholder polygons are not measured as lots', async () => {
  // County layers carry multipart placeholder features for unparceled land;
  // a many-ring or oversized polygon must fall back, not price a township.
  const small = [[-86.25, 41.83], [-86.249, 41.83], [-86.249, 41.831], [-86.25, 41.831], [-86.25, 41.83]];
  const manyRings = { rings: Array.from({ length: 9 }, () => small) };
  const oversized = { rings: [[[-86.25, 41.83], [-86.23, 41.83], [-86.23, 41.85], [-86.25, 41.85], [-86.25, 41.83]]] };
  for (const geometry of [manyRings, oversized]) {
    const lot = await resolveLotSqft(41.84, -86.24,
      async () => response({ features: [{ attributes: { ACREAGE: 0 }, geometry }] }),
      { layerUrl: 'https://county.example/query' });
    assert.equal(lot.source, 'typical-lot-fallback');
  }
});
test('zeroed acreage without usable geometry still falls back', async () => {
  const lot = await resolveLotSqft(41, -86,
    async () => response({ features: [{ attributes: { ACREAGE: 0 } }] }),
    { layerUrl: 'https://county.example/query' });
  assert.equal(lot.source, 'typical-lot-fallback');
});
test('a point on the county catch-all retries nearby and takes a lone real parcel', async () => {
  // Found live 2026-10-30: address points often land on the county layer's
  // multipart catch-all placeholder (or in the road), while the house's real
  // parcel sits a few meters away with its acreage zeroed.
  const ring = [[-86.25, 41.83], [-86.249, 41.83], [-86.249, 41.831], [-86.25, 41.831], [-86.25, 41.83]];
  const catchAll = { attributes: { ACREAGE: 0 }, geometry: { rings: Array.from({ length: 40 }, () => ring) } };
  const realParcel = { attributes: { ACREAGE: 0 }, geometry: { rings: [ring] } };
  const fetchImpl = async (url) => {
    const buffered = new URL(url).searchParams.has('distance');
    return response({ features: buffered ? [catchAll, realParcel] : [catchAll] });
  };
  const lot = await resolveLotSqft(41.8305, -86.2495, fetchImpl, { layerUrl: 'https://county.example/query' });
  assert.equal(lot.source, 'county-parcel');
  assert.ok(lot.lotSqft > 50_000 && lot.lotSqft < 200_000, `expected roughly 99k sq ft, got ${lot.lotSqft}`);
});
test('two real parcels near the point stay ambiguous and fall back', async () => {
  const ring = [[-86.25, 41.83], [-86.249, 41.83], [-86.249, 41.831], [-86.25, 41.831], [-86.25, 41.83]];
  const parcel = { attributes: { ACREAGE: 0 }, geometry: { rings: [ring] } };
  const fetchImpl = async (url) => {
    const buffered = new URL(url).searchParams.has('distance');
    return response({ features: buffered ? [parcel, parcel] : [] });
  };
  const lot = await resolveLotSqft(41.8305, -86.2495, fetchImpl, { layerUrl: 'https://county.example/query' });
  assert.equal(lot.source, 'typical-lot-fallback');
});
test('browser-compatible module import does not depend on process globals', async () => {
  const saved = globalThis.process;
  try { globalThis.process = undefined; await import('../estimates/lot.js?browser-test'); }
  finally { globalThis.process = saved; }
});


test('provider fetch uses Workers-compatible manual redirects and rejects redirect responses', async () => {
  const workersFetch = async (_url, options) => {
    if (options.redirect === 'error') throw new TypeError('Unsupported redirect mode: error');
    assert.equal(options.redirect, 'manual');
    return response(geo);
  };
  const match = await geocodeAddress(address, workersFetch);
  assert.equal(match.matchedAddress, geo.result.addressMatches[0].matchedAddress);
  await assert.rejects(fetchJson('https://example.test', async (_url, options) => {
    assert.equal(options.redirect, 'manual');
    return new Response(null, { status: 302, headers: { location: 'https://other.example/' } });
  }), /Lookup unavailable/u);
});
