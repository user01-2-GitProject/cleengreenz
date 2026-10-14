import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('How it works section accessibility and list semantics', () => {
  const { document } = new JSDOM(html).window;
  const section = document.getElementById('how');
  assert.ok(section, '#how section exists');

  const stepsList = section.querySelector('ol.steps');
  assert.ok(stepsList, '#how section contains an <ol class="steps"> element');
  assert.equal(stepsList.getAttribute('aria-label'), 'How it works steps');

  const stepItems = stepsList.querySelectorAll('li.step');
  assert.equal(stepItems.length, 3, 'contains 3 step list items');

  stepItems.forEach((item, index) => {
    const num = item.querySelector('.num');
    assert.ok(num, `step ${index + 1} has number element`);
    assert.equal(num.textContent.trim(), String(index + 1));
    assert.ok(item.querySelector('h3'), `step ${index + 1} has heading element`);
    assert.ok(item.querySelector('p'), `step ${index + 1} has paragraph element`);
  });
});
