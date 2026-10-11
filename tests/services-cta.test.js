import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('Service cards in #services grid are interactive estimate links', async (t) => {
  await t.test('all .service elements are anchor links with valid href="#estimate" and data-service attributes', () => {
    const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const dom = new JSDOM(htmlTemplate, {
      url: 'https://cleengreenz.com'
    });
    const { document } = dom.window;

    const serviceLinks = document.querySelectorAll('#services .service');
    assert.equal(serviceLinks.length, 6, 'should contain 6 service card links');

    const expectedServices = [
      'Weekly mowing and edging',
      'Weekly mowing and edging',
      'Seeding and fertilizing',
      'Fall leaf cleanup',
      'Mulch or shrub trimming',
      'Snow removal'
    ];

    serviceLinks.forEach((link, idx) => {
      assert.equal(link.tagName, 'A', `service card ${idx + 1} should be an <a> element`);
      assert.equal(link.getAttribute('href'), '#estimate', `service card ${idx + 1} should target #estimate`);
      assert.equal(link.getAttribute('data-lead-location'), 'services', `service card ${idx + 1} should have data-lead-location="services"`);
      assert.equal(link.getAttribute('data-service'), expectedServices[idx], `service card ${idx + 1} should have data-service="${expectedServices[idx]}"`);
    });
  });

  await t.test('clicking a service card pre-selects option in #f-service and focuses #f-name input', async () => {
    const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const leadsJs = fs.readFileSync(path.resolve(process.cwd(), 'js/leads.js'), 'utf8');

    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      url: 'https://cleengreenz.com',
      beforeParse(window) {
        window.matchMedia = window.matchMedia || function () {
          return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        };
        window.requestAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.pause = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
        window.fetch = window.fetch || (() => Promise.resolve({ ok: true }));
        if (window.navigator) {
          window.navigator.sendBeacon = window.navigator.sendBeacon || (() => true);
        }
      }
    });
    const { window } = dom;
    const { document } = window;

    // Load js/leads.js script
    window.eval(leadsJs);

    const serviceSelect = document.getElementById('f-service');
    const nameInput = document.getElementById('f-name');
    const serviceCard = document.querySelector('#services a.service[data-service="Mulch or shrub trimming"]');

    assert.ok(serviceCard, 'mulch or shrub trimming service card should exist');
    assert.notEqual(serviceSelect.value, 'Mulch or shrub trimming');

    serviceCard.click();

    // Give setTimeout in leads.js a cycle to focus #f-name
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(serviceSelect.value, 'Mulch or shrub trimming', 'clicking service card should pre-select option in #f-service');
    assert.equal(document.activeElement, nameInput, 'clicking service card should shift focus to #f-name input');
  });
});
