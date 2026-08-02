# Dane

## Katalog `data/90minut/`

| Plik | Opis |
|------|------|
| `clubs.json` | Kluby (nazwa, region, tier, strength, liga…) |
| `leagues.json` | Ligi / grupy |
| `players.json` | Zawodnicy (opcjonalnie pod lab / draft) |
| `meta.json` | Metadane importu |

Źródło koncepcyjne: ekosystem 90minut / lokalne skrypty importu. Pliki w repo to snapshot JSON pod grę offline.

## Import

```bash
python3 scripts/import_90minut.py
```

Szczegóły argumentów i źródła — w nagłówku / docstringu skryptu. Po imporcie sprawdź `meta.json` i rozmiary JSON.

## Użycie w grze

- Kariera ładuje kluby przez moduły JS (`08-polska-kariera-kluby.js` i powiązania z core).
- Nie commituj `__pycache__/` ani lokalnych `.log` (są w `.gitignore`).

## Aktualizacja bazy

1. Uruchom import.  
2. Zweryfikuj kilka klubów z różnych województw i tierów.  
3. Odpal grę lokalnie i sprawdź oferty startowe / rynek.
