// leaves.js — leaf blowing / cleanup estimate from lot square footage.
// Leaves cover the whole lot, not just the lawn, and tree cover is the
// swing factor: the same lot with heavy oaks is a different job than a
// light one. Cover level is an input; "moderate" is the default.

import { LEAVES } from "../rates.js";

const round5 = (n) => Math.round(n / 5) * 5;

export function leavesEstimate(lotSqft, cover = LEAVES.defaultCover) {
  const factor = LEAVES.coverFactors[cover] ?? LEAVES.coverFactors.moderate;
  const over = Math.max(0, lotSqft - LEAVES.baseLotSqft);
  const mid = Math.max(
    LEAVES.minimum,
    (LEAVES.basePrice + (over / 1000) * LEAVES.perThousandOverBase) * factor
  );
  const perVisit = {
    low: round5(mid * (1 - LEAVES.rangeSpread)),
    mid: round5(mid),
    high: round5(mid * (1 + LEAVES.rangeSpread)),
  };
  const seasonMid = round5(
    perVisit.mid * LEAVES.seasonVisits * (1 - LEAVES.seasonDiscount)
  );
  return {
    service: "leaves",
    basisSqft: lotSqft,
    cover,
    perVisit,
    season: {
      visits: LEAVES.seasonVisits,
      mid: seasonMid,
      note: `Typical fall package: ${LEAVES.seasonVisits} visits (early, mid, final), season discount applied`,
    },
    explanation:
      `$${LEAVES.basePrice} covers the first ${LEAVES.baseLotSqft.toLocaleString()} sq ft of lot, ` +
      `+$${LEAVES.perThousandOverBase} per extra 1,000 sq ft, x${factor} for ${cover} tree cover ` +
      `(minimum $${LEAVES.minimum}).`,
  };
}
