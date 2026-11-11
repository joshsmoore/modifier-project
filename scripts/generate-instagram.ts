/**
 * Generate Instagram-sized 4:5 images (1080×1350) for one or many
 * modifiers, with the shot settings burned into a strip along the top.
 *
 *   npm run instagram -- <arg>
 *   tsx scripts/generate-instagram.ts <arg>
 *
 * <arg> is resolved in this order:
 *   1. Exact modifier slug      — e.g. "speedlight"            → 1 modifier
 *   2. Modifier class           — e.g. "bare" | "snoot"        → every modifier in that class
 *   3. Slug prefix              — e.g. "magsnoot" | "softbox-24" → every modifier whose slug starts with it
 *
 * Subject shots (glass, apples) are center-cropped 2:3 → 4:5.
 * Setup shots are rotated 90° (landscape → portrait) and then cropped
 * to 4:5. Setup files are deduped — one IG crop per unique setup photo.
 *
 * Output: instagram/<slug>_<subject>_ig.jpg
 */
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const IG_W = 1080;
const IG_H = 1350;
const BAND_H = 180;
const PAD_X = 56;

type ShotRow = {
  id: string;
  modifier: string;
  subject: 'glass' | 'apples';
  image: string;
  iso: number;
  power: string;
  distance: number;
  setupImage?: string;
};

type ModifierMeta = {
  slug: string;
  name: string;
  class: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadModifiers(): Promise<Map<string, ModifierMeta>> {
  const dir = resolve(root, 'src/content/modifiers');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const out = new Map<string, ModifierMeta>();
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const md = await readFile(resolve(dir, file), 'utf8');
    const fm = md.match(/^---\n([\s\S]+?)\n---/);
    if (!fm) continue;
    const parsed = parseYaml(fm[1]!) as { name?: string; class?: string };
    out.set(slug, {
      slug,
      name: parsed.name ?? slug,
      class: parsed.class ?? '',
    });
  }
  return out;
}

function pickSlugs(arg: string, modifiers: Map<string, ModifierMeta>): string[] {
  if (modifiers.has(arg)) return [arg];

  const classMatches = [...modifiers.values()]
    .filter((m) => m.class === arg)
    .map((m) => m.slug)
    .sort();
  if (classMatches.length > 0) return classMatches;

  const prefixMatches = [...modifiers.keys()]
    .filter((slug) => slug.startsWith(arg))
    .sort();
  return prefixMatches;
}

function overlaySvg(title: string, settings: string, tag: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IG_W}" height="${IG_H}">
       <rect x="0" y="0" width="${IG_W}" height="${BAND_H}"
             fill="rgba(10,10,10,0.78)"/>
       <text x="${PAD_X}" y="72"
             fill="#e8e8e8"
             font-family="Helvetica, Arial, sans-serif"
             font-size="52" font-weight="600">${esc(title)}</text>
       <text x="${PAD_X}" y="128"
             fill="#a8a8a8"
             font-family="Menlo, Courier, monospace"
             font-size="30" letter-spacing="2">${esc(settings)}</text>
       <text x="${IG_W - PAD_X}" y="128"
             text-anchor="end"
             fill="#6a6a6a"
             font-family="Menlo, Courier, monospace"
             font-size="24" letter-spacing="3">${esc(tag)}</text>
     </svg>`,
  );
}

type RenderOpts = {
  title: string;
  settings: string;
  tag: string;
  rotate?: boolean;
};

async function renderCrop(srcFile: string, outFile: string, opts: RenderOpts): Promise<void> {
  const srcPath = resolve(root, 'src/assets/shots', srcFile);

  let pipeline = sharp(srcPath);
  if (opts.rotate) pipeline = pipeline.rotate(-90);
  const buf = await pipeline.toBuffer();
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error(`Cannot read dimensions for ${srcFile}`);

  const srcW = meta.width;
  const srcH = meta.height;
  const srcAR = srcW / srcH;
  const targetAR = IG_W / IG_H;

  let left = 0;
  let top = 0;
  let w = srcW;
  let h = srcH;
  if (srcAR < targetAR) {
    h = Math.round(srcW / targetAR);
    top = Math.round((srcH - h) / 2);
  } else if (srcAR > targetAR) {
    w = Math.round(srcH * targetAR);
    left = Math.round((srcW - w) / 2);
  }

  await sharp(buf)
    .extract({ left, top, width: w, height: h })
    .resize(IG_W, IG_H, { fit: 'cover' })
    .composite([{ input: overlaySvg(opts.title, opts.settings, opts.tag) }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(outFile);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run instagram -- <slug | class | prefix>');
    process.exit(1);
  }

  const modifiers = await loadModifiers();
  const slugs = pickSlugs(arg, modifiers);
  if (slugs.length === 0) {
    console.error(`No match for "${arg}".`);
    const classes = [...new Set([...modifiers.values()].map((m) => m.class))].filter(Boolean).sort();
    console.error(`\nClasses: ${classes.join(', ')}`);
    console.error(`\nSlugs: ${[...modifiers.keys()].sort().join(', ')}`);
    process.exit(1);
  }

  const shotsText = await readFile(resolve(root, 'src/data/shots.yaml'), 'utf8');
  const allShots = parseYaml(shotsText) as ShotRow[];
  const outDir = resolve(root, 'instagram');
  await mkdir(outDir, { recursive: true });

  console.log(`Matched ${slugs.length} modifier(s): ${slugs.join(', ')}`);

  for (const slug of slugs) {
    const mod = modifiers.get(slug)!;
    const shots = allShots.filter((s) => s.modifier === slug);
    if (shots.length === 0) {
      console.log(`  ${slug}: (no shots in shots.yaml — skipped)`);
      continue;
    }

    console.log(`\n${mod.name}`);
    for (const row of shots) {
      const settings = `${row.power}  ·  ${row.distance}"  ·  ISO ${row.iso}`;
      const outFile = resolve(outDir, `${slug}_${row.subject}_ig.jpg`);
      await renderCrop(row.image, outFile, {
        title: mod.name,
        settings,
        tag: row.subject.toUpperCase(),
      });
      console.log(`  ✓ ${slug}_${row.subject}_ig.jpg`);
    }

    // Dedupe setup images: only one IG crop per unique setup photo.
    const setups = new Set(shots.map((s) => s.setupImage).filter((v): v is string => !!v));
    for (const setupFile of setups) {
      const settings = `${shots[0]!.power}  ·  ${shots[0]!.distance}"  ·  ISO ${shots[0]!.iso}`;
      const outFile = resolve(outDir, `${slug}_setup_ig.jpg`);
      await renderCrop(setupFile, outFile, {
        title: mod.name,
        settings,
        tag: 'SETUP',
        rotate: true,
      });
      console.log(`  ✓ ${slug}_setup_ig.jpg (rotated)`);
    }
  }
}

await main();
