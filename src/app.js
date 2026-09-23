import { loadSnapshot } from './client.js';
import { POLL_MS } from './constants.js';
import { byId } from './dom.js';
import { createSnapshotStore } from './store.js';
import { renderCharts } from './views/charts.js';
import { renderHeader } from './views/header.js';
import { bindMap, renderMap } from './views/map.js';
import { renderLeaderboard, renderLegend } from './views/leaderboard.js';
import { renderPlayer } from './views/player.js';
import { renderStatus, renderStatusRail } from './views/status.js';

let selected = null;
let renderedKey = null;

function preferredPlayer(snapshot) {
  if (selected && snapshot.players.some((player) => player.id === selected)) return selected;
  return snapshot.leaderboard[0]?.player || snapshot.players[0]?.id || null;
}

function renderSnapshot(snapshot, refreshedAt) {
  selected = preferredPlayer(snapshot);
  byId('content').hidden = false;
  renderHeader(snapshot, refreshedAt);
  renderLeaderboard(snapshot, selected, selectPlayer);
  renderLegend(snapshot, selected, selectPlayer);
  renderPlayer(snapshot, selected);
  renderMap(snapshot, selected);
  renderCharts(snapshot);
  renderedKey = snapshot.key;
}

function selectPlayer(id) {
  selected = id;
  const snapshot = store.getState().snapshot;
  if (snapshot) renderSnapshot(snapshot, store.getState().refreshedAt);
}

function onStateChange(state) {
  renderStatus(state);
  renderStatusRail(state);
  if (!state.snapshot || state.phase === 'empty') {
    byId('content').hidden = true;
    return;
  }
  if (state.snapshot.key !== renderedKey) renderSnapshot(state.snapshot, state.refreshedAt);
  else renderHeader(state.snapshot, state.refreshedAt);
}

const store = createSnapshotStore({ load: loadSnapshot, onChange: onStateChange });

byId('retry-load').addEventListener('click', () => store.refresh({ retry: true }));
bindMap(selectPlayer);

let resizeTimer = null;
function renderCurrentSnapshot() {
  const state = store.getState();
  if (!state.snapshot || state.phase === 'empty') return;
  renderSnapshot(state.snapshot, state.refreshedAt);
}

window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    renderCurrentSnapshot();
  }, 120);
});

const scheme = window.matchMedia('(prefers-color-scheme: dark)');
const repaint = () => renderCurrentSnapshot();
if (scheme.addEventListener) scheme.addEventListener('change', repaint);
window.addEventListener('virus-game-themechange', repaint);

store.refresh();
window.setInterval(() => store.refresh(), POLL_MS);
window.setInterval(() => {
  const state = store.getState();
  if (state.snapshot && state.phase !== 'empty') renderHeader(state.snapshot, state.refreshedAt);
}, 1000);
