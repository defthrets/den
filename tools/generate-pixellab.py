#!/usr/bin/env python3
"""
PixelLab character generator for Den.

Pipeline per preset:
  1. POST /v2/create-character-with-4-directions  - character_id + 4 static dir frames
  2. POST /v2/animate-character (template "walk") - 4 background jobs, one per direction
  3. Poll each job until completed, decode the 6-frame walk cycle (RGBA bytes 92x92)
  4. Compose a 6 cols × 4 rows sheet (frame, direction) at 92x92 = 552x368
  5. Save to mobile/assets/sprites/<id>.png AND preview/sprites/<id>.png

Usage:
  export PIXELLAB_API_KEY=xxxxxxxx-xxxx-...
  python tools/generate-pixellab.py              # generate missing
  python tools/generate-pixellab.py --force      # regenerate everything
  python tools/generate-pixellab.py casual_blue  # one preset by id
"""

from __future__ import annotations
import base64, json, os, sys, time
# Force UTF-8 on stdout for Windows consoles
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from pathlib import Path
from urllib import request, error
from PIL import Image

API_KEY = os.environ.get("PIXELLAB_API_KEY")
if not API_KEY:
    print("Set PIXELLAB_API_KEY env var. Get one at https://api.pixellab.ai/mcp", file=sys.stderr)
    sys.exit(1)

BASE = "https://api.pixellab.ai/v2"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# Frame size returned by PixelLab when image_size is 64x64 (canvas is ~40% larger).
FRAME_W, FRAME_H = 92, 92
WALK_FRAMES = 6
DIRECTIONS = ["south", "east", "north", "west"]  # rows in the output sheet

REPO = Path(__file__).resolve().parent.parent
MOBILE_OUT  = REPO / "mobile" / "assets" / "sprites"
PREVIEW_OUT = REPO / "preview" / "sprites"
MOBILE_OUT.mkdir(parents=True, exist_ok=True)
PREVIEW_OUT.mkdir(parents=True, exist_ok=True)

# Locked-anatomy presets — every preset shares the same body silhouette,
# light skin, oval head, dot eyes, neutral mouth, arms-at-sides pose. The
# only varied elements are HAIR, SHIRT and PANTS. This is what makes the
# slice-and-mix system actually align across presets: head ends at the
# same Y, shoulders + neck land in the same place, shoes meet legs at the
# same line.
#
# Two body archetypes:
#   BOY  → boy proportions
#   GIRL → girl proportions
# Mixing parts WITHIN a body type tracks cleanly. Mixing across types
# (boy head on girl torso) still works but the shoulder widths may differ.

BOY_BASE  = "Habbo Hotel boy avatar, light peach skin, oval head, small dot eyes, tiny neutral mouth, dark eyebrow dots, slim arms at sides, standing facing forward, dark single-pixel outline, flat shading, classic Habbo pixel art style"
GIRL_BASE = "Habbo Hotel girl avatar, light peach skin, oval head, small dot eyes, tiny neutral mouth, dark eyebrow dots, slim arms at sides, standing facing forward, dark single-pixel outline, flat shading, classic Habbo pixel art style"

PRESETS = [
    # ── Boy outfits (consistent anatomy)
    { "id": "casual_blue_boy",  "seed": 800, "detail": "high",
      "description": BOY_BASE + ", short brown hair, plain blue sweater, navy jeans, brown shoes" },
    { "id": "punk_red_boy",     "seed": 802, "detail": "high",
      "description": BOY_BASE + ", spiky bright red hair, black leather jacket over white shirt, dark jeans, black shoes" },
    { "id": "preppy_boy",       "seed": 804, "detail": "high",
      "description": BOY_BASE + ", neat blonde hair, green polo shirt with collar, khaki trousers, brown loafers" },
    { "id": "nerd_kid",         "seed": 807, "detail": "high",
      "description": BOY_BASE + ", neat brown hair, round glasses, light blue button-up shirt with dark tie, dark grey trousers, black shoes" },
    { "id": "athlete_boy",      "seed": 806, "detail": "high",
      "description": BOY_BASE + ", short black hair, red basketball jersey, dark grey shorts, white sneakers" },
    { "id": "hoodie_boy",       "seed": 820, "detail": "high",
      "description": BOY_BASE + ", messy brown hair, grey hoodie sweatshirt, faded blue jeans, white sneakers" },

    # ── Girl outfits (consistent anatomy)
    { "id": "casual_blue_girl", "seed": 801, "detail": "high",
      "description": GIRL_BASE + ", shoulder-length brown hair, plain blue jumper, navy skirt, brown shoes" },
    { "id": "blonde_yellow_girl","seed": 803, "detail": "high",
      "description": GIRL_BASE + ", long blonde hair, yellow t-shirt, blue denim shorts, white sneakers" },
    { "id": "goth_girl",        "seed": 805, "detail": "high",
      "description": GIRL_BASE + ", long black hair with side bangs, dark purple band t-shirt, black skirt, black boots" },
    { "id": "punk_girl",        "seed": 821, "detail": "high",
      "description": GIRL_BASE + ", short bright pink hair, black band tank top, plaid red skirt, black boots" },
    { "id": "preppy_girl",      "seed": 822, "detail": "high",
      "description": GIRL_BASE + ", blonde ponytail, white blouse with collar, navy skirt, brown loafers" },
    { "id": "floral_girl",      "seed": 823, "detail": "high",
      "description": GIRL_BASE + ", long brown hair, pink floral pattern dress, white sneakers" },
]

