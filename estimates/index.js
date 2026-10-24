// index.js — the estimates tool entry point.
// Address in -> fair estimates for all three services out:
//
//   const result = await estimateFromAddress("1154 Lambert St, Niles, MI");
//   result.property  — matched address, lot sq ft, where the figure came from
//   result.estimates — { grass, leaves, snow }, each a per-visit range + season
//
// Options:
//   lotSqft  — skip the lookup and price this exact lot size (sq ft).
//   cover    — leaf tree-cover level: "light" | "moderate" | "heavy".

import { geocodeAddress } from "./address.js";
import { resolveLotSqft, surfaceAreas } from "./lot.js";
import { grassEstimate } from "./grass/grass.js";
import { leavesEstimate } from "./leaves/leaves.js";
import { snowEstimate } from "./snow/snow.js";

/** Price all three services from measured/known surface areas. */
export function estimateFromAreas({ lawnSqft, lotSqft, drivewaySqft }, options = {}) {
  return {
    grass: grassEstimate(lawnSqft),
    leaves: leavesEstimate(lotSqft, options.cover),
    snow: snowEstimate(drivewaySqft),
  };
}

/** Full pipeline: geocode the address, resolve its lot, price everything. */
export async function estimateFromAddress(address, options = {}) {
  let property;
  if (options.lotSqft) {
    property = {
      input: address,
      lotSqft: options.lotSqft,
      source: "provided",
      confidence: "high",
      ...surfaceAreas(options.lotSqft),
    };
  } else {
    const geo = await geocodeAddress(address, options.fetchImpl);
    if (!geo) {
      return { ok: false, error: "address-not-matched", input: address };
    }
    const lot = await resolveLotSqft(geo.lat, geo.lon, options.fetchImpl);
    property = {
      input: address,
      matchedAddress: geo.matchedAddress,
      lat: geo.lat,
      lon: geo.lon,
      ...lot,
      ...surfaceAreas(lot.lotSqft),
    };
  }
  return { ok: true, property, estimates: estimateFromAreas(property, options) };
}
