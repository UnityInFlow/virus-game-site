import { loadSnapshot } from './client.js';
import { POLL_MS } from './constants.js';
import { byId } from './dom.js';
import { createReplayClock } from './replay-clock.js';
import { hasReplayTick, historicalSnapshot, replayTicks } from './replay.js';
import { normaliseSelection, selectionFromUrl, selectionPath } from './selection.js';
import { createSnapshotStore } from './store.js';
import { renderCharts } from './views/charts.js';
import { renderHeader } from './views/header.js';
import { bindMap, renderMap } from './views/map.js';
import { renderLeaderboard, renderLegend } from './views/leaderboard.js';
import { renderPlayer } from './views/player.js';
import { renderReplay } from './views/replay.js';
import { renderStatus, renderStatusRail } from './views/status.js';

let selection = null;
let selectionInitialised = false;
let renderedKey = null;
let replayTick = null;
let replayInitialised = false;
let replayPlaying = false;
let replaySpeed = 1;
let replayNotice = '';
const replayClock = createReplayClock();

function replayPath(tick) {
  const location = new URL(window.location.href);
  if (tick === null) location.searchParams.delete('tick');
  else location.searchParams.set('tick', String(tick));
  return `${location.pathname}${location.search}${location.hash}`;
}

function writeReplayPath(tick, { replace = false } = {}) {
  const path = replayPath(tick);
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== path) {
    window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  }
}

function stopReplay() {
  replayClock.stop();
  replayPlaying = false;
}

function requestedReplayTick(location) {
  const value = location.searchParams.get('tick');
  if (value === null) return null;
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
}

function ensureReplay(snapshot) {
  if (!replayInitialised) {
    const requested = requestedReplayTick(new URL(window.location.href));
    if (requested !== null) {
      if (snapshot.replay && hasReplayTick(snapshot.replay, requested)) {
        replayTick = requested;
      } else {
        replayTick = null;
        replayNotice = `Requested tick ${Number.isNaN(requested) ? 'is invalid' : requested} is not retained; showing the live board.`;
        writeReplayPath(null, { replace: true });
      }
    }
    replayInitialised = true;
  }
  if (replayTick !== null && (!snapshot.replay || !hasReplayTick(snapshot.replay, replayTick))) {
    stopReplay();
    replayNotice = `Tick ${replayTick} is no longer retained; showing the live board.`;
    replayTick = null;
    writeReplayPath(null, { replace: true });
  }
}

function displayedSnapshot(snapshot) {
  return replayTick === null ? snapshot : historicalSnapshot(snapshot, replayTick);
}

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
  ensureReplay(snapshot);
  const displayed = displayedSnapshot(snapshot);
  ensureSelection(displayed);
  byId('content').hidden = false;
  renderHeader(snapshot, refreshedAt);
  renderLeaderboard(snapshot, selection.player, selectPlayer);
  renderLegend(snapshot, selection.player, selectPlayer);
  renderPlayer(snapshot, selection.player, selectPlayer);
  renderMap(displayed, selection, { historical: replayTick !== null });
  renderReplay({
    snapshot,
    tick: replayTick,
    playing: replayPlaying,
    speed: replaySpeed,
    notice: replayNotice,
  });
  renderCharts(snapshot);
  renderedKey = snapshot.key;
}

function renderReplayFrame() {
  const state = store.getState();
  if (!state.snapshot || state.phase === 'empty') return;
  const displayed = displayedSnapshot(state.snapshot);
  renderMap(displayed, selection, { historical: replayTick !== null });
  renderReplay({
    snapshot: state.snapshot,
    tick: replayTick,
    playing: replayPlaying,
    speed: replaySpeed,
    notice: replayNotice,
  });
}

