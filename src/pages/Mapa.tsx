import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Map as MapIcon, Filter } from "lucide-react";

// Correção de ícones padrão do Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-icon",
    html: `<div style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [15, 15],
    iconAnchor: [7, 7],
  });
};

interface MapPoint {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  status: "sem_visita" | "visitado" | "vendido";
  endereco: string;
}

export default function Mapa() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  const [filters, setFilters] = useState({
    vendido: true,
    visitado: true,
    sem_visita: true,
  });

  useEffect(() => {
    loadMapData();
  }, []);

  // 🚚 FUNÇÃO DE PAGINAÇÃO
  const fetchAllPoints = async () => {
    let allData: any[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    console.log("[Mapa] Iniciando busca paginada...");

    while (hasMore) {
      // Adicionei tipagem explícita aqui para evitar recursão do TS
      const { data, error } = await supabase
        .from("points_of_interest")
        .select("id, nome, coordenadas, endereco")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data) {
        allData = [...allData, ...data];
        console.log(
          `[Mapa] Página ${page + 1} carregada: +${data.length} itens. Total: ${
            allData.length
          }`
        );

        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      page++;
      setProgress((prev) => prev + 10);
    }

    return allData;
  };

  const loadMapData = async () => {
    try {
      setLoading(true);
      setProgress(10);

      // 1. Busca TODAS as escolas
      const pdvs = await fetchAllPoints();
      setProgress(80);

      // 2. Busca Visitas e Vendas
      // 👇 AQUI A CORREÇÃO PRINCIPAL: Adicionei ': any' para quebrar o loop do TS
      const { data: visits }: any = await supabase
        .from("visits")
        .select("point_id");

      const { data: customers }: any = await supabase
        .from("customers")
        .select("id, nome_completo, pdv_id")
        .eq("status", "matriculado");

      if (!pdvs) return;

      const visitedSet = new Set(visits?.map((v: any) => v.point_id));
      const soldSet = new Set(
        customers?.map((c: any) => c.pdv_id).filter(Boolean)
      );

      const processedPoints: MapPoint[] = pdvs
        .filter((p: any) => p.coordenadas && p.coordenadas.includes(","))
        .map((p: any) => {
          const [latStr, lngStr] = p
            .coordenadas!.split(",")
            .map((s: string) => s.trim());
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);

          let status: MapPoint["status"] = "sem_visita";
          if (soldSet.has(p.id)) status = "vendido";
          else if (visitedSet.has(p.id)) status = "visitado";

          return {
            id: p.id,
            nome: p.nome,
            endereco: p.endereco,
            lat,
            lng,
            status,
          };
        });

      setPoints(processedPoints);
      console.log(
        `[Mapa] FINAL: ${processedPoints.length} pontos plotados com sucesso!`
      );
      setProgress(100);
    } catch (err) {
      console.error("Erro no mapa:", err);
    } finally {
      setLoading(false);
    }
  };

  const getColor = (status: string) => {
    switch (status) {
      case "vendido":
        return "#10b981";
      case "visitado":
        return "#f59e0b";
      default:
        return "#ef4444";
    }
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredPoints = points.filter((p) => filters[p.status]);

  return (
    <AppLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <MapIcon className="w-6 h-6 text-primary" />
              Visão de Águia
            </h1>
            <p className="text-muted-foreground text-sm">
              Exibindo <strong>{filteredPoints.length}</strong> de{" "}
              {points.length} pontos mapeados.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 bg-card p-2 rounded-lg border shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground flex items-center px-2">
              <Filter className="w-3 h-3 mr-1" /> Filtros:
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter("vendido")}
              className={`h-7 text-xs border transition-all ${
                filters.vendido
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  : "opacity-50 grayscale hover:opacity-100"
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              Matriculados
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter("visitado")}
              className={`h-7 text-xs border transition-all ${
                filters.visitado
                  ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                  : "opacity-50 grayscale hover:opacity-100"
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
              Visitados / Pendentes
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleFilter("sem_visita")}
              className={`h-7 text-xs border transition-all ${
                filters.sem_visita
                  ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  : "opacity-50 grayscale hover:opacity-100"
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
              Sem Visita
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden border-none shadow-lg relative rounded-xl">
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div className="text-sm font-medium text-muted-foreground animate-pulse">
                Carregando mapa gigante... {progress > 100 ? 99 : progress}%
              </div>
            </div>
          )}

          {!loading && (
            <MapContainer
              center={[-23.5505, -46.6333]}
              zoom={11}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {filteredPoints.map((point) => (
                <Marker
                  key={point.id}
                  position={[point.lat, point.lng]}
                  icon={createCustomIcon(getColor(point.status))}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-sm mb-1">{point.nome}</h3>
                      <p className="text-xs text-gray-600 mb-2">
                        {point.endereco}
                      </p>

                      <div className="flex justify-between items-center">
                        <Badge
                          className={`text-[10px] ${
                            point.status === "vendido"
                              ? "bg-emerald-500 hover:bg-emerald-600"
                              : point.status === "visitado"
                              ? "bg-amber-500 hover:bg-amber-600"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >
                          {point.status === "vendido"
                            ? "MATRICULADO"
                            : point.status === "sem_visita"
                            ? "PENDENTE"
                            : "VISITADO"}
                        </Badge>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
