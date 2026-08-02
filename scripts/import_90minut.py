#!/usr/bin/env python3
"""
Import klubów, poziomów rozgrywek i nazwisk piłkarzy z 90minut.pl (sezon 2026/27).

Użycie:
  python3 scripts/import_90minut.py
  python3 scripts/import_90minut.py --skip-players   # tylko kluby/ligi
  python3 scripts/import_90minut.py --players-only

Wynik:
  data/90minut/leagues.json
  data/90minut/clubs.json
  data/90minut/players.json
  data/90minut/meta.json
  js/08-polska-kariera-kluby.js   (PL z 90minut + zachowane foreignClubs)
  js/08b-polskie-imiona.js        (pula imion z kadr centralnych)
"""

from __future__ import annotations

import argparse
import json
import random
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "90minut"
BASE = "http://www.90minut.pl"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
SEASON_ID = 109  # 2026/2027
DELAY = 0.18

REGION_BY_LIGIREG = {
    16: "Dolnośląskie",
    1: "Kujawsko-pomorskie",
    2: "Lubelskie",
    3: "Lubuskie",
    4: "Łódzkie",
    5: "Małopolskie",
    6: "Mazowieckie",
    7: "Opolskie",
    8: "Podkarpackie",
    9: "Podlaskie",
    10: "Pomorskie",
    11: "Śląskie",
    12: "Świętokrzyskie",
    13: "Warmińsko-mazurskie",
    14: "Wielkopolskie",
    15: "Zachodniopomorskie",
}

REGION_NAMES = list(REGION_BY_LIGIREG.values())

# Centralne poziomy (id_rozgrywki / liga*.html z menu 90minut)
CENTRAL = [
    {
        "name": "PKO BP Ekstraklasa",
        "tier": 6,
        "liga_id": 14675,
        "skarb_id": 14675,
        "region": None,
    },
    {
        "name": "Betclic I liga",
        "tier": 5,
        "liga_id": 14676,
        "skarb_id": 14676,
        "region": None,
    },
    {
        "name": "Betclic II liga",
        "tier": 4,
        "liga_id": 14677,
        "skarb_id": 14677,
        "region": None,
    },
    {
        "name": "III liga, gr. I",
        "tier": 3,
        "liga_id": 14742,
        "skarb_id": None,
        "region": None,
        "iii_group": 1,
    },
    {
        "name": "III liga, gr. II",
        "tier": 3,
        "liga_id": 14743,
        "skarb_id": None,
        "region": None,
        "iii_group": 2,
    },
    {
        "name": "III liga, gr. III",
        "tier": 3,
        "liga_id": 14744,
        "skarb_id": None,
        "region": None,
        "iii_group": 3,
    },
    {
        "name": "III liga, gr. IV",
        "tier": 3,
        "liga_id": 14745,
        "skarb_id": None,
        "region": None,
        "iii_group": 4,
    },
]

# Przybliżone województwa w grupach III ligi (sezon 2026/27)
III_GROUP_REGIONS = {
    1: {  # północno-wschodnia / północ
        "Podlaskie",
        "Warmińsko-mazurskie",
        "Mazowieckie",
        "Pomorskie",
        "Kujawsko-pomorskie",
    },
    2: {"Zachodniopomorskie", "Wielkopolskie", "Lubuskie", "Kujawsko-pomorskie", "Pomorskie"},
    3: {"Dolnośląskie", "Opolskie", "Śląskie", "Łódzkie"},
    4: {"Małopolskie", "Świętokrzyskie", "Podkarpackie", "Lubelskie"},
}

