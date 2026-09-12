const K = {
  places: "pylenie:places:v1",
  watch: "pylenie:watch:v1",
  last: "pylenie:last:v1",
  theme: "pylenie:theme:v1",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function getPlaces() {
  const v = read(K.places, []);
  return Array.isArray(v) ? v : [];
}

export function savePlace(place) {
  const next = getPlaces().filter((p) => p.id !== place.id);
  next.unshift({
    id: place.id,
    name: place.name,
    label: place.label || place.name,
    lat: place.lat,
    lon: place.lon,
    admin: place.admin || "",
  });
  write(K.places, next.slice(0, 8));
  return getPlaces();
}

export function removePlace(id) {
  write(
    K.places,
    getPlaces().filter((p) => p.id !== id)
  );
  return getPlaces();
}

export function getWatch() {
  const v = read(K.watch, ["grass", "birch", "mugwort"]);
  return Array.isArray(v) ? v : [];
}

export function toggleWatch(id) {
  const set = new Set(getWatch());
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = [...set];
  write(K.watch, next);
  return next;
}

export function getLast() {
  return read(K.last, null);
}

export function setLast(place) {
  write(K.last, place);
}

export function getTheme() {
  const v = read(K.theme, "system");
  return ["dark", "light", "system"].includes(v) ? v : "system";
}

export function setTheme(v) {
  write(K.theme, v);
}
