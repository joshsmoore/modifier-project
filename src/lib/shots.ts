import { getCollection, type CollectionEntry } from 'astro:content';
import type { Subject } from '~/content.config';

export type ShotEntry = CollectionEntry<'shots'>;
export type BaselineEntry = CollectionEntry<'baselines'>;

/** All shots for a modifier slug, keyed by subject. */
export async function shotsForModifier(
  modifierSlug: string,
): Promise<Partial<Record<Subject, ShotEntry>>> {
  const all = await getCollection('shots');
  const out: Partial<Record<Subject, ShotEntry>> = {};
  for (const s of all) {
    if (s.data.modifier.id === modifierSlug) out[s.data.subject] = s;
  }
  return out;
}

export async function getBareFlashBaselines(): Promise<Partial<Record<Subject, BaselineEntry>>> {
  const all = await getCollection('baselines');
  const out: Partial<Record<Subject, BaselineEntry>> = {};
  for (const b of all) {
    if (b.data.kind === 'bare-flash') out[b.data.subject] = b;
  }
  return out;
}

export async function getNoFlashBaselines(): Promise<Partial<Record<Subject, BaselineEntry>>> {
  const all = await getCollection('baselines');
  const out: Partial<Record<Subject, BaselineEntry>> = {};
  for (const b of all) {
    if (b.data.kind === 'no-flash') out[b.data.subject] = b;
  }
  return out;
}

/** Validate that every shot's modifier reference resolves — fails the build if not. */
export async function assertShotIntegrity(): Promise<void> {
  const [modifiers, shots] = await Promise.all([
    getCollection('modifiers'),
    getCollection('shots'),
  ]);
  const ids = new Set(modifiers.map((m) => m.id));
  for (const s of shots) {
    if (!ids.has(s.data.modifier.id)) {
      throw new Error(
        `shots.yaml: '${s.id}' references modifier '${s.data.modifier.id}' which does not exist.`,
      );
    }
  }
}
