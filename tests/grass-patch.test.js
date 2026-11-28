import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');

test('winter scene replaces the retired grass interaction', () => {
  const dom = new JSDOM(htmlContent, { url: 'https://cleengreenz.test/' });
  const { document } = dom.window;

  assert.ok(document.querySelector('.winter-scene'), 'the hero should render the current winter scene');
  assert.ok(document.querySelector('.winter-scene-snow'), 'the page should include snow decoration');
  assert.equal(document.querySelectorAll('.grass-patch, .lawn-grass-layer, .pet-mower').length, 0, 'retired grass interaction markup should not be rendered');

  dom.window.close();
});
