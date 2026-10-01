# Design Specification & Plans for New Animated Asset: Chris Lawn Mowing Sequence

**Status: unapproved proposal; not implemented.** This document is not authorization to create assets, add mower states, or change the live animation. It does not satisfy or replace the separate knee/gait revision approval gate.

This document outlines a possible future pipeline for a new animated asset sequence featuring Pet Chris pushing a push mower.

---

## 1. Concept & Character Action
- **Title:** Push Mower Action Loop
- **Description:** Pet Chris pushes a classic green-and-black push lawnmower across the lawn with spinning mower blades and subtle flying grass clippings.
- **Purpose:** Adds an engaging interactive lawn care animation state to the desktop pet widget when users hover over or request estimates for lawn mowing.

---

## 2. Technical Specifications

### Dimensions & Formatting
- **Canvas Size per Frame:** 192 × 200 px (RGB with exact `#FF00FF` keying background or full RGBA transparency).
- **Scale:** 1:1 pixel art matching the existing 192×200 Chris character sprite scale (`media/pet-chris-poses-v4.png`).
- **Ground Line Alignment:** Feet and mower wheels resting at `y = 197` px.

### Sequence Keyframes & Timing

| Frame Index | Pose Name | Action Description | Frame Duration |
| --- | --- | --- | --- |
| 0 | `mower_idle` | Chris gripping push mower handles in ready position | 150 ms |
| 1 | `mower_push_step_a` | Forward push stroke with left leg advancing & blade spin frame 1 | 100 ms |
| 2 | `mower_push_pass_a` | Mid-step passing pose with grass clipping discharge particle | 90 ms |
| 3 | `mower_push_step_b` | Forward push stroke with right leg advancing & blade spin frame 2 | 100 ms |
| 4 | `mower_push_pass_b` | Mid-step passing pose with grass clipping discharge particle | 90 ms |
| 5 | `mower_wipe_brow` | Pauses mowing to wipe brow with sleeve | 300 ms |

---

## 3. Implementation Pipeline & Integration

1. **Keyframe Art Creation (`pet/chris-mower-keyframes/`):**
   - Deliver PNG keyframes `00_mower_idle.png` through `05_mower_wipe_brow.png` at 192×200 px.
2. **Rig & Sheet Builder Script (`pet/mower-rig.py`):**
   - Adapt `pet/walk-rig.py` to synthesize smooth 8-frame push cycles with leg-rig kinematics attached to fixed mower handle anchor points.
   - Output integrated sprite sheet `media/pet-chris-mower.png`.
3. **Frontend Integration (`index.html` & `pet/pet-extras.js`):**
   - Add state `'mow'` to pet controller `p.state`.
   - Add custom CSS class `.pet-wrap.mowing` with custom grass particle spawn logic.
