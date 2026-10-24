import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('Seasonal cards in #season grid are interactive estimate links', async (t) => {
  await t.test('CSS rules include focus-visible focus outline style for .season-card', () => {
    const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.match(htmlTemplate, /\.season-card:focus-visible\s*\{\s*outline:\s*3px solid var\(--gold\);\s*outline-offset:\s*3px;\s*\}/);
  });

  await t.test('all .season-card elements are anchor links with valid href="#estimate" and data-service attributes', () => {
    const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const dom = new JSDOM(htmlTemplate, {
      url: 'https://cleengreenz.com'
    });
    const { document } = dom.window;

    const seasonLinks = document.querySelectorAll('#season .season-card');
    assert.equal(seasonLinks.length, 3, 'should contain 3 seasonal card links');

    const expectedServices = [
      'Fall leaf cleanup',
      'Seeding and fertilizing',
      'Snow removal'
    ];

    seasonLinks.forEach((link, idx) => {
      assert.equal(link.tagName, 'A', `seasonal card ${idx + 1} should be an <a> element`);
      assert.equal(link.getAttribute('href'), '#estimate', `seasonal card ${idx + 1} should target #estimate`);
      assert.equal(link.getAttribute('data-lead-location'), 'season', `seasonal card ${idx + 1} should have data-lead-location="season"`);
      assert.equal(link.getAttribute('data-service'), expectedServices[idx], `seasonal card ${idx + 1} should have data-service="${expectedServices[idx]}"`);
    });
  });

  await t.test('clicking a seasonal card pre-selects option in #f-service and focuses #f-name input', async () => {
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
    const snowCard = document.querySelector('#season a.season-card[data-service="Snow removal"]');

    assert.ok(snowCard, 'snow removal seasonal card should exist');
    assert.notEqual(serviceSelect.value, 'Snow removal');

    snowCard.click();

    // Give setTimeout in leads.js a cycle to focus #f-name
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(serviceSelect.value, 'Snow removal', 'clicking seasonal card should pre-select option in #f-service');
    assert.equal(document.activeElement, nameInput, 'clicking seasonal card should shift focus to #f-name input');
  });
});
