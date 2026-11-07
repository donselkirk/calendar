import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // UI orchestration is exercised by the required Playwright suite. Unit coverage gates the
      // deterministic business/feed modules where line and branch coverage are actionable.
      include: ['js/holidays.js', 'js/weather.js', 'js/waste.js', 'js/updates.js'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 }
    }
  }
});
