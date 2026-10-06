import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const leadsJsCode = fs.readFileSync(path.resolve(process.cwd(), 'js/leads.js'), 'utf8');

test('Service cards accessibility & pre-selection behavior', async (t) => {
  await t.test('all service cards in #services are interactive <a> links targeting #estimate with data-service and data-lead-location', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const cards = document.querySelectorAll('.services-grid .service');
    assert.equal(cards.length, 6, 'Exactly 6 service cards found');

    cards.forEach((card, idx) => {
      assert.equal(card.tagName.toLowerCase(), 'a', `Card ${idx + 1} is an <a> element`);
      assert.equal(card.getAttribute('href'), '#estimate', `Card ${idx + 1} links to #estimate`);
      assert.ok(card.getAttribute('data-service'), `Card ${idx + 1} has non-empty data-service attribute`);
      assert.equal(card.getAttribute('data-lead-location'), 'services', `Card ${idx + 1} has data-lead-location="services"`);
    });
  });

  await t.test('clicking a service card pre-selects the corresponding option in #f-service dropdown', () => {
    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      url: 'http://localhost/',
      beforeParse(win) {
        win.matchMedia = win.matchMedia || (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
        win.requestAnimationFrame = win.requestAnimationFrame || (() => {});
        win.cancelAnimationFrame = win.cancelAnimationFrame || (() => {});
      }
    });
    const { document, window } = dom.window;

    // Attach tracking function stub
    let trackedLeadType = null;
    let trackedLeadLoc = null;
    window.trackLead = (type, loc) => {
      trackedLeadType = type;
      trackedLeadLoc = loc;
    };

    // Load leads.js script
    const script = document.createElement('script');
    script.textContent = leadsJsCode;
    document.body.appendChild(script);

    const serviceSelect = document.getElementById('f-service');
    const snowCard = document.querySelector('.services-grid .service[data-service="Snow removal"]');
    assert.ok(snowCard, 'Snow removal card found');

    // Click snow card
    snowCard.click();

    assert.equal(serviceSelect.value, 'Snow removal', 'Select dropdown value updated to Snow removal');
    assert.equal(trackedLeadType, 'estimate_click', 'trackLead fired with estimate_click');
    assert.equal(trackedLeadLoc, 'services', 'trackLead fired with location "services"');
  });
});
