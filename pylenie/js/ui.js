import {
  ALLERGENS,
  shownLevel,
  fmtDay,
  verdict,
  interpretation,
  changeText,
  localKey,
} from "./config.js";

const $ = (id) => document.getElementById(id);

const LEVEL_COLOR = {
  none: "var(--muted)",
  low: "var(--low)",
  moderate: "var(--moderate)",
  high: "var(--high)",
  "very-high": "var(--very-high)",
};

function fmtNum(v) {
  return (Math.round(v * 10) / 10).toString().replace(".", ",");
}

function fmtHeaderDate(date) {
  const d = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(date);
  const t = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${d}, ${t}`;
}

function setMeter(el, level) {
  if (!el) return;
  el.dataset.level = shownLevel(level).id;
}

export function say(msg) {
  const el = $("live");
  if (el) el.textContent = msg;
}

export function show(state) {
  const map = { start: "screen-start", loading: "screen-loading", error: "screen-error", app: "app" };
  for (const [key, id] of Object.entries(map)) {
    const el = $(id);
    if (el) el.hidden = key !== state;
  }
}

export function setError(text) {
  if ($("error-text")) $("error-text").textContent = text;
}

export function applyTheme(pref) {
  const resolved = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "dark" ? "#0f1512" : "#f6f3ea";
}

export function setThemeSeg(pref) {
  document.querySelectorAll("#theme-seg [data-theme-value]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.themeValue === pref);
  });
}

export function setTab(tab) {
  document.querySelectorAll(".screen[data-tab]").forEach((el) => {
    el.hidden = el.dataset.tab !== tab;
  });
  document.querySelectorAll(".tabbar-item").forEach((btn) => {
    const on = btn.dataset.tabBtn === tab;
    btn.classList.toggle("is-on", on);
    if (on) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });
}

function levelRow(item, { watched = false, sub = "", trailing = "" } = {}) {
  const li = document.createElement("li");
  const row = document.createElement("div");
  row.className = "row-static";
  const left = document.createElement("div");
  left.className = "row-left";
  const name = document.createElement("div");
  name.className = "row-name";
  if (watched) {
    const dot = document.createElement("span");
    dot.className = "dot";
    name.append(dot);
  }
  name.append(document.createTextNode(item.name));
  const meta = document.createElement("div");
  meta.className = "row-meta";
  meta.textContent = sub;
  left.append(name, meta);
  const right = document.createElement("div");
  right.className = "row-right";
  const s = shownLevel(item.level);
  const lvl = document.createElement("span");
  lvl.className = "row-level" + (item.level?.id === "none" ? " is-none" : "");
  lvl.textContent = s.label;
  const meter = document.createElement("span");
  meter.className = "meter meter-sm";
  meter.dataset.level = s.id;
  meter.innerHTML = "<i></i><i></i><i></i><i></i>";
  right.append(lvl, meter);
  row.append(left, right);
  li.appendChild(row);
  return li;
}

export function renderCities(items, onPick) {
  const list = $("city-results");
  if (!list) return;
  list.innerHTML = "";
  if (!items.length) {
    list.hidden = true;
    return;
  }
  for (const city of items) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = city.label;
    btn.addEventListener("click", () => onPick(city));
    li.appendChild(btn);
    list.appendChild(li);
  }
  list.hidden = false;
}

export function renderSaved(id, places, { onPick, onRemove } = {}) {
  const list = $(id);
  if (!list) return;
  const block = list.closest(".saved-block");
  if (block) block.hidden = places.length === 0;
  list.innerHTML = "";
  if (!places.length) {
    if (id !== "start-saved") {
      const li = document.createElement("li");
      li.className = "muted";
      li.style.padding = "14px 16px";
      li.textContent = "Brak zapisanych miejsc.";
      list.appendChild(li);
    }
    return;
  }
  for (const p of places) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "saved-row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick";
    btn.textContent = p.label || p.name;
    btn.addEventListener("click", () => onPick?.(p));
    row.appendChild(btn);
    if (onRemove) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "rm";
      rm.setAttribute("aria-label", `Usuń ${p.name}`);
      rm.textContent = "×";
      rm.addEventListener("click", () => onRemove(p.id));
      row.appendChild(rm);
    }
    li.appendChild(row);
    list.appendChild(li);
  }
}

export function renderWatchChips(ids, onToggle) {
  const wrap = $("watch-chips");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const a of ALLERGENS) {
    const btn = document.createElement("button");
    btn.type = "button";
    const on = ids.includes(a.id);
    btn.className = "chip" + (on ? " is-on" : "");
    btn.innerHTML = on
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 12l5 5L20 6"/></svg>${a.name}`
      : a.name;
    btn.addEventListener("click", () => onToggle(a.id));
    wrap.appendChild(btn);
  }
}

