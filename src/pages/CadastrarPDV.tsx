import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

const poiTypes = [
  { value: 'escola', label: 'Escola' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'upa', label: 'UPA' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'comercio', label: 'Comércio' },
  { value: 'outro', label: 'Outro' },
] as const;

const formSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  endereco: z.string().trim().min(5, 'Endereço deve ter pelo menos 5 caracteres').max(200, 'Endereço deve ter no máximo 200 caracteres'),
  bairro: z.string().trim().min(2, 'Bairro deve ter pelo menos 2 caracteres').max(100, 'Bairro deve ter no máximo 100 caracteres'),
  cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, 'CEP inválido (ex: 01234-567)').optional().or(z.literal('')),
  telefone: z.string().trim().optional(),
  tipo: z.enum(['escola', 'hospital', 'upa', 'clinica', 'empresa', 'comercio', 'outro']),
  coordenadas: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastrarPDV() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { coordinates, loading: geoLoading } = useGeolocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'outro',
      coordenadas: '',
    },
  });

  const coordenadas = watch('coordenadas');

  const handleUseCurrentLocation = () => {
    if (coordinates) {
      setValue('coordenadas', `${coordinates.latitude}, ${coordinates.longitude}`);
      toast({
        title: 'Localização capturada',
        description: 'Coordenadas atuais foram preenchidas.',
      });
    } else {
      toast({
        title: 'Localização indisponível',
        description: 'Aguarde a captura ou permita o acesso à localização.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('points_of_interest').insert({
      nome: data.nome,
      endereco: data.endereco,
      bairro: data.bairro,
      cep: data.cep || null,
      telefone: data.telefone || null,
      tipo: data.tipo,
      coordenadas: data.coordenadas || null,
      created_by: user.id,
    });

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'PDV cadastrado!',
      description: 'O ponto de venda foi cadastrado com sucesso.',
    });

    navigate('/');
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl font-display">Cadastrar PDV</CardTitle>
                <CardDescription>Adicione um novo ponto de venda</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do estabelecimento *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Escola Municipal João da Silva"
                  {...register('nome')}
                  className={errors.nome ? 'border-destructive' : ''}
                />
                {errors.nome && (
                  <p className="text-sm text-destructive">{errors.nome.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço *</Label>
                <Input
                  id="endereco"
                  placeholder="Ex: Rua das Flores, 123"
                  {...register('endereco')}
                  className={errors.endereco ? 'border-destructive' : ''}
                />
                {errors.endereco && (
                  <p className="text-sm text-destructive">{errors.endereco.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    placeholder="Ex: Centro"
                    {...register('bairro')}
                    className={errors.bairro ? 'border-destructive' : ''}
                  />
                  {errors.bairro && (
                    <p className="text-sm text-destructive">{errors.bairro.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    placeholder="Ex: 01234-567"
                    {...register('cep')}
                    className={errors.cep ? 'border-destructive' : ''}
                  />
                  {errors.cep && (
                    <p className="text-sm text-destructive">{errors.cep.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  placeholder="Ex: (11) 99999-9999"
                  {...register('telefone')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  defaultValue="outro"
                  onValueChange={(value) => setValue('tipo', value as FormData['tipo'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {poiTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coordenadas">Coordenadas</Label>
                <div className="flex gap-2">
                  <Input
                    id="coordenadas"
                    placeholder="Ex: -23.58545, -46.581002"
                    {...register('coordenadas')}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={geoLoading}
                    className="shrink-0"
                  >
                    {geoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Usar atual</span>
                  </Button>
                </div>
                {coordenadas && (
                  <p className="text-xs text-muted-foreground">
                    Coordenadas: {coordenadas}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 gradient-primary text-primary-foreground"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar PDV'
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
