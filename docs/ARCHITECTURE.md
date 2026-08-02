# Architektura

## Przepływ kariery (`index.html`)

1. **Setup** — `setupView`: tożsamość, skille, tryb sezonu, tempo kariery  
2. **Oferty** — fax / kluby startowe  
3. **Sezon** — silnik + decyzje (zależnie od `playMode`)  
4. **Gazeta** — nagłówki po sezonie (`CareerLife`)  
5. **Decyzja fabularna** — wg tempa (`intense` / `normal` / `express`)  
6. **Rynek klubowy** — oferty transferowe  
7. **Faza życia** — limity energii, relacje  
8. **Advance year** — wiek / sezon dalej albo emerytura + karta share

Główna logika stanu: `js/10-polska-kariera-core.js`  
Życie / relacje / share: `js/12-career-life.js` (ładowany **przed** core)

## Kolejność skryptów

Kolejność w `index.html` ma znaczenie (globalne obiekty, brak bundlera):

1. Dane i silnik NSS (`01`–`07`)
2. Kluby / imiona / decyzje (`08`, `08b`, `09`)
3. `12-career-life.js`
4. `10-polska-kariera-core.js`
5. `11-lab-integration.js`

## Warstwy

| Warstwa | Pliki | Rola |
|---------|--------|------|
| UI kariery | `css/main.css`, markup w `index.html` | Pixel board, HUD, setup |
| Core | `10-polska-kariera-core.js` | Stan gracza, sezony, przejścia |
| Life | `12-career-life.js` | Relacje, tempo, headlines, canvas PNG |
| Decyzje | `09-polska-kariera-decyzje.js` | Eventy fabularne |
| Kluby | `08-polska-kariera-kluby.js` + `data/90minut/` | Baza klubów PL |
| NSS | `01`–`07`, `04-nss-turnieje-ui.css` | Mecz, turnieje, adapter |
| Lab | `lab.html`, `js/lab/*`, `11-lab-integration.js` | Piaskownica |

## UI / fonty

- `--font-pixel`: Jersey 10 (nagłówki)  
- `--font-body`: VT323 (tekst, formularze, skille)  
- Pełne pliki WOFF2 w `fonts/` (bez subsetów `unicode-range`) — polskie glify i spójne metryki

## Stan (skrót)

Typowe pola w obiekcie kariery (niepełna lista):

- tożsamość: `name`, `position`, `region`, `age`, `overall`
- klub / historia: `club`, `clubHistory`, `totals`
- soft: relacje, energia, `headlines`, `careerPace`
- wynik: `score`, `trophies`, `nationalCaps`, path tag przy emeryturze

## Rozszerzanie

- Nowa decyzja → `09-polska-kariera-decyzje.js`  
- Nowa akcja życia → `12-career-life.js` + host w core  
- Nowy tryb UI → CSS w `main.css`, bez kart w hero (konwencja pixel board)
