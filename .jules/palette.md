## 2026-10-14 - Context-Specific Form Field Error Messages
**Learning:** Generic missing-field validation messages (e.g., "Please enter your phone number") confuse users when they have already typed partial data into an input field (such as an incomplete phone number with fewer than 7 digits).
**Action:** Dynamically update `role="alert"` validation error messages to specify exact actionable requirements (e.g., "Please enter a valid phone number with area code") when inputs fail format/length criteria, and restore default messaging on clear/reset.

## 2026-10-22 - Re-engaging Form CTAs After Submission
**Learning:** When a single-page app hides form inputs upon submission to display a success message, subsequent clicks on CTA links targeting that form leave the user staring at the stale confirmation view while failing to focus the now-hidden inputs.
**Action:** Detect if the form is in its completed/done state when any target CTA link is clicked, and automatically restore form field visibility, reset stale field state, update selected options, and shift focus to the first input field.
