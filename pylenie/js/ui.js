import {
  ALLERGENS,
  shownLevel,
  fmtDay,
  fmtDateTime,
  verdict,
  interpretation,
  changeText,
  localKey,
} from "./config.js";

const $ = (id) => document.getElementById(id);

function pill(level) {
  const s = shownLevel(level);
  const el = document.createElement("span");
  el.className = "pill";
  el.dataset.level = s.id;
  el.innerHTML = `<i class="shape" aria-hidden="true"></i>${s.label}`;
  return el;
}

function spark(values, level) {
  const wrap = document.createElement("span");
  wrap.className = "spark";
  wrap.dataset.level = shownLevel(level).id;
  wrap.setAttribute("aria-hidden", "true");
  if (!values?.length) return wrap;
  const step = Math.max(1, Math.floor(values.length / 8));
  const sample = [];
  for (let i = 0; i < values.length; i += step) sample.push(values[i]);
  const max = Math.max(1, ...sample);
  for (const v of sample.slice(0, 8)) {
    const bar = document.createElement("i");
    bar.style.height = `${Math.max(3, Math.round((v / max) * 20))}px`;
    wrap.appendChild(bar);
  }
  return wrap;
}

export function say(msg) {
  const el = $("live");
  if (el) el.textContent = msg;
}

export function setTab(view) {
  const today = view === "today";
  $("tab-today")?.classList.toggle("is-active", today);
  $("tab-forecast")?.classList.toggle("is-active", !today);
  $("tab-today")?.setAttribute("aria-selected", String(today));
  $("tab-forecast")?.setAttribute("aria-selected", String(!today));
  if ($("panel-today")) $("panel-today").hidden = !today;
  if ($("panel-forecast")) $("panel-forecast").hidden = today;
}

export function show(state) {
  const map = {
    welcome: "state-welcome",
    loading: "state-loading",
    error: "state-error",
    content: "content",
  };
  for (const [key, id] of Object.entries(map)) {
    const el = $(id);
    if (el) el.hidden = key !== state;
  }
}

export function setError(text) {
  if ($("error-text")) $("error-text").textContent = text;
}

export function openDlg(id) {
  $(id)?.showModal?.();
}

export function closeDlg(id) {
  if ($(id)?.open) $(id).close();
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
  list.innerHTML = "";
  if (!places.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Brak zapisanych miejsc.";
    list.appendChild(li);
    return;
  }
  for (const p of places) {
    const li = document.createElement("li");
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = onRemove ? "1fr auto" : "1fr";
    wrap.style.gap = "8px";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.label || p.name;
    btn.addEventListener("click", () => onPick?.(p));
    wrap.appendChild(btn);
    if (onRemove) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "icon-btn";
      rm.setAttribute("aria-label", `Usuń ${p.name}`);
      rm.textContent = "×";
      rm.addEventListener("click", () => onRemove(p.id));
      wrap.appendChild(rm);
    }
    li.appendChild(wrap);
    list.appendChild(li);
  }
}

export function renderWatch(ids, onToggle) {
  const list = $("watch-list");
  if (!list) return;
  list.innerHTML = "";
  for (const a of ALLERGENS) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = ids.includes(a.id);
    input.addEventListener("change", () => onToggle(a.id));
    label.append(input, document.createTextNode(` ${a.name}`));
    li.appendChild(label);
    list.appendChild(li);
  }
}

