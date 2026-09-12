# Pylenie — PWA

Prosta aplikacja mobilna (Progressive Web App) do sprawdzania pylenia w Twojej lokalizacji w Polsce.

## Jak uruchomić

```bash
cd pylenie
python3 -m http.server 8787
```

Otwórz: [http://127.0.0.1:8787/](http://127.0.0.1:8787/)

Na telefonie: otwórz adres w Chrome/Safari w tej samej sieci, potem **Dodaj do ekranu głównego**.

## Co robi

1. Bierze lokalizację GPS (albo wybrane miasto).
2. Pobiera godzinową prognozę pyłków z **Open-Meteo Air Quality API** (model CAMS Copernicus).
3. Pokazuje poziom dla traw, brzozy, olszy, bylicy, ambrozji i oliwki oraz wykres najbliższych godzin.

## Źródła danych

| Źródło | Rola |
|--------|------|
| [Open-Meteo / CAMS](https://open-meteo.com/en/docs/air-quality-api) | Godzinowa prognoza stężeń (ziarna/m³) |
| [Serwis Pyłkowy IMGW-PIB](https://biometeo.imgw.pl/?page=PYLKI) | Oficjalne komunikaty tygodniowe (PSA) |

**IMGW** publikuje cotygodniowe komunikaty dla ~8 ośrodków (aktualizacja zwykle w czwartki w sezonie luty–wrzesień), ale **nie ma publicznego REST API** z pomiarami pyłku w czasie rzeczywistym. Dlatego aplikacja opiera się na modelu CAMS, a do oficjalnych komunikatów linkuje IMGW.

## Pliki

```
pylenie/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── icons/
└── README.md
```

Działa bez buildera — czysty HTML/CSS/JS.
