import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    wasm(),
    nodePolyfills()
  ],
  resolve: {
    alias: {
      'util': '/src/util-shim.js'
    }
  }
});
