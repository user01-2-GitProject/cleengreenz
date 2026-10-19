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

## 2026-09-30 - Prefer direct property references over Map lookups on wrapper objects

**Learning:** When data structures store references to target objects (such as `catcherItem` or `grassPatch`), retrieving properties directly from the object (e.g. `p.target.pile` or `gp.r`) is faster than querying a `Map` (e.g. `piles.get(target)` or `rects.get(gp.el)`). It also avoids runtime errors when the target object type differs from the `Map` key type.

**Action:** Store direct references to cached metadata/collections on the parent object where possible to eliminate `Map.get()` overhead in high-frequency animation loops.

## 2026-10-01 - Replace Map instances with direct object properties and indexed loops in animation frame rect updates

**Learning:** Using `Map` instances (`rects`, `piles`) to map DOM elements to cached metadata forces hash lookups on every animation frame and event handler. Furthermore, using `.forEach()` inside `requestAnimationFrame` or `scroll` invalidation blocks allocates unnecessary closure callbacks on every invocation. Replacing `Map` instances with direct property storage on item wrappers (`ci.r`, `ci.pile`) and using indexed `for` loops eliminates garbage collection pressure and hash table overhead completely.

**Action:** Store metadata directly on item objects instead of parallel `Map` collections, and use indexed `for` loops rather than `.forEach()` in high-frequency animation and DOM update paths.

## 2026-10-02 - Avoid micro-optimizing low-frequency event handlers like IntersectionObserver

**Learning:** Optimizing low-frequency event handlers (e.g. `IntersectionObserver` callbacks for 4 navigation links) by replacing clean `Map`/`Set` structures with custom properties attached to DOM elements (`sec._navLink`) and replacing `.forEach` with indexed `for` loops is a micro-optimization with zero measurable impact. It pollutes DOM objects, degrades code readability, and adds maintenance complexity without real performance benefits.

**Action:** Focus performance optimizations strictly on hot paths (e.g. `requestAnimationFrame` loops, scroll/resize handlers, high-volume DOM rendering). Never compromise code readability or pollute DOM instances for low-frequency events.
