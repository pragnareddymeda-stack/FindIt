import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
      CLIENT_URL: 'http://localhost:5173',
      BCRYPT_ROUNDS: '4',
    },
    testTimeout: 30000,
    hookTimeout: 120000, // first run downloads a MongoDB binary for mongodb-memory-server
    fileParallelism: false,
  },
});
