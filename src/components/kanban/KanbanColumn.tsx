import { KanbanCard } from './KanbanCard';

type VisitStatus = 'a_visitar' | 'em_rota' | 'visitado' | 'finalizado';

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
  poi: POI;
}

interface KanbanColumnProps {
  title: string;
  status: VisitStatus;
  color: string;
  visits: Visit[];
  onStatusChange: (visitId: string, newStatus: VisitStatus, collaboratorCount?: number) => void;
  calculateDistance: (coords: string) => number | null;
}

export function KanbanColumn({
  title,
  status,
  color,
  visits,
  onStatusChange,
  calculateDistance,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col bg-card/50 rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto text-sm text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
          {visits.length}
        </span>
      </div>
      
      <div className="flex-1 p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
        {visits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma visita
          </div>
        ) : (
          visits.map((visit) => (
            <KanbanCard
              key={visit.id}
              visit={visit}
              currentStatus={status}
              onStatusChange={onStatusChange}
              calculateDistance={calculateDistance}
            />
          ))
        )}
      </div>
    </div>
  );
}
