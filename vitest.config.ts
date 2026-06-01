import * as path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Config dedicada de tests. NO carga el plugin PWA (vite-plugin-pwa) a propósito:
// genera el service worker y el módulo virtual `virtual:pwa-register`, que no
// aplican en jsdom y romperían el entorno de test.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    css: false,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'android', 'execution'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'android/',
        'test/',
        'scripts/',
        'supabase/**',
        'index.tsx',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        'types/**',
        'types.ts',
      ],
    },
  },
});
