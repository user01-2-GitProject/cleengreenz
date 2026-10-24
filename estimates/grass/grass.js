// grass.js — grass cutting estimate from lawn square footage.
// A fair estimate is a range: the mid price from the rate table, quoted
// +/- the spread in rates.js, with a full-season figure alongside.

import { GRASS } from "../rates.js";

const round5 = (n) => Math.round(n / 5) * 5;

export function grassEstimate(lawnSqft) {
  const over = Math.max(0, lawnSqft - GRASS.baseLawnSqft);
  const mid = Math.max(
    GRASS.minimum,
    GRASS.basePrice + (over / 1000) * GRASS.perThousandOverBase
  );
  // Per-visit prices round to the dollar (not $5) so the calibration to
  // Chris's real $30-per-typical-lot price lands exact.
  const perVisit = {
    low: Math.round(mid * (1 - GRASS.rangeSpread)),
    mid: Math.round(mid),
    high: Math.round(mid * (1 + GRASS.rangeSpread)),
  };
  const seasonMid = round5(
    perVisit.mid * GRASS.seasonVisits * (1 - GRASS.seasonDiscount)
  );
  return {
    service: "grass",
    basisSqft: lawnSqft,
    perVisit,
    season: {
      visits: GRASS.seasonVisits,
      mid: seasonMid,
      note: `Weekly cuts, ~${GRASS.seasonVisits} visits Apr-Oct, season discount applied`,
    },
    explanation:
      `$${GRASS.basePrice} covers the first ${GRASS.baseLawnSqft.toLocaleString()} sq ft of lawn, ` +
      `+$${GRASS.perThousandOverBase} per extra 1,000 sq ft (minimum $${GRASS.minimum}).`,
  };
}
