"""
Crop a single Habbo character out of a busy room screenshot and convert
it to an RGB PNG suitable for Retro Diffusion's `input_image` parameter
(which doesn't accept transparency).

Usage:
    python tools/prep-reference.py references/y6Gl7.png 380 175 64 90

Args: <input.png> <crop-x> <crop-y> <crop-w> <crop-h>

Output: references/_global.png  (RGB, no alpha)
"""
import sys
from PIL import Image

if len(sys.argv) != 6:
    print(__doc__)
    sys.exit(1)

src, x, y, w, h = sys.argv[1], *map(int, sys.argv[2:6])

img = Image.open(src).convert('RGBA')
crop = img.crop((x, y, x + w, y + h))

# Composite over white so transparency becomes opaque
bg = Image.new('RGB', crop.size, (255, 255, 255))
bg.paste(crop, mask=crop.split()[3] if crop.mode == 'RGBA' else None)

# Upscale a bit so the character has room to breathe in the input_image,
# but keep nearest-neighbour to preserve pixel-art look.
upscale = 2
out_w, out_h = bg.size[0] * upscale, bg.size[1] * upscale
bg = bg.resize((out_w, out_h), Image.NEAREST)

out_path = 'references/_global.png'
bg.save(out_path)
print(f'Wrote {out_path}: {bg.size}')
