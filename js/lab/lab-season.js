/*
 * Lab — silnik sezonu z trzema trybami:
 *  - auto: wszystkie mecze symulowane
 *  - key: decyzje tylko w meczach istotnych
 *  - full: każdy mecz interaktywny (posiadanie)
 */
(function (global) {
  'use strict';

  const D = global.LabData;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function createSeason(options = {}) {
    const player = options.player;
    const club = options.club;
    const mode = options.mode || 'key'; // auto | key | full
    const rivals = options.rivals || [];
    const fixtures = buildFixtures(club, rivals);
    let index = 0;
    let tablePoints = 0;
    let played = 0;
    let seasonLog = [];
    let pendingMatch = null;
    let seasonEvent = null;
    let pointsBank = player.pointsBank || 0;
    let finished = false;

    const totals = {
      apps: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: 0,
      ratingSum: 0,
      ratingN: 0,
      decisions: 0
    };

    function buildFixtures(homeClub, pool) {
      const list = [];
      const others = pool.filter((c) => c.name !== homeClub.name).slice();
      // 16 kolejek „ligi” + 2 pucharowe
      for (let i = 0; i < 16; i++) {
        const opp = others[i % Math.max(1, others.length)] || {
          name: 'Rywal lokalny',
          strength: homeClub.strength - 2 + (i % 5),
          tier: homeClub.tier
        };
        const home = i % 2 === 0;
        list.push({
          id: `L${i + 1}`,
          round: i + 1,
          type: 'league',
          home: home ? homeClub : opp,
          away: home ? opp : homeClub,
          opponent: opp,
          month: ((i + 7) % 12) + 1,
          importance: classifyImportance(homeClub, opp, 'league', i)
        });
      }
      list.push({
        id: 'C1',
        round: 17,
        type: 'cup',
        home: homeClub,
        away: others[3] || { name: 'Pucharowy rywal', strength: homeClub.strength + 3, tier: homeClub.tier },
        opponent: others[3] || { name: 'Pucharowy rywal', strength: homeClub.strength + 3 },
        month: 9,
        importance: 'cup'
      });
      list.push({
        id: 'C2',
        round: 18,
        type: 'cup',
        home: others[5] || { name: 'Derby pucharowe', strength: homeClub.strength + 1 },
        away: homeClub,
        opponent: others[5] || { name: 'Derby pucharowe', strength: homeClub.strength + 1 },
        month: 3,
        importance: 'derby'
      });
      return list;
    }

    function classifyImportance(homeClub, opp, type, idx) {
      if (type === 'cup') return 'cup';
      const gap = Math.abs((homeClub.strength || 50) - (opp.strength || 50));
      const nameHit = /legia|lech|śląsk|wisła|cracovia|górnik|ruch|widzew|łks/i.test(opp.name || '');
      if (nameHit && gap < 12) return 'derby';
      if (gap <= 5 && (opp.tier || 0) >= (homeClub.tier || 0)) return 'key';
      if (idx >= 13) return 'key'; // końcówka sezonu
      return 'league';
    }

    function isInteractiveFixture(fx) {
      if (mode === 'auto') return false;
      if (mode === 'full') return true;
      // key
      return fx.importance === 'key' || fx.importance === 'derby' || fx.importance === 'cup';
    }

    function rollSeasonEvent() {
      const ev = D.pickWeighted(D.SEASON_EVENTS);
      if (ev.choices) {
        seasonEvent = {
          ...ev,
          unresolved: true
        };
        return seasonEvent;
      }
      const applied = D.applyEffects(player.attrs, player.soft, ev.effects);
      player.attrs = applied.attrs;
      player.soft = applied.soft;
      player.overall = D.overallFromAttrs(player.attrs);
      seasonLog.push({ type: 'event', title: ev.title, text: ev.text, effects: ev.effects });
      seasonEvent = { ...ev, unresolved: false, applied: true };
      return seasonEvent;
    }

    function resolveSeasonEventChoice(choiceIndex) {
      if (!seasonEvent || !seasonEvent.choices) return null;
      const choice = seasonEvent.choices[choiceIndex];
      if (!choice) return null;
      const applied = D.applyEffects(player.attrs, player.soft, choice.effects);
      player.attrs = applied.attrs;
      player.soft = applied.soft;
      player.overall = D.overallFromAttrs(player.attrs);
      seasonLog.push({ type: 'event', title: seasonEvent.title, text: choice.label, effects: choice.effects });
      seasonEvent = { ...seasonEvent, unresolved: false, chosen: choice.label };
      return seasonEvent;
    }

    function startNextMatch() {
      if (finished || index >= fixtures.length) {
        finished = true;
        return null;
      }
      // losowe zdarzenie przed meczem (~35%)
      if (Math.random() < 0.35) rollSeasonEvent();

      const fx = fixtures[index];
      const weather = D.rollWeather(Math.random, fx.month);
      const interactive = isInteractiveFixture(fx);
      const match = global.LabMatch.createMatch({
        player,
        home: fx.home,
        away: fx.away,
        weather,
        importance: fx.importance,
        interactive
      });
      pendingMatch = { fixture: fx, match, interactive, weather };
      return pendingMatch;
    }

    function applyMatchResult(snap) {
      const fx = pendingMatch.fixture;
      const weHome = fx.home.name === club.name;
      const gf = weHome ? snap.scoreH : snap.scoreA;
      const ga = weHome ? snap.scoreA : snap.scoreH;
      if (gf > ga) tablePoints += 3;
      else if (gf === ga) tablePoints += 1;

      totals.apps += 1;
      totals.goals += snap.stats.goals;
      totals.assists += snap.stats.assists;
      totals.yellow += snap.yellow || 0;
      totals.red += snap.red ? 1 : 0;
      totals.ratingSum += snap.stats.rating;
      totals.ratingN += 1;
      totals.decisions += snap.decisionCount || snap.stats.decisions || 0;

      // transfer softów z meczu
      player.soft = { ...player.soft, ...snap.soft };
      // mikroprogresja z oceny
      const rating = snap.stats.rating;
      if (rating >= 7.5) {
        player.soft.form = clamp(player.soft.form + 3, 0, 100);
        player.soft.confidence = clamp(player.soft.confidence + 2, 0, 100);
        pointsBank += 1;
      } else if (rating <= 5.8) {
        player.soft.form = clamp(player.soft.form - 3, 0, 100);
        player.soft.confidence = clamp(player.soft.confidence - 2, 0, 100);
      }
      player.soft.fatigue = clamp(player.soft.fatigue + 8, 0, 100);
      // regeneracja między meczami
      player.soft.fatigue = clamp(player.soft.fatigue - 12, 0, 100);

      seasonLog.push({
        type: 'match',
        id: fx.id,
        label: `${fx.home.name} ${snap.scoreH}:${snap.scoreA} ${fx.away.name}`,
        importance: fx.importance,
        weather: snap.weather.label,
        rating,
        goals: snap.stats.goals,
        assists: snap.stats.assists,
        interactive: pendingMatch.interactive
      });

      index += 1;
      played += 1;
      pendingMatch = null;
      if (index >= fixtures.length) finished = true;
      player.pointsBank = pointsBank;
      player.overall = D.overallFromAttrs(player.attrs);
      return summary();
    }

    function autoPlayCurrentMatch() {
      if (!pendingMatch) return null;
      const snap = pendingMatch.match.skipToEnd(true);
      return applyMatchResult(snap);
    }

    function autoPlayRestOfSeason() {
      const results = [];
      if (pendingMatch) results.push(autoPlayCurrentMatch());
      while (!finished) {
        startNextMatch();
        if (seasonEvent && seasonEvent.unresolved) {
          // auto: pierwsza opcja
          resolveSeasonEventChoice(0);
        }
        if (!pendingMatch) break;
        // w autoPlayRest zawsze symuluj
        const snap = pendingMatch.match.skipToEnd(true);
        results.push(applyMatchResult(snap));
      }
      return results;
    }

    function spendPoint(attrKey) {
      if (pointsBank <= 0) return false;
      if (!D.ATTR_KEYS.includes(attrKey)) return false;
      if ((player.attrs[attrKey] || 0) >= 99) return false;
      player.attrs[attrKey] = clamp((player.attrs[attrKey] || 40) + 1, 1, 99);
      pointsBank -= 1;
      player.pointsBank = pointsBank;
      player.overall = D.overallFromAttrs(player.attrs);
      return true;
    }

    function summary() {
      return {
        index,
        played,
        total: fixtures.length,
        finished,
        tablePoints,
        totals: {
          ...totals,
          avgRating: totals.ratingN ? +(totals.ratingSum / totals.ratingN).toFixed(2) : 0
        },
        pointsBank,
        seasonLog: seasonLog.slice(-20),
        seasonEvent,
        pendingMatch: pendingMatch
          ? {
              fixture: pendingMatch.fixture,
              interactive: pendingMatch.interactive,
              weather: pendingMatch.weather,
              snap: pendingMatch.match.snapshot()
            }
          : null,
        player: {
          name: player.name,
          position: player.position,
          overall: player.overall,
          attrs: { ...player.attrs },
          soft: { ...player.soft },
          pointsBank
        },
        mode,
        club
      };
    }

    return {
      startNextMatch,
      autoPlayCurrentMatch,
      autoPlayRestOfSeason,
      applyMatchResult,
      resolveSeasonEventChoice,
      spendPoint,
      summary,
      getMatch: () => pendingMatch && pendingMatch.match,
      get pendingMatch() {
        return pendingMatch;
      },
      get fixtures() {
        return fixtures;
      }
    };
  }

  global.LabSeason = Object.freeze({ createSeason });
})(typeof window !== 'undefined' ? window : globalThis);
