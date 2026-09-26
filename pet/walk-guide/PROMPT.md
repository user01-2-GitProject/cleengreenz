# Redrawing Chris's walk cycle

The current walk frames cannot form a walk (measured with `pet/check-walk.py`: a planted foot skates up to
44px, one foot never leaves the ground, the two steps differ by 3x). No timing fixes that; it needs redrawn
legs. This is the recipe.

## What to ask for: 12 frames

Foot skating in the page is about `128 / frames` px with no lock (8 frames: 14px, 12: 9px, 16: 7px; the
current art is 44px). 12 frames with the built-in foot lock is about 5px of foot skating and 5px of torso
wobble, which is hard to see. 8 frames is the minimum; 16 is better if the image tool can keep them consistent.

Attach to the chat: the current idle pose (`pet/chris-keyframes/00_idle.png`), the pose guide
`pet/walk-guide/walk_guide_12.png`, and your pixel-art walk reference (the one with the far leg shaded
differently from the near leg).

```
Same Chris (same face, beard, cap, green CG shirt, tan cargo pants, boots), 192x200 pixels per frame,
facing right, solid #FF00FF background, no anti-aliasing, feet on the same ground line in every frame.

Draw a 12-frame walk cycle that matches the attached pose guide frame by frame. In the guide, red is the
NEAR leg (closest to the viewer; it has the cargo pocket), blue is the FAR leg. The green dots and the
scrolling ground ticks show which foot is planted: a planted foot must stay on the same ground tick from
frame to frame, so relative to Chris's body it slides backwards while the body moves forward.

Rules:
- Each foot is on the ground a bit over half the cycle and off it the rest. Never let a planted foot
  jump forward or hover.
- Frame 1: near leg forward, heel strike; far leg back, toe pushing off. Frame 7 is the same pose with
  the legs swapped (far leg forward). The two contacts must have the same foot separation (about 64px).
- Frame 4 (and 10): the planted leg is straight under the body, the swinging knee is bent and passing.
- Shade the far leg a little darker and greyer than the near leg so depth reads. Arms swing opposite to the legs.
- Keep torso, head and shirt identical in size and position in every frame; only the legs, arms and a slight
  body dip change.
```

## Then

1. Save the frames as `pet/walk-frames/walk_00.png` ... `walk_11.png` (192x200, exact #FF00FF background).
2. `python3 pet/check-walk.py pet/walk-frames --cycle 128` must say PASS. It prints where each foot is and
   which frame pair skates.
3. `python3 pet/build-sheet.py` appends them to the sheet and rewrites the `WALK` block in `index.html`.
4. Tune `--lock` (0 keeps the body smooth, 1 keeps feet fixed; default 0.45) and commit.
