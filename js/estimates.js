(function () {
  'use strict';
  var form = document.getElementById('yard-price-form');
  if (!form) return;
  var byId = function (id) { return document.getElementById(id); };
  var address = byId('yard-address'), service = byId('yard-service');
  var submit = byId('yard-price-submit'), error = byId('yard-price-error');
  var status = byId('yard-price-status'), review = byId('yard-price-review');
  var confirmation = byId('yard-confirm'), result = byId('yard-price-result');
  var yardLot = byId('yard-lot'), yardLawn = byId('yard-lawn'), yardDriveway = byId('yard-driveway');
  var leavesOptions = byId('yard-leaves-options');
  var yardInputs = [address, yardLot, yardLawn, yardDriveway];
  var version = 0, controller, pending = false, candidate = null, previousSummary = '';
  var serviceNames = { grass: 'Grass cutting', leaves: 'Leaf cleanup', snow: 'Snow clearing' };
  var leadServices = { grass: 'Weekly mowing and edging', leaves: 'Fall leaf cleanup', snow: 'Snow removal' };
  var number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  var money = function (value) { return '$' + number.format(value); };
  var priceRange = function (range) { return range.low === range.high ? money(range.low) : money(range.low) + '–' + money(range.high); };
  var spinnerSvg = '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> ';
  function loading(value) {
    pending = value;
    submit.disabled = value;
    if (value) {
      submit.setAttribute('aria-busy', 'true');
      submit.innerHTML = spinnerSvg + 'Checking your property…';
    } else {
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Get my estimate';
    }
    form.setAttribute('aria-busy', String(value));
  }
  function clear() {
    version++;
    if (controller) controller.abort();
    loading(false);
    candidate = null;
    confirmation.checked = false;
    confirmation.setAttribute('aria-expanded', 'false');
    review.hidden = result.hidden = true;
    error.hidden = true;
    status.textContent = '';
    byId('yard-handoff-status').textContent = '';
    // Performance optimization: Guard aria-invalid and aria-describedby cleanup with presence checks
    // to bypass redundant DOM queries, string splitting/joining, and attribute mutations on input events.
    for (var i = 0; i < yardInputs.length; i++) {
      var input = yardInputs[i];
      if (!input) continue;
      if (input.getAttribute('aria-invalid') === 'true') {
        input.removeAttribute('aria-invalid');
      }
      var describedBy = input.getAttribute('aria-describedby');
      if (describedBy && describedBy.indexOf('yard-price-error') !== -1) {
        var ids = describedBy.split(/\s+/).filter(function (id) { return id && id !== 'yard-price-error'; });
        if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
        else input.removeAttribute('aria-describedby');
      }
    }
    var shouldHideLeaves = service.value !== 'leaves';
    if (leavesOptions && leavesOptions.hidden !== shouldHideLeaves) {
      leavesOptions.hidden = shouldHideLeaves;
    }
    if (service) {
      service.setAttribute('aria-expanded', shouldHideLeaves ? 'false' : 'true');
    }
  }
  var intro = byId('yard-intro'), startBtn = byId('yard-start');
  function openTool() {
    if (intro) intro.hidden = true;
    form.hidden = false;
    if (startBtn) startBtn.setAttribute('aria-expanded', 'true');
    address.focus();
  }
  if (startBtn) startBtn.addEventListener('click', openTool);
  if (intro) intro.addEventListener('click', function (event) { if (event.target !== startBtn) openTool(); });
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href="#price-your-yard"]');
    if (link) openTool();
  });
  if (window.location.hash === '#price-your-yard') openTool();
  window.addEventListener('hashchange', function () { if (window.location.hash === '#price-your-yard') openTool(); });
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
    if (payload.address.length < 5 || /[\u0000-\u001f\u007f]/.test(payload.address)) { fail('Enter the full property address, including city and state.', address); return; }
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
    if (payload.lotSqft && ((payload.lawnSqft || 0) + (payload.drivewaySqft || 0) > payload.lotSqft)) {
      byId('yard-area-details').open = true;
      fail('Lawn and driveway areas together cannot exceed the total lot area.', yardLot); return;
    }
    var requestVersion = version;
    controller = new AbortController();
    var requestController = controller;
    var requestTimer = setTimeout(function () { requestController.abort(); }, 20000);
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
      var neededArea = service.value === 'grass' ? 'lawnSqft' : service.value === 'snow' ? 'drivewaySqft' : 'lotSqft';
      if (property && property.source === 'typical-lot-fallback' && !payload[neededArea]) {
        status.textContent = '';
        byId('yard-area-details').open = true;
        var neededLabel = service.value === 'grass' ? 'mowable lawn or total lot' : service.value === 'snow' ? 'driveway + walk or total lot' : 'total lot';
        fail('We could not verify this property’s lot size. Check the full address or enter your ' + neededLabel + ' area in square feet, then get your estimate again. You can also request a quote below.', byId(fields[neededArea]));
        return;
      }
      var estimate = data.estimates && data.estimates[service.value];
      var range = estimate && (service.value === 'grass' ? estimate.job : estimate.perVisit);
      if (!property || !['lotSqft', 'lawnSqft', 'drivewaySqft'].every(function (k) { return Number.isFinite(property[k]) && property[k] > 0; }) || !range || !['low', 'mid', 'high'].every(function (k) { return Number.isFinite(range[k]) && range[k] >= 0; }) || range.mid < range.low || range.mid > range.high) throw new Error('The estimate was incomplete. Please try again or request a quote directly.');
      candidate = { property: property, service: service.value, range: range, payload: payload };
      byId('yard-matched-address').textContent = property.matchedAddress ? 'Matched address: ' + property.matchedAddress : 'Address you entered (not verified): ' + payload.address;
      var list = byId('yard-surfaces');
      list.replaceChildren();
      [['lot', 'lotSqft', 'Total lot'], ['lawn', 'lawnSqft', 'Mowable lawn'], ['driveway', 'drivewaySqft', 'Driveway + walk']].forEach(function (entry) {
        var dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = entry[2];
        var supplied = Object.prototype.hasOwnProperty.call(payload, entry[1]);
        var unknown = property.source === 'typical-lot-fallback' && !supplied;
        var basisLabel = supplied ? 'provided by you' : entry[0] === 'lot' ? 'county parcel estimate — confirm this is your lot' : 'assumed share of total lot; not measured';
        dd.textContent = unknown ? 'Unknown — not used for this estimate' : number.format(property[entry[1]]) + ' sq ft — ' + basisLabel;
        list.append(dt, dd);
      });
      byId('yard-source').textContent = (property.source === 'provided' ? 'Using the lot size you entered; the address has not been verified.' : property.source === 'county-parcel' ? 'County parcel area is approximate. A nearby address match does not verify the parcel boundary.' : 'Using your supplied service area. The total lot size could not be verified.') + ' Lawn and driveway shares are assumptions unless you enter those measurements. After editing, select Get my estimate again.';
      var warnings = byId('yard-warnings'); warnings.replaceChildren();
      var warningCopy = {
        'parcel-not-configured': 'County lot lookup is not configured. Only your supplied service area can be priced.',
        'parcel-not-found': 'We could not identify one county parcel for this address. Check or enter your lot size.',
        'parcel-lookup-unavailable': 'County lot records could not be reached. Check or enter your lot size.',
        'lot-area-unknown': 'Lot size is unknown. Only your supplied service area can be priced.',
        'address-not-matched': 'The address could not be matched. Check its spelling, city, state, and ZIP before confirming.',
        'address-lookup-unavailable': 'Address lookup is temporarily unavailable. The address shown has not been verified.'
      };
      (Array.isArray(property.warnings) ? property.warnings : []).forEach(function (warning) { var li = document.createElement('li'); li.textContent = warningCopy[warning] || 'Some property details could not be verified. Check the address and areas carefully.'; warnings.append(li); });
      review.hidden = false;
      status.textContent = 'Check the address and areas below, then confirm to see your price.';
      review.focus();
    } catch (err) {
      if (requestVersion !== version) return;
      status.textContent = '';
      byId('yard-area-details').open = true;
      var friendly = err && err.name === 'AbortError' ? 'The estimate request took too long. Please try again or request a quote below.' : err && /^(Too many|We could not|The estimate was)/.test(err.message) ? err.message : 'We could not connect to the estimate service. Please retry, or enter your known lot size and try again. You can also request a quote directly.';
      fail(friendly);
    } finally {
      clearTimeout(requestTimer);
      if (requestVersion === version) loading(false);
    }
  });
  confirmation.addEventListener('change', function () {
    var checked = confirmation.checked;
    confirmation.setAttribute('aria-expanded', checked ? 'true' : 'false');
    if (!candidate || !checked) { result.hidden = true; return; }
    var range = candidate.range;
    byId('yard-price-range').textContent = priceRange(range);
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
    var basis = property.source === 'provided' ? 'provided lot' : property.source === 'county-parcel' ? 'county lot' : 'unknown lot';
    var areaSummary = [['lot', 'lotSqft'], ['lawn', 'lawnSqft'], ['drive/walk', 'drivewaySqft']].map(function (entry) {
      var supplied = Object.prototype.hasOwnProperty.call(candidate.payload, entry[1]);
      return entry[0] + ' ' + (property.source === 'typical-lot-fallback' && !supplied ? 'unknown' : number.format(property[entry[1]]) + ' sq ft (' + (supplied ? 'provided' : entry[0] === 'lot' ? 'county' : 'assumed') + ')');
    }).join(', ');
    var leavesDetail = candidate.service === 'leaves' ? '; ' + candidate.payload.cover + ' cover/' + candidate.payload.amount + ' leaves' : '';
    var summary = '[Yard quote: ' + serviceNames[candidate.service] + ' ' + priceRange(candidate.range) + '/visit; ' + areaSummary + '; ' + basis + leavesDetail + '; areas confirmed.]';
    var existing = notes.value;
    if (previousSummary) existing = existing.replace(previousSummary, '').trimEnd();
    var combined = existing + (existing ? '\n' : '') + summary;
    if (combined.length <= 500) { notes.value = combined; previousSummary = summary; byId('yard-handoff-status').textContent = 'Address, service, and your price added to your request below.'; }
    else { byId('yard-handoff-status').textContent = 'Address and service added. Your existing notes were preserved; shorten them if you want room for the estimate summary.'; }
    [leadAddress, leadService, notes].forEach(function (field) { field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); });
    var quote = byId('estimate');
    if (quote.scrollIntoView) quote.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    byId('f-name').focus({ preventScroll: true });
  });
})();

