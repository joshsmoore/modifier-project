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
    power: z.string().optional(),
    distance: z.number().optional(),
    notes: z.string().optional(),
  }),
});

export const collections = { modifiers, shots, baselines };
export type ModifierClass = z.infer<typeof modifierClass>;
export type Subject = z.infer<typeof subject>;
