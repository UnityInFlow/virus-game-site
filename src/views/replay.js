import { byId } from '../dom.js';
import { replayTicks } from '../replay.js';

function disableControls(disabled) {
  for (const id of [
    'replay-first',
    'replay-previous',
    'replay-play',
    'replay-next',
    'replay-last',
    'replay-scrubber',
    'replay-speed',
    'replay-return-live',
  ]) {
    byId(id).disabled = disabled;
  }
}

/** Update the replay controls without making an announcement for every animation frame. */
export function renderReplay({ snapshot, tick, playing, speed, notice = '' }) {
  const replay = snapshot.replay;
  const panel = byId('replay-panel');
  const status = byId('replay-status');
  const tickLabel = byId('replay-tick');
  const range = byId('replay-scrubber');
  const play = byId('replay-play');
  const returnLive = byId('replay-return-live');
  const first = byId('replay-first');
  const previous = byId('replay-previous');
  const next = byId('replay-next');
  const last = byId('replay-last');

  panel.hidden = false;
  if (!replay) {
    disableControls(true);
    tickLabel.textContent = `Live · tick ${snapshot.map.tick}`;
    status.textContent = `Replay unavailable. ${snapshot.replayProblem || 'No replay was published.'}`;
    return;
  }

  disableControls(false);
  const ticks = replayTicks(replay);
  const index = tick === null ? ticks.length - 1 : ticks.indexOf(tick);
  const atLive = tick === null;
  const activeIndex = atLive ? ticks.length - 1 : index;
  range.min = '0';
  range.max = String(ticks.length - 1);
  range.value = String(activeIndex);
  range.setAttribute('aria-valuetext', `tick ${ticks[activeIndex]} of ${replay.endTick}`);
  byId('replay-speed').value = String(speed);
  play.textContent = playing ? 'pause' : 'play';
  play.setAttribute('aria-label', playing ? 'pause replay' : 'play replay');
  returnLive.disabled = atLive;
  first.disabled = activeIndex === 0;
  previous.disabled = activeIndex === 0;
  next.disabled = activeIndex === ticks.length - 1;
  last.disabled = activeIndex === ticks.length - 1;

  if (atLive) {
    tickLabel.textContent = `Live · tick ${replay.endTick}`;
    status.textContent = notice || 'Live board. Replay is ready from the first retained tick.';
  } else {
    tickLabel.textContent = `Replay · tick ${tick}`;
    const start = replay.truncated
      ? `First retained tick is ${replay.startTick}.`
      : `Season start is tick ${replay.startTick}.`;
    status.textContent =
      notice || `${start} Showing historical ownership; live health and energy are unavailable.`;
  }
}
