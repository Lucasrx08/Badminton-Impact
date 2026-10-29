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
    const edge = $('netEdge');
    edge.className = `net-edge ${selectedMode === 'baston' ? 'net-none' : selectedMode === 'carre' ? 'net-low' : 'net-normal'}`;
    $('netPill').textContent = MODES[selectedMode].net;
    const last = s.events.at(-1);
    document.querySelectorAll('[data-zone][data-points]').forEach(button => {
      const isLast = Boolean(last && last.zone === button.dataset.zone && last.points === Number(button.dataset.points));
      button.classList.toggle('is-last',isLast);
    });
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
      message:`${playerName(pair[0])} : ${s.scores[0]} pts. ${playerName(pair[1])} : ${s.scores[1]} pts. Tu passeras au match suivant.`,
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
    document.querySelectorAll('[data-zone][data-points]').forEach(button => button.addEventListener('click',()=>{
      addAction(button.dataset.zone,Number(button.dataset.points));
    }));
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
