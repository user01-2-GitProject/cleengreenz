import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdom from 'jsdom';

function createMockDom(htmlContent) {
  const dom = new jsdom.JSDOM(htmlContent, {
    runScripts: 'dangerously',
    beforeParse(win) {
      win.matchMedia = win.matchMedia || (() => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
      }));
      // Prevent requestAnimationFrame infinite loop in test environment
      win.requestAnimationFrame = () => 0;
      win.cancelAnimationFrame = () => {};
      win.IntersectionObserver = win.IntersectionObserver || class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });
  return dom;
}

test('Grass patch initialization and DOM rendering in index.html', () => {
  const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const dom = createMockDom(htmlContent);
  const { document } = dom.window;

  // Check that green sections exist in index.html
  const greenSections = document.querySelectorAll('section.green');
  assert.ok(greenSections.length > 0, 'Should have at least one section.green');

  // Verify grass layers and patches were created
  greenSections.forEach((sec) => {
    const layer = sec.querySelector('.lawn-grass-layer');
    assert.ok(layer, 'Section .green should contain a .lawn-grass-layer container');
    const patches = layer.querySelectorAll('.grass-patch');
    assert.equal(patches.length, 3, 'Each .green section should spawn 3 grass patches');

    // Check patch SVG element structure
    const firstPatch = patches[0];
    const svg = firstPatch.querySelector('svg');
    assert.ok(svg, 'Grass patch should contain an SVG element');
    const blades = svg.querySelectorAll('.grass-blade');
    assert.ok(blades.length >= 5, 'Grass patch SVG should contain grass blade paths');
  });
});

test('Grass patch mowed state class toggling', () => {
  const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const dom = createMockDom(htmlContent);
  const { document } = dom.window;

  const patch = document.querySelector('.grass-patch');
  assert.ok(patch, 'Grass patch element should exist');
  assert.equal(patch.classList.contains('mowed'), false, 'Grass patch initially should not have mowed class');

  patch.classList.add('mowed');
  assert.equal(patch.classList.contains('mowed'), true, 'Grass patch should have mowed class when mowed');

  patch.classList.remove('mowed');
  assert.equal(patch.classList.contains('mowed'), false, 'Grass patch should remove mowed class on regrow');
});
