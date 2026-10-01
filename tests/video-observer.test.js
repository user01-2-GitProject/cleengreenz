import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const htmlTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

test('Mascot video playback via single IntersectionObserver', async (t) => {
  await t.test('uses a single IntersectionObserver instance to observe all video elements', async () => {
    const observerInstances = [];

    class MockIntersectionObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.observedElements = [];
        observerInstances.push(this);
      }
      observe(el) {
        this.observedElements.push(el);
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
        window.HTMLMediaElement.prototype.play = function() {
          this._customPlayed = true;
          return Promise.resolve();
        };
        window.HTMLMediaElement.prototype.pause = function() {
          this._customPaused = true;
        };
      },
    });

    const { document } = dom.window;
    const videos = document.querySelectorAll('video');
    assert.ok(videos.length > 1, 'multiple video elements exist on page');

    // Index 0 is section reveal observer, Index 1 is header nav observer, Index 2 is video observer
    assert.equal(observerInstances.length, 3, 'exactly 3 IntersectionObserver instances created overall');
    const videoObserver = observerInstances[2];
    assert.equal(videoObserver.observedElements.length, videos.length, 'videoObserver observes all videos using a single instance');

    // Verify video observer callback handles play/pause correctly for intersecting target
    const firstVideo = videos[0];
    videoObserver.callback([{ target: firstVideo, isIntersecting: true }]);
    assert.equal(firstVideo._customPlayed, true, 'plays video when intersecting');

    videoObserver.callback([{ target: firstVideo, isIntersecting: false }]);
    assert.equal(firstVideo._customPaused, true, 'pauses video when not intersecting');
  });
});
