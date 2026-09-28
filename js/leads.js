// Lead tracking and the estimate form.
//
// index.html fires a `cg:lead` event for every call and email link tap (see
// trackLead there). This file sends those to /api/lead so they get counted,
// counts clicks on the "free estimate" buttons, and submits the estimate form
// to /api/lead, which stores it and emails Chris. If that fails, the form falls
// back to opening a prefilled email like before.
(function () {
  function send(data) {
    const payload = JSON.stringify(Object.assign({ page: location.pathname, referrer: document.referrer }, data));
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/lead', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    }
  }

  // Call and email taps. Form requests are recorded by the server when submitted.
  document.addEventListener('cg:lead', function (e) {
    const d = e.detail || {};
    if (d.lead_type === 'form') return;
    send({ type: d.lead_type, location: d.lead_location });
  });

  // "Free estimate" buttons that jump to the form.
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href="#estimate"]');
    if (a && window.trackLead) window.trackLead('estimate_click', a.dataset.leadLocation || 'link');
  });

  const form = document.getElementById('estimate-form');
  if (!form) return;

  // Hidden field only bots fill in.
  const trap = document.createElement('input');
  trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(trap);

  const fieldsBox = form.querySelector('.form-fields');
  const done = form.querySelector('.form-done');
  const button = form.querySelector('button[type="submit"]');
  let sending = false;

  function showDone() {
    fieldsBox.style.display = 'none';
    done.classList.add('show');
    const heading = done.querySelector('h3');
    if (heading) heading.focus();
  }

  function openEmail(d) {
    const body = [
      'Hi Chris, I would like a free estimate.',
      '',
      'Name: ' + d.name,
      'Phone: ' + d.phone,
      'Address: ' + d.address,
      'Service: ' + d.service,
      d.notes ? 'Notes: ' + d.notes : ''
    ].join('\n');
    done.querySelector('h3').textContent = 'Almost there!';
    done.querySelector('p').textContent = 'Your email app should have opened with your request. Just hit send and Chris will be in touch.';
    showDone();
    window.location.href = 'mailto:chris@cleengreenz.com?subject=' +
      encodeURIComponent('Estimate request: ' + d.service + ' (' + d.name + ')') +
      '&body=' + encodeURIComponent(body);
  }

  // The honeypot field is built without an id, so skip the lookup rather than query '#-err'.
  function errorFor(field) {
    return field.id ? form.querySelector('#' + CSS.escape(field.id) + '-err') : null;
  }

  form.addEventListener('input', function (e) {
    const field = e.target;
    if (field && field.removeAttribute) {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
      const errEl = errorFor(field);
      if (errEl) errEl.classList.remove('show');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    const fields = form.querySelectorAll('[required]');
    let invalidField = null;
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const errEl = errorFor(field);
      if (!field.value.trim()) {
        field.setAttribute('aria-invalid', 'true');
        if (errEl) {
          errEl.classList.add('show');
          field.setAttribute('aria-describedby', errEl.id);
        }
        if (!invalidField) invalidField = field;
      } else {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
        if (errEl) errEl.classList.remove('show');
      }
    }
    if (invalidField) {
      invalidField.focus();
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    if (window.trackLead) window.trackLead('form', 'estimate', { service: d.service });

    sending = true;
    const label = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Sending...';
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ type: 'form', location: 'estimate', page: location.pathname, referrer: document.referrer }, d))
    })
      .then(function (res) { if (!res.ok) throw new Error(res.status); showDone(); })
      .catch(function () { openEmail(d); })
      .then(function () {
        sending = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = label;
      });
  });
})();