CITY_HINTS = {
    "Warszawa": "Mazowieckie",
    "Kraków": "Małopolskie",
    "Łódź": "Łódzkie",
    "Wrocław": "Dolnośląskie",
    "Poznań": "Wielkopolskie",
    "Gdańsk": "Pomorskie",
    "Gdynia": "Pomorskie",
    "Sopot": "Pomorskie",
    "Szczecin": "Zachodniopomorskie",
    "Bydgoszcz": "Kujawsko-pomorskie",
    "Toruń": "Kujawsko-pomorskie",
    "Lublin": "Lubelskie",
    "Białystok": "Podlaskie",
    "Katowice": "Śląskie",
    "Gliwice": "Śląskie",
    "Zabrze": "Śląskie",
    "Chorzów": "Śląskie",
    "Bytom": "Śląskie",
    "Rzeszów": "Podkarpackie",
    "Kielce": "Świętokrzyskie",
    "Olsztyn": "Warmińsko-mazurskie",
    "Opole": "Opolskie",
    "Zielona Góra": "Lubuskie",
    "Gorzów": "Lubuskie",
    "Częstochowa": "Śląskie",
    "Radom": "Mazowieckie",
    "Płock": "Mazowieckie",
    "Legnica": "Dolnośląskie",
    "Lubin": "Dolnośląskie",
    "Mielec": "Podkarpackie",
    "Nieciecza": "Małopolskie",
    "Niepołomice": "Małopolskie",
    "Tychy": "Śląskie",
    "Bielsko": "Śląskie",
    "Nowy Sącz": "Małopolskie",
    "Nowy Targ": "Małopolskie",
    "Stalowa Wola": "Podkarpackie",
    "Siedlce": "Mazowieckie",
    "Grodzisk": "Mazowieckie",
    "Pruszków": "Mazowieckie",
    "Grudziądz": "Kujawsko-pomorskie",
    "Chojnice": "Pomorskie",
    "Łęczna": "Lubelskie",
    "Świdnik": "Lubelskie",
    "Kleczew": "Wielkopolskie",
}


def fetch(url: str, retries: int = 3) -> str:
    last = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Accept-Language": "pl"})
            with urlopen(req, timeout=45) as resp:
                raw = resp.read()
            time.sleep(DELAY)
            return raw.decode("iso-8859-2", errors="replace")
        except (HTTPError, URLError, TimeoutError) as exc:
            last = exc
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Fetch failed {url}: {last}")


def clean_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    return s


def classify_league(label: str) -> tuple[int, str]:
    lab = clean_text(label)
    low = lab.lower()
    if "iii liga" in low:
        return 3, "III liga"
    if re.search(r"\biv liga\b", low):
        return 2, "IV liga"
    if re.search(r"\bv liga\b", low):
        return 1, "V liga"
    if "klasa okręgowa" in low or "klasa okregowa" in low:
        return 1, "Klasa okręgowa"
    if re.search(r"\bklasa a\b", low):
        return 1, "Klasa A"
    if re.search(r"\bklasa b\b", low):
        return 1, "Klasa B"
    if re.search(r"\bklasa c\b", low):
        return 1, "Klasa C"
    return 1, "ligi regionalne"


def parse_clubs_from_liga(html: str) -> list[dict]:
    clubs = []
    seen = set()
    for m in re.finditer(
        r'href="/skarb\.php\?id_klub=(\d+)(?:&amp;|&)id_sezon=\d+"[^>]*>([^<]+)</a>'
        r'|href="/skarb\.php\?id_sezon=\d+(?:&amp;|&)id_klub=(\d+)"[^>]*>([^<]+)</a>'
        r'|href="/skarb\.php\?id_klub=(\d+)"[^>]*>([^<]+)</a>',
        html,
        flags=re.I,
    ):
        cid = m.group(1) or m.group(3) or m.group(5)
        name = clean_text(m.group(2) or m.group(4) or m.group(6))
        if not cid or not name or len(name) < 2:
            continue
        if name.lower() in {"tabela", "wyniki", "statystyki", "terminarz"}:
            continue
        cid = int(cid)
        if cid in seen:
            continue
        seen.add(cid)
        clubs.append({"id": cid, "name": name})
    return clubs


def parse_skarb_clubs(html: str) -> list[dict]:
    clubs = []
    seen = set()
    for m in re.finditer(
        r'href="/skarb\.php\?id_sezon=\d+(?:&amp;|&)id_klub=(\d+)"[^>]*>'
        r'(?:<img[^>]*>\s*<br\s*/?>)?([^<]+)</a>',
        html,
        flags=re.I,
    ):
        cid, name = int(m.group(1)), clean_text(m.group(2))
        if cid in seen or not name:
            continue
        seen.add(cid)
        clubs.append({"id": cid, "name": name})
    if clubs:
        return clubs
    return parse_clubs_from_liga(html)


