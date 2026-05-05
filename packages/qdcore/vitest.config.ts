import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,ts}', 'src/**/*.spec.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.test.{js,ts}', 'src/**/*.spec.{js,ts}'],
    },
  },
})
