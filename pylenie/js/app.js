import { fetchPollen, mockForecast, reverseLabel, searchCities } from "./data.js";
import {
  getLast,
  getPlaces,
  getWatch,
  removePlace,
  savePlace,
  setLast,
  toggleWatch,
} from "./store.js";
import {
  closeDlg,
  openDlg,
  renderAllergen,
  renderCities,
  renderMain,
  renderSaved,
  renderWatch,
  setError,
  setTab,
  show,
  say,
} from "./ui.js";

const state = {
  place: null,
  forecast: null,
  selectedDay: null,
  watched: getWatch(),
};

const $ = (id) => document.getElementById(id);

function refreshSaved() {
  const places = getPlaces();
  const handlers = {
    onPick: (place) => {
      closeDlg("dialog-location");
      closeDlg("dialog-settings");
      load(place);
    },
    onRemove: (id) => {
      removePlace(id);
      refreshSaved();
    },
  };
  renderSaved("saved-places", places, handlers);
  renderSaved("settings-saved", places, handlers);
}

function refreshWatch() {
  renderWatch(state.watched, (id) => {
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
      setTab("forecast");
      paint();
    },
    onOpenAllergen: (id) => {
      renderAllergen(id, state.forecast, state.watched, (allergenId) => {
        state.watched = toggleWatch(allergenId);
        refreshWatch();
        paint();
      });
    },
  });
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
  } catch (err) {
    if (mockOk) {
      state.forecast = mockForecast(place.name);
      paint();
      say("Nie udało się pobrać żywych danych. Pokazuję dane przykładowe (mock).");
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
    openDlg("dialog-location");
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
    closeDlg("dialog-location");
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
    openDlg("dialog-location");
  }
}

async function search() {
  try {
    const results = await searchCities($("city-input")?.value || "");
    if (!results.length) say("Nie znaleziono miejscowości. Spróbuj innej nazwy.");
    renderCities(results, (city) => {
      closeDlg("dialog-location");
      load(city);
    });
  } catch (err) {
    say(err.message || "Błąd wyszukiwania.");
  }
}

function bind() {
  $("open-location")?.addEventListener("click", () => openDlg("dialog-location"));
  $("open-settings")?.addEventListener("click", () => {
    refreshSaved();
    refreshWatch();
    if ($("save-current")) $("save-current").hidden = !state.place;
    openDlg("dialog-settings");
  });
  $("welcome-search")?.addEventListener("click", () => openDlg("dialog-location"));
  $("welcome-geo")?.addEventListener("click", () => geo());
  $("use-geo")?.addEventListener("click", () => geo());
  $("search-city")?.addEventListener("click", () => search());
  $("city-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  });
  $("retry")?.addEventListener("click", () => {
    if (state.place) load(state.place, { mockOk: false });
    else openDlg("dialog-location");
  });
  $("error-location")?.addEventListener("click", () => openDlg("dialog-location"));
  $("jump-details")?.addEventListener("click", () => {
    $("details")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("open-method")?.addEventListener("click", () => openDlg("dialog-method"));
  $("save-current")?.addEventListener("click", () => {
    if (!state.place) return;
    savePlace(state.place);
    refreshSaved();
    say(`Zapisano lokalizację: ${state.place.name}.`);
  });
  $("tab-today")?.addEventListener("click", () => setTab("today"));
  $("tab-forecast")?.addEventListener("click", () => setTab("forecast"));
  setTab("today");
}

function init() {
  bind();
  refreshSaved();
  refreshWatch();
  const last = getLast();
  if (last?.lat && last?.lon) load(last);
  else show("welcome");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}

init();
