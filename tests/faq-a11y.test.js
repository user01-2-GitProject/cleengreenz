import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('FAQ summary elements initialize with aria-expanded="false" and toggle aria-expanded on details open/close', async (t) => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const dom = new JSDOM(htmlTemplate, {
    runScripts: 'dangerously',
    resources: 'usable',
    beforeParse(window) {
      window.IntersectionObserver = MockIntersectionObserver;
      window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      window.HTMLMediaElement.prototype.pause = () => {};
    },
  });

  const { document } = dom.window;

  const summaries = document.querySelectorAll('.faq summary');
  assert.ok(summaries.length > 0, 'FAQ section should contain summary elements');

  summaries.forEach((summary) => {
    assert.equal(
      summary.getAttribute('aria-expanded'),
      'false',
      'FAQ summary element should initialize with aria-expanded="false"'
    );
  });

  const firstDetails = document.querySelector('.faq details');
  const firstSummary = firstDetails.querySelector('summary');

  // Toggle details open
  firstDetails.open = true;
  firstDetails.dispatchEvent(new dom.window.Event('toggle', { bubbles: true }));

  assert.equal(
    firstSummary.getAttribute('aria-expanded'),
    'true',
    'FAQ summary aria-expanded should be updated to "true" when details is opened'
  );

  // Toggle details closed
  firstDetails.open = false;
  firstDetails.dispatchEvent(new dom.window.Event('toggle', { bubbles: true }));

  assert.equal(
    firstSummary.getAttribute('aria-expanded'),
    'false',
    'FAQ summary aria-expanded should be updated to "false" when details is closed'
  );
});
