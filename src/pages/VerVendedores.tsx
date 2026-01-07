import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Users, Loader2, Navigation } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Ícone Personalizado (Avatar)
const createAvatarIcon = (initials: string, color: string) => {
  return L.divIcon({
    className: "custom-avatar-icon",
    html: `<div style="
      background-color: ${color}; 
      width: 36px; height: 36px; 
      border-radius: 50%; 
      border: 3px solid white; 
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; color: white; font-size: 14px;
    ">${initials}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
};

interface SellerLocation {
  id: string;
  full_name: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_time: string | null;
  role: string;
  manager_id: string | null;
}

export default function VerVendedores() {
  const { user, profile } = useAuth();
  const [sellers, setSellers] = useState<SellerLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      fetchSellers();
      subscribeToUpdates();
    }
  }, [user, profile]);

  const fetchSellers = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select(
        "id, full_name, last_latitude, last_longitude, last_location_time, role, manager_id"
      )
      .eq("role", "seller")
      .not("last_latitude", "is", null); // Só traz quem tem localização

    // Se for GERENTE, filtra só a equipe dele
    if (profile?.role === "manager") {
      query = query.eq("manager_id", user?.id);
    }

    const { data, error } = await query;
    if (error) console.error("Erro ao buscar vendedores:", error);
    else setSellers(data || []);
    setLoading(false);
  };

  const subscribeToUpdates = () => {
    const channel = supabase
      .channel("sellers-location")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload: any) => {
          const updatedUser = payload.new;

          // Verifica se o usuário atual tem permissão para ver essa atualização
          // Admin vê tudo. Gerente vê só se manager_id bater.
          const canView =
            profile?.role === "admin" ||
            (profile?.role === "manager" &&
              updatedUser.manager_id === user?.id);

          if (canView && updatedUser.role === "seller") {
            setSellers((prev) => {
              const index = prev.findIndex((s) => s.id === updatedUser.id);
              if (index >= 0) {
                // Atualiza existente
                const newSellers = [...prev];
                newSellers[index] = { ...newSellers[index], ...updatedUser };
                return newSellers;
              } else {
                // Novo vendedor apareceu no mapa
                return [...prev, updatedUser];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-50px)] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Equipe em Tempo Real
            </h1>
            <p className="text-muted-foreground text-sm">
              Monitorando <strong>{sellers.length}</strong> vendedores ativos.
            </p>
          </div>
          {loading && <Loader2 className="animate-spin text-primary" />}
        </div>

        <Card className="flex-1 overflow-hidden border-none shadow-lg relative rounded-xl">
          <MapContainer
            center={[-23.5505, -46.6333]}
            zoom={11}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {sellers.map((seller) => {
              if (!seller.last_latitude || !seller.last_longitude) return null;

              const initials = seller.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              const isOnline =
                seller.last_location_time &&
                new Date().getTime() -
                  new Date(seller.last_location_time).getTime() <
                  1000 * 60 * 10; // 10 min

              return (
                <Marker
                  key={seller.id}
                  position={[seller.last_latitude, seller.last_longitude]}
                  icon={createAvatarIcon(
                    initials,
                    isOnline ? "#10b981" : "#6b7280"
                  )}
                >
                  <Popup>
                    <div className="p-1 min-w-[150px]">
                      <h3 className="font-bold text-sm mb-1">
                        {seller.full_name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Navigation className="w-3 h-3" />
                        {seller.last_location_time
                          ? `Visto há ${formatDistanceToNow(
                              new Date(seller.last_location_time),
                              { locale: ptBR }
                            )}`
                          : "Localização antiga"}
                      </div>
                      <Badge
                        variant={isOnline ? "default" : "secondary"}
                        className={isOnline ? "bg-emerald-500" : ""}
                      >
                        {isOnline ? "ONLINE AGORA" : "AUSENTE"}
                      </Badge>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </Card>
      </div>
    </AppLayout>
  );
}
