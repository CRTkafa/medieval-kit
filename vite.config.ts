import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      // vibe3d, kurulan kaynağı "@/lib/vibe3d/..." ve "@/models/..." takma
      // adlarıyla yazar. Bu adlar models.json içindeki `aliases` alanından gelir,
      // o yüzden bundler tarafında da aynı şekilde tanımlanmaları gerekir.
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },

      // `three` ve `three/webgpu` AYRI bundle'lar; ikisi de çekirdek sınıfların
      // kendi kopyasını içerir. scifi-kit modeli three/webgpu'dan, taşınabilir
      // medieval modeli düz three'den import ettiği için tarayıcı "Multiple
      // instances of Three.js" uyarısı veriyor ve instanceof kontrolleri iki
      // kopya arasında bozuluyor. WebGPU ile çalışan uygulamada standart çözüm:
      // `three`yi tek kopyaya, three/webgpu'ya yönlendirmek.
      // Regex şart — düz string önek eşleşmesi yapar ve "three/addons/..." yolunu
      // da bozardı.
      { find: /^three$/, replacement: 'three/webgpu' },
    ],
  },
})
