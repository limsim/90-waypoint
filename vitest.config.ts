import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Only run unit tests in src/; Playwright handles tests/
    include: ['src/**/*.test.ts'],
  },
});
