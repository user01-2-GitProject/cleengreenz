# Cleen Greenz — Estimates Tool

Type in an address, get a fair estimate for grass cutting, leaf blowing,
and snow shoveling. Built for the Cleen Greenz site so a visitor can price
their own yard instead of only filling in a contact form (Jimmy's note,
2026-10-24).

## Layout

```
        estimates
        /     |      \
    grass   leaves    snow
```

- `address.js` — geocodes the typed address via the **US Census Geocoder**
  (free, no API key, US only).
- `lot.js` — resolves the property's **lot square footage** (see below)
  and splits it into lawn / driveway surfaces.
- `rates.js` — **every price and assumption in one file.** Tune prices here.
- `grass/grass.js`, `leaves/leaves.js`, `snow/snow.js` — one pricing model
  per service, each reading only from `rates.js`.
- `index.js` — `estimateFromAddress(address)` runs the whole pipeline;
  `estimateFromAreas(areas)` prices known square footage directly.

Each service returns a per-visit **range** (low / mid / high — a fair
estimate is a range, not a fake-precise number), a full-season figure, and
a plain-English explanation of the math.

## Where the square footage comes from

Honest version: there is no free national parcel database. The chain in
`lot.js` is:

1. **County parcel record (high confidence).** Many counties publish a
   public ArcGIS REST parcel layer with an acreage field. Set
   `PARCEL_LAYER_URL` to that layer's query endpoint and
   `PARCEL_ACRES_FIELD` to its acreage attribute (default `ACREAGE`) and
   lot size comes straight from the county. **First wire-up target:
   Berrien County GIS** (Niles) — the service area's own parcels.
2. **Typical-lot fallback (low confidence).** If no parcel layer answers,
   the tool assumes a typical in-town lot (7,840 sq ft, in `rates.js`) and
   the result is labeled `confidence: "low"` with source
   `"typical-lot-fallback"` so it is never quoted as measured. A caller who
   knows the real lot size can pass `lotSqft` and skip the lookup entirely.

Lawn and driveway areas are shares of the lot (house/drive/beds removed):
72% lawn, 9% driveway + walk — also in `rates.js`, also tunable.

## Rates (starting points, Chris has final say)

- **Grass:** $28 up to 5,000 sq ft of lawn, +$3 per extra 1,000 sq ft,
  with a **$50 minimum per stop**. Calibrated to Chris's real prices
  (2026-10-24): $60 cuts Jimmy's property plus the house next door (the
  pair prices at $30 per property and clears the minimum on its own),
  $50 is the cheapest job he does, and the pair takes him ~1 hr 15 solo
  (~150 sq ft/min — the tool also estimates job time). Season = 26 weekly
  cuts with a 10% booking discount.
- **Leaves:** $120 up to 5,000 sq ft of lot, +$18 per extra 1,000 sq ft,
  scaled by tree cover (light x1.0 / moderate x1.3 / heavy x1.6).
- **Snow:** $35 up to 400 sq ft of driveway/walk, +$5 per extra 100 sq ft.
  Season contract assumes ~20 plowable events, Nov–Mar.

## Tests

`npm test` runs `tests/estimates.test.js` — pure pricing math, no network.

## Not built yet (next steps)

- Wire the real Berrien County parcel layer URL into `PARCEL_LAYER_URL`.
- A page on cleengreenz.com that calls this and shows the estimate, then
  hands the address + estimate into the existing lead flow.
- Chris confirms/tunes the starting rates in `rates.js`.
