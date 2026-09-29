import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imagesBindingName: false,
  }),
  session: false,
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
  security: { checkOrigin: true },
});
