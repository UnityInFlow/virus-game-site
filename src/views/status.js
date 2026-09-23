import { byId } from '../dom.js';
import { number } from '../format.js';

function failureCount(strainFailures) {
  return Object.values(strainFailures).reduce(
    (total, strains) => total + (Array.isArray(strains) ? strains.length : 0),
    0,
  );
}

function healthFor(phase) {
  if (phase === 'live') return { state: 'live', label: 'verified' };
  if (phase === 'degraded') return { state: 'degraded', label: 'stale data' };
  if (phase === 'error') return { state: 'error', label: 'unavailable' };
  if (phase === 'empty') return { state: 'empty', label: 'awaiting tick' };
  return { state: phase, label: phase === 'retrying' ? 'retrying' : 'loading' };
}

/** Keep the diagnostic rail useful even while the dashboard is deliberately retained or hidden. */
export function renderStatusRail(state) {
  const health = healthFor(state.phase);
  const healthNode = byId('data-health');
  healthNode.dataset.state = health.state;
  byId('health-label').textContent = health.label;

  const loading = byId('loading-atlas');
  loading.hidden = !((state.phase === 'loading' || state.phase === 'retrying') && !state.snapshot);
  if (!state.snapshot) return;

  const { map, players, latest } = state.snapshot;
  const occupied = map.cells.reduce((total, cell) => total + (cell[1] === null ? 0 : 1), 0);
  const active = players.filter(
    (player) =>
      player.enabled && player.strains.some((strain) => strain.enabled && !strain.suspended),
  ).length;
  byId('occupancy').textContent = `${number(occupied)} / ${number(map.cells.length)}`;
  byId('active-players').textContent = number(active);
  byId('failure-count').textContent = number(failureCount(latest.strainFailures));
}

export function renderStatus(state) {
  const panel = byId('app-status');
  const title = byId('status-title');
  const detail = byId('status-detail');
  const retry = byId('retry-load');

  if (state.phase === 'live') {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  retry.hidden = state.phase !== 'error' && state.phase !== 'degraded';
  if (state.phase === 'loading') {
    title.textContent = 'Loading public game data…';
    detail.textContent = '';
  } else if (state.phase === 'retrying') {
    title.textContent = 'Retrying public game data…';
    detail.textContent = '';
  } else if (state.phase === 'refreshing') {
    title.textContent = 'Refreshing public game data…';
    detail.textContent =
      'The displayed tick remains verified until the complete next snapshot arrives.';
  } else if (state.phase === 'empty') {
    title.textContent = 'No tick has been published yet.';
    detail.textContent = 'The public map will appear after the first successful tick.';
  } else if (state.phase === 'degraded') {
    title.textContent = 'Showing the last verified tick.';
    detail.textContent = `The latest refresh failed: ${state.error.message}`;
  } else {
    title.textContent = 'Could not load public game data.';
    detail.textContent = state.error.message;
  }
}
