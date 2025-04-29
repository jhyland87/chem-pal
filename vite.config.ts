import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: 'build',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes("lodash")) {
              return 'lodash'
            }
            if (id.includes('@mui') || id.includes('@material-ui')) {
              return 'vendor_mui';
            }
            if (id.includes('react')) {
              return 'react';
            }

            return 'vendor'; // all other package goes here
          }
        }
      }
    }
  }
})
