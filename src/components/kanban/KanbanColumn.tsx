import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";

type VisitStatus = "a_visitar" | "em_rota" | "visitado" | "finalizado";

// Adicionei os tipos das novas props aqui 👇
interface KanbanColumnProps {
  title: string;
  status: VisitStatus;
  color: string;
  visits: any[];
  onStatusChange: (
    visitId: string,
    newStatus: VisitStatus,
    extraData?: any
  ) => void;
  calculateDistance: (coords: string) => number | null;
  // Novas props necessárias:
  userLocation: { latitude: number; longitude: number } | null;
  onSchedule: (visitId: string, date: Date) => void;
}

export function KanbanColumn({
  title,
  status,
  color,
  visits,
  onStatusChange,
  calculateDistance,
  userLocation, // Recebendo do Board
  onSchedule, // Recebendo do Board
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div className="flex flex-col h-full bg-muted/40 rounded-lg border border-border/50">
      {/* Cabeçalho da Coluna */}
      <div
        className={`p-3 border-b border-border/50 flex justify-between items-center ${
          status === "a_visitar"
            ? "bg-blue-50/50 dark:bg-blue-900/10"
            : status === "em_rota"
            ? "bg-yellow-50/50 dark:bg-yellow-900/10"
            : status === "visitado"
            ? "bg-orange-50/50 dark:bg-orange-900/10"
            : "bg-green-50/50 dark:bg-green-900/10"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium bg-background/50 px-2 py-0.5 rounded-full">
          {visits.length}
        </span>
      </div>

      {/* Área de Drop e Lista de Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[150px] overflow-y-auto custom-scrollbar"
      >
        {visits.map((visit) => (
          <KanbanCard
            key={visit.id}
            visit={visit}
            currentStatus={status}
            onStatusChange={onStatusChange}
            calculateDistance={calculateDistance}
            // Repassando para o Card 👇
            userLocation={userLocation}
            onSchedule={onSchedule}
          />
        ))}

        {visits.length === 0 && (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-muted rounded-md opacity-50 p-4">
            <span className="text-xs text-muted-foreground text-center">
              Arraste itens aqui ou inicie uma rota
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
