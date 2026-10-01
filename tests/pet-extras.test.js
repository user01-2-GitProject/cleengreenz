import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

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

test('Pet Chris accessibility and Escape key handling in index.html', async (t) => {
  await t.test('places .pet-bubble after button.pet and dismisses bubble on Escape key', () => {
    const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      url: 'https://cleengreenz.com',
      beforeParse(window) {
        window.matchMedia = window.matchMedia || function () {
          return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
        };
        window.requestAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.pause = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
      }
    });
    try {
      const { document } = dom.window;

      const wrap = document.querySelector('.pet-wrap');
      assert.ok(wrap, '.pet-wrap should exist');

      const children = Array.from(wrap.children);
      const petBtnIndex = children.findIndex((el) => el.classList.contains('pet'));
      const bubbleIndex = children.findIndex((el) => el.classList.contains('pet-bubble'));

      assert.ok(petBtnIndex >= 0, 'button.pet should exist inside .pet-wrap');
      assert.ok(bubbleIndex >= 0, '.pet-bubble should exist inside .pet-wrap');
      assert.ok(
        bubbleIndex > petBtnIndex,
        '.pet-bubble should be after button.pet in DOM order for natural keyboard Tab navigation'
      );

      const pet = wrap.querySelector('.pet');
      pet.click(); pet.click(); pet.click();
      const bubble = wrap.querySelector('.pet-bubble');
      assert.equal(pet.getAttribute('aria-expanded'), 'true');
      const bubbleLink = bubble.querySelector('a');
      bubbleLink.focus();
      assert.equal(document.activeElement, bubbleLink);
      bubble.classList.add('is-visible');
      assert.equal(bubble.classList.contains('is-visible'), true);

      const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(escapeEvent);

      assert.equal(
        bubble.classList.contains('is-visible'),
        false,
        'Escape key press should dismiss the visible pet speech bubble'
      );
      assert.equal(document.activeElement, pet,
        'Escape from a bubble link should restore focus to the trigger');
      assert.equal(pet.getAttribute('aria-expanded'), 'false',
        'Escape must also reset the trigger expanded state');

      pet.click();
      const brand = document.querySelector('.brand');
      brand.focus();
      document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(document.activeElement, brand,
        'Escape must not steal focus from outside the bubble');
    } finally {
      dom.window.close();
    }
  });
});
