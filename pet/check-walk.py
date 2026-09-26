"""Check a walk cycle for planted feet and sliding.  Run from the repository root.

  python3 pet/check-walk.py media/pet-chris-poses-v2.png --frames 2,3,4,5 --cycle 124
  python3 pet/check-walk.py pet/walk-frames --cycle 128        # a folder of frames, sorted by name

Frames are the 192x200 poses on a sprite sheet (--frames picks indices, in walk order) or a folder of PNGs,
either transparent or on exact #FF00FF. The frames are assumed to be equally spaced in phase around one
full cycle; --cycle is how far the body travels in that cycle (2 x step length).

For each frame it finds the boot soles, decides which feet are on the ground, and checks the one thing that
makes a walk read as a walk: a planted foot is fixed on the ground, so relative to the body it must move
back by exactly the distance the body advanced between frames. Anything else is the foot skating.

Foot position is the lowest point of its sole (the contact point). Body position is the shirt centroid.
The sole finder looks for the mauve-grey boot sole colour used in Chris's art.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def key_magenta(rgba):
    a = rgba.copy()
    m = (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255)
    a[m] = 0
    if a.shape[2] == 3:
        a = np.dstack([a, np.where(m, 0, 255).astype(np.uint8)])
    return a


def load_frames(args):
    if os.path.isdir(args.source):
        files = sorted(glob.glob(os.path.join(args.source, "*.png")))
        return [key_magenta(np.array(Image.open(f).convert("RGB"))) for f in files], [os.path.basename(f) for f in files]
    sheet = np.array(Image.open(args.source).convert("RGBA"))
    idx = [int(i) for i in args.frames.split(",")]
    return [sheet[:, i * 192:(i + 1) * 192] for i in idx], [f"#{i}" for i in idx]


def body_x(f):
    r, g, b, a = (f[..., i].astype(int) for i in range(4))
    shirt = (g > r + 25) & (g > b + 25) & (a > 0)
    return np.where(shirt)[1].mean()


def soles(f):
    r, g, b, a = (f[..., i].astype(int) for i in range(4))
    mx, mn = np.max(f[..., :3], axis=2).astype(int), np.min(f[..., :3], axis=2).astype(int)
    sole = (a > 0) & (r > 115) & (r < 215) & (b > r * 0.5) & (b < r * 0.85) & ((mx - mn) < 75) & (np.arange(f.shape[0])[:, None] > 150)
    lab, k = ndi.label(sole, structure=np.ones((3, 3)))
    out = []
    for j in range(1, k + 1):
        ys, xs = np.where(lab == j)
        if len(ys) < 12:
            continue
        yb = ys.max()
        low = xs[ys >= yb - 1]
        out.append(dict(x=float(low.mean()), bottom=int(yb), x0=int(xs.min()), x1=int(xs.max())))
    return sorted(out, key=lambda s: s["x"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help="sprite sheet PNG or a folder of frame PNGs")
    ap.add_argument("--frames", default="2,3,4,5", help="sheet indices in walk order (sheet input only)")
    ap.add_argument("--cycle", type=float, required=True, help="body travel over one full cycle, px (2 x step length)")
    ap.add_argument("--ground-tol", type=float, default=3.0, help="a sole this close to the lowest sole counts as planted")
    ap.add_argument("--max-slip", type=float, default=None, help="fail above this many px of skating (default: 25%% of the per-frame advance, min 4)")
    args = ap.parse_args()

    frames, names = load_frames(args)
    n = len(frames)
    step = args.cycle / n
    max_slip = args.max_slip if args.max_slip is not None else max(4.0, step * 0.25)
    bx = [body_x(f) for f in frames]
    feet = []
    for f, b in zip(frames, bx):
        ss = soles(f)
        feet.append([dict(rel=s["x"] - b, bottom=s["bottom"]) for s in ss])
    ground = max(s["bottom"] for fr in feet for s in fr)
    for fr in feet:
        for s in fr:
            s["planted"] = s["bottom"] >= ground - args.ground_tol
            s["lift"] = ground - s["bottom"]

    print(f"{n} frames, body advances {step:.1f}px per frame, ground row {ground}, skating limit {max_slip:.1f}px\n")
    print("frame        foot contacts (rel x from body centre, + ahead; P planted, lift in px)")
    for nm, fr in zip(names, feet):
        print(f"{nm:12s} " + "   ".join(f"{s['rel']:+6.1f} {'P' if s['planted'] else 'lift ' + str(s['lift'])}" for s in fr))

    slips, seps, planted_ct = [], [], 0
    for k in range(n):
        nxt = feet[(k + 1) % n]
        for s in feet[k]:
            if not s["planted"]:
                continue
            planted_ct += 1
            exp = s["rel"] - step
            cand = [t for t in nxt if t["planted"] and abs(t["rel"] - exp) < 45]
            if cand:
                t = min(cand, key=lambda t: abs(t["rel"] - exp))
                slips.append((names[k], names[(k + 1) % n], t["rel"] - exp))
        pl = [s["rel"] for s in feet[k] if s["planted"]]
        if len(pl) == 2:
            seps.append(abs(pl[1] - pl[0]))

    print("\nplanted foot skating between consecutive frames (0 = perfectly fixed on the ground):")
    for a, b, s in slips:
        flag = "  <-- SKATING" if abs(s) > max_slip else ""
        print(f"  {a:>10s} -> {b:<10s} {s:+6.1f}px{flag}")
    worst = max((abs(s) for _, _, s in slips), default=0.0)
    frac = planted_ct / (2 * n)
    spread = (max(seps) - min(seps)) / max(seps) if len(seps) > 1 else 0.0
    print(f"\nplanted feet: {planted_ct} of {2 * n} foot-frames ({frac:.0%}; a walk is about 55-65%)")
    if seps:
        print(f"double-support separations: {', '.join(f'{s:.0f}' for s in seps)}px (spread {spread:.0%}; a symmetric walk is under 15%)")
    print(f"worst skating: {worst:.1f}px")
    ok = worst <= max_slip and 0.45 <= frac <= 0.70 and spread <= 0.15
    print("\nRESULT:", "PASS" if ok else "FAIL")
    if worst > max_slip:
        print(" - a planted foot slides against the ground")
    if not 0.45 <= frac <= 0.70:
        print(" - feet are planted too rarely/often for a walk")
    if spread > 0.15:
        print(" - the two contacts have different foot separations (uneven steps)")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
