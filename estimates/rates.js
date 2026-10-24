// rates.js — every price and assumption for the estimates tool lives here.
// Chris: tune the numbers in this one file; the math in grass/, leaves/ and
// snow/ reads from these constants and nothing is hard-coded elsewhere.

// Lot -> lawn/driveway heuristics. A parcel's total square footage includes
// the house, driveway, beds and walks; only part of it is grass.
export const SURFACE = {
  // Share of the lot that is mowable lawn (house + drive + beds removed).
  lawnShareOfLot: 0.72,
  // Share of the lot counted as driveway + front walk for snow work when no
  // better figure is known.
  drivewayShareOfLot: 0.09,
  // Assumed lot size (sq ft) when no parcel record can be found. Roughly an
  // in-town Niles lot (about 0.18 acre). Estimates built on this are labeled
  // low-confidence so nobody quotes them as measured.
  fallbackLotSqft: 7840,
};

// Grass cutting, per visit. CALIBRATED 2026-10-24 to Chris's real prices
// (Jimmy's figures, not market surveys):
//   - $60 cuts Jimmy's property AND the house next door — two typical
//     in-town lots at one stop — so the per-property curve must land a
//     typical lot at $30: base $28 + $3 per 1,000 sq ft over 5,000 does
//     (typical lawn = 5,645 sq ft -> exactly $30, pair = $60).
//   - $50 is the cheapest job he does: a per-stop JOB MINIMUM. A single
//     typical lot curves to $30 but quotes at the $50 job minimum; the
//     pair clears the minimum on its own ($60).
//   - The pair takes him ~1 hr 15 min solo: ~150 sq ft of lawn per minute,
//     used for the job-time estimate.
// (Supersedes the ~$57 "market average" from Lawn Love.)
export const GRASS = {
  basePrice: 28, // covers the first baseLawnSqft of lawn
  baseLawnSqft: 5000,
  perThousandOverBase: 3, // added per extra 1,000 sq ft of lawn
  minimum: 25,
  jobMinimum: 50, // cheapest job Chris does — per stop, per visit
  soloSqftPerMin: 150, // solo pace: ~11,300 sq ft of lawn in ~75 minutes
  rangeSpread: 0.1, // estimates are quoted as mid +/- 10%
  seasonVisits: 26, // weekly cuts, roughly April-October
  seasonDiscount: 0.1, // full-season booking discount
};

// Leaf blowing / cleanup, per visit. Tree cover is the swing factor, so the
// customer (or Chris) picks a cover level; moderate is the default.
export const LEAVES = {
  basePrice: 120, // covers the first baseLotSqft of lot
  baseLotSqft: 5000,
  perThousandOverBase: 18,
  minimum: 95,
  rangeSpread: 0.15,
  coverFactors: { light: 1.0, moderate: 1.3, heavy: 1.6 },
  defaultCover: "moderate",
  seasonVisits: 3, // typical fall: early, mid, final cleanup
  seasonDiscount: 0.1,
};

// Snow shoveling / clearing, per visit, priced off the driveway + walk area.
export const SNOW = {
  basePrice: 35, // covers the first baseDrivewaySqft
  baseDrivewaySqft: 400,
  perHundredOverBase: 5, // added per extra 100 sq ft of driveway/walk
  minimum: 30,
  rangeSpread: 0.15,
  // Michiana average: roughly 18-22 plowable events, Nov-Mar.
  seasonEvents: 20,
  seasonDiscount: 0.1,
};
