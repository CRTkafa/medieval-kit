import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      // vibe3d writes the installed source with the "@/lib/vibe3d/..." and
      // "@/models/..." aliases. Those names come from the `aliases` field in
      // models.json, so they have to be defined the same way on the bundler side.
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },

      // `three` and `three/webgpu` are SEPARATE bundles; each one carries its
      // own copy of the core classes. The scifi-kit model imports from
      // three/webgpu and the portable medieval model imports from plain three,
      // so the browser warns "Multiple instances of Three.js" and instanceof
      // checks break across the two copies. The standard fix in a WebGPU app:
      // point `three` at a single copy, three/webgpu.
      // The regex is required — a plain string does prefix matching and would
      // break the "three/addons/..." path too.
      { find: /^three$/, replacement: 'three/webgpu' },
    ],
  },
})
