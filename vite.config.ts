import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'gramr-ts': new URL('./src/', import.meta.url).pathname, // Example alias
    },
  },
});
