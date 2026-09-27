"""Build Chris's walk cycle by re-posing his own pixel legs, into media/pet-chris-poses-v4.png.

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
OUT = "media/pet-chris-poses-v4.png"
W, H = 192, 200
FRAMES = 16
STANCE = 0.55
STEP = 72           # boot-to-boot distance at contact, px (about 0.4 of his height, a normal step)
LIFT = 7            # swing boot peak lift, px: the foot passes low, it is not hoisted
REST_BEND = 6.0     # knees stay this soft at passing, so the hips bob about this much, not more
# The passing keyframe's legs are bent, so it stands 10px shorter than the idle pose. The rig
# lengthens thigh and shin until his head sits HEAD_DROP px below idle's at passing, so he does not
# shrink when he sets off.
HEAD_DROP = 2
SRC_HEAD = 10       # top row of the cap in the passing keyframe (idle's is 0)
LOGO_BOX = (70, 65, 93, 81)   # the white "CG" on the shirt, x0 y0 x1 y1 (exclusive), in the keyframe
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
HEM_CUT = 105
PELVIS_BOX = (55, 100, 97, 121)
OUTLINE = (38, 22, 14, 255)
# Arms below the sleeves, and the shoulder each one swings from (measured on the keyframe). The
# sleeves stay on the body and are drawn over the top of the arm, so the joint never shows.
# NEAR_ARM is the one on the same side as the near (cargo-pocket) leg; it swings opposite that leg.
FAR_ARM = dict(box=(28, 79, 56, 130), pivot=(46, 70))
NEAR_ARM = dict(box=(95, 81, 127, 130), pivot=(100, 70))
ARM_SWING = 16.0    # degrees each way
ARM_LAG = 0.06      # arms trail the legs by this much of a cycle, so they swing rather than pump
STAND_GAP = 14      # px between the boots in the standing frame
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


def scale2x(img):
    """EPX / Scale2x: doubles pixel art while keeping edges sharp (no new colours)."""
    h, w = img.shape[:2]
    pad = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode="edge")
    P = pad[1:-1, 1:-1]
    A, B, C, D = pad[:-2, 1:-1], pad[1:-1, 2:], pad[1:-1, :-2], pad[2:, 1:-1]   # up, right, left, down

    def eq(u, v):
        return np.all(u == v, axis=-1)[..., None]
    out = np.zeros((2 * h, 2 * w, img.shape[2]), img.dtype)
    out[0::2, 0::2] = np.where(eq(C, A) & ~eq(C, D) & ~eq(A, B), A, P)
    out[0::2, 1::2] = np.where(eq(A, B) & ~eq(A, C) & ~eq(B, D), B, P)
    out[1::2, 0::2] = np.where(eq(D, C) & ~eq(D, B) & ~eq(C, A), C, P)
    out[1::2, 1::2] = np.where(eq(B, D) & ~eq(B, A) & ~eq(D, C), D, P)
    return out


UP = 4   # sources are Scale2x'd twice before rotating (the RotSprite trick): smoother edges


def affine_sample(src, dst_shape, inv):
    """Inverse mapping: dst pixel centre (x, y) -> src (x, y) = inv(x, y), sampled from the 4x
    Scale2x'd source so rotated edges and outlines stay clean instead of stair-stepping."""
    big = scale2x(scale2x(src))
    h, w = dst_shape
    ys, xs = np.mgrid[0:h, 0:w]
    sx, sy = inv(xs + 0.5, ys + 0.5)
    sx = np.floor(sx * UP).astype(int)
    sy = np.floor(sy * UP).astype(int)
    src = big
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


def shift_y(img, dy):
    out = np.zeros_like(img)
    if dy > 0:
        out[dy:] = img[:-dy]
    elif dy < 0:
        out[:dy] = img[-dy:]
    else:
        out[:] = img
    return out


def over(dst, src):
    a = src[..., 3:4].astype(np.float32) / 255
    dst[..., :3] = (src[..., :3] * a + dst[..., :3] * (1 - a)).astype(np.uint8)
    dst[..., 3] = np.maximum(dst[..., 3], src[..., 3])


def neighbours(m):
    n = np.zeros(m.shape, int)
    n[1:, :] += m[:-1, :]
    n[:-1, :] += m[1:, :]
    n[:, 1:] += m[:, :-1]
    n[:, :-1] += m[:, 1:]
    return n


