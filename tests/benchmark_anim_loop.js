import test from 'node:test';
import assert from 'node:assert/strict';

test('Animation loop property access benchmark', () => {
  const catcherCount = 10;
  const leavesCount = 20;

  // Mock DOM elements and data structures
  const catchers = [];
  const pilesMap = new Map();
  const rectsMap = new Map();
  const catcherItems = [];
  const leavesBaseline = [];
  const leavesOptimized = [];

  for (let i = 0; i < catcherCount; i++) {
    const el = { id: `btn-${i}` };
    const rect = { left: 100 * i, top: 200, width: 120, height: 40, bottom: 240 };
    const pile = [{ size: 20, ox: 10, lift: 5 }];

    catchers.push(el);
    pilesMap.set(el, pile);
    rectsMap.set(el, rect);

    const ci = { el, pile, r: rect, top: rect.top, topMax: rect.top + 10, leftMin: rect.left - 18, rightMax: rect.right + 18 };
    catcherItems.push(ci);
  }

  for (let i = 0; i < leavesCount; i++) {
    const hostEl = catchers[i % catcherCount];
    const ci = catcherItems[i % catcherCount];
    leavesBaseline.push({ host: hostEl, ox: 10, size: 20, lift: 5, lastOpacity: 1 });
    leavesOptimized.push({ host: hostEl, ci, ox: 10, size: 20, lift: 5, lastOpacity: 1 });
  }

  function visible(r) {
    return r && r.width > 0 && r.top > 90 && r.bottom < 800;
  }

  const iterations = 1000000;

  // Baseline execution (Map lookups + forEach closure)
  const startBaseline = performance.now();
  for (let frame = 0; frame < iterations; frame++) {
    // 1. readyPile baseline
    let chosenBase = null, biggestBase = 5;
    catchers.forEach((el) => {
      const count = pilesMap.get(el).length;
      if (count > biggestBase && visible(rectsMap.get(el))) {
        chosenBase = el;
        biggestBase = count;
      }
    });

    // 2. Landed leaves position update baseline
    for (let i = 0; i < leavesBaseline.length; i++) {
      const l = leavesBaseline[i];
      const hr = rectsMap.get(l.host);
      if (hr) {
        const x = hr.left + l.ox - l.size / 2;
        const y = hr.top - l.size * 0.75 - l.lift;
      }
    }
  }
  const durationBaseline = performance.now() - startBaseline;

  // Optimized execution (Direct property access + for loop)
  const startOptimized = performance.now();
  for (let frame = 0; frame < iterations; frame++) {
    // 1. readyPile optimized
    let chosenOpt = null, biggestOpt = 5;
    for (let i = 0; i < catcherItems.length; i++) {
      const ci = catcherItems[i];
      const count = ci.pile.length;
      if (count > biggestOpt && visible(ci.r)) {
        chosenOpt = ci;
        biggestOpt = count;
      }
    }

    // 2. Landed leaves position update optimized
    for (let i = 0; i < leavesOptimized.length; i++) {
      const l = leavesOptimized[i];
      const hr = l.ci.r;
      if (hr) {
        const x = hr.left + l.ox - l.size / 2;
        const y = hr.top - l.size * 0.75 - l.lift;
      }
    }
  }
  const durationOptimized = performance.now() - startOptimized;

  const speedup = ((durationBaseline - durationOptimized) / durationBaseline * 100).toFixed(1);

  console.log(`\n--- ANIMATION LOOP BENCHMARK RESULTS ---`);
  console.log(`Baseline execution (Map lookups + closures):   ${durationBaseline.toFixed(2)} ms`);
  console.log(`Optimized execution (Direct property access): ${durationOptimized.toFixed(2)} ms`);
  console.log(`Improvement: ${speedup}% faster (${(durationBaseline / durationOptimized).toFixed(2)}x speedup)`);
  console.log(`-----------------------------------------\n`);

  assert.ok(durationOptimized < durationBaseline, 'Optimized version should be faster than baseline');
});
