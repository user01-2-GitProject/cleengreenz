// Lead tracking and the estimate form.
//
// index.html fires a `cg:lead` event for every call and email link tap (see
// trackLead there). This file sends those to /api/lead so they get counted,
// counts clicks on the "free estimate" buttons, and submits the estimate form
// to /api/lead, which stores it and emails Chris. If that fails, the form falls
// back to opening a prefilled email like before.
(function () {
  function buildPayload(data) {
    var page = typeof location !== 'undefined' ? location.pathname : '';
    var referrer = typeof document !== 'undefined' ? document.referrer : '';
    return Object.assign({ page: page, referrer: referrer }, data);
  }

  function send(data) {
    var payload = JSON.stringify(buildPayload(data));
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/lead', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    }
  }

  if (typeof document === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = { buildPayload };
    }
    return;
  }

  // Copy phone number functionality with debounced clearing timer and fallback handling
  var copyTimeout = null;
  document.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('.copy-phone-btn');
    if (copyBtn) {
      var phoneNum = copyBtn.dataset.phone || '(269) 362-8286';
      var container = copyBtn.parentElement;
      var feedback = container ? container.querySelector('.copy-feedback') : null;
      var writePromise;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        writePromise = navigator.clipboard.writeText(phoneNum);
      } else {
        writePromise = Promise.resolve();
      }
      writePromise.then(function () {
        if (copyTimeout) clearTimeout(copyTimeout);
        copyBtn.classList.add('copied');
        copyBtn.setAttribute('aria-label', 'Phone number copied');
        if (feedback) feedback.textContent = 'Copied!';
        copyTimeout = setTimeout(function () {
          if (feedback) feedback.textContent = '';
          copyBtn.classList.remove('copied');
          copyBtn.setAttribute('aria-label', 'Copy phone number ' + phoneNum);
          copyTimeout = null;
        }, 2000);
      }).catch(function () {
        if (copyTimeout) clearTimeout(copyTimeout);
        copyBtn.classList.remove('copied');
        copyBtn.setAttribute('aria-label', 'Copy phone number ' + phoneNum);
        if (feedback) feedback.textContent = 'Failed to copy';
        copyTimeout = setTimeout(function () {
          if (feedback) feedback.textContent = '';
          copyTimeout = null;
        }, 2000);
      });
    }
  });

  // Call and email taps. Form requests are recorded by the server when submitted.
  document.addEventListener('cg:lead', function (e) {
    var d = e.detail || {};
    if (d.lead_type === 'form') return;
    send({ type: d.lead_type, location: d.lead_location });
  });

  // "Free estimate" buttons that jump to the form.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#estimate"]');
    if (a) {
      if (window.trackLead) window.trackLead('estimate_click', a.dataset.leadLocation || 'link');
      if (a.dataset.service) {
        var serviceSelect = document.getElementById('f-service');
        if (serviceSelect) {
          var targetVal = a.dataset.service;
          for (var i = 0; i < serviceSelect.options.length; i++) {
            if (serviceSelect.options[i].text === targetVal || serviceSelect.options[i].value === targetVal) {
              serviceSelect.selectedIndex = i;
              break;
            }
          }
        }
      }
      var nameInput = document.getElementById('f-name');
      if (nameInput) {
        setTimeout(function () { nameInput.focus(); }, 50);
      }
    }
  });

  var form = document.getElementById('estimate-form');
  if (!form) return;

  var notesInput = form.querySelector('#f-notes');
  var notesCount = form.querySelector('#f-notes-count');
  if (notesInput && notesCount) {
    var maxLen = notesInput.maxLength > 0 ? notesInput.maxLength : 500;
    function updateNotesCount() {
      var remaining = maxLen - notesInput.value.length;
      notesCount.textContent = '· ' + remaining + ' character' + (remaining === 1 ? '' : 's') + ' remaining';
      notesCount.classList.toggle('near-limit', remaining <= 20);
    }
    notesInput.addEventListener('input', updateNotesCount);
    updateNotesCount();
  }

  var phoneInput = form.querySelector('#f-phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function () {
      var digits = phoneInput.value.replace(/\D/g, '');
      if (!digits) {
        phoneInput.value = '';
        return;
      }
      if (digits.length >= 11 && digits[0] === '1') {
        digits = digits.slice(1);
      }
      if (digits.length > 10) digits = digits.slice(0, 10);
      if (digits.length <= 3) {
        phoneInput.value = '(' + digits;
      } else if (digits.length <= 6) {
        phoneInput.value = '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
      } else {
        phoneInput.value = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
      }
    });
  }

  // Hidden field only bots fill in.
  var trap = document.createElement('input');
  trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
  trap.setAttribute('aria-hidden', 'true');
  trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
  form.appendChild(trap);

  var fieldsBox = form.querySelector('.form-fields');
  var done = form.querySelector('.form-done');
  var button = form.querySelector('button[type="submit"]');
  var requiredFields = form.querySelectorAll('[required]');
  var resetBtn = done ? done.querySelector('#form-reset-btn') : null;
  var sending = false;

  function showDone() {
    fieldsBox.style.display = 'none';
    done.classList.add('show');
    var heading = done.querySelector('h3');
    if (heading) heading.focus();
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      form.reset();
      for (var i = 0; i < requiredFields.length; i++) {
        var field = requiredFields[i];
        field.removeAttribute('aria-invalid');
        var errEl = errorFor(field);
        if (errEl) {
          errEl.classList.remove('show');
          if (field.id === 'f-phone') errEl.textContent = 'Please enter your phone number';
          var descriptions = (field.getAttribute('aria-describedby') || '').split(/\s+/)
            .filter(function (id) { return id && id !== errEl.id; }).join(' ');
          if (descriptions) field.setAttribute('aria-describedby', descriptions);
          else field.removeAttribute('aria-describedby');
        }
      }
      done.classList.remove('show');
      fieldsBox.style.display = '';
      var heading = done.querySelector('h3');
      if (heading) heading.textContent = 'Thanks, got it!';
      var p = done.querySelector('p');
      if (p) p.textContent = 'Chris has your request and will be in touch soon.';
      if (notesInput && notesCount) updateNotesCount();
      var firstInput = form.querySelector('#f-name');
      if (firstInput) firstInput.focus();
    });
  }

  function openEmail(d) {
    // Sanitize fields to remove control/BIDI characters and linebreaks that could inject mail headers or spoof display
    var ctrlRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/g;
    var cleanName = (d.name || '').replace(ctrlRegex, '').replace(/[\r\n]+/g, ' ');
    var cleanPhone = (d.phone || '').replace(ctrlRegex, '').replace(/[\r\n]+/g, ' ');
    var cleanAddress = (d.address || '').replace(ctrlRegex, '').replace(/[\r\n]+/g, ' ');
    var cleanService = (d.service || 'lawn care').replace(ctrlRegex, '').replace(/[\r\n]+/g, ' ');
    var cleanNotes = (d.notes || '').replace(ctrlRegex, '').replace(/\r\n?/g, '\n');

    var body = [
      'Hi Chris, I would like a free estimate.',
      '',
      'Name: ' + cleanName,
      'Phone: ' + cleanPhone,
      'Address: ' + cleanAddress,
      'Service: ' + cleanService,
      cleanNotes ? 'Notes: ' + cleanNotes : ''
    ].join('\n');
    done.querySelector('h3').textContent = 'Almost there!';
    done.querySelector('p').textContent = 'Your email app should have opened with your request. Just hit send and Chris will be in touch.';
    showDone();
    window.location.href = 'mailto:chris@cleengreenz.com?subject=' +
      encodeURIComponent('Estimate request: ' + cleanService + ' (' + cleanName + ')') +
      '&body=' + encodeURIComponent(body);
  }

  // The honeypot field is built without an id, so skip the lookup rather than query '#-err'.
  function errorFor(field) {
    return field.id ? form.querySelector('#' + CSS.escape(field.id) + '-err') : null;
  }

  function validateField(field) {
    var isRequired = field && (field.hasAttribute ? field.hasAttribute('required') : (field.getAttribute && field.getAttribute('required') !== null));
    if (!isRequired) return true;
    var errEl = errorFor(field);
    var isInvalid = !field.value.trim();
    if (field.id === 'f-phone') {
      var phoneDigits = field.value.replace(/\D/g, '');
      if (!isInvalid && phoneDigits.length < 7) {
        isInvalid = true;
        if (errEl) errEl.textContent = 'Please enter a valid phone number with area code';
      } else if (errEl) {
        errEl.textContent = 'Please enter your phone number';
      }
    }
    if (isInvalid) {
      field.setAttribute('aria-invalid', 'true');
      if (errEl) {
        errEl.classList.add('show');
        var currentDescribedBy = field.getAttribute('aria-describedby') || '';
        var ids = currentDescribedBy.split(/\s+/).filter(Boolean);
        if (ids.indexOf(errEl.id) === -1) {
          ids.push(errEl.id);
          field.setAttribute('aria-describedby', ids.join(' '));
        }
      }
      return false;
    } else {
      field.removeAttribute('aria-invalid');
      if (errEl) {
        errEl.classList.remove('show');
        var descriptions = (field.getAttribute('aria-describedby') || '').split(/\s+/)
          .filter(function (id) { return id && id !== errEl.id; }).join(' ');
        if (descriptions) field.setAttribute('aria-describedby', descriptions);
        else field.removeAttribute('aria-describedby');
      }
      return true;
    }
  }

  form.addEventListener('focusout', function (e) {
    var field = e.target;
    if (field && field.hasAttribute && field.hasAttribute('required')) {
      if (field.value.trim() !== '' || field.getAttribute('aria-invalid') === 'true') {
        validateField(field);
      }
    }
  });

  form.addEventListener('input', function (e) {
    var field = e.target;
    if (field && field.getAttribute && field.getAttribute('aria-invalid') === 'true') {
      validateField(field);
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var invalidField = null;
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      var isValid = validateField(field);
      if (!isValid && !invalidField) {
        invalidField = field;
      }
    }
    if (invalidField) {
      invalidField.focus();
      return;
    }
    var d = Object.fromEntries(new FormData(form));
    if (window.trackLead) window.trackLead('form', 'estimate', { service: d.service });

    sending = true;
    var label = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Sending...';
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(Object.assign({ type: 'form', location: 'estimate' }, d)))
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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildPayload };
  }
})();
