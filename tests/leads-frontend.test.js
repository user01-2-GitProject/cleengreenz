import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const leadsJsSource = fs.readFileSync(path.resolve(process.cwd(), 'js/leads.js'), 'utf8');

function setupEnvironment(options = {}) {
  const dom = new JSDOM(htmlTemplate, { url: 'https://cleengreenz.com/estimate' });
  const { window } = dom;

  let assignedHref = '';
  const mockLocation = {
    pathname: '/estimate',
    get href() {
      return 'https://cleengreenz.com/estimate';
    },
    set href(val) {
      assignedHref = val;
    },
  };

  const trackedLeads = [];
  const trackLeadFn = options.trackLead !== undefined ? options.trackLead : function (type, location, extra) {
    trackedLeads.push({ type, location, extra });
  };

  const mockWindow = new Proxy(window, {
    get(target, prop) {
      if (prop === 'location') return mockLocation;
      if (prop === 'trackLead') return trackLeadFn;
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  if (!window.CSS) {
    window.CSS = { escape: (s) => s.replace(/([^\w-])/g, '\\$1') };
  }

  let beaconSent = null;
  const mockNavigator = new Proxy(window.navigator, {
    get(target, prop) {
      if (prop === 'sendBeacon') {
        if (options.hasSendBeacon === false) return undefined;
        return (url, blob) => {
          beaconSent = { url, blob };
          return true;
        };
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });

  let fetchCalls = [];
  const fetchFn = options.fetch || (async (url, opts) => {
    fetchCalls.push({ url, opts });
    return { ok: true, status: 200 };
  });

  // Execute js/leads.js within the JSDOM window scope
  const runFn = new Function('window', 'document', 'location', 'navigator', 'CSS', 'FormData', 'fetch', leadsJsSource);
  runFn(
    mockWindow,
    window.document,
    mockLocation,
    mockNavigator,
    window.CSS,
    window.FormData,
    fetchFn
  );

  return {
    window,
    document: window.document,
    getAssignedHref: () => assignedHref,
    getBeaconSent: () => beaconSent,
    getFetchCalls: () => fetchCalls,
    getTrackedLeads: () => trackedLeads,
  };
}

test('Estimate form submission - Error handling & Mailto fallback', async (t) => {
  await t.test('triggers openEmail mailto fallback and updates UI when /api/lead returns non-ok status (500)', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });

    const { window, document, getAssignedHref } = setupEnvironment({
      fetch: () => fetchPromise,
    });

    const form = document.getElementById('estimate-form');
    const button = form.querySelector('button[type="submit"]');

    form.querySelector('#f-name').value = 'Jane Doe';
    form.querySelector('#f-phone').value = '269-555-0199';
    form.querySelector('#f-address').value = '123 Main St';
    form.querySelector('#f-service').value = 'Fall leaf cleanup';
    form.querySelector('#f-notes').value = 'Call before coming';

    const originalButtonHtml = button.innerHTML;

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    // While sending, button should be disabled and aria-busy set
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.match(button.innerHTML, /Sending\.\.\./);

    // Resolve fetch with 500 status error
    resolveFetch({ ok: false, status: 500 });

    // Wait for promise chain (.then, .catch, .then)
    await new Promise((r) => setTimeout(r, 20));

    // Form done state checks
    const fieldsBox = form.querySelector('.form-fields');
    const doneBox = form.querySelector('.form-done');
    const doneHeading = doneBox.querySelector('h3');
    const doneParagraph = doneBox.querySelector('p');

    assert.equal(fieldsBox.style.display, 'none');
    assert.equal(doneBox.classList.contains('show'), true);
    assert.equal(doneHeading.textContent, 'Almost there!');
    assert.equal(
      doneParagraph.textContent,
      'Your email app should have opened with your request. Just hit send and Chris will be in touch.'
    );

    // Mailto location checks
    const mailto = getAssignedHref();
    assert.match(mailto, /^mailto:chris@cleengreenz\.com\?/);
    assert.match(mailto, /subject=Estimate%20request%3A%20Fall%20leaf%20cleanup%20\(Jane%20Doe\)/);
    assert.match(mailto, /Name%3A%20Jane%20Doe/);
    assert.match(mailto, /Phone%3A%20269-555-0199/);
    assert.match(mailto, /Address%3A%20123%20Main%20St/);
    assert.match(mailto, /Service%3A%20Fall%20leaf%20cleanup/);
    assert.match(mailto, /Notes%3A%20Call%20before%20coming/);

    // Button state restored
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(button.innerHTML, originalButtonHtml);
  });

  await t.test('triggers openEmail mailto fallback when fetch encounters a network rejection', async () => {
    let rejectFetch;
    const fetchPromise = new Promise((_, reject) => { rejectFetch = reject; });

    const { window, document, getAssignedHref } = setupEnvironment({
      fetch: () => fetchPromise,
    });

    const form = document.getElementById('estimate-form');
    const button = form.querySelector('button[type="submit"]');

    form.querySelector('#f-name').value = 'John Smith';
    form.querySelector('#f-phone').value = '555-0000';
    form.querySelector('#f-address').value = '789 Pine Ave';
    form.querySelector('#f-service').value = 'Snow removal';
    form.querySelector('#f-notes').value = '';

    const originalButtonHtml = button.innerHTML;

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    // Reject fetch with network error
    rejectFetch(new TypeError('Network failure'));

    await new Promise((r) => setTimeout(r, 20));

    const doneBox = form.querySelector('.form-done');
    assert.equal(doneBox.classList.contains('show'), true);
    assert.equal(doneBox.querySelector('h3').textContent, 'Almost there!');

    // Mailto location checks without notes
    const mailto = getAssignedHref();
    assert.match(mailto, /^mailto:chris@cleengreenz\.com\?/);
    assert.match(mailto, /subject=Estimate%20request%3A%20Snow%20removal%20\(John%20Smith\)/);
    assert.doesNotMatch(mailto, /Notes%3A/);

    // Button state restored
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(button.innerHTML, originalButtonHtml);
  });

  await t.test('handles form submission success path (res.ok == true) without mailto fallback', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });

    const { window, document, getAssignedHref } = setupEnvironment({
      fetch: () => fetchPromise,
    });

    const form = document.getElementById('estimate-form');
    const button = form.querySelector('button[type="submit"]');

    form.querySelector('#f-name').value = 'Bob Dylan';
    form.querySelector('#f-phone').value = '269-123-4567';
    form.querySelector('#f-address').value = '100 Rock Rd';
    form.querySelector('#f-service').value = 'Weekly mowing and edging';

    const originalButtonHtml = button.innerHTML;

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    resolveFetch({ ok: true, status: 200 });

    await new Promise((r) => setTimeout(r, 20));

    const fieldsBox = form.querySelector('.form-fields');
    const doneBox = form.querySelector('.form-done');

    assert.equal(fieldsBox.style.display, 'none');
    assert.equal(doneBox.classList.contains('show'), true);
    assert.equal(doneBox.querySelector('h3').textContent, 'Thanks, got it!');
    assert.equal(getAssignedHref(), ''); // No mailto navigation

    // Button state restored
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(button.innerHTML, originalButtonHtml);
  });

  await t.test('calls window.trackLead on form submit when trackLead function exists', async () => {
    const tracked = [];
    const { window, document } = setupEnvironment({
      trackLead: (type, location, extra) => {
        tracked.push({ type, location, extra });
      },
      fetch: () => Promise.resolve({ ok: true, status: 200 }),
    });

    const form = document.getElementById('estimate-form');
    form.querySelector('#f-name').value = 'Carol Danvers';
    form.querySelector('#f-phone').value = '555-3210';
    form.querySelector('#f-address').value = '200 Hero Way';
    form.querySelector('#f-service').value = 'Seeding and fertilizing';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    await new Promise((r) => setTimeout(r, 20));

    assert.equal(tracked.length, 1);
    assert.deepEqual(tracked[0], {
      type: 'form',
      location: 'estimate',
      extra: { service: 'Seeding and fertilizing' },
    });
  });

  await t.test('resets form, restores form fields visibility, and focuses first input when Send another request button is clicked', async () => {
    const { window, document } = setupEnvironment({
      fetch: () => Promise.resolve({ ok: true, status: 200 }),
    });

    const form = document.getElementById('estimate-form');
    const nameInput = form.querySelector('#f-name');
    const phoneInput = form.querySelector('#f-phone');
    const addressInput = form.querySelector('#f-address');
    const notesInput = form.querySelector('#f-notes');
    const notesCount = form.querySelector('#f-notes-count');
    const fieldsBox = form.querySelector('.form-fields');
    const doneBox = form.querySelector('.form-done');
    const resetBtn = doneBox.querySelector('#form-reset-btn');

    // Trigger validation error on invalid field prior to submission
    nameInput.value = '';
    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    assert.equal(nameInput.getAttribute('aria-invalid'), 'true');
    assert.equal(document.querySelector('#f-name-err').classList.contains('show'), true);

    nameInput.value = 'Alice Smith';
    phoneInput.value = '269-555-9999';
    addressInput.value = '456 Elm St';
    notesInput.value = 'Testing reset';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(fieldsBox.style.display, 'none');
    assert.equal(doneBox.classList.contains('show'), true);

    // Click "Send another request" button
    resetBtn.click();

    assert.equal(fieldsBox.style.display, '');
    assert.equal(doneBox.classList.contains('show'), false);
    assert.equal(nameInput.value, '');
    assert.equal(phoneInput.value, '');
    assert.equal(addressInput.value, '');
    assert.equal(notesInput.value, '');
    assert.equal(notesCount.textContent, '· 500 chars left');
    assert.equal(nameInput.hasAttribute('aria-invalid'), false);
    assert.equal(document.querySelector('#f-name-err').classList.contains('show'), false);
    assert.equal(document.activeElement, nameInput);
  });
});

