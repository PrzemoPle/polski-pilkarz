/*
 * Polska Kariera v1.03 — baza zdarzeń/decyzji sezonowych.
 * Eksportuje window.CAREER_EVENT_DEFS. Zero zależności od reszty gry —
 * funkcje 'make' są wywoływane dopiero przez silnik, z gotowym kontekstem 'h'.
 */
/*
  POLSKA KARIERA — baza zdarzeń v0.4
  Zdarzenia są krótkie i sytuacyjne: warunek -> 2 wybory -> jeden czytelny skutek.
  Teksty są autorskie; struktura jest inspirowana prostotą symulatorów kariery typu Copero.
*/
(() => {
  const event = (id, weight, cooldown, maxUses, when, make) => ({id, weight, cooldown, maxUses, when, make});

  window.CAREER_EVENT_DEFS = [
    event('young_minutes', 15, 99, 1,
      h => h.s.age <= 23 && h.s.status === 'Rezerwowy',
      h => ({
        title:'Potrzebujesz minut.',
        text:'Trener mówi wprost: w przyszłym sezonie możesz znowu zaczynać na ławce.',
        choices:[
          {label:'Zostaję i walczę', act:()=>{h.s.boost+=5; h.s.professionalism=h.clamp(h.s.professionalism+3,0,100); h.log('Zostajesz walczyć o skład.','Ryzykujesz kolejną ławkę, ale trener widzi twoją determinację.');}},
          {label:'Buntuję drużynę przeciwko trenerowi', ovrProfile:null,
           preview:'50% → szansa na grę +50 p.p. • 50% → 0 meczów w następnym sezonie i brak nowej umowy po nim',
           act:()=>{
             const r=h.rand(1,100);
             if(r<=50){
               h.s.boost=(h.s.boost||0)+50;
               h.log('Szatnia staje przeciwko trenerowi.',`Rzut ${r}/100 • trener traci kontrolę • szansa na grę +50 p.p.`);
             } else {
               h.s.nextAppsFactor=0;
               h.s.nextAppsReason='Straciłeś sezon w konflikcie z trenerem — nie zagrałeś ani jednego meczu.';
               h.s.noRenewAfterAge=h.s.age+1;
               h.s.noRenewClubName=h.s.club.name;
               h.log('Bunt obraca się przeciwko tobie.',`Rzut ${r}/100 • następny sezon: 0 meczów • ${h.s.club.name} nie przedłuży potem umowy.`);
             }
           }}
        ]
      })),

    event('first_team_invite', 10, 99, 1,
      h => h.s.age <= 23 && h.s.club.tier <= 5 && h.performance > 30,
      h => ({
        title:'Starszyzna drużyny zaprasza cię na noc pokera.',
        text:'Wiesz, że wszyscy w radzie zespołu palą, a jeden dodatkowo pije. Dla młodego zawodnika to pierwszy prawdziwy test wejścia do szatni seniorów.',
        choices:[
          {label:'Idę', ovrProfile:null,
           preview:'Lojalność +5 • 50% → OVR -1 • 50% → bez straty OVR',
           act:()=>{const r=h.rand(1,100);h.s.loyalty=h.clamp((h.s.loyalty||0)+5,0,15);if(r<=50)h.s.overall=Math.max(20,h.s.overall-1);h.log('Idziesz na poker ze starszyzną.',`Lojalność +5 • rzut ${r}/100${r<=50?' • OVR -1':' • OVR bez zmian'}.`);}},
          {label:'Nie idę', ovrProfile:null,
           preview:'Lojalność -3 • profesjonalizm +10',
           act:()=>{h.s.loyalty=h.clamp((h.s.loyalty||0)-3,0,15);h.s.professionalism=h.clamp(h.s.professionalism+10,0,100);h.log('Odmawiasz starszyźnie.','Lojalność -3 • profesjonalizm +10.');}}
        ]
      })),

    event('early_contract', 8, 99, 1,
      h => h.s.age <= 23 && h.performance > 28,
      h => ({
        title:'Klub chce podpisać z tobą dziesięcioletni kontrakt.',
        text:'Po poradzie Bogusława Cupiała działacze kładą na stole umowę dłuższą niż niejedna kariera.',
        choices:[
          {label:'Podpisuję', ovrProfile:null, preview:'Lojalność +10', act:()=>{h.s.loyalty=h.clamp((h.s.loyalty||0)+10,0,15);h.log('Podpisujesz dziesięcioletni kontrakt.','Lojalność +10.');}},
          {label:'Nie podpisuję', ovrProfile:null, preview:'Brak ofert transferowych w dwóch najbliższych oknach', act:()=>{h.s.marketLockSeasons=Math.max(h.s.marketLockSeasons||0,2);h.log('Odrzucasz dziesięcioletnią umowę.','Przez dwa najbliższe okna żaden klub nie składa oferty.');}}
        ]
      })),

    event('breakthrough_hype_tempo', 7, 99, 1,
      h => h.performance > 48,
      h => ({
        title:'Robi się o tobie głośno. „Tempo” prosi cię o wywiad.',
        text:'Po dobrym sezonie pojawiają się pierwsze większe oczekiwania.',
        choices:[
          {label:'Udzielam wywiadu',rollSpec:{stat:'recognition',name:'Wywiad dla „Tempa”',outcomes:[[100,10]]}},
          {label:'Trzymam się z boku',rollSpec:{stat:'professionalism',name:'Spokój',outcomes:[[100,3]]}}
        ]
      })),

    event('breakthrough_hype_pnplus', 6, 99, 1,
      h => h.performance > 48 && h.s.club.tier >= 4,
      h => ({
        title:'Robi się o tobie głośno. „Piłka Nożna Plus” prosi cię o wywiad.',
        text:'Po dobrym sezonie zaczynasz być rozpoznawalny poza własnym regionem.',
        choices:[
          {label:'Udzielam wywiadu',rollSpec:{stat:'recognition',name:'Wywiad dla „Piłki Nożnej Plus”',outcomes:[[100,15]]}},
          {label:'Trzymam się z boku',rollSpec:{stat:'professionalism',name:'Spokój',outcomes:[[100,4]]}}
        ]
      })),

    event('breakthrough_hype_sport', 5, 99, 1,
      h => h.performance > 48 && h.s.club.region === 'Śląskie',
      h => ({
        title:'Robi się o tobie głośno. Katowicki „Sport” prosi cię o wywiad.',
        text:'Na Śląsku twoje nazwisko zaczyna żyć własnym życiem.',
        choices:[
          {label:'Udzielam wywiadu',rollSpec:{stat:'recognition',name:'Wywiad dla katowickiego „Sportu”',outcomes:[[100,20]]}},
          {label:'Trzymam się z boku',rollSpec:{stat:'professionalism',name:'Spokój',outcomes:[[100,5]]}}
        ]
      })),

    event('agent_choice', 9, 99, 1,
      h => h.s.age <= 28 && h.performance > 28,
      h => ({
        title:'Pojawia się nowy agent.',
        text:'Wygląda trochę jak hochsztapler, ale obiecuje ruch do dużo większego klubu.',
        choices:[
          {label:'Podpisuję z nim',ovrProfile:null,preview:'50% → znacznie lepsze oferty • 50% → brak ofert w najbliższym oknie',act:()=>{const r=h.rand(1,100);if(r<=50){h.s.marketBonus=100;h.s.agentMarketJump=1;h.log('Podpisujesz z podejrzanym agentem.',`Rzut ${r}/100 • agent naprawdę ma dojścia.`);}else{h.s.blockMarketOnce=true;h.log('Podpisujesz z podejrzanym agentem.',`Rzut ${r}/100 • agent okazuje się hochsztaplerem • brak ofert w najbliższym oknie.`);}}},
          {label:'Rezygnuję',rollSpec:{stat:'loyalty',name:'Pozostanie przy swoim otoczeniu',outcomes:[[75,2],[25,3]]}}
        ]
      })),

    event('summer_training', 7, 4, 3,
      h => h.s.age >= 18,
      h => ({
        title:'Masz wolne lato.',
        text:'Jurij Szatałow proponuje ci treningi indywidualne w Murzasichle. Tomasz Łapiński i Jacek Zieliński mają inny plan.',
        choices:[
          {label:'Jadę łowić ryby z Łapińskim i Zielińskim',ovrProfile:null,preview:'Ryzyko urazu spada o połowę',act:()=>{const before=h.s.injuryRisk;h.s.injuryRisk=h.clamp(Math.round(before/2),5,50);h.log('Jedziesz łowić ryby.','Ryzyko urazu spada o połowę.');}},
          {label:'Jadę trenować z Szatałowem',ovrProfile:null,preview:'50% → OVR +3 • 50% → ryzyko urazu rośnie dwukrotnie',act:()=>{const r=h.rand(1,100);if(r<=50)h.s.overall+=3;else h.s.injuryRisk=h.clamp(h.s.injuryRisk*2,5,50);h.log('Trenujesz w Murzasichle.',`Rzut ${r}/100 • ${r<=50?'OVR +3':'ryzyko urazu rośnie dwukrotnie'}.`);}}
        ]
      })),

    event('new_coach', 7, 5, 3,
      h => h.s.age >= 18,
      h => ({
        title:'Klub zmienia trenera.',
        text:'Nowy szkoleniowiec zaczyna od czystej kartki. Szatnia zastanawia się nad wkupnym.',
        choices:[
          {label:'Organizuję mu chrzest — jesień średniowiecza',ovrProfile:null,preview:'50% → szansa na grę rośnie o połowę • 50% → spada o połowę',act:()=>{const r=h.rand(1,100);const now=h.playChance();const target=r<=50?Math.min(97,Math.round(now*1.5)):Math.max(4,Math.round(now*.5));h.s.boost=(h.s.boost||0)+(target-now);h.log('Organizujesz trenerowi chrzest.',`Rzut ${r}/100 • szansa na grę ${now}% → ${target}%.`);}},
          {label:'Organizuję bardzo miękkie wkupne',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Miękkie wkupne.','Nic się nie zmienia.')}
        ]
      })),

    event('new_signing', 9, 5, 3,
      h => h.s.age >= 18 && h.s.club.tier >= 2,
      h => ({
        title:'Klub sprowadza konkurenta.',
        text:'Na twoją pozycję przychodzi zawodnik z mocnym nazwiskiem. Trener zapowiada otwartą rywalizację.',
        choices:[
          {label:'Witam go i pokazuję najlepsze kasyna w mieście',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Oprowadzasz nowego konkurenta.','Hierarchia pozostaje bez zmian.')},
          {label:'Wjeżdżam mu sankami na pierwszym treningu',ovrProfile:null,preview:'50% → szansa na grę +20 p.p. • 50% → klub nie przedłuży umowy',act:()=>{const r=h.rand(1,100);if(r<=50){h.s.boost=(h.s.boost||0)+20;h.log('Sanki rozwiązują rywalizację.',`Rzut ${r}/100 • szansa na grę +20 p.p.`);}else{h.s.forceNoRenewClubName=h.s.club.name;h.log('Sanki rozwiązują rywalizację — przeciwko tobie.',`Rzut ${r}/100 • ${h.s.club.name} nie przedłuży umowy.`);}}}
        ]
      })),

    event('new_role', 7, 6, 2,
      h => h.s.age >= 18 && h.s.position !== 'GK',
      h => {
        const role=h.s.position==='FWD'?'skrzydle':h.s.position==='MID'?'bardziej ofensywnej roli':'wahadle';
        return {
          title:'Trener widzi cię inaczej.',
          text:`Chce częściej ustawiać cię na ${role}. To może dać więcej minut, ale oddala cię od nominalnej pozycji.`,
          choices:[
            {label:'Próbuję',ovrProfile:null,preview:'75% → szansa na grę +6 p.p. • 25% → OVR -1',act:()=>{const r=h.rand(1,100);if(r<=75)h.s.boost=(h.s.boost||0)+6;else h.s.overall=Math.max(20,h.s.overall-1);h.log('Próbujesz nowej pozycji.',`Rzut ${r}/100 • ${r<=75?'szansa na grę +6 p.p.':'OVR -1'}.`);}},
            {label:'Każę mu spier…',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Odrzucasz nową rolę.','Nic się nie zmienia.')}
          ]
        };
      }),

    event('set_pieces', 6, 99, 1,
      h => h.s.position !== 'GK' && h.s.age >= 18,
      h => ({
        title:'Możesz dostać stałe fragmenty.',
        text:'Sztab pyta, czy chcesz zostać po treningach i przejąć część rzutów wolnych albo karnych.',
        choices:[
          {label:'Zostaję po treningu',ovrProfile:null,preview:'50% → OVR +1 • 50% → ryzyko urazu +5 p.p.',act:()=>{const r=h.rand(1,100);if(r<=50)h.s.overall+=1;else h.s.injuryRisk=h.clamp(h.s.injuryRisk+5,5,50);h.log('Ćwiczysz stałe fragmenty.',`Rzut ${r}/100 • ${r<=50?'OVR +1':'ryzyko urazu +5 p.p.'}.`);}},
          {label:'Nie chce mi się, po treningu jadę do kobity',ovrProfile:null,preview:'Ryzyko urazu -5 p.p. • 50% → medialność +20',act:()=>{const r=h.rand(1,100);h.s.injuryRisk=h.clamp(h.s.injuryRisk-5,5,50);if(r<=50)h.s.recognition=h.clamp((h.s.recognition||0)+20,0,100);h.log('Rezygnujesz z dodatkowego treningu.',`Ryzyko urazu -5 p.p. • rzut ${r}/100${r<=50?' • medialność +20':' • bez bonusu medialności'}.`);}}
        ]
      })),

    event('derby_pressure', 7, 5, 3,
      h => h.s.club.tier >= 2 && h.s.age >= 18,
      h => ({
        title:'Przed derbami robi się gorąco.',
        text:'Popularna popołudniówka pyta cię o komentarz.',
        choices:[
          {label:'Mówię, że derby rządzą się swoimi prawami',ovrProfile:null,preview:'Profesjonalizm +3 • medialność -20',act:()=>{h.s.professionalism=h.clamp(h.s.professionalism+3,0,100);h.s.recognition=h.clamp((h.s.recognition||0)-20,0,100);h.log('Udzielasz klasycznej odpowiedzi.','Profesjonalizm +3 • medialność -20.');}},
          {label:'Mówię, że tamci są niefajni, a my jesteśmy fajni, nawet bardzo',rollSpec:{stat:'recognition',name:'Mocny komentarz przed derbami',outcomes:[[100,40]]}}
        ]
      })),

    event('social_media', 5, 6, 2,
      h => h.s.age >= 18 && h.s.club.tier >= 3,
      h => ({
        title:'Jedna akcja robi się viralem.',
        text:'Klip z twoim zagraniem krąży po sieci. Nie wiesz jednak który, a „Goal.pl” pyta o opinię.',
        choices:[
          {label:'Podkręcam temat',rollSpec:{stat:'recognition',name:'Viral',outcomes:[[50,10],[50,-10]]}},
          {label:'Nie mogę rozmawiać, żre mi karta w bakarat',rollSpec:{stat:'professionalism',name:'Powrót do rutyny',outcomes:[[100,3]]}}
        ]
      })),

    event('bad_press', 7, 5, 3,
      h => h.s.age >= 18 && h.performance < 38 && h.s.club.tier >= 2,
      h => ({
        title:'Prasa zaczyna cię punktować.',
        text:'Po słabszym sezonie pojawiają się pytania, czy twój rozwój nie stanął w miejscu.',
        choices:[
          {label:'Stanąć to może tramwaj na przystanku',rollSpec:{stat:'recognition',name:'Riposta',outcomes:[[100,10]]}},
          {label:'Zgadzam się, mój rozwój stanął w miejscu',rollSpec:{stat:'professionalism',name:'Szczerość',outcomes:[[100,2]]}}
        ]
      })),

    event('lower_league_finances', 8, 7, 2,
      h => h.s.club.tier <= 3 && h.s.age >= 18,
      h => ({
        title:'W klubie zaczyna brakować pieniędzy.',
        text:'Klub prosi, czy twoja żona nie mogłaby zrobić kanapek drużynie na najbliższy wyjazd.',
        choices:[
          {label:'Może zrobić',rollSpec:{stat:'loyalty',name:'Pomoc klubowi',outcomes:[[100,4]]}},
          {label:'Nie może zrobić',rollSpec:{stat:'recognition',name:'Odmowa',outcomes:[[100,10]]}}
        ]
      })),

    event('captaincy', 8, 99, 1,
      h => h.s.status !== 'Rezerwowy' && h.s.age >= 22,
      h => ({
        title:'Szatnia widzi w tobie lidera.',
        text:'Trener proponuje ci wejście do rady drużyny. To prestiż, ale też więcej odpowiedzialności poza boiskiem.',
        choices:[
          {label:'Biorę to',ovrProfile:null,preview:'W Wielkim Meczu tego klubu dostajesz dwa razy więcej zdarzeń z udziałem twojego zawodnika',act:()=>{h.s.captainEventBonusClub=h.s.club.name;h.log('Wchodzisz do rady drużyny.',`W Wielkich Meczach ${h.s.club.name} masz podwójny budżet zdarzeń osobistych.`);}},
          {label:'Nie chcę, pora na CS-a',rollSpec:{stat:'injuryRisk',name:'Mniej obciążeń',outcomes:[[100,-3]]}}
        ]
      })),

    event('veteran_role', 9, 99, 1,
      h => h.s.age >= 30 && h.s.status !== 'Rezerwowy',
      h => ({
        title:'Trener chce zmienić twoją rolę.',
        text:'Masz grać trochę mniej, ale pomagać młodszym i być punktem odniesienia dla szatni.',
        choices:[
          {label:'Przyjmuję rolę mentora',ovrProfile:null,preview:'75% → profesjonalizm +3 • 25% → lojalność +3',act:()=>{const r=h.rand(1,100);if(r<=75)h.s.professionalism=h.clamp(h.s.professionalism+3,0,100);else h.s.loyalty=h.clamp((h.s.loyalty||0)+3,0,15);h.log('Przyjmujesz rolę mentora.',`Rzut ${r}/100 • ${r<=75?'profesjonalizm +3':'lojalność +3'}.`);}},
          {label:'Nie będę wycierał gili młodym — robię sanki talentowi',rollSpec:{stat:'playChance',name:'Walka ze zmiennikiem',outcomes:[[100,20]]}}
        ]
      })),

    event('homecoming', 10, 99, 1,
      h => h.s.age >= 25 && (h.s.club.tier >= 7 || h.s.club.region !== h.s.region),
      h => ({
        title:'Wraca temat domu.',
        text:`Jeden z klubów z województwa ${h.s.region} pyta, czy chciałbyś wrócić bliżej miejsca, z którego ruszyła kariera.`,
        choices:[
          {label:'Wrócę, ale jeszcze muszę wrócić z Radomia, a do Radomia się nie wybieram',rollSpec:{stat:'recognition',name:'Odpowiedź mediom',outcomes:[[100,20]]}},
          {label:'Wracam', ovrProfile:null,preview:'Natychmiastowy transfer do klubu z rodzinnego województwa',act:()=>{h.regionalReturn();h.s.skipMarketOnce=true;}}
        ]
      })),

    event('last_big_offer', 6, 99, 1,
      h => h.s.age >= 28,
      h => ({
        title:'Może to być ostatnia duża oferta.',
        text:'Agent mówi wprost: za rok rynek może już patrzeć na ciebie inaczej. Teraz jest klub gotowy zaryzykować.',
        choices:[
          {label:'Biorę ostatnią szansę', ovrProfile:null, act:()=>{const t=h.findTransferClub(false); if(t) h.moveClub(t); else h.log('Jesteś gotowy na ruch.','Odpowiednia oferta jednak nie przychodzi.');}},
          {label:'Nie ruszam się',rollSpec:{stat:'loyalty',name:'Pozostanie w klubie',outcomes:[[100,3]]}}
        ]
      })),

    event('locker_room', 6, 6, 2,
      h => h.s.age >= 20 && h.s.status !== 'Rezerwowy',
      h => ({
        title:'W szatni robi się nerwowo.',
        text:'Po kilku słabszych wynikach starsi zawodnicy ścierają się z trenerem. Ktoś oczekuje, że zabierzesz głos.',
        choices:[
          {label:'Próbuję uspokoić sytuację',rollSpec:{stat:'loyalty',name:'Spokój w szatni',outcomes:[[100,4]]}},
          {label:'Namawiam zespół, żebyśmy przegrali teraz dwa mecze',ovrProfile:null,preview:'50% → szansa na grę rośnie o połowę i siła klubu +3 • 50% → bez efektu',act:()=>{const r=h.rand(1,100);if(r<=50){const now=h.playChance();const target=Math.min(97,Math.round(now*1.5));h.s.boost=(h.s.boost||0)+(target-now);h.s.club.strength=Math.min(99,(h.s.club.strength||0)+3);h.log('Szatnia gra przeciwko trenerowi.',`Rzut ${r}/100 • szansa na grę ${now}% → ${target}% • siła klubu +3.`);}else h.log('Plan szatni upada.',`Rzut ${r}/100 • bez efektu.`);}}
        ]
      })),

    event('puchar_fatigue', 6, 5, 3,
      h => h.s.club.tier >= 3 && h.s.age >= 18,
      h => ({
        title:'Terminarz robi się ciasny.',
        text:'Liga, Puchar Polski i coraz mniej czasu na regenerację. Sztab pyta, czy chcesz odpuścić część dodatkowych zajęć.',
        choices:[
          {label:'Gram i trenuję normalnie', act:()=>{h.s.boost+=3; h.s.injuryRisk=h.clamp(h.s.injuryRisk+3,5,45); h.log('Nie zmniejszasz obciążeń.','Chcesz wykorzystać każdy mecz, ale organizm dostaje mocniej.');}},
          {label:'Regeneracja przede wszystkim', act:()=>{h.s.injuryRisk=h.clamp(h.s.injuryRisk-3,5,45); h.s.boost-=1; h.log('Odcinasz część dodatkowych zajęć.','Priorytetem jest zdrowie na najważniejsze mecze.');}}
        ]
      })),

    event('studies', 6, 99, 1,
      h => h.s.age <= 25 && h.s.club.tier <= 5,
      h => ({
        title:'Co robisz poza treningami?',
        text:'Rodzina namawia cię, żebyś nie stawiał wszystkiego na jedną kartę i zaczął naukę równolegle z piłką.',
        choices:[
          {label:'Łączę piłkę z nauką', act:()=>{h.s.professionalism=h.clamp(h.s.professionalism+1,0,100); h.s.boost-=1; h.log('Zaczynasz naukę równolegle z grą.','Masz mniej wolnego czasu, ale więcej stabilności poza boiskiem.');}},
          {label:'Zrywam kontakty z rodziną, tylko piłka', act:()=>{h.s.boost+=4; h.log('Skupiasz się wyłącznie na piłce.','Chcesz wykorzystać każdy miesiąc rozwoju.');}}
        ]
      })),

    event('nutrition_plan', 5, 7, 2,
      h => h.s.age >= 18,
      h => ({
        title:'Sztab proponuje nowy plan żywienia.',
        text:'Sugeruje, żebyś jadł jarmuż.',
        choices:[
          {label:'Jem jarmuż',rollSpec:{stat:'injuryRisk',name:'Plan żywienia',outcomes:[[80,-3],[20,2]]}},
          {label:'Idę na kebsa',ovrProfile:null,preview:'75% → medialność +10 • 25% → OVR +1',act:()=>{const r=h.rand(1,100);if(r<=75)h.s.recognition=h.clamp((h.s.recognition||0)+10,0,100);else h.s.overall+=1;h.log('Idziesz na kebsa.',`Rzut ${r}/100 • ${r<=75?'medialność +10':'OVR +1'}.`);}}
        ]
      })),

    event('academy_rival', 8, 99, 1,
      h => h.s.age >= 20 && h.s.club.tier >= 3 && h.s.status !== 'Rezerwowy',
      h => ({
        title:'Wychowanek depcze ci po piętach.',
        text:'Do pierwszej drużyny wchodzi bardzo głośny nastolatek grający na twojej pozycji. Klub chce dawać mu coraz więcej minut.',
        choices:[
          {label:'Pomagam mu wejść do zespołu',rollSpec:{stat:'loyalty',name:'Pomoc wychowankowi',outcomes:[[100,4]]}},
          {label:'Pokazuję mu magiczny świat blackjacka',rollSpec:{stat:'playChance',name:'Rywalizacja o skład',outcomes:[[100,10]]}}
        ]
      })),

    event('club_wants_sale', 8, 7, 2,
      h => h.s.age >= 18 && h.performance > 40,
      h => ({
        title:'Klub chce na tobie zarobić.',
        text:'Dyrektor mówi, że dobra oferta może zostać przyjęta nawet bez twojego entuzjazmu. Możesz otworzyć się na rozmowy albo jasno powiedzieć, że chcesz zostać.',
        choices:[
          {label:'Dobra, idę',ovrProfile:null,preview:'OVR +1 i natychmiastowy transfer do pierwszego wylosowanego klubu',act:()=>{h.s.overall+=1;const t=h.findTransferClub(false);if(t){h.moveClub(t);h.s.skipMarketOnce=true;}else h.log('Klub próbuje cię sprzedać.','Nie znajduje się żaden możliwy kierunek.');}},
          {label:'Panie, ja się buduję na przedmieściach, zostaję',rollSpec:{stat:'loyalty',name:'Deklaracja pozostania',outcomes:[[100,5]]}}
        ]
      })),


    event('corruption_offer', 5, 99, 1,
      h => h.s.age >= 19 && h.s.club.tier >= 2 && h.s.club.tier <= 5 && !h.s.corruptionPlan,
      h => ({
        title:'Ktoś proponuje „pomóc” w meczu o awans.',
        text:'W szatni krąży pomysł, żeby zrzucić się na ustawienie kluczowego meczu. To jeden rzut: albo awans jest załatwiony, albo wpadasz.',
        choices:[
          {label:'Dorzucam się',
           specialRoll:'corruption',
           preview:'70% → układ przechodzi i klub ma zapewniony awans • 30% → wpadka, -5 OVR i cały sezon dyskwalifikacji'},
          {label:'Nie wchodzę w to',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Nie wchodzisz w układ.','Sezon i awans są liczone normalnie.')}
        ]
      })),

    event('bad_pitch_winter', 5, 6, 2,
      h => h.s.club.tier <= 4 && h.s.age >= 18,
      h => ({
        title:'Zimą boisko zamienia się w kartoflisko.',
        text:'Przez kilka tygodni treningi będą bardziej fizyczne i cięższe dla organizmu. Możesz trenować jak zawsze albo ograniczyć obciążenia.',
        choices:[
          {label:'Trenuję normalnie', ovrProfile:'aggressive', act:()=>{h.s.boost+=3;h.s.injuryRisk=h.clamp(h.s.injuryRisk+3,5,45);}},
          {label:'Oszczędzam nogi',rollSpec:{stat:'playChance',name:'Oszczędzanie na kartoflisku',outcomes:[[80,0],[20,-10]]}}
        ]
      })),

    event('license_chaos', 4, 99, 1,
      h => h.s.justPromoted && h.s.club.tier <= 5,
      h => ({
        title:'Po awansie zaczyna się walka o licencję.',
        text:'Stadion i finanse klubu nie spełniają wszystkich wymogów. Możesz zostać mimo chaosu albo poprosić agenta, żeby mocniej sprawdził rynek.',
        choices:[
          {label:'Zostaję, to moja banda',rollSpec:{stat:'loyalty',name:'Pozostanie mimo chaosu',outcomes:[[50,15],[50,0]]}},
          {label:'A szlag z tym',ovrProfile:null,preview:'W najbliższym oknie dostajesz ciekawsze oferty niż zwykle',act:()=>{h.s.marketBonus=100;h.s.agentMarketJump=1;h.log('Agent natychmiast rusza na rynek.','Najbliższe oferty będą o poziom ambitniejsze.');}}
        ]
      })),


    event('fans_at_training', 6, 6, 2,
      h => h.s.club.tier >= 2 && h.s.age >= 18 && h.performance < 38,
      h => ({
        title:'Kibice przychodzą pod trening.',
        text:'Po serii słabych wyników grupa kibiców chce rozmowy z drużyną. Możesz wyjść do nich albo zostać w środku.',
        choices:[
          {label:'Słucham',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Słuchasz kibiców.','Nic się nie zmienia.')},
          {label:'Sam ich opieprzam',ovrProfile:null,preview:'75% → profesjonalizm +30 • 25% → ryzyko urazu +30 p.p.',act:()=>{const r=h.rand(1,100);if(r<=75)h.s.professionalism=h.clamp(h.s.professionalism+30,0,100);else h.s.injuryRisk=h.clamp(h.s.injuryRisk+30,5,50);h.log('Odwracasz rozmowę z kibicami.',`Rzut ${r}/100 • ${r<=75?'profesjonalizm +30':'ryzyko urazu +30 p.p.'}.`);}}
        ]
      })),

    event('play_hurt', 7, 7, 2,
      h => h.s.age >= 18 && h.s.club.tier >= 2,
      h => ({
        title:'Trener chce, żebyś zagrał niedoleczony.',
        text:'Mecz jest ważny, a sztab proponuje blokadę przeciwbólową. Możesz zagrać albo odmówić i zaryzykować miejsce w hierarchii.',
        choices:[
          {label:'Gram mimo urazu',ovrProfile:null,preview:'50% → szansa na grę +10 p.p. • 50% → ryzyko urazu +10 p.p.',act:()=>{const r=h.rand(1,100);if(r<=50)h.s.boost=(h.s.boost||0)+10;else h.s.injuryRisk=h.clamp(h.s.injuryRisk+10,5,50);h.log('Grasz niedoleczony.',`Rzut ${r}/100 • ${r<=50?'szansa na grę +10 p.p.':'ryzyko urazu +10 p.p.'}.`);}},
          {label:'Chyba sam jest niedoleczony',rollSpec:{stat:'playChance',name:'Odmowa gry',outcomes:[[50,0],[50,-10]]}}
        ]
      })),

    event('foreign_trials', 6, 99, 1,
      h => h.s.age >= 18 && h.performance > 28,
      h => ({
        title:'Masz zaproszenie na testy za granicą.',
        text:'Termin nachodzi na część przygotowań w obecnym klubie. Możesz pojechać albo zostać i walczyć o miejsce tutaj.',
        choices:[
          {label:'Jadę na testy',ovrProfile:null,preview:'Dwie gwarantowane oferty zagraniczne w najbliższym oknie',act:()=>{h.s.guaranteedForeignOffers=2;h.log('Jedziesz na testy za granicę.','W najbliższym oknie dostaniesz dwie oferty zagraniczne.');}},
          {label:'Zostaję na przygotowaniach',rollSpec:{stat:'loyalty',name:'Pozostanie z klubem',outcomes:[[100,5]]}}
        ]
      })),

    event('cup_spotlight', 7, 6, 2,
      h => h.s.club.tier <= 6 && h.s.age >= 18,
      h => ({
        title:'Puchar Polski: trafia wam się wielki rywal.',
        text:'To może być jeden mecz, który zobaczy pół kraju. Możesz grać pod błysk albo maksymalnie trzymać się planu drużyny.',
        choices:[
          {label:'Chcę się pokazać',rollSpec:{stat:'recognition',name:'Pucharowy rozgłos',outcomes:[[100,10]]}},
          {label:'Gram dla zespołu',rollSpec:{stat:'professionalism',name:'Gra dla zespołu',outcomes:[[100,3]]}}
        ]
      })),

    event('coach_own_players', 7, 6, 2,
      h => h.s.age >= 18 && h.s.club.tier >= 3,
      h => ({
        title:'Nowy trener przyprowadza swoich.',
        text:'Na twoją pozycję trafia zawodnik, którego szkoleniowiec zna z poprzedniego klubu. Hierarchia robi się mniej oczywista.',
        choices:[
          {label:'Walczę z jego człowiekiem',ovrProfile:null,preview:'50% → szansa na grę rośnie o połowę • 50% → stracony sezon',act:()=>{const r=h.rand(1,100);if(r<=50){const now=h.playChance();const target=Math.min(97,Math.round(now*1.5));h.s.boost=(h.s.boost||0)+(target-now);h.log('Wygrywasz walkę z człowiekiem trenera.',`Rzut ${r}/100 • szansa na grę ${now}% → ${target}%.`);}else{h.s.nextAppsFactor=0;h.s.nextAppsReason='Człowiek trenera zabrał ci cały sezon — nie zagrałeś ani jednego meczu.';h.log('Człowiek trenera wygrywa.',`Rzut ${r}/100 • następny sezon: 0 meczów.`);}}},
          {label:'Uruchamiam agenta',ovrProfile:null,preview:'Agent od razu otwiera ambitniejszy rynek',act:()=>{h.s.marketBonus=100;h.s.agentMarketJump=1;h.log('Uruchamiasz agenta.','Najbliższe oferty będą o poziom ambitniejsze.');}}
        ]
      })),

    event('sponsor_campaign', 4, 8, 2,
      h => h.s.age >= 18,
      h => ({
        title:'Klub chce cię w kampanii społecznej.',
        text:'Masz promować używanie trolejbusów w miastach.',
        choices:[
          {label:'Biorę udział',rollSpec:{stat:'recognition',name:'Kampania trolejbusowa',outcomes:[[100,10]]}},
          {label:'Zostaję tylko przy piłce',rollSpec:{stat:'professionalism',name:'Skupienie na piłce',outcomes:[[100,4]]}}
        ]
      })),


    event('mandziejewicz_name_day', 7, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Imieniny Zbigniewa Mandziejewicza.',
        text:'W polskiej piłce są daty meczowe, terminy okienka i są też imieniny Zbigniewa Mandziejewicza. Część środowiska będzie na miejscu. Możesz pojechać i pobyć wśród ludzi futbolu albo wykorzystać spokojniejszy dzień na własną robotę.',
        choices:[
          {label:'Jadę na imieniny',ovrProfile:null,preview:'75% → medialność +25 • 25% → OVR +1',act:()=>{const r=h.rand(1,100);if(r<=75)h.s.recognition=h.clamp((h.s.recognition||0)+25,0,100);else h.s.overall+=1;h.log('Jedziesz na imieniny Zbigniewa Mandziejewicza.',`Rzut ${r}/100 • ${r<=75?'medialność +25':'OVR +1'}.`);}},
          {label:'Zostaję na treningu',rollSpec:{stat:'loyalty',name:'Pozostanie z klubem',outcomes:[[100,5]]}}
        ]
      })),


    event('reserve_warning', 7, 6, 2,
      h => h.s.age >= 18 && h.s.club.tier >= 3,
      h => ({
        title:'Trener figlarz zsyła cię do rezerw przed sezonem.',
        text:'To tania zemsta za to, że nazwałeś go sprzedawczykiem.',
        choices:[
          {label:'Walczę o pierwszą drużynę'},
          {label:'Uruchamiam kontakty',rollSpec:{stat:'recognition',name:'Kontakty',outcomes:[[100,10]]}}
        ]
      })),

    event('position_coach', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Do sztabu dołącza Piotr Przerywacz.',
        text:'Możesz wykorzystać kilka tygodni na bardzo indywidualną pracę albo skupić się na tym, by od początku wygrać miejsce w składzie.',
        choices:[
          {label:'Pracuję nad umiejętnościami'},
          {label:'Walczę o hierarchię'}
        ]
      })),

    event('local_tv_preseason', 5, 6, 2,
      h => h.s.age >= 18,
      h => ({
        title:'TV4 chce zrobić film dokumentalny o twoim życiu.',
        text:'Możesz wejść w promocję albo zostać poza kamerami i trzymać rytm treningów.',
        choices:[
          {label:'Biorę udział w materiale'},
          {label:'Zostaję poza kamerami'}
        ]
      })),

    event('ultras_flares', 7, 99, 1,
      h => h.s.age >= 18 && h.s.club.tier >= 2 && h.s.club.tier <= 6,
      h => ({
        title:'Ultrasi proszą cię o pomoc przy racach.',
        text:'Przed ważnym meczem ultrasi twojego klubu namawiają cię, żebyś pomógł wnieść race na stadion.',
        choices:[
          {label:'Pomagam wnieść race', specialRoll:'ultras_flares',
           preview:'1–3 → medialność +12 • 4–6 → zawieszenie: -20% meczów w następnym sezonie'},
          {label:'Odmawiam'}
        ]
      })),

    event('cwiakala_interview', 7, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Tomek Ćwiąkała zaprasza cię na wywiad.',
        text:'Możesz usiąść do długiej rozmowy albo wykorzystać ten czas na dodatkowy trening.',
        choices:[
          {label:'Idę i odpowiadam wyczerpująco'},
          {label:'Odmawiam i idę na dodatkowy trening'}
        ]
      })),

    event('helti_plan', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Agent proponuje dietę „Helti plen baj Tlen”.',
        text:'Plan opiera się na bardzo dużej ilości jarmużu. Agent zapewnia, że efekty będą spektakularne.',
        choices:[
          {label:'Ryzykuję i jem dużo jarmużu'},
          {label:'Odmawiam i zostaję przy normalnej diecie'}
        ]
      })),

    event('wisnicz_festival', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Dni Wiśnicza Małego.',
        text:'Wybierasz się na festyn z okazji Dni Wiśnicza Małego. Wieczorem zaczepiają cię lokalni watażkowie.',
        choices:[
          {label:'Wdaję się w awanturę', specialRoll:'wisnicz_brawl',
           preview:'1–3 → medialność +10 • 4–6 → uraz: -20% minut w następnym sezonie'},
          {label:'Rezygnuję z wyjścia i idę na trening'}
        ]
      })),

    // Zdarzenia Kuby — zredagowane do zasady: dwie odpowiedzi i najwyżej
    // dwa możliwe wyniki jednego, jasno nazwanego parametru.
    event('kuba_x_vote', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Kolega przesyła ci podejrzany link.',
        text:'Na portalu X prosi, żebyś zagłosował na jego siostrzenicę Magdalenę. Adres wygląda trochę podejrzanie.',
        choices:[
          {label:'Klikam i głosuję'},
          {label:'Nie otwieram linku', ovrProfile:null, preview:'Bez losowania • nic się nie dzieje'}
        ]
      })),

    event('kuba_padel', 7, 5, 2,
      h => h.s.age >= 18 && h.s.club.tier >= 2,
      h => ({
        title:'Drużyna idzie na padla.',
        text:'W tym samym czasie fizjoterapeuta prowadzi dodatkową sesję regeneracyjną dla chętnych.',
        choices:[
          {label:'Idę z drużyną na padla'},
          {label:'Wybieram regenerację'}
        ]
      })),

    event('kuba_futbol_na_tak', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'„Futbol na tak” trafia na Vinted.',
        text:'Koledze z zespołu wpadła w ręce książka Władysława Jerzego Engela. Zastanawia się, czy jej nie sprzedać.',
        choices:[
          {label:'Pomagam mu wystawić książkę'},
          {label:'Przekonuję go, żeby ją zachował'}
        ]
      })),

    event('kuba_bengay_target', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Ktoś wysmarował ci gacie Bengayem.',
        text:'Szatnia czeka na twoją reakcję. Figlarze próbują zachować powagę, ale idzie im coraz gorzej.',
        choices:[
          {label:'Śmieję się razem z nimi'},
          {label:'Szukam winowajcy'}
        ]
      })),

    event('kuba_bengay_keeper', 5, 99, 1,
      h => h.s.age >= 18 && h.s.position !== 'GK',
      h => ({
        title:'Koledzy planują żart z bramkarza.',
        text:'Proponują, żebyś wysmarował Bengayem jego gacie. Twierdzą, że przejdzie to do historii szatni.',
        choices:[
          {label:'Pomagam w żarcie'},
          {label:'Mówię, że to słaby pomysł'}
        ]
      })),

    event('kuba_tree_run', 7, 6, 2,
      h => h.s.age >= 18,
      h => ({
        title:'Drzewo daje idealną kryjówkę.',
        text:'Podczas ciężkiego treningu biegowego możesz na chwilę zniknąć trenerowi z oczu. Raczej się nie zorientuje.',
        choices:[
          {label:'Biegnę uczciwie do końca'},
          {label:'Chowam się za drzewem'}
        ]
      })),

    event('kuba_favourite_pub', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Twój ulubiony lokal zmienia charakter.',
        text:'Spokojne miejsce zastępuje mordownia słynąca z najmocniejszych trunków. Nadal znasz tam wszystkich.',
        choices:[
          {label:'Nie zmieniam lokalu'},
          {label:'Szukam spokojniejszego miejsca'}
        ]
      })),

    event('kuba_dynamic_sock', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Nowe buty nie dają ci spokoju.',
        text:'Dynamiczna skarpetka, ostatni krzyk futbolowej mody, niemiłosiernie uciska kostkę.',
        choices:[
          {label:'Gram w nowych butach'},
          {label:'Wracam do starego modelu'}
        ]
      })),

    event('kuba_bengay_boxers', 4, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Inwestor pokazuje bokserki odporne na Bengay.',
        text:'Szemrany wynalazca zapewnia, że materiał wytrzyma każdą ilość maści rozgrzewającej. Szuka znanego testera.',
        choices:[
          {label:'Testuję wynalazek'},
          {label:'Nie ryzykuję', ovrProfile:null, preview:'Bez losowania • nic się nie zmienia'}
        ]
      })),

    // Zdarzenia z wersji po komentarzach. Zbędne ograniczenia wieku i etapu
    // kariery zostały usunięte; zostają tylko warunki konieczne narracyjnie,
    // np. zdarzenie niemieckie nadal wymaga gry w Niemczech.
    event('grajewski_friendly', 4, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Dostajesz zaproszenie na mecz „Przyjaciele Andrzeja Grajewskiego — Reszta Świata”.',
        text:'Przyjaciele mają 62 OVR, Reszta Świata 64 OVR. Ten mecz nie może skończyć się remisem: w razie potrzeby będą dogrywka i karne.',
        choices:[
          {label:'Jadę',specialRoll:'grajewski_friendly',preview:'Zwycięstwo → OVR +25% obecnego poziomu • porażka → natychmiastowy koniec kariery'},
          {label:'Zostaję w domu',rollSpec:{stat:'injuryRisk',name:'Odpoczynek',outcomes:[[100,-5]]}}
        ]
      })),

    event('swap_professionalism_recognition', 5, 99, 1,
      h => h.s.age >= 18,
      h => {
        const professionalism=h.s.professionalism||0;
        const recognition=h.s.recognition||0;
        return {
          title:'Ekspert od marki osobistej znajduje błąd w twoim profilu.',
          text:'Twierdzi, że przez całą karierę profesjonalizm był wpisywany w rubrykę „medialność”, a medialność w rubrykę „profesjonalizm”. Proponuje po prostu zamienić kolumny.',
          choices:[
            {label:'Zgadzam się na zamianę',ovrProfile:null,preview:`Profesjonalizm ${professionalism} ↔ medialność ${recognition}`,act:()=>{
              const beforeProfessionalism=h.s.professionalism||0;
              const beforeRecognition=h.s.recognition||0;
              h.s.professionalism=beforeRecognition;
              h.s.recognition=beforeProfessionalism;
              h.log('Ekspert zamienia dwie kolumny.',`Profesjonalizm ${beforeProfessionalism} → ${h.s.professionalism} • medialność ${beforeRecognition} → ${h.s.recognition}.`);
            }},
            {label:'Nie zgadzam się',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Nie pozwalasz ruszać profilu.','Profesjonalizm i medialność pozostają bez zmian.')}
          ]
        };
      }),

    event('miekarski_or_pisz', 6, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Piariusz Miekarski albo trening z Leszkiem Piszem.',
        text:'Piariusz Miekarski chce zostać twoim agentem. W tym samym czasie masz unikalną okazję, by Leszek Pisz uczył cię stałych fragmentów.',
        choices:[
          {label:'Wybieram Miekarskiego',ovrProfile:null,preview:'Do końca kariery dostajesz jedną dodatkową ofertę w każdym oknie',act:()=>{h.s.extraMarketOffer=true;h.log('Piariusz Miekarski zostaje twoim agentem.','Od teraz każde okno ma jedną dodatkową ofertę.');}},
          {label:'Wybieram trening z Leszkiem Piszem',rollSpec:{stat:'overall',name:'Trening stałych fragmentów',outcomes:[[50,1],[25,0],[25,2]]}}
        ]
      })),

    event('papszun_cap', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Znajdujesz czapkę Marka Papszuna.',
        text:'Możesz oddać artefakt właścicielowi albo zachować go dla siebie.',
        choices:[
          {label:'Oddaję',ovrProfile:null,preview:'Lojalność +5 • medialność +10 • szansa na grę +10 p.p.',act:()=>{h.s.loyalty=h.clamp((h.s.loyalty||0)+5,0,15);h.s.recognition=h.clamp((h.s.recognition||0)+10,0,100);h.s.boost=(h.s.boost||0)+10;h.log('Oddajesz czapkę Marka Papszuna.','„Tempo” publikuje reportaż • lojalność +5 • medialność +10 • szansa na grę +10 p.p.');}},
          {label:'Nie oddaję, czerpię moc z artefaktu',rollSpec:{stat:'overall',name:'Moc czapki',outcomes:[[100,1]]}}
        ]
      })),

    event('german_anti_polish_coach', 8, 99, 1,
      h => h.s.club.country === 'Niemcy',
      h => ({
        title:'Trener nie lubi Polaków.',
        text:'Wiesz już, że przy tym szkoleniowcu nie dostaniesz uczciwej szansy.',
        choices:[
          {label:'Wracam do Polski',ovrProfile:null,preview:'Natychmiastowy powrót do polskiego klubu odpowiedniego dla twojego poziomu',act:()=>{h.regionalReturn();h.s.skipMarketOnce=true;}},
          {label:'Zostaję i czekam, może go zwolnią',ovrProfile:null,preview:'Następny sezon: 0 meczów • kolejne sezony normalnie',act:()=>{h.s.nextAppsFactor=0;h.s.nextAppsReason='Trener odsunął cię na cały sezon — nie zagrałeś ani jednego meczu.';h.s.marketLockSeasons=Math.max(h.s.marketLockSeasons||0,1);h.log('Zostajesz w Niemczech.','Następny sezon: 0 meczów.');}}
        ]
      })),

    event('danza_kuduro_compilation', 6, 7, 2,
      h => h.s.age >= 18,
      h => ({
        title:'Agent proponuje Goals and Skills Danza Kuduro Remix.',
        text:'Ma dojścia na kanale Rain of Goals. Pozostaje tylko zmontować najlepsze akcje.',
        choices:[
          {label:'Poświęcam na to czas',rollSpec:{stat:'recognition',name:'Kompilacja',outcomes:[[100,20]]}},
          {label:'Idę na trening',rollSpec:{stat:'professionalism',name:'Trening',outcomes:[[50,10],[50,0]]}}
        ]
      })),

    event('radzius_party', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Nerijus Radžius zaprasza cię na balety.',
        text:'Zaproszenie brzmi dobrze, ale trudno przewidzieć, jak skończy się noc.',
        choices:[
          {label:'Idę',ovrProfile:null,preview:'34% → medialność +20 • 33% → ryzyko urazu +20 p.p. • 33% → OVR +1',act:()=>{const r=h.rand(1,100);let result;if(r<=34){h.s.recognition=h.clamp((h.s.recognition||0)+20,0,100);result='medialność +20';}else if(r<=67){h.s.injuryRisk=h.clamp(h.s.injuryRisk+20,5,50);result='ryzyko urazu +20 p.p.';}else{h.s.overall+=1;result='OVR +1';}h.log('Idziesz na balety z Nerijusem Radžiusem.',`Rzut ${r}/100 • ${result}.`);}},
          {label:'Zostaję',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Zostajesz w domu.','Nic się nie zmienia.')}
        ]
      })),

    event('olympic_doctor_supplements', 4, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Doktor kadry olimpijskiej z 1992 roku proponuje sprawdzone suplementy.',
        text:'Zapewnia, że zna je od lat. Nie mówi jednak, czego dokładnie należy się spodziewać.',
        choices:[
          {label:'Biorę',ovrProfile:null,specialRoll:'olympic_supplements',preview:'Losowanie od -5 do +5 OVR • każdy wynik ma taką samą szansę'},
          {label:'Nie biorę',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Odrzucasz suplementy.','Nic się nie zmienia.')}
        ]
      })),

    event('citko_training', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Marek Citko proponuje ci indywidualne treningi.',
        text:'Może to być przełom albo bardzo kosztowny eksperyment.',
        choices:[
          {label:'Idę',ovrProfile:null,preview:'1% → OVR +20 • 99% → ryzyko urazu +25 p.p.',act:()=>{const r=h.rand(1,100);if(r===1)h.s.overall+=20;else h.s.injuryRisk=h.clamp(h.s.injuryRisk+25,5,50);h.log('Trenujesz z Markiem Citką.',`Rzut ${r}/100 • ${r===1?'OVR +20':'ryzyko urazu +25 p.p.'}.`);}},
          {label:'Nie idę',rollSpec:{stat:'professionalism',name:'Odmowa',outcomes:[[100,1]]}}
        ]
      })),

    event('gedgaudas_advice', 5, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Spotykasz Adriusa Gedgaudasa.',
        text:'Możesz wykorzystać okazję i zapytać go o piłkę albo dyskretnie pójść w drugą stronę.',
        choices:[
          {label:'Pytam o porady piłkarskie',ovrProfile:null,preview:'20% → OVR +1 • 80% → profesjonalizm -30',act:()=>{const r=h.rand(1,100);if(r<=20)h.s.overall+=1;else h.s.professionalism=h.clamp(h.s.professionalism-30,0,100);h.log('Rozmawiasz z Adriusem Gedgaudasem.',`Rzut ${r}/100 • ${r<=20?'OVR +1':'profesjonalizm -30'}.`);}},
          {label:'Udaję, że go nie poznaję',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Mijasz Adriusa Gedgaudasa.','Nic się nie zmienia.')}
        ]
      })),

    event('four_men_on_couches', 7, 1, 2,
      h => h.s.age >= 40,
      h => ({
        title:'Dostajesz zaproszenie do programu, w którym cztery chłopy siedzą na kanapach.',
        text:'Na tym etapie kariery jeden telewizyjny występ może otworzyć zaskakujące drzwi.',
        choices:[
          {label:'Idę',ovrProfile:null,preview:'75% → medialność +10 • 25% → natychmiastowy angaż w losowym klubie Ekstraklasy',act:()=>{const r=h.rand(1,100);if(r<=75){h.s.recognition=h.clamp((h.s.recognition||0)+10,0,100);h.log('Siadasz z czterema chłopami na kanapach.',`Rzut ${r}/100 • medialność +10.`);}else{const esa=Object.values(h.data.regions).flat().filter(c=>c.tier===6&&!c.reserve&&c.name!==h.s.club.name);const club=esa.length?h.pick(esa):null;if(club){h.moveClub(club);h.s.skipMarketOnce=true;h.log('Program zmienia końcówkę kariery.',`Rzut ${r}/100 • natychmiastowy angaż: ${club.name}.`);}else h.log('Program nie przynosi kontraktu.',`Rzut ${r}/100 • brak dostępnego klubu Ekstraklasy.`);}}},
          {label:'Zostaję w domu, idę na trening',rollSpec:{stat:'playChance',name:'Trening zamiast programu',outcomes:[[100,10]]}}
        ]
      })),

    event('molongo_dribbles', 6, 99, 1,
      h => h.s.age >= 16,
      h => ({
        title:'Trafiasz na nagrania z dryblingami Mosesa Molongo.',
        text:'Materiał wygląda jak kurs piłkarskiej sztuki, której nie da się już odtworzyć.',
        choices:[
          {label:'Oglądam',rollSpec:{stat:'overall',name:'Nauka dryblingu',outcomes:[[20,1],[80,0]]}},
          {label:'Nie oglądam, i tak nie dam rady odtworzyć tego kunsztu',rollSpec:{stat:'professionalism',name:'Realistyczna samoocena',outcomes:[[100,10]]}}
        ]
      })),

    event('grajewski_agent', 4, 99, 1,
      h => h.s.age >= 18,
      h => ({
        title:'Andrzej Grajewski chce być twoim agentem.',
        text:'Twierdzi, że ma dla ciebie gotową ofertę z zagranicy. Kierunek poznałbyś dopiero po zgodzie.',
        choices:[
          {label:'Zgadzam się',ovrProfile:null,preview:'Natychmiastowy transfer do losowego klubu z całej zagranicznej bazy',act:()=>{const pool=h.data.foreignClubs.filter(c=>c.name!==h.s.club.name);const club=pool.length?h.pick(pool):null;if(club){h.moveClub(club);h.s.skipMarketOnce=true;h.log('Andrzej Grajewski zostaje twoim agentem.',`Natychmiastowy transfer: ${club.name} (${club.country}).`);}else h.log('Zgadzasz się na współpracę.','W bazie nie ma dostępnego zagranicznego klubu.');}},
          {label:'Nie zgadzam się',ovrProfile:null,preview:'Bez efektu',act:()=>h.log('Odrzucasz propozycję Andrzeja Grajewskiego.','Nic się nie zmienia.')}
        ]
      })),

    event('cafe_futbol', 6, 99, 1,
      h => h.s.age >= 23 && h.s.overall >= 60,
      h => ({
        title:'Dostajesz zaproszenie do Cafe Futbol.',
        text:'Możesz trzymać się analizy albo spróbować przejąć program.',
        choices:[
          {label:'Jestem merytoryczny',rollSpec:{stat:'professionalism',name:'Merytoryczny występ',outcomes:[[100,10]]}},
          {label:'Przerywam Bożydarowi',rollSpec:{stat:'recognition',name:'Telewizyjny rozgłos',outcomes:[[100,40]]}}
        ]
      })),

    event('career_aftercare', 4, 99, 1,
      h => h.s.age >= 28,
      h => ({
        title:'Po raz pierwszy pytają cię o życie po piłce.',
        text:'Klub proponuje opłacić pierwszy kurs trenerski. Możesz zacząć myśleć o przyszłości albo całkowicie odsunąć ten temat.',
        choices:[
          {label:'Robię kurs',rollSpec:{stat:'professionalism',name:'Kurs trenerski',outcomes:[[100,3]]}},
          {label:'Ja przecież jestem w życiowej formie, patrz teraz',rollSpec:{stat:'playChance',name:'Jeszcze jestem piłkarzem',outcomes:[[60,6],[40,-4]]}}
        ]
      }))
  ];
})();
