import { loadSnapshot } from './client.js';
import { POLL_MS } from './constants.js';
import { byId } from './dom.js';
import { normaliseSelection, selectionFromUrl, selectionPath } from './selection.js';
import { createSnapshotStore } from './store.js';
import { renderCharts } from './views/charts.js';
import { renderHeader } from './views/header.js';
import { bindMap, renderMap } from './views/map.js';
import { renderLeaderboard, renderLegend } from './views/leaderboard.js';
import { renderPlayer } from './views/player.js';
import { renderStatus, renderStatusRail } from './views/status.js';

let selection = null;
let selectionInitialised = false;
let renderedKey = null;

function ensureSelection(snapshot) {
  if (!selectionInitialised) {
    const location = new URL(window.location.href);
    selection = selectionFromUrl(
      snapshot,
      location,
      snapshot.leaderboard[0]?.player || snapshot.players[0]?.id || null,
    );
    const canonical = selectionPath(location, selection);
    const requestedSelection =
      location.searchParams.has('player') || location.searchParams.has('cell');
    if (
      requestedSelection &&
      `${window.location.pathname}${window.location.search}${window.location.hash}` !== canonical
    ) {
      window.history.replaceState(null, '', canonical);
    }
    selectionInitialised = true;
  } else {
    selection = normaliseSelection(snapshot, selection);
  }
}

function renderSnapshot(snapshot, refreshedAt) {
  ensureSelection(snapshot);
  byId('content').hidden = false;
  renderHeader(snapshot, refreshedAt);
  renderLeaderboard(snapshot, selection.player, selectPlayer);
  renderLegend(snapshot, selection.player, selectPlayer);
  renderPlayer(snapshot, selection.player);
  renderMap(snapshot, selection);
  renderCharts(snapshot);
  renderedKey = snapshot.key;
}

function select(next) {
  const snapshot = store.getState().snapshot;
  if (!snapshot) return;
  selection = normaliseSelection(snapshot, next);
  selectionInitialised = true;
  const path = selectionPath(new URL(window.location.href), selection);
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== path) {
    window.history.pushState(null, '', path);
  }
  renderSnapshot(snapshot, store.getState().refreshedAt);
}

function selectPlayer(id) {
  select({ player: id, cell: null });
}

function selectCell(cell) {
  select({ player: null, cell });
}

function clearSelection() {
  select({ player: null, cell: null });
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
byId('clear-map-selection').addEventListener('click', clearSelection);
bindMap({
  onPinCell: selectCell,
  onClearSelection: clearSelection,
  onResize: renderCurrentSnapshot,
});

function renderCurrentSnapshot() {
  const state = store.getState();
  if (!state.snapshot || state.phase === 'empty') return;
  renderSnapshot(state.snapshot, state.refreshedAt);
}

window.addEventListener('popstate', () => {
  selectionInitialised = false;
  renderCurrentSnapshot();
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
