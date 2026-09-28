import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('Active navigation highlighting via IntersectionObserver', async (t) => {
  await t.test('updates aria-current="true" on header nav links when sections intersect', async () => {
    const observerCallbacks = [];

    class MockIntersectionObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        observerCallbacks.push(callback);
      }
      observe(el) {
        this.observedElement = el;
      }
      unobserve() {}
      disconnect() {}
    }

    const dom = new JSDOM(htmlTemplate, {
      runScripts: 'dangerously',
      resources: 'usable',
      beforeParse(window) {
        window.IntersectionObserver = MockIntersectionObserver;
        window.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        window.HTMLMediaElement.prototype.play = () => Promise.resolve();
        window.HTMLMediaElement.prototype.pause = () => {};
      },
    });

    const { document } = dom.window;
    const seasonLink = document.querySelector('.nav-links a[href="#season"]');
    const servicesLink = document.querySelector('.nav-links a[href="#services"]');
    const seasonSec = document.getElementById('season');
    const servicesSec = document.getElementById('services');

    assert.ok(seasonLink, 'season nav link exists');
    assert.ok(servicesLink, 'services nav link exists');
    assert.ok(seasonSec, 'season section exists');
    assert.ok(servicesSec, 'services section exists');
    assert.equal(seasonLink.getAttribute('aria-current'), null, 'no active nav link initially');

    assert.ok(observerCallbacks.length > 0, 'IntersectionObserver callback was registered');
    // Nav observer is the second IntersectionObserver instantiated in script (reveal observer is first, video observer is third)
    const navObserverCallback = observerCallbacks[1];
    assert.ok(navObserverCallback, 'nav observer callback found');

    // Simulate season section scrolling into view
    navObserverCallback([
      { target: seasonSec, isIntersecting: true },
    ]);

    assert.equal(seasonLink.getAttribute('aria-current'), 'true', 'season link gains aria-current="true"');
    assert.equal(servicesLink.getAttribute('aria-current'), null, 'services link remains without aria-current');

    // Simulate scrolling down to services section
    navObserverCallback([
      { target: seasonSec, isIntersecting: false },
      { target: servicesSec, isIntersecting: true },
    ]);

    assert.equal(seasonLink.getAttribute('aria-current'), null, 'season link loses aria-current');
    assert.equal(servicesLink.getAttribute('aria-current'), 'true', 'services link gains aria-current="true"');
  });
});
