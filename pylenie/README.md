# Pylenie

Lekka PWA do sprawdzania aktualnego i prognozowanego pylenia w wybranej lokalizacji w Polsce.

## Uruchomienie

```bash
cd pylenie
python3 -m http.server 8787
```

Otwórz: http://127.0.0.1:8787/

Na telefonie (ta sama sieć Wi‑Fi): `http://<IP-komputera>:8787/`  
Albo wgraj katalog `pylenie/` na hosting z HTTPS i dodaj do ekranu głównego.

## Co pokazuje

1. **Werdykt na dziś** — poziom ogólny i naturalny opis.
2. **Najważniejsze alergeny** — z poziomem słownym (niski / umiarkowany / wysoki / bardzo wysoki).
3. **Prognoza na najbliższe dni** — wybór dnia i rozbicie na alergeny.
4. **Obserwowane alergeny i zapisane lokalizacje** — w ustawieniach.

## Dane

| Źródło | Rola |
|--------|------|
| [Open-Meteo / CAMS](https://open-meteo.com/en/docs/air-quality-api) | Godzinowa prognoza stężeń |
| [Serwis Pyłkowy IMGW-PIB](https://biometeo.imgw.pl/?page=PYLKI) | Oficjalne komunikaty tygodniowe |

IMGW nie udostępnia otwartego API z pomiarami w czasie rzeczywistym. Aplikacja korzysta z modelu CAMS i linkuje do IMGW. Przy błędzie sieci pokazuje oznaczone dane przykładowe (mock).

## Stack

Czysty HTML + CSS + ES modules. Bez buildera.
