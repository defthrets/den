#!/usr/bin/env python3
"""
Shrink ONE furniture piece's content within its 96x96 frame using
nearest-neighbour. Pads back to 96x96 so the frame size stays consistent.
After shrinking, run normalize-furniture.py to re-align base and centre.

Usage:
  python tools/shrink-piece.py bed_blue --to 64
"""
import sys
from pathlib import Path
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent
DIRS = [
    REPO / "mobile" / "assets" / "furniture",
    REPO / "preview" / "furniture",
]
FRAME = 96

def shrink(path: Path, target: int) -> str:
    img = Image.open(path).convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        return "skip (empty)"
    left, top, right, bottom = bbox
    cropped = img.crop(bbox)
    w, h = cropped.size
    scale = min(target / w, target / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    shrunk = cropped.resize((new_w, new_h), Image.NEAREST)
    canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = (FRAME - new_w) // 2
    y = FRAME - new_h - 4  # leave 4 px floor padding (matches TARGET_BASE_Y)
    canvas.paste(shrunk, (x, y))
    canvas.save(path)
    return f"{w}x{h} -> {new_w}x{new_h} at ({x},{y})"

def main():
    args = sys.argv[1:]
    if "--to" not in args or len(args) < 3:
        print("usage: shrink-piece.py <piece_id> --to <target_size>", file=sys.stderr)
        sys.exit(1)
    piece = args[0]
    target = int(args[args.index("--to") + 1])
    for d in DIRS:
        p = d / f"{piece}.png"
        if not p.exists():
            print(f"  [skip] {p}")
            continue
        msg = shrink(p, target)
        print(f"  {p}: {msg}")

if __name__ == "__main__":
    main()
