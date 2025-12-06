import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  server: {
    port: 5173,
    // Прокси для обхода CORS при локальной разработке
    // Направляем все запросы на локальный backend (порт 3001)
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/deposit": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/withdraw": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/pvp": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Прокси для /balance/restore (должен быть перед общим /balance)
      "/balance/restore": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      // Прокси для всех /balance/* запросов (включая /balance/:wallet/subtract)
      // Vite proxy автоматически обрабатывает динамические пути
      "/balance": {
        target: "http://localhost:3001",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[PROXY]', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[PROXY RESPONSE]', req.method, req.url, '->', proxyRes.statusCode);
          });
          proxy.on('error', (err, req, res) => {
            console.error('[PROXY ERROR]', err.message, req.url);
          });
        },
      },
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  // Убеждаемся, что public файлы копируются
  publicDir: "public",
});
