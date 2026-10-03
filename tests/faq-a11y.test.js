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

  await t.test('all FAQ summary elements have aria-expanded="false" initially and update on toggle', () => {
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      beforeParse(window) {
        window.IntersectionObserver = MockIntersectionObserver;
        window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        if (window.HTMLMediaElement) {
          window.HTMLMediaElement.prototype.play = () => Promise.resolve();
          window.HTMLMediaElement.prototype.pause = () => {};
        }
      },
    });
    const { document } = dom.window;

    const detailsList = document.querySelectorAll('.faq details');
    assert.ok(detailsList.length > 0, 'FAQ details elements exist');

    detailsList.forEach((detail, index) => {
      const summary = detail.querySelector('summary');
      assert.ok(summary, `Detail ${index + 1} has summary element`);
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} has initial aria-expanded="false"`);

      detail.open = true;
      detail.dispatchEvent(new dom.window.Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'true', `Summary ${index + 1} has aria-expanded="true" when open`);

      detail.open = false;
      detail.dispatchEvent(new dom.window.Event('toggle'));
      assert.equal(summary.getAttribute('aria-expanded'), 'false', `Summary ${index + 1} has aria-expanded="false" when closed`);
    });
  });
});
