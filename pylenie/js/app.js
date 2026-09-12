import { fetchPollen, mockForecast, reverseLabel, searchCities } from "./data.js";
import {
  getLast,
  getPlaces,
  getWatch,
  getTheme,
  removePlace,
  savePlace,
  setLast,
  setTheme,
  toggleWatch,
} from "./store.js";
import {
  applyTheme,
  closeAllergenSheet,
  openAllergenSheet,
  renderCities,
  renderMain,
  renderSaved,
  renderWatchChips,
  setError,
  setTab,
  setThemeSeg,
  show,
  say,
} from "./ui.js";

const $ = (id) => document.getElementById(id);

const state = {
  place: null,
  forecast: null,
  selectedDay: null,
  watched: getWatch(),
  tab: "today",
};

function refreshSaved() {
  const places = getPlaces();
  const handlers = {
    onPick: (place) => {
      closeAllergenSheet();
      load(place);
    },
    onRemove: (id) => {
      removePlace(id);
      refreshSaved();
    },
  };
  renderSaved("start-saved", places, handlers);
  renderSaved("settings-saved", places, handlers);
}

function refreshWatch() {
  renderWatchChips(state.watched, (id) => {
    state.watched = toggleWatch(id);
    refreshWatch();
    if (state.place && state.forecast) paint();
  });
}

function paint() {
  if (!state.place || !state.forecast) return;
  renderMain({
    place: state.place,
    forecast: state.forecast,
    selectedDay: state.selectedDay,
    watched: state.watched,
    onSelectDay: (date) => {
      state.selectedDay = date;
      goTab("forecast");
    },
    onOpenAllergen: (id) => {
      openAllergenSheet(id, state.forecast, state.watched, (allergenId) => {
        state.watched = toggleWatch(allergenId);
        refreshWatch();
        closeAllergenSheet();
        paint();
      });
    },
  });
}

function goTab(tab) {
  state.tab = tab;
  setTab(tab);
}

async function load(place, { mockOk = true } = {}) {
  state.place = place;
  state.selectedDay = null;
  setLast(place);
  show("loading");
  say(`Pobieram dane dla ${place.name}…`);
  try {
    state.forecast = await fetchPollen(place.lat, place.lon);
    paint();
    show("app");
  } catch (err) {
    if (mockOk) {
      state.forecast = mockForecast(place.name);
      paint();
      show("app");
      say("Nie udało się pobrać żywych danych. Pokazuję dane przykładowe.");
      return;
    }
    setError(err.message || "Nie udało się pobrać danych.");
    show("error");
    say(err.message || "Błąd pobierania danych.");
  }
}

async function geo() {
  if (!navigator.geolocation) {
    setError("To urządzenie nie obsługuje geolokalizacji. Wpisz miejscowość ręcznie.");
    show("error");
    return;
  }
  show("loading");
  say("Ustalam lokalizację urządzenia…");
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      });
    });
    const { latitude: lat, longitude: lon } = pos.coords;
    const label = await reverseLabel(lat, lon);
    await load({
      id: `geo:${lat.toFixed(3)},${lon.toFixed(3)}`,
      name: label.name,
      label: label.label,
      admin: label.admin,
      lat,
      lon,
    });
  } catch (err) {
    let msg = "Nie udało się ustalić lokalizacji. Wpisz miejscowość ręcznie.";
    if (err?.code === 1) msg = "Brak zgody na lokalizację. Możesz wpisać miejscowość ręcznie.";
    if (err?.code === 3) msg = "Przekroczono czas oczekiwania na lokalizację. Spróbuj wpisać miasto.";
    setError(msg);
    show("error");
  }
}

async function search() {
  try {
    const results = await searchCities($("city-input")?.value || "");
    if (!results.length) say("Nie znaleziono miejscowości. Spróbuj innej nazwy.");
    renderCities(results, (city) => load(city));
  } catch (err) {
    say(err.message || "Błąd wyszukiwania.");
  }
}

function bindTheme() {
  const pref = getTheme();
  applyTheme(pref);
  setThemeSeg(pref);
  document.querySelectorAll("#theme-seg [data-theme-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.themeValue;
      setTheme(v);
      applyTheme(v);
      setThemeSeg(v);
    });
  });
  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (getTheme() === "system") applyTheme("system");
    });
  }
}

function bind() {
  document.querySelectorAll("[data-tab-btn]").forEach((btn) => {
    btn.addEventListener("click", () => goTab(btn.dataset.tabBtn));
  });
  $("open-place")?.addEventListener("click", () => goTab("settings"));
  $("see-all")?.addEventListener("click", () => goTab("allergens"));

  $("start-geo")?.addEventListener("click", () => geo());
  $("search-city")?.addEventListener("click", () => search());
  $("city-input")?.addEventListener("input", () => {
    const v = $("city-input").value || "";
    if (v.trim().length >= 2) search();
    else renderCities([], () => {});
  });
  $("city-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  });

  $("retry")?.addEventListener("click", () => {
    if (state.place) load(state.place, { mockOk: false });
    else show("start");
  });
  $("error-location")?.addEventListener("click", () => show("start"));

  $("save-current")?.addEventListener("click", () => {
    if (!state.place) return;
    savePlace(state.place);
    refreshSaved();
    say(`Zapisano lokalizację: ${state.place.name}.`);
  });

  $("sheet-backdrop")?.addEventListener("click", () => closeAllergenSheet());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllergenSheet();
  });

  bindTheme();
}

function init() {
  bind();
  refreshSaved();
  refreshWatch();
  goTab("today");
  const last = getLast();
  if (last?.lat && last?.lon) load(last);
  else show("start");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

init();
