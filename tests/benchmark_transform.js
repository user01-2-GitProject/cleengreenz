import { performance } from 'node:perf_hooks';

function createMockElement() {
  const styleObj = {
    _properties: {},
    transform: '',
    setProperty(name, value) {
      this._properties[name] = value;
    }
  };
  return { style: styleObj };
}

function runBenchmark() {
  const ITERATIONS = 1000000;

  // Generate realistic animation frame data for Chris moving/walking/idle across screen
  const frames = [];
  let x = 4, y = 500;
  for (let i = 0; i < ITERATIONS; i++) {
    const phase = i % 100;
    if (phase < 70) {
      x += 0.5; // horizontal walking
    } else if (phase < 90) {
      // idle (x & y unchanged)
    } else {
      x += 1;
      y += (i % 2 === 0 ? 2 : -2); // jumping / tossing
    }
    frames.push({ x, y });
  }

  // 1. Baseline: repeated string concatenation on style.transform
  const wrapBaseline = createMockElement();
  const startBaseline = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const p = frames[i];
    wrapBaseline.style.transform = 'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0)';
  }
  const baselineTime = performance.now() - startBaseline;

  // 2. Optimized: CSS variables with integer coordinate change check
  const wrapOptimized = createMockElement();
  let lastRx = null, lastRy = null;
  const startOptimized = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    const p = frames[i];
    const rx = Math.round(p.x), ry = Math.round(p.y);
    if (rx !== lastRx) {
      wrapOptimized.style.setProperty('--x', rx + 'px');
      lastRx = rx;
    }
    if (ry !== lastRy) {
      wrapOptimized.style.setProperty('--y', ry + 'px');
      lastRy = ry;
    }
  }
  const optimizedTime = performance.now() - startOptimized;

  const speedup = ((baselineTime - optimizedTime) / baselineTime * 100).toFixed(1);

  console.log(`Baseline (String concatenation every frame): ${baselineTime.toFixed(2)} ms`);
  console.log(`Optimized (CSS variables + integer coordinate check): ${optimizedTime.toFixed(2)} ms`);
  console.log(`Improvement: ${speedup}% faster`);
}

runBenchmark();
