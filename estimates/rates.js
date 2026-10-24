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

// Grass cutting, per visit. CALIBRATED 2026-10-24 to Chris's real price:
// $60 to cut Jimmy's property AND the house next door — two typical
// in-town lots side by side — so one typical lot must price at $30/visit:
// base $28 + $3 per 1,000 sq ft over 5,000 lands the typical 5,645 sq ft
// lawn at exactly $30. (This supersedes the ~$57 "market average" from
// Lawn Love — Chris's actual price is the ground truth for this business.)
export const GRASS = {
  basePrice: 28, // covers the first baseLawnSqft of lawn
  baseLawnSqft: 5000,
  perThousandOverBase: 3, // added per extra 1,000 sq ft of lawn
  minimum: 25,
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
