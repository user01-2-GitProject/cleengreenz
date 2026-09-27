"""Build Chris's walk cycle by re-posing his own pixel legs, into media/pet-chris-poses-v3.png.

Run from the repository root:  python3 pet/walk-rig.py [--preview out.png]

Why this exists
The four delivered walk keyframes (pet/chris-keyframes/02..05) are not a real gait: the same boot is in
front in every frame and both boots stay on the ground, so no timing makes him walk; he shuffles.
Instead of redrawing by hand, this cuts the near leg (thigh, shin, boot) out of the passing keyframe
and re-poses it with a two-bone leg rig, so every pixel still comes from Chris's own art.

The gait
- FRAMES frames per cycle (two steps). Each foot is planted for STANCE of the cycle and slides back
  under the body at exactly the walking speed, so on the page a planted boot stays on one spot.
- Planted boots sit flat on the ground line. The swinging boot lifts on an arc, toe down at push-off
  and toe up at heel strike.
- The hips drop at contact (legs spread) and rise at passing, from the leg lengths, not a guess.
- The arms swing opposite the legs.
- STEP (px) is the distance between the boots at contact; the site script uses the same number
  (WALK.step in index.html), so the pose is picked from distance walked and feet do not skate.
"""
import math
import sys

import numpy as np
from PIL import Image

SRC = "pet/chris-keyframes/03_walk_passing_a.png"
IDLE_SHEET = "media/pet-chris-poses-v2.png"
# The site's sheet: the twelve poses from pet/build-sheet.py, then the walk frames (poses 12..23).
# A new file name, so browsers and the Cloudflare cache cannot mix old poses with new code.
OUT = "media/pet-chris-poses-v3.png"
W, H = 192, 200
FRAMES = 12
STANCE = 0.6
STEP = 50           # boot-to-boot distance at contact, px
LIFT = 9            # swing boot peak lift, px
REST_BEND = 3.0     # knees stay this soft at passing, so the hips bob about this much, not more
GROUND = 197        # lowest sole row in every frame

# --- The source leg, measured on the passing keyframe (pixel coordinates in that frame) ----------
HIP = np.array([78.0, 110.0])
KNEE = np.array([80.0, 145.0])
ANKLE = np.array([86.0, 181.0])
# Near leg outline (thigh + shin + cuff), drawn by hand around the front leg.
LEG_POLY = [(57, 99), (96, 99), (96, 126), (93, 140), (93, 160), (96, 172), (97, 181),
            (74, 183), (72, 172), (69, 152), (66, 138), (62, 126), (57, 112)]
# Boot: everything below the cuff line around the front boot.
BOOT_BOX = (73, 178, 116, 198)
# Body: everything above this row comes from the passing keyframe unchanged.
WAIST = 112
SHIRT_HEM = 104
OUTLINE = (38, 22, 14, 255)
# Arms below the sleeves, and the shoulder each one swings from (measured on the keyframe). The
# sleeves stay on the body and are drawn over the top of the arm, so the joint never shows.
# NEAR_ARM is the one on the same side as the near (cargo-pocket) leg; it swings opposite that leg.
FAR_ARM = dict(box=(28, 79, 56, 130), pivot=(46, 70))
NEAR_ARM = dict(box=(95, 81, 127, 130), pivot=(100, 70))
ARM_SWING = 6.0     # degrees each way
# The cargo pocket is on the outside of the near leg only; the far leg gets it painted out.
POCKET_BOX = (63, 116, 80, 142)


def load_keyframe(path):
    rgb = np.array(Image.open(path).convert("RGB"))
    key = (rgb[..., 0] == 255) & (rgb[..., 1] == 0) & (rgb[..., 2] == 255)
    rgba = np.dstack([rgb, np.where(key, 0, 255).astype(np.uint8)])
    rgba[key] = 0
    return rgba


def poly_mask(poly, shape):
    from PIL import ImageDraw
    m = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.array(m) > 0


def cut(src, mask):
    out = np.zeros_like(src)
    out[mask] = src[mask]
    return out


def affine_sample(src, dst_shape, inv):
    """Nearest-neighbour inverse mapping: dst pixel centre (x, y) -> src (x, y) = inv(x, y)."""
    h, w = dst_shape
    ys, xs = np.mgrid[0:h, 0:w]
    sx, sy = inv(xs + 0.5, ys + 0.5)
    sx = np.floor(sx).astype(int)
    sy = np.floor(sy).astype(int)
    ok = (sx >= 0) & (sx < src.shape[1]) & (sy >= 0) & (sy < src.shape[0])
    out = np.zeros((h, w, 4), np.uint8)
    out[ok] = src[sy[ok], sx[ok]]
    return out


