// import { defineConfig, loadEnv } from 'vite';
// import react from '@vitejs/plugin-react';
// import path from 'path';

// // https://vitejs.dev/config/
// export default defineConfig(({ mode }) => {
//   // Load env file based on mode in the current working directory.
//   const env = loadEnv(mode, process.cwd(), '');
  
//   return {
//     plugins: [react()],
//     resolve: {
//       alias: {
//         "@": path.resolve(__dirname, "./"),
//       },
//     },
//     define: {
//       // Make environment variables available at build time
//       'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
//     },
//     build: {
//       outDir: 'dist',
//       sourcemap: true,
//       rollupOptions: {
//         output: {
//           manualChunks: {
//             vendor: ['react', 'react-dom'],
//             ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
//           },
//         },
//       },
//     },
//     server: {
//       port: 5173,
//       host: true,
//     },
//     preview: {
//       port: 5173,
//       host: true,
//     },
//     envPrefix: ['VITE_'],
//   };
// });

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
    define: {
      // Make environment variables available at build time
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          },
        },
      },
    },
    server: {
      port: 5173,
      host: true,
      // ▼▼▼ THIS IS THE FIX ▼▼▼
      proxy: {
        '/api': {
          // CHANGE 'ehubph_pms2' to the actual name of your folder in htdocs
          target: 'http://localhost/EHUB_PMSV3/api', 
          changeOrigin: true,
          secure: false,
          // This strips '/api' from the request before sending it to PHP
          // So: /api/auth/login -> http://localhost/ehubph_pms2/auth/login
          rewrite: (path) => path.replace(/^\/api/, ''), 
        },
      },
      // ▲▲▲ END OF FIX ▲▲▲
    },
    preview: {
      port: 5173,
      host: true,
    },
    envPrefix: ['VITE_'],
  };
});