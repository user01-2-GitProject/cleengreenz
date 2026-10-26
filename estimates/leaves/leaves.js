// leaves.js — leaf blowing / cleanup estimate from lot square footage.
// Leaves cover the whole lot, not just the lawn. Two axes set the price:
// tree COVER (how wooded the lot is) and AMOUNT (how big this visit's leaf
// job is). A moderate amount at a typical lot is a $60 add-on — anchored to
// Chris's real Chippewa Trail job ($50 lawn + $60 leaves = $110); the $220
// figure is a full cleanup. See rates.js for the calibration notes.

import { area, optionsValue } from '../validation.js';
import { LEAVES } from "../rates.js";

const round5 = (n) => Math.round(n / 5) * 5;

export function leavesEstimate(lotSqft, cover = LEAVES.defaultCover, options = {}) {
  area(lotSqft, 'lotSqft');
  optionsValue({ ...optionsValue(options), cover });
  const { amount = 'full' } = options;
  const factor = LEAVES.coverFactors[cover] ?? LEAVES.coverFactors.moderate;
  const amountFactor = LEAVES.amountFactors[amount] ?? 1;
  const over = Math.max(0, lotSqft - LEAVES.baseLotSqft);
  const fullMid = Math.max(
    LEAVES.minimum,
    (LEAVES.basePrice + (over / 1000) * LEAVES.perThousandOverBase) * factor
  );
  const mid = fullMid * amountFactor;
  const perVisit = {
    low: round5(mid * (1 - LEAVES.rangeSpread)),
    mid: round5(mid),
    high: round5(mid * (1 + LEAVES.rangeSpread)),
  };
  const seasonMid = round5(
    round5(fullMid) * LEAVES.seasonVisits * (1 - LEAVES.seasonDiscount)
  );
  return {
    service: "leaves",
    basisSqft: lotSqft,
    cover,
    amount,
    perVisit,
    season: {
      visits: LEAVES.seasonVisits,
      mid: seasonMid,
      note: `Typical fall package: ${LEAVES.seasonVisits} full cleanups (early, mid, final), season discount applied`,
    },
    explanation:
      `Full cleanup: $${LEAVES.basePrice} covers the first ${LEAVES.baseLotSqft.toLocaleString()} sq ft of lot, ` +
      `+$${LEAVES.perThousandOverBase} per extra 1,000 sq ft, x${factor} for ${cover} tree cover ` +
      `(minimum $${LEAVES.minimum}). Amount: light x${LEAVES.amountFactors.light}, ` +
      `moderate x${LEAVES.amountFactors.moderate}, full x1.`,
  };
}
