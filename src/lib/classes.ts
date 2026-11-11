import { getCollection, type CollectionEntry } from 'astro:content';
import type { ModifierClass } from '~/content.config';

export type ModifierEntry = CollectionEntry<'modifiers'>;

export type ClassGroup = {
  /** URL segment, e.g. 'snoot', 'softbox-24'. */
  slug: string;
  /** Human-readable title, e.g. 'Snoot', '24" softbox'. */
  title: string;
  class: ModifierClass;
  size?: string;
  modifiers: ModifierEntry[];
};

function normalizeSize(size: string): string {
  return size.replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

export function groupSlug(mod: { data: { class: ModifierClass; size?: string } }): string {
  const { class: cls, size } = mod.data;
  if (!size) return cls;
  return `${cls}-${normalizeSize(size)}`;
}

function titleFor(cls: ModifierClass, size?: string): string {
  if (cls === 'softbox' && size) return `${size} softbox`;
  if (cls === 'snoot') return 'Snoot';
  if (cls === 'bare') return 'Bare flash';
  if (cls === 'reflector') return 'Reflector';
  return 'Other';
}

export async function getClassGroups(): Promise<ClassGroup[]> {
  const modifiers = await getCollection('modifiers');
  const groups = new Map<string, ClassGroup>();

  for (const mod of modifiers) {
    const slug = groupSlug(mod);
    if (!groups.has(slug)) {
      groups.set(slug, {
        slug,
        title: titleFor(mod.data.class, mod.data.size),
        class: mod.data.class,
        size: mod.data.size,
        modifiers: [],
      });
    }
    groups.get(slug)!.modifiers.push(mod);
  }

  for (const g of groups.values()) {
    g.modifiers.sort((a, b) => a.data.order - b.data.order);
  }

  return [...groups.values()].sort((a, b) => {
    // Stable UI order: bare → snoot → softboxes (ascending size) → others.
    const rank = (g: ClassGroup) => {
      if (g.class === 'bare') return 0;
      if (g.class === 'snoot') return 1;
      if (g.class === 'softbox') {
        const n = Number((g.size ?? '').replace(/[^0-9]/g, '')) || 0;
        return 2 + n / 1000;
      }
      if (g.class === 'reflector') return 10;
      return 11;
    };
    return rank(a) - rank(b);
  });
}

export async function getGroupBySlug(slug: string): Promise<ClassGroup | undefined> {
  const groups = await getClassGroups();
  return groups.find((g) => g.slug === slug);
}
