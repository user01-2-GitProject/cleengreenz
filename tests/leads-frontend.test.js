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
  });

  await t.test('sanitizes CRLF linebreaks in name, phone, address, and service for mailto link', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });

    const { window, document, getAssignedHref } = setupEnvironment({
      fetch: () => fetchPromise,
    });

    const form = document.getElementById('estimate-form');
    const button = form.querySelector('button[type="submit"]');
    const originalButtonHtml = button.innerHTML;

    const nameInput = form.querySelector('#f-name');
    const phoneInput = form.querySelector('#f-phone');
    const addressInput = form.querySelector('#f-address');
    const serviceSelect = form.querySelector('#f-service');

    nameInput.value = 'Jane';
    phoneInput.value = '269-555-0199';
    addressInput.value = '123 Main St';
    serviceSelect.value = 'Fall leaf cleanup';

    // Mock Object.fromEntries inside the test so d receives CRLF linebreaks
    const originalFromEntries = Object.fromEntries;
    Object.fromEntries = (fd) => ({
      name: 'Jane\r\nDoe',
      phone: '269-555-0199\nExtra',
      address: '123 Main St\rSuite 4',
      service: 'Fall leaf\r\ncleanup',
    });

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    Object.fromEntries = originalFromEntries;

    resolveFetch({ ok: false, status: 500 });
    await new Promise((r) => setTimeout(r, 20));

    const mailto = getAssignedHref();
    assert.match(mailto, /^mailto:chris@cleengreenz\.com\?/);
    assert.match(mailto, /subject=Estimate%20request%3A%20Fall%20leaf%20cleanup%20\(Jane%20Doe\)/);
    assert.match(mailto, /Name%3A%20Jane%20Doe/);
    assert.match(mailto, /Phone%3A%20269-555-0199%20Extra/);
    assert.match(mailto, /Address%3A%20123%20Main%20St%20Suite%204/);
    assert.match(mailto, /Service%3A%20Fall%20leaf%20cleanup/);

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

    // Trigger validation first so reset verifies stale error state is cleared.
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
    assert.equal(notesCount.textContent, '· 500 characters remaining');
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
    const nameErr = document.querySelector('#f-name-err');
    assert.equal(nameErr.classList.contains('show'), true);
    assert.equal(nameErr.getAttribute('role'), 'alert', 'error element must have role="alert" for assistive tech');

    assert.equal(phoneInput.getAttribute('aria-invalid'), 'true');
    assert.equal(phoneInput.getAttribute('aria-describedby'), 'f-phone-err');
    const phoneErr = document.querySelector('#f-phone-err');
    assert.equal(phoneErr.classList.contains('show'), true);
    assert.equal(phoneErr.getAttribute('role'), 'alert', 'error element must have role="alert" for assistive tech');

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

  await t.test('formats phone number on input event into (XXX) XXX-XXXX structure', async () => {
    const { window, document } = setupEnvironment();
    const phoneInput = document.getElementById('f-phone');

    phoneInput.value = '269';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.value, '(269');

    phoneInput.value = '269362';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.value, '(269) 362');

    phoneInput.value = '2693628286';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.value, '(269) 362-8286');

    // Handles 11-digit numbers with leading country code 1 or +1
    phoneInput.value = '12693628286';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.value, '(269) 362-8286');

    phoneInput.value = '+1 (269) 362-8286';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.value, '(269) 362-8286');
  });

  await t.test('rejects phone number with fewer than 7 digits on submit and marks field as invalid', async () => {
    let fetchCalled = false;
    const { window, document } = setupEnvironment({
      fetch: () => {
        fetchCalled = true;
        return Promise.resolve({ ok: true });
      },
    });

    const form = document.getElementById('estimate-form');
    form.querySelector('#f-name').value = 'Jane Doe';
    form.querySelector('#f-phone').value = '123'; // Incomplete phone
    form.querySelector('#f-address').value = '123 Main St';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));

    assert.equal(fetchCalled, false, 'fetch should not be called with an invalid phone number');
    const phoneInput = form.querySelector('#f-phone');
    assert.equal(phoneInput.getAttribute('aria-invalid'), 'true');
    const phoneErr = document.querySelector('#f-phone-err');
    assert.equal(phoneErr.classList.contains('show'), true);
    assert.equal(phoneErr.textContent, 'Please enter a valid phone number with area code');
  });

  await t.test('performs inline validation on focusout when field has value or was previously invalid', async () => {
    const { window, document } = setupEnvironment();
    const form = document.getElementById('estimate-form');
    const phoneInput = form.querySelector('#f-phone');
    const nameInput = form.querySelector('#f-name');
    const phoneErr = document.querySelector('#f-phone-err');

    // Blurring an untouched empty required field should not trigger error immediately before submission
    nameInput.dispatchEvent(new window.Event('focusout', { bubbles: true }));
    assert.equal(nameInput.hasAttribute('aria-invalid'), false);

    // Typing incomplete phone and blurring triggers inline validation error
    phoneInput.value = '123';
    phoneInput.dispatchEvent(new window.Event('focusout', { bubbles: true }));
    assert.equal(phoneInput.getAttribute('aria-invalid'), 'true');
    assert.equal(phoneErr.classList.contains('show'), true);
    assert.equal(phoneErr.textContent, 'Please enter a valid phone number with area code');

    // Correcting the phone number updates the field to valid on input
    phoneInput.value = '2693628286';
    phoneInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(phoneInput.hasAttribute('aria-invalid'), false);
    assert.equal(phoneErr.classList.contains('show'), false);
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
    assert.equal(notesCount.textContent, '· 500 characters remaining');

    notesInput.value = 'Hello world!';
    notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(notesCount.textContent, '· 488 characters remaining');
    assert.equal(notesCount.classList.contains('near-limit'), false, 'should not have near-limit class when > 20 characters remain');

    // Type until 20 characters remain (500 - 480 = 20)
    notesInput.value = 'a'.repeat(480);
    notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(notesCount.textContent, '· 20 characters remaining');
    assert.equal(notesCount.classList.contains('near-limit'), true, 'should toggle near-limit class when <= 20 characters remain');

    // Delete characters so 21 remain
    notesInput.value = 'a'.repeat(479);
    notesInput.dispatchEvent(new window.Event('input', { bubbles: true }));

    assert.equal(notesCount.textContent, '· 21 characters remaining');
    assert.equal(notesCount.classList.contains('near-limit'), false, 'should remove near-limit class when > 20 characters remain');
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

  await t.test('tracks clicks on free estimate links, pre-selects service option if data-service set, and shifts focus to first input field', async () => {
    const tracked = [];
    const { window, document } = setupEnvironment({
      trackLead: (type, location) => {
        tracked.push({ type, location });
      },
    });

    const link = document.createElement('a');
    link.href = '#estimate';
    link.dataset.leadLocation = 'hero';
    link.dataset.service = 'Fall leaf cleanup';
    document.body.appendChild(link);

    const serviceSelect = document.getElementById('f-service');
    // Change initial value to something else to verify pre-selection change
    serviceSelect.value = 'Snow removal';

    link.click();

    assert.equal(tracked.length, 1);
    assert.deepEqual(tracked[0], { type: 'estimate_click', location: 'hero' });
    assert.equal(serviceSelect.value, 'Fall leaf cleanup');

    await new Promise((r) => setTimeout(r, 60));
    const nameInput = document.getElementById('f-name');
    assert.equal(document.activeElement, nameInput);
  });

  await t.test('resets estimate form and reveals form fields when an estimate link is clicked while form is in submitted state', async () => {
    const { window, document } = setupEnvironment({
      fetch: () => Promise.resolve({ ok: true, status: 200 }),
    });

    const form = document.getElementById('estimate-form');
    const fieldsBox = form.querySelector('.form-fields');
    const doneBox = form.querySelector('.form-done');
    const serviceSelect = form.querySelector('#f-service');

    form.querySelector('#f-name').value = 'Jane Doe';
    form.querySelector('#f-phone').value = '269-555-0199';
    form.querySelector('#f-address').value = '123 Main St';

    form.dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(fieldsBox.style.display, 'none');
    assert.equal(doneBox.classList.contains('show'), true);

    const serviceCard = document.createElement('a');
    serviceCard.href = '#estimate';
    serviceCard.dataset.service = 'Snow removal';
    document.body.appendChild(serviceCard);

    serviceCard.click();

    assert.equal(fieldsBox.style.display, '');
    assert.equal(doneBox.classList.contains('show'), false);
    assert.equal(serviceSelect.value, 'Snow removal');

    await new Promise((r) => setTimeout(r, 60));
    const nameInput = document.getElementById('f-name');
    assert.equal(document.activeElement, nameInput);
  });

  await t.test('pre-selects matching service option when clicking estimate link with data-service', async () => {
    const { window, document } = setupEnvironment();

    const serviceSelect = document.getElementById('f-service');
    serviceSelect.value = 'Weekly mowing and edging';

    const seasonCta = document.querySelector('a[href="#estimate"][data-service]');
    assert.ok(seasonCta, 'seasonal estimate link with data-service should exist');
    assert.equal(seasonCta.getAttribute('data-service'), 'Fall leaf cleanup');

    seasonCta.click();

    assert.equal(serviceSelect.value, 'Fall leaf cleanup');

    await new Promise((r) => setTimeout(r, 60));
    const nameInput = document.getElementById('f-name');
    assert.equal(document.activeElement, nameInput);
  });

  await t.test('mobile contact bar link contains phone icon and accessible aria-label', () => {
    const { document } = setupEnvironment();

    const mobileCallBtn = document.querySelector('.mobile-bar a[data-lead="call"]');
    assert.ok(mobileCallBtn, 'mobile bar call link exists');
    assert.equal(mobileCallBtn.getAttribute('aria-label'), 'Call Chris at (269) 362-8286');
    assert.ok(mobileCallBtn.querySelector('svg'), 'mobile bar call link includes phone icon svg');
  });

  await t.test('copy phone button copies phone number to clipboard and displays feedback', async () => {
    let copiedText = '';
    const { window, document } = setupEnvironment();

    // Mock navigator.clipboard
    window.navigator.clipboard = {
      writeText: async (text) => {
        copiedText = text;
      },
    };

    const copyBtn = document.querySelector('.copy-phone-btn');
    const feedback = document.querySelector('.copy-feedback');

    assert.ok(copyBtn, 'copy phone button exists');
    assert.ok(feedback, 'copy feedback element exists');
    assert.equal(copyBtn.getAttribute('aria-label'), 'Copy phone number (269) 362-8286');
    assert.equal(feedback.getAttribute('aria-atomic'), 'true', 'copy feedback live region has aria-atomic="true"');

    copyBtn.click();

    await new Promise((r) => setTimeout(r, 20));

    assert.equal(copiedText, '(269) 362-8286');
    assert.equal(feedback.textContent, 'Copied!');
    assert.equal(copyBtn.classList.contains('copied'), true, 'copy button toggles .copied class');
    assert.equal(copyBtn.getAttribute('aria-label'), 'Phone number copied', 'copy button updates aria-label');
    await new Promise((r) => setTimeout(r, 2050));
    assert.equal(feedback.textContent, '');
    assert.equal(copyBtn.classList.contains('copied'), false);
    assert.equal(copyBtn.getAttribute('aria-label'), 'Copy phone number (269) 362-8286');
  });

  await t.test('copy phone feedback recovers when a later clipboard write fails', async () => {
    const { window, document } = setupEnvironment();
    let fail = false;
    window.navigator.clipboard = { writeText: async () => { if (fail) throw new Error('denied'); } };
    const copyBtn = document.querySelector('.copy-phone-btn');
    const feedback = document.querySelector('.copy-feedback');
    copyBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(copyBtn.classList.contains('copied'), true);
    fail = true;
    copyBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(feedback.textContent, 'Failed to copy');
    assert.equal(copyBtn.classList.contains('copied'), false);
    assert.equal(copyBtn.getAttribute('aria-label'), 'Copy phone number (269) 362-8286');
    await new Promise((r) => setTimeout(r, 2050));
    assert.equal(feedback.textContent, '');
  });

  await t.test('copy phone button displays error feedback when clipboard write rejects', async () => {
    const { window, document } = setupEnvironment();

    window.navigator.clipboard = {
      writeText: async () => {
        throw new Error('Clipboard access denied');
      },
    };

    const copyBtn = document.querySelector('.copy-phone-btn');
    const feedback = document.querySelector('.copy-feedback');

    copyBtn.click();

    await new Promise((r) => setTimeout(r, 20));

    assert.equal(feedback.textContent, 'Failed to copy');
  });
});

test('seasonal ribbon CTA has data-lead-location="ribbon"', () => {
  const { document } = setupEnvironment();
  const ribbonLink = document.querySelector('.ribbon a[href="#estimate"]');
  assert.ok(ribbonLink, 'seasonal ribbon CTA link exists');
  assert.equal(ribbonLink.dataset.leadLocation, 'ribbon');
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
