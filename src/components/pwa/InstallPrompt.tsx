import { useEffect, useState } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // Escuta o evento que o navegador dispara quando o app pode ser instalado
    const handler = (e: any) => {
      e.preventDefault(); // Impede o pop-up automático (que o navegador bloqueia as vezes)
      setDeferredPrompt(e);
      setIsInstallable(true);

      // Opcional: Mostra um toast avisando que dá pra instalar
      // toast("Instale o App para melhor performance!", {
      //   action: {
      //     label: "Instalar",
      //     onClick: handleInstallClick
      //   }
      // });
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Verifica se já está instalado para esconder o botão
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt nativo do Android/iOS
    deferredPrompt.prompt();

    // Espera a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
      toast.success("Instalando aplicativo...");
    }
  };

  if (!isInstallable) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={handleInstallClick}
        className="text-emerald-600 font-medium hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 bg-emerald-50/50"
      >
        <Smartphone className="w-4 h-4" />
        <span>Instalar Aplicativo</span>
        <Download className="w-3 h-3 ml-auto opacity-50" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
