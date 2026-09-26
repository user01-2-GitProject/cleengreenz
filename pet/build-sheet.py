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
- If pet/walk-frames/ holds a walk cycle (N PNGs, sorted by name, one full cycle, evenly spaced in phase),
  appends them after the poses, lines them up on the shirt, and rewrites the WALK block in index.html
  (the gait table, cycle length and foot lock). Check a new cycle first with pet/check-walk.py.

    python3 pet/build-sheet.py [--walk-dir pet/walk-frames] [--cycle 128] [--lock 0.45]
"""
import argparse
import glob
import os
import re

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


def blink_frame(idle_rgba):
    """Derive the blink from the idle frame: only the eyelids change, a few pixels.

    Same edit that PR 10's add-blink-frame.py made to the old sheet. The idle frame is pixel-identical
    to the old one, so the coordinates are unchanged: the idle art is placed at x=34 in the 192x200 frame.
    """
    blink = idle_rgba.copy()
    skin, skin_light, lid = (234, 140, 99, 255), (251, 170, 116, 255), (69, 35, 24, 255)
    for left, right in ((38, 44), (52, 57)):
        for x in range(left + 34, right + 34 + 1):
            blink[25, x], blink[26, x], blink[27, x] = skin_light, lid, skin
    return blink


def walk_block(first, n, cycle, lock):
    """The WALK block for an n-frame cycle whose frames sit at sheet indices first..first+n-1."""
    gait = [[round((k + .5) / n, 4), first + k, round(k / n, 4)] for k in range(n)] + [[1, first, 1.0]]
    text = ("      /* WALK:BEGIN (pet/build-sheet.py rewrites this block when pet/walk-frames/ has a new cycle) */\n"
            f"      var WALK = {{ cycle: {cycle:g}, bob: 0, bobs: 2, bobPeak: .39, lock: {lock:g}, settle: {{}},\n"
            f"        gait: {gait} }};\n"
            f"      WALK.settle[{first}] = {first + 1}; WALK.settle[{first + n // 2}] = {first + n // 2 + 1};\n"
            "      /* WALK:END */")
    return text.replace("], [", "], [")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--walk-dir", default="pet/walk-frames")
    ap.add_argument("--cycle", type=float, default=128, help="body travel over one full walk cycle, px (2 x step length)")
    ap.add_argument("--lock", type=float, default=0.45, help="foot lock 0-1: 0 keeps the body smooth, 1 keeps planted feet fixed")
    ap.add_argument("--no-align", action="store_true", help="do not line the walk frames up on the shirt (for test art)")
    ap.add_argument("--html", default="index.html")
    args = ap.parse_args()

    walk_files = sorted(glob.glob(os.path.join(args.walk_dir, "*.png"))) if os.path.isdir(args.walk_dir) else []
    idle_rgb, idle_op = load(FRAMES[0])
    target = shirt_cx(idle_rgb, idle_op)
    total = len(FRAMES) + 1 + len(walk_files)
    sheet = Image.new("RGBA", (W * total, H), (0, 0, 0, 0))
    idle_rgba = None
    for i, name in enumerate(FRAMES):
        rgb, op = load(name)
        rgba = np.dstack([rgb, (op * 255).astype(np.uint8)])
        rgba[~op] = 0  # no magenta left in fully transparent pixels
        dx = int(round(target - shirt_cx(rgb, op))) if name in ALIGN else 0
        assert rgba.shape[1] == W and rgba.shape[0] == H, name
        placed = shifted(rgba, dx)
        if i == 0:
            idle_rgba = placed
        sheet.alpha_composite(Image.fromarray(placed, "RGBA"), (i * W, 0))
        print(f"{i:2d}  {name:20s} shift {dx:+d}px")
    n = len(FRAMES)
    sheet.alpha_composite(Image.fromarray(blink_frame(idle_rgba), "RGBA"), (n * W, 0))
    print(f"{n:2d}  {'blink (from idle)':20s}")
    first = n + 1
    for j, path in enumerate(walk_files):
        rgba = np.array(Image.open(path).convert("RGBA"))
        magenta = (rgba[..., 0] == 255) & (rgba[..., 1] == 0) & (rgba[..., 2] == 255)
        rgba[magenta] = 0
        op = rgba[..., 3] > 0
        assert rgba.shape[1] == W and rgba.shape[0] == H, path
        dx = 0 if args.no_align else int(round(target - shirt_cx(rgba[..., :3], op)))
        sheet.alpha_composite(Image.fromarray(shifted(rgba, dx), "RGBA"), ((first + j) * W, 0))
        print(f"{first + j:2d}  walk {os.path.basename(path):24s} shift {dx:+d}px")
    sheet.save(OUT, optimize=True)
    print("wrote", OUT, sheet.size)

    css = f"/ {W * total}px {H}px no-repeat"
    with open(args.html, encoding="utf-8") as f:
        html = f.read()
    html2 = re.sub(r"/ \d+px 200px no-repeat", css, html, count=1)
    if walk_files:
        blk = walk_block(first, len(walk_files), args.cycle, args.lock)
        html2 = re.sub(r"      /\* WALK:BEGIN.*?/\* WALK:END \*/", lambda m: blk, html2, count=1, flags=re.S)
        print(f"WALK block rewritten for {len(walk_files)} frames (cycle {args.cycle:g}px, lock {args.lock:g})")
    if html2 != html:
        with open(args.html, "w", encoding="utf-8") as f:
            f.write(html2)
        print("updated", args.html)


if __name__ == "__main__":
    main()
