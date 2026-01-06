import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { KanbanColumn } from './KanbanColumn';
import { Loader2 } from 'lucide-react';

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

const columns: { status: VisitStatus; title: string; color: string }[] = [
  { status: 'a_visitar', title: 'A Visitar', color: 'status-todo' },
  { status: 'em_rota', title: 'Em Rota', color: 'status-in-route' },
  { status: 'visitado', title: 'Visitado', color: 'status-visited' },
  { status: 'finalizado', title: 'Finalizado', color: 'status-finished' },
];

export function KanbanBoard() {
  const { user } = useAuth();
  const { calculateDistance } = useGeolocation();
  const { toast } = useToast();
  
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      console.log('[Kanban] Loading visits for user:', user.id);
      loadVisits();
    }
  }, [user]);

  const loadVisits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          id,
          point_id,
          status,
          collaborator_count,
          checkin_time,
          checkout_time,
          poi:points_of_interest(id, nome, endereco, bairro, tipo, coordenadas)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Kanban] Error loading visits:', error);
        throw error;
      }

      console.log('[Kanban] Loaded visits:', data?.length);
      setVisits((data as unknown as Visit[]) || []);
    } catch (err) {
      console.error('[Kanban] Exception loading visits:', err);
      toast({
        title: 'Erro ao carregar visitas',
        description: 'Não foi possível carregar as visitas',
        variant: 'destructive',
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
    console.log('[Kanban] Status change:', visitId, 'to', newStatus);
    
    const currentVisit = visits.find(v => v.id === visitId);
    if (!currentVisit) return;

    // Validation: Can't start new route if one is already in progress
    if (newStatus === 'em_rota') {
      const hasActiveRoute = visits.some(v => v.status === 'em_rota' && v.id !== visitId);
      if (hasActiveRoute) {
        console.log('[Kanban] Blocked - already has active route');
        toast({
          title: 'Ação bloqueada',
          description: 'Finalize a rota atual antes de iniciar outra',
          variant: 'destructive',
        });
        return;
      }
    }

    // Validation: Must provide collaborator count to finalize
    if (newStatus === 'finalizado' && collaboratorCount === undefined) {
      console.log('[Kanban] Blocked - missing collaborator count');
      toast({
        title: 'Informe os colaboradores',
        description: 'Você precisa informar a quantidade de colaboradores para finalizar',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updates: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === 'em_rota') {
        updates.checkin_time = new Date().toISOString();
      } else if (newStatus === 'finalizado') {
        updates.checkout_time = new Date().toISOString();
        updates.collaborator_count = collaboratorCount;
      }

      const { error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', visitId);

      if (error) throw error;

      console.log('[Kanban] Status updated successfully');
      
      setVisits(prev =>
        prev.map(v =>
          v.id === visitId
            ? { ...v, status: newStatus, collaborator_count: collaboratorCount ?? v.collaborator_count }
            : v
        )
      );

      toast({
        title: 'Status atualizado',
        description: `Visita movida para "${columns.find(c => c.status === newStatus)?.title}"`,
      });
    } catch (err) {
      console.error('[Kanban] Error updating status:', err);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
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
  );
}
