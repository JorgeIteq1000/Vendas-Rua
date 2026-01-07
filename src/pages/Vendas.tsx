import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ShoppingCart,
  CheckCircle,
  Search,
  Loader2,
  User,
  FileDown,
  Info,
  Calendar,
  Filter,
  FileText,
  X, // Ícone para limpar filtros
} from "lucide-react";

interface SellerProfile {
  id: string;
  full_name: string;
  manager_id: string | null;
  role: string;
}

interface Customer {
  id: string;
  nome_completo: string;
  curso_escolhido: string;
  valor_inscricao: number;
  valor_mensalidade: number;
  parcelas: number;
  observacao: string | null;
  status: string;
  created_at: string;
  seller_id: string;
  seller: SellerProfile;
  pdv: { nome: string; bairro: string };
}

interface TeamMember {
  id: string;
  full_name: string;
  role: "admin" | "manager" | "seller";
}

export default function Vendas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilterId, setSelectedFilterId] = useState<string>("all");
  const [startDate, setStartDate] = useState(""); // Novo: Data Inicial
  const [endDate, setEndDate] = useState(""); // Novo: Data Final
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isManagerOrAdmin =
    profile?.role === "manager" || profile?.role === "admin";
  const pageTitle =
    profile?.role === "admin" ? "Relatórios de Vendas" : "Gestão de Vendas";

  useEffect(() => {
    if (user) {
      loadSales();
      if (isManagerOrAdmin) {
        loadTeam();
      }
    }
  }, [user, profile]);

  const loadTeam = async () => {
    try {
      let query = supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("full_name");

      const { data } = await query;
      if (data) setTeamMembers(data as TeamMember[]);
    } catch (err) {
      console.error("Erro ao carregar equipe:", err);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("customers")
        .select(
          `
          *,
          seller:profiles(id, full_name, manager_id, role),
          pdv:points_of_interest(nome, bairro)
        `
        )
        .order("created_at", { ascending: false });

      if (profile?.role === "seller") {
        query = query.eq("seller_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCustomers((data as any) || []);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar vendas.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMatricular = async (customerId: string) => {
    setProcessingId(customerId);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ status: "matriculado" } as any)
        .eq("id", customerId);

      if (error) throw error;

      toast({ title: "Sucesso!", description: "Aluno matriculado." });
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId ? { ...c, status: "matriculado" } : c
        )
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message,
      });
    } finally {
      setProcessingId(null);
    }
  };

  // 🧠 LÓGICA DE FILTRAGEM TURBINADA (Texto + Equipe + Data)
  const filteredCustomers = customers.filter((c) => {
    // 1. Filtro de Texto
    const matchesSearch =
      c.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.curso_escolhido.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filtro de Equipe
    let matchesFilter = true;
    if (selectedFilterId !== "all") {
      const filterOwner = teamMembers.find((m) => m.id === selectedFilterId);
      if (filterOwner?.role === "manager") {
        matchesFilter =
          c.seller_id === selectedFilterId ||
          c.seller?.manager_id === selectedFilterId;
      } else {
        matchesFilter = c.seller_id === selectedFilterId;
      }
    }

    // 3. Filtro de Datas (Intervalo)
    let matchesDate = true;
    if (startDate || endDate) {
      const saleDate = new Date(c.created_at);

      if (startDate) {
        // Cria data inicio do dia (00:00:00) local
        const start = new Date(startDate + "T00:00:00");
        if (saleDate < start) matchesDate = false;
      }

      if (endDate) {
        // Cria data fim do dia (23:59:59) local
        const end = new Date(endDate + "T23:59:59.999");
        if (saleDate > end) matchesDate = false;
      }
    }

    return matchesSearch && matchesFilter && matchesDate;
  });

  const exportToCSV = () => {
    if (filteredCustomers.length === 0) {
      toast({
        title: "Sem dados",
        description: "Nenhum registro para exportar com os filtros atuais.",
      });
      return;
    }

    const headers = [
      "Data",
      "Nome do Cliente",
      "Curso",
      "Inscrição",
      "Mensalidade",
      "Parcelas",
      "Bairro",
      "Vendedor",
      "Gerente",
      "Status",
      "Observação",
    ];

    const rows = filteredCustomers.map((c) => {
      const managerName =
        teamMembers.find((m) => m.id === c.seller?.manager_id)?.full_name ||
        "-";

      return [
        new Date(c.created_at).toLocaleDateString("pt-BR"),
        `"${c.nome_completo}"`,
        `"${c.curso_escolhido}"`,
        c.valor_inscricao.toFixed(2).replace(".", ","),
        c.valor_mensalidade.toFixed(2).replace(".", ","),
        c.parcelas,
        `"${c.pdv?.bairro || "N/A"}"`,
        `"${c.seller?.full_name || "N/A"}"`,
        `"${managerName}"`,
        c.status,
        `"${c.observacao || ""}"`,
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);

    const filterName =
      selectedFilterId === "all"
        ? "geral"
        : teamMembers
            .find((m) => m.id === selectedFilterId)
            ?.full_name.replace(/\s+/g, "_") || "relatorio";

    const dateSuffix = startDate ? `_de_${startDate}` : "";

    link.setAttribute("download", `relatorio_${filterName}${dateSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const managers = teamMembers.filter((m) => m.role === "manager");
  const sellers = teamMembers.filter((m) => m.role === "seller");

  // Função para limpar filtros de data
  const clearDates = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              {profile?.role === "admin" ? (
                <FileText className="w-6 h-6 text-primary" />
              ) : (
                <ShoppingCart className="w-6 h-6 text-primary" />
              )}
              {pageTitle}
            </h1>
            <p className="text-muted-foreground">
              {profile?.role === "seller"
                ? "Minhas vendas"
                : "Visualize e exporte os resultados."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isManagerOrAdmin && (
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="gap-2 border-primary/20 hover:bg-primary/5"
              >
                <FileDown className="w-4 h-4 text-primary" />
                Exportar CSV
              </Button>
            )}
            <div className="bg-primary/10 px-4 py-2 rounded-lg text-right min-w-[100px]">
              <div className="text-xl font-bold text-primary">
                {filteredCustomers.length}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                Total
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS APRIMORADA */}
        <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 1. Busca Texto */}
            <div className="flex-1 flex items-center gap-2 bg-muted/50 px-3 rounded-md">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por aluno ou curso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10"
              />
            </div>

            {/* 2. Filtro de Vendedor (Admin/Manager) */}
            {isManagerOrAdmin && (
              <div className="w-full md:w-64">
                <Select
                  value={selectedFilterId}
                  onValueChange={setSelectedFilterId}
                >
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <SelectValue placeholder="Filtrar Relatório" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos (Geral)</SelectItem>

                    {managers.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Gerentes (Equipes)</SelectLabel>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.full_name || "Sem nome"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {sellers.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Vendedores (Individual)</SelectLabel>
                        {sellers.map((seller) => (
                          <SelectItem key={seller.id} value={seller.id}>
                            {seller.full_name || "Sem nome"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 3. Filtro de Datas */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t border-dashed">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Período:
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full sm:w-40"
              />
              <span className="text-muted-foreground text-xs">até</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full sm:w-40"
              />
              {(startDate || endDate) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearDates}
                  className="h-9 w-9 shrink-0"
                  title="Limpar datas"
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <Card>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Aluno / PDV</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Detalhes</TableHead>
                  {isManagerOrAdmin && <TableHead>Vendedor</TableHead>}
                  <TableHead>Status</TableHead>
                  {isManagerOrAdmin && (
                    <TableHead className="text-right">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhum registro encontrado neste período.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(sale.created_at).toLocaleDateString(
                            "pt-BR"
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{sale.nome_completo}</span>
                          <span className="text-xs text-muted-foreground">
                            {sale.pdv?.nome}
                          </span>
                          <span className="text-[10px] text-muted-foreground italic">
                            {sale.pdv?.bairro}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{sale.curso_escolhido}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs gap-1">
                          <span className="font-medium text-emerald-600">
                            Inscr: R$ {sale.valor_inscricao.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">
                            Mensal: R$ {sale.valor_mensalidade.toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="whitespace-nowrap"
                          >
                            {sale.parcelas}x
                          </Badge>
                          {sale.observacao && (
                            <Popover>
                              <PopoverTrigger>
                                <Info className="w-4 h-4 text-blue-500 cursor-pointer hover:text-blue-700" />
                              </PopoverTrigger>
                              <PopoverContent className="w-80 p-4 text-sm bg-white text-zinc-900 shadow-xl border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700">
                                <div className="space-y-2">
                                  <h4 className="font-semibold leading-none border-b pb-2 mb-2">
                                    Observações
                                  </h4>
                                  <p className="text-muted-foreground leading-relaxed">
                                    {sale.observacao}
                                  </p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </TableCell>

                      {isManagerOrAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-2 text-xs">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span>{sale.seller?.full_name?.split(" ")[0]}</span>
                          </div>
                        </TableCell>
                      )}

                      <TableCell>
                        {sale.status === "matriculado" ? (
                          <Badge className="bg-green-500 hover:bg-green-600">
                            Matriculado
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-yellow-500/15 text-yellow-700"
                          >
                            Pendente
                          </Badge>
                        )}
                      </TableCell>

                      {isManagerOrAdmin && (
                        <TableCell className="text-right">
                          {sale.status === "pendente" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                              onClick={() => handleMatricular(sale.id)}
                              disabled={!!processingId}
                            >
                              {processingId === sale.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              Matricular
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
