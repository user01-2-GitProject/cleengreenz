## 2026-09-26 - Form Required Indicators & Disabled States
**Learning:** Bespoke HTML forms in static marketing sites often lack both `aria-required="true"` and visual required indicators on mandatory input labels, leaving screen reader and visual users unaware until submission errors occur. Additionally, custom `.btn` components require explicit `.btn:disabled` rules to suppress hover transforms, cursor pointer, and hover shadows while form handlers are in pending states.
**Action:** When working on form UX, pair `aria-required="true"` with visual indicator tags styled using primary contrast tokens (`var(--pumpkin-2)`), and ensure button CSS includes proper `:disabled` states.

## 2026-09-27 - Form Submission Focus Management & Loading Feedback
**Learning:** Hiding form field containers (`display: none`) upon successful async submit traps keyboard focus on the now-hidden submit button or resets focus to `<body>`, confusing screen reader users. Programmatically shifting focus to a heading with `tabindex="-1"` in the success view ensures immediate announcement and keyboard context continuity.
**Action:** When swapping form DOM views on submit, set `tabindex="-1"` on the success message heading and call `.focus()` alongside setting `aria-busy="true"` on the submit button.

## 2026-09-28 - Scoping Focus Outlines with :not(:focus-visible)
**Learning:** Unconditional `input:focus { outline: none; }` rules placed later in a stylesheet override earlier `:focus-visible` rules during keyboard navigation because both pseudo-classes match simultaneously. Scoping `outline: none` to `:focus:not(:focus-visible)` prevents mouse focus outlines without suppressing visible keyboard focus rings.
**Action:** When removing default focus outlines for mouse users, always scope `outline: none` with `:not(:focus-visible)` rather than un-scoped `:focus`.

## 2026-09-28 - Accessible Inline Form Validation with Novalidate
**Learning:** When using `novalidate` on HTML forms to override browser default tooltips, simply focusing an empty field with `aria-invalid="true"` leaves screen reader users and sighted users without clear visual error explanations. Programmatically toggling visible `.field-error` elements and dynamically associating them via `aria-describedby` when a required field fails validation provides accessible, unambiguous inline feedback.
**Action:** Always pair `aria-invalid="true"` with visible error elements linked via `aria-describedby`, and clear both on the `input` event when users edit the field.

## 2026-09-29 - Dynamic Navigation State with IntersectionObserver and aria-current
**Learning:** In single-page websites with in-page anchor links, users navigating by scrolling lack visual feedback and screen readers lack semantic context regarding which section is currently active. Using `IntersectionObserver` to track the visible page sections and dynamically setting `aria-current="true"` on matching navigation anchor links provides accessible context for screen readers and clean visual cues for sighted users.
**Action:** When adding scroll-based navigation feedback, map sections to header anchor links with `IntersectionObserver` and update `aria-current="true"` (or `aria-current="page"`).

## 2026-09-29 - Accessible Live Character Counters in Form Labels
**Learning:** For optional or constrained text inputs (like form notes textareas), users lack visual and screen-reader feedback about input bounds until server truncation occurs. Placing a live `aria-live="polite"` remaining count element inside the input `<label>` styled with secondary text tokens (`.opt`) provides real-time feedback that screen readers announce politely without adding extra form layout rows.
**Action:** When adding character limits to form inputs, set `maxlength` and pair with an inline `aria-live="polite"` span inside the label that updates on the `input` event.

## 2026-09-30 - Skip Link Focus Target & Dismissible Widget Focus Management
**Learning:** Target elements like `<main id="main">` for skip-to-content links require explicit `tabindex="-1"` and `main:focus { outline: none; }` to ensure browsers actually shift keyboard focus to the main container upon activation instead of retaining focus in the header navigation. Furthermore, when dismissible interactive widgets (like Pet Chris) remove their wrapper from the DOM, shifting focus to a logical persistent element (like `.brand`) prevents keyboard focus from becoming orphaned on `<body>`.
**Action:** Always set `tabindex="-1"` on skip link targets and manage focus transition before removing interactive elements from the DOM.
## 2026-09-30 - Interactive Popover Triggers and Global Button Focus Rings
**Learning:** Interactive floating mascot and popover trigger buttons lack popup state context for screen readers when `aria-expanded` and `aria-controls` are omitted. Dynamically toggling `aria-expanded="true"|"false"` on trigger buttons when associated speech bubbles open or close gives assistive technologies critical context. Additionally, scoping global focus ring rules to `button:focus-visible` ensures inline controls inside speech bubbles or popups inherit consistent high-contrast focus rings (`var(--gold)`) during keyboard navigation.
**Action:** Always link interactive popover triggers to controlled target containers using `aria-controls` and dynamically update `aria-expanded` on open/close events, while including `button:focus-visible` in global CSS focus ring rules.
