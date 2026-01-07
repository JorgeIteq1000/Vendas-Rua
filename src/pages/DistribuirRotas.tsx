import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Map as MapIcon, // 👈 CORREÇÃO: Renomeando para não conflitar com o 'Map' do JS
  Search,
  ArrowRightLeft,
  User,
  Filter,
  MapPin,
} from "lucide-react";

interface Point {
  id: string;
  nome: string;
  bairro: string;
  endereco: string;
  active_visit?: {
    id: string;
    user_id: string;
    assignee_name: string;
    manager_id: string | null;
  } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

export default function DistribuirRotas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [points, setPoints] = useState<Point[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]); // IDs dos PDVs selecionados

  // Filtros e Ações
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [filterHolder, setFilterHolder] = useState<string>("all"); // 'all', 'unassigned', or user_id
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = profile?.role === "admin";
  const targetRoleLabel = isAdmin ? "Gerente" : "Vendedor";

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, profile]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Carregar TODAS as Escolas/PDVs (Fonte da Verdade)
      const { data: pointsData, error: pointsError } = await supabase
        .from("points_of_interest")
        .select("id, nome, bairro, endereco")
        .order("nome");

      if (pointsError) throw pointsError;

      // 2. Carregar Visitas Ativas (Para saber com quem está cada escola)
      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select(
          `
          id, 
          point_id, 
          user_id, 
          assignee:profiles!visits_user_id_fkey(full_name, manager_id)
        `
        )
        .eq("status", "a_visitar"); // Só interessa o que está pendente

      if (visitsError) throw visitsError;

      // 3. Cruzar os dados (Escola + Visita Ativa)
      // 👇 AGORA O 'Map' FUNCIONA PORQUE O ÍCONE FOI RENOMEADO
      const visitsMap = new Map();
      visitsData?.forEach((v: any) => {
        visitsMap.set(v.point_id, {
          id: v.id,
          user_id: v.user_id,
          assignee_name: v.assignee?.full_name || "Desconhecido",
          manager_id: v.assignee?.manager_id,
        });
      });

      const mergedPoints: Point[] = (pointsData || []).map((p) => ({
        ...p,
        active_visit: visitsMap.get(p.id) || null,
      }));

      setPoints(mergedPoints);

      // 4. Carregar Equipe (Para quem enviar)
      let teamQuery = supabase.from("profiles").select("id, full_name, email");

      if (isAdmin) {
        teamQuery = teamQuery.eq("role", "manager");
      } else {
        // Gerente só vê seus vendedores
        teamQuery = teamQuery.eq("manager_id", user?.id).eq("role", "seller");
      }

      const { data: teamData } = await teamQuery.order("full_name");
      setTeamMembers((teamData as Profile[]) || []);
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async () => {
    if (!targetUserId || selectedPoints.length === 0) return;

    setIsSubmitting(true);
    try {
      const pointsToUpdate = [];
      const pointsToInsert = [];

      // Separa o que é UPDATE (já tem visita) do que é INSERT (novo)
      for (const pointId of selectedPoints) {
        const point = points.find((p) => p.id === pointId);
        if (point?.active_visit) {
          pointsToUpdate.push(point.active_visit.id);
        } else {
          pointsToInsert.push({
            point_id: pointId,
            user_id: targetUserId,
            status: "a_visitar",
          });
        }
      }

      // Executa UPDATEs
      if (pointsToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from("visits")
          .update({
            user_id: targetUserId,
            status: "a_visitar", // 👈 ADICIONADO: Reseta o status para a 1ª etapa
            checkin_time: null, // (Opcional) Limpa dados de checkin se houver
            checkout_time: null, // (Opcional) Limpa dados de checkout
          })
          .in("id", pointsToUpdate);
        if (updateError) throw updateError;
      }

      // Executa INSERTs
      if (pointsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("visits")
          .insert(pointsToInsert);
        if (insertError) throw insertError;
      }

      toast({
        title: "Distribuição Concluída! 🚀",
        description: `${selectedPoints.length} rotas atribuídas com sucesso.`,
      });

      setSelectedPoints([]);
      setTargetUserId("");
      loadData(); // Recarrega para ver as mudanças
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔎 FILTRAGEM INTELIGENTE
  const filteredPoints = points.filter((p) => {
    // 1. Busca por Texto
    const matchesSearch =
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.bairro.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filtro de Responsável
    let matchesHolder = true;
    if (filterHolder !== "all") {
      if (filterHolder === "unassigned") {
        matchesHolder = !p.active_visit;
      } else {
        matchesHolder = p.active_visit?.user_id === filterHolder;
      }
    }

    return matchesSearch && matchesHolder;
  });

  const toggleSelectAll = () => {
    if (selectedPoints.length === filteredPoints.length) {
      setSelectedPoints([]);
    } else {
      setSelectedPoints(filteredPoints.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedPoints.includes(id)) {
      setSelectedPoints(selectedPoints.filter((pid) => pid !== id));
    } else {
      setSelectedPoints([...selectedPoints, id]);
    }
  };

  // Calcula lista única de "Donos" atuais para o filtro
  const holders = Array.from(
    new Set(
      points.map((p) =>
        p.active_visit
          ? JSON.stringify({
              id: p.active_visit.user_id,
              name: p.active_visit.assignee_name,
            })
          : null
      )
    )
  )
    .filter(Boolean)
    .map((s) => JSON.parse(s as string));

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              {/* 👇 CORREÇÃO: Usando MapIcon aqui */}
              <MapIcon className="w-6 h-6 text-primary" />
              Central de Distribuição
            </h1>
            <p className="text-muted-foreground">
              Total de PDVs: <strong>{points.length}</strong> | Selecionados:{" "}
              <strong>{selectedPoints.length}</strong>
            </p>
          </div>

          <Card className="w-full md:w-auto min-w-[350px] border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ArrowRightLeft className="w-4 h-4" />
                Enviar Selecionados Para:
              </div>
              <div className="flex gap-2">
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="bg-background border-primary/20">
                    <SelectValue
                      placeholder={`Selecione o ${targetRoleLabel}...`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleDistribute}
                  disabled={
                    !targetUserId || selectedPoints.length === 0 || isSubmitting
                  }
                  className="shadow-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex-1 flex items-center gap-2 bg-muted/50 px-3 rounded-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nome ou bairro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10"
            />
          </div>

          <div className="w-full md:w-64">
            <Select value={filterHolder} onValueChange={setFilterHolder}>
              <SelectTrigger className="h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mostrar Todos</SelectItem>
                <SelectItem
                  value="unassigned"
                  className="text-amber-600 font-medium"
                >
                  ⚠️ Não Atribuídos
                </SelectItem>
                {holders.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>
                    Com: {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      filteredPoints.length > 0 &&
                      selectedPoints.length === filteredPoints.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>PDV / Escola</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPoints.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="w-8 h-8 opacity-20" />
                      <p>Nenhum ponto encontrado.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPoints.map((point) => (
                  <TableRow key={point.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox
                        checked={selectedPoints.includes(point.id)}
                        onCheckedChange={() => toggleSelectOne(point.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {point.nome}
                      <div className="md:hidden text-xs text-muted-foreground mt-1">
                        {point.bairro}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col text-sm">
                        <Badge
                          variant="outline"
                          className="w-fit mb-1 bg-muted/50"
                        >
                          {point.bairro}
                        </Badge>
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[300px]"
                          title={point.endereco}
                        >
                          {point.endereco}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {point.active_visit ? (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                            {point.active_visit.assignee_name}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-muted-foreground font-normal bg-gray-100 dark:bg-gray-800"
                        >
                          Não Atribuído
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
