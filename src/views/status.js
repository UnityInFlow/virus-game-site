import { byId } from '../dom.js';

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
