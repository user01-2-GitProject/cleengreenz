// grass.js — grass cutting estimate from lawn square footage.
// Calibrated to Chris's real prices (see rates.js): the per-property curve
// lands a typical lot at $30, a per-stop job minimum of $50 applies, and
// solo job time runs ~150 sq ft of lawn per minute — so the two-lot stop
// next door prices at $60 and takes about 1 hr 15, exactly like real life.

import { GRASS } from "../rates.js";

const round5 = (n) => Math.round(n / 5) * 5;

export function grassEstimate(lawnSqft, { properties = 1 } = {}) {
  const over = Math.max(0, lawnSqft - GRASS.baseLawnSqft);
  const raw = Math.max(
    GRASS.minimum,
    GRASS.basePrice + (over / 1000) * GRASS.perThousandOverBase
  );
  // Per-visit prices round to the dollar (not $5) so the calibration to
  // Chris's real $30-per-typical-lot price lands exact.
  const perProperty = {
    low: Math.round(raw * (1 - GRASS.rangeSpread)),
    mid: Math.round(raw),
    high: Math.round(raw * (1 + GRASS.rangeSpread)),
  };
  // The job is what's actually charged: per-property price times the
  // number of properties at the stop, with Chris's $50 job minimum.
  const jobMid = Math.max(GRASS.jobMinimum, perProperty.mid * properties);
  const job = {
    properties,
    low: Math.max(GRASS.jobMinimum, perProperty.low * properties),
    mid: jobMid,
    high: Math.max(GRASS.jobMinimum, perProperty.high * properties),
    minutes: Math.round((lawnSqft * properties) / GRASS.soloSqftPerMin),
    note:
      properties > 1
        ? `${properties} properties at one stop`
        : `Includes Chris's $${GRASS.jobMinimum} minimum per stop when the yard itself prices lower`,
  };
  const seasonMid = round5(jobMid * GRASS.seasonVisits * (1 - GRASS.seasonDiscount));
  return {
    service: "grass",
    basisSqft: lawnSqft,
    perProperty,
    job,
    season: {
      visits: GRASS.seasonVisits,
      mid: seasonMid,
      note: `Weekly cuts, ~${GRASS.seasonVisits} visits Apr-Oct, season discount applied`,
    },
    explanation:
      `$${GRASS.basePrice} covers the first ${GRASS.baseLawnSqft.toLocaleString()} sq ft of lawn, ` +
      `+$${GRASS.perThousandOverBase} per extra 1,000 sq ft (minimum $${GRASS.minimum} per property, ` +
      `$${GRASS.jobMinimum} minimum per stop).`,
  };
}
