import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Mail, User, Trash2 } from 'lucide-react';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(50),
});

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'manager' | 'seller';
  created_at: string;
}

export default function Gerentes() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  // Determine what role the current user can create
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const canManage = isAdmin || isManager;
  const targetRole = isAdmin ? 'manager' : 'seller';
  const targetRoleLabel = isAdmin ? 'Gerente' : 'Vendedor';
  const pageTitle = isAdmin ? 'Gerentes' : 'Equipe';
  const pageDescription = isAdmin 
    ? 'Gerencie os gerentes da plataforma' 
    : 'Gerencie os vendedores da sua equipe';

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/auth');
      return;
    }
    
    if (!authLoading && profile && !canManage) {
      navigate('/');
      return;
    }

    if (profile && canManage) {
      loadTeamMembers();
    }
  }, [profile, authLoading, navigate, canManage]);

  const loadTeamMembers = async () => {
    try {
      let query = supabase.from('profiles').select('*');
      
      if (isAdmin) {
        // Admin sees all managers
        query = query.eq('role', 'manager');
      } else if (isManager) {
        // Manager sees their sellers
        query = query.eq('manager_id', profile?.id).eq('role', 'seller');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading team:', error);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar a equipe.',
        });
      } else {
        setTeamMembers(data as TeamMember[]);
      }
    } catch (err) {
      console.error('Exception loading team:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    const validation = inviteSchema.safeParse({ email, fullName, password });
    if (!validation.success) {
      const errorMessages = validation.error.errors.map(e => e.message).join(', ');
      toast({
        variant: 'destructive',
        title: 'Dados inválidos',
        description: errorMessages,
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validation.data.email,
        password: validation.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: validation.data.fullName }
        }
      });
      
      if (authError) {
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('Usuário não foi criado');
      }

      // Update the profile with the correct role and manager_id
      const updateData: { role: 'admin' | 'manager' | 'seller'; manager_id?: string } = {
        role: targetRole as 'manager' | 'seller',
      };
      
      if (isManager && profile?.id) {
        updateData.manager_id = profile.id;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        // Profile was created but role update failed - still show success but warn
        toast({
          variant: 'default',
          title: 'Usuário criado',
          description: `${targetRoleLabel} criado, mas a atribuição de role pode precisar de ajuste manual.`,
        });
      } else {
        toast({
          title: 'Sucesso!',
          description: `${targetRoleLabel} ${validation.data.fullName} cadastrado com sucesso!`,
        });
      }
      
      // Reset form and reload
      setEmail('');
      setFullName('');
      setPassword('');
      setIsDialogOpen(false);
      loadTeamMembers();
      
    } catch (err: any) {
      console.error('Error creating user:', err);
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: err.message || 'Não foi possível cadastrar o usuário.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
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
                  Preencha os dados para cadastrar um novo {targetRoleLabel.toLowerCase()}.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleInvite} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Nome completo"
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
                      placeholder="email@exemplo.com"
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
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    `Cadastrar ${targetRoleLabel}`
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Team Members List */}
        {teamMembers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <UserPlus className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Nenhum {targetRoleLabel.toLowerCase()} cadastrado</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                Clique no botão acima para cadastrar seu primeiro {targetRoleLabel.toLowerCase()}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamMembers.map((member) => (
              <Card key={member.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {member.full_name || 'Sem nome'}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {member.email}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {member.role === 'manager' ? 'Gerente' : 'Vendedor'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastrado em {formatDate(member.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
