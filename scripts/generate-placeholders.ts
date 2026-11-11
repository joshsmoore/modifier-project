/**
 * Generates a grey JPEG placeholder for every image referenced by
 * shots.yaml / baselines.yaml that doesn't already exist in
 * src/assets/shots/. Real photos are never overwritten.
 *
 * Each placeholder is a slightly different shade so adjacent modifiers
 * are distinguishable while scaffolding.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shotsPath = resolve(root, 'src/data/shots.yaml');
const baselinesPath = resolve(root, 'src/data/baselines.yaml');
const outDir = resolve(root, 'src/assets/shots');

const W = 1997;
const H = 3000; // 2:3 portrait, matching the exported photos

function hashSeed(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function shadeFor(filename: string): number {
  // Grey range 20-55 so placeholders are visible but still clearly placeholders.
  return Math.round(20 + hashSeed(filename) * 35);
}

async function ensurePlaceholder(filename: string) {
  const outPath = resolve(outDir, filename);
  if (existsSync(outPath)) return { filename, created: false };

  const shade = shadeFor(filename);
  const label = filename.replace(/\.[^.]+$/, '');
  const svgOverlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <text x="50%" y="50%" fill="rgba(255,255,255,0.18)"
            font-family="ui-monospace, monospace" font-size="42"
            text-anchor="middle" dominant-baseline="middle">
        ${label}
      </text>
    </svg>`,
  );

  await sharp({
    create: {
      width: W,
      height: H,
      channels: 3,
      background: { r: shade, g: shade, b: shade },
    },
  })
    .composite([{ input: svgOverlay }])
    .jpeg({ quality: 82 })
    .toFile(outPath);

  return { filename, created: true };
}

async function collectFilenames(): Promise<Set<string>> {
  const files = new Set<string>();
  const shotsText = await readFile(shotsPath, 'utf8');
  const shots = parseYaml(shotsText) as Array<{
    image: string;
    setupImage?: string;
  }>;
  for (const row of shots) {
    if (row.image) files.add(row.image);
    if (row.setupImage) files.add(row.setupImage);
  }

  const baselinesText = await readFile(baselinesPath, 'utf8');
  const baselines = parseYaml(baselinesText) as Array<{ image: string }>;
  for (const row of baselines) {
    if (row.image) files.add(row.image);
  }
  return files;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const files = await collectFilenames();
  const results = await Promise.all([...files].map(ensurePlaceholder));
  const created = results.filter((r) => r.created).length;
  const skipped = results.length - created;
  console.log(
    `placeholders: ${created} created, ${skipped} already present (${files.size} total).`,
  );
}

await main();
