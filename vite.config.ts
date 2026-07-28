import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: {
    name: 'Meu Controle Financeiro', short_name: 'Meu Controle', theme_color: '#071412', background_color: '#071412', display: 'standalone',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
  } })],
})
