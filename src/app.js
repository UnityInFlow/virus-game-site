import { loadSnapshot } from './client.js';
import { POLL_MS } from './constants.js';
import { byId } from './dom.js';
import { createSnapshotStore } from './store.js';
import { renderCharts } from './views/charts.js';
import { renderHeader } from './views/header.js';
import { bindMap, renderMap } from './views/map.js';
import { renderLeaderboard, renderLegend } from './views/leaderboard.js';
import { renderPlayer } from './views/player.js';
import { renderStatus } from './views/status.js';

let selected = null;
let rendered = null;

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
  rendered = snapshot;
}

function selectPlayer(id) {
  selected = id;
  const snapshot = store.getState().snapshot;
  if (snapshot) renderSnapshot(snapshot, store.getState().refreshedAt);
}

function onStateChange(state) {
  renderStatus(state);
  if (!state.snapshot || state.phase === 'empty') {
    byId('content').hidden = true;
    return;
  }
  if (state.snapshot !== rendered) renderSnapshot(state.snapshot, state.refreshedAt);
  else if (state.phase === 'live') renderHeader(state.snapshot, state.refreshedAt);
}

const store = createSnapshotStore({ load: loadSnapshot, onChange: onStateChange });

byId('retry-load').addEventListener('click', () => store.refresh({ retry: true }));
bindMap(selectPlayer);

let resizeTimer = null;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const snapshot = store.getState().snapshot;
    if (snapshot) renderSnapshot(snapshot, store.getState().refreshedAt);
  }, 120);
});

const scheme = window.matchMedia('(prefers-color-scheme: dark)');
const repaint = () => {
  const snapshot = store.getState().snapshot;
  if (snapshot) renderSnapshot(snapshot, store.getState().refreshedAt);
};
if (scheme.addEventListener) scheme.addEventListener('change', repaint);

store.refresh();
window.setInterval(() => store.refresh(), POLL_MS);
