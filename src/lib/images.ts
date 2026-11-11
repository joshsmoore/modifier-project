import type { ImageMetadata } from 'astro';

const shotImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/shots/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export function getShotImage(filename: string): ImageMetadata {
  const key = `/src/assets/shots/${filename}`;
  const mod = shotImages[key];
  if (!mod) {
    throw new Error(
      `Image not found: ${filename} — referenced in shots.yaml but missing from src/assets/shots/.`,
    );
  }
  return mod.default;
}

export function tryGetShotImage(filename: string | undefined): ImageMetadata | null {
  if (!filename) return null;
  const key = `/src/assets/shots/${filename}`;
  return shotImages[key]?.default ?? null;
}

const gearImages = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/gear/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export function getGearImage(filename: string): ImageMetadata {
  const key = `/src/assets/gear/${filename}`;
  const mod = gearImages[key];
  if (!mod) {
    throw new Error(
      `Image not found: ${filename} — referenced in a group markdown but missing from src/assets/gear/.`,
    );
  }
  return mod.default;
}

export function tryGetGearImage(filename: string | undefined): ImageMetadata | null {
  if (!filename) return null;
  const key = `/src/assets/gear/${filename}`;
  return gearImages[key]?.default ?? null;
}
