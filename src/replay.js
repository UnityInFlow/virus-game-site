/**
 * Replay reconstruction deliberately has no DOM or network dependency.  A replay is
 * validated before it reaches this module; these functions still only create new
 * ownership vectors so a bad caller cannot mutate the published source arrays.
 */

export function hasReplayTick(replay, tick) {
  return tick === replay.startTick || replay.frames.some((frame) => frame[0] === tick);
}

export function replayTicks(replay) {
  return [replay.startTick, ...replay.frames.map((frame) => frame[0])];
}

/** Rebuild ownership at one published tick without mutating the replay or a prior seek. */
export function ownershipAtTick(replay, tick) {
  if (!hasReplayTick(replay, tick)) throw new RangeError(`tick ${tick} is not retained in replay`);
  const owners = replay.initial.slice();
  for (const [frameTick, changes] of replay.frames) {
    if (frameTick > tick) break;
    for (const [cellId, owner] of changes) owners[cellId] = owner;
  }
  return owners;
}

/**
 * Construct the map-shaped view consumed by the existing canvas.  Historical
 * ownership is real replay data; live health and energy are intentionally absent.
 */
export function historicalSnapshot(snapshot, tick) {
  const owners = ownershipAtTick(snapshot.replay, tick);
  return Object.freeze({
    ...snapshot,
    map: Object.freeze({
      ...snapshot.map,
      tick,
      cells: snapshot.map.cells.map(([id]) => Object.freeze([id, owners[id], null, null])),
    }),
  });
}
