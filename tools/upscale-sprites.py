#!/usr/bin/env python3
"""
Upscale every sprite/furniture PNG by an integer factor using
nearest-neighbour, so each ORIGINAL art pixel becomes an N×N block in
the file. At zoom = 2/3 the canvas then renders each original pixel as
a clean 2×2 block instead of fractionally aliased fragments.

The visual content is identical to the originals — just at higher source
resolution, so downsampling lands on integer screen pixels everywhere.

Run:
  python tools/upscale-sprites.py        # 3x everything
  python tools/upscale-sprites.py --factor 2
"""

from __future__ import annotations
import sys
from pathlib import Path
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent
TARGETS = [
    REPO / "mobile" / "assets" / "sprites",
    REPO / "mobile" / "assets" / "furniture",
    REPO / "preview" / "sprites",
    REPO / "preview" / "furniture",
]

def upscale(path: Path, factor: int) -> str:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    new = img.resize((w * factor, h * factor), Image.NEAREST)
    new.save(path)
    return f"{w}x{h} -> {new.size[0]}x{new.size[1]}"

def main():
    args = sys.argv[1:]
    factor = 3
    if "--factor" in args:
        i = args.index("--factor")
        factor = int(args[i + 1])
    print(f"upscaling by {factor}x (nearest neighbour)\n")
    for d in TARGETS:
        if not d.is_dir():
            print(f"  [skip] {d} (missing)")
            continue
        for png in sorted(d.glob("*.png")):
            msg = upscale(png, factor)
            print(f"  {png.name:<30} {msg}")
    print("\ndone.")

if __name__ == "__main__":
    main()
