## 2026-10-14 - Context-Specific Form Field Error Messages
**Learning:** Generic missing-field validation messages (e.g., "Please enter your phone number") confuse users when they have already typed partial data into an input field (such as an incomplete phone number with fewer than 7 digits).
**Action:** Dynamically update `role="alert"` validation error messages to specify exact actionable requirements (e.g., "Please enter a valid phone number with area code") when inputs fail format/length criteria, and restore default messaging on clear/reset.

## 2026-10-18 - Area Code Phone Number Length Validation
**Learning:** Validation messages referencing "with area code" must enforce 10 digits (3-digit area code + 7-digit local number) rather than 7 digits so that incomplete local numbers missing area codes are properly flagged before submission.
**Action:** When validating phone fields with area code requirements, check for `< 10` digits after stripping non-numeric characters to ensure area codes are provided.

## 2026-10-22 - App-Wide Disclosure Accordion Accessibility Observer
**Learning:** Scoping disclosure accordion event listeners to section-specific classes (e.g., `.faq details`) leaves other `<details>` elements on the page (such as form option disclosures like `#yard-area-details`) without proper `aria-expanded` synchronization and `Escape` key focus restoration.
**Action:** Attach disclosure toggle and keyboard handlers to all `details` elements (`document.querySelectorAll('details')`) across the document rather than scoped section selectors.

## 2026-10-28 - Checkbox-Controlled Disclosure State ARIA Attributes
**Learning:** Interactive checkboxes that reveal or hide content sections (such as property address/area confirmation toggling price results) must maintain `aria-controls` pointing to the target container and dynamically synchronize `aria-expanded="true"` or `"false"` on state changes so screen readers understand the relationship and visibility state.
**Action:** Associate disclosing checkboxes with their controlled container via `aria-controls` and update `aria-expanded` whenever the checkbox `change` or form `reset` events fire.

## 2026-11-04 - Visual Step Numbers in Ordered Lists
**Learning:** In ordered lists (`<ol>`), rendering visual step numbers as text inside `<li>` elements (e.g. `<div class="num">1</div>`) causes screen readers to redundantly announce numbers twice (e.g. "1. 1 Tell us about your yard").
**Action:** Mark visual step number elements inside `<ol>` list items as `aria-hidden="true"` so screen readers convey list structure cleanly without duplicate number announcements.
