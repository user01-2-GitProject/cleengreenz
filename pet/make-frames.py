# Builds the extra pet Chris frames (6-10) onto media/pet-chris.png from the
# original six. Usage: python3 pet/make-frames.py <original.png> <out.png> <preview.png>
import sys
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGBA')
FW, FH = 52, 50
def frame(i): return src.crop((i*FW, 0, (i+1)*FW, FH))
A=(36,24,16,255); D=(79,168,58,255); B=(47,122,38,255); C=(127,207,79,255)
G=(217,154,108,255); H=(242,191,147,255); I=(255,255,255,255); T=(0,0,0,0)

def eyes(f, left, right):
    for x, c in zip((21, 22), left): f.putpixel((x, 18), c)
    for x, c in zip((29, 30), right): f.putpixel((x, 18), c)
    return f

def arms_up(f):
    # Two raised arms from the shoulders, mirrored around the body's center.
    def px(x, y, c):
        for xx in (x, 51 - x):
            f.putpixel((xx, y), c)
    for y in range(18, 34):
        xc = round(7 + (y - 18) * 5 / 15)
        sleeve = y >= 28
        px(xc - 2, y, A); px(xc + 3, y, A)
        px(xc - 1, y, B if sleeve else G)
        px(xc, y, D if sleeve else H)
        px(xc + 1, y, D if sleeve else H)
        px(xc + 2, y, C if sleeve else H)
    # Fists
    fist = [".AAAA.", "AHHHHA", "AHHHHA", "AGHHGA", ".AAAA."]
    for dy, row in enumerate(fist):
        for dx, ch in enumerate(row):
            if ch != '.':
                px(4 + dx, 13 + dy, {'A': A, 'H': H, 'G': G}[ch])
    return f

def slump(f):
    out = f.copy()
    for y in range(29, -1, -1):
        for x in range(FW):
            out.putpixel((x, y + 1), f.getpixel((x, y)))
    for x in range(FW): out.putpixel((x, 0), T)
    return out

new = [
    eyes(frame(0), (A, I), (A, H)),            # 6 look left
    eyes(frame(0), (I, A), (H, A)),            # 7 look right
    arms_up(frame(0)),                         # 8 cheer
    arms_up(frame(5)),                         # 9 stretch (eyes shut)
    slump(frame(5)),                           # 10 doze
]
out = Image.new('RGBA', (FW * (6 + len(new)), FH), T)
out.paste(src.crop((0, 0, FW * 6, FH)), (0, 0))
for i, f in enumerate(new): out.paste(f, (FW * (6 + i), 0))
out.save(sys.argv[2], optimize=True)
prev = Image.new('RGBA', out.size, (255, 255, 255, 255)); prev.alpha_composite(out)
prev.resize((out.width * 5, out.height * 5), Image.NEAREST).save(sys.argv[3])
