// Unit tests for the estimates tool — pure pricing math only, no network.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { surfaceAreas, parcelSqftFromArcGIS } from "../estimates/lot.js";
import { grassEstimate } from "../estimates/grass/grass.js";
import { leavesEstimate } from "../estimates/leaves/leaves.js";
import { snowEstimate } from "../estimates/snow/snow.js";
import { estimateFromAreas } from "../estimates/index.js";

test("surfaceAreas splits a lot into lawn and driveway shares", () => {
  const a = surfaceAreas(10000);
  assert.equal(a.lawnSqft, 7200);
  assert.equal(a.drivewaySqft, 900);
});

test("grass: calibrated to Chris's real prices (Jimmy, 2026-10-24)", () => {
  // $60 cuts Jimmy's property plus the house next door (two typical
  // in-town lots at one stop); $50 is the cheapest job he does; the pair
  // takes him ~1 hr 15 solo. 7,840 sq ft lot -> 5,645 sq ft of lawn.
  const single = grassEstimate(5645);
  assert.equal(single.perProperty.mid, 30); // per-property curve
  assert.equal(single.job.mid, 50); // ...but the $50 job minimum binds

  const pair = grassEstimate(5645, { properties: 2 });
  assert.equal(pair.job.mid, 60); // the pair prices at Chris's $60
  assert.equal(pair.job.minutes, 75); // ...and takes him ~1 hr 15 solo

  assert.ok(single.perProperty.low < single.perProperty.mid);
  assert.ok(single.perProperty.mid < single.perProperty.high);
  assert.ok(single.season.mid > single.job.mid * 20);
});

test("grass: small lawn pays the base price per property", () => {
  const e = grassEstimate(2000);
  assert.equal(e.perProperty.mid, 28); // base price, above the $25 minimum
  assert.equal(e.job.mid, 50); // job minimum still binds
});

test("leaves: heavy cover costs more than light on the same lot", () => {
  const light = leavesEstimate(7840, "light");
  const heavy = leavesEstimate(7840, "heavy");
  assert.ok(heavy.perVisit.mid > light.perVisit.mid);
});

test("leaves: full cleanup at a typical lot is $220; moderate amount is $60", () => {
  // Jimmy (2026-10-24): the $220 price "is assuming there's a lot" — it
  // is the FULL cleanup. A moderate-amount visit is far less.
  assert.equal(leavesEstimate(7840, "moderate").perVisit.mid, 220);
  assert.equal(
    leavesEstimate(7840, "moderate", { amount: "moderate" }).perVisit.mid,
    60
  );
});

test("leaves: calibrated to the Chippewa Trail job (Jimmy, 2026-10-24)", () => {
  // 812 Chippewa Trail: lawn + a moderate amount of leaves = $110 total.
  const leaves = leavesEstimate(7840, "moderate", { amount: "moderate" });
  assert.equal(grassEstimate(5645).job.mid + leaves.perVisit.mid, 110);
});

test("snow: bigger driveway costs more per visit", () => {
  const small = snowEstimate(400);
  const big = snowEstimate(1200);
  assert.equal(small.perVisit.mid, 35);
  assert.ok(big.perVisit.mid > small.perVisit.mid);
});

test("parcelSqftFromArcGIS rejects untrusted host domains for parcel config", async () => {
  await assert.rejects(
    async () => {
      await parcelSqftFromArcGIS(42.0, -86.5, fetch, {
        layerUrl: "https://evil.com/arcgis/rest/services/FeatureServer/0/query",
      });
    },
    { message: "Invalid parcel configuration host." }
  );
});

test("estimateFromAreas prices all three services", () => {
  const all = estimateFromAreas({ lawnSqft: 5645, lotSqft: 7840, drivewaySqft: 706 });
  assert.equal(all.grass.service, "grass");
  assert.equal(all.leaves.service, "leaves");
  assert.equal(all.snow.service, "snow");
});
