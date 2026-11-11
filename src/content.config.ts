import { defineCollection, z, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';

const modifierClass = z.enum(['bare', 'snoot', 'softbox', 'reflector', 'other']);
const subject = z.enum(['glass', 'apples']);

const modifiers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/modifiers' }),
  schema: z.object({
    name: z.string(),
    class: modifierClass,
    configuration: z.string().optional(),
    size: z.string().optional(),
    order: z.number().int().default(0),
  }),
});

// shots.yaml is an array; each entry carries an explicit id for stable references.
const shots = defineCollection({
  loader: file('src/data/shots.yaml'),
  schema: z.object({
    modifier: reference('modifiers'),
    subject,
    image: z.string(),
    iso: z.number().int().positive(),
    power: z.string(),
    distance: z.number().positive(),
    setupImage: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// Two kinds of baseline frames: "no-flash" proves the room is dark;
// "bare-flash" is the reference every modifier page links back to.
const baselines = defineCollection({
  loader: file('src/data/baselines.yaml'),
  schema: z.object({
    subject,
    kind: z.enum(['no-flash', 'bare-flash']),
    image: z.string(),
    iso: z.number().int().positive().optional(),
    power: z.string().optional(),
    distance: z.number().optional(),
    notes: z.string().optional(),
  }),
});

// One entry per class group (bare, snoot, softbox-24, softbox-36, …).
// Describes the modifier *hardware* itself: what it is, photos of it,
// how it's set up. Rendered as an overview at the top of the class page.
// The filename must equal the group slug (e.g. softbox-24.md).
const groups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/groups' }),
  schema: z.object({
    name: z.string(),
    class: modifierClass,
    size: z.string().optional(),
    hero: z.string().optional(),
    images: z
      .array(
        z.object({
          src: z.string(),
          caption: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export const collections = { modifiers, shots, baselines, groups };
export type ModifierClass = z.infer<typeof modifierClass>;
export type Subject = z.infer<typeof subject>;