test('Estimate form field validation & user input handling', async (t) => {
  await t.test('prevents submission and highlights error fields when required fields are empty', async () => {
    let fetchCalled = false;
    const { window, document } = setupEnvironment({
      fetch: () => {
        fetchCalled = true;
        return Promise.resolve({ ok: true });
      },
    });

    const form = document.getElementById('estimate-form');
    const nameInput = form.querySelector('#f-name');
    const phoneInput = form.querySelector('#f-phone');
    const addressInput = form.querySelector('#f-address');

    nameInput.value = '   '; // Whitespace only
    phoneInput.value = '';
    addressInput.value = '123 Test St';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    assert.equal(fetchCalled, false, 'fetch should not be called when form is invalid');

    assert.equal(nameInput.getAttribute('aria-invalid'), 'true');
    assert.equal(nameInput.getAttribute('aria-describedby'), 'f-name-err');
    assert.equal(document.querySelector('#f-name-err').classList.contains('show'), true);

    assert.equal(phoneInput.getAttribute('aria-invalid'), 'true');
    assert.equal(phoneInput.getAttribute('aria-describedby'), 'f-phone-err');
    assert.equal(document.querySelector('#f-phone-err').classList.contains('show'), true);

    // Address input was valid
    assert.equal(addressInput.hasAttribute('aria-invalid'), false);
  });

  await t.test('clears field validation errors on input event', async () => {
    const { window, document } = setupEnvironment();

    const form = document.getElementById('estimate-form');
    const nameInput = form.querySelector('#f-name');
    nameInput.value = '';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    assert.equal(nameInput.getAttribute('aria-invalid'), 'true');
    assert.equal(document.querySelector('#f-name-err').classList.contains('show'), true);

    // User types into input
    nameInput.value = 'Jane';
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(nameInput.hasAttribute('aria-invalid'), false);
    assert.equal(nameInput.hasAttribute('aria-describedby'), false);
    assert.equal(document.querySelector('#f-name-err').classList.contains('show'), false);
  });
});

