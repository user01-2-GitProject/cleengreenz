import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('Phone tel: links accessibility attributes', async (t) => {
  await t.test('all tel: links have aria-label attributes containing phone number (269) 362-8286', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const telLinks = document.querySelectorAll('a[href^="tel:"]');
    assert.ok(telLinks.length > 0, 'tel: links exist');

    telLinks.forEach((link, index) => {
      const ariaLabel = link.getAttribute('aria-label');
      assert.ok(ariaLabel, `Link ${index + 1} (${link.getAttribute('href')}) has aria-label attribute`);
      assert.match(
        ariaLabel,
        /269.*362.*8286/,
        `Link ${index + 1} aria-label "${ariaLabel}" contains phone number digits`
      );
    });
  });
});
