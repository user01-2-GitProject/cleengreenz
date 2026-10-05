import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('contact and in-page navigation accessibility', () => {
  const { document } = new JSDOM(html).window;
  const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
  assert.ok(phoneLinks.length > 0);
  for (const link of phoneLinks) assert.match(link.getAttribute('aria-label') || '', /269|362-8286/);

  const externalLinks = document.querySelectorAll('a[target="_blank"]');
  assert.ok(externalLinks.length > 0);
  for (const link of externalLinks) {
    assert.ok(link.querySelector('svg.ext-icon[aria-hidden="true"]'));
    assert.match(link.getAttribute('aria-label') || '', /opens in a new tab/);
  }

  for (const id of ['top', 'season', 'services', 'meet', 'how', 'area', 'faq', 'estimate']) {
    assert.equal(document.getElementById(id)?.getAttribute('tabindex'), '-1', id);
  }
  assert.match(html, /section\[id\]\s*\{\s*scroll-margin-top:\s*84px;/);
});
