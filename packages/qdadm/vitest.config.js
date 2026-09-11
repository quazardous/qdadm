import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // What qdadmVitePlugin() defines: the suites run qdadm the way a correctly configured app does (#2259).
  define: { __QDADM_VITE_PLUGIN__: 'true' },
  test: {
    globals: true,
    environment: 'jsdom',
    include: [
      'tests/**/*.test.{js,ts}',
      'tests/**/*.spec.{js,ts}',
      'src/**/*.test.{js,ts}',
      'src/**/*.spec.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.test.{js,ts}', 'src/**/*.spec.{js,ts}'],
    },
  }
})
