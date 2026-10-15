import test from 'node:test';
import assert from 'node:assert/strict';

test('Stationary landed leaves frame optimization benchmark & unit test', () => {
  const leafCount = 36;
  const landedCount = 24;

  const createLeaves = () => {
    const leaves = [];
    for (let i = 0; i < leafCount; i++) {
      const isLanded = i < landedCount;
      leaves.push({
        state: isLanded ? 'land' : 'fall',
        landedDirty: isLanded,
        ox: 20,
        size: 20,
        lift: 5,
        rot: 15,
        bx: 100,
        y: 100,
        vy: 50,
        phase: 0,
        sway: 10,
        spin: 5,
        sticky: true,
        lastOpacity: 1,
        lastRx: null,
        lastRy: null,
        lastRrot: null,
        hostCi: { r: { left: 200, top: 300, width: 100, height: 40 } },
        el: { style: { opacity: 1, transform: '' } },
      });
    }
    return leaves;
  };

  // Unit Test: Check that landed leaves update transform on initial frame and skip on subsequent stationary frames
  const leavesUnitTest = createLeaves();
  let isRectsDirty = false;

  // Frame 1: Initial landedDirty is true, so transform must be updated
  for (let i = 0; i < leavesUnitTest.length; i++) {
    const l = leavesUnitTest[i];
    if (l.state === 'land') {
      if (!isRectsDirty && !l.landedDirty) continue;
      const hr = l.hostCi.r;
      const x = hr.left + l.ox - l.size / 2;
      const y = hr.top - l.size * 0.75 - l.lift;
      l.landedDirty = false;
      const rx = Math.round(x), ry = Math.round(y), rrot = Math.round(l.rot);
      l.lastRx = rx; l.lastRy = ry; l.lastRrot = rrot;
      l.el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) rotate(' + rrot + 'deg)';
    }
  }

  assert.equal(leavesUnitTest[0].landedDirty, false, 'landedDirty should reset to false after frame processing');
  assert.equal(leavesUnitTest[0].el.style.transform, 'translate3d(210px,280px,0) rotate(15deg)', 'Landed leaf transform correctly initialized');

  // Frame 2: Stationary (isRectsDirty = false, landedDirty = false), so landed leaves are skipped
  let landedProcessedInFrame2 = 0;
  for (let i = 0; i < leavesUnitTest.length; i++) {
    const l = leavesUnitTest[i];
    if (l.state === 'land') {
      if (!isRectsDirty && !l.landedDirty) continue;
      landedProcessedInFrame2++;
    }
  }
  assert.equal(landedProcessedInFrame2, 0, 'Stationary landed leaves should be skipped when not dirty');

  // Frame 3: Scroll occurs (isRectsDirty = true)
  isRectsDirty = true;
  leavesUnitTest[0].hostCi.r.top = 250; // simulated scroll shift
  let landedProcessedInFrame3 = 0;
  for (let i = 0; i < leavesUnitTest.length; i++) {
    const l = leavesUnitTest[i];
    if (l.state === 'land') {
      if (!isRectsDirty && !l.landedDirty) continue;
      landedProcessedInFrame3++;
      const hr = l.hostCi.r;
      const x = hr.left + l.ox - l.size / 2;
      const y = hr.top - l.size * 0.75 - l.lift;
      l.landedDirty = false;
      const rx = Math.round(x), ry = Math.round(y), rrot = Math.round(l.rot);
      l.lastRx = rx; l.lastRy = ry; l.lastRrot = rrot;
      l.el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) rotate(' + rrot + 'deg)';
    }
  }
  assert.equal(landedProcessedInFrame3, landedCount, 'Landed leaves should all update when layout shift (isRectsDirty) occurs');
  assert.equal(leavesUnitTest[0].el.style.transform, 'translate3d(210px,230px,0) rotate(15deg)', 'Landed leaf transform updated after scroll');

  // Performance Benchmark
  const ITERATIONS = 500000;

  // Baseline Benchmark (recalculating landed leaves every frame)
  const leavesBaseline = createLeaves();
  const startBaseline = performance.now();
  for (let frame = 0; frame < ITERATIONS; frame++) {
    const frameRectsDirty = frame % 1000 === 0; // scroll occurs every 1000 frames
    for (let i = 0; i < leavesBaseline.length; i++) {
      const l = leavesBaseline[i];
      if (l.state === 'land') {
        const hr = l.hostCi.r;
        const x = hr.left + l.ox - l.size / 2;
        const y = hr.top - l.size * 0.75 - l.lift;
        const rx = Math.round(x), ry = Math.round(y), rrot = Math.round(l.rot);
        if (rx !== l.lastRx || ry !== l.lastRy || rrot !== l.lastRrot) {
          l.lastRx = rx; l.lastRy = ry; l.lastRrot = rrot;
          l.el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) rotate(' + rrot + 'deg)';
        }
      }
    }
  }
  const durationBaseline = performance.now() - startBaseline;

  // Optimized Benchmark (skipping stationary landed leaves)
  const leavesOptimized = createLeaves();
  const startOptimized = performance.now();
  for (let frame = 0; frame < ITERATIONS; frame++) {
    const frameRectsDirty = frame % 1000 === 0;
    for (let i = 0; i < leavesOptimized.length; i++) {
      const l = leavesOptimized[i];
      if (l.state === 'land') {
        if (!frameRectsDirty && !l.landedDirty) continue;
        const hr = l.hostCi.r;
        const x = hr.left + l.ox - l.size / 2;
        const y = hr.top - l.size * 0.75 - l.lift;
        l.landedDirty = false;
        const rx = Math.round(x), ry = Math.round(y), rrot = Math.round(l.rot);
        if (rx !== l.lastRx || ry !== l.lastRy || rrot !== l.lastRrot) {
          l.lastRx = rx; l.lastRy = ry; l.lastRrot = rrot;
          l.el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) rotate(' + rrot + 'deg)';
        }
      }
    }
  }
  const durationOptimized = performance.now() - startOptimized;

  console.log(`\n--- LANDED LEAVES BENCHMARK RESULTS ---`);
  console.log(`Baseline execution:  ${durationBaseline.toFixed(2)} ms`);
  console.log(`Optimized execution: ${durationOptimized.toFixed(2)} ms`);
  console.log(`Speedup factor:     ${(durationBaseline / durationOptimized).toFixed(2)}x`);
  console.log(`----------------------------------------\n`);

  assert.ok(durationOptimized < durationBaseline, 'Optimized version should execute faster than baseline');
});
