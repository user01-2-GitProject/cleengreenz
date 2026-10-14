import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('How it works section steps accessibility', () => {
  const htmlPath = path.join(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const stepsList = document.querySelector('.steps');
  assert.ok(stepsList, 'found .steps element');
  assert.equal(stepsList.tagName.toLowerCase(), 'ol', '.steps is an ordered list <ol>');
  assert.equal(stepsList.getAttribute('aria-label'), 'How it works steps', '.steps has aria-label="How it works steps"');

  const stepItems = stepsList.querySelectorAll('.step');
  assert.equal(stepItems.length, 3, 'contains 3 step items');
  stepItems.forEach((item) => {
    assert.equal(item.tagName.toLowerCase(), 'li', 'each .step item is an <li> element');
  });
});
