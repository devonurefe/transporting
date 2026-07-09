import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy/independent vendors out of the main bundle so the browser
          // caches them across deploys and only pays for what a route needs. The
          // React runtime is kept in ONE chunk (react/react-dom/router/scheduler)
          // to avoid cross-chunk init ordering issues; charts (admin dashboard)
          // and icons/motion get their own chunks.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react-vendor';
            if (id.includes('node_modules/motion') || id.includes('framer-motion')) return 'motion';
            if (id.includes('node_modules/lucide-react')) return 'icons';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) return 'charts';
            return 'vendor';
          },
        },
      },
    },
    server: {
      // HMR can be disabled via the DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
