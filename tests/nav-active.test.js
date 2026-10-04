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

test('Pet Chris speech bubble accessibility attributes', async (t) => {
  await t.test('initializes .pet button with aria-controls and toggles aria-expanded on click', () => {
    class MockIntersectionObserver {
      observe() {}
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

    const { document, Event } = dom.window;
    const petBtn = document.querySelector('.pet');
    const petBubble = document.getElementById('pet-bubble');

    assert.ok(petBtn, '.pet button element should exist');
    assert.ok(petBubble, '#pet-bubble element should exist');
    assert.equal(petBtn.getAttribute('aria-controls'), 'pet-bubble');
    assert.equal(petBtn.getAttribute('aria-expanded'), 'false');

    // Simulate clicking Pet Chris via keyboard activation (detail: 0)
    petBtn.dispatchEvent(new dom.window.MouseEvent('click', { detail: 0, bubbles: true }));

    assert.equal(petBtn.getAttribute('aria-expanded'), 'true');
    assert.equal(petBubble.classList.contains('is-visible'), true);

    // Simulate clicking an action inside the speech bubble (e.g. data-pet-go link), which hides the bubble
    const goLink = document.createElement('a');
    goLink.setAttribute('data-pet-go', 'true');
    petBubble.appendChild(goLink);
    goLink.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    assert.equal(petBtn.getAttribute('aria-expanded'), 'false');
    assert.equal(petBubble.classList.contains('is-visible'), false);
  });
});

test('Section navigation scroll offset and call CTA accessibility attributes', async (t) => {
  await t.test('has tabindex="-1" on all section elements and aria-labels on call buttons', () => {
    class MockIntersectionObserver {
      observe() {}
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

    // Verify all target sections have tabindex="-1"
    const sectionIds = ['top', 'season', 'services', 'meet', 'how', 'area', 'faq', 'estimate'];
    sectionIds.forEach((id) => {
      const sec = document.getElementById(id);
      assert.ok(sec, `section #${id} exists`);
      assert.equal(sec.getAttribute('tabindex'), '-1', `section #${id} has tabindex="-1"`);
    });

    // Verify call CTA aria-labels
    const heroCallBtn = document.querySelector('.hero-actions a[href^="tel:"]');
    assert.ok(heroCallBtn, 'hero call CTA button exists');
    assert.equal(heroCallBtn.getAttribute('aria-label'), 'Call or text Chris at (269) 362-8286');

    const mobileCallBtn = document.querySelector('.mobile-bar a[href^="tel:"]');
    assert.ok(mobileCallBtn, 'mobile bar call CTA button exists');
    assert.equal(mobileCallBtn.getAttribute('aria-label'), 'Call Chris at (269) 362-8286');

    // Verify CSS contains section[id] scroll-margin-top
    assert.match(htmlTemplate, /section\[id\]\s*\{\s*scroll-margin-top:\s*84px;/);
  });
});
