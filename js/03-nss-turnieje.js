/*
 * NSS — eliminacje, EURO 24, mundial 48, grupy i pełne drabinki.
 * Moduł nie zna głównego stanu kariery ani DOM-u.
 *
 * Zależność: 01-nss-dane-reprezentacji.js
 */
(function (global) {
  'use strict';

  if (!global.NSSNationalData) {
    throw new Error('Najpierw załaduj 01-nss-dane-reprezentacji.js');
  }

  const DATA=global.NSSNationalData;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const GROUP_PAIRS=[[[0,3],[1,2]],[[0,2],[3,1]],[[0,1],[2,3]]];

  function createEngine(options={}) {
    const random=options.random||Math.random;
    const rand=(a,b)=>Math.floor(random()*(b-a+1))+a;
    const pick=arr=>arr[Math.floor(random()*arr.length)];
    const shuffle=arr=>{
      const out=arr.slice();
      for(let i=out.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));
        [out[i],out[j]]=[out[j],out[i]];
      }
      return out;
    };
    const poisson=lambda=>{
      if(lambda<=0) return 0;
      const limit=Math.exp(-lambda);
      let k=0,p=1;
      do{k++;p*=random();}while(p>limit&&k<60);
      return k-1;
    };
    const byName=new Map(DATA.teams.map(team=>[team.name,team]));

    function rankQualificationPool(teams,spreadA=12,spreadB=8) {
      return teams.map(team=>({
        team,
        score:team.baseOvr+rand(-spreadA,spreadA)+rand(-spreadB,spreadB),
        tie:random()
      })).sort((a,b)=>b.score-a.score||b.team.baseOvr-a.team.baseOvr||b.tie-a.tie);
    }

    function confederation(team) {
      if(team.name==='Australia') return 'AFC';
      if(team.zone==='Europa') return 'UEFA';
      if(team.zone==='Afryka') return 'CAF';
      if(team.zone==='Azja') return 'AFC';
      if(team.zone==='Ameryka Południowa') return 'CONMEBOL';
      if(team.zone==='Ameryka Północna'||team.zone==='Ameryka Środkowa') return 'CONCACAF';
      return 'OFC';
    }

    function playoffWinner(a,b) {
      const chanceA=clamp(Math.round(50+(a.baseOvr-b.baseOvr)*2.5),18,82);
      return rand(1,100)<=chanceA?a:b;
    }

    function qualifyEuro(forcePoland=false) {
      const europe=DATA.teams.filter(team=>team.zone==='Europa');
      const ranking=rankQualificationPool(europe,14,9);
      const polandEntry=ranking.find(entry=>entry.team.name==='Polska');
      let direct=ranking.slice(0,24);
      if(forcePoland&&!direct.some(entry=>entry.team.name==='Polska')){
        direct=ranking.filter(entry=>entry.team.name!=='Polska').slice(0,23).concat(polandEntry);
      }
      return {
        kind:'EURO',
        teams:direct.map(entry=>entry.team),
        qualifiedTeamNames:direct.map(entry=>entry.team.name),
        polandQualified:direct.some(entry=>entry.team.name==='Polska'),
        polandRank:ranking.indexOf(polandEntry)+1,
        polandScore:polandEntry.score,
        ranking
      };
    }

    function qualifyWorld(forcePoland=false) {
      const pools={UEFA:[],AFC:[],CAF:[],CONCACAF:[],CONMEBOL:[],OFC:[]};
      DATA.teams.forEach(team=>pools[confederation(team)].push(team));
      const directTeams=[],playoffCandidates=[],rankings={};
      let polandRank=null,polandScore=null;

      Object.keys(DATA.config.worldSlots).forEach(confed=>{
        const spec=DATA.config.worldSlots[confed];
        const ranking=confed==='UEFA'
          ? rankQualificationPool(pools[confed],18,12)
          : rankQualificationPool(pools[confed]);
        rankings[confed]=ranking;

        if(confed==='UEFA'){
          const polandEntry=ranking.find(entry=>entry.team.name==='Polska');
          polandRank=ranking.indexOf(polandEntry)+1;
          polandScore=polandEntry.score;
          let direct=ranking.slice(0,spec.direct);
          if(forcePoland&&!direct.some(entry=>entry.team.name==='Polska')){
            direct=ranking.filter(entry=>entry.team.name!=='Polska')
              .slice(0,spec.direct-1).concat(polandEntry);
          }
          directTeams.push(...direct.map(entry=>entry.team));
        } else {
          directTeams.push(...ranking.slice(0,spec.direct).map(entry=>entry.team));
          playoffCandidates.push(...ranking
            .slice(spec.direct,spec.direct+spec.playoff).map(entry=>entry.team));
        }
      });

      const seeded=playoffCandidates.slice().sort((a,b)=>b.baseOvr-a.baseOvr).slice(0,2);
      const unseeded=shuffle(playoffCandidates.filter(team=>!seeded.includes(team)));
      const semiA=playoffWinner(unseeded[0],unseeded[1]);
      const semiB=playoffWinner(unseeded[2],unseeded[3]);
      const playoffWinners=[playoffWinner(seeded[0],semiA),playoffWinner(seeded[1],semiB)];
      const teams=directTeams.concat(playoffWinners);

      return {
        kind:'WORLD',
        teams,
        qualifiedTeamNames:teams.map(team=>team.name),
        polandQualified:teams.some(team=>team.name==='Polska'),
        polandRank,
        polandScore,
        rankings,
        directTeams,
        playoffCandidates,
        playoffWinners
      };
    }

    function qualify(kind,settings={}) {
      return kind==='WORLD'
        ? qualifyWorld(!!settings.forcePoland)
        : qualifyEuro(!!settings.forcePoland);
    }

    function createField(kind,qualifiedTeamNames=null) {
      const expected=kind==='WORLD'?48:24;
      let selected=Array.isArray(qualifiedTeamNames)
        ? qualifiedTeamNames.map(name=>byName.get(name)).filter(Boolean)
        : [];
      if(selected.length!==expected||!selected.some(team=>team.name==='Polska')){
        selected=qualify(kind,{forcePoland:true}).teams;
      }
      const golden=random()<DATA.config.goldenGenerationChance/100;
      const polandStrength=golden
        ? pick(DATA.config.goldenGenerationOvr)
        : rand(85-DATA.config.tournamentFormSpread,85+DATA.config.tournamentFormSpread);
      return selected.map(team=>({
        name:team.name,
        zone:team.zone,
        tier:team.tier,
        baseOvr:team.baseOvr,
        strength:team.name==='Polska'
          ? polandStrength
          : rand(team.range[0],team.range[1]),
        isPoland:team.name==='Polska',
        goldenGeneration:team.name==='Polska'&&golden
      }));
    }

    function resolveAbstractMatch(strengthA,strengthB) {
      const diff=strengthA-strengthB;
      const swing=clamp(diff/16,-1.3,1.3);
      return {
        gf:poisson(Math.max(.18,1.30+swing*.85)),
        ga:poisson(Math.max(.18,1.30-swing*.85))
      };
    }

    function buildFixtures(teams) {
      return GROUP_PAIRS.map(round=>round.map(([i,j])=>[teams[i],teams[j]]));
    }

    function recordResult(standings,a,b,gfA,gfB) {
      const sa=standings[a.name],sb=standings[b.name];
      sa.played++;sb.played++;
      sa.gf+=gfA;sa.ga+=gfB;sb.gf+=gfB;sb.ga+=gfA;
      if(gfA>gfB)sa.pts+=3;
      else if(gfA<gfB)sb.pts+=3;
      else{sa.pts++;sb.pts++;}
    }

    function rankStandings(standings) {
      return Object.values(standings).sort((a,b)=>
        b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||
        (a.team.name<b.team.name?-1:1)
      );
    }

    function assignGroups(field,groupCount) {
      const sorted=field.slice().sort((a,b)=>b.strength-a.strength);
      const pots=Array.from({length:4},(_,i)=>sorted.slice(i*groupCount,(i+1)*groupCount));
      const names=Array.from({length:groupCount},(_,i)=>String.fromCharCode(65+i));
      const groups=Object.fromEntries(names.map(name=>[name,[]]));
      pots.forEach(pot=>shuffle(pot).forEach((team,i)=>groups[names[i]].push(team)));
      return {groups,groupNames:names};
    }

    function createGroupStage(kind,field) {
      const isWorld=kind==='WORLD';
      const groupCount=isWorld?12:6;
      const thirdAdvanceCount=isWorld?8:4;
      const {groups,groupNames}=assignGroups(field,groupCount);
      const polandGroup=groupNames.find(name=>groups[name].some(team=>team.isPoland));
      const fixtures={},results={},standings={},prepared=new Set(),recorded=new Set();

      groupNames.forEach(name=>{
        fixtures[name]=buildFixtures(groups[name]);
        results[name]=[[],[],[]];
        standings[name]={};
        groups[name].forEach(team=>{
          standings[name][team.name]={team,pts:0,gf:0,ga:0,played:0};
        });
      });

      function prepareRound(roundIndex) {
        if(roundIndex<0||roundIndex>2) throw new Error('Kolejka musi być od 0 do 2.');
        if(!prepared.has(roundIndex)){
          groupNames.forEach(group=>{
            fixtures[group][roundIndex].forEach(([a,b])=>{
              if(a.isPoland||b.isPoland)return;
              const score=resolveAbstractMatch(a.strength,b.strength);
              recordResult(standings[group],a,b,score.gf,score.ga);
              results[group][roundIndex].push({a,b,...score});
            });
          });
          prepared.add(roundIndex);
        }
        const pair=fixtures[polandGroup][roundIndex].find(([a,b])=>a.isPoland||b.isPoland);
        const [a,b]=pair;
        return {
          roundIndex,
          a,b,
          poland:a.isPoland?a:b,
          opponent:a.isPoland?b:a
        };
      }

      function recordPolandMatch(roundIndex,polandScore) {
        if(recorded.has(roundIndex)) throw new Error('Wynik Polski w tej kolejce już zapisano.');
        const fixture=prepareRound(roundIndex);
        const gfA=fixture.a.isPoland?polandScore.gf:polandScore.ga;
        const gfB=fixture.a.isPoland?polandScore.ga:polandScore.gf;
        recordResult(standings[polandGroup],fixture.a,fixture.b,gfA,gfB);
        results[polandGroup][roundIndex].push({a:fixture.a,b:fixture.b,gf:gfA,ga:gfB});
        recorded.add(roundIndex);
      }

      function finish() {
        if(recorded.size!==3) throw new Error('Najpierw rozegraj trzy mecze Polski.');
        const rankings={};
        groupNames.forEach(name=>rankings[name]=rankStandings(standings[name]));
        const allThirds=groupNames.map(group=>({...rankings[group][2],group}))
          .sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||
            (a.team.name<b.team.name?-1:1));
        const bestThirds=allThirds.slice(0,thirdAdvanceCount);
        const qualifiedTeams=[];
        groupNames.forEach(group=>{
          rankings[group].slice(0,2).forEach((row,index)=>qualifiedTeams.push({
            ...row.team,
            group,
            groupPosition:index+1,
            groupPts:row.pts,
            groupGf:row.gf,
            groupGa:row.ga
          }));
        });
        bestThirds.forEach(row=>qualifiedTeams.push({
          ...row.team,
          group:row.group,
          groupPosition:3,
          groupPts:row.pts,
          groupGf:row.gf,
          groupGa:row.ga
        }));
        const polandTable=rankings[polandGroup];
        const polandRow=polandTable.find(row=>row.team.isPoland);
        const polandPosition=polandTable.indexOf(polandRow)+1;
        return {
          kind,groups,groupNames,polandGroup,standings,rankings,results,
          allThirds,bestThirds,qualifiedTeams,polandRow,polandPosition,
          polandQualified:qualifiedTeams.some(team=>team.isPoland)
        };
      }

      return {
        kind,groups,groupNames,polandGroup,standings,results,
        prepareRound,recordPolandMatch,
        getPolandTable:()=>rankStandings(standings[polandGroup]),
        getRoundResults:index=>results[polandGroup][index].slice(),
        finish
      };
    }

    function compareSeeds(a,b) {
      return a.groupPosition-b.groupPosition||
        b.groupPts-a.groupPts||
        ((b.groupGf-b.groupGa)-(a.groupGf-a.groupGa))||
        b.groupGf-a.groupGf||(a.name<b.name?-1:1);
    }

    function buildInitialRound(qualifiedTeams) {
      const ordered=qualifiedTeams.slice().sort(compareSeeds);
      const half=ordered.length/2;
      const seededBase=ordered.slice(0,half);
      const unseededBase=ordered.slice(half);
      for(let attempt=0;attempt<200;attempt++){
        const seeded=shuffle(seededBase),available=shuffle(unseededBase),matches=[];
        let valid=true;
        for(const a of seeded){
          const candidates=available.filter(b=>b.group!==a.group);
          if(!candidates.length){valid=false;break;}
          const b=pick(candidates);
          available.splice(available.indexOf(b),1);
          matches.push({a,b,result:null,winner:null});
        }
        if(valid)return matches;
      }
      throw new Error('Nie udało się utworzyć drabinki bez rewanżu grupowego.');
    }

    function resolveKnockoutMatch(a,b) {
      let {gf,ga}=resolveAbstractMatch(a.strength,b.strength);
      let extra=false,penalties=false;
      if(gf===ga){
        extra=true;
        const diff=(a.strength-b.strength)/22;
        gf+=poisson(Math.max(.08,.32+diff*.22));
        ga+=poisson(Math.max(.08,.32-diff*.22));
      }
      if(gf===ga){
        penalties=true;
        const chanceA=clamp(.5+(a.strength-b.strength)/260,.36,.64);
        if(random()<chanceA)gf++;else ga++;
      }
      return {gf,ga,extra,penalties};
    }

    function roundName(size) {
      if(size===32)return '1/16 FINAŁU';
      if(size===16)return '1/8 FINAŁU';
      if(size===8)return 'ĆWIERĆFINAŁ';
      if(size===4)return 'PÓŁFINAŁ';
      return 'FINAŁ';
    }

    function simulateRemainder(resolvedMatches) {
      let winners=resolvedMatches.map(match=>match.winner);
      const rounds=[];
      while(winners.length>1){
        const matches=[];
        for(let i=0;i<winners.length;i+=2){
          const match={a:winners[i],b:winners[i+1],result:null,winner:null};
          match.result=resolveKnockoutMatch(match.a,match.b);
          match.winner=match.result.gf>match.result.ga?match.a:match.b;
          matches.push(match);
        }
        rounds.push({name:roundName(winners.length),matches});
        winners=matches.map(match=>match.winner);
      }
      return {champion:winners[0],rounds};
    }

    function createKnockout(kind,qualifiedTeams) {
      let size=kind==='WORLD'?32:16;
      let matches=buildInitialRound(qualifiedTeams);
      let resolved=false,finished=false;

      function getPolandMatch() {
        return matches.find(match=>match.a.isPoland||match.b.isPoland)||null;
      }

      function resolveRound(polandResult) {
        if(finished)throw new Error('Turniej jest zakończony.');
        if(resolved)throw new Error('Ta runda została już rozstrzygnięta.');
        const polandMatch=getPolandMatch();
        if(!polandMatch)throw new Error('Polska nie znajduje się w aktywnej rundzie.');
        const result=polandMatch.a.isPoland
          ? {gf:polandResult.gf,ga:polandResult.ga,extra:!!polandResult.extra,penalties:!!polandResult.penalties}
          : {gf:polandResult.ga,ga:polandResult.gf,extra:!!polandResult.extra,penalties:!!polandResult.penalties};
        polandMatch.result=result;
        polandMatch.winner=result.gf>result.ga?polandMatch.a:polandMatch.b;
        matches.forEach(match=>{
          if(match===polandMatch)return;
          match.result=resolveKnockoutMatch(match.a,match.b);
          match.winner=match.result.gf>match.result.ga?match.a:match.b;
        });
        resolved=true;
        const polandWon=polandMatch.winner.isPoland;
        if(!polandWon){
          const remainder=simulateRemainder(matches);
          finished=true;
          return {polandWon:false,finished:true,champion:remainder.champion,matches:matches.slice(),remainder};
        }
        if(size===2){
          finished=true;
          return {polandWon:true,finished:true,champion:polandMatch.winner,matches:matches.slice()};
        }
        return {polandWon:true,finished:false,matches:matches.slice()};
      }

      function advance() {
        if(finished)throw new Error('Turniej jest zakończony.');
        if(!resolved)throw new Error('Najpierw rozstrzygnij bieżącą rundę.');
        const winners=matches.map(match=>match.winner),next=[];
        for(let i=0;i<winners.length;i+=2){
          next.push({a:winners[i],b:winners[i+1],result:null,winner:null});
        }
        matches=next;
        size/=2;
        resolved=false;
        return {size,name:roundName(size),matches:matches.slice(),polandMatch:getPolandMatch()};
      }

      return {
        kind,
        getRound:()=>({size,name:roundName(size),matches:matches.slice(),resolved,finished}),
        getPolandMatch,
        resolveRound,
        advance
      };
    }

    return {
      qualify,
      createField,
      createGroupStage,
      createKnockout,
      resolveAbstractMatch,
      confederation,
      roundName
    };
  }

  global.NSSTournamentEngine=Object.freeze({
    version:'0.69-transfer-1',
    createEngine
  });
})(typeof window !== 'undefined' ? window : globalThis);