test('Form initialization, honeypot field, and lead tracking events', async (t) => {
  await t.test('initializes and updates notes character counter live on input', async () => {
    const { window, document } = setupEnvironment();
    const notesInput = document.getElementById('f-notes');
    const notesCount = document.getElementById('f-notes-count');

    assert.ok(notesInput, 'notes input should exist');
    assert.ok(notesCount, 'notes count element should exist');
    assert.equal(notesInput.getAttribute('maxlength'), '500');
    assert.equal(notesCount.textContent, '· 500 chars left');

    notesInput.value = 'Hello world!';
    notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(notesCount.textContent, '· 488 chars left');
  });

  await t.test('appends a hidden honeypot website field to the form on script load', async () => {
    const { document } = setupEnvironment();
    const form = document.getElementById('estimate-form');
    const trapInput = form.querySelector('input[name="website"]');

    assert.ok(trapInput, 'honeypot input should exist');
    assert.equal(trapInput.type, 'text');
    assert.equal(trapInput.tabIndex, -1);
    assert.equal(trapInput.getAttribute('aria-hidden'), 'true');
  });

  await t.test('handles cg:lead custom event and sends lead beacon or fetch', async () => {
    const fetchCalls = [];
    const { window, document, getBeaconSent } = setupEnvironment({
      hasSendBeacon: true,
      fetch: (url, opts) => {
        fetchCalls.push({ url, opts });
        return Promise.resolve({ ok: true });
      },
    });

    // Fire cg:lead event
    document.dispatchEvent(
      new window.CustomEvent('cg:lead', {
        detail: { lead_type: 'call', lead_location: 'header' },
      })
    );

    const beacon = getBeaconSent();
    assert.ok(beacon, 'sendBeacon should be called');
    assert.equal(beacon.url, '/api/lead');

    // Ignore cg:lead event with lead_type 'form'
    document.dispatchEvent(
      new window.CustomEvent('cg:lead', {
        detail: { lead_type: 'form', lead_location: 'estimate' },
      })
    );
  });

  await t.test('tracks clicks on free estimate links and shifts focus to first input field', async () => {
    const tracked = [];
    const { window, document } = setupEnvironment({
      trackLead: (type, location) => {
        tracked.push({ type, location });
      },
    });

    const link = document.createElement('a');
    link.href = '#estimate';
    link.dataset.leadLocation = 'hero';
    document.body.appendChild(link);

    link.click();

    assert.equal(tracked.length, 1);
    assert.deepEqual(tracked[0], { type: 'estimate_click', location: 'hero' });

    await new Promise((r) => setTimeout(r, 60));
    const nameInput = document.getElementById('f-name');
    assert.equal(document.activeElement, nameInput);
  });
});

