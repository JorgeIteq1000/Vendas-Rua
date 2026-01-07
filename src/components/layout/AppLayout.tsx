import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    // Só rastreia se for Vendedor (Seller)
    if (!user || profile?.role !== "seller") return;

    if (!navigator.geolocation) return;

    console.log("[Tracker] Iniciando rastreamento...");

    const watcher = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        // Throttling: Só atualiza no máximo a cada 30 segundos
        if (now - lastUpdate.current < 30000) return;

        const { latitude, longitude } = position.coords;
        lastUpdate.current = now;

        console.log("[Tracker] Atualizando posição:", latitude, longitude);

        // Atualiza o Supabase (Fire and Forget)
        const { error } = await supabase
          .from("profiles")
          .update({
            last_latitude: latitude,
            last_longitude: longitude,
            last_location_time: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (error) console.error("[Tracker] Erro ao salvar:", error);
      },
      (error) => {
        console.error("[Tracker] Erro GPS:", error);
        if (error.code === 1) {
          toast({
            variant: "destructive",
            title: "GPS Desativado",
            description: "Ative a localização para usar o sistema.",
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [user, profile]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        {/* 👇 AQUI O AJUSTE: 'pt-16' no mobile, 'md:pt-4' no desktop */}
        <main className="flex-1 p-4 pt-16 md:p-4 overflow-auto relative w-full">
          <div className="absolute top-4 left-4 z-50 md:hidden">
            <SidebarTrigger />
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
