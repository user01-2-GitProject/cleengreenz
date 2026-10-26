// Census matches locate an address; they do not measure its lawn or driveway.
import { addressValue, coordinates, fetchJson } from './validation.js';
const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

export async function geocodeAddress(address, fetchImpl = fetch, { timeoutMs = 5000 } = {}) {
  address = addressValue(address);
  const params = new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' });
  const data = await fetchJson(`${CENSUS_URL}?${params}`, fetchImpl, timeoutMs);
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) throw new Error('Invalid address lookup response.');
  if (!matches.length) return null;
  // Multiple matches require a choice; never silently select a different property.
  if (matches.length !== 1) throw new Error('Address match is ambiguous.');
  const match = matches[0];
  const matchedAddress = addressValue(match?.matchedAddress);
  const lat = match?.coordinates?.y;
  const lon = match?.coordinates?.x;
  coordinates(lat, lon);
  return { matchedAddress, lat, lon };
}
