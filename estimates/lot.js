// County parcel acreage is optional. Configuration is explicit, never read from
// Node globals, so the pricing modules also work in a browser or Pages runtime.
import { SURFACE } from './rates.js';
import { area, coordinates, fetchJson } from './validation.js';
const SQFT_PER_ACRE = 43560;
const TRUSTED_HOST_PATTERNS = [/\.gov$/i, /\.us$/i, /(^|\.)arcgis\.com$/i, /\.example$/i, /^localhost$/i];

function isTrustedParcelHost(hostname) {
  return TRUSTED_HOST_PATTERNS.some(pattern => pattern.test(hostname));
}

export async function parcelSqftFromArcGIS(lat, lon, fetchImpl = fetch, config = {}) {
  coordinates(lat, lon);
  if (!config.layerUrl) return null;
  const url = new URL(config.layerUrl);
  if (url.protocol !== 'https:' || url.username || url.password || !isTrustedParcelHost(url.hostname)) {
    throw new Error('Invalid parcel configuration.');
  }
  const acresField = config.acresField || 'ACREAGE';
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u.test(acresField)) throw new Error('Invalid parcel field.');
  const params = { geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: acresField, returnGeometry: 'false', f: 'json' };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const data = await fetchJson(url.toString(), fetchImpl, config.timeoutMs ?? 5000);
  if (data?.error || !Array.isArray(data?.features)) throw new Error('Invalid parcel response.');
  // Overlapping parcels cannot safely be resolved by taking the first result.
  if (data.features.length !== 1) return null;
  const acres = data.features[0]?.attributes?.[acresField];
  if (typeof acres !== 'number' || !Number.isFinite(acres) || acres <= 0) return null;
  return area(Math.round(acres * SQFT_PER_ACRE), 'parcel area');
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
