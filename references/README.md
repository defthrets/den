# Reference images

Drop reference PNGs here and the generator will pass them to Retro
Diffusion's `input_image` parameter for style-matching.

## How it works

`tools/generate-sprites.js` looks for two kinds of references:

1. **Per-preset reference** — `references/<preset-id>.png` is used as
   `input_image` for that specific preset only.
2. **Global reference** — `references/_global.png` is used for any
   preset that doesn't have its own per-preset reference.

The image is base64-encoded RGB, no transparency, no `data:image/png;base64,`
prefix. The generator strips the alpha channel if present and inlines
the bytes for you.

## Requirements

- PNG format
- 32x32 to 256x256 px
- Single subject preferred (crop out backgrounds and other characters
  if possible — the model interprets the whole frame)
- For animation styles like `rd_animation__small_sprites`, a neutral
  standing pose works best

## Copyright note

Don't commit copyrighted reference images. The folder is `.gitignore`-d
below for that reason. Use references locally for style guidance, then
rely on the AI-generated derivatives (which sit in `mobile/assets/sprites/`
and `preview/sprites/`) as the actual project assets.
