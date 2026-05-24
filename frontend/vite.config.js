/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const chunkNameFor = (id) => {
  if (id.includes('/node_modules/')) {
    if (id.includes('/recharts/')) return 'charts';
    if (id.includes('/jspdf/') || id.includes('/html2canvas/')) return 'export-tools';
    if (id.includes('/@e965/xlsx/')) return 'xlsx';
    if (id.includes('/lucide-react/')) return 'icons';
    return 'vendor';
  }

  if (id.includes('/src/pages/Admin/')) return 'portal-admin';
  if (id.includes('/src/pages/Clerk/')) return 'portal-clerk';
  if (id.includes('/src/pages/Student/')) return 'portal-student';
  if (id.includes('/src/pages/Teacher/')) return 'portal-teacher';
  if (id.includes('/src/components/common/')) return 'portal-common';
  return undefined;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5000';

  return {
    plugins: [react(), tailwindcss()],
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
