import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
