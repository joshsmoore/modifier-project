/**
 * Verifies every image within a subject (glass / apples) has identical
 * dimensions. The compare views rely on this — a mismatch would show
 * two subjects at slightly different scales.
 *
 * Fails the build on mismatch. Warns on any image we can't probe.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shotsPath = resolve(root, 'src/data/shots.yaml');
const baselinesPath = resolve(root, 'src/data/baselines.yaml');
const assetsDir = resolve(root, 'src/assets/shots');

type ShotRow = { image: string; subject: 'glass' | 'apples' };

async function dims(filename: string) {
  const meta = await sharp(resolve(assetsDir, filename)).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read dimensions for ${filename}`);
  }
  return { w: meta.width, h: meta.height };
}

async function main() {
  const shots = parseYaml(await readFile(shotsPath, 'utf8')) as ShotRow[];
  const baselines = parseYaml(await readFile(baselinesPath, 'utf8')) as ShotRow[];
  const rows = [...shots, ...baselines];

  const bySubject: Record<string, string[]> = { glass: [], apples: [] };
  for (const r of rows) bySubject[r.subject]?.push(r.image);

  const errors: string[] = [];
  for (const [subject, images] of Object.entries(bySubject)) {
    if (images.length === 0) continue;
    const first = await dims(images[0]!);
    for (const img of images.slice(1)) {
      const d = await dims(img);
      if (d.w !== first.w || d.h !== first.h) {
        errors.push(
          `  ${subject}: ${img} is ${d.w}×${d.h}, expected ${first.w}×${first.h} (from ${images[0]}).`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('Dimension mismatch — compare views require consistent dimensions per subject:');
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(`validate-dimensions: OK (${rows.length} images checked).`);
}

await main();
