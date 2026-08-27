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
      output: {
        inlineDynamicImports: true,
        // CONTENT HASHED, and not for tidiness. The published site serves
        // these with a year of immutable caching, which is only ever correct
        // if the name changes when the bytes do: at the fixed `viewer.js` a
        // returning visitor would have been handed a year-old bundle after
        // every future deploy. `build-artifact.ts` finds them by pattern.
        entryFileNames: 'viewer-[hash].js',
        assetFileNames: 'viewer-[hash][extname]',
      },
    },
  },
})
