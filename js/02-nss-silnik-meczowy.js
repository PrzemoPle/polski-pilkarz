/*
 * NSS — silnik pojedynczego meczu reprezentacji v2 (Match Lab).
 * Port silnika z "NSS Match Lab v0.6" (autorstwa Leszka) do formy "headless":
 * nie zna DOM-u ani głównego `state`, zwraca zdarzenia, które UI ma wyświetlić.
 *
 * W stosunku do Match Lab v0.6 dodano wyłącznie:
 *  - obsługę dogrywki/karnych dla meczów pucharowych (Match Lab był pojedynczym,
 *    swobodnym meczem bez kontekstu turniejowego),
 *  - opakowanie całości w sesję na mecz (zamiast jednego globalnego `game`),
 *  - zdarzeniowe next()/choose() zamiast bezpośredniego rysowania DOM-u.
 * Cała matematyka (profil 13 cech, budżet zdarzeń, funkcje resolve*, formuły
 * sigmoid/tanh) jest przeniesiona 1:1 z Match Lab.
 *
 * Zależność: brak (moduł samodzielny; 01-nss-dane-reprezentacji.js dalej
 * dostarcza tylko dane reprezentacji/turniejów, nie mecz).
 */
(function (global) {
  'use strict';

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

  // ---- stałe cech i umiejętności (przeniesione z Match Lab) ----------

  const ATTR_GROUPS = [
    {name:'Skills', attrs:[
      ['shooting','Strzały'],['heading','Główki'],['dribbling','Drybling'],
      ['setPiece','Stałe fragmenty'],['tackling','Odbiór'],['passing','Podania']
    ]},
    {name:'Technique', attrs:[
      ['flair','Fantazja'],['control','Przyjęcie'],['bothFeet','Obunożność']
    ]},
    {name:'Fitness', attrs:[
      ['pace','Szybkość'],['strength','Siła']
    ]},
    {name:'Tactical Awareness', attrs:[
      ['positioning','Ustawianie'],['vision','Wizja']
    ]}
  ];
  const ATTR_LABELS = Object.fromEntries(ATTR_GROUPS.flatMap(g=>g.attrs));
  const SKILLS = [
    ['setPiece','Stały fragment','Wykonaj rzut wolny lub róg.'],
    ['shoot','Strzał','Spróbuj uderzyć na bramkę.'],
    ['header','Główka','Zagraj piłkę głową.'],
    ['dribble','Drybling','Spróbuj minąć przeciwników.'],
    ['pass','Podanie','Podaj do kolegi.'],
    ['tackle','Odbiór','Spróbuj odebrać piłkę rywalowi.']
  ];
  const POSITION_DELTAS = {
    FWD:{shooting:10,heading:7,dribbling:5,setPiece:0,tackling:-14,passing:-5,flair:4,control:4,bothFeet:0,pace:5,strength:2,positioning:8,vision:-6},
    MID:{shooting:0,heading:-5,dribbling:4,setPiece:3,tackling:1,passing:9,flair:5,control:7,bothFeet:2,pace:0,strength:-3,positioning:4,vision:10},
    DEF:{shooting:-12,heading:8,dribbling:-5,setPiece:-6,tackling:12,passing:1,flair:-8,control:0,bothFeet:0,pace:2,strength:8,positioning:10,vision:0}
  };

  // ---- generatory losowości (mulberry32, jak w Match Lab) -------------

  function mulberry32(seed){
    let a=seed>>>0;
    return function(){
      a|=0;a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a);
      t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296;
    };
  }
  function hashString(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++){ h^=text.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
  }
  function poisson(rng,lambda){
    if(lambda<=0) return 0;
    const limit=Math.exp(-lambda);
    let k=0,p=1;
    do{k++;p*=rng();}while(p>limit&&k<60);
    return k-1;
  }

  // ---- profil zawodnika (13 cech z jednego OVR) -----------------------

  function normalizeProfile(profile,target){
    const keys=Object.keys(profile);
    for(let pass=0;pass<8;pass++){
      const mean=keys.reduce((sum,key)=>sum+profile[key],0)/keys.length;
      const gap=target-mean;
      if(Math.abs(gap)<.001) break;
      const adjustable=keys.filter(key=>gap>0?profile[key]<98.999:profile[key]>1.001);
      if(!adjustable.length) break;
      const correction=gap*keys.length/adjustable.length;
      adjustable.forEach(key=>profile[key]=clamp(profile[key]+correction,1,99));
    }
    return profile;
  }

  function buildHiddenProfile(ovr,position,playerName,matchSeed){
    const profileSeed=hashString(`${(playerName||'').trim().toLowerCase()}|${position}|nss-profile`);
    const stableRng=mulberry32(profileSeed);
    const formRng=mulberry32((profileSeed^matchSeed^0x9e3779b9)>>>0);
    const deltas=POSITION_DELTAS[position]||POSITION_DELTAS.MID;
    const edgeScale=clamp(Math.min(ovr-1,99-ovr)/20,.28,1);
    const profile={};
    Object.keys(ATTR_LABELS).forEach(key=>{
      const personalVariation=(stableRng()*2-1)*5;
      const matchVariation=(formRng()*2-1)*1.4;
      profile[key]=clamp(ovr+(deltas[key]+personalVariation+matchVariation)*edgeScale,1,99);
    });
    return {profile:normalizeProfile(profile,ovr),profileSeed};
  }

  function teamToNss(rating){
    const thresholds=[12,25,37,49,61,73,83,93,99];
    return thresholds.findIndex(max=>rating<=max)+1;
  }

  function effectiveHomeRating(teamRating,playerOVR,role,subMinute){
    const minutesFactor=role==='bench' ? clamp((90-subMinute)/90,0,1) : 1;
    const playerShare=minutesFactor/11;
    const captainBonus=role==='captain'?.6:0;
    return clamp(teamRating+(playerOVR-teamRating)*playerShare+captainBonus,1,99);
  }

  function normalizePlayer(player){
    return {
      overall:Number.isFinite(player.overall)?player.overall:65,
      position:player.position||'MID',
      status:player.status||'Podstawowy',
      isCaptain:!!player.isCaptain,
      name:player.name||'Zawodnik',
      teammates:Number.isFinite(player.teammates)?clamp(player.teammates,0,100):50,
      nextMinutesFactor:Number.isFinite(player.nextMinutesFactor)?player.nextMinutesFactor:1,
      eventMultiplier:Number.isFinite(player.eventMultiplier)?clamp(player.eventMultiplier,1,2):1
    };
  }
  function determineRole(player){
    if(player.status==='Rezerwowy') return 'bench';
    if(player.isCaptain) return 'captain';
    return 'starter';
  }

  function newStats(){
    return {
      goals:0,assists:0,shots:0,shotsOn:0,
      passes:0,passesOk:0,dribbles:0,dribblesOk:0,
      tackles:0,tacklesOk:0,turnovers:0,rating:6,
      yellowCards:0,redCards:0,
      personalEventsSeen:0
    };
  }

  function createEngine(options={}){
    const topRandom=options.random||Math.random;

    function createMatch(config){
      const player=normalizePlayer(config.player||{});
      const opponent={
        name:config.opponent?.name||'Rywal',
        rating:Number.isFinite(config.opponent?.strength)?config.opponent.strength:75
      };
      const homeName=config.homeName||'Polska';
      const homeRating=Number.isFinite(config.polandStrength)?config.polandStrength:85;
      const knockout=!!config.knockout;

      const matchSeed=Math.floor(topRandom()*4294967296)>>>0;
      const rng=mulberry32(matchSeed);
      const rand=(a,b)=>Math.floor(rng()*(b-a+1))+a;
      const chance=p=>rng()<p;
      const pick=arr=>arr[Math.floor(rng()*arr.length)];

      const role=determineRole(player);
      const subMinute=role==='bench' ? 48+Math.floor(mulberry32((matchSeed+91)>>>0)()*29) : null;
      const homeEffective=effectiveHomeRating(homeRating,player.overall,role,subMinute);
      const homeNss=teamToNss(homeEffective), awayNss=teamToNss(opponent.rating);

      const {profile:base,profileSeed}=buildHiddenProfile(player.overall,player.position,player.name,matchSeed);
      let current={...base};
      const used=Object.fromEntries(Object.keys(base).map(k=>[k,0]));
      const stats=newStats();

      let minute=0, homeGoals=0, awayGoals=0;
      let beatIndex=0, entered=(role!=='bench'), sentOff=false, chain=0, finished=false;
      let pendingContext=null, awaitingChoice=false;

      // ---- budżet zdarzeń i "gwarancja" udziału gracza ----

      function buildMatchBeats(){
        const count=rand(21,28);
        const diff=homeEffective-opponent.rating;
        const homeShare=clamp(.5+Math.tanh(diff/12)*.15,.35,.65);
        const minutes=new Set();
        while(minutes.size<count) minutes.add(rand(3,89));
        return [...minutes].sort((a,b)=>a-b).map(m=>({minute:m,side:chance(homeShare)?'home':'away'}));
      }

      function involvementTarget(){
        const baseTarget={FWD:6,MID:7,DEF:6}[player.position]||6;
        const relationBonus=clamp(Math.round((player.teammates-50)/15),-2,2);
        const relativeOvrBonus=clamp(Math.round((player.overall-homeRating)/10),-2,2);
        const roleBonus=role==='captain'?1:0;
        const raw=baseTarget+relationBonus+relativeOvrBonus+roleBonus;
        const boostedRaw=Math.round(raw*player.eventMultiplier);
        let minutesFactor=1, target;
        if(role==='bench'){
          minutesFactor=clamp((90-subMinute)/90,0,1);
          target=clamp(Math.round(boostedRaw*minutesFactor),1,10);
        } else {
          target=clamp(boostedRaw,4,20);
        }
        return {target,base:baseTarget,relationBonus,relativeOvrBonus,roleBonus,eventMultiplier:player.eventMultiplier,minutesFactor};
      }

      function personalBeatWeight(beat){
        const weights={FWD:{home:1,away:.12},MID:{home:.8,away:.45},DEF:{home:.35,away:1}};
        return (weights[player.position]||weights.MID)[beat.side];
      }

      function assignPersonalBeats(beats){
        const plan=involvementTarget();
        const pool=beats.filter(b=>role!=='bench'||b.minute>=subMinute);
        const picked=[];
        const count=Math.min(plan.target,pool.length);
        while(pool.length&&picked.length<count){
          const total=pool.reduce((sum,b)=>sum+personalBeatWeight(b),0);
          let roll=rng()*total, index=pool.length-1;
          for(let i=0;i<pool.length;i++){ roll-=personalBeatWeight(pool[i]); if(roll<=0){index=i;break;} }
          picked.push(pool.splice(index,1)[0]);
        }
        picked.forEach(b=>b.personal=true);
        return {personalTarget:picked.length,involvementPlan:plan};
      }

      const beats=buildMatchBeats();
      const {personalTarget,involvementPlan}=assignPersonalBeats(beats);

      const roleText=role==='captain'
        ? 'Wyprowadzasz drużynę jako kapitan.'
        : role==='starter'
          ? 'Grasz w wyjściowej jedenastce.'
          : `Zaczynasz na ławce. Planowane wejście około ${subMinute}. minuty.`;

      // ---- pomocnicze --------------------------------------------------

      function score(){ return {poland:homeGoals,opponent:awayGoals}; }

      function useAttributes(keys,cost=.3){
        keys.forEach(key=>{
          const loss=cost*3.2*(.8+rng()*.45);
          current[key]=clamp(current[key]-loss,1,99);
          used[key]+=loss;
        });
      }
      function weakestUsed(weights){
        return Object.keys(weights).sort((a,b)=>(current[a]/Math.max(1,base[a]))-(current[b]/Math.max(1,base[b])))[0];
      }
      function skillChance(weights,difficulty,bonus=0){
        let total=0,weightSum=0;
        Object.entries(weights).forEach(([key,w])=>{ total+=current[key]*w; weightSum+=w; });
        const skill=total/Math.max(.01,weightSum);
        const opp=opponent.rating+difficulty;
        const duel=1/(1+Math.exp(-(skill-opp)/10));
        return clamp(duel+bonus,.05,.95);
      }

      // ---- generowanie kontekstu sytuacji (jak makeContext w Match Lab) --

      function makeContext(beat){
        if(beat.side==='away'){
          return {
            type:'defense',side:'away',distance:rand(12,35),defenders:0,support:false,
            allowed:['tackle'],requiresControl:false,
            text:pick([
              `Napastnik ${opponent.name} prowadzi piłkę w Twoją stronę. Jesteś ostatnim rywalem przed polem karnym.`,
              `Rywal próbuje minąć Cię dryblingiem, około ${rand(18,32)} metrów od bramki.`,
              `${opponent.name} kontruje. Musisz zamknąć drogę zawodnikowi z piłką.`
            ])
          };
        }
        const roll=rand(1,100);
        if(roll<=13){
          const corner=chance(.42);
          const setPieceDistance=corner?8:rand(18,31);
          return {
            type:'setpiece',side:'home',distance:setPieceDistance,defenders:rand(2,4),support:true,
            allowed:['setPiece','shoot','pass'],requiresControl:false,corner,
            text:corner
              ? `Masz wykonać rzut rożny dla Polski.`
              : `Polska ma rzut wolny ${setPieceDistance} metrów od bramki. Podchodzisz do piłki.`
          };
        }
        if(roll<=32){
          const distance=rand(5,24);
          return {
            type:'high',side:'home',distance,defenders:rand(0,2),support:chance(.75),
            allowed:['header','shoot'],requiresControl:false,
            text:pick([
              `Wysoka piłka leci w Twoją stronę. Jesteś ${distance} metrów od bramki.`,
              `Dośrodkowanie spada na Ciebie ${distance} metrów od bramki.`,
              `Piłka odbija się wysoko w polu karnym. Obrońcy ruszają do Ciebie.`
            ])
          };
        }
        const distance=rand(8,42), defenders=rand(0,3), support=chance(.72);
        const allowed=['dribble','pass'];
        if(distance<=32) allowed.push('shoot');
        return {
          type:'ground',side:'home',distance,defenders,support,allowed,requiresControl:true,
          text:pick([
            `Dostajesz piłkę po ziemi. Jesteś ${distance} metrów od bramki. ${defenders?`Pilnuje Cię ${defenders} ${defenders===1?'obrońca':'obrońców'}.`:'Nie pilnuje Cię żaden obrońca.'}`,
            `Przejmujesz piłkę ${distance} metrów od bramki. ${defenders?`Zamyka Cię ${defenders} rywali.`:'Masz przed sobą przestrzeń.'}`,
            `Polska przesuwa się do przodu. Piłka trafia do Ciebie ${distance} metrów od celu.`
          ])
        };
      }

      function automaticControl(context){
        const pressure=context.defenders*4;
        const p=skillChance({control:.65,bothFeet:.15,positioning:.20},pressure,+.20);
        useAttributes(['control','bothFeet'],.16);
        const roll=rng();
        if(roll<p) return {success:true};
        stats.turnovers++;
        stats.rating=clamp(stats.rating-.18,1,10);
        return {success:false,text:pick([
          'Pierwszy kontakt jest zbyt ciężki. Obrońca zabiera Ci piłkę.',
          'Przyjęcie Cię zawodzi i akcja się kończy.',
          'Nie opanowujesz podania. Rywal przejmuje piłkę.'
        ]),flashKey:'control'};
      }

      function resolveBackgroundBeat(beat){
        const attackHome=beat.side==='home';
        const attackRating=attackHome?homeEffective:opponent.rating;
        const defenseRating=attackHome?opponent.rating:homeEffective;
        const goalP=clamp(.11+Math.tanh((attackRating-defenseRating)/12)*.07,.05,.18);
        let text, goal=false;
        if(chance(goalP)){
          goal=true;
          if(attackHome) homeGoals++; else awayGoals++;
          text=`GOL! ${pick([
            `${attackHome?homeName:opponent.name} kończy składną akcję.`,
            `Strzał z pola karnego wpada do siatki.`,
            `${attackHome?homeName:opponent.name} wykorzystuje błąd obrony.`
          ])}`;
        } else {
          text=pick([
            `${attackHome?homeName:opponent.name} rusza do przodu, ale obrona przerywa akcję.`,
            `Strzał ${attackHome?homeName:opponent.name} mija bramkę.`,
            `Bramkarz pewnie łapie piłkę po ataku ${attackHome?homeName:opponent.name}.`,
            `${attackHome?opponent.name:homeName} odzyskuje piłkę w środku pola.`,
            `Ostatnie podanie ${attackHome?homeName:opponent.name} jest niedokładne.`
          ]);
        }
        return {type:'commentary',minute:beat.minute,text,goal,side:attackHome?'my':'opp',score:score()};
      }

      // ---- rozwiązywanie decyzji (resolve*, przeniesione z Match Lab) --

      function resolveSetPiece(ctx,selected,secondary){
        const shoot=selected.has('shoot')&&!ctx.corner;
        if(shoot){
          stats.shots++;
          const power=secondary==='powerShot';
          const weights=power
            ? {setPiece:.36,shooting:.27,strength:.25,bothFeet:.07,control:.05}
            : {setPiece:.48,shooting:.18,control:.14,bothFeet:.12,flair:.08};
          useAttributes(Object.keys(weights),power?.50:.41);
          const avg=Object.entries(weights).reduce((s,[k,w])=>s+current[k]*w,0);
          const setPiecePenalty=Math.max(0,ctx.distance-18)*.7+(power?1.5:-1);
          const goalP=clamp((1/(1+Math.exp(-(avg-opponent.rating-setPiecePenalty)/10)))*(power?.36:.32),.018,power?.36:.33);
          const roll=rng();
          if(roll<goalP) return {end:true,goal:true,rating:+1,text:power
            ?'Uderzasz z całej siły. Piłka przełamuje mur i wpada do siatki — GOL Z RZUTU WOLNEGO!'
            :'Podkręcasz piłkę nad murem. Bramkarz zostaje bez szans — GOL Z RZUTU WOLNEGO!'};
          if(roll<goalP+(power?.25:.40)){ stats.shotsOn++; return {end:true,rating:+.04,text:power
            ?'Mocne uderzenie zmierza w światło bramki, ale bramkarz je odbija.'
            :'Techniczne uderzenie przechodzi nad murem, ale bramkarz dobrze interweniuje.'}; }
          return {end:true,rating:-.12,text:power
            ?'Siłowy strzał ze stałego fragmentu trafia w mur albo mija bramkę.'
            :'Techniczne uderzenie nie schodzi wystarczająco nisko i mija bramkę.',flashKey:power?'strength':'setPiece'};
        }
        stats.passes++;
        const cross=secondary!=='setShort';
        const weights={setPiece:.48,passing:.22,vision:.18,bothFeet:.12};
        const p=skillChance(weights,cross?5:0,cross?.02:.17);
        useAttributes(Object.keys(weights),cross?.35:.23);
        const roll=rng();
        if(roll>p) return {end:true,turnover:true,rating:-.15,text:'Dogranie ze stałego fragmentu jest zbyt słabe. Rywale wybijają piłkę.',flashKey:'setPiece'};
        stats.passesOk++;
        if(cross&&chance(.06+current.setPiece*.0016)) return {end:true,assist:true,rating:+.65,text:'Idealne dośrodkowanie! Kolega wygrywa pojedynek w powietrzu — ASYSTA!'};
        return {end:true,rating:+.12,text:cross?'Dobre dośrodkowanie, ale obrona wybija piłkę.':'Rozgrywasz krótko i drużyna utrzymuje piłkę.'};
      }

      function resolveTackle(ctx,secondary){
        stats.tackles++;
        const aggressive=secondary==='aggressiveTackle';
        const weights={tackling:.48,positioning:.22,strength:.17,pace:.13};
        const p=skillChance(weights,(30-ctx.distance)*.25,aggressive?.17:.03);
        useAttributes(Object.keys(weights),aggressive?.52:.34);
        const roll=rng();
        if(roll<p){
          stats.tacklesOk++;
          const next={
            type:'ground',side:'home',distance:Math.min(52,ctx.distance+22),defenders:rand(0,2),
            support:chance(.65),allowed:['dribble','pass'],requiresControl:false,
            text:'Wygrywasz piłkę. Możesz od razu rozpocząć akcję swojej drużyny.'
          };
          return {continue:true,next,rating:aggressive?+.30:+.27,text:aggressive
            ?'Mocny, skuteczny odbiór. Wchodzisz w piłkę i natychmiast rozpoczynasz kontrę.'
            :'Czysty odbiór. Zatrzymujesz atak rywala i przejmujesz piłkę.'};
        }
        if(aggressive){
          const cardRoll=rng();
          if(cardRoll<.03){
            stats.redCards++;
            sentOff=true;
            return {end:true,opponentChance:.12,rating:-1.15,text:'Wchodzisz za ostro i za późno. Sędzia pokazuje bezpośrednią czerwoną kartkę — wylatujesz z boiska.',flashKey:'tackling'};
          }
          if(cardRoll<.27){
            stats.yellowCards++;
            if(stats.yellowCards>=2){
              stats.redCards++;
              sentOff=true;
              return {end:true,opponentChance:.10,rating:-.90,text:'Kolejny agresywny odbiór kończy się drugą żółtą i czerwoną kartką. Schodzisz z boiska.',flashKey:'tackling'};
            }
            return {end:true,opponentChance:.07,rating:-.34,text:'Agresywny odbiór jest spóźniony. Żółta kartka i rzut wolny dla rywala.',flashKey:'tackling'};
          }
          if(chance(.55)) return {end:true,opponentChance:.07,rating:-.27,text:'Wchodzisz agresywnie, ale nie trafiasz czysto w piłkę. Rzut wolny dla rywala.',flashKey:'tackling'};
          const goalP=clamp(.14+Math.tanh((opponent.rating-homeEffective)/12)*.08,.06,.22);
          return {end:true,opponentChance:goalP,rating:-.30,text:'Agresywny wślizg nie dochodzi celu. Rywal utrzymuje się na nogach i ma otwartą drogę do bramki.',flashKey:'tackling'};
        }
        if(chance(.38)) return {end:true,rating:-.20,text:'Spóźniasz zwykły odbiór. Sędzia dyktuje rzut wolny dla rywala.',flashKey:'tackling'};
        const goalP=clamp(.12+Math.tanh((opponent.rating-homeEffective)/12)*.08,.05,.20);
        return {end:true,opponentChance:goalP,rating:-.24,text:'Rywal mija Cię i kontynuuje akcję w stronę bramki.',flashKey:'tackling'};
      }
      function resolveNoTackle(){
        return {end:true,opponentChance:.22,rating:-.18,text:'Nie podejmujesz próby. Napastnik przechodzi dalej.'};
      }
      function resolveHoldUp(ctx){
        const weights={strength:.45,control:.35,positioning:.20};
        const p=skillChance(weights,ctx.defenders*5,ctx.support?.12:-.03);
        useAttributes(Object.keys(weights),.31);
        const roll=rng();
        if(roll>p){
          stats.turnovers++;
          return {end:true,turnover:false,rating:-.20,text:'Przytrzymujesz piłkę zbyt długo. Obrońca odbiera Ci ją od tyłu.',flashKey:weakestUsed(weights)};
        }
        const next={...ctx,support:true,defenders:Math.max(0,ctx.defenders-1),requiresControl:false};
        next.allowed=['dribble','pass'];
        if(next.distance<=32) next.allowed.push('shoot');
        next.text='Nadchodzi wsparcie. Nadal jesteś przy piłce i możesz wybrać kolejne zagranie.';
        return {continue:true,next,rating:+.10,text:'Skutecznie osłaniasz piłkę przed obrońcą.'};
      }
      function resolvePass(ctx,secondary){
        stats.passes++;
        const through=secondary==='through';
        const weights=through
          ? {passing:.45,vision:.35,control:.10,bothFeet:.10}
          : {passing:.60,control:.20,bothFeet:.10,vision:.10};
        const difficulty=ctx.defenders*4+(through?6:0)+(ctx.support?0:8);
        const p=skillChance(weights,difficulty,through?-.02:+.15);
        useAttributes(Object.keys(weights),through?.34:.24);
        const roll=rng();
        if(roll>p) return {end:true,turnover:true,rating:-.20,flashKey:weakestUsed(weights),text:pick([
          'Podanie jest niedokładne i rywal je przecina.',
          'Zagrywasz prosto pod nogi przeciwnika.',
          through?'Nie dostrzegasz właściwego momentu. Piłka przepada.':'Kolega nie jest w stanie opanować podania.'
        ])};
        stats.passesOk++;
        const assistP=through
          ? clamp(.045+(38-ctx.distance)*.0075+current.vision*.0015,0,.36)
          : clamp(.018+(25-ctx.distance)*.004,0,.10);
        if(ctx.distance<34&&chance(assistP)) return {end:true,assist:true,rating:+.65,text:pick([
          'Świetne podanie otwiera drogę do bramki. Kolega trafia — ASYSTA!',
          'Zagrywasz w idealnym momencie. Napastnik kończy akcję golem — ASYSTA!'
        ])};
        return {end:true,rating:+.12,text:through
          ? 'Podanie przecina linię obrony. Kolega przejmuje piłkę, lecz akcja nie kończy się golem.'
          : 'Pewne podanie do kolegi. Drużyna utrzymuje posiadanie.'};
      }
      function resolveDribble(ctx,secondary){
        stats.dribbles++;
        const paceMove=secondary==='pace';
        const fancy=['cruyff','zidane','nutmeg','step'].includes(secondary);
        const weights=paceMove
          ? {pace:.45,dribbling:.30,control:.15,strength:.10}
          : {dribbling:.38,flair:.32,control:.20,bothFeet:.10};
        const difficulty=ctx.defenders*6+(fancy?4:0);
        const p=skillChance(weights,difficulty,paceMove?.02:(fancy?-.05:.03));
        useAttributes(Object.keys(weights),fancy?.46:.36);
        const roll=rng();
        if(roll>p) return {end:true,turnover:true,rating:-.24,flashKey:weakestUsed(weights),text:paceMove
          ? 'Brakuje Ci szybkości. Obrońca dotrzymuje kroku i zabiera piłkę.'
          : 'Zwód nie wychodzi. Bierzesz na siebie jednego rywala za dużo i tracisz piłkę.'};
        stats.dribblesOk++;
        const beaten=fancy&&chance(.32)?2:1;
        const next={...ctx,distance:Math.max(5,ctx.distance-rand(5,10)),defenders:Math.max(0,ctx.defenders-beaten),requiresControl:false};
        next.allowed=['dribble','pass'];
        if(next.distance<=30) next.allowed.push('shoot');
        next.text=`Po udanym dryblingu masz ${next.distance} metrów do bramki i ${next.defenders} ${next.defenders===1?'obrońcę':'obrońców'} przed sobą.`;
        return {continue:true,next,rating:+.22,text:beaten===2?'Znakomity zwód! Mijasz dwóch rywali.':'Mijasz obrońcę i nadal prowadzisz piłkę.'};
      }
      function resolveShot(ctx,volley,secondary){
        stats.shots++;
        const power=secondary==='powerShot';
        const weights=power
          ? (volley
            ? {shooting:.38,strength:.30,control:.14,positioning:.10,bothFeet:.08}
            : {shooting:.42,strength:.32,positioning:.12,control:.08,bothFeet:.06})
          : (volley
            ? {shooting:.32,control:.28,flair:.16,bothFeet:.14,positioning:.10}
            : {shooting:.36,control:.24,positioning:.18,bothFeet:.14,flair:.08});
        useAttributes(Object.keys(weights),power?.50:.41);
        const avg=Object.entries(weights).reduce((s,[k,w])=>s+current[k]*w,0);
        const shotPenalty=Math.max(0,ctx.distance-10)*.85+ctx.defenders*4.5+(volley?5:0)+(power?1.5:-1);
        let goalP=(1/(1+Math.exp(-(avg-opponent.rating-shotPenalty)/10)))*(power?.56:.48);
        goalP=clamp(goalP,.02,.54);
        const onTargetP=clamp(.55+(current.shooting-opponent.rating)*.006-Math.max(0,ctx.distance-12)*.008-ctx.defenders*.025-(volley?.05:0)+(power?-.08:.10),.16,.88);
        const roll=rng(), onTarget=roll<onTargetP;
        if(roll<goalP){
          const spectacular=volley||(current.flair>=22&&chance(.28));
          return {end:true,goal:true,rating:+1,text:power
            ?'Uderzasz z całej siły. Bramkarz nie zdąża zareagować — GOL!'
            :(spectacular?'Fantastyczne techniczne uderzenie! Piłka wpada w górny róg — GOL!':'Mierzysz precyzyjnie obok bramkarza — GOL!')};
        }
        if(onTarget){ stats.shotsOn++; return {end:true,rating:+.05,text:power
          ?'Mocny strzał jest celny, ale bramkarz odbija piłkę.'
          :'Techniczny strzał jest celny, ale bramkarz sięga piłki.'}; }
        return {end:true,rating:-.12,flashKey:power?'strength':'shooting',text:power
          ?'Siłowe uderzenie jest niecelne.'
          :(ctx.distance>28?'Próbujesz technicznie z dystansu, lecz piłka mija bramkę.':'Techniczne uderzenie mija bramkę.')};
      }
      function resolveHeaderShot(ctx){
        stats.shots++;
        const weights={heading:.48,positioning:.22,strength:.20,control:.10};
        useAttributes(Object.keys(weights),.42);
        const avg=Object.entries(weights).reduce((s,[k,w])=>s+current[k]*w,0);
        const headerPenalty=Math.max(0,ctx.distance-7)*1.05+ctx.defenders*5;
        const goalP=clamp((1/(1+Math.exp(-(avg-opponent.rating-headerPenalty)/10)))*.50,.02,.52);
        const onTargetP=clamp(.52+(current.heading-opponent.rating)*.006-Math.max(0,ctx.distance-8)*.009-ctx.defenders*.025,.16,.82);
        const roll=rng();
        if(roll<goalP) return {end:true,goal:true,rating:+1,text:'Wyskakujesz najwyżej. Mocna główka wpada do siatki — GOL!'};
        if(roll<onTargetP){ stats.shotsOn++; return {end:true,rating:+.04,text:'Dobra główka, ale bramkarz broni.'}; }
        return {end:true,rating:-.14,flashKey:'heading',text:'Źle składasz się do główki i piłka przelatuje obok bramki.'};
      }
      function resolveHeaderPass(ctx,secondary){
        stats.passes++;
        const long=secondary==='longHeader';
        const weights={heading:.55,positioning:.15,vision:.15,strength:.15};
        const p=skillChance(weights,ctx.defenders*1.6+(long?3:0),long?.01:.14);
        useAttributes(Object.keys(weights),long?.34:.25);
        const roll=rng();
        if(roll>p) return {end:true,turnover:true,rating:-.16,flashKey:'heading',text:'Główkujesz niedokładnie. Piłka trafia do przeciwnika.'};
        stats.passesOk++;
        if(ctx.distance<18&&chance(.075+current.vision*.0013)) return {end:true,assist:true,rating:+.65,text:'Zgrywasz piłkę głową wprost do kolegi. Strzał i gol — ASYSTA!'};
        return {end:true,rating:+.13,text:'Dobre zgranie głową. Kolega utrzymuje piłkę.'};
      }

      function resolveSelection(ctx,selected,secondary){
        if(ctx.side==='away') return selected.has('tackle')?resolveTackle(ctx,secondary):resolveNoTackle();
        if(selected.has('setPiece')) return resolveSetPiece(ctx,selected,secondary);
        if(selected.has('header')) return selected.has('shoot')?resolveHeaderShot(ctx):resolveHeaderPass(ctx,secondary);
        if(selected.has('shoot')) return resolveShot(ctx,ctx.type==='high',secondary);
        if(selected.has('dribble')) return resolveDribble(ctx,secondary);
        if(selected.has('pass')) return resolvePass(ctx,secondary);
        return resolveHoldUp(ctx);
      }

      function applyActionResult(result){
        if(result.goal){ homeGoals++; stats.goals++; stats.shotsOn++; }
        if(result.assist){ homeGoals++; stats.assists++; }
        if(result.turnover) stats.turnovers++;
        let text=result.text;
        if(result.opponentChance&&chance(result.opponentChance)){
          awayGoals++;
          text+=' Akcja kończy się golem dla rywala.';
        }
        stats.rating=clamp(stats.rating+(result.rating||0),1,10);
        return text;
      }

      // ---- toggle/sekcje pomocnicze do budowy UI (przeniesione z renderSkillButtons/renderSecondaryActions) --

      function toggleSkill(selectedArr,key){
        const selected=new Set(selectedArr);
        const ctx=pendingContext;
        if(!ctx) return [...selected];
        if(key==='setPiece'){
          if(ctx.type==='setpiece') selected.add(key);
          else { if(selected.has(key)) selected.delete(key); else selected.add(key); }
        } else if(key==='shoot'&&ctx.type==='high'){
          if(selected.has('shoot')) selected.delete('shoot'); else selected.add('shoot');
        } else if(key==='shoot'&&ctx.type==='setpiece'){
          selected.delete('pass'); selected.add('setPiece');
        } else if(key==='pass'&&ctx.type==='setpiece'){
          selected.delete('shoot'); selected.add('setPiece');
        } else if(key==='shoot'&&ctx.type==='ground'){
          selected.clear(); selected.add('shoot');
        } else if(key==='header'){
          if(selected.has('header')) selected.delete('header');
          else { if(ctx.type!=='high') selected.clear(); selected.add('header'); }
        } else {
          selected.clear(); selected.add(key);
        }
        return [...selected];
      }

      function getSecondaryOptions(selectedArr){
        const selected=new Set(selectedArr);
        const ctx=pendingContext;
        if(!ctx) return [];
        if(selected.has('pass')&&ctx.type!=='setpiece') return [['simple','Proste podanie'],['through','Prostopadłe podanie']];
        if(selected.has('header')&&!selected.has('shoot')) return [['shortHeader','Krótka główka'],['longHeader','Długa główka']];
        if(selected.has('dribble')) return [
          ['pace','Użyj szybkości'],['body','Body swerve'],['side','Side step'],
          ['cruyff','Cruyff turn'],['zidane','Zidane spin'],['nutmeg','Nutmeg'],['step','Step over']
        ];
        if(selected.has('tackle')) return [
          ['normalTackle','Zwykły odbiór'],['aggressiveTackle','Agresywny odbiór']
        ];
        if(selected.has('shoot')&&!selected.has('header')) return [
          ['technicalShot','Strzał techniczny'],['powerShot','Strzał siłowy']
        ];
        if(ctx.type==='setpiece'&&selected.has('pass')) return [['setShort','Krótko'],['setCross','Dośrodkowanie']];
        return [];
      }

      function getTip(selectedArr,secondary){
        const s=new Set(selectedArr);
        const ctx=pendingContext;
        if(!ctx) return '';
        if(!s.size) return ctx.side==='home' ? 'Spróbujesz osłonić piłkę do czasu nadejścia wsparcia.' : 'Nie podejmiesz próby odbioru.';
        if(s.has('setPiece')&&s.has('shoot')) return secondary==='powerShot'
          ?'Mocne uderzenie ze stałego fragmentu: liczą się głównie stałe fragmenty, strzał i siła. Większa moc, mniejsza celność.'
          :'Techniczne uderzenie ze stałego fragmentu: liczą się głównie stałe fragmenty, strzał, kontrola i obie nogi. Większa celność.';
        if(s.has('setPiece')&&s.has('pass')) return 'Dograsz piłkę ze stałego fragmentu.';
        if(s.has('setPiece')) return 'Wykonasz stały fragment podaniem.';
        if(s.has('header')&&s.has('shoot')) return 'Jeśli dojdziesz do piłki, uderzysz głową na bramkę.';
        if(s.has('header')) return 'Jeśli dojdziesz do piłki, zgrasz ją głową do kolegi.';
        if(s.has('shoot')&&ctx.type==='high') return secondary==='powerShot'
          ?'Siłowy wolej: większe znaczenie mają strzał i siła; łatwiej o mocne wykończenie, trudniej trafić w bramkę.'
          :'Techniczny wolej: większe znaczenie mają kontrola, strzał, finezja i obie nogi; łatwiej trafić w bramkę.';
        if(s.has('shoot')) return secondary==='powerShot'
          ?'Strzał siłowy: większe znaczenie mają siła i strzał. Ma większą moc, ale jest mniej celny.'
          :'Strzał techniczny: większe znaczenie mają kontrola, strzał, ustawianie i obie nogi. Jest celniejszy.';
        if(s.has('dribble')) return secondary==='pace' ? 'Spróbujesz minąć rywali szybkością.' : 'Spróbujesz technicznego zwodu.';
        if(s.has('pass')) return secondary==='through' ? 'Trudniejsze podanie w wolną przestrzeń.' : 'Bezpieczniejsze, krótkie podanie.';
        if(s.has('tackle')) return secondary==='aggressiveTackle'
          ?'Agresywny odbiór jest skuteczniejszy, ale zwiększa ryzyko żółtej i czerwonej kartki.'
          :'Zwykły odbiór jest bezpieczniejszy, ale mniej skuteczny niż agresywny.';
        return 'Wybierz akcję.';
      }

      // ---- dogrywka / karne (dodane na potrzeby turnieju pucharowego) --

      function finishKnockoutIfNeeded(){
        let extra=false,penalties=false; const notes=[];
        if(knockout&&homeGoals===awayGoals){
          extra=true;
          const diff=(homeEffective-opponent.rating)/22;
          const etGf=poisson(rng,Math.max(.08,.32+diff*.22));
          const etGa=poisson(rng,Math.max(.08,.32-diff*.22));
          homeGoals+=etGf; awayGoals+=etGa;
          notes.push(etGf||etGa?`Dogrywka: ${etGf}:${etGa}.`:'Dogrywka bez goli.');
        }
        if(knockout&&homeGoals===awayGoals){
          penalties=true;
          const ch=clamp(.5+(homeEffective-opponent.rating)/260,.36,.64);
          if(rng()<ch) homeGoals++; else awayGoals++;
          notes.push(`Rzuty karne: ${homeName} ${homeGoals>awayGoals?'wygrywa':'przegrywa'} serię.`);
        }
        return {extra,penalties,notes};
      }

      function finishMatch(){
        const {extra,penalties,notes}=finishKnockoutIfNeeded();
        finished=true;
        return {
          type:'finished',
          result:{gf:homeGoals,ga:awayGoals,extra,penalties,myGoals:stats.goals,myAssists:stats.assists,playerPatch:{}},
          notes,
          score:score()
        };
      }

      // ---- API sesji -----------------------------------------------------

      return {
        meta:{
          role,roleText,subMinute,knockout,
          home:{name:homeName,rating:homeRating,effectiveRating:homeEffective,nssClass:homeNss},
          away:{name:opponent.name,rating:opponent.rating,nssClass:awayNss},
          totalBeats:beats.length,
          personalTarget,involvementPlan
        },
        next(){
          if(finished) return {type:'finished',result:{gf:homeGoals,ga:awayGoals,myGoals:stats.goals,myAssists:stats.assists,playerPatch:{}},notes:[],score:score()};
          if(awaitingChoice) throw new Error('Najpierw wybierz decyzję przez choose(...).');

          if(pendingContext){
            awaitingChoice=true;
            return {type:'decision',minute,text:pendingContext.text,context:pendingContext,score:score()};
          }
          if(beatIndex>=beats.length) return finishMatch();

          const beat=beats[beatIndex];
          if(role==='bench'&&!entered&&beat.minute>=subMinute){
            entered=true;
            return {type:'substitution',minute:subMinute,text:`${subMinute}' Wchodzisz na boisko. Trener każe od razu wejść w rytm meczu.`,score:score()};
          }
          beatIndex++;
          minute=beat.minute;

          const involved=entered&&!sentOff&&beat.personal===true;
          if(involved){
            stats.personalEventsSeen++;
            const context=makeContext(beat);
            if(context.requiresControl){
              const controlResult=automaticControl(context);
              if(!controlResult.success){
                return {type:'commentary',minute,text:controlResult.text,goal:false,side:'my',score:score(),flashKey:controlResult.flashKey};
              }
            }
            pendingContext=context;
            awaitingChoice=true;
            return {type:'decision',minute,text:context.text,context,score:score()};
          }
          return resolveBackgroundBeat(beat);
        },
        choose(selectedArr,secondary){
          if(!pendingContext||!awaitingChoice) throw new Error('Brak aktywnej decyzji.');
          const ctx=pendingContext;
          const selected=new Set(selectedArr||[]);
          const result=resolveSelection(ctx,selected,secondary);
          const text=applyActionResult(result);
          const minuteForEvent=minute;
          awaitingChoice=false;

          let chained=false;
          if(result.continue&&chain<2){
            chain++; pendingContext=result.next; chained=true;
          } else {
            chain=0; pendingContext=null;
          }
          return {
            type:'choice-result',minute:minuteForEvent,
            effect:{kind:result.goal?'goal':result.assist?'assist':result.turnover?'turnover':'flavor',text},
            flashKey:result.flashKey||null,
            chained,
            score:score()
          };
        },
        timeoutChoice(){
          if(!pendingContext||!awaitingChoice) throw new Error('Brak aktywnej decyzji.');
          stats.turnovers++;
          stats.rating=clamp(stats.rating-.28,1,10);
          chain=0; pendingContext=null; awaitingChoice=false;
          return {type:'choice-result',minute,effect:{kind:'turnover',text:'Wahasz się zbyt długo. Rywal odbiera Ci piłkę.'},flashKey:null,chained:false,score:score()};
        },
        toggleSkill,
        getSecondaryOptions,
        getTip,
        getStatus(){
          const baseTotal=Object.values(base).reduce((a,b)=>a+b,0)||1;
          const currentTotal=Object.values(current).reduce((a,b)=>a+b,0);
          const conditionPct=clamp(currentTotal/baseTotal*100,0,100);
          return {stats:{...stats},base:{...base},current:{...current},conditionPct,personalTarget,personalEventsSeen:stats.personalEventsSeen};
        },
        snapshot(){
          return {minute,homeGoals,awayGoals,beatIndex,totalBeats:beats.length,finished,awaitingChoice};
        }
      };
    }

    return {createMatch};
  }

  global.NSSMatchEngine=Object.freeze({
    version:'0.81-shot-choice',
    createEngine,
    SKILLS,
    ATTR_GROUPS,
    ATTR_LABELS
  });
})(typeof window !== 'undefined' ? window : globalThis);