function select(next) {
  const snapshot = store.getState().snapshot;
  if (!snapshot) return;
  selection = normaliseSelection(displayedSnapshot(snapshot), next);
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

function announceReplay(message) {
  byId('replay-announcement').textContent = message;
}

function setReplayTick(tick, { replace = false, announce = false } = {}) {
  const snapshot = store.getState().snapshot;
  if (!snapshot?.replay || !hasReplayTick(snapshot.replay, tick)) return;
  replayTick = tick;
  replayNotice = '';
  writeReplayPath(tick, { replace });
  renderReplayFrame();
  if (announce) announceReplay(`Showing replay tick ${tick}.`);
}

function returnToLive({ announce = false } = {}) {
  stopReplay();
  replayTick = null;
  replayNotice = '';
  writeReplayPath(null);
  renderReplayFrame();
  if (announce) announceReplay('Returned to the live board.');
}

function scheduleReplay() {
  replayClock.start(advanceReplay, replaySpeed);
}

function advanceReplay() {
  const snapshot = store.getState().snapshot;
  if (!snapshot?.replay || replayTick === null) {
    stopReplay();
    renderReplayFrame();
    return;
  }
  const ticks = replayTicks(snapshot.replay);
  const index = ticks.indexOf(replayTick);
  if (index < 0 || index >= ticks.length - 1) {
    stopReplay();
    renderReplayFrame();
    return;
  }
  setReplayTick(ticks[index + 1], { replace: true });
  if (ticks[index + 1] === ticks.at(-1)) {
    stopReplay();
    renderReplayFrame();
  }
}

function playReplay() {
  const snapshot = store.getState().snapshot;
  if (!snapshot?.replay) return;
  if (replayPlaying) {
    stopReplay();
    renderReplayFrame();
    announceReplay('Replay paused.');
    return;
  }
  if (replayTick === null || replayTick === snapshot.replay.endTick) {
    setReplayTick(snapshot.replay.startTick, { announce: false });
  }
  replayPlaying = true;
  scheduleReplay();
  renderReplayFrame();
  announceReplay('Replay playing.');
}

function stepReplay(direction) {
  const snapshot = store.getState().snapshot;
  if (!snapshot?.replay) return;
  stopReplay();
  const ticks = replayTicks(snapshot.replay);
  const current = replayTick === null ? ticks.length - 1 : ticks.indexOf(replayTick);
  const next = Math.max(0, Math.min(ticks.length - 1, current + direction));
  setReplayTick(ticks[next], { announce: true });
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
byId('replay-first').addEventListener('click', () => {
  const replay = store.getState().snapshot?.replay;
  if (!replay) return;
  stopReplay();
  setReplayTick(replay.startTick, { announce: true });
});
byId('replay-previous').addEventListener('click', () => stepReplay(-1));
byId('replay-play').addEventListener('click', playReplay);
byId('replay-next').addEventListener('click', () => stepReplay(1));
byId('replay-last').addEventListener('click', () => {
  const replay = store.getState().snapshot?.replay;
  if (!replay) return;
  stopReplay();
  setReplayTick(replay.endTick, { announce: true });
});
byId('replay-return-live').addEventListener('click', () => returnToLive({ announce: true }));
byId('replay-scrubber').addEventListener('input', (event) => {
  const replay = store.getState().snapshot?.replay;
  if (!replay) return;
  stopReplay();
  const tick = replayTicks(replay)[Number(event.currentTarget.value)];
  setReplayTick(tick, { replace: true });
});
byId('replay-scrubber').addEventListener('change', () => announceReplay('Replay tick selected.'));
byId('replay-speed').addEventListener('change', (event) => {
  const nextSpeed = Number(event.currentTarget.value);
  if (![0.5, 1, 2, 4].includes(nextSpeed)) return;
  replaySpeed = nextSpeed;
  if (replayPlaying) scheduleReplay();
  renderReplayFrame();
  announceReplay(`Replay speed set to ${nextSpeed} times.`);
});
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
  stopReplay();
  selectionInitialised = false;
  replayInitialised = false;
  renderCurrentSnapshot();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && replayPlaying) {
    stopReplay();
    replayNotice = 'Replay paused while this tab was in the background.';
    renderReplayFrame();
  }
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
