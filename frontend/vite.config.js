/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Only group third-party libs into a single `vendor` chunk (keeping the heavy,
// lazy-loaded 3D libs out so they stay in their own async chunk). App code is
// left to Rollup's automatic chunking, which respects the module dependency
// order. Manually splitting app code into portal-common / portal-admin created a
// chunk cycle (portal-common -> export-tools -> portal-admin) whose init order
// left module-level consts (e.g. LEAVE_STATUS) uninitialised — a
// "Cannot access X before initialization" TDZ crash that blanked the whole app.
const chunkNameFor = (id) => {
  if (id.includes('/node_modules/')) {
    if (id.includes('/three/') || id.includes('/@react-three/')) return undefined;
    return 'vendor';
  }
  return undefined;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5000';

  return {
    plugins: [react(), tailwindcss()],
    // The workspace hoists a second React copy to the repo root, and
    // @react-three/fiber resolves against it. Dedupe so the orb and the app
    // share ONE React instance (otherwise r3f's <Canvas> throws
    // "Invalid hook call / Cannot read properties of null (reading 'useMemo')").
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['three', '@react-three/fiber'],
    },
    server: {
      proxy: {
        '/api': devApiTarget,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: chunkNameFor,
        },
      },
      chunkSizeWarningLimit: 1200,
    },
  };
});
