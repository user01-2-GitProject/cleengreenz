## 2026-10-14 - Context-Specific Form Field Error Messages
**Learning:** Generic missing-field validation messages (e.g., "Please enter your phone number") confuse users when they have already typed partial data into an input field (such as an incomplete phone number with fewer than 7 digits).
**Action:** Dynamically update `role="alert"` validation error messages to specify exact actionable requirements (e.g., "Please enter a valid phone number with area code") when inputs fail format/length criteria, and restore default messaging on clear/reset.

## 2026-10-18 - Area Code Phone Number Length Validation
**Learning:** Validation messages referencing "with area code" must enforce 10 digits (3-digit area code + 7-digit local number) rather than 7 digits so that incomplete local numbers missing area codes are properly flagged before submission.
**Action:** When validating phone fields with area code requirements, check for `< 10` digits after stripping non-numeric characters to ensure area codes are provided.
