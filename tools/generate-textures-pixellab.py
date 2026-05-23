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

# Iso floor tiles — 64x32 final canvas. Prompts kept short + explicit
# about "flat" / "minimal" / "simple" so PixelLab doesn't add busy
# noise. Combined with shading="flat shading", detail="low detail",
# outline="lineless" in gen_floor() to push for clean blocky pixel art.
FLOOR_TILES = [
    ("floor_stone",    "single flat isometric stone floor tile, plain light grey, minimal clean pixel art"),
    ("floor_wood",     "single flat isometric wooden plank floor tile, plain warm brown, two-tone planks, minimal clean pixel art"),
    ("floor_concrete", "single flat isometric concrete floor tile, plain solid grey, minimal clean pixel art"),
    ("floor_tile_w",   "single flat isometric white ceramic tile, plain white with thin grey grout cross, minimal clean pixel art"),
    ("floor_tile_d",   "single flat isometric dark slate tile, plain dark grey with thin grout cross, minimal clean pixel art"),
    ("floor_marble",   "single flat isometric marble tile, plain pale cream with one subtle grey vein, minimal clean pixel art"),
    ("floor_brick",    "single flat isometric red brick tile, plain rust red with thin mortar cross, minimal clean pixel art"),
]

# UI icons — small transparent-bg pixel-art glyphs the front-end pulls in
# as <img> tags or CSS backgrounds. 32x32 source @ 2x css = a crisp 64px
# rendered icon; smaller chrome (top-bar, send button) shrinks via CSS.
UI_ICONS = [
    ("ui_back",     "tiny pixel art chevron arrow pointing left, bold white pixels, transparent background, minimal flat"),
    ("ui_edit",     "tiny pixel art pencil icon, brown wood with grey tip, transparent background, minimal flat"),
    ("ui_profile",  "tiny pixel art smiley face icon, yellow with dot eyes and smile, transparent background, minimal flat"),
    ("ui_send",     "tiny pixel art paper airplane icon, white folded paper, transparent background, minimal flat"),
    ("ui_lock",     "tiny pixel art padlock icon, gold metal, transparent background, minimal flat"),
    ("ui_home",     "tiny pixel art house icon, red roof and brown wall, transparent background, minimal flat"),
    ("ui_rotate",   "tiny pixel art circular rotate arrow icon, white outlined arrow curving clockwise, transparent background, minimal flat"),
    ("ui_delete",   "tiny pixel art trash can icon, dark grey bin with lid, transparent background, minimal flat"),
    ("ui_check",    "tiny pixel art checkmark icon, bold green tick, transparent background, minimal flat"),
    ("ui_close",    "tiny pixel art X close icon, bold white pixels, transparent background, minimal flat"),
]

# Decorated UI panels / button skins — full PixelLab art used as CSS
# background-image (with image-rendering: pixelated). Sizes chosen to
# match the slots they fill in the HTML.
UI_PANELS = [
    # 64x32 chunky button skins. Bevel + highlight + shadow baked in so
    # we can drop our CSS rectangle borders.
    ("ui_btn_amber",         64, 32, "pixel art chunky game button face, warm amber orange with dark outline, glossy bevelled top highlight, soft inner shadow, classic Habbo Hotel UI style"),
    ("ui_btn_amber_hover",   64, 32, "pixel art chunky game button face, BRIGHT golden yellow with dark outline, glossy bevelled top highlight, hover state, classic Habbo Hotel UI style"),
    ("ui_btn_amber_active",  64, 32, "pixel art chunky rectangular button skin, BLANK darker burnt orange recessed inset, dark outline, no text no letters no symbols, retro game UI"),
    ("ui_btn_dark",          64, 32, "pixel art chunky game button face, dark slate grey with white outline, subtle bevelled top highlight, classic Habbo Hotel UI style"),
    ("ui_btn_dark_hover",    64, 32, "pixel art chunky game button face, medium slate grey with white outline, brighter bevelled top highlight, hover state, classic Habbo Hotel UI style"),
    ("ui_btn_dark_active",   64, 32, "pixel art chunky rectangular button skin, BLANK very dark grey recessed inset, white outline, no text no letters no symbols, retro game UI"),
    # 192x48 ornate header banner used by the room chip
    ("ui_panel_top", 192, 48, "pixel art game UI horizontal banner, dark wood with brass corner studs, ornate scroll edges, empty middle for label, classic Habbo Hotel dialog style"),
    # 128x40 input-field skin
    ("ui_input_bg",  128, 40, "pixel art game UI long input slot, dark inset trough with thin gold border, classic JRPG message field, empty middle"),
    # 192x192 ornate framed panel — used as a 9-slice border-image around
    # the editor panel + customiser modal. Brass corner studs, dark wood
    # border, neutral dark fill in the middle that text will sit over.
    ("ui_panel_frame", 192, 192, "pixel art game UI panel frame, square dark wood border with large brass corner studs at all four corners, decorative gold inner trim, dark navy interior fill, classic JRPG / Habbo Hotel dialog window, symmetrical and clean"),
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
        "outline": "lineless",          # no rim, lets the tile colour read flat
        "shading": "flat shading",      # no gradients — cleaner pixel art
        "detail": "low detail",         # fewer high-frequency speckles
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

def gen_icon(icon_id, desc):
    """Small 32x32 pixel-art icon with transparent background."""
    r = api_post("/create-image-pixflux", {
        "description": desc,
        "image_size": {"width": 32, "height": 32},
        "outline": "single color outline",
        "shading": "flat shading",
        "detail": "low detail",
        "no_background": True,
        "background_removal_task": "remove_simple_background",
    })
    if "background_job_id" in r:
        d = wait(r["background_job_id"]).get("last_response", {})
    else:
        d = r
    if "image" in d:
        return decode_b64(d["image"]) if isinstance(d["image"], dict) else fetch_png(d["image"])
    raise RuntimeError(f"no image in resp: {json.dumps(d)[:400]}")

def gen_panel(panel_id, w, h, desc):
    """Custom-sized pixel-art UI panel/button. Opaque, used as background."""
    r = api_post("/create-image-pixflux", {
        "description": desc,
        "image_size": {"width": w, "height": h},
        "outline": "single color outline",
        "shading": "basic shading",
        "detail": "low detail",
        "no_background": False,
    })
    if "background_job_id" in r:
        d = wait(r["background_job_id"]).get("last_response", {})
    else:
        d = r
    if "image" in d:
        return decode_b64(d["image"]) if isinstance(d["image"], dict) else fetch_png(d["image"])
    raise RuntimeError(f"no image in resp: {json.dumps(d)[:400]}")

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
    for tid, d in UI_ICONS: targets.append(("icon", tid, d))
    for tid, w, h, d in UI_PANELS: targets.append(("panel", tid, (w, h, d)))
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
            if   kind == "floor": img = gen_floor(tid, desc)
            elif kind == "wall":  img = gen_wall(tid, desc)
            elif kind == "icon":  img = gen_icon(tid, desc)
            else:
                w, h, d = desc  # panel tuple
                img = gen_panel(tid, w, h, d)
            img.save(out_p); img.save(out_m)
            print(f"[ok] {time.time()-start:.1f}s  size={img.size}")
        except Exception as e:
            print(f"[fail] {e}")
            if "HTTP 402" in str(e) or "Not enough" in str(e):
                print("Out of credits — stopping."); break

if __name__ == "__main__":
    main()
