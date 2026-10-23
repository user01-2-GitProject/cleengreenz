## 2026-10-14 - Context-Specific Form Field Error Messages
**Learning:** Generic missing-field validation messages (e.g., "Please enter your phone number") confuse users when they have already typed partial data into an input field (such as an incomplete phone number with fewer than 7 digits).
**Action:** Dynamically update `role="alert"` validation error messages to specify exact actionable requirements (e.g., "Please enter a valid phone number with area code") when inputs fail format/length criteria, and restore default messaging on clear/reset.

## 2026-10-15 - Resetting Hidden Form State on External CTA Clicks
**Learning:** When a form transitions into a completion state (`display: none` on inputs) and the user subsequently interacts with a page CTA or service card targeting the form, focusing a hidden input silently fails and leaves the user confused on a completed message screen.
**Action:** Automatically trigger the form reset procedure whenever any anchor targeting the form (`a[href="#estimate"]`) is clicked while the form is in a completed/done state, restoring input visibility before setting selection and focus.
