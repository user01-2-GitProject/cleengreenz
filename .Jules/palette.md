## 2026-09-26 - Form Required Indicators & Disabled States
**Learning:** Bespoke HTML forms in static marketing sites often lack both `aria-required="true"` and visual required indicators on mandatory input labels, leaving screen reader and visual users unaware until submission errors occur. Additionally, custom `.btn` components require explicit `.btn:disabled` rules to suppress hover transforms, cursor pointer, and hover shadows while form handlers are in pending states.
**Action:** When working on form UX, pair `aria-required="true"` with visual indicator tags styled using primary contrast tokens (`var(--pumpkin-2)`), and ensure button CSS includes proper `:disabled` states.

## 2026-09-27 - Form Submission Focus Management & Loading Feedback
**Learning:** Hiding form field containers (`display: none`) upon successful async submit traps keyboard focus on the now-hidden submit button or resets focus to `<body>`, confusing screen reader users. Programmatically shifting focus to a heading with `tabindex="-1"` in the success view ensures immediate announcement and keyboard context continuity.
**Action:** When swapping form DOM views on submit, set `tabindex="-1"` on the success message heading and call `.focus()` alongside setting `aria-busy="true"` on the submit button.

## 2026-09-28 - Accessible Inline Form Validation with Novalidate
**Learning:** When using `novalidate` on HTML forms to override browser default tooltips, simply focusing an empty field with `aria-invalid="true"` leaves screen reader users and sighted users without clear visual error explanations. Programmatically toggling visible `.field-error` elements and dynamically associating them via `aria-describedby` when a required field fails validation provides accessible, unambiguous inline feedback.
**Action:** Always pair `aria-invalid="true"` with visible error elements linked via `aria-describedby`, and clear both on the `input` event when users edit the field.
