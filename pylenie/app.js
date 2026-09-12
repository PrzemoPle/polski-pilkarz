(() => {
  "use strict";

  const POLLEN_TYPES = [
    {
      key: "grass_pollen",
      name: "Trawy",
      season: "maj–sierpień",
      thresholds: [0, 20, 50, 120],
    },
    {
      key: "birch_pollen",
      name: "Brzoza",
      season: "kwiecień–maj",
      thresholds: [0, 20, 80, 200],
    },
    {
      key: "alder_pollen",
      name: "Olsza",
      season: "luty–kwiecień",
      thresholds: [0, 10, 50, 150],
    },
    {
      key: "mugwort_pollen",
      name: "Bylica",
      season: "lipiec–wrzesień",
      thresholds: [0, 10, 30, 70],
    },
    {
      key: "ragweed_pollen",
      name: "Ambrozja",
      season: "sierpień–październik",
      thresholds: [0, 5, 20, 50],
    },
    {
      key: "olive_pollen",
      name: "Oliwka",
      season: "rzadko w PL",
      thresholds: [0, 10, 50, 150],
    },
  ];

  const LEVEL_LABELS = ["brak / niski", "niski", "średni", "wysoki", "bardzo wysoki"];
  const ADVICE = [
    "Spokojny dzień dla większości alergików. Wietrz mieszkanie jak zwykle.",
    "Niskie stężenie — wrażliwe osoby mogą już odczuwać lekkie objawy.",
    "Średnie obciążenie. Ogranicz dłuższe spacery w godzinach szczytu pylenia.",
    "Wysokie pylenie. Rozważ leki, okulary i prysznic po powrocie z zewnątrz.",
    "Bardzo wysokie stężenie. Najlepiej ograniczyć aktywność na zewnątrz.",
  ];

  const POLISH_CITIES = [
    { name: "Warszawa", lat: 52.2297, lon: 21.0122 },
    { name: "Kraków", lat: 50.0647, lon: 19.945 },
    { name: "Łódź", lat: 51.7592, lon: 19.456 },
    { name: "Wrocław", lat: 51.1079, lon: 17.0385 },
    { name: "Poznań", lat: 52.4064, lon: 16.9252 },
    { name: "Gdańsk", lat: 54.352, lon: 18.6466 },
    { name: "Szczecin", lat: 53.4285, lon: 14.5528 },
    { name: "Bydgoszcz", lat: 53.1235, lon: 18.0084 },
    { name: "Lublin", lat: 51.2465, lon: 22.5684 },
    { name: "Białystok", lat: 53.1325, lon: 23.1688 },
    { name: "Katowice", lat: 50.2649, lon: 19.0238 },
    { name: "Gdynia", lat: 54.5189, lon: 18.5305 },
    { name: "Częstochowa", lat: 50.8118, lon: 19.1203 },
    { name: "Radom", lat: 51.4027, lon: 21.1471 },
    { name: "Toruń", lat: 53.0138, lon: 18.5984 },
    { name: "Rzeszów", lat: 50.0413, lon: 21.999 },
    { name: "Kielce", lat: 50.8661, lon: 20.6286 },
    { name: "Olsztyn", lat: 53.7784, lon: 20.4801 },
    { name: "Zielona Góra", lat: 51.9356, lon: 15.5064 },
    { name: "Opole", lat: 50.6751, lon: 17.9213 },
  ];

  const els = {
    btnLocate: document.getElementById("btn-locate"),
    btnCity: document.getElementById("btn-city"),
    btnSearch: document.getElementById("btn-search"),
    cityPanel: document.getElementById("city-panel"),
    cityInput: document.getElementById("city-input"),
    cityResults: document.getElementById("city-results"),
    status: document.getElementById("status"),
    statusText: document.querySelector("#status .status-text"),
    summary: document.getElementById("summary"),
    placeName: document.getElementById("place-name"),
    asOf: document.getElementById("as-of"),
    overall: document.getElementById("overall"),
    overallLevel: document.getElementById("overall-level"),
    advice: document.getElementById("advice"),
    species: document.getElementById("species"),
    speciesList: document.getElementById("species-list"),
    forecast: document.getElementById("forecast"),
    hourlyChart: document.getElementById("hourly-chart"),
  };

  function levelFor(value, thresholds) {
    const v = Number(value) || 0;
    if (v <= thresholds[0] + 0.05) return 0;
    if (v < thresholds[1]) return 1;
    if (v < thresholds[2]) return 2;
    if (v < thresholds[3]) return 3;
    return 4;
  }

  function setStatus(message, isError = false) {
    els.status.hidden = false;
    els.status.classList.toggle("is-error", isError);
    els.statusText.textContent = message;
  }

  function setLoading(loading) {
    els.btnLocate.disabled = loading;
    els.btnSearch.disabled = loading;
    els.btnCity.disabled = loading;
  }

  function nearestHourIndex(times) {
    const now = Date.now();
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < times.length; i += 1) {
      const diff = Math.abs(new Date(times[i]).getTime() - now);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  }

  function formatHour(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  }

  function formatWhen(iso) {
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function distanceKm(aLat, aLon, bLat, bLon) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function nearestPolishCity(lat, lon) {
    let best = POLISH_CITIES[0];
    let bestDist = Infinity;
    for (const city of POLISH_CITIES) {
      const d = distanceKm(lat, lon, city.lat, city.lon);
      if (d < bestDist) {
        bestDist = d;
        best = city;
      }
    }
    return { city: best, distanceKm: bestDist };
  }

  async function reverseGeocode(lat, lon) {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}` +
        `&accept-language=pl&zoom=12`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.village ||
          data.address?.municipality ||
          data.address?.county;
        const region = data.address?.state || data.address?.region;
        if (city) {
          return region ? `${city} · ${region}` : city;
        }
      }
    } catch {
      /* fall through */
    }
    const nearby = nearestPolishCity(lat, lon);
    if (nearby.distanceKm < 45) {
      return `${nearby.city.name} · okolice`;
    }
    return `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
  }

  async function searchPlaces(query) {
    const q = query.trim();
    if (!q) return [];
    const params = new URLSearchParams({
      name: q,
      count: "8",
      language: "pl",
      countryCode: "pl",
    });
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r) => ({
      name: [r.name, r.admin1].filter(Boolean).join(" · "),
      lat: r.latitude,
      lon: r.longitude,
    }));
  }

  async function fetchPollen(lat, lon) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: POLLEN_TYPES.map((p) => p.key).join(","),
      timezone: "Europe/Warsaw",
      forecast_days: "2",
      domains: "cams_europe",
    });
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać danych pyłkowych (${res.status}).`);
    }
    return res.json();
  }

  function render(placeLabel, data) {
    const times = data.hourly?.time || [];
    if (!times.length) {
      throw new Error("Brak danych godzinowych dla tej lokalizacji.");
    }

    const idx = nearestHourIndex(times);
    const readings = POLLEN_TYPES.map((type) => {
      const series = data.hourly[type.key] || [];
      const value = Number(series[idx] ?? 0);
      const level = levelFor(value, type.thresholds);
      return { ...type, value, level, series };
    }).sort((a, b) => b.value - a.value || b.level - a.level);

    const overallLevel = Math.max(...readings.map((r) => r.level), 0);
    const active = readings.filter((r) => r.value > 0.05);

    els.placeName.textContent = placeLabel;
    els.asOf.textContent = `Stan na ${formatWhen(times[idx])}`;
    els.overall.dataset.level = String(overallLevel);
    els.overallLevel.textContent = LEVEL_LABELS[overallLevel];
    els.advice.textContent = ADVICE[overallLevel];

    els.speciesList.innerHTML = "";
    const list = active.length ? active : readings.slice(0, 3);
    for (const item of list) {
      const row = document.createElement("article");
      row.className = "species-item";
      row.innerHTML = `
        <div class="species-name">${item.name}</div>
        <span class="level-pill" data-level="${item.level}">${LEVEL_LABELS[item.level]}</span>
        <div class="species-meta">Sezon: ${item.season}</div>
        <div class="species-value">${item.value.toFixed(1)} ziaren/m³</div>
      `;
      els.speciesList.appendChild(row);
    }

    const hours = Math.min(12, times.length - idx);
    els.hourlyChart.innerHTML = "";
    let maxCombined = 1;
    const combined = [];
    for (let h = 0; h < hours; h += 1) {
      const i = idx + h;
      let sum = 0;
      let maxLevel = 0;
      for (const type of POLLEN_TYPES) {
        const v = Number(data.hourly[type.key]?.[i] ?? 0);
        sum += v;
        maxLevel = Math.max(maxLevel, levelFor(v, type.thresholds));
      }
      combined.push({ time: times[i], sum, level: maxLevel });
      maxCombined = Math.max(maxCombined, sum);
    }

    for (const point of combined) {
      const height = Math.max(6, Math.round((point.sum / maxCombined) * 110));
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.dataset.level = String(point.level);
      bar.innerHTML = `
        <div class="bar-fill" style="height:${height}px"></div>
        <div class="bar-val">${point.sum < 10 ? point.sum.toFixed(1) : Math.round(point.sum)}</div>
        <div class="bar-hour">${formatHour(point.time)}</div>
      `;
      els.hourlyChart.appendChild(bar);
    }

    els.summary.hidden = false;
    els.species.hidden = false;
    els.forecast.hidden = false;
    setStatus("Dane zaktualizowane. Model CAMS przez Open-Meteo.");
  }

  async function loadFor(lat, lon, labelPromise) {
    setLoading(true);
    setStatus("Pobieram prognozę pyłków…");
    try {
      const [data, label] = await Promise.all([
        fetchPollen(lat, lon),
        Promise.resolve(labelPromise),
      ]);
      const place = typeof label === "string" ? label : await label;
      render(place, data);
      try {
        localStorage.setItem(
          "pylenie:last",
          JSON.stringify({ lat, lon, place, savedAt: Date.now() })
        );
      } catch {
        /* ignore quota */
      }
    } catch (err) {
      setStatus(err.message || "Wystąpił błąd pobierania danych.", true);
    } finally {
      setLoading(false);
    }
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("To urządzenie nie obsługuje geolokalizacji."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
    });
  }

  function geoErrorMessage(error) {
    if (!error || typeof error.code !== "number") {
      return "Nie udało się ustalić lokalizacji.";
    }
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Brak zgody na lokalizację. Wybierz miasto ręcznie.";
      case error.POSITION_UNAVAILABLE:
        return "Lokalizacja niedostępna. Wybierz miasto ręcznie.";
      case error.TIMEOUT:
        return "Przekroczono czas oczekiwania na lokalizację.";
      default: {
        const _exhaustive = error.code;
        void _exhaustive;
        return "Nie udało się ustalić lokalizacji.";
      }
    }
  }

  async function showCityResults(query) {
    const q = query.trim();
    setStatus("Szukam miejscowości…");
    let matches = await searchPlaces(q);
    if (!matches.length) {
      const local = q.toLowerCase();
      matches = POLISH_CITIES.filter((c) => c.name.toLowerCase().includes(local))
        .slice(0, 8)
        .map((c) => ({ name: c.name, lat: c.lat, lon: c.lon }));
    }
    els.cityResults.innerHTML = "";
    if (!matches.length) {
      els.cityResults.hidden = true;
      setStatus("Nie znaleziono miasta. Spróbuj innej nazwy.", true);
      return;
    }
    for (const city of matches) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = city.name;
      btn.addEventListener("click", () => {
        els.cityResults.hidden = true;
        els.cityPanel.hidden = true;
        loadFor(city.lat, city.lon, city.name);
      });
      li.appendChild(btn);
      els.cityResults.appendChild(li);
    }
    els.cityResults.hidden = false;
    setStatus(`Znaleziono ${matches.length} lokalizacji. Wybierz jedną.`);
  }

  els.btnLocate.addEventListener("click", async () => {
    setLoading(true);
    setStatus("Ustalam Twoją lokalizację…");
    try {
      const pos = await getPosition();
      const { latitude, longitude } = pos.coords;
      await loadFor(latitude, longitude, reverseGeocode(latitude, longitude));
    } catch (err) {
      setLoading(false);
      setStatus(geoErrorMessage(err), true);
      els.cityPanel.hidden = false;
    }
  });

  els.btnCity.addEventListener("click", () => {
    els.cityPanel.hidden = !els.cityPanel.hidden;
    if (!els.cityPanel.hidden) {
      els.cityInput.focus();
    }
  });

  els.btnSearch.addEventListener("click", () => {
    showCityResults(els.cityInput.value || "");
  });

  els.cityInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      showCityResults(els.cityInput.value || "");
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        /* offline cache optional */
      });
    });
  }

  try {
    const saved = JSON.parse(localStorage.getItem("pylenie:last") || "null");
    if (saved?.lat && saved?.lon && Date.now() - saved.savedAt < 1000 * 60 * 60 * 12) {
      loadFor(saved.lat, saved.lon, saved.place || reverseGeocode(saved.lat, saved.lon));
    }
  } catch {
    /* ignore */
  }
})();
