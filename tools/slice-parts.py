#!/usr/bin/env python3
"""
Slice every character sprite sheet into 4 part-sheets so the customiser
can mix heads / torsos / legs / shoes from different presets.

Each input sheet is 6 cols (walk frames) x 4 rows (directions) of 276x276
frames (1656x1104 total). We crop the same vertical Y-band from every
frame and write it as a NEW sheet of the same dimensions, with everything
outside the band fully transparent.

Bands (in 276-px frame coords, 3x scale of the original 92-px):
    head : y =   0 .. 92   (top ~33% — head + neck)
    torso: y =  92 .. 165  (chest + arms)
    legs : y = 165 .. 240  (thighs + shins)
    shoes: y = 240 .. 276  (feet)

Output: preview/sprites/<part>_<preset>.png  (also mirrored to mobile).

Usage:
  python tools/slice-parts.py            # slice every preset
  python tools/slice-parts.py punk_red_boy
"""

from __future__ import annotations
import os, sys
from pathlib import Path
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent
PREVIEW = REPO / "preview" / "sprites"
MOBILE  = REPO / "mobile" / "assets" / "sprites"

FRAME = 92           # source frame size (PixelLab character API returns 92x92)
COLS, ROWS = 6, 4    # 6 walk frames per direction, 4 directions

# Vertical bands per part, in source-pixel Y coords within one 92x92 frame.
# Hand-tuned to match the anatomy of the PixelLab character generator:
# head sits at ~0..30, torso/chest at ~30..55, legs ~55..78, shoes ~78..92.
BANDS = {
    "head":  (0,    30),
    "torso": (30,   55),
    "legs":  (55,   78),
    "shoes": (78,   92),
}

# Presets that exist as full character sheets — only these get sliced.
PRESETS = [
    # Boys
    "casual_blue_boy", "punk_red_boy", "preppy_boy",
    "nerd_kid", "athlete_boy", "hoodie_boy",
    "eshay_boy", "gym_bro", "suit_boy", "skater_boy",
    # Girls
    "casual_blue_girl", "blonde_yellow_girl", "goth_girl",
    "punk_girl", "preppy_girl", "floral_girl",
    "club_girl", "suit_girl", "gym_girl", "cocktail_girl",
]

def slice_one(src_path: Path, part: str, y0: int, y1: int) -> Image.Image:
    """Return a full-sheet image with only the band [y0..y1) of each
    frame copied — rest is transparent."""
    src = Image.open(src_path).convert("RGBA")
    w, h = src.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for r in range(ROWS):
        for c in range(COLS):
            fx = c * FRAME
            fy = r * FRAME
            # Crop the band from the source frame
            band = src.crop((fx, fy + y0, fx + FRAME, fy + y1))
            out.paste(band, (fx, fy + y0))
    return out

def main():
    args = sys.argv[1:]
    only = args[0] if args else None
    targets = [p for p in PRESETS if (only is None or p == only)]
    if only and not targets:
        print(f"No preset named {only!r}", file=sys.stderr); sys.exit(1)

    print(f"Slicing {len(targets)} preset(s) x {len(BANDS)} parts...")
    for preset in targets:
        src_path = PREVIEW / f"{preset}.png"
        if not src_path.exists():
            print(f"  [skip] {preset} (no source sheet)"); continue
        for part, (y0, y1) in BANDS.items():
            out = slice_one(src_path, part, y0, y1)
            for d in (PREVIEW, MOBILE):
                d.mkdir(parents=True, exist_ok=True)
                out.save(d / f"{part}_{preset}.png")
            print(f"  {part}_{preset}.png  (y {y0}..{y1})")
    print("done.")

if __name__ == "__main__":
    main()
