import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdom from 'jsdom';

const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');

function createHarness({ reducedMotion = false } = {}) {
  const frames = [];
  let clock = 1000;
  let mowerPlayCount = 0;
  const dom = new jsdom.JSDOM(htmlContent, {
    runScripts: 'dangerously',
    url: 'https://cleengreenz.test/',
    beforeParse(win) {
      Object.defineProperty(win, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(win, 'innerHeight', { configurable: true, value: 640 });
      Object.defineProperty(win.performance, 'now', { configurable: true, value: () => clock });
      win.matchMedia = () => ({
        matches: reducedMotion,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {}
      });
      win.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
      win.cancelAnimationFrame = () => {};
      win.HTMLElement.prototype.setPointerCapture = () => {};
      win.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      win.HTMLMediaElement.prototype.pause = () => {};
      win.HTMLMediaElement.prototype.play = function () {
        if (this.classList.contains('grass-mower-video')) mowerPlayCount++;
        return Promise.resolve();
      };
    }
  });

  const { window } = dom;
  const patches = [...window.document.querySelectorAll('.grass-patch')];
  const patchRects = new Map();
  const readCounts = new Map();
  patches.forEach((patch, index) => {
    const rect = index === 0
      ? { left: 400, top: 300, right: 464, bottom: 344, width: 64, height: 44 }
      : { left: 400, top: 700, right: 464, bottom: 744, width: 64, height: 44 };
    patchRects.set(patch, rect);
    readCounts.set(patch, 0);
    patch.getBoundingClientRect = () => {
      readCounts.set(patch, readCounts.get(patch) + 1);
      return { ...patchRects.get(patch) };
    };
  });

  function tick(ms = 50) {
    clock += ms;
    const pending = frames.splice(0);
    assert.ok(pending.length, 'the page controller should have a queued animation frame');
    pending.forEach(callback => callback(clock));
  }

  function advance(count, ms = 50) {
    for (let i = 0; i < count; i++) tick(ms);
  }

  function advanceUntil(predicate, limit = 400) {
    for (let i = 0; i < limit && !predicate(); i++) tick();
    return predicate();
  }

  function setRect(patch, rect, notifyScroll = true) {
    patchRects.set(patch, rect);
    if (notifyScroll) window.dispatchEvent(new window.Event('scroll'));
  }

  return { dom, window, patches, readCounts, setRect, tick, advance, advanceUntil, mowerPlayCount: () => mowerPlayCount };
}

function visibleRect(top = 300) {
  return { left: 400, top, right: 464, bottom: top + 44, width: 64, height: 44 };
}

test('grass layers and patches initialize inside each green section', () => {
  const { dom, window } = createHarness();
  const greenSections = window.document.querySelectorAll('section.green');
  assert.ok(greenSections.length > 0, 'the page should contain lawn sections');
  greenSections.forEach(section => {
    const layer = section.querySelector('.lawn-grass-layer');
    assert.ok(layer, 'each lawn section should contain a grass layer');
    assert.equal(layer.querySelectorAll('.grass-patch').length, 3);
    assert.ok(layer.querySelector('.grass-patch svg .grass-blade'));
  });
  dom.window.close();
});

test('the live pet controller trims an in-view patch and reuses cached geometry between scrolls', () => {
  const h = createHarness();
  const target = h.patches[0];
  const pet = h.window.document.querySelector('.pet-wrap');

  assert.ok(h.advanceUntil(() => target.classList.contains('mowed')), 'Pet Chris should reach and trim the visible patch');
  assert.equal(h.readCounts.get(target), 1, 'the patch rectangle should be read once during initial cache fill');
  assert.equal(pet.style.getPropertyValue('--x'), '346px', 'Pet Chris should walk to the patch');
  assert.equal(pet.style.getPropertyValue('--y'), '148px', 'Pet Chris should align with the patch before trimming');
  assert.equal(h.mowerPlayCount(), 1, 'the mower video should play when the grass action starts');
  assert.ok(target.classList.contains('mowing'));
  assert.ok(pet.classList.contains('mowing'), 'the blower-pose sprite should be hidden during the mower scene');
  assert.equal(target.querySelector('.grass-mower-video source').getAttribute('src'), 'media/mascot-mower.mp4');
  h.advance(20);
  assert.equal(h.readCounts.get(target), 1, 'animation frames should not read patch layout again');
  assert.equal(target.classList.contains('mowing'), false, 'the mower scene should end with the trim action');
  h.dom.window.close();
});

test('dragging Pet Chris interrupts the mower cutaway and restores the grass patch', () => {
  const h = createHarness();
  const target = h.patches[0];
  const pet = h.window.document.querySelector('.pet');
  const wrap = h.window.document.querySelector('.pet-wrap');
  assert.ok(h.advanceUntil(() => target.classList.contains('mowed')), 'the mowing action should start');
  const sendPointer = (type, x, y) => {
    const event = new h.window.Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerId: { value: 1 },
      clientX: { value: x },
      clientY: { value: y }
    });
    pet.dispatchEvent(event);
  };

  sendPointer('pointerdown', 360, 200);
  sendPointer('pointermove', 380, 220);

  assert.equal(target.classList.contains('mowing'), false, 'the interrupted patch should restore its grass art');
  assert.equal(h.window.document.querySelector('.grass-mower-video').parentElement, h.window.document.body,
    'the mower video should be detached from the patch after interruption');
  h.tick();
  assert.equal(wrap.classList.contains('mowing'), false, 'the Pet should leave the mowing presentation when dragged');
  h.dom.window.close();
});

