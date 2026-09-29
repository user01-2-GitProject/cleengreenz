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

## 2026-09-29 - Popover Bubble Keyboard Navigation & Global Escape Dismissal
**Learning:** Interactive popovers or speech bubbles placed before their toggle button in the DOM cause unintuitive backward Tab focus movement for keyboard users. Placing the popover element directly after its trigger button in DOM order ensures forward Tab flow, while attaching a document `keydown` listener for the `Escape` key allows users to quickly dismiss popovers from anywhere without losing focus context.
**Action:** Always position popover DOM containers directly after their trigger buttons and provide global `Escape` key handlers to dismiss visible popover overlays.
