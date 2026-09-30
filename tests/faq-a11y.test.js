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
});
