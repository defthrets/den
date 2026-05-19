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

# Image size for furniture. 96 matches our existing renderer constants.
SIZE = 96

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
    ("fridge",      "white kitchen refrigerator with chrome handle, Habbo Hotel furniture style", 909),
    ("desk_wood",   "small wooden desk with one drawer, Habbo Hotel furniture style", 910),
    ("computer",    "beige retro desktop computer with CRT monitor and keyboard, Habbo Hotel furniture style", 911),
    ("fish_tank",   "rectangular glass aquarium with two orange fish, green plants and blue water, Habbo Hotel furniture style", 912),
    ("painting",    "framed wall painting of a green landscape with gold frame, Habbo Hotel furniture style", 913),
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
    print(f"  POST /objects...", end="", flush=True)
    r = api_post("/objects", {
        "description": description,
        "directions": 1,
        "image_size": {"width": SIZE, "height": SIZE},
        "view": "low top-down",
        "n_frames": 1,
        "no_background": True,
        "seed": seed,
    })
    # Some responses come back synchronously with the image already attached.
    try:
        return _extract_image(r)
    except RuntimeError:
        pass
    if "background_job_id" in r:
        job_id = r["background_job_id"]
    elif "background_job_ids" in r and r["background_job_ids"]:
        job_id = r["background_job_ids"][0]
    else:
        raise RuntimeError(f"Unexpected response: {json.dumps(r)[:400]}")

    data = wait_for_job(job_id)
    resp = data.get("last_response", {})
    return _extract_image(resp)

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
            img.save(out_m); img.save(out_p)
            print(f" [ok] {time.time()-start:.1f}s")
        except Exception as e:
            print(f" [fail] {e}")
            if "HTTP 402" in str(e) or "Not enough" in str(e):
                print("Out of credits — stopping."); break

if __name__ == "__main__":
    main()
