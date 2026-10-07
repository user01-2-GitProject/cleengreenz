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

  await t.test('FAQ summary elements have initial aria-expanded="false" and toggle to "true" on details open', () => {
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

    const detailsList = document.querySelectorAll('.faq details');
    assert.ok(detailsList.length > 0, 'FAQ details exist');

    detailsList.forEach((details, index) => {
      const summary = details.querySelector('summary');
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} initially has aria-expanded="false"`);

      details.open = true;
      details.dispatchEvent(new Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'true', `Summary ${index + 1} has aria-expanded="true" when details open`);

      details.open = false;
      details.dispatchEvent(new Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} returns to aria-expanded="false" when details closed`);
    });
  });
});
