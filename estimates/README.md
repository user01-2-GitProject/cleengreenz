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
  scaled by tree cover (light x1.0 / moderate x1.3 / heavy x1.6) and by
  the AMOUNT of leaf work in the visit (light x0.15 / moderate x0.27 /
  full x1.0). Calibrated 2026-10-24: lawn + a moderate amount of leaves
  at 812 Chippewa Trail = $110 total ($50 grass + $60 leaves); the $220
  typical-lot figure is a full cleanup.
- **Snow:** $35 up to 400 sq ft of driveway/walk, +$5 per extra 100 sq ft.
  Season contract assumes ~20 plowable events, Nov–Mar.

## Tests

`npm test` runs `tests/estimates.test.js` — pure pricing math, no network.

## Customer flow (October 25, 2026)

Jimmy confirmed the branch's rates may be used publicly. The homepage calculator
uses `POST /api/estimate` to look up an address, explain the source of its area
figures, and calculate a preliminary per-visit range. Customers can supply their
own lot, lawn, or driveway measurements. They confirm the address and area
assumptions before seeing prices or transferring the estimate to the existing
quote-request form. Grass uses the **job** range, including the $50 stop minimum.
The calculator does not book work, charge money, or promise a season discount.

The address, selected service, area basis and price range pass into the existing
contact form; the customer must still provide contact information and submit it.
Existing notes are preserved. Calculating alone never creates a lead or sends
email. A preliminary estimate is not Chris's final quote or service-area approval.

### Area and lookup limits

- Census coordinates are calculated along a street address range; they are not
  proof of a property's boundary. See the [official Census API documentation](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html).
- A parcel's acreage is its total lot area, not measured lawn or driveway area.
  The 72% / 9% split remains an explicit assumption unless the customer supplies
  those surface measurements.
- Missing or unavailable parcel data uses the labeled 7,840 sq ft example from
  `rates.js`. It must never be described as a measured property size.
- The Pages endpoint defaults to Berrien County's current public parcel layer,
  querying only its numeric `acres` field. Its [official metadata](https://gis.berriencountymi.gov/server/rest/services/Hosted/Parcels_Current/FeatureServer/0?f=pjson)
  and [county portal item](https://gis.berriencountymi.gov/portal/sharing/rest/content/items/8c8ff545a18449118d25616955f5f9d6?f=json)
  identify it as current parcels, updated annually. Records are approximate,
  not surveyed boundaries. Outside coverage or on lookup failure, the explicitly
  labeled typical-lot fallback remains available.
- Optional overrides come from Pages Function bindings, not `process.env`:
  `PARCEL_LAYER_URL` (HTTPS query endpoint) and `PARCEL_ACRES_FIELD` (numeric
  acreage field). No credential belongs in this file.

### Privacy and request handling

The browser posts to the site's own endpoint. Address lookup sends the entered
address to the US Census Geocoder; an optional configured county service receives
coordinates. The calculator does not save addresses in URLs, browser storage,
analytics, logs, or a database. Once the customer submits the existing quote form,
its existing lead storage and email behavior applies. Infrastructure providers
may retain their normal request logs. The endpoint uses no-store responses,
bounded JSON input, lookup deadlines and a separate best-effort per-isolate rate
limit; this is not a globally coordinated abuse limit.

### Verification

`npm test` includes pricing calibration, invalid input, mocked lookup/outage,
endpoint and browser-form tests. Use a Pages preview to check the actual server
route and desktop/mobile flow. A plain static server cannot execute `/api/estimate`.

### Before production

Review the branch preview before merging the calculator to production. County
data is supplied as-is; a coordinate match and parcel acreage do not verify the
customer's service area or exact mowing/snow surfaces. The customer confirmation
and Chris's final quote remain necessary.
