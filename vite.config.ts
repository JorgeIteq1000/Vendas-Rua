import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // 👇 Configuração PWA Corrigida
    VitePWA({
      registerType: "autoUpdate",
      // Removi arquivos que você não tem para evitar erros 404
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Vendas Externas - Sistema de Gestão",
        short_name: "Vendas Rua", // Nome curto para ficar embaixo do ícone
        description: "Sistema de gestão de vendas externas e rotas.",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait", // Força abrir em pé
        scope: "/", // 👈 OBRIGATÓRIO
        start_url: "/", // 👈 OBRIGATÓRIO
        id: "/", // 👈 OBRIGATÓRIO
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable", // Ajuda o Android a arredondar o ícone
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
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
