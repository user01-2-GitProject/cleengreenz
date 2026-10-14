## 2026-10-14 - Context-Specific Form Field Error Messages
**Learning:** Generic missing-field validation messages (e.g., "Please enter your phone number") confuse users when they have already typed partial data into an input field (such as an incomplete phone number with fewer than 7 digits).
**Action:** Dynamically update `role="alert"` validation error messages to specify exact actionable requirements (e.g., "Please enter a valid phone number with area code") when inputs fail format/length criteria, and restore default messaging on clear/reset.
