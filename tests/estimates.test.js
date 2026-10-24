// Unit tests for the estimates tool — pure pricing math only, no network.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { surfaceAreas } from "../estimates/lot.js";
import { grassEstimate } from "../estimates/grass/grass.js";
import { leavesEstimate } from "../estimates/leaves/leaves.js";
import { snowEstimate } from "../estimates/snow/snow.js";
import { estimateFromAreas } from "../estimates/index.js";

test("surfaceAreas splits a lot into lawn and driveway shares", () => {
  const a = surfaceAreas(10000);
  assert.equal(a.lawnSqft, 7200);
  assert.equal(a.drivewaySqft, 900);
});

test("grass: calibrated to Chris's real price — $30 per typical lot", () => {
  // Calibration (Jimmy, 2026-10-24): Chris charges $60 to cut Jimmy's
  // property plus the house next door — two typical in-town lots.
  // 7,840 sq ft fallback lot -> 5,645 sq ft of lawn.
  const e = grassEstimate(5645);
  assert.equal(e.perVisit.mid, 30);
  assert.equal(e.perVisit.mid * 2, 60); // the pair prices at Chris's $60
  assert.ok(e.perVisit.low < e.perVisit.mid && e.perVisit.mid < e.perVisit.high);
  assert.ok(e.season.mid > e.perVisit.mid * 20);
});

test("grass: small lawn pays the base price", () => {
  const e = grassEstimate(2000);
  assert.equal(e.perVisit.mid, 28); // base price, above the $25 minimum
});

test("leaves: heavy cover costs more than light on the same lot", () => {
  const light = leavesEstimate(7840, "light");
  const heavy = leavesEstimate(7840, "heavy");
  assert.ok(heavy.perVisit.mid > light.perVisit.mid);
});

test("snow: bigger driveway costs more per visit", () => {
  const small = snowEstimate(400);
  const big = snowEstimate(1200);
  assert.equal(small.perVisit.mid, 35);
  assert.ok(big.perVisit.mid > small.perVisit.mid);
});

test("estimateFromAreas prices all three services", () => {
  const all = estimateFromAreas({ lawnSqft: 5645, lotSqft: 7840, drivewaySqft: 706 });
  assert.equal(all.grass.service, "grass");
  assert.equal(all.leaves.service, "leaves");
  assert.equal(all.snow.service, "snow");
});
