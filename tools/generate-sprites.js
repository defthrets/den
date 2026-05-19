#!/usr/bin/env node
/**
 * Retro Diffusion sprite generator for Den.
 *
 * Usage:
 *   export RETRO_DIFFUSION_API_KEY=rd-xxxxx
 *   node tools/generate-sprites.js                # generate any missing
 *   node tools/generate-sprites.js --force        # regenerate everything
 *   node tools/generate-sprites.js --force --only=avatars
 *   node tools/generate-sprites.js --force --only=furniture
 *   node tools/generate-sprites.js casual_blue    # one item by id
 *
 * Reads tools/manifest.json. Manifest has two arrays:
 *   - avatars[]   → animation sprite sheets (32x32 × 5x4)
 *   - furniture[] → static iso assets       (64x64–96x96)
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
const ONLY   = args.find(a => a.startsWith('--only='))?.split('=')[1];   // avatars | furniture
const idFilter = args.find(a => !a.startsWith('--'));

const isAnimationStyle = s =>
  s.startsWith('rd_animation__') || s.startsWith('rd_advanced_animation__');

/**
 * Look for a reference image to feed as `input_image`:
 *   1. references/<id>.png  (per-item)
 *   2. references/_global.png (fallback)
 */
async function loadReferenceImage(id) {
  const repoRoot = path.resolve(__dirname, '..');
  for (const candidate of [
    path.join(repoRoot, 'references', `${id}.png`),
    path.join(repoRoot, 'references', '_global.png'),
  ]) {
    try {
      const buf = await fs.readFile(candidate);
      return { base64: buf.toString('base64'), source: path.relative(repoRoot, candidate) };
    } catch {/* try next */}
  }
  return null;
}

async function callApi(item, kind) {
  const animation = isAnimationStyle(item.style);
  const body = {
    prompt: item.prompt,
    prompt_style: item.style,
    width: item.width,
    height: item.height,
    num_images: 1,
    seed: item.seed,
  };
  if (animation) body.return_spritesheet = true;
  // Static items need a transparent background; the AI tends to paint a
  // beige neutral background otherwise. RD's background_removal service
  // handles the cleanup.
  if (!animation && kind === 'furniture') body.remove_bg = true;

  // Only animation styles support input_image. Static styles use
  // reference_images (rd_pro only) or no reference at all.
  if (animation && kind === 'avatars') {
    const ref = await loadReferenceImage(item.id);
    if (ref) {
      body.input_image = ref.base64;
      process.stdout.write(`(ref: ${ref.source}) `);
    }
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

async function generate(item, kind) {
  const start = Date.now();
  process.stdout.write(`→ ${item.id.padEnd(20)} `);
  const data = await callApi(item, kind);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (!data.base64_images || data.base64_images.length === 0) {
    throw new Error(`No images in response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  process.stdout.write(`✓ ${elapsed}s  cost ${data.balance_cost}  balance ${data.remaining_balance}\n`);
  return data.base64_images[0];
}

async function processGroup(items, kind, outDirs) {
  if (items.length === 0) return 0;
  console.log(`\n${kind} (${items.length})`);

  let spent = 0;
  for (const item of items) {
    if (idFilter && item.id !== idFilter) continue;

    const mobilePath  = path.join(outDirs.mobile,  `${item.id}.png`);
    const previewPath = path.join(outDirs.preview, `${item.id}.png`);

    if (!FORCE) {
      try {
        await fs.access(mobilePath);
        console.log(`  ${item.id.padEnd(20)} ⏭  exists`);
        continue;
      } catch {}
    }

    try {
      const base64 = await generate(item, kind);
      const buf = Buffer.from(base64, 'base64');
      await fs.writeFile(mobilePath,  buf);
      await fs.writeFile(previewPath, buf);
      spent++;
    } catch (e) {
      console.error(`  ${item.id.padEnd(20)} ✗  ${e.message}`);
    }
  }
  return spent;
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const manifest = JSON.parse(
    await fs.readFile(path.join(__dirname, 'manifest.json'), 'utf8'),
  );

  const avatarOut = {
    mobile:  path.join(repoRoot, manifest.outputs.mobile_avatars),
    preview: path.join(repoRoot, manifest.outputs.preview_avatars),
  };
  const furnitureOut = {
    mobile:  path.join(repoRoot, manifest.outputs.mobile_furniture),
    preview: path.join(repoRoot, manifest.outputs.preview_furniture),
  };
  for (const d of [avatarOut.mobile, avatarOut.preview, furnitureOut.mobile, furnitureOut.preview]) {
    await fs.mkdir(d, { recursive: true });
  }

  let total = 0;
  if (!ONLY || ONLY === 'avatars')   total += await processGroup(manifest.avatars   ?? [], 'avatars',   avatarOut);
  if (!ONLY || ONLY === 'furniture') total += await processGroup(manifest.furniture ?? [], 'furniture', furnitureOut);

  console.log(`\nDone. Generated ${total} sprite(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
