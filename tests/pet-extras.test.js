import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

test('pet-extras setup DOM element caching', async (t) => {
  await t.test('caches wrap and bubble element references after initial lookup', () => {
    let documentQueryCount = 0;
    let wrapQueryCount = 0;

    const mockBubble = {
      textContent: '',
      classList: { add() {}, remove() {}, contains() { return false; } }
    };

    const mockWrap = {
      isConnected: true,
      classList: { contains() { return false; }, add() {}, remove() {} },
      style: { transform: 'translate3d(4px, 0px, 0px)' },
      querySelector(sel) {
        if (sel === '.pet-bubble') {
          wrapQueryCount++;
          return mockBubble;
        }
        return null;
      }
    };

    let setIntervalCb = null;
    const mockWindow = {
      matchMedia: () => ({ matches: false }),
      addEventListener: () => {},
      setInterval: (fn) => { setIntervalCb = fn; }
    };

    const mockDocument = {
      addEventListener: () => {},
      querySelector(sel) {
        if (sel === '.pet-wrap') {
          documentQueryCount++;
          return mockWrap;
        }
        return null;
      }
    };

    const scriptCode = fs.readFileSync(path.resolve('pet/pet-extras.js'), 'utf8');
    const context = vm.createContext({
      window: mockWindow,
      document: mockDocument,
      matchMedia: mockWindow.matchMedia,
      setInterval: mockWindow.setInterval,
      setTimeout: () => {},
      clearTimeout: () => {},
      clearInterval: () => {},
      Date,
      Math
    });

    vm.runInContext(scriptCode, context);

    assert.equal(typeof setIntervalCb, 'function');

    // Run tick multiple times
    setIntervalCb();
    setIntervalCb();
    setIntervalCb();

    // Querying should occur only on the first setup invocation
    assert.equal(documentQueryCount, 1);
    assert.equal(wrapQueryCount, 1);
  });
});
