import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Deployment base path.
 *
 * Select the target with the VITE_BASE environment variable:
 *   - User/organization site  (https://USERNAME.github.io/)             -> VITE_BASE=/
 *   - Project site            (https://USERNAME.github.io/REPOSITORY/)  -> VITE_BASE=/REPOSITORY/
 *
 * Defaults to "/". The GitHub Actions workflow sets it automatically.
 * (VITE_BASE is not a secret: it is only a URL path.)
 */
function normalizeBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export default defineConfig({
  base: normalizeBase(process.env.VITE_BASE),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