def api_post(path: str, body: dict) -> dict:
    req = request.Request(
        BASE + path,
        method="POST",
        headers=HEADERS,
        data=json.dumps(body).encode(),
    )
    try:
        with request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:400]}")

def api_get(path: str) -> dict:
    req = request.Request(BASE + path, headers=HEADERS)
    with request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def wait_for_job(job_id: str, label: str = "", timeout_s: int = 600) -> dict:
    start = time.time()
    while time.time() - start < timeout_s:
        data = api_get(f"/background-jobs/{job_id}")
        status = data.get("status", "?")
        if status == "completed":
            return data
        if status in ("failed", "error"):
            raise RuntimeError(f"Job {job_id} {status}: {json.dumps(data)[:400]}")
        time.sleep(8)
    raise RuntimeError(f"Job {job_id} timed out after {timeout_s}s")

def decode_rgba(img_data: dict) -> Image.Image:
    raw = base64.b64decode(img_data["base64"])
    w = img_data["width"]
    h = img_data.get("height") or len(raw) // (4 * w)
    return Image.frombytes("RGBA", (w, h), raw)

def create_character(preset: dict) -> str:
    print(f"  - creating character...", end="", flush=True)
    body = {
        "description": preset["description"],
        "image_size": {"width": 64, "height": 64},
        "outline": "thin",
        "shading": "flat",
        "detail": preset.get("detail", "medium"),
        "view": "side",
        "seed": preset["seed"],
    }
    r = api_post("/create-character-with-4-directions", body)
    char_id = r["character_id"]
    job_id  = r["background_job_id"]
    wait_for_job(job_id, "create")
    print(" done")
    return char_id

def animate_character(char_id: str, seed: int) -> list[Image.Image]:
    """Run walking animation, return composed 552x368 sheet.

    Uses v3 mode (custom action_description) so we get clear leg motion in
    every direction — the older template mode produced glitched south
    walks where late frames flipped to back-facing.
    """
    print(f"  - animating walk...", end="", flush=True)
    r = api_post("/animate-character", {
        "character_id": char_id,
        "animation_name": "walk",
        "action_description": "walking forward, knees bending, legs swinging alternately, arms swinging at sides, weight shifting side to side",
        "mode": "v3",
        "seed": seed,
    })
    job_ids = r["background_job_ids"]
    print(f" {len(job_ids)} jobs spawned")

    # Collect frames per direction
    frames_by_dir: dict[str, list[Image.Image]] = {}
    for jid in job_ids:
        data = wait_for_job(jid, "animate")
        resp = data["last_response"]
        direction = resp["direction"]
        imgs = resp["images"][:WALK_FRAMES]
        frames_by_dir[direction] = [decode_rgba(img) for img in imgs]
        print(f"    {direction}: {len(imgs)} frames")
    return frames_by_dir

def compose_sheet(frames_by_dir: dict[str, list[Image.Image]]) -> Image.Image:
    sheet = Image.new("RGBA", (FRAME_W * WALK_FRAMES, FRAME_H * len(DIRECTIONS)), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        frames = frames_by_dir.get(direction, [])
        for col in range(min(WALK_FRAMES, len(frames))):
            sheet.paste(frames[col], (col * FRAME_W, row * FRAME_H))
    return sheet

def main():
    args = sys.argv[1:]
    force = "--force" in args
    id_filter = next((a for a in args if not a.startswith("--")), None)
    presets = [p for p in PRESETS if (id_filter is None or p["id"] == id_filter)]
    if id_filter and not presets:
        print(f"Preset {id_filter!r} not in catalogue", file=sys.stderr)
        sys.exit(1)

    for preset in presets:
        out_mobile  = MOBILE_OUT  / f"{preset['id']}.png"
        out_preview = PREVIEW_OUT / f"{preset['id']}.png"
        if out_mobile.exists() and not force:
            print(f"{preset['id']}: [skip]  exists")
            continue
        print(f"{preset['id']}:")
        char_id = create_character(preset)
        frames  = animate_character(char_id, preset["seed"])
        sheet   = compose_sheet(frames)
        sheet.save(out_mobile)
        sheet.save(out_preview)
        print(f"  [ok] {out_mobile} ({sheet.size})")
    print("done.")

if __name__ == "__main__":
    main()
