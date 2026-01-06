import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Users,
  Filter,
} from "lucide-react";

interface Visit {
  id: string;
  status: string;
  points_of_interest: {
    nome: string;
    bairro: string;
    endereco: string;
  };
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
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisits, setSelectedVisits] = useState<string[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>("");
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
      // 1. Carregar Visitas que estão COMIGO (user_id = meu id)
      // Só posso distribuir o que está na minha mão.
      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select(
          `
          id, 
          status,
          points_of_interest (nome, bairro, endereco)
        `
        )
        .eq("user_id", user?.id)
        .eq("status", "a_visitar"); // Só distribui o que não foi feito ainda

      if (visitsError) throw visitsError;

      // 2. Carregar Equipe para quem posso enviar
      let teamQuery = supabase.from("profiles").select("id, full_name, email");

      if (isAdmin) {
        // Admin envia para Gerentes
        teamQuery = teamQuery.eq("role", "manager");
      } else {
        // Gerente envia para Vendedores da sua equipe
        teamQuery = teamQuery.eq("manager_id", user?.id).eq("role", "seller");
      }

      const { data: teamData, error: teamError } = await teamQuery;

      if (teamError) throw teamError;

      setVisits((visitsData as any) || []);
      setTeamMembers(teamData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao carregar visitas ou equipe.",
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
        .update({ user_id: targetUserId }) // A mágica acontece aqui: troca o dono
        .in("id", selectedVisits);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `${selectedVisits.length} rotas foram transferidas com sucesso.`,
      });

      // Limpa seleção e recarrega
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

  // Filtro de busca local
  const filteredVisits = visits.filter(
    (v) =>
      v.points_of_interest.nome
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      v.points_of_interest.bairro
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              Distribuição de Rotas
            </h1>
            <p className="text-muted-foreground">
              Você tem <strong>{visits.length}</strong> visitas na sua carteira
              para distribuir.
            </p>
          </div>

          <Card className="w-full md:w-auto min-w-[300px] border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Users className="w-4 h-4" />
                Destino ({targetRoleLabel})
              </div>
              <div className="flex gap-2">
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue
                      placeholder={`Selecione um ${targetRoleLabel}`}
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
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Filtrar por nome da escola ou bairro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {selectedVisits.length} selecionados
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
                <TableHead>Bairro</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisits.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhuma rota disponível para distribuição.
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {visit.points_of_interest.bairro}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                      {visit.points_of_interest.endereco}
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