test('Accessibility attributes & focus management enhancements', async (t) => {
  await t.test('main element has tabindex="-1" for skip link focus targeting', () => {
    const { document } = setupEnvironment();
    const mainEl = document.getElementById('main');
    assert.ok(mainEl, '<main id="main"> should exist');
    assert.equal(mainEl.getAttribute('tabindex'), '-1');
  });

  await t.test('notes textarea has aria-describedby pointing to notes character count element', () => {
    const { document } = setupEnvironment();
    const notesInput = document.getElementById('f-notes');
    assert.ok(notesInput, '#f-notes textarea should exist');
    assert.equal(notesInput.getAttribute('aria-describedby'), 'f-notes-count');
    notesInput.value = 'abcd';
    notesInput.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
    assert.equal(notesInput.getAttribute('aria-describedby'), 'f-notes-count',
      'typing must retain the permanent character count description');
  });

  await t.test('Pet Chris hide button shifts focus to brand link before removing container', () => {
    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      url: 'https://cleengreenz.com',
      beforeParse(window) {
        window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
        window.HTMLMediaElement.prototype.pause = () => {};
      },
    });
    const { document } = dom.window;

    const wrap = document.querySelector('.pet-wrap');
    assert.ok(wrap, 'Pet Chris wrap should exist in DOM on load');

    const bubble = wrap.querySelector('.pet-bubble');
    assert.ok(bubble, 'Pet Chris bubble should exist');

    bubble.innerHTML = '<button type="button" data-pet-hide>Hide me</button>';
    const hideBtn = bubble.querySelector('[data-pet-hide]');

    hideBtn.click();

    const brandLink = document.querySelector('.brand');
    assert.equal(document.activeElement, brandLink, 'focus should shift to .brand on hide');
    assert.equal(document.querySelector('.pet-wrap'), null, 'pet wrap should be removed from DOM');
  });
});
