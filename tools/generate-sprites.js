#!/usr/bin/env node
/**
 * Retro Diffusion sprite generator for Den.
 *
 * Usage:
 *   export RETRO_DIFFUSION_API_KEY=rd-xxxxx
 *   node tools/generate-sprites.js              # generate any missing sprites
 *   node tools/generate-sprites.js --force      # regenerate everything
 *   node tools/generate-sprites.js casual_blue  # generate one preset by id
 *   node tools/generate-sprites.js --cost       # estimate cost without spending
 *
 * Reads tools/manifest.json. Saves PNG sprite sheets into both
 * mobile/assets/sprites/ and preview/sprites/ so both runtimes can load them.
 */

const fs   = require('fs').promises;
const path = require('path');

const API_KEY = process.env.RETRO_DIFFUSION_API_KEY;
if (!API_KEY) {
  console.error('Set RETRO_DIFFUSION_API_KEY env var.');
  console.error('Get a key from https://www.retrodiffusion.ai/app/devtools');
  process.exit(1);
}

const API_URL = 'https://api.retrodiffusion.ai/v1/inferences';

const args   = process.argv.slice(2);
const FORCE  = args.includes('--force');
const COST   = args.includes('--cost');
const idFilter = args.find(a => !a.startsWith('--'));

/**
 * Look for a reference image to feed as `input_image`:
 *   1. references/<preset-id>.png (per-preset)
 *   2. references/_global.png     (fallback for all presets)
 * Returns the base64-encoded bytes (no data: prefix) or null.
 */
async function loadReferenceImage(presetId) {
  const repoRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(repoRoot, 'references', `${presetId}.png`),
    path.join(repoRoot, 'references', '_global.png'),
  ];
  for (const p of candidates) {
    try {
      const buf = await fs.readFile(p);
      return { base64: buf.toString('base64'), source: path.relative(repoRoot, p) };
    } catch {/* try next */}
  }
  return null;
}

async function callApi(item, extra = {}) {
  const body = {
    prompt: item.prompt,
    prompt_style: item.style,
    width: item.width,
    height: item.height,
    num_images: 1,
    return_spritesheet: true,
    seed: item.seed,
    ...extra,
  };

  // Inject input_image if a reference is available for this preset
  const ref = await loadReferenceImage(item.id);
  if (ref && !('input_image' in body)) {
    body.input_image = ref.base64;
    process.stdout.write(`(ref: ${ref.source}) `);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'X-RD-Token': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

  try { return JSON.parse(text); }
  catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
}

async function generate(item) {
  const start = Date.now();
  process.stdout.write(`→ ${item.id.padEnd(20)} `);

  const data = await callApi(item);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!data.base64_images || data.base64_images.length === 0) {
    throw new Error(`No images in response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  process.stdout.write(
    `✓ ${elapsed}s  cost ${data.balance_cost}  balance ${data.remaining_balance}\n`,
  );
  return data.base64_images[0];
}

async function checkCost(item) {
  const data = await callApi(item, { check_cost: true });
  return data.balance_cost;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const manifest = JSON.parse(
    await fs.readFile(path.join(__dirname, 'manifest.json'), 'utf8'),
  );

  const mobileOut  = path.join(repoRoot, manifest.outputs.mobile);
  const previewOut = path.join(repoRoot, manifest.outputs.preview);
  await ensureDir(mobileOut);
  await ensureDir(previewOut);

  const presets = idFilter
    ? manifest.presets.filter(p => p.id === idFilter)
    : manifest.presets;

  if (presets.length === 0) {
    console.error(idFilter ? `Preset "${idFilter}" not found.` : 'No presets in manifest.');
    process.exit(1);
  }

  if (COST) {
    let total = 0;
    for (const p of presets) {
      const c = await checkCost(p);
      console.log(`  ${p.id.padEnd(20)} ${c} credits`);
      total += c;
    }
    console.log(`Total estimated cost: ${total.toFixed(2)} credits`);
    return;
  }

  let spent = 0;
  for (const item of presets) {
    const mobilePath  = path.join(mobileOut,  `${item.id}.png`);
    const previewPath = path.join(previewOut, `${item.id}.png`);

    if (!FORCE) {
      try {
        await fs.access(mobilePath);
        console.log(`  ${item.id.padEnd(20)} ⏭  exists (use --force to regenerate)`);
        continue;
      } catch {}
    }

    try {
      const base64 = await generate(item);
      const buf = Buffer.from(base64, 'base64');
      await fs.writeFile(mobilePath,  buf);
      await fs.writeFile(previewPath, buf);
      spent++;
    } catch (e) {
      console.error(`  ${item.id.padEnd(20)} ✗  ${e.message}`);
    }
  }

  console.log(`Done. Generated ${spent} sprite sheet(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
