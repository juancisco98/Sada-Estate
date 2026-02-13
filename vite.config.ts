import * as path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'SV Propiedades',
          short_name: 'SVPropiedades',
          description: 'Gestión Inmobiliaria Inteligente',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'logo-sv.png',
              sizes: '192x192', // Using same image for now
              type: 'image/png'
            },
            {
              src: 'logo-sv.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_MODEL': JSON.stringify(env.GEMINI_MODEL || 'gemini-2.0-flash-exp') // Default fallback
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
