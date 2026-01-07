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
  Map as MapIcon,
  Search,
  ArrowRightLeft,
  User,
  Filter,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";

// Tipos do Banco
interface Point {
  id: string;
  nome: string;
  bairro: string;
  endereco: string;
  tipo: string; // Adicionado Tipo
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

const ITEMS_PER_PAGE = 50;

export default function DistribuirRotas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  // Dados
  const [points, setPoints] = useState<Point[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);

  // Estados de Controle
  const [loading, setLoading] = useState(true);
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filtros e Ações
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [filterHolder, setFilterHolder] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all"); // Novo Filtro de Tipo
  const [searchTerm, setSearchTerm] = useState("");

  // Estado para debounce da busca (evita requisições a cada letra)
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = profile?.role === "admin";
  const targetRoleLabel = isAdmin ? "Gerente" : "Vendedor";

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reseta paginação ao buscar
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Recarrega quando mudar página ou filtros
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, profile, page, debouncedSearch, filterHolder, filterType]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Construir a Query Base de Pontos
      let query = supabase
        .from("points_of_interest")
        .select("id, nome, bairro, endereco, tipo", { count: "exact" });

      // --- APLICAÇÃO DE FILTROS (SERVER-SIDE) ---

      // Filtro de Texto (Nome ou Bairro)
      if (debouncedSearch) {
        query = query.or(
          `nome.ilike.%${debouncedSearch}%,bairro.ilike.%${debouncedSearch}%`
        );
      }

      // Filtro de Tipo (Escola, Hospital...)
      if (filterType !== "all") {
        query = query.eq("tipo", filterType as any);
      }

      // Paginação
      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const {
        data: pointsData,
        error: pointsError,
        count,
      } = await query.order("nome", { ascending: true }).range(from, to);

      if (pointsError) throw pointsError;
      setTotalCount(count || 0);

      if (!pointsData || pointsData.length === 0) {
        setPoints([]);
        setLoading(false);
        return;
      }

      // 2. Buscar Visitas Ativas APENAS para os pontos carregados (Performance 🚀)
      const pointIds = pointsData.map((p) => p.id);

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
        .in("point_id", pointIds)
        .neq("status", "finalizado");

      if (visitsError) throw visitsError;

      // 3. Cruzar os dados
      const visitsMap = new Map();
      visitsData?.forEach((v: any) => {
        visitsMap.set(v.point_id, {
          id: v.id,
          user_id: v.user_id,
          assignee_name: v.assignee?.full_name || "Desconhecido",
          manager_id: v.assignee?.manager_id,
        });
      });

      let processedPoints: Point[] = pointsData.map((p) => ({
        ...p,
        active_visit: visitsMap.get(p.id) || null,
      }));

      // 4. Aplicar Filtro de "Quem está com a rota" (No Front, pois é complexo no banco)
      // Nota: Idealmente seria no banco, mas exigiria joins complexos. Como são só 50 itens, o front aguenta.
      if (filterHolder !== "all") {
        if (filterHolder === "unassigned") {
          processedPoints = processedPoints.filter((p) => !p.active_visit);
        } else {
          processedPoints = processedPoints.filter(
            (p) => p.active_visit?.user_id === filterHolder
          );
        }
      }

      setPoints(processedPoints);

      // 5. Carregar Equipe (apenas uma vez ou se vazio)
      if (teamMembers.length === 0) {
        let teamQuery = supabase
          .from("profiles")
          .select("id, full_name, email");
        if (isAdmin) {
          teamQuery = teamQuery.eq("role", "manager");
        } else {
          teamQuery = teamQuery.eq("manager_id", user?.id).eq("role", "seller");
        }
        const { data: teamData } = await teamQuery.order("full_name");
        setTeamMembers((teamData as Profile[]) || []);
      }
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

      for (const pointId of selectedPoints) {
        const point = points.find((p) => p.id === pointId);
        // Se já tem visita ativa E não é o mesmo usuário alvo
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

      if (pointsToUpdate.length > 0) {
        const { error: updateError } = await supabase
          .from("visits")
          .update({
            user_id: targetUserId,
            status: "a_visitar",
            checkin_time: null,
            checkout_time: null,
          })
          .in("id", pointsToUpdate);
        if (updateError) throw updateError;
      }

      if (pointsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("visits")
          .insert(pointsToInsert);
        if (insertError) throw insertError;
      }

      toast({
        title: "Sucesso!",
        description: `${selectedPoints.length} rotas distribuídas.`,
      });

      setSelectedPoints([]);
      setTargetUserId("");
      loadData();
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

  const toggleSelectAll = () => {
    if (selectedPoints.length === points.length) {
      setSelectedPoints([]);
    } else {
      setSelectedPoints(points.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedPoints.includes(id)) {
      setSelectedPoints(selectedPoints.filter((pid) => pid !== id));
    } else {
      setSelectedPoints([...selectedPoints, id]);
    }
  };

  // Extrair holders únicos da página atual para o filtro rápido
  const currentPageHolders = Array.from(
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {" "}
        {/* Padding bottom para não colar no final */}
        {/* CABEÇALHO E AÇÕES */}
        <div className="flex flex-col xl:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <MapIcon className="w-6 h-6 text-primary" />
              Central de Distribuição
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Total Global: <strong>{totalCount}</strong> PDVs encontrados.
            </p>
          </div>

          <Card className="w-full xl:w-auto border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end sm:items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-primary whitespace-nowrap">
                <ArrowRightLeft className="w-4 h-4" />
                Mover Selecionados ({selectedPoints.length}):
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="bg-background border-primary/20 min-w-[200px]">
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
        {/* BARRA DE FILTROS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card p-4 rounded-lg border shadow-sm">
          {/* Busca Texto */}
          <div className="md:col-span-5 flex items-center gap-2 bg-muted/50 px-3 rounded-md border border-transparent focus-within:border-primary/30 transition-all">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar PDV, Bairro ou Endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10"
            />
          </div>

          {/* Filtro de Tipo */}
          <div className="md:col-span-3">
            <Select
              value={filterType}
              onValueChange={(val) => {
                setFilterType(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Tipo de Estabelecimento" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="escola">Escola</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="upa">UPA</SelectItem>
                <SelectItem value="clinica">Clínica</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro de Status/Dono */}
          <div className="md:col-span-4">
            <Select
              value={filterHolder}
              onValueChange={(val) => {
                setFilterHolder(val);
              }}
            >
              <SelectTrigger className="h-10 bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mostrar Tudo (Página Atual)</SelectItem>
                <SelectItem
                  value="unassigned"
                  className="text-amber-600 font-medium"
                >
                  ⚠️ Não Atribuídos
                </SelectItem>
                {currentPageHolders.length > 0 && (
                  <SelectItem disabled value="sep">
                    ──────────
                  </SelectItem>
                )}
                {currentPageHolders.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>
                    Com: {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* TABELA DE DADOS */}
        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      points.length > 0 &&
                      selectedPoints.length === points.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>PDV / Estabelecimento</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <p>Carregando dados do servidor...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : points.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="w-8 h-8 opacity-20" />
                      <p>Nenhum ponto encontrado com estes filtros.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                points.map((point) => (
                  <TableRow
                    key={point.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
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
                          className="w-fit mb-1 bg-muted/50 text-[10px]"
                        >
                          {point.bairro}
                        </Badge>
                        <span
                          className="text-xs text-muted-foreground truncate max-w-[250px]"
                          title={point.endereco}
                        >
                          {point.endereco}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {point.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {point.active_visit ? (
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[120px]">
                            {point.active_visit.assignee_name}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800"
                        >
                          Disponível
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* PAGINAÇÃO */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            Página <strong>{page + 1}</strong> de{" "}
            <strong>{totalPages || 1}</strong>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
