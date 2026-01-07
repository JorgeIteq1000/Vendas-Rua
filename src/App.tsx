import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"; // 👈 Importamos o segurança

// Páginas
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CadastrarPDV from "./pages/CadastrarPDV";
import Gerentes from "./pages/Gerentes";
import NotFound from "./pages/NotFound";
import ImportarEscolas from "./pages/ImportarEscolas";
import DistribuirRotas from "./pages/DistribuirRotas";
import CadastrarCliente from "./pages/CadastrarCliente";
import Vendas from "./pages/Vendas";
import Mapa from "./pages/Mapa";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota Pública (Login) */}
            <Route path="/auth" element={<Auth />} />

            {/* Rotas Privadas (Protegidas) 👇 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastrar-pdv"
              element={
                <ProtectedRoute>
                  <CadastrarPDV />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gerentes"
              element={
                <ProtectedRoute>
                  <Gerentes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipe"
              element={
                <ProtectedRoute>
                  <Gerentes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/importar-escolas"
              element={
                <ProtectedRoute>
                  <ImportarEscolas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/distribuir"
              element={
                <ProtectedRoute>
                  <DistribuirRotas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastrar-cliente"
              element={
                <ProtectedRoute>
                  <CadastrarCliente />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendas"
              element={
                <ProtectedRoute>
                  <Vendas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mapa"
              element={
                <ProtectedRoute>
                  <Mapa />
                </ProtectedRoute>
              }
            />

            {/* Rota de Erro */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
