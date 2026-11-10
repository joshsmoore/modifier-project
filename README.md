# Modifier Project

A static site documenting a lighting modifier experiment: the same two subjects
(a martini glass with blue liquid, and three apples) shot with every modifier I
own, everything else held constant. Built with Astro and deployed to GitHub
Pages.

## Running locally

```bash
npm install
npm run dev
```

The `predev` script generates grey placeholder images for every image
referenced in `src/data/shots.yaml` that doesn't exist yet in
`src/assets/shots/`. Real photos are never overwritten.

## Adding a modifier

1. Create `src/content/modifiers/<slug>.md`:

   ```markdown
   ---
   name: Human name
   class: snoot            # bare | snoot | softbox | reflector | other
   configuration: stage 3  # optional
   size: 24"               # optional, used for softbox grouping
   order: 3                # order within its class
   ---

   Notes in markdown — what the modifier does, what you observed.
   ```

2. Add two rows to `src/data/shots.yaml` — one per subject:

   ```yaml
   - id: <slug>_glass
     modifier: <slug>
     subject: glass
     image: <slug>_glass.jpg
     power: "1/16"
     distance: 18
   - id: <slug>_apples
     modifier: <slug>
     subject: apples
     image: <slug>_apples.jpg
     power: "1/16"
     distance: 18
   ```

3. Drop the originals into `src/assets/shots/` using the exact filenames.
   Astro's image pipeline generates responsive AVIF/WebP/JPEG variants and
   strips EXIF on re-encode. A full-resolution JPEG download link is generated
   automatically.

The shot log and modifier files are validated at build time against zod
schemas in `src/content.config.ts`. A typo in a modifier slug, a missing
image, or an unknown class value fails the build.

## Adding shots to an existing modifier

Only step 2 and step 3 above. Each `shot` in `shots.yaml` needs a unique `id`
— keep these stable so shareable `/compare?a=…&b=…` URLs don't rot.

## The baseline frames

Two baseline kinds live in `src/data/baselines.yaml`:

- `no-flash` — ambient-only frame for each subject; should be pure black.
- `bare-flash` — the canonical reference every modifier is judged against.
  Modifier pages link to it under "Compare with".

## Image rules

Every image within a subject (`glass` or `apples`) must share dimensions —
the slider/toggle/side-by-side views depend on identical framing. The
`prebuild` script runs `scripts/validate-dimensions.ts` and fails the build
on mismatch.

## Deploying to GitHub Pages

1. Edit `astro.config.mjs` and set `site` to `https://<your-user>.github.io`
   and `base` to `/<repo-name>` (or `/` for a user/org root site).
2. Push to `main`. The workflow at `.github/workflows/deploy.yml` builds the
   site and deploys it to Pages.
3. In the repository settings, under **Pages**, set **Source** to **GitHub
   Actions**.

## Scripts

| Command           | What it does                                           |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Generate placeholders, start dev server                |
| `npm run build`   | Generate placeholders, validate dimensions, build site |
| `npm run preview` | Preview the production build                           |
| `npm run check`   | Astro + TypeScript type-check                          |

## Layout

```
src/
├── content.config.ts    # zod schemas for modifiers + shots + baselines
├── content/modifiers/   # one .md per modifier, body is the notes
├── data/                # shots.yaml, baselines.yaml
├── assets/shots/        # image originals (ignored for placeholders)
├── components/          # ShotFigure, CompareSlider, CompareToggle
├── layouts/Base.astro
├── lib/                 # data joins, URL helpers, image resolution
├── pages/
│   ├── index.astro          # home
│   ├── method.astro         # setup, gear, sortable log
│   ├── compare.astro        # slider / side-by-side / toggle
│   ├── 404.astro
│   └── [class]/
│       ├── index.astro      # class page, every configuration
│       └── [slug].astro     # individual modifier
└── styles/global.css
scripts/
├── generate-placeholders.ts
└── validate-dimensions.ts
```
