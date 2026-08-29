# Polski Piłkarz — 16-bit kariera

Symulator kariery polskiego piłkarza w estetyce pixel / 16-bit. Statyczna gra przeglądarkowa (HTML + CSS + JS), bez buildera.

Inspiracje: lokalny klimat kariery (m.in. Tetrycy), pętla życia/sezonu w duchu Copero oraz decyzje meczowe à la New Star Soccer — **układ i branding własne**, nie kopia oryginału.

## Szybki start

Wymaga Pythona 3 (wbudowany serwer HTTP):

```bash
cd "Gra football"   # lub katalog klonu
python3 -m http.server 8765
```

Otwórz: [http://127.0.0.1:8765/](http://127.0.0.1:8765/)

| Strona | Opis |
|--------|------|
| `index.html` | Główna kariera (create player → sezony → życie → emerytura) |
| `lab.html` | LAB — piaskownica meczowa / skilli |
| `kanban.html` | Tablica Kanban — zadania z drag-and-drop i localStorage |

## Funkcje

- Tworzenie zawodnika: pozycja, województwo, budżet skilli, tryb sezonu i tempo kariery
- Sezony z ofertami klubowymi, decyzjami fabularnymi i raportami
- Gazeta po sezonie, faza życia (energia / relacje), karta kariery do pobrania (Stories)
- Turnieje / silnik meczowy NSS (moduły w `js/`)
- Fonty z pełnymi polskimi znakami: **Jersey 10** + **VT323** (`fonts/`)

## Struktura repozytorium

```
├── index.html          # kariera
├── lab.html            # lab
├── css/
│   ├── main.css        # UI pixel + @font-face
│   ├── lab.css
│   └── 04-nss-turnieje-ui.css
├── fonts/              # jersey10.woff2, vt323.woff2
├── js/
│   ├── 01–07…          # NSS (dane, silnik, turnieje, UI, adapter)
│   ├── 08…10…          # kluby PL, imiona, decyzje, core kariery
│   ├── 11-lab-integration.js
│   ├── 12-career-life.js   # relacje, gazeta, share card
│   └── lab/            # lab-app, lab-match, lab-season, lab-data
├── data/90minut/       # kluby / ligi / zawodnicy (JSON)
├── scripts/            # import danych (Python)
└── docs/               # dokumentacja
```

Szczegóły architektury: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)  
Dane i import: [docs/DATA.md](docs/DATA.md)

## Stack

- Czysty front: HTML5, CSS, vanilla JS (ES modules nie są wymagane — skrypty w kolejności w HTML)
- Dane: JSON (`data/90minut/`)
- Import: `scripts/import_90minut.py`

## Licencja i credits

Kod projektu: własny fork / rozwój w tym repozytorium.

- Powered by / inspiracja: [Tetrycy](https://tetrycy.com.pl/)
- Fonty: [Jersey 10](https://fonts.google.com/specimen/Jersey+10), [VT323](https://fonts.google.com/specimen/VT323) (Google Fonts / OFL)

Jeśli publikujesz fork, zachowaj informację o inspiracji i licencjach fontów.
