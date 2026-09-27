// Lead tracking and the estimate form.
//
// index.html fires a `cg:lead` event for every call and email link tap (see
// trackLead there). This file sends those to /api/lead so they get counted,
// counts clicks on the "free estimate" buttons, and submits the estimate form
// to /api/lead, which stores it and emails Chris. If that fails, the form falls
// back to opening a prefilled email like before.
(function () {
  function send(data) {
    var payload = JSON.stringify(Object.assign({ page: location.pathname, referrer: document.referrer }, data));
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/lead', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    }
  }

  // Call and email taps. Form requests are recorded by the server when submitted.
  document.addEventListener('cg:lead', function (e) {
    var d = e.detail || {};
    if (d.lead_type === 'form') return;
    send({ type: d.lead_type, location: d.lead_location });
  });

  // "Free estimate" buttons that jump to the form.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#estimate"]');
    if (a && window.trackLead) window.trackLead('estimate_click', a.dataset.leadLocation || 'link');
  });

  var form = document.getElementById('estimate-form');
  if (!form) return;

  // Hidden field only bots fill in.
  var trap = document.createElement('input');
  trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(trap);

  var fieldsBox = form.querySelector('.form-fields');
  var done = form.querySelector('.form-done');
  var button = form.querySelector('button[type="submit"]');
  var sending = false;

  function showDone() {
    fieldsBox.style.display = 'none';
    done.classList.add('show');
    if (done.focus) done.focus();
  }

  function openEmail(d) {
    var body = [
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

  form.addEventListener('input', function (e) {
    if (e.target && e.target.removeAttribute) {
      e.target.removeAttribute('aria-invalid');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var fields = form.querySelectorAll('[required]');
    var invalidField = null;
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].value.trim()) {
        fields[i].setAttribute('aria-invalid', 'true');
        if (!invalidField) invalidField = fields[i];
      } else {
        fields[i].removeAttribute('aria-invalid');
      }
    }
    if (invalidField) {
      invalidField.focus();
      invalidField.reportValidity && invalidField.reportValidity();
      return;
    }
    var d = Object.fromEntries(new FormData(form));
    if (window.trackLead) window.trackLead('form', 'estimate', { service: d.service });

    sending = true;
    var label = button.textContent;
    button.disabled = true;
    button.textContent = 'Sending...';
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.assign({ type: 'form', location: 'estimate', page: location.pathname, referrer: document.referrer }, d))
    })
      .then(function (res) { if (!res.ok) throw new Error(res.status); showDone(); })
      .catch(function () { openEmail(d); })
      .then(function () { sending = false; button.disabled = false; button.textContent = label; });
  });
})();
