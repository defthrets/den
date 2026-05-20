#!/usr/bin/env python3
"""
Normalise the vertical position of every furniture PNG so each piece's
visual base sits at a consistent Y inside the 96x96 frame.

Without this, PixelLab places objects at varying heights inside the
canvas — small items end up centred and look like they're floating,
big items sit on the bottom edge. We can't get them all to sit on
the tile cleanly with a single anchor unless their bases align.

Workflow:
  1. Find the row index of the BOTTOM-most non-transparent pixel.
  2. Shift the whole image vertically so that row lands at TARGET_BASE_Y.
  3. Write the result back to disk in both mobile/ and preview/.

Run:
  python tools/normalize-furniture.py            # all files
  python tools/normalize-furniture.py chair_wood # one file
"""

import sys
from pathlib import Path
from PIL import Image
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent
MOBILE_DIR  = REPO / "mobile" / "assets" / "furniture"
PREVIEW_DIR = REPO / "preview" / "furniture"

# Where the base of each piece should land in the 96-px frame.
# 92 leaves 4 px of breathing room below — looks better than dead-bottom
# because the iso tile diamond extends slightly below tile center.
TARGET_BASE_Y = 92

def bottom_opaque_row(img):
    """Return the Y of the lowest row that has any non-transparent pixel."""
    a = img.split()[3]
    pixels = a.load()
    w, h = img.size
    for y in range(h - 1, -1, -1):
        for x in range(w):
            if pixels[x, y] > 8:  # threshold to skip near-transparent
                return y
    return -1

def normalize(path: Path) -> str:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    base = bottom_opaque_row(img)
    if base < 0:
        return "skip (no opaque pixels)"
    delta = TARGET_BASE_Y - base  # positive = shift down, negative = shift up
    if delta == 0:
        return f"already at base={base}"
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(img, (0, delta))
    canvas.save(path)
    return f"base {base} -> {TARGET_BASE_Y} (shifted {delta:+d}px)"

def main():
    args = sys.argv[1:]
    only = next((a for a in args if not a.startswith("--")), None)

    files = sorted(MOBILE_DIR.glob("*.png"))
    if only:
        files = [f for f in files if f.stem == only]
        if not files:
            print(f"No furniture named {only!r}", file=sys.stderr); sys.exit(1)

    for src in files:
        msg = normalize(src)
        # Mirror to preview/ — same PNG in both
        twin = PREVIEW_DIR / src.name
        Image.open(src).save(twin)
        print(f"  {src.stem:<20} {msg}")

if __name__ == "__main__":
    main()