def bone_map(src_a, src_b, dst_a, dst_b):
    """Inverse map that carries bone dst_a->dst_b onto src_a->src_b (rotation + stretch along bone)."""
    sv, dv = src_b - src_a, dst_b - dst_a
    sl, dl = np.hypot(*sv), np.hypot(*dv)
    su, du = sv / sl, dv / dl
    sn, dn = np.array([-su[1], su[0]]), np.array([-du[1], du[0]])

    def inv(x, y):
        rx, ry = x - dst_a[0], y - dst_a[1]
        t = (rx * du[0] + ry * du[1]) * (sl / dl)
        n = rx * dn[0] + ry * dn[1]
        return src_a[0] + t * su[0] + n * sn[0], src_a[1] + t * su[1] + n * sn[1]
    return inv


def rot_map(src_pivot, dst_pivot, deg):
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))

    def inv(x, y):
        rx, ry = x - dst_pivot[0], y - dst_pivot[1]
        return src_pivot[0] + c * rx + s * ry, src_pivot[1] - s * rx + c * ry
    return inv


def over(dst, src):
    a = src[..., 3:4].astype(np.float32) / 255
    dst[..., :3] = (src[..., :3] * a + dst[..., :3] * (1 - a)).astype(np.uint8)
    dst[..., 3] = np.maximum(dst[..., 3], src[..., 3])


def outline(layer):
    """Give a cut-out layer a 1px dark edge where it meets transparency (the cut sides had none)."""
    m = layer[..., 3] > 0
    inner = m.copy()
    inner[1:, :] &= m[:-1, :]
    inner[:-1, :] &= m[1:, :]
    inner[:, 1:] &= m[:, :-1]
    inner[:, :-1] &= m[:, 1:]
    edge = m & ~inner
    layer[edge] = OUTLINE
    return layer


def two_bone(hip, ankle, l1, l2):
    """Knee position for a leg that bends forward (+x)."""
    d = ankle - hip
    dist = min(np.hypot(*d), l1 + l2 - 1e-6)
    a = math.acos(max(-1, min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))))
    base = math.atan2(d[1], d[0])
    ang = base - a  # rotate toward +x (screen y is down, so subtract)
    return hip + l1 * np.array([math.cos(ang), math.sin(ang)])


def foot_track(phase):
    """Ankle offset from the hip (x) and lift above planted height (y), and boot pitch, for one foot.

    phase 0 = heel strike of this foot."""
    travel = 2 * STEP * STANCE          # how far the planted boot slides back relative to the hips
    front, back = travel / 2, -travel / 2
    if phase < STANCE:
        u = phase / STANCE
        x = front + (back - front) * u
        # Heel strike: toe comes down over the first bit; toe-off: heel rises over the last bit.
        pitch = -12 * max(0, 1 - u / .15) + 18 * max(0, (u - .82) / .18)
        return x, 0.0, pitch
    u = (phase - STANCE) / (1 - STANCE)
    s = (1 - math.cos(math.pi * u)) / 2   # ease in and out
    x = back + (front - back) * s
    lift = LIFT * math.sin(math.pi * u) ** 1.2
    pitch = 18 * (1 - u / .35) if u < .35 else -12 * min(1, (u - .5) / .5) if u > .5 else 0
    return x, lift, pitch


