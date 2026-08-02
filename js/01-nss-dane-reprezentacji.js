/*
 * NSS — dane reprezentacji i sytuacje meczowe
 * Wydzielone z Polska Kariera v0.69.
 * Ładować przed 02-nss-silnik-meczowy.js i 03-nss-turnieje.js.
 */
(function (global) {
  'use strict';

  const TEAM_ROWS = [
    ['Argentyna','Ameryka Południowa',97],['Boliwia','Ameryka Południowa',73],
    ['Brazylia','Ameryka Południowa',94],['Chile','Ameryka Południowa',80],
    ['Ekwador','Ameryka Południowa',84],['Kolumbia','Ameryka Południowa',88],
    ['Paragwaj','Ameryka Południowa',83],['Peru','Ameryka Południowa',80],
    ['Urugwaj','Ameryka Południowa',86],['Wenezuela','Ameryka Południowa',79],

    ['Albania','Europa',78],['Andora','Europa',57],['Anglia','Europa',92],
    ['Austria','Europa',85],['Belgia','Europa',89],['Białoruś','Europa',72],
    ['Bośnia i Hercegowina','Europa',78],['Bułgaria','Europa',74],
    ['Chorwacja','Europa',87],['Cypr','Europa',68],['Czechy','Europa',80],
    ['Dania','Europa',85],['Finlandia','Europa',77],['Francja','Europa',93],
    ['Grecja','Europa',81],['Hiszpania','Europa',94],['Holandia','Europa',89],
    ['Irlandia','Europa',79],['Islandia','Europa',77],['Izrael','Europa',77],
    ['Liechtenstein','Europa',53],['Luksemburg','Europa',73],
    ['Macedonia Północna','Europa',77],['Malta','Europa',65],['Niemcy','Europa',88],
    ['Norwegia','Europa',86],['Polska','Europa',85],['Portugalia','Europa',90],
    ['Rumunia','Europa',81],['San Marino','Europa',50],['Serbia','Europa',82],
    ['Słowacja','Europa',79],['Słowenia','Europa',80],['Szkocja','Europa',82],
    ['Szwajcaria','Europa',87],['Szwecja','Europa',82],['Turcja','Europa',84],
    ['Ukraina','Europa',84],['Walia','Europa',82],['Węgry','Europa',82],
    ['Włochy','Europa',88],

    ['Kanada','Ameryka Północna',83],['Meksyk','Ameryka Północna',88],
    ['USA','Ameryka Północna',86],

    ['Algieria','Afryka',83],['Botswana','Afryka',68],['Burkina Faso','Afryka',79],
    ['DR Konga','Afryka',81],['Egipt','Afryka',85],['Ghana','Afryka',79],
    ['Gwinea Równikowa','Afryka',72],['Kamerun','Afryka',81],['Mali','Afryka',79],
    ['Maroko','Afryka',90],['Namibia','Afryka',69],['Nigeria','Afryka',84],
    ['RPA','Afryka',79],['Rwanda','Afryka',72],['Senegal','Afryka',86],
    ['Tunezja','Afryka',80],['Uganda','Afryka',72],
    ['Wybrzeże Kości Słoniowej','Afryka',82],['Zambia','Afryka',75],

    ['Arabia Saudyjska','Azja',80],['Bhutan','Azja',50],['Chiny','Azja',72],
    ['Filipiny','Azja',64],['Irak','Azja',77],['Iran','Azja',85],
    ['Japonia','Azja',86],['Jordania','Azja',76],['Kambodża','Azja',59],
    ['Katar','Azja',79],['Kirgistan','Azja',69],['Korea Południowa','Azja',83],
    ['Laos','Azja',56],['Malediwy','Azja',55],['Mongolia','Azja',54],
    ['Nepal','Azja',56],['Sri Lanka','Azja',53],['Tadżykistan','Azja',68],
    ['Turkmenistan','Azja',64],['Uzbekistan','Azja',78],['Wietnam','Azja',69],

    ['Australia','Oceania',83],['Fidżi','Oceania',62],
    ['Nowa Zelandia','Oceania',76],['Papua-Nowa Gwinea','Oceania',61],
    ['Vanuatu','Oceania',59],['Wyspy Salomona','Oceania',67],

    ['Belize','Ameryka Środkowa',55],['Costa Rica','Ameryka Środkowa',78],
    ['Gwatemala','Ameryka Środkowa',74],['Honduras','Ameryka Środkowa',72],
    ['Jamajka','Ameryka Środkowa',78],['Kuba','Ameryka Środkowa',66],
    ['Nikaragua','Ameryka Środkowa',68],['Panama','Ameryka Środkowa',79],
    ['Salwador','Ameryka Środkowa',69],['Trynidad i Tobago','Ameryka Środkowa',72]
  ];

  function tierFromOvr(ovr) {
    if (ovr >= 89) return 1;
    if (ovr >= 84) return 2;
    if (ovr >= 78) return 3;
    if (ovr >= 68) return 4;
    return 5;
  }

  const teams = TEAM_ROWS.map(([name, zone, baseOvr]) => ({
    name,
    zone,
    baseOvr,
    tier: tierFromOvr(baseOvr),
    range: [Math.max(1, baseOvr - 2), Math.min(99, baseOvr + 2)]
  }));

  const situations = {
    ATAK: [
      {text:'Wychodzisz sam na sam z obrońcą na 18. metrze.',options:[
        {label:'Strzelam od razu',tag:'shot_direct'},
        {label:'Próbuję zmylić obrońcę dryblingiem',tag:'dribble_risky'},
        {label:'Zwalniam, szukam lepszej pozycji',tag:'pass_safe'}]},
      {text:'Piłka odbija się do Ciebie w polu karnym, bramkarz wyszedł do przodu.',options:[
        {label:'Uderzenie w pierwszej piłce',tag:'shot_direct'},
        {label:'Próbuję przelobować bramkarza',tag:'shot_chip'},
        {label:'Przyjęcie i podanie do wolnego kolegi',tag:'pass_safe'}]},
      {text:'Dośrodkowanie leci prosto na Ciebie w polu karnym.',options:[
        {label:'Strzał głową',tag:'shot_header'},
        {label:'Zgranie głową do kolegi z tyłu',tag:'pass_safe'}]},
      {text:'Masz przestrzeń 20 metrów od bramki, nikt Cię nie atakuje.',options:[
        {label:'Strzał z dystansu',tag:'shot_long'},
        {label:'Podanie prostopadłe do napastnika',tag:'pass_risky'},
        {label:'Trzymam piłkę, czekam na wsparcie',tag:'hold_up'}]},
      {text:'Dryblujesz w polu karnym, dwóch obrońców blokuje drogę.',options:[
        {label:'Próbuję przejść siłą',tag:'dribble_risky'},
        {label:'Cofam piłkę, budujemy jeszcze raz',tag:'pass_safe'},
        {label:'Trzymam piłkę, czekam na wsparcie',tag:'hold_up'}]},
      {text:'Masz rzut wolny w dogodnej pozycji pod polem karnym.',options:[
        {label:'Uderzam sam',tag:'shot_setpiece'},
        {label:'Wystawiam koledze do dogrania',tag:'pass_safe'}]}
    ],
    SRODEK: [
      {text:'Masz piłkę na środku pola, obrona rywala się cofa.',options:[
        {label:'Podanie proste, budujemy spokojnie',tag:'pass_safe'},
        {label:'Podanie prostopadłe za linię obrony',tag:'pass_risky'},
        {label:'Sam ruszam do przodu z piłką',tag:'dribble_risky'}]},
      {text:'Rywal naciska wysoko, masz ułamek sekundy na decyzję.',options:[
        {label:'Oddaję piłkę najbliższemu koledze',tag:'pass_safe'},
        {label:'Próbuję zwodu i wyjścia z presji',tag:'dribble_risky'},
        {label:'Trzymam piłkę, osłaniam ciałem',tag:'hold_up'}]},
      {text:'Widzisz niepilnowanego napastnika w polu karnym.',options:[
        {label:'Bezpieczne podanie do nogi',tag:'pass_safe'},
        {label:'Ryzykowne podanie w bieg za obrońców',tag:'pass_risky'}]},
      {text:'Masz czas na rozegranie rzutu rożnego.',options:[
        {label:'Krótki, bezpieczny wariant',tag:'pass_safe'},
        {label:'Dośrodkowanie prosto w pole karne',tag:'pass_risky'}]},
      {text:'Ruszasz kontratakiem przez środek pola.',options:[
        {label:'Zwalniam grę, czekam na wsparcie',tag:'pass_safe'},
        {label:'Idę na przyspieszenie',tag:'dribble_risky'},
        {label:'Podaję prostopadle za obronę',tag:'pass_risky'}]},
      {text:'Piłka wraca do Ciebie po rozegranym stałym fragmencie.',options:[
        {label:'Uderzenie z dystansu',tag:'shot_long'},
        {label:'Rozgrywam do skrzydła',tag:'pass_safe'}]}
    ],
    OBRONA: [
      {text:'Napastnik rywala idzie sam na Ciebie.',options:[
        {label:'Wchodzę ostro w odbiór',tag:'tackle_hard'},
        {label:'Spycham go na bok, gram bezpiecznie',tag:'tackle_safe'},
        {label:'Celowo fauluję, zatrzymuję kontrę',tag:'tackle_professional'}]},
      {text:'Dośrodkowanie leci w pole karne, trwa walka w powietrzu.',options:[
        {label:'Idę w pojedynek powietrzny',tag:'tackle_hard'},
        {label:'Ustawiam się i wybijam na róg',tag:'tackle_safe'}]},
      {text:'Rywal próbuje minąć Cię dryblingiem.',options:[
        {label:'Agresywny odbiór',tag:'tackle_hard'},
        {label:'Cierpliwie czekam na jego błąd',tag:'tackle_safe'},
        {label:'Celowo fauluję, zatrzymuję akcję',tag:'tackle_professional'}]},
      {text:'Masz piłkę pod presją na własnej połowie.',options:[
        {label:'Krótkie, bezpieczne wybicie',tag:'pass_safe'},
        {label:'Próbuję rozegrać od tyłu',tag:'pass_risky'},
        {label:'Trzymam piłkę, czekam na wsparcie',tag:'hold_up'}]},
      {text:'Rzut wolny rywala niedaleko Twojego pola karnego.',options:[
        {label:'Wchodzę w mur, blokuję strzał',tag:'tackle_hard'},
        {label:'Pilnuję rywala przy słupku',tag:'tackle_safe'}]},
      {text:'Sytuacja sam na sam w polu karnym — tylko Ty i napastnik rywala.',options:[
        {label:'Idę zdecydowanie w odbiór',tag:'tackle_hard'},
        {label:'Zwlekam, licząc na jego błąd',tag:'tackle_safe'},
        {label:'Celowo fauluję, nie dam mu strzelić',tag:'tackle_professional'}]}
    ]
  };

  global.NSSNationalData = Object.freeze({
    version: '0.69-transfer-1',
    teams,
    situations,
    scorerRoles: ['napastnik','napastnik','napastnik','pomocnik','pomocnik','obrońca'],
    config: Object.freeze({
      polandBaseOvr: 85,
      tournamentFormSpread: 2,
      goldenGenerationChance: 8,
      goldenGenerationOvr: [90, 91, 92],
      worldSlots: Object.freeze({
        UEFA:{direct:16,playoff:0},
        AFC:{direct:8,playoff:1},
        CAF:{direct:9,playoff:1},
        CONCACAF:{direct:6,playoff:2},
        CONMEBOL:{direct:6,playoff:1},
        OFC:{direct:1,playoff:1}
      })
    })
  });
})(typeof window !== 'undefined' ? window : globalThis);
