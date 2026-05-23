#!/usr/bin/env python3
"""
Generate PixelLab wall/floor textures for Den.

  - Floor tiles:    POST /v2/create-isometric-tile  -> single iso diamond PNG
  - Wall patterns:  POST /v2/create-image-pixflux   -> seamless tileable square

Output:
  preview/textures/floor_<id>.png
  preview/textures/wall_<id>.png
  (mirrored to mobile/assets/textures/)

Usage:
  export PIXELLAB_API_KEY=...
  python tools/generate-textures-pixellab.py              # generate missing
  python tools/generate-textures-pixellab.py --force      # regenerate all
  python tools/generate-textures-pixellab.py floor_wood   # one
"""

from __future__ import annotations
import base64, json, os, sys, time
from pathlib import Path
from urllib import request, error
from PIL import Image
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

API_KEY = os.environ.get("PIXELLAB_API_KEY")
if not API_KEY:
    print("Set PIXELLAB_API_KEY env var.", file=sys.stderr); sys.exit(1)

BASE = "https://api.pixellab.ai/v2"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

REPO = Path(__file__).resolve().parent.parent
MOBILE_OUT  = REPO / "mobile" / "assets" / "textures"
PREVIEW_OUT = REPO / "preview" / "textures"
MOBILE_OUT.mkdir(parents=True, exist_ok=True)
PREVIEW_OUT.mkdir(parents=True, exist_ok=True)

# Iso floor tiles — 64x32 final canvas (matches TILE_W x TILE_H in renderer).
FLOOR_TILES = [
    ("floor_stone",    "isometric grey stone floor tile, flat shading, classic Habbo pixel art"),
    ("floor_wood",     "isometric wooden plank floor tile, warm brown grain, classic Habbo pixel art"),
    ("floor_concrete", "isometric concrete floor tile, light grey, faint surface speckle, classic Habbo pixel art"),
    ("floor_tile_w",   "isometric white ceramic tile floor with subtle grout, classic Habbo pixel art"),
    ("floor_tile_d",   "isometric dark slate floor tile with grout lines, classic Habbo pixel art"),
    ("floor_marble",   "isometric polished marble floor tile, cream white with grey veining, classic Habbo pixel art"),
    ("floor_brick",    "isometric red brick floor tile with mortar lines, classic Habbo pixel art"),
]

# Wall patterns — seamless square that we tile across the wall quad.
# 64x64 keeps the texture small enough to repeat clearly.
WALL_PATTERNS = [
    ("wall_beige",      "seamless tileable pixel-art wallpaper, plain beige cream texture, very subtle shading, classic Habbo style"),
    ("wall_powderblue", "seamless tileable pixel-art wallpaper, soft powder blue texture, very subtle shading, classic Habbo style"),
    ("wall_mint",       "seamless tileable pixel-art wallpaper, pale mint green texture, very subtle shading, classic Habbo style"),
    ("wall_rose",       "seamless tileable pixel-art wallpaper, dusty rose pink texture, very subtle shading, classic Habbo style"),
    ("wall_charcoal",   "seamless tileable pixel-art wallpaper, dark charcoal grey texture, very subtle noise, classic Habbo style"),
    ("wall_vict_red",   "seamless tileable Victorian wallpaper, deep red background with small gold damask diamond motif, ornate pixel art"),
    ("wall_vict_green", "seamless tileable Victorian wallpaper, deep forest green background with small gold damask diamond motif, ornate pixel art"),
    ("wall_vict_navy",  "seamless tileable Victorian wallpaper, deep navy blue background with small gold damask diamond motif, ornate pixel art"),
]

def api_post(path, body):
    req = request.Request(BASE + path, method="POST", headers=HEADERS, data=json.dumps(body).encode())
    with request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

