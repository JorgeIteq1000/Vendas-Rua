import { useState, useEffect } from "react";
import { useToast } from "./use-toast";

interface Coordinates {
  latitude: number;
  longitude: number;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Opções "Agressivas" para Mobile
  const geoOptions = {
    enableHighAccuracy: true, // Força o uso do GPS Hardware
    timeout: 20000, // Espera até 20s (celular pode demorar pra triangular)
    maximumAge: 0, // Não aceita cache, quer a posição AGORA
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada");
      return;
    }

    // Monitoramento passivo (apenas para ter um valor inicial se possível)
    const watcher = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => console.log("WatchPosition error (ignorado):", err),
      geoOptions
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  // 🚀 FUNÇÃO MANUAL PROMISSORA (A Mágica acontece aqui)
  const getCurrentLocation = (): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = "Geolocalização não suportada pelo navegador.";
        toast({ variant: "destructive", title: "Erro", description: msg });
        reject(new Error(msg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(newLoc); // Atualiza estado global
          resolve(newLoc); // Devolve para quem chamou
        },
        (err) => {
          let msg = "Erro desconhecido de GPS.";
          switch (err.code) {
            case 1:
              msg = "Permissão negada. Ative a localização no navegador.";
              break;
            case 2:
              msg = "Sinal de GPS indisponível. Vá para céu aberto.";
              break;
            case 3:
              msg = "O GPS demorou muito para responder.";
              break;
          }
          toast({
            variant: "destructive",
            title: "Erro de GPS",
            description: msg,
          });
          setError(msg);
          reject(err);
        },
        geoOptions
      );
    });
  };

  const calculateDistance = (targetCoords: string | null) => {
    if (!location || !targetCoords) return null;

    try {
      const [lat2Str, lon2Str] = targetCoords.split(",").map((s) => s.trim());
      const lat2 = parseFloat(lat2Str);
      const lon2 = parseFloat(lon2Str);

      if (isNaN(lat2) || isNaN(lon2)) return null;

      const R = 6371; // Raio da Terra em km
      const dLat = (lat2 - location.latitude) * (Math.PI / 180);
      const dLon = (lon2 - location.longitude) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(location.latitude * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distância em km
    } catch (e) {
      console.error("Erro ao calcular distância:", e);
      return null;
    }
  };

  return { location, error, calculateDistance, getCurrentLocation };
};
