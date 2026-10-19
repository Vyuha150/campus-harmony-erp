import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Config validation runs at import time, so tests need a valid environment.
    // These are test-only values and never reach a real deployment.
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-only-secret-value-at-least-32-characters-long',
      MONGODB_URI: 'mongodb://test:test@localhost:27017/test'
    }
  }
});
