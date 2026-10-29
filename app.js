/* Badminton Impact — Lucas Rigaux. Aucune donnée n'est envoyée à un serveur. */
(() => {
  'use strict';

  const STORAGE_KEY = 'rigaux-badminton-impact-v1';
  const MODES = {
    baston: { label: 'LA BASTON', net: 'SANS FILET', levels: [{level: 1, minExclusive: 30}, {level: 2, minExclusive: 40}] },
    carre: { label: 'LE CARRÉ MAGIQUE', net: 'FILET ABAISSÉ', levels: [{level: 1, minExclusive: 40}, {level: 2, minExclusive: 50}, {level: 3, minExclusive: 60}] },
    roi: { label: 'LE ROI DU TERRAIN', net: 'FILET NORMAL', levels: [{level: 2, minExclusive: 60}, {level: 3, minExclusive: 70}, {level: 4, minExclusive: 80}] }
  };
  const ZONE_NAMES = {
    river: 'Rivière',
    'front-top': 'Avant haut',
    'front-bottom': 'Avant bas',
    'back-top': 'Fond haut',
    'back-bottom': 'Fond bas',
    fault: 'Faute adverse',
    missed: 'Faute personnelle'
  };

  const makeSession = () => ({ matchNumber: 1, scores: [0, 0], events: [], completed: [] });
  const defaults = () => ({
    version: 1,
    players: ['Joueur 1', 'Joueur 2'],
    mode: 'baston',
    trajectory: 'above',
    sessions: { baston: makeSession(), carre: makeSession(), roi: makeSession() }
  });

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.version !== 1 || !saved.sessions) return defaults();
      const state = defaults();
      if (Array.isArray(saved.players) && saved.players.length === 2) {
        state.players = saved.players.map((s, i) => typeof s === 'string' ? s.slice(0, 36) : `Joueur ${i + 1}`);
      }
      if (MODES[saved.mode]) state.mode = saved.mode;
      if (['above', 'under'].includes(saved.trajectory)) state.trajectory = saved.trajectory;
      for (const mode of Object.keys(MODES)) {
        const entry = saved.sessions[mode];
        if (!entry || !Array.isArray(entry.events) || !Array.isArray(entry.completed) || !Array.isArray(entry.scores)) continue;
        state.sessions[mode] = {
          matchNumber: Number.isInteger(entry.matchNumber) && entry.matchNumber > 0 ? entry.matchNumber : 1,
          scores: entry.scores.map(x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0).slice(0, 2),
          events: entry.events.slice(-2000),
          completed: entry.completed.slice(-200)
        };
      }
      return state;
    } catch (error) {
      return defaults();
    }
  }

  let state = loadState();
  let feedbackTimer = 0;
  const $ = id => document.getElementById(id);
  const current = () => state.sessions[state.mode];
  const playerName = i => state.players[i].trim() || `Joueur ${i + 1}`;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showFeedback('Stockage indisponible', true); }
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function computeLevel(score, mode) {
    let highest = null;
    for (const limit of MODES[mode].levels) {
      // « Plus de 30 » signifie strictement supérieur à 30.
      if (score > limit.minExclusive) highest = limit.level;
    }
    return highest;
  }

  function totalPoints(mode, player) {
    const session = state.sessions[mode];
    return session.scores[player] + session.completed.reduce((sum, match) => sum + (Number(match.scores?.[player]) || 0), 0);
  }

  function renderNet() {
    const base = '<text x="365" y="35" text-anchor="middle" fill="#868c18" font-size="15" font-weight="950" letter-spacing="1">SUR-FILET</text>';
    let mesh = '';
    if (state.mode === 'baston') {
      mesh = '<line x1="379" y1="54" x2="379" y2="476" stroke="#e7df12" stroke-width="10" stroke-linecap="round"/><line x1="379" y1="54" x2="379" y2="476" stroke="#fff69c" stroke-width="3"/>';
    } else if (state.mode === 'carre') {
      mesh = '<rect x="370" y="58" width="20" height="414" fill="url(#netMesh)" opacity=".63"/><line x1="377" y1="58" x2="377" y2="472" stroke="#555d54" stroke-width="3"/><line x1="362" y1="54" x2="362" y2="476" stroke="#e8df1b" stroke-width="8" stroke-linecap="round"/>';
    } else {
      mesh = '<rect x="364" y="58" width="31" height="414" fill="url(#netMesh)" opacity=".9"/><line x1="378" y1="58" x2="378" y2="472" stroke="#293d33" stroke-width="5"/><line x1="350" y1="54" x2="350" y2="476" stroke="#e8df1b" stroke-width="8" stroke-linecap="round"/>';
    }
    $('netGraphic').innerHTML = base + mesh;
  }

  function renderScores() {
    const session = current();
    $('matchCounter').textContent = `MATCH ${String(session.matchNumber).padStart(2, '0')}`;
    [0, 1].forEach(i => {
      $('score' + i).textContent = session.scores[i];
      $('playerLabel' + i).textContent = playerName(i);
    });
    $('name0').value = state.players[0];
    $('name1').value = state.players[1];
    $('undoButton').disabled = session.events.length === 0;
    $('finishButton').disabled = session.events.length === 0;
  }

  function renderModes() {
    document.querySelectorAll('[data-mode]').forEach(button => {
      const selected = button.dataset.mode === state.mode;
      button.setAttribute('aria-pressed', String(selected));
    });
    const mode = MODES[state.mode];
    $('courtCaption').textContent = `${mode.label} · ${mode.net}`;
  }

  function renderTrajectory() {
    document.querySelectorAll('[data-trajectory]').forEach(button => {
      const active = button.dataset.trajectory === state.trajectory;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    // On colore temporairement le terrain selon l'action précédente, sans modifier les règles.
    const last = current().events.at(-1);
    document.querySelectorAll('.court-zone').forEach(zone => {
      const isLast = Boolean(last && last.zone === zone.dataset.zone && last.player === Number(zone.dataset.player));
      zone.classList.toggle('is-last', isLast);
      if (zone.dataset.zone !== 'river') zone.setAttribute('fill', isLast && last.points === 2 ? '#B4D01A' : '#EDE6E2');
    });
  }

  function renderContract() {
    const content = [0, 1].map(i => {
      const points = totalPoints(state.mode, i);
      const level = computeLevel(points, state.mode);
      return `<article class="contract-card"><div class="contract-initial">${i === 0 ? 'A' : 'B'}</div><div><div class="contract-name" title="${esc(playerName(i))}">${esc(playerName(i))}</div><div class="contract-points">${points} points cumulés</div><div class="contract-level">${level === null ? 'EN COURS' : `NIVEAU ${level}`}</div></div></article>`;
    }).join('');
    $('contractGrid').innerHTML = content;
    const limits = MODES[state.mode].levels.map(item => `N${item.level} : > ${item.minExclusive} pts`).join(' · ');
    $('contractNote').textContent = `${limits}. Les points sont cumulés dans cette situation (matchs terminés + match en cours).`;
  }

  function renderHistory() {
    const events = current().events.slice(-7).reverse();
    if (!events.length) {
      $('historyList').innerHTML = '<div class="history-empty">Aucune action pour le moment.<br>Touche une zone du terrain pour commencer.</div>';
      return;
    }
    $('historyList').innerHTML = events.map(event => {
      const name = event.playerName || playerName(event.player);
      const description = event.kind === 'fault' ? 'Faute adverse' : `${ZONE_NAMES[event.zone] || 'Zone du terrain'} · ${event.trajectory === 'under' ? 'Trajectoire tendue' : 'Trajectoire haute'}`;
      const badge = event.points === 2 ? 'bonus' : event.points === 0 ? 'zero' : '';
      return `<div class="history-item"><div><div class="history-actor">${esc(name)}</div><div class="history-info">${esc(description)}</div></div><span class="history-info">${esc(event.time || '')}</span><span class="history-points ${badge}">+${event.points}</span></div>`;
    }).join('');
  }

  function render() {
    renderModes();
    renderScores();
    renderTrajectory();
    renderNet();
    renderContract();
    renderHistory();
  }

  function showFeedback(text, warning = false) {
    const el = $('courtFeedback');
    clearTimeout(feedbackTimer);
    el.textContent = text;
    el.style.background = warning ? '#995661' : '#304226';
    el.classList.add('show');
    feedbackTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function addAction(zone, player, kind = 'direct') {
    if (kind !== 'fault' && !ZONE_NAMES[zone]) return;
    if (player !== 0 && player !== 1) return;
    const points = kind === 'fault' ? 1 : (zone === 'river' ? 0 : (state.trajectory === 'under' ? 2 : 1));
    const now = new Date();
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      player,
      playerName: playerName(player),
      points,
      zone,
      kind,
      trajectory: state.trajectory,
      time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      date: now.toISOString()
    };
    current().events.push(event);
    current().scores[player] += points;
    persist();
    render();
    showFeedback(points === 0 ? `JOUEUR ${player === 0 ? 'A' : 'B'} · RIVIÈRE · 0 PT` : `JOUEUR ${player === 0 ? 'A' : 'B'} · +${points} POINT${points > 1 ? 'S' : ''} !`);
  }

  function undoLast() {
    const session = current();
    const removed = session.events.pop();
    if (!removed) return;
    session.scores[removed.player] = Math.max(0, session.scores[removed.player] - removed.points);
    persist(); render(); showFeedback('DERNIÈRE ACTION ANNULÉE');
  }

  function confirmAction({ kicker = 'CONFIRMATION', title, message, label = 'Confirmer' }) {
    return new Promise(resolve => {
      const dialog = $('confirmDialog');
      $('dialogKicker').textContent = kicker;
      $('dialogTitle').textContent = title;
      $('dialogText').textContent = message;
      $('dialogConfirm').textContent = label;
      const done = () => resolve(dialog.returnValue === 'ok');
      dialog.addEventListener('close', done, { once: true });
      dialog.showModal();
    });
  }

  async function finishMatch() {
    const session = current();
    if (!session.events.length) return;
    const confirmed = await confirmAction({
      kicker: 'FIN DE MATCH', title: 'Enregistrer cette rencontre ?',
      message: `${playerName(0)} : ${session.scores[0]} points · ${playerName(1)} : ${session.scores[1]} points. Les points seront conservés dans le cumul de ${MODES[state.mode].label}.`,
      label: 'Enregistrer le match'
    });
    if (!confirmed) return;
    session.completed.push({
      number: session.matchNumber,
      players: [...state.players],
      scores: [...session.scores],
      events: session.events.map(x => ({ ...x })),
      finishedAt: new Date().toISOString()
    });
    session.matchNumber += 1;
    session.scores = [0, 0];
    session.events = [];
    persist(); render(); showFeedback('MATCH ENREGISTRÉ ✓');
  }

  async function clearMatch() {
    const session = current();
    if (!session.events.length && session.scores.every(x => x === 0)) return;
    const confirmed = await confirmAction({
      kicker: 'REMISE À ZÉRO', title: 'Effacer le match en cours ?',
      message: 'Les actions et les scores de ce match seront effacés. Les rencontres déjà terminées resteront enregistrées.',
      label: 'Effacer ce match'
    });
    if (!confirmed) return;
    session.scores = [0, 0]; session.events = [];
    persist(); render(); showFeedback('MATCH REMIS À ZÉRO');
  }

  function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
  function exportCsv() {
    const rows = [['Situation', 'Match', 'Date', 'Joueur', 'Zone', 'Trajectoire', 'Points', 'Heure']];
    for (const [mode, session] of Object.entries(state.sessions)) {
      const matches = [...session.completed, { number: session.matchNumber, events: session.events }];
      for (const match of matches) {
        for (const event of match.events) {
          rows.push([
            MODES[mode].label, match.number, event.date || '', event.playerName || '', ZONE_NAMES[event.zone] || event.zone,
            event.kind === 'fault' ? 'Faute adverse' : event.trajectory === 'under' ? 'Sous le sur-filet' : 'Au-dessus du sur-filet', event.points, event.time || ''
          ]);
        }
      }
    }
    if (rows.length === 1) { showFeedback('AUCUNE ACTION À EXPORTER', true); return; }
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-impact-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showFeedback('EXPORT CSV PRÊT ✓');
  }

  function init() {
    document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      persist(); render(); showFeedback(MODES[state.mode].label);
    }));
    document.querySelectorAll('[data-trajectory]').forEach(button => button.addEventListener('click', () => {
      state.trajectory = button.dataset.trajectory;
      persist(); render();
    }));
    document.querySelectorAll('[data-zone]').forEach(zone => {
      zone.addEventListener('click', () => addAction(zone.dataset.zone, Number(zone.dataset.player)));
      zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addAction(zone.dataset.zone, Number(zone.dataset.player)); }
      });
    });
    [0, 1].forEach(i => {
      $('name' + i).addEventListener('change', e => {
        state.players[i] = e.target.value.trim().slice(0, 36) || `Joueur ${i + 1}`;
        persist(); render();
      });
    });
    $('undoButton').addEventListener('click', undoLast);
    document.querySelectorAll('[data-fault-player]').forEach(button => button.addEventListener('click', () => addAction('fault', Number(button.dataset.faultPlayer), 'fault')));
    $('finishButton').addEventListener('click', finishMatch);
    $('clearButton').addEventListener('click', clearMatch);
    $('exportButton').addEventListener('click', exportCsv);
    $('helpButton').addEventListener('click', () => $('helpDialog').showModal());
    render();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  init();
})();
