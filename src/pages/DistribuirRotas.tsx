import { useState, useEffect, useMemo } from "react";
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
import { Slider } from "@/components/ui/slider";
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
  Radius,
  Building2,
} from "lucide-react";

interface Point {
  id: string;
  nome: string;
  bairro: string;
  endereco: string;
  tipo: string;
  coordenadas: string | null;
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

// 📐 FÓRMULA DE HAVERSINE
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DistribuirRotas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [allPoints, setAllPoints] = useState<Point[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0); // Para mostrar progresso do carregamento
  const [selectedPoints, setSelectedPoints] = useState<string[]>([]);

  // Filtros
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [filterHolder, setFilterHolder] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [radius, setRadius] = useState([0]);

  const [page, setPage] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = profile?.role === "admin";
  const targetRoleLabel = isAdmin ? "Gerente" : "Vendedor";

  useEffect(() => {
    if (user) loadData();
  }, [user, profile]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, filterHolder, filterType, radius]);

  // 🚜 FUNÇÃO DE CARREGAMENTO EM LOTES (PDVs)
  const fetchAllPoints = async () => {
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000; // Limite máximo seguro do Supabase

    while (hasMore) {
      const { data, error } = await supabase
        .from("points_of_interest")
        .select("id, nome, bairro, endereco, tipo, coordenadas")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        // Atualiza progresso visual (opcional)
        setProgress((prev) => prev + 1);

        if (data.length < pageSize) {
          hasMore = false; // Chegou no fim
        } else {
          page++; // Tem mais, próxima página
        }
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  // 🚜 FUNÇÃO DE CARREGAMENTO EM LOTES (Visitas)
  const fetchAllVisits = async () => {
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data, error } = await supabase
        .from("visits")
        .select(
          `
          id, point_id, user_id, 
          assignee:profiles!visits_user_id_fkey(full_name, manager_id)
        `
        )
        .neq("status", "finalizado")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const loadData = async () => {
    setLoading(true);
    setProgress(0);
    try {
      // 1. Carregar TUDO usando as funções em lote
      const [pointsData, visitsData] = await Promise.all([
        fetchAllPoints(),
        fetchAllVisits(),
      ]);

      // 3. Cruzar dados (Igual antes, mas agora com arrays completos)
      const visitsMap = new Map();
      visitsData?.forEach((v: any) => {
        visitsMap.set(v.point_id, {
          id: v.id,
          user_id: v.user_id,
          assignee_name: v.assignee?.full_name || "Desconhecido",
          manager_id: v.assignee?.manager_id,
        });
      });

      const mergedPoints: Point[] = (pointsData || []).map((p: any) => ({
        ...p,
        active_visit: visitsMap.get(p.id) || null,
      }));

      // Ordenar por nome para facilitar busca
      mergedPoints.sort((a, b) => a.nome.localeCompare(b.nome));

      setAllPoints(mergedPoints);

      // 4. Carregar Equipe
      let teamQuery = supabase.from("profiles").select("id, full_name, email");
      if (isAdmin) {
        teamQuery = teamQuery.eq("role", "manager");
      } else {
        teamQuery = teamQuery.eq("manager_id", user?.id).eq("role", "seller");
      }
      const { data: teamData } = await teamQuery.order("full_name");
      setTeamMembers((teamData as Profile[]) || []);
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar dados completos.",
      });
    } finally {
      setLoading(false);
    }
  };

  // 🧠 CÉREBRO DA FILTRAGEM
  const filteredPoints = useMemo(() => {
    let result = allPoints;

    // 1. Filtro de Tipo
    if (filterType !== "all") {
      // @ts-ignore
      result = result.filter((p) => p.tipo === filterType);
    }

    // 2. Filtro de Responsável
    if (filterHolder !== "all") {
      if (filterHolder === "unassigned") {
        result = result.filter((p) => !p.active_visit);
      } else {
        result = result.filter((p) => p.active_visit?.user_id === filterHolder);
      }
    }

    // 3. Lógica do RADAR
    const searchLower = searchTerm.toLowerCase();
    const currentRadius = radius[0];

    if (searchTerm) {
      if (currentRadius > 0) {
        // Acha o "Pivô"
        const pivotPoint = result.find(
          (p) =>
            p.nome.toLowerCase().includes(searchLower) ||
            p.bairro.toLowerCase().includes(searchLower)
        );

        if (pivotPoint && pivotPoint.coordenadas) {
          const [pivotLat, pivotLng] = pivotPoint.coordenadas
            .split(",")
            .map(Number);

          result = result.filter((p) => {
            if (!p.coordenadas) return false;
            const [pLat, pLng] = p.coordenadas.split(",").map(Number);
            const distance = calculateDistance(pivotLat, pivotLng, pLat, pLng);
            return distance <= currentRadius;
          });
        } else {
          result = result.filter(
            (p) =>
              p.nome.toLowerCase().includes(searchLower) ||
              p.bairro.toLowerCase().includes(searchLower)
          );
        }
      } else {
        result = result.filter(
          (p) =>
            p.nome.toLowerCase().includes(searchLower) ||
            p.bairro.toLowerCase().includes(searchLower)
        );
      }
    }

    return result;
  }, [allPoints, searchTerm, filterType, filterHolder, radius]);

  const paginatedPoints = useMemo(() => {
    const from = page * ITEMS_PER_PAGE;
    return filteredPoints.slice(from, from + ITEMS_PER_PAGE);
  }, [filteredPoints, page]);

  const totalPages = Math.ceil(filteredPoints.length / ITEMS_PER_PAGE);

  const handleDistribute = async () => {
    if (!targetUserId || selectedPoints.length === 0) return;
    setIsSubmitting(true);
    try {
      const pointsToUpdate = [];
      const pointsToInsert = [];

      for (const pointId of selectedPoints) {
        const point = allPoints.find((p) => p.id === pointId);
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
        await supabase
          .from("visits")
          .update({
            user_id: targetUserId,
            status: "a_visitar",
            checkin_time: null,
            checkout_time: null,
          })
          .in("id", pointsToUpdate);
      }

      if (pointsToInsert.length > 0) {
        await supabase.from("visits").insert(pointsToInsert);
      }

      toast({
        title: "Sucesso!",
        description: `${selectedPoints.length} rotas distribuídas.`,
      });
      setSelectedPoints([]);
      setTargetUserId("");
      loadData();
    } catch (error: any) {
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
    if (selectedPoints.length === paginatedPoints.length) setSelectedPoints([]);
    else setSelectedPoints(paginatedPoints.map((p) => p.id));
  };

  const toggleSelectOne = (id: string) => {
    if (selectedPoints.includes(id))
      setSelectedPoints(selectedPoints.filter((pid) => pid !== id));
    else setSelectedPoints([...selectedPoints, id]);
  };

  const holders = Array.from(
    new Set(
      allPoints.map((p) =>
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

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        <div className="flex flex-col xl:flex-row justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <MapIcon className="w-6 h-6 text-primary" />
              Central de Distribuição
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visualizando <strong>{filteredPoints.length}</strong> de{" "}
              {allPoints.length} PDVs.
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-card p-4 rounded-lg border shadow-sm items-end">
          <div className="md:col-span-4 space-y-2">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Bairro / Referência
            </label>
            <div className="flex items-center gap-2 bg-muted/50 px-3 rounded-md border border-transparent focus-within:border-primary/30 h-10">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ex: Vila Rio Branco..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 bg-transparent h-full"
              />
            </div>
          </div>

          <div className="md:col-span-3 space-y-2 px-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Radius className="w-3 h-3" /> Raio de Expansão
              </label>
              <span className="text-xs font-bold text-primary">
                {radius[0] === 0 ? "Desligado" : `${radius[0]} km`}
              </span>
            </div>
            <Slider
              value={radius}
              onValueChange={setRadius}
              max={5}
              step={0.5}
              className="py-2"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Tipo
            </label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
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

          <div className="md:col-span-3 space-y-2">
            <label className="text-xs font-medium text-muted-foreground ml-1">
              Situação
            </label>
            <Select value={filterHolder} onValueChange={setFilterHolder}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mostrar Tudo</SelectItem>
                <SelectItem
                  value="unassigned"
                  className="text-amber-600 font-medium"
                >
                  ⚠️ Não Atribuídos
                </SelectItem>
                {holders.length > 0 && (
                  <SelectItem disabled value="sep">
                    ──────────
                  </SelectItem>
                )}
                {holders.map((h: any) => (
                  <SelectItem key={h.id} value={h.id}>
                    Com: {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      paginatedPoints.length > 0 &&
                      selectedPoints.length === paginatedPoints.length
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
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">
                      Carregando {allPoints.length || "dados"} itens do
                      servidor...
                    </p>
                  </TableCell>
                </TableRow>
              ) : paginatedPoints.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <MapPin className="w-8 h-8 opacity-20" />
                      <p>Nenhum ponto encontrado.</p>
                      {radius[0] > 0 && (
                        <p className="text-xs text-amber-600">
                          Dica: Verifique se o ponto de referência existe.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPoints.map((point) => (
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-xs text-muted-foreground">
              Página <strong>{page + 1}</strong> de{" "}
              <strong>{totalPages}</strong>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próximo <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
