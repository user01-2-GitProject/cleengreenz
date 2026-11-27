import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('winter hero uses a static scene when no videos are rendered', () => {
  const dom = new JSDOM(htmlTemplate, { url: 'https://cleengreenz.test/' });
  const { document } = dom.window;

  assert.equal(document.querySelectorAll('video').length, 0, 'the current winter hero should not require video playback');
  assert.ok(document.querySelector('.winter-scene'), 'the static winter scene should be present');

  dom.window.close();
});
