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
      registerType: 'autoUpdate',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Sin esto, una pestaña abierta durante un deploy nuevo puede quedar con el service
        // worker viejo controlándola y terminar pidiendo chunks JS de una build anterior que
        // ya no existen (404 → el servidor devuelve el index.html, y el navegador lo rechaza
        // por MIME type). skipWaiting + clientsClaim hacen que la versión nueva tome el control
        // apenas se instala, y cleanupOutdatedCaches saca del caché las entradas de la build vieja.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