export function renderMain({ place, forecast, selectedDay, watched, onSelectDay, onOpenAllergen }) {
  const { current, days, source, mockNote } = forecast;
  const overall = shownLevel(current.overall);
  const top = current.allergens.find((a) => a.value > 0) || current.allergens[0];
  const asOf = new Date(current.asOf || forecast.generatedAt);
  const todayKey = localKey(asOf);
  const yesterday = [...days].reverse().find((d) => d.date < todayKey);
  const focusKey = selectedDay || todayKey;
  const focusDay =
    days.find((d) => d.date === focusKey) ||
    days.find((d) => d.date >= todayKey) ||
    days.at(-1);

  $("place-name").textContent = place.label || place.name;
  $("today-date").textContent = fmtHeaderDate(asOf);
  $("verdict-word").textContent = overall.label;
  $("verdict-word").dataset.long = overall.label.length > 9 ? "1" : "0";
  setMeter($("today-meter"), current.overall);
  $("verdict-sentence").textContent = verdict({ overall: current.overall, top, place: place.name });
  $("interpretation").textContent = interpretation(current.overall);

  const mock = $("mock-note");
  if (mock) {
    mock.hidden = source !== "mock";
    mock.textContent = mockNote || "Dane przykładowe dla wybranej lokalizacji, nie są aktualnym pomiarem.";
  }

  // highlights (top 3 active)
  const highlights = $("highlights");
  highlights.innerHTML = "";
  const active = current.allergens.filter((a) => a.value > 0).slice(0, 3);
  const rows = active.length ? active : current.allergens.slice(0, 3);
  for (const item of rows) {
    const y = yesterday?.allergens.find((a) => a.id === item.id)?.level;
    const li = levelRow(item, {
      watched: watched.includes(item.id),
      sub: `${fmtNum(item.value)} ziaren/m³, ${changeText(item.level, y)}`,
    });
    li.addEventListener("click", () => onOpenAllergen(item.id));
    li.style.cursor = "pointer";
    highlights.appendChild(li);
  }

  // allergens screen
  $("allergens-title").textContent = `${current.allergens.length === 1 ? "Jeden" : sixWord(current.allergens.length)} śledzon${current.allergens.length === 1 ? "y" : "ych"}`;
  const list = $("allergen-list");
  list.innerHTML = "";
  const sorted = [...(focusDay?.allergens || [])].sort((a, b) => b.level.rank - a.level.rank || b.peak - a.peak);
  for (const item of sorted) {
    const li = levelRow(item, { watched: watched.includes(item.id), sub: `Sezon ${item.season}` });
    li.addEventListener("click", () => onOpenAllergen(item.id));
    li.style.cursor = "pointer";
    highlightSeason(li);
    list.appendChild(li);
  }

  // forecast screen
  $("forecast-place").textContent = `Prognoza, ${place.name}`;
  $("forecast-day-title").textContent = fmtDay(new Date(`${focusKey}T12:00:00`), { weekday: "long", day: "numeric", month: "short" });

  const daysEl = $("days");
  daysEl.innerHTML = "";
  const upcoming = days.filter((d) => d.date >= todayKey).slice(0, 4);
  for (const day of upcoming) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day-chip" + (day.date === focusKey ? " is-on" : "");
    btn.setAttribute("role", "listitem");
    const date = new Date(`${day.date}T12:00:00`);
    const ov = shownLevel(day.overall);
    btn.innerHTML = `
      <span class="dow">${fmtDay(date, { weekday: "short", day: "numeric" })}</span>
      <span class="meter meter-sm" data-level="${ov.id}"><i></i><i></i><i></i><i></i></span>
      <span class="lbl">${ov.label}</span>`;
    btn.addEventListener("click", () => onSelectDay(day.date));
    daysEl.appendChild(btn);
  }

  const topA = [...(focusDay?.allergens || [])].sort((a, b) => b.peak - a.peak)[0];
  $("forecast-peak-note").textContent = topA && topA.peak > 0 ? `${topA.name} do ${fmtNum(topA.peak)} ziaren/m³` : "";

  const bars = $("hourly-bars");
  bars.innerHTML = "";
  const hourly = topA?.hourly || [];
  const max = Math.max(1, ...hourly);
  const thresholds = ALLERGENS.find((a) => a.id === topA?.id)?.thresholds;
  let peakHour = 0;
  let peakVal = -1;
  hourly.forEach((v, h) => {
    if (v > peakVal) {
      peakVal = v;
      peakHour = h;
    }
    const bar = document.createElement("i");
    const pct = Math.max(4, Math.round((v / max) * 100));
    bar.style.height = `${pct}%`;
    const lvl = thresholds ? levelId(v, thresholds) : "low";
    bar.style.setProperty("--lvl-color", LEVEL_COLOR[lvl]);
    bars.appendChild(bar);
  });
  const summaryText = topA && topA.peak > 0
    ? `Najwięcej około ${String(peakHour).padStart(2, "0")}:00. Rano i po zmroku wyraźnie mniej.`
    : "Bez istotnego pylenia w ciągu dnia.";
  $("hourly-summary").textContent = summaryText;
  $("trend-text").textContent = summaryText;

  say(`Załadowano pylenie dla ${place.name}. Poziom ogólny: ${overall.label}.`);
}