def tidy(layer):
    """Nearest-neighbour rotation leaves one-pixel teeth and pinholes on edges: file them off."""
    for _ in range(2):
        m = layer[..., 3] > 0
        n = neighbours(m)
        layer[m & (n <= 1)] = 0
        holes = ~m & (n >= 3)
        if holes.any():
            # Fill a pinhole with the pixel above or below it, whichever is opaque.
            up = np.roll(layer, 1, axis=0)
            down = np.roll(layer, -1, axis=0)
            fill = np.where((up[..., 3] > 0)[..., None], up, down)
            layer[holes] = fill[holes]
    return layer


def fill_holes(frame, top):
    """Transparent pockets fully enclosed by the hips and legs (below row `top`, where the layers
    meet) get the nearest cloth colour to their right, so no background shows through. Gaps higher
    up, like between an arm and the torso, are real and stay open."""
    empty = frame[..., 3] == 0
    outside = np.zeros_like(empty)
    outside[0, :] = empty[0, :]
    outside[-1, :] = empty[-1, :]
    outside[:, 0] = empty[:, 0]
    outside[:, -1] = empty[:, -1]
    while True:
        grown = outside.copy()
        grown[1:, :] |= outside[:-1, :]
        grown[:-1, :] |= outside[1:, :]
        grown[:, 1:] |= outside[:, :-1]
        grown[:, :-1] |= outside[:, 1:]
        grown &= empty
        if (grown == outside).all():
            break
        outside = grown
    holes = empty & ~outside
    holes[:top] = False
    # Only small pockets: a big enclosed area (between an arm and a thigh, say) is real background.
    seen = np.zeros_like(holes)
    for y0, x0 in zip(*np.where(holes)):
        if seen[y0, x0]:
            continue
        comp, todo = [], [(y0, x0)]
        seen[y0, x0] = True
        while todo:
            y, x = todo.pop()
            comp.append((y, x))
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and holes[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    todo.append((yy, xx))
        if len(comp) > 30:
            for y, x in comp:
                holes[y, x] = False
    lum = frame[..., :3].astype(int).sum(axis=2)
    for y, x in zip(*np.where(holes)):
        xs = np.where((frame[y, x:, 3] > 0) & (lum[y, x:] > 200))[0]
        frame[y, x] = frame[y, x + xs[0]] if len(xs) else OUTLINE
    return frame


def drop_specks(frame, smallest=15):
    """Remove little islands of pixels cut loose from the figure (bits of the old back outline)."""
    m = frame[..., 3] > 0
    seen = np.zeros_like(m)
    for y0, x0 in zip(*np.where(m)):
        if seen[y0, x0]:
            continue
        comp, todo = [], [(y0, x0)]
        seen[y0, x0] = True
        while todo:
            y, x = todo.pop()
            comp.append((y, x))
            for yy in (y - 1, y, y + 1):
                for xx in (x - 1, x, x + 1):
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        todo.append((yy, xx))
        if len(comp) < smallest:
            for y, x in comp:
                frame[y, x] = 0
    return frame


def close_notches(frame, y0, y1, widest=9):
    """Across the hips, a narrow wedge of background between two bits of cloth (where a thigh
    swings away from the pelvis) is filled with the cloth to its right, and edged."""
    lum = frame[..., :3].astype(int).sum(axis=2)
    for y in range(y0, y1):
        op = np.where(frame[y, :, 3] > 0)[0]
        if len(op) < 2:
            continue
        gaps = np.where(np.diff(op) > 1)[0]
        for gi in gaps:
            a, b = op[gi] + 1, op[gi + 1]
            # Only between two pieces of pants, and only a narrow gap near the back of the hips.
            if b - a <= widest and b < W // 2 and lum[y, b] > 200 and lum[y, a - 1] > 60:
                frame[y, a:b] = frame[y, b]
                frame[y, a - 1] = OUTLINE if frame[y, a - 2, 3] == 0 else frame[y, a - 1]
    return frame


def outline(layer):
    """Give a cut-out layer a 1px dark edge where it meets transparency (the cut sides had none)."""
    layer = tidy(layer)
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
        pitch = -12 * max(0, 1 - u / .15) + 22 * max(0, (u - .7) / .3)
        return x, 0.0, pitch
    # Swing: the foot swings from the hip rather than the knee driving up. The heel peels up behind
    # right after toe-off (lift peaks early), the foot passes low, and the leg reaches out nearly
    # straight, arriving by 90% of the swing.
    u = (phase - STANCE) / (1 - STANCE)
    s = (1 - math.cos(math.pi * min(1, u / .9))) / 2
    x = back + (front - back) * s
    lift = LIFT * math.sin(math.pi * u ** .6) ** 1.5
    pitch = 24 * (1 - u / .4) if u < .4 else -14 * min(1, (u - .45) / .45) if u > .45 else 0
    return x, lift, pitch


def main():
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    src = load_keyframe(SRC)
    leg_mask = poly_mask(LEG_POLY, src.shape)
    leg_mask &= src[..., 3] > 0
    sr, sg, sb = (src[..., k].astype(int) for k in range(3))
    leg_mask &= ~((sg > sr + 20) & (sg > sb + 20))   # the shirt hem is not part of the leg
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
    # One clean hem: the keyframe's shirt hangs in curls over the hips (drawn for its own legs),
    # which float loose once the legs move. Cut the shirt at HEM_CUT and outline the new edge.
    r, g, b = (src[..., k].astype(int) for k in range(3))
    shirt = (g > r + 20) & (g > b + 20) & (body[..., 3] > 0)
    body[HEM_CUT:][shirt[HEM_CUT:]] = 0
    below = np.zeros_like(shirt)
    below[:-1] = body[1:, :, 3] == 0
    body[HEM_CUT - 1][shirt[HEM_CUT - 1]] = OUTLINE
    body[shirt & below & (np.mgrid[0:H, 0:W][0] < HEM_CUT)] = OUTLINE
    # The pelvis: the tops of both thighs under the hem, kept as one piece that only bobs. It fills
    # the crotch and the back of the hips when the thighs swing apart.
    pelvis = np.zeros_like(src)
    x0, y0, x1, y1 = PELVIS_BOX
    r, g, b = (src[..., k].astype(int) for k in range(3))
    keep = np.zeros(src.shape[:2], bool)
    keep[y0:y1, x0:x1] = True
    keep &= ~((g > r + 20) & (g > b + 20)) & (src[..., 3] > 0)
    pelvis[keep] = src[keep]
    pelvis = outline(pelvis)

    # Lengthen the legs (drawn lengths l1, l2; the texture stretches along each bone) so the hip
    # sits where HEAD_DROP puts it at passing.
    reach = (ANKLE[1] - (HIP[1] + HEAD_DROP - SRC_HEAD)) + REST_BEND
    scale = reach / .99 / (np.hypot(*(KNEE - HIP)) + np.hypot(*(ANKLE - KNEE)))
    l1 = np.hypot(*(KNEE - HIP)) * scale
    l2 = np.hypot(*(ANKLE - KNEE)) * scale
    print(f"legs lengthened x{scale:.3f}")
    # The torso's back and front edges lost their outline where the arms were lifted off.
    edge_fix = outline(body.copy())
    sides = np.zeros(body.shape[:2], bool)
    sides[:WAIST - 3, :62] = True
    sides[:WAIST - 3, 90:] = True
    body[sides] = edge_fix[sides]

    def needed_dy(feet):
        """How far the hips must drop so every planted boot still reaches the ground."""
        hip_y = ANKLE[1] - (reach - REST_BEND)
        for x, lift, pitch, planted in feet:
            if planted:
                hip_y = max(hip_y, ANKLE[1] - math.sqrt(max(1, reach ** 2 - x ** 2)))
        return hip_y - HIP[1]

    def render(feet, dy, swing):
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
            over(layer, affine_sample(boot_src, (H, W), rot_map(ANKLE, ankle, pitch)))
            over(layer, affine_sample(shin_src, (H, W), bone_map(KNEE, ANKLE, knee, ankle)))
            over(layer, affine_sample(far_thigh_src if i else thigh_src, (H, W), bone_map(HIP, KNEE, h, knee)))
            layer = outline(layer)
            # Never through the ground: a pitched boot's heel or toe corner is lifted back onto it.
            rows = np.where(layer[..., 3].any(axis=1))[0]
            if len(rows) and rows[-1] > GROUND:
                layer = shift_y(layer, GROUND - rows[-1])
            if i == 1:  # far leg: a touch darker, like the art's far leg
                layer[..., :3] = (layer[..., :3] * .82).astype(np.uint8)
            layers.append(layer)

        body_shift = shift_y(body, dy)
        up = np.array([0, dy], float)
        near_arm = affine_sample(arms[0][0], (H, W), rot_map(arms[0][1], arms[0][1] + up, -swing))
        far_arm = affine_sample(arms[1][0], (H, W), rot_map(arms[1][1], arms[1][1] + up, swing))
        # Under each swinging arm, its unmoved upper part, so no gap opens against the torso.
        for a, _ in arms:
            base = np.zeros_like(a)
            base[:96] = a[:96]
            over(frame, shift_y(base, dy))
        over(frame, far_arm)
        over(frame, layers[1])
        over(frame, shift_y(pelvis, dy))
        over(frame, body_shift)
        over(frame, layers[0])
        # Shirt hem back over the top of the thigh.
        hem = np.zeros_like(body_shift)
        hem[:SHIRT_HEM + dy] = body_shift[:SHIRT_HEM + dy]
        over(frame, hem)
        over(frame, near_arm)
        # The sleeve goes back over the top of the swinging arm, so no arm edge pokes past it.
        sleeve = np.zeros_like(body_shift)
        sy = NEAR_ARM["box"][1] + dy + 2
        sleeve[:sy, NEAR_ARM["box"][0] - 4:] = body_shift[:sy, NEAR_ARM["box"][0] - 4:]
        over(frame, sleeve)
        # No shirt below the hem: where a thigh swung away, the shirt's corner would hang loose.
        r, g, b = (frame[..., k].astype(int) for k in range(3))
        loose = (g > r + 20) & (g > b + 20) & (frame[..., 3] > 0)
        loose[:SHIRT_HEM + dy + 5] = False
        frame[loose] = 0
        return drop_specks(close_notches(fill_holes(tidy(frame), SHIRT_HEM + dy - 2), SHIRT_HEM + dy, SHIRT_HEM + dy + 24))

    cycle = []
    for f in range(FRAMES):
        ph = f / FRAMES
        feet = []
        for off in (0.0, 0.5):   # near foot, far foot
            fp = (ph + off) % 1
            x, lift, pitch = foot_track(fp)
            feet.append((x, lift, pitch, fp < STANCE))
        cycle.append((ph, feet, needed_dy(feet)))
    # The hips bob on a smooth curve (lowest at each contact, two dips a cycle) that is never higher
    # than the planted legs allow, rather than dropping for one frame at contact.
    lo, hi = min(c[2] for c in cycle), max(c[2] for c in cycle)
    frames = []
    for ph, feet, need in cycle:
        dy = int(math.ceil(max(need, lo + (hi - lo) * (.5 + .5 * math.cos(4 * math.pi * ph))) - .01))
        # Near arm is furthest back just after the near foot strikes (phase 0 + ARM_LAG), forward half a cycle later.
        frames.append((render(feet, dy, ARM_SWING * math.cos(2 * math.pi * (ph - ARM_LAG))), dy))
    # Standing still in walking profile, boots side by side: the frame he stops on before idle.
    stand = [(STAND_GAP / 2, 0.0, 0.0, True), (-STAND_GAP / 2, 0.0, 0.0, True)]
    sdy = int(math.ceil(needed_dy(stand) - REST_BEND - .01))   # knees straight, not the walk's soft bend
    frames.append((render(stand, sdy, 0.0), sdy))

    # Facing left, the page mirrors the sprite, which would put the shirt logo backwards. The
    # second set of walk frames has the logo pre-flipped, so it reads right once mirrored.
    lx0, ly0, lx1, ly1 = LOGO_BOX
    flipped = []
    for frame, dy in frames:
        fl = frame.copy()
        fl[ly0 + dy:ly1 + dy, lx0:lx1] = frame[ly0 + dy:ly1 + dy, lx0:lx1][:, ::-1]
        flipped.append(fl)
    frames = [f for f, _ in frames] + flipped
    sheet = np.concatenate(frames, axis=1)
    poses = np.array(Image.open(IDLE_SHEET).convert("RGBA"))
    # The same pre-flipped logo for the twelve other poses (idle, blower...), for facing left.
    poses_left = poses.copy()
    for k in range(poses.shape[1] // W):
        f = poses_left[:, k * W:(k + 1) * W]
        white = (f[..., :3].min(axis=2) > 225) & (f[..., 3] > 0)
        white[:58] = False
        white[90:] = False
        ys, xs = np.where(white)
        y0, y1, x0, x1 = ys.min() - 1, ys.max() + 2, xs.min() - 1, xs.max() + 2
        f[y0:y1, x0:x1] = f[y0:y1, x0:x1][:, ::-1].copy()
    Image.fromarray(np.concatenate([poses, sheet, poses_left], axis=1), "RGBA").save(OUT, optimize=True)
    n = poses.shape[1] // W
    print("wrote", OUT, f"walk right: poses {n}-{n + FRAMES - 1} then stand {n + FRAMES}; "
          f"logo pre-flipped for walking left: {n + FRAMES + 1}-{n + 2 * FRAMES} then stand {n + 2 * FRAMES + 1}; "
          f"poses 0-{n - 1} with the logo pre-flipped: {n + 2 * FRAMES + 2}-{2 * n + 2 * FRAMES + 1}")
    if preview:
        bg = Image.new("RGBA", (sheet.shape[1], H), (226, 236, 214, 255))
        bg.alpha_composite(Image.fromarray(sheet, "RGBA"))
        bg.save(preview)


if __name__ == "__main__":
    main()
