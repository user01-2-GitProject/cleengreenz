# Pet Chris Pixel-Art Animation Sequences & Timing Specifications

Every frame is delivered as a separate 192 × 200 RGB PNG on a solid `#FF00FF` magenta background with crisp pixel edges (no anti-aliased halos or soft gradients). Chris faces right and his feet are consistently aligned to the ground line.

The sprite sheet `media/pet-chris-poses-v2.png` aggregates all poses into a single labeled sequence (12 frames wide = 2304 × 200 px).

---

## Labeled Poses Index & Sprite Sheet Layout

| Index | File Name | Description |
| --- | --- | --- |
| 0 | `00_idle.png` | Default standing idle pose |
| 1 | `01_walk_push_off.png` | Walk departure / push-off transition |
| 2 | `02_walk_contact_a.png` | Walk step contact pose A (left leg forward) |
| 3 | `03_walk_passing_a.png` | Walk step passing pose A |
| 4 | `04_walk_contact_b.png` | Walk step contact pose B (right leg forward) |
| 5 | `05_walk_passing_b.png` | Walk step passing pose B |
| 6 | `06_notice_pile.png` | Head turns / notices leaf pile |
| 7 | `07_blower_pickup.png` | Reaches and picks up the leaf blower |
| 8 | `08_blower_level.png` | Holds leaf blower level / braced |
| 9 | `09_blower_lower.png` | Blows leaves with nozzle angled slightly downward |
| 10 | `10_wave.png` | Friendly wave / cheer action |
| 11 | `blink (derived from 00_idle)` | Eyelids shut blink frame |

---

## Sequence Frame Order and Timing

### 1. Walk Loop

> **Status:** these four frames do not form a walking gait. Measured with `pet/check-walk.py`: the right foot is
> on the ground in every frame and stays ahead of the body, the left leg does all the lifting, one planted foot
> jumps 31px between frames, and the two contacts are 54px and 71px wide. A planted foot skates up to 44px.
> See `pet/walk-guide/PROMPT.md` for what a redraw needs and how to check it.
Includes both contact poses, both passing poses, and push-off keyframes for a clean, seamless gait without sliding feet.

- **Departure:** `00_idle` → `01_walk_push_off` (100 ms)
- **Repeating Cycle (`walk_cycle_4_frames.png`):**
  - Frame 02 (`02_walk_contact_a`): **120 ms**
  - Frame 03 (`03_walk_passing_a`): **90 ms**
  - Frame 04 (`04_walk_contact_b`): **120 ms**
  - Frame 05 (`05_walk_passing_b`): **90 ms**
- **Arrival:** Finish current step through passing pose before transitioning to idle.
- **Direction:** For traveling left, mirror the entire frame horizontally.

---

### 2. Idle Loop
Subtle breathing and natural movements to keep Chris feeling alive without fidgeting continuously.

- **Base Pose:** `00_idle` (default idle)
- **Subtle Breathing:** CSS scale micro-animation (`scale(1.006, 1.003)` over 2.8s) or subtle 1px breathing frame drop.
- **Blinking:** Intermittent `11_blink` frame for **105 ms** every 2.8s–5.8s.
- **Occasional Fidget / Shift:** Periodic subtle shift (`06_notice_pile` or `10_wave` gesture) every 11s–19s.

---

### 3. Idle → Blower Trigger Transition
A readable transition as Chris notices the leaf pile, reaches/raises the blower, braces himself, and prepares to blow.

- `00_idle` (Idle)
- → `06_notice_pile` (**150 ms**): Chris notices the leaves
- → `07_blower_pickup` (**160 ms**): Reaches for and picks up the leaf blower
- → `08_blower_level` (**110 ms**): Raises blower to level/braced position

---

### 4. Leaf-Blowing Loop and Recovery
Leaves gather into a pile, then Chris blows them away with the nozzle angled slightly downward, followed by a smooth return to idle.

- **Blowing Loop:**
  - Cycle between `08_blower_level` (**120 ms**) and `09_blower_lower` (**120 ms** - nozzle angled slightly downward) while blowing leaves.
  - Hold `09_blower_lower` (**250 ms**) for the primary wind blast / leaf burst scattering effect.
- **Recovery to Idle:**
  - `09_blower_lower` → `08_blower_level` (**110 ms**) → `00_idle` (Return to Idle)

---

## Color Keying & Rendering
- **Background:** `#FF00FF` (Magenta, RGB 255, 0, 255) is used as an exact keying color.
- **Alpha:** When embedding in web pages, replace RGB(255, 0, 255) with full transparency.
