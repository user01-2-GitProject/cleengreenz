// snow.js — snow shoveling / clearing estimate from driveway + walk area.
// Snow work is priced on the hard surface, not the lot: driveway and front
// walk square footage drive the per-visit price.

import { SNOW } from "../rates.js";

const round5 = (n) => Math.round(n / 5) * 5;

export function snowEstimate(drivewaySqft) {
  const over = Math.max(0, drivewaySqft - SNOW.baseDrivewaySqft);
  const mid = Math.max(
    SNOW.minimum,
    SNOW.basePrice + (over / 100) * SNOW.perHundredOverBase
  );
  const perVisit = {
    low: round5(mid * (1 - SNOW.rangeSpread)),
    mid: round5(mid),
    high: round5(mid * (1 + SNOW.rangeSpread)),
  };
  const seasonMid = round5(
    perVisit.mid * SNOW.seasonEvents * (1 - SNOW.seasonDiscount)
  );
  return {
    service: "snow",
    basisSqft: drivewaySqft,
    perVisit,
    season: {
      events: SNOW.seasonEvents,
      mid: seasonMid,
      note: `Season contract assumes ~${SNOW.seasonEvents} plowable events, Nov-Mar, season discount applied`,
    },
    explanation:
      `$${SNOW.basePrice} covers the first ${SNOW.baseDrivewaySqft} sq ft of driveway/walk, ` +
      `+$${SNOW.perHundredOverBase} per extra 100 sq ft (minimum $${SNOW.minimum}).`,
  };
}
