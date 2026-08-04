/*
 * Lab — interaktywny silnik meczu.
 * Gdy piłka jest u gracza: next() zwraca kontekst decyzji; choose(actionId) rozwiązuje akcję.
 * Skille odblokowują warianty akcji (LabData.availableActions).
 */
(function (global) {
  'use strict';

  const D = global.LabData;
  const clamp = D.clamp;

  function rand(rng, a, b) {
    return a + Math.floor(rng() * (b - a + 1));
  }
  function chance(rng, p) {
    return rng() < p;
  }
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function createMatch(options = {}) {
    const rng = options.random || Math.random;
    const player = options.player;
    const home = options.home || { name: 'Twój klub', strength: 55 };
    const away = options.away || { name: 'Rywal', strength: 55 };
    const weather = options.weather || D.rollWeather(rng);
    const importance = options.importance || 'league'; // league | key | derby | cup
    const interactive = options.interactive !== false;

    const baseAttrs = { ...player.attrs };
    const baseSoft = { ...player.soft };
    let { attrs, soft } = D.applyWeather(baseAttrs, baseSoft, weather);

    // presja ważnego meczu (composure to atr, nie soft)
    if (importance === 'derby' || importance === 'cup') {
      soft.confidence = clamp(soft.confidence + ((attrs.composure || 50) > 55 ? 3 : -4), 0, 100);
      soft.focus = clamp(soft.focus + 2, 0, 100);
    }
    // Soft po pogodzie/presji — zapisujemy tylko delty z gry, bez stackowania modów.
    const softKickoff = { ...soft };

    let minute = 0;
    let scoreH = 0;
    let scoreA = 0;
    let phase = 'kickoff'; // kickoff | play | decision | half | ended
    let pending = null;
    let possession = 'home'; // home = nasza drużyna
    let stats = blankStats();
    let log = [];
    let yellow = 0;
    let red = false;
    let subbed = false;
    let matchEventsFired = new Set();
    let decisionCount = 0;

    const oppRating = clamp(away.strength + rand(rng, -4, 4), 25, 95);
    const teamRating = clamp(home.strength + (D.overallFromAttrs(attrs) - home.strength) * 0.12, 25, 95);

    function blankStats() {
      return {
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOn: 0,
        passes: 0,
        passesOk: 0,
        dribbles: 0,
        dribblesOk: 0,
        tackles: 0,
        tacklesOk: 0,
        turnovers: 0,
        rating: 6.2,
        keyPasses: 0,
        fouls: 0,
        decisions: 0
      };
    }

    function push(text, kind = 'info') {
      log.push({ minute, text, kind, score: `${scoreH}:${scoreA}` });
    }

    function fatigueFactor() {
      const late = minute > 70 ? 1.25 : minute > 55 ? 1.1 : 1;
      const stam = attrs.stamina || 50;
      const fat = soft.fatigue || 0;
      return clamp(1 - (fat / 180) * late - Math.max(0, 55 - stam) / 220, 0.62, 1);
    }

    function liveAttrs() {
      const f = fatigueFactor();
      const formBoost = ((soft.form || 50) - 50) * 0.12;
      const conf = ((soft.confidence || 50) - 50) * 0.08;
      const focus = ((soft.focus || 50) - 50) * 0.06;
      const out = {};
      D.ATTR_KEYS.forEach((k) => {
        let v = attrs[k] || 40;
        if (['pace', 'acceleration', 'dribbling', 'stamina', 'workRate'].includes(k)) v *= f;
        v += formBoost + conf + focus;
        out[k] = clamp(Math.round(v), 1, 99);
      });
      return out;
    }

    function skillChance(weights, difficulty = 0, bias = 0) {
      const live = liveAttrs();
      const avg = Object.entries(weights).reduce((s, [k, w]) => s + live[k] * w, 0);
      const softMod =
        ((soft.morale || 50) - 50) * 0.002 +
        ((soft.chemistry || 50) - 50) * 0.0015 -
        ((soft.fatigue || 0) * 0.0015);
      const gap = avg - oppRating - difficulty;
      return clamp(1 / (1 + Math.exp(-gap / 11)) + bias + softMod, 0.04, 0.94);
    }

    function bumpRating(delta) {
      stats.rating = clamp(+(stats.rating + delta).toFixed(2), 4, 10);
    }

    function maybeMatchEvent() {
      D.MATCH_EVENTS.forEach((ev) => {
        if (matchEventsFired.has(ev.id)) return;
        const [a, b] = ev.minute;
        if (minute < a || minute > b) return;
        if (!chance(rng, 0.09)) return;
        matchEventsFired.add(ev.id);
        const applied = D.applyEffects(attrs, soft, ev.effects);
        attrs = applied.attrs;
        soft = applied.soft;
        push(ev.text, 'event');
        if (ev.yellow) {
          yellow += 1;
          stats.fouls += 1;
          if (yellow >= 2) {
            red = true;
            push('Druga żółta — czerwona kartka! Schodzisz z boiska.', 'bad');
            // Zawodnik schodzi, ale mecz trwa dalej (tylko tło drużynowe).
            pending = null;
            phase = 'play';
          }
        }
        if (ev.injuryChance && chance(rng, ev.injuryChance + weather.injury / 100)) {
          soft.fatigue = clamp(soft.fatigue + 15, 0, 100);
          push('Czujesz ostry ból — grasz przez to ostrożniej.', 'bad');
        }
      });
    }

    function simTeamChance(attackHome) {
      const atk = attackHome ? teamRating : oppRating;
      const def = attackHome ? oppRating : teamRating;
      const weatherDrag = weather.id === 'fog' || weather.id === 'wind' ? 0.85 : 1;
      const p = clamp(0.045 + (atk - def) * 0.0018, 0.02, 0.14) * weatherDrag;
      if (chance(rng, p)) {
        if (attackHome) {
          scoreH += 1;
          push(`GOL! ${home.name} zdobywa bramkę po akcji zespołowej.`, 'goal');
        } else {
          scoreA += 1;
          push(`Gol dla ${away.name}.`, 'bad');
        }
      }
    }

    function makeContext(kind) {
      const live = liveAttrs();
      if (kind === 'attack') {
        const distance = rand(rng, 8, 42);
        const defenders = rand(rng, 0, distance < 16 ? 2 : 3);
        const aerial = chance(rng, 0.18 + live.heading / 400);
        const setPiece = chance(rng, 0.08 + live.setPiece / 500);
        const ctx = {
          kind: 'attack',
          defending: false,
          distance,
          defenders,
          aerial,
          setPiece,
          text: setPiece
            ? `Stały fragment z ${distance} m. Przed tobą ${defenders} rywali w murze / polu karnym.`
            : aerial
              ? `Piłka w powietrzu, ${distance} m do bramki, ${defenders} rywali w starciu.`
              : `Masz piłkę ${distance} m od bramki. Przed tobą ${defenders} ${defenders === 1 ? 'obrońca' : 'obrońców'}.`
        };
        ctx.actions = D.availableActions(live, ctx);
        ctx.locked = D.lockedActions(live, ctx).slice(0, 4);
        return ctx;
      }
      // defending
      const distance = rand(rng, 10, 35);
      const ctx = {
        kind: 'defend',
        defending: true,
        distance,
        defenders: 0,
        aerial: chance(rng, 0.2),
        setPiece: false,
        text: `Rywal prowadzi piłkę w strefie ${distance} m od waszej bramki. Możesz wejść w odbiór.`
      };
      ctx.actions = D.availableActions(live, ctx);
      ctx.locked = D.lockedActions(live, ctx).slice(0, 3);
      return ctx;
    }

    function shouldInvolvePlayer() {
      if (red || subbed) return false;
      const ovr = D.overallFromAttrs(liveAttrs());
      const roleChance = clamp(0.22 + (ovr - home.strength) * 0.008 + (soft.form - 50) * 0.002, 0.12, 0.55);
      return chance(rng, roleChance);
    }

    function resolveAction(actionId) {
      const live = liveAttrs();
      const ctx = pending;
      stats.decisions += 1;
      decisionCount += 1;
      soft.fatigue = clamp(soft.fatigue + rand(rng, 1, 3), 0, 100);

      let result = { text: '', end: true };

      if (actionId === 'pass') {
        stats.passes += 1;
        const p = skillChance({ passing: 0.55, control: 0.2, vision: 0.15, bothFeet: 0.1 }, ctx.defenders * 3, 0.12);
        if (chance(rng, p)) {
          stats.passesOk += 1;
          bumpRating(0.08);
          result = { text: 'Pewne podanie. Drużyna utrzymuje piłkę.', end: true };
        } else {
          stats.turnovers += 1;
          bumpRating(-0.15);
          result = { text: 'Niedokładne podanie — strata.', end: true, turnover: true };
        }
      } else if (actionId === 'through') {
        stats.passes += 1;
        const p = skillChance({ passing: 0.4, vision: 0.4, composure: 0.1, control: 0.1 }, ctx.defenders * 4 + 6, -0.02);
        if (chance(rng, p)) {
          stats.passesOk += 1;
          stats.keyPasses += 1;
          if (ctx.distance < 30 && chance(rng, 0.12 + live.vision * 0.0015)) {
            stats.assists += 1;
            scoreH += 1;
            bumpRating(0.7);
            result = { text: 'Podanie prostopadłe otwiera obronę — ASYSTA!', end: true, assist: true, goal: true };
          } else {
            bumpRating(0.2);
            result = { text: 'Świetne podanie w tempo. Akcja trwa, lecz bez gola.', end: true };
          }
        } else {
          stats.turnovers += 1;
          bumpRating(-0.2);
          result = { text: 'Próba prostopadłej jest przeczytana przez rywala.', end: true, turnover: true };
        }
      } else if (actionId === 'switch') {
        stats.passes += 1;
        const p = skillChance({ passing: 0.45, vision: 0.4, strength: 0.15 }, 8 + (weather.id === 'wind' ? 6 : 0), 0);
        if (chance(rng, p)) {
          stats.passesOk += 1;
          stats.keyPasses += 1;
          bumpRating(0.15);
          result = { text: 'Przekładasz grę na drugą stronę. Rywal się spóźnia.', end: true };
        } else {
          stats.turnovers += 1;
          bumpRating(-0.18);
          result = { text: 'Długa zmiana strony wypada za linię lub do rywala.', end: true, turnover: true };
        }
      } else if (actionId === 'shoot' || actionId === 'powerShot' || actionId === 'placedShot' || actionId === 'volley' || actionId === 'weakFoot') {
        stats.shots += 1;
        const power = actionId === 'powerShot';
        const placed = actionId === 'placedShot';
        const volley = actionId === 'volley';
        const weak = actionId === 'weakFoot';
        const weights = power
          ? { shooting: 0.4, strength: 0.3, positioning: 0.15, control: 0.15 }
          : placed
            ? { shooting: 0.4, composure: 0.25, control: 0.2, positioning: 0.15 }
            : volley
              ? { shooting: 0.3, control: 0.3, flair: 0.2, positioning: 0.2 }
              : { shooting: 0.4, control: 0.25, positioning: 0.2, bothFeet: 0.15 };
        const penalty =
          Math.max(0, ctx.distance - 10) * 0.9 +
          ctx.defenders * 4.5 +
          (volley ? 4 : 0) +
          (weak && live.bothFeet < 60 ? 6 : 0) +
          (weather.attrMods.shooting ? Math.abs(weather.attrMods.shooting) * 0.4 : 0);
        const avg = Object.entries(weights).reduce((s, [k, w]) => s + live[k] * w, 0);
        let goalP = (1 / (1 + Math.exp(-(avg - oppRating - penalty) / 10))) * (power ? 0.5 : placed ? 0.48 : 0.45);
        goalP = clamp(goalP, 0.02, 0.52);
        const onP = clamp(0.5 + (live.shooting - oppRating) * 0.006 - ctx.defenders * 0.03, 0.18, 0.85);
        const roll = rng();
        if (roll < goalP) {
          stats.goals += 1;
          stats.shotsOn += 1;
          scoreH += 1;
          bumpRating(1);
          result = { text: power ? 'Młot w okienko — GOL!' : placed ? 'Placé obok bramkarza — GOL!' : volley ? 'Wolej wpada pod poprzeczkę — GOL!' : 'GOL!', end: true, goal: true };
        } else if (roll < onP) {
          stats.shotsOn += 1;
          bumpRating(0.05);
          result = { text: 'Strzał celny, ale bramkarz broni.', end: true };
        } else {
          bumpRating(-0.12);
          result = { text: 'Strzał niecelny.', end: true };
        }
      } else if (actionId === 'dribble' || actionId === 'paceBurst' || actionId === 'nutmeg' || actionId === 'cruyff') {
        stats.dribbles += 1;
        const fancy = actionId === 'nutmeg' || actionId === 'cruyff';
        const pace = actionId === 'paceBurst';
        const weights = pace
          ? { pace: 0.4, acceleration: 0.3, dribbling: 0.2, control: 0.1 }
          : fancy
            ? { flair: 0.35, dribbling: 0.35, control: 0.2, bothFeet: 0.1 }
            : { dribbling: 0.45, control: 0.25, pace: 0.15, flair: 0.15 };
        const p = skillChance(weights, ctx.defenders * 6 + (fancy ? 4 : 0), fancy ? -0.04 : 0.02);
        if (chance(rng, p)) {
          stats.dribblesOk += 1;
          bumpRating(0.2);
          const nextDist = Math.max(6, ctx.distance - rand(rng, 5, 11));
          const nextDef = Math.max(0, ctx.defenders - 1);
          if (interactive && chance(rng, 0.55)) {
            pending = {
              kind: 'attack',
              defending: false,
              distance: nextDist,
              defenders: nextDef,
              aerial: false,
              setPiece: false,
              text: `Po udanym dryblingu: ${nextDist} m do bramki, ${nextDef} rywali. Kontynuujesz akcję.`
            };
            pending.actions = D.availableActions(liveAttrs(), pending);
            pending.locked = D.lockedActions(liveAttrs(), pending).slice(0, 3);
            phase = 'decision';
            result = { text: fancy ? 'Efektowny zwód! Nadal masz piłkę.' : 'Mijasz rywala i idziesz dalej.', end: false, continue: true };
            push(result.text, 'action');
            return result;
          }
          result = { text: 'Udany drybling, lecz akcja wygasa.', end: true };
        } else {
          stats.turnovers += 1;
          bumpRating(-0.22);
          result = { text: 'Drybling nie wychodzi — strata.', end: true, turnover: true };
        }
      } else if (actionId === 'holdUp' || actionId === 'delay') {
        const weights = { strength: 0.35, composure: 0.35, control: 0.2, positioning: 0.1 };
        const p = skillChance(weights, ctx.defenders * 3, 0.05);
        if (chance(rng, p)) {
          bumpRating(0.1);
          soft.focus = clamp(soft.focus + 1, 0, 100);
          result = { text: actionId === 'delay' ? 'Spowalnasz grę i uspokajasz posiadanie.' : 'Przytrzymujesz piłkę do czasu wsparcia.', end: true };
        } else {
          stats.turnovers += 1;
          bumpRating(-0.15);
          result = { text: 'Za długo trzymasz — odbierają ci piłkę.', end: true, turnover: true };
        }
      } else if (actionId === 'tackle' || actionId === 'aggTackle') {
        stats.tackles += 1;
        const agg = actionId === 'aggTackle';
        const p = skillChance({ tackling: 0.45, positioning: 0.25, strength: 0.15, pace: 0.15 }, (30 - ctx.distance) * 0.3, agg ? 0.1 : 0);
        if (chance(rng, p)) {
          stats.tacklesOk += 1;
          bumpRating(agg ? 0.28 : 0.22);
          result = { text: agg ? 'Mocny, skuteczny odbiór.' : 'Czysty odbiór. Przerywasz akcję.', end: true };
        } else {
          bumpRating(-0.25);
          stats.fouls += 1;
          if (agg && chance(rng, 0.28)) {
            yellow += 1;
            result = { text: 'Spóźniony wślizg — żółta kartka.', end: true, yellow: true };
            if (yellow >= 2) {
              red = true;
              push('Czerwona kartka!', 'bad');
              // Zawodnik schodzi — mecz toczy się dalej bez jego udziału.
            }
          } else {
            result = { text: 'Nie dochodzisz do piłki. Rywal przechodzi dalej.', end: true };
            if (chance(rng, 0.1)) {
              scoreA += 1;
              push(`Gol dla ${away.name} po nieudanym odbiorze.`, 'bad');
            }
          }
        }
      } else if (actionId === 'header') {
        const attack = !ctx.defending;
        if (attack && ctx.distance <= 18) {
          stats.shots += 1;
          const p = skillChance({ heading: 0.5, positioning: 0.25, strength: 0.25 }, ctx.defenders * 4, 0);
          if (chance(rng, p * 0.45)) {
            stats.goals += 1;
            stats.shotsOn += 1;
            scoreH += 1;
            bumpRating(0.9);
            result = { text: 'Główka do siatki — GOL!', end: true, goal: true };
          } else {
            bumpRating(-0.05);
            result = { text: 'Główka niecelna lub obroniona.', end: true };
          }
        } else {
          const p = skillChance({ heading: 0.55, positioning: 0.25, strength: 0.2 }, 4, 0.05);
          if (chance(rng, p)) {
            bumpRating(0.12);
            result = { text: 'Wygrywasz starcie w powietrzu.', end: true };
          } else {
            bumpRating(-0.1);
            result = { text: 'Przegrywasz główkę.', end: true };
          }
        }
      } else if (actionId === 'setPiece') {
        stats.shots += 1;
        const p = skillChance({ setPiece: 0.5, shooting: 0.25, bothFeet: 0.15, flair: 0.1 }, Math.max(0, ctx.distance - 18) * 0.7, -0.05);
        if (chance(rng, p * 0.35)) {
          stats.goals += 1;
          stats.shotsOn += 1;
          scoreH += 1;
          bumpRating(1);
          result = { text: 'Gol bezpośrednio ze stałego fragmentu!', end: true, goal: true };
        } else if (chance(rng, 0.45)) {
          stats.shotsOn += 1;
          bumpRating(0.05);
          result = { text: 'Uderzenie ze stałego — bramkarz broni / mur.', end: true };
        } else {
          bumpRating(-0.08);
          result = { text: 'Stały fragment bez zagrożenia.', end: true };
        }
      } else {
        result = { text: 'Akcja nierozpoznana — sędzia przerywa.', end: true };
      }

      push(result.text, result.goal ? 'goal' : result.turnover ? 'bad' : 'action');
      if (result.end) {
        pending = null;
        // Po czerwonej kartce zostajemy w play (tylko tło) — nie kasuj fazy ended
        // z innych ścieżek; sent-off kontynuuje z red=true w tick().
        if (!red) {
          phase = 'play';
          possession = result.turnover ? 'away' : chance(rng, 0.55) ? 'home' : 'away';
        } else {
          phase = 'play';
          possession = 'away';
        }
      }
      return result;
    }

    function autoResolveDecision() {
      if (!pending) return;
      const acts = pending.actions || [];
      if (!acts.length) {
        pending = null;
        phase = 'play';
        return;
      }
      // AI wybiera „najlepszą” akcję wg prostego scoringu
      const live = liveAttrs();
      let best = acts[0];
      let bestScore = -1e9;
      acts.forEach((a) => {
        let s = 0;
        Object.entries(a.needs || {}).forEach(([k, min]) => {
          s += (live[k] || 0) - min;
        });
        if (a.id === 'shoot' || a.id === 'placedShot') s += pending.distance < 18 ? 20 : -10;
        if (a.id === 'pass') s += 5;
        if (a.id === 'aggTackle') s -= 8;
        if (s > bestScore) {
          bestScore = s;
          best = a;
        }
      });
      resolveAction(best.id);
    }

    function tick(minutes = 1) {
      if (phase === 'ended' || phase === 'decision') return snapshot();
      for (let i = 0; i < minutes; i++) {
        if (phase === 'ended' || phase === 'decision') break;
        if (minute >= 90) {
          phase = 'ended';
          push(`Koniec meczu ${scoreH}:${scoreA}.`, 'info');
          break;
        }
        minute += 1;
        if (minute === 45) push('Koniec pierwszej połowy.', 'info');
        if (minute === 46) push('Początek drugiej połowy.', 'info');

        soft.fatigue = clamp(soft.fatigue + (weather.id === 'heat' ? 0.35 : 0.2), 0, 100);
        maybeMatchEvent();

        if (red) {
          simTeamChance(false);
          continue;
        }

        // okazja gracza
        if (interactive && shouldInvolvePlayer()) {
          const defend = chance(rng, player.position === 'DEF' ? 0.55 : 0.22);
          pending = makeContext(defend ? 'defend' : 'attack');
          phase = 'decision';
          push(pending.text, 'decision');
          break;
        }

        // tło zespołowe
        if (chance(rng, 0.35)) simTeamChance(chance(rng, 0.48));
      }
      return snapshot();
    }

    function softForSeason() {
      // Cofnij pogodę/presję; zostaw tylko zmiany z meczu (fatigue, eventy, akcje).
      const out = { ...baseSoft };
      D.SOFT_KEYS.forEach((k) => {
        const delta = (soft[k] || 0) - (softKickoff[k] || 0);
        if (delta) out[k] = clamp((baseSoft[k] || 50) + delta, 0, 100);
      });
      return out;
    }

    function snapshot() {
      return {
        minute,
        scoreH,
        scoreA,
        phase,
        pending,
        weather,
        stats: { ...stats },
        soft: softForSeason(),
        softLive: { ...soft },
        attrs: liveAttrs(),
        yellow,
        red,
        log: log.slice(-12),
        home,
        away,
        importance,
        decisionCount
      };
    }

    function choose(actionId) {
      if (phase !== 'decision' || !pending) throw new Error('Brak decyzji do podjęcia.');
      const allowed = (pending.actions || []).some((a) => a.id === actionId);
      if (!allowed) throw new Error('Akcja niedostępna (brak skilli lub kontekst).');
      const result = resolveAction(actionId);
      return { result, state: snapshot() };
    }

    function skipToEnd(autoDecisions = true) {
      while (phase !== 'ended' && minute < 90) {
        if (phase === 'decision') {
          if (autoDecisions) autoResolveDecision();
          else break;
        } else tick(1);
      }
      if (minute >= 90 && phase !== 'ended') {
        phase = 'ended';
        push(`Koniec meczu ${scoreH}:${scoreA}.`, 'info');
      }
      return snapshot();
    }

    push(`Kick-off. Pogoda: ${weather.label}. ${weather.note}`, 'info');
    phase = 'play';

    return {
      tick,
      choose,
      skipToEnd,
      autoResolveDecision,
      snapshot,
      get weather() {
        return weather;
      }
    };
  }

  global.LabMatch = Object.freeze({ createMatch });
})(typeof window !== 'undefined' ? window : globalThis);
