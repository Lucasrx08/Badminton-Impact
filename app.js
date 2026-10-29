/* Badminton Impact V2 — EPS · L. RIGAUX — données locales. */
(function badmintonAppV2(){
  'use strict';

  const STORE_V2 = 'rigaux-badminton-impact-v2';
  const STORE_V1 = 'rigaux-badminton-impact-v1';
  const MODES = {
    baston: { label: 'LA BASTON', net: 'SANS FILET', levels: [{ level: 1, min: 30 }, { level: 2, min: 40 }] },
    carre: { label: 'LE CARRÉ MAGIQUE', net: 'FILET ABAISSÉ', levels: [{ level: 1, min: 40 }, { level: 2, min: 50 }, { level: 3, min: 60 }] },
    roi: { label: 'LE ROI DU TERRAIN', net: 'FILET NORMAL', levels: [{ level: 2, min: 60 }, { level: 3, min: 70 }, { level: 4, min: 80 }] }
  };
  const ZONES = {
    river: 'Rivière', 'trajectory-above': 'Au-dessus du sur-filet',
    'trajectory-under': 'En dessous du sur-filet',
    'fault-net': 'Filet', 'fault-out': 'Hors du terrain',
    fault: 'Faute adverse',
    'front-top': 'Avant haut', 'front-bottom': 'Avant bas',
    'back-top': 'Fond haut', 'back-bottom': 'Fond bas'
  };
  const LETTERS = 'ABCD';
  const PAIRS = { 3: [[0,1],[0,2],[1,2]], 4: [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]] };
  const $ = id => document.getElementById(id);
  const makeSession = size => ({
    players: Array.from({length:size}, (_,i)=>`Joueur ${LETTERS[i]}`),
    matchNumber: 1, scores: [0,0], selectedScorer: 0, events: [], completed: [], pairOverride: null
  });
  const defaultState = () => ({
    version: 2,
    sessions: Object.fromEntries(Object.keys(MODES).map(mode => [mode, {'3':makeSession(3),'4':makeSession(4)}]))
  });

  function safeNumber(x) { return Number.isFinite(Number(x)) ? Math.max(0,Number(x)) : 0; }
  function restoreSession(s, size) {
    const base = makeSession(size);
    if (!s || typeof s !== 'object') return base;
    base.players = base.players.map((name,i) => typeof s.players?.[i] === 'string' ? s.players[i].slice(0,36) : name);
    base.matchNumber = Number.isInteger(s.matchNumber) && s.matchNumber > 0 ? s.matchNumber : 1;
    base.scores = [safeNumber(s.scores?.[0]), safeNumber(s.scores?.[1])];
    base.selectedScorer = s.selectedScorer === 1 ? 1 : 0;
    base.events = Array.isArray(s.events) ? s.events.slice(-1000) : [];
    base.completed = Array.isArray(s.completed) ? s.completed.slice(-500) : [];
    if (Array.isArray(s.pairOverride) && s.pairOverride.every(i => Number.isInteger(i) && i >= 0 && i < size) && s.pairOverride.length === 2) {
      base.pairOverride = [...s.pairOverride];
    }
    return base;
  }
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_V2) || 'null');
      if (saved?.version === 2 && saved.sessions) {
        const result = defaultState();
        Object.keys(MODES).forEach(mode => {
          [3,4].forEach(size => {
            result.sessions[mode][size] = restoreSession(saved.sessions[mode]?.[size],size);
          });
        });
        return result;
      }
      const old = JSON.parse(localStorage.getItem(STORE_V1) || 'null');
      if (old?.version === 1 && old.sessions) {
        const migrated = defaultState();
        Object.keys(MODES).forEach(mode => {
          const entry = old.sessions[mode];
          if (!entry) return;
          const s = migrated.sessions[mode]['3'];
          s.players[0] = old.players?.[0] || s.players[0];
          s.players[1] = old.players?.[1] || s.players[1];
          s.matchNumber = Number.isInteger(entry.matchNumber) && entry.matchNumber > 0 ? entry.matchNumber : 1;
          s.scores = [safeNumber(entry.scores?.[0]), safeNumber(entry.scores?.[1])];
          s.events = Array.isArray(entry.events) ? entry.events.slice(-1000) : [];
          s.completed = Array.isArray(entry.completed) ? entry.completed.map(match => ({
            ...match, pair: [0,1]
          })) : [];
          if (s.events.length || s.scores.some(Boolean)) s.pairOverride = [0,1];
        });
        return migrated;
      }
    } catch (e) { /* Une sauvegarde illisible n'empêche pas de jouer. */ }
    return defaultState();
  }

  let state = loadState();
  let selectedMode = null;
  let selectedSize = 3;
  let currentView = 'home';
  let feedbackTimer = 0;
  const current = () => state.sessions[selectedMode][selectedSize];
  const playerName = index => current().players[index]?.trim() || `Joueur ${LETTERS[index]}`;
  const pairings = () => PAIRS[selectedSize];
  const activePair = () => current().pairOverride || pairings()[(current().matchNumber - 1) % pairings().length];

  function persist() {
    try { localStorage.setItem(STORE_V2,JSON.stringify(state)); }
    catch(e) { if(currentView === 'game') feedback('Sauvegarde indisponible'); }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function navigate(view) {
    currentView = view;
    ['home','pool','game'].forEach(name => { $(name+'View').hidden = view !== name; });
    window.scrollTo(0,0);
    if (view === 'pool') renderPool();
    if (view === 'game') renderGame();
  }

  function renderPool() {
    if (!selectedMode) return;
    $('poolModeKicker').textContent = MODES[selectedMode].label;
    document.querySelectorAll('[data-pool-size]').forEach(btn => btn.setAttribute('aria-pressed',String(Number(btn.dataset.poolSize) === selectedSize)));
    const s = current();
    $('rosterFields').innerHTML = s.players.map((name,i) =>
      `<label class="roster-field"><span class="roster-letter">${LETTERS[i]}</span><input type="text" maxlength="36" data-roster-index="${i}" value="${escapeHtml(name)}" aria-label="Prénom du joueur ${LETTERS[i]}"></label>`
    ).join('');
    const p = pairings();
    $('poolPreviewTitle').textContent = `${p.length} rencontres par tour`;
    $('schedulePreview').innerHTML = p.map((pair,i) =>
      `<div class="preview-row"><span>MATCH ${String(i+1).padStart(2,'0')}</span><span>${LETTERS[pair[0]]} · ${escapeHtml(playerName(pair[0]))} <b>VS</b> ${LETTERS[pair[1]]} · ${escapeHtml(playerName(pair[1]))}</span></div>`
    ).join('');
  }

  function scoreLevel(points) {
    let level = null;
    MODES[selectedMode].levels.forEach(rule => { if (points > rule.min) level = rule.level; });
    return level;
  }
  function playerTotals() {
    const s = current();
    const totals = s.players.map(() => ({points:0,wins:0,played:0}));
    s.completed.forEach(match => {
      const pair = Array.isArray(match.pair) ? match.pair : [0,1];
      if (!totals[pair[0]] || !totals[pair[1]]) return;
      const a = safeNumber(match.scores?.[0]);
      const b = safeNumber(match.scores?.[1]);
      totals[pair[0]].points += a;
      totals[pair[1]].points += b;
      totals[pair[0]].played++;
      totals[pair[1]].played++;
      if (a > b) totals[pair[0]].wins++;
      if (b > a) totals[pair[1]].wins++;
    });
    const pair = activePair();
    totals[pair[0]].points += s.scores[0];
    totals[pair[1]].points += s.scores[1];
    return totals;
  }
  function render3DCourt(last){
    const svg = document.getElementById('courtArtwork');
    if (!svg) return;
    const farL={x:300,y:221},farR={x:792,y:305},nearL={x:93,y:515},nearR={x:626,y:603};
    const pt=(x,t)=>{
      const lx=farL.x+(nearL.x-farL.x)*t,ly=farL.y+(nearL.y-farL.y)*t;
      const rx=farR.x+(nearR.x-farR.x)*t,ry=farR.y+(nearR.y-farR.y)*t;
      return{x:lx+(rx-lx)*x,y:ly+(ry-ly)*x};
    };
    const round=n=>Math.round(n*10)/10;
    const xy=p=>`${round(p.x)},${round(p.y)}`;
    const outline=[farL,farR,nearR,nearL].map(xy).join(' ');
    const quad=(x1,t1,x2,t2)=>[pt(x1,t1),pt(x2,t1),pt(x2,t2),pt(x1,t2)].map(xy).join(' ');
    const line=(p1,p2,color,width=4,extra='')=>`<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
    const selected=last?.zone||'';
    let html='';
    // Les zones vides sont une faute : un toucher hors des deux trajectoires donne le point à l'adversaire.
    html+=`<g class="scene-miss-zone" data-action="fault-out" role="button" tabindex="0" aria-label="Volant dehors ou autre zone : 1 point pour l'adversaire"><rect x="2" y="2" width="976" height="686" rx="30" fill="transparent"/></g>`;
    // Un seul rectangle : aucun trait central, aucune séparation avant/fond.
    html+=`<polygon points="${[farL,farR,{x:nearR.x+8,y:nearR.y+18},{x:nearL.x+8,y:nearL.y+18}].map(xy).join(' ')}" fill="#00683f" opacity=".86" pointer-events="none"/>`;
    html+=`<polygon points="${[farR,nearR,{x:nearR.x+8,y:nearR.y+18},{x:farR.x+8,y:farR.y+18}].map(xy).join(' ')}" fill="#074f37" pointer-events="none"/>`;
    html+=`<polygon points="${outline}" fill="url(#courtSurface)" stroke="#038F51" stroke-width="9" stroke-linejoin="round" pointer-events="none"/>`;
    html+=`<g class="river-3d${selected==='river'?' is-last':''}" data-action="river" role="button" tabindex="0" aria-label="Rivière rose, zéro point"><polygon points="${quad(0,0,1,.16)}" fill="#F098A5" stroke="${selected==='river'?'#C75875':'#E58293'}" stroke-width="${selected==='river'?6:2}"/></g>`;
    html+=line(pt(0,.16),pt(1,.16),'#038F51',6,'pointer-events="none"');
    html+=`<polygon points="${outline}" fill="none" stroke="#038F51" stroke-width="8" stroke-linejoin="round" pointer-events="none"/>`;
    const riverMid=pt(.50,.097);
    html+=`<text x="${round(riverMid.x)}" y="${round(riverMid.y+8)}" text-anchor="middle" transform="rotate(9 ${round(riverMid.x)} ${round(riverMid.y)})" class="river-3d-label" pointer-events="none">RIVIÈRE · 0 PT</text>`;
    // Filet classique : absent pour la Baston, abaissé pour le Carré, normal pour le Roi.
    const height=selectedMode==='baston'?0:selectedMode==='carre'?52:114;
    const meshLines=selectedMode==='carre'?3:7;
    if(height){
      html+=`<g class="net-miss-zone" data-action="fault-net" role="button" tabindex="0" aria-label="Volant dans le filet : 1 point pour l'adversaire">`;
      html+=`<polygon points="${[farL,farR,{x:farR.x,y:farR.y-height},{x:farL.x,y:farL.y-height}].map(xy).join(' ')}" fill="#e7eee6" fill-opacity=".38" stroke="#3F4942" stroke-width="2.4"/>`;
      for(let i=0;i<=27;i++){const p=pt(i/27,0);html+=line(p,{x:p.x,y:p.y-height},'#35423c',1.45,'opacity=".7"');}
      for(let j=1;j<meshLines;j++)html+=line({x:farL.x,y:farL.y-height*j/meshLines},{x:farR.x,y:farR.y-height*j/meshLines},'#35423c',1.6,'opacity=".70"');
      html+=line({x:farL.x,y:farL.y-height},{x:farR.x,y:farR.y-height},'#fff',7);
      html+=line({x:farL.x,y:farL.y-height},{x:farR.x,y:farR.y-height},'#747a6f',2);
      html+=`</g>`;
    }
    const ropeHeight=selectedMode==='roi'?160:selectedMode==='carre'?151:142;
    const ropeL={x:farL.x,y:farL.y-ropeHeight},ropeR={x:farR.x,y:farR.y-ropeHeight};
    html+=line(ropeL,ropeR,'#EFF700',8,'filter="url(#shuttleShade)"');
    html+=line({x:ropeL.x,y:ropeL.y-1},{x:ropeR.x,y:ropeR.y-1},'#FFFF83',2.5);
    for(const base of [farL,farR]){
      const top={x:base.x,y:base.y-ropeHeight-7};
      html+=`<line x1="${base.x+5}" y1="${base.y+8}" x2="${top.x+5}" y2="${top.y}" stroke="#263e32" opacity=".13" stroke-width="13" stroke-linecap="round" pointer-events="none"/>`;
      html+=line(base,top,'url(#netPole)',9,'filter="url(#shuttleShade)"');
      html+=`<circle cx="${top.x}" cy="${top.y}" r="5.3" fill="#fff" stroke="#859189" stroke-width="1.3" pointer-events="none"/>`;
    }
    const ropeCentre={x:(ropeL.x+ropeR.x)/2,y:(ropeL.y+ropeR.y)/2};
    html+=`<rect x="${round(ropeCentre.x-68)}" y="${round(ropeCentre.y-34)}" width="136" height="26" rx="13" fill="#2F4431" opacity=".93" pointer-events="none"/>`;
    html+=`<text x="${round(ropeCentre.x)}" y="${round(ropeCentre.y-16)}" text-anchor="middle" class="rope-title" pointer-events="none">SUR-FILET</text>`;
    const netLabel=selectedMode==='baston'?'SANS FILET':selectedMode==='carre'?'FILET ABAISSÉ':'FILET NORMAL';
    html+=`<text x="304" y="${round(farL.y-height-13)}" class="net-height-label" pointer-events="none">${netLabel}</text>`;
    // Deux véritables trajectoires tactiles, bien distinctes et directement sélectionnables.
    const trajectories=[
      {id:'trajectory-above',points:1,caption:'AU-DESSUS',path:'M 400 515 C 302 342 316 159 451 94 C 526 48 605 55 687 76',pillX:344,pillY:287,fill:'#EDE6E2',stroke:'#968769',tipX:687,tipY:76},
      {id:'trajectory-under',points:2,caption:'EN DESSOUS',path:'M 417 518 C 517 481 601 365 654 235 C 684 184 725 163 764 177',pillX:658,pillY:396,fill:'#B4D01A',stroke:'#A0BB0B',tipX:764,tipY:177}
    ];
    trajectories.forEach(tr=>{
      const active=selected===tr.id,opacity=active?1:.90;
      html+=`<g class="trajectory-touch${active?' is-last':''}" data-action="${tr.id}" role="button" tabindex="0" aria-label="Trajectoire ${tr.caption.toLowerCase()} du sur-filet, ${tr.points} point${tr.points===2?'s':''} pour le joueur qui frappe" opacity="${opacity}">`;
      html+=`<path d="${tr.path}" stroke="transparent" stroke-width="58" fill="none" stroke-linecap="round" class="trajectory-hit"/>`;
      html+=`<path d="${tr.path}" stroke="#fff" stroke-width="15" opacity=".9" fill="none" stroke-linecap="round" stroke-dasharray="18 13" filter="url(#shuttleShade)"/>`;
      html+=`<path d="${tr.path}" stroke="${tr.stroke}" stroke-width="${active?10:7}" fill="none" stroke-linecap="round" stroke-dasharray="18 13" class="trajectory-line"/>`;
      html+=`<circle cx="${tr.tipX}" cy="${tr.tipY}" r="12" fill="${tr.fill}" stroke="${tr.stroke}" stroke-width="4"/>`;
      html+=`<g transform="translate(${tr.pillX} ${tr.pillY}) rotate(9)">`;
      html+=`<rect x="-89" y="-38" width="178" height="76" rx="18" fill="${tr.fill}" stroke="${active?'#DF9E44':tr.stroke}" stroke-width="${active?5:2.7}" filter="url(#padShade)"/>`;
      html+=`<text x="0" y="-2" text-anchor="middle" class="trajectory-score">+${tr.points}</text>`;
      html+=`<text x="0" y="23" text-anchor="middle" class="trajectory-caption">${tr.caption}</text></g></g>`;
    });
    // Le volant de départ reste une illustration, les deux parcours restent les vrais boutons.
    html+=`<g transform="translate(396 521) rotate(-32)" filter="url(#shuttleShade)" pointer-events="none"><path d="M-12 -1 -29 -58 -17 -64 -2 -6Z" fill="#fff" stroke="#78877d" stroke-width="1.4"/><path d="M-8 -2 -12 -68 1 -70 4 -5Z" fill="#fafaf6" stroke="#748378" stroke-width="1.4"/><path d="M-2 -4 7 -64 20 -58 10 -1Z" fill="#fff" stroke="#77897b" stroke-width="1.4"/><path d="M-22 -41 11 -40M-19 -27 12 -27" stroke="#94a19a" stroke-width="2" fill="none"/><path d="M-12 -1Q0 8 11 -1L7 12Q0 17 -7 12Z" fill="#37483e" stroke="#fff" stroke-width="2"/><ellipse cx="0" cy="13" rx="7" ry="5" fill="#f6eee6" stroke="#737f76" stroke-width="1.5"/></g>`;
    // Les boutons de faute sont hors du rectangle, mais toute autre surface compte aussi comme faute.
    const faultActive=last?.kind==='fault-opponent';
    html+=`<g class="fault-visual-hotspot${faultActive?' is-last':''}" data-action="fault-out" role="button" tabindex="0" aria-label="Faute, volant dehors : un point pour l'adversaire" transform="translate(842 535)">`;
    html+=`<rect x="-105" y="-39" width="210" height="78" rx="17" fill="${faultActive?'#f7d4c2':'#f5e9dd'}" stroke="${faultActive?'#d78356':'#cdb9aa'}" stroke-width="${faultActive?5:2.5}" filter="url(#padShade)"/>`;
    html+=`<text x="0" y="-4" text-anchor="middle" class="fault-visual-title">DEHORS / FILET</text>`;
    html+=`<text x="0" y="21" text-anchor="middle" class="fault-visual-sub">+1 ADVERSAIRE</text></g>`;
    svg.innerHTML=html;
  }

  function renderScores() {
    const s = current();
    const pair = activePair();
    const round = Math.floor((s.matchNumber - 1) / pairings().length) + 1;
    $('gameModeKicker').textContent = `${MODES[selectedMode].label} · ${MODES[selectedMode].net}`;
    $('gameMatchTitle').textContent = `MATCH ${String(s.matchNumber).padStart(2,'0')}`;
    $('gamePairNames').textContent = `${playerName(pair[0])} contre ${playerName(pair[1])}`;
    $('roundBadge').textContent = `POULE DE ${selectedSize} · TOUR ${round}`;
    [0,1].forEach(slot => {
      $('playerName'+slot).textContent = playerName(pair[slot]);
      $('playerScore'+slot).textContent = s.scores[slot];
      const button = document.querySelector(`[data-scorer="${slot}"]`);
      const active = s.selectedScorer === slot;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',String(active));
      button.querySelector('.selected-text').textContent = active ? 'JOUE LE VOLANT' : 'TOUCHER POUR CHANGER';
    });
    $('selectedName').textContent = playerName(pair[s.selectedScorer]);
    $('undoButton').disabled = s.events.length === 0;
    $('finishButton').disabled = s.events.length === 0;
    $('netPill').textContent = MODES[selectedMode].net;
    render3DCourt(s.events.at(-1));
  }
  function renderRanking() {
    const totals = playerTotals();
    const rank = totals.map((t,i) => ({...t,i})).sort((a,b)=>b.wins-a.wins || b.points-a.points || a.i-b.i);
    $('rankingBody').innerHTML = rank.map(({i,wins,points}) => {
      const level = scoreLevel(points);
      return `<tr><td class="rank-name">${LETTERS[i]} · ${escapeHtml(playerName(i))}</td><td>${wins}</td><td>${points}</td><td class="rank-level">${level === null ? '—' : `N${level}`}</td></tr>`;
    }).join('');
    $('contractNote').textContent = MODES[selectedMode].levels.map(rule => `N${rule.level} : plus de ${rule.min} pts`).join(' · ') + ' · Points cumulés dans cette poule.';
  }
  function renderMatches() {
    const s = current();
    const first = Math.floor((s.matchNumber-1)/pairings().length)*pairings().length + 1;
    $('matchList').innerHTML = pairings().map((pair,i) => {
      const num = first+i;
      const done = s.completed.find(match => match.number === num);
      const isCurrent = s.matchNumber === num;
      const players = `${LETTERS[pair[0]]} · ${escapeHtml(playerName(pair[0]))} / ${LETTERS[pair[1]]} · ${escapeHtml(playerName(pair[1]))}`;
      return `<div class="match-entry ${isCurrent?'is-current':''} ${done?'is-done':''}"><span><strong>${String(num).padStart(2,'0')}</strong> ${players}</span><small>${done ? `${safeNumber(done.scores?.[0])} – ${safeNumber(done.scores?.[1])}` : isCurrent ? 'EN COURS' : 'À VENIR'}</small></div>`;
    }).join('');
  }
  function renderHistory(){
    const recent=current().events.slice(-5).reverse();
    $('historyList').innerHTML=recent.length ? recent.map(event=>{
      let label;
      if(event.kind==='fault-opponent'){
        const reason=event.zone==='fault-net'?'filet':event.zone==='fault-out'?'dehors':'faute';
        label=`Faute de ${event.strikerName||'l’adversaire'} · ${reason}`;
      } else if(event.kind==='fault'){
        label='Faute adverse';
      } else if(event.zone==='river'){
        label='Rivière · 0 point';
      } else if(event.zone==='trajectory-above'){
        label='Trajectoire au-dessus du sur-filet';
      } else if(event.zone==='trajectory-under'){
        label='Trajectoire sous le sur-filet';
      } else {
        label=`${ZONES[event.zone]||'Zone'} · ${event.points===2?'Sous le sur-filet':event.points===1?'Au-dessus du sur-filet':'Rivière'}`;
      }
      return `<div class="history-item"><span><strong>${escapeHtml(event.playerName||'Joueur')}</strong> · ${escapeHtml(label)}</span><span class="history-points ${event.points===0?'zero':''}">+${event.points}</span></div>`;
    }).join('') : '<div class="history-empty">Touche une trajectoire pour compter le premier point.</div>';
  }
  function renderGame() {
    if (!selectedMode) return;
    renderScores();
    renderRanking();
    renderMatches();
    renderHistory();
  }

  function feedback(message) {
    clearTimeout(feedbackTimer);
    const element = $('courtFeedback');
    element.textContent = message;
    element.classList.add('flash');
    feedbackTimer = setTimeout(()=>element.classList.remove('flash'),1300);
  }
  function addAction(zone,points,kind='direct'){
    if(!ZONES[zone]||![0,1,2].includes(points))return;
    if((kind==='fault'||kind==='fault-opponent')&&points!==1)return;
    if(zone==='river'&&points!==0)return;
    const s=current();
    const pair=activePair();
    const hitter=s.selectedScorer;
    const recipient=kind==='fault-opponent'?1-hitter:hitter;
    const now=new Date();
    const action={
      id:`${now.getTime()}-${Math.random().toString(36).slice(2,8)}`,
      player:recipient,playerIndex:pair[recipient],playerName:playerName(pair[recipient]),
      strikerIndex:pair[hitter],strikerName:playerName(pair[hitter]),
      points,zone,kind,trajectory:kind==='fault-opponent'?null:points===2?'under':points===1?'above':null,
      time:now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),date:now.toISOString()
    };
    s.events.push(action);
    s.scores[recipient]+=points;
    persist();
    renderGame();
    if(kind==='fault-opponent')feedback(`Faute de ${playerName(pair[hitter])} · +1 pour ${playerName(pair[recipient])} !`);
    else if(zone==='river')feedback(`${playerName(pair[hitter])} · rivière : 0 point.`);
    else feedback(`${playerName(pair[hitter])} · +${points} ${points===1?'point':'points'} !`);
  }
  function undoLast() {
    const s = current();
    const item = s.events.pop();
    if (!item) return;
    s.scores[item.player] = Math.max(0,s.scores[item.player]-item.points);
    persist(); renderGame(); feedback('Dernière action annulée');
  }
  function askConfirmation({kicker='CONFIRMATION',title,message,label='Confirmer'}) {
    const dialog = $('confirmDialog');
    if (!dialog?.showModal) return Promise.resolve(window.confirm(message));
    $('dialogKicker').textContent = kicker;
    $('dialogTitle').textContent = title;
    $('dialogText').textContent = message;
    $('dialogConfirm').textContent = label;
    return new Promise(resolve => {
      dialog.addEventListener('close',()=>resolve(dialog.returnValue === 'ok'),{once:true});
      dialog.showModal();
    });
  }
  async function finishMatch() {
    const s = current();
    if (!s.events.length) return;
    const pair = activePair();
    const accepted = await askConfirmation({
      kicker:'FIN DE RENCONTRE', title:'Enregistrer les points ?',
      message:`${playerName(pair[0])} : ${s.scores[0]} ${s.scores[0] === 1 ? 'point' : 'points'}. ${playerName(pair[1])} : ${s.scores[1]} ${s.scores[1] === 1 ? 'point' : 'points'}. Tu passeras au match suivant.`,
      label:'Enregistrer et continuer'
    });
    if (!accepted) return;
    s.completed.push({
      number:s.matchNumber, pair:[...pair], scores:[...s.scores],
      events:s.events.map(item=>({...item})), finishedAt:new Date().toISOString()
    });
    s.matchNumber++;
    s.scores=[0,0];
    s.events=[];
    s.pairOverride=null;
    s.selectedScorer=0;
    persist(); renderGame(); feedback('Match enregistré ✓');
  }
  async function clearMatch() {
    const s = current();
    if (!s.events.length && s.scores.every(x=>x===0)) return;
    const accepted = await askConfirmation({
      kicker:'REMISE À ZÉRO',title:'Effacer ce match ?',
      message:'Les actions du match en cours seront supprimées. Les résultats des matchs terminés seront conservés.',
      label:'Effacer ce match'
    });
    if (!accepted) return;
    s.scores=[0,0]; s.events=[];
    persist(); renderGame(); feedback('Match remis à zéro');
  }
  function csvCell(value) { return `"${String(value ?? '').replace(/"/g,'""')}"`; }
  function exportCsv() {
    const s = current();
    const rows = [['Situation','Poule','Match','Date','Joueur','Adversaire','Zone','Trajectoire','Points','Heure']];
    const matches = [...s.completed,{number:s.matchNumber,pair:activePair(),events:s.events}];
    matches.forEach(match => {
      const pair = match.pair || [0,1];
      (match.events || []).forEach(event => {
        const slot = event.player === 1 ? 1 : 0;
        rows.push([
          MODES[selectedMode].label,selectedSize,match.number,event.date||'',
          event.playerName||'',s.players[pair[1-slot]]||'',
          ZONES[event.zone]||event.zone,
          event.kind === 'fault' ? 'Faute adverse' : event.points === 0 ? 'Rivière' : event.points === 2 ? 'Sous le sur-filet' : 'Au-dessus du sur-filet',
          event.points,event.time||''
        ]);
      });
    });
    if (rows.length === 1) { feedback('Aucune action à exporter'); return; }
    const csv = '\uFEFF' + rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-impact-${selectedMode}-poule-${selectedSize}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    feedback('Export CSV prêt ✓');
  }

  function init() {
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click',()=>{
      selectedMode = button.dataset.mode;
      selectedSize = 3;
      navigate('pool');
    }));
    document.querySelectorAll('[data-pool-size]').forEach(button => button.addEventListener('click',()=>{
      selectedSize = Number(button.dataset.poolSize);
      renderPool();
    }));
    $('rosterFields').addEventListener('input',event=>{
      const input = event.target.closest('input[data-roster-index]');
      if (!input) return;
      const index = Number(input.dataset.rosterIndex);
      current().players[index] = input.value.slice(0,36);
      persist();
      const p = pairings();
      $('schedulePreview').innerHTML = p.map((pair,i)=>
        `<div class="preview-row"><span>MATCH ${String(i+1).padStart(2,'0')}</span><span>${LETTERS[pair[0]]} · ${escapeHtml(playerName(pair[0]))} <b>VS</b> ${LETTERS[pair[1]]} · ${escapeHtml(playerName(pair[1]))}</span></div>`
      ).join('');
    });
    $('startButton').addEventListener('click',()=>{persist();navigate('game');});
    $('poolBack').addEventListener('click',()=>navigate('home'));
    $('gameHome').addEventListener('click',()=>navigate('home'));
    $('gameBack').addEventListener('click',()=>navigate('pool'));
    document.querySelectorAll('[data-scorer]').forEach(button => button.addEventListener('click',()=>{
      current().selectedScorer=Number(button.dataset.scorer);
      persist();renderScores();
    }));
    function onCourtTouch(action){
      if(action==='river')addAction('river',0);
      else if(action==='trajectory-above')addAction('trajectory-above',1);
      else if(action==='trajectory-under')addAction('trajectory-under',2);
      else if(action==='fault-net')addAction('fault-net',1,'fault-opponent');
      else addAction('fault-out',1,'fault-opponent');
    }
    $('court3D').addEventListener('click',event=>{
      const target=event.target.closest('[data-action]');
      onCourtTouch(target?.dataset.action||'fault-out');
    });
    $('court3D').addEventListener('keydown',event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const target=event.target.closest('[data-action]');
      if(target){event.preventDefault();onCourtTouch(target.dataset.action);}
    });
    $('faultButton').addEventListener('click',()=>addAction('fault-out',1,'fault-opponent'));
    $('undoButton').addEventListener('click',undoLast);
    $('finishButton').addEventListener('click',finishMatch);
    $('clearButton').addEventListener('click',clearMatch);
    $('exportButton').addEventListener('click',exportCsv);
    $('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
    navigate('home');
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }
  init();
})();
