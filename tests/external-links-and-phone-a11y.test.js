import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('External links visual indicators and phone buttons accessibility', async (t) => {
  await t.test('links opening in a new tab have external icon SVG with aria-hidden="true"', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const targetBlankLinks = document.querySelectorAll('a[target="_blank"]');
    assert.ok(targetBlankLinks.length > 0, 'Target blank links exist on page');

    targetBlankLinks.forEach((link) => {
      const extIcon = link.querySelector('svg.ext-icon, svg');
      assert.ok(extIcon, `Link "${link.textContent.trim()}" contains visual external icon SVG`);
      assert.equal(extIcon.getAttribute('aria-hidden'), 'true', 'External icon SVG has aria-hidden="true"');
      const ariaLabel = link.getAttribute('aria-label') || '';
      assert.ok(ariaLabel.includes('opens in a new tab'), 'Target blank link aria-label informs screen reader users about new tab');
    });
  });

  await t.test('phone call action links/buttons have complete aria-label attributes including phone number', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
    assert.ok(phoneLinks.length > 0, 'Phone links exist on page');

    phoneLinks.forEach((link) => {
      const ariaLabel = link.getAttribute('aria-label');
      assert.ok(ariaLabel, `Phone link "${link.textContent.trim()}" has an aria-label`);
      assert.ok(ariaLabel.includes('269') || ariaLabel.includes('362-8286'), `Phone link aria-label "${ariaLabel}" contains telephone number`);
    });
  });
});
