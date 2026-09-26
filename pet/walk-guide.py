"""Generate a walk-cycle pose guide for Chris: pet/walk-guide/walk_guide_8.png and SPEC.md.

Run from the repository root:  python3 pet/walk-guide.py

Why this exists: the walk frames from the first art pass were two silhouettes (right foot always planted
and always ahead, left leg doing all the lifting), so no timing could make them read as a walk. This draws
the frames a *correct* cycle needs, as a stick-figure guide at Chris's scale, to give an image tool as a
pose reference, and writes the numbers the validator (pet/check-walk.py) checks the finished art against.

Model (all in the 192x200 frame; Chris faces right; body centre x = 71.6, ground y = 197):
- One full cycle = two steps. Step length S is the foot separation at contact; cycle length C = 2*S.
- Each foot is planted for 60% of the cycle (heel strike at phase 0, toe-off at 0.56) and swings for 40%.
- While planted, the foot's world position is fixed, so relative to the body it moves back at body speed:
  ankle x = S/2 - C*phase. The ground ticks in the guide scroll by the same amount, so a planted foot
  stays on the same tick from frame to frame. If a foot slides against the ticks, the pose is wrong.
- The far leg is half a cycle behind the near leg. Arms swing opposite to the legs.
"""
import argparse
import math
import os

from PIL import Image, ImageDraw

W, H = 192, 200
BODY_X = 71.6
GROUND = 197
HIP_Y_TOP = 108          # hip joint height when the leg is vertical is GROUND - ANKLE_H - (THIGH + SHIN)
THIGH, SHIN, ANKLE_H = 41.0, 41.0, 7.0
S = 64.0                 # step length: foot separation at contact (px)
C = 2 * S                # cycle length: distance the body travels in one full cycle
STANCE = 0.56            # fraction of the cycle a foot is on the ground (stylised; keeps the passing pose on frame 3)
LIFT = 16.0              # peak foot lift in swing (px)
N = 8                    # frames in the guide (set with --frames)
OUT_DIR = "pet/walk-guide"

NEAR = (214, 60, 60)     # near leg / arm
FAR = (55, 95, 200)      # far leg / arm
INK = (30, 30, 30)


def ankle(phase):
    """Ankle position relative to the body (x) and height above ground (lift) for a foot at `phase`."""
    p = phase % 1.0
    if p < STANCE:
        return S / 2 - C * p, 0.0, "planted"
    u = (p - STANCE) / (1 - STANCE)
    x0, x1 = S / 2 - C * STANCE, S / 2
    e = (1 - math.cos(math.pi * u)) / 2
    return x0 + (x1 - x0) * e, LIFT * math.sin(math.pi * u), "swing"


def foot_angle(phase):
    """Foot pitch in degrees (positive = toe up): heel strike, flat, heel off, swing."""
    p = phase % 1.0
    if p < 0.08:
        return 22 * (1 - p / 0.08)
    if p < 0.40:
        return 0.0
    if p < STANCE:
        return -30 * (p - 0.40) / (STANCE - 0.40)
    u = (p - STANCE) / (1 - STANCE)
    return -30 + 60 * u if u < 0.8 else 18 * (1 - (u - 0.8) / 0.2)


def two_bone(hip, target):
    """Knee position for a two-bone leg from hip to target, knee bending forward (+x)."""
    dx, dy = target[0] - hip[0], target[1] - hip[1]
    d = min(math.hypot(dx, dy), THIGH + SHIN - 1e-3)
    a = math.atan2(dy, dx)
    cos_k = (THIGH ** 2 + d ** 2 - SHIN ** 2) / (2 * THIGH * d)
    k = math.acos(max(-1, min(1, cos_k)))
    ang = a - k if dx >= -1e9 else a + k
    # pick the bend that puts the knee forward of the hip-ankle line
    cand = [a - k, a + k]
    pts = [(hip[0] + THIGH * math.cos(t), hip[1] + THIGH * math.sin(t)) for t in cand]
    return max(pts, key=lambda q: q[0] - (hip[0] + (target[0] - hip[0]) * (q[1] - hip[1]) / (target[1] - hip[1] + 1e-9)))


def pose(k):
    """All joint positions for frame k of N (world-relative x are relative to BODY_X)."""
    phase = k / N
    legs = {}
    for name, off in (("near", 0.0), ("far", 0.5)):
        ax, lift, state = ankle(phase + off)
        legs[name] = dict(ax=ax, lift=lift, state=state, phase=(phase + off) % 1.0)
    # hip height: the shorter reach of the planted legs sets how low the body sits (natural bob)
    reach = (THIGH + SHIN)
    hips = [math.sqrt(max(reach ** 2 - v["ax"] ** 2, 1.0)) for v in legs.values() if v["state"] == "planted"]
    hip_h = min(hips) if hips else reach
    hip_y = GROUND - ANKLE_H - hip_h
    hip = (BODY_X, hip_y)
    for name, v in legs.items():
        a = (BODY_X + v["ax"], GROUND - ANKLE_H - v["lift"])
        v["ankle"] = a
        v["knee"] = two_bone(hip, a)
    return phase, hip, legs


