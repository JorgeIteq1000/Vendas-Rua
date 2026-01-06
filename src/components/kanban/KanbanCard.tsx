import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MapPin,
  Navigation,
  Users,
  ArrowRight,
  Clock,
  AlertTriangle,
} from "lucide-react";

type VisitStatus = "a_visitar" | "em_rota" | "visitado" | "finalizado";

interface POI {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  tipo: string;
  coordenadas: string | null;
}

interface Visit {
  id: string;
  point_id: string;
  status: VisitStatus;
  collaborator_count: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  poi: POI | null; // POI pode ser nulo se a permissão falhar
}

interface KanbanCardProps {
  visit: Visit;
  currentStatus: VisitStatus;
  onStatusChange: (
    visitId: string,
    newStatus: VisitStatus,
    collaboratorCount?: number
  ) => void;
  calculateDistance: (coords: string) => number | null;
}

const nextStatus: Record<VisitStatus, VisitStatus | null> = {
  a_visitar: "em_rota",
  em_rota: "visitado",
  visitado: "finalizado",
  finalizado: null,
};

const statusLabels: Record<VisitStatus, string> = {
  a_visitar: "Iniciar Rota",
  em_rota: "Marcar Visitado",
  visitado: "Finalizar",
  finalizado: "",
};

const poiTypeLabels: Record<string, string> = {
  escola: "Escola",
  hospital: "Hospital",
  upa: "UPA",
  clinica: "Clínica",
  empresa: "Empresa",
  comercio: "Comércio",
  outro: "Outro",
};

export function KanbanCard({
  visit,
  currentStatus,
  onStatusChange,
  calculateDistance,
}: KanbanCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [collaboratorCount, setCollaboratorCount] = useState("");

  // 🛡️ BLINDAGEM: Verifica se POI existe antes de tentar acessar
  if (!visit.poi) {
    return (
      <Card className="p-4 bg-destructive/10 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-medium">
            Dados do local indisponíveis
          </span>
        </div>
      </Card>
    );
  }

  // Agora é seguro acessar visit.poi
  const distance = visit.poi.coordenadas
    ? calculateDistance(visit.poi.coordenadas)
    : null;
  const next = nextStatus[currentStatus];

  const handleAction = () => {
    console.log("[KanbanCard] Action triggered for status:", currentStatus);

    if (currentStatus === "visitado") {
      setShowDialog(true);
    } else if (next) {
      onStatusChange(visit.id, next);
    }
  };

  const handleFinalize = () => {
    const count = parseInt(collaboratorCount, 10);
    if (isNaN(count) || count < 0) {
      return;
    }
    console.log("[KanbanCard] Finalizing with collaborators:", count);
    onStatusChange(visit.id, "finalizado", count);
    setShowDialog(false);
    setCollaboratorCount("");
  };

  return (
    <>
      <Card className="p-4 space-y-3 bg-card border-border/50 hover:border-primary/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm leading-tight">
              {visit.poi.nome}
            </h4>
            <Badge variant="secondary" className="mt-1 text-xs">
              {poiTypeLabels[visit.poi.tipo] || visit.poi.tipo}
            </Badge>
          </div>
          {distance !== null && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium whitespace-nowrap">
              <Navigation className="w-3 h-3" />
              {distance.toFixed(1)} km
            </div>
          )}
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{visit.poi.endereco}</span>
          </div>
          <div className="font-medium text-foreground/80">
            {visit.poi.bairro}
          </div>
        </div>

        {visit.collaborator_count !== null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{visit.collaborator_count} colaborador(es)</span>
          </div>
        )}

        {visit.checkin_time && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              Check-in:{" "}
              {new Date(visit.checkin_time).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {next && (
          <Button size="sm" className="w-full h-10 mt-2" onClick={handleAction}>
            {statusLabels[currentStatus]}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Informe a quantidade de colaboradores encontrados em{" "}
              <strong>{visit.poi.nome}</strong>:
            </p>
            <Input
              type="number"
              min="0"
              placeholder="Número de colaboradores"
              value={collaboratorCount}
              onChange={(e) => setCollaboratorCount(e.target.value)}
              className="h-12"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFinalize} disabled={!collaboratorCount}>
              Finalizar Visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
