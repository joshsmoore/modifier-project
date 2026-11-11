import { getCollection, type CollectionEntry } from 'astro:content';
import { groupSlug } from '~/lib/classes';

export type GroupEntry = CollectionEntry<'groups'>;

/**
 * Returns the group content entry whose slug matches the given group slug,
 * if any. Verifies that the entry's class + size would compute to the same
 * slug, so a mis-named file surfaces as a build-time error.
 */
export async function getGroupContent(slug: string): Promise<GroupEntry | undefined> {
  const entries = await getCollection('groups');
  const match = entries.find((e) => e.id === slug);
  if (!match) return undefined;

  const expected = groupSlug({ data: match.data });
  if (expected !== slug) {
    throw new Error(
      `Group content "${slug}.md" has class/size that computes to "${expected}" — rename the file or fix the frontmatter.`,
    );
  }
  return match;
}
