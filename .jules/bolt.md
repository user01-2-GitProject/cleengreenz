## 2026-09-26 - Avoid layout thrashing from getBoundingClientRect in requestAnimationFrame

**Learning:** Invoking `getBoundingClientRect()` inside a `requestAnimationFrame` loop on every frame forces synchronous layout recalculation/reflow (layout thrashing), especially when DOM style changes or transforms are applied in the same loop. Caching element bounding rectangles and invalidating them on `scroll`, `resize`, or when layout changes occur avoids unnecessary reflows and improves frame consistency and CPU/battery efficiency.

**Action:** Always cache layout measurements (`getBoundingClientRect`, `offsetHeight`, `offsetTop`) outside the main animation loop and invalidate/update the cache only when scrolling, resizing, or when explicit DOM layout shifts happen.

## 2026-09-26 - Reuse single IntersectionObserver instance across multiple DOM elements

**Learning:** Instantiating `new IntersectionObserver()` inside a loop for each DOM element (e.g., `<video>`) creates unnecessary observer instances and increases GC and layout calculation overhead. Instantiating a single `IntersectionObserver` instance and observing multiple elements using `en.target` in the callback eliminates redundant observer allocations.

**Action:** Whenever multiple DOM elements share the same intersection callback logic, instantiate a single `IntersectionObserver` and pass each element to `observer.observe(el)`.
## 2026-09-27 - Cache Map lookups outside array iteration loops

**Learning:** In animation frame handlers and leaf/particle processing functions, repeatedly querying Map instances (e.g. `rects.get(host)`) inside a loop over array elements creates unnecessary hash table lookup overhead. Caching the lookup result in a local variable outside the loop reduces lookups from 2N to 1.

**Action:** Always hoist repeated `Map.get()` or object property lookups outside `forEach` or `for` loops when the key is invariant across iterations.

## 2026-09-28 - Micro-optimizations on cold event paths without measurable impact are rejected

**Learning:** Caching DOM query lookups on infrequent event paths (like single-shot form submission/reset handlers) provides no measurable frame rate or latency improvement and adds maintenance overhead.

**Action:** Focus performance optimizations on hot paths (animation frame loops, scroll/resize handlers, large list processing) where DOM or calculation overhead directly impacts measurable performance.
