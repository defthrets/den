# Den sprite generator

Generates avatar sprite sheets via the [Retro Diffusion API](https://www.retrodiffusion.ai/app/devtools).

## How it works

`generate-sprites.js` reads `manifest.json`, calls
`POST https://api.retrodiffusion.ai/v1/inferences` for each preset, and writes
the resulting PNG into both:

- `mobile/assets/sprites/<id>.png` — bundled into the Flutter app via `pubspec.yaml`
- `preview/sprites/<id>.png` — served by the HTML preview

Both runtimes load the same files, so a sprite generated once works in both places.

## Usage

```powershell
# 1. Get an API key from https://www.retrodiffusion.ai/app/devtools
$env:RETRO_DIFFUSION_API_KEY = "rd-xxxxxxxxxxxxxx"

# 2. Estimate cost before spending credits
node tools/generate-sprites.js --cost

# 3. Generate missing sprites
node tools/generate-sprites.js

# Other modes:
node tools/generate-sprites.js casual_blue   # one preset
node tools/generate-sprites.js --force       # regenerate everything
```

## Manifest format

Each entry in `manifest.json -> presets[]`:

| Field   | Required | Notes                                                                                          |
|---------|----------|------------------------------------------------------------------------------------------------|
| `id`    | yes      | Output filename without extension. Becomes `<id>.png`.                                         |
| `prompt`| yes      | Description of the character. Always end with "on transparent background" for cleaner cutout.  |
| `style` | yes      | A `prompt_style` from RD's catalogue (see below).                                              |
| `width` | yes      | Must match the style's required size — see notes below.                                        |
| `height`| yes      | "                                                                                              |
| `seed`  | no       | Stable seed so re-runs produce identical output.                                               |

### Relevant styles

| `prompt_style`                          | Size    | What it produces                                              |
|-----------------------------------------|---------|---------------------------------------------------------------|
| `rd_animation__walking_and_idle`        | 48×48   | 4-direction walk + idle, one sprite sheet                     |
| `rd_animation__small_sprites`           | 32×32   | 4-dir walk + arm wave + look + surprised + lay down           |
| `rd_animation__four_angle_walking`      | 48×48   | 4-direction × 4-frame walk only                               |
| `rd_animation__8_dir_rotation`          | 80×80   | 8-direction static rotation (for Habbo-style iso 8 dirs)      |
| `rd_fast__character_turnaround`         | 64–384  | Static turnaround sheet, no animation                          |
| `rd_advanced_animation__walking`        | 32–256  | Walks from an `input_image` reference (consistency across outfits) |

The animation styles output 4-row sprite sheets (one row per direction).
The renderer slices the sheet at runtime based on the `width`/`height` and frame count.

## After a successful run

1. The script saves PNGs to both target directories.
2. The renderer (Flame in Flutter, canvas in the preview) picks them up next refresh — no code change needed *unless* you added a new preset id that isn't referenced anywhere yet.
3. For new preset ids, register them in the wardrobe catalogue (`mobile/lib/features/avatar/wardrobe.dart` and `preview/wardrobe.js`).

## Cost

Animation calls run ~0.25 credits each. With the 4 presets in the default manifest,
a full regeneration is ~1 credit. Use `--cost` first to confirm.

## Troubleshooting

- **`401`** — `X-RD-Token` missing or wrong. Re-check `RETRO_DIFFUSION_API_KEY`.
- **`400 insufficient balance`** — top up credits at retrodiffusion.ai.
- **Empty `base64_images`** — the prompt failed safety filters. Tweak wording and rerun.
- **Sprite has white background instead of transparent** — RD's animation styles output transparent PNG by default. If you see white, double-check `return_spritesheet: true` is in the request (the script always sends it).
