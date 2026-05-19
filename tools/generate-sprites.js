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
 *   - avatars[]   → single-stage animation sheets, OR two-stage
 *                  (static rd_plus then rd_advanced_animation__walking).
 *   - furniture[] → static iso assets (rd_plus__isometric_asset).
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
const ONLY   = args.find(a => a.startsWith('--only='))?.split('=')[1];
const idFilter = args.find(a => !a.startsWith('--'));

const isAnimationStyle = s =>
  s.startsWith('rd_animation__') || s.startsWith('rd_advanced_animation__');

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

async function callApi(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'X-RD-Token': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); }
  catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }
}

function buildBody(item, extra = {}) {
  const body = {
    prompt: item.prompt,
    prompt_style: item.style,
    width: item.width,
    height: item.height,
    num_images: 1,
    seed: item.seed,
    ...extra,
  };
  if (isAnimationStyle(item.style)) body.return_spritesheet = true;
  if (item.remove_bg) body.remove_bg = true;
  return body;
}

/** Single-stage: one API call. */
async function generateSingle(item) {
  const body = buildBody(item);
  const data = await callApi(body);
  if (!data.base64_images || data.base64_images.length === 0) {
    throw new Error(`No images: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { base64: data.base64_images[0], cost: data.balance_cost, balance: data.remaining_balance };
}

/** Two-stage: static -> animated. Returns the animated sheet. */
async function generateTwoStage(item) {
  // Stage 1: optionally feed a Habbo-style reference as `reference_images`
  // so the rd_plus model anchors to the right visual language.
  const stage1Extra = {};
  const ref = await loadReferenceImage(item.id);
  if (ref) {
    stage1Extra.reference_images = [ref.base64];
    process.stdout.write(`(ref) `);
  }
  const stage1Body = buildBody(item.stage1, stage1Extra);
  process.stdout.write('s1... ');
  const s1 = await callApi(stage1Body);
  if (!s1.base64_images || s1.base64_images.length === 0) {
    throw new Error(`Stage 1 returned no images: ${JSON.stringify(s1).slice(0, 200)}`);
  }
  const staticPng = s1.base64_images[0];

  // Stage 2: feed the static as input_image
  const stage2Body = {
    ...buildBody(item.stage2, {
      input_image: staticPng,
      ...(item.stage2.frames_duration ? { frames_duration: item.stage2.frames_duration } : {}),
    }),
  };
  // Animation styles always want return_spritesheet for our pipeline
  stage2Body.return_spritesheet = true;
  process.stdout.write('s2... ');
  const s2 = await callApi(stage2Body);
  if (!s2.base64_images || s2.base64_images.length === 0) {
    throw new Error(`Stage 2 returned no images: ${JSON.stringify(s2).slice(0, 200)}`);
  }

  const cost = (s1.balance_cost ?? 0) + (s2.balance_cost ?? 0);
  return { base64: s2.base64_images[0], cost: cost.toFixed(3), balance: s2.remaining_balance };
}

async function generate(item, kind) {
  const start = Date.now();
  process.stdout.write(`→ ${item.id.padEnd(20)} `);

  // Inject reference image if available (single-stage avatars only)
  if (kind === 'avatars' && !item.kind && isAnimationStyle(item.style)) {
    const ref = await loadReferenceImage(item.id);
    if (ref) {
      item = { ...item, input_image: ref.base64 };
      process.stdout.write(`(ref) `);
    }
  }
  if (kind === 'furniture' && !isAnimationStyle(item.style)) {
    item = { ...item, remove_bg: true };
  }

  let result;
  if (item.kind === 'two_stage') {
    result = await generateTwoStage(item);
  } else {
    result = await generateSingle(item);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  process.stdout.write(`✓ ${elapsed}s  cost ${result.cost}  balance ${result.balance}\n`);
  return result.base64;
}

async function processGroup(items, kind, outDirs) {
  if (!items?.length) return 0;
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
  if (!ONLY || ONLY === 'avatars')   total += await processGroup(manifest.avatars,   'avatars',   avatarOut);
  if (!ONLY || ONLY === 'furniture') total += await processGroup(manifest.furniture, 'furniture', furnitureOut);
  console.log(`\nDone. Generated ${total} sprite(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
