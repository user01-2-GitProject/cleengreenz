// County parcel acreage is optional. Configuration is explicit, never read from
// Node globals, so the pricing modules also work in a browser or Pages runtime.
import { SURFACE } from './rates.js';
import { area, coordinates, fetchJson } from './validation.js';
const SQFT_PER_ACRE = 43560;
const EARTH_RADIUS_M = 6371008.8;
const SQFT_PER_SQ_METER = 10.763910416709722;

// Geodesic area of one [lon, lat] ring in square meters (Chamberlain-Duquette).
// Signed on purpose: Esri winds outer rings and holes in opposite directions,
// so summing the signed ring areas and taking the absolute value nets out holes.
function ringAreaSqMeters(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return 0;
    total += (lon2 - lon1) * Math.PI / 180 * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
  }
  return total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
}

// The county acreage field is not trustworthy on its own: Berrien County's
// live layer reports acres: 0 for whole neighborhoods (found 2026-10-30),
// which used to drop those addresses to the typical-lot fallback even though
// the parcel was found. When the acreage is missing or zero, measure the
// parcel polygon instead; a recorded acreage stays authoritative when present.
// Two sanity guards keep the measurement honest: county layers also carry
// catch-all placeholder polygons for unparceled land (the Berrien one is a
// single 89-ring feature spanning half a township), so only a simple polygon
// of a plausible lot size counts as measured.
const MAX_GEOMETRY_RINGS = 8;
const MAX_GEOMETRY_LOT_SQFT = 435600; // 10 acres — beyond any yard we price
function geometrySqft(geometry) {
  const rings = geometry?.rings;
  if (!Array.isArray(rings) || !rings.length || rings.length > MAX_GEOMETRY_RINGS) return null;
  const sqMeters = Math.abs(rings.reduce((sum, ring) => sum + ringAreaSqMeters(ring), 0));
  if (!Number.isFinite(sqMeters) || sqMeters <= 0) return null;
  const sqft = Math.round(sqMeters * SQFT_PER_SQ_METER);
  return sqft > 0 && sqft <= MAX_GEOMETRY_LOT_SQFT ? sqft : null;
}

function featureSqft(feature, acresField) {
  const acres = feature?.attributes?.[acresField];
  if (typeof acres === 'number' && Number.isFinite(acres) && acres > 0) {
    return Math.round(acres * SQFT_PER_ACRE);
  }
  return geometrySqft(feature?.geometry);
}

export async function parcelSqftFromArcGIS(lat, lon, fetchImpl = fetch, config = {}) {
  coordinates(lat, lon);
  if (!config.layerUrl) return null;
  const url = new URL(config.layerUrl);
  // SSRF Protection: Restrict hostnames to trusted ArcGIS/government domain suffixes or local/test endpoints.
  const host = url.hostname.toLowerCase();
  const isTrustedHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host.endsWith('.gov') || host.endsWith('.us') || host === 'arcgis.com' || host.endsWith('.arcgis.com') || host.endsWith('.example');
  if (url.protocol !== 'https:' || url.username || url.password || !isTrustedHost) throw new Error('Invalid parcel configuration.');
  const acresField = config.acresField || 'ACREAGE';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(acresField)) throw new Error('Invalid parcel field.');
  const query = async (extra) => {
    const target = new URL(url.toString());
    const params = { geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields: acresField, returnGeometry: 'true', outSR: '4326', f: 'json', ...extra };
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    const data = await fetchJson(target.toString(), fetchImpl, config.timeoutMs ?? 5000);
    if (data?.error || !Array.isArray(data?.features)) throw new Error('Invalid parcel response.');
    return data.features;
  };
  // A feature only counts when it can actually size a lot; the county
  // catch-all placeholder and other unsized features are ignored, so a point
  // sitting on the placeholder alone is a miss, not a measurement.
  const sizes = (features) => features.map((feature) => featureSqft(feature, acresField)).filter((value) => value !== null);
  const atPoint = sizes(await query({}));
  if (atPoint.length === 1) return area(atPoint[0], 'parcel area');
  // Overlapping parcels cannot safely be resolved by taking the first result.
  if (atPoint.length > 1) return null;
  // The geocoded point missed every real parcel — address points are often
  // interpolated into the road in front of the house. Look a few meters out
  // and accept the parcel only when exactly one real parcel is near.
  const nearby = sizes(await query({ distance: '25', units: 'esriSRUnit_Meter' }));
  return nearby.length === 1 ? area(nearby[0], 'parcel area') : null;
}

export async function resolveLotSqft(lat, lon, fetchImpl = fetch, config = {}) {
  coordinates(lat, lon);
  let warning = config.layerUrl ? 'parcel-not-found' : 'parcel-not-configured';
  try {
    const parcel = await parcelSqftFromArcGIS(lat, lon, fetchImpl, config);
    if (parcel) return { lotSqft: parcel, source: 'county-parcel', confidence: 'medium', warnings: [] };
  } catch { warning = 'parcel-lookup-unavailable'; }
  return typicalLot(warning);
}

export function typicalLot(warning = 'lot-area-unknown') {
  return { lotSqft: SURFACE.fallbackLotSqft, source: 'typical-lot-fallback', confidence: 'low', warnings: [warning] };
}

export function surfaceAreas(lotSqft) {
  area(lotSqft, 'lotSqft');
  return { lotSqft, lawnSqft: Math.max(1, Math.round(lotSqft * SURFACE.lawnShareOfLot)),
    drivewaySqft: Math.max(1, Math.round(lotSqft * SURFACE.drivewayShareOfLot)) };
}
