"""Build media/pet-chris-poses-v2.png from the individual keyframes in pet/chris-keyframes/.

Run from the repository root:  python3 pet/build-sheet.py

What it does
- Keys out the exact #FF00FF background (the frames have no anti-aliased halo, so an exact key is clean).
- Lines up the walk and departure frames on the shirt. The generated frames drift sideways by up to
  ~8px between consecutive poses, which reads as a lateral wobble when they cycle at walking speed.
  Aligning the torso keeps the head/torso lean the artist drew and removes the wobble. The blower
  and wave frames are already within ~2.5px of idle and are left exactly as delivered.
- Pastes all frames into one row, 192x200 each, in the order listed in FRAMES. The order is the pose
  index used by the site script (POSE in index.html); change both together.
"""
import glob
import os

import numpy as np
from PIL import Image

SRC = "pet/chris-keyframes"
OUT = "media/pet-chris-poses-v2.png"
W, H = 192, 200

# Pose index -> keyframe file prefix. Keep in step with POSE in index.html.
FRAMES = [
    "00_idle", "01_walk_push_off", "02_walk_contact_a", "03_walk_passing_a", "04_walk_contact_b",
    "05_walk_passing_b", "06_notice_pile", "07_blower_pickup", "08_blower_level", "09_blower_lower",
    "10_wave",
]
# Frames whose torso is lined up with the idle frame's torso.
ALIGN = {"01_walk_push_off", "02_walk_contact_a", "03_walk_passing_a", "04_walk_contact_b",
         "05_walk_passing_b", "06_notice_pile"}


def load(name):
    path = glob.glob(os.path.join(SRC, name + ".png"))[0]
    rgb = np.array(Image.open(path).convert("RGB"))
    key = (rgb[..., 0] == 255) & (rgb[..., 1] == 0) & (rgb[..., 2] == 255)
    return rgb, ~key


def shirt_cx(rgb, opaque):
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    shirt = (g > r + 25) & (g > b + 25) & opaque
    return np.where(shirt)[1].mean()


def shifted(rgba, dx):
    if dx == 0:
        return rgba
    out = np.zeros_like(rgba)
    if dx > 0:
        out[:, dx:] = rgba[:, :-dx]
    else:
        out[:, :dx] = rgba[:, -dx:]
    return out


def main():
    idle_rgb, idle_op = load(FRAMES[0])
    target = shirt_cx(idle_rgb, idle_op)
    sheet = Image.new("RGBA", (W * len(FRAMES), H), (0, 0, 0, 0))
    for i, name in enumerate(FRAMES):
        rgb, op = load(name)
        rgba = np.dstack([rgb, (op * 255).astype(np.uint8)])
        rgba[~op] = 0  # no magenta left in fully transparent pixels
        dx = int(round(target - shirt_cx(rgb, op))) if name in ALIGN else 0
        assert rgba.shape[1] == W and rgba.shape[0] == H, name
        sheet.alpha_composite(Image.fromarray(shifted(rgba, dx), "RGBA"), (i * W, 0))
        print(f"{i:2d}  {name:20s} shift {dx:+d}px")
    sheet.save(OUT, optimize=True)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
