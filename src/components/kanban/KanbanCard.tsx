import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MapPin,
  Navigation,
  Users,
  ArrowRight,
  Clock,
  AlertTriangle,
  ExternalLink,
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

interface Profile {
  full_name: string | null;
}

interface Visit {
  id: string;
  point_id: string;
  status: VisitStatus;
  collaborator_count: number | null;
  checkin_time: string | null;
  checkout_time: string | null;
  poi: POI | null;
  assignee: Profile | null;
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
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showGpsDialog, setShowGpsDialog] = useState(false);
  const [collaboratorCount, setCollaboratorCount] = useState("");

  // 🛡️ BLINDAGEM DE DADOS
  if (!visit.poi) {
    return (
      <Card className="p-4 bg-destructive/10 border-destructive/50">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-medium">Dados indisponíveis</span>
        </div>
      </Card>
    );
  }

  const distance = visit.poi.coordenadas
    ? calculateDistance(visit.poi.coordenadas)
    : null;
  const next = nextStatus[currentStatus];

  const assigneeName = visit.assignee?.full_name || "Desconhecido";
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleAction = () => {
    if (currentStatus === "a_visitar") {
      // Abre escolha de GPS
      setShowGpsDialog(true);
    } else if (currentStatus === "visitado") {
      // Abre finalização
      setShowFinishDialog(true);
    } else if (next) {
      // Ação direta (Em Rota -> Visitado)
      onStatusChange(visit.id, next);
    }
  };

  const handleStartRoute = (app: "waze" | "google") => {
    if (!visit.poi) return;

    // Monta o endereço completo para maior precisão
    const destination = encodeURIComponent(
      `${visit.poi.endereco}, ${visit.poi.bairro}`
    );

    let url = "";
    if (app === "waze") {
      url = `https://waze.com/ul?q=${destination}&navigate=yes`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${destination}`;
    }

    // Abre o GPS
    window.open(url, "_blank");

    // Atualiza status para "Em Rota"
    onStatusChange(visit.id, "em_rota");
    setShowGpsDialog(false);
  };

  const handleFinalize = () => {
    const count = parseInt(collaboratorCount, 10);
    if (isNaN(count) || count < 0) return;
    onStatusChange(visit.id, "finalizado", count);
    setShowFinishDialog(false);
    setCollaboratorCount("");
  };

  return (
    <>
      <Card className="p-4 space-y-3 bg-card border-border/50 hover:border-primary/30 transition-colors shadow-sm group">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">
              {visit.poi.nome}
            </h4>
            <div className="flex gap-2 mt-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {poiTypeLabels[visit.poi.tipo] || visit.poi.tipo}
              </Badge>
              <div className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-0.5 border">
                <Avatar className="w-3 h-3">
                  <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                    {assigneeInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">
                  {assigneeName.split(" ")[0]}
                </span>
              </div>
            </div>
          </div>

          {distance !== null && (
            <div className="flex items-center gap-1 text-xs text-primary font-medium whitespace-nowrap bg-primary/5 px-2 py-1 rounded-md">
              <Navigation className="w-3 h-3" />
              {distance.toFixed(1)} km
            </div>
          )}
        </div>

        {/* Endereço */}
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{visit.poi.endereco}</span>
          </div>
          <div className="pl-5 font-medium text-foreground/80">
            {visit.poi.bairro}
          </div>
        </div>

        {/* Status e Timers */}
        <div className="flex flex-wrap gap-2 pt-1">
          {visit.collaborator_count !== null && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
              <Users className="w-3 h-3" />
              <span>{visit.collaborator_count}</span>
            </div>
          )}

          {visit.checkin_time && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(visit.checkin_time).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Botão Principal */}
        {next && (
          <Button
            size="sm"
            className="w-full h-9 mt-2 text-xs font-medium"
            onClick={handleAction}
          >
            {statusLabels[currentStatus]}
            <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
        )}
      </Card>

      {/* 🚀 DIALOG 1: ESCOLHA DE GPS */}
      <Dialog open={showGpsDialog} onOpenChange={setShowGpsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Navegação</DialogTitle>
            <DialogDescription>
              Escolha seu aplicativo preferido para ir até{" "}
              <strong>{visit.poi.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 hover:border-blue-500 hover:bg-blue-50"
              onClick={() => handleStartRoute("waze")}
            >
              <Navigation className="w-6 h-6 text-blue-500" />
              <span>Waze</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2 hover:border-green-500 hover:bg-green-50"
              onClick={() => handleStartRoute("google")}
            >
              <MapPin className="w-6 h-6 text-green-600" />
              <span>Google Maps</span>
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <div className="text-xs text-muted-foreground w-full text-center">
              A rota será iniciada automaticamente após a escolha.
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ DIALOG 2: FINALIZAR VISITA */}
      <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
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
              placeholder="Ex: 5"
              value={collaboratorCount}
              onChange={(e) => setCollaboratorCount(e.target.value)}
              className="h-12"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFinishDialog(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleFinalize} disabled={!collaboratorCount}>
              Concluir e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