function sixWord(n) {
  const words = ["Zero", "Jeden", "Dwa", "Trzy", "Cztery", "Pięć", "Sześć", "Siedem", "Osiem", "Dziewięć"];
  return words[n] || String(n);
}

function highlightSeason(li) {
  const meta = li.querySelector(".row-meta");
  if (meta) meta.textContent = meta.textContent.replace("–", "-");
}

function levelId(value, thresholds) {
  if (value < thresholds[0]) return "none";
  if (value < thresholds[1]) return "low";
  if (value < thresholds[2]) return "moderate";
  if (value < thresholds[3]) return "high";
  return "very-high";
}

export function openAllergenSheet(id, forecast, watched, onToggle) {
  const item = forecast.current.allergens.find((a) => a.id === id);
  const meta = ALLERGENS.find((a) => a.id === id);
  if (!item || !meta) return;

  const todayKey = localKey(new Date(forecast.current.asOf || Date.now()));
  const yesterday = [...forecast.days].reverse().find((d) => d.date < todayKey);
  const y = yesterday?.allergens.find((a) => a.id === id)?.level;

  $("sheet-season").textContent = `Sezon ${meta.season}`;
  $("sheet-name").textContent = item.name;
  $("sheet-value").textContent = fmtNum(item.value);
  setMeter($("sheet-meter"), item.level);
  $("sheet-level-label").textContent = shownLevel(item.level).label;
  $("sheet-change").textContent = `${changeText(item.level, y)}, szczyt ${fmtNum(item.dayPeak)}`;
  $("sheet-description").textContent = meta.description;

  const list = $("sheet-days");
  list.innerHTML = "";
  const series = forecast.days.filter((d) => d.date >= todayKey);
  for (const d of series) {
    const row = d.allergens.find((a) => a.id === id);
    const li = document.createElement("li");
    li.className = "row-static";
    li.style.padding = "12px 0";
    li.innerHTML = `<span>${fmtDay(new Date(`${d.date}T12:00:00`), { weekday: "short", day: "numeric", month: "short" })}</span>`;
    const right = document.createElement("span");
    right.className = "row-right";
    const val = document.createElement("span");
    val.className = "row-level";
    val.textContent = `${fmtNum(row?.peak || 0)} ziaren/m³`;
    const meter = document.createElement("span");
    meter.className = "meter meter-xs";
    meter.dataset.level = shownLevel(row?.level).id;
    meter.innerHTML = "<i></i><i></i><i></i><i></i>";
    right.append(val, meter);
    li.appendChild(right);
    list.appendChild(li);
  }

  const isWatched = watched.includes(id);
  const toggleBtn = $("sheet-toggle-watch");
  toggleBtn.textContent = isWatched ? "Przestań obserwować" : "Obserwuj ten alergen";
  toggleBtn.className = "btn btn-block " + (isWatched ? "btn-secondary" : "btn-primary");
  toggleBtn.onclick = () => onToggle(id);

  $("sheet-backdrop").hidden = false;
  $("allergen-sheet").hidden = false;
}

export function closeAllergenSheet() {
  $("sheet-backdrop").hidden = true;
  $("allergen-sheet").hidden = true;
}
