## 2026-09-26 - Avoid layout thrashing from getBoundingClientRect in requestAnimationFrame

**Learning:** Invoking `getBoundingClientRect()` inside a `requestAnimationFrame` loop on every frame forces synchronous layout recalculation/reflow (layout thrashing), especially when DOM style changes or transforms are applied in the same loop. Caching element bounding rectangles and invalidating them on `scroll`, `resize`, or when layout changes occur avoids unnecessary reflows and improves frame consistency and CPU/battery efficiency.

**Action:** Always cache layout measurements (`getBoundingClientRect`, `offsetHeight`, `offsetTop`) outside the main animation loop and invalidate/update the cache only when scrolling, resizing, or when explicit DOM layout shifts happen.

## 2026-09-26 - Reuse single IntersectionObserver instance across multiple DOM elements

**Learning:** Instantiating `new IntersectionObserver()` inside a loop for each DOM element (e.g., `<video>`) creates unnecessary observer instances and increases GC and layout calculation overhead. Instantiating a single `IntersectionObserver` instance and observing multiple elements using `en.target` in the callback eliminates redundant observer allocations.

**Action:** Whenever multiple DOM elements share the same intersection callback logic, instantiate a single `IntersectionObserver` and pass each element to `observer.observe(el)`.
## 2026-09-27 - Cache Map lookups outside array iteration loops

**Learning:** In animation frame handlers and leaf/particle processing functions, repeatedly querying Map instances (e.g. `rects.get(host)`) inside a loop over array elements creates unnecessary hash table lookup overhead. Caching the lookup result in a local variable outside the loop reduces lookups from 2N to 1.

**Action:** Always hoist repeated `Map.get()` or object property lookups outside `forEach` or `for` loops when the key is invariant across iterations.

## 2026-09-28 - Inspect CSS custom properties directly instead of regex on style.transform

**Learning:** When DOM element position is updated via CSS custom properties (e.g., `wrap.style.setProperty('--x', ...)` with CSS `transform: translate3d(var(--x), ...)`), reading `wrap.style.transform` returns an empty string, causing regex matching on `style.transform` to fail and waste CPU cycles during periodic polling or animation ticks. Querying `wrap.style.getPropertyValue('--x')` directly is fast, accurate, and avoids failed regex executions.

**Action:** Always inspect CSS custom properties directly via `style.getPropertyValue()` when element state/transforms are driven by custom properties rather than string parsing `style.transform`.

## 2026-09-29 - Clear cached pile arrays in-place to preserve object reference equality

**Learning:** Reassigning an array property on a cached container object (e.g., `ci.pile = []`) breaks reference equality with existing collections referencing that same array instance (e.g., `piles.get(el)`). Clearing the array in-place via `pile.length = 0` maintains reference identity across all references and avoids state desynchronization without allocation overhead.

**Action:** When caching object references across data structures, always mutate array state in-place (`array.length = 0`) instead of reassigning new array literals.
