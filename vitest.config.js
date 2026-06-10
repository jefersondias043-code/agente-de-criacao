import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom fornece document para os módulos que dependem do browser
    environment: 'jsdom',
    setupFiles: ['test/setup.js'],
    include: ['test/**/*.test.js'],
  },
});
