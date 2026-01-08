import { useEffect, useState } from "react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
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
  const { setOpenMobile } = useSidebar();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [os, setOs] = useState<"android" | "ios">("android");

  useEffect(() => {
    // Detecta se já está instalado
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");

    setIsStandalone(standalone);

    // Detecta iOS
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setOs("ios");
    }

    // Captura o evento do Android
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // ANDROID NATIVO
      deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }

      setOpenMobile(false);
    } else {
      // MANUAL / IOS
      // 🔥 ABRE O MODAL PRIMEIRO
      setShowInstruction(true);

      // 🔥 FECHA O MENU DEPOIS
      setTimeout(() => {
        setOpenMobile(false);
      }, 100);
    }
  };

  // Não mostra se já estiver instalado
  if (isStandalone) return null;

  return (
    <>
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

      {/* MODAL */}
      <Dialog open={showInstruction} onOpenChange={setShowInstruction}>
        <DialogContent className="sm:max-w-md z-[110]">
          <DialogHeader>
            <DialogTitle>Instalar Vendas Externas</DialogTitle>
            <DialogDescription>
              Para ter a melhor experiência, adicione este app à sua tela
              inicial.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={os} onValueChange={(v) => setOs(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="android">Android</TabsTrigger>
              <TabsTrigger value="ios">iPhone (iOS)</TabsTrigger>
            </TabsList>

            <TabsContent value="android" className="pt-4 space-y-3">
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  Toque no menu{" "}
                  <MoreVertical className="w-4 h-4 text-primary" /> do
                  navegador.
                </li>
                <li>
                  Selecione{" "}
                  <strong className="text-foreground">
                    Instalar aplicativo
                  </strong>{" "}
                  ou{" "}
                  <strong className="text-foreground">
                    Adicionar à tela inicial
                  </strong>
                  .
                </li>
                <li>Confirme e procure o ícone no celular.</li>
              </ol>
            </TabsContent>

            <TabsContent value="ios" className="pt-4 space-y-3">
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  Toque em Compartilhar{" "}
                  <Share className="w-4 h-4 text-blue-500" />.
                </li>
                <li className="flex items-center gap-2">
                  Selecione{" "}
                  <strong className="flex items-center gap-1 text-foreground">
                    <PlusSquare className="w-4 h-4" />
                    Adicionar à Tela de Início
                  </strong>
                  .
                </li>
                <li>Toque em “Adicionar”.</li>
              </ol>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
