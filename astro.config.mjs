import { defineConfig } from 'astro/config';

// For a project pages URL like https://<user>.github.io/<repo>, set both:
//   site: 'https://<user>.github.io'
//   base: '/<repo>'
// For a user/org root site, use site: 'https://<user>.github.io' and base: '/'.
// Update these before the first deploy.
export default defineConfig({
  site: 'https://joshsmoore.github.io',
  base: '/modifier-project',
  trailingSlash: 'ignore',
  build: {
    assets: 'assets',
  },
  image: {
    // sharp is bundled with Astro; EXIF is stripped on re-encode.
  },
});
