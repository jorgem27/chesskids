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
    // Pre-bundle the server's npm deps up front. Otherwise Vite discovers them on the first request,
    // re-optimizes and the Workers runtime keeps old hashed URLs ("file does not exist ... deps_ssr").
    ssr: { optimizeDeps: { include: ['chess.js', 'preact', 'preact/hooks', 'preact/jsx-runtime'] } },
  },
  security: { checkOrigin: true },
});
