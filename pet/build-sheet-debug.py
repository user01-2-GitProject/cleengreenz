"""Build media/pet-chris-poses-debug.png from media/pet-chris-poses-v4.png.

This tool generates an annotated sprite sheet with frame indices, ground lines, and frame boundaries
so that all 58 animated poses can pass visual/agent quality review.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

IN_SHEET = "media/pet-chris-poses-v4.png"
OUT_SHEET = "media/pet-chris-poses-debug.png"
W, H = 192, 200

def main():
    img = Image.open(IN_SHEET).convert("RGBA")
    total_w, h = img.size
    num_frames = total_w // W

    # Create canvas with green background for transparency inspection
    canvas = Image.new("RGBA", (total_w, h + 30), (220, 235, 210, 255))
    canvas.paste(img, (0, 0), img)

    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    # Ground line at y=197
    draw.line([(0, 197), (total_w, 197)], fill=(200, 50, 50, 255), width=1)

    for i in range(num_frames):
        x0 = i * W
        x1 = x0 + W
        # Draw frame border
        draw.rectangle([(x0, 0), (x1 - 1, H - 1)], outline=(100, 140, 90, 180), width=1)
        # Draw frame index label
        label = f"#{i}"
        draw.text((x0 + 6, H + 8), label, fill=(40, 60, 20, 255), font=font)

    canvas.save(OUT_SHEET, optimize=True)
    print(f"Wrote {OUT_SHEET}: {num_frames} frames, {canvas.size}")

if __name__ == "__main__":
    main()
