import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.jsx'),
      output: {
        format: 'iife',
        name: 'VedikaApp',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.iife.js'
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