export function renderMain({ place, forecast, selectedDay, watched, onSelectDay, onOpenAllergen }) {
  const { current, days, source, mockNote, generatedAt } = forecast;
  const overall = shownLevel(current.overall);
  const top = current.allergens.find((a) => a.value > 0) || current.allergens[0];
  const asOf = new Date(current.asOf || generatedAt);
  const todayKey = localKey(asOf);
  const yesterday = [...days].reverse().find((d) => d.date < todayKey);
  const focusKey = selectedDay || todayKey;
  const focusDay =
    days.find((d) => d.date === focusKey) ||
    days.find((d) => d.date >= todayKey) ||
    days.at(-1);

  $("header-place").textContent = place.label || place.name;
  $("place-title").textContent = place.name;
  $("meta-line").textContent = `Aktualizacja: ${fmtDateTime(asOf)}`;
  $("overall-badge").dataset.level = overall.id;
  $("overall-text").textContent = overall.label;
  $("verdict").textContent = verdict({ overall: current.overall, top, place: place.name });
  $("interpretation").textContent = interpretation(current.overall);

  $("trust-line").textContent =
    source === "mock"
      ? `Dane przykładowe (mock). Wygenerowano: ${fmtDateTime(new Date(generatedAt))}.`
      : `Dane modelu CAMS. Stan na ${fmtDateTime(asOf)}.`;

  const mode = $("data-mode");
  if (mode) {
    if (source === "mock") {
      mode.hidden = false;
      mode.textContent = mockNote || "Wyświetlane są dane przykładowe (mock).";
    } else {
      mode.hidden = true;
    }
  }

  const save = $("save-current");
  if (save) save.hidden = false;

  const highlights = $("highlights");
  highlights.innerHTML = "";
  const active = current.allergens.filter((a) => a.value > 0).slice(0, 5);
  const rows = active.length ? active : current.allergens.slice(0, 3);
  for (const item of rows) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "ah-name";
    if (watched.includes(item.id)) {
      const dot = document.createElement("span");
      dot.className = "watch-dot";
      name.append(dot, document.createTextNode(item.name));
    } else name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "ah-meta";
    const y = yesterday?.allergens.find((a) => a.id === item.id)?.level;
    meta.textContent = `${item.value.toFixed(1)} ziaren/m³ · ${changeText(item.level, y)}`;
    li.append(name, pill(item.level), meta);
    highlights.appendChild(li);
  }

  const list = $("allergen-list");
  list.innerHTML = "";
  const sorted = [...(focusDay?.allergens || [])].sort(
    (a, b) => b.level.rank - a.level.rank || b.peak - a.peak
  );
  for (const item of sorted) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "row";
    btn.addEventListener("click", () => onOpenAllergen(item.id));
    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "ar-name";
    if (watched.includes(item.id)) {
      const dot = document.createElement("span");
      dot.className = "watch-dot";
      name.append(dot, document.createTextNode(item.name));
    } else name.textContent = item.name;
    const season = document.createElement("div");
    season.className = "ar-season";
    season.textContent = `Sezon: ${item.season}`;
    left.append(name, season);
    const trend = document.createElement("div");
    trend.className = "ar-trend";
    const y = yesterday?.allergens.find((a) => a.id === item.id)?.level;
    trend.append(
      document.createTextNode(
        `${item.peak.toFixed(1)} ziaren/m³ (szczyt dnia) · ${changeText(item.level, y)} `
      ),
      spark(item.hourly, item.level)
    );
    btn.append(left, pill(item.level), trend);
    li.appendChild(btn);
    list.appendChild(li);
  }

  const daysEl = $("days");
  daysEl.innerHTML = "";
  const upcoming = days.filter((d) => d.date >= todayKey).slice(0, 7);
  for (const day of upcoming) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    btn.setAttribute("role", "listitem");
    if (day.date === focusKey) btn.classList.add("is-on");
    const date = new Date(`${day.date}T12:00:00`);
    const ov = shownLevel(day.overall);
    const topA = [...day.allergens].sort((a, b) => b.peak - a.peak)[0];
    let blurb = "Spokojnie";
    if (topA && topA.peak >= 1) {
      if (ov.rank === 1) blurb = "Niskie nasilenie";
      else if (ov.rank >= 3) blurb = `Głównie ${topA.name.toLowerCase()}`;
      else blurb = topA.name;
    }
    btn.innerHTML = `
      <span class="dow">${fmtDay(date, { weekday: "short" })}</span>
      <span class="date">${fmtDay(date, { day: "numeric", month: "short" })}</span>
      <span class="pill" data-level="${ov.id}"><i class="shape" aria-hidden="true"></i>${ov.label}</span>
      <span class="blurb">${blurb}</span>`;
    btn.addEventListener("click", () => onSelectDay(day.date));
    daysEl.appendChild(btn);
  }

  const panel = $("day-panel");
  if (focusDay && panel) {
    panel.hidden = false;
    $("day-panel-title").textContent = `Szczegóły: ${fmtDay(new Date(`${focusDay.date}T12:00:00`))}`;
    const pl = $("day-panel-list");
    pl.innerHTML = "";
    const activeDays = [...focusDay.allergens].filter((a) => a.peak > 0).sort((a, b) => b.peak - a.peak);
    for (const item of activeDays.length ? activeDays : focusDay.allergens.slice(0, 3)) {
      const li = document.createElement("li");
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<div><div class="ar-name">${item.name}</div><div class="ar-season">${item.peak.toFixed(1)} ziaren/m³</div></div>`;
      row.appendChild(pill(item.level));
      li.appendChild(row);
      pl.appendChild(li);
    }
  }

  const trend = $("trend");
  const bars = $("trend-bars");
  const trendText = $("trend-text");
  if (upcoming.length && trend && bars) {
    trend.hidden = false;
    bars.innerHTML = "";
    const summary = [];
    for (const day of upcoming) {
      const col = document.createElement("div");
      col.className = "tbar";
      const ov = shownLevel(day.overall);
      col.dataset.level = ov.id;
      const fill = document.createElement("div");
      fill.className = "fill";
      fill.style.height = `${Math.max(6, Math.round(((ov.rank || 0) / 4) * 100))}px`;
      const lbl = document.createElement("div");
      lbl.className = "lbl";
      lbl.textContent = fmtDay(new Date(`${day.date}T12:00:00`), { weekday: "short" });
      col.append(fill, lbl);
      bars.appendChild(col);
      summary.push(`${fmtDay(new Date(`${day.date}T12:00:00`))}: ${ov.label}`);
    }
    if (trendText) trendText.textContent = summary.join(". ");
  }

  say(`Załadowano pylenie dla ${place.name}. Poziom ogólny: ${overall.label}.`);
  show("content");
}

export function renderAllergen(id, forecast, watched, onToggle) {
  const item = forecast.current.allergens.find((a) => a.id === id);
  const meta = ALLERGENS.find((a) => a.id === id);
  if (!item || !meta) return;

  $("allergen-title").textContent = item.name;
  const body = $("allergen-body");
  const s = shownLevel(item.level);
  const todayKey = localKey(new Date(forecast.current.asOf || Date.now()));
  const series = forecast.days
    .filter((d) => d.date >= todayKey)
    .map((d) => {
      const row = d.allergens.find((a) => a.id === id);
      return { date: d.date, peak: row?.peak || 0, level: row?.level };
    });

  body.innerHTML = `
    <div class="stat"><span>Teraz</span><strong>${item.value.toFixed(1)} ziaren/m³ · ${s.label}</strong></div>
    <div class="stat"><span>Szczyt dziś</span><strong>${item.dayPeak.toFixed(1)} ziaren/m³</strong></div>
    <div class="stat"><span>Typowy sezon</span><strong>${meta.season}</strong></div>
    <p class="muted" style="margin-top:16px">${meta.description}</p>
    <h3 class="sub">Najbliższe dni</h3>
    <ul class="list compact" id="allergen-days"></ul>
    <button type="button" class="btn btn-secondary btn-block" id="toggle-watch" style="margin-top:16px">
      ${watched.includes(id) ? "Usuń z obserwowanych" : "Dodaj do obserwowanych"}
    </button>`;

  const list = body.querySelector("#allergen-days");
  for (const point of series) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div><div class="ar-name">${fmtDay(new Date(`${point.date}T12:00:00`))}</div><div class="ar-season">${point.peak.toFixed(1)} ziaren/m³</div></div>`;
    row.appendChild(pill(point.level));
    li.appendChild(row);
    list.appendChild(li);
  }

  body.querySelector("#toggle-watch")?.addEventListener("click", () => {
    onToggle(id);
    closeDlg("dialog-allergen");
  });
  openDlg("dialog-allergen");
}
