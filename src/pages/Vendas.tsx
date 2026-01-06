import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, CheckCircle, Search, Loader2, User } from "lucide-react";

interface Customer {
  id: string;
  nome_completo: string;
  curso_escolhido: string;
  valor_inscricao: number;
  status: string;
  created_at: string;
  seller: {
    full_name: string;
  };
  pdv: {
    nome: string;
  };
}

export default function Vendas() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isManagerOrAdmin =
    profile?.role === "manager" || profile?.role === "admin";

  useEffect(() => {
    if (user) loadSales();
  }, [user, profile]);

  const loadSales = async () => {
    setLoading(true);
    try {
      // Busca clientes com join para trazer nome do vendedor e do PDV
      let query = supabase
        .from("customers")
        .select(
          `
          *,
          seller:profiles(full_name),
          pdv:points_of_interest(nome)
        `
        )
        .order("created_at", { ascending: false });

      // O RLS já filtra, mas por segurança visual no front:
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

      toast({
        title: "Sucesso!",
        description: "Status alterado para Matriculado.",
      });

      // Atualiza lista localmente
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matriculado":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">Matriculado</Badge>
        );
      case "pendente":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25"
          >
            Pendente
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.curso_escolhido.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Gestão de Vendas
            </h1>
            <p className="text-muted-foreground">
              {profile?.role === "seller"
                ? "Minhas vendas realizadas"
                : "Visão geral das vendas da equipe"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              {customers.length}
            </div>
            <div className="text-xs text-muted-foreground">Vendas Totais</div>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do aluno ou curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 bg-transparent"
          />
        </div>

        <Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Valores</TableHead>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhuma venda encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{sale.nome_completo}</span>
                          <span className="text-xs text-muted-foreground">
                            {sale.pdv?.nome || "PDV não informado"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{sale.curso_escolhido}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span>Inscr: R$ {sale.valor_inscricao}</span>
                        </div>
                      </TableCell>
                      {isManagerOrAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">
                              {sale.seller?.full_name || "Desconhecido"}
                            </span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      {isManagerOrAdmin && (
                        <TableCell className="text-right">
                          {sale.status === "pendente" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-8"
                              onClick={() => handleMatricular(sale.id)}
                              disabled={!!processingId}
                            >
                              {processingId === sale.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
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
