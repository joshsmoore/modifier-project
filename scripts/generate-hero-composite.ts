/**
 * Builds the home-page hero: a 2x2 composite of four random real shots.
 *
 * Layout (user-specified):
 *   apple  glass
 *   glass  apple
 *
 * "Real" means the file is not one of the grey placeholders — detected by
 * channel stdev. Placeholders are flat grey + a text label, so their stdev
 * is near zero; real photos run in the dozens.
 *
 * Writes src/assets/shots/_hero.jpg. If fewer than 2 real shots exist for
 * either subject, it writes a copy of speedlight_glass.jpg so the page
 * still renders. Overwrites on every run so the composite reshuffles.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shotsPath = resolve(root, 'src/data/shots.yaml');
const shotsDir = resolve(root, 'src/assets/shots');
const outPath = resolve(shotsDir, '_hero.jpg');
const fallback = resolve(shotsDir, 'speedlight_glass.jpg');

const W = 1997;
const H = 3000;
const halfW = Math.floor(W / 2);
const halfH = H - halfW; // stay exact: 3000 - 998 = 2002, but we want halves of H too.
// Correction: we want each quadrant to be half the canvas in BOTH dimensions.
const QW = Math.floor(W / 2); // 998
const QH = Math.floor(H / 2); // 1500
const CANVAS_W = QW * 2; // 1996
const CANVAS_H = QH * 2; // 3000

// Placeholders are near-solid grey — avg channel stdev is ~0.5. Real photos
// are ~40+. 5 is comfortably between.
const PLACEHOLDER_STDEV = 5;

type Row = { id: string; image: string; subject: 'glass' | 'apples' };

async function isRealPhoto(file: string): Promise<boolean> {
  try {
    const stats = await sharp(file).stats();
    const avg =
      stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) /
      Math.min(3, stats.channels.length);
    return avg > PLACEHOLDER_STDEV;
  } catch {
    return false;
  }
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

async function quadrant(file: string): Promise<Buffer> {
  return sharp(file).resize(QW, QH, { fit: 'cover', position: 'centre' }).toBuffer();
}

async function writeFallback(): Promise<void> {
  if (!existsSync(fallback)) {
    console.warn('hero: no fallback speedlight_glass.jpg present; skipping.');
    return;
  }
  await sharp(fallback).resize(CANVAS_W, CANVAS_H, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(outPath);
  console.log('hero: fallback (speedlight_glass).');
}

async function main() {
  const rows = parseYaml(await readFile(shotsPath, 'utf8')) as Row[];

  const bySubject: { glass: string[]; apples: string[] } = { glass: [], apples: [] };
  await Promise.all(
    rows.map(async (r) => {
      if (r.subject !== 'glass' && r.subject !== 'apples') return;
      const p = resolve(shotsDir, r.image);
      if (!existsSync(p)) return;
      if (await isRealPhoto(p)) bySubject[r.subject].push(p);
    }),
  );

  if (bySubject.glass.length < 2 || bySubject.apples.length < 2) {
    console.warn(
      `hero: not enough real shots (glass=${bySubject.glass.length}, apples=${bySubject.apples.length}); need 2 of each.`,
    );
    await writeFallback();
    return;
  }

  const [appleTL, appleBR] = pickN(bySubject.apples, 2);
  const [glassTR, glassBL] = pickN(bySubject.glass, 2);

  const [tl, tr, bl, br] = await Promise.all([
    quadrant(appleTL!),
    quadrant(glassTR!),
    quadrant(glassBL!),
    quadrant(appleBR!),
  ]);

  await sharp({
    create: {
      width: CANVAS_W,
      height: CANVAS_H,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      { input: tl, top: 0, left: 0 },
      { input: tr, top: 0, left: QW },
      { input: bl, top: QH, left: 0 },
      { input: br, top: QH, left: QW },
    ])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(outPath);

  const name = (p: string) => p.split('/').pop();
  console.log(
    `hero: composite of ${name(appleTL!)} + ${name(glassTR!)} / ${name(glassBL!)} + ${name(appleBR!)}.`,
  );
}

await main();
