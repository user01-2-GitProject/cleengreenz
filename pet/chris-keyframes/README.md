# Chris pixel-art animation frames

Every frame is 192 x 200 RGB PNG on a flat #FF00FF background. Chris faces right and his feet align to the original ground line. Original five poses are 00, 02, 03, 08, and 10; the others extend that set.

## Walk

On departure: `00_idle` -> `01_walk_push_off` (100 ms). Repeat the four frames in `walk_cycle_4_frames.png`:

| Frame | Pose | Suggested hold |
| --- | --- | --- |
| 02 | contact A | 120 ms |
| 03 | passing A | 90 ms |
| 04 | contact B | 120 ms |
| 05 | passing B | 90 ms |

On arrival, finish the current step before changing to the next action. For travel left, mirror the full frame horizontally, including head and body.

## Idle to leaf-clearing trigger

`00_idle` -> `06_notice_pile` (150 ms) -> `01_walk_push_off` (100 ms) -> walk cycle until the pile -> `07_blower_pickup` (160 ms) -> `08_blower_level` (110 ms) -> `09_blower_lower` (hold while leaves scatter, about 250 ms). Return through `08_blower_level`, then `00_idle`.

`idle_to_blower_6_frames.png` shows the key poses, with travel represented by `01_walk_push_off`; insert the repeating walk frames between it and `07_blower_pickup` when implementing.

The magenta background is an exact color key. Replace only RGB(255, 0, 255) with transparency if the webpage needs alpha.
