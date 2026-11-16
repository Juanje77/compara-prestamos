import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' y no 'autoUpdate': la versión nueva espera a que la persona apriete
      // "Actualizar" — ver AvisoVersionNueva.tsx. Con autoUpdate se instalaba sola pero recién
      // tomaba el control en la carga SIGUIENTE, así que el refresh que uno hace justo después de
      // publicar un arreglo seguía mostrando la versión vieja.
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'FinCorp — Comparador de préstamos',
        short_name: 'FinCorp',
        description: 'Comparador de préstamos personales, prendarios, hipotecarios y para jubilados de bancos argentinos.',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#020B26',
        theme_color: '#0052FF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // webp incluido: las capturas de la landing se sirven en ese formato y, sin esto, el
        // service worker precachearía solo el PNG de respaldo — el peor de los dos mundos,
        // porque se descarga el pesado y igual no queda disponible sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}'],
        // skipWaiting ya no va acá: lo dispara el botón "Actualizar" (updateServiceWorker(true)).
        // Ponerlo fijo cambiaría el código abajo de los pies de una pantalla abierta. El riesgo que
        // cubría —una pestaña vieja pidiendo un chunk JS que ya no existe, 404 que devuelve el
        // index.html y el navegador rechaza por MIME type— sigue cubierto porque globPatterns
        // precachea TODOS los .js: la pestaña vieja se sirve de su propio caché y no sale a la red.
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