def guess_region_from_name(name: str, fallback: str | None = None) -> str | None:
    for city, region in CITY_HINTS.items():
        if city.lower() in name.lower():
            return region
    return fallback


def is_reserve(name: str) -> bool:
    return bool(re.search(r"\bII\b|\b2\b| rezerwy| rezerwa", name, flags=re.I))


def strength_for(tier: int, index: int, total: int) -> int:
    ranges = {
        6: (64, 82),
        5: (54, 68),
        4: (50, 62),
        3: (42, 56),
        2: (34, 48),
        1: (28, 40),
    }
    lo, hi = ranges.get(tier, (28, 40))
    if total <= 1:
        return (lo + hi) // 2
    # wyższa pozycja w tabeli (index 0) = wyższy strength
    t = index / (total - 1)
    val = round(hi - t * (hi - lo))
    # mała losowość stabilna względem nazwy/pozycji
    jitter = ((index * 17 + tier * 3) % 5) - 2
    return max(lo, min(hi, val + jitter))


def discover_regional_leagues() -> list[dict]:
    leagues = []
    for rid, region in REGION_BY_LIGIREG.items():
        html = fetch(f"{BASE}/ligireg-{rid}.html")
        title = clean_text(re.search(r"<title>([^<]+)", html).group(1))
        print(f"  region {region} ({title})")
        for href, liga_id, label in re.findall(
            r'href="(/liga/1/liga(\d+)\.html)"[^>]*>([^<]+)</a>', html
        ):
            lab = clean_text(label)
            if "2026/2027" not in lab and "2026/27" not in lab:
                continue
            tier, level = classify_league(lab)
            leagues.append(
                {
                    "id": int(liga_id),
                    "name": lab,
                    "url": href,
                    "tier": tier,
                    "level": level,
                    "region": region,
                    "central": False,
                }
            )
    return leagues


def parse_players_from_kadra(html: str, club_id: int, club_name: str) -> list[dict]:
    players = []
    # sekcje pozycji
    sections = re.split(r"<b>([^<]+):</b>", html, flags=re.I)
    # sections[0]=preamble, then label, body, label, body...
    pos_map = {
        "bramkarze": "GK",
        "bramkarz": "GK",
        "obrońcy": "DEF",
        "obroncy": "DEF",
        "pomocnicy": "MID",
        "napastnicy": "FWD",
    }
    for i in range(1, len(sections), 2):
        label = clean_text(sections[i]).lower().rstrip(":")
        body = sections[i + 1] if i + 1 < len(sections) else ""
        position = pos_map.get(label)
        if not position:
            continue
        for m in re.finditer(
            r'href="/kariera\.php\?id=(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]+)</a>'
            r'[\s\S]*?title="([^"]+)"',
            body,
        ):
            pid = int(m.group(1))
            title_name = clean_text(m.group(2) or m.group(3))
            name = clean_text(m.group(3))
            nationality = clean_text(m.group(4))
            players.append(
                {
                    "id": pid,
                    "name": title_name or name,
                    "nationality": nationality,
                    "position": position,
                    "clubId": club_id,
                    "clubName": club_name,
                    "polish": nationality.lower() == "polska",
                }
            )
    # fallback simpler parse if section split failed
    if not players:
        for m in re.finditer(
            r'href="/kariera\.php\?id=(\d+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]+)</a>'
            r'[\s\S]{0,220}?title="([^"]+)"',
            html,
        ):
            players.append(
                {
                    "id": int(m.group(1)),
                    "name": clean_text(m.group(2) or m.group(3)),
                    "nationality": clean_text(m.group(4)),
                    "position": None,
                    "clubId": club_id,
                    "clubName": club_name,
                    "polish": clean_text(m.group(4)).lower() == "polska",
                }
            )
    # dedupe by id
    uniq = {}
    for p in players:
        uniq[p["id"]] = p
    return list(uniq.values())


