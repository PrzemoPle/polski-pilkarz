/*
 * NSS — adapter do gry typu Polska Kariera.
 *
 * Ten plik jest jedynym miejscem, które powinno wymagać dopasowania
 * do nowszej wersji gry. Rdzenie 01–03 pozostają nietknięte.
 */
(function (global) {
  'use strict';

  function installPolskaKarieraNSS(host) {
    const state=()=>host.getState();
    const tournamentEngine=global.NSSTournamentEngine.createEngine();
    const matchEngine=global.NSSMatchEngine.createEngine();
    let afterTournament=null;

    const poisson=lambda=>{
      if(lambda<=0)return 0;
      const limit=Math.exp(-lambda);
      let k=0,p=1;
      do{k++;p*=Math.random();}while(p>limit&&k<60);
      return k-1;
    };

    function simulatedPlayerStats(matches){
      const s=state();
      const quality=Math.max(.72,Math.min(1.35,.82+((s.overall||60)-60)*.018));
      const rates=s.position==='FWD'
        ? {goals:.32,assists:.13}
        : s.position==='MID'
          ? {goals:.11,assists:.24}
          : {goals:.025,assists:.055};
      return {
        goals:poisson(matches*rates.goals*quality),
        assists:poisson(matches*rates.assists*quality)
      };
    }

    function resolveAutomaticKnockout(poland,opponent){
      const result=tournamentEngine.resolveAbstractMatch(poland.strength,opponent.strength);
      if(result.gf!==result.ga)return result;
      const chance=Math.max(.36,Math.min(.64,.5+(poland.strength-opponent.strength)/260));
      if(Math.random()<chance)result.gf++;
      else result.ga++;
      result.extra=true;
      result.penalties=true;
      return result;
    }

    function simulateNationalTournament(kind,qualifiedTeamNames){
      const field=tournamentEngine.createField(kind,qualifiedTeamNames);
      const groups=tournamentEngine.createGroupStage(kind,field);
      const polandMatches=[];

      for(let round=0;round<3;round++){
        const fixture=groups.prepareRound(round);
        const result=tournamentEngine.resolveAbstractMatch(fixture.poland.strength,fixture.opponent.strength);
        groups.recordPolandMatch(round,result);
        polandMatches.push({
          phase:`GRUPA ${groups.polandGroup} • ${round+1}. KOLEJKA`,
          opponent:fixture.opponent.name,gf:result.gf,ga:result.ga
        });
      }

      const groupResult=groups.finish();
      if(!groupResult.polandQualified){
        return {kind,champion:false,stage:'faza grupowa',tournamentChampion:null,field,groupResult,polandMatches};
      }

      const knockout=tournamentEngine.createKnockout(kind,groupResult.qualifiedTeams);
      while(true){
        const round=knockout.getRound();
        const match=knockout.getPolandMatch();
        const poland=match.a.isPoland?match.a:match.b;
        const opponent=match.a.isPoland?match.b:match.a;
        const result=resolveAutomaticKnockout(poland,opponent);
        const resolved=knockout.resolveRound(result);
        polandMatches.push({phase:round.name,opponent:opponent.name,gf:result.gf,ga:result.ga});
        if(resolved.finished){
          const champion=!!resolved.champion?.isPoland;
          return {
            kind,champion,
            stage:champion?(kind==='WORLD'?'MISTRZOSTWO ŚWIATA':'MISTRZOSTWO EUROPY'):round.name,
            tournamentChampion:resolved.champion?.name||null,
            field,groupResult,polandMatches
          };
        }
        knockout.advance();
      }
    }

    function recordTournamentResult(result,watched){
      const s=state();
      const pending=s.pendingTournament;
      const isWorld=result.kind==='WORLD';
      const historyKey=isWorld?'worldCupHistory':'euroHistory';
      const label=isWorld?'MUNDIAL':'EURO';

      s.nationalGoals=(s.nationalGoals||0)+(result.stats.goals||0);
      s.score=(s.score||0)+Math.round((result.stats.goals||0)*4+(result.stats.assists||0)*3);
      if(result.champion){
        host.addTrophy(
          `${isWorld?'Mistrzostwo Świata':'Mistrzostwo Europy'} ${result.year} — Polska`,
          isWorld?120:90
        );
      }

      const poland=result.field.find(team=>team.isPoland);
      s[historyKey]=s[historyKey]||{};
      s[historyKey][result.year]={
        qualified:true,
        qualificationRank:pending?.qualificationRank||null,
        qualifiedTeamNames:pending?.qualifiedTeamNames?.slice()||null,
        result:result.stage,
        text:`${isWorld?'🌍':'🇪🇺'} ${label} ${result.year}: Polska — ${result.stage}.`,
        watched:!!watched,
        simulated:!watched,
        myGoals:result.stats.goals||0,
        myAssists:result.stats.assists||0,
        polandStrength:poland?.strength||null,
        goldenGeneration:!!poland?.goldenGeneration,
        tournamentChampion:result.tournamentChampion||null,
        polandMatches:(result.polandMatches||[]).map(match=>({...match}))
      };
      delete s.pendingTournament;
      host.log(
        `${label} ${result.year}: Polska — ${result.stage}.`,
        `${watched?'turniej rozegrany':'wynik wylosowany'}${result.tournamentChampion?` • mistrz: ${result.tournamentChampion}`:''}`
      );
      host.render();
      return result;
    }

    const controller=global.NSSTournamentUI.createController({
      root:host.tournamentRoot||'#nssTournamentRoot',
      tournamentEngine,
      matchEngine,
      delays:host.uiDelays,
      getPlayer:()=>{
        const s=state();
        return {
          overall:s.overall,
          position:s.position,
          status:s.status,
          isCaptain:s.isCaptain,
          finishingBias:s.finishingBias,
          creativeBias:s.creativeBias,
          nextMinutesFactor:s.nextMinutesFactor,
          eventMultiplier:s.activePlayerEventMultiplier||1,
          name:s.name,
          teammates:Math.max(0,Math.min(100,Math.round(((s.loyalty||0)/15)*100)))
        };
      },
      applyPlayerPatch:patch=>{
        const s=state();
        if(Number.isFinite(patch.nextMinutesFactor)){
          s.nextMinutesFactor=Math.min(s.nextMinutesFactor||1,patch.nextMinutesFactor);
        }
      },
      log:(title,meta)=>host.log(title,meta),
      setHostVisible:visible=>host.setCareerVisible(visible),
      onTournamentComplete:result=>{
        recordTournamentResult(result,true);
        if(afterTournament){
          const done=afterTournament;
          afterTournament=null;
          done(result);
        }
      }
    });

    function qualificationYear(kind,seasonYear) {
      const year=seasonYear+1;
      if(kind==='WORLD')return year>=2030&&(year-2026)%4===0?year:null;
      return year>=2028&&(year-2028)%4===0?year:null;
    }

    function checkQualification(kind) {
      const s=state();
      const year=qualificationYear(kind,s.seasonYear);
      // Pojedynczy próbny sparing zawodnika 74–76 OVR nie oznacza jeszcze
      // miejsca w kadrze na wielki turniej. EURO/mundial są dostępne od
      // poziomu szerokiego składu reprezentacji (77 OVR).
      if(!year||s.national!=='Polska'||!(s.seasonNationalCaps>0)||s.overall<77)return '';
      const historyKey=kind==='WORLD'?'worldCupHistory':'euroHistory';
      s[historyKey]=s[historyKey]||{};
      if(s[historyKey][year])return s[historyKey][year].text||'';

      const qualification=tournamentEngine.qualify(kind);
      const qualified=qualification.polandQualified;
      const total=kind==='WORLD'?41:41;
      const spots=kind==='WORLD'?16:24;
      const label=kind==='WORLD'?'MUNDIAL':'EURO';
      const icon=kind==='WORLD'?'🌍':'🇪🇺';
      const qualifiedTeamNames=qualification.qualifiedTeamNames.slice();
      let text;

      if(qualified){
        if(kind==='WORLD')s.worldCups=(s.worldCups||0)+1;
        else s.euros=(s.euros||0)+1;
        text=`${icon} ${label} ${year}: Polska awansowała! (${qualification.polandRank}. miejsce; awansuje ${spots}/${total}).`;
        s.pendingTournament={
          kind,year,qualRoll:null,
          qualificationRank:qualification.polandRank,
          qualifiedTeamNames
        };
      }else{
        text=`${icon} ${label} ${year}: Polska nie awansowała (${qualification.polandRank}. miejsce; awansuje ${spots}/${total}).`;
      }
      s[historyKey][year]={
        qualified,
        qualificationRank:qualification.polandRank,
        qualifiedTeamNames,
        pending:qualified,
        text
      };
      host.log(
        `${label} ${year}: Polska ${qualified?'awansowała':'nie awansowała'}.`,
        `${qualification.polandRank}. miejsce • OVR 85`
      );
      return text;
    }

    function playPendingTournament(onDone=()=>{}) {
      const pending=state().pendingTournament;
      if(!pending)throw new Error('Brak turnieju oczekującego na rozegranie.');
      afterTournament=onDone;
      return controller.playTournament({
        kind:pending.kind,
        year:pending.year,
        qualifiedTeamNames:pending.qualifiedTeamNames
      });
    }

    function simulatePendingTournament() {
      const pending=state().pendingTournament;
      if(!pending)throw new Error('Brak turnieju oczekującego na wylosowanie.');
      const simulated=simulateNationalTournament(pending.kind,pending.qualifiedTeamNames);
      const stats=simulatedPlayerStats(simulated.polandMatches.length);
      return recordTournamentResult({
        ...simulated,
        year:pending.year,
        stats
      },false);
    }

    // Pojedynczy mecz decydujący na poziomie klubu (mistrzostwo, awans, puchar —
    // krajowy lub zagraniczny). Nie dotyczy reprezentacji, więc nie rusza
    // pendingTournament/historii EURO-mundial. Zwraca wynik meczu (gf/ga/...).
    function playClubDecisiveMatch({kicker,homeName,homeStrength,opponent,knockout}) {
      return controller.playStandaloneMatch({
        kicker,
        homeName,
        fixture:{poland:{strength:homeStrength}, opponent},
        knockout
      });
    }

    return {
      tournamentEngine,
      matchEngine,
      controller,
      checkEuro:()=>checkQualification('EURO'),
      checkWorldCup:()=>checkQualification('WORLD'),
      playPendingTournament,
      simulatePendingTournament,
      playClubDecisiveMatch
    };
  }

  global.installPolskaKarieraNSS=installPolskaKarieraNSS;
})(typeof window !== 'undefined' ? window : globalThis);
