import { detectBPM } from './bpmMapping';

export interface GPSCoords {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface GeocodedLocation {
  address: string;
  neighborhood: string;
  city: string;
  bpm: string;
}

let lastKnownCoords: GPSCoords | null = null;
let watchId: number | null = null;
const listeners = new Set<(coords: GPSCoords) => void>();

/**
 * Inicia o rastreamento contínuo de GPS no aplicativo
 */
export function startContinuousGPS(): () => void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return () => {};
  }

  if (watchId !== null) {
    return () => {};
  }

  try {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastKnownCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
        };
        listeners.forEach((listener) => listener(lastKnownCoords!));
      },
      (err) => {
        console.warn('Aviso de GPS contínuo:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );
  } catch (err) {
    console.warn('Erro ao iniciar watchPosition:', err);
  }

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
}

export function getLastKnownGPS(): GPSCoords | null {
  return lastKnownCoords;
}

/**
 * Obtém a posição atual do GPS com retorno imediato se já houver cache recente (< 30s)
 */
export async function getActiveGPS(): Promise<{ lat: number; lng: number }> {
  if (lastKnownCoords && Date.now() - lastKnownCoords.timestamp < 30000) {
    return { lat: lastKnownCoords.lat, lng: lastKnownCoords.lng };
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Padrão BH
      resolve({ lat: -19.916681, lng: -43.934493 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp || Date.now(),
        };
        lastKnownCoords = coords;
        resolve({ lat: coords.lat, lng: coords.lng });
      },
      (err) => {
        if (lastKnownCoords) {
          resolve({ lat: lastKnownCoords.lat, lng: lastKnownCoords.lng });
        } else {
          // Fallback para BH se falhar
          resolve({ lat: -19.916681, lng: -43.934493 });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  });
}

/**
 * Realiza o geocoding reverso e faz a vinculação imediata com o Batalhão (BPM)
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedLocation> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
      const houseNumber = addr.house_number ? `, Nº ${addr.house_number}` : '';
      const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || '';
      const city = addr.city || addr.town || addr.municipality || 'Belo Horizonte';

      let formattedAddress = '';
      if (road) {
        formattedAddress = `${road}${houseNumber}`;
        if (suburb) formattedAddress += ` - ${suburb}`;
        if (city) formattedAddress += `, ${city}`;
      } else if (data.display_name) {
        formattedAddress = data.display_name;
      }

      if (!formattedAddress) {
        formattedAddress = `LOCALIZAÇÃO GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      const cleanAddress = formattedAddress.toUpperCase();
      const detectedBpm = detectBPM(`${cleanAddress} ${suburb}`);

      return {
        address: cleanAddress,
        neighborhood: suburb.toUpperCase(),
        city: city.toUpperCase(),
        bpm: detectedBpm,
      };
    }
  } catch (err) {
    console.warn('Erro ao realizar reverse geocoding:', err);
  }

  const fallbackAddress = `LOCALIZAÇÃO GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  return {
    address: fallbackAddress,
    neighborhood: '',
    city: 'BELO HORIZONTE',
    bpm: '',
  };
}

export interface AddressSuggestion {
  id: string;
  formattedAddress: string;
  road: string;
  suburb: string;
  city: string;
  lat: number;
  lng: number;
  bpm: string;
}

const addressSearchCache = new Map<string, AddressSuggestion[]>();

/**
 * Busca sugestões de endereço em tempo real para o campo de Local da Abordagem
 * Prioriza região de Belo Horizonte / Minas Gerais, identificando bairro e BPM
 */
export async function searchAddressLocations(query: string): Promise<AddressSuggestion[]> {
  const cleanQ = query.trim();
  if (cleanQ.length < 3) return [];

  const cacheKey = cleanQ.toLowerCase();
  if (addressSearchCache.has(cacheKey)) {
    return addressSearchCache.get(cacheKey)!;
  }

  // Extrai número da casa se o operador já tiver digitado
  const numMatch = cleanQ.match(/(?:n[ºo°]?\s*|,?\s*)(\d+)\b/i);
  const houseNumberInput = numMatch ? numMatch[1] : '';

  const hasCity = /(belo horizonte|contagem|betim|sabara|nova lima|ibirite|santa luzia|ribeirao das neves|\bmg\b)/i.test(cleanQ);
  const searchQ = hasCity ? cleanQ : `${cleanQ}, Belo Horizonte`;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&addressdetails=1&limit=6&countrycodes=br`,
      {
        headers: {
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'TacticalApp/1.0',
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const suggestions: AddressSuggestion[] = [];
    const seenAddresses = new Set<string>();

    for (const item of data) {
      const addr = item.address || {};
      const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
      const houseNumber = addr.house_number || houseNumberInput;
      const suburb = addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || '';
      const city = addr.city || addr.town || addr.municipality || 'Belo Horizonte';

      let formatted = '';
      if (road) {
        formatted = road;
        if (houseNumber) formatted += `, Nº ${houseNumber}`;
        if (suburb) formatted += ` - ${suburb}`;
        if (city) formatted += `, ${city}`;
      } else if (item.display_name) {
        formatted = item.display_name;
      }

      if (!formatted) continue;

      const upperFormatted = formatted.toUpperCase();
      if (seenAddresses.has(upperFormatted)) continue;
      seenAddresses.add(upperFormatted);

      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (isNaN(lat) || isNaN(lng)) continue;

      // Detecta BPM correspondente a partir do bairro e endereço
      const detectedBpm = detectBPM(`${upperFormatted} ${suburb} ${road}`);

      suggestions.push({
        id: `${lat.toFixed(5)}_${lng.toFixed(5)}_${road}`,
        formattedAddress: upperFormatted,
        road: (road || '').toUpperCase(),
        suburb: (suburb || '').toUpperCase(),
        city: (city || 'BELO HORIZONTE').toUpperCase(),
        lat,
        lng,
        bpm: detectedBpm,
      });
    }

    // Salva no cache da sessão
    addressSearchCache.set(cacheKey, suggestions);
    return suggestions;
  } catch (err) {
    console.warn('Erro ao pesquisar endereços no mapa:', err);
    return [];
  }
}
