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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Loader2, DollarSign, BookOpen } from "lucide-react";

// Schema de validação
const formSchema = z.object({
  nome_completo: z.string().min(3, "Nome muito curto"),
  cpf: z.string().min(11, "CPF inválido"), // Idealmente adicionar máscara/validação real
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().min(10, "Telefone inválido"),
  curso_escolhido: z.string().min(2, "Selecione um curso"),
  valor_inscricao: z.string().min(1, "Valor obrigatório"),
  valor_mensalidade: z.string().min(1, "Valor obrigatório"),
  pdv_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastrarCliente() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [pdvs, setPdvs] = useState<{ id: string; nome: string }[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valor_inscricao: "0",
      valor_mensalidade: "0",
    },
  });

  useEffect(() => {
    // Carrega PDVs próximos ou atribuídos para facilitar o cadastro
    const loadPdvs = async () => {
      const { data } = await supabase
        .from("points_of_interest")
        .select("id, nome")
        .limit(50);
      if (data) setPdvs(data);
    };
    loadPdvs();
  }, []);

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
        pdv_id: data.pdv_id || null,
        seller_id: user.id,
        status: "pendente", // Status inicial padrão
      });

      if (error) throw error;

      toast({
        title: "Venda Realizada!",
        description: "Cliente cadastrado e aguardando matrícula.",
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
              {/* Dados Pessoais */}
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

                <div className="space-y-2">
                  <Label>Email (Opcional)</Label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="aluno@email.com"
                  />
                </div>
              </div>

              {/* Dados do Curso */}
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Inscrição (R$)</Label>
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
                    <Label>Valor Mensalidade (R$)</Label>
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
                </div>

                <div className="space-y-2">
                  <Label>PDV de Origem (Opcional)</Label>
                  <Select onValueChange={(val) => setValue("pdv_id", val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione onde foi a venda" />
                    </SelectTrigger>
                    <SelectContent>
                      {pdvs.map((pdv) => (
                        <SelectItem key={pdv.id} value={pdv.id}>
                          {pdv.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
