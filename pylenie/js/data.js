import { ALLERGENS, LEVELS, levelFromValue, maxLevel, localKey } from "./config.js";

const AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

function dayKey(iso) {
  return iso.slice(0, 10);
}

function parseDays(data) {
  const times = data.hourly?.time || [];
  const map = new Map();
  for (let i = 0; i < times.length; i += 1) {
    const key = dayKey(times[i]);
    if (!map.has(key)) {
      map.set(key, {
        date: key,
        times: [],
        values: Object.fromEntries(ALLERGENS.map((a) => [a.id, []])),
      });
    }
    const bucket = map.get(key);
    bucket.times.push(times[i]);
    for (const a of ALLERGENS) {
      const v = Number(data.hourly?.[a.key]?.[i]);
      bucket.values[a.id].push(Number.isFinite(v) ? v : 0);
    }
  }

  return [...map.values()].map((day) => {
    const allergens = ALLERGENS.map((a) => {
      const hourly = day.values[a.id];
      const peak = hourly.length ? Math.max(...hourly) : 0;
      return {
        id: a.id,
        name: a.name,
        season: a.season,
        description: a.description,
        peak,
        level: levelFromValue(peak, a.thresholds),
        hourly,
      };
    });
    return { date: day.date, allergens, overall: maxLevel(allergens.map((x) => x.level)) };
  });
}

function nearestIndex(times) {
  const now = Date.now();
  let best = 0;
  let diff = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const d = Math.abs(new Date(times[i]).getTime() - now);
    if (d < diff) {
      diff = d;
      best = i;
    }
  }
  return best;
}

function currentFrom(data, days) {
  const times = data.hourly?.time || [];
  if (!times.length || !days.length) return null;
  const idx = nearestIndex(times);
  const today = days.find((d) => d.date === dayKey(times[idx])) || days[0];
  const allergens = ALLERGENS.map((a) => {
    const value = Number(data.hourly?.[a.key]?.[idx] ?? 0);
    const day = today.allergens.find((x) => x.id === a.id);
    return {
      id: a.id,
      name: a.name,
      season: a.season,
      description: a.description,
      value: Number.isFinite(value) ? value : 0,
      level: levelFromValue(value, a.thresholds),
      dayPeak: day?.peak ?? 0,
      dayLevel: day?.level ?? LEVELS.none,
      hourly: day?.hourly || [],
    };
  }).sort((a, b) => b.level.rank - a.level.rank || b.value - a.value);

  return {
    asOf: times[idx],
    overall: maxLevel(allergens.map((a) => a.level)),
    allergens,
  };
}

export async function searchCities(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, count: "8", language: "pl", countryCode: "pl" });
  const res = await fetch(`${GEO}?${params}`);
  if (!res.ok) throw new Error("Nie udało się wyszukać miejscowości.");
  const data = await res.json();
  return (data.results || []).map((r) => ({
    id: String(r.id || `${r.latitude},${r.longitude}`),
    name: r.name,
    admin: r.admin1 || "",
    lat: r.latitude,
    lon: r.longitude,
    label: r.admin1 ? `${r.name} · ${r.admin1}` : r.name,
  }));
}

export async function reverseLabel(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=pl&zoom=12`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      const city =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.municipality ||
        data.address?.county;
      const region = data.address?.state || "";
      if (city) return { name: city, admin: region, label: region ? `${city} · ${region}` : city };
    }
  } catch {
    /* ignore */
  }
  const label = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
  return { name: label, admin: "", label };
}

export async function fetchPollen(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: ALLERGENS.map((a) => a.key).join(","),
    timezone: "Europe/Warsaw",
    forecast_days: "4",
    past_days: "1",
    domains: "cams_europe",
  });
  const res = await fetch(`${AQ}?${params}`);
  if (!res.ok) throw new Error("Nie udało się pobrać danych o pyleniu. Spróbuj ponownie za chwilę.");
  const data = await res.json();
  const days = parseDays(data);
  if (!days.length) throw new Error("Dla tej miejscowości nie mamy jeszcze wystarczających danych.");
  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    days,
    current: currentFrom(data, days),
  };
}

export function mockForecast(placeName = "Poznań") {
  const patterns = {
    grass: [8, 14, 22, 35, 28],
    birch: [0, 0, 0, 0, 0],
    alder: [0, 0, 0, 0, 0],
    mugwort: [12, 18, 26, 40, 33],
    ragweed: [3, 5, 9, 14, 11],
    olive: [0, 0, 0, 0, 0],
  };
  const days = [];
  const today = new Date();
  for (let d = -1; d < 4; d += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const key = localKey(date);
    const allergens = ALLERGENS.map((a) => {
      const peak = patterns[a.id]?.[d + 1] ?? 0;
      const hourly = Array.from({ length: 24 }, (_, h) =>
        Math.max(0, peak * (0.35 + 0.65 * Math.sin((h / 24) * Math.PI)))
      );
      return {
        id: a.id,
        name: a.name,
        season: a.season,
        description: a.description,
        peak,
        level: levelFromValue(peak, a.thresholds),
        hourly,
      };
    });
    days.push({ date: key, allergens, overall: maxLevel(allergens.map((x) => x.level)) });
  }
  const todayDay = days.find((d) => d.date === localKey(today)) || days[1];
  const allergens = todayDay.allergens
    .map((a) => ({
      id: a.id,
      name: a.name,
      season: a.season,
      description: a.description,
      value: a.hourly[12] ?? a.peak,
      level: levelFromValue(a.hourly[12] ?? a.peak, ALLERGENS.find((x) => x.id === a.id).thresholds),
      dayPeak: a.peak,
      dayLevel: a.level,
      hourly: a.hourly,
    }))
    .sort((a, b) => b.level.rank - a.level.rank || b.value - a.value);

  return {
    source: "mock",
    generatedAt: new Date().toISOString(),
    mockNote: `Dane przykładowe (mock) dla ${placeName} — nie są aktualnym pomiarem.`,
    days,
    current: {
      asOf: new Date().toISOString(),
      overall: maxLevel(allergens.map((a) => a.level)),
      allergens,
    },
  };
}
