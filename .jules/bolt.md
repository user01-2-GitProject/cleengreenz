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

## 2026-09-29 - Reset arrays in-place with length = 0 to avoid breaking references and GC pressure

**Learning:** Reassigning a Map value to a new array (`map.set(key, [])`) creates garbage collector churn in animation loops and breaks any cached references holding onto the original array. Clearing the array in-place (`pile.length = 0`) preserves object references and eliminates array re-allocation overhead.

**Action:** Always clear arrays in-place (`array.length = 0`) when clearing collections in hot paths or animation frame loops.

## 2026-09-30 - Store cached bounding rects and arrays directly on item objects instead of Map instances

**Learning:** Using `Map` instances (`rects.get(el)`, `piles.get(el)`) to associate DOM elements with cached bounding rectangles or child arrays in high-frequency `requestAnimationFrame` loops introduces hash table lookup overhead on every frame render. Storing `.r` and `.pile` properties directly on item wrapper objects (`catcherItem`, `grassPatch`) allows O(1) direct property reads and eliminates `Map` allocations and lookups entirely.

**Action:** Store cached layout measurements and child collection arrays directly on item wrapper objects rather than maintaining auxiliary `Map` instances for lookups in 60fps animation frame loops.
