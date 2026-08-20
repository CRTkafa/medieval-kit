import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Viewer'ı tek dosyalık bir Artifact'e gömmek için ayrı build.
 * `scripts/build-artifact.ts` çıktıyı tek HTML'e indirger.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // `three` ve `three/webgpu` ayrı bundle'lar; ikisini de yüklemek çekirdeği
      // iki kez paketler ve instanceof kontrollerini bozar. Regex şart —
      // düz string önek eşleşmesi `three/addons/...` yolunu da bozardı.
      { find: /^three$/, replacement: 'three/webgpu' },
    ],
  },
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: true,
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./viewer.html', import.meta.url)),
      output: { inlineDynamicImports: true, entryFileNames: 'viewer.js', assetFileNames: 'viewer[extname]' },
    },
  },
})
