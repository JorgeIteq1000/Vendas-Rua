import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa"; // 👈 Importamos o Mágico

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // 👇 Configuração do PWA
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Vendas Externas - Sistema de Gestão",
        short_name: "Vendas Externas",
        description: "Sistema de gestão de vendas externas e rotas.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone", // Isso faz parecer App nativo (sem barra de navegador)
        icons: [
          {
            src: "pwa-192x192.png", // Você precisará criar essas imagens depois
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
