/*
 * NSS — gotowy kontroler łączący czysty silnik turnieju i meczu z DOM-em.
 *
 * Zależności (w tej kolejności):
 * 01-nss-dane-reprezentacji.js
 * 02-nss-silnik-meczowy.js
 * 03-nss-turnieje.js
 * 04-nss-turnieje-ui.css
 * 05-nss-turnieje-ui.html
 */
(function (global) {
  'use strict';

  if(!global.NSSMatchEngine||!global.NSSTournamentEngine){
    throw new Error('Brakuje NSSMatchEngine lub NSSTournamentEngine.');
  }

  const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  function createController(config) {
    const root=typeof config.root==='string'?document.querySelector(config.root):config.root;
    if(!root)throw new Error('Nie znaleziono elementu interfejsu turnieju.');
    const tournament=config.tournamentEngine||global.NSSTournamentEngine.createEngine();
    const match=config.matchEngine||global.NSSMatchEngine.createEngine();
    const hooks={
      getPlayer:config.getPlayer||(()=>({overall:65,position:'MID',status:'Podstawowy'})),
      applyPlayerPatch:config.applyPlayerPatch||(()=>{}),
      log:config.log||(()=>{}),
      setHostVisible:config.setHostVisible||(()=>{}),
      onTournamentComplete:config.onTournamentComplete||(()=>{})
    };

    const overview=root.querySelector('[data-nss-view="overview"]');
    const matchView=root.querySelector('[data-nss-view="match"]');
    const el=name=>root.querySelector(`[data-nss="${name}"]`);
    const speedButtons=[...root.querySelectorAll('[data-nss-speed]')];
    const delays=config.delays||{slow:2400,normal:1300,fast:550};
    let speed='normal';

    speedButtons.forEach(button=>button.addEventListener('click',()=>{
      speed=button.dataset.nssSpeed;
      speedButtons.forEach(item=>item.classList.toggle('nss-active',item===button));
    }));

    function show(which) {
      overview.classList.toggle('nss-hidden',which!=='overview');
      matchView.classList.toggle('nss-hidden',which!=='match');
    }

    function primaryButton(label) {
      return new Promise(resolve=>{
        const actions=el('actions');
        actions.innerHTML='';
        const button=document.createElement('button');
        button.type='button';
        button.className='nss-button nss-primary';
        button.textContent=label;
        button.onclick=resolve;
        actions.appendChild(button);
      });
    }

    async function overviewScreen({kicker,title,summary,content,button}) {
      show('overview');
      el('kicker').textContent=kicker;
      el('title').textContent=title;
      el('summary').textContent=summary||'';
      el('content').innerHTML=content||'';
      await primaryButton(button||'DALEJ →');
    }

    function tableHtml(rows,{third=false,thirdAdvance=8}={}) {
      const body=rows.map((row,index)=>{
        const gd=row.gf-row.ga;
        const classes=[
          row.team.isPoland?'nss-poland':'',
          third&&index===thirdAdvance-1?'nss-cut':'',
          !third&&index===1?'nss-cut':''
        ].filter(Boolean).join(' ');
        return `<tr class="${classes}">
          <td>${index+1}</td><td>${escapeHtml(row.team.name)}</td>
          ${third?`<td>${escapeHtml(row.group)}</td>`:''}
          <td>${row.played}</td><td>${row.pts}</td><td>${row.gf}:${row.ga}</td>
          <td>${gd>0?'+':''}${gd}</td><td>${row.team.strength}</td>
        </tr>`;
      }).join('');
      return `<div class="nss-table-wrap"><table class="nss-table"><thead><tr>
        <th>#</th><th>Drużyna</th>${third?'<th>Grupa</th>':''}
        <th>M</th><th>Pkt</th><th>Bramki</th><th>Bilans</th><th>OVR</th>
      </tr></thead><tbody>${body}</tbody></table></div>`;
    }

    function resultListHtml(results) {
      return `<div class="nss-results">${results.map(item=>
        `<div class="nss-result">${escapeHtml(item.a.name)}
          <span class="nss-score-inline">${item.gf}:${item.ga}</span><br>
          ${escapeHtml(item.b.name)}</div>`
      ).join('')}</div>`;
    }

    function bracketHtml(matches,withScores=false) {
      return `<div class="nss-bracket">${matches.map(item=>{
        const poland=item.a.isPoland||item.b.isPoland;
        const suffix=withScores&&item.result
          ? `${item.result.gf}:${item.result.ga}${item.result.penalties?' k.':item.result.extra?' d.':''}`
          : '';
        return `<div class="nss-bracket-match${poland?' nss-poland':''}">
          ${escapeHtml(item.a.name)}
          ${suffix?`<span class="nss-score-inline">${suffix}</span>`:''}<br>
          ${escapeHtml(item.b.name)}</div>`;
      }).join('')}</div>`;
    }

    function appendMatchLine(text,className='') {
      const line=document.createElement('div');
      line.className=`nss-log-line ${className}`.trim();
      line.textContent=text;
      el('match-log').appendChild(line);
      el('match-log').scrollTop=el('match-log').scrollHeight;
    }

    function updateScore(score) {
      el('match-score').textContent=`${score.poland} : ${score.opponent}`;
    }

    function wait(ms) { return new Promise(resolve=>setTimeout(resolve,ms)); }

    const SKILLS=global.NSSMatchEngine.SKILLS;
    const ATTR_GROUPS=global.NSSMatchEngine.ATTR_GROUPS;
    const ATTR_LABELS=global.NSSMatchEngine.ATTR_LABELS;
    const SKILL_LABELS=Object.fromEntries(SKILLS.map(([key,label])=>[key,label]));

    function updateStatusPanel(session) {
      const status=session.getStatus();
      const s=status.stats;
      el('stat-rating').textContent=s.rating.toFixed(1);
      el('stat-personal').textContent=`${status.personalEventsSeen} / ${status.personalTarget}`;
      el('stat-goals').textContent=s.goals;
      el('stat-assists').textContent=s.assists;
      el('stat-shots').textContent=`${s.shots} / ${s.shotsOn}`;
      el('stat-passes').textContent=`${s.passesOk} / ${s.passes}`;
      el('stat-dribbles').textContent=`${s.dribblesOk} / ${s.dribbles}`;
      el('stat-tackles').textContent=`${s.tacklesOk} / ${s.tackles}`;
      el('stat-turnovers').textContent=s.turnovers;
      const cards=el('stat-cards');
      if(cards) cards.textContent=s.yellowCards||s.redCards?`🟨 ${s.yellowCards} • 🟥 ${s.redCards}`:'—';
      el('condition-meter').style.width=`${status.conditionPct.toFixed(0)}%`;
      el('condition-text').textContent=`Kondycja ${status.conditionPct.toFixed(0)}% • zużycie tylko meczowe`;
      return status;
    }

    function renderSkillBars(status) {
      const wrap=el('skill-bars');
      wrap.innerHTML='';
      Object.entries(ATTR_LABELS).forEach(([key,label])=>{
        const value=status.current[key];
        const row=document.createElement('div');
        row.className='nss-skill-row';
        row.dataset.nssSkillRow=key;
        row.innerHTML=`<span>${escapeHtml(label)}</span><div class="nss-mini-track"><div class="nss-mini-fill" style="width:${clampPct(value)}%"></div></div><b>${(value*30/99).toFixed(1)}</b>`;
        wrap.appendChild(row);
      });
    }
    function clampPct(v){ return Math.max(0,Math.min(100,v/99*100)); }

    function flashSkillRow(key) {
      if(!key) return;
      const row=root.querySelector(`[data-nss-skill-row="${key}"]`);
      if(!row) return;
      row.classList.remove('nss-flash');
      void row.offsetWidth;
      row.classList.add('nss-flash');
    }

    async function playMatch({kicker,homeName='Polska',fixture,knockout}) {
      show('match');
      const player=hooks.getPlayer();
      const session=match.createMatch({
        player,
        homeName,
        polandStrength:fixture.poland.strength,
        opponent:fixture.opponent,
        knockout
      });
      el('match-kicker').textContent=kicker;
      el('match-title').textContent=`${homeName} vs ${fixture.opponent.name}`;
      el('match-score').textContent='0 : 0';
      el('match-meta').textContent=`Siła: ${homeName} ${Math.round(session.meta.home.effectiveRating)} • ${fixture.opponent.name} ${fixture.opponent.strength}${fixture.poland.goldenGeneration?' • ZŁOTE POKOLENIE':''}`;
      el('match-log').innerHTML='';
      el('match-actions').innerHTML='';
      el('decision').classList.add('nss-hidden');
      appendMatchLine(session.meta.roleText);
      updateStatusPanel(session);

      await new Promise(resolve=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='nss-button nss-primary';
        button.textContent='GRAMY →';
        button.onclick=resolve;
        el('match-actions').appendChild(button);
      });
      el('match-actions').innerHTML='';

      // Prezentuje jedną decyzję (świeżą albo kontynuację łańcucha) i zwraca wybór gracza.
      function presentDecision(event) {
        return new Promise(resolve=>{
          const ctx=event.context;
          let selected=ctx.type==='setpiece' ? ['setPiece'] : [];
          let secondary=null;

          el('decision').classList.remove('nss-hidden');
          el('decision-title').textContent=event.text;
          el('secondary-actions').innerHTML='';

          function currentStatus(){ return session.getStatus(); }

          function renderButtons(){
            const wrap=el('skill-buttons');
            wrap.innerHTML='';
            SKILLS.forEach(([key,label])=>{
              const b=document.createElement('button');
              b.type='button';
              b.className='nss-skill-btn';
              b.textContent=label;
              b.disabled=!ctx.allowed.includes(key);
              b.classList.toggle('nss-selected',selected.includes(key));
              b.onclick=()=>{
                selected=session.toggleSkill(selected,key);
                secondary=null;
                renderButtons();
                renderSecondary();
                el('tip').textContent=session.getTip(selected,secondary);
              };
              wrap.appendChild(b);
            });
          }
          function renderSecondary(){
            const wrap=el('secondary-actions');
            wrap.innerHTML='';
            const options=session.getSecondaryOptions(selected);
            if(!options.length) return;
            if(!secondary) secondary=options[0][0];
            options.forEach(([key,label])=>{
              const b=document.createElement('button');
              b.type='button';
              b.className=secondary===key?'nss-active':'';
              b.textContent=label;
              b.onclick=()=>{ secondary=key; renderSecondary(); el('tip').textContent=session.getTip(selected,secondary); };
              wrap.appendChild(b);
            });
          }

          renderButtons();
          renderSecondary();
          renderSkillBars(currentStatus());
          el('tip').textContent=session.getTip(selected,secondary)||'Wybierz umiejętność i naciśnij Graj.';

          function finish(){
            el('clear-btn').onclick=null;
            el('play-btn').onclick=null;
            resolve({selected,secondary});
          }

          el('clear-btn').onclick=()=>{
            selected=[]; secondary=null;
            renderButtons(); renderSecondary();
            el('tip').textContent=session.getTip(selected,secondary);
          };
          el('play-btn').onclick=finish;
        });
      }

      while(true){
        await wait(delays[speed]);
        const event=session.next();
        updateScore(event.score);

        if(event.type==='substitution'){
          appendMatchLine(event.text);
          continue;
        }
        if(event.type==='commentary'){
          appendMatchLine(`${event.minute}' ${event.text}`,event.goal?'nss-goal':'');
          flashSkillRow(event.flashKey);
          updateStatusPanel(session);
          continue;
        }
        if(event.type==='decision'){
          appendMatchLine(`${event.minute}' ${event.text}`,'nss-decision');
          const {selected,secondary}=await presentDecision(event);
          el('decision').classList.add('nss-hidden');

          const outcome=session.choose(selected,secondary);
          updateScore(outcome.score);
          appendMatchLine(
            outcome.effect.text,
            outcome.effect.kind==='goal'||outcome.effect.kind==='assist'?'nss-goal':''
          );
          flashSkillRow(outcome.flashKey);
          updateStatusPanel(session);

          if(outcome.chained){
            await wait(600);
          }
          continue;
        }
        if(event.type==='finished'){
          event.notes.forEach(note=>appendMatchLine(note));
          const result=event.result;
          const label=result.gf>result.ga?'WYGRANA':result.gf<result.ga?'PRZEGRANA':'REMIS';
          appendMatchLine(`KONIEC: ${homeName} ${result.gf}:${result.ga} ${fixture.opponent.name} — ${label}.`,'nss-final');
          hooks.applyPlayerPatch(result.playerPatch||{});
          hooks.log(
            `${kicker}: ${homeName} ${result.gf}:${result.ga} ${fixture.opponent.name}`,
            label
          );
          await new Promise(resolve=>{
            const button=document.createElement('button');
            button.type='button';
            button.className='nss-button nss-primary';
            button.textContent='DALEJ →';
            button.onclick=resolve;
            el('match-actions').appendChild(button);
          });
          return result;
        }
      }
    }

    async function playTournament({kind,year,qualifiedTeamNames}) {
      root.classList.remove('nss-hidden');
      hooks.setHostVisible(false);
      const field=tournament.createField(kind,qualifiedTeamNames);
      const poland=field.find(team=>team.isPoland);
      const stats={goals:0,assists:0};
      const polandMatches=[];
      if(poland.goldenGeneration)hooks.log(
        `🌟 ZŁOTE POKOLENIE POLSKI — OVR ${poland.strength}.`,
        `${kind==='WORLD'?'MUNDIAL':'EURO'} ${year}`
      );

      const groups=tournament.createGroupStage(kind,field);
      const label=kind==='WORLD'?'MUNDIAL':'EURO';
      const thirdAdvance=kind==='WORLD'?8:4;
      await overviewScreen({
        kicker:`${label} ${year} • FAZA GRUPOWA`,
        title:`Polska w grupie ${groups.polandGroup}`,
        summary:'Przed tobą trzy mecze. Tabela jest aktualizowana po każdej kolejce.',
        content:`<section><h3>Grupa ${groups.polandGroup}</h3>${tableHtml(groups.getPolandTable())}</section>`,
        button:'ZAGRAJ 1. KOLEJKĘ →'
      });

      for(let round=0;round<3;round++){
        const fixture=groups.prepareRound(round);
        const result=await playMatch({
          kicker:`${label} ${year} • GRUPA ${groups.polandGroup} • KOLEJKA ${round+1}/3`,
          fixture,knockout:false
        });
        stats.goals+=result.myGoals||0;
        stats.assists+=result.myAssists||0;
        groups.recordPolandMatch(round,result);
        polandMatches.push({
          phase:`GRUPA ${groups.polandGroup} • ${round+1}. KOLEJKA`,
          opponent:fixture.opponent.name,gf:result.gf,ga:result.ga
        });
        if(round<2){
          await overviewScreen({
            kicker:`${label} ${year} • PO ${round+1}. KOLEJCE`,
            title:`Tabela grupy ${groups.polandGroup}`,
            summary:'Wszystkie grupy rozegrały tę samą kolejkę.',
            content:`<section><h3>Tabela</h3>${tableHtml(groups.getPolandTable())}</section>
              <section><h3>Wyniki kolejki</h3>${resultListHtml(groups.getRoundResults(round))}</section>`,
            button:`ZAGRAJ ${round+2}. KOLEJKĘ →`
          });
        }
      }

      const groupResult=groups.finish();
      await overviewScreen({
        kicker:`${label} ${year} • KONIEC FAZY GRUPOWEJ`,
        title:`${groupResult.polandPosition}. miejsce Polski w grupie ${groupResult.polandGroup}`,
        summary:groupResult.polandQualified?'Polska awansuje do fazy pucharowej.':'Polska odpada po fazie grupowej.',
        content:`<section><h3>Końcowa tabela grupy</h3>${tableHtml(groupResult.rankings[groupResult.polandGroup])}</section>
          <section><h3>Tabela trzecich miejsc</h3>${tableHtml(groupResult.allThirds,{third:true,thirdAdvance})}
          <p class="nss-note">Gruba linia oddziela zespoły awansujące.</p></section>`,
        button:groupResult.polandQualified?'PRZEJDŹ DO FAZY PUCHAROWEJ →':'ZAKOŃCZ TURNIEJ →'
      });

      if(!groupResult.polandQualified){
        const outcome={kind,year,champion:false,stage:'faza grupowa',stats,field,groupResult,polandMatches};
        hooks.onTournamentComplete(outcome);
        hooks.setHostVisible(true);
        root.classList.add('nss-hidden');
        return outcome;
      }

      const knockout=tournament.createKnockout(kind,groupResult.qualifiedTeams);
      while(true){
        const round=knockout.getRound();
        const polandMatch=knockout.getPolandMatch();
        const fixture={
          poland:polandMatch.a.isPoland?polandMatch.a:polandMatch.b,
          opponent:polandMatch.a.isPoland?polandMatch.b:polandMatch.a
        };
        await overviewScreen({
          kicker:`${label} ${year} • ${round.name}`,
          title:`Polska zagra z ${fixture.opponent.name}`,
          summary:'Pary wynikają ze stałej drabinki. Nie ma ponownego losowania.',
          content:`<section><h3>Pary — ${round.name}</h3>${bracketHtml(round.matches)}</section>`,
          button:'ZAGRAJ MECZ POLSKI →'
        });
        const result=await playMatch({kicker:`${label} ${year} • ${round.name}`,fixture,knockout:true});
        stats.goals+=result.myGoals||0;
        stats.assists+=result.myAssists||0;
        polandMatches.push({phase:round.name,opponent:fixture.opponent.name,gf:result.gf,ga:result.ga});
        const resolved=knockout.resolveRound(result);

        if(resolved.finished){
          const polandChampion=resolved.champion?.isPoland;
          const title=polandChampion
            ? `🏆 POLSKA MISTRZEM ${kind==='WORLD'?'ŚWIATA':'EUROPY'}!`
            : `Polska odpada w rundzie ${round.name}`;
          await overviewScreen({
            kicker:`${label} ${year} • ${round.name}`,
            title,
            summary:polandChampion
              ? `Polska wygrywa ${kind==='WORLD'?'mundial':'EURO'}.`
              : `Mistrzem zostaje ${resolved.champion.name}.`,
            content:`<section><h3>Wyniki</h3>${bracketHtml(resolved.matches,true)}</section>`,
            button:polandChampion?'ODBIERZ PUCHAR →':'ZAKOŃCZ TURNIEJ →'
          });
          const outcome={
            kind,year,champion:!!polandChampion,
            stage:polandChampion?(kind==='WORLD'?'MISTRZOSTWO ŚWIATA':'MISTRZOSTWO EUROPY'):round.name,
            tournamentChampion:resolved.champion.name,
            stats,field,groupResult,polandMatches
          };
          hooks.onTournamentComplete(outcome);
          hooks.setHostVisible(true);
          root.classList.add('nss-hidden');
          return outcome;
        }

        await overviewScreen({
          kicker:`${label} ${year} • ${round.name}`,
          title:'Polska gra dalej',
          summary:'Cała runda została rozegrana.',
          content:`<section><h3>Wyniki</h3>${bracketHtml(resolved.matches,true)}</section>`,
          button:'ZOBACZ KOLEJNĄ RUNDĘ →'
        });
        knockout.advance();
      }
    }

    async function playStandaloneMatch(params) {
      root.classList.remove('nss-hidden');
      hooks.setHostVisible(false);
      const result = await playMatch(params);
      hooks.setHostVisible(true);
      root.classList.add('nss-hidden');
      return result;
    }

    return {playTournament,playStandaloneMatch,tournamentEngine:tournament,matchEngine:match};
  }

  global.NSSTournamentUI=Object.freeze({
    version:'0.79-clean-interface',
    createController
  });
})(typeof window !== 'undefined' ? window : globalThis);
