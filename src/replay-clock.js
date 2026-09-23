/**
 * Own the single playback interval so changing speed, clicking rapidly, or a
 * background-tab pause cannot leave a second timer advancing the same replay.
 */
export function createReplayClock({
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
} = {}) {
  let handle = null;

  function stop() {
    if (handle !== null) clearIntervalImpl(handle);
    handle = null;
  }

  function start(callback, speed) {
    stop();
    handle = setIntervalImpl(callback, 1000 / speed);
  }

  return Object.freeze({
    start,
    stop,
    get active() {
      return handle !== null;
    },
  });
}
