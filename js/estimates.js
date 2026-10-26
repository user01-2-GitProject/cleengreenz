(function () {
  'use strict';
  var form = document.getElementById('yard-price-form');
  if (!form) return;
  var byId = function (id) { return document.getElementById(id); };
  var address = byId('yard-address'), service = byId('yard-service');
  var submit = byId('yard-price-submit'), error = byId('yard-price-error');
  var status = byId('yard-price-status'), review = byId('yard-price-review');
  var confirmation = byId('yard-confirm'), result = byId('yard-price-result');
  var version = 0, controller, pending = false, candidate = null, previousSummary = '';
  var serviceNames = { grass: 'Grass cutting', leaves: 'Leaf cleanup', snow: 'Snow clearing' };
  var leadServices = { grass: 'Weekly mowing and edging', leaves: 'Fall leaf cleanup', snow: 'Snow removal' };
  var number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var money = function (value) { return '$' + number.format(value); };
  function loading(value) {
    pending = value;
    submit.disabled = value;
    submit.textContent = value ? 'Checking your property…' : 'Find my rough estimate';
    form.setAttribute('aria-busy', String(value));
  }
  function clear() {
    version++;
    if (controller) controller.abort();
    loading(false);
    candidate = null;
    confirmation.checked = false;
    review.hidden = result.hidden = true;
    error.hidden = true;
    status.textContent = '';
    [address, byId('yard-lot'), byId('yard-lawn'), byId('yard-driveway')].forEach(function (input) {
      if (!input) return;
      input.removeAttribute('aria-invalid');
      var describedBy = input.getAttribute('aria-describedby') || '';
      var ids = describedBy.split(/\s+/).filter(function (id) { return id && id !== 'yard-price-error'; });
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
      else input.removeAttribute('aria-describedby');
    });
    byId('yard-leaves-options').hidden = service.value !== 'leaves';
  }
  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
  function fail(message, field) {
    error.textContent = message;
    error.hidden = false;
    if (field) {
      field.setAttribute('aria-invalid', 'true');
      var describedBy = field.getAttribute('aria-describedby') || '';
      var ids = describedBy.split(/\s+/).filter(Boolean);
      if (ids.indexOf('yard-price-error') === -1) {
        ids.push('yard-price-error');
        field.setAttribute('aria-describedby', ids.join(' '));
      }
      field.focus();
    }
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending) return;
    clear();
    var payload = { address: address.value.trim(), properties: 1, cover: byId('yard-cover').value, amount: byId('yard-amount').value };
    if (!payload.address) { fail('Enter the property address, including city and state.', address); return; }
    if (payload.address.length > 200) { fail('Please shorten the address to 200 characters.', address); return; }
    var fields = { lotSqft: 'yard-lot', lawnSqft: 'yard-lawn', drivewaySqft: 'yard-driveway' };
    for (var key of Object.keys(fields)) {
      var input = byId(fields[key]);
      input.removeAttribute('aria-invalid');
      if (input.value.trim() !== '') {
        var area = Number(input.value);
        if (!Number.isFinite(area) || area <= 0 || area > 10000000) {
          byId('yard-area-details').open = true;
          fail('Enter an area greater than zero and no more than 10,000,000 sq ft.', input); return;
        }
        payload[key] = area;
      }
    }
    var requestVersion = version;
    controller = new AbortController();
    loading(true); status.textContent = 'Finding the address and checking available lot information…';
    try {
      var response = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      var data = await response.json();
      if (requestVersion !== version) return;
      if (!response.ok || !data.ok) {
        if (response.status === 429 || data.error === 'rate_limited') throw new Error('Too many estimate requests. Please wait a minute, then try again.');
        throw new Error('We could not check this property. Try again with the full address or add your known lot size below. You can also request a quote directly.');
      }
      var property = data.property;
      var estimate = data.estimates && data.estimates[service.value];
      var range = estimate && (service.value === 'grass' ? estimate.job : estimate.perVisit);
      if (!property || !['lotSqft', 'lawnSqft', 'drivewaySqft'].every(function (k) { return Number.isFinite(property[k]) && property[k] > 0; }) || !range || !['low', 'mid', 'high'].every(function (k) { return Number.isFinite(range[k]) && range[k] >= 0; }) || range.high < range.low) throw new Error('The estimate was incomplete. Please try again or request a quote directly.');
      candidate = { property: property, service: service.value, range: range, payload: payload };
      byId('yard-matched-address').textContent = property.matchedAddress ? 'Matched address: ' + property.matchedAddress : 'Address you entered (not verified): ' + payload.address;
      var list = byId('yard-surfaces');
      list.replaceChildren();
      [['lot', 'lotSqft', 'Total lot'], ['lawn', 'lawnSqft', 'Mowable lawn'], ['driveway', 'drivewaySqft', 'Driveway + walk']].forEach(function (entry) {
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = entry[2];
        var basis = property.surfaceBasis && property.surfaceBasis[entry[0]];
        var supplied = Object.prototype.hasOwnProperty.call(payload, entry[1]);
        dd.textContent = number.format(property[entry[1]]) + ' sq ft — ' + (supplied ? 'provided by you' : basis === 'parcel' || (entry[0] === 'lot' && property.source === 'county-parcel') ? 'county parcel record' : 'assumed, not measured');
        list.append(dt, dd);
      });
      byId('yard-source').textContent = property.confidence === 'low' ? 'Low-confidence starting point. No measured lot size was available. Add your lot size above for a better starting point.' : 'Lot records do not measure the exact lawn or snow-clearing area. Check each area before continuing.';
      var warnings = byId('yard-warnings'); warnings.replaceChildren();
      var warningCopy = {
        'parcel-not-configured': 'County parcel records are not connected yet. The lot size is a typical local starting point.',
        'parcel-not-found': 'We could not identify one county parcel for this address. Check or enter your lot size.',
        'parcel-lookup-unavailable': 'County lot records could not be reached. Check or enter your lot size.',
        'lot-area-unknown': 'Your lot size is unknown, so a typical lot size is assumed.',
        'address-not-matched': 'The address could not be matched. Check its spelling, city, state, and ZIP before confirming.',
        'address-lookup-unavailable': 'Address lookup is temporarily unavailable. The address shown has not been verified.'
      };
      (Array.isArray(property.warnings) ? property.warnings : []).forEach(function (warning) { var li = document.createElement('li'); li.textContent = warningCopy[warning] || 'Some property details could not be verified. Check the address and areas carefully.'; warnings.append(li); });
      review.hidden = false;
      status.textContent = 'Check the address and areas below, then confirm them to see your price range.';
      review.focus();
    } catch (err) {
      if (requestVersion !== version || err.name === 'AbortError') return;
      status.textContent = '';
      byId('yard-area-details').open = true;
      var friendly = err && /^(Too many|We could not|The estimate was)/.test(err.message) ? err.message : 'We could not connect to the estimate service. Please retry, or enter your known lot size and try again. You can also request a quote directly.';
      fail(friendly);
    } finally {
      if (requestVersion === version) loading(false);
    }
  });
  confirmation.addEventListener('change', function () {
    if (!candidate || !confirmation.checked) { result.hidden = true; return; }
    var range = candidate.range;
    byId('yard-price-range').textContent = money(range.low) + '–' + money(range.high);
    byId('yard-price-context').textContent = serviceNames[candidate.service] + ' for one property, one visit.' + (candidate.service === 'grass' ? ' Includes the $50 minimum per stop.' : candidate.service === 'leaves' ? ' Based on ' + candidate.payload.cover + ' tree cover and a ' + candidate.payload.amount + ' amount of leaf work.' : ' Based on the driveway and walk area above.');
    result.hidden = false; result.focus();
  });
  byId('yard-quote-handoff').addEventListener('click', function () {
    if (!candidate || !confirmation.checked) return;
    var property = candidate.property;
    var done = document.querySelector('#estimate-form .form-done.show');
    if (done && byId('form-reset-btn')) byId('form-reset-btn').click();
    var leadAddress = byId('f-address'), leadService = byId('f-service'), notes = byId('f-notes');
    leadAddress.value = property.matchedAddress || candidate.payload.address;
    leadService.value = leadServices[candidate.service];
    var basis = property.source === 'provided' ? 'provided lot' : property.source === 'county-parcel' ? 'county lot' : 'assumed lot';
    var leavesDetail = candidate.service === 'leaves' ? '; ' + candidate.payload.cover + ' cover/' + candidate.payload.amount + ' leaves' : '';
    var summary = '[Yard estimate: ' + serviceNames[candidate.service] + ' ' + money(candidate.range.low) + '–' + money(candidate.range.high) + '/visit; lot ' + number.format(property.lotSqft) + ', lawn ' + number.format(property.lawnSqft) + ', drive/walk ' + number.format(property.drivewaySqft) + ' sq ft; ' + basis + leavesDetail + '; areas confirmed, rough quote.]';
    var existing = notes.value;
    if (previousSummary) existing = existing.replace(previousSummary, '').trimEnd();
    var combined = existing + (existing ? '\n' : '') + summary;
    if (combined.length <= 500) { notes.value = combined; previousSummary = summary; byId('yard-handoff-status').textContent = 'Address, service, and estimate added to your request below.'; }
    else { byId('yard-handoff-status').textContent = 'Address and service added. Your existing notes were preserved; shorten them if you want room for the estimate summary.'; }
    [leadAddress, leadService, notes].forEach(function (field) { field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); });
    var quote = byId('estimate');
    if (quote.scrollIntoView) quote.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    byId('f-name').focus({ preventScroll: true });
  });
})();
