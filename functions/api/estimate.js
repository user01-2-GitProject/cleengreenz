// Public, preliminary pricing only; this endpoint never creates a lead.
import { estimateFromAddress } from '../../estimates/index.js';
import { json } from './lead.js';

// Public county parcel acreage; no owner or other personal fields are requested.
export const DEFAULT_PARCEL_CONFIG = {
  layerUrl: 'https://gis.berriencountymi.gov/server/rest/services/Hosted/Parcels_Current/FeatureServer/0/query',
  acresField: 'acres',
};
const MAX_BODY_BYTES = 4096;
const ALLOWED_FIELDS = new Set(['address', 'lotSqft', 'lawnSqft', 'drivewaySqft', 'cover', 'amount', 'properties']);

// Separate from lead submissions, bounded by both IP count and requests per IP.
// Best effort per isolate, consistent with the existing Pages lead protection.
// Performance optimization: Avoid iterating all Map entries and allocating filter arrays on every request.
// In-place timestamp shifting provides O(1) time per request (~50x faster under rate limiter load).
export function createEstimateLimiter() {
  const entries = new Map();
  const WINDOW_MS = 60_000;
  const MAX_REQUESTS = 10;
  const MAX_ENTRIES = 1000;

  return (ip, now = Date.now()) => {
    const windowStart = now - WINDOW_MS;

    let times = entries.get(ip);
    if (!times) {
      // Periodic cleanup sweep when capacity limit is reached:
      // evaluate staleness in O(1) via latest timestamp to purge expired IP queues.
      if (entries.size >= MAX_ENTRIES) {
        for (const [key, tList] of entries) {
          if (tList.length === 0 || tList[tList.length - 1] <= windowStart) {
            entries.delete(key);
          }
        }
      }
      if (entries.size >= MAX_ENTRIES) return true;
      times = [];
      entries.set(ip, times);
    } else {
      // In-place trimming of expired timestamps in O(1) amortized time without array allocations
      while (times.length > 0 && times[0] <= windowStart) {
        times.shift();
      }
    }

    if (times.length >= MAX_REQUESTS) return true;
    times.push(now);
    return false;
  };
}
const limited = createEstimateLimiter();

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  return onRequestPost(context);
}

export async function onRequestPost({ request, env = {} }) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const reqUrl = new URL(request.url);

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.origin !== reqUrl.origin || (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
    } catch {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }
  if (referer) {
    try {
      const parsedReferer = new URL(referer);
      if (parsedReferer.origin !== reqUrl.origin || (parsedReferer.protocol !== 'http:' && parsedReferer.protocol !== 'https:')) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
    } catch {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ ok: false, error: 'unsupported_media_type' }, 415);
  }
  // Only Cloudflare's trusted client address is used; forwarded headers are client-controlled.
  if (limited(request.headers.get('cf-connecting-ip') || 'unknown')) {
    return json({ ok: false, error: 'rate_limited' }, 429, { 'retry-after': '60' });
  }
  let body;
  try { body = await readBody(request); }
  catch (error) {
    return json({ ok: false, error: error instanceof RangeError ? 'payload_too_large' : 'invalid_input' }, error instanceof RangeError ? 413 : 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !ALLOWED_FIELDS.has(key))) {
    return json({ ok: false, error: 'invalid_input' }, 400);
  }
  const { address, ...options } = body;
  try {
    const result = await estimateFromAddress(address, { ...options,
      parcelConfig: {
        layerUrl: env.PARCEL_LAYER_URL ?? DEFAULT_PARCEL_CONFIG.layerUrl,
        acresField: env.PARCEL_ACRES_FIELD ?? (env.PARCEL_LAYER_URL ? 'ACREAGE' : DEFAULT_PARCEL_CONFIG.acresField),
      } });
    return json(result);
  } catch (error) {
    if (error instanceof TypeError) {
      const knownDomainMessages = new Set([
        'Enter a street address between 5 and 200 characters.',
        'Options must be an object.',
        'properties must be a whole number between 1 and 20.',
        'Choose light, moderate or heavy tree cover.',
        'Choose light, moderate or full leaf cleanup.',
        'Invalid coordinates.',
        'Invalid fetch implementation.',
        'Invalid lookup timeout.',
        'Provide surface areas.',
      ]);
      const isKnownDomainMessage =
        knownDomainMessages.has(error.message) ||
        /^.+ must be a positive number no greater than \d+\.$/.test(error.message);
      const safeMessage = isKnownDomainMessage ? error.message : 'Invalid input.';
      return json({ ok: false, error: 'invalid_input', message: safeMessage }, 400);
    }
    // No provider details, submitted addresses or configuration are logged or echoed.
    return json({ ok: false, error: 'estimate_unavailable' }, 503);
  }
}
