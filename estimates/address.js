// address.js — turn a typed street address into coordinates.
// Uses the US Census Bureau geocoder: free, no API key, US addresses only.
// Docs: https://geocoding.geo.census.gov/geocoder/

const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

/**
 * Geocode a one-line address ("1154 Lambert St, Niles, MI 49120").
 * Returns { matchedAddress, lat, lon } or null when the Census geocoder
 * cannot match it. Throws only on network/HTTP failure.
 */
export async function geocodeAddress(address, fetchImpl = fetch) {
  const url =
    `${CENSUS_URL}?address=${encodeURIComponent(address)}` +
    `&benchmark=Public_AR_Current&format=json`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}`);
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  return {
    matchedAddress: match.matchedAddress,
    lat: match.coordinates.y,
    lon: match.coordinates.x,
  };
}