def load_existing_foreign_clubs() -> list[dict]:
    path = ROOT / "js" / "08-polska-kariera-kluby.js"
    text = path.read_text(encoding="utf-8")
    m = re.search(r"foreignClubs:\s*\[([\s\S]*?)\n\s*\]\s*\}", text)
    if not m:
        return []
    body = m.group(1)
    clubs = []
    for row in re.finditer(r"\{([^{}]+)\}", body):
        obj = {}
        for km in re.finditer(r'(\w+):(?:"((?:\\.|[^"])*)"|(\d+)|true|false)', row.group(1)):
            key = km.group(1)
            if km.group(2) is not None:
                obj[key] = km.group(2).encode("utf-8").decode("unicode_escape") if "\\" in km.group(2) else km.group(2)
            elif km.group(3) is not None:
                obj[key] = int(km.group(3))
        if "name" in obj:
            clubs.append(obj)
    return clubs


def js_str(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def write_clubs_js(polish_clubs: list[dict], foreign_clubs: list[dict], data_season: str) -> None:
    # sort: tier desc, region, name
    polish_clubs = sorted(
        polish_clubs, key=lambda c: (-c["tier"], c["region"], c["name"].lower())
    )
    lines = [
        "/*",
        " * Polski Piłkarz Simulator — dane klubów.",
        " * Kluby polskie: import z 90minut.pl (sezon " + data_season + ").",
        " * Kluby zagraniczne: zachowane z poprzedniej bazy gry.",
        " * Pola PL: name, region, tier (1-6, 6=Ekstraklasa), strength, opcjonalnie reserve,",
        " * sourceId (id klubu 90minut), league (nazwa rozgrywek).",
        " */",
        "",
        f"const REGION_NAMES = {json.dumps(REGION_NAMES, ensure_ascii=False)};",
        "",
        "const CLUBS = [",
    ]
    by_tier = defaultdict(list)
    for c in polish_clubs:
        by_tier[c["tier"]].append(c)

    tier_labels = {
        6: "Ekstraklasa",
        5: "I liga",
        4: "II liga",
        3: "III liga",
        2: "IV liga",
        1: "ligi regionalne (V liga / okręgówka / A–C)",
    }
    for tier in (6, 5, 4, 3, 2, 1):
        group = by_tier.get(tier, [])
        lines.append(f"  // {tier_labels[tier]} (tier {tier}, {len(group)} klubów)")
        for c in group:
            parts = [
                f"name:{js_str(c['name'])}",
                f"region:{js_str(c['region'])}",
                f"tier:{c['tier']}",
                f"strength:{c['strength']}",
            ]
            if c.get("reserve"):
                parts.append("reserve:true")
            if c.get("sourceId"):
                parts.append(f"sourceId:{c['sourceId']}")
            if c.get("league"):
                parts.append(f"league:{js_str(c['league'])}")
            lines.append(f"  {{{','.join(parts)}}},")
        lines.append("")
    lines.append("];")
    lines.append("")
    lines.append("const GAME_DATA = {")
    lines.append(
        "  regions: Object.fromEntries(REGION_NAMES.map(region => [region, CLUBS.filter(c => c.region === region)])),"
    )
    lines.append(
        '  tierNames: {1:"ligi regionalne",2:"IV liga",3:"III liga",4:"II liga",5:"I liga",6:"Ekstraklasa"},'
    )
    lines.append('  tier7: "klub zagraniczny",')
    lines.append('  tier8: "czołowy klub zagraniczny",')
    lines.append(f'  dataSeason: "{data_season}",')
    lines.append('  source: "90minut.pl",')
    lines.append("  foreignClubs: [")
    for c in foreign_clubs:
        parts = [
            f'name:{js_str(c["name"])}',
            f'country:{js_str(c.get("country",""))}',
            f'foreignTier:{c.get("foreignTier",6)}',
            f'tier:{c.get("tier",4)}',
            f'strength:{c.get("strength",40)}',
            f'league:{js_str(c.get("league",""))}',
            f'zone:{js_str(c.get("zone",""))}',
            f'marketRegion:{js_str(c.get("marketRegion",""))}',
        ]
        lines.append(f"    {{{','.join(parts)}}},")
    lines.append("  ]")
    lines.append("};")
    lines.append("")
    (ROOT / "js" / "08-polska-kariera-kluby.js").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_names_js(players: list[dict]) -> None:
    polish = [p for p in players if p.get("polish")]
    names = sorted({p["name"] for p in polish if " " in p["name"]})
    # Preferuj rozsądną pulę: pełne imię+nazwisko, bez zbyt egzotycznych
    filtered = [n for n in names if 5 <= len(n) <= 36 and re.search(r"[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]", n)]
    rng = random.Random(90)
    if len(filtered) > 400:
        filtered = sorted(rng.sample(filtered, 400))
    elif len(filtered) < 40:
        # fallback: dołącz wszystkie unikalne
        filtered = names[:400]

    lines = [
        "/*",
        " * Polska Kariera — pula imion i nazwisk z kadr 90minut.pl",
        " * (Ekstraklasa / I / II / III liga, sezon 2026/27, zawodnicy z flagą Polska).",
        " */",
        "",
        "(function () {",
        "  window.POLISH_PLAYER_NAMES = Object.freeze([",
    ]
    for i in range(0, len(filtered), 4):
        chunk = filtered[i : i + 4]
        lines.append("    " + ",".join(js_str(n) for n in chunk) + ",")
    lines.append("  ]);")
    lines.append("})();")
    lines.append("")
    (ROOT / "js" / "08b-polskie-imiona.js").write_text("\n".join(lines) + "\n", encoding="utf-8")


def merge_existing_regions(clubs: list[dict]) -> None:
    """Uzupełnij region klubów centralnych z poprzedniej bazy po nazwie."""
    path = ROOT / "js" / "08-polska-kariera-kluby.js"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    old = {}
    for m in re.finditer(
        r'\{name:"((?:\\.|[^"])*)",region:"((?:\\.|[^"])*)",tier:(\d+)', text
    ):
        old[m.group(1)] = m.group(2)
    for c in clubs:
        if c.get("region"):
            continue
        if c["name"] in old:
            c["region"] = old[c["name"]]
            continue
        # fuzzy: bez II / rezerw
        base = re.sub(r"\s+II\b.*$", "", c["name"]).strip()
        if base in old:
            c["region"] = old[base]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-players", action="store_true")
    parser.add_argument("--players-only", action="store_true")
    parser.add_argument("--max-regional", type=int, default=0, help="limit regional leagues (debug)")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    leagues: list[dict] = []
    clubs_by_id: dict[int, dict] = {}
    players: list[dict] = []

    if not args.players_only:
        print("== Centralne rozgrywki ==")
        for conf in CENTRAL:
            liga_url = f"{BASE}/liga/1/liga{conf['liga_id']}.html"
            print(f"  {conf['name']} -> {liga_url}")
            html = fetch(liga_url)
            parsed = parse_clubs_from_liga(html)
            if conf.get("skarb_id") and len(parsed) < 10:
                html2 = fetch(f"{BASE}/skarb.php?id_rozgrywki={conf['skarb_id']}")
                parsed = parse_skarb_clubs(html2) or parsed
            leagues.append(
                {
                    "id": conf["liga_id"],
                    "name": conf["name"],
                    "url": f"/liga/1/liga{conf['liga_id']}.html",
                    "tier": conf["tier"],
                    "level": conf["name"],
                    "region": conf.get("region"),
                    "central": True,
                    "clubCount": len(parsed),
                }
            )
            for idx, club in enumerate(parsed):
                region = guess_region_from_name(club["name"])
                entry = {
                    "id": club["id"],
                    "name": club["name"],
                    "tier": conf["tier"],
                    "league": conf["name"],
                    "leagueId": conf["liga_id"],
                    "region": region,
                    "tableIndex": idx,
                    "tableSize": len(parsed),
                    "reserve": is_reserve(club["name"]),
                    "source": "90minut.pl",
                }
                # wyższy poziom nadpisuje niższy przy dubletach
                prev = clubs_by_id.get(club["id"])
                if not prev or entry["tier"] > prev["tier"]:
                    clubs_by_id[club["id"]] = entry

        print("== Regionalne ZPN ==")
        regional = discover_regional_leagues()
        if args.max_regional:
            regional = regional[: args.max_regional]
        print(f"  znaleziono {len(regional)} lig regionalnych")
        for i, lg in enumerate(regional, 1):
            if i % 25 == 0 or i == 1:
                print(f"  [{i}/{len(regional)}] {lg['region']}: {lg['name']}")
            html = fetch(f"{BASE}{lg['url']}")
            parsed = parse_clubs_from_liga(html)
            lg["clubCount"] = len(parsed)
            leagues.append(lg)
            for idx, club in enumerate(parsed):
                entry = {
                    "id": club["id"],
                    "name": club["name"],
                    "tier": lg["tier"],
                    "league": lg["name"],
                    "leagueId": lg["id"],
                    "region": lg["region"],
                    "tableIndex": idx,
                    "tableSize": len(parsed),
                    "reserve": is_reserve(club["name"]),
                    "source": "90minut.pl",
                }
                prev = clubs_by_id.get(club["id"])
                if not prev or entry["tier"] > prev["tier"]:
                    clubs_by_id[club["id"]] = entry
                elif prev and not prev.get("region") and entry.get("region"):
                    prev["region"] = entry["region"]

        clubs = list(clubs_by_id.values())
        merge_existing_regions(clubs)
        for c in clubs:
            if not c.get("region"):
                c["region"] = guess_region_from_name(c["name"], "Mazowieckie") or "Mazowieckie"
            c["strength"] = strength_for(c["tier"], c.get("tableIndex", 0), max(1, c.get("tableSize", 1)))

        (OUT / "leagues.json").write_text(
            json.dumps(leagues, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (OUT / "clubs.json").write_text(
            json.dumps(sorted(clubs, key=lambda c: (-c["tier"], c["region"], c["name"])), ensure_ascii=False, indent=2)
            + "\n",
            encoding="utf-8",
        )
        print(f"Kluby: {len(clubs)}")
        print("Po tierach:", dict(Counter(c["tier"] for c in clubs)))
    else:
        clubs = json.loads((OUT / "clubs.json").read_text(encoding="utf-8"))

    if not args.skip_players:
        print("== Kadry (Ekstraklasa–III liga) ==")
        central_clubs = [c for c in clubs if c["tier"] >= 3]
        for i, club in enumerate(central_clubs, 1):
            if i % 20 == 0 or i == 1:
                print(f"  [{i}/{len(central_clubs)}] {club['name']}")
            url = f"{BASE}/kadra.php?id_sezon={SEASON_ID}&jesien=1&id_klub={club['id']}"
            try:
                html = fetch(url)
            except Exception as exc:
                print(f"  ! kadra fail {club['name']}: {exc}")
                continue
            players.extend(parse_players_from_kadra(html, club["id"], club["name"]))

        # dedupe players by id
        uniq = {}
        for p in players:
            uniq[p["id"]] = p
        players = list(uniq.values())
        (OUT / "players.json").write_text(
            json.dumps(players, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"Piłkarze: {len(players)} (PL: {sum(1 for p in players if p.get('polish'))})")
    else:
        players = []
        if (OUT / "players.json").exists():
            players = json.loads((OUT / "players.json").read_text(encoding="utf-8"))

    meta = {
        "source": "http://www.90minut.pl",
        "season": "2026/2027",
        "seasonId": SEASON_ID,
        "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "leagues": len(json.loads((OUT / "leagues.json").read_text())) if (OUT / "leagues.json").exists() else 0,
        "clubs": len(clubs),
        "players": len(players),
        "tierMap": {
            "6": "Ekstraklasa",
            "5": "I liga",
            "4": "II liga",
            "3": "III liga",
            "2": "IV liga",
            "1": "V liga / klasa okręgowa / A–C",
        },
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("== Generowanie JS ==")
    foreign = load_existing_foreign_clubs()
    print(f"  foreign clubs retained: {len(foreign)}")
    game_clubs = []
    for c in clubs:
        game_clubs.append(
            {
                "name": c["name"],
                "region": c["region"],
                "tier": c["tier"],
                "strength": c["strength"],
                "reserve": bool(c.get("reserve")),
                "sourceId": c["id"],
                "league": c.get("league"),
            }
        )
    write_clubs_js(game_clubs, foreign, "2026/27")
    if players:
        write_names_js(players)
    print("OK")


if __name__ == "__main__":
    main()
