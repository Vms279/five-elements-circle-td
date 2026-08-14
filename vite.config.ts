import { defineConfig } from 'vite';

export default defineConfig({
  base: '/five-elements-circle-td/',
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
