import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicDataError, validateSnapshot } from '../../src/contracts.js';
import { clone, fixture, tenPlayerSnapshot } from '../fixture.js';

test('accepts a complete normal public snapshot', async () => {
  const snapshot = validateSnapshot(await fixture());
  assert.deepEqual(snapshot.order, ['alice', 'bob']);
  assert.equal(snapshot.map.tick, 2);
});

test('accepts the explicit empty-game fixture and all ten players', async () => {
  assert.equal(validateSnapshot(await fixture('empty')).map.tick, 0);
  assert.equal(validateSnapshot(tenPlayerSnapshot()).order.length, 10);
});

test('rejects malformed JSON shapes, invalid owners, mixed ticks, unknown leaderboard players, and bad history', async () => {
  const base = await fixture();
  const cases = [
    (value) => {
      value.map.cells[0] = [0, 9, 100, 50];
    },
    (value) => {
      value.latest.tick = 3;
    },
    (value) => {
      value.leaderboard[1].player = 'nobody';
    },
    (value) => {
      value.history.ticks[1][0] = 1;
    },
    (value) => {
      value.history.ticks.pop();
    },
    (value) => {
      value.map.cells[0] = ['zero', 0, 100, 50];
    },
    (value) => {
      value.history.players.reverse();
    },
    (value) => {
      value.map.cells[0][2] = -1;
    },
    (value) => {
      value.map.version = 2;
    },
    (value) => {
      value.players[0].cells += 1;
    },
    (value) => {
      value.leaderboard[0].delta += 1;
    },
    (value) => {
      value.history.ticks.at(-1)[1][0] += 1;
    },
  ];
  for (const mutate of cases) {
    const broken = clone(base);
    mutate(broken);
    assert.throws(() => validateSnapshot(broken), PublicDataError);
  }
});
