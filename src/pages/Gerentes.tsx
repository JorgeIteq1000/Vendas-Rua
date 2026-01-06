import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  Loader2,
  Mail,
  User,
  Ban,
  CheckCircle,
  ArrowRightLeft,
} from "lucide-react";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  fullName: z
    .string()
    .trim()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(50),
});

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "manager" | "seller";
  created_at: string;
  is_active?: boolean;
}

export default function Gerentes() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for Invite Form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  // States for Transfer Action
  const [selectedManagerToTransferFrom, setSelectedManagerToTransferFrom] =
    useState<TeamMember | null>(null);
  const [selectedNewManagerId, setSelectedNewManagerId] = useState<string>("");

  // Permissions logic
  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const canManage = isAdmin || isManager;
  const targetRole = isAdmin ? "manager" : "seller";
  const targetRoleLabel = isAdmin ? "Gerente" : "Vendedor";
  const pageTitle = isAdmin ? "Gerentes" : "Equipe";
  const pageDescription = isAdmin
    ? "Gerencie os gerentes da plataforma, bloqueie acessos ou transfira equipes."
    : "Gerencie os vendedores da sua equipe.";

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/auth");
      return;
    }

    if (!authLoading && profile && !canManage) {
      navigate("/");
      return;
    }

    if (profile && canManage) {
      loadTeamMembers();
    }
  }, [profile, authLoading, navigate, canManage]);

  const loadTeamMembers = async () => {
    try {
      let query = supabase.from("profiles").select("*");

      if (isAdmin) {
        query = query.eq("role", "manager");
      } else if (isManager) {
        query = query.eq("manager_id", profile?.id).eq("role", "seller");
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) {
        console.error("Error loading team:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar a equipe.",
        });
      } else {
        setTeamMembers(data as TeamMember[]);
      }
    } catch (err) {
      console.error("Exception loading team:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = inviteSchema.safeParse({ email, fullName, password });
    if (!validation.success) {
      const errorMessages = validation.error.errors
        .map((e) => e.message)
        .join(", ");
      toast({
        variant: "destructive",
        title: "Dados inválidos",
        description: errorMessages,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: validation.data.fullName },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Usuário não foi criado");

      const updateData: {
        role: "admin" | "manager" | "seller";
        manager_id?: string;
        is_active: boolean;
      } = {
        role: targetRole as "manager" | "seller",
        is_active: true,
      };

      if (isManager && profile?.id) {
        updateData.manager_id = profile.id;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", authData.user.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        toast({
          variant: "default",
          title: "Aviso",
          description: "Usuário criado, mas houve erro ao definir permissões.",
        });
      } else {
        toast({
          title: "Sucesso!",
          description: `${targetRoleLabel} cadastrado com sucesso!`,
        });
      }

      setEmail("");
      setFullName("");
      setPassword("");
      setIsDialogOpen(false);
      loadTeamMembers();
    } catch (err: any) {
      console.error("Error creating user:", err);
      toast({
        variant: "destructive",
        title: "Erro ao cadastrar",
        description: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (member: TeamMember) => {
    try {
      const newStatus = !member.is_active;
      // Se member.is_active for undefined (banco antigo), assumimos true, então newStatus seria false
      const currentStatus =
        member.is_active === undefined ? true : member.is_active;
      const finalStatus = !currentStatus;

      console.log(
        `[Gerentes] Toggling status for ${member.email} to ${finalStatus}`
      );

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: finalStatus })
        .eq("id", member.id);

      if (error) throw error;

      toast({
        title: finalStatus ? "Usuário Ativado" : "Usuário Bloqueado",
        description: `O acesso de ${member.full_name} foi ${
          finalStatus ? "liberado" : "bloqueado"
        }.`,
        variant: finalStatus ? "default" : "destructive",
      });

      loadTeamMembers();
    } catch (error: any) {
      console.error("Error toggling status:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar status.",
      });
    }
  };

  const openTransferDialog = (manager: TeamMember) => {
    setSelectedManagerToTransferFrom(manager);
    setIsTransferDialogOpen(true);
  };

  const handleTransferTeam = async () => {
    if (!selectedManagerToTransferFrom || !selectedNewManagerId) return;

    setIsSubmitting(true);
    console.log(
      `[Gerentes] Transferring team from ${selectedManagerToTransferFrom.full_name} to manager ID ${selectedNewManagerId}`
    );

    try {
      // Atualiza todos os profiles que tinham o antigo manager para o novo manager
      const { error, count } = await supabase
        .from("profiles")
        .update({ manager_id: selectedNewManagerId })
        .eq("manager_id", selectedManagerToTransferFrom.id);

      if (error) throw error;

      toast({
        title: "Transferência Concluída",
        description: `${
          count || 0
        } vendedores foram movidos para o novo gerente.`,
      });

      setIsTransferDialogOpen(false);
      setSelectedManagerToTransferFrom(null);
      setSelectedNewManagerId("");
    } catch (error: any) {
      console.error("Error transferring team:", error);
      toast({
        variant: "destructive",
        title: "Erro na transferência",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Filter out the manager we are transferring FROM so we don't transfer to themselves
  const availableManagers = teamMembers.filter((m) =>
    selectedManagerToTransferFrom
      ? m.id !== selectedManagerToTransferFrom.id
      : true
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">{pageTitle}</h1>
            <p className="text-muted-foreground">{pageDescription}</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="w-4 h-4" />
                Cadastrar {targetRoleLabel}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar {targetRoleLabel}</DialogTitle>
                <DialogDescription>
                  Preencha os dados para cadastrar um novo{" "}
                  {targetRoleLabel.toLowerCase()}.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    `Cadastrar ${targetRoleLabel}`
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transfer Team Dialog */}
        <Dialog
          open={isTransferDialogOpen}
          onOpenChange={setIsTransferDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transferir Equipe</DialogTitle>
              <DialogDescription>
                Selecione o novo gerente para assumir a equipe de{" "}
                <strong>{selectedManagerToTransferFrom?.full_name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="newManager">Novo Gerente</Label>
              <Select
                onValueChange={setSelectedNewManagerId}
                value={selectedNewManagerId}
              >
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Selecione um gerente..." />
                </SelectTrigger>
                <SelectContent>
                  {availableManagers.map((manager) => (
                    <SelectItem
                      key={manager.id}
                      value={manager.id}
                      disabled={!manager.is_active}
                    >
                      {manager.full_name} {!manager.is_active && "(Bloqueado)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsTransferDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleTransferTeam}
                disabled={!selectedNewManagerId || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  "Confirmar Transferência"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {teamMembers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UserPlus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">
                Nenhum {targetRoleLabel.toLowerCase()} encontrado
              </h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Utilize o botão acima para adicionar membros.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => (
              <Card
                key={member.id}
                className={`hover:shadow-lg transition-shadow relative ${
                  member.is_active === false
                    ? "opacity-75 border-destructive/50 bg-destructive/5"
                    : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback
                          className={`${
                            member.is_active === false
                              ? "bg-destructive/20 text-destructive"
                              : "bg-primary/20 text-primary"
                          } font-semibold`}
                        >
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {member.full_name || "Sem nome"}
                          {member.is_active === false && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] h-5"
                            >
                              Bloqueado
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {member.email}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-xs text-muted-foreground">
                    Cadastrado em {formatDate(member.created_at)}
                  </p>
                </CardContent>
                {isAdmin && (
                  <CardFooter className="pt-0 gap-2 border-t bg-muted/20 p-3 mt-auto">
                    {/* Botão de Transferir Equipe (Apenas se for Gerente e estiver Ativo... ou Inativo também pode transferir) */}
                    {member.role === "manager" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1"
                        onClick={() => openTransferDialog(member)}
                        title="Transferir equipe deste gerente"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        Transferir
                      </Button>
                    )}

                    {/* Botão de Bloquear/Desbloquear */}
                    <Button
                      variant={
                        member.is_active === false ? "default" : "destructive"
                      }
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() => toggleStatus(member)}
                    >
                      {member.is_active === false ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Ativar
                        </>
                      ) : (
                        <>
                          <Ban className="w-3 h-3" /> Bloquear
                        </>
                      )}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
