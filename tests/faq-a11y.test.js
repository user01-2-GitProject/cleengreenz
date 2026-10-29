import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('FAQ details/summary accessibility attributes', async (t) => {
  await t.test('all FAQ summary elements have aria-controls pointing to valid answer element IDs', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const summaries = document.querySelectorAll('.faq summary');
    assert.ok(summaries.length > 0, 'FAQ summaries exist');

    summaries.forEach((summary, index) => {
      const ariaControls = summary.getAttribute('aria-controls');
      assert.ok(ariaControls, `Summary ${index + 1} has aria-controls attribute`);

      const targetEl = document.getElementById(ariaControls);
      assert.ok(targetEl, `Element with id "${ariaControls}" exists in DOM`);
      assert.equal(targetEl.tagName.toLowerCase(), 'p', `Controlled element is a <p> tag`);
    });
  });

  await t.test('all summary elements (including #yard-area-details) have initial aria-expanded="false" and toggle on open', () => {
    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      beforeParse(window) {
        window.matchMedia = window.matchMedia || function () {
          return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        };
        window.requestAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.pause = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      }
    });
    const { document, Event } = dom.window;

    const detailsList = document.querySelectorAll('details');
    assert.ok(detailsList.length > 1, 'Multiple details elements exist including FAQ and yard-area-details');

    detailsList.forEach((details, index) => {
      const summary = details.querySelector('summary');
      assert.ok(summary, `Details ${index + 1} has a summary element`);
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} initially has aria-expanded="false"`);

      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'true', `Summary ${index + 1} has aria-expanded="true" when details open`);

      details.open = false;
      details.dispatchEvent(new Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} returns to aria-expanded="false" when details closed`);
    });
  });

  await t.test('pressing Escape key on open details elements (including #yard-area-details) closes them and focuses summary', () => {
    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      beforeParse(window) {
        window.matchMedia = window.matchMedia || function () {
          return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        };
        window.requestAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.pause = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      }
    });
    const { document, KeyboardEvent } = dom.window;

    const yardDetails = document.getElementById('yard-area-details');
    assert.ok(yardDetails, '#yard-area-details exists');
    const yardSummary = yardDetails.querySelector('summary');

    yardDetails.open = true;
    yardDetails.dispatchEvent(new dom.window.Event('toggle'));
    assert.equal(yardDetails.open, true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    yardDetails.dispatchEvent(escapeEvent);

    assert.equal(yardDetails.open, false);
    assert.equal(document.activeElement, yardSummary);
  });

  await t.test('#yard-address input has optimal mobile keyboard attributes', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const addressInput = document.getElementById('yard-address');
    assert.ok(addressInput, '#yard-address input exists');
    assert.equal(addressInput.getAttribute('autocapitalize'), 'words');
    assert.equal(addressInput.getAttribute('enterkeyhint'), 'search');
  });

  await t.test('yard estimator controls have explicit aria-controls relationships for disclosed sections', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const yardService = document.getElementById('yard-service');
    assert.ok(yardService, '#yard-service element exists');
    const serviceControls = yardService.getAttribute('aria-controls');
    assert.equal(serviceControls, 'yard-leaves-options', '#yard-service controls #yard-leaves-options');
    assert.ok(document.getElementById(serviceControls), 'controlled element #yard-leaves-options exists');

    const yardAreaDetails = document.getElementById('yard-area-details');
    assert.ok(yardAreaDetails, '#yard-area-details element exists');
    const yardAreaSummary = yardAreaDetails.querySelector('summary');
    assert.ok(yardAreaSummary, '#yard-area-details summary exists');
    const areaControls = yardAreaSummary.getAttribute('aria-controls');
    assert.equal(areaControls, 'yard-area-fields', '#yard-area-details summary controls #yard-area-fields');
    assert.ok(document.getElementById(areaControls), 'controlled element #yard-area-fields exists');
  });
});