def draw_frame(k, scale=1, decorate=True):
    phase, hip, legs = pose(k)
    im = Image.new("RGBA", (W, H), (250, 244, 232, 255) if decorate else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if decorate:
        # ground line + world-fixed ticks: they move back by C*phase, so planted feet sit on one tick
        d.line([(0, GROUND), (W, GROUND)], fill=(150, 150, 150))
        for n in range(-2, 16):
            tx = 16 * n - (C * phase) % 16 + BODY_X % 16
            d.line([(tx, GROUND), (tx, GROUND + 3)], fill=(150, 150, 150))
    # far limbs first
    order = ("far", "near")
    sh = (BODY_X, hip[1] - 50)          # shoulder
    for name in order:
        col = NEAR if name == "near" else FAR
        v = legs[name]
        d.line([hip, v["knee"]], fill=col, width=7)
        d.line([v["knee"], v["ankle"]], fill=col, width=6)
        a = v["ankle"]
        ang = math.radians(foot_angle(v["phase"]))
        toe = (a[0] + 20 * math.cos(ang), a[1] + ANKLE_H - 20 * math.sin(ang) * 0.0 - 20 * math.sin(ang))
        heel = (a[0] - 7 * math.cos(ang), a[1] + ANKLE_H + 7 * math.sin(ang))
        d.line([a, toe], fill=col, width=5)
        d.line([a, heel], fill=col, width=5)
        if v["state"] == "planted":
            d.ellipse([a[0] - 3, GROUND - 3, a[0] + 3, GROUND + 3], fill=(40, 170, 70))
    # torso + head
    d.line([hip, sh], fill=INK, width=12)
    d.ellipse([sh[0] - 15, sh[1] - 34, sh[0] + 15, sh[1] - 4], outline=INK, width=3)
    # arms swing opposite to the same-side leg
    for name in order:
        col = NEAR if name == "near" else FAR
        opp = legs["far" if name == "near" else "near"]
        swing = -opp["ax"] / (S * 0.9) * 0.6
        upper = 27.0
        el = (sh[0] + upper * math.sin(swing), sh[1] + upper * math.cos(swing))
        wr = (el[0] + 24 * math.sin(swing * 0.6 + 0.3), el[1] + 24 * math.cos(swing * 0.6 + 0.3))
        d.line([sh, el], fill=col, width=5)
        d.line([el, wr], fill=col, width=4)
    n_state = legs["near"]["state"]
    f_state = legs["far"]["state"]
    if decorate:
        d.text((100, 4), f"{k + 1}/{N}  phase {phase:.3f}", fill=INK)
        d.text((100, 16), f"NEAR (red): {n_state}", fill=NEAR)
        d.text((100, 28), f"FAR (blue): {f_state}", fill=FAR)
    return im.resize((W * scale, H * scale), Image.NEAREST), legs, hip


def main():
    global N
    ap = argparse.ArgumentParser(description="Generate the Chris walk-cycle pose guide and spec table.")
    ap.add_argument("--frames", type=int, default=8, help="frames in the cycle (8, 12 or 16; more frames = less foot skating)")
    N = ap.parse_args().frames
    os.makedirs(OUT_DIR, exist_ok=True)
    tiles, rows = [], []
    for k in range(N):
        im, legs, hip = draw_frame(k, scale=2)
        tiles.append(im)
        rows.append((k, legs, hip))
    cols = 4 if N <= 8 else 6 if N == 12 else 8
    sheet = Image.new("RGB", (W * 2 * cols, H * 2 * ((N + cols - 1) // cols)), (255, 255, 255))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k % cols) * W * 2, (k // cols) * H * 2))
    path = os.path.join(OUT_DIR, f"walk_guide_{N}.png")
    sheet.save(path)
    with open(os.path.join(OUT_DIR, f"SPEC_{N}.md"), "w") as f:
        f.write("# Chris walk cycle: numbers the finished art is checked against\n\n")
        f.write(f"Frame 192x200, body centre x={BODY_X}, ground y={GROUND}. Step length S={S:.0f}px (foot separation at contact), "
                f"cycle C={C:.0f}px, each foot planted {int(STANCE*100)}% of the cycle. Positions are ankle x relative to the body centre "
                "(+ is ahead) and foot lift above the ground line.\n\n")
        f.write("| Frame | Phase | Near foot | x | lift | Far foot | x | lift | Hip height |\n|---|---|---|---|---|---|---|---|---|\n")
        for k, legs, hip in rows:
            n, fr = legs["near"], legs["far"]
            f.write(f"| {k + 1} | {k / N:.3f} | {n['state']} | {n['ax']:+.0f} | {n['lift']:.0f} | {fr['state']} | {fr['ax']:+.0f} | "
                    f"{fr['lift']:.0f} | {GROUND - hip[1]:.0f} |\n")
        f.write("\nRules the validator enforces: a planted foot never moves forward relative to the ground; each foot is "
                "planted in about 5 of the 8 frames; both contacts have the same foot separation; the near leg is the "
                "front leg at frame 1 and the rear leg at frame 5.\n")
    print("wrote", path)


if __name__ == "__main__":
    main()
