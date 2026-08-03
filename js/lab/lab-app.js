/*
 * Lab — UI: setup skilli, sezon, decyzje meczowe.
 */
(function () {
  'use strict';

  const D = window.LabData;
  const $ = (s) => document.querySelector(s);
  const els = {
    setup: $('#labSetup'),
    play: $('#labPlay'),
    summary: $('#labSummary'),
    name: $('#labName'),
    position: $('#labPosition'),
    region: $('#labRegion'),
    start: $('#labStart'),
    points: $('#labPoints'),
    pointsLeft: $('#labPointsLeft'),
    attrEditor: $('#labAttrEditor'),
    softPreview: $('#labSoftPreview'),
    ovrPreview: $('#labOvrPreview'),
    startBtn: $('#labStartBtn'),
    resetBtn: $('#labResetBtn'),
    roundLabel: $('#labRoundLabel'),
    matchTitle: $('#labMatchTitle'),
    weather: $('#labWeather'),
    homeName: $('#labHomeName'),
    awayName: $('#labAwayName'),
    score: $('#labScore'),
    minute: $('#labMinute'),
    phase: $('#labPhase'),
    matchStats: $('#labMatchStats'),
    log: $('#labLog'),
    decision: $('#labDecision'),
    decisionText: $('#labDecisionText'),
    actions: $('#labActions'),
    locked: $('#labLocked'),
    seasonEvent: $('#labSeasonEvent'),
    eventTitle: $('#labEventTitle'),
    eventText: $('#labEventText'),
    eventChoices: $('#labEventChoices'),
    tickBtn: $('#labTickBtn'),
    autoMatchBtn: $('#labAutoMatchBtn'),
    nextBtn: $('#labNextBtn'),
    autoSeasonBtn: $('#labAutoSeasonBtn'),
    playerName: $('#labPlayerName'),
    playerMeta: $('#labPlayerMeta'),
    bank: $('#labBank'),
    softLive: $('#labSoftLive'),
    attrLive: $('#labAttrLive'),
    seasonStats: $('#labSeasonStats'),
    fixtures: $('#labFixtures'),
    summaryTitle: $('#labSummaryTitle'),
    summaryText: $('#labSummaryText'),
    summaryStats: $('#labSummaryStats'),
    againBtn: $('#labAgainBtn')
  };

  let draftAttrs = null;
  let draftSoft = null;
  let pointsLeft = 20;
  let season = null;

  function show(el) {
    [els.setup, els.play, els.summary].forEach((n) => n.classList.add('hidden'));
    el.classList.remove('hidden');
  }

  function randName() {
    const pool = window.POLISH_PLAYER_NAMES || ['Jan Kowalski', 'Adam Nowak'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function fillRegions() {
    const names = typeof REGION_NAMES !== 'undefined' ? REGION_NAMES : Object.keys((window.GAME_DATA && GAME_DATA.regions) || {});
    els.region.innerHTML = names.map((r) => `<option value="${r}">${r}</option>`).join('');
    if (names.length) els.region.value = names[Math.floor(Math.random() * names.length)];
  }

  function rebuildDraft() {
    const ovr = Number(els.start.value) || 45;
    const pos = els.position.value;
    draftAttrs = D.baseAttrsFor(pos, ovr);
    draftSoft = D.softDefaults();
    pointsLeft = Number(els.points.value) || 20;
    renderAttrEditor();
    renderSoft(els.softPreview, draftSoft);
    els.ovrPreview.textContent = `OVR bazowy po skillach: ${D.overallFromAttrs(draftAttrs)} · punkty: ${pointsLeft}`;
    els.pointsLeft.textContent = String(pointsLeft);
  }

  function renderAttrEditor() {
    els.attrEditor.innerHTML = '';
    D.ATTR_GROUPS.forEach((g) => {
      const box = document.createElement('div');
      box.className = 'attr-group';
      box.innerHTML = `<h3>${g.name}</h3>`;
      g.attrs.forEach(([key, label, hint]) => {
        const row = document.createElement('div');
        row.className = 'attr-row';
        row.title = hint;
        row.innerHTML = `<span>${label}</span><span class="attr-val" data-k="${key}">${draftAttrs[key]}</span>`;
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        minus.addEventListener('click', () => {
          if (draftAttrs[key] <= 15) return;
          draftAttrs[key] -= 1;
          pointsLeft += 1;
          syncPoints();
        });
        plus.addEventListener('click', () => {
          if (pointsLeft <= 0 || draftAttrs[key] >= 95) return;
          draftAttrs[key] += 1;
          pointsLeft -= 1;
          syncPoints();
        });
        row.appendChild(minus);
        row.appendChild(plus);
        box.appendChild(row);
      });
      els.attrEditor.appendChild(box);
    });
  }

  function syncPoints() {
    els.pointsLeft.textContent = String(pointsLeft);
    els.attrEditor.querySelectorAll('[data-k]').forEach((n) => {
      n.textContent = draftAttrs[n.getAttribute('data-k')];
    });
    els.ovrPreview.textContent = `OVR bazowy po skillach: ${D.overallFromAttrs(draftAttrs)} · punkty: ${pointsLeft}`;
  }

  function renderSoft(root, soft) {
    const labels = {
      form: 'Forma',
      morale: 'Morale',
      confidence: 'Pewność',
      fatigue: 'Zmęczenie',
      chemistry: 'Chemia',
      focus: 'Skupienie'
    };
    root.innerHTML = Object.keys(labels)
      .map((k) => `<div><span>${labels[k]}</span><strong>${soft[k] ?? 0}</strong></div>`)
      .join('');
  }

  function renderAttrLive(attrs, spendable) {
    els.attrLive.innerHTML = '';
    D.ATTR_GROUPS.forEach((g) => {
      const box = document.createElement('div');
      box.className = 'attr-group';
      box.innerHTML = `<h3>${g.name}</h3>`;
      g.attrs.forEach(([key, label]) => {
        const row = document.createElement('div');
        row.className = 'attr-row';
        row.innerHTML = `<span>${label}</span><span class="attr-val">${attrs[key]}</span>`;
        if (spendable) {
          const plus = document.createElement('button');
          plus.type = 'button';
          plus.textContent = '+';
          plus.disabled = !season || season.summary().pointsBank <= 0;
          plus.addEventListener('click', () => {
            if (season && season.spendPoint(key)) renderAll();
          });
          const spacer = document.createElement('span');
          row.appendChild(spacer);
          row.appendChild(plus);
        }
        box.appendChild(row);
      });
      els.attrLive.appendChild(box);
    });
  }

  function pickClub(region) {
    const list = (GAME_DATA.regions[region] || []).filter((c) => !c.reserve);
    if (!list.length) return { name: 'KS Lokalny', region, tier: 2, strength: 40 };
    // prefer IV–II liga for lab readability
    const mid = list.filter((c) => c.tier >= 2 && c.tier <= 5);
    const pool = mid.length ? mid : list;
    return { ...pool[Math.floor(Math.random() * pool.length)] };
  }

  function rivalsFor(club) {
    const all = Object.values(GAME_DATA.regions)
      .flat()
      .filter((c) => !c.reserve && c.name !== club.name);
    const same = all.filter((c) => c.region === club.region || Math.abs(c.tier - club.tier) <= 1);
    const pool = (same.length >= 12 ? same : all).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 24);
  }

  function startLab() {
    if (!els.name.value.trim()) els.name.value = randName();
    const mode = (document.querySelector('input[name="labMode"]:checked') || {}).value || 'key';
    const club = pickClub(els.region.value);
    const player = {
      name: els.name.value.trim(),
      position: els.position.value,
      attrs: { ...draftAttrs },
      soft: { ...draftSoft },
      overall: D.overallFromAttrs(draftAttrs),
      pointsBank: 0,
      region: els.region.value
    };
    season = window.LabSeason.createSeason({
      player,
      club,
      mode,
      rivals: rivalsFor(club)
    });
    els.resetBtn.classList.remove('hidden');
    show(els.play);
    if (mode === 'auto') {
      season.autoPlayRestOfSeason();
      finishSeason();
      return;
    }
    beginMatchFlow();
    renderAll();
  }

  function beginMatchFlow() {
    const pending = season.startNextMatch();
    const sum = season.summary();
    if (sum.seasonEvent && sum.seasonEvent.unresolved) {
      return;
    }
    if (!pending) {
      finishSeason();
      return;
    }
    if (!pending.interactive) {
      season.autoPlayCurrentMatch();
      if (season.summary().finished) finishSeason();
      return;
    }
    const match = season.getMatch();
    let guard = 0;
    while (match.snapshot().phase === 'play' && match.snapshot().minute < 12 && guard++ < 20) {
      match.tick(1);
    }
  }

  function finishSeason() {
    const s = season.summary();
    show(els.summary);
    els.summaryTitle.textContent = `${s.player.name} — ${s.club.name}`;
    els.summaryText.textContent = `Tryb: ${s.mode}. Punkty ligowe klubu (uproszczenie): ${s.tablePoints}. Śr. nota ${s.totals.avgRating}. Decyzji przy piłce: ${s.totals.decisions}.`;
    els.summaryStats.innerHTML = stripHtml([
      ['Mecze', s.totals.apps],
      ['Gole', s.totals.goals],
      ['Asysty', s.totals.assists],
      ['OVR', s.player.overall]
    ]);
  }

  function stripHtml(rows) {
    return rows.map(([a, b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join('');
  }

  function renderLog(entries) {
    els.log.innerHTML = (entries || [])
      .map((e) => {
        const cls = e.kind || 'info';
        return `<div><span class="m">${e.minute}'</span><span class="${cls}">${e.text}</span></div>`;
      })
      .join('');
    els.log.scrollTop = els.log.scrollHeight;
  }

  function renderDecision(snap) {
    if (!snap || snap.phase !== 'decision' || !snap.pending) {
      els.decision.classList.add('hidden');
      return;
    }
    els.decision.classList.remove('hidden');
    els.decisionText.textContent = snap.pending.text;
    els.actions.innerHTML = '';
    (snap.pending.actions || []).forEach((act) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<strong>${act.label}</strong><span class="sub">${act.desc}</span>`;
      b.addEventListener('click', () => {
        const match = season.getMatch();
        match.choose(act.id);
        // kontynuuj chwilę jeśli dalej play
        let g = 0;
        while (match.snapshot().phase === 'play' && match.snapshot().minute < 90 && g++ < 8) {
          match.tick(1);
        }
        if (match.snapshot().phase === 'ended') {
          season.applyMatchResult(match.snapshot());
        }
        renderAll();
        if (season.summary().finished) finishSeason();
      });
      els.actions.appendChild(b);
    });
    els.locked.innerHTML = (snap.pending.locked || [])
      .map((a) => `<li>🔒 ${a.label} — wymaga: ${a.missing.join(', ')}</li>`)
      .join('');
  }

  function renderEvent(sum) {
    const ev = sum.seasonEvent;
    if (!ev || !ev.unresolved) {
      els.seasonEvent.classList.add('hidden');
      return;
    }
    els.seasonEvent.classList.remove('hidden');
    els.eventTitle.textContent = ev.title;
    els.eventText.textContent = ev.text;
    els.eventChoices.innerHTML = '';
    (ev.choices || []).forEach((ch, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<strong>${ch.label}</strong>`;
      b.addEventListener('click', () => {
        season.resolveSeasonEventChoice(idx);
        const pending = season.summary().pendingMatch;
        const match = season.getMatch();
        if (match && pending && !pending.interactive) {
          season.autoPlayCurrentMatch();
        } else if (match) {
          let g = 0;
          while (match.snapshot().phase === 'play' && match.snapshot().minute < 10 && g++ < 15) match.tick(1);
        }
        renderAll();
        if (season.summary().finished) finishSeason();
      });
      els.eventChoices.appendChild(b);
    });
  }

  function renderFixtures(sum) {
    const fx = season.fixtures;
    els.fixtures.innerHTML = fx
      .map((f, i) => {
        const done = i < sum.index;
        const current = i === sum.index && sum.pendingMatch;
        const mark = done ? '✓' : current ? '▶' : '·';
        return `<div><span>${mark} ${f.id}</span><span>${f.home.name} – ${f.away.name}</span><span class="tag ${f.importance}">${f.importance}</span></div>`;
      })
      .join('');
  }

  function renderAll() {
    if (!season) return;
    const sum = season.summary();
    els.playerName.textContent = sum.player.name;
    els.playerMeta.textContent = `${sum.player.position} · OVR ${sum.player.overall} · ${sum.club.name} · tryb ${sum.mode}`;
    els.bank.textContent = String(sum.pointsBank);
    renderSoft(els.softLive, sum.player.soft);
    renderAttrLive(sum.player.attrs, true);
    els.seasonStats.innerHTML = stripHtml([
      ['Pkt', sum.tablePoints],
      ['Gole', sum.totals.goals],
      ['Asysty', sum.totals.assists],
      ['Nota', sum.totals.avgRating]
    ]);
    renderFixtures(sum);
    renderEvent(sum);

    const pending = sum.pendingMatch;
    if (!pending) {
      els.roundLabel.textContent = sum.finished ? 'SEZON ZAKOŃCZONY' : 'MIĘDZY MECZAMI';
      els.matchTitle.textContent = sum.finished ? 'Koniec' : 'Oczekiwanie';
      els.score.textContent = '—';
      els.minute.textContent = '—';
      els.phase.textContent = '';
      els.weather.textContent = '—';
      els.decision.classList.add('hidden');
      els.nextBtn.classList.toggle('hidden', sum.finished);
      els.tickBtn.disabled = true;
      els.autoMatchBtn.disabled = true;
      return;
    }

    const snap = pending.snap;
    const fx = pending.fixture;
    els.roundLabel.textContent = `${fx.type.toUpperCase()} · ${fx.importance.toUpperCase()}${pending.interactive ? ' · INTERAKTYWNY' : ' · AUTO'}`;
    els.matchTitle.textContent = `${fx.home.name} vs ${fx.away.name}`;
    els.homeName.textContent = fx.home.name;
    els.awayName.textContent = fx.away.name;
    els.score.textContent = `${snap.scoreH}:${snap.scoreA}`;
    els.minute.textContent = `${snap.minute}'`;
    els.phase.textContent = snap.phase;
    els.weather.textContent = `${snap.weather.icon || ''} ${snap.weather.label} — ${snap.weather.note}`;
    els.matchStats.innerHTML = stripHtml([
      ['Gole', snap.stats.goals],
      ['Strzały', snap.stats.shots],
      ['Nota', snap.stats.rating],
      ['Decyzje', snap.stats.decisions]
    ]);
    renderLog(snap.log);
    renderDecision(snap);

    const ended = snap.phase === 'ended';
    els.tickBtn.disabled = ended || snap.phase === 'decision' || !!sum.seasonEvent?.unresolved;
    els.autoMatchBtn.disabled = ended || !!sum.seasonEvent?.unresolved;
    if (els.autoSeasonBtn) {
      els.autoSeasonBtn.disabled = !!sum.finished || !!sum.seasonEvent?.unresolved;
    }
    els.nextBtn.classList.toggle('hidden', !ended);
  }

  // events
  els.position.addEventListener('change', rebuildDraft);
  els.start.addEventListener('change', rebuildDraft);
  els.points.addEventListener('change', rebuildDraft);
  els.startBtn.addEventListener('click', startLab);
  const labSetupForm = document.getElementById('labSetupForm');
  if (labSetupForm) {
    labSetupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      startLab();
    });
  }
  els.againBtn.addEventListener('click', () => {
    season = null;
    els.resetBtn.classList.add('hidden');
    show(els.setup);
    rebuildDraft();
  });
  els.resetBtn.addEventListener('click', () => {
    season = null;
    els.resetBtn.classList.add('hidden');
    show(els.setup);
    rebuildDraft();
  });

  els.tickBtn.addEventListener('click', () => {
    const match = season && season.getMatch();
    if (!match) return;
    match.tick(5);
    const snap = match.snapshot();
    if (snap.phase === 'ended') season.applyMatchResult(snap);
    renderAll();
    if (season.summary().finished) finishSeason();
  });

  els.autoMatchBtn.addEventListener('click', () => {
    if (!season) return;
    season.autoPlayCurrentMatch();
    renderAll();
    if (season.summary().finished) finishSeason();
  });

  els.nextBtn.addEventListener('click', () => {
    beginMatchFlow();
    renderAll();
    if (season.summary().finished) finishSeason();
  });

  els.autoSeasonBtn.addEventListener('click', () => {
    if (!season) return;
    season.autoPlayRestOfSeason();
    finishSeason();
  });

  // init
  fillRegions();
  els.name.value = randName();
  rebuildDraft();
  show(els.setup);
})();