def main():
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    src = load_keyframe(SRC)
    leg_mask = poly_mask(LEG_POLY, src.shape)
    leg_mask &= src[..., 3] > 0
    thigh_src = cut(src, leg_mask & (np.mgrid[0:H, 0:W][0] < KNEE[1] + 7))
    shin_src = cut(src, leg_mask & (np.mgrid[0:H, 0:W][0] >= KNEE[1] - 7))
    bx0, by0, bx1, by1 = BOOT_BOX
    boot_mask = np.zeros(src.shape[:2], bool)
    boot_mask[by0:by1, bx0:bx1] = True
    boot_mask &= src[..., 3] > 0
    boot_mask &= ~poly_mask(LEG_POLY, src.shape) | (np.mgrid[0:H, 0:W][0] >= ANKLE[1] - 1)
    boot_src = cut(src, boot_mask)

    # The far leg is the same leg without the pocket: fill the pocket from the plain cloth beside it.
    far_thigh_src = thigh_src.copy()
    px0, py0, px1, py1 = POCKET_BOX
    for y in range(py0, py1):
        for x in range(px0, px1):
            if far_thigh_src[y, x, 3] and thigh_src[y, x + 13, 3]:
                far_thigh_src[y, x] = thigh_src[y, x + 13]

    body = src.copy()
    arms = []
    for arm in (NEAR_ARM, FAR_ARM):
        x0, y0, x1, y1 = arm["box"]
        a = np.zeros_like(src)
        box = np.zeros(src.shape[:2], bool)
        box[y0:y1, x0:x1] = True
        r, g, b = (src[..., k].astype(int) for k in range(3))
        box &= ~((g > r + 20) & (g > b + 20))   # shirt pixels stay on the body
        a[box] = src[box]
        body[box] = 0
        arms.append((a, np.array(arm["pivot"], float)))
    body[WAIST:] = 0

    l1 = np.hypot(*(KNEE - HIP))
    l2 = np.hypot(*(ANKLE - KNEE))

    frames = []
    for f in range(FRAMES):
        ph = f / FRAMES
        feet = []
        for off in (0.0, 0.5):   # near foot, far foot
            fp = (ph + off) % 1
            x, lift, pitch = foot_track(fp)
            feet.append((x, lift, pitch, fp < STANCE))
        # Hip height: as high as the planted legs allow, but never fully locked straight.
        reach = (l1 + l2) * .99
        rest = reach - REST_BEND
        hip_y = ANKLE[1] - rest
        for x, lift, pitch, planted in feet:
            if planted:
                hip_y = max(hip_y, ANKLE[1] - math.sqrt(max(1, reach ** 2 - x ** 2)))
        dy = int(round(hip_y - HIP[1]))
        hip = HIP + np.array([0, dy])

        frame = np.zeros((H, W, 4), np.uint8)
        layers = []
        for i, (x, lift, pitch, planted) in enumerate(feet):
            # Pitch about the toe (push-off) or the heel (strike) keeps the planted end on the ground.
            ankle = np.array([hip[0] + x, ANKLE[1] - lift])
            if pitch > 0:   # heel up, rotate about the toe ball
                ankle[1] -= math.sin(math.radians(pitch)) * 14
            elif pitch < 0:  # toe up, rotate about the heel
                ankle[1] -= math.sin(math.radians(-pitch)) * 4
            h = hip + (np.array([-5.0, 0]) if i == 1 else 0)
            knee = two_bone(h, ankle, l1, l2)
            layer = np.zeros((H, W, 4), np.uint8)
            over(layer, affine_sample(boot_src, (H, W), rot_map(ANKLE, ankle, -pitch)))
            over(layer, affine_sample(shin_src, (H, W), bone_map(KNEE, ANKLE, knee, ankle)))
            over(layer, affine_sample(far_thigh_src if i else thigh_src, (H, W), bone_map(HIP, KNEE, h, knee)))
            layer = outline(layer)
            if i == 1:  # far leg: a touch darker, like the art's far leg
                layer[..., :3] = (layer[..., :3] * .82).astype(np.uint8)
            layers.append(layer)

        # Near arm is furthest back when the near foot strikes (phase 0), forward half a cycle later.
        swing = ARM_SWING * math.cos(2 * math.pi * ph)
        body_shift = np.zeros_like(body)
        body_shift[dy:] = body[:H - dy] if dy else body
        up = np.array([0, dy], float)
        near_arm = affine_sample(arms[0][0], (H, W), rot_map(arms[0][1], arms[0][1] + up, -swing))
        far_arm = affine_sample(arms[1][0], (H, W), rot_map(arms[1][1], arms[1][1] + up, swing))
        # Under each swinging arm, its unmoved upper part, so no gap opens against the torso.
        for a, _ in arms:
            base = np.zeros_like(a)
            base[:96] = a[:96]
            shifted_base = np.zeros_like(base)
            shifted_base[dy:] = base[:H - dy] if dy else base
            over(frame, shifted_base)
        over(frame, far_arm)
        over(frame, layers[1])
        over(frame, body_shift)
        over(frame, layers[0])
        # Shirt hem back over the top of the thigh.
        hem = np.zeros_like(body_shift)
        hem[:SHIRT_HEM + dy] = body_shift[:SHIRT_HEM + dy]
        over(frame, hem)
        over(frame, near_arm)
        frames.append(frame)

    sheet = np.concatenate(frames, axis=1)
    poses = np.array(Image.open(IDLE_SHEET).convert("RGBA"))
    Image.fromarray(np.concatenate([poses, sheet], axis=1), "RGBA").save(OUT, optimize=True)
    print("wrote", OUT, "walk frames are poses", poses.shape[1] // W, "to", poses.shape[1] // W + FRAMES - 1)
    if preview:
        bg = Image.new("RGBA", (W * FRAMES, H), (226, 236, 214, 255))
        bg.alpha_composite(Image.fromarray(sheet, "RGBA"))
        bg.save(preview)


if __name__ == "__main__":
    main()
