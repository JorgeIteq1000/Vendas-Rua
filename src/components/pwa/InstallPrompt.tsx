import { useEffect, useState } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  Download,
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [os, setOs] = useState<"android" | "ios">("android");

  useEffect(() => {
    // 1. Verifica se já está instalado (Modo App)
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsStandalone(isStandaloneMode);

    // 2. Tenta detectar se é iPhone para já abrir a aba certa
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setOs("ios");
    }

    // 3. Captura o evento nativo do Chrome (se ele disparar)
    const handler = (e: any) => {
      e.preventDefault(); // Impede o banner feio automático
      setDeferredPrompt(e); // Guarda o poder de instalar para o nosso botão
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    // Se o navegador "deixou" instalar nativamente, usa isso
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Se não, abre o manual de instruções
      setShowInstruction(true);
    }
  };

  // Se já estiver instalado, o botão some
  if (isStandalone) return null;

  return (
    <>
      {/* Botão sempre visível no Menu */}
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={handleInstallClick}
          className="text-emerald-600 font-medium hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 bg-emerald-50/50 transition-all"
        >
          <Smartphone className="w-4 h-4" />
          <span>Instalar Aplicativo</span>
          <Download className="w-3 h-3 ml-auto opacity-50" />
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Modal de Instruções (Caso o clique direto falhe) */}
      <Dialog open={showInstruction} onOpenChange={setShowInstruction}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar Vendas Externas</DialogTitle>
            <DialogDescription>
              Para ter a melhor experiência, adicione este app à sua tela
              inicial.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue={os} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="android" onClick={() => setOs("android")}>
                Android
              </TabsTrigger>
              <TabsTrigger value="ios" onClick={() => setOs("ios")}>
                iPhone (iOS)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="android" className="space-y-4 pt-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  Toque no menu do navegador{" "}
                  <MoreVertical className="w-4 h-4 text-primary inline" /> (três
                  pontinhos).
                </li>
                <li className="flex items-center gap-2">
                  Selecione{" "}
                  <span className="font-bold text-foreground">
                    Instalar aplicativo
                  </span>{" "}
                  ou{" "}
                  <span className="font-bold text-foreground">
                    Adicionar à tela inicial
                  </span>
                  .
                </li>
                <li>Confirme a instalação e procure o ícone no seu celular!</li>
              </ol>
            </TabsContent>

            <TabsContent value="ios" className="space-y-4 pt-4">
              <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  Toque no botão Compartilhar{" "}
                  <Share className="w-4 h-4 text-blue-500 inline" /> na barra
                  inferior.
                </li>
                <li className="flex items-center gap-2">
                  Role para cima e toque em{" "}
                  <span className="font-bold text-foreground flex items-center gap-1">
                    <PlusSquare className="w-4 h-4" /> Adicionar à Tela de
                    Início
                  </span>
                  .
                </li>
                <li>Clique em "Adicionar" no canto superior direito.</li>
              </ol>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
