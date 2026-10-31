import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
export default defineConfig({plugins:[react(),tailwindcss()],publicDir:false,resolve:{alias:{'@':path.resolve('src')}},build:{rollupOptions:{output:{entryFileNames:'app.js',chunkFileNames:'chunks/[name]-[hash].js',assetFileNames:asset=>asset.names?.some(n=>n.endsWith('.css'))?'style.css':'assets/[name]-[hash][extname]'}}}});
