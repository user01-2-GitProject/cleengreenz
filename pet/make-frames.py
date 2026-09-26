# Draws media/pet-chris.png: pet Chris as an 11-frame 8-bit sprite sheet.
#
# Usage: python3 pet/make-frames.py media/pet-chris.png [preview.png]
#
# The sheet is 11 frames of 52x50, drawn on screen at 2x (104x100 per frame).
# Frames: 0 idle, 1-2 walk, 3 leaf blower, 4 cap doff, 5 blink,
#         6 look left, 7 look right, 8 cheer, 9 stretch, 10 doze.
#
# Chris is built from ASCII rows so the proportions stay readable and easy to
# tweak: head y2-21 (43%), torso y22-34 (28%), legs y35-48 (30%). The earlier
# sprite gave the head 60% and drew no torso at all, so he read as a bust
# balanced on two legs, and the leaf blower floated with no arm holding it.
import sys
from PIL import Image

FW, FH = 52, 50
BOX_X, BOX_Y = 13, 2          # top-left of the 26-wide column the body sits in
BOX_W = 26

PALETTE = {
    'A': (36, 24, 16, 255),     # outline
    'D': (79, 168, 58, 255),    # green, main
    'B': (47, 122, 38, 255),    # green, shadow
    'C': (127, 207, 79, 255),   # green, highlight
    'M': (122, 74, 40, 255),    # hair and beard
    'K': (78, 46, 24, 255),     # hair and beard, shadow
    'H': (242, 191, 147, 255),  # skin
    'G': (217, 154, 108, 255),  # skin, shadow
    'I': (255, 255, 255, 255),  # eye glint
    'P': (201, 168, 120, 255),  # work pants
    'Q': (168, 135, 90, 255),   # work pants, shadow
    'R': (90, 59, 34, 255),     # boots
    'O': (226, 112, 42, 255),   # blower orange
    '.': (0, 0, 0, 0),
}

# --- the body, row by row (each row is BOX_W wide) ------------------------

HEAD = [
    '.........AAAAAAAA.........',  # y2  cap crown
    '.......ACCDDDDDDDDA.......',
    '......ACCDDDDDDDDDDA......',
    '.....ACDDDDDDDDDDDDDA.....',
    '.....ACDDDDDDDDDDDDDA.....',
    '.....ABBBBBBBBBBBBBBA.....',  # y7  cap band
    '.....ABBBBBBBBBBBBBBBBBBA.',  # y8  brim, swept to his left
    '......AMMHHHHHHHHMMA......',  # y9  hairline
    '......AMHHHHHHHHHHMA......',
    '......AMHAIHHHHAIHMA......',  # y11 eyes (replaced per frame)
    '......AMHHHHHHHHHHMA......',
    '......AMHHHHGGHHHHMA......',  # y13 nose
    '......AMMHHGGGGHHMMA......',
    '......AMMMMHHHHMMMMA......',
    '......AMMMMMKKMMMMMA......',  # y16 mouth
    '......AMMMMMMMMMMMMA......',
    '........AMMMMMMMMA........',  # y18 beard tapers
    '.........AMMMMMMA.........',
    '..........AMMMMA..........',
    '..........AGGGGA..........',  # y21 neck
]

TORSO = [
    '.......ADDDBBBBDDDA.......',  # y22 shoulders and neckline
    '...ACDDACDDDDDDDDBACDDA...',  # y23 sleeves
    '...ACDDACDDDDDDDDBACDDA...',
    '...ACDDACDDDDDDDDBACDDA...',
    '...ACDDACDDDDDDDDBACDDA...',
    '...AHHGACDDDDDDDDBAHHGA...',  # y27 forearms
    '...AHHGACDDDDDDDDBAHHGA...',
    '...AHHGACDDDDDDDDBAHHGA...',
    '...AGHGACDDDDDDDDBAGHGA...',  # y30 hands
    '...AAAAACDDDDDDDDBAAAAA...',
    '.......ACDDDDDDDDBA.......',
    '.......ACDDDDDDDDBA.......',
    '.......AKKKKKKKKKKA.......',  # y34 belt
]

LEGS = [
    '.......APPPQAAPPPQA.......',  # y35
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',
    '.......APPPQAAPPPQA.......',  # y44
    '.......ARRRRAARRRRA.......',  # y45 boots
    '.......ARRRRAARRRRA.......',
    '......ARRRRRAARRRRRA......',
    '......AAAAAAAAAAAAAA......',  # y48
]

# Legs mid-stride, for the walk cycle.
LEGS_STRIDE = [
    '......APPPQA..APPPQA......',
    '......APPPQA..APPPQA......',
    '......APPPQA..APPPQA......',
    '......APPPQA..APPPQA......',
    '......APPPQA..APPPQA......',
    '.....APPPQA....APPPQA.....',
    '.....APPPQA....APPPQA.....',
    '.....APPPQA....APPPQA.....',
    '.....APPPQA....APPPQA.....',
    '.....APPPQA....APPPQA.....',
    '.....ARRRRA....ARRRRA.....',
    '.....ARRRRA....ARRRRA.....',
    '....ARRRRRA....ARRRRRA....',
    '....AAAAAA......AAAAAA....',
]

# Bare head, for the cap doff (replaces the cap rows y2-8).
HAIR = [
    '.........AAAAAAAA.........',
    '.......AMMMMMMMMMMA.......',
    '......AMMKKMMMMMMMMA......',
    '.....AMMKKMMMMMMMMMMA.....',
    '.....AMMMMMMMMMMMMMMA.....',
    '.....AMMMMMMMMMMMMMMA.....',
    '......AMMMMMMMMMMMMA......',
]

