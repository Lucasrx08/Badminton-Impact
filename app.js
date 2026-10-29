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
    river: 'Rivière', 'front-top': 'Avant haut', 'front-bottom': 'Avant bas',
    'back-top': 'Fond haut', 'back-bottom': 'Fond bas', fault: 'Faute adverse'
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
    const farL = {x:300,y:221}, farR = {x:792,y:305};
    const nearL = {x:93,y:515}, nearR = {x:626,y:603};
    const pt = (x,t) => {
      const lx=farL.x+(nearL.x-farL.x)*t, ly=farL.y+(nearL.y-farL.y)*t;
      const rx=farR.x+(nearR.x-farR.x)*t, ry=farR.y+(nearR.y-farR.y)*t;
      return {x:lx+(rx-lx)*x,y:ly+(ry-ly)*x};
    };
    const round=n=>Math.round(n*10)/10;
    const xy=p=>`${round(p.x)},${round(p.y)}`;
    const quad=(x1,t1,x2,t2)=>[pt(x1,t1),pt(x2,t1),pt(x2,t2),pt(x1,t2)].map(xy).join(' ');
    const line=(p1,p2,color,width=4,extra='')=>`<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
    const zones=[
      {id:'front-top',label:'AVANT · GAUCHE',x1:0,x2:.5,t1:.16,t2:.57,fill:'#f5f7f0',centerX:.25,captionT:.245,buttonT:.425},
      {id:'front-bottom',label:'AVANT · DROITE',x1:.5,x2:1,t1:.16,t2:.57,fill:'#edf4e6',centerX:.75,captionT:.245,buttonT:.425},
      {id:'back-top',label:'FOND · GAUCHE',x1:0,x2:.5,t1:.57,t2:1,fill:'#fbfcf8',centerX:.25,captionT:.645,buttonT:.825},
      {id:'back-bottom',label:'FOND · DROITE',x1:.5,x2:1,t1:.57,t2:1,fill:'#f0f5e9',centerX:.75,captionT:.645,buttonT:.825}
    ];
    let markup = '';
    markup += `<polygon points="${[farL,farR,{x:nearR.x+7,y:nearR.y+18},{x:nearL.x+7,y:nearL.y+18}].map(xy).join(' ')}" fill="#005E3D" opacity=".88"/>`;
    markup += `<polygon points="${[farR,nearR,{x:nearR.x+7,y:nearR.y+18},{x:farR.x+7,y:farR.y+18}].map(xy).join(' ')}" fill="#074F37"/>`;
    markup += `<polygon points="${quad(0,0,1,1)}" fill="url(#courtSurface)" stroke="#038F51" stroke-width="9" stroke-linejoin="round"/>`;
    zones.forEach(zone => {markup+=`<polygon points="${quad(zone.x1,zone.t1,zone.x2,zone.t2)}" fill="${zone.fill}" opacity=".98"/>`;});
    markup += `<g class="river-3d" data-zone="river" data-points="0" role="button" tabindex="0" aria-label="Rivière rose, 0 point"><polygon points="${quad(0,0,1,.16)}" fill="#F098A5" stroke="#E58293" stroke-width="2"/></g>`;
    markup += line(pt(0,.16),pt(1,.16),'#038F51',6);
    markup += line(pt(0,.57),pt(1,.57),'#038F51',6);
    markup += line(pt(.5,.16),pt(.5,1),'#038F51',6);
    markup += `<polygon points="${quad(0,0,1,1)}" fill="none" stroke="#038F51" stroke-width="8" stroke-linejoin="round" pointer-events="none"/>`;
    const riverMid=pt(.5,.095);
    markup += `<text x="${round(riverMid.x)}" y="${round(riverMid.y+8)}" transform="rotate(9 ${round(riverMid.x)} ${round(riverMid.y)})" text-anchor="middle" class="river-3d-label" pointer-events="none">RIVIÈRE · 0 PT</text>`;
  
    // Filet dressé sur le bord supérieur de ce demi-terrain.
    const height=selectedMode==='baston'?0:selectedMode==='carre'?52:114;
    const meshLines=selectedMode==='carre'?3:7;
    if(height){
      markup += `<polygon points="${[farL,farR,{x:farR.x,y:farR.y-height},{x:farL.x,y:farL.y-height}].map(xy).join(' ')}" fill="#f4f5f2" fill-opacity=".29" stroke="#3F4942" stroke-width="2.4"/>`;
      for(let i=0;i<=27;i++){
        const x=pt(i/27,0);
        markup+=line(x,{x:x.x,y:x.y-height},'#303D38',1.45,'opacity=".73"');
      }
      for(let j=1;j<meshLines;j++){
        markup+=line({x:farL.x,y:farL.y-height*j/meshLines},{x:farR.x,y:farR.y-height*j/meshLines},'#35423D',1.6,'opacity=".72"');
      }
      markup+=line({x:farL.x,y:farL.y-height},{x:farR.x,y:farR.y-height},'#FFFFFF',7);
      markup+=line({x:farL.x,y:farL.y-height},{x:farR.x,y:farR.y-height},'#747A6F',2);
    }
    // Le sur-filet reste jaune dans les trois situations, même sans filet ordinaire.
    const ropeHeight=selectedMode==='roi'?160:selectedMode==='carre'?151:142;
    const ropeL={x:farL.x,y:farL.y-ropeHeight},ropeR={x:farR.x,y:farR.y-ropeHeight};
    markup+=line(ropeL,ropeR,'#EFF700',8,'filter="url(#shuttleShade)"');
    markup+=line({x:ropeL.x,y:ropeL.y-1},{x:ropeR.x,y:ropeR.y-1},'#FFFF83',2.5);
    for(const base of [farL,farR]){
      const top={x:base.x,y:base.y-ropeHeight-7};
      markup+=`<line x1="${base.x+5}" y1="${base.y+8}" x2="${top.x+5}" y2="${top.y}" stroke="#263E32" opacity=".15" stroke-width="13" stroke-linecap="round"/>`;
      markup+=line(base,top,'url(#netPole)',9,'filter="url(#shuttleShade)"');
      markup+=`<circle cx="${top.x}" cy="${top.y}" r="5.3" fill="#fff" stroke="#859189" stroke-width="1.3"/>`;
    }
    const ropeCentre={x:(ropeL.x+ropeR.x)/2,y:(ropeL.y+ropeR.y)/2};
    markup+=`<rect x="${round(ropeCentre.x-68)}" y="${round(ropeCentre.y-34)}" width="136" height="26" rx="13" fill="#2F4431" opacity=".92"/>`;
    markup+=`<text x="${round(ropeCentre.x)}" y="${round(ropeCentre.y-16)}" text-anchor="middle" class="rope-title" pointer-events="none">SUR-FILET</text>`;
    if(selectedMode!=='baston'){
      const modeLabel=selectedMode==='carre'?'FILET ABAISSÉ':'FILET NORMAL';
      const anchor={x:farL.x+7,y:farL.y-height-12};
      markup+=`<text x="${anchor.x}" y="${anchor.y}" class="net-height-label" pointer-events="none">${modeLabel}</text>`;
    } else {
      markup+=`<text x="${farL.x+5}" y="${farL.y-15}" class="net-height-label" pointer-events="none">SANS FILET</text>`;
    }
  
    // Petite trajectoire illustrative et volant : bougent après le dernier impact.
    const mapping={
      'front-top':{x:.25,t:.43},'front-bottom':{x:.75,t:.43},
      'back-top':{x:.25,t:.81},'back-bottom':{x:.75,t:.81},
      river:{x:.52,t:.08},fault:{x:.7,t:.62}
    };
    const landing=last&&mapping[last.zone]?mapping[last.zone]:{x:.72,t:.75};
    const target=pt(landing.x,landing.t);
    const shuttleX=round(target.x-7),shuttleY=round(target.y-19);
    const start=pt(.62,0);
    const arcColor=last?.points===2?'#83AC0B':last?.points===0?'#D98093':'#968769';
    markup+=`<path d="M ${round(start.x)} ${round(start.y-56)} Q ${round((start.x+target.x)/2+65)} ${round(Math.min(start.y,target.y)-165)} ${round(target.x)} ${round(target.y-5)}" stroke="${arcColor}" stroke-width="4" stroke-dasharray="9 11" fill="none" opacity=".61" stroke-linecap="round" pointer-events="none"/>`;
    markup+=`<ellipse cx="${round(target.x)}" cy="${round(target.y+3)}" rx="14" ry="6" fill="#608567" opacity=".22" pointer-events="none"/>`;
    markup+=`<g transform="translate(${shuttleX} ${shuttleY}) rotate(-33)" filter="url(#shuttleShade)" pointer-events="none"><path d="M-12 -1 -29 -58 -17 -64 -2 -6Z" fill="#FFF" stroke="#78877D" stroke-width="1.4"/><path d="M-8 -2 -12 -68 1 -70 4 -5Z" fill="#FAFAF6" stroke="#748378" stroke-width="1.4"/><path d="M-2 -4 7 -64 20 -58 10 -1Z" fill="#FFF" stroke="#77897B" stroke-width="1.4"/><path d="M-22 -41 11 -40M-19 -27 12 -27" stroke="#94A19A" stroke-width="2" fill="none"/><path d="M-12 -1Q0 8 11 -1L7 12Q0 17 -7 12Z" fill="#37483E" stroke="#FFF" stroke-width="2"/><ellipse cx="0" cy="13" rx="7" ry="5" fill="#F6EEE6" stroke="#737F76" stroke-width="1.5"/></g>`;
  
    zones.forEach(zone=>{
      const cap=pt(zone.centerX,zone.captionT);
      markup+=`<text x="${round(cap.x)}" y="${round(cap.y)}" text-anchor="middle" transform="rotate(9 ${round(cap.x)} ${round(cap.y)})" class="zone-3d-caption" pointer-events="none">${zone.label}</text>`;
      for (const n of [1,2]){
        const p=pt(zone.centerX+(n===1?-.105:.105),zone.buttonT);
        const active=last?.zone===zone.id && last.points===n;
        const fill=n===1?'#EDE6E2':'#B4D01A';
        const stroke=active?'#E8A64F':n===1?'#D3C6BE':'#92AF0D';
        const label=n===1?'AU-DESSUS':'EN DESSOUS';
        const a11y=`${zone.label.toLowerCase()}, ${n===1?'au-dessus du sur-filet':'sous le sur-filet'}, ${n} ${n===1?'point':'points'}`;
        markup+=`<g class="point-pad${active?' is-last':''}" data-zone="${zone.id}" data-points="${n}" role="button" tabindex="0" aria-label="${a11y}" transform="translate(${round(p.x)} ${round(p.y)}) rotate(9)">`;
        markup+=`<rect x="-48" y="-32" width="96" height="64" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="${active?5:2.4}" filter="url(#padShade)"/>`;
        markup+=`<text x="0" y="4" text-anchor="middle" class="pad-number" pointer-events="none">+${n}</text>`;
        markup+=`<text x="0" y="21" text-anchor="middle" class="pad-caption" pointer-events="none">${label}</text></g>`;
      }
    });
    markup+=`<text x="99" y="596" class="court-foot-caption" pointer-events="none">LIGNE DE FOND</text>`;
    markup+=`<text x="822" y="526" class="court-foot-caption" pointer-events="none">½ TERRAIN</text>`;
    svg.innerHTML=markup;
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
      button.querySelector('.selected-text').textContent = active ? 'POINTS POUR CE JOUEUR' : 'TOUCHER POUR SÉLECTIONNER';
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
  function renderHistory() {
    const recent = current().events.slice(-5).reverse();
    $('historyList').innerHTML = recent.length ? recent.map(event => {
      const label = event.kind === 'fault' ? 'Faute adverse' : `${ZONES[event.zone] || 'Zone'} · ${event.points === 2 ? 'Sous le sur-filet' : event.points === 1 ? 'Au-dessus du sur-filet' : 'Rivière'}`;
      return `<div class="history-item"><span><strong>${escapeHtml(event.playerName || 'Joueur')}</strong> · ${escapeHtml(label)}</span><span class="history-points ${event.points === 0?'zero':''}">+${event.points}</span></div>`;
    }).join('') : '<div class="history-empty">Touche une zone pour compter le premier point.</div>';
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
  function addAction(zone,points,kind='direct') {
    if (!ZONES[zone] || ![0,1,2].includes(points)) return;
    if (kind === 'fault' && points !== 1) return;
    if (zone === 'river' && points !== 0) return;
    const s = current();
    const pair = activePair();
    const slot = s.selectedScorer;
    const now = new Date();
    const action = {
      id: `${now.getTime()}-${Math.random().toString(36).slice(2,8)}`,
      player: slot, playerIndex: pair[slot], playerName: playerName(pair[slot]),
      points, zone, kind, trajectory: points === 2 ? 'under' : 'above',
      time: now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}), date: now.toISOString()
    };
    s.events.push(action);
    s.scores[slot] += points;
    persist();
    renderGame();
    feedback(`${playerName(pair[slot])} · +${points} ${points===1?'point':'points'} !`);
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
    $('court3D').addEventListener('click',event=>{
      const target=event.target.closest('[data-zone][data-points]');
      if(target) addAction(target.dataset.zone,Number(target.dataset.points));
    });
    $('court3D').addEventListener('keydown',event=>{
      if(event.key !== 'Enter' && event.key !== ' ') return;
      const target=event.target.closest('[data-zone][data-points]');
      if(target) { event.preventDefault(); addAction(target.dataset.zone,Number(target.dataset.points)); }
    });
    $('faultButton').addEventListener('click',()=>addAction('fault',1,'fault'));
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
