import test from 'node:test';
import assert from 'node:assert/strict';

test('Leaf transform performance benchmark', () => {
  const count = 36;
  const leavesBaseline = [];
  const leavesOptimized = [];

  for (let i = 0; i < count; i++) {
    const leaf = {
      x: Math.random() * 1000,
      y: Math.random() * 800,
      rot: Math.random() * 360,
      lastTransform: '',
      lastRx: null,
      lastRy: null,
      lastRrot: null,
      el: { style: { transform: '' } },
    };
    leavesBaseline.push({ ...leaf, el: { style: { transform: '' } } });
    leavesOptimized.push({ ...leaf, el: { style: { transform: '' } } });
  }

  const iterations = 1000000;

  // Baseline execution
  const startBaseline = performance.now();
  for (let frame = 0; frame < iterations; frame++) {
    for (let i = 0; i < leavesBaseline.length; i++) {
      const l = leavesBaseline[i];
      // Simulate frame-by-frame slight position updates (some leaves landed, some moving)
      const x = l.x + (frame % 2 === 0 ? 0.05 : 0);
      const y = l.y + (frame % 2 === 0 ? 0.05 : 0);
      const rot = l.rot + (frame % 2 === 0 ? 0.1 : 0);

      var transformStr = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0) rotate(' + Math.round(rot) + 'deg)';
      if (l.lastTransform !== transformStr) {
        l.el.style.transform = transformStr;
        l.lastTransform = transformStr;
      }
    }
  }
  const durationBaseline = performance.now() - startBaseline;

  // Optimized execution
  const startOptimized = performance.now();
  for (let frame = 0; frame < iterations; frame++) {
    for (let i = 0; i < leavesOptimized.length; i++) {
      const l = leavesOptimized[i];
      const x = l.x + (frame % 2 === 0 ? 0.05 : 0);
      const y = l.y + (frame % 2 === 0 ? 0.05 : 0);
      const rot = l.rot + (frame % 2 === 0 ? 0.1 : 0);

      var rx = Math.round(x), ry = Math.round(y), rrot = Math.round(rot);
      if (rx !== l.lastRx || ry !== l.lastRy || rrot !== l.lastRrot) {
        l.lastRx = rx; l.lastRy = ry; l.lastRrot = rrot;
        l.el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) rotate(' + rrot + 'deg)';
      }
    }
  }
  const durationOptimized = performance.now() - startOptimized;

  console.log(`\n--- BENCHMARK RESULTS ---`);
  console.log(`Baseline execution:  ${durationBaseline.toFixed(2)} ms`);
  console.log(`Optimized execution: ${durationOptimized.toFixed(2)} ms`);
  console.log(`Speedup factor:     ${(durationBaseline / durationOptimized).toFixed(2)}x`);
  console.log(`-------------------------\n`);

  assert.ok(durationOptimized < durationBaseline, 'Optimized version should be faster than baseline');
});

test('Catcher and grass patch Map lookup vs direct property caching benchmark', () => {
  const catchers = [];
  const catcherItemsBaseline = [];
  const catcherItemsOptimized = [];
  const pilesMap = new Map();
  const rectsMap = new Map();

  for (let i = 0; i < 10; i++) {
    const el = { id: 'btn-' + i };
    catchers.push(el);
    const rect = { left: 100 * i, top: 200, width: 120, height: 40 };
    pilesMap.set(el, []);
    rectsMap.set(el, rect);

    catcherItemsBaseline.push({ el, top: 200, topMax: 210, leftMin: 100 * i - 18, rightMax: 100 * i + 138 });
    catcherItemsOptimized.push({ el, pile: [], r: rect, top: 200, topMax: 210, leftMin: 100 * i - 18, rightMax: 100 * i + 138 });
  }

  const iterations = 5000000;

  // Baseline: querying Map.get() and forEach inside frame processing
  const startBaseline = performance.now();
  let baselineChecksum = 0;
  for (let frame = 0; frame < iterations; frame++) {
    catchers.forEach((el) => {
      const pile = pilesMap.get(el);
      const r = rectsMap.get(el);
      if (r && pile) {
        baselineChecksum += r.top + pile.length;
      }
    });
  }
  const durationBaseline = performance.now() - startBaseline;

  // Optimized: direct property access (ci.pile, ci.r) and standard for loop
  const startOptimized = performance.now();
  let optimizedChecksum = 0;
  for (let frame = 0; frame < iterations; frame++) {
    for (let i = 0; i < catcherItemsOptimized.length; i++) {
      const ci = catcherItemsOptimized[i];
      const pile = ci.pile;
      const r = ci.r;
      if (r && pile) {
        optimizedChecksum += r.top + pile.length;
      }
    }
  }
  const durationOptimized = performance.now() - startOptimized;

  console.log(`\n--- MAP LOOKUP VS DIRECT PROPERTY BENCHMARK ---`);
  console.log(`Baseline Map.get() + forEach: ${durationBaseline.toFixed(2)} ms`);
  console.log(`Optimized direct ci.r + for:  ${durationOptimized.toFixed(2)} ms`);
  console.log(`Speedup factor:                ${(durationBaseline / durationOptimized).toFixed(2)}x`);
  console.log(`-----------------------------------------------\n`);

  assert.equal(baselineChecksum, optimizedChecksum);
  assert.ok(durationOptimized < durationBaseline, 'Direct property access should be faster than Map.get() + forEach');
});
