/**
 * Generate Instagram-sized 4:5 images (1080×1350) for one or many
 * modifiers, with the shot settings burned into a strip along the top.
 *
 *   npm run instagram -- <arg>
 *   tsx scripts/generate-instagram.ts <arg>
 *
 * <arg> is resolved in this order:
 *   1. Exact modifier slug      — e.g. "speedlight"            → 1 modifier
 *   2. Modifier class           — e.g. "bare" | "snoot"        → every modifier in that class
 *   3. Slug prefix              — e.g. "magsnoot" | "softbox-24" → every modifier whose slug starts with it
 *
 * Subject shots (glass, apples) are center-cropped 2:3 → 4:5. Setup
 * shots are intentionally excluded from IG — they live on the website
 * for anyone studying the method; the carousel focuses on outcomes.
 *
 * Also emits a cover slide (<arg>_00_cover_ig.jpg) sized to sort first
 * in a carousel, and prints a copy-pasteable IG caption with the
 * modifiers.lighting link and the fixed hashtag set.
 *
 * Output: ~/Downloads/modifier-project-<arg>/*.jpg
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const IG_W = 1080;
const IG_H = 1350;
const BAND_H = 180;
const PAD_X = 56;

type ShotRow = {
  id: string;
  modifier: string;
  subject: 'glass' | 'apples';
  image: string;
  iso: number;
  power: string;
  distance: number;
  setupImage?: string;
};

type ModifierMeta = {
  slug: string;
  name: string;
  class: string;
  configuration?: string;
  body?: string;
};

type GroupMeta = {
  name: string;
  description?: string;
};

const SITE = 'modifiers.lighting';
const HASHTAGS = [
  '#modifierproject',
  '#lightingtest',
  '#speedlight',
  '#photopractice',
  '#studiolighting',
];
const PROJECT_TAGLINE =
  'Every lighting modifier I own, shot with the same subjects and setup. Only the modifier changes.';
const CAPTION_CAP = 300;
const COVER_SUBTITLE_CAP = 70;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadModifiers(): Promise<Map<string, ModifierMeta>> {
  const dir = resolve(root, 'src/content/modifiers');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const out = new Map<string, ModifierMeta>();
  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const md = await readFile(resolve(dir, file), 'utf8');
    const fm = md.match(/^---\n([\s\S]+?)\n---/);
    if (!fm) continue;
    const parsed = parseYaml(fm[1]!) as {
      name?: string;
      class?: string;
      configuration?: string;
    };
    const body = md.slice(fm[0].length).trim().replace(/\s+/g, ' ');
    out.set(slug, {
      slug,
      name: parsed.name ?? slug,
      class: parsed.class ?? '',
      configuration: parsed.configuration,
      body: body || undefined,
    });
  }
  return out;
}

async function loadGroup(className: string): Promise<GroupMeta | null> {
  const dir = resolve(root, 'src/content/groups');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const md = await readFile(resolve(dir, file), 'utf8');
    const fm = md.match(/^---\n([\s\S]+?)\n---/);
    if (!fm) continue;
    const parsed = parseYaml(fm[1]!) as { name?: string; class?: string; description?: string };
    if (parsed.class === className) {
      return { name: parsed.name ?? className, description: parsed.description };
    }
  }
  return null;
}

function pickSlugs(arg: string, modifiers: Map<string, ModifierMeta>): string[] {
  if (modifiers.has(arg)) return [arg];

  const classMatches = [...modifiers.values()]
    .filter((m) => m.class === arg)
    .map((m) => m.slug)
    .sort();
  if (classMatches.length > 0) return classMatches;

  const prefixMatches = [...modifiers.keys()]
    .filter((slug) => slug.startsWith(arg))
    .sort();
  return prefixMatches;
}

function overlaySvg(title: string, settings?: string, tag?: string): Buffer {
  const titleY = settings ? 72 : Math.round(BAND_H / 2 + 18);
  const subRow = settings
    ? `<text x="${PAD_X}" y="128"
             fill="#a8a8a8"
             font-family="Menlo, Courier, monospace"
             font-size="30" letter-spacing="2">${esc(settings)}</text>
       ${
         tag
           ? `<text x="${IG_W - PAD_X}" y="128"
                    text-anchor="end"
                    fill="#6a6a6a"
                    font-family="Menlo, Courier, monospace"
                    font-size="24" letter-spacing="3">${esc(tag)}</text>`
           : ''
       }`
    : '';
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IG_W}" height="${IG_H}">
       <rect x="0" y="0" width="${IG_W}" height="${BAND_H}"
             fill="rgba(10,10,10,0.78)"/>
       <text x="${PAD_X}" y="${titleY}"
             fill="#e8e8e8"
             font-family="Helvetica, Arial, sans-serif"
             font-size="52" font-weight="600">${esc(title)}</text>
       ${subRow}
     </svg>`,
  );
}

type RenderOpts = {
  title: string;
  settings?: string;
  tag?: string;
  rotate?: boolean;
};

function wrapText(s: string, maxLen: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxLen) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function coverSvg(title: string, subtitle: string | undefined, url: string): Buffer {
  const subLines = subtitle ? wrapText(subtitle, 36).slice(0, 2) : [];
  const subBlock = subLines
    .map(
      (line, i) =>
        `<text x="${IG_W / 2}" y="${1160 + i * 46}" text-anchor="middle"
               fill="#c8c8c8" font-family="Helvetica, Arial, sans-serif"
               font-size="34" font-weight="400">${esc(line)}</text>`,
    )
    .join('\n       ');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${IG_W}" height="${IG_H}">
       <defs>
         <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0" stop-color="#000" stop-opacity="0"/>
           <stop offset="0.55" stop-color="#000" stop-opacity="0.25"/>
           <stop offset="0.75" stop-color="#000" stop-opacity="0.75"/>
           <stop offset="1" stop-color="#000" stop-opacity="0.96"/>
         </linearGradient>
       </defs>
       <rect x="0" y="0" width="${IG_W}" height="${IG_H}" fill="url(#bg)"/>
       <text x="${IG_W / 2}" y="1080" text-anchor="middle"
             fill="#f4f4f4" font-family="Helvetica, Arial, sans-serif"
             font-size="88" font-weight="700" letter-spacing="-1">${esc(title)}</text>
       ${subBlock}
       <text x="${IG_W - PAD_X}" y="${IG_H - 40}" text-anchor="end"
             fill="#9a9a9a" font-family="Menlo, Courier, monospace"
             font-size="26" letter-spacing="1">${esc(url)}</text>
     </svg>`,
  );
}

async function renderCover(
  srcFile: string,
  outFile: string,
  title: string,
  subtitle: string | undefined,
  urlPath: string,
): Promise<void> {
  const srcPath = resolve(root, 'src/assets/shots', srcFile);
  const meta = await sharp(srcPath).metadata();
  if (!meta.width || !meta.height) throw new Error(`Cannot read dimensions for ${srcFile}`);

  const srcAR = meta.width / meta.height;
  const targetAR = IG_W / IG_H;
  let left = 0;
  let top = 0;
  let w = meta.width;
  let h = meta.height;
  if (srcAR < targetAR) {
    h = Math.round(meta.width / targetAR);
    top = Math.round((meta.height - h) / 2);
  } else if (srcAR > targetAR) {
    w = Math.round(meta.height * targetAR);
    left = Math.round((meta.width - w) / 2);
  }

  await sharp(srcPath)
    .extract({ left, top, width: w, height: h })
    .resize(IG_W, IG_H, { fit: 'cover' })
    .composite([{ input: coverSvg(title, subtitle, `${SITE}${urlPath}`) }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(outFile);
}

async function renderCrop(srcFile: string, outFile: string, opts: RenderOpts): Promise<void> {
  const srcPath = resolve(root, 'src/assets/shots', srcFile);

  let pipeline = sharp(srcPath);
  if (opts.rotate) pipeline = pipeline.rotate(-90);
  const buf = await pipeline.toBuffer();
  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new Error(`Cannot read dimensions for ${srcFile}`);

  const srcW = meta.width;
  const srcH = meta.height;
  const srcAR = srcW / srcH;
  const targetAR = IG_W / IG_H;

  let left = 0;
  let top = 0;
  let w = srcW;
  let h = srcH;
  if (srcAR < targetAR) {
    h = Math.round(srcW / targetAR);
    top = Math.round((srcH - h) / 2);
  } else if (srcAR > targetAR) {
    w = Math.round(srcH * targetAR);
    left = Math.round((srcW - w) / 2);
  }

  await sharp(buf)
    .extract({ left, top, width: w, height: h })
    .resize(IG_W, IG_H, { fit: 'cover' })
    .composite([{ input: overlaySvg(opts.title, opts.settings, opts.tag) }])
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toFile(outFile);
}

function claudeSummarize(text: string, maxChars: number, purpose: string): string | null {
  const prompt =
    `Summarize the following text in no more than ${maxChars} characters. ` +
    `${purpose} Keep first-person voice if present. Preserve the key technical specifics. ` +
    `Output ONLY the summary. No quotes, no preamble, no trailing newline.\n\nText:\n${text}`;

  const result = spawnSync('claude', ['-p', prompt], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const out = (result.stdout ?? '').trim();
  if (!out) return null;
  return out.length <= maxChars ? out : out.slice(0, maxChars - 1).trimEnd() + '…';
}

async function summarizeOrKeep(
  text: string | undefined,
  maxChars: number,
  purpose: string,
): Promise<string | undefined> {
  if (!text) return undefined;
  if (text.length <= maxChars) return text;
  console.log(`  …summarizing (${text.length} → ≤${maxChars} chars) via claude…`);
  const summary = claudeSummarize(text, maxChars, purpose);
  if (summary) return summary;
  console.log('  …claude summarize failed; falling back to hard truncation');
  return text.slice(0, maxChars - 1).trimEnd() + '…';
}

function prompt(message: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function editInEditor(initial: string): Promise<string> {
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  const tmpFile = resolve(tmpdir(), `ig-caption-${Date.now()}.txt`);
  await writeFile(tmpFile, initial, 'utf8');
  const result = spawnSync(editor, [tmpFile], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`  (editor "${editor}" failed; keeping original caption)`);
    return initial;
  }
  return (await readFile(tmpFile, 'utf8')).trimEnd();
}

function buildCaption(
  title: string,
  description: string | undefined,
  urlPath: string,
): string {
  const fullUrl = `https://${SITE}${urlPath}`;
  const lines: string[] = [PROJECT_TAGLINE, '', title];
  if (description) lines.push(description);
  lines.push('', `Full comparison and large frames: ${fullUrl}`, '', HASHTAGS.join(' '));
  return lines.join('\n');
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run instagram -- <slug | class | prefix>');
    process.exit(1);
  }

  const modifiers = await loadModifiers();
  const slugs = pickSlugs(arg, modifiers);
  if (slugs.length === 0) {
    console.error(`No match for "${arg}".`);
    const classes = [...new Set([...modifiers.values()].map((m) => m.class))].filter(Boolean).sort();
    console.error(`\nClasses: ${classes.join(', ')}`);
    console.error(`\nSlugs: ${[...modifiers.keys()].sort().join(', ')}`);
    process.exit(1);
  }

  const shotsText = await readFile(resolve(root, 'src/data/shots.yaml'), 'utf8');
  const allShots = parseYaml(shotsText) as ShotRow[];

  console.log(`Matched ${slugs.length} modifier(s): ${slugs.join(', ')}`);

  // --- Determine title, description, and URL path ---
  let title = '';
  let rawDescription: string | undefined;
  let urlPath = '/';
  const isSingleModifier = slugs.length === 1 && modifiers.has(arg);

  if (isSingleModifier) {
    const mod = modifiers.get(slugs[0]!)!;
    title = mod.name;
    rawDescription = mod.body;
    urlPath = `/${mod.class}/${mod.slug}`;
  } else {
    const firstMod = modifiers.get(slugs[0]!)!;
    const group = await loadGroup(firstMod.class);
    title = group?.name ?? firstMod.class;
    rawDescription = group?.description;
    urlPath = `/${firstMod.class}`;
  }

  // --- Summarize (if needed) for caption + cover ---
  const captionDescription = await summarizeOrKeep(
    rawDescription,
    CAPTION_CAP,
    'Target: roughly 2–4 short sentences, suitable for an Instagram caption.',
  );
  const coverSubtitle = isSingleModifier
    ? modifiers.get(slugs[0]!)!.configuration
    : await summarizeOrKeep(
        rawDescription,
        COVER_SUBTITLE_CAP,
        'Target: a single short phrase for a cover slide, no period needed.',
      );

  // --- Build caption, show it, let user edit ---
  let caption = buildCaption(title, captionDescription, urlPath);
  console.log('\n────────────────────────────────────────');
  console.log('IG caption preview:');
  console.log('────────────────────────────────────────');
  console.log(caption);
  console.log('────────────────────────────────────────');

  const answer = (await prompt('[Enter] to use as-is, [e] edit, [q] quit: ')).toLowerCase();
  if (answer === 'q') {
    console.log('Aborted. No images generated.');
    process.exit(0);
  }
  if (answer === 'e') {
    caption = await editInEditor(caption);
    console.log('\nFinal caption:');
    console.log('────────────────────────────────────────');
    console.log(caption);
    console.log('────────────────────────────────────────');
  }

  // --- Now generate images ---
  const outDir = resolve(homedir(), 'Downloads', `modifier-project-${arg}`);
  await mkdir(outDir, { recursive: true });
  console.log(`\nOutput: ${outDir}`);

  const firstModWithGlass = (() => {
    for (const slug of slugs) {
      const glass = allShots.find((s) => s.modifier === slug && s.subject === 'glass');
      if (glass) return { slug, image: glass.image };
    }
    return null;
  })();

  if (firstModWithGlass) {
    const coverFile = resolve(outDir, `${arg}_00_cover_ig.jpg`);
    await renderCover(firstModWithGlass.image, coverFile, title, coverSubtitle, urlPath);
    console.log(`  ✓ ${arg}_00_cover_ig.jpg (cover)`);
  }

  for (const slug of slugs) {
    const mod = modifiers.get(slug)!;
    const shots = allShots.filter((s) => s.modifier === slug);
    if (shots.length === 0) {
      console.log(`  ${slug}: (no shots in shots.yaml — skipped)`);
      continue;
    }

    console.log(`\n${mod.name}`);
    for (const row of shots) {
      const settings = `${row.power}  ·  ${row.distance}"  ·  ISO ${row.iso}`;
      const outFile = resolve(outDir, `${slug}_${row.subject}_ig.jpg`);
      await renderCrop(row.image, outFile, { title: mod.name, settings });
      console.log(`  ✓ ${slug}_${row.subject}_ig.jpg`);
    }
  }

  // --- Save caption alongside the images ---
  await writeFile(resolve(outDir, 'caption.txt'), caption + '\n', 'utf8');
  console.log(`\nCaption saved to: ${outDir}/caption.txt`);
}

await main();
