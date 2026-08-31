import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
  server: {
    // PINNED, not incidental: Google matches the redirect URI exactly, so the
    // port is part of what you registered in the console. Change it here and
    // you must change it there.
    port: 5176,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5179',
      '/auth/google/exchange': 'http://localhost:5179',
    },
  },
})
