/**
 * CareerLife — warstwa Copero (gazeta, tempo helpers, karta share)
 * + NSS (relacje, energia, międzysezon).
 * Core woła API; host: window.CareerLifeHost { getState, els, render, log, clamp, rand, pick }.
 */
(function (global) {
  'use strict';

  const PACE_EVERY = { intense: 1, normal: 2, express: 3 };

  function paceEvery(pace) {
    return PACE_EVERY[pace] || 2;
  }

  function defaultRelations() {
    return { coach: 55, squad: 50, fans: 45, agent: 40 };
  }

  function clampRel(v) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  function ensureLifeState(state) {
    if (!state) return;
    if (!state.relations) state.relations = defaultRelations();
    ['coach', 'squad', 'fans', 'agent'].forEach((k) => {
      state.relations[k] = clampRel(state.relations[k] ?? defaultRelations()[k]);
    });
    if (!Number.isFinite(state.energy)) state.energy = 2;
    if (!Array.isArray(state.headlines)) state.headlines = [];
    if (!Array.isArray(state.lifeLog)) state.lifeLog = [];
    if (!Number.isFinite(state.seasonsSinceDecision)) state.seasonsSinceDecision = 0;
    if (!state.careerPace) state.careerPace = 'normal';
    if (!Number.isFinite(state.decisionEvery)) state.decisionEvery = paceEvery(state.careerPace);
  }

  /** Modyfikator % do projectedStartChance z relacji z trenerem. */
  function playChanceMod(state) {
    ensureLifeState(state);
    const c = state.relations.coach;
    if (c >= 75) return 4;
    if (c >= 60) return 2;
    if (c <= 25) return -6;
    if (c <= 40) return -3;
    return 0;
  }

  /** Bonus % szansy na lepszą ofertę rynku (agent). */
  function marketAgentBonus(state) {
    ensureLifeState(state);
    const a = state.relations.agent;
    if (a >= 75) return 18;
    if (a >= 60) return 10;
    if (a <= 30) return -8;
    return 0;
  }

  function syncSoftFromRelations(state) {
    ensureLifeState(state);
    if (!state.soft) return;
    const s = state.relations.squad;
    const f = state.relations.fans;
    // lekki dryf chemii / morale w stronę relacji
    state.soft.chemistry = clampRel(
      (state.soft.chemistry || 50) * 0.85 + s * 0.15
    );
    if (f >= 70) state.soft.morale = clampRel((state.soft.morale || 55) + 2);
    if (f <= 30) state.soft.morale = clampRel((state.soft.morale || 55) - 2);
  }

  function buildSeasonHeadlines(state, ctx) {
    ensureLifeState(state);
    const {
      apps = 0,
      goals = 0,
      assists = 0,
      formLabel = '',
      gradeLabel = '',
      injuryText = '',
      clubName = state.club?.name || 'Klub',
      seasonNotes = [],
      nationalCaps = 0
    } = ctx || {};
    const lines = [];

    if (goals >= 15) {
      lines.push(`${clubName}: ${goals} goli — snajper sezonu na ustach wszystkich.`);
    } else if (goals >= 8) {
      lines.push(`${state.name} kończy sezon z ${goals} golami. Scouty notują.`);
    } else if (apps >= 30 && goals + assists <= 2 && state.position !== 'DEF') {
      lines.push(`Dużo minut, mało liczb. ${state.name} grał, ale bez fajerwerków.`);
    }

    if (assists >= 10) {
      lines.push(`Asysty jak z automatu: ${assists}. Kolega z linii ataku dziękuje.`);
    }

    if (formLabel && /KRYZYS|SŁABA|CRISIS/i.test(formLabel)) {
      lines.push(`Kryzys formy w ${clubName}. Kibice gwizdali, trener milczał.`);
    } else if (formLabel && /ŚWIETNA|REWELACYJNA|CAREER|WYBITNA/i.test(formLabel)) {
      lines.push(`Sezon życia? Dyspozycja: ${formLabel}. ${gradeLabel || ''}`.trim());
    }

    if (injuryText && /URAZ|KONTUZJ|WIĘZAD/i.test(injuryText)) {
      lines.push(`Lazaret: ${injuryText.replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]*/i, '').slice(0, 90)}`);
    }

    if (nationalCaps > 0) {
      lines.push(`Kadra Polski: ${nationalCaps} występ${nationalCaps === 1 ? '' : 'ów'} w sezonie.`);
    }

    if (seasonNotes && seasonNotes.length) {
      lines.push(String(seasonNotes[0]).slice(0, 110));
    }

    const fans = state.relations.fans;
    if (fans >= 80 && apps >= 20) {
      lines.push(`Ulubieniec trybun. Szaliki z nazwiskiem ${state.name.split(' ').pop()} już wiszą.`);
    } else if (fans <= 25 && apps >= 15) {
      lines.push(`Relacja z kibicami na lodzie. Gwiazdy przy wejściu bolą bardziej niż uraz.`);
    }

    if (gradeLabel) {
      lines.push(`Ocena sezonu: ${gradeLabel}. ${apps} M / ${goals} G / ${assists} A.`);
    }

    // dedupe + max 3
    const uniq = [];
    for (const line of lines) {
      const t = (line || '').trim();
      if (!t) continue;
      if (uniq.some((u) => u.slice(0, 40) === t.slice(0, 40))) continue;
      uniq.push(t);
      if (uniq.length >= 3) break;
    }
    if (!uniq.length) {
      uniq.push(`${clubName}: ${apps} meczów, ${goals} goli, ${assists} asyst. Kolejny rozdział.`);
      uniq.push(`Dyspozycja: ${formLabel || 'NORMALNA'}. Życie toczy się dalej.`);
    }
    state.headlines = uniq.slice();
    return uniq;
  }

  function newspaperHtml(headlines, meta) {
    const { formLabel = '', kicker = 'KONIEC SEZONU', lead = '', detailHtml = '' } = meta || {};
    const list = (headlines || [])
      .map((h, i) => `<li class="newspaper-line${i === 0 ? ' newspaper-line--lead' : ''}">${h}</li>`)
      .join('');
    return `<div class="newspaper">
      <div class="newspaper-masthead">SPORT PIXEL</div>
      <div class="event-kicker">${kicker}${formLabel ? ` • ${formLabel}` : ''}</div>
      <ul class="newspaper-list">${list}</ul>
      ${lead ? `<p class="newspaper-lead">${lead}</p>` : ''}
      ${detailHtml}
    </div>`;
  }

  const LIFE_ACTIONS = [
    {
      key: 'train',
      label: 'TRENING',
      blurb: '+OVR / skille • +ryzyko urazu • trener +'
    },
    {
      key: 'rest',
      label: 'ODPOCZYNEK',
      blurb: '−uraz • −zmęczenie • morale +'
    },
    {
      key: 'coach',
      label: 'ROZMOWA Z TRENEREM',
      blurb: 'relacja trener + • hierarchia +'
    },
    {
      key: 'squad',
      label: 'WIECZÓR SZATNI',
      blurb: 'szatnia +/− • chemia • ryzyko skandalu'
    },
    {
      key: 'media',
      label: 'MEDIA / KIBICE',
      blurb: 'kibice + • medialność + • fokus −'
    }
  ];

  function applyLifeAction(state, key, helpers) {
    ensureLifeState(state);
    const { clamp, rand, log } = helpers;
    const rel = state.relations;
    let title = '';
    let meta = '';

    if (key === 'train') {
      const before = state.overall;
      const gain = rand(0, 100) <= 55 ? 1 : 0;
      if (gain) {
        state.overall = before + 1;
        if (state.attrs && global.LabData) {
          const keys = Object.keys(state.attrs);
          const k = keys[rand(0, keys.length - 1)];
          state.attrs[k] = clamp((state.attrs[k] || 40) + rand(1, 2), 1, 99);
          state.overall = global.LabData.overallFromAttrs(state.attrs);
        }
      }
      state.injuryRisk = clamp(state.injuryRisk + rand(1, 3), 5, 45);
      rel.coach = clampRel(rel.coach + rand(1, 3));
      if (state.soft) state.soft.fatigue = clampRel((state.soft.fatigue || 10) + 8);
      title = 'Międzysezon: trening';
      meta = gain
        ? `OVR ${before} → ${state.overall} • uraz ${state.injuryRisk}% • trener ${rel.coach}`
        : `Bez skoku OVR, ale robota zrobiona • uraz ${state.injuryRisk}% • trener ${rel.coach}`;
    } else if (key === 'rest') {
      state.injuryRisk = clamp(state.injuryRisk - rand(2, 5), 5, 45);
      if (state.soft) {
        state.soft.fatigue = clampRel((state.soft.fatigue || 10) - 15);
        state.soft.morale = clampRel((state.soft.morale || 55) + 4);
      }
      title = 'Międzysezon: odpoczynek';
      meta = `Regeneracja • uraz ${state.injuryRisk}%`;
    } else if (key === 'coach') {
      rel.coach = clampRel(rel.coach + rand(4, 8));
      state.boost = (state.boost || 0) + 1;
      title = 'Międzysezon: rozmowa z trenerem';
      meta = `Trener ${rel.coach} • hierarchia +1`;
    } else if (key === 'squad') {
      const roll = rand(1, 100);
      if (roll <= 70) {
        rel.squad = clampRel(rel.squad + rand(3, 7));
        if (state.soft) state.soft.chemistry = clampRel((state.soft.chemistry || 50) + 5);
        title = 'Międzysezon: szatnia OK';
        meta = `Integracja wyszła • szatnia ${rel.squad}`;
      } else {
        rel.squad = clampRel(rel.squad - rand(2, 6));
        rel.fans = clampRel(rel.fans - rand(0, 4));
        if (state.soft) state.soft.chemistry = clampRel((state.soft.chemistry || 50) - 4);
        title = 'Międzysezon: szatnia — aferka';
        meta = `Ktoś nagrał filmik • szatnia ${rel.squad}`;
        state.headlines = state.headlines || [];
        state.headlines.unshift(`Afera szatniowa wokół ${state.name}. Klub milczy.`);
        state.headlines = state.headlines.slice(0, 5);
      }
    } else if (key === 'media') {
      rel.fans = clampRel(rel.fans + rand(4, 9));
      const before = state.recognition || 0;
      state.recognition = clamp(before + rand(3, 7), 0, 100);
      if (state.soft) state.soft.focus = clampRel((state.soft.focus || 55) - 5);
      rel.agent = clampRel(rel.agent + rand(1, 3));
      title = 'Międzysezon: media';
      meta = `Kibice ${rel.fans} • medialność ${before} → ${state.recognition}`;
    } else {
      return applyLifeAction(state, 'rest', helpers);
    }

    state.lifeLog.push({ age: state.age, key, title, meta });
    if (log) log(title, meta);
    syncSoftFromRelations(state);
    return { title, meta };
  }

  function presentLifePhase(onDone) {
    const host = global.CareerLifeHost;
    if (!host || !host.getState) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    const state = host.getState();
    const { els, render, log, clamp, rand } = host;
    if (!state || state.retired) {
      if (typeof onDone === 'function') onDone();
      return;
    }
    ensureLifeState(state);
    state.energy = 2;
    state.pendingDecision = true;
    els.playSeasonBtn.classList.add('hidden');
    els.decisionBox.classList.remove('hidden');
    els.decisionTitle.textContent = 'MIĘDZYSEZON · ŻYCIE';
    els.decisionText.textContent =
      'Masz 2 punkty energii. Trening, odpoczynek, trener, szatnia albo media — wybierz, zanim wystartuje nowy sezon.';

    const helpers = { clamp, rand, log };
    const picked = [];

    function finish() {
      while (state.energy > 0) {
        applyLifeAction(state, 'rest', helpers);
        state.energy--;
      }
      state.pendingDecision = false;
      els.decisionBox.classList.add('hidden');
      els.playSeasonBtn.classList.remove('hidden');
      if (render) render();
      if (typeof onDone === 'function') onDone();
    }

    function paint() {
      els.decisionText.innerHTML = `Energia: <strong>${state.energy}</strong> / 2${
        picked.length
          ? `<br><span class="muted">Zrobione: ${picked.join(' → ')}</span>`
          : ''
      }`;
      els.decisionChoices.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'life-actions';
      LIFE_ACTIONS.forEach((act) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice-btn';
        b.innerHTML = `<span class="choice-main">${act.label}</span><span class="choice-stake">${act.blurb}</span>`;
        b.disabled = state.energy <= 0;
        b.onclick = () => {
          if (state.energy <= 0) return;
          applyLifeAction(state, act.key, helpers);
          picked.push(act.label);
          state.energy--;
          if (render) render();
          if (state.energy <= 0) finish();
          else paint();
        };
        grid.appendChild(b);
      });
      els.decisionChoices.appendChild(grid);
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'ghost full';
      skip.textContent = state.energy >= 2 ? 'POMIŃ — SAM ODPOCZYNEK' : 'DALEJ (reszta = odpoczynek)';
      skip.onclick = finish;
      els.decisionChoices.appendChild(skip);
    }

    paint();
  }

  function pathTag(state) {
    ensureLifeState(state);
    const seasons = (state.careerSeasons || []).filter((s) => s.club && s.club !== 'Bez klubu');
    const clubs = new Set(seasons.map((s) => s.club)).size;
    const trophies = state.trophies?.length || 0;
    const loyalty = state.loyalty || 0;
    const longest = seasons.reduce((best, s, i, arr) => {
      let len = 1;
      while (i + len < arr.length && arr[i + len].club === s.club) len++;
      return len > best ? len : best;
    }, 0);

    if (loyalty >= 10 && clubs <= 3 && longest >= 8) return { key: 'loyal', label: 'ONE-CLUB / LOJALNOŚĆ' };
    if (trophies >= 5) return { key: 'glory', label: 'TROPHY HUNTER' };
    if (clubs >= 8) return { key: 'journeyman', label: 'OBIEŻYŚWIAT' };
    if ((state.recognition || 0) >= 70 && (state.highestTier || 0) <= 4) return { key: 'cult', label: 'CULT HERO' };
    if (clubs <= 2 && longest >= 6) return { key: 'loyal', label: 'KLUBOWY SYMBOL' };
    return { key: 'pro', label: 'ZAWODOWIEC' };
  }

  function exportShareCard(state) {
    ensureLifeState(state);
    const path = pathTag(state);
    const pixel = '"Jersey 10", "VT323", monospace';
    const body = '"VT323", "Jersey 10", monospace';

    const draw = () => {
      const w = 1080;
      const h = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#3d7eb8');
      grad.addColorStop(0.38, '#3d7eb8');
      grad.addColorStop(0.38, '#2f9b45');
      grad.addColorStop(1, '#17632a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#0b1420';
      ctx.fillRect(48, 80, w - 96, h - 160);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 8;
      ctx.strokeRect(48, 80, w - 96, h - 160);

      ctx.fillStyle = '#ffd23f';
      ctx.font = '32px ' + pixel;
      ctx.fillText('POLSKI PIŁKARZ', 88, 160);
      ctx.fillStyle = '#cfe8c4';
      ctx.font = '22px ' + pixel;
      ctx.fillText('CAREER CARD', 88, 200);

      ctx.fillStyle = '#ffffff';
      ctx.font = '40px ' + pixel;
      wrapText(ctx, state.name || 'Zawodnik', 88, 280, w - 200, 48);

      ctx.fillStyle = '#ffd23f';
      ctx.font = '24px ' + pixel;
      ctx.fillText(path.label, 88, 400);

      const stats = [
        `WIEK KOŃCA  ${state.age}`,
        `PEAK OVR    ${state.peakOverall || state.overall}`,
        `MECZE       ${state.totals?.apps || 0}`,
        `GOLE        ${state.totals?.goals || 0}`,
        `ASYSTY      ${state.totals?.assists || 0}`,
        `KADRA       ${state.nationalCaps || 0}`,
        `PUCHARY     ${state.trophies?.length || 0}`,
        `WYNIK       ${state.score || 0}`
      ];
      ctx.fillStyle = '#eef6ea';
      ctx.font = '24px ' + pixel;
      stats.forEach((line, i) => ctx.fillText(line, 88, 480 + i * 48));

      ctx.fillStyle = '#a8c8b0';
      ctx.font = '20px ' + pixel;
      ctx.fillText('KLUBY', 88, 920);
      ctx.fillStyle = '#ffffff';
      ctx.font = '26px ' + body;
      wrapText(ctx, (state.clubHistory || []).join(' → ') || '—', 88, 960, w - 200, 32);

      const headline = (state.headlines && state.headlines[0]) || '';
      if (headline) {
        ctx.fillStyle = '#ffd23f';
        ctx.font = '20px ' + pixel;
        ctx.fillText('OSTATNI NAGŁÓWEK', 88, 1180);
        ctx.fillStyle = '#eef6ea';
        ctx.font = '26px ' + body;
        wrapText(ctx, headline, 88, 1220, w - 200, 32);
      }

      ctx.fillStyle = '#cfe8c4';
      ctx.font = '24px ' + body;
      wrapText(ctx, state._shareVerdict || '', 88, 1400, w - 200, 30);

      ctx.fillStyle = '#ffd23f';
      ctx.font = '18px ' + pixel;
      ctx.fillText('v1.07 · PIXEL CAREER', 88, h - 120);

      const fname = `karta-${(state.name || 'pilkarz').replace(/\s+/g, '-').toLowerCase()}.png`;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = fname;
            a.click();
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fname;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        },
        'image/png'
      );
    };

    const loads = [];
    if (document.fonts && document.fonts.load) {
      loads.push(document.fonts.load('32px "Jersey 10"'));
      loads.push(document.fonts.load('26px "VT323"'));
    }
    Promise.all(loads)
      .catch(() => null)
      .then(draw);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(/\s+/);
    let line = '';
    let yy = y;
    for (let n = 0; n < words.length; n++) {
      const test = line ? line + ' ' + words[n] : words[n];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = words[n];
        yy += lineHeight;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  global.CareerLife = {
    paceEvery,
    defaultRelations,
    ensureLifeState,
    playChanceMod,
    marketAgentBonus,
    syncSoftFromRelations,
    buildSeasonHeadlines,
    newspaperHtml,
    LIFE_ACTIONS,
    applyLifeAction,
    presentLifePhase,
    pathTag,
    exportShareCard
  };
})(typeof window !== 'undefined' ? window : globalThis);
