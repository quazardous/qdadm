import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'

// Tutorial-conform consumer config (#1390): qdadmVitePlugin() supplies the
// dedupe + optimizeDeps + symlink fs.allow this file used to hand-roll
// (aliases into ../qdadm/src, manual dedupe, usetoast/useconfirm includes).
// The demo consumes @quazardous/qdadm through the workspace link, exactly
// like a real app consumes the npm package.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/qdadm/' : '/',
  plugins: [vue(), qdadmVitePlugin({ dedupe: ['vanilla-jsoneditor'] }), qdadmDebugPlugin(), qdadmMcpPlugin()],
  resolve: {
    alias: [{ find: '@', replacement: resolve(__dirname, 'src') }]
  },
  server: {
    port: 5174
  }
})
