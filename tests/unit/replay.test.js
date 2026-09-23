import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicDataError, validateReplay, validateSnapshot } from '../../src/contracts.js';
import { createReplayClock } from '../../src/replay-clock.js';
import {
  hasReplayTick,
  historicalSnapshot,
  ownershipAtTick,
  replayTicks,
} from '../../src/replay.js';
import { clone, fixture } from '../fixture.js';

async function preparedFixture() {
  const source = await fixture();
  return {
    snapshot: validateSnapshot(source),
    replay: validateReplay(source.replay, validateSnapshot(source)),
  };
}

test('reconstructs bootstrap and conflict-heavy frames without mutating replay source', async () => {
  const { replay } = await preparedFixture();
  const before = structuredClone(replay);
  assert.deepEqual(replayTicks(replay), [0, 1, 2]);
  assert.equal(hasReplayTick(replay, 1), true);
  assert.equal(hasReplayTick(replay, 9), false);
  assert.deepEqual(ownershipAtTick(replay, 0), [null, null, null, null]);
  assert.deepEqual(ownershipAtTick(replay, 1), [0, 1, null, null]);
  const final = ownershipAtTick(replay, 2);
  assert.deepEqual(final, [0, 1, null, 0]);
  final[0] = null;
  assert.deepEqual(ownershipAtTick(replay, 2), [0, 1, null, 0]);
  assert.deepEqual(replay, before);
  assert.throws(() => ownershipAtTick(replay, 99), RangeError);
});

test('uses translated roster ownership and marks health and energy unavailable in historical views', async () => {
  const source = await fixture();
  source.replay.players = ['bob', 'alice'];
  source.replay.frames[0][1] = [
    [0, 1],
    [1, 0],
  ];
  source.replay.frames[0][2][0] = [1, 1];
  source.replay.frames[1][1] = [[3, 1]];
  source.replay.frames[1][2][0] = [1, 2];
  const snapshot = validateSnapshot(source);
  const replay = validateReplay(source.replay, snapshot);
  const historical = historicalSnapshot({ ...snapshot, replay }, 1);
  assert.deepEqual(
    historical.map.cells.map((cell) => cell[1]),
    [0, 1, null, null],
  );
  assert.deepEqual(historical.map.cells[0].slice(2), [null, null]);
});

test('accepts a truncated retained window and rejects malformed or mixed replay publications', async () => {
  const source = await fixture();
  source.replay.truncated = true;
  source.replay.startTick = 1;
  source.replay.initial = [0, 1, null, null];
  source.replay.frames = [source.replay.frames[1]];
  const snapshot = validateSnapshot(source);
  assert.equal(validateReplay(source.replay, snapshot).startTick, 1);

  const cases = [
    (replay) => {
      replay.version = 2;
    },
    (replay) => {
      replay.width = 3;
    },
    (replay) => {
      replay.frames[1][1].push([3, 0]);
    },
    (replay) => {
      replay.frames[1][2][0][0] += 1;
    },
    (replay) => {
      replay.frames[1][0] = 1;
    },
  ];
  for (const mutate of cases) {
    const broken = clone(await fixture());
    mutate(broken.replay);
    assert.throws(() => validateReplay(broken.replay, validateSnapshot(broken)), PublicDataError);
  }
});

test('uses one fake-timer playback clock across rapid starts, speed changes, pause and end', () => {
  let nextHandle = 0;
  const active = new Map();
  const cleared = [];
  const clock = createReplayClock({
    setIntervalImpl: (callback, delay) => {
      const handle = ++nextHandle;
      active.set(handle, { callback, delay });
      return handle;
    },
    clearIntervalImpl: (handle) => {
      cleared.push(handle);
      active.delete(handle);
    },
  });
  const ticks = [];
  clock.start(() => ticks.push('first'), 1);
  clock.start(() => ticks.push('replacement'), 4);
  assert.deepEqual(cleared, [1]);
  assert.equal(clock.active, true);
  assert.equal(active.size, 1);
  assert.equal([...active.values()][0].delay, 250);
  [...active.values()][0].callback();
  assert.deepEqual(ticks, ['replacement']);
  clock.stop();
  assert.equal(clock.active, false);
  assert.deepEqual(cleared, [1, 2]);
});
