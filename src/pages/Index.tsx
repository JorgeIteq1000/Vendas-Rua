import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  MapPin,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Trophy,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function Index() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState({
    visitasHoje: 0,
    vendasMes: 0,
    conversao: 0,
    ranking: 0,
  });

  useEffect(() => {
    if (user) loadStats();
  }, [user]);

  const loadStats = async () => {
    // Exemplo simples de queries (pode refinar depois)
    const today = new Date().toISOString().split("T")[0];
    const firstDayMonth = new Date();
    firstDayMonth.setDate(1);

    // 1. Visitas hoje
    const { count: visitasCount } = await supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user?.id)
      .eq("status", "visitado")
      .gte("checkin_time", today);

    // 2. Vendas do Mês (Matriculadas)
    const { count: vendasCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user?.id)
      .eq("status", "matriculado")
      .gte("created_at", firstDayMonth.toISOString());

    setStats({
      visitasHoje: visitasCount || 0,
      vendasMes: vendasCount || 0,
      conversao: visitasCount
        ? Math.round(((vendasCount || 0) / visitasCount) * 100)
        : 0,
      ranking: 1, // Placeholder para gamificação futura
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 👋 BOAS VINDAS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">
              Olá, {profile?.full_name?.split(" ")[0]}! 👋
            </h1>
            <p className="text-muted-foreground">
              Aqui está o resumo da sua operação hoje.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-medium text-sm">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>

        {/* 📊 KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visitas Hoje
              </CardTitle>
              <MapPin className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.visitasHoje}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Check-ins realizados
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas (Mês)
              </CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vendasMes}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Matrículas confirmadas
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversão
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversao}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Eficiência de vendas
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-gradient-to-br from-yellow-50 to-orange-50 border-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-yellow-700">
                Sua Meta
              </CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-800">85%</div>
              <div className="w-full bg-yellow-200 h-2 rounded-full mt-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: "85%" }}
                ></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 📋 KANBAN INTEGRADO */}
        <div className="pt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-1 bg-primary rounded-full"></div>
            <h2 className="text-xl font-bold">Minha Rota</h2>
          </div>
          <KanbanBoard />
        </div>
      </div>
    </AppLayout>
  );
}
