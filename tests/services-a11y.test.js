import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('Services grid cards accessibility and estimate form integration', async (t) => {
  await t.test('all .service elements are <a> cards with valid data-service matching options in #f-service', () => {
    const dom = new JSDOM(htmlTemplate);
    const { document } = dom.window;

    const serviceCards = document.querySelectorAll('#services .service');
    assert.ok(serviceCards.length > 0, 'Service cards exist in #services section');

    const serviceSelect = document.getElementById('f-service');
    assert.ok(serviceSelect, '#f-service dropdown exists');

    const validOptionValues = Array.from(serviceSelect.options).map(opt => opt.text || opt.value);

    serviceCards.forEach((card, index) => {
      assert.equal(card.tagName.toLowerCase(), 'a', `Service card ${index + 1} is an <a> element`);
      assert.equal(card.getAttribute('href'), '#estimate', `Service card ${index + 1} targets #estimate`);

      const dataService = card.getAttribute('data-service');
      assert.ok(dataService, `Service card ${index + 1} has data-service attribute`);
      assert.ok(
        validOptionValues.includes(dataService),
        `data-service "${dataService}" on card ${index + 1} matches an option in #f-service`
      );
    });
  });
});
