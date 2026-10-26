// Shared boundaries for direct callers and the public estimate endpoint.
export const MAX_AREA_SQFT = 10_000_000;
export function area(value, name = 'area') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_AREA_SQFT) {
    throw new TypeError(`${name} must be a positive number no greater than ${MAX_AREA_SQFT}.`);
  }
  return value;
}
export function addressValue(value) {
  if (typeof value !== 'string' || value.trim().length < 5 || value.length > 200 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError('Enter a street address between 5 and 200 characters.');
  }
  return value.trim();
}
export function optionsValue(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object.');
  if (options.properties !== undefined && (!Number.isInteger(options.properties) || options.properties < 1 || options.properties > 20)) {
    throw new TypeError('properties must be a whole number between 1 and 20.');
  }
  if (options.cover !== undefined && !['light', 'moderate', 'heavy'].includes(options.cover)) throw new TypeError('Choose light, moderate or heavy tree cover.');
  if (options.amount !== undefined && !['light', 'moderate', 'full'].includes(options.amount)) throw new TypeError('Choose light, moderate or full leaf cleanup.');
  return options;
}
export function coordinates(lat, lon) {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
      typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) throw new TypeError('Invalid coordinates.');
}

// Abort the actual request and bound even fetch implementations that ignore abort.
export async function fetchJson(url, fetchImpl = fetch, timeoutMs = 5000) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Invalid fetch implementation.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new TypeError('Invalid lookup timeout.');
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error' });
        if (!response.ok) throw new Error('Lookup unavailable.');
        return await response.json();
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Lookup timed out.')); }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}
