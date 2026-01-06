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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// 👇 A CORREÇÃO ESTÁ AQUI: Adicionei FileText na lista
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
} from "lucide-react";

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
  seller: { full_name: string };
  pdv: { nome: string; bairro: string };
}

interface Profile {
  id: string;
  full_name: string;
}

export default function Vendas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all");
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
        .select("id, full_name")
        .order("full_name");
      const { data } = await query;
      if (data) setSellers(data as Profile[]);
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
          seller:profiles(full_name),
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
        .update({ status: "matriculado" })
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

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.curso_escolhido.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeller =
      selectedSellerId === "all" || c.seller_id === selectedSellerId;

    return matchesSearch && matchesSeller;
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
      "Status",
      "Observação",
    ];

    const rows = filteredCustomers.map((c) => [
      new Date(c.created_at).toLocaleDateString("pt-BR"),
      `"${c.nome_completo}"`,
      `"${c.curso_escolhido}"`,
      c.valor_inscricao.toFixed(2).replace(".", ","),
      c.valor_mensalidade.toFixed(2).replace(".", ","),
      c.parcelas,
      `"${c.pdv?.bairro || "N/A"}"`,
      `"${c.seller?.full_name || "N/A"}"`,
      c.status,
      `"${c.observacao || ""}"`,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `relatorio_${
        selectedSellerId === "all" ? "geral" : "individual"
      }_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex-1 flex items-center gap-2 bg-muted/50 px-3 rounded-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por aluno ou curso..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 bg-transparent h-10"
            />
          </div>

          {isManagerOrAdmin && (
            <div className="w-full md:w-64">
              <Select
                value={selectedSellerId}
                onValueChange={setSelectedSellerId}
              >
                <SelectTrigger className="h-10">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por Vendedor" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Vendedores</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                      Nenhum registro encontrado.
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
                              <PopoverContent className="w-64 text-sm p-3 bg-white">
                                <p className="font-semibold mb-1">
                                  Observações:
                                </p>
                                {sale.observacao}
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
