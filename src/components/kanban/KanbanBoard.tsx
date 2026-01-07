import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";
import { KanbanColumn } from "./KanbanColumn";
import { Loader2, Zap, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

type VisitStatus = "a_visitar" | "em_rota" | "visitado" | "finalizado";

// ... (Mantenha as interfaces POI, Profile, Visit iguais às anteriores) ...
interface POI {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  tipo: string;
  coordenadas: string | null;
}

interface Profile {
  full_name: string | null;
}

interface Visit {
  id: string;
  point_id: string;
  user_id: string;
  status: VisitStatus;
  collaborator_count: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  poi: POI | null;
  assignee: Profile | null;
}

const columns: { status: VisitStatus; title: string; color: string }[] = [
  { status: "a_visitar", title: "A Visitar", color: "status-todo" },
  { status: "em_rota", title: "Em Rota", color: "status-in-route" },
  { status: "visitado", title: "Visitado", color: "status-visited" },
  { status: "finalizado", title: "Finalizado", color: "status-finished" },
];

export function KanbanBoard() {
  const { user, profile } = useAuth();
  // 👇 Pegamos a nova função getCurrentLocation
  const { calculateDistance, getCurrentLocation } = useGeolocation();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false); // Estado para o loading do botão

  useEffect(() => {
    if (user && profile) {
      loadVisits();

      const channel = supabase
        .channel("public:visits")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "visits" },
          () => {
            loadVisits();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, profile]);

  const loadVisits = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      let query = supabase
        .from("visits")
        .select(
          `
          id, point_id, user_id, status, collaborator_count, checkin_time, checkout_time,
          poi:points_of_interest(id, nome, endereco, bairro, tipo, coordenadas),
          assignee:profiles(full_name)
        `
        )
        .order("created_at", { ascending: false });

      if (profile.role === "seller") {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setVisits((data as unknown as Visit[]) || []);
    } catch (err) {
      console.error("[Kanban] Erro:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar visitas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    visitId: string,
    newStatus: VisitStatus,
    collaboratorCount?: number
  ) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "em_rota")
        updates.checkin_time = new Date().toISOString();
      else if (newStatus === "finalizado") {
        updates.checkout_time = new Date().toISOString();
        updates.collaborator_count = collaboratorCount;
      }

      const { error } = await supabase
        .from("visits")
        .update(updates)
        .eq("id", visitId);
      if (error) throw error;

      setVisits((prev) =>
        prev.map((v) =>
          v.id === visitId ? { ...v, status: newStatus, ...updates } : v
        )
      );
      toast({
        title: "Status atualizado",
        description: `Visita movida para ${newStatus}`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar.",
      });
    }
  };

  // 🚀 OTIMIZADOR DE ROTA INTELIGENTE 2.0 (Com Força Bruta de GPS)
  const optimizeRoute = async () => {
    setOptimizing(true);
    try {
      // 1. Força a busca da localização atual (Isso acorda o GPS do celular)
      const location = await getCurrentLocation();

      console.log("[Kanban] GPS Capturado:", location);

      // 2. Separa as visitas
      const todoVisits = visits.filter((v) => v.status === "a_visitar");
      const otherVisits = visits.filter((v) => v.status !== "a_visitar");

      // 3. Função auxiliar para calcular distância baseada na nova localização
      const getDist = (coordsStr: string | null) => {
        if (!coordsStr || !location) return 99999;

        const [lat2Str, lon2Str] = coordsStr.split(",").map((s) => s.trim());
        const lat2 = parseFloat(lat2Str);
        const lon2 = parseFloat(lon2Str);

        // Haversine simples
        const R = 6371;
        const dLat = (lat2 - location.latitude) * (Math.PI / 180);
        const dLon = (lon2 - location.longitude) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(location.latitude * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // 4. Ordena
      const sortedTodo = todoVisits.sort((a, b) => {
        const distA = getDist(a.poi?.coordenadas || null);
        const distB = getDist(b.poi?.coordenadas || null);
        return distA - distB;
      });

      // 5. Atualiza
      setVisits([...sortedTodo, ...otherVisits]);

      toast({
        title: "Rota Otimizada! ⚡",
        description: `Visitas reordenadas a partir da sua posição atual.`,
        className: "bg-green-50 border-green-200",
      });
    } catch (error) {
      console.error("Erro ao otimizar:", error);
      // O toast de erro já é disparado dentro do hook getCurrentLocation
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-dashed">
        <div className="text-sm text-muted-foreground hidden md:block">
          {profile?.role !== "seller" ? (
            <span>
              <b>Visão Gerencial:</b> Acompanhando equipe.
            </span>
          ) : (
            <span>
              <b>Minha Rota:</b> Organize seu dia.
            </span>
          )}
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            variant="default"
            size="sm"
            onClick={optimizeRoute}
            disabled={optimizing}
            className="flex-1 md:flex-none gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition-all active:scale-95"
          >
            {optimizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
            {optimizing ? "Buscando Satélites..." : "Otimizar Rota"}
          </Button>

          <Button variant="ghost" size="sm" onClick={loadVisits}>
            <Navigation className="w-4 h-4 mr-2 md:hidden" />
            <span className="hidden md:inline">Atualizar</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            title={column.title}
            status={column.status}
            color={column.color}
            visits={visits.filter((v) => v.status === column.status)}
            onStatusChange={handleStatusChange}
            calculateDistance={calculateDistance}
          />
        ))}
      </div>
    </div>
  );
}
