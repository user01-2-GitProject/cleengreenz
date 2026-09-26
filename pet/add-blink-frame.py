"""Append a blink frame to the five-pose Chris sprite sheet.

Run from the repository root after rebuilding the five-pose sheet.
The eyelids change only a few pixels; all other idle artwork is preserved.
"""
from PIL import Image

sheet_path = "media/pet-chris-poses.png"
sheet = Image.open(sheet_path).convert("RGBA")
assert sheet.size in ((960, 200), (1152, 200))
idle = sheet.crop((0, 0, 192, 200))
blink = idle.copy()

# The original 84x198 idle art is placed at x=34 in the 192x200 pose frame.
skin = (234, 140, 99, 255)
skin_light = (251, 170, 116, 255)
lid = (69, 35, 24, 255)
for left, right in ((38, 44), (52, 57)):
    for x in range(left, right + 1):
        blink.putpixel((x + 34, 25), skin_light)
        blink.putpixel((x + 34, 26), lid)
        blink.putpixel((x + 34, 27), skin)

out = Image.new("RGBA", (1152, 200))
out.alpha_composite(sheet.crop((0, 0, 960, 200)))
out.alpha_composite(blink, (960, 0))
out.save(sheet_path, optimize=True)
print("added blink frame 5 to", sheet_path)
