import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('js/estimates.js', 'utf8');
const fixture = () => ({ ok: true, property: { input: '123 Main St, Niles MI', matchedAddress: '123 MAIN ST, NILES MI', lotSqft: 7840, lawnSqft: 5645, drivewaySqft: 706, source: 'typical-lot-fallback', confidence: 'low', surfaceBasis: { lot: 'assumed', lawn: 'assumed', driveway: 'assumed' }, warnings: ['Typical lot assumed.'] }, estimates: { grass: { job: { low: 50, mid: 50, high: 50 } }, leaves: { perVisit: { low: 50, mid: 60, high: 70 } }, snow: { perVisit: { low: 45, mid: 50, high: 55 } } } });
function setup(fetchImpl) {
  const dom = new JSDOM(html, { url: 'https://cleengreenz.com/', runScripts: 'outside-only' });
  const { window } = dom; const calls = [];
  window.fetch = async (...args) => { calls.push(args); return fetchImpl ? fetchImpl(...args) : { ok: true, json: async () => fixture() }; };
  window.eval(source);
  const d = window.document, get = id => d.getElementById(id);
  const input = (id, value) => { get(id).value = value; get(id).dispatchEvent(new window.Event('input', { bubbles: true })); };
  const change = (id, value) => { get(id).value = value; get(id).dispatchEvent(new window.Event('change', { bubbles: true })); };
  const submit = () => get('yard-price-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  const confirm = () => { get('yard-confirm').checked = true; get('yard-confirm').dispatchEvent(new window.Event('change', { bubbles: true })); };
  return { window, d, get, input, change, submit, calls, flush, confirm };
}
test('calculator validates address and area before making requests', () => {
  const e = setup();
  assert.equal(e.get('yard-address').getAttribute('aria-required'), 'true');
  const reqSpan = e.d.querySelector('label[for="yard-address"] .req');
  assert.ok(reqSpan, 'yard address label contains required visual indicator');
  e.submit(); assert.equal(e.calls.length, 0); assert.equal(e.d.activeElement.id, 'yard-address');
  assert.equal(e.get('yard-address').getAttribute('aria-invalid'), 'true');
  assert.match(e.get('yard-address').getAttribute('aria-describedby'), /yard-price-error/);

  e.input('yard-address', '123 Main St, Niles MI');
  assert.equal(e.get('yard-address').hasAttribute('aria-invalid'), false);

  e.input('yard-lot', '-1'); e.submit();
  assert.equal(e.calls.length, 0); assert.equal(e.d.activeElement.id, 'yard-lot'); assert.equal(e.get('yard-area-details').open, true);
  assert.equal(e.get('yard-lot').getAttribute('aria-invalid'), 'true');
  assert.match(e.get('yard-lot').getAttribute('aria-describedby'), /yard-price-error/);

  e.input('yard-lot', '8000');
  assert.equal(e.get('yard-lot').hasAttribute('aria-invalid'), false);
  assert.doesNotMatch(e.get('yard-lot').getAttribute('aria-describedby') || '', /yard-price-error/);
});
test('confirmation gate, safe property rendering, and grass job minimum', async () => {
  const data = fixture(); data.property.matchedAddress = '<img src=x onerror=alert(1)>'; data.property.warnings = ['<script>bad()</script>'];
  const e = setup(async () => ({ ok: true, json: async () => data }));
  e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush();
  assert.equal(e.get('yard-price-review').hidden, false); assert.equal(e.get('yard-price-result').hidden, true);
  assert.match(e.get('yard-surfaces').textContent, /typical for the area/); assert.match(e.get('yard-source').textContent, /typical lot for the area/);
  assert.equal(e.get('yard-price-review').querySelectorAll('img,script').length, 0);
  e.confirm(); assert.equal(e.get('yard-price-result').hidden, false); assert.equal(e.get('yard-price-range').textContent, '$50');
  assert.match(e.get('yard-price-context').textContent, /\$50 minimum/); assert.equal(e.d.activeElement.id, 'yard-price-result');
  assert.equal(e.window.localStorage.length, 0); assert.equal(e.window.location.search, '');
});
test('quote handoff preserves existing notes, emits input events, and avoids duplicates', async () => {
  const e = setup(); e.input('yard-address', '123 Main St, Niles MI'); e.change('yard-service', 'leaves');
  e.input('yard-lot', '9000'); e.get('f-notes').value = 'Please close the gate.';
  let changes = 0; e.get('f-notes').addEventListener('input', () => changes++);
  e.submit(); await e.flush(); e.confirm(); e.get('yard-quote-handoff').click(); e.get('yard-quote-handoff').click();
  assert.equal(e.get('f-address').value, '123 MAIN ST, NILES MI'); assert.equal(e.get('f-service').value, 'Fall leaf cleanup');
  assert.match(e.get('f-notes').value, /^Please close the gate\./); assert.equal((e.get('f-notes').value.match(/\[Yard quote:/g) || []).length, 1);
  assert.equal(changes, 2); assert.ok(e.get('f-notes').value.length <= 500);
  assert.deepEqual(JSON.parse(e.calls[0][1].body), { address: '123 Main St, Niles MI', properties: 1, cover: 'moderate', amount: 'moderate', lotSqft: 9000 });
  assert.equal(e.calls[0][0], '/api/estimate'); assert.equal(e.calls[0][1].method, 'POST');
});
test('full notes are preserved and customer is told the summary did not fit', async () => {
  const e = setup(); e.get('f-notes').value = 'x'.repeat(500); e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush(); e.confirm(); e.get('yard-quote-handoff').click();
  assert.equal(e.get('f-notes').value, 'x'.repeat(500)); assert.match(e.get('yard-handoff-status').textContent, /shorten/);
});
test('loading prevents duplicate requests and changed inputs discard stale replies', async () => {
  let resolve; const e = setup(() => new Promise(r => { resolve = r; }));
  e.input('yard-address', '123 Main St, Niles MI'); e.submit(); e.submit(); assert.equal(e.calls.length, 1); assert.equal(e.get('yard-price-submit').disabled, true);
  assert.equal(e.get('yard-price-submit').getAttribute('aria-busy'), 'true');
  assert.ok(e.get('yard-price-submit').querySelector('svg.spinner'));
  e.input('yard-address', '456 Other St, Niles MI'); resolve({ ok: true, json: async () => fixture() }); await e.flush();
  assert.equal(e.get('yard-price-review').hidden, true); assert.equal(e.get('yard-price-submit').disabled, false);
  assert.equal(e.get('yard-price-submit').hasAttribute('aria-busy'), false);
  assert.equal(e.get('yard-price-submit').querySelector('svg.spinner'), null);
});
test('service change clears a confirmed result and reveals leaf inputs', async () => {
  const e = setup(); e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush(); e.confirm();
  e.change('yard-service', 'leaves'); assert.equal(e.get('yard-price-result').hidden, true); assert.equal(e.get('yard-confirm').checked, false); assert.equal(e.get('yard-leaves-options').hidden, false);
});
test('failed lookup offers retry and manual areas without destroying input', async () => {
  let fail = true; const e = setup(async () => fail ? { ok: false, status: 503, json: async () => ({ ok: false }) } : { ok: true, json: async () => fixture() });
  e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush(); assert.equal(e.get('yard-price-submit').disabled, false); assert.match(e.get('yard-price-error').textContent, /known lot size/);
  assert.equal(e.get('yard-area-details').open, true); fail = false; e.input('yard-lot', '7840'); e.submit(); await e.flush(); assert.equal(e.get('yard-price-review').hidden, false);
});
test('rate limit and invalid server response never reveal prices', async () => {
  const e = setup(async () => ({ ok: false, status: 429, json: async () => ({ error: 'rate_limited' }) }));
  e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush(); assert.match(e.get('yard-price-error').textContent, /wait a minute/); assert.equal(e.get('yard-price-result').hidden, true);
});
test('handoff reopens an already completed quote form before prefilling it', async () => {
  const e = setup(); const done = e.d.querySelector('#estimate-form .form-done'); done.classList.add('show');
  let reset = false; e.get('form-reset-btn').addEventListener('click', () => { reset = true; e.get('estimate-form').reset(); done.classList.remove('show'); });
  e.input('yard-address', '123 Main St, Niles MI'); e.change('yard-service', 'leaves'); e.submit(); await e.flush(); e.confirm(); e.get('yard-quote-handoff').click();
  assert.equal(reset, true); assert.equal(e.get('f-service').value, 'Fall leaf cleanup'); assert.match(e.get('f-notes').value, /assumed lot; moderate cover\/moderate leaves/);
});
test('technical warning codes have plain language explanations', async () => {
  const data = fixture(); data.property.warnings = ['parcel-not-configured', 'address-not-matched'];
  const e = setup(async () => ({ ok: true, json: async () => data })); e.input('yard-address', '123 Main St, Niles MI'); e.submit(); await e.flush();
  assert.match(e.get('yard-warnings').textContent, /typical lot for the area/); assert.doesNotMatch(e.get('yard-warnings').textContent, /parcel-not-configured|address-not-matched/);
});

test('infographic gates the tool until it is touched', async () => {
  const e = setup();
  assert.equal(e.get('yard-intro').hidden, false);
  assert.equal(e.get('yard-price-form').hidden, true);
  assert.equal(e.get('yard-price-result').hidden, true);
  e.get('yard-start').click();
  assert.equal(e.get('yard-intro').hidden, true);
  assert.equal(e.get('yard-price-form').hidden, false);
  assert.equal(e.get('yard-price-result').hidden, true);
});
