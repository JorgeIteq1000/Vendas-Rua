import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";
import { KanbanColumn } from "./KanbanColumn";
import { Loader2, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";

type VisitStatus = "a_visitar" | "em_rota" | "visitado" | "finalizado";

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
  user_id: string; // Importante para saber de quem é
  status: VisitStatus;
  collaborator_count: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  poi: POI | null;
  assignee: Profile | null; // Novo campo para o nome do vendedor
}

const columns: { status: VisitStatus; title: string; color: string }[] = [
  { status: "a_visitar", title: "A Visitar", color: "status-todo" },
  { status: "em_rota", title: "Em Rota", color: "status-in-route" },
  { status: "visitado", title: "Visitado", color: "status-visited" },
  { status: "finalizado", title: "Finalizado", color: "status-finished" },
];

export function KanbanBoard() {
  const { user, profile } = useAuth(); // Precisamos do profile para saber a role
  const { calculateDistance } = useGeolocation();
  const { toast } = useToast();

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      console.log(
        `[Kanban] Initializing for user ${profile.email} (${profile.role})`
      );
      loadVisits();

      // Inscreve para atualizações em tempo real (Opcional, mas recomendado para dashboards)
      const channel = supabase
        .channel("public:visits")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "visits" },
          (payload) => {
            console.log("[Kanban] Realtime update received:", payload);
            loadVisits(); // Recarrega simples para garantir consistência
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
      console.log("[Kanban] Fetching visits...");

      // Query base
      let query = supabase
        .from("visits")
        .select(
          `
          id,
          point_id,
          user_id,
          status,
          collaborator_count,
          checkin_time,
          checkout_time,
          poi:points_of_interest(id, nome, endereco, bairro, tipo, coordenadas),
          assignee:profiles(full_name)
        `
        )
        .order("created_at", { ascending: false });

      // 🔍 LÓGICA DE VISIBILIDADE
      // Se for Vendedor, vê apenas as suas.
      // Se for Admin ou Manager, NÃO filtramos por user_id, deixamos o RLS trazer tudo que eles podem ver.
      if (profile.role === "seller") {
        console.log("[Kanban] Applying seller filter (own visits only)");
        query = query.eq("user_id", user.id);
      } else {
        console.log(
          `[Kanban] User is ${profile.role}. Showing all accessible visits.`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("[Kanban] Error loading visits:", error);
        throw error;
      }

      console.log(`[Kanban] Loaded ${data?.length} visits.`);
      setVisits((data as unknown as Visit[]) || []);
    } catch (err) {
      console.error("[Kanban] Exception loading visits:", err);
      toast({
        title: "Erro ao carregar visitas",
        description: "Não foi possível carregar o quadro de visitas.",
        variant: "destructive",
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
    console.log("[Kanban] Status change request:", visitId, "to", newStatus);

    // Validações básicas
    if (newStatus === "em_rota") {
      // Verifica se O USUÁRIO RESPONSÁVEL já tem uma rota (não o usuário logado necessariamente)
      const visitToUpdate = visits.find((v) => v.id === visitId);
      const assigneeId = visitToUpdate?.user_id;

      const hasActiveRoute = visits.some(
        (v) =>
          v.status === "em_rota" && v.id !== visitId && v.user_id === assigneeId // Checa rota ativa daquele vendedor específico
      );

      if (hasActiveRoute) {
        console.warn("[Kanban] Blocked: Assignee already has an active route.");
        toast({
          title: "Ação bloqueada",
          description: "Este vendedor já possui uma rota em andamento.",
          variant: "destructive",
        });
        return;
      }
    }

    if (newStatus === "finalizado" && collaboratorCount === undefined) {
      toast({
        title: "Informe os colaboradores",
        description: "Necessário informar a quantidade para finalizar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === "em_rota") {
        updates.checkin_time = new Date().toISOString();
      } else if (newStatus === "finalizado") {
        updates.checkout_time = new Date().toISOString();
        updates.collaborator_count = collaboratorCount;
      }

      const { error } = await supabase
        .from("visits")
        .update(updates)
        .eq("id", visitId);

      if (error) throw error;

      console.log("[Kanban] Status updated in DB.");

      // Atualização otimista local
      setVisits((prev) =>
        prev.map((v) =>
          v.id === visitId
            ? {
                ...v,
                status: newStatus,
                collaborator_count: collaboratorCount ?? v.collaborator_count,
              }
            : v
        )
      );

      toast({
        title: "Status atualizado",
        description: `Visita movida para "${
          columns.find((c) => c.status === newStatus)?.title
        }"`,
      });
    } catch (err) {
      console.error("[Kanban] Error updating status:", err);
      toast({
        title: "Erro ao atualizar",
        description: "Falha na comunicação com o servidor.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          Carregando rotas da equipe...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com resumo para Gestores */}
      {profile?.role !== "seller" && (
        <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-dashed">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Modo Visão Geral:
            </span>{" "}
            Você está vendo todas as visitas da sua equipe.
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadVisits}
            title="Recarregar"
          >
            Atualizar Lista
          </Button>
        </div>
      )}

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
