/*
 * Polski Piłkarz Simulator v1.07 — rdzeń silnika (stan, render, symulacja sezonu).
 * Wymaga wcześniej wczytanych: 01–03/06/07 (NSS), 08 (dane klubów),
 * 09 (decyzje) — patrz index.html.
 */
(() => {
  const $ = s => document.querySelector(s);
  const els = {
    setupView: $('#setupView'), offersView: $('#offersView'), careerView: $('#careerView'), retirementView: $('#retirementView'),
    setupForm: $('#setupForm'), region: $('#region'), offersGrid: $('#offersGrid'), offerRegion: $('#offerRegion'),
    newCareerBtn: $('#newCareerBtn'), restartBtn: $('#restartBtn'), playSeasonBtn: $('#playSeasonBtn'),
    playerNameLabel: $('#playerNameLabel'), playerRegionLabel: $('#playerRegionLabel'), playerMeta: $('#playerMeta'), shirtNumber: $('#shirtNumber'),
    overallValue: $('#overallValue'), ageValue: $('#ageValue'), clubValue: $('#clubValue'), clubTierValue: $('#clubTierValue'), statusValue: $('#statusValue'), nationalValue: $('#nationalValue'), playChanceValue: $('#playChanceValue'), professionalismValue: $('#professionalismValue'), loyaltyValue: $('#loyaltyValue'), recognitionValue: $('#recognitionValue'), injuryRiskValue: $('#injuryRiskValue'),
    relCoach: $('#relCoach'), relSquad: $('#relSquad'), relFans: $('#relFans'), relAgent: $('#relAgent'), energyValue: $('#energyValue'),
    shareCardBtn: $('#shareCardBtn'),
    seasonLabel: $('#seasonLabel'), seasonHeadline: $('#seasonHeadline'), valueLabel: $('#valueLabel'), appsStat: $('#appsStat'), goalsStat: $('#goalsStat'), assistsStat: $('#assistsStat'), minutesStat: $('#minutesStat'),
    eventBox: $('#eventBox'), decisionBox: $('#decisionBox'), decisionTitle: $('#decisionTitle'), decisionText: $('#decisionText'), decisionChoices: $('#decisionChoices'),
    timeline: $('#timeline'), careerScore: $('#careerScore'), retireTitle: $('#retireTitle'), retireVerdict: $('#retireVerdict'), retireStats: $('#retireStats'), retireClubs: $('#retireClubs'), retireSeasons: $('#retireSeasons'),
    retirementSummary: $('#retirementSummary'), profile89Btn: $('#profile89Btn'), profile89View: $('#profile89View'), profile89Content: $('#profile89Content'), profile89BackBtn: $('#profile89BackBtn'),
    patronitePrompt: $('#patronitePrompt'), patronitePromptClose: $('#patronitePromptClose'), patronitePromptCloseX: $('#patronitePromptCloseX'), patronitePromptLink: $('#patronitePromptLink')
  };

  let state = null;
  const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];

  const PATRONITE_PROMPT_MS=30*60*1000;
  const PATRONITE_TIME_KEY='pps-active-play-ms';
  const PATRONITE_SEEN_KEY='pps-patronite-prompt-seen';
  const safeLocalGet=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
  const safeLocalSet=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){/* standalone file:// może nie mieć localStorage */}};
  let patroniteActiveMs=Math.max(0,Number(safeLocalGet(PATRONITE_TIME_KEY))||0);
  let patronitePromptSeen=safeLocalGet(PATRONITE_SEEN_KEY)==='1';
  let patronitePromptShown=false;
  let patroniteLastTick=Date.now();
  let patroniteLastSaved=patroniteActiveMs;

  function closePatronitePrompt(){
    patronitePromptSeen=true;
    safeLocalSet(PATRONITE_SEEN_KEY,'1');
    safeLocalSet(PATRONITE_TIME_KEY,Math.round(patroniteActiveMs));
    els.patronitePrompt?.classList.add('hidden');
  }

  function showPatronitePrompt(){
    if(patronitePromptSeen || patronitePromptShown || !els.patronitePrompt) return;
    patronitePromptShown=true;
    els.patronitePrompt.classList.remove('hidden');
    els.patronitePromptClose?.focus();
  }

  // Liczymy tylko czas po rozpoczęciu kariery i tylko wtedy, gdy karta jest
  // widoczna. Długi powrót z tła nie dopisuje od razu całej przerwy.
  setInterval(()=>{
    const now=Date.now();
    if(state && document.visibilityState!=='hidden' && !patronitePromptSeen){
      patroniteActiveMs+=Math.min(2000,Math.max(0,now-patroniteLastTick));
      if(patroniteActiveMs-patroniteLastSaved>=10000){
        safeLocalSet(PATRONITE_TIME_KEY,Math.round(patroniteActiveMs));
        patroniteLastSaved=patroniteActiveMs;
      }
      if(patroniteActiveMs>=PATRONITE_PROMPT_MS) showPatronitePrompt();
    }
    patroniteLastTick=now;
  },1000);

  // Umowna skala świata gry. To nie jest "obiektywny ranking historii",
  // tylko punkt odniesienia dla sekretnego endgame'u kariery.
  //
  // Pula ma 25 legend. Cztery największe kotwice są zawsze obecne,
  // a pozostałe pięć nazwisk w historycznym TOP 10 jest losowane
  // przy odblokowaniu Trybu Legendy.
  const FOOTBALL_HISTORY_REFERENCE=[
    {name:'Lionel Messi',ovr:109,anchor:true},
    {name:'Pelé',ovr:109,anchor:true},
    {name:'Diego Maradona',ovr:108,anchor:true},
    {name:'Cristiano Ronaldo',ovr:108,anchor:true},

    {name:'Johan Cruyff',ovr:107},
    {name:'Ronaldo Nazário',ovr:107},
    {name:'Alfredo Di Stéfano',ovr:106},
    {name:'Ferenc Puskás',ovr:106},
    {name:'Franz Beckenbauer',ovr:106},

    {name:'Zinédine Zidane',ovr:105},
    {name:'Michel Platini',ovr:105},
    {name:'Garrincha',ovr:105},
    {name:'Ronaldinho',ovr:104},
    {name:'Eusébio',ovr:104},
    {name:'Gerd Müller',ovr:104},
    {name:'Marco van Basten',ovr:104},

    {name:'George Best',ovr:103},
    {name:'Zico',ovr:103},
    {name:'Romário',ovr:103},
    {name:'Andrés Iniesta',ovr:103},
    {name:'Xavi',ovr:103},

    {name:'Luka Modrić',ovr:102},
    {name:'Neymar',ovr:102},
    {name:'Kylian Mbappé',ovr:102},
    {name:'Lew Jaszyn',ovr:102}
  ];

  function overallCap(){
    const standard=state && state.legendEraActive ? 110 : 99;
    return Math.max(standard,state?.grajewskiOverallCap||0);
  }

  function updateLegendPeak(){
    state.peakOverall=Math.max(state.peakOverall||0,state.overall||0);
    if(state.legendUnlocked){
      state.legendPeakOverall=Math.max(state.legendPeakOverall||0,state.overall||0);
    }
  }

  function noteLegendOverallChange(before){
    updateLegendPeak();
    const standardCap=state.legendEraActive?110:99;
    if((state.grajewskiOverallCap||0)>standardCap && state.overall<=standardCap){
      state.grajewskiOverallCap=0;
    }
    if(state.legendEraActive && before>=100 && state.overall<100){
      state.legendEraActive=false;
      if(!state.legendRankingShown) state.legendRankingPending=true;
      log('KONIEC ERY 100+',`Szczyt ${state.legendPeakOverall} OVR • sezony 100+: ${state.legendSeasons100||0}`);
    }
  }

  function ensureLegendReferenceSet(){
    if(Array.isArray(state.legendReferenceNames) && state.legendReferenceNames.length===9){
      return state.legendReferenceNames;
    }

    const anchors=FOOTBALL_HISTORY_REFERENCE.filter(x=>x.anchor);
    const rest=shuffle(FOOTBALL_HISTORY_REFERENCE.filter(x=>!x.anchor)).slice(0,5);
    state.legendReferenceNames=[...anchors,...rest].map(x=>x.name);
    return state.legendReferenceNames;
  }

  function selectedLegendReferences(){
    const names=ensureLegendReferenceSet();
    return names
      .map(name=>FOOTBALL_HISTORY_REFERENCE.find(x=>x.name===name))
      .filter(Boolean);
  }

  function legendHistoricalRanking(){
    const player={
      name:state.name,
      ovr:Math.max(state.legendPeakOverall||0,state.peakOverall||0),
      player:true
    };
    return [...selectedLegendReferences(),player]
      .sort((a,b)=>b.ovr-a.ovr || (a.player?1:0)-(b.player?1:0))
      .map((x,i)=>({...x,place:i+1}));
  }

  function legendRankingHtml(){
    const rows=legendHistoricalRanking();
    const playerRow=rows.find(x=>x.player);
    const place=playerRow?playerRow.place:10;
    const peak=Math.max(state.legendPeakOverall||0,state.peakOverall||0);
    return `<div class="legend-ranking">
      <div class="legend-ranking-head">TOP 10 HISTORII • SZCZYT OVR</div>
      ${rows.map(x=>`<div class="legend-row${x.player?' player':''}">
        <strong>${x.place}.</strong><span>${x.player?`${x.name} — TWOJA KARIERA`:x.name}</span><strong>${x.ovr}</strong>
      </div>`).join('')}
    </div>
    <div class="legend-note">Umowny ranking świata gry oparty wyłącznie na najwyższym OVR. Dziewięć legend jest dobieranych z puli 25 nazwisk: Messi, Pelé, Maradona i Cristiano Ronaldo są stałymi punktami odniesienia, pięć pozostałych miejsc jest losowanych dla tej kariery. Twój szczyt: <strong>${peak}</strong> • miejsce: <strong>${place}.</strong> • sezony rozegrane na poziomie 100+: <strong>${state.legendSeasons100||0}</strong>.</div>`;
  }

  function showLegendRanking(onDone){
    state.legendRankingPending=false;
    presentDecision({
      title:'KONIEC ERY • TWOJE MIEJSCE W HISTORII',
      html:`Po raz pierwszy od odblokowania Trybu Legendy spadasz poniżej 100 OVR. Gra zamyka twój historyczny prime i porównuje najwyższy osiągnięty poziom z umowną skalą największych piłkarzy w historii.${legendRankingHtml()}`,
      text:'',
      choices:[{
        label:'DALEJ',
        ovrProfile:null,
        preview:'Ranking zostaje zapisany w historii kariery.',
        act:()=>{ state.legendRankingShown=true; state.legendRankingPending=false; }
      }]
    },onDone);
  }


  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const shuffle = arr => arr.slice().sort(()=>Math.random()-.5);
  const weightedPick = arr => {
    const total=arr.reduce((sum,x)=>sum+Math.max(0.01,x.weight||1),0);
    let roll=Math.random()*total;
    for(const x of arr){ roll-=Math.max(0.01,x.weight||1); if(roll<=0) return x; }
    return arr[arr.length-1];
  };

  Object.keys(GAME_DATA.regions).forEach(r => {
    const o = document.createElement('option'); o.value=r; o.textContent=r; els.region.appendChild(o);
  });

  function randomSetupPlayerName(){
    const pool=Array.isArray(window.POLISH_PLAYER_NAMES)?window.POLISH_PLAYER_NAMES:[];
    return pool.length?pick(pool):'Jacek Cyzio';
  }
  function normalizePlayerName(value){
    return String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pl-PL');
  }
  function isJakubOlkiewicz(value){ return normalizePlayerName(value)==='jakub olkiewicz'; }
  function randomizeSetupScreen(){
    els.region.value=pick(Object.keys(GAME_DATA.regions));
    $('#startPoint').value=pick(['backyard','normal','syrenka','wonderkid']);
    $('#playerName').value=randomSetupPlayerName();
  }
  randomizeSetupScreen();

  function tierName(t){
    if(t===0) return 'bez klubu';
    return GAME_DATA.tierNames[t] || (t===7?GAME_DATA.tier7:GAME_DATA.tier8);
  }
  function isForeignClub(c){ return !!(c && Number.isFinite(c.foreignTier)); }
  function clubTransferRegion(c){
    if(!isForeignClub(c)) return 'POLSKA';
    return c.marketRegion || c.zone || 'Inne';
  }
  function sameLocalTransferRegion(a,b){
    if(!isForeignClub(a) || !isForeignClub(b)) return false;
    if(a.zone==='Europa' || b.zone==='Europa') return a.zone==='Europa' && b.zone==='Europa' && clubTransferRegion(a)===clubTransferRegion(b);
    return a.zone===b.zone;
  }
  function foreignTierName(ft){
    return ({1:'TIER 1 — światowa czołówka',2:'TIER 2 — bardzo mocny klub',3:'TIER 3 — mocna zagranica',4:'TIER 4 — poziom Ekstraklasy/I ligi',5:'TIER 5 — lokalny rynek, poziom I/II ligi',6:'TIER 6 — egzotyczny lokalny rynek'})[ft]||'zagranica';
  }
  function clubCompetition(c){
    if(!c) return '—';
    if(isForeignClub(c)) return `${c.league||'liga krajowa'} • ${c.country||'zagranica'} • T${c.foreignTier}`;
    return tierName(c.tier);
  }
  function clubOfferCompetition(c){
    const base=clubCompetition(c);
    return !isForeignClub(c) && c?.tier<=3 && c.region
      ? `${base} • woj. ${c.region}`
      : base;
  }
  function clubMarketLevel(c){
    if(!isForeignClub(c)) return c?.tier||0;
    return ({6:4.25,5:5.15,4:6.25,3:6.9,2:7.65,1:8.45})[c.foreignTier]||7;
  }
  function requiredForeignRecognition(ft){ return ({6:6,5:12,4:25,3:39,2:56,1:73})[ft]||30; }
  function requiredForeignOvr(ft){ return ({6:28,5:36,4:49,3:65,2:76,1:80})[ft]||50; }

  // v0.53 — jakość rynku transferowego.
  // Geografia wybiera klub DOPIERO w obrębie sensownego poziomu sportowego.
  // Nie może już zepchnąć gwiazdy T1/T2 do przypadkowych ofert T3/T4.
  function foreignTierReachable(ft,performance,fromPoland=false){
    const media=state.recognition||0;
    const ovr=state.overall||0;

    if(fromPoland){
      // Pierwszy wyjazd nadal wymaga medialności — ktoś musi cię zauważyć.
      const recSlack=7;
      const ovrSlack=4;
      if(media < requiredForeignRecognition(ft)-recSlack) return false;
      if(ovr < requiredForeignOvr(ft)-ovrSlack) return false;

      if(ft===1 && performance<34 && !state.seniorInternational && media<82) return false;
      if(ft===2 && performance<29 && !state.seniorInternational && media<62) return false;
      return true;
    }

    // Gdy już jesteś za granicą, rozwój kariery jest przede wszystkim SPORTOWY.
    // Medialność wpływa na zainteresowanie konkretnych klubów, ale nie blokuje
    // zwykłego przejścia T4->T3, T3->T2 itd.
    if(ovr < requiredForeignOvr(ft)-6) return false;

    // T1/T2 nadal potrzebują czegoś więcej niż samego "jestem za dobry na obecny klub",
    // ale wysokie OVR albo status reprezentanta mogą zastąpić słabszą medialność.
    if(ft===1 && performance<34 && !state.seniorInternational && ovr<88 && media<55) return false;
    if(ft===2 && performance<29 && !state.seniorInternational && ovr<80 && media<40) return false;

    return true;
  }

  function hasOutgrownForeignClub(current,performance,apps){
    if(!isForeignClub(current)) return false;
    const startChance=projectedStartChance(current,0);

    // 90%+ oznacza, że zawodnik sportowo wyraźnie przerósł otoczenie.
    if(startChance>=90) return true;

    // Alternatywnie: duża przewaga OVR albo pełny, dobry sezon.
    if(state.overall>=current.strength+8) return true;
    if(apps>=24 && performance>=43 && state.overall>=current.strength+3) return true;

    return false;
  }

  function foreignWorstOfferTier(current,performance,apps,lowStreak){
    if(!isForeignClub(current)) return 4;

    const media=state.recognition||0;
    const ovr=state.overall||0;
    const struggling=apps<8 || performance<30 || lowStreak>=2;

    // Normalnie rynek nie proponuje zejścia jakościowego.
    // Przy fatalnej sytuacji sportowej dopuszczamy najwyżej jeden tier w dół.
    let worst=struggling ? Math.min(6,current.foreignTier+1) : current.foreignTier;

    // Status zawodnika może jeszcze bardziej odciąć słabe oferty.
    if(ovr>=92 && media>=75) worst=Math.min(worst,2);
    else if(ovr>=86 && media>=58) worst=Math.min(worst,3);
    else if(ovr>=78 && media>=40) worst=Math.min(worst,4);

    return worst;
  }

  function firstForeignWindow(performance,current){
    const media=state.recognition||0;
    const apps=state.season?.apps||0;
    let chance=
      8 +
      (media-18)*1.05 +
      (performance-32)*.40 +
      Math.max(0,(state.overall||0)-58)*1.10;

    if(state.seniorInternational) chance+=25;
    if(state.age<=21) chance+=8;
    if(current?.tier===6) chance+=5;
    if(apps<8) chance-=12;

    // Młody reprezentant Ekstraklasy nie powinien czekać latami,
    // aż zagranica w ogóle zauważy jego istnienie.
    if(state.seniorInternational && state.age<=21 && current?.tier>=6 && state.overall>=68)
      chance=Math.max(chance,85);

    if(state.overall>=72 && media>=50) chance=Math.max(chance,90);
    return clamp(Math.round(chance),4,95);
  }
  function formatMoney(n){
    if(n>=1000000) return `${(n/1000000).toFixed(n>=10000000?0:1).replace('.',',')} mln zł`;
    if(n>=1000) return `${Math.round(n/1000)} tys. zł`;
    return `${n} zł`;
  }
  function show(view){ [els.setupView,els.offersView,els.careerView,els.retirementView].forEach(v=>v.classList.add('hidden')); view.classList.remove('hidden'); }
  function allPolishClubs(){ return Object.values(GAME_DATA.regions).flat(); }
  function seniorClubs(){ return allPolishClubs().filter(c=>!c.reserve); }
  function isEasy(){ return !!state && state.difficulty==='easy'; }

  els.setupForm.addEventListener('submit', e => {
    e.preventDefault();
    const position = $('#position').value;
    const difficulty = $('#difficulty').value;
    const startPoint = $('#startPoint').value;
    const base = startPoint==='backyard' ? rand(29,34)
      : startPoint==='syrenka' ? rand(50,55)
      : startPoint==='wonderkid' ? rand(60,66)
      : rand(39,45);
    state = {
      name: $('#playerName').value.trim() || randomSetupPlayerName(), position, foot: $('#foot').value, region: els.region.value, difficulty, startPoint,
      age:16, seasonYear:2026, overall:base,
      // Awaryjny, ukryty limit długowiecznej kariery. Wylosowany wiek
      // jest ostatnim sezonem gracza; po nim nie pojawi się już rynek.
      hardRetirementAge:rand(52,61),
      talent:rand(35,95),
      professionalism:rand(35,95),
      injuryRisk:rand(8,30),
      club:null, clubHistory:[], shirtNumber: position==='GK'?1:position==='DEF'?rand(2,6):position==='MID'?rand(6,18):rand(9,19), status:'Junior', national:'—', nationalCaps:0, nationalGoals:0, seniorInternational:false,
      season:{apps:0,goals:0,assists:0,minutes:0}, totals:{apps:0,goals:0,assists:0,minutes:0}, trophies:[], trophyHistory:[], awards:[], awardHistory:[], promotions:0, timeline:[], score:0,
      retired:false, pendingDecision:false, boost:0, loyalty:0, loanReturn:null, justRelegated:false, justPromoted:false,
      justNationalCall:false, lastInjuryLost:0, lastInjurySeverity:null, lastInjuryOvrPenalty:0, foreignMoveAge:null, seasonNationalCaps:0, seasonNationalGoals:0,
      adaptability:rand(35,90), recognition:rand(12,32), marketBonus:0, eventMemory:{},
      careerPace:(document.querySelector('input[name="careerPace"]:checked')||{}).value||'normal',
      decisionEvery:1,
      seasonsSinceDecision:0,
      energy:2,
      relations:(window.CareerLife&&window.CareerLife.defaultRelations)?window.CareerLife.defaultRelations():{coach:55,squad:50,fans:45,agent:40},
      headlines:[], lifeLog:[],
      offerHistory:{}, lowAppsStreak:0, careerSeasons:[], worldCupHistory:{}, worldCups:0, euroHistory:{}, euros:0,
      corruptionPlan:null, forceCorruptPromotion:false, corruptionShadow:0, nextAppsFactor:1, nextAppsReason:null, nextMinutesFactor:1,
      marketLockSeasons:0, blockMarketOnce:false, guaranteedForeignOffers:0, extraMarketOffer:false,
      agentMarketJump:0, skipMarketOnce:false, forceNoRenewClubName:null, noRenewClubName:null, noRenewAfterAge:null,
      captainEventBonusClub:null, activePlayerEventMultiplier:1, clubLegendMilestones:{},
      finishingBias:rand(86,114)/100, creativeBias:rand(86,114)/100,
      peakOverall:base, highestTier:0, bestForeignTier:null, ekstraklasaSeasons:0, foreignSeasons:0, clubsPlayed:0,
      legend99Streak:0, legendUnlocked:false, legendEraActive:false, legendStartBonus:0,
      legendPeakOverall:base, legendSeasons100:0, legendRankingPending:false, legendRankingShown:false,
      legendReferenceNames:null, grajewskiOverallCap:0,
      // Lab: skille / soft / tryb sezonu
      attrs: (window.__careerDraft && window.__careerDraft.attrs) || (window.LabData ? window.LabData.baseAttrsFor(position, base) : null),
      soft: (window.__careerDraft && window.__careerDraft.soft) || (window.LabData ? window.LabData.softDefaults() : null),
      skillPoints: (window.__careerDraft && window.__careerDraft.pointsLeft) || 0,
      playMode: (document.querySelector('input[name="playMode"]:checked') || {}).value || 'key'
    };
    if(window.CareerLife){
      state.decisionEvery=window.CareerLife.paceEvery(state.careerPace);
      window.CareerLife.ensureLifeState(state);
    } else {
      state.decisionEvery=({intense:1,normal:2,express:3}[state.careerPace]||2);
    }
    if(state.attrs && window.LabData) state.overall=window.LabData.overallFromAttrs(state.attrs);
    generateOffers();
  });

  function generateOffers(){
    show(els.offersView); els.newCareerBtn.classList.remove('hidden');
    const startLabels={
      backyard:'PODWÓRKO • 29–34 OVR',
      normal:'NORMALNY CHŁOP',
      syrenka:'PUCHAR SYRENKI • 50–55 OVR',
      wonderkid:'WONDERKID • 60–66 OVR'
    };
    els.offerRegion.textContent='';

    const local=GAME_DATA.regions[state.region].filter(c=>!c.reserve);
    const national=seniorClubs();
    const targets={
      backyard:[1,1,2],
      normal:[2,3,4],
      syrenka:[4,5,6],
      // Wonderkid dostaje dwie polskie ścieżki + jedną gwarantowaną zagraniczną.
      wonderkid:[5,6]
    }[state.startPoint] || [2,3,4];

    const offers=[];
    const add=c=>{
      if(c && !offers.some(x=>x.name===c.name)) offers.push(c);
    };

    const candidatesForTier=tier=>{
      const exactLocal=shuffle(local.filter(c=>c.tier===tier));
      const exactNational=shuffle(national.filter(c=>c.tier===tier));
      const nearLocal=shuffle(local.filter(c=>Math.abs(c.tier-tier)===1));
      const nearNational=shuffle(national.filter(c=>Math.abs(c.tier-tier)===1));
      return [...exactLocal,...exactNational,...nearLocal,...nearNational];
    };

    targets.forEach(t=>{
      const candidates=candidatesForTier(t);
      add(candidates.find(c=>!offers.some(o=>o.name===c.name)));
    });

    // WONDERKID: jedna zagraniczna oferta już przed pierwszym sezonem.
    // To specjalna ścieżka skautingowa dla 16-latka, więc nie używa normalnej
    // bramki wieku/medialności pierwszego transferu. T5/T6 są nadal wykluczone.
    if(state.startPoint==='wonderkid'){
      const preferredTier=(state.overall>=64 && state.recognition>=23)?3:4;
      let foreignStart=GAME_DATA.foreignClubs.filter(c=>
        c.zone==='Europa' &&
        c.foreignTier===preferredTier &&
        c.strength<=state.overall+10
      );
      if(!foreignStart.length){
        foreignStart=GAME_DATA.foreignClubs.filter(c=>
          c.zone==='Europa' &&
          c.foreignTier===4 &&
          c.strength<=state.overall+10
        );
      }
      if(foreignStart.length) add(pick(foreignStart));
    }

    // Awaryjnie dopełniamy ofertami najbardziej zbliżonymi do oczekiwanego szczebla.
    if(offers.length<3){
      const center=targets.reduce((a,b)=>a+b,0)/targets.length;
      shuffle(national)
        .sort((a,b)=>Math.abs(a.tier-center)-Math.abs(b.tier-center))
        .forEach(add);
    }
    offers.length=3;

    // EASTER EGG: ręcznie wpisany Jakub Olkiewicz zawsze dostaje jedną
    // z trzech ofert od Teofilka. Przy WONDERKIDZIE zachowujemy ofertę
    // zagraniczną i zastępujemy jedną z polskich propozycji.
    if(isJakubOlkiewicz(state.name)){
      const teofilek=allPolishClubs().find(c=>c.name==='Teofilek Łódź');
      if(teofilek && !offers.some(c=>c.name===teofilek.name)){
        let replaceIndex=-1;
        for(let i=offers.length-1;i>=0;i--){
          if(!isForeignClub(offers[i])){ replaceIndex=i; break; }
        }
        if(replaceIndex<0) replaceIndex=Math.max(0,offers.length-1);
        offers[replaceIndex]=teofilek;
      }
    }

    els.offersGrid.innerHTML='';
    shuffle(offers).forEach(c=>{
      const d=document.createElement('article'); d.className='offer-card';
      d.innerHTML=`<div class="eyebrow">FAX</div><div class="offer-body"><h3>${c.name}</h3><p><strong>${clubOfferCompetition(c)}</strong><br>${offerPitch(c)}</p></div><button class="primary">SIGN</button>`;
      d.querySelector('button').onclick=()=>startAtClub(c);
      els.offersGrid.appendChild(d);
    });
  }

  function offerPitch(c){
    if(isForeignClub(c)){
      if(c.foreignTier===1) return 'Światowy top już na starcie. Ogromny prestiż, ale minuty trzeba będzie wyrwać.';
      if(c.foreignTier===2) return 'Bardzo mocny klub zagraniczny. Wielka szansa i bardzo trudna walka o skład.';
      if(c.foreignTier===3) return 'Mocna zagranica. Poziom czołówki Ekstraklasy lub wyżej, bez gwarancji minut.';
      if(c.foreignTier===4) return 'Pierwszy zagraniczny krok. Dobry poziom do rozwoju i wejścia na europejski rynek.';
      if(c.foreignTier===5) return 'Lokalny rynek zagraniczny. Dużo zależy od regularnej gry.';
      return 'Egzotyczny rynek. Szansa na grę i zupełnie inną ścieżkę kariery.';
    }
    if(c.tier===1) return 'Najbliżej domu. Seniorskie granie od razu i dużo minut, ale długa droga na szczyt.';
    if(c.tier===2) return 'Prawdziwa seniorska piłka i dobra szansa na szybkie wejście do składu.';
    if(c.tier===3) return 'III liga. Już można się pokazać klubom centralnym, ale trzeba zasłużyć na minuty.';
    if(c.tier===4) return 'II liga. Poziom centralny już na starcie, ale o miejsce w składzie trzeba walczyć.';
    return 'Mocny klub na start. Minuty nie przyjdą za darmo.';
  }
  function startAtClub(c){
    state.club={...c}; state.clubHistory.push(c.name); state.clubsPlayed=1; state.status=c.tier>=5?'Junior / akademia':'Junior / rezerwy'; state.highestTier=c.tier;
    log(`Podpisujesz pierwszy kontrakt: ${c.name}.`, `${clubCompetition(c)} • 16 lat`);
    show(els.careerView); render();
  }

  function render(){
    if(!state) return;
    const startLabel={backyard:'PODWÓRKO',normal:'NORMALNY CHŁOP',syrenka:'PUCHAR SYRENKI',wonderkid:'WONDERKID'}[state.startPoint]||'START';
    els.playerNameLabel.textContent=state.name; els.playerRegionLabel.textContent=state.region; els.playerMeta.textContent=`${state.position} • ${state.foot} noga • ${startLabel} • ${isEasy()?'PROGRESJA ŁATWA':'PROGRESJA NORMALNA'}${state.legendUnlocked?' • LEGENDA FUTBOLU':''}`;
    els.shirtNumber.textContent = state.shirtNumber;
    els.overallValue.textContent=state.overall; els.ageValue.textContent=state.age; els.clubValue.textContent=state.club.name; els.clubTierValue.textContent=clubCompetition(state.club);
    els.statusValue.textContent=state.status;
    if(state.seniorInternational){
      const ntStatus=state.national==='Polska'?'Polska':'Poza kadrą';
      els.nationalValue.textContent=`${ntStatus} • ${state.nationalCaps} M / ${state.nationalGoals} G`;
    } else {
      els.nationalValue.textContent=state.national;
    }
    if(state.club){
      els.playChanceValue.textContent=state.club.noClub?'—':`${projectedStartChance(state.club,state.boost||0)}%${state.boost?` (${state.boost>0?'+':''}${state.boost})`:''}`;
      els.professionalismValue.textContent=`${Math.round(state.professionalism)}/100`;
      els.loyaltyValue.textContent=`${Math.round(clamp(state.loyalty,0,15))}/15`;
      els.recognitionValue.textContent=`${Math.round(state.recognition||0)}/100`;
      els.injuryRiskValue.textContent=`${Math.round(state.injuryRisk)}%`;
    }
    if(window.CareerLife) window.CareerLife.ensureLifeState(state);
    const rel=state.relations||{};
    if(els.relCoach) els.relCoach.textContent=Math.round(rel.coach??55);
    if(els.relSquad) els.relSquad.textContent=Math.round(rel.squad??50);
    if(els.relFans) els.relFans.textContent=Math.round(rel.fans??45);
    if(els.relAgent) els.relAgent.textContent=Math.round(rel.agent??40);
    if(els.energyValue) els.energyValue.textContent=Number.isFinite(state.energy)?state.energy:'—';
    els.seasonLabel.textContent=`SEZON ${state.seasonYear}/${String(state.seasonYear+1).slice(2)}`;
    els.seasonHeadline.textContent=seasonHeadline();
    els.valueLabel.textContent=formatMoney(calcValue());
    els.appsStat.textContent=state.season.apps; els.goalsStat.textContent=state.season.goals; els.assistsStat.textContent=state.season.assists; els.minutesStat.textContent=state.season.minutes;
    els.careerScore.textContent=`${state.score} pkt`;
    els.timeline.innerHTML=state.timeline.slice().reverse().map(x=>`<div class="timeline-item"><div class="timeline-age">${x.age} LAT</div><div class="timeline-text"><strong>${x.title}</strong><span>${x.meta}</span></div></div>`).join('');
  }
  function seasonHeadline(){
    if(state.age<=17) return 'Pierwsze kroki w seniorach';
    if(state.overall>=76) return 'Jesteś gwiazdą';
    if(state.overall>=67) return 'Liczą się z tobą';
    if(state.overall>=57) return 'Budujesz pozycję';
    return 'Walczysz o swoje minuty';
  }
  function calcValue(){
    let base=Math.max(15000, Math.pow(Math.max(1,state.overall-32),2.7)*700);
    const ageFactor=state.age<22?1.5:state.age<27?1.25:state.age<31?1:Math.max(.18,1-(state.age-30)*.12);
    const tierFactor={1:.15,2:.28,3:.45,4:.75,5:1.15,6:1.8,7:2.3,8:3.1}[state.club.tier]||1;
    const recognitionFactor=.82+clamp(state.recognition||20,0,100)*.006; return Math.round(base*ageFactor*tierFactor*recognitionFactor/10000)*10000;
  }

  els.playSeasonBtn.addEventListener('click', ()=>{
    if(state.pendingDecision) return;
    if(window.CareerLab && typeof window.CareerLab.onPlaySeason==='function'){
      window.CareerLab.onPlaySeason();
      return;
    }
    simulateSeason();
  });


  function weightedDelta(rows){
    const total=rows.reduce((a,x)=>a+x[0],0);
    let r=Math.random()*total;
    for(const [w,d] of rows){ r-=w; if(r<=0) return d; }
    return rows[rows.length-1][1];
  }

  // Naturalna krzywa OVR przed dodatkowymi modyfikatorami
  // sezonu, środowiska, talentu i liczby występów.
  // Wiek to tylko biologiczny dryf, nie wyrok. Nawet stary zawodnik
  // zachowuje małą szansę poprawy; wynik sezonu jest liczony osobno.
  function veteranProfessionalismProtection(age){
    if(age<35) return 0;

    const p=state.professionalism||50;
    if(p<60) return 0;

    // Po 39. roku życia regres pozostaje brutalny:
    // profesjonalizm może uratować najwyżej 1 OVR w danym roku.
    if(age>=39){
      const chance =
        p>=95 ? 65 :
        p>=85 ? 50 :
        p>=75 ? 35 :
        p>=60 ? 18 : 0;
      return rand(1,100)<=chance ? 1 : 0;
    }

    // 35–38: najlepsi profesjonaliści realnie starzeją się wolniej.
    // Najczęściej oznacza to uratowanie 1 OVR, czasem 2.
    if(p>=95){
      const r=rand(1,100);
      return r<=20 ? 2 : r<=75 ? 1 : 0;   // EV +0.95
    }
    if(p>=85){
      const r=rand(1,100);
      return r<=10 ? 2 : r<=60 ? 1 : 0;   // EV +0.70
    }
    if(p>=75) return rand(1,100)<=42 ? 1 : 0;
    return rand(1,100)<=20 ? 1 : 0;
  }

  function rollNaturalGrowth(age){
    // v0.61 — SCHYŁEK KARIERY.
    // Od 35 lat biologiczny regres jest mocny i taki sam na obu poziomach trudności.
    // Od 39 lat staje się brutalny, ale nadal jest losowany.
    if(age===35) return weightedDelta([[10,-1],[45,-2],[35,-3],[10,-4]]);
    if(age===36) return weightedDelta([[5,-1],[35,-2],[45,-3],[15,-4]]);
    if(age===37) return weightedDelta([[20,-2],[45,-3],[25,-4],[10,-5]]);
    if(age===38) return weightedDelta([[10,-2],[35,-3],[40,-4],[15,-5]]);
    if(age>=39 && age<=40) return weightedDelta([[15,-3],[35,-4],[35,-5],[15,-6]]);
    if(age>=41 && age<=42) return weightedDelta([[10,-4],[35,-5],[35,-6],[20,-7]]);
    if(age>=43) return weightedDelta([[10,-5],[30,-6],[40,-7],[20,-8]]);

    // Do 34 roku życia trudność nadal wpływa na rozwój.
    if(isEasy()){
      if(age<=18) return weightedDelta([[4,0],[38,1],[45,2],[13,3]]);
      if(age<=21) return weightedDelta([[2,-1],[15,0],[55,1],[23,2],[5,3]]);
      if(age<=24) return weightedDelta([[4,-1],[30,0],[56,1],[10,2]]);
      if(age<=27) return weightedDelta([[7,-1],[50,0],[39,1],[4,2]]);
      if(age<=30) return weightedDelta([[12,-1],[60,0],[26,1],[2,2]]);
      if(age===31) return weightedDelta([[2,-2],[20,-1],[65,0],[13,1]]);
      if(age<=33) return weightedDelta([[5,-2],[30,-1],[58,0],[7,1]]);
      if(age===34) return weightedDelta([[12,-2],[40,-1],[45,0],[3,1]]);
      return weightedDelta([[12,-2],[40,-1],[45,0],[3,1]]);
    }

    if(age<=18) return weightedDelta([[10,0],[50,1],[35,2],[5,3]]);
    if(age<=21) return weightedDelta([[5,-1],[25,0],[52,1],[15,2],[3,3]]);
    if(age<=24) return weightedDelta([[10,-1],[40,0],[45,1],[5,2]]);
    if(age<=27) return weightedDelta([[15,-1],[55,0],[28,1],[2,2]]);
    if(age<=30) return weightedDelta([[22,-1],[60,0],[17,1],[1,2]]);
    if(age===31) return weightedDelta([[5,-2],[30,-1],[55,0],[10,1]]);
    if(age<=33) return weightedDelta([[12,-2],[40,-1],[43,0],[5,1]]);
    if(age===34) return weightedDelta([[22,-2],[45,-1],[31,0],[2,1]]);
    return weightedDelta([[22,-2],[45,-1],[31,0],[2,1]]);
  }

  // Sezon jest JEDNYM czytelnym rzutem DYSPOZYCJI.
  // Początkowa szansa na grę NIE wpływa na to, czy wylosujesz świetny czy słaby rok.
  // Profesjonalizm tylko lekko przesuwa rozkład; głównym rozstrzygnięciem pozostaje rzut.
  function rollSeasonForm(){
    const profMod=clamp(Math.round((state.professionalism-50)/18),-3,3);
    const qualityMod=profMod;

    const rows=[
      {key:'crisis',label:'KRYZYS',base:6,grade:-2,hierarchy:-18,productionRange:[.30,.50],gradePair:[0,1],gradeBounds:[0,1],performanceMod:-6,seasonBonus:-2},
      {key:'poor',label:'SŁABY',base:14,grade:-1,hierarchy:-8,productionRange:[.75,1.05],gradePair:[1,2],gradeBounds:[0,3],performanceMod:-3,seasonBonus:-1},
      {key:'normal',label:'NORMALNY',base:45,grade:0,hierarchy:0,productionRange:[.80,1.20],gradePair:[3,4],gradeBounds:[3,5],performanceMod:0,seasonBonus:0},
      {key:'good',label:'DOBRY',base:23,grade:1,hierarchy:15,productionRange:[1.05,1.35],gradePair:[5,6],gradeBounds:[4,7],performanceMod:3,seasonBonus:1},
      {key:'great',label:'ŚWIETNY',base:10,grade:2,hierarchy:35,productionRange:[1.20,1.50],gradePair:[6,7],gradeBounds:[5,7],performanceMod:6,seasonBonus:2},
      {key:'career',label:'SEZON ŻYCIA',base:2,grade:3,hierarchy:50,productionRange:[1.40,1.65],gradePair:[7,8],gradeBounds:[7,8],performanceMod:10,seasonBonus:3}
    ];

    // Profesjonalizm i tryb gry tylko lekko przesuwają rozkład.
    // Hierarchia przed sezonem nie zmienia szans na wylosowanie dobrej dyspozycji.
    const weighted=rows.map(x=>({...x,w:x.base*Math.exp(qualityMod*x.grade/22)}));
    const sum=weighted.reduce((a,x)=>a+x.w,0);
    const exact=weighted.map(x=>100*x.w/sum);
    const chances=exact.map(Math.floor);
    let missing=100-chances.reduce((a,x)=>a+x,0);
    const remainderOrder=exact.map((v,i)=>({i,frac:v-Math.floor(v)})).sort((a,b)=>b.frac-a.frac);
    for(let k=0;k<missing;k++) chances[remainderOrder[k%remainderOrder.length].i]++;

    const roll=rand(1,100);
    let cursor=0;
    let bandStart=1;
    let bandSize=chances[chances.length-1];
    let chosen=weighted[weighted.length-1];
    for(let i=0;i<weighted.length;i++){
      const before=cursor;
      cursor+=chances[i];
      if(roll<=cursor){
        chosen=weighted[i];
        bandStart=before+1;
        bandSize=chances[i];
        break;
      }
    }

    const probabilities=Object.fromEntries(weighted.map((x,i)=>[x.key,chances[i]]));
    // 0 = sam dół wylosowanego przedziału, 1 = sam szczyt. Przy jedno-
    // punktowym przedziale przyjmujemy środek, żeby uniknąć sztucznej skrajności.
    const position=bandSize<=1 ? .5 : clamp((roll-bandStart)/(bandSize-1),0,1);
    return {
      ...chosen,roll,profMod,qualityMod,probabilities,
      bandStart,bandEnd:bandStart+bandSize-1,bandSize,position,
      positionPct:Math.round(position*100)
    };
  }

  // Profile natychmiastowych decyzji międzysezonowych.
  const OVR_PROFILES = {
    // Również profile awaryjne mają tylko dwa wyniki.
    breakout:{outcomes:[[30,3],[70,-1]], name:'PRÓBA PRZEŁOMU'},
    highrisk:{outcomes:[[35,2],[65,-1]], name:'DUŻE RYZYKO'},
    aggressive:{outcomes:[[40,1],[60,0]], name:'AGRESYWNIE'},
    balanced:{outcomes:[[30,1],[70,0]], name:'ZRÓWNOWAŻENIE'},
    safe:{outcomes:[[20,1],[80,0]], name:'OSTROŻNIE'}
  };

  const HIGH_RISK_LABELS = new Set([
    'Wchodzę na sto procent','Dodatkowy trening','Walczę o miejsce','Zostaję po treningu',
    'Podkręcam atmosferę','Chcę nadal grać wszystko','Tylko piłka','Gram i trenuję normalnie',
    'Wszystko stawiam na piłkę','Walczę o każdą minutę','Wracam jak najszybciej',
    'Od razu pokazuję charakter','Nie wiążę się','Sprawdzam oferty',
    'Chcę jeszcze spróbować wyżej','Biorę ostatnią szansę','Słucham ofert','Szukam odejścia',
    'Bronię się publicznie','Wolę swoją pozycję'
  ]);
  const AGGRESSIVE_LABELS = new Set([
    'Zostaję i walczę','Od razu go przekonuję','Odpowiadam na boisku','Korzystam z momentu',
    'Korzystam z rozgłosu','Próbuję','Uczę się tego','Przekonuję go na treningach',
    'Wierzę w swoją pozycję','Jeszcze jestem piłkarzem','Biorę odpowiedzialność','Podpisuję z nim','Pytam o odejście',
    'Szukam stabilności','Chcę znowu grać','Wracam'
  ]);
  const SAFE_LABELS = new Set([
    'Bez pośpiechu','Odpoczywam','Czekam na swoją szansę','Nie dokładam obciążeń',
    'Mówię tylko o boisku','Wyłączam telefon','Regeneracja przede wszystkim',
    'Pełna rehabilitacja','Słucham i chłonę','Czekam, co będzie',
    'Podpisuję','Zostaję przy swoim','Nie ruszam się','Zostaję na tym poziomie',
    'Nie mieszam się','Nic nie zmieniam','Bronię po staremu','Skupiam się na grze'
  ]);
  const BALANCED_LABELS = new Set([
    'Trzymam się z boku','Biorę odpowiedzialność',
    'Przyjmuję rolę mentora','Uczę się życia tutaj','Łączę piłkę z nauką',
    'Pomagam mu wejść do zespołu','Robię kurs','Zostaję z drużyną','Zostaję po awansie',
    'Chcę wypożyczenia','Wracam po minuty','Szukam gry','Wchodzę w ten plan',
    'Chcę zostać','Jeszcze nie','Próbuję uspokoić sytuację','Zgadzam się','Zostaję'
  ]);

  function ovrProfileForChoice(ch){
    // null jest zarezerwowane wyłącznie dla rynku klubowego: sam podpis z klubem
    // nie wykonuje natychmiastowego rzutu OVR. Zwykłe zdarzenia ZAWSZE mają stawkę.
    if(ch.ovrProfile===null) return null;
    if(ch.ovrProfile && OVR_PROFILES[ch.ovrProfile]) return OVR_PROFILES[ch.ovrProfile];
    const l=ch.label||'';
    if(HIGH_RISK_LABELS.has(l)) return OVR_PROFILES.highrisk;
    if(AGGRESSIVE_LABELS.has(l)) return OVR_PROFILES.aggressive;
    if(SAFE_LABELS.has(l)) return OVR_PROFILES.safe;
    if(BALANCED_LABELS.has(l)) return OVR_PROFILES.balanced;

    const src=String(ch.act||'');
    const injPlus=src.match(/injuryRisk[^;]*?injuryRisk\s*\+\s*(\d+)/) || src.match(/injuryRisk[^;]*?\+\s*(\d+)/);
    const injMinus=src.match(/injuryRisk[^;]*?injuryRisk\s*-\s*(\d+)/) || src.match(/injuryRisk[^;]*?-\s*(\d+)/);
    const boostPlus=src.match(/boost\s*\+=\s*(\d+)/);
    if(/findTransferClub|moveClub|regionalReturn|loanMove|findLowerClub|findPlayableClub/.test(src)) return OVR_PROFILES.aggressive;
    if(injPlus && Number(injPlus[1])>=2) return OVR_PROFILES.highrisk;
    if(injMinus) return OVR_PROFILES.safe;
    if(boostPlus && Number(boostPlus[1])>=4) return OVR_PROFILES.aggressive;
    if(/professionalism/.test(src) || /loyalty/.test(src)) return OVR_PROFILES.balanced;
    return OVR_PROFILES.balanced;
  }

  function extractEffectSummary(ch){
    if(ch.preview) return ch.preview;
    const src=String(ch.act||'');
    const bits=[];
    const add=(name, regex, suffix='')=>{
      const m=src.match(regex);
      if(m){
        const n=Number(m[1]);
        bits.push(`${name} ${n>=0?'+':''}${n}${suffix}`);
      }
    };
    const boost=src.match(/boost\s*([+-])=\s*(\d+)/);
    if(boost) bits.push(`szansa na minuty ${boost[1]==='+'?'+':'-'}${boost[2]} p.p.`);

    // Precise common hidden-stat changes.
    const pairs=[
      ['profesjonalizm','professionalism'],
      ['adaptacja','adaptability']
    ];
    for(const [name,key] of pairs){
      const m=src.match(new RegExp(key+"[^;]*?"+key+"\\s*([+-])\\s*(\\d+)"));
      if(m) bits.push(`${name} ${m[1]==='+'?'+':'-'}${m[2]}`);
    }
    const inj=src.match(/injuryRisk[^;]*?injuryRisk\s*([+-])\s*(\d+)/);
    if(inj) bits.push(`ryzyko urazu ${inj[1]==='+'?'+':'-'}${inj[2]} p.p.`);
    const market=src.match(/marketBonus[^;]*?\+\s*(\d+)/);
    if(market) bits.push(`szansa na ambitniejszą ofertę +${market[1]} p.p. tego lata`);
    if(/loanMove\(/.test(src)) bits.push('możliwe wypożyczenie');
    else if(/moveClub\(|regionalReturn\(|findTransferClub|findLowerClub|findPlayableClub/.test(src)) bits.push('możliwa zmiana klubu');
    if(/loyalty\s*\+=/.test(src)) bits.push('lojalność rośnie');
    if(/loyalty--|loyalty\s*-/.test(src)) bits.push('lojalność spada');
    return bits.length?bits.join(' • '):'Brak bezpośredniej zmiany OVR; wpływ głównie na dalszą historię kariery.';
  }

  function choiceStakeText(ch){
    const p=ovrProfileForChoice(ch);
    const effects=extractEffectSummary(ch);
    if(!p) return effects;
    if(p.outcomes){
      const parts=p.outcomes.map(([pct,delta])=>`${pct}% → ${delta>0?'+':''}${delta===0?'bez zmian':delta}`);
      return `${p.name} • OVR: ${parts.join(' • ')} • ${effects}`;
    }
    return `${p.name} • OVR: ${p.up}% → +${p.upDelta} • ${p.flat}% → bez zmian • ${p.down}% → ${p.downDelta} • ${effects}`;
  }

  function applyChoiceOvrRoll(ch){
    const p=ovrProfileForChoice(ch);
    if(!p) return null;
    const before=state.overall;
    const r=rand(1,100);
    let delta=0, band='NEUTRALNIE';

    if(p.outcomes){
      let cursor=0;
      for(const [pct,d] of p.outcomes){
        cursor+=pct;
        if(r<=cursor){ delta=d; break; }
      }
      band=delta>0?'SUKCES':delta<0?'PORAŻKA':'NEUTRALNIE';
    } else {
      if(r<=p.up){ delta=p.upDelta; band='SUKCES'; }
      else if(r>p.up+p.flat){ delta=p.downDelta; band='PORAŻKA'; }
    }

    state.overall=clamp(state.overall+delta,20,overallCap());
    noteLegendOverallChange(before);
    const result=state.overall>before?`OVR ${before} → ${state.overall}`:state.overall<before?`OVR ${before} → ${state.overall}`:`OVR bez zmian (${state.overall})`;
    log('Skutek decyzji', `Rzut ${r}/100 • ${band} • ${result}`);
    return {roll:r,band,delta,before,after:state.overall,result,profile:p};
  }

  function projectedStartChance(club, extraBoost=0){
    const qualityGap=state.overall-club.strength;
    // Lojalność jest relacją z AKTUALNYM klubem: znajomość systemu, zaufanie sztabu,
    // pozycja w szatni. Nie przenosi się w pełnej wartości po transferze.
    const loyaltyBonus=(state.club && club.name===state.club.name) ? Math.min(7,Math.max(0,state.loyalty)*.65) : 0;
    const coachMod=(window.CareerLife&&state.club&&club.name===state.club.name)?window.CareerLife.playChanceMod(state):0;
    const raw=
      // Dawna regularność dawała przeciętnie ok. +1 p.p.; stała 48 zachowuje
      // dotychczasowy średni poziom szans po usunięciu tej martwej cechy.
      48+qualityGap*4+(state.professionalism-50)*.18+extraBoost+loyaltyBonus+coachMod;
    // Przy gigantycznej różnicy poziomu dopuszczamy faktyczne 1%, zamiast
    // sztucznej podłogi 4%. Dla normalnych relacji zawodnik–klub zachowujemy
    // dotychczasowe minimum, więc zmiana nie rozlewa się na całą grę.
    const minimum=qualityGap<=-25?1:4;
    return Math.round(clamp(raw,minimum,97));
  }

  function qualityGapStartChanceCap(qualityGap){
    if(qualityGap<=-40) return 2;
    if(qualityGap<=-30) return 5;
    if(qualityGap<=-22) return 10;
    if(qualityGap<=-15) return 22;
    if(qualityGap<=-10) return 38;
    return 97;
  }

  function rollSeasonAppearances(startChance,breakthrough=false){
    // 38 niezależnych kolejek. Przy normalnej pozycji w hierarchii zachowujemy
    // dotychczasowy niewielki bonus rotacyjny 0–5 występów; znika on dopiero
    // przy skrajnie niskiej szansie, żeby gracz 1–4% mógł naprawdę skończyć z 0.
    let apps=0;
    for(let matchday=0;matchday<38;matchday++){
      if(Math.random()*100<startChance) apps++;
    }
    const rotationBonus=startChance>=20?rand(0,5):startChance>=10?rand(0,2):0;
    return clamp(apps+rotationBonus+(breakthrough?2:0),0,38);
  }

  function careerSeasonAppsFloor(qualityGap,breakthrough=false){
    if(breakthrough || qualityGap>=-8) return 28;
    if(qualityGap>=-15) return 20;
    if(qualityGap>=-22) return 12;
    return 0;
  }


  function environmentTierBase(tier){
    // To nie jest już bezpośredni bonus OVR. Wyższy poziom klubu oznacza
    // lepszy POZIOM TRENINGU, a osobne środowisko opisuje dopasowanie.
    return ({1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0}[tier] ?? 0);
  }

  function rollClubEnvironment(club, age){
    // ŚRODOWISKO = trener, szatnia, dopasowanie, codzienny komfort pracy.
    // POZIOM TRENINGU jest liczony osobno z tieru klubu.
    // Niższe ligi mają szerszy rozrzut organizacyjny: można trafić na
    // fantastycznie zgraną ekipę, ale też na kompletny chaos.
    const cultureRange=club.tier<=2?[-16,14]:club.tier===3?[-15,14]:club.tier===4?[-14,13]:[-12,12];
    let score=rand(cultureRange[0],cultureRange[1]);

    // Adaptacja jest tylko jedną ze składowych, nie gwarancją dobrego środowiska.
    score += Math.round((state.adaptability-60)/14);

    // Lojalność pomaga tylko w aktualnym klubie: znasz ludzi, system i swoją pozycję.
    if(state.club && club.name===state.club.name){
      // Maksymalnie +4: lojalność pomaga, ale nawet klubowy symbol może
      // trafić na toksyczny rok, zmianę trenera czy rozwaloną szatnię.
      score += Math.min(4,Math.floor(Math.max(0,state.loyalty)/3));
    }

    // Wielki klub daje młodemu większą wariancję dopasowania:
    // możesz trafić na świetnego trenera albo kompletnie zginąć w tłumie.
    if(age<=23 && club.tier>=6) score += rand(-4,4);

    let label='NEUTRALNE', injuryMod=0, growthFactor=1, negativeRisk=6;
    if(score<=-10){
      label='TOKSYCZNE'; injuryMod=4; growthFactor=.35; negativeRisk=28;
    } else if(score<=-4){
      label='TRUDNE'; injuryMod=2; growthFactor=.65; negativeRisk=15;
    } else if(score<=4){
      label='NEUTRALNE'; injuryMod=0; growthFactor=1; negativeRisk=6;
    } else if(score<=9){
      label='DOBRE'; injuryMod=-1; growthFactor=1.20; negativeRisk=3;
    } else if(score<=14){
      label='ŚWIETNE'; injuryMod=-2; growthFactor=1.45; negativeRisk=1;
    } else {
      label='WYJĄTKOWE'; injuryMod=-3; growthFactor=1.65; negativeRisk=0;
    }

    return {score,label,injuryMod,growthFactor,negativeRisk};
  }

  function trainingLevelLabel(tier){
    return ({
      1:'lokalny',
      2:'regionalny',
      3:'III liga',
      4:'II liga',
      5:'I liga',
      6:'Ekstraklasa',
      7:'mocna zagranica',
      8:'europejska czołówka'
    })[tier] || 'nieznany';
  }

  function baseEnvironmentLearning(age,tier){
    // To jest sedno "młody uczy się wyżej nawet bez minut".
    // Tier zwiększa szansę na naukę; wraz z wiekiem efekt gwałtownie maleje.
    let plus1=0, plus2=0;

    if(age<=18){
      plus1=6+tier*3.5;
      plus2=Math.max(0,tier-3)*1.35;
    } else if(age<=21){
      plus1=5+tier*3.0;
      plus2=Math.max(0,tier-4)*1.25;
    } else if(age<=24){
      plus1=3+tier*2.5;
      plus2=Math.max(0,tier-5)*.8;
    } else if(age<=27){
      plus1=2+tier*1.55;
    } else if(age<=30){
      plus1=1+tier*1.05;
    } else if(age<=33){
      plus1=.5+tier*.65;
    } else if(age<=36){
      plus1=Math.max(.5,tier*.28);
    } else {
      plus1=.5;
    }

    return {plus1,plus2};
  }

  function rollEnvironmentGrowth(env,age,tier){
    const base=baseEnvironmentLearning(age,tier);

    const difficultyGrowthFactor=isEasy()?1.25:1;
    let plus1=base.plus1*env.growthFactor*difficultyGrowthFactor;
    let plus2=base.plus2*env.growthFactor*difficultyGrowthFactor;

    // Niższy poziom ma nie tylko słabszy upside treningowy, ale również
    // większą szansę złych nawyków / słabego szkolenia / organizacyjnego chaosu.
    // Dobra szatnia i trener potrafią to prawie całkowicie skompensować.
    const tierNegativeBase=({1:10,2:7,3:5,4:3,5:1,6:0,7:0,8:0}[tier] ?? 0);
    const cultureShield=
      env.label==='WYJĄTKOWE'?0:
      env.label==='ŚWIETNE'?.20:
      env.label==='DOBRE'?.45:
      env.label==='NEUTRALNE'?.75:1;
    let minus1=(env.negativeRisk + tierNegativeBase*cultureShield)*(isEasy()?.65:1);

    // Po 30. roku życia dobre środowisko pomaga raczej utrzymać poziom niż "uczyć".
    if(age>=35){
      plus1*=.30;
      plus2=0;
      // Weteran jest bardziej podatny na negatywny wpływ złego środowiska.
      minus1*=1.15;
    } else if(age>=31){
      plus1*=.75;
      plus2=0;
    }

    plus1=clamp(Math.round(plus1),0,62);
    plus2=clamp(Math.round(plus2),0,14);
    minus1=clamp(Math.round(minus1),0,35);

    // Pilnujemy pełnego rozkładu 100%.
    const total=plus1+plus2+minus1;
    if(total>82){
      const scale=82/total;
      plus1=Math.round(plus1*scale);
      plus2=Math.round(plus2*scale);
      minus1=Math.round(minus1*scale);
    }
    const flat=100-plus1-plus2-minus1;

    const roll=rand(1,100);
    let delta=0;
    if(roll<=minus1) delta=-1;
    else if(roll<=minus1+flat) delta=0;
    else if(roll<=minus1+flat+plus1) delta=1;
    else delta=2;

    return {
      delta,roll,
      probabilities:{minus1,flat,plus1,plus2},
      trainingLevel:trainingLevelLabel(tier)
    };
  }

  function competitionBonus(tier, apps, club=null){
    // Minuty na wyższym poziomie są cenniejsze, ale bonus jest celowo mały.
    let perGame=({1:0,2:.03,3:.05,4:.10,5:.16,6:.24,7:.27,8:.32}[tier] ?? 0);
    if(isForeignClub(club)) perGame=({4:.24,3:.28,2:.33,1:.37})[club.foreignTier]||perGame;
    return Math.min(10, apps*perGame);
  }

  function breakthroughChance(baseStartChance, form, env, club){
    if(state.age>25 || baseStartChance>=45) return 0;
    let chance=1;
    if(form.key==='good') chance+=3;
    if(form.key==='great') chance+=9;
    if(form.key==='career') chance+=20;
    if(state.professionalism>=75) chance+=3;
    if(state.adaptability>=75) chance+=2;
    if(state.club && club.name===state.club.name) chance+=Math.min(3,Math.floor(Math.max(0,state.loyalty)/4));
    if(club.tier>=6) chance+=2;

    // Młody wyraźnie poniżej poziomu mocnego klubu to specjalny zakład:
    // częściej straci rok, ale istnieje realna szansa, że jedna okazja zmieni hierarchię.
    const challenge=club.strength-state.overall;
    if(state.age<=23 && club.tier>=5 && challenge>=7){
      chance += 5 + Math.min(7,Math.floor((challenge-7)/2));
    }
    return clamp(chance,1,42);
  }

  function clubEnvironmentPreview(club){
    const challenge=club.strength-state.overall;
    if(state.age<=23 && club.tier>=5 && challenge>=7)
      return 'HIGH RISK / HIGH REWARD • możesz stracić rok na ławce, ale wysoki poziom treningu nadal daje młodemu osobny rzut rozwojowy';
    if(isForeignClub(club)) return `${foreignTierName(club.foreignTier)} • ${club.league||'liga krajowa'} • wysoki poziom treningu i konkurencji`;
    if(club.tier===6) return 'wysoki poziom treningu • młody może rozwijać się także przy małej liczbie minut • mocna konkurencja';
    if(club.tier===5) return 'dobry poziom treningu • rozsądny balans minut i presji';
    if(club.tier===4) return 'solidne środowisko • minuty zwykle ważniejsze niż zaplecze';
    if(club.tier===3) return 'stabilniejszy zakład na minuty • zaplecze rozwojowe bywa nierówne';
    return 'najważniejsze są minuty • jakość środowiska może mocno się wahać';
  }


  function poisson(lambda){
    if(lambda<=0) return 0;
    const L=Math.exp(-lambda);
    let k=0,p=1;
    do { k++; p*=Math.random(); } while(p>L && k<60);
    return k-1;
  }

  const SEASON_GRADE_LABELS=[
    'BEZNADZIEJNY','BARDZO SŁABY','SŁABY','PRZECIĘTNY','PRZYZWOITY',
    'DOBRY','ŚWIETNY','WYBITNY','HISTORYCZNY'
  ];

  const CLUB_LEGEND_TIERS=[
    {key:'remembered',label:'Pamiętany',minSeasons:5,minPoints:125,minGreatSeasons:1},
    {key:'fan',label:'Ulubieniec kibiców',minSeasons:8,minPoints:200,minGreatSeasons:2},
    {key:'alltime11',label:'Jedenastka wszechczasów klubu',minSeasons:10,minPoints:300,minOutstandingSeasons:2,requiresClubOvr:true},
    {key:'retiredNumber',label:'Zastrzeżony numer',minSeasons:15,minPoints:450,minOutstandingSeasons:3,requiresClubOvr:true},
    {key:'stadium',label:'Stadion Twojego imienia',minSeasons:20,minPoints:650,minOutstandingSeasons:3,minHistoricSeasons:1,requiresClubOvr:true}
  ];

  function clubTrophyLegacyPoints(name){
    if(/Liga Mistrzów|Copa Libertadores/i.test(name)) return 40;
    if(/Liga Europy|Liga Konferencji|Champions League|Champions Cup|Copa Sudamericana/i.test(name)) return 30;
    if(/Mistrzostwo Polski|^Mistrzostwo:/i.test(name)) return 24;
    if(/^Mistrzostwo ligi:/i.test(name)) return 20;
    if(/Puchar Polski|^Puchar kraju/i.test(name)) return 18;
    if(/^Puchar /i.test(name)) return 12;
    return 10;
  }

  function clubAwardLegacyPoints(name){
    if(/Złota Piłka/i.test(name)) return 40;
    if(/Piłkarz Roku w Polsce/i.test(name)) return 28;
    if(/^Piłkarz sezonu/i.test(name)) return 20;
    if(/^Odkrycie Roku w Polsce|^Młody piłkarz sezonu/i.test(name)) return 12;
    if(/^Król strzelców/i.test(name)) return 12;
    if(/^Jedenastka sezonu/i.test(name)) return 10;
    return 8;
  }

  function calculateClubSeasonPoints(club,grade,minutes,clubResult){
    const minuteShare=clamp(minutes/(38*90),0,1);
    const participation=Math.round(minuteShare*12);
    const gradePoints=[0,1,2,4,6,10,16,25,40][grade.index]||0;
    const place=clubResult?.place||99;
    const teams=clubResult?.teams||18;
    const tablePoints=place===1?18:place<=3?10:place<=Math.ceil(teams/2)?4:0;
    const promotionPoints=clubResult?.promoted?15:0;
    const trophyPoints=(state.trophyHistory||[])
      .filter(t=>t.year===state.seasonYear && t.club===club.name && t.clubCredit)
      .reduce((sum,t)=>sum+clubTrophyLegacyPoints(t.name),0);
    const awardPoints=(state.awardHistory||[])
      .filter(a=>a.year===state.seasonYear && a.club===club.name)
      .reduce((sum,a)=>sum+clubAwardLegacyPoints(a.name),0);
    const points=participation+gradePoints+tablePoints+promotionPoints+trophyPoints+awardPoints;
    return {points,participation,gradePoints,tablePoints,promotionPoints,trophyPoints,awardPoints};
  }

  function clubLegendStatus(){
    const grouped=new Map();
    (state.careerSeasons||[]).forEach(season=>{
      if(!season.club || season.club==='Bez klubu') return;
      if(!grouped.has(season.club)) grouped.set(season.club,{
        club:season.club,seasons:0,points:0,bestSeason:null,peakOvr:0,reachedClubOvr:false,
        greatSeasons:0,outstandingSeasons:0,historicSeasons:0
      });
      const row=grouped.get(season.club);
      row.seasons++;
      row.points+=season.clubPoints||0;
      const seasonPeak=Math.max(season.ovrBefore||0,season.ovrAfter||0);
      row.peakOvr=Math.max(row.peakOvr,seasonPeak);
      if(Number.isFinite(season.clubStrength) && seasonPeak>=season.clubStrength) row.reachedClubOvr=true;
      if((season.gradeIndex??-1)>=6) row.greatSeasons++;
      if((season.gradeIndex??-1)>=7) row.outstandingSeasons++;
      if((season.gradeIndex??-1)>=8) row.historicSeasons++;
      if(!row.bestSeason || (season.gradeIndex??-1)>(row.bestSeason.gradeIndex??-1)) row.bestSeason=season;
    });
    return [...grouped.values()].map(row=>{
      const tiers=CLUB_LEGEND_TIERS.filter(t=>
        row.seasons>=t.minSeasons &&
        row.points>=t.minPoints &&
        row.greatSeasons>=(t.minGreatSeasons||0) &&
        row.outstandingSeasons>=(t.minOutstandingSeasons||0) &&
        row.historicSeasons>=(t.minHistoricSeasons||0) &&
        (!t.requiresClubOvr || row.reachedClubOvr)
      );
      return {...row,tiers};
    }).filter(row=>row.tiers.length>0).sort((a,b)=>b.points-a.points);
  }

  function updateClubLegendMilestones(clubName){
    const row=clubLegendStatus().find(x=>x.club===clubName);
    if(!row) return '';
    state.clubLegendMilestones=state.clubLegendMilestones||{};
    const previous=new Set(state.clubLegendMilestones[clubName]||[]);
    const fresh=row.tiers.filter(t=>!previous.has(t.key));
    state.clubLegendMilestones[clubName]=row.tiers.map(t=>t.key);
    fresh.forEach(t=>log(`${t.label}: ${clubName}`,`${row.points} punktów klubowej legendy • ${row.seasons} sezonów`));
    return fresh.length?fresh.map(t=>`⭐ ${clubName}: ${t.label}`).join(' • '):'';
  }

  const lerp=(a,b,t)=>a+(b-a)*t;

  function formPositionText(position){
    if(position<.18) return 'sam dół przedziału';
    if(position<.40) return 'dolna część przedziału';
    if(position<.62) return 'środek przedziału';
    if(position<.84) return 'górna część przedziału';
    return 'sam szczyt przedziału';
  }

  function minuteGradeCap(minutes){
    const maxMinutes=38*90;
    const share=clamp(minutes/maxMinutes,0,1);
    if(share<.05) return {share,cap:0,text:'Stracony sezon — praktycznie nie grałeś.'};
    if(share<.15) return {share,cap:2,text:'Bardzo mało minut ograniczyło ocenę sezonu.'};
    if(share<.25) return {share,cap:4,text:'Mała rola w drużynie ograniczyła ocenę sezonu.'};
    if(share<.40) return {share,cap:6,text:'Liczba minut nie pozwoliła wejść wyżej niż ŚWIETNY.'};
    if(share<.55) return {share,cap:7,text:'Do oceny HISTORYCZNEJ zabrakło udziału w sezonie.'};
    return {share,cap:8,text:''};
  }

  // Wyjątkowe, rzeczywiście uzyskane liczby mogą przebić typowy sufit
  // wylosowanej dyspozycji. Działa to tylko dla ofensywnych pozycji i tylko
  // przy naprawdę dominującej produkcji; zwykły „normalny” sezon nadal
  // pozostaje w swoim dotychczasowym zakresie.
  function exceptionalProductionFloor(form,production,apps,minutes,seasonTier){
    if(!production?.hasVisibleProduction || apps<15 || minutes<900)
      return {index:-1,label:null,metric:0,threshold:0,text:''};

    // W niższych ligach do tego samego wyróżnienia potrzeba nieco większych
    // liczb, na szczycie — nieco mniejszych. I liga jest punktem odniesienia.
    const levelScale=seasonTier<=2?1.40:seasonTier===3?1.25:seasonTier===4?1.12:seasonTier===5?1:seasonTier===6?.92:.86;
    let metric=0;
    let greatThreshold=0;
    let outstandingThreshold=0;
    if(state.position==='FWD'){
      metric=production.goals+production.assists*.70;
      greatThreshold=23*levelScale;
      outstandingThreshold=32*levelScale;
    } else {
      metric=production.goals*1.15+production.assists;
      greatThreshold=19*levelScale;
      outstandingThreshold=28*levelScale;
    }

    let index=-1;
    let threshold=0;
    if(metric>=outstandingThreshold){ index=7; threshold=outstandingThreshold; }
    else if(metric>=greatThreshold){ index=6; threshold=greatThreshold; }
    if(index<0) return {index,label:null,metric,threshold:greatThreshold,text:''};

    // Dyspozycja nadal jest szkieletem sezonu. Wielkie liczby mogą uratować
    // słaby rok, ale HISTORYCZNY pozostaje domeną sezonu życia, a normalna
    // dyspozycja nie wskakuje od samych statystyk wyżej niż ŚWIETNY.
    const formCap={crisis:4,poor:5,normal:6,good:7,great:7,career:8}[form.key]??6;
    index=Math.min(index,formCap);
    return {
      index,label:SEASON_GRADE_LABELS[index],metric,threshold,
      text:`Wyjątkowa produkcja ofensywna (${production.goals} G / ${production.assists} A) podniosła ocenę co najmniej do ${SEASON_GRADE_LABELS[index]}.`
    };
  }

  function evaluateSeasonGrade(form,production,apps,minutes,club,seasonTier){
    const [pairLow,pairHigh]=form.gradePair;
    const [boundLow,boundHigh]=form.gradeBounds;
    // Pozycja w przedziale buduje środek pary, ale nie przykuwa oceny do
    // jednego końca. Dzięki temu skrajny rzut produkcji wciąż może uratować
    // ledwo złapaną dyspozycję — bez przeskakiwania kilku poziomów.
    const baseScore=pairLow+.15+.70*form.position;

    // Produkcja wybiera głównie miejsce w parze i przy skrajności może liznąć
    // jeden sąsiedni stopień. Twarde granice dyspozycji blokują dalsze skoki.
    const productionNudge=(production.gradeQuality-.5)*2;
    const skillGap=state.overall-club.strength;
    const levelBonus=competitionBonus(seasonTier,apps,club);
    const contextNudge=clamp(skillGap/30+levelBonus/30,-.35,.35);
    const rawScore=baseScore+productionNudge+contextNudge;
    const dispositionIndex=clamp(Math.round(rawScore),boundLow,boundHigh);
    const productionFloor=exceptionalProductionFloor(form,production,apps,minutes,seasonTier);
    const beforeMinutesIndex=Math.max(dispositionIndex,productionFloor.index);
    const liftedByOutput=beforeMinutesIndex>dispositionIndex;

    const minuteLimit=minuteGradeCap(minutes);
    const finalIndex=Math.min(beforeMinutesIndex,minuteLimit.cap);
    const limitedByMinutes=finalIndex<beforeMinutesIndex;
    const pairText=`${SEASON_GRADE_LABELS[pairLow]} / ${SEASON_GRADE_LABELS[pairHigh]}`;
    const explanationParts=[];
    if(liftedByOutput) explanationParts.push(productionFloor.text);
    if(limitedByMinutes) explanationParts.push(minuteLimit.text);

    return {
      index:finalIndex,
      label:SEASON_GRADE_LABELS[finalIndex],
      dispositionIndex,
      dispositionLabel:SEASON_GRADE_LABELS[dispositionIndex],
      beforeMinutesIndex,
      beforeMinutesLabel:SEASON_GRADE_LABELS[beforeMinutesIndex],
      baseScore,productionNudge,contextNudge,rawScore,skillGap,levelBonus,
      pairLow,pairHigh,pairText,
      productionFloor,liftedByOutput,
      minuteShare:minuteLimit.share,
      minuteCap:minuteLimit.cap,
      minuteCapLabel:SEASON_GRADE_LABELS[minuteLimit.cap],
      limitedByMinutes,
      explanation:explanationParts.join(' ')
    };
  }

  function productionRates(position){
    if(position==='GK') return {g:.001,a:.008};
    if(position==='DEF') return {g:.035,a:.055};
    if(position==='MID') return {g:.12,a:.22};
    return {g:.34,a:.13};
  }

  function rollSeasonProduction(minutes,form,club){
    // Rzut jest niezależny, ale pozycja w przedziale dyspozycji przesuwa go
    // najwyżej o ±12. Nawet z samego dołu można więc wylosować świetną
    // produkcję, a z samej góry — słabą.
    const rawRoll=rand(1,100);
    const bias=Math.round((form.position-.5)*24);
    const adjustedRoll=clamp(rawRoll+bias,1,100);
    const quality=(adjustedRoll-1)/99;
    const [rangeMin,rangeMax]=form.productionRange;
    const multiplier=lerp(rangeMin,rangeMax,quality);

    const n90=minutes/90;
    const rates=productionRates(state.position);
    const skill=clamp(.68+(state.overall-38)/48,.58,1.42);
    const opposition=clamp(1-(club.strength-state.overall)*.012,.72,1.18);
    const goalLambda=n90*rates.g*skill*multiplier*opposition*(state.finishingBias||1);
    const assistLambda=n90*rates.a*skill*multiplier*opposition*(state.creativeBias||1);
    const goals=minutes>0?poisson(goalLambda):0;
    const assists=minutes>0?poisson(assistLambda):0;

    // U napastników i pomocników ocena widzi również to, co faktycznie
    // wpadło do statystyk, nie tylko ukryty rzut produkcji. Realizacja ma
    // jednak mniejszą wagę (40%), żeby seria szczęśliwych odbić nie mogła
    // przykryć całej dyspozycji. U bramkarzy i obrońców produkcja pozostaje
    // świadomie niewidocznym wkładem pozycyjnym — bez sztucznych statystyk.
    const hasVisibleProduction=state.position==='MID'||state.position==='FWD';
    const actualOutput=goals+assists*.7;
    const expectedOutput=goalLambda+assistLambda*.7;
    const realizedQuality=hasVisibleProduction
      ?clamp(.5+(actualOutput-expectedOutput)/(2*Math.max(2,expectedOutput)),0,1)
      :.5;
    const gradeQuality=hasVisibleProduction
      ?quality*.60+realizedQuality*.40
      :quality;

    return {
      goals,assists,
      rawRoll,bias,adjustedRoll,quality,realizedQuality,gradeQuality,
      hasVisibleProduction,actualOutput,expectedOutput,
      multiplier,rangeMin,rangeMax,
      goalLambda,assistLambda,skill,opposition
    };
  }

  function calculatePerformance(apps,minutes,goals,assists,form,seasonTier){
    const n90=minutes/90;
    let production=0;
    if(state.position==='GK') production=Math.min(14,apps*.35);
    if(state.position==='DEF') production=goals*3.1+assists*2.4;
    if(state.position==='MID') production=goals*3.1+assists*3.4;
    if(state.position==='FWD') production=goals*2.6+assists*2.2;

    // Dyspozycja jest tłem. Ostateczna ocena ma przede wszystkim opisywać
    // to, co naprawdę zrobiłeś w minutach, które dostałeś.
    const minutesValue=Math.min(40,n90*1.18);
    const availabilityBonus=apps>=25?5:apps>=15?2:0;
    const levelBonus=competitionBonus(seasonTier,apps,state.club);
    const formInfluence=form.performanceMod;
    return Math.max(0,minutesValue+Math.min(30,production)+availabilityBonus+levelBonus+formInfluence);
  }

  // v0.60 — DODATKOWA SPORTOWA WARSTWA MEDIALNOŚCI.
  // Nie zastępuje zdarzeń fabularnych ani ich nie osłabia.
  // Pełny sezon, gra w mocnym klubie i realna produkcja boiskowa
  // same budują (lub odbierają) medialność.
  function sportMediaLayer(performance,club,apps){
    let performanceMedia=0;
    if(performance>=56) performanceMedia=4;
    else if(performance>=43) performanceMedia=2;
    else if(performance>=28) performanceMedia=1;
    else if(performance<16) performanceMedia=-2;

    let clubMedia=0;
    if(isForeignClub(club)){
      clubMedia=({1:3,2:2,3:1,4:0,5:-1,6:-2})[club.foreignTier] ?? 0;

      // Najmocniejsze marki w obrębie tieru są jeszcze bardziej widoczne.
      if(club.foreignTier===1 && club.strength>=94) clubMedia+=1;
      else if(club.foreignTier===2 && club.strength>=87) clubMedia+=1;
      else if(club.foreignTier===3 && club.strength>=80) clubMedia+=1;
    } else {
      if(club.tier===6) clubMedia=club.strength>=76?2:1;
      else if(club.tier===5) clubMedia=0;
      else if(club.tier<=3) clubMedia=-1;
    }

    // Sam prestiż klubu działa tylko, jeśli faktycznie jesteś widoczny.
    if(clubMedia>0){
      const exposure=apps>=25?1:apps>=15?.75:apps>=8?.4:0;
      clubMedia=Math.round(clubMedia*exposure);
    }

    let playingMedia=0;
    if(apps>=30) playingMedia=2;
    else if(apps>=20) playingMedia=1;
    else if(apps<8) playingMedia=-2;

    const total=clamp(performanceMedia+clubMedia+playingMedia,-6,8);
    return {performanceMedia,clubMedia,playingMedia,total};
  }

  function addSportMedia(delta,reason=''){
    if(!delta) return 0;
    const before=state.recognition||0;
    state.recognition=clamp(before+delta,0,100);
    const actual=state.recognition-before;
    if(actual && reason) log(`Medialność ${actual>0?'+':''}${actual}`,reason);
    return actual;
  }

  function aclAnnualChance(age, injuryRisk){
    // Szansa ROCZNA, niezależna od zwykłego rzutu urazu.
    // Dostępna dopiero dla bardzo podatnych zawodników (40+).
    if(injuryRisk<40) return 0;

    // Sama podatność 40–42 daje połowę punktu procentowego,
    // 43–45 daje 1%. Wiek dokłada kolejne niewielkie ryzyko.
    let chance=injuryRisk>=43 ? 1.0 : 0.5;

    if(age>=40) chance+=2.0;
    else if(age>=37) chance+=1.5;
    else if(age>=34) chance+=1.0;
    else if(age>=30) chance+=0.5;

    return chance; // procent na sezon, maksymalnie 3%
  }

  function simulateSeason(matchOverrides=null){
    const club={...state.club};
    const seasonTier=club.tier;
    const useMatch=!!(matchOverrides && Number.isFinite(matchOverrides.apps));
    state.justRelegated=false; state.justPromoted=false; state.justNationalCall=false;
    state.lastInjuryLost=0; state.lastInjurySeverity=null; state.lastInjuryOvrPenalty=0;
    state.seasonNationalCaps=0; state.seasonNationalGoals=0;
    state.forceCorruptPromotion=false;

    // Udany układ z poprzedniego lata: sezon gramy normalnie, ale awans jest zapewniony.
    if(state.corruptionPlan && !state.corruptionPlan.caught && state.corruptionPlan.clubName===club.name){
      const plan=state.corruptionPlan;
      state.corruptionPlan=null;
      state.forceCorruptPromotion=true;
      log('Układ nie został wykryty.',`Rzut ${plan.roll}/100 • klub ma zapewniony awans po sezonie.`);
    }

    const qualityGap=state.overall-club.strength;
    const openingStartChance=projectedStartChance(club,state.boost);

    // Najpierw losujemy środowisko, potem niezależny od hierarchii rzut dyspozycji.
    const env=rollClubEnvironment(club,state.age);
    let form=rollSeasonForm();
    if(useMatch && Number.isFinite(matchOverrides.avgRating)){
      const r=matchOverrides.avgRating;
      if(r>=8.2) form={...form,key:'career',label:'SEZON ŻYCIA',seasonBonus:2,hierarchy:25};
      else if(r>=7.4) form={...form,key:'great',label:'ŚWIETNY',seasonBonus:1,hierarchy:18};
      else if(r>=6.8) form={...form,key:'good',label:'DOBRY',seasonBonus:1,hierarchy:10};
      else if(r>=6.0) form={...form,key:'normal',label:'NORMALNY',seasonBonus:0,hierarchy:0};
      else if(r>=5.4) form={...form,key:'poor',label:'SŁABY',seasonBonus:-1,hierarchy:-8};
      else form={...form,key:'crisis',label:'KRYZYS',seasonBonus:-2,hierarchy:-18};
    }

    // Dyspozycja zmienia pozycję w hierarchii W TRAKCIE sezonu.
    // Dlatego rezerwowy może rozegrać mnóstwo meczów po świetnym roku.
    let startChance=clamp(openingStartChance+form.hierarchy,1,97);

    // Przełom: nawet młody rezerwowy w wielkim klubie może niespodziewanie dostać szansę.
    const bChance=breakthroughChance(openingStartChance,form,env,club);
    let breakthrough=false;
    if(!useMatch && bChance>0 && rand(1,100)<=bChance){
      breakthrough=true;
      startChance=clamp(startChance+rand(44,68),1,97);
    }

    // Sama dyspozycja nie może zmienić zawodnika 20 OVR w regularnego gracza
    // Ekstraklasy. Wyjątkiem pozostaje istniejący młodzieżowy „przełom”.
    if(!breakthrough) startChance=Math.min(startChance,qualityGapStartChanceCap(qualityGap));

    let apps=useMatch?Math.max(0,Math.round(matchOverrides.apps)):rollSeasonAppearances(startChance,breakthrough);
    // Sezon życia musi oznaczać realnie dużą rolę. Zawieszenie lub późniejszy
    // uraz nadal mogą tę liczbę obniżyć. Podłoga skaluje się jednak do realnej
    // różnicy poziomu — przy przepaści sportowej nie działa wcale.
    const careerAppsFloor=(!useMatch && form.key==='career')?careerSeasonAppsFloor(qualityGap,breakthrough):0;
    if(careerAppsFloor) apps=Math.max(apps,careerAppsFloor);
    let availabilityNote=useMatch?(matchOverrides.note||'Sezon z trybem meczowym (pogoda / skille / decyzje).'):'';
    const pendingAppsFactor=Number.isFinite(state.nextAppsFactor)?state.nextAppsFactor:1;
    if(!useMatch && pendingAppsFactor<1){
      const beforeApps=apps;
      apps=Math.floor(apps*pendingAppsFactor);
      availabilityNote=state.nextAppsReason||`Zawieszenie ograniczyło występy: ${beforeApps} → ${apps}.`;
      state.nextAppsFactor=1;
      state.nextAppsReason=null;
    } else if(useMatch){
      state.nextAppsFactor=1;
      state.nextAppsReason=null;
    }
    const starter = startChance>62 || careerAppsFloor>=20 || (useMatch && apps>=20);

    // v0.69 — URAZY.
    // 1) Bardzo rzadka katastrofa: zerwanie więzadeł krzyżowych.
    //    Tylko przy bazowej podatności 40+; wiek zwiększa ryzyko.
    // 2) Jeśli ACL nie wypada, wykonujemy dotychczasowy zwykły rzut urazu.
    let injury='';
    let injuryOvrPenalty=0;
    const injuryChance=clamp(state.injuryRisk+env.injuryMod+(matchOverrides?.weatherInjury||0),3,55);
    const aclChance=aclAnnualChance(state.age,state.injuryRisk);
    let aclHappened=false;

    if(!useMatch && apps>0 && aclChance>0 && rand(1,1000)<=Math.round(aclChance*10)){
      aclHappened=true;
      const lost=apps; // cały sportowo dostępny sezon przepada
      apps=0;
      injuryOvrPenalty=-2;
      state.lastInjuryLost=lost;
      state.lastInjurySeverity='ZERWANIE WIĘZADEŁ KRZYŻOWYCH';
      state.lastInjuryOvrPenalty=injuryOvrPenalty;
      state.injuryRisk=clamp(state.injuryRisk+5,5,45);
      injury=` URAZ — ZERWANIE WIĘZADEŁ KRZYŻOWYCH: cały sezon bez gry (${lost} potencjalnych występów) • skutek rozwojowy -2 OVR • roczna szansa tego urazu: ${aclChance.toFixed(1)}%.`;
    }

    if(!useMatch && !aclHappened && apps>0 && rand(1,100)<=injuryChance){
      // Starszy i bardziej podatny zawodnik ma trochę większą szansę na ciężki uraz,
      // ale nawet przy wysokim ryzyku większość urazów pozostaje drobna/średnia.
      let severityRoll=rand(1,100);
      if(state.injuryRisk>=30) severityRoll+=4;
      if(state.age>=32) severityRoll+=3;
      if(state.age>=36) severityRoll+=3;

      let severity='DROBNY';
      let minLost=1, maxLost=4, riskRise=1;

      if(severityRoll>=96){
        severity='BARDZO CIĘŻKI';
        minLost=17; maxLost=28; riskRise=5; injuryOvrPenalty=-2;
      } else if(severityRoll>=83){
        severity='POWAŻNY';
        minLost=10; maxLost=16; riskRise=3; injuryOvrPenalty=-1;
      } else if(severityRoll>=56){
        severity='ŚREDNI';
        minLost=5; maxLost=9; riskRise=2;
      }

      const plannedLost=rand(minLost,maxLost);
      const lost=Math.min(apps,plannedLost);
      apps=Math.max(0,apps-lost);

      state.lastInjuryLost=lost;
      state.lastInjurySeverity=severity;
      state.lastInjuryOvrPenalty=injuryOvrPenalty;
      state.injuryRisk=clamp(state.injuryRisk+riskRise,5,45);

      injury=` URAZ — ${severity}: straciłeś ${lost} ${lost===1?'mecz':lost>=2&&lost<=4?'mecze':'meczów'}${injuryOvrPenalty?` • skutek rozwojowy ${injuryOvrPenalty} OVR`:''} (ryzyko zwykłego urazu: ${injuryChance}%).`;
    }

    let minutes=useMatch
      ? Math.max(0,Math.round(matchOverrides.minutes||0))
      : (apps===0?0:Math.round(apps*(starter?rand(68,88):rand(20,58))));
    const pendingMinutesFactor=Number.isFinite(state.nextMinutesFactor)?state.nextMinutesFactor:1;
    if(!useMatch && pendingMinutesFactor<1){
      const beforeMinutes=minutes;
      minutes=Math.floor(minutes*pendingMinutesFactor);
      availabilityNote+=(availabilityNote?' ':'')+`Uraz ograniczył minuty: ${beforeMinutes} → ${minutes}.`;
      state.nextMinutesFactor=1;
    } else if(useMatch){
      state.nextMinutesFactor=1;
    }
    const production=useMatch
      ? {
          goals:Math.max(0,Math.round(matchOverrides.goals||0)),
          assists:Math.max(0,Math.round(matchOverrides.assists||0)),
          rawRoll:50,bias:0,adjustedRoll:50,multiplier:1,rangeMin:1,rangeMax:1,
          hasVisibleProduction:true,realizedQuality:1,gradeQuality:1
        }
      : rollSeasonProduction(minutes,form,club);
    const goals=production.goals;
    const assists=production.assists;

    const levelBonus=competitionBonus(seasonTier,apps,club);
    const performance=calculatePerformance(apps,minutes,goals,assists,form,seasonTier);
    const grade=evaluateSeasonGrade(form,production,apps,minutes,club,seasonTier);
    state.status = startChance>82?'Gwiazda zespołu':startChance>64?'Podstawowy':startChance>43?'Rotacja':'Rezerwowy';

    const before=state.overall;    const rawAgeDrift=rollNaturalGrowth(state.age);
    const profAgeProtection=rawAgeDrift<0 ? Math.min(-rawAgeDrift,veteranProfessionalismProtection(state.age)) : 0;
    const ageDrift=rawAgeDrift+profAgeProtection;
    const seasonGrowth=form.seasonBonus;

    // MEDIALNOŚĆ = forma sezonu + ekspozycja poziomu rozgrywek.
    // Granie nisko samo w sobie zjada medialność. Świetny rok może tę stratę
    // częściowo lub wyjątkowo całkowicie odrobić, ale normalny sezon nisko oznacza spadek.
    const recognitionBefore=state.recognition||0;
    const visibilityBonus=seasonTier<=2?0:seasonTier<=4?1:seasonTier===5?2:seasonTier===6?3:4;

    let formMedia=0;
    if(form.key==='career') formMedia=6+visibilityBonus;
    else if(form.key==='great') formMedia=3+visibilityBonus;
    else if(form.key==='good') formMedia=1+Math.floor(visibilityBonus/2);
    else if(form.key==='poor') formMedia=-1;
    else if(form.key==='crisis') formMedia=-2;

    let levelMedia=0;
    if(isForeignClub(club)){
      levelMedia=({1:1,2:1,3:0,4:-2,5:-4,6:-6})[club.foreignTier] ?? 0;
    } else {
      levelMedia=({1:-6,2:-5,3:-4,4:-2,5:-1,6:0})[seasonTier] ?? 0;
    }

    const baseSeasonRecognition=formMedia+levelMedia;
    const sportMedia=sportMediaLayer(performance,club,apps);
    const seasonRecognition=baseSeasonRecognition+sportMedia.total;
    state.recognition=clamp(recognitionBefore+seasonRecognition,0,100);

    // OSOBNY MODYFIKATOR ŚRODOWISKA:
    // może rozwijać młodego nawet przy małej liczbie występów.
    const environmentGrowth=rollEnvironmentGrowth(env,state.age,seasonTier);

    let talentMod=0;
    let talentChance=0;
    let talentRoll=null;
    let minutesMod=0;

    // TALENT NIE JEST SUFITEM.
    // To wrodzona skłonność do szybszego uczenia się w młodości.
    // Nie określa maksymalnego OVR i nie blokuje wzrostu nigdy.
    if(state.age<=18) talentChance=clamp(Math.round(8+state.talent*.35),12,43);
    else if(state.age<=21) talentChance=clamp(Math.round(5+state.talent*.30),10,35);
    else if(state.age<=24) talentChance=clamp(Math.round(4+state.talent*.20),7,24);
    else if(state.age<=27) talentChance=clamp(Math.round(2+state.talent*.10),4,12);

    if(isEasy() && talentChance>0) talentChance=clamp(talentChance+10,0,60);

    if(talentChance>0){
      talentRoll=rand(1,100);
      if(talentRoll<=talentChance) talentMod=1;
    }

    // Brak minut jest osobnym, jawnym ryzykiem rozwojowym młodego.
    if(apps<8 && state.age<=27){
      const baseNoMinutesRisk=state.age<=20?65:state.age<=23?50:30;
      const noMinutesRisk=Math.round(baseNoMinutesRisk*(isEasy()?.65:1));
      if(rand(1,100)<=noMinutesRisk) minutesMod=-1;
    }

    const rawGrowth=ageDrift+seasonGrowth+environmentGrowth.delta+talentMod+minutesMod+injuryOvrPenalty;
    let growth=rawGrowth;
    let formGuarantee=0;
    // Ostateczna gwarancja kierunku: pozostałe składniki ustalają skalę,
    // ale nie mogą odwrócić znaczenia dwóch skrajnych dyspozycji.
    if(form.key==='crisis' && growth>-1){
      formGuarantee=-1-growth;
      growth=-1;
    } else if(form.key==='career' && growth<1){
      formGuarantee=1-growth;
      growth=1;
    }
    // Nie istnieje żaden indywidualny sufit potencjału.
    // Jeśli wszystkie składowe rozwoju są dodatnie, OVR rośnie bez dodatkowego hamulca.

    // Brak limitu rocznej zmiany OVR.
    // Wyjątkowy zbieg: sezon życia + wiek + środowisko + rezerwa talentu
    // może dać naprawdę wyjątkowy skok. Analogicznie fatalny rok może boleć.
    state.overall=clamp(state.overall+growth,20,overallCap());
    noteLegendOverallChange(before);
    if(window.LabData && state.attrs){
      const delta=state.overall-before;
      if(delta){
        const keys=window.LabData.ATTR_KEYS;
        keys.forEach(k=>{ state.attrs[k]=clamp((state.attrs[k]||40)+delta,1,99); });
      }
      state.overall=window.LabData.overallFromAttrs(state.attrs);
    }
    state.boost=0;

    state.season={apps,goals,assists,minutes};
    if(apps<8) state.lowAppsStreak=(state.lowAppsStreak||0)+1;
    else state.lowAppsStreak=0;
    state.totals.apps+=apps; state.totals.goals+=goals; state.totals.assists+=assists; state.totals.minutes+=minutes;

    // Dwa kolejne ZAKOŃCZONE sezony na 99 otwierają Tryb Legendy
    // przed rozpoczęciem następnego sezonu.
    if(!state.legendUnlocked){
      if(state.overall===99) state.legend99Streak=(state.legend99Streak||0)+1;
      else state.legend99Streak=0;
    }

    // Sezon liczy się jako 100+, jeśli zawodnik zaczynał go już ponad zwykłym sufitem.
    if(state.legendUnlocked && before>=100){
      state.legendSeasons100=(state.legendSeasons100||0)+1;
    }

    const signed=n=>n>0?`+${n}`:`${n}`;
    const ovrText = state.overall!==before?`OVR ${before} → ${state.overall}.`:`OVR ${state.overall}.`;
    const visibleOvrParts=[
      `wiek ${signed(ageDrift)}${profAgeProtection?` (profesjonalizm +${profAgeProtection})`:''}`,
      `sezon ${signed(seasonGrowth)}`,
      `środowisko ${signed(environmentGrowth.delta)}`
    ];
    if(talentMod) visibleOvrParts.push(`talent ${signed(talentMod)}`);
    if(minutesMod) visibleOvrParts.push(`brak minut ${signed(minutesMod)}`);
    if(injuryOvrPenalty) visibleOvrParts.push(`uraz ${signed(injuryOvrPenalty)}`);
    if(formGuarantee) visibleOvrParts.push(`gwarancja ${form.key==='crisis'?'kryzysu':'sezonu życia'} ${signed(formGuarantee)}`);
    const visibleOvrBreakdown=`OVR ${before} → ${state.overall} • ${visibleOvrParts.join(' • ')}`;
    const visibleRecognition=seasonRecognition
      ? ` Medialność: ${recognitionBefore} → ${state.recognition}.`
      : '';
    const talentText=talentChance>0
      ? `talent: ${talentChance}% na +1, rzut ${talentRoll}/100 → ${talentMod?'+1':'0'}`
      : `talent: w tym wieku nie daje już osobnego bonusu rozwojowego`;
    const growthBreakdown=`OVR: wiek ${signed(ageDrift)}${profAgeProtection?` (bazowo ${signed(rawAgeDrift)}, profesjonalizm uratował +${profAgeProtection})`:''} • sezon ${signed(seasonGrowth)} • środowisko ${signed(environmentGrowth.delta)} • ${talentText}${minutesMod?` • brak minut ${signed(minutesMod)}`:''}${injuryOvrPenalty?` • uraz ${signed(injuryOvrPenalty)}`:''}${formGuarantee?` • gwarancja ${form.key==='crisis'?'kryzysu':'sezonu życia'} ${signed(formGuarantee)}`:''} = ${signed(growth)}.`;
    const p=form.probabilities;
    const seasonRollText=`Szanse dyspozycji: kryzys ${p.crisis}% • słaby ${p.poor}% • normalny ${p.normal}% • dobry ${p.good}% • świetny ${p.great}% • życia ${p.career}%. Początkowa szansa na grę ani poziom trudności NIE wpływają na ten rozkład. Profesjonalizm ${signed(form.profMod)}. Rzut ${form.roll}/100 → ${form.label}; przedział ${form.bandStart}–${form.bandEnd}, pozycja ${form.positionPct}% (${formPositionText(form.position)}). Wpływ dyspozycji na hierarchię: ${signed(form.hierarchy)} p.p.; ${openingStartChance}% → ${startChance}%${breakthrough?' po przełomie':''}. Bonus OVR sezonu: ${signed(form.seasonBonus)}.`;
    const productionRollText=`Produkcja: surowy rzut ${production.rawRoll}/100${production.bias?` • przesunięcie za pozycję w dyspozycji ${signed(production.bias)}`:''} → ${production.adjustedRoll}/100. Mnożnik ${production.multiplier.toFixed(2)}× w zakresie ${production.rangeMin.toFixed(2)}–${production.rangeMax.toFixed(2)} dla ${form.label}.${production.hasVisibleProduction?` Realizacja goli i asyst: ${(production.realizedQuality*100).toFixed(0)}%; łączna jakość produkcji do oceny: ${(production.gradeQuality*100).toFixed(0)}% (60% rzut, 40% wykonanie).`:` Dla tej pozycji jakość produkcji jest wkładem pozycyjnym bez sztucznych dodatkowych statystyk.`} Produkcja współpracuje z OVR, poziomem rywali i minutami; nie daje osobnego bonusu OVR.`;
    const gradeRollText=`Ocena sezonu: baza dyspozycji ${grade.pairText}, dokładna baza ${grade.baseScore.toFixed(2)} • produkcja ${grade.productionNudge>=0?'+':''}${grade.productionNudge.toFixed(2)} • kontekst OVR/poziomu ${grade.contextNudge>=0?'+':''}${grade.contextNudge.toFixed(2)} → ${grade.dispositionLabel}.${grade.liftedByOutput?` Wyjątkowe liczby ${production.goals} G / ${production.assists} A ustanawiają podłogę ${grade.productionFloor.label} → ${grade.beforeMinutesLabel}.`:''}${grade.limitedByMinutes?` Limit za ${(grade.minuteShare*100).toFixed(1)}% możliwych minut: najwyżej ${grade.minuteCapLabel} → ${grade.label}.`:` Udział w możliwych minutach: ${(grade.minuteShare*100).toFixed(1)}% → bez ograniczenia oceny.`}`;
    const ep=environmentGrowth.probabilities;
    const envText=`Środowisko ${env.label} • poziom treningu: ${environmentGrowth.trainingLevel}.${isEasy()?' Tryb łatwy wzmacnia tylko szanse rozwoju OVR z nauki i łagodzi rozwojowe minusy środowiska.':''} Rozwój środowiskowy: ${ep.minus1}% → -1 • ${ep.flat}% → 0 • ${ep.plus1}% → +1${ep.plus2?` • ${ep.plus2}% → +2`:''}. Rzut ${environmentGrowth.roll}/100 → ${signed(environmentGrowth.delta)} OVR. Ryzyko zwykłego urazu w tym sezonie: ${injuryChance}%.${aclChance>0?` Osobna roczna szansa zerwania więzadeł przy podatności ${state.injuryRisk}/45: ${aclChance.toFixed(1)}%.`:''}${state.lastInjurySeverity?` Wypadł uraz: ${state.lastInjurySeverity}, stracone mecze ${state.lastInjuryLost}${injuryOvrPenalty?`, OVR ${injuryOvrPenalty}`:''}.`:' Brak urazu.'}`;

    const injurySeasonText=state.lastInjurySeverity
      ? `Uraz: ${state.lastInjurySeverity}${state.lastInjuryLost?` • stracone mecze: ${state.lastInjuryLost}`:''}${state.lastInjuryOvrPenalty?` • OVR ${state.lastInjuryOvrPenalty}`:''}.`
      : `Uraz: brak.`;

    const seasonNotes=[];
    if(availabilityNote) seasonNotes.push(availabilityNote);
    if(breakthrough) seasonNotes.push(`⚡ PRZEŁOM: dostałeś niespodziewaną serię szans`);
    if(seasonTier===6) state.ekstraklasaSeasons++;
    if(isForeignClub(club)) state.foreignSeasons++;
    resolveClubSeason(performance, club, seasonTier, form, grade, minutes, function(clubNote,clubSeasonResult){
    if(clubNote) seasonNotes.push(clubNote);
    const nationalNote=maybeNationalTeam(performance, seasonTier, club); if(nationalNote) seasonNotes.push(nationalNote);
    const euroNote=nssPolska.checkEuro(); if(euroNote) seasonNotes.push(euroNote);
    const worldCupNote=nssPolska.checkWorldCup(); if(worldCupNote) seasonNotes.push(worldCupNote);
      const awardNotes=maybeAward(goals,assists,apps,grade,seasonTier,club);
    if(awardNotes.length) seasonNotes.push(...awardNotes);
    state.score += Math.round(performance/3)+Math.max(0,seasonTier*2)+(state.seasonNationalCaps>0?12:0);

    const clubPointBreakdown=calculateClubSeasonPoints(club,grade,minutes,clubSeasonResult);
    const seasonRecord={
      year:state.seasonYear,age:state.age,club:club.name,tier:seasonTier,clubStrength:club.strength,
      ovrBefore:before,ovrAfter:state.overall,apps,goals,assists,minutes,
      grade:grade.label,gradeIndex:grade.index,gradeBeforeMinutes:grade.beforeMinutesLabel,
      minuteShare:grade.minuteShare,form:form.label,seasonRoll:form.roll,formPosition:form.position,
      productionRoll:production.rawRoll,productionAdjustedRoll:production.adjustedRoll,productionMultiplier:production.multiplier,
      competition:clubCompetition(club),country:club.country||null,foreignTier:club.foreignTier||null,
      leaguePlace:clubSeasonResult.place,leagueTeams:clubSeasonResult.teams,clubSeasonResult,
      clubPoints:clubPointBreakdown.points,clubPointBreakdown,
      environment:env.label,environmentGrowth:environmentGrowth.delta,environmentRoll:environmentGrowth.roll,
      recognitionBefore,recognitionAfter:state.recognition,recognitionDelta:seasonRecognition,
      nationalCaps:state.seasonNationalCaps||0,nationalGoals:state.seasonNationalGoals||0,note:''
    };
    state.careerSeasons.push(seasonRecord);
    const legendMilestone=updateClubLegendMilestones(club.name);
    if(legendMilestone) seasonNotes.push(legendMilestone);

    const seasonNoteParts=[];
    if(breakthrough) seasonNoteParts.push('przełom');
    seasonNoteParts.push(injurySeasonText);
    if(seasonNotes.length) seasonNoteParts.push(...seasonNotes);
    seasonRecord.note=seasonNoteParts.join(' • ');

    els.eventBox.classList.remove('special-event'); void els.eventBox.offsetWidth; els.eventBox.classList.add('special-event');
    const seasonLead=`<strong>${apps} meczów. ${goals} goli. ${assists} asyst.</strong> ${visibleOvrBreakdown} Dyspozycja: <strong>${form.label}</strong>. Ocena: <strong>${grade.label}</strong>.${grade.explanation?` ${grade.explanation}`:''} Środowisko: <strong>${env.label}</strong>.${visibleRecognition} ${state.status}.${Math.abs(form.hierarchy)>=15?` Hierarchia: ${openingStartChance}% → ${startChance}%.`:''}${state.seasonNationalCaps?` Kadra: ${state.seasonNationalCaps} M / ${state.seasonNationalGoals} G.`:''} <strong>${injurySeasonText}</strong>${seasonNotes.length?' '+seasonNotes.join(' • '):''}`;
    const detailBlock=`<details class="roll-details">
        <summary>Pokaż szczegóły losowania</summary>
        <div>${seasonRollText}<br>${productionRollText}<br>${gradeRollText}<br>${envText}<br>${growthBreakdown}<br>Medialność: dotychczasowa warstwa ${baseSeasonRecognition>0?'+':''}${baseSeasonRecognition} • sport: boisko ${sportMedia.performanceMedia>0?'+':''}${sportMedia.performanceMedia}, klub ${sportMedia.clubMedia>0?'+':''}${sportMedia.clubMedia}, regularna gra ${sportMedia.playingMedia>0?'+':''}${sportMedia.playingMedia} • razem ${seasonRecognition>0?'+':''}${seasonRecognition} (${recognitionBefore} → ${state.recognition}).<br>Wewnętrzny wynik sportowy: ${performance.toFixed(1)} — używany przez rynek, reprezentację, nagrody i wyniki klubu. Nie jest drugą oceną sezonu. Poziom rywali: +${levelBonus.toFixed(1)} do tego wyniku.</div>
      </details>`;
    if(window.CareerLife){
      const headlines=window.CareerLife.buildSeasonHeadlines(state,{
        apps,goals,assists,formLabel:form.label,gradeLabel:grade.label,injuryText:injurySeasonText,
        clubName:club.name,seasonNotes,nationalCaps:state.seasonNationalCaps||0
      });
      // fans drift from form / apps
      if(state.relations){
        if(apps>=28) state.relations.fans=Math.max(0,Math.min(100,state.relations.fans+2));
        if(form.label&&/KRYZYS|SŁABA/i.test(form.label)) state.relations.fans=Math.max(0,Math.min(100,state.relations.fans-3));
        if(form.label&&/ŚWIETNA|REWELACYJNA|WYBITNA/i.test(form.label)) state.relations.coach=Math.max(0,Math.min(100,state.relations.coach+2));
        window.CareerLife.syncSoftFromRelations(state);
      }
      els.eventBox.innerHTML=window.CareerLife.newspaperHtml(headlines,{
        formLabel:form.label,
        kicker:`KONIEC SEZONU ${state.seasonYear}/${String(state.seasonYear+1).slice(2)}`,
        lead:seasonLead,
        detailHtml:detailBlock
      });
    } else {
      els.eventBox.innerHTML=`<div class="event-kicker">KONIEC SEZONU • ${form.label}</div>
      <h3>${apps} meczów. ${goals} goli. ${assists} asyst.</h3>
      <p>${seasonLead}</p>${detailBlock}`;
    }
    log(`${club.name}: ${apps} M / ${goals} G / ${assists} A`, `${tierName(seasonTier)} • dyspozycja ${form.label} (rzut ${form.roll}) • ocena ${grade.label} • ${growthBreakdown}`);

    if(state.loanReturn) returnFromLoan();
    render();

    // NSS: po awansie gracz sam wybiera między pełnym turniejem a natychmiastową
    // symulacją wyniku Polski. Turniej nie uruchamia się już automatycznie.
    function afterSeasonFlow(){
      const decision=makeDecision(performance);
      if(decision) presentDecision(decision, ()=>presentClubChoice(performance));
      else presentClubChoice(performance);
    }
    if(state.pendingTournament){
      offerTournamentChoice(afterSeasonFlow);
    } else {
      afterSeasonFlow();
    }
    });
  }


  // v0.48 — UNIWERSALNE AWANSE ZAGRANICZNE.
  // Każda realna niższa liga istniejąca w bazie może dać awans o JEDEN poziom.
  // Wyjątki bez awansu (np. zamknięte systemy) nadal mogą mieć mistrza swojej ligi.
  // Pełna tabela nie jest potrzebna: liczymy wynik klubu względem poziomu ligi.

  const FOREIGN_LOWER_LEAGUES={
    // WYSPY
    'Anglia|Sky Bet League One':{to:'Sky Bet Championship'},
    'Anglia|Sky Bet Championship':{to:'Premier League'},
    'Szkocja|William Hill Championship':{to:'William Hill Premiership'},

    // IBERIA
    'Hiszpania|Primera Federación':{to:'LALIGA HYPERMOTION'},
    'Hiszpania|LALIGA HYPERMOTION':{to:'LaLiga EA Sports'},
    'Portugalia|Liga Portugal 2 Meu Super':{to:'Liga Portugal Betclic'},

    // FRANCJA + BENELUX
    'Francja|Ligue 3':{to:'Ligue 2 BKT'},
    'Francja|Ligue 2 BKT':{to:'Ligue 1'},
    'Holandia|Keuken Kampioen Divisie':{to:'Eredivisie'},
    'Belgia|Challenger Pro League':{to:'Jupiler Pro League'},

    // DACH / ALPY
    'Niemcy|3. Liga':{to:'2. Bundesliga'},
    'Niemcy|2. Bundesliga':{to:'Bundesliga'},
    'Austria|ADMIRAL 2. Liga':{to:'ADMIRAL Bundesliga'},
    'Szwajcaria|dieci Challenge League':{to:'Brack Super League'},

    // APENINY
    'Włochy|Serie C':{to:'Serie B'},
    'Włochy|Serie B':{to:'Serie A'},

    // NORDYCKIE
    'Dania|Betinia Liga':{to:'3F Superliga'},
    'Szwecja|Superettan':{to:'Allsvenskan'},
    'Norwegia|OBOS-ligaen':{to:'Eliteserien'},
    'Finlandia|Ykkösliiga':{to:'Veikkausliiga'},

    // EUROPA ŚRODKOWA
    'Czechy|Chance Národní Liga':{to:'Chance Liga'},
    'Słowacja|MONACObet liga':{to:'Niké liga'},
    'Węgry|NB II':{to:'NB I'},

    // BAŁKANY
    'Grecja|Super League 2':{to:'Stoiximan Super League'},
    'Chorwacja|SuperSport Prva NL':{to:'SuperSport HNL'},
    'Serbia|Prva Liga Srbije':{to:'Mozzart Bet SuperLiga'},
    'Słowenia|2. SNL':{to:'Prva liga Telemach'},
    'Bośnia i Hercegowina|WWIN Prva liga FBiH':{to:'WWin Liga BiH'},
    'Bośnia i Hercegowina|Prva liga RS':{to:'WWin Liga BiH'},
    'Czarnogóra|Druga CFL':{to:'Meridianbet 1. CFL'},
    'Macedonia Północna|2. MFL':{to:'1. MFL'},
    'Albania|Kategoria e Parë':{to:'Abissnet Superiore'},
    'Kosowo|Liga e Parë':{to:'Superliga e Kosovës'},
    'Rumunia|Liga II':{to:'SuperLiga'},
    'Bułgaria|Vtora Liga':{to:'efbet Liga'},

    // WSCHÓD / MORZE CZARNE
    'Turcja|Trendyol 1. Lig':{to:'Süper Lig'},
    'Cypr|Cyprus Second Division':{to:'Cyprus League by Stoiximan'},
    'Ukraina|Ukrainian First League':{to:'Ukrainian Premier League'},
    'Mołdawia|Liga 1':{to:'Liga 7777'},
    'Gruzja|Erovnuli Liga 2':{to:'Erovnuli Liga'},
    'Armenia|Armenian First League':{to:'Armenian Premier League'},
    'Azerbejdżan|Azerbaijan First League':{to:'Azerbaijan Premier League'},
    'Kazachstan|Kazakhstan First League':{to:'Kazakhstan Premier League'},

    // AZJA
    'Japonia|J2 League':{to:'J1 League'},

    // Systemy bez normalnego awansu do najwyższej ligi.
    // Mogą wygrać własne rozgrywki, ale nie przenosimy ich sztucznie szczebel wyżej.
    'USA|USL Championship':{to:null,closed:true},
    'Meksyk|Liga de Expansión MX':{to:null,closed:true}
  };

  function foreignLowerLeagueInfo(club){
    if(!club) return null;
    return FOREIGN_LOWER_LEAGUES[`${club.country}|${club.league}`] || null;
  }

  function foreignPromotionInfo(club){
    const info=foreignLowerLeagueInfo(club);
    return info && info.to ? info : null;
  }

  function foreignLeaguePeers(club){
    return GAME_DATA.foreignClubs.filter(c=>c.country===club.country && c.league===club.league);
  }

  function foreignLeagueStrengthGap(club){
    const peers=foreignLeaguePeers(club);
    if(!peers.length) return 0;
    return Math.max(0,Math.max(...peers.map(c=>c.strength))-club.strength);
  }

  // Najwyższa liga: zawsze istnieje szansa na mistrzostwo kraju/lokalnej najwyższej ligi.
  // Nie wymaga pełnej tabeli. Liczy się poziom klubu i dystans do najmocniejszego
  // wpisanego klubu z tych rozgrywek.
  function foreignNationalTitleChance(club,performance){
    const ft=club.foreignTier||4;
    const base=({1:18,2:13,3:8,4:4,5:2,6:1})[ft]||4;
    const gap=foreignLeagueStrengthGap(club);
    const relative=12-gap*1.4;
    const formBonus=performance>=62?4:performance>=52?2:performance>=43?1:0;
    return clamp(Math.round(base+relative+formBonus),1,38);
  }

  // Mistrzostwo niższej ligi — osobna rzecz od mistrzostwa kraju.
  function foreignLowerLeagueTitleChance(club,performance){
    const ft=club.foreignTier||5;
    const base=({1:10,2:9,3:8,4:7,5:6,6:5})[ft]||6;
    const gap=foreignLeagueStrengthGap(club);
    const relative=10-gap*1.25;
    const formBonus=performance>=60?4:performance>=50?2:performance>=42?1:0;
    return clamp(Math.round(base+relative+formBonus),1,30);
  }

  function foreignPromotionChance(club,performance){
    const gap=foreignLeagueStrengthGap(club);
    const formBonus=performance>=60?7:performance>=50?4:performance>=42?2:0;
    const tierBonus=club.foreignTier===3?3:club.foreignTier===4?2:0;
    return clamp(Math.round(17-gap*1.55+formBonus+tierBonus),2,34);
  }

  // ============================================================
  // TABELA LIGOWA — pozycja klubu jest wspólną podstawą dla opisu
  // sezonu, mistrzostwa, awansu i spadku. Nie wymaga kompletnej bazy:
  // brakujące zespoły są wirtualnymi rywalami o sile wynikającej ze
  // średniej i rozrzutu danej ligi.
  // ============================================================
  function normalish(){
    let sum=0;
    for(let i=0;i<6;i++) sum+=Math.random();
    return (sum-3)*1.41421356237;
  }

  function leagueStandingContext(club,seasonTier){
    let exact=[];
    let reference=[];
    let teams=18;

    if(isForeignClub(club)){
      exact=foreignLeaguePeers(club);
      reference=exact.length>=3
        ? exact
        : GAME_DATA.foreignClubs.filter(c=>c.foreignTier===club.foreignTier && c.zone===club.zone);
      if(reference.length<3) reference=GAME_DATA.foreignClubs.filter(c=>c.foreignTier===club.foreignTier);
      // Pełniejsze ligi zachowują rzeczywistą liczebność bazy. Małe wycinki
      // są uzupełniane do neutralnej, osiemnastozespołowej tabeli.
      teams=exact.length>=10?clamp(exact.length,10,24):18;
    } else {
      exact=CLUBS.filter(c=>c.tier===seasonTier && (seasonTier>3 || c.region===club.region));
      reference=exact.length?exact:CLUBS.filter(c=>c.tier===seasonTier);
      teams=18;
    }

    const strengths=(reference.length?reference:[club]).map(c=>c.strength);
    const average=strengths.reduce((a,b)=>a+b,0)/strengths.length;
    const variance=strengths.reduce((a,b)=>a+(b-average)**2,0)/strengths.length;
    const spread=clamp(Math.sqrt(variance)||3,2.5,8);
    return {teams,average,spread};
  }

  function simulateLeagueStanding(club,seasonTier,grade,minutes){
    const context=leagueStandingContext(club,seasonTier);
    const minuteShare=clamp(minutes/(38*90),0,1);

    // Jeden zawodnik jest tylko częścią drużyny. Jego przewaga nad poziomem
    // klubu ma niewielki wpływ i jest ważona realnymi minutami.
    const individualImpact=clamp((state.overall-club.strength)/11,-1.25,2.5)*minuteShare;
    const gradeBonus=grade.index>=8?2.5:grade.index>=7?1.5:grade.index>=6?.75:0;
    const playerImpact=individualImpact+gradeBonus*minuteShare;
    const clubPower=club.strength+playerImpact+normalish()*4.4;

    let place=1;
    for(let i=0;i<context.teams-1;i++){
      const rivalBase=context.average+normalish()*context.spread;
      const rivalPower=rivalBase+normalish()*4.1;
      if(rivalPower>clubPower) place++;
    }

    return {
      place:clamp(place,1,context.teams), teams:context.teams,
      competition:clubCompetition(club), playerImpact,
      champion:false,promoted:false,relegated:false,cups:[]
    };
  }

  function relegationPlaces(teams){ return teams<=12?2:3; }
  function setTitleSuccess(result){ result.place=1; result.champion=true; }
  function setTitleFailure(result){ result.place=clamp(Math.max(2,result.place),2,result.teams); }
  function setPromotionSuccess(result){ result.place=clamp(result.place,1,2); result.promoted=true; }
  function setPromotionFailure(result){ result.place=clamp(Math.max(3,result.place),3,result.teams); }
  function setRelegation(result){
    const firstDown=result.teams-relegationPlaces(result.teams)+1;
    result.place=clamp(Math.max(firstDown,result.place),firstDown,result.teams);
    result.relegated=true;
  }

  function promotedLeagueFloor(club,toLeague){
    const peers=GAME_DATA.foreignClubs.filter(c=>c.country===club.country && c.league===toLeague);
    if(!peers.length) return club.strength+2;
    const strengths=peers.map(c=>c.strength).sort((a,b)=>a-b);
    // Promowany klub ma wejść jako raczej słabszy zespół nowej ligi,
    // ale nie jako kompletnie oderwany od jej poziomu.
    const idx=Math.min(strengths.length-1,Math.floor(strengths.length*.2));
    return Math.max(club.strength+2,strengths[idx]-2);
  }

  function applyForeignPromotion(club,info,asChampion=false){
    if(!info || !info.to || state.loanReturn) return false;

    const oldLeague=club.league;
    const floor=promotedLeagueFloor(club,info.to);

    state.promotions++;
    state.justPromoted=true;
    state.club.league=info.to;
    state.club.strength=Math.min(99,Math.max(state.club.strength+rand(2,4),floor));

    // Nie mutujemy globalnej bazy klubów. Awans dotyczy tej konkretnej kariery.
    // Dzięki temu rozpoczęcie nowej kariery na tej samej stronie nie dziedziczy
    // losowych awansów z poprzedniej.
    state.score+=18;
    log(`AWANS: ${club.name}`,`${oldLeague} → ${info.to}${asChampion?' • mistrz ligi':''}`);
    return true;
  }

  function maybeBallonDorAfterChampionsLeague(form,performance){
    if(!form || (form.key!=='great' && form.key!=='career')) return '';
    const chance=form.key==='career' ? 100 : 50;
    const roll=rand(1,100);

    if(roll<=chance){
      grantSeasonAward('Złota Piłka',110,10,state.club,`Liga Mistrzów + ${form.label} • szansa ${chance}% • rzut ${roll}/100`);
      return `🥇 ZŁOTA PIŁKA`;
    }

    log('Głosowanie Złotej Piłki',`Liga Mistrzów + ${form.label} • szansa ${chance}% • rzut ${roll}/100 → bez nagrody`);
    return '';
  }

  // Wybiera losowego rywala z puli klubów (wykluczając własny klub).
  // Zwraca {name, strength}; przy pustej puli daje bezpieczny fallback.
  function pickRivalClub(pool, ownName, fallbackStrength){
    const candidates=(pool||[]).filter(c=>c && c.name && c.name!==ownName);
    if(!candidates.length) return {name:'Rywal', strength:fallbackStrength};
    return candidates[rand(0,candidates.length-1)];
  }

  function simulateDecisiveResult(homeStrength,opponent,drawCountsAsSuccess){
    const gap=homeStrength-(opponent?.strength||homeStrength);
    // Przy remisie wystarczającym do sukcesu gospodarz ma kilka dodatkowych
    // punktów procentowych. Poza tym liczy się wyłącznie różnica siły drużyn.
    const chance=clamp(Math.round((drawCountsAsSuccess?56:50)+gap*3),12,90);
    const roll=rand(1,100);
    return {success:roll<=chance,chance,roll};
  }

  // Pokazuje wybór "zagraj mecz / zasymuluj automatycznie" w istniejącym
  // decisionBox, bez przechodzenia przez pełną maszynerię presentDecision
  // (ta zakłada synchroniczne act() i nie nadaje się do meczu asynchronicznego).
  function offerDecisiveMatch(descriptor, next){
    const {kicker,title,text,homeName,homeStrength,opponent,knockout,drawCountsAsSuccess,onSuccess,onFailure}=descriptor;

    state.pendingDecision=true;
    els.playSeasonBtn.classList.add('hidden');
    els.decisionBox.classList.remove('hidden');
    els.decisionTitle.textContent=title;
    els.decisionText.innerHTML=`<strong>${text}</strong>`;
    els.decisionChoices.innerHTML='';

    function finish(){
      state.pendingDecision=false;
      els.decisionBox.classList.add('hidden');
      els.playSeasonBtn.classList.remove('hidden');
      render();
      next();
    }

    const playBtn=document.createElement('button'); playBtn.className='choice-btn';
    playBtn.innerHTML=`<span class="choice-main">ZAGRAJ MECZ</span><span class="choice-stake">Decydujące starcie z ${opponent.name} (${opponent.strength} OVR).</span>`;
    playBtn.onclick=()=>{
      els.decisionChoices.innerHTML='<p class="choice-stake">Trwa mecz…</p>';
      const previousMultiplier=state.activePlayerEventMultiplier||1;
      state.activePlayerEventMultiplier=state.captainEventBonusClub===state.club.name?2:1;
      nssPolska.playClubDecisiveMatch({kicker,homeName,homeStrength,opponent,knockout}).then(result=>{
        state.activePlayerEventMultiplier=previousMultiplier;
        const success=result.gf>result.ga || (drawCountsAsSuccess && result.gf===result.ga);
        if(success){ if(onSuccess) onSuccess(); } else if(onFailure){ onFailure(); }
        finish();
      });
    };

    const simBtn=document.createElement('button'); simBtn.className='choice-btn';
    simBtn.innerHTML=`<span class="choice-main">ZASYMULUJ AUTOMATYCZNIE</span><span class="choice-stake">Wynik zostanie uczciwie wylosowany według siły obu drużyn.</span>`;
    simBtn.onclick=()=>{
      const simulated=simulateDecisiveResult(homeStrength,opponent,drawCountsAsSuccess);
      if(simulated.success){ if(onSuccess) onSuccess(); }
      else if(onFailure) onFailure();
      log(`Symulacja: ${homeName} — ${opponent.name}`,`Szansa sukcesu ${simulated.chance}% • rzut ${simulated.roll}/100 • ${simulated.success?'sukces':'porażka'}`);
      finish();
    };

    els.decisionChoices.appendChild(playBtn);
    els.decisionChoices.appendChild(simBtn);
  }

  // Po awansie Polski turniej nigdy nie uruchamia się sam. Gracz wybiera,
  // czy chce przejść przez wszystkie mecze, czy od razu poznać wylosowany
  // wynik kadry. Obie ścieżki zapisują ten sam typ historii turniejowej.
  function offerTournamentChoice(next){
    const pending=state.pendingTournament;
    if(!pending){ next(); return; }
    const label=pending.kind==='WORLD'?'MUNDIAL':'EURO';

    state.pendingDecision=true;
    els.playSeasonBtn.classList.add('hidden');
    els.decisionBox.classList.remove('hidden');
    els.decisionTitle.textContent=`Polska jedzie na ${label} ${pending.year}!`;
    els.decisionText.textContent='Chcesz rozegrać turniej mecz po meczu, czy od razu poznać szybki wynik Polski?';
    els.decisionChoices.innerHTML='';

    const finish=()=>{
      state.pendingDecision=false;
      els.decisionBox.classList.add('hidden');
      els.playSeasonBtn.classList.remove('hidden');
      render();
      next();
    };

    const playBtn=document.createElement('button');
    playBtn.className='choice-btn';
    playBtn.innerHTML='<span class="choice-main">GRAM TURNIEJ</span><span class="choice-stake">Faza grupowa, tabele i kolejne mecze Polski będą rozgrywane interaktywnie.</span>';
    playBtn.onclick=()=>{
      els.decisionChoices.innerHTML='<p class="choice-stake">Przechodzimy do turnieju…</p>';
      nssPolska.playPendingTournament(()=>finish());
    };

    const simulateBtn=document.createElement('button');
    simulateBtn.className='choice-btn';
    simulateBtn.innerHTML='<span class="choice-main">SZYBKI WYNIK</span><span class="choice-stake">Gra rozegra cały turniej w tle i pokaże drogę oraz końcowy wynik Polski.</span>';
    simulateBtn.onclick=()=>{
      const result=nssPolska.simulatePendingTournament();
      const champion=result.champion
        ? `Polska zdobywa ${pending.kind==='WORLD'?'mistrzostwo świata':'mistrzostwo Europy'}!`
        : `Polska kończy turniej na etapie: ${result.stage}.`;
      const matches=(result.polandMatches||[]).map(match=>
        `<div class="tournament-sim-match"><span>${match.phase}</span><strong>Polska ${match.gf}:${match.ga} ${match.opponent}</strong></div>`
      ).join('');
      els.decisionTitle.textContent=`${label} ${pending.year} — SZYBKI WYNIK`;
      els.decisionText.innerHTML=`<strong>${champion}</strong>${result.tournamentChampion?`<br>Mistrz turnieju: <strong>${result.tournamentChampion}</strong>.`:''}<br>Twój dorobek: <strong>${result.stats.goals||0} G / ${result.stats.assists||0} A</strong>.${matches?`<div class="tournament-sim-report">${matches}</div>`:''}`;
      els.decisionChoices.innerHTML='';
      const nextBtn=document.createElement('button');
      nextBtn.className='primary full';
      nextBtn.textContent='DALEJ';
      nextBtn.onclick=finish;
      els.decisionChoices.appendChild(nextBtn);
    };

    els.decisionChoices.appendChild(playBtn);
    els.decisionChoices.appendChild(simulateBtn);
  }

  // Przetwarza kolejkę meczów decydujących jeden po drugim (może być ich
  // kilka w tym samym sezonie — np. puchar i awans naraz).
  function processDecisiveQueue(queue,idx,finalize){
    if(idx>=queue.length){ finalize(); return; }
    offerDecisiveMatch(queue[idx],()=>processDecisiveQueue(queue,idx+1,finalize));
  }

  const REGION_CUP_NAME={
    'Dolnośląskie':'Dolnego Śląska','Kujawsko-pomorskie':'Kujaw i Pomorza',
    'Lubelskie':'Lubelszczyzny','Lubuskie':'Ziemi Lubuskiej','Łódzkie':'Ziemi Łódzkiej',
    'Małopolskie':'Małopolski','Mazowieckie':'Mazowsza','Opolskie':'Opolszczyzny',
    'Podkarpackie':'Podkarpacia','Podlaskie':'Podlasia','Pomorskie':'Pomorza',
    'Śląskie':'Śląska','Świętokrzyskie':'Ziemi Świętokrzyskiej',
    'Warmińsko-mazurskie':'Warmii i Mazur','Wielkopolskie':'Wielkopolski',
    'Zachodniopomorskie':'Pomorza Zachodniego'
  };

  // Sześć najmocniejszych polskich klubów według bazowej siły. Nie wpisujemy
  // nazw na sztywno, więc zmiana danych automatycznie aktualizuje kwalifikację.
  const POLISH_CONFERENCE_TOP6=CLUBS
    .filter(c=>c.tier===6&&!c.reserve)
    .slice()
    .sort((a,b)=>b.strength-a.strength||a.name.localeCompare(b.name,'pl'))
    .slice(0,6)
    .map(c=>c.name);

  function conferenceLeagueChance(club,grade,performance,polishClub=false){
    const gradeIndex=clamp(grade?.index??4,0,8);
    const seasonModifier=[-1.2,-1,-.7,-.4,-.1,.35,.85,1.4,2.1][gradeIndex];
    const performanceModifier=clamp((performance-38)*.025,-.35,.55);

    if(polishClub){
      if(!POLISH_CONFERENCE_TOP6.includes(club.name)) return 0;
      // Lech (80 OVR klubu) zaczyna w okolicach 4,5–5%, a świetny sezon
      // podnosi szansę w okolice 5,5–6%. Kolejne kluby schodzą stopniowo.
      const strengthBase=1.4+Math.max(0,club.strength-74)*.55;
      return clamp(strengthBase+seasonModifier+performanceModifier,.35,7.5);
    }

    if(!isForeignClub(club)||club.foreignTier!==3||club.zone!=='Europa') return 0;
    // Europejskie T3: od ok. 1% dla dołu tieru do ok. 4–5% dla jego czołówki.
    const strengthBase=1.25+Math.max(0,club.strength-74)*.26;
    return clamp(strengthBase+seasonModifier+performanceModifier,.5,7);
  }

  function conferenceFinalOpponent(homeClub){
    const eligible=GAME_DATA.foreignClubs
      .filter(c=>
        c.name!==homeClub.name &&
        c.zone==='Europa' &&
        c.foreignTier===3 &&
        !foreignLowerLeagueInfo(c)
      )
      .slice()
      .sort((a,b)=>b.strength-a.strength||a.name.localeCompare(b.name,'pl'));
    // Losujemy wyłącznie z czołówki prawidłowego T3. Kluby Championship,
    // Serie B, 2. Bundesligi itd. odpadają przez foreignLowerLeagueInfo().
    const topPool=eligible.slice(0,12);
    return topPool.length?{...pick(topPool)}:null;
  }

  function queueConferenceLeagueFinal(queue,club,standing,notes){
    const opponent=conferenceFinalOpponent(club);
    if(!opponent) return false;
    queue.push({
      kicker:'LIGA KONFERENCJI',
      title:'Finał Ligi Konferencji!',
      text:`${club.name} gra w finale Ligi Konferencji z ${opponent.name}. Remis oznacza dogrywkę i rzuty karne. Zagrać finał, czy zasymulować wynik?`,
      homeName:club.name,homeStrength:club.strength,
      opponent,
      knockout:true,drawCountsAsSuccess:false,
      onSuccess:()=>{
        addTrophy('Liga Konferencji',55);
        standing.cups.push('Liga Konferencji');
        notes.push('🌍 🏆 Liga Konferencji');
      }
    });
    return true;
  }

  // Najmocniejsze kluby południowoamerykańskiego T3 mogą dojść zarówno do
  // finału Libertadores, jak i Sudamericany. Lista wynika z danych, więc nie
  // trzeba jej ręcznie aktualizować po zmianie overalli klubów.
  const SOUTH_AMERICAN_LIBERTADORES_T3=GAME_DATA.foreignClubs
    .filter(c=>c.zone==='Ameryka Południowa'&&c.foreignTier===3&&!foreignLowerLeagueInfo(c))
    .slice()
    .sort((a,b)=>b.strength-a.strength||a.name.localeCompare(b.name,'pl'))
    .slice(0,12)
    .map(c=>c.name);

  function continentalFinalOpponent(homeClub,competition){
    const confederationMatch=c=>{
      if(competition==='Liga Mistrzów'||competition==='Liga Europy') return c.zone==='Europa';
      if(/Copa Libertadores|Copa Sudamericana/.test(competition)) return c.zone==='Ameryka Południowa';
      if(competition==='CONCACAF Champions Cup') return c.zone==='Ameryka Północna'||c.zone==='Ameryka Środkowa';
      if(/^AFC /.test(competition)) return c.zone==='Azja';
      if(competition==='CAF Champions League') return c.zone==='Afryka';
      if(competition==='OFC Champions League') return c.zone==='Oceania';
      return false;
    };
    const tournamentLevelMatch=c=>{
      if(competition==='Liga Mistrzów') return c.foreignTier===1;
      if(competition==='Liga Europy') return c.foreignTier===2;
      if(competition==='Copa Libertadores') return c.foreignTier<=3;
      if(competition==='Copa Sudamericana') return c.foreignTier>=3;
      if(competition==='AFC Champions League') return c.foreignTier<=3;
      if(competition==='AFC Champions League Two') return c.foreignTier>=4;
      if(competition==='AFC Challenge League') return c.foreignTier>=5;
      return true;
    };
    const eligible=GAME_DATA.foreignClubs
      .filter(c=>
        c.name!==homeClub.name &&
        confederationMatch(c) &&
        tournamentLevelMatch(c) &&
        !foreignLowerLeagueInfo(c)
      )
      .slice()
      .sort((a,b)=>b.strength-a.strength||a.name.localeCompare(b.name,'pl'));
    const topPool=eligible.slice(0,12);
    return topPool.length?{...pick(topPool)}:null;
  }

  function queueContinentalFinal(queue,club,competition,standing,notes,afterSuccess=null){
    const opponent=continentalFinalOpponent(club,competition);
    if(!opponent) return false;
    queue.push({
      kicker:competition.toUpperCase(),
      title:`Finał: ${competition}!`,
      text:`${club.name} gra w finale ${competition} z ${opponent.name}. Remis oznacza dogrywkę i rzuty karne. Zagrać finał, czy zasymulować wynik?`,
      homeName:club.name,homeStrength:club.strength,
      opponent,
      knockout:true,drawCountsAsSuccess:false,
      onSuccess:()=>{
        addTrophy(competition,55);
        standing.cups.push(competition);
        notes.push(`🌍 🏆 ${competition}`);
        if(typeof afterSuccess==='function') afterSuccess();
      }
    });
    return true;
  }

  function resolveClubSeason(performance, club, seasonTier, form, grade, minutes, done){
    const notes=[];
    const queue=[];
    const standing=simulateLeagueStanding(club,seasonTier,grade,minutes);
    const finishClubSeason=()=>{
      notes.unshift(`${standing.place}. miejsce w ${standing.competition}`);
      done(notes.join(' • '),{...standing,cups:standing.cups.slice()});
    };

    if(isForeignClub(club)){
      const ft=club.foreignTier;
      const lowerInfo=foreignLowerLeagueInfo(club);
      const promotionInfo=foreignPromotionInfo(club);
      const isLower=!!lowerInfo;
      const domesticCupChance=({1:12,2:8,3:4,4:2,5:1,6:1})[ft]||2;
      const rivalPool=foreignLeaguePeers(club);

      // Miejsce w tabeli otwiera mecz o tytuł albo awans. Jego wynik może
      // przesunąć końcową pozycję, ale nigdy nie stworzy sprzecznego opisu.
      function maybeForeignPromotionWithoutTitle(){
        if(!promotionInfo || state.loanReturn || standing.place>3) return;
        queue.push({
          kicker:'BARAŻ O AWANS',
          title:`Baraż o awans do ${promotionInfo.to}!`,
          text:`${club.name} kończy sezon w czołówce i ma szansę na awans przez baraż. Remis też awansuje. Zagrać decydujący mecz, czy zasymulować wynik?`,
          homeName:club.name, homeStrength:club.strength,
          opponent:pickRivalClub(rivalPool,club.name,club.strength),
          knockout:false, drawCountsAsSuccess:true,
          onSuccess:()=>{
            if(applyForeignPromotion(club,promotionInfo,false)){
              setPromotionSuccess(standing); notes.push(`⬆️ Awans do ${promotionInfo.to}`);
            }
          },
          onFailure:()=>setPromotionFailure(standing)
        });
      }

      if(isLower){
        // Na niższym szczeblu można zostać mistrzem SWOJEJ ligi.
        // Jeśli istnieje normalny szczebel wyżej, tytuł automatycznie daje awans.
        if(standing.place===1){
          const t=`Mistrzostwo ligi: ${club.league}`;
          queue.push({
            kicker:'MISTRZOSTWO LIGI',
            title:`Walczysz o mistrzostwo ligi (${club.league})!`,
            text:`${club.name} może zostać mistrzem. Remis też wystarcza do tytułu. Zagrać decydujący mecz, czy zasymulować wynik?`,
            homeName:club.name, homeStrength:club.strength,
            opponent:pickRivalClub(rivalPool,club.name,club.strength),
            knockout:false, drawCountsAsSuccess:true,
            onSuccess:()=>{
              setTitleSuccess(standing); addTrophy(t,28); standing.cups.push(t); notes.push(`🏆 ${t}`);
              if(promotionInfo && applyForeignPromotion(club,promotionInfo,true)){
                standing.promoted=true; notes.push(`⬆️ Awans do ${promotionInfo.to}`);
              }
            },
            onFailure:()=>{ setTitleFailure(standing); maybeForeignPromotionWithoutTitle(); }
          });
        } else {
          maybeForeignPromotionWithoutTitle();
        }
      } else {
        // Najwyższy szczebel: pierwsze miejsce otwiera decydujący mecz o tytuł.
        if(standing.place===1){
          const t=`Mistrzostwo: ${club.league||club.country}`;
          queue.push({
            kicker:'MISTRZOSTWO KRAJU',
            title:`Walczysz o mistrzostwo kraju (${club.league||club.country})!`,
            text:`${club.name} może zdobyć tytuł. Remis też wystarcza. Zagrać decydujący mecz, czy zasymulować wynik?`,
            homeName:club.name, homeStrength:club.strength,
            opponent:pickRivalClub(rivalPool,club.name,club.strength),
            knockout:false, drawCountsAsSuccess:true,
            onSuccess:()=>{ setTitleSuccess(standing); addTrophy(t,42); standing.cups.push(t); notes.push(`🏆 ${t}`); },
            onFailure:()=>setTitleFailure(standing)
          });
        }
      }

      // Puchar jest niezależnym rzutem — możliwy jest dublet / potrójna korona.
      if(rand(1,100)<=domesticCupChance){
        const t=`Puchar kraju (${club.country})`;
        queue.push({
          kicker:'PUCHAR KRAJU',
          title:`Finał pucharu — ${club.country}!`,
          text:`${club.name} gra w finale pucharu krajowego. Tu liczy się tylko zwycięstwo — remis oznacza dogrywkę i rzuty karne. Zagrać finał, czy zasymulować wynik?`,
          homeName:club.name, homeStrength:club.strength,
          opponent:pickRivalClub(rivalPool,club.name,club.strength),
          knockout:true, drawCountsAsSuccess:false,
          onSuccess:()=>{ addTrophy(t,32); standing.cups.push(t); notes.push(`🏆 ${t}`); }
        });
      }

      // Procent oznacza szansę dotarcia do finału. Każdy puchar kontynentalny
      // prowadzi do grywalnego finału; trofeum wpada dopiero po zwycięstwie.
      let continental=null, continentalChance=0, continentalQualified=false;
      if(!isLower){
        if(club.zone==='Europa'){
          if(ft===1){ continental='Liga Mistrzów'; continentalChance=7+Math.max(0,club.strength-95); }
          else if(ft===2){ continental='Liga Europy'; continentalChance=4; }
          else if(ft===3){ continental='Liga Konferencji'; continentalChance=conferenceLeagueChance(club,grade,performance,false); }
        } else if(club.zone==='Ameryka Południowa'){
          if(ft===3 && SOUTH_AMERICAN_LIBERTADORES_T3.includes(club.name) && Math.random()*100<4){
            continental='Copa Libertadores';
            continentalQualified=true;
          } else {
            continental=ft<=2?'Copa Libertadores':'Copa Sudamericana';
            continentalChance=ft<=2?6:ft===3?3:1;
          }
        } else if(club.zone==='Ameryka Północna' || club.zone==='Ameryka Środkowa'){
          continental='CONCACAF Champions Cup'; continentalChance=ft===2?5:ft===3?3:1;
        } else if(club.zone==='Azja'){
          if(ft<=3){
            continental='AFC Champions League';
            continentalChance=ft===2?5:ft===3?3:2;
          } else if(ft===4){
            continental='AFC Champions League Two';
            continentalChance=2;
          } else {
            continental='AFC Challenge League';
            continentalChance=ft===5?2:1;
          }
        } else if(club.zone==='Afryka'){
          continental='CAF Champions League'; continentalChance=ft===3?4:2;
        } else if(club.zone==='Oceania'){
          continental='OFC Champions League'; continentalChance=club.name==='Auckland City'?9:(ft===6?1:3);
        }
      }
      if(continental && (continentalQualified || Math.random()*100<continentalChance)){
        if(continental==='Liga Konferencji'){
          queueConferenceLeagueFinal(queue,club,standing,notes);
        } else {
          const afterSuccess=continental==='Liga Mistrzów'?()=>{
            const bd=maybeBallonDorAfterChampionsLeague(form,performance);
            if(bd) notes.push(bd);
          }:null;
          queueContinentalFinal(queue,club,continental,standing,notes,afterSuccess);
        }
      }

      processDecisiveQueue(queue,0,finishClubSeason);
      return;
    }

    // Kluby polskie.
    // Puchar Polski może wygrać także klub spoza Ekstraklasy, ale to rzadkie.
    if(seasonTier>=3){
      const cupChance = seasonTier===6 ? Math.max(1.5, 2.4+(club.strength-74)*.55) : seasonTier===5 ? 1.4 : .35;
      if(Math.random()*100<cupChance){
        const cupPool=CLUBS.filter(c=>c.tier>=Math.max(3,seasonTier-1) && c.tier<=Math.min(6,seasonTier+1));
        queue.push({
          kicker:'PUCHAR POLSKI',
          title:'Finał Pucharu Polski!',
          text:`${club.name} gra w finale Pucharu Polski. Tu liczy się tylko zwycięstwo — remis oznacza dogrywkę i rzuty karne. Zagrać finał, czy zasymulować wynik?`,
          homeName:club.name, homeStrength:club.strength,
          opponent:pickRivalClub(cupPool,club.name,club.strength),
          knockout:true, drawCountsAsSuccess:false,
          onSuccess:()=>{ addTrophy('Puchar Polski',38); standing.cups.push('Puchar Polski'); notes.push('🏆 Puchar Polski'); }
        });
      }
    }

    // Osobny Puchar Regionalny dla III ligi i niżej. Szansa zależy trochę
    // od siły klubu względem regionalnej konkurencji, ale pozostaje rzadka.
    if(seasonTier<=3 && club.region){
      const context=leagueStandingContext(club,seasonTier);
      const baseChance=seasonTier===3?4:seasonTier===2?3:2;
      const strengthFactor=clamp(1+(club.strength-context.average)*.08,.55,1.8);
      const regionalCupChance=baseChance*strengthFactor;
      if(Math.random()*100<regionalCupChance){
        const regionalPool=CLUBS.filter(c=>c.region===club.region && c.name!==club.name && c.tier<=4);
        const cupName=`Puchar ${REGION_CUP_NAME[club.region]||club.region}`;
        queue.push({
          kicker:cupName.toUpperCase(),
          title:`Finał: ${cupName}!`,
          text:`${club.name} gra w finale pucharu regionalnego. Tu liczy się tylko zwycięstwo — remis oznacza dogrywkę i rzuty karne. Zagrać finał, czy zasymulować wynik?`,
          homeName:club.name,homeStrength:club.strength,
          opponent:pickRivalClub(regionalPool,club.name,club.strength),
          knockout:true,drawCountsAsSuccess:false,
          onSuccess:()=>{ addTrophy(cupName,18); standing.cups.push(cupName); notes.push(`🏆 ${cupName}`); }
        });
      }
    }

    // Czołowa szóstka polskiej bazy może wygrać Ligę Konferencji. To osobny,
    // rzadki rzut: Lech ma realną, ale nadal jednocyfrową szansę; słabsze
    // kluby z TOP 6 odpowiednio mniejszą. Forma sezonu delikatnie ją przesuwa.
    const polishConferenceChance=seasonTier===6
      ?conferenceLeagueChance(club,grade,performance,true)
      :0;
    if(polishConferenceChance>0 && Math.random()*100<polishConferenceChance){
      queueConferenceLeagueFinal(queue,club,standing,notes);
    }

    if(seasonTier===6){
      if(standing.place===1){
        const titlePool=CLUBS.filter(c=>c.tier===6);
        queue.push({
          kicker:'MISTRZOSTWO POLSKI',
          title:'Walczysz o Mistrzostwo Polski!',
          text:`${club.name} może zdobyć tytuł mistrza Polski. Remis też wystarcza do mistrzostwa. Zagrać decydujący mecz, czy zasymulować wynik?`,
          homeName:club.name, homeStrength:club.strength,
          opponent:pickRivalClub(titlePool,club.name,club.strength),
          knockout:false, drawCountsAsSuccess:true,
          onSuccess:()=>{ setTitleSuccess(standing); addTrophy('Mistrzostwo Polski',45); standing.cups.push('Mistrzostwo Polski'); notes.push('🏆 Mistrzostwo Polski'); },
          onFailure:()=>setTitleFailure(standing)
        });
      }
      const firstDown=standing.teams-relegationPlaces(standing.teams)+1;
      if(standing.place>=firstDown && !state.loanReturn){
        setRelegation(standing);
        state.club.tier=5; state.club.strength=Math.max(66,state.club.strength-3); state.justRelegated=true;
        log(`SPADEK: ${state.club.name}`, 'Ekstraklasa → I liga'); notes.push('⬇️ Spadek do I ligi');
      }
      processDecisiveQueue(queue,0,finishClubSeason);
      return;
    }

    if(seasonTier<=5){
      if(state.forceCorruptPromotion){
        state.forceCorruptPromotion=false;
        const old=seasonTier;
        state.promotions++;
        setPromotionSuccess(standing);
        if(state.loanReturn){
          notes.push(`⬆️ ${club.name} awansuje po ustawionym meczu`);
          processDecisiveQueue(queue,0,finishClubSeason);
          return;
        }
        state.club.tier=Math.min(6,seasonTier+1);
        const floors={2:50,3:56,4:62,5:68,6:75};
        state.club.strength=Math.max(state.club.strength+rand(2,4),floors[state.club.tier]||state.club.strength);
        state.highestTier=Math.max(state.highestTier,state.club.tier);
        state.justPromoted=true;
        log(`AWANS: ${state.club.name}`,`${tierName(old)} → ${tierName(state.club.tier)} • ustawiony kluczowy mecz`);
        notes.push(`⬆️ Awans do ${tierName(state.club.tier)} po ustawionym meczu`);
        processDecisiveQueue(queue,0,finishClubSeason);
        return;
      }

      function maybeRelegation(){
        if(seasonTier<2 || state.loanReturn) return;
        const firstDown=standing.teams-relegationPlaces(standing.teams)+1;
        if(standing.place>=firstDown){
          setRelegation(standing);
          const old=seasonTier; state.club.tier=Math.max(1,seasonTier-1); state.club.strength=Math.max(45,state.club.strength-rand(2,4)); state.justRelegated=true;
          log(`SPADEK: ${state.club.name}`, `${tierName(old)} → ${tierName(state.club.tier)}`); notes.push(`⬇️ Spadek do ${tierName(state.club.tier)}`);
        }
      }

      if(standing.place<=2){
        if(state.loanReturn){
          standing.promoted=true;
          state.score+=12; notes.push(`⬆️ Pomagasz ${club.name} awansować`);
          processDecisiveQueue(queue,0,finishClubSeason);
          return;
        }
        const old=seasonTier;
        const promoPool=CLUBS.filter(c=>c.tier===seasonTier);
        queue.push({
          kicker:'AWANS',
          title:`Walczysz o awans do ${tierName(Math.min(6,seasonTier+1))}!`,
          text:`${club.name} ma szansę na awans. Remis też awansuje. Zagrać decydujący mecz, czy zasymulować wynik?`,
          homeName:club.name, homeStrength:club.strength,
          opponent:pickRivalClub(promoPool,club.name,club.strength),
          knockout:false, drawCountsAsSuccess:true,
          onSuccess:()=>{
            setPromotionSuccess(standing);
            state.promotions++;
            state.club.tier=Math.min(6,old+1);
            const floors={2:50,3:56,4:62,5:68,6:75};
            state.club.strength=Math.max(state.club.strength+rand(2,4),floors[state.club.tier]||state.club.strength);
            state.highestTier=Math.max(state.highestTier,state.club.tier); state.justPromoted=true; state.score+=18;
            log(`AWANS: ${state.club.name}`, `${tierName(old)} → ${tierName(state.club.tier)}`); notes.push(`⬆️ Awans do ${tierName(state.club.tier)}`);
          },
          onFailure:()=>setPromotionFailure(standing)
        });
      } else {
        maybeRelegation();
      }
    }
    processDecisiveQueue(queue,0,finishClubSeason);
  }
  function trophyMediaBonus(name){
    const n=String(name||'');
    if(/Mistrzostwo Świata/i.test(n)) return 8;
    if(/Mistrzostwo Europy/i.test(n)) return 7;
    if(/Liga Mistrzów/i.test(n)) return 6;
    if(/Copa Libertadores|CAF Champions League|AFC Champions League|CONCACAF Champions Cup/i.test(n)) return 4;
    if(/Liga Europy/i.test(n)) return 3;
    if(/Liga Konferencji|Copa Sudamericana|OFC Champions League/i.test(n)) return 2;
    if(/Mistrzostwo Polski/i.test(n)) return 3;
    if(/^Mistrzostwo:/i.test(n)) return 3;
    if(/Puchar Polski|^Puchar kraju/i.test(n)) return 2;
    if(/^Mistrzostwo ligi:/i.test(n)) return 1;
    return 1;
  }

  function addTrophy(name,score){
    const seasonLabel=`${state.seasonYear}/${String(state.seasonYear+1).slice(2)}`;
    state.trophies.push(`${name} (${seasonLabel})`);
    state.trophyHistory=state.trophyHistory||[];
    const national=/Mistrzostwo Świata|Mistrzostwo Europy/i.test(name);
    state.trophyHistory.push({
      name,year:state.seasonYear,club:state.club?.name||null,score,
      clubCredit:!national
    });
    state.score+=score;
    addSportMedia(trophyMediaBonus(name),`Trofeum: ${name}`);
  }

  function grantSeasonAward(name,score,media,club,detail=''){
    const seasonLabel=`${state.seasonYear}/${String(state.seasonYear+1).slice(2)}`;
    state.awardHistory=state.awardHistory||[];
    if(state.awardHistory.some(a=>a.name===name && a.year===state.seasonYear && a.club===club?.name)) return false;
    state.awards.push(`${name} (${seasonLabel})`);
    state.awardHistory.push({name,year:state.seasonYear,club:club?.name||null,competition:clubCompetition(club),score});
    state.score+=score;
    addSportMedia(media,name);
    log(name,detail||`${club?.name||'—'} • ${clubCompetition(club)}`);
    return true;
  }

  function maybeAward(g,a,apps,grade,tier,club){
    const won=[];
    if(tier<3 || apps<18 || !grade) return won;
    const competition=clubCompetition(club);
    const add=(name,score,media,detail)=>{
      if(grantSeasonAward(name,score,media,club,detail)){ won.push(`🏅 ${name}`); return true; }
      return false;
    };

    // Sam próg 18 goli nie oznacza już automatycznej korony. Im większy
    // dorobek, tym większa szansa, że nikt w lidze nie strzelił więcej.
    if(state.position==='FWD' && tier>=4 && g>=18){
      const chance=g>=30?100:g>=27?90:g>=24?70:g>=21?40:15;
      const roll=rand(1,100);
      if(roll<=chance)
        add(`Król strzelców — ${competition}`,25,4,`${g} goli • szansa ${chance}% • rzut ${roll}/100`);
      else
        log('Walka o koronę króla strzelców',`${competition} • ${g} goli • szansa ${chance}% • rzut ${roll}/100 → inny zawodnik zdobył więcej bramek`);
    }

    if(grade.index>=6){
      // Jeśli ocenę do ŚWIETNEJ podniosły naprawdę wyjątkowe liczby, gracz
      // jest mocnym kandydatem do XI sezonu, ale nagroda nadal nie jest pewna.
      const chance=grade.index>=8?100:grade.index>=7?75:grade.liftedByOutput?70:35;
      if(rand(1,100)<=chance)
        add(`Jedenastka sezonu — ${competition}`,22,4,`${grade.label} • ${apps} meczów`);
    }

    if(grade.index>=7){
      const chance=grade.index>=8?70:25;
      if(rand(1,100)<=chance)
        add(`Piłkarz sezonu — ${competition}`,34,6,`${grade.label} • ${apps} meczów`);
    }

    // Jednorazowe Odkrycie Roku. Można je zdobyć tylko jako młody zawodnik
    // Ekstraklasy albo odpowiednio mocnej ligi zagranicznej (foreignTier 1–3).
    const discoveryLevel=(!isForeignClub(club) && tier===6) || (isForeignClub(club) && club.foreignTier<=3);
    const discoveryAlreadyWon=(state.awardHistory||[]).some(a=>a.name==='Odkrycie Roku w Polsce');
    if(!discoveryAlreadyWon && state.age<=21 && discoveryLevel && grade.index>=6){
      const chance=grade.index>=8?100:grade.index>=7?80:40;
      if(rand(1,100)<=chance)
        add('Odkrycie Roku w Polsce',24,5,`${state.age} lat • ${grade.label} • ${competition}`);
    }

    const highPolishLevel=(!isForeignClub(club) && tier===6) || (isForeignClub(club) && club.foreignTier<=3);
    if(highPolishLevel && state.overall>=85 && grade.index>=7 && apps>=20){
      let chance=grade.index>=8?55:12;
      if(isForeignClub(club) && club.foreignTier<=2) chance+=10;
      if((state.seasonNationalCaps||0)>0) chance+=6;
      if(rand(1,100)<=clamp(chance,0,90))
        add('Piłkarz Roku w Polsce',55,8,`${grade.label} • ${competition} • ${apps} meczów`);
    }
    return won;
  }

  function nationalSquadRole(overall=state.overall){
    if(overall<=76) return 'awaryjny debiutant — pojedynczy sparing';
    if(overall<=80) return 'szeroki skład — rezerwowy';
    if(overall<=84) return 'rotacja reprezentacji';
    return 'regularna kadra';
  }

  function nationalCapsRoll(firstCall, returning){
    const ovr=state.overall;
    // OVR kadry to około 85. Zawodnik 74–76 może wyjątkowo dostać próbny
    // sparing, 77–80 jest rezerwowym, a regularne granie zaczyna się wyżej.
    if(ovr<=76) return weightedDelta([[88,1],[12,2]]);
    if(ovr<=80){
      if(firstCall) return weightedDelta([[58,1],[32,2],[10,3]]);
      if(returning) return weightedDelta([[42,1],[38,2],[16,3],[4,4]]);
      return weightedDelta([[28,1],[38,2],[24,3],[8,4],[2,5]]);
    }
    if(ovr<=84){
      if(firstCall) return weightedDelta([[20,1],[32,2],[28,3],[15,4],[5,5]]);
      if(returning) return weightedDelta([[12,1],[24,2],[30,3],[22,4],[9,5],[3,6]]);
      return weightedDelta([[8,1],[17,2],[26,3],[25,4],[15,5],[7,6],[2,7]]);
    }
    if(firstCall) return weightedDelta([[8,1],[17,2],[27,3],[25,4],[16,5],[7,6]]);
    if(returning) return weightedDelta([[5,1],[10,2],[18,3],[24,4],[22,5],[14,6],[7,7]]);
    return weightedDelta([[3,1],[7,2],[13,3],[20,4],[22,5],[18,6],[11,7],[6,8]]);
  }

  function nationalGoalsRoll(caps){
    if(caps<=0) return 0;
    const skill=clamp(.75+(state.overall-65)*.025,.7,1.3);
    const rate=state.position==='FWD'?.28:state.position==='MID'?.10:state.position==='DEF'?.035:.003;
    return poisson(caps*rate*skill);
  }

  function seniorNationalEligibleClub(club,seasonTier){
    if(isForeignClub(club)) return (club.foreignTier||99)<=3;
    return seasonTier>=6; // Polska: wyłącznie Ekstraklasa.
  }

  function seniorNationalCallChance(performance, seasonTier, club=state.club){
    const recognition=state.recognition||20;
    const apps=state.season?.apps||0;
    const ovr=state.overall;
    let chance=0;

    // Twarda bramka jakości rozgrywek:
    // Polska = Ekstraklasa; zagranica = tylko T1, T2, T3.
    if(!seniorNationalEligibleClub(club,seasonTier)) return 0;

    if(!state.seniorInternational){
      if(ovr<74) return 0;

      if(ovr<=76){
        // Rzadki debiut próbny: świetny rok na boisku, dużo minut i zwykle
        // jeden sparing. Nie otwiera regularnego grania przy niskim OVR.
        if(performance<62 || apps<24) return 0;
        chance=2+(ovr-74)*4+clamp((performance-62)*.8,0,8)+recognition*.04;
      } else if(ovr<=80){
        if(performance<40 || apps<15) return 0;
        chance=8+(ovr-77)*7+clamp((performance-42)*.8,0,16)+recognition*.10;
      } else if(ovr<=84){
        chance=35+(ovr-81)*9+clamp((performance-35)*.7,0,16)+recognition*.12;
      } else {
        chance=70+Math.min(15,(ovr-85)*3)+clamp((performance-35)*.45,0,10)+recognition*.08;
      }
    } else {
      // Historia reprezentacyjna pomaga, ale nie utrzymuje w kadrze gracza,
      // który zjechał daleko poniżej poziomu szerokiego składu.
      if(ovr<74) return 0;
      if(ovr<=76){
        if(performance<52 || apps<18) return 0;
        chance=6+(ovr-74)*4+clamp((performance-52)*.6,0,9)+recognition*.05;
      } else if(ovr<=80){
        chance=28+(ovr-77)*7+clamp((performance-36)*.7,0,15)+recognition*.12;
      } else if(ovr<=84){
        chance=55+(ovr-81)*8+clamp((performance-32)*.55,0,13)+recognition*.12;
      } else {
        chance=82+Math.min(9,(ovr-85)*2)+clamp((performance-32)*.35,0,7)+recognition*.05;
      }
      if(state.national==='Polska') chance+=6;
    }

    if(performance<22) chance-=18;
    if(apps<8) chance-=15;

    return clamp(Math.round(chance),1,94);
  }


  // Stary, jednorzutowy system kwalifikacji i wyników EURO/mundialu
  // został zastąpiony przez paczkę NSS — patrz nssPolska.checkEuro()/
  // checkWorldCup()/playPendingTournament() poniżej.

  function maybeNationalTeam(performance, seasonTier, club=state.club){
    const old=state.national;
    const wasSeniorInternational=state.seniorInternational;
    state.seasonNationalCaps=0;
    state.seasonNationalGoals=0;

    if((state.corruptionShadow||0)>0){
      state.national='—';
      return old==='Polska'?'🇵🇱 Poza kadrą Polski po aferze korupcyjnej':'';
    }

    const callChance=seniorNationalCallChance(performance,seasonTier,club);
    const callRoll=callChance>0?rand(1,100):null;
    const called=callChance>0 && callRoll<=callChance;

    if(called){
      const firstSeniorCall=!wasSeniorInternational;
      const returning=wasSeniorInternational && old!=='Polska';

      state.national='Polska';
      state.seniorInternational=true;
      state.justNationalCall=firstSeniorCall;

      const caps=nationalCapsRoll(firstSeniorCall,returning);
      const goals=nationalGoalsRoll(caps);
      state.seasonNationalCaps=caps;
      state.seasonNationalGoals=goals;
      state.nationalCaps+=caps;
      state.nationalGoals+=goals;

      addSportMedia(firstSeniorCall?5:(caps>=5?3:2),
        firstSeniorCall?'Pierwsze powołanie do reprezentacji Polski':`${caps} meczów w reprezentacji Polski`);

      const goalText=goals?` • ${goals} ${goals===1?'gol':'gole'}`:'';
      let label;
      if(firstSeniorCall) label='🇵🇱 PIERWSZE POWOŁANIE DO REPREZENTACJI POLSKI';
      else if(returning) label='🇵🇱 POWRÓT DO REPREZENTACJI POLSKI';
      else label='🇵🇱 REPREZENTACJA POLSKI';

      const squadRole=nationalSquadRole();
      const meta=`${caps} ${caps===1?'mecz':'mecze'}${goalText} • ${squadRole} • szansa powołania ${callChance}% • rzut ${callRoll}/100`;
      log(label,meta);
      return `${label}: ${caps} ${caps===1?'mecz':'mecze'}${goalText} • ${squadRole} (szansa ${callChance}%, rzut ${callRoll})`;
    }

    // Brak powołania seniorów nie wymazuje historii reprezentanta.
    if(wasSeniorInternational){
      state.national='—';
      if(callChance>0){
        const text=`🇵🇱 Poza kadrą Polski w tym sezonie (szansa ${callChance}%, rzut ${callRoll})`;
        if(old==='Polska') log('Wypadasz z reprezentacji Polski.',`Szansa ${callChance}% • rzut ${callRoll}/100`);
        return text;
      }
      return old==='Polska'?'🇵🇱 W tym sezonie nie dostajesz powołania do Polski':'';
    }

    // Młodzieżówki nadal są prostsze — nie liczymy ich do seniorskich występów.
    if(state.age<=19 && state.overall>=51 && seasonTier>=3 && performance>30){
      state.national='Polska U-19';
      if(old!==state.national){
        const text='Powołanie: Polska U-19';
        log(text,`${state.age} lat • ${state.club.name} • OVR ${state.overall}`);
        return text;
      }
      return '';
    }

    if(state.age<=22 && state.overall>=58 && seasonTier>=4 && performance>33){
      state.national='Polska U-21';
      if(old!==state.national){
        const text='Powołanie: Polska U-21';
        log(text,`${state.age} lat • ${state.club.name} • OVR ${state.overall}`);
        return text;
      }
      return '';
    }

    state.national='—';
    return '';
  }

  function eventAllowed(id,cooldown=4,maxUses=1){
    const m=state.eventMemory[id];
    if(!m) return true;
    if(m.count>=maxUses) return false;
    return state.age-m.lastAge>=cooldown;
  }


  const ROLL = {
    // Każda odpowiedź ma najwyżej dwa możliwe skutki. Gracz wybiera kierunek,
    // a losowanie rozstrzyga tylko: udało się albo nie.
    ovrSafe:       {stat:'overall', name:'OVR — ostrożnie', outcomes:[[20,1],[80,0]]},
    ovrBalanced:   {stat:'overall', name:'OVR — próba rozwoju', outcomes:[[30,1],[70,0]]},
    ovrRisky:      {stat:'overall', name:'OVR — ryzyko', outcomes:[[35,2],[65,-1]]},
    ovrBreakout:   {stat:'overall', name:'OVR — próba przełomu', outcomes:[[30,3],[70,-1]]},

    playSafe:      {stat:'playChance', name:'Hierarchia — spokojnie', outcomes:[[70,3],[30,-2]]},
    playBalanced:  {stat:'playChance', name:'Hierarchia — próba', outcomes:[[60,6],[40,-4]]},
    playRisky:     {stat:'playChance', name:'Hierarchia — ryzyko', outcomes:[[50,10],[50,-7]]},

    healthSafe:    {stat:'injuryRisk', name:'Zdrowie — ostrożnie', outcomes:[[80,-3],[20,2]]},
    healthBalanced:{stat:'injuryRisk', name:'Zdrowie — próba', outcomes:[[60,-4],[40,3]]},
    healthRisky:   {stat:'injuryRisk', name:'Zdrowie — ryzyko', outcomes:[[40,-4],[60,6]]},

    profSafe:      {stat:'professionalism', name:'Profesjonalizm — spokojnie', outcomes:[[75,3],[25,-1]]},
    profRisky:     {stat:'professionalism', name:'Profesjonalizm — ryzyko', outcomes:[[55,6],[45,-4]]},

    recogSafe:     {stat:'recognition', name:'Medialność — spokojnie', outcomes:[[75,5],[25,-3]]},
    recogRisky:    {stat:'recognition', name:'Medialność — ryzyko', outcomes:[[55,10],[45,-7]]},

    loyaltySafe:   {stat:'loyalty', name:'Lojalność — spokojnie', outcomes:[[75,2],[25,-1]]},
    loyaltyRisky:  {stat:'loyalty', name:'Lojalność — ryzyko', outcomes:[[55,4],[45,-3]]},

    fanRefusal:    {stat:'recognition', name:'Reakcja kibiców', outcomes:[[70,0],[30,-6]]},
    interview:     {stat:'recognition', name:'Wywiad', outcomes:[[70,8],[30,-4]]},
    extraTraining: {stat:'overall', name:'Dodatkowy trening', outcomes:[[25,1],[75,0]]},
    kaleDiet:      {stat:'overall', name:'Jarmuż', outcomes:[[50,2],[50,-2]]},
    normalDiet:    {stat:'injuryRisk', name:'Normalna dieta', outcomes:[[80,-2],[20,2]]},

    linkVote:      {stat:'recognition', name:'Podejrzany link', outcomes:[[50,10],[50,-20]]},
    padel:         {stat:'loyalty', name:'Wyjście z drużyną', outcomes:[[70,2],[30,-1]]},
    bookSale:      {stat:'loyalty', name:'Pomoc koledze', outcomes:[[70,1],[30,-1]]},
    bengayLaugh:   {stat:'loyalty', name:'Żart w szatni', outcomes:[[70,2],[30,-2]]},
    bengayPrank:   {stat:'loyalty', name:'Żart z bramkarza', outcomes:[[60,2],[40,-2]]},
    honestRun:     {stat:'overall', name:'Uczciwy trening', outcomes:[[30,2],[70,0]]},
    pubNight:      {stat:'recognition', name:'Stary lokal', outcomes:[[60,5],[40,-5]]},
    fashionBoots:  {stat:'recognition', name:'Modne buty', outcomes:[[65,8],[35,-5]]},
    bengayProof:   {stat:'injuryRisk', name:'Nowy wynalazek', outcomes:[[50,-8],[50,8]]}
  };

  // Jedna decyzja = jeden jawny rzut. Stare wielopakietowe efekty z act()
  // są ignorowane dla zdarzeń fabularnych. Rynek klubowy pozostaje wyjątkiem.
  const DECISION_ROLLS = {
    young_minutes:[ROLL.playRisky,null],
    puchar_fatigue:[ROLL.ovrRisky,ROLL.healthSafe],
    studies:[ROLL.profSafe,ROLL.ovrRisky],
    serious_injury:[ROLL.playRisky,ROLL.healthSafe],
    first_national_camp:[ROLL.profSafe,ROLL.recogRisky],
    reserve_warning:[ROLL.playRisky,null],
    position_coach:[ROLL.ovrBalanced,ROLL.playBalanced],
    local_tv_preseason:[ROLL.recogSafe,ROLL.profSafe],
    ultras_flares:[null,ROLL.fanRefusal],
    cwiakala_interview:[ROLL.interview,ROLL.extraTraining],
    helti_plan:[ROLL.kaleDiet,ROLL.normalDiet],
    wisnicz_festival:[null,ROLL.extraTraining],

    kuba_x_vote:[ROLL.linkVote,null],
    kuba_padel:[ROLL.padel,ROLL.healthSafe],
    kuba_futbol_na_tak:[ROLL.bookSale,ROLL.loyaltyRisky],
    kuba_bengay_target:[ROLL.bengayLaugh,ROLL.loyaltyRisky],
    kuba_bengay_keeper:[ROLL.bengayPrank,ROLL.profSafe],
    kuba_tree_run:[ROLL.honestRun,ROLL.healthSafe],
    kuba_favourite_pub:[ROLL.pubNight,ROLL.healthSafe],
    kuba_dynamic_sock:[ROLL.fashionBoots,ROLL.healthSafe],
    kuba_bengay_boxers:[ROLL.bengayProof,null]
  };

  function attachDecisionRolls(d,id){
    if(!d || !Array.isArray(d.choices)) return d;
    const specs=DECISION_ROLLS[id];
    if(specs){
      d.choices.forEach((ch,i)=>{
        if(specs[i]){
          ch.rollSpec=specs[i];
          ch.ignoreLegacyAct=true;
          ch.ovrProfile=null;
        }
      });
    }
    return d;
  }

  function statLabel(stat){
    return ({
      overall:'OVR',
      playChance:'szansa na grę',
      injuryRisk:'ryzyko urazu',
      professionalism:'profesjonalizm',
      recognition:'medialność',
      loyalty:'lojalność'
    })[stat]||stat;
  }

  function rollSpecText(spec){
    if(!spec) return '';
    return spec.outcomes.map(([pct,delta])=>{
      let value;
      if(spec.stat==='injuryRisk'){
        value=delta<0?`ryzyko urazu ${delta} p.p.`:delta>0?`ryzyko urazu +${delta} p.p.`:'bez zmian';
      } else if(spec.stat==='playChance'){
        value=delta===0?'bez zmian':`szansa na grę ${delta>0?'+':''}${delta} p.p.`;
      } else if(spec.stat==='overall'){
        value=delta===0?'bez zmian':`${delta>0?'+':''}${delta} OVR`;
      } else if(spec.stat==='professionalism'){
        value=delta===0?'bez zmian':`profesjonalizm ${delta>0?'+':''}${delta}`;
      } else if(spec.stat==='recognition'){
        value=delta===0?'bez zmian':`medialność ${delta>0?'+':''}${delta}`;
      } else if(spec.stat==='loyalty'){
        value=delta===0?'bez zmian':`lojalność ${delta>0?'+':''}${delta}`;
      } else {
        value=delta===0?'bez zmian':`${delta>0?'+':''}${delta}`;
      }
      return `${pct}% → ${value}`;
    }).join(' • ');
  }

  function applyDecisionRoll(ch){
    const spec=ch.rollSpec;
    if(!spec) return null;
    const r=rand(1,100);
    let cursor=0,delta=0;
    for(const [pct,d] of spec.outcomes){
      cursor+=pct;
      if(r<=cursor){delta=d;break;}
    }
    const before={
      overall:state.overall,
      playChance:projectedStartChance(state.club,state.boost||0),
      injuryRisk:state.injuryRisk,
      professionalism:state.professionalism,
      recognition:state.recognition||0,
      loyalty:state.loyalty
    }[spec.stat];

    if(spec.stat==='overall'){
      const beforeOverall=state.overall;
      state.overall=clamp(state.overall+delta,20,overallCap());
      noteLegendOverallChange(beforeOverall);
    } else if(spec.stat==='playChance'){
      state.boost=clamp((state.boost||0)+delta,-20,25);
    } else if(spec.stat==='injuryRisk'){
      state.injuryRisk=clamp(state.injuryRisk+delta,5,50);
    } else if(spec.stat==='professionalism'){
      state.professionalism=clamp(state.professionalism+delta,0,100);
    } else if(spec.stat==='recognition'){
      state.recognition=clamp((state.recognition||0)+delta,0,100);
    } else if(spec.stat==='loyalty'){
      state.loyalty=clamp((state.loyalty||0)+delta,0,15);
    }

    const after={
      overall:state.overall,
      playChance:projectedStartChance(state.club,state.boost||0),
      injuryRisk:state.injuryRisk,
      professionalism:state.professionalism,
      recognition:state.recognition||0,
      loyalty:state.loyalty
    }[spec.stat];

    const better = spec.stat==='injuryRisk' ? after<before : after>before;
    const worse  = spec.stat==='injuryRisk' ? after>before : after<before;
    const band=better?'SUKCES':worse?'PORAŻKA':'NEUTRALNIE';
    const suffix=(spec.stat==='playChance'||spec.stat==='injuryRisk')?'%':'';
    const result=`${statLabel(spec.stat)}: ${Math.round(before)}${suffix} → ${Math.round(after)}${suffix}`;
    log('Skutek decyzji',`Rzut ${r}/100 • ${band} • ${result}`);
    render();
    return {roll:r,band,result,spec};
  }

  function tagEvent(d,id,weight=1,cooldown=4,maxUses=1){
    if(!d) return null;
    d.id=id;
    d.baseWeight=weight;
    // Dawne wagi 4–6 spychały część zdarzeń do ok. 1–2% w zatłoczonym
    // sezonie. Siedem jest od teraz minimalną realną wagą fabularną.
    d.weight=Math.max(7,weight);
    d.cooldown=cooldown; d.maxUses=maxUses;
    attachDecisionRolls(d,id);
    return d;
  }

  function rememberEvent(d){
    if(!d || !d.id) return;
    const m=state.eventMemory[d.id] || {count:0,lastAge:-99};
    state.eventMemory[d.id]={count:m.count+1,lastAge:state.age};
  }

  function storyContext(performance){
    return {
      s:state, performance, clamp, rand, pick, tierName, log,
      loanMove, moveClub, regionalReturn, findTransferClub, findLowerClub, findPlayableClub,
      playChance:()=>projectedStartChance(state.club,state.boost||0),
      data:GAME_DATA
    };
  }

  const MOVEMENT_EVENT_IDS = new Set([]);

  // Zdarzenia z krótkim albo wyjątkowym oknem nie mogą przegrać jedynej
  // okazji z ogólnym wywiadem czy treningiem. Wyższy numer oznacza, że po
  // spełnieniu warunku to zdarzenie ma pierwszeństwo przed pozostałymi.
  const STORY_EVENT_PRIORITY={
    license_chaos:100,
    four_men_on_couches:95,
    german_anti_polish_coach:90,
    breakthrough_hype_sport:85,
    first_team_invite:80,
    early_contract:75,
    young_minutes:70,
    last_big_offer:65,
    breakthrough_hype_pnplus:60,
    breakthrough_hype_tempo:55
  };

  function storyEventCandidates(performance){
    if(!window.CAREER_EVENT_DEFS) return [];
    const h=storyContext(performance);
    const out=[];
    CAREER_EVENT_DEFS.forEach(def=>{
      // Zmiana klubu ma własny, obowiązkowy etap po KAŻDYM sezonie.
      // Dzięki temu losowe wydarzenie nie może zastąpić rynku transferowego.
      if(MOVEMENT_EVENT_IDS.has(def.id)) return;
      if(!eventAllowed(def.id,def.cooldown,def.maxUses)) return;
      let ok=false;
      try { ok=!!def.when(h); } catch(e){ console.warn('Event condition failed',def.id,e); }
      if(!ok) return;
      let d=null;
      try { d=def.make(h); } catch(e){ console.warn('Event build failed',def.id,e); }
      if(d) out.push(tagEvent(d,def.id,def.weight,def.cooldown,def.maxUses));
    });
    return out;
  }

  function seriousInjuryDecision(){
    const acl=state.lastInjurySeverity==='ZERWANIE WIĘZADEŁ KRZYŻOWYCH';
    const verySerious=acl || state.lastInjurySeverity==='BARDZO CIĘŻKI';
    return tagEvent({
      title:acl?'Rok po zerwaniu więzadeł.':verySerious?'Powrót po bardzo ciężkiej kontuzji.':'Rehabilitacja czy szybki powrót?',
      text:acl
        ? `Cały sezon spędziłeś poza boiskiem po zerwaniu więzadeł krzyżowych. Rehabilitacja trwała cały rok; teraz decydujesz, jak wejść w powrót do gry.`
        : `${state.lastInjurySeverity} uraz zabrał ci ${state.lastInjuryLost} meczów${state.lastInjuryOvrPenalty?` i kosztował ${Math.abs(state.lastInjuryOvrPenalty)} OVR`:''}. Sztab daje dwie drogi przed kolejnym sezonem.`,
      choices:[
        {
          label:'Wracam jak najszybciej',
          preview:`Pełna dostępność od początku • hierarchia +5 p.p. • ryzyko urazu +${verySerious?8:6} p.p.`,
          act:()=>{
            state.boost+=5;
            state.injuryRisk=clamp(state.injuryRisk+(verySerious?8:6),5,45);
            log('Przyspieszasz powrót po urazie.','Od początku walczysz o skład, ale mocno zwiększasz ryzyko nawrotu.');
          }
        },
        {
          label:'Pełna rehabilitacja',
          preview:acl
            ? `Rok rehabilitacji jest już za tobą • ryzyko urazu -8 p.p. • profesjonalizm +2 • bez dodatkowej utraty kolejnego sezonu`
            : `Ryzyko urazu -${verySerious?8:6} p.p. • profesjonalizm +2 • początek następnego sezonu: ok. ${verySerious?'20':'10'}% mniej meczów`,
          act:()=>{
            state.boost-=1;
            state.injuryRisk=clamp(state.injuryRisk-(verySerious?8:6),5,45);
            state.professionalism=clamp(state.professionalism+2,0,100);
            if(!acl) state.nextAppsFactor=Math.min(state.nextAppsFactor||1,verySerious?.80:.90);
            log('Wybierasz pełną rehabilitację.',acl
              ? `Rok leczenia jest zakończony. Wracasz ostrożnie, ale bez automatycznej utraty kolejnego sezonu.`
              : `Chronisz zdrowie, ale początek następnego sezonu tracisz na odbudowę.`);
          }
        }
      ]
    },'serious_injury',18,0,99);
  }

  function firstNationalDecision(){
    return tagEvent({
      title:'Pierwsze zgrupowanie reprezentacji.',
      text:'Wchodzisz do szatni reprezentacji Polski. Nagle trenujesz z zawodnikami, których jeszcze niedawno oglądałeś w telewizji.',
      choices:[
        {label:'Słucham i chłonę',act:()=>{state.professionalism=clamp(state.professionalism+2,0,100);state.score+=5;log('Pierwsze zgrupowanie kadry.','Nie próbujesz niczego udowadniać na siłę.');}},
        {label:'Od razu pokazuję charakter',act:()=>{state.boost+=5;state.injuryRisk=clamp(state.injuryRisk+1,5,45);state.score+=5;log('Pierwsze zgrupowanie kadry.','Od pierwszego treningu walczysz o swoją pozycję.');}}
      ]
    },'first_national_camp',30,99,1);
  }

  function makeDecision(performance){
    // Spadek nie wymusza już osobnego transferowego eventu — za chwilę i tak
    // pojawi się coroczny wybór klubu z opcją pozostania albo odejścia.
    if(state.justNationalCall){
      state.seasonsSinceDecision=0;
      return firstNationalDecision();
    }
    if((state.lastInjurySeverity==='POWAŻNY' || state.lastInjurySeverity==='BARDZO CIĘŻKI' || state.lastInjurySeverity==='ZERWANIE WIĘZADEŁ KRZYŻOWYCH') && eventAllowed('serious_injury',0,99)){
      state.seasonsSinceDecision=0;
      return seriousInjuryDecision();
    }

    // Tempo kariery (Copero): intense=1 / normal=2 / express=3 sezony między historiami.
    const every=state.decisionEvery||1;
    state.seasonsSinceDecision=(state.seasonsSinceDecision||0)+1;
    if(state.seasonsSinceDecision<every){
      const left=every-state.seasonsSinceDecision;
      return {
        title:'Cichy sezon.',
        text:`Tempo kariery (${state.careerPace||'normal'}): bez wielkiej historii. Treningi, mecze, regeneracja. Do następnego momentu decyzyjnego zostało jeszcze ${left} sezon${left===1?'':'y/ów'}.`,
        choices:[{label:'DALEJ',act:()=>{}}]
      };
    }
    state.seasonsSinceDecision=0;

    const decisions=storyEventCandidates(performance);
    const priority=decisions.filter(d=>STORY_EVENT_PRIORITY[d.id]);
    // Od 46 lat wcześniejsze założenie „zawsze spokojny rok” pozostaje twarde.
    // Priorytet ratuje krótkie okna tylko do końca 45. roku życia.
    if(priority.length && state.age<46){
      const top=Math.max(...priority.map(d=>STORY_EVENT_PRIORITY[d.id]));
      return weightedPick(priority.filter(d=>STORY_EVENT_PRIORITY[d.id]===top));
    }

    // Po 38. roku życia coraz częściej trafia się po prostu spokojny rok.
    // To celowe zdarzenie, a nie brak pasujących wpisów w bazie decyzji.
    // 39 lat: 30%, potem +10 p.p. rocznie; od 46 lat już zawsze.
    if(state.age>=39){
      const quietChance=clamp(30+(state.age-39)*10,30,100);
      if(rand(1,100)<=quietChance){
        return {
          title:'Nic ci się nie wydarzyło.',
          text:'Kolejny rok kariery mija bez historii, która zmieniałaby twoją sytuację. Treningi, mecze, regeneracja — zwykły rytm weterana.',
          choices:[{label:'DALEJ',act:()=>{}}]
        };
      }
    }
    if(!decisions.length) return null;
    // Dopóki istnieje pasujące zdarzenie, którego ta kariera jeszcze nie
    // widziała, powtórki nie zajmują mu miejsca. Dopiero po wyczerpaniu
    // świeżej puli wracamy do zdarzeń wielokrotnych.
    const unseen=decisions.filter(d=>!(state.eventMemory[d.id]?.count));
    return weightedPick(unseen.length?unseen:decisions);
  }

  function relegationDecision(){
    return {title:'Spadliście z ligi.',text:`${state.club.name} zacznie kolejny sezon w ${tierName(state.club.tier)}. Klub chce, żebyś został i pomógł wrócić.`,choices:[
      {label:'Zostaję',act:()=>{state.loyalty=clamp((state.loyalty||0)+3,0,15);state.boost+=5;log('Zostajesz po spadku.','Chcesz pomóc klubowi wrócić wyżej.');}},
      {label:'Szukam odejścia',act:()=>{const t=findTransferClub(true); if(t) moveClub(t); else {state.boost-=1;log('Nie znajdujesz odpowiedniej oferty.','Zostajesz przynajmniej do zimy.');}}}
    ]};
  }

  function transferDecision(mode){
    let target=null;
    if(mode==='foreign'){
      const fromPoland=!isForeignClub(state.club);
      const performance=45; // zdarzenie jest ofertą "w tle"; używamy neutralnie dobrego sezonu.
      const worst=fromPoland?4:foreignWorstOfferTier(state.club,performance,state.season?.apps||0,state.lowAppsStreak||0);
      let pool=GAME_DATA.foreignClubs.filter(c=>
        c.name!==state.club.name &&
        c.foreignTier<=worst &&
        (fromPoland?c.foreignTier<5:(c.foreignTier<5 || sameLocalTransferRegion(c,state.club))) &&
        foreignTierReachable(c.foreignTier,performance,fromPoland) &&
        c.strength<=state.overall+8
      );
      if(pool.length){
        const best=Math.min(...pool.map(c=>c.foreignTier));
        const bestPool=pool.filter(c=>c.foreignTier===best);
        target=pick(bestPool);
      }
    } else if(mode==='eliteForeign'){
      const pool=GAME_DATA.foreignClubs.filter(c=>
        c.foreignTier<=2 &&
        foreignTierReachable(c.foreignTier,50,!isForeignClub(state.club)) &&
        c.strength<=state.overall+8
      );
      if(pool.length){
        const best=Math.min(...pool.map(c=>c.foreignTier));
        target=pick(pool.filter(c=>c.foreignTier===best));
      }
    } else if(mode==='sameTier') target=findSameTierUpgrade();
    else target=findHigherPolishClub();
    if(!target) return null;
    const abroad=mode==='foreign'||mode==='eliteForeign';
    return {
      title: abroad?'Telefon z zagranicy.':mode==='sameTier'?'Większy klub z tej samej ligi.':'Oferta z wyższej ligi.',
      text:`${target.name} (${clubCompetition(target)}) chce cię sprowadzić. W obecnym klubie masz już wyrobioną pozycję.`,
      choices:[
        {label:`Idę do ${target.name}`,act:()=>moveClub(target)},
        {label:'Zostaję',act:()=>{state.loyalty=clamp((state.loyalty||0)+2,0,15);state.boost+=3;log(`Odrzucasz ofertę ${target.name}.`,`Zostajesz w ${state.club.name}.`);}}
      ]
    };
  }

  function trainingDecision(){
    return {title:'Masz wolne lato.',text:'Możesz wejść w dodatkowy indywidualny cykl treningowy albo po prostu odpocząć po sezonie.',choices:[
      {label:'Dodatkowy trening',act:()=>{state.professionalism=clamp(state.professionalism+5,0,100);state.boost+=4;state.injuryRisk=clamp(state.injuryRisk+2,5,45);log('Robisz dodatkowy trening.','Większa szansa rozwoju, trochę większe ryzyko przeciążenia.');}},
      {label:'Odpoczywam',act:()=>{state.injuryRisk=clamp(state.injuryRisk-3,5,45);log('Stawiasz na odpoczynek.','Mniej ryzyka urazu w kolejnym sezonie.');}}
    ]};
  }
  function positionStory(){
    const role=state.position==='FWD'?'skrzydle':state.position==='MID'?'bardziej ofensywnej roli':state.position==='DEF'?'wahadle':'grze wyżej od bramki';
    return {title:'Trener ma dla ciebie nową rolę.',text:`Chce częściej ustawiać cię na ${role}.`,choices:[
      {label:'Zgadzam się',act:()=>{state.boost+=2;log('Przyjmujesz nową rolę.','Stajesz się bardziej uniwersalny.');}},
      {label:'Wolę swoją pozycję',act:()=>{state.boost-=2;state.loyalty=clamp((state.loyalty||0)-1,0,15);log('Bronisz swojej pozycji.','Trener nie jest zachwycony, ale wiesz czego chcesz.');}}
    ]};
  }
  function agentDecision(){
    return {title:'Odzywa się agent.',text:'Obiecuje, że szybciej wyciągnie cię do większego klubu. W zamian chce, żebyś zaczął mocniej naciskać na transfer.',choices:[
      {label:'Podpisuję z nim',act:()=>{state.loyalty=clamp((state.loyalty||0)-1,0,15);state.boost+=1;log('Zmieniasz otoczenie.','Od teraz częściej patrzysz na kolejny krok.');}},
      {label:'Zostaję przy swoim',act:()=>{state.loyalty=clamp((state.loyalty||0)+2,0,15);log('Nie zmieniasz agenta.','Wolisz spokój i regularne granie.');}}
    ]};
  }
  function coachChangeDecision(){
    return {title:'Klub zmienia trenera.',text:'Nowy szkoleniowiec zaczyna od czystej kartki i chce zobaczyć cię w innej roli w zespole.',choices:[
      {label:'Przekonuję go na treningach',act:()=>{state.professionalism=clamp(state.professionalism+3,0,100);state.boost+=3;log('Dobrze wchodzisz we współpracę z nowym trenerem.','Masz szansę poprawić swoją pozycję.');}},
      {label:'Czekam, co będzie',act:()=>{state.boost-=1;state.injuryRisk=clamp(state.injuryRisk-1,5,45);log('Nie szarżujesz po zmianie trenera.','Stawiasz na cierpliwość.');}}
    ]};
  }
  function captainDecision(){
    return {title:'Szatnia widzi w tobie lidera.',text:'Trener proponuje ci wejście do rady drużyny, ale oznacza to więcej odpowiedzialności i mniej świętego spokoju.',choices:[
      {label:'Biorę odpowiedzialność',act:()=>{state.loyalty=clamp((state.loyalty||0)+2,0,15);log('Stajesz się jednym z liderów zespołu.','Twoja pozycja w klubie rośnie.');}},
      {label:'Skupiam się na grze',act:()=>{state.boost+=2;log('Odmawiasz funkcji lidera.','Chcesz odpowiadać przede wszystkim na boisku.');}}
    ]};
  }
  function contractDecision(){
    return {title:'Klub proponuje nowy kontrakt.',text:'Możesz związać się na dłużej albo zostawić sobie otwartą drogę do transferu.',choices:[
      {label:'Podpisuję',ovrProfile:'safe',act:()=>{state.loyalty=clamp((state.loyalty||0)+3,0,15);state.boost+=2;log('Przedłużasz kontrakt.','Klub daje ci mocniejszą pozycję.');}},
      {label:'Czekam z decyzją',ovrProfile:'highrisk',act:()=>{state.loyalty=clamp((state.loyalty||0)-1,0,15);state.marketBonus=clamp((state.marketBonus||0)+25,0,60);log('Nie przedłużasz umowy.','Ryzykujesz stabilność, ale agent szerzej otwiera rynek na najbliższe lato.');}}
    ]};
  }


  function corruptionReturnOffers(originTier){
    const targetTier=Math.max(1,originTier-1);
    let pool=shuffle(seniorClubs().filter(c=>c.tier===targetTier && !c.reserve));
    const regional=pool.filter(c=>c.region===state.region);
    const ordered=[...shuffle(regional),...pool.filter(c=>c.region!==state.region)];
    const out=[];
    for(const c of ordered){
      if(!out.some(x=>x.name===c.name)) out.push(c);
      if(out.length>=4) break;
    }
    return out;
  }

  function presentCorruptionReturnMarket(originTier,originClub){
    const offers=corruptionReturnOffers(originTier);
    const choices=offers.map(c=>({
      label:`${c.name} — ${tierName(c.tier)}`,
      ovrProfile:null,
      preview:`Powrót po dyskwalifikacji • dokładnie poziom niżej niż ${originClub} • bazowa prognoza gry ok. ${projectedStartChance(c,0)}%`,
      act:()=>moveClub(c)
    }));

    const d={
      title:'Rok dyskwalifikacji minął. Wracasz na rynek.',
      text:`Po roku bez klubu możesz wrócić do gry, ale reputacja nie pozwala od razu odzyskać dawnego poziomu. Dostajesz oferty z ${tierName(Math.max(1,originTier-1))}.`,
      choices
    };
    presentDecision(d,goToLifeThenYear);
  }

  function processCorruptionSuspension(){
    const plan=state.corruptionPlan;
    if(!plan || !plan.caught) return false;

    const originClub=plan.clubName;
    const originTier=plan.originTier;
    const loss=plan.loss;
    state.corruptionPlan=null;

    // Natychmiastowe rozwiązanie kontraktu.
    log(`${originClub} rozwiązuje z tobą kontrakt.`,`Afera korupcyjna • dyskwalifikacja na cały następny sezon`);
    state.club={name:'Bez klubu — dyskwalifikacja',tier:0,strength:0,region:state.region,noClub:true};
    state.status='Dyskwalifikowany';
    state.loyalty=0;
    state.national='—';

    // Wchodzimy w następny sezon i cały go tracimy.
    state.age++;
    state.seasonYear++;
    const before=state.overall;
    state.overall=clamp(state.overall-loss,20,overallCap());
    noteLegendOverallChange(before);
    state.corruptionShadow=3;
    state.season={apps:0,goals:0,assists:0,minutes:0};
    state.seasonNationalCaps=0;
    state.seasonNationalGoals=0;
    state.lowAppsStreak=(state.lowAppsStreak||0)+1;

    state.careerSeasons.push({
      year:state.seasonYear,age:state.age,club:'Bez klubu',tier:0,
      ovrBefore:before,ovrAfter:state.overall,apps:0,goals:0,assists:0,minutes:0,
      grade:'DYSKWALIFIKACJA',form:'—',environment:'—',nationalCaps:0,nationalGoals:0,
      note:`Afera korupcyjna • ${originClub} zerwał kontrakt • rzut ${plan.roll}/100 • OVR -${loss}`
    });

    els.eventBox.classList.remove('special-event'); void els.eventBox.offsetWidth; els.eventBox.classList.add('special-event');
    els.eventBox.innerHTML=`<div class="event-kicker">SEZON ${state.seasonYear}/${String(state.seasonYear+1).slice(2)} • DYSKWALIFIKACJA</div><h3>Cały rok poza piłką.</h3><p>${originClub} zerwał kontrakt. 0 meczów, 0 minut. OVR ${before} → ${state.overall}. Po tym sezonie możesz wrócić wyłącznie poziom niżej.</p>`;
    render();

    presentCorruptionReturnMarket(originTier,originClub);
    return true;
  }

  function presentDecision(d,onDone=advanceYear){
    rememberEvent(d);
    state.pendingDecision=true; els.playSeasonBtn.classList.add('hidden'); els.decisionBox.classList.remove('hidden');
    els.decisionTitle.textContent=d.title;
    if(d.html) els.decisionText.innerHTML=d.html;
    else els.decisionText.textContent=d.text;
    els.decisionChoices.innerHTML='';

    d.choices.forEach(ch=>{
      const b=document.createElement('button'); b.className='choice-btn';
      let stake='';
      if(ch.specialRoll==='corruption' || ch.specialRoll==='ultras_flares' || ch.specialRoll==='wisnicz_brawl' || ch.specialRoll==='grajewski_friendly' || ch.specialRoll==='olympic_supplements') stake=ch.preview;
      else if(ch.rollSpec) stake=rollSpecText(ch.rollSpec);
      else stake=choiceStakeText(ch);
      b.innerHTML=`<span class="choice-main">${ch.label}</span><span class="choice-stake">${stake}</span>`;

      b.onclick=()=>{
        let simpleResult='';
        let detailResult='';

        // MECZ PRZYJACIÓŁ ANDRZEJA GRAJEWSKIEGO — pełny, grywalny mecz.
        if(ch.specialRoll==='grajewski_friendly'){
          els.decisionChoices.innerHTML='<p class="choice-stake">Przechodzimy do meczu…</p>';
          nssPolska.playClubDecisiveMatch({
            kicker:'MECZ TOWARZYSKI',
            homeName:'Przyjaciele Andrzeja Grajewskiego',
            homeStrength:62,
            opponent:{name:'Reszta Świata',strength:64},
            // Musi paść rozstrzygnięcie: remis uruchamia dogrywkę i karne.
            knockout:true
          }).then(result=>{
            const win=result.gf>result.ga;
            if(win){
              const before=state.overall;
              const bonus=Math.max(1,Math.round(before*.25));
              state.overall=before+bonus;
              state.grajewskiOverallCap=Math.max(state.grajewskiOverallCap||0,state.overall);
              noteLegendOverallChange(before);
              log('Przyjaciele Andrzeja Grajewskiego — Reszta Świata',`${result.gf}:${result.ga} • zwycięstwo • OVR ${before} → ${state.overall} (+${bonus}, czyli 25%)`);
            } else {
              log('Przyjaciele Andrzeja Grajewskiego — Reszta Świata',`${result.gf}:${result.ga} • porażka • natychmiastowy koniec kariery`);
            }
            state.pendingDecision=false;
            els.decisionBox.classList.add('hidden');
            els.playSeasonBtn.classList.remove('hidden');
            render();
            if(win) onDone();
            else retire();
          });
          return;
        }

        // KORUPCJA
        else if(ch.specialRoll==='corruption'){
          const r=rand(1,100);
          const caught=r>70;
          if(caught){
            const loss = 5;
            state.corruptionPlan={clubName:state.club.name,originTier:state.club.tier,caught:true,roll:r,loss};
            simpleResult=`WYKRYCIE. Dyskwalifikacja na cały sezon i -${loss} OVR.`;
          } else {
            state.corruptionPlan={clubName:state.club.name,originTier:state.club.tier,caught:false,roll:r,loss:0};
            simpleResult='Układ przechodzi. Klub ma zapewniony awans.';
          }
          detailResult=`Rzut d100: ${r}. ${ch.preview}`;
          log('Decyzja korupcyjna',`Rzut ${r}/100 • ${caught?'WYKRYCIE':'UKŁAD PRZECHODZI'}`);
        }

        // ULTRASI / RACE — jedna kość, dwa bardzo różne skutki.
        else if(ch.specialRoll==='ultras_flares'){
          const r=rand(1,6);
          if(r<=3){
            const before=state.recognition||0;
            state.recognition=clamp(before+12,0,100);
            simpleResult=`Medialność ${before} → ${state.recognition}.`;
          } else {
            state.nextAppsFactor=Math.min(state.nextAppsFactor||1,.8);
            simpleResult='Zawieszenie: w następnym sezonie rozegrasz o 20% mniej meczów.';
          }
          detailResult=`Rzut kostką: ${r}. 1–3 → medialność +12 • 4–6 → -20% meczów w następnym sezonie.`;
          log('Race na stadionie',`Rzut k6: ${r} • ${simpleResult}`);
          render();
        }

        // DNI WIŚNICZA — jedna kość, sława albo uraz.
        else if(ch.specialRoll==='wisnicz_brawl'){
          const r=rand(1,6);
          if(r<=3){
            const before=state.recognition||0;
            state.recognition=clamp(before+10,0,100);
            simpleResult=`Medialność ${before} → ${state.recognition}.`;
          } else {
            state.nextMinutesFactor=Math.min(state.nextMinutesFactor||1,.8);
            simpleResult='Uraz: w następnym sezonie rozegrasz o 20% mniej minut.';
          }
          detailResult=`Rzut kostką: ${r}. 1–3 → medialność +10 • 4–6 → -20% minut w następnym sezonie.`;
          log('Dni Wiśnicza Małego',`Rzut k6: ${r} • ${simpleResult}`);
          render();
        }

        // SUPLEMENTY DOKTORA KADRY OLIMPIJSKIEJ — dokładnie jeden z jedenastu
        // równoprawdopodobnych wyników całkowitych: -5, -4, ... 0, ... +4, +5.
        else if(ch.specialRoll==='olympic_supplements'){
          const before=state.overall;
          const delta=rand(-5,5);
          state.overall=clamp(before+delta,20,overallCap());
          noteLegendOverallChange(before);
          const applied=state.overall-before;
          simpleResult=applied===0
            ?`Wylosowano ${delta>=0?'+':''}${delta} OVR. Twój OVR pozostaje na poziomie ${state.overall}.`
            :`Wylosowano ${delta>0?'+':''}${delta} OVR. OVR ${before} → ${state.overall}.`;
          detailResult=`Losowanie całkowite z przedziału -5…+5: ${delta>=0?'+':''}${delta}. Każdy z 11 wyników miał taką samą szansę.`;
          log('Suplementy doktora kadry olimpijskiej',`Losowanie ${delta>=0?'+':''}${delta} • OVR ${before} → ${state.overall}`);
          render();
        }

        // ZWYKŁY JEDEN RZUT
        else if(ch.rollSpec){
          const result=applyDecisionRoll(ch);
          simpleResult=result.result;
          detailResult=`Rzut d100: ${result.roll}. Możliwe wyniki: ${rollSpecText(ch.rollSpec)}.`;
        }

        else {
          if(ch.endCareer){
            if(ch.act) ch.act();
            state.pendingDecision=false;
            els.decisionBox.classList.add('hidden');
            els.playSeasonBtn.classList.remove('hidden');
            return;
          }

          // Wyjątek: wybór klubu. Tu stawką jest sam klub i prognoza minut.
          if(ch.act) ch.act();
          state.pendingDecision=false;
          els.decisionBox.classList.add('hidden');
          els.playSeasonBtn.classList.remove('hidden');
          onDone();
          return;
        }

        els.decisionTitle.textContent='WYNIK DECYZJI';
        els.decisionText.innerHTML=`<strong>${simpleResult}</strong>
          <details class="roll-details">
            <summary>Pokaż szczegóły losowania</summary>
            <div>${detailResult}</div>
          </details>`;
        els.decisionChoices.innerHTML='';

        const next=document.createElement('button');
        next.className='primary full';
        next.textContent='DALEJ';
        next.onclick=()=>{
          state.pendingDecision=false;
          els.decisionBox.classList.add('hidden');
          els.playSeasonBtn.classList.remove('hidden');
          if(state.corruptionPlan && state.corruptionPlan.caught){
            processCorruptionSuspension();
            return;
          }
          onDone();
        };
        els.decisionChoices.appendChild(next);
      };
      els.decisionChoices.appendChild(b);
    });
  }


  // v0.52 — POLSKI RYNEK REGIONALNY.
  // Im niższa liga, tym mocniej liczy się geografia:
  // aktualne województwo klubu -> sąsiednie -> rodzinne -> reszta Polski.
  const POLISH_REGION_NEIGHBORS={
    'Dolnośląskie':['Lubuskie','Wielkopolskie','Opolskie'],
    'Kujawsko-pomorskie':['Pomorskie','Warmińsko-mazurskie','Mazowieckie','Łódzkie','Wielkopolskie'],
    'Lubelskie':['Podlaskie','Mazowieckie','Świętokrzyskie','Podkarpackie'],
    'Lubuskie':['Zachodniopomorskie','Wielkopolskie','Dolnośląskie'],
    'Łódzkie':['Wielkopolskie','Kujawsko-pomorskie','Mazowieckie','Świętokrzyskie','Śląskie','Opolskie'],
    'Małopolskie':['Śląskie','Świętokrzyskie','Podkarpackie'],
    'Mazowieckie':['Warmińsko-mazurskie','Podlaskie','Lubelskie','Świętokrzyskie','Łódzkie','Kujawsko-pomorskie'],
    'Opolskie':['Dolnośląskie','Wielkopolskie','Łódzkie','Śląskie'],
    'Podkarpackie':['Małopolskie','Świętokrzyskie','Lubelskie'],
    'Podlaskie':['Warmińsko-mazurskie','Mazowieckie','Lubelskie'],
    'Pomorskie':['Zachodniopomorskie','Wielkopolskie','Kujawsko-pomorskie','Warmińsko-mazurskie'],
    'Śląskie':['Opolskie','Łódzkie','Świętokrzyskie','Małopolskie'],
    'Świętokrzyskie':['Łódzkie','Mazowieckie','Lubelskie','Podkarpackie','Małopolskie','Śląskie'],
    'Warmińsko-mazurskie':['Pomorskie','Kujawsko-pomorskie','Mazowieckie','Podlaskie'],
    'Wielkopolskie':['Zachodniopomorskie','Pomorskie','Kujawsko-pomorskie','Łódzkie','Opolskie','Dolnośląskie','Lubuskie'],
    'Zachodniopomorskie':['Pomorskie','Wielkopolskie','Lubuskie']
  };

  function polishRegionsAdjacent(a,b){
    return !!(a && b && (POLISH_REGION_NEIGHBORS[a]||[]).includes(b));
  }

  function polishLocalityClass(c,current=state.club){
    if(!c || isForeignClub(c)) return 'none';
    const currentRegion=current && current.region ? current.region : state.region;
    const homeRegion=state.region;

    if(c.region===currentRegion) return 'current';
    if(polishRegionsAdjacent(currentRegion,c.region)) return 'neighbor';
    if(c.region===homeRegion) return 'home';
    return 'far';
  }

  function polishLocalityBonus(c,current=state.club){
    if(!c || isForeignClub(c)) return 0;

    // tier 1 = głęboka lokalna piłka, tier 6 = Ekstraklasa.
    // Bierzemy niższy z poziomów klubu obecnego i zainteresowanego,
    // bo transfer na dole piramidy jest najbardziej lokalny.
    const localTier=Math.min(c.tier||6,current?.tier||6);
    const cls=polishLocalityClass(c,current);

    const same={1:28,2:24,3:18,4:11,5:5,6:2};
    const near={1:16,2:13,3:9,4:5,5:2,6:0};
    const home={1:13,2:11,3:8,4:6,5:4,6:2};
    const farPenalty={1:-9,2:-7,3:-4,4:-2,5:0,6:0};

    if(cls==='current') return same[localTier]||0;
    if(cls==='neighbor') return near[localTier]||0;
    if(cls==='home') return home[localTier]||0;
    return farPenalty[localTier]||0;
  }

  function veteranCareerText(){
    if(state.age<35) return '';
    if(state.age<=37) return 'Wiek coraz mocniej odbija się na OVR.';
    if(state.age===38) return 'Wiek coraz mocniej odbija się na OVR. Przed tobą być może ostatni pełny sezon bez pytania o zakończenie kariery.';
    if(state.age===39) return 'Regres fizyczny przyspiesza. Od teraz możesz też sam zakończyć karierę z poziomu rynku.';
    return 'Jesteś weteranem, ale kluby nadal oceniają cię po aktualnym OVR i formie, nie po metryce.';
  }

  function annualMarketOffers(performance){
    const current={...state.club};
    const result=[];
    const polish=seniorClubs().filter(c=>c.name!==current.name);
    const history=state.offerHistory||{};
    const apps=state.season?.apps||0;
    const lowStreak=state.lowAppsStreak||0;
    const talentLevel=state.talent||50;
    const media=state.recognition||0;

    const recentlyOffered=c=>{
      const y=history[c.name];
      return Number.isFinite(y) && state.seasonYear-y<=2;
    };
    const add=c=>{
      if(!c || c.name===current.name || result.some(x=>x.name===c.name) || recentlyOffered(c)) return false;
      result.push({...c});
      return true;
    };

    // Awaryjne dopełnienie rynku. Historia ofert jest preferencją,
    // nie powodem, żeby gracz zobaczył 0–1 klubów.
    const addEvenIfRecent=c=>{
      if(!c || c.name===current.name || result.some(x=>x.name===c.name)) return false;
      result.push({...c});
      return true;
    };

    const forceFill=(pool,target=3)=>{
      for(const c of shuffle(pool.filter(c=>
        c && c.name!==current.name && !result.some(x=>x.name===c.name)
      ))){
        addEvenIfRecent(c);
        if(result.length>=target) break;
      }
      return result.length>=target;
    };

    const struggling = apps<8 || performance<30 || lowStreak>=2;
    const perfGood=performance>=43;
    const perfGreat=performance>=56;

    function interestChance(c,kind='normal'){
      // T5/T6 są lokalne. Pierwszy wyjazd z Polski do nich nadal jest niemożliwy.
      if(isForeignClub(c) && c.foreignTier>=5){
        if(!isForeignClub(current) || !sameLocalTransferRegion(c,current)) return 0;
      }

      const levelDiff=clubMarketLevel(c)-clubMarketLevel(current);
      const strengthDiff=state.overall-c.strength;
      let chance=34;

      chance += strengthDiff*1.8;
      chance += clamp((performance-36)*.65,-18,22);
      chance += Math.min(11,apps*.35);
      chance += (media-25)*.18;

      if(levelDiff>0) chance-=levelDiff*13;
      if(levelDiff<0) chance+=Math.min(10,Math.abs(levelDiff)*4);

      if(apps<8 && clubMarketLevel(c)>=clubMarketLevel(current)) chance-=16;
      if(apps<4 && clubMarketLevel(c)>=clubMarketLevel(current)) chance-=10;
      if(lowStreak>=2 && clubMarketLevel(c)>=clubMarketLevel(current)) chance-=18;
      if(lowStreak>=3 && clubMarketLevel(c)>=clubMarketLevel(current)) chance-=10;
      if((state.corruptionShadow||0)>0 && clubMarketLevel(c)>=clubMarketLevel(current)) chance-=28;

      if(state.age<=22 && talentLevel>=70)
        chance += kind==='project' ? 20+Math.round((talentLevel-70)*.25) : 4;

      if(!isForeignClub(c)) chance += polishLocalityBonus(c,current);
      if(kind==='safe') chance+=12;
      if(kind==='ambitious') chance-=3;

      if(isForeignClub(c)){
        const reqMedia=requiredForeignRecognition(c.foreignTier);
        const reqOvr=requiredForeignOvr(c.foreignTier);

        if(!isForeignClub(current)){
          // Pierwszy wyjazd: medialność jest bramką, OVR i sezon muszą ją potwierdzić.
          chance += (media-reqMedia)*1.10;
          if(media<reqMedia) chance -= (reqMedia-media)*1.55;
          if(state.overall<reqOvr) chance -= (reqOvr-state.overall)*3.0;
          if(state.seniorInternational) chance+=10;
          if(state.age<=21 && state.seniorInternational) chance+=6;
        } else {
          // Za granicą geografia pomaga, ale NIE wyznacza już jakości ofert.
          if(c.country===current.country) chance+=18;
          else if(current.zone==='Europa' && c.zone==='Europa' && clubTransferRegion(c)===clubTransferRegion(current)) chance+=10;
          else if(c.zone===current.zone) chance+=5;

          if(current.zone && current.zone!=='Europa'){
            if(c.country===current.country) chance+=8;
            else if(c.zone===current.zone) chance+=6;
          }

          // Lepszy tier jest trudniejszym transferem, ale kara jest niewielka:
          // status sportowy i medialność mają być ważniejsze od geografii.
          if(c.foreignTier<current.foreignTier)
            chance-=(current.foreignTier-c.foreignTier)*4;

          // Medialność jest ważna, lecz po wejściu na zagraniczny rynek
          // sportowa jakość ma większą wagę niż szum wokół nazwiska.
          chance += (media-reqMedia)*.18;
        }
      }

      chance+=rand(-12,12);
      return clamp(Math.round(chance),2,96);
    }

    function tryFrom(pool,kind){
      const shuffled=shuffle(pool.filter(c=>!recentlyOffered(c) && !result.some(x=>x.name===c.name)));
      for(const c of shuffled){
        if(rand(1,100)<=interestChance(c,kind)){
          add(c);
          return true;
        }
      }
      return false;
    }

    // Zagraniczne pule zawsze sprawdzamy od NAJLEPSZEGO dostępnego tieru.
    // To naprawia wcześniejszy błąd, gdzie sortowanie zaczynało od T4.
    function tryFromBestForeignTier(pool,kind='normal'){
      const clean=pool.filter(c=>isForeignClub(c) && !recentlyOffered(c) && !result.some(x=>x.name===c.name));
      const tiers=[...new Set(clean.map(c=>c.foreignTier))].sort((a,b)=>a-b);
      for(const ft of tiers){
        if(tryFrom(clean.filter(c=>c.foreignTier===ft),kind)) return true;
      }
      return false;
    }

    // Jedna konkretna próba z najlepszego dostępnego tieru.
    // Używana dla zawodnika, który jeszcze wyraźnie nie przerósł klubu:
    // awans ma być możliwy, ale nie automatyczny.
    function trySingleBestForeignTier(pool,kind='ambitious'){
      const clean=pool.filter(c=>isForeignClub(c) && !recentlyOffered(c) && !result.some(x=>x.name===c.name));
      if(!clean.length) return false;
      const bestTier=Math.min(...clean.map(c=>c.foreignTier));
      const candidates=shuffle(clean.filter(c=>c.foreignTier===bestTier));
      const c=candidates[0];
      if(!c) return false;
      if(rand(1,100)<=interestChance(c,kind)) return add(c);
      return false;
    }

    // ==========================================================
    // JESTEŚ JUŻ ZA GRANICĄ
    // Jakość -> dopiero potem kraj/region/kontynent.
    // ==========================================================
    if(isForeignClub(current)){
      const strengthWindow=perfGreat?12:perfGood?9:7;
      const worstTier=foreignWorstOfferTier(current,performance,apps,lowStreak);

      const foreignPool=GAME_DATA.foreignClubs.filter(c=>
        c.name!==current.name &&
        !recentlyOffered(c) &&
        c.foreignTier<=worstTier &&
        foreignTierReachable(c.foreignTier,performance,false) &&
        c.strength<=state.overall+strengthWindow &&
        (c.foreignTier<5 || sameLocalTransferRegion(c,current))
      );

      const better=foreignPool.filter(c=>c.foreignTier<current.foreignTier);
      const sameTier=foreignPool.filter(c=>c.foreignTier===current.foreignTier);
      const allowedStepDown=foreignPool.filter(c=>c.foreignTier>current.foreignTier);
      const outgrown=hasOutgrownForeignClub(current,performance,apps);

      const addCareerStep=()=>{
        if(!better.length || current.foreignTier<=1) return false;

        // Naturalny awans to przede wszystkim JEDEN tier wyżej.
        // Nie teleportujemy automatycznie z T4 do T1 tylko dlatego, że rynek jest otwarty.
        const nextTier=Math.max(1,current.foreignTier-1);
        let stepPool=better.filter(c=>c.foreignTier===nextTier);
        if(!stepPool.length) stepPool=better;

        // Najpierw próbujemy normalnego zainteresowania.
        if(tryFromBestForeignTier(stepPool,outgrown?'normal':'ambitious')) return true;

        if(!outgrown) return false;

        // Jeśli zawodnik wyraźnie przerósł klub (np. 97% szans gry),
        // medialność nie może zamrozić kariery. Gwarantujemy jedną
        // sportowo osiągalną ofertę z kolejnego poziomu.
        const candidates=shuffle(stepPool.filter(c=>
          !recentlyOffered(c) &&
          !result.some(x=>x.name===c.name)
        ));
        if(!candidates.length) return false;

        // Preferuj znajomy rynek, ale globalna oferta nadal jest możliwa.
        candidates.sort((a,b)=>{
          const aLocal=a.country===current.country?0:
            clubTransferRegion(a)===clubTransferRegion(current)?1:
            a.zone===current.zone?2:3;
          const bLocal=b.country===current.country?0:
            clubTransferRegion(b)===clubTransferRegion(current)?1:
            b.zone===current.zone?2:3;
          return aLocal-bLocal || Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall);
        });

        return add(candidates[0]);
      };

      // Jeżeli wyraźnie przerosłeś klub, dostajesz realną drogę sportowego awansu.
      // Jeżeli jeszcze nie — lepszy tier nadal może się odezwać, ale wykonujemy
      // tylko JEDNĄ próbę zainteresowania, a nie serię prób po całej bazie.
      if(better.length){
        if(outgrown) addCareerStep();
        else trySingleBestForeignTier(better,'ambitious');
      }

      // Potem podobny poziom, z geografią jako tie-breakerem.
      const sameCountry=sameTier.filter(c=>c.country===current.country);
      const sameRegion=sameTier.filter(c=>c.country!==current.country && clubTransferRegion(c)===clubTransferRegion(current));
      const sameZone=sameTier.filter(c=>c.country!==current.country && clubTransferRegion(c)!==clubTransferRegion(current) && c.zone===current.zone);

      if(result.length<2) tryFromBestForeignTier(sameCountry,'normal');
      if(result.length<2) tryFromBestForeignTier(sameRegion,'normal');
      if(result.length<3) tryFromBestForeignTier(sameZone,'normal');

      // Brak regionalnego dopasowania nie blokuje globalnego rynku.
      while(result.length<3 && tryFromBestForeignTier(foreignPool,'normal')){}

      // Zejście o tier w dół może pojawić się tylko przy realnym kryzysie/minutach.
      if(result.length<3 && struggling)
        while(result.length<3 && tryFromBestForeignTier(allowedStepDown,'safe')){}

      // Powrót do Polski wynika z sytuacji sportowej, nie z wieku zawodnika.
      const returnChance=struggling?26:5;
      if(result.length<3 && rand(1,100)<=returnChance){
        const minReturnTier=state.overall>=66?6:5;
        const polishReturn=polish.filter(c=>c.tier>=minReturnTier && c.strength<=state.overall+4);
        tryFrom(polishReturn,'safe');
      }

      // Rynek ma zawsze dać trzy kluby. Najpierw powtarzamy tylko sportowo
      // sensowne zagraniczne kierunki; historia ofert ustępuje miejsca grywalności.
      if(result.length<3){
        const fallbackWorst=current.foreignTier;
        const foreignFallback=GAME_DATA.foreignClubs.filter(c=>
          c.name!==current.name &&
          c.foreignTier>=Math.max(1,current.foreignTier-1) &&
          c.foreignTier<=fallbackWorst &&
          c.strength<=state.overall+12 &&
          (c.foreignTier<5 || sameLocalTransferRegion(c,current))
        );
        forceFill(foreignFallback,3);
      }

      // Skrajny fallback przy realnym kryzysie sportowym.
      if(result.length<3 && struggling){
        const returnMax=state.overall>=66?6:state.overall>=59?5:4;
        forceFill(polish.filter(c=>c.tier<=returnMax && c.strength<=state.overall+8),3);
      }

      return result.slice(0,3);
    }

    // ==========================================================
    // JESTEŚ W POLSCE
    // ==========================================================
    let naturalMax = state.overall>=66?6:state.overall>=59?5:state.overall>=52?4:state.overall>=46?3:2;
    naturalMax=Math.max(naturalMax,Math.min(6,current.tier));
    if(perfGood) naturalMax=Math.min(6,naturalMax+1);
    if(lowStreak>=2 && apps<8) naturalMax=Math.min(naturalMax,current.tier);

    const marketBonus=(state.marketBonus||0)+(window.CareerLife?window.CareerLife.marketAgentBonus(state):0);
    const marketHit=marketBonus>0 && rand(1,100)<=Math.max(0,marketBonus);
    if(marketHit) naturalMax=Math.min(6,naturalMax+1+(state.agentMarketJump||0));
    state.marketBonus=0;
    state.agentMarketJump=0;

    // Normalny coroczny rynek NIE zasypuje zawodnika ofertami w dół.
    // Zejście o szczebel pojawia się tylko przy problemach z grą/formą.
    const minPolishTier=struggling
      ? Math.max(1,current.tier-1)
      : current.tier;
    const strengthWindow=(perfGreat?12:perfGood?9:6)+(marketHit?5:0);

    const attainable=polish.filter(c=>
      c.tier>=minPolishTier &&
      c.tier<=naturalMax &&
      c.strength<=state.overall+strengthWindow
    );

    // ----------------------------------------------------------
    // III LIGA I NIŻEJ — TWARDY KLUCZ WOJEWÓDZKI.
    // Cztery propozycje na ekranie:
    // 1) przedłużenie z obecnym klubem,
    // 2) klub z TEGO SAMEGO województwa,
    // 3) drugi klub z TEGO SAMEGO województwa,
    // 4) dopiero jeden klub SPOZA województwa.
    //
    // Sąsiednie województwa nie liczą się do dwóch obowiązkowych
    // lokalnych slotów. Geografia buduje zestaw ofert.
    // ----------------------------------------------------------
    if(current.tier<=3){
      const lowerMinTier=struggling ? Math.max(1,current.tier-1) : current.tier;

      const broad=polish.filter(c=>
        c.tier>=lowerMinTier &&
        c.tier<=naturalMax &&
        c.strength<=state.overall+strengthWindow+2
      );

      const fresh=pool=>shuffle(pool.filter(c=>
        !recentlyOffered(c) &&
        !result.some(x=>x.name===c.name)
      ));

      const addGuaranteed=(pool,kind='normal')=>{
        const candidates=fresh(pool);
        if(!candidates.length) return false;

        for(const c of candidates){
          if(rand(1,100)<=interestChance(c,kind)){
            add(c);
            return true;
          }
        }

        candidates.sort((a,b)=>
          Math.abs(a.tier-current.tier)-Math.abs(b.tier-current.tier) ||
          Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall)
        );
        return add(candidates[0]);
      };

      const currentProvince=current.region||state.region;

      // DWA obowiązkowe sloty z dokładnie tego samego województwa.
      const sameProvince=broad.filter(c=>c.region===currentProvince);

      addGuaranteed(sameProvince,'normal');
      if(result.length<2) addGuaranteed(sameProvince,'normal');

      // Jeżeli w podstawowym oknie sportowym zabrakło drugiego klubu,
      // szukamy szerzej PO SZCZEBLACH, ale nadal tylko w tym województwie.
      if(result.length<2){
        const sameProvinceFallback=polish.filter(c=>
          c.region===currentProvince &&
          c.tier<=Math.max(current.tier,naturalMax) &&
          c.tier>=Math.max(1,current.tier-2) &&
          c.strength<=state.overall+strengthWindow+5
        );
        while(result.length<2 && addGuaranteed(sameProvinceFallback,'safe')){}
      }

      // Dopiero trzeci transfer jest spoza województwa.
      const outsideProvince=broad.filter(c=>c.region!==currentProvince);
      if(result.length<3) addGuaranteed(outsideProvince,'normal');

      if(result.length<3){
        const outsideFallback=polish.filter(c=>
          c.region!==currentProvince &&
          c.tier>=Math.max(1,current.tier-1) &&
          c.tier<=Math.max(current.tier,naturalMax) &&
          c.strength<=state.overall+strengthWindow+5
        );
        addGuaranteed(outsideFallback,'safe');
      }

      // Ostateczna siatka bezpieczeństwa nigdy nie omija już poziomu sportowego.
      // Przy skrajnie niskim OVR wolno zejść prosto do tieru 1, ale nie wolno
      // dopełnić ekranu przypadkową ofertą z Ekstraklasy.
      const regionalSafetyCeiling=Math.max(30,state.overall+10);
      const sameProvinceSafety=polish.filter(c=>
        c.region===currentProvince&&c.tier===1&&c.strength<=regionalSafetyCeiling
      );
      const outsideSafety=polish.filter(c=>
        c.region!==currentProvince&&c.tier===1&&c.strength<=regionalSafetyCeiling
      );

      while(result.length<2 && addGuaranteed(sameProvinceSafety,'safe')){}
      if(result.length<3) addGuaranteed(outsideSafety,'safe');

      // Historia ofert nie może wyczyścić całego rynku. Powtórki są dozwolone,
      // lecz nadal wyłącznie w najniższych ligach regionalnych.
      if(result.length<2) forceFill(sameProvinceSafety,2);
      if(result.length<3) forceFill(outsideSafety,3);

      // Awaria danych nie tworzy oferty z wyższej ligi: szukamy najbliższych
      // OVR klubów tieru 1, najpierw w bieżącym województwie.
      const fillClosest=(pool,target)=>{
        const ordered=pool.slice().sort((a,b)=>
          Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall)
        );
        for(const c of ordered){
          addEvenIfRecent(c);
          if(result.length>=target) break;
        }
      };
      if(result.length<2) fillClosest(polish.filter(c=>c.region===currentProvince&&c.tier===1),2);
      if(result.length<3) fillClosest(polish.filter(c=>c.region!==currentProvince&&c.tier===1),3);

      return result.slice(0,3);
    }

    // ----------------------------------------------------------
    // PIERWSZY WYJAZD ZA GRANICĘ
    // Najpierw wyznaczamy poziom, potem losujemy klub.
    // ----------------------------------------------------------
    const foreignPool=GAME_DATA.foreignClubs.filter(c=>{
      if(c.foreignTier>=5) return false; // T5/T6 nie są pierwszym wyjazdem.
      if(recentlyOffered(c)) return false;
      if(!foreignTierReachable(c.foreignTier,performance,true)) return false;

      const reqPerf=({4:27,3:34,2:42,1:50})[c.foreignTier]||30;
      if(performance<reqPerf-5 && !state.seniorInternational) return false;

      return c.strength<=state.overall+(perfGreat?10:perfGood?7:5);
    });

    const abroadWindow=firstForeignWindow(performance,current);
    const foreignPriority=
      current.tier>=6 &&
      (
        state.seniorInternational ||
        (state.age<=21 && state.overall>=66 && media>=35) ||
        (state.overall>=70 && media>=45)
      );

    let foreignGatePassed=false;
    const tryForeignGate=()=>{
      if(foreignGatePassed || !foreignPool.length || state.age<18 || apps<6) return false;
      foreignGatePassed=true;
      if(rand(1,100)>abroadWindow) return false;
      return tryFromBestForeignTier(foreignPool,'normal');
    };

    // 18-letni reprezentant / duży talent z ESA: zagranica jest sprawdzana PRZED
    // zapełnieniem trzech miejsc ofertami krajowymi.
    if(foreignPriority){
      tryForeignGate();

      // Bardzo mocny i medialny zawodnik może dostać więcej niż jeden telefon z zagranicy.
      if(result.length<2 && foreignPool.length && state.overall>=72 && media>=50)
        tryFromBestForeignTier(foreignPool,'normal');
    }

    // Projekt młodego w Polsce.
    if(state.age<=22 && talentLevel>=70 && result.length<3){
      let scoutChance=5+(talentLevel-70)*.45;
      if(performance>=34) scoutChance+=(performance-34)*.25;
      if(apps<8) scoutChance-=4;
      if(lowStreak>=2) scoutChance-=5;
      scoutChance=clamp(Math.round(scoutChance),3,28);

      if(rand(1,100)<=scoutChance){
        const projectPool=polish.filter(c=>
          c.tier>=Math.min(6,current.tier+1) &&
          c.tier<=6 &&
          c.strength>=state.overall+7 &&
          c.strength<=state.overall+24
        );
        for(const c of shuffle(projectPool)){
          if(rand(1,100)<=interestChance(c,'project')){
            add({...c,talentProject:true});
            break;
          }
        }
      }
    }

    const ambitious=attainable.filter(c=>
      c.tier>current.tier ||
      (c.tier===current.tier && c.strength>current.strength+2)
    );
    const lateral=attainable.filter(c=>c.tier===current.tier);

    // Regionalność pozostaje silna nisko, ale tylko w sensownej sportowo puli.
    const localAttainable=attainable.filter(c=>{
      const cls=polishLocalityClass(c,current);
      return cls==='current' || cls==='neighbor' || cls==='home';
    });

    if(current.tier<=3 && result.length<3){
      tryFrom(localAttainable,'normal');
    } else if(current.tier===4 && result.length<3 && rand(1,100)<=60){
      tryFrom(localAttainable,'normal');
    }

    if(result.length<3) tryFrom(ambitious,'ambitious');
    if(result.length<3) tryFrom(lateral,'normal');

    // Zwykły zawodnik dostaje szansę zagraniczną po polskich naturalnych ofertach.
    // Priorytetowy profil dostał tę szansę już wcześniej.
    if(!foreignPriority && result.length<3) tryForeignGate();

    // Jeśli bramka zagraniczna przeszła, a zawodnik jest naprawdę mocny,
    // dopuszczamy drugą sensowną ofertę z zagranicy.
    if(foreignGatePassed && result.length<3 && state.overall>=74 && media>=55)
      tryFromBestForeignTier(foreignPool,'normal');

    // Bezpieczne zejście jest awaryjne i tylko dla zawodnika, który ma problem z grą.
    if(struggling && result.length<3){
      const safe=polish.filter(c=>
        c.tier>=Math.max(1,current.tier-1) &&
        c.tier<=current.tier &&
        c.strength<=state.overall+4
      );
      while(result.length<3 && tryFrom(safe,'safe')){}
    }

    // Fallback NIE może już wrzucić gwiazdy ESA do II/III ligi.
    if(result.length<3){
      const fallback=shuffle(polish.filter(c=>
        !recentlyOffered(c) &&
        c.tier>=minPolishTier &&
        c.tier<=Math.max(current.tier,naturalMax) &&
        c.strength<=state.overall+Math.max(6,strengthWindow)
      ));
      for(const c of fallback){
        add(c);
        if(result.length>=3) break;
      }
    }

    // Ostatnia siatka bezpieczeństwa: trzy oferty mają być elementem
    // rytmu gry. W razie potrzeby pozwalamy klubowi powtórzyć ofertę.
    if(result.length<3){
      forceFill(polish.filter(c=>
        c.tier>=minPolishTier &&
        c.tier<=Math.max(current.tier,naturalMax) &&
        c.strength<=state.overall+Math.max(8,strengthWindow+2)
      ),3);
    }

    return result.slice(0,3);
  }

  function offerReason(c,performance){
    const current=state.club;
    if(c.veteranRoute==='homecoming') return 'Jesień kariery • powrót do Ekstraklasy';
    if(c.veteranRoute==='polishReturn') return 'Weteran • oferta powrotu do Polski';
    if(c.veteranRoute==='exotic') return 'Jesień kariery • egzotyczny kontrakt';
    if(c.talentProject) return 'Klub stawia na twój talent';
    if(isForeignClub(c)){
      if(c.foreignTier>=5) return `${foreignTierName(c.foreignTier)} • lokalny rynek: ${clubTransferRegion(c)}`;
      if(isForeignClub(current) && c.country===current.country) return `${foreignTierName(c.foreignTier)} • znajomy rynek`;
      if(isForeignClub(current) && clubTransferRegion(c)===clubTransferRegion(current)) return `${foreignTierName(c.foreignTier)} • region ${clubTransferRegion(c)}`;
      if(isForeignClub(current) && c.zone===current.zone) return `${foreignTierName(c.foreignTier)} • ten sam kontynent`;
      return `${foreignTierName(c.foreignTier)} • medialność ${Math.round(state.recognition||0)}/100`;
    }
    const locality=polishLocalityClass(c,current);
    if(c.tier>current.tier) return locality==='current'?'Krok wyżej • lokalny rynek':'Krok wyżej';
    if(c.tier===current.tier && c.strength>current.strength+2) return locality==='current'?'Mocniejszy klub z regionu':'Mocniejszy klub';
    if(locality==='current') return 'Lokalny rynek';
    if(locality==='neighbor') return 'Sąsiednie województwo';
    if(locality==='home') return 'Powrót w rodzinne strony';
    if(c.tier<current.tier) return 'Większa szansa na regularną grę';
    return 'Zmiana otoczenia';
  }

  function veteranPolishReturnOffer(current){
    if(!isForeignClub(current) || state.age<35) return null;
    const polish=seniorClubs().filter(c=>c.name!==current.name);
    if(!polish.length) return null;

    // Poziom wybiera bieżący OVR, nie metryka. Weteran 85 OVR powinien
    // wracać do czołówki Ekstraklasy, a zawodnik po mocnym regresie do ligi,
    // która rzeczywiście odpowiada jego obecnym możliwościom.
    let candidates=polish.filter(c=>
      c.strength<=state.overall+7 &&
      c.strength>=state.overall-12
    );
    if(!candidates.length) candidates=polish;
    const bestGap=Math.min(...candidates.map(c=>Math.abs(c.strength-state.overall)));
    const close=candidates.filter(c=>Math.abs(c.strength-state.overall)<=bestGap+3);
    const home=close.filter(c=>c.region===state.region);
    const pool=home.length && rand(1,100)<=35 ? home : close;
    const chosen=pick(pool.length?pool:close);
    return chosen?{...chosen,veteranRoute:'polishReturn'}:null;
  }

  function applySpecialMarketOffers(baseOffers,performance){
    const current=state.club;
    const target=state.extraMarketOffer?4:3;
    let offers=(baseOffers||[]).slice();
    const veteranReturn=veteranPolishReturnOffer(current);

    // Od 35. roku życia zawodnik grający za granicą ma w każdym normalnym
    // oknie jedną sportowo adekwatną drogę powrotu do Polski.
    if(veteranReturn){
      offers=[veteranReturn,...offers.filter(c=>c.name!==veteranReturn.name)];
    }

    // Za granicą zwykły generator kończy się wcześniej niż polska gałąź
    // marketBonus. Jeżeli agent obiecał skok, dokładamy tu ambitniejszy klub
    // i dopiero potem czyścimy jednorazowy bonus.
    if((state.agentMarketJump||0)>0){
      const ambitious=[...seniorClubs(),...GAME_DATA.foreignClubs].filter(c=>
        c.name!==current.name &&
        clubMarketLevel(c)>clubMarketLevel(current) &&
        c.strength<=state.overall+15 &&
        (!isForeignClub(c) || c.foreignTier<=4)
      ).sort((a,b)=>
        clubMarketLevel(a)-clubMarketLevel(b) ||
        Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall)
      );
      if(ambitious.length){
        const c=pick(ambitious.slice(0,Math.min(20,ambitious.length)));
        offers=[{...c},...offers.filter(x=>x.name!==c.name)];
      }
      state.agentMarketJump=0;
      state.marketBonus=0;
    }

    // Testy zagraniczne gwarantują dokładnie dwa zagraniczne kierunki przy
    // najbliższej realnej okazji. Wybieramy kluby możliwie bliskie poziomowi
    // zawodnika, ale nie przepuszczamy ich ponownie przez bramkę medialności.
    const guaranteed=Math.max(0,state.guaranteedForeignOffers||0);
    if(guaranteed){
      let foreign=GAME_DATA.foreignClubs.filter(c=>
        c.name!==current.name && c.foreignTier<=4 && c.strength<=state.overall+12
      );
      // Sama gwarancja jest ważniejsza od zwykłego okna siły: bardzo młody
      // zawodnik po testach ma dostać dwie zagraniczne propozycje nawet wtedy,
      // gdy obie będą dla niego wyraźnie ryzykowne.
      if(foreign.length<guaranteed){
        foreign=GAME_DATA.foreignClubs.filter(c=>c.name!==current.name && c.foreignTier<=4);
      }
      foreign.sort((a,b)=>
        Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall) ||
        a.foreignTier-b.foreignTier
      );
      const picked=[];
      for(const c of shuffle(foreign.slice(0,Math.min(40,foreign.length)))){
        if(!picked.some(x=>x.name===c.name)) picked.push({...c});
        if(picked.length>=guaranteed) break;
      }
      offers=[...picked,...offers.filter(c=>!picked.some(x=>x.name===c.name))];
      state.guaranteedForeignOffers=0;
    }

    // Agent Miekarski dodaje jeden stały slot. Gdy zwykły generator zwrócił
    // tylko trzy kluby, dokładamy sportowo zbliżony kierunek bez duplikatu.
    if(state.extraMarketOffer && offers.length<target){
      const used=new Set(offers.map(c=>c.name));
      const pool=[...seniorClubs(),...GAME_DATA.foreignClubs].filter(c=>
        c.name!==current.name &&
        !used.has(c.name) &&
        c.strength<=state.overall+12 &&
        (!isForeignClub(c) || c.foreignTier<=4)
      ).sort((a,b)=>
        Math.abs(clubMarketLevel(a)-clubMarketLevel(current))-
        Math.abs(clubMarketLevel(b)-clubMarketLevel(current)) ||
        Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall)
      );
      while(offers.length<target && pool.length){
        const sample=pool.splice(0,Math.min(20,pool.length));
        const c=pick(sample);
        if(c) offers.push({...c});
      }
    }

    let finalOffers=offers.slice(0,target);

    // Jednorazowe efekty agentów mogą dołożyć oferty przed zwykłym rynkiem.
    // Nawet wtedy obowiązkowa propozycja powrotu nie może wypaść poza ekran.
    if(veteranReturn && !finalOffers.some(c=>c.name===veteranReturn.name)){
      finalOffers=[veteranReturn,...finalOffers.filter(c=>c.name!==veteranReturn.name)].slice(0,target);
    }

    // Na całym widocznym ekranie (obecny klub + oferty) nie mogą pojawić się
    // cztery kluby z tego samego zagranicznego tieru. Poprzednia wersja
    // sprawdzała wyłącznie cztery nowe oferty, więc nie łapała układu:
    // obecny klub T2 + trzy nowe kluby T2.
    const visibleTierCounts=new Map();
    if(isForeignClub(current)) visibleTierCounts.set(current.foreignTier,1);
    const usedNames=new Set(finalOffers.map(c=>c.name));
    const tierHasRoom=c=>!isForeignClub(c) ||
      (c.foreignTier<=4 && (visibleTierCounts.get(c.foreignTier)||0)<3);
    const findTierAlternative=forbiddenTier=>{
      const eligible=c=>
        c.name!==current.name &&
        !usedNames.has(c.name) &&
        tierHasRoom(c) &&
        (!isForeignClub(c) || c.foreignTier!==forbiddenTier);
      const sportAlternatives=[...GAME_DATA.foreignClubs,...seniorClubs()]
        .filter(c=>eligible(c) && c.strength<=state.overall+12)
        .sort((a,b)=>
          (isForeignClub(a)?0:1)-(isForeignClub(b)?0:1) ||
          Math.abs((a.foreignTier||forbiddenTier)-forbiddenTier)-Math.abs((b.foreignTier||forbiddenTier)-forbiddenTier) ||
          Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall)
        );
      if(sportAlternatives.length) return sportAlternatives[0];
      return [...GAME_DATA.foreignClubs,...seniorClubs()]
        .filter(eligible)
        .sort((a,b)=>Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall))[0]||null;
    };
    for(let i=0;i<finalOffers.length;i++){
      let offer=finalOffers[i];
      if(!isForeignClub(offer)) continue;
      const visibleCount=visibleTierCounts.get(offer.foreignTier)||0;
      if(visibleCount>=3){
        const replacement=findTierAlternative(offer.foreignTier);
        if(replacement){
          usedNames.delete(offer.name);
          finalOffers[i]={...replacement};
          usedNames.add(replacement.name);
          offer=finalOffers[i];
        }
      }
      if(isForeignClub(offer)){
        visibleTierCounts.set(offer.foreignTier,(visibleTierCounts.get(offer.foreignTier)||0)+1);
      }
    }

    return finalOffers;
  }

  function clubRenewalRisk(club){
    const apps=Math.max(0,state.season?.apps||0);
    const minutes=Math.max(0,state.season?.minutes||0);

    // Tylko trzy rodzaje klubów są bezpieczną przystanią na zawsze:
    // polskie ligi regionalne oraz zagraniczny T6 w Azji i Oceanii.
    // Ekstraklasa ani żaden inny polski lub zagraniczny szczebel nie ma ochrony.
    const permanentSafeHarbour=
      (!isForeignClub(club) && club.tier===1) ||
      (isForeignClub(club) && club.foreignTier===6 && (club.zone==='Azja'||club.zone==='Oceania'));
    if(permanentSafeHarbour){
      return {chance:0,apps,minutes,regionalGuarantee:true};
    }

    // Dopiero naprawdę marginalny udział uruchamia decyzję klubu. Nie ma
    // osobnej kary za wiek — dobry weteran grający regularnie jest bezpieczny.
    let base=0;
    if(minutes<180 || apps<=2) base=80;
    else if(minutes<450 || apps<=4) base=60;
    else if(minutes<720 || apps<=6) base=40;
    else if(minutes<900 || apps<=8) base=20;
    if(!base) return {chance:0,apps,minutes,regionalGuarantee:false};

    const streakBonus=Math.min(30,Math.max(0,(state.lowAppsStreak||0)-1)*10);
    const qualityGap=(club.strength||0)-state.overall;
    const qualityBonus=qualityGap>=15?10:qualityGap>=8?5:0;
    const loyaltyProtection=Math.min(10,Math.round((state.loyalty||0)*.7));
    const chance=clamp(base+streakBonus+qualityBonus-loyaltyProtection,5,95);
    return {chance,apps,minutes,base,streakBonus,qualityBonus,loyaltyProtection,regionalGuarantee:false};
  }

  function rollClubRenewal(club){
    const risk=clubRenewalRisk(club);
    if(!risk.chance) return {...risk,roll:null,refused:false};
    const roll=rand(1,100);
    return {...risk,roll,refused:roll<=risk.chance};
  }

  function presentClubChoice(performance){
    if(shouldRetire()){
      log('Twardy koniec kariery.',`Osiągasz wylosowany limit: ${state.hardRetirementAge} lat • ostatni klub: ${state.club.name}`);
      retire();
      return;
    }
    if(state.skipMarketOnce){
      state.skipMarketOnce=false;
      goToLifeThenYear();
      return;
    }
    if(state.legendRankingPending && !state.legendRankingShown){
      showLegendRanking(()=>presentClubChoice(performance));
      return;
    }

    const current={...state.club};
    const delayedNoRenew=
      state.noRenewClubName===current.name &&
      Number.isFinite(state.noRenewAfterAge) &&
      state.age>=state.noRenewAfterAge;
    const scriptedNoRenew=state.forceNoRenewClubName===current.name || delayedNoRenew;
    const renewal=scriptedNoRenew
      ? {chance:0,roll:null,refused:false,apps:state.season?.apps||0,minutes:state.season?.minutes||0}
      : rollClubRenewal(current);
    const forcedNoRenew=scriptedNoRenew || renewal.refused;
    // Wiek nie stanowi osobnej bramki kontraktowej. Jeżeli zawodnik nadal
    // gra wystarczająco dużo, rynek traktuje go tak samo jak młodszego.
    const normallyCanRenew=true;
    const requestedMarketBlock=!!state.blockMarketOnce || (state.marketLockSeasons||0)>0;
    const marketBlocked=requestedMarketBlock && normallyCanRenew && !forcedNoRenew;

    let offers=marketBlocked?[]:applySpecialMarketOffers(annualMarketOffers(performance),performance);
    // Zwolnienie nie może zablokować kariery pustym ekranem. Jeżeli normalny
    // rynek nie znalazł niczego, zawsze pozostaje klub regionalny.
    if(forcedNoRenew && !offers.length){
      const regional=(GAME_DATA.regions[state.region]||[])
        .filter(c=>!c.reserve&&c.tier===1&&c.name!==current.name);
      const fallback=regional.length?pick(regional):seniorClubs().find(c=>c.tier===1&&c.name!==current.name);
      if(fallback) offers=[{...fallback}];
    }
    if(state.blockMarketOnce) state.blockMarketOnce=false;
    if((state.marketLockSeasons||0)>0) state.marketLockSeasons--;
    state.offerHistory=state.offerHistory||{};
    offers.forEach(c=>{ state.offerHistory[c.name]=state.seasonYear; });

    const canRenew=normallyCanRenew && !forcedNoRenew;
    if(renewal.roll!==null){
      log(
        renewal.refused?'Klub nie przedłuża kontraktu.':'Klub daje ci jeszcze jeden kontrakt.',
        `${current.name} • ${renewal.apps} meczów / ${renewal.minutes} minut • ryzyko odmowy ${renewal.chance}% • rzut ${renewal.roll}/100${renewal.refused?' • koniec umowy':' • zostajesz w planach'}`
      );
    }
    if(state.forceNoRenewClubName===current.name) state.forceNoRenewClubName=null;
    if(delayedNoRenew){ state.noRenewClubName=null; state.noRenewAfterAge=null; }
    const veteranNote=veteranCareerText();
    const renewalNote=renewal.refused
      ? `Po sezonie z bilansem ${renewal.apps} meczów i ${renewal.minutes} minut klub rezygnuje z przedłużenia umowy (szansa ${renewal.chance}%, rzut ${renewal.roll}/100).`
      : '';

    const heading=marketBlocked
      ?'W tym oknie nie dostajesz żadnej oferty.'
      :state.justRelegated
      ?'Po spadku musisz zdecydować, co dalej.'
      :state.justPromoted
        ?'Po awansie czas wybrać klub na następny sezon.'
        :!canRenew
          ?`${current.name} nie proponuje ci nowego kontraktu.`
          :'Gdzie grasz w przyszłym sezonie?';

    const stayChance=projectedStartChance(current,(state.boost||0)+1);
    const lowerRegionalMarket=!isForeignClub(current) && current.tier<=3;
    const choices=[];

    if(canRenew){
      choices.push({
        label:lowerRegionalMarket
          ? `PRZEDŁUŻAM KONTRAKT — ${current.name} (${clubCompetition(current)})`
          : `ZOSTAJĘ — ${current.name} (${clubCompetition(current)})`,
        ovrProfile:null,
        preview:`Prognoza gry po pozostaniu: ok. ${stayChance}%${state.boost?` • aktywny bonus do hierarchii: ${state.boost>0?'+':''}${state.boost} p.p.`:''} • pozostanie w klubie: lojalność +1–2 • obecna lojalność ${state.loyalty} pomaga w zaufaniu sztabu i środowisku • ${clubEnvironmentPreview(current)}`,
        act:()=>{
          const loyaltyGain=rand(1,2);
          state.loyalty=clamp((state.loyalty||0)+loyaltyGain,0,15);
          state.boost+=1;
          log(lowerRegionalMarket?`Przedłużasz kontrakt z ${current.name}.`:`Zostajesz w ${current.name}.`, `${clubCompetition(current)} • kolejny sezon w tym samym klubie • lojalność +${loyaltyGain}`);
        }
      });
    }

    const retirementAvailable=state.age>=39;

    // "Koniec kariery" jest dodatkową decyzją i nigdy nie zabiera miejsca
    // normalnej ofercie. Od 39 lat rynek pokazuje więc pozostanie + pełne
    // trzy transfery + koniec kariery (albo cztery transfery przy dodatkowym
    // slocie agenta). Powrót do Polski i egzotyka nie mogą wyciąć naturalnego,
    // konsekwentnego kroku po klasycznej ścieżce kariery.
    const normalTransferSlots=state.extraMarketOffer?4:3;
    const transferSlots=normalTransferSlots;

    offers.slice(0,transferSlots).forEach(c=>{
      const chance=projectedStartChance(c,0);
      const risk=chance>=65?'dobra szansa na regularną grę':chance>=40?'realna walka o skład':'duże ryzyko ławki';
      choices.push({
        label:`${c.name} — ${clubOfferCompetition(c)} • ${offerReason(c,performance)}`,
        ovrProfile:null,
        preview:`Bazowa prognoza gry: ok. ${chance}% • ${risk} • ${clubEnvironmentPreview(c)} • faktyczne środowisko zostanie wylosowane dopiero w sezonie`,
        act:()=>moveClub(c)
      });
    });

    if(retirementAvailable){
      choices.push({
        label:'KONIEC KARIERY',
        endCareer:true,
        ovrProfile:null,
        preview:`To jedna z opcji rynku, nie osobne pytanie. Kończysz w wieku ${state.age} lat • OVR ${state.overall} • ${state.totals.apps} meczów`,
        act:()=>{
          log('Kończysz karierę.',`${state.age} lat • ostatni klub: ${current.name}`);
          retire();
        }
      });
    }

    const d={
      title:heading,
      text:`Twój sezon się skończył. ${marketBlocked?`Agent nie przyniósł żadnej oferty; pozostaje ${current.name}.`:canRenew?`${current.name} chce, żebyś został.`:`Kontrakt z ${current.name} dobiega końca i klub idzie w inną stronę.`}${renewalNote?` ${renewalNote}`:''} ${offers.length?'Rynek daje ci inne możliwości.':''}${veteranNote?` ${veteranNote}`:''}`,
      choices
    };
    presentDecision(d,goToLifeThenYear);
  }

  function goToLifeThenYear(){
    if(state.retired) return;
    if(window.CareerLife && typeof window.CareerLife.presentLifePhase==='function'){
      window.CareerLife.presentLifePhase(advanceYear);
      return;
    }
    advanceYear();
  }

  function moveClub(c){
    const oldClub={...state.club}; const old=oldClub.name;
    state.club={...c}; if(state.clubHistory[state.clubHistory.length-1]!==c.name){state.clubHistory.push(c.name);state.clubsPlayed++;} state.status='Nowy zawodnik';
    // Bonus hierarchii/szansy na grę dotyczy konkretnego sztabu i nie przechodzi z transferem.
    state.boost=0;
    state.loyalty=0;
    if(state.relations){
      state.relations.coach=Math.round((state.relations.coach||55)*0.35+40);
      state.relations.squad=Math.round((state.relations.squad||50)*0.4+35);
    }
    if(state.forceNoRenewClubName===old) state.forceNoRenewClubName=null;
    if(state.noRenewClubName===old){state.noRenewClubName=null;state.noRenewAfterAge=null;}
    if(state.captainEventBonusClub===old) state.captainEventBonusClub=null;
    if(state.corruptionPlan && !state.corruptionPlan.caught && state.corruptionPlan.clubName!==c.name) state.corruptionPlan=null;
    if(isForeignClub(c) && !isForeignClub(oldClub)) state.foreignMoveAge=state.age;
    state.highestTier=Math.max(state.highestTier,c.tier); if(isForeignClub(c)) state.bestForeignTier=state.bestForeignTier?Math.min(state.bestForeignTier,c.foreignTier):c.foreignTier; state.justRelegated=false; state.justPromoted=false;
    log(`TRANSFER: ${old} → ${c.name}`, `${clubCompetition(c)} • ${state.age} lat`);
  }
  function loanMove(){
    const parent={...state.club};
    const parentLoyalty=state.loyalty;
    const candidates=seniorClubs().filter(c=>c.tier===Math.max(1,parent.tier-1)&&c.name!==parent.name);
    const c=candidates.length?pick(candidates):null;
    if(!c){state.boost+=5;log('Nie udaje się znaleźć wypożyczenia.','Zostajesz i walczysz o minuty.');return;}
    state.loanReturn={...parent,_loyalty:parentLoyalty}; state.club={...c}; state.loyalty=0; if(state.clubHistory[state.clubHistory.length-1]!==c.name){state.clubHistory.push(c.name);state.clubsPlayed++;} state.status='Wypożyczony'; state.boost+=8;
    log(`WYPOŻYCZENIE: ${parent.name} → ${c.name}`, `${tierName(c.tier)} • po minuty`);
  }
  function returnFromLoan(){
    const loanClub=state.club.name; const _ret={...state.loanReturn}; state.loanReturn=null; const _loy=_ret._loyalty||0; delete _ret._loyalty; state.club=_ret; state.loyalty=clamp(_loy,0,15); state.status='Powrót z wypożyczenia';
    if(state.clubHistory[state.clubHistory.length-1]!==state.club.name) state.clubHistory.push(state.club.name);
    log(`Koniec wypożyczenia: wracasz do ${state.club.name}.`, `Sezon w ${loanClub} za tobą.`);
  }
  function regionalReturn(){
    const all=(GAME_DATA.regions[state.region]||[]).filter(c=>!c.reserve&&c.tier<=6&&c.name!==state.club.name);
    let candidates=all.filter(c=>c.strength<=state.overall+10);
    if(!candidates.length) candidates=all.filter(c=>c.tier===1).sort((a,b)=>Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall));
    candidates=candidates.sort((a,b)=>b.tier-a.tier||Math.abs(a.strength-state.overall)-Math.abs(b.strength-state.overall));
    const shortlist=candidates.slice(0,Math.min(3,candidates.length)); if(!shortlist.length){state.loyalty=clamp((state.loyalty||0)+2,0,15);log('Zostajesz w obecnym klubie.','Nie ma sensownej oferty z rodzinnego regionu.');return;} const c=pick(shortlist); moveClub(c); state.loyalty=clamp((state.loyalty||0)+3,0,15);
  }
  function pickRegionalClubName(){ return pick(GAME_DATA.regions[state.region].filter(c=>!c.reserve)).name; }
  function findHigherPolishClub(){
    const eligible=seniorClubs().filter(c=>c.name!==state.club.name && c.tier>state.club.tier && c.tier<=6 && c.strength<=state.overall+13);
    const nextStep=eligible.filter(c=>c.tier===state.club.tier+1);
    const pool=nextStep.length?nextStep:eligible;
    return pool.length?pick(pool):null;
  }
  function findSameTierUpgrade(){
    const pool=seniorClubs().filter(c=>c.name!==state.club.name && c.tier===state.club.tier && c.strength>=state.club.strength+4 && c.strength<=state.overall+11);
    return pool.length?pick(pool):null;
  }
  function findTransferClub(afterRelegation=false){
    const minTier=afterRelegation?state.club.tier+1:state.club.tier;
    const pool=seniorClubs().filter(c=>c.name!==state.club.name && c.tier>=minTier && c.tier<=6 && c.strength<=state.overall+12);
    return pool.length?pick(pool):null;
  }

  function findLowerClub(){
    const targetTier=Math.max(1,state.club.tier-1);
    let pool=seniorClubs().filter(c=>c.name!==state.club.name && c.tier===targetTier && c.strength<=state.overall+7);

    const currentRegion=state.club?.region||state.region;
    const same=pool.filter(c=>c.region===currentRegion);
    const near=pool.filter(c=>polishRegionsAdjacent(currentRegion,c.region));
    const home=pool.filter(c=>c.region===state.region);

    if(same.length) pool=same;
    else if(near.length) pool=near;
    else if(home.length) pool=home;

    return pool.length?pick(pool):null;
  }
  function findPlayableClub(){
    const current=Math.min(6,state.club.tier);
    let pool=seniorClubs().filter(c=>c.name!==state.club.name && c.tier>=Math.max(3,current-1) && c.tier<=current && c.strength<=state.overall+4);
    pool=pool.sort((a,b)=>b.tier-a.tier||b.strength-a.strength);
    return pool.length?pick(pool.slice(0,Math.min(8,pool.length))):null;
  }

  function advanceYear(){
    state.age++; state.seasonYear++; if((state.corruptionShadow||0)>0) state.corruptionShadow--; state.season={apps:0,goals:0,assists:0,minutes:0};

    let legendActivation='';
    if(!state.legendUnlocked && (state.legend99Streak||0)>=2 && state.overall===99){
      const bonus=rand(1,5);
      state.legendUnlocked=true;
      state.legendEraActive=true;
      state.legendStartBonus=bonus;
      state.overall=99+bonus;
      state.legendPeakOverall=state.overall;
      ensureLegendReferenceSet();
      state.peakOverall=Math.max(state.peakOverall,state.overall);
      state.legend99Streak=0;
      log('TRYB LEGENDY FUTBOLU',`Dwa kolejne sezony na 99 OVR • rzut +${bonus} • OVR ${state.overall}`);
      legendActivation=`<div class="event-kicker">TRYB LEGENDY FUTBOLU</div><h3>Przebijasz sufit: 99 → ${state.overall} OVR.</h3><p>Dwa kolejne sezony zakończyłeś na 99 OVR. Przed trzecim sezonem specjalny rzut daje ci <strong>+${bonus} OVR</strong>. Od tej chwili zwykły limit 99 nie obowiązuje podczas twojego historycznego prime'u.</p>`;
    }

    const veteranNote=veteranCareerText();
    els.eventBox.innerHTML=legendActivation || `<div class="event-kicker">NOWY SEZON • PROGRESJA ${isEasy()?'ŁATWA':'NORMALNA'}</div><h3>${state.age} lat.</h3><p>${state.club.name} • ${clubCompetition(state.club)}. ${state.status}. OVR ${state.overall}. Kariera trwa.${veteranNote?` ${veteranNote}`:''}</p>`;
    render();
  }
  function shouldRetire(){
    return Number.isFinite(state?.hardRetirementAge) && state.age>=state.hardRetirementAge;
  }
  function log(title,meta){ state.timeline.push({age:state.age,title,meta}); }

  function longestClubRun(seasons){
    let best=null,current=null;
    seasons.forEach(season=>{
      if(current && current.club===season.club) current.length++;
      else current={club:season.club,length:1};
      if(!best || current.length>best.length) best={...current};
    });
    return best;
  }

  function clubLegendHtml(){
    const rows=clubLegendStatus();
    if(!rows.length) return '';
    return `<section class="career-curiosities">
      <h3>STATUS W KLUBACH</h3>
      <div class="career-curiosity-list">${rows.map(row=>{
        const top=row.tiers[row.tiers.length-1];
        const best=row.bestSeason;
        return `<div><span>${row.club}</span><strong>${top.label}</strong><small>${row.points} pkt • ${row.seasons} sezonów • ŚWIETNE+: ${row.greatSeasons} • WYBITNE+: ${row.outstandingSeasons} • HISTORYCZNE: ${row.historicSeasons}<br>najlepszy: ${best.grade} (${best.year}/${String(best.year+1).slice(2)}) • najwyższy OVR w klubie: ${row.peakOvr}<br>${row.tiers.map(t=>t.label).join(' → ')}</small></div>`;
      }).join('')}</div>
    </section>`;
  }

  function careerCuriositiesHtml(){
    const allSeasons=state.careerSeasons||[];
    const seasons=allSeasons.filter(s=>s.club && s.club!=='Bez klubu');
    if(!seasons.length) return '';
    const best=seasons.slice().sort((a,b)=>(b.gradeIndex??-1)-(a.gradeIndex??-1)||(b.minuteShare||0)-(a.minuteShare||0))[0];
    const highestPlace=seasons.filter(s=>Number.isFinite(s.leaguePlace)).sort((a,b)=>a.leaguePlace-b.leaguePlace||(b.tier||0)-(a.tier||0))[0];
    const counts={}; seasons.forEach(s=>{counts[s.club]=(counts[s.club]||0)+1;});
    const mostClub=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    const longest=longestClubRun(seasons);
    const rises=seasons.map(s=>({season:s,delta:(s.ovrAfter||0)-(s.ovrBefore||0)}));
    const rise=rises.slice().sort((a,b)=>b.delta-a.delta)[0];
    const fall=rises.slice().sort((a,b)=>a.delta-b.delta)[0];
    const lost=allSeasons.filter(s=>s.club==='Bez klubu' || (s.minuteShare||0)<.05).length;
    const clubs=new Set(seasons.map(s=>s.club)).size;
    const countries=new Set(seasons.map(s=>s.country||'Polska')).size;
    const leagues=new Set(seasons.map(s=>s.competition)).size;
    const relegations=seasons.filter(s=>s.clubSeasonResult?.relegated).length;
    const firstCall=(state.timeline||[]).find(x=>/PIERWSZE POWOŁANIE DO REPREZENTACJI POLSKI/i.test(x.title));
    const fmt=s=>`${s.year}/${String(s.year+1).slice(2)} • ${s.club}`;
    const items=[
      ['Najwyższy osiągnięty OVR',String(state.peakOverall)],
      ['Najlepszy sezon',`${best.grade} • ${fmt(best)}`],
      ['Najwyższe miejsce klubu',highestPlace?`${highestPlace.leaguePlace}. miejsce • ${fmt(highestPlace)}`:'—'],
      ['Najwięcej sezonów',`${mostClub[0]} • ${mostClub[1]}`],
      ['Najdłuższy nieprzerwany pobyt',`${longest.club} • ${longest.length} sezonów`],
      ['Największy wzrost OVR',rise.delta>0?`+${rise.delta} • ${fmt(rise.season)}`:'brak'],
      ['Największy spadek OVR',fall.delta<0?`${fall.delta} • ${fmt(fall.season)}`:'brak'],
      ['Praktycznie stracone sezony',String(lost)],
      ['Kluby / ligi / kraje',`${clubs} / ${leagues} / ${countries}`],
      ['Awanse / spadki',`${state.promotions} / ${relegations}`]
    ];
    if(Number.isFinite(state.foreignMoveAge)) items.push(['Pierwszy wyjazd za granicę',`${state.foreignMoveAge} lat`]);
    if(firstCall) items.push(['Debiut w seniorskiej reprezentacji',`${firstCall.age} lat`]);
    return `<section class="career-curiosities">
      <h3>CIEKAWOSTKI KARIERY</h3>
      <div class="career-curiosity-list">${items.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    </section>`;
  }

  function escapeProfileHtml(value){
    return String(value??'').replace(/[&<>'"]/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[ch]);
  }

  function profileSeasonLabel(year){
    return `${year}/${String(year+1).slice(2)}`;
  }

  function profile89List(items,empty='brak'){
    return items.length
      ? `<ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>`
      : `<p class="profile89-empty">${empty}</p>`;
  }

  function profile89TournamentRows(){
    const rows=[];
    const add=(history,label)=>{
      Object.entries(history||{}).forEach(([year,result])=>{
        const status=result.qualified
          ? (result.result||result.pending?'zakwalifikowany — turniej do rozegrania':'udział')
          : 'brak awansu';
        rows.push({
          year:Number(year),label,
          status:result.qualified && result.result ? result.result : status,
          goals:result.myGoals||0,assists:result.myAssists||0,
          matches:(result.polandMatches||[]).map(match=>`${match.gf}:${match.ga} ${match.opponent}`).join(' • ')
        });
      });
    };
    add(state.worldCupHistory,'Mundial');
    add(state.euroHistory,'EURO');
    return rows.sort((a,b)=>a.year-b.year);
  }

  function profile89Html(){
    const seasons=state.careerSeasons||[];
    const awards=(state.awardHistory||[]).slice().sort((a,b)=>a.year-b.year);
    const clubTrophies=(state.trophyHistory||[]).filter(t=>t.clubCredit!==false).sort((a,b)=>a.year-b.year);
    const nationalTrophies=(state.trophyHistory||[]).filter(t=>t.clubCredit===false).sort((a,b)=>a.year-b.year);
    const tournaments=profile89TournamentRows();
    const position={DEF:'obrońca',MID:'pomocnik',FWD:'napastnik'}[state.position]||state.position;
    const birthYear=state.seasonYear-state.age;
    const clubs=new Set(seasons.filter(s=>s.club && !s.club.startsWith('Bez klubu')).map(s=>s.club)).size;

    const seasonRows=seasons.map(s=>{
      const place=Number.isFinite(s.leaguePlace)?`${s.leaguePlace}. / ${s.leagueTeams||'—'}`:'—';
      const league=s.competition||tierName(s.tier||0);
      return `<tr>
        <td>${escapeProfileHtml(profileSeasonLabel(s.year))}</td>
        <td>${escapeProfileHtml(s.club||'—')}</td>
        <td>${escapeProfileHtml(league||'—')}</td>
        <td>${escapeProfileHtml(place)}</td>
        <td>${s.apps||0}</td><td>${s.goals||0}</td><td>${s.assists||0}</td>
        <td>${escapeProfileHtml(s.grade||'—')}</td>
        <td>${s.ovrBefore??'—'} → ${s.ovrAfter??'—'}</td>
      </tr>`;
    }).join('');

    const awardItems=awards.map(a=>
      `<strong>${escapeProfileHtml(a.name)}</strong> — ${escapeProfileHtml(profileSeasonLabel(a.year))}${a.club?` • ${escapeProfileHtml(a.club)}`:''}`
    );
    const trophyItems=clubTrophies.map(t=>
      `<strong>${escapeProfileHtml(t.name)}</strong> — ${escapeProfileHtml(profileSeasonLabel(t.year))}${t.club?` • ${escapeProfileHtml(t.club)}`:''}`
    );
    const nationalItems=nationalTrophies.map(t=>
      `<strong>${escapeProfileHtml(t.name)}</strong> — ${escapeProfileHtml(profileSeasonLabel(t.year))}`
    );

    const tournamentTable=tournaments.length?`<div class="profile89-table-wrap"><table class="profile89-table compact">
      <thead><tr><th>Turniej</th><th>Rok</th><th>Wynik Polski</th><th>Mecze Polski</th><th>G</th><th>A</th></tr></thead>
      <tbody>${tournaments.map(t=>`<tr><td>${escapeProfileHtml(t.label)}</td><td>${t.year}</td><td>${escapeProfileHtml(t.status)}</td><td>${escapeProfileHtml(t.matches||'—')}</td><td>${t.goals}</td><td>${t.assists}</td></tr>`).join('')}</tbody>
    </table></div>`:'<p class="profile89-empty">Brak udziału w turniejach reprezentacyjnych.</p>';

    return `<article class="profile89-card">
      <header class="profile89-header">
        <div class="profile89-brand"><strong>89</strong><span>minut.pl</span></div>
        <div><div class="profile89-kicker">PROFIL ZAWODNIKA</div><h2>${escapeProfileHtml(state.name)}</h2></div>
      </header>

      <div class="profile89-facts">
        <div><span>Rok urodzenia</span><strong>${birthYear}</strong></div>
        <div><span>Pozycja</span><strong>${escapeProfileHtml(position)}</strong></div>
        <div><span>Lepsza noga</span><strong>${escapeProfileHtml(state.foot)}</strong></div>
        <div><span>Województwo</span><strong>${escapeProfileHtml(state.region)}</strong></div>
        <div><span>Maksymalny OVR</span><strong>${state.peakOverall}</strong></div>
        <div><span>Kluby</span><strong>${clubs}</strong></div>
        <div><span>Mecze / gole / asysty</span><strong>${state.totals.apps} / ${state.totals.goals} / ${state.totals.assists}</strong></div>
        <div><span>Polska</span><strong>${state.nationalCaps} M / ${state.nationalGoals} G</strong></div>
      </div>

      <section class="profile89-section">
        <h3>Kariera klubowa — sezon po sezonie</h3>
        <div class="profile89-table-wrap"><table class="profile89-table">
          <thead><tr><th>Sezon</th><th>Klub</th><th>Liga</th><th>Miejsce</th><th>M</th><th>G</th><th>A</th><th>Ocena</th><th>OVR</th></tr></thead>
          <tbody>${seasonRows||'<tr><td colspan="9">Brak rozegranych sezonów.</td></tr>'}</tbody>
          <tfoot><tr><th colspan="4">Razem</th><th>${state.totals.apps}</th><th>${state.totals.goals}</th><th>${state.totals.assists}</th><th colspan="2">max OVR ${state.peakOverall}</th></tr></tfoot>
        </table></div>
      </section>

      <div class="profile89-columns">
        <section class="profile89-section"><h3>Osiągnięcia indywidualne</h3>${profile89List(awardItems)}</section>
        <section class="profile89-section"><h3>Trofea klubowe</h3>${profile89List(trophyItems)}</section>
      </div>

      <section class="profile89-section">
        <h3>Reprezentacja Polski</h3>
        <p><strong>${state.nationalCaps}</strong> meczów • <strong>${state.nationalGoals}</strong> goli • mundiale: <strong>${state.worldCups||0}</strong> • EURO: <strong>${state.euros||0}</strong></p>
        ${tournamentTable}
        ${nationalItems.length?`<h4>Sukcesy z reprezentacją</h4>${profile89List(nationalItems)}`:''}
      </section>
    </article>`;
  }

  function profile89CanvasLines(ctx,value,maxWidth){
    const text=String(value??'—').trim()||'—';
    const words=text.split(/\s+/);
    const lines=[];
    let line='';
    words.forEach(word=>{
      const candidate=line?`${line} ${word}`:word;
      if(line && ctx.measureText(candidate).width>maxWidth){
        lines.push(line);
        line=word;
      } else line=candidate;
    });
    if(line) lines.push(line);
    return lines.length?lines:['—'];
  }

  function profile89SafeFileName(value){
    return String(value||'pilkarz')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'')
      .toLowerCase()||'pilkarz';
  }

  // Zewnętrzny profil do udostępnienia: pełna kariera jest rysowana na
  // płótnie i zapisywana jako zwykły JPG. Nie wymaga sieci ani biblioteki.
  function exportProfile89Jpg(){
    if(!state?.retired) return;

    const W=1600;
    const PAD=64;
    const CONTENT=W-PAD*2;
    const RED='#c9252d';
    const DARK='#211718';
    const MUTED='#6d5758';
    const LINE='#d7b2b4';
    const LIGHT='#f8e9ea';
    const ALT='#fff7f7';
    const seasons=state.careerSeasons||[];
    const awards=(state.awardHistory||[]).slice().sort((a,b)=>a.year-b.year);
    const clubTrophies=(state.trophyHistory||[]).filter(t=>t.clubCredit!==false).sort((a,b)=>a.year-b.year);
    const nationalTrophies=(state.trophyHistory||[]).filter(t=>t.clubCredit===false).sort((a,b)=>a.year-b.year);
    const tournaments=profile89TournamentRows().filter(t=>t.status!=='brak awansu');
    const position={DEF:'obrońca',MID:'pomocnik',FWD:'napastnik'}[state.position]||state.position;
    const birthYear=state.seasonYear-state.age;
    const clubs=new Set(seasons.filter(s=>s.club && !s.club.startsWith('Bez klubu')).map(s=>s.club)).size;

    const measureCanvas=document.createElement('canvas');
    measureCanvas.width=W;
    const measure=measureCanvas.getContext('2d');
    measure.font='22px Arial, sans-serif';

    const listHeight=items=>{
      if(!items.length) return 46;
      return items.reduce((sum,item)=>sum+Math.max(36,profile89CanvasLines(measure,item,CONTENT-54).length*29+8),0);
    };
    const awardLines=awards.map(a=>`${a.name} — ${profileSeasonLabel(a.year)}${a.club?` • ${a.club}`:''}`);
    const trophyLines=clubTrophies.map(t=>`${t.name} — ${profileSeasonLabel(t.year)}${t.club?` • ${t.club}`:''}`);
    const nationalLines=nationalTrophies.map(t=>`${t.name} — ${profileSeasonLabel(t.year)}`);
    const tournamentRows=tournaments.map(t=>({
      title:`${t.label} ${t.year} — ${t.status}`,
      detail:`Mecze Polski: ${t.matches||'brak zapisanych wyników'} • zawodnik: ${t.goals} G / ${t.assists} A`
    }));
    const tournamentHeight=tournamentRows.length
      ? tournamentRows.reduce((sum,row)=>{
          measure.font='22px Arial, sans-serif';
          const title=profile89CanvasLines(measure,row.title,CONTENT-42).length;
          measure.font='19px Arial, sans-serif';
          const detail=profile89CanvasLines(measure,row.detail,CONTENT-42).length;
          return sum+Math.max(76,title*29+detail*25+22);
        },0)
      : 52;

    const headerH=164;
    const factsH=178;
    const sectionHeadH=62;
    const tableHeadH=48;
    const seasonRowH=54;
    const tableFootH=52;
    const representationIntroH=66;
    const footerH=82;
    const totalH=Math.max(1200,
      headerH+factsH+
      sectionHeadH+tableHeadH+Math.max(1,seasons.length)*seasonRowH+tableFootH+
      sectionHeadH+listHeight(awardLines)+
      sectionHeadH+listHeight(trophyLines)+
      sectionHeadH+representationIntroH+tournamentHeight+
      (nationalLines.length?sectionHeadH+listHeight(nationalLines):0)+footerH
    );

    const canvas=document.createElement('canvas');
    canvas.width=W;
    canvas.height=Math.ceil(totalH);
    const ctx=canvas.getContext('2d');
    ctx.textBaseline='middle';
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,W,canvas.height);

    const setFont=(size,weight=400)=>{ctx.font=`${weight} ${size}px Arial, sans-serif`;};
    const line=(x1,y1,x2,y2,color=LINE,width=1)=>{
      ctx.strokeStyle=color; ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    };
    const fitText=(value,maxWidth)=>{
      const original=String(value??'—');
      if(ctx.measureText(original).width<=maxWidth) return original;
      let text=original;
      while(text.length>1 && ctx.measureText(`${text}…`).width>maxWidth) text=text.slice(0,-1);
      return `${text}…`;
    };
    const drawWrapped=(value,x,y,maxWidth,lineHeight,color=DARK)=>{
      const lines=profile89CanvasLines(ctx,value,maxWidth);
      ctx.fillStyle=color;
      lines.forEach((txt,i)=>ctx.fillText(txt,x,y+i*lineHeight));
      return lines.length;
    };
    const sectionTitle=(title,y)=>{
      ctx.fillStyle=LIGHT; ctx.fillRect(0,y,W,sectionHeadH);
      ctx.fillStyle=RED; setFont(24,800); ctx.fillText(title.toUpperCase(),PAD,y+sectionHeadH/2);
      line(PAD,y+sectionHeadH-1,W-PAD,y+sectionHeadH-1,RED,2);
      return y+sectionHeadH;
    };
    const drawList=(items,y)=>{
      if(!items.length){
        ctx.fillStyle=MUTED; setFont(21,400); ctx.fillText('brak',PAD+18,y+23);
        return y+46;
      }
      items.forEach((item,index)=>{
        setFont(22,400);
        const lines=profile89CanvasLines(ctx,item,CONTENT-54);
        const h=Math.max(36,lines.length*29+8);
        if(index%2===1){ctx.fillStyle=ALT;ctx.fillRect(PAD,y,CONTENT,h);}
        ctx.fillStyle=RED; ctx.beginPath(); ctx.arc(PAD+13,y+21,4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=DARK;
        lines.forEach((txt,i)=>ctx.fillText(txt,PAD+31,y+20+i*29));
        y+=h;
      });
      return y;
    };

    let y=0;
    ctx.fillStyle=RED; ctx.fillRect(0,0,W,headerH);
    ctx.fillStyle='#fff'; setFont(66,900); ctx.fillText('89',PAD,78);
    setFont(32,800); ctx.fillText('minut.pl',PAD+94,88);
    setFont(19,800); ctx.fillText('PROFIL ZAWODNIKA • POLSKI PIŁKARZ SIMULATOR',PAD+325,50);
    setFont(46,800); ctx.fillText(fitText(state.name,CONTENT-325),PAD+325,103);
    y=headerH;

    const facts=[
      ['Rok urodzenia',birthYear],['Pozycja',position],['Lepsza noga',state.foot],['Województwo',state.region],
      ['Maksymalny OVR',state.peakOverall],['Kluby',clubs],['M / G / A',`${state.totals.apps} / ${state.totals.goals} / ${state.totals.assists}`],['Polska',`${state.nationalCaps} M / ${state.nationalGoals} G`]
    ];
    const factW=CONTENT/4;
    const factH=factsH/2;
    facts.forEach((fact,i)=>{
      const col=i%4,row=Math.floor(i/4),x=PAD+col*factW,fy=y+row*factH;
      if((row+col)%2===0){ctx.fillStyle=ALT;ctx.fillRect(x,fy,factW,factH);}
      line(x+factW,fy,x+factW,fy+factH,LINE,1); line(x,fy+factH,x+factW,fy+factH,LINE,1);
      ctx.fillStyle=MUTED; setFont(15,800); ctx.fillText(String(fact[0]).toUpperCase(),x+17,fy+26);
      ctx.fillStyle=DARK; setFont(23,700); ctx.fillText(fitText(fact[1],factW-34),x+17,fy+61);
    });
    y+=factsH;

    y=sectionTitle('Kariera klubowa — sezon po sezonie',y);
    const columns=[
      {name:'SEZON / WIEK',w:150},{name:'KLUB',w:335},{name:'LIGA',w:250},{name:'MIEJSCE',w:120},
      {name:'M',w:65},{name:'G',w:65},{name:'A',w:65},{name:'OCENA',w:170},{name:'OVR',w:250}
    ];
    ctx.fillStyle=RED;ctx.fillRect(PAD,y,CONTENT,tableHeadH);
    let x=PAD;
    columns.forEach(col=>{ctx.fillStyle='#fff';setFont(15,800);ctx.fillText(col.name,x+10,y+tableHeadH/2);x+=col.w;});
    y+=tableHeadH;
    if(!seasons.length){
      ctx.fillStyle=DARK;setFont(21,400);ctx.fillText('Brak rozegranych sezonów.',PAD+12,y+seasonRowH/2);y+=seasonRowH;
    } else seasons.forEach((s,rowIndex)=>{
      if(rowIndex%2===1){ctx.fillStyle=ALT;ctx.fillRect(PAD,y,CONTENT,seasonRowH);}
      const place=Number.isFinite(s.leaguePlace)?`${s.leaguePlace}. / ${s.leagueTeams||'—'}`:'—';
      const values=[`${profileSeasonLabel(s.year)} • ${s.age} l.`,s.club||'—',s.competition||tierName(s.tier||0),place,s.apps||0,s.goals||0,s.assists||0,s.grade||'—',`${s.ovrBefore??'—'} → ${s.ovrAfter??'—'}`];
      let cx=PAD;
      values.forEach((value,i)=>{
        ctx.fillStyle=DARK; setFont(i===1?18:17,i===1?700:400);
        ctx.fillText(fitText(value,columns[i].w-20),cx+10,y+seasonRowH/2);
        cx+=columns[i].w;
        if(i<values.length-1) line(cx,y,cx,y+seasonRowH,LINE,1);
      });
      line(PAD,y+seasonRowH,W-PAD,y+seasonRowH,LINE,1);
      y+=seasonRowH;
    });
    ctx.fillStyle='#f1d3d5';ctx.fillRect(PAD,y,CONTENT,tableFootH);
    ctx.fillStyle=RED;setFont(19,800);ctx.fillText(`RAZEM: ${state.totals.apps} MECZÓW • ${state.totals.goals} GOLI • ${state.totals.assists} ASYST • MAX OVR ${state.peakOverall}`,PAD+12,y+tableFootH/2);
    y+=tableFootH;

    y=sectionTitle('Osiągnięcia indywidualne',y);
    y=drawList(awardLines,y);
    y=sectionTitle('Trofea klubowe',y);
    y=drawList(trophyLines,y);
    y=sectionTitle('Reprezentacja Polski',y);
    ctx.fillStyle=DARK;setFont(25,700);ctx.fillText(`${state.nationalCaps} meczów • ${state.nationalGoals} goli • mundiale: ${state.worldCups||0} • EURO: ${state.euros||0}`,PAD+10,y+representationIntroH/2);
    y+=representationIntroH;
    if(!tournamentRows.length){
      ctx.fillStyle=MUTED;setFont(21,400);ctx.fillText('Brak udziału w turniejach reprezentacyjnych.',PAD+18,y+26);y+=52;
    } else tournamentRows.forEach((row,index)=>{
      measure.font='22px Arial, sans-serif';
      ctx.font='700 22px Arial, sans-serif';
      const titleLines=profile89CanvasLines(ctx,row.title,CONTENT-42);
      ctx.font='400 19px Arial, sans-serif';
      const detailLines=profile89CanvasLines(ctx,row.detail,CONTENT-42);
      const h=Math.max(76,titleLines.length*29+detailLines.length*25+22);
      if(index%2===1){ctx.fillStyle=ALT;ctx.fillRect(PAD,y,CONTENT,h);}
      setFont(22,700);ctx.fillStyle=RED;titleLines.forEach((txt,i)=>ctx.fillText(txt,PAD+18,y+20+i*29));
      setFont(19,400);ctx.fillStyle=DARK;const detailY=y+20+titleLines.length*29;detailLines.forEach((txt,i)=>ctx.fillText(txt,PAD+18,detailY+i*25));
      line(PAD,y+h,W-PAD,y+h,LINE,1); y+=h;
    });
    if(nationalLines.length){
      y=sectionTitle('Sukcesy z reprezentacją',y);
      y=drawList(nationalLines,y);
    }

    ctx.fillStyle=LIGHT;ctx.fillRect(0,y,W,footerH);
    ctx.fillStyle=MUTED;setFont(17,700);ctx.fillText(`Wygenerowano w Polski Piłkarz Simulator • wynik kariery: ${state.score} pkt`,PAD,y+footerH/2);

    const fileName=`profil-89minut-${profile89SafeFileName(state.name)}.jpg`;
    const download=blob=>{
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    };
    if(canvas.toBlob){
      canvas.toBlob(blob=>{
        if(blob) download(blob);
        else {
          const a=document.createElement('a');a.href=canvas.toDataURL('image/jpeg',.92);a.download=fileName;document.body.appendChild(a);a.click();a.remove();
        }
      },'image/jpeg',.92);
    } else {
      const a=document.createElement('a');a.href=canvas.toDataURL('image/jpeg',.92);a.download=fileName;document.body.appendChild(a);a.click();a.remove();
    }
  }

  function openProfile89(){
    if(!state?.retired) return;
    els.profile89Content.innerHTML=profile89Html();
    els.retirementSummary.classList.add('hidden');
    els.profile89View.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function closeProfile89(){
    els.profile89View.classList.add('hidden');
    els.retirementSummary.classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function finalCareerVerdict(){
    const caps=state.nationalCaps||0;
    const peak=state.peakOverall||0;
    const trophies=state.trophies?.length||0;
    const awards=state.awards?.length||0;
    const topSeasons=(state.ekstraklasaSeasons||0)+(state.foreignSeasons||0);
    const apps=state.totals?.apps||0;
    const media=state.recognition||0;
    const professionalism=state.professionalism||0;
    const seasons=(state.careerSeasons||[]).filter(s=>s.club&&s.club!=='Bez klubu');
    const clubs=new Set(seasons.map(s=>s.club)).size;
    const longest=longestClubRun(seasons)||{club:'',length:0};
    const clubRows=clubLegendStatus();
    const clubWith=key=>clubRows.find(row=>row.tiers.some(t=>t.key===key));
    const stadiumClub=clubWith('stadium');
    const retiredNumberClub=clubWith('retiredNumber');
    const alltimeClub=clubWith('alltime11');
    const fanClub=clubWith('fan');
    const rememberedClub=clubWith('remembered');

    // Sama wartość 85 OVR nie daje już statusu legendy. To poziom kadrowy,
    // który musi zostać poparty długim dorobkiem, występami i sukcesami.
    const worldIcon=
      state.legendUnlocked && peak>=100 && caps>=70 && topSeasons>=12 && trophies>=5;
    const polishLegend=
      (caps>=75 && peak>=88 && topSeasons>=10 && (trophies>=3 || awards>=5)) ||
      (caps>=55 && peak>=92 && topSeasons>=12 && trophies>=5);
    const generationElite=
      (caps>=50 && peak>=86 && topSeasons>=8) ||
      (peak>=90 && topSeasons>=10 && trophies>=3);

    let primary;
    if(worldIcon) primary='Ikona światowego futbolu.';
    else if(polishLegend) primary='Legenda polskiej piłki.';
    else if(stadiumClub) primary=`Największa legenda w historii klubu ${stadiumClub.club}.`;
    else if(retiredNumberClub) primary=`Legenda jednego klubu — ${retiredNumberClub.club}.`;
    else if(generationElite) primary='Jeden z najlepszych polskich piłkarzy swojego pokolenia.';
    else if(alltimeClub) primary=`Członek jedenastki wszechczasów klubu ${alltimeClub.club}.`;
    else if(caps>=45 && peak>=83) primary='Gwiazda reprezentacji Polski.';
    else if((state.foreignSeasons||0)>=9 && peak>=80) primary='Polski piłkarz z dużą karierą zagraniczną.';
    else if(caps>=20) primary='Uznany reprezentant Polski.';
    else if((state.ekstraklasaSeasons||0)>=8 && (trophies>=2 || awards>=2 || peak>=80)) primary='Ikona Ekstraklasy.';
    else if(fanClub) primary=`Ulubieniec kibiców klubu ${fanClub.club}.`;
    else if(peak>=82 && apps<180 && topSeasons<5) primary='Wielki talent, po którym pozostał niedosyt.';
    else if((state.foreignSeasons||0)>=4) primary='Solidna kariera zagraniczna.';
    else if((state.ekstraklasaSeasons||0)>=5 || (apps>=250 && state.highestTier>=5)) primary='Uznany ligowiec.';
    else if(rememberedClub) primary=`Ważna postać w historii klubu ${rememberedClub.club}.`;
    else if(state.highestTier>=4 && apps>=160) primary='Solidny zawodowiec.';
    else if(apps>=180) primary='Ważna postać niższych lig.';
    else if(apps>=90) primary='Kariera ligowego rzemieślnika.';
    else primary='Krótka kariera, która nie rozwinęła pełnego potencjału.';

    const substantial=caps>=25 || topSeasons>=8 || trophies>=2 || awards>=3 || peak>=87;
    const notes=[];
    if(media>=85 && substantial) notes.push('Medialna ikona swojej epoki.');
    else if(media>=80 && !substantial) notes.push('Rozpoznawalność przerosła sportowy dorobek.');
    else if(media<=20 && substantial) notes.push('Wielka kariera bez wielkiego rozgłosu.');

    if(professionalism>=90) notes.push('Wzór profesjonalizmu.');
    else if(professionalism<=25 && peak>=75) notes.push('Talent wyraźnie większy niż profesjonalizm.');

    if((state.loyalty||0)>=12 && clubs<=3 && longest.length>=8)
      notes.push('Symbol przywiązania do klubowych barw.');
    else if(clubs>=10) notes.push('Piłkarski obieżyświat.');
    else if((state.foreignSeasons||0)>=12) notes.push('Przez lata sprawdzony na zagranicznych boiskach.');

    if(window.CareerLife){
      const path=window.CareerLife.pathTag(state);
      notes.unshift(`Ścieżka: ${path.label}.`);
    }

    return [primary,...notes.slice(0,3)].join(' ');
  }

  function retire(){
    state.retired=true; show(els.retirementView); els.newCareerBtn.classList.add('hidden');
    els.profile89View.classList.add('hidden'); els.retirementSummary.classList.remove('hidden');
    state.score += state.nationalCaps*3 + state.trophies.length*24 + state.awards.length*18 + Math.max(0,state.peakOverall-60)*2;
    const level=finalCareerVerdict();
    state._shareVerdict=level;
    els.retireTitle.textContent=`${state.name} kończy karierę w wieku ${state.age} lat.`; els.retireVerdict.textContent=level;
    els.retireStats.innerHTML=`
      <div><span>Mecze</span><strong>${state.totals.apps}</strong></div><div><span>Gole</span><strong>${state.totals.goals}</strong></div><div><span>Asysty</span><strong>${state.totals.assists}</strong></div><div><span>Kadra</span><strong>${state.nationalCaps}</strong></div><div><span>Mundiale</span><strong>${state.worldCups||0}</strong></div><div><span>EURO</span><strong>${state.euros||0}</strong></div><div><span>Awanse</span><strong>${state.promotions}</strong></div><div><span>Wynik</span><strong>${state.score}</strong></div>`;
    els.retireClubs.innerHTML=`<strong>Kluby:</strong> ${state.clubHistory.join(' → ')}<br><strong>Najwyższy poziom:</strong> ${state.bestForeignTier?foreignTierName(state.bestForeignTier):tierName(state.highestTier)}<br><strong>Trofea:</strong> ${state.trophies.length?state.trophies.join(', '):'brak'}<br><strong>Wyróżnienia:</strong> ${state.awards.length?state.awards.join(', '):'brak'}${state.nationalGoals?`<br><strong>Gole dla Polski:</strong> ${state.nationalGoals}`:''}${careerCuriositiesHtml()}${clubLegendHtml()}${state.legendUnlocked?legendRankingHtml():''}`;

    els.retireSeasons.innerHTML=(state.careerSeasons||[]).map(x=>`
      <div class="season-review-item">
        <div class="season-review-year">${x.year}/${String(x.year+1).slice(2)}<br>${x.age} LAT</div>
        <div class="season-review-club"><strong>${x.club}</strong><span>${x.competition||tierName(x.tier)}${Number.isFinite(x.leaguePlace)?` • ${x.leaguePlace}. miejsce`:''}</span><br><span class="season-grade">${x.grade}</span>${Number.isFinite(x.clubPoints)?` <span class="season-grade">${x.clubPoints} pkt klubu</span>`:''}${x.note?`<br><span>${x.note}</span>`:''}</div>
        <div class="season-review-stats">${x.apps} M • ${x.goals} G • ${x.assists} A<br><span class="season-review-meta">${x.minutes} min • sezon ${x.form}${x.seasonRoll?` (${x.seasonRoll})`:''}${x.nationalCaps?`<br>🇵🇱 Polska: ${x.nationalCaps} M / ${x.nationalGoals||0} G`:''}</span></div>
        <div class="season-review-ovr">OVR ${x.ovrBefore} → ${x.ovrAfter}<br><span class="season-review-meta">środ. ${x.environment}${Number.isFinite(x.environmentGrowth)?` (${x.environmentGrowth>0?'+':''}${x.environmentGrowth} OVR)`:''}</span></div>
      </div>`).join('');
  }

  // ============================================================
  // NSS — podłączenie paczki turniejów reprezentacji do stanu kariery.
  // Jedyne miejsce łączące bibliotekę NSS z 'state'/'els'/'log'/'render'.
  // Wymaga wcześniejszego wczytania 01–03, 06 i 07 (patrz index.html).
  // ============================================================
  const nssPolska = installPolskaKarieraNSS({
    tournamentRoot: '#nssTournamentRoot',
    getState: () => state,
    log: (title, meta) => log(title, meta),
    addTrophy: (name, score) => addTrophy(name, score),
    render: () => render(),
    setCareerVisible: visible => { els.careerView.classList.toggle('hidden', !visible); }
  });


  function resetGame(){ state=null; randomizeSetupScreen(); show(els.setupView); els.newCareerBtn.classList.add('hidden'); els.decisionBox.classList.add('hidden'); els.playSeasonBtn.classList.remove('hidden'); els.profile89View.classList.add('hidden'); els.retirementSummary.classList.remove('hidden'); }
  els.profile89Btn.addEventListener('click',exportProfile89Jpg); els.profile89BackBtn.addEventListener('click',closeProfile89);
  els.shareCardBtn?.addEventListener('click',()=>{
    if(!state||!state.retired) return;
    if(window.CareerLife) window.CareerLife.exportShareCard(state);
  });
  els.patronitePromptClose?.addEventListener('click',closePatronitePrompt);
  els.patronitePromptCloseX?.addEventListener('click',closePatronitePrompt);
  els.patronitePromptLink?.addEventListener('click',closePatronitePrompt);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && els.patronitePrompt && !els.patronitePrompt.classList.contains('hidden')) closePatronitePrompt();
  });
  els.newCareerBtn.addEventListener('click',resetGame); els.restartBtn.addEventListener('click',resetGame);

  // Host dla warstwy Lab (skille / pogoda / tryby meczu)
  window.CareerLabHost = {
    getState: () => state,
    simulateSeason,
    render,
    log,
    show,
    els,
    clamp,
    rand,
    pick
  };
  window.CareerLifeHost = {
    getState: () => state,
    els,
    render,
    log,
    clamp,
    rand,
    pick
  };
})();
