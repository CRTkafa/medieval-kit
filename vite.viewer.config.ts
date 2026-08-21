import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * A separate build for embedding the viewer into a single-file Artifact.
 * `scripts/build-artifact.ts` collapses the output into one HTML file.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // `three` and `three/webgpu` are separate bundles; loading both packs the
      // core twice and breaks instanceof checks. The regex is required — a plain
      // string prefix match would break the `three/addons/...` path too.
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