test('the waiting pet follows a still-visible grass target after scroll and returns home when it leaves view', () => {
  const h = createHarness();
  const target = h.patches[0];
  const pet = h.window.document.querySelector('.pet-wrap');
  assert.ok(h.advanceUntil(() => target.classList.contains('mowed')), 'the test should reach the grass interaction');
  assert.ok(h.advanceUntil(() => !pet.classList.contains('clearing') && target.classList.contains('mowed')),
    'the pet should enter its post-trim wait state');

  h.setRect(target, visibleRect(390));
  h.tick();
  assert.equal(pet.style.getPropertyValue('--y'), '238px', 'waiting position should follow the patch’s cached post-scroll bounds');
  assert.equal(h.readCounts.get(target), 2, 'one scroll should cause one new geometry read');

  h.setRect(target, { left: 400, top: 700, right: 464, bottom: 744, width: 64, height: 44 });
  h.tick();
  h.advance(250);
  assert.equal(pet.style.getPropertyValue('--y'), '430px', 'the pet should finish returning to the fixed home position');
  assert.equal(h.readCounts.get(target), 3, 'later animation frames should still use the cache');
  h.dom.window.close();
});

test('a target that scrolls offscreen during the clear action is not mowed', () => {
  const h = createHarness();
  const target = h.patches[0];
  const pet = h.window.document.querySelector('.pet-wrap');
  assert.ok(h.advanceUntil(() => pet.classList.contains('clearing'), 240), 'the pet should reach the clear action');
  assert.equal(target.classList.contains('mowed'), false, 'clearing begins before its trim point');

  h.setRect(target, { left: 400, top: -80, right: 464, bottom: -36, width: 64, height: 44 });
  h.tick();
  h.advance(40);
  assert.equal(target.classList.contains('mowed'), false, 'the clear action must cancel once its target leaves the viewport');
  h.dom.window.close();
});

test('offscreen patches are not selected for trimming', () => {
  const h = createHarness();
  h.patches.forEach(patch => h.setRect(patch, { left: 400, top: 700, right: 464, bottom: 744, width: 64, height: 44 }, false));
  h.window.dispatchEvent(new h.window.Event('scroll'));
  h.advance(260);
  assert.ok(h.patches.every(patch => !patch.classList.contains('mowed')));
  h.dom.window.close();
});

test('reduced motion keeps grass static and disables automatic trimming', () => {
  const h = createHarness({ reducedMotion: true });
  h.advance(240);
  assert.ok(h.patches.every(patch => !patch.classList.contains('mowed')));
  assert.equal(h.window.document.querySelector('.leaf-layer'), null);
  assert.equal(h.window.document.querySelector('.grass-mower-video'), null, 'reduced-motion pages should not create or load the mower clip');
  assert.equal(h.mowerPlayCount(), 0);
  const mediaStart = htmlContent.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  const reducedMotionRules = htmlContent.slice(mediaStart);
  assert.match(reducedMotionRules, /\.grass-blade\s*\{\s*animation:\s*none;/);
  assert.match(reducedMotionRules, /\.grass-patch\s*\{\s*transition:\s*none;/);
  h.dom.window.close();
});
