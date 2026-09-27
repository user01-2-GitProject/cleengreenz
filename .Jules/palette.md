## 2026-09-26 - Form Required Indicators & Disabled States
**Learning:** Bespoke HTML forms in static marketing sites often lack both `aria-required="true"` and visual required indicators on mandatory input labels, leaving screen reader and visual users unaware until submission errors occur. Additionally, custom `.btn` components require explicit `.btn:disabled` rules to suppress hover transforms, cursor pointer, and hover shadows while form handlers are in pending states.
**Action:** When working on form UX, pair `aria-required="true"` with visual indicator tags styled using primary contrast tokens (`var(--pumpkin-2)`), and ensure button CSS includes proper `:disabled` states.

## 2026-09-27 - Form Submission Focus Management
**Learning:** When multi-state forms hide input fields (`display: none`) and display a success container upon submission, focus on the submit button is destroyed, resetting focus to `<body>`. This causes keyboard and screen reader users to lose context completely.
**Action:** Add `tabindex="-1"` to the success container and call `.focus()` on it when showing the completion state, pairing it with `:focus { outline: none; }` to maintain clean visual presentation while guiding assistive focus.
