/*
 * Integracja Lab → główna kariera.
 * Skille, pogoda, eventy, tryby: auto / key / full.
 */
(function () {
  'use strict';

  const D = window.LabData;
  if (!D) {
    console.warn('LabData missing — kariera bez warstwy meczowej');
    return;
  }

  const draft = {
    attrs: null,
    soft: D.softDefaults(),
    pointsLeft: 20
  };
  window.__careerDraft = draft;

  let seasonCtl = null;

  function $(s) {
    return document.querySelector(s);
  }

  function host() {
    return window.CareerLabHost;
  }

  function rebuildDraftFromSetup() {
    const pos = ($('#position') || {}).value || 'MID';
    const start = ($('#startPoint') || {}).value || 'normal';
    const ovr =
      start === 'backyard' ? 32 : start === 'syrenka' ? 52 : start === 'wonderkid' ? 63 : 42;
    draft.attrs = D.baseAttrsFor(pos, ovr);
    draft.soft = D.softDefaults();
    draft.pointsLeft = Number(($('#skillBudget') || {}).value || 20);
    renderSkillEditor();
  }

  function renderSkillEditor() {
    const root = $('#careerSkillEditor');
    const bank = $('#careerSkillBank');
    if (!root || !draft.attrs) return;
    if (bank) bank.textContent = String(draft.pointsLeft);
    root.innerHTML = '';
    D.ATTR_GROUPS.forEach((g) => {
      const box = document.createElement('div');
      box.className = 'attr-group';
      box.innerHTML = `<h3>${g.name}</h3>`;
      g.attrs.forEach(([key, label, hint]) => {
        const row = document.createElement('div');
        row.className = 'attr-row';
        row.title = hint || '';
        row.innerHTML = `<span>${label}</span><span class="attr-val">${draft.attrs[key]}</span>`;
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '−';
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        minus.onclick = () => {
          if (draft.attrs[key] <= 15) return;
          draft.attrs[key] -= 1;
          draft.pointsLeft += 1;
          renderSkillEditor();
          updateOvrHint();
        };
        plus.onclick = () => {
          if (draft.pointsLeft <= 0 || draft.attrs[key] >= 95) return;
          draft.attrs[key] += 1;
          draft.pointsLeft -= 1;
          renderSkillEditor();
          updateOvrHint();
        };
        row.appendChild(minus);
        row.appendChild(plus);
        box.appendChild(row);
      });
      root.appendChild(box);
    });
    updateOvrHint();
  }

  function updateOvrHint() {
    const el = $('#careerSkillOvr');
    if (el && draft.attrs) el.textContent = `OVR ze skilli: ${D.overallFromAttrs(draft.attrs)} · do rozdania: ${draft.pointsLeft}`;
  }

  function applyPreSeasonLabEffects(state) {
    const notes = [];
    // event sezonowy (~40%)
    if (Math.random() < 0.4) {
      const ev = D.pickWeighted(D.SEASON_EVENTS);
      if (ev.choices) {
        // w auto: wybierz pierwszą / w key pokażemy w match panel przed sezonem
        const choice = ev.choices[0];
        const applied = D.applyEffects(state.attrs, state.soft, choice.effects);
        state.attrs = applied.attrs;
        state.soft = applied.soft;
        notes.push(`${ev.title}: ${choice.label}`);
      } else {
        const applied = D.applyEffects(state.attrs, state.soft, ev.effects);
        state.attrs = applied.attrs;
        state.soft = applied.soft;
        notes.push(`${ev.title} — ${ev.text}`);
      }
      host().log('Zdarzenie przed sezonem', notes[notes.length - 1]);
    }
    // pogoda „sezonowa” (dominujący klimat) wpływa lekko na soft
    const month = ((state.seasonYear % 100) % 12) + 8;
    const weather = D.rollWeather(Math.random, month > 12 ? month - 12 : month);
    const w = D.applyWeather(state.attrs, state.soft, weather);
    // tylko soft + mały wpływ — nie nadpisuj bazowych attr na cały sezon
    state.soft = w.soft;
    state._seasonWeather = weather;
    notes.push(`Klimat: ${weather.label} (${weather.note})`);
    host().log('Warunki sezonu', `${weather.icon || ''} ${weather.label} — ${weather.note}`);
    if (state.attrs) state.overall = D.overallFromAttrs(state.attrs);
    return { notes, weather };
  }

  function rivalsFor(club) {
    const all = Object.values(GAME_DATA.regions)
      .flat()
      .filter((c) => !c.reserve && c.name !== club.name);
    const same = all.filter((c) => c.region === club.region || Math.abs((c.tier || 1) - (club.tier || 1)) <= 1);
    const pool = (same.length >= 10 ? same : all).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 20);
  }

  function showMatchPanel(visible) {
    const panel = $('#careerMatchPanel');
    if (!panel) return;
    panel.classList.toggle('hidden', !visible);
    const btn = host().els.playSeasonBtn;
    if (btn) btn.classList.toggle('hidden', visible);
  }

  function renderMatchUI() {
    if (!seasonCtl) return;
    const sum = seasonCtl.summary();
    const pending = sum.pendingMatch;
    $('#cmRound').textContent = pending
      ? `${pending.fixture.type} · ${pending.fixture.importance}${pending.interactive ? ' · INTERAKTYWNY' : ' · AUTO'}`
      : sum.finished
        ? 'SEZON MECZOWY ZAKOŃCZONY'
        : 'MIĘDZY MECZAMI';
    $('#cmTitle').textContent = pending
      ? `${pending.fixture.home.name} vs ${pending.fixture.away.name}`
      : 'Sezon meczowy';
    $('#cmWeather').textContent = pending
      ? `${pending.weather.icon || ''} ${pending.weather.label} — ${pending.weather.note}`
      : '—';
    const snap = pending && pending.snap;
    $('#cmScore').textContent = snap ? `${snap.scoreH}:${snap.scoreA}` : '—';
    $('#cmMinute').textContent = snap ? `${snap.minute}'` : '—';
    $('#cmStats').innerHTML = [
      ['Gole', sum.totals.goals],
      ['Asysty', sum.totals.assists],
      ['Mecze', sum.totals.apps],
      ['Nota', sum.totals.avgRating]
    ]
      .map(([a, b]) => `<div><span>${a}</span><strong>${b}</strong></div>`)
      .join('');

    const logEl = $('#cmLog');
    logEl.innerHTML = ((snap && snap.log) || [])
      .map((e) => `<div><span class="m">${e.minute}'</span><span class="${e.kind || ''}">${e.text}</span></div>`)
      .join('');
    logEl.scrollTop = logEl.scrollHeight;

    // soft + bank
    const st = host().getState();
    $('#cmBank').textContent = String(st.skillPoints || 0);
    renderLiveAttrs(st);

    // event
    const evBox = $('#cmEvent');
    const ev = sum.seasonEvent;
    if (ev && ev.unresolved) {
      evBox.classList.remove('hidden');
      $('#cmEventTitle').textContent = ev.title;
      $('#cmEventText').textContent = ev.text;
      const choices = $('#cmEventChoices');
      choices.innerHTML = '';
      (ev.choices || []).forEach((ch, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice-btn';
        b.innerHTML = `<span class="choice-main">${ch.label}</span>`;
        b.onclick = () => {
          seasonCtl.resolveSeasonEventChoice(idx);
          // sync to career state
          const p = seasonCtl.summary().player;
          Object.assign(st.attrs, p.attrs);
          Object.assign(st.soft, p.soft);
          continueAfterEvent();
        };
        choices.appendChild(b);
      });
    } else {
      evBox.classList.add('hidden');
    }

    // decision
    const dec = $('#cmDecision');
    if (snap && snap.phase === 'decision' && snap.pending) {
      dec.classList.remove('hidden');
      $('#cmDecisionText').textContent = snap.pending.text;
      const acts = $('#cmActions');
      acts.innerHTML = '';
      (snap.pending.actions || []).forEach((act) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<strong>${act.label}</strong><span class="sub">${act.desc}</span>`;
        b.onclick = () => {
          const match = seasonCtl.getMatch();
          match.choose(act.id);
          let g = 0;
          while (match.snapshot().phase === 'play' && match.snapshot().minute < 90 && g++ < 10) match.tick(1);
          if (match.snapshot().phase === 'ended') {
            seasonCtl.applyMatchResult(match.snapshot());
            syncPlayerFromSeason();
          }
          renderMatchUI();
          maybeFinishMatchSeason();
        };
        acts.appendChild(b);
      });
      $('#cmLocked').innerHTML = (snap.pending.locked || [])
        .slice(0, 4)
        .map((a) => `<li>🔒 ${a.label} — ${a.missing.join(', ')}</li>`)
        .join('');
      $('#cmTick').disabled = true;
      $('#cmAutoMatch').disabled = true;
    } else {
      dec.classList.add('hidden');
      const ended = snap && snap.phase === 'ended';
      $('#cmTick').disabled = !snap || ended || !!(ev && ev.unresolved);
      $('#cmAutoMatch').disabled = !snap || ended || !!(ev && ev.unresolved);
      $('#cmNext').classList.toggle('hidden', !ended);
    }

    $('#cmAutoSeason').disabled = !!sum.finished;
  }

  function renderLiveAttrs(st) {
    const root = $('#cmAttrLive');
    if (!root || !st.attrs) return;
    root.innerHTML = '';
    D.ATTR_GROUPS.forEach((g) => {
      const box = document.createElement('div');
      box.className = 'attr-group';
      box.innerHTML = `<h3>${g.name}</h3>`;
      g.attrs.forEach(([key, label]) => {
        const row = document.createElement('div');
        row.className = 'attr-row';
        row.innerHTML = `<span>${label}</span><span class="attr-val">${st.attrs[key]}</span>`;
        const plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.disabled = !(st.skillPoints > 0);
        plus.onclick = () => {
          if ((st.skillPoints || 0) <= 0 || (st.attrs[key] || 0) >= 99) return;
          st.attrs[key] += 1;
          st.skillPoints -= 1;
          st.overall = D.overallFromAttrs(st.attrs);
          if (seasonCtl) seasonCtl.spendPoint(key);
          host().render();
          renderMatchUI();
        };
        const spacer = document.createElement('span');
        row.appendChild(spacer);
        row.appendChild(plus);
        box.appendChild(row);
      });
      root.appendChild(box);
    });
  }

  function syncPlayerFromSeason() {
    const st = host().getState();
    const p = seasonCtl.summary().player;
    st.attrs = { ...p.attrs };
    st.soft = { ...p.soft };
    st.skillPoints = p.pointsBank;
    st.overall = D.overallFromAttrs(st.attrs);
  }

  function continueAfterEvent() {
    syncPlayerFromSeason();
    const pending = seasonCtl.summary().pendingMatch;
    const match = seasonCtl.getMatch();
    if (match && pending && !pending.interactive) {
      seasonCtl.autoPlayCurrentMatch();
      syncPlayerFromSeason();
    } else if (match) {
      let g = 0;
      while (match.snapshot().phase === 'play' && match.snapshot().minute < 12 && g++ < 20) match.tick(1);
    }
    renderMatchUI();
    maybeFinishMatchSeason();
  }

  function beginNextMatch() {
    const pending = seasonCtl.startNextMatch();
    const sum = seasonCtl.summary();
    if (sum.seasonEvent && sum.seasonEvent.unresolved) {
      renderMatchUI();
      return;
    }
    if (!pending) {
      finishMatchSeason();
      return;
    }
    if (!pending.interactive) {
      seasonCtl.autoPlayCurrentMatch();
      syncPlayerFromSeason();
      renderMatchUI();
      if (seasonCtl.summary().finished) finishMatchSeason();
      return;
    }
    const match = seasonCtl.getMatch();
    let g = 0;
    while (match.snapshot().phase === 'play' && match.snapshot().minute < 12 && g++ < 20) match.tick(1);
    renderMatchUI();
  }

  function maybeFinishMatchSeason() {
    if (seasonCtl && seasonCtl.summary().finished) finishMatchSeason();
  }

  function finishMatchSeason() {
    const sum = seasonCtl.summary();
    syncPlayerFromSeason();
    showMatchPanel(false);
    const weatherInjury = Math.round(
      (sum.seasonLog || [])
        .filter((x) => x.type === 'match')
        .reduce((s, x) => s + (x.weather === 'Śnieg' || x.weather === 'Błoto' ? 2 : x.weather === 'Deszcz' ? 1 : 0), 0) / 4
    );
    host().simulateSeason({
      apps: sum.totals.apps,
      goals: sum.totals.goals,
      assists: sum.totals.assists,
      minutes: Math.max(sum.totals.apps * 70, sum.totals.apps * 65),
      avgRating: sum.totals.avgRating,
      weatherInjury,
      note: `Tryb ${sum.mode}: ${sum.totals.apps} meczów, nota ${sum.totals.avgRating}, decyzji ${sum.totals.decisions}.`
    });
    seasonCtl = null;
    host().render();
  }

  function startMatchSeason(mode) {
    const st = host().getState();
    if (!st.attrs) {
      st.attrs = D.baseAttrsFor(st.position, st.overall);
      st.soft = D.softDefaults();
    }
    applyPreSeasonLabEffects(st);
    seasonCtl = window.LabSeason.createSeason({
      player: {
        name: st.name,
        position: st.position,
        attrs: { ...st.attrs },
        soft: { ...st.soft },
        overall: st.overall,
        pointsBank: st.skillPoints || 0
      },
      club: st.club,
      mode,
      rivals: rivalsFor(st.club)
    });
    showMatchPanel(true);
    if (mode === 'auto') {
      seasonCtl.autoPlayRestOfSeason();
      finishMatchSeason();
      return;
    }
    beginNextMatch();
  }

  function onPlaySeason() {
    const st = host().getState();
    if (!st || st.pendingDecision) return;
    const mode = st.playMode || 'key';

    if (mode === 'classic') {
      // klasyczny rzut sezonu + lekkie efekty labu
      if (st.attrs) applyPreSeasonLabEffects(st);
      host().simulateSeason();
      return;
    }

    // auto / key / full → sezon meczowy, potem feed do silnika kariery
    startMatchSeason(mode);
  }

  window.CareerLab = { onPlaySeason };

  function wireButtons() {
    $('#cmTick')?.addEventListener('click', () => {
      const match = seasonCtl && seasonCtl.getMatch();
      if (!match) return;
      match.tick(5);
      if (match.snapshot().phase === 'ended') {
        seasonCtl.applyMatchResult(match.snapshot());
        syncPlayerFromSeason();
      }
      renderMatchUI();
      maybeFinishMatchSeason();
    });
    $('#cmAutoMatch')?.addEventListener('click', () => {
      if (!seasonCtl) return;
      seasonCtl.autoPlayCurrentMatch();
      syncPlayerFromSeason();
      renderMatchUI();
      maybeFinishMatchSeason();
    });
    $('#cmNext')?.addEventListener('click', () => beginNextMatch());
    $('#cmAutoSeason')?.addEventListener('click', () => {
      if (!seasonCtl) return;
      seasonCtl.autoPlayRestOfSeason();
      finishMatchSeason();
    });
  }

  function enhanceRender() {
    const h = host();
    if (!h || h._labRenderPatched) return;
    const orig = h.render;
    h.render = function () {
      orig();
      const st = h.getState();
      if (!st) return;
      const meta = h.els.playerMeta;
      if (meta && st.playMode) {
        const modeLabel = { auto: 'AUTO', key: 'WAŻNE MECZE', full: 'PEŁNY MECZ', classic: 'KLASYKA' }[st.playMode] || st.playMode;
        if (!meta.textContent.includes(modeLabel)) meta.textContent += ` • ${modeLabel}`;
      }
      const softBox = $('#careerSoftStats');
      if (softBox && st.soft) {
        softBox.classList.remove('hidden');
        softBox.innerHTML = [
          ['Forma', st.soft.form],
          ['Morale', st.soft.morale],
          ['Pewność', st.soft.confidence],
          ['Zmęczenie', st.soft.fatigue],
          ['Chemia', st.soft.chemistry],
          ['Skupienie', st.soft.focus]
        ]
          .map(([a, b]) => `<div><span>${a}</span><strong>${Math.round(b)}</strong></div>`)
          .join('');
      }
      const pts = $('#careerPointsLive');
      if (pts) pts.textContent = `${st.skillPoints || 0} pkt skilli`;
    };
    h._labRenderPatched = true;
  }

  function init() {
    const pos = $('#position');
    const start = $('#startPoint');
    const budget = $('#skillBudget');
    pos?.addEventListener('change', rebuildDraftFromSetup);
    start?.addEventListener('change', rebuildDraftFromSetup);
    budget?.addEventListener('change', rebuildDraftFromSetup);
    rebuildDraftFromSetup();
    wireButtons();

    const boot = () => {
      if (!host()) {
        setTimeout(boot, 30);
        return;
      }
      enhanceRender();
    };
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
