/*
 * Lab — katalog atrybutów, pogody, zdarzeń losowych i odblokowań akcji.
 * Wariant testowy: nie zależy od NSS, tylko od własnego silnika.
 */
(function (global) {
  'use strict';

  const ATTR_GROUPS = [
    {
      id: 'skills',
      name: 'Umiejętności',
      attrs: [
        ['shooting', 'Strzały', 'Celność i moc zakończenia akcji'],
        ['heading', 'Główki', 'Gra powietrzna i dośrodkowania głową'],
        ['dribbling', 'Drybling', 'Prowadzenie piłki 1v1'],
        ['setPiece', 'Stałe fragmenty', 'Rzuty wolne, rożne, karne'],
        ['tackling', 'Odbiór', 'Przejmowanie piłki'],
        ['passing', 'Podania', 'Krótkie i średnie podania']
      ]
    },
    {
      id: 'technique',
      name: 'Technika',
      attrs: [
        ['flair', 'Fantazja', 'Niekonwencjonalne rozwiązania'],
        ['control', 'Przyjęcie', 'Pierwszy kontakt'],
        ['bothFeet', 'Obunożność', 'Gra słabszą nogą']
      ]
    },
    {
      id: 'fitness',
      name: 'Kondycja',
      attrs: [
        ['pace', 'Szybkość', 'Prędkość maksymalna'],
        ['acceleration', 'Przyspieszenie', 'Pierwsze metry'],
        ['strength', 'Siła', 'Pojedynki bark w bark'],
        ['stamina', 'Wytrzymałość', 'Spadek formy w końcówce']
      ]
    },
    {
      id: 'mental',
      name: 'Mental',
      attrs: [
        ['positioning', 'Ustawianie', 'Zajmowanie przestrzeni'],
        ['vision', 'Wizja', 'Czytanie gry i podania kluczowe'],
        ['composure', 'Opanowanie', 'Decyzje pod presją'],
        ['aggression', 'Agresja', 'Intensywność odbioru'],
        ['workRate', 'Pracowitość', 'Pressing i powroty']
      ]
    }
  ];

  const ATTR_KEYS = ATTR_GROUPS.flatMap((g) => g.attrs.map((a) => a[0]));
  const ATTR_LABELS = Object.fromEntries(ATTR_GROUPS.flatMap((g) => g.attrs.map((a) => [a[0], a[1]])));

  const SOFT_KEYS = ['form', 'morale', 'confidence', 'fatigue', 'chemistry', 'focus'];

  const POSITION_BASE = {
    DEF: { shooting: 28, heading: 55, dribbling: 35, setPiece: 30, tackling: 58, passing: 42, flair: 28, control: 40, bothFeet: 35, pace: 45, acceleration: 44, strength: 55, stamina: 50, positioning: 55, vision: 38, composure: 42, aggression: 52, workRate: 50 },
    MID: { shooting: 42, heading: 38, dribbling: 48, setPiece: 45, tackling: 42, passing: 55, flair: 45, control: 50, bothFeet: 42, pace: 48, acceleration: 48, strength: 42, stamina: 55, positioning: 48, vision: 55, composure: 48, aggression: 40, workRate: 55 },
    FWD: { shooting: 58, heading: 48, dribbling: 52, setPiece: 40, tackling: 28, passing: 38, flair: 48, control: 52, bothFeet: 40, pace: 55, acceleration: 55, strength: 48, stamina: 48, positioning: 52, vision: 40, composure: 50, aggression: 42, workRate: 45 }
  };

  const WEATHER = [
    {
      id: 'sunny',
      label: 'Słonecznie',
      icon: '☀',
      weight: 28,
      mods: { morale: 2, confidence: 1, stamina: 0 },
      attrMods: {},
      injury: 0,
      note: 'Lekki bonus do morale.'
    },
    {
      id: 'cloudy',
      label: 'Pochmurno',
      icon: '☁',
      weight: 22,
      mods: {},
      attrMods: {},
      injury: 0,
      note: 'Warunki neutralne.'
    },
    {
      id: 'rain',
      label: 'Deszcz',
      icon: '🌧',
      weight: 18,
      mods: { focus: -2 },
      attrMods: { control: -8, dribbling: -6, pace: -4, tackling: 3, shooting: -3 },
      injury: 3,
      note: 'Śliska murawa: trudniejsze prowadzenie, łatwiejsze wślizgi.'
    },
    {
      id: 'wind',
      label: 'Wiatr',
      icon: '🌬',
      weight: 12,
      mods: { focus: -1 },
      attrMods: { shooting: -7, setPiece: -10, passing: -5, vision: -3 },
      injury: 1,
      note: 'Długie piłki i stałe fragmenty cierpią.'
    },
    {
      id: 'heat',
      label: 'Upał',
      icon: '🌡',
      weight: 8,
      mods: { fatigue: 8, morale: -2 },
      attrMods: { stamina: -10, pace: -3, acceleration: -3, strength: -2 },
      injury: 4,
      note: 'Szybsze męczenie się w drugiej połowie.'
    },
    {
      id: 'snow',
      label: 'Śnieg',
      icon: '❄',
      weight: 6,
      mods: { fatigue: 5, morale: -1 },
      attrMods: { pace: -10, acceleration: -8, dribbling: -5, control: -4, stamina: -6 },
      injury: 7,
      note: 'Ciężkie warunki, wyższe ryzyko kontuzji.'
    },
    {
      id: 'fog',
      label: 'Mgła',
      icon: '🌫',
      weight: 4,
      mods: { focus: -4, confidence: -2 },
      attrMods: { vision: -12, positioning: -8, passing: -4 },
      injury: 1,
      note: 'Trudniej czytać grę i ustawienie.'
    },
    {
      id: 'mud',
      label: 'Błoto',
      icon: '🦶',
      weight: 2,
      mods: { fatigue: 6 },
      attrMods: { pace: -8, dribbling: -7, control: -5, strength: 5, stamina: -8 },
      injury: 5,
      note: 'Siła zyskuje, technika traci.'
    }
  ];

  const SEASON_EVENTS = [
    { id: 'gym_boost', title: 'Dobry cykl siłowy', text: 'Trener przygotowania fizycznego chwali twoją pracę.', weight: 10, effects: { strength: 2, stamina: 1, fatigue: -5 } },
    { id: 'media_storm', title: 'Afera medialna', text: 'Plotka o wyjściu klubowym krąży w sieci.', weight: 7, effects: { morale: -8, confidence: -4, focus: -3 } },
    { id: 'family_visit', title: 'Rodzina na trybunach', text: 'Bliscy przyjechali na mecz. Czujesz wsparcie.', weight: 9, effects: { morale: 6, confidence: 3 } },
    { id: 'tactical_talk', title: 'Indywidualna rozmowa', text: 'Trener rozrysowuje tobie rolę w pressingu.', weight: 10, effects: { positioning: 2, vision: 1, workRate: 1, chemistry: 4 } },
    { id: 'ankle_knock', title: 'Uderzenie w kostkę', text: 'Trening kończysz z lekkim urazem.', weight: 8, effects: { pace: -2, acceleration: -2, fatigue: 10 }, injuryDays: [3, 10] },
    { id: 'sponsor_day', title: 'Dzień sponsora', text: 'Sesja zdjęciowa i spotkanie z partnerami klubu.', weight: 6, effects: { morale: 2, focus: -2, fatigue: 3 } },
    { id: 'rival_taunt', title: 'Prowokacja rywala', text: 'Przed derbami ktoś próbuje cię zagrać psychologicznie.', weight: 7, effects: { aggression: 3, composure: -2, confidence: 1 } },
    { id: 'night_out', title: 'Wyjście z szatnią', text: 'Integracja po meczu — raz na jakiś czas.', weight: 5, effects: { chemistry: 5, fatigue: 6, focus: -3 }, choices: [
      { label: 'Wracam wcześnie', effects: { chemistry: 2, fatigue: 1 } },
      { label: 'Zostaję dłużej', effects: { chemistry: 7, fatigue: 10, morale: 3, focus: -5 } }
    ]},
    { id: 'video_analysis', title: 'Analiza wideo', text: 'Oglądacie nagrania twoich decyzji przy piłce.', weight: 11, effects: { composure: 2, vision: 1, passing: 1 } },
    { id: 'fan_gift', title: 'Prezent od kibiców', text: 'Szalik i list od grupy młodzików.', weight: 6, effects: { morale: 5, confidence: 2 } },
    { id: 'coach_bench', title: 'Ławka w sparingu', text: 'W środku tygodnia grasz tylko 20 minut.', weight: 8, effects: { fatigue: -8, morale: -3, form: -2 } },
    { id: 'extra_shooting', title: 'Dodatkowe strzały', text: 'Zostajesz po treningu na wykończenie.', weight: 10, effects: { shooting: 2, composure: 1, fatigue: 4 } },
    { id: 'sleep_poor', title: 'Bezsenna noc', text: 'Hotel, hałas, stres przed wyjazdem.', weight: 8, effects: { focus: -6, fatigue: 5, form: -2 } },
    { id: 'new_boots', title: 'Nowe buty', text: 'Testujesz model pod twarde podłoże.', weight: 5, effects: { pace: 1, dribbling: 1, confidence: 2 } },
    { id: 'argument', title: 'Sprzeczka w szatni', text: 'Ostra wymiana zdań z kolegą z formacji.', weight: 6, effects: { chemistry: -8, aggression: 2, morale: -4 }, choices: [
      { label: 'Przepraszam publicznie', effects: { chemistry: 3, composure: 1, morale: 1 } },
      { label: 'Stoję przy swoim', effects: { confidence: 2, chemistry: -4, aggression: 1 } }
    ]}
  ];

  const MATCH_EVENTS = [
    { id: 'crowd_roar', minute: [1, 20], text: 'Trybuny wchodzą w mecz — czujesz adrenalizację.', effects: { confidence: 3, composure: -1 } },
    { id: 'early_foul', minute: [5, 25], text: 'Dostajesz ostre wejście. Sędzia gwiżdże.', effects: { fatigue: 4, aggression: 2 }, injuryChance: 0.08 },
    { id: 'coach_shout', minute: [30, 55], text: 'Trener krzyczy o wyższej pozycji.', effects: { positioning: 2, workRate: 2, focus: 1 } },
    { id: 'cramp', minute: [70, 88], text: 'Czujesz skurcz. Musisz ostrożniej dobierać akcje.', effects: { pace: -4, stamina: -3, fatigue: 8 } },
    { id: 'second_wind', minute: [60, 80], text: 'Łapiesz drugi oddech.', effects: { stamina: 3, confidence: 2, fatigue: -4 } },
    { id: 'ref_card', minute: [20, 75], text: 'Żółta kartka po spóźnionym odbiorze.', effects: { aggression: -2, composure: 1 }, yellow: true },
    { id: 'teammate_boost', minute: [15, 70], text: 'Kolega klepie cię po ramieniu: „Dawaj dalej”.', effects: { morale: 3, chemistry: 2 } }
  ];

  /** Akcje meczowe — odblokowania zależne od skilli (efektywnych). */
  const ACTIONS = [
    { id: 'pass', label: 'Podanie', group: 'base', needs: {}, desc: 'Bezpieczne podanie.' },
    { id: 'through', label: 'Podanie prostopadłe', group: 'pass', needs: { passing: 52, vision: 48 }, desc: 'Przecinasz linię obrony.' },
    { id: 'switch', label: 'Zmiana strony', group: 'pass', needs: { passing: 58, vision: 62 }, desc: 'Długie przełożenie gry.' },
    { id: 'shoot', label: 'Strzał', group: 'base', needs: {}, desc: 'Uderzenie na bramkę.', nearOnly: true },
    { id: 'powerShot', label: 'Strzał siłowy', group: 'shoot', needs: { shooting: 55, strength: 48 }, desc: 'Moc zamiast precyzji.', nearOnly: true },
    { id: 'placedShot', label: 'Strzał placé', group: 'shoot', needs: { shooting: 58, composure: 55 }, desc: 'Precyzyjne wykończenie.', nearOnly: true },
    { id: 'volley', label: 'Wolej / first time', group: 'shoot', needs: { shooting: 50, control: 58 }, desc: 'Bez przyjęcia.', nearOnly: true },
    { id: 'dribble', label: 'Drybling', group: 'base', needs: {}, desc: 'Spróbuj minąć rywala.' },
    { id: 'paceBurst', label: 'Wybuch szybkości', group: 'dribble', needs: { pace: 58, acceleration: 55 }, desc: 'Idziesz na tempo.' },
    { id: 'nutmeg', label: 'Tunnel', group: 'dribble', needs: { flair: 55, dribbling: 52 }, desc: 'Między nogami.' },
    { id: 'cruyff', label: 'Zwód Cruyffa', group: 'dribble', needs: { flair: 60, dribbling: 55 }, desc: 'Odwrócenie kierunku.' },
    { id: 'holdUp', label: 'Przytrzymaj', group: 'base', needs: { strength: 45, composure: 45 }, desc: 'Osłoń piłkę i poczekaj.' },
    { id: 'tackle', label: 'Odbiór', group: 'def', needs: {}, desc: 'Czysty odbiór.', defending: true },
    { id: 'aggTackle', label: 'Agresywny wślizg', group: 'def', needs: { tackling: 50, aggression: 55 }, desc: 'Ryzyko kartki.', defending: true },
    { id: 'header', label: 'Główka', group: 'air', needs: { heading: 50 }, desc: 'Pojedynek powietrzny.', aerial: true },
    { id: 'setPiece', label: 'Stały fragment', group: 'set', needs: { setPiece: 48 }, desc: 'Wykonaj RZ / rożny.', setPiece: true },
    { id: 'weakFoot', label: 'Słabsza noga', group: 'shoot', needs: { bothFeet: 50, shooting: 45 }, desc: 'Bez dużej kary.', nearOnly: true },
    { id: 'delay', label: 'Spowolnij grę', group: 'mental', needs: { composure: 60, vision: 45 }, desc: 'Uspokój akcję pod presją.' }
  ];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function pickWeighted(items, rng = Math.random) {
    const total = items.reduce((s, it) => s + (it.weight || 1), 0);
    let r = rng() * total;
    for (const it of items) {
      r -= it.weight || 1;
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  function baseAttrsFor(position, overall) {
    const template = POSITION_BASE[position] || POSITION_BASE.MID;
    const ovr = clamp(overall || 45, 20, 95);
    const scale = (ovr - 45) * 0.55;
    const out = {};
    ATTR_KEYS.forEach((k) => {
      out[k] = clamp(Math.round((template[k] || 40) + scale + (Math.random() * 4 - 2)), 15, 92);
    });
    return out;
  }

  function softDefaults() {
    return { form: 50, morale: 55, confidence: 50, fatigue: 10, chemistry: 50, focus: 55 };
  }

  function overallFromAttrs(attrs) {
    const keys = ATTR_KEYS;
    const sum = keys.reduce((s, k) => s + (attrs[k] || 40), 0);
    return clamp(Math.round(sum / keys.length), 20, 99);
  }

  function applyWeather(attrs, soft, weather) {
    const a = { ...attrs };
    const s = { ...soft };
    Object.entries(weather.attrMods || {}).forEach(([k, v]) => {
      if (k in a) a[k] = clamp(a[k] + v, 1, 99);
    });
    Object.entries(weather.mods || {}).forEach(([k, v]) => {
      if (k in s) s[k] = clamp(s[k] + v, 0, 100);
    });
    return { attrs: a, soft: s };
  }

  function applyEffects(attrs, soft, effects = {}) {
    const a = { ...attrs };
    const s = { ...soft };
    Object.entries(effects).forEach(([k, v]) => {
      if (ATTR_KEYS.includes(k)) a[k] = clamp((a[k] || 40) + v, 1, 99);
      else if (SOFT_KEYS.includes(k)) s[k] = clamp((s[k] || 50) + v, 0, 100);
    });
    return { attrs: a, soft: s };
  }

  function meetsNeeds(attrs, needs = {}) {
    return Object.entries(needs).every(([k, min]) => (attrs[k] || 0) >= min);
  }

  function availableActions(attrs, ctx = {}) {
    return ACTIONS.filter((act) => {
      if (!meetsNeeds(attrs, act.needs)) return false;
      if (act.defending && !ctx.defending) return false;
      if (!act.defending && act.group === 'def') return false;
      if (act.nearOnly && !(ctx.distance <= 28)) return false;
      if (act.aerial && !ctx.aerial) return false;
      if (act.setPiece && !ctx.setPiece) return false;
      if (ctx.defending && !act.defending) return false;
      if (!ctx.defending && act.defending) return false;
      if (ctx.setPiece && !act.setPiece && act.id !== 'pass') return false;
      return true;
    });
  }

  function lockedActions(attrs, ctx = {}) {
    return ACTIONS.filter((act) => {
      if (meetsNeeds(attrs, act.needs)) return false;
      if (act.defending && !ctx.defending) return false;
      if (act.nearOnly && !(ctx.distance <= 28)) return false;
      if (act.aerial && !ctx.aerial) return false;
      if (act.setPiece && !ctx.setPiece) return false;
      return Object.keys(act.needs || {}).length > 0;
    }).map((act) => ({
      ...act,
      missing: Object.entries(act.needs)
        .filter(([k, min]) => (attrs[k] || 0) < min)
        .map(([k, min]) => `${ATTR_LABELS[k]} ${attrs[k] || 0}/${min}`)
    }));
  }

  function rollWeather(rng = Math.random, month = 8) {
    // zima częściej śnieg, lato upał
    const pool = WEATHER.map((w) => {
      let weight = w.weight;
      if (month <= 2 || month === 12) {
        if (w.id === 'snow') weight *= 4;
        if (w.id === 'heat') weight *= 0.1;
      }
      if (month >= 6 && month <= 8) {
        if (w.id === 'heat') weight *= 3;
        if (w.id === 'snow') weight *= 0.05;
      }
      if (month >= 9 && month <= 11) {
        if (w.id === 'rain' || w.id === 'wind' || w.id === 'mud') weight *= 1.4;
      }
      return { ...w, weight };
    });
    return pickWeighted(pool, rng);
  }

  global.LabData = Object.freeze({
    ATTR_GROUPS,
    ATTR_KEYS,
    ATTR_LABELS,
    SOFT_KEYS,
    WEATHER,
    SEASON_EVENTS,
    MATCH_EVENTS,
    ACTIONS,
    clamp,
    pickWeighted,
    baseAttrsFor,
    softDefaults,
    overallFromAttrs,
    applyWeather,
    applyEffects,
    meetsNeeds,
    availableActions,
    lockedActions,
    rollWeather
  });
})(typeof window !== 'undefined' ? window : globalThis);