def api_get(path):
    req = request.Request(BASE + path, headers={"Authorization": HEADERS["Authorization"]})
    with request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def wait(jid, timeout_s=300):
    start = time.time()
    while time.time() - start < timeout_s:
        d = api_get(f"/background-jobs/{jid}")
        s = d.get("status")
        if s == "completed": return d
        if s in ("failed","error"):
            raise RuntimeError(f"job {jid} {s}: {json.dumps(d)[:300]}")
        time.sleep(6)
    raise RuntimeError(f"job {jid} timeout")

def fetch_png(url):
    from io import BytesIO
    req = request.Request(url, headers={"User-Agent":"Mozilla/5.0 (den-tools)"})
    with request.urlopen(req, timeout=60) as r:
        return Image.open(BytesIO(r.read())).convert("RGBA")

def decode_b64(d):
    """Decode a Base64Image. New API returns the raw PNG bytes b64-encoded,
    so we hand it to PIL via BytesIO rather than treating it as raw RGBA."""
    from io import BytesIO
    raw = base64.b64decode(d["base64"])
    return Image.open(BytesIO(raw)).convert("RGBA")

def gen_floor(tile_id, desc):
    """Iso tile PNG. POST returns a job + tile_id; after the job completes
    we GET /isometric-tiles/{tile_id} to retrieve the actual image."""
    r = api_post("/create-isometric-tile", {
        "description": desc,
        "image_size": {"width": 64, "height": 64},
        "isometric_tile_size": 32,
        "isometric_tile_shape": "thin tile",
        "outline": "single color outline",
        "shading": "basic shading",
    })
    tile_pl_id = r.get("tile_id")
    jid = r.get("background_job_id")
    if jid: wait(jid)
    if not tile_pl_id:
        raise RuntimeError(f"no tile_id in resp: {json.dumps(r)[:400]}")
    obj = api_get(f"/isometric-tiles/{tile_pl_id}")
    if "image" in obj:
        return decode_b64(obj["image"])
    raise RuntimeError(f"no image in obj: {json.dumps(obj)[:400]}")

def gen_wall(pattern_id, desc):
    """Returns a 64x64 tileable wallpaper square via /create-image-pixflux."""
    r = api_post("/create-image-pixflux", {
        "description": desc,
        "image_size": {"width": 64, "height": 64},
        "outline": "lineless",
        "shading": "flat shading",
        "detail": "low detail",
        "no_background": False,
    })
    if "background_job_id" in r:
        d = wait(r["background_job_id"]).get("last_response", {})
    else:
        d = r
    if "images" in d and d["images"]:
        return decode_b64(d["images"][0])
    if "image" in d:
        return decode_b64(d["image"]) if isinstance(d["image"], dict) else fetch_png(d["image"])
    for v in (d.get("storage_urls") or {}).values():
        if isinstance(v, str) and v.startswith("http"):
            return fetch_png(v)
    raise RuntimeError(f"no image in resp: {json.dumps(d)[:400]}")

def main():
    args = sys.argv[1:]
    force = "--force" in args
    only = next((a for a in args if not a.startswith("--")), None)

    targets = []
    for tid, d in FLOOR_TILES: targets.append(("floor", tid, d))
    for tid, d in WALL_PATTERNS: targets.append(("wall", tid, d))
    if only: targets = [t for t in targets if t[1] == only]

    print(f"Textures: {len(targets)} target(s)")
    for kind, tid, desc in targets:
        out_p = PREVIEW_OUT / f"{tid}.png"
        out_m = MOBILE_OUT / f"{tid}.png"
        if out_p.exists() and not force:
            print(f"  [skip] {tid}")
            continue
        start = time.time()
        print(f"  generating {tid:<20} ", end="", flush=True)
        try:
            img = gen_floor(tid, desc) if kind == "floor" else gen_wall(tid, desc)
            img.save(out_p); img.save(out_m)
            print(f"[ok] {time.time()-start:.1f}s  size={img.size}")
        except Exception as e:
            print(f"[fail] {e}")
            if "HTTP 402" in str(e) or "Not enough" in str(e):
                print("Out of credits — stopping."); break

if __name__ == "__main__":
    main()
