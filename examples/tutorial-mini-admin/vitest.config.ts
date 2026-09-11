import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

// Tests get Vue and qdadm's resolver settings, not the rest of vite.config.ts: its step 6 plugins start the agent
// relay, which a test run must not do.
export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
