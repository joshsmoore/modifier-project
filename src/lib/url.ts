/**
 * Build an internal URL that respects Astro's configured `base`.
 * Use for every <a href="…"> on the site; raw "/compare" won't work on
 * project-pages URLs like https://user.github.io/modifier-project.
 */
export function u(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
}
