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
    const numEl = item.querySelector('.num');
    assert.ok(numEl, 'step item has .num element');
    assert.equal(numEl.getAttribute('aria-hidden'), 'true', '.num is aria-hidden="true"');
  });

  const yardStepsList = document.querySelector('.yard-steps');
  assert.ok(yardStepsList, 'found .yard-steps element');
  assert.equal(yardStepsList.tagName.toLowerCase(), 'ol', '.yard-steps is an ordered list <ol>');
  assert.equal(yardStepsList.getAttribute('aria-label'), 'Yard estimator steps', '.yard-steps has aria-label="Yard estimator steps"');

  const yardStepItems = yardStepsList.querySelectorAll('li');
  assert.equal(yardStepItems.length, 4, 'contains 4 yard step items');
  yardStepItems.forEach((item) => {
    const numEl = item.querySelector('.yard-step-num');
    assert.ok(numEl, 'yard step item has .yard-step-num element');
    assert.equal(numEl.getAttribute('aria-hidden'), 'true', '.yard-step-num is aria-hidden="true"');
  });
});
