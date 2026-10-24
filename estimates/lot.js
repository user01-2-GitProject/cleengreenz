// lot.js — resolve a property's lot square footage.
//
// Provider chain, best source first:
//   1. ArcGIS parcel layer (county GIS). Many counties publish a public
//      ArcGIS REST layer of parcels with an acreage field. Point
//      PARCEL_LAYER_URL at that layer's query endpoint and set
//      PARCEL_ACRES_FIELD to its acreage attribute, and lot size comes
//      straight from the county record (high confidence).
//      Berrien County (Niles) is the first layer to wire up — see README.
//   2. Fallback typical lot (rates.js SURFACE.fallbackLotSqft), labeled
//      low confidence. Never present a fallback figure as measured.
//
// Every result carries its source so the estimate can say how it knows.

import { SURFACE } from "./rates.js";

const SQFT_PER_ACRE = 43560;

// Configured via environment so each county/site can point at its own GIS.
const PARCEL_LAYER_URL = process.env.PARCEL_LAYER_URL || "";
const PARCEL_ACRES_FIELD = process.env.PARCEL_ACRES_FIELD || "ACREAGE";

/**
 * Ask an ArcGIS REST layer which parcel contains (lat, lon) and read its
 * acreage. Returns square feet, or null when no layer is configured, the
 * point hits no parcel, or the parcel has no acreage recorded.
 */
export async function parcelSqftFromArcGIS(lat, lon, fetchImpl = fetch) {
  if (!PARCEL_LAYER_URL) return null;
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: PARCEL_ACRES_FIELD,
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetchImpl(`${PARCEL_LAYER_URL}?${params}`);
  if (!res.ok) throw new Error(`Parcel layer HTTP ${res.status}`);
  const data = await res.json();
  const attrs = data?.features?.[0]?.attributes;
  const acres = attrs?.[PARCEL_ACRES_FIELD];
  if (typeof acres !== "number" || !(acres > 0)) return null;
  return Math.round(acres * SQFT_PER_ACRE);
}

/**
 * Resolve lot square footage for a geocoded point.
 * Returns { lotSqft, source, confidence } where source is "county-parcel"
 * or "typical-lot-fallback".
 */
export async function resolveLotSqft(lat, lon, fetchImpl = fetch) {
  const parcel = await parcelSqftFromArcGIS(lat, lon, fetchImpl);
  if (parcel) {
    return { lotSqft: parcel, source: "county-parcel", confidence: "high" };
  }
  return {
    lotSqft: SURFACE.fallbackLotSqft,
    source: "typical-lot-fallback",
    confidence: "low",
  };
}

/** Split a lot into the surfaces each service actually works on. */
export function surfaceAreas(lotSqft) {
  return {
    lotSqft,
    lawnSqft: Math.round(lotSqft * SURFACE.lawnShareOfLot),
    drivewaySqft: Math.round(lotSqft * SURFACE.drivewayShareOfLot),
  };
}
