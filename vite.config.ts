import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    // TON-библиотеки (@ton/*, ton, tonweb) используют Node-глобалы (Buffer,
    // process, global). Плагин подставляет их во все чанки — важно для
    // Telegram WebView, где нет Node-окружения.
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  server: {
    watch: {
      usePolling: true,
      interval: 200,
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Разбиваем крупные вендоры на отдельные чанки: быстрее параллельная
        // загрузка и кеширование в webview Telegram Mini App (при обновлении
        // приложения перекачивается только изменившийся код).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
            return "vendor-react";
          if (/[\\/]node_modules[\\/]@mui[\\/]/.test(id))
            return "vendor-mui";
          // @emotion держим в том же чанке, что и @mui: разделение создаёт
          // циклическую зависимость между чанками и TDZ-ошибку при загрузке.
          if (/[\\/]node_modules[\\/]@emotion[\\/]/.test(id))
            return "vendor-mui";
          if (/[\\/]node_modules[\\/](moment|moment-timezone|dayjs)[\\/]/.test(id))
            return "vendor-dates";
          if (/[\\/]node_modules[\\/](@ton|ton|ton-core|ton-crypto|tonweb|@tonconnect|ton-vote-contracts-sdk)[\\/]/.test(id))
            return "vendor-ton";
          if (/[\\/]node_modules[\\/]@tma\.js[\\/]/.test(id))
            return "vendor-tma";
          if (/[\\/]node_modules[\\/](@tanstack|axios|axios-retry|lodash)[\\/]/.test(id))
            return "vendor-utils";
        },
      },
    },
  },
});