# Eye row (y11). The sockets sit at x21-23 and x28-30; the pupil moves inside
# them, so Chris can glance about without the eyes changing shape.
EYES = {
    'idle':  '......A' + 'MHAIHHHHAIHM' + 'A......',
    'left':  '......A' + 'MAIHHHHAIHHM' + 'A......',
    'right': '......A' + 'MHHAIHHHHAIM' + 'A......',
    'shut':  '......A' + 'MHAAHHHHAAHM' + 'A......',
}

# Props, stamped at an (x, y) in frame space.
BLOWER = [
    '.AAAAAA........',
    'AKKKKKKA.......',
    'AKOOOOKA.......',
    'AKOOOOKAAAAAAA.',
    'AKOOOOKOOOOOOA.',
    'AKOOOOKOOOOOOA.',
    'AKKKKKKAAAAAAA.',
    '.AAAAAA........',
]

CAP_HELD = [
    '...AAAA...',
    '..ADDDDA..',
    '.ADDDDDDA.',
    '.ADDDDDDA.',
    '.ABBBBBBAA',
    '..AAAAAAAA',
]

# A raised left arm, y12-23: fist clear of the head, slanting in to meet the
# shoulder at x20. Reversed row-wise for the right arm.
ARM_UP = [
    '..AAA...',
    '.AHHHA..',
    '.AHHHA..',
    '.AGGGA..',
    '.AAHAA..',
    '..AHA...',
    '..AHA...',
    '...AHA..',
    '...AHA..',
    '....ADA.',
    '.....ADA',
    '.....AAA',
]

# Torso rows y23-31 with the arms left off, for the raised-arm poses.
TORSO_BARE = ['.......ACDDDDDDDDBA.......'] * 9


def check(name, rows, width, count=None):
    if count is not None and len(rows) != count:
        raise SystemExit('%s has %d rows, expected %d' % (name, len(rows), count))
    for i, r in enumerate(rows):
        if len(r) != width:
            raise SystemExit('%s row %d is %d wide, expected %d: %r'
                             % (name, i, len(r), width, r))


check('HEAD', HEAD, BOX_W, 20)
check('TORSO', TORSO, BOX_W, 13)
check('LEGS', LEGS, BOX_W, 14)
check('LEGS_STRIDE', LEGS_STRIDE, BOX_W, 14)
check('HAIR', HAIR, BOX_W, 7)
check('EYES', list(EYES.values()), BOX_W)
check('ARM_UP', ARM_UP, 8, 12)
check('BLOWER', BLOWER, 15, 8)
check('CAP_HELD', CAP_HELD, 10, 6)


def stamp(img, art, x, y):
    """Draw an ASCII sprite at (x, y); '.' leaves what is underneath."""
    for dy, row in enumerate(art):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            px, py = x + dx, y + dy
            if 0 <= px < FW and 0 <= py < FH:
                img.putpixel((px, py), PALETTE[ch])


def build(head=None, torso=None, legs=None, eyes='idle', drop=0):
    """Assemble one frame. `drop` slides head and torso down, for the doze."""
    img = Image.new('RGBA', (FW, FH), (0, 0, 0, 0))
    head = list(head or HEAD)
    head[9] = EYES[eyes]
    stamp(img, head, BOX_X, BOX_Y + drop)
    stamp(img, torso or TORSO, BOX_X, BOX_Y + len(HEAD) + drop)
    stamp(img, legs or LEGS, BOX_X, BOX_Y + len(HEAD) + len(TORSO))
    return img


def mirror_x(x):
    """Mirror a frame-space column about the body's centre line."""
    return FW - 1 - x


frames = []

# 0 idle
frames.append(build())

# 1-2 walk: mid-stride, then feet together a pixel higher on the up-beat.
frames.append(build(legs=LEGS_STRIDE))
frames.append(build().crop((0, 1, FW, FH + 1)))

# 3 leaf blower, gripped in his right hand
f = build()
stamp(f, BLOWER, 34, 26)
frames.append(f)

# 4 cap doff: cap off the head, held out at chest height
f = build(head=HAIR + HEAD[7:])
stamp(f, ['AHHA', 'AHHA'], 35, 29)
stamp(f, CAP_HELD, 38, 26)
frames.append(f)

# 5 blink
frames.append(build(eyes='shut'))

# 6-7 glancing about
frames.append(build(eyes='left'))
frames.append(build(eyes='right'))

# 8-9 cheer and stretch: both arms up, eyes open then shut
for eyes in ('idle', 'shut'):
    f = build(torso=[TORSO[0]] + TORSO_BARE + TORSO[10:], eyes=eyes)
    stamp(f, ARM_UP, 12, 12)
    stamp(f, [r[::-1] for r in ARM_UP], mirror_x(19), 12)
    frames.append(f)

# 10 doze: head and torso settle a pixel, eyes shut
frames.append(build(eyes='shut', drop=1))

out = sys.argv[1] if len(sys.argv) > 1 else 'media/pet-chris.png'
sheet = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
for i, f in enumerate(frames):
    sheet.paste(f, (FW * i, 0))
sheet.save(out, optimize=True)
print('wrote %s: %d frames, %dx%d' % (out, len(frames), sheet.width, sheet.height))

if len(sys.argv) > 2:
    prev = Image.new('RGBA', sheet.size, (255, 255, 255, 255))
    prev.alpha_composite(sheet)
    prev.resize((sheet.width * 5, sheet.height * 5), Image.NEAREST).save(sys.argv[2])
