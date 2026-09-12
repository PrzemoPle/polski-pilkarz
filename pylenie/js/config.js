export const ALLERGENS = [
  {
    id: "grass",
    key: "grass_pollen",
    name: "Trawy",
    season: "maj–sierpień",
    description: "Najczęstsza przyczyna alergii pyłkowej w Polsce. Najwyższe stężenia zwykle w ciepłe, suche dni.",
    thresholds: [1, 20, 50, 120],
  },
  {
    id: "birch",
    key: "birch_pollen",
    name: "Brzoza",
    season: "kwiecień–maj",
    description: "Silnie alergizująca. Sezon bywa krótki, ale intensywny.",
    thresholds: [1, 20, 80, 200],
  },
  {
    id: "alder",
    key: "alder_pollen",
    name: "Olsza",
    season: "luty–kwiecień",
    description: "Wczesnowiosenny alergen. Często otwiera sezon pylenia drzew.",
    thresholds: [1, 10, 50, 150],
  },
  {
    id: "mugwort",
    key: "mugwort_pollen",
    name: "Bylica",
    season: "lipiec–wrzesień",
    description: "Późnoletni alergen, częsty przy drogach i na nieużytkach.",
    thresholds: [1, 10, 30, 70],
  },
  {
    id: "ragweed",
    key: "ragweed_pollen",
    name: "Ambrozja",
    season: "sierpień–październik",
    description: "Bardzo silnie alergizująca. W Polsce lokalnie, częściej na południu i zachodzie.",
    thresholds: [1, 5, 20, 50],
  },
  {
    id: "olive",
    key: "olive_pollen",
    name: "Oliwka",
    season: "rzadko w PL",
    description: "W Polsce zwykle śladowa. Może pojawiać się przy napływie powietrza z południa.",
    thresholds: [1, 10, 50, 150],
  },
];

export const LEVELS = {
  none: { id: "none", label: "brak", rank: 0 },
  low: { id: "low", label: "niski", rank: 1 },
  moderate: { id: "moderate", label: "umiarkowany", rank: 2 },
  high: { id: "high", label: "wysoki", rank: 3 },
  "very-high": { id: "very-high", label: "bardzo wysoki", rank: 4 },
};

export function levelFromValue(value, thresholds) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < thresholds[0]) return LEVELS.none;
  if (v < thresholds[1]) return LEVELS.low;
  if (v < thresholds[2]) return LEVELS.moderate;
  if (v < thresholds[3]) return LEVELS.high;
  return LEVELS["very-high"];
}

export function shownLevel(level) {
  return !level || level.id === "none" ? LEVELS.low : level;
}

export function maxLevel(list) {
  return list.reduce((best, lvl) => ((lvl?.rank || 0) > (best?.rank || 0) ? lvl : best), LEVELS.none);
}

export function fmtDay(date, opts = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("pl-PL", opts).format(date);
}

export function fmtDateTime(date) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function verdict({ overall, top, place }) {
  if (!overall || overall.rank <= 1) {
    if (top && top.level.rank >= 1 && top.value >= 1) {
      return `Dziś w ${place} pylenie jest niskie. Najbardziej widoczna jest ${top.name.toLowerCase()}.`;
    }
    return `Niskie ryzyko pylenia w ${place} dla większości alergenów.`;
  }
  if (overall.id === "moderate") {
    return top
      ? `Dziś pylenie jest umiarkowane. Warto zwrócić uwagę na ${top.name.toLowerCase()}.`
      : "Dziś pylenie jest umiarkowane.";
  }
  if (overall.id === "high") {
    return top
      ? `Dziś szczególnie uważaj na ${top.name.toLowerCase()} — poziom jest wysoki.`
      : "Dziś pylenie jest wysokie.";
  }
  return top
    ? `Bardzo wysokie pylenie ${top.name.toLowerCase()} w ${place}.`
    : `Bardzo wysokie pylenie w ${place}.`;
}

export function interpretation(overall) {
  switch (overall?.id) {
    case "none":
    case "low":
      return "Dla większości osób wrażliwych dzień powinien być względnie spokojny. Przy znanej alergii i tak warto śledzić swój główny alergen.";
    case "moderate":
      return "Osoby wrażliwe mogą odczuwać objawy. Krótsze wyjścia i prysznic po powrocie często pomagają ograniczyć ekspozycję.";
    case "high":
      return "Przy alergii rozważ ograniczenie dłuższego przebywania na zewnątrz, zwłaszcza w godzinach największego pylenia. To informacja, nie porada medyczna.";
    case "very-high":
      return "Nasilenie jest duże. Jeśli zwykle mocno reagujesz, ogranicz ekspozycję i korzystaj z zaleceń swojego lekarza.";
    default:
      return "Sprawdź szczegóły alergenów poniżej, żeby ocenić sytuację pod kątem swojej alergii.";
  }
}

export function changeText(today, yesterday) {
  const t = today?.rank || 0;
  const y = yesterday?.rank || 0;
  if (t > y) return "wzrost względem wczoraj";
  if (t < y) return "spadek względem wczoraj";
  if (t === 0 && y === 0) return "bez istotnego pylenia";
  return "bez większej zmiany";
}

export function localKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
