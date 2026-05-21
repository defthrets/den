#!/usr/bin/env python3
"""
PixelLab furniture generator for Den.

Each item is created via POST /v2/objects with:
  directions = 1  (single static angle — furniture doesn't rotate)
  view = "low top-down"  (closest to our 2:1 iso projection)
  n_frames = 1
  no_background = true

Output: mobile/assets/furniture/<id>.png + preview/furniture/<id>.png

Usage:
  export PIXELLAB_API_KEY=...
  python tools/generate-furniture-pixellab.py            # missing only
  python tools/generate-furniture-pixellab.py --force    # regenerate all
  python tools/generate-furniture-pixellab.py chair_wood # one item
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
MOBILE_OUT  = REPO / "mobile" / "assets" / "furniture"
PREVIEW_OUT = REPO / "preview" / "furniture"
MOBILE_OUT.mkdir(parents=True, exist_ok=True)
PREVIEW_OUT.mkdir(parents=True, exist_ok=True)

# Default image_size sent to PixelLab. Final PNG is always padded to
# 96x96 so the renderer's FURNITURE_FRAME_W stays consistent.
DEFAULT_SIZE = 96
FRAME = 96

# Per-piece overrides. Smaller image_size = smaller pixel-art at 1:1 render.
# These are the pieces the user asked to be smaller — 5/2026.
PIECE_SIZE = {
    "chair_wood": 48,
    "bed_blue":   80,
    "computer":   48,
    "tv_crt":     64,
    "fridge":     80,
}

# Each entry: (id, description, seed)
CATALOG = [
    ("chair_wood",  "wooden dining chair, simple flat shading, Habbo Hotel furniture style", 900),
    ("sofa_red",    "red two-seater sofa couch with plush cushions, Habbo Hotel furniture style", 901),
    ("bed_blue",    "single bed with blue blanket and white pillow, wooden frame, Habbo Hotel furniture style", 902),
    ("plant_tall",  "tall potted houseplant with green leaves in terracotta pot, Habbo Hotel furniture style", 903),
    ("table_round", "round wooden coffee table with four legs, Habbo Hotel furniture style", 904),
    ("lamp_floor",  "floor lamp with cream lampshade and brass stand, Habbo Hotel furniture style", 905),
    ("rug_persian", "persian rug with red and gold ornate pattern, flat on the floor, Habbo Hotel furniture style", 906),
    ("bookshelf",   "tall wooden bookshelf filled with colorful books, Habbo Hotel furniture style", 907),
    ("tv_crt",      "retro CRT television on a low stand with antenna, dark grey casing, Habbo Hotel furniture style", 908),
    ("fridge",      "tall white kitchen appliance with a door, Habbo Hotel furniture style", 909),
    ("desk_wood",   "small wooden desk with one drawer, Habbo Hotel furniture style", 910),
    ("computer",    "beige retro desktop computer with CRT monitor and keyboard, Habbo Hotel furniture style", 911),
    ("fish_tank",   "rectangular glass aquarium with two orange fish, green plants and blue water, Habbo Hotel furniture style", 912),
    ("painting",    "framed wall painting of a green landscape with gold frame, Habbo Hotel furniture style", 913),
    ("doorway",     "isometric wooden entry doorway with door frame, open door, single object, Habbo Hotel furniture style", 914),
    ("window",      "isometric square window with white frame and blue sky visible through it, single wall-mounted object, Habbo Hotel furniture style", 915),
]

def api_post(path: str, body: dict) -> dict:
    req = request.Request(BASE + path, method="POST", headers=HEADERS, data=json.dumps(body).encode())
    try:
        with request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")

def api_get(path: str) -> dict:
    req = request.Request(BASE + path, headers=HEADERS)
    with request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def wait_for_job(job_id: str, timeout_s: int = 600) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        data = api_get(f"/background-jobs/{job_id}")
        status = data.get("status", "?")
        if status == "completed": return data
        if status in ("failed", "error"):
            raise RuntimeError(f"Job {job_id} {status}: {json.dumps(data)[:400]}")
        time.sleep(6)
    raise RuntimeError(f"Job {job_id} timed out")

def decode_rgba(img_data: dict) -> Image.Image:
    raw = base64.b64decode(img_data["base64"])
    w = img_data["width"]
    h = img_data.get("height") or len(raw) // (4 * w)
    return Image.frombytes("RGBA", (w, h), raw)

def generate_item(item_id: str, description: str, seed: int) -> Image.Image:
    # New API (v2 as of 2026-05): POST /create-8-direction-object → poll
    # background job → GET /objects/{id} → fetch the south-east rotation URL
    # (iso 3/4 view; horizontal flip at render gives south-west).
    # NB: the API no longer accepts `seed`, `directions`, or `no_background`.
    size = PIECE_SIZE.get(item_id, DEFAULT_SIZE)
    print(f"  POST /create-8-direction-object (size={size})...", end="", flush=True)
    r = api_post("/create-8-direction-object", {
        "description": description,
        "size": size,
        "view": "low top-down",
    })
    job_id    = r["background_job_id"]
    object_id = r["object_id"]
    wait_for_job(job_id)
    obj = api_get(f"/objects/{object_id}")
    rotations = obj.get("rotation_urls") or {}
    url = rotations.get("south-east")
    if not url:
        # Fall back to any rotation URL we can find.
        for k in ("south", "south-west", "east", "west"):
            url = rotations.get(k)
            if url: break
    if not url:
        raise RuntimeError(f"No image URLs in object {object_id}: {json.dumps(obj)[:400]}")
    return _fetch_png(url)

def _fetch_png(url: str) -> Image.Image:
    from io import BytesIO
    # Backblaze CDN rejects the default Python User-Agent — set a real one.
    req = request.Request(url, headers={"User-Agent": "Mozilla/5.0 (den-tools)"})
    with request.urlopen(req, timeout=60) as r:
        return Image.open(BytesIO(r.read())).convert("RGBA")

def _extract_image(resp: dict) -> Image.Image:
    """Find an image somewhere in the PixelLab response (inline base64
    or a storage URL). NOTE: `directions` in a response is the int echoed
    from the request body, not a container."""
    if "images" in resp and resp["images"]:
        return decode_rgba(resp["images"][0])
    if "image" in resp and isinstance(resp["image"], dict):
        return decode_rgba(resp["image"])
    storage = resp.get("storage_urls")
    if isinstance(storage, dict):
        # Prefer south-east (iso 3/4 view) when available
        for preferred in ("south-east", "unknown"):
            if preferred in storage and isinstance(storage[preferred], str):
                return _fetch_png(storage[preferred])
        # Fall back to the first http URL we find
        for _key, url in storage.items():
            if isinstance(url, str) and url.startswith("http"):
                return _fetch_png(url)
    raise RuntimeError(f"No image in response: {json.dumps(resp)[:500]}")

def main():
    args = sys.argv[1:]
    force = "--force" in args
    id_filter = next((a for a in args if not a.startswith("--")), None)
    items = [c for c in CATALOG if (id_filter is None or c[0] == id_filter)]
    if id_filter and not items:
        print(f"No item {id_filter!r}", file=sys.stderr); sys.exit(1)

    print(f"Furniture: {len(items)} items")
    for i, (item_id, desc, seed) in enumerate(items, 1):
        out_m = MOBILE_OUT  / f"{item_id}.png"
        out_p = PREVIEW_OUT / f"{item_id}.png"
        if out_m.exists() and not force:
            print(f"[{i:>2}/{len(items)}] {item_id:<24} [skip]")
            continue
        start = time.time()
        print(f"[{i:>2}/{len(items)}] {item_id:<24} ", end="", flush=True)
        try:
            img = generate_item(item_id, desc, seed)
            # Pad/crop into a 96x96 frame (bottom-aligned, horizontally centred)
            # so renderer constants stay constant regardless of requested size.
            if img.size != (FRAME, FRAME):
                canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
                bbox = img.getbbox() or (0, 0, img.size[0], img.size[1])
                content = img.crop(bbox)
                cw, ch = content.size
                x = (FRAME - cw) // 2
                y = FRAME - ch - 4  # 4 px floor padding, normalize will refine
                canvas.paste(content, (x, y))
                img = canvas
            img.save(out_m); img.save(out_p)
            print(f" [ok] {time.time()-start:.1f}s")
        except Exception as e:
            print(f" [fail] {e}")
            if "HTTP 402" in str(e) or "Not enough" in str(e):
                print("Out of credits — stopping."); break

if __name__ == "__main__":
    main()
