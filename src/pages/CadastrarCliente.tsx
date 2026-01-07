import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // Importando Popover
import { toast } from "@/hooks/use-toast";
import {
  UserPlus,
  Loader2,
  DollarSign,
  BookOpen,
  FileText,
  CreditCard,
  ChevronsUpDown,
  Check,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Utilitário de classes padrão do shadcn

const formSchema = z.object({
  nome_completo: z.string().min(3, "Nome muito curto"),
  cpf: z.string().min(11, "CPF inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().min(10, "Telefone inválido"),
  curso_escolhido: z.string().min(2, "Selecione um curso"),
  valor_inscricao: z.string().min(1, "Valor obrigatório"),
  valor_mensalidade: z.string().min(1, "Valor obrigatório"),
  parcelas: z.string().min(1, "Informe as parcelas"),
  observacao: z.string().optional(),
  pdv_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastrarCliente() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [pdvs, setPdvs] = useState<
    { id: string; nome: string; bairro: string }[]
  >([]);

  // Estados para o Combobox de PDV
  const [openPdvSelect, setOpenPdvSelect] = useState(false);
  const [searchPdv, setSearchPdv] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valor_inscricao: "0",
      valor_mensalidade: "0",
      parcelas: "1",
      observacao: "",
    },
  });

  const selectedPdvId = watch("pdv_id");

  useEffect(() => {
    if (user && profile) {
      loadPdvs();
    }
  }, [user, profile]);

  const loadPdvs = async () => {
    try {
      let data: any[] = [];

      if (profile?.role === "admin") {
        const response = await supabase
          .from("points_of_interest")
          .select("id, nome, bairro")
          .limit(1000);
        data = response.data || [];
      } else {
        const response = await supabase
          .from("visits")
          .select(`poi:points_of_interest (id, nome, bairro)`);

        if (response.data) {
          const uniqueMap = new Map();
          response.data.forEach((item: any) => {
            if (item.poi) {
              uniqueMap.set(item.poi.id, item.poi);
            }
          });
          data = Array.from(uniqueMap.values());
        }
      }

      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setPdvs(data);
    } catch (error) {
      console.error("Erro ao carregar PDVs:", error);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("customers").insert({
        nome_completo: data.nome_completo,
        cpf: data.cpf,
        email: data.email || null,
        telefone: data.telefone,
        curso_escolhido: data.curso_escolhido,
        valor_inscricao: parseFloat(data.valor_inscricao),
        valor_mensalidade: parseFloat(data.valor_mensalidade),
        parcelas: parseInt(data.parcelas),
        observacao: data.observacao || null,
        pdv_id: data.pdv_id || null,
        seller_id: user.id,
        status: "pendente",
      });

      if (error) throw error;

      toast({
        title: "Venda Realizada!",
        description: "Cliente cadastrado com sucesso.",
      });
      navigate("/vendas");
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filtra os PDVs baseado na busca
  const filteredPdvs = pdvs.filter(
    (pdv) =>
      pdv.nome.toLowerCase().includes(searchPdv.toLowerCase()) ||
      (pdv.bairro && pdv.bairro.toLowerCase().includes(searchPdv.toLowerCase()))
  );

  const selectedPdvLabel = pdvs.find((p) => p.id === selectedPdvId)?.nome;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <UserPlus className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Nova Venda</h1>
            <p className="text-muted-foreground">Cadastre os dados do aluno</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Aluno *</Label>
                  <Input
                    {...register("nome_completo")}
                    placeholder="Nome completo"
                  />
                  {errors.nome_completo && (
                    <p className="text-xs text-destructive">
                      {errors.nome_completo.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CPF *</Label>
                    <Input {...register("cpf")} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <Input
                      {...register("telefone")}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="space-y-2">
                  <Label>Curso Escolhido *</Label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...register("curso_escolhido")}
                      className="pl-10"
                      placeholder="Ex: Administração"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Inscrição (R$)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        {...register("valor_inscricao")}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensalidade (R$)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        {...register("valor_mensalidade")}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="1"
                        {...register("parcelas")}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      {...register("observacao")}
                      className="pl-10 min-h-[80px]"
                      placeholder="Detalhes sobre pagamento, melhor horário, etc."
                    />
                  </div>
                </div>

                {/* 👇 COMBOBOX PESQUISÁVEL 👇 */}
                <div className="space-y-2">
                  <Label>PDV de Origem</Label>

                  <Popover open={openPdvSelect} onOpenChange={setOpenPdvSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPdvSelect}
                        className="w-full justify-between h-10 px-3 font-normal"
                      >
                        {selectedPdvLabel ? (
                          <span className="truncate">{selectedPdvLabel}</span>
                        ) : (
                          <span className="text-muted-foreground">
                            Selecione ou pesquise o local...
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <div className="flex flex-col">
                        {/* Campo de Busca */}
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Buscar por nome ou bairro..."
                            value={searchPdv}
                            onChange={(e) => setSearchPdv(e.target.value)}
                            autoFocus
                          />
                        </div>

                        {/* Lista de Opções */}
                        <div className="max-h-[200px] overflow-y-auto p-1">
                          {filteredPdvs.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Nenhum PDV encontrado.
                            </div>
                          ) : (
                            filteredPdvs.map((pdv) => (
                              <div
                                key={pdv.id}
                                className={cn(
                                  "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                  selectedPdvId === pdv.id && "bg-accent/50"
                                )}
                                onClick={() => {
                                  setValue("pdv_id", pdv.id);
                                  setOpenPdvSelect(false);
                                  setSearchPdv(""); // Limpa busca ao selecionar
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPdvId === pdv.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{pdv.nome}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {pdv.bairro}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <p className="text-[10px] text-muted-foreground">
                    * Exibindo apenas PDVs atribuídos à sua equipe (Carteira).
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    "Finalizar Venda"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
