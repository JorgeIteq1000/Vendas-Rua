import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CadastrarPDV from "./pages/CadastrarPDV";
import Gerentes from "./pages/Gerentes";
import NotFound from "./pages/NotFound";
import ImportarEscolas from "./pages/ImportarEscolas"; // Importe a nova página
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
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/cadastrar-pdv" element={<CadastrarPDV />} />
            <Route path="/gerentes" element={<Gerentes />} />
            <Route path="/equipe" element={<Gerentes />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            <Route path="/importar-escolas" element={<ImportarEscolas />} />
            <Route path="/distribuir" element={<DistribuirRotas />} />
            <Route path="/cadastrar-cliente" element={<CadastrarCliente />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/mapa" element={<Mapa />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
