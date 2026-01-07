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
  Map,
  Search,
  ArrowRightLeft,
  User,
  Filter,
} from "lucide-react";

interface Visit {
  id: string;
  status: string;
  user_id: string;
  points_of_interest: {
    nome: string;
    bairro: string;
    endereco: string;
  };
  assignee: {
    full_name: string;
    manager_id: string | null; // Adicionado para identificar a hierarquia
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

  const [visits, setVisits] = useState<Visit[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]); // Para quem posso TRANSFERIR
  const [holders, setHolders] = useState<Profile[]>([]); // Para o FILTRO (Quem está com a rota)

  const [loading, setLoading] = useState(true);
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);

  // Filtros e Ações
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [filterHolderId, setFilterHolderId] = useState<string>("all");
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
      // 1. Carregar Visitas
      // Agora trazemos o 'manager_id' do responsável para saber de qual equipe ele é
      let visitsQuery = supabase
        .from("visits")
        .select(
          `
          id, 
          status,
          user_id,
          points_of_interest (nome, bairro, endereco),
          assignee:profiles!visits_user_id_fkey (
            full_name,
            manager_id
          ) 
        `
        )
        .eq("status", "a_visitar");

      if (profile?.role === "seller") {
        visitsQuery = visitsQuery.eq("user_id", user?.id);
      }

      const { data: visitsData, error: visitsError } = await visitsQuery;
      if (visitsError) throw visitsError;

      // 2. Carregar Equipe (Para os Dropdowns)
      let teamQuery = supabase.from("profiles").select("id, full_name, email");

      if (isAdmin) {
        teamQuery = teamQuery.eq("role", "manager");
      } else {
        teamQuery = teamQuery.eq("manager_id", user?.id).eq("role", "seller");
      }

      const { data: teamData, error: teamError } = await teamQuery.order(
        "full_name"
      );
      if (teamError) throw teamError;

      const team = (teamData as Profile[]) || [];

      setVisits((visitsData as any) || []);
      setTeamMembers(team);

      // O filtro de "Com quem está" inclui a mim mesmo e a equipe que gerencio
      const myself = {
        id: user!.id,
        full_name: "Comigo (Não distribuído)",
        email: user!.email || "",
      };
      setHolders([myself, ...team]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar rotas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async () => {
    if (!targetUserId || selectedVisits.length === 0) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("visits")
        .update({ user_id: targetUserId })
        .in("id", selectedVisits);

      if (error) throw error;

      toast({
        title: "Transferência Realizada",
        description: `${selectedVisits.length} rotas foram movidas com sucesso.`,
      });

      setSelectedVisits([]);
      setTargetUserId("");
      loadData();
    } catch (error: any) {
      console.error("Erro na distribuição:", error);
      toast({
        variant: "destructive",
        title: "Erro ao distribuir",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔎 LÓGICA DE FILTRAGEM INTELIGENTE (CASCATA)
  const filteredVisits = visits.filter((v) => {
    // 1. Filtro de Texto
    const matchesSearch =
      v.points_of_interest.nome
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      v.points_of_interest.bairro
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    // 2. Filtro de "Com quem está"
    let matchesHolder = true;

    if (filterHolderId !== "all") {
      if (isAdmin) {
        // SE FOR ADMIN:
        // O filtro selecionado é um ID de GERENTE.
        // Queremos ver rotas que estão DIRETAMENTE com esse gerente
        // OU rotas que estão com vendedores DELE (v.assignee.manager_id === filterHolderId)
        matchesHolder =
          v.user_id === filterHolderId ||
          v.assignee?.manager_id === filterHolderId;
      } else {
        // SE FOR GERENTE:
        // O filtro selecionado é um ID de VENDEDOR (ou o próprio gerente).
        // Queremos correspondência exata.
        matchesHolder = v.user_id === filterHolderId;
      }
    }

    return matchesSearch && matchesHolder;
  });

  const toggleSelectAll = () => {
    if (selectedVisits.length === filteredVisits.length) {
      setSelectedVisits([]);
    } else {
      setSelectedVisits(filteredVisits.map((v) => v.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedVisits.includes(id)) {
      setSelectedVisits(selectedVisits.filter((v) => v !== id));
    } else {
      setSelectedVisits([...selectedVisits, id]);
    }
  };

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
              <Map className="w-6 h-6 text-primary" />
              Distribuição de Rotas
            </h1>
            <p className="text-muted-foreground">
              {isAdmin
                ? "Gerencie as carteiras dos Gerentes e suas equipes."
                : "Gerencie quem vai visitar cada ponto."}
            </p>
          </div>

          <Card className="w-full md:w-auto min-w-[350px] border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ArrowRightLeft className="w-4 h-4" />
                Transferir Selecionados ({selectedVisits.length}) Para:
              </div>
              <div className="flex gap-2">
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="bg-background border-primary/20">
                    <SelectValue
                      placeholder={`Escolher ${targetRoleLabel}...`}
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
                    !targetUserId || selectedVisits.length === 0 || isSubmitting
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
              placeholder="Buscar por escola ou bairro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10"
            />
          </div>

          <div className="w-full md:w-64">
            <Select value={filterHolderId} onValueChange={setFilterHolderId}>
              <SelectTrigger className="h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue
                    placeholder={
                      isAdmin
                        ? "Filtrar por Gerente"
                        : "Filtrar por Responsável"
                    }
                  />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mostrar Todos</SelectItem>
                {holders.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.id === user?.id ? "Comigo (Não Atribuído)" : h.full_name}
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
                      filteredVisits.length > 0 &&
                      selectedVisits.length === filteredVisits.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Escola / PDV</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Responsável (Quem está visitando)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisits.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Map className="w-8 h-8 opacity-20" />
                      <p>Nenhuma rota encontrada com os filtros atuais.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisits.map((visit) => (
                  <TableRow key={visit.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox
                        checked={selectedVisits.includes(visit.id)}
                        onCheckedChange={() => toggleSelectOne(visit.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {visit.points_of_interest.nome}
                      <div className="md:hidden text-xs text-muted-foreground mt-1">
                        {visit.points_of_interest.bairro}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col text-sm">
                        <Badge variant="outline" className="w-fit mb-1">
                          {visit.points_of_interest.bairro}
                        </Badge>
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[200px]"
                          title={visit.points_of_interest.endereco}
                        >
                          {visit.points_of_interest.endereco}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {visit.user_id === user?.id ? (
                            <span className="text-primary font-bold">
                              ⚠️ Comigo (Precisa Distribuir)
                            </span>
                          ) : (
                            visit.assignee?.full_name || "Desconhecido"
                          )}
                        </span>
                      </div>
                      {/* Se for admin e estiver com um vendedor, mostra de quem é o vendedor (opcional, mas útil visualmente) */}
                      {isAdmin &&
                        visit.assignee?.manager_id === filterHolderId &&
                        filterHolderId !== "all" &&
                        visit.user_id !== filterHolderId && (
                          <div className="text-[10px] text-muted-foreground pl-5">
                            ↳ Equipe deste Gerente
                          </div>
                        )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">A Visitar</Badge>
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
