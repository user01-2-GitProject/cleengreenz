import { geocodeAddress } from './address.js';
import { resolveLotSqft, surfaceAreas, typicalLot } from './lot.js';
import { grassEstimate } from './grass/grass.js';
import { leavesEstimate } from './leaves/leaves.js';
import { snowEstimate } from './snow/snow.js';
import { area, addressValue, optionsValue } from './validation.js';

export function estimateFromAreas(areas, options = {}) {
  optionsValue(options);
  if (!areas || typeof areas !== 'object') throw new TypeError('Provide surface areas.');
  const { lawnSqft, lotSqft, drivewaySqft } = areas;
  area(lawnSqft, 'lawnSqft'); area(lotSqft, 'lotSqft'); area(drivewaySqft, 'drivewaySqft');
  return { grass: grassEstimate(lawnSqft, options), leaves: leavesEstimate(lotSqft, options.cover, options), snow: snowEstimate(drivewaySqft) };
}

export async function estimateFromAddress(address, options = {}) {
  address = addressValue(address);
  optionsValue(options);
  for (const field of ['lotSqft', 'lawnSqft', 'drivewaySqft']) {
    if (options[field] !== undefined) area(options[field], field);
  }
  const warnings = [];
  let geo = null;
  let lot;
  if (options.lotSqft !== undefined) {
    lot = { lotSqft: options.lotSqft, source: 'provided', confidence: 'provided', warnings: [] };
  } else {
    try {
      geo = await geocodeAddress(address, options.fetchImpl, { timeoutMs: options.timeoutMs });
      if (!geo) warnings.push('address-not-matched');
    } catch { warnings.push('address-lookup-unavailable'); }
    lot = geo
      ? await resolveLotSqft(geo.lat, geo.lon, options.fetchImpl, { ...options.parcelConfig, timeoutMs: options.timeoutMs })
      : typicalLot('lot-area-unknown');
  }
  const property = {
    input: address, ...(geo || {}), ...lot, ...surfaceAreas(lot.lotSqft),
    lawnSqft: options.lawnSqft ?? surfaceAreas(lot.lotSqft).lawnSqft,
    drivewaySqft: options.drivewaySqft ?? surfaceAreas(lot.lotSqft).drivewaySqft,
    surfaceBasis: { lot: lot.source, lawn: options.lawnSqft !== undefined ? 'provided' : 'lot-share-assumption',
      driveway: options.drivewaySqft !== undefined ? 'provided' : 'lot-share-assumption' },
    requiresConfirmation: lot.source !== 'provided' || options.lawnSqft === undefined || options.drivewaySqft === undefined,
    warnings: [...warnings, ...lot.warnings],
  };
  return { ok: true, property, estimates: estimateFromAreas(property, options) };
}
