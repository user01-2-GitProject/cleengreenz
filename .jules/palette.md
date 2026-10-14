## Palette Journal - UX & Accessibility Learnings

## 2026-03-30 - Ordered List Semantics for Sequential Step Displays
**Learning:** Sequential "How it works" process steps displayed as generic `<div>`s hide step count and list position context from screen reader users. Using an `<ol>` with `aria-label` and `list-style: none; padding: 0; margin: 0;` CSS reset maintains exact visual grid layout while providing assistive technologies structured step navigation.
**Action:** Always structure sequential workflow steps using `<ol>` and `<li>` elements, resetting list margins and padding in CSS to preserve visual design.
