import { useState, useEffect, useCallback } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GeolocationState {
  coordinates: Coordinates | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    console.log('[Geo] Requesting geolocation permission...');
    
    if (!navigator.geolocation) {
      console.log('[Geo] Geolocation not supported');
      setState({
        coordinates: null,
        error: 'Geolocalização não suportada pelo navegador',
        loading: false,
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        console.log('[Geo] Position updated:', position.coords.latitude, position.coords.longitude);
        setState({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          error: null,
          loading: false,
        });
      },
      (error) => {
        console.log('[Geo] Error getting position:', error.message);
        let errorMessage = 'Erro ao obter localização';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tempo esgotado ao obter localização';
            break;
        }
        
        setState({
          coordinates: null,
          error: errorMessage,
          loading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );

    return () => {
      console.log('[Geo] Cleaning up geolocation watch');
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const calculateDistance = useCallback((targetCoords: string): number | null => {
    if (!state.coordinates || !targetCoords) {
      console.log('[Geo] Cannot calculate distance - missing coordinates');
      return null;
    }

    try {
      const [targetLat, targetLng] = targetCoords.split(',').map(c => parseFloat(c.trim()));
      
      if (isNaN(targetLat) || isNaN(targetLng)) {
        console.log('[Geo] Invalid target coordinates:', targetCoords);
        return null;
      }

      const R = 6371;
      const dLat = toRad(targetLat - state.coordinates.latitude);
      const dLon = toRad(targetLng - state.coordinates.longitude);
      const lat1 = toRad(state.coordinates.latitude);
      const lat2 = toRad(targetLat);

      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      console.log('[Geo] Distance calculated:', distance.toFixed(2), 'km');
      return Math.round(distance * 100) / 100;
    } catch (err) {
      console.log('[Geo] Error calculating distance:', err);
      return null;
    }
  }, [state.coordinates]);

  return { ...state, calculateDistance };
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
