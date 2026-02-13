import { defineConfig, type Plugin } from 'vite'
import { copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

/** Copy built index.js to repo root (for jsdelivr CDN) and manifest to dist/ */
function postBuild(): Plugin {
  return {
    name: 'post-build',
    closeBundle() {
      mkdirSync('dist', { recursive: true })
      copyFileSync('manifest.json', 'dist/manifest.json')
      copyFileSync('dist/index.js', 'index.js')
    },
  }
}

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', '@mywallpaper/sdk-react'],
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  plugins: [postBuild()],
})
