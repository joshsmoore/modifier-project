/**
 * "Published" = a modifier has real (non-placeholder) photos for BOTH subjects.
 *
 * The placeholder generator produces near-flat grey images (channel stdev ~0.5);
 * real photos sit around 40+. A 5 threshold is safely between. The scan runs
 * once per process and is memoized for the rest of the build / dev session.
 *
 * Set `SHOW_ALL_MODIFIERS=1` in the environment to bypass the filter — useful
 * when previewing scaffold work before the shots exist.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { getCollection } from 'astro:content';

const shotsDir = resolve(process.cwd(), 'src/assets/shots');

const PLACEHOLDER_STDEV = 5;

async function isRealPhoto(filename: string): Promise<boolean> {
  const path = resolve(shotsDir, filename);
  if (!existsSync(path)) return false;
  try {
    const stats = await sharp(path).stats();
    const n = Math.min(3, stats.channels.length);
    const avg = stats.channels.slice(0, n).reduce((s, c) => s + c.stdev, 0) / n;
    return avg > PLACEHOLDER_STDEV;
  } catch {
    return false;
  }
}

let cache: Promise<Set<string>> | null = null;

export function getPublishedModifierIds(): Promise<Set<string>> {
  if (process.env.SHOW_ALL_MODIFIERS === '1') {
    return allModifierIds();
  }
  if (!cache) cache = compute();
  return cache;
}

async function allModifierIds(): Promise<Set<string>> {
  const mods = await getCollection('modifiers');
  return new Set(mods.map((m) => m.id));
}

async function compute(): Promise<Set<string>> {
  const shots = await getCollection('shots');

  const byModifier = new Map<string, { glass?: string; apples?: string }>();
  for (const s of shots) {
    const bucket = byModifier.get(s.data.modifier.id) ?? {};
    bucket[s.data.subject as 'glass' | 'apples'] = s.data.image;
    byModifier.set(s.data.modifier.id, bucket);
  }

  const results = await Promise.all(
    Array.from(byModifier.entries()).map(async ([id, files]) => {
      if (!files.glass || !files.apples) return [id, false] as const;
      const [glassReal, applesReal] = await Promise.all([
        isRealPhoto(files.glass),
        isRealPhoto(files.apples),
      ]);
      return [id, glassReal && applesReal] as const;
    }),
  );

  return new Set(results.filter(([, ok]) => ok).map(([id]) => id));
}
