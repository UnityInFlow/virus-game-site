import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSnapshot } from '../../src/client.js';
import { clone, fixture } from '../fixture.js';
import { createSnapshotStore } from '../../src/store.js';

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Last-Modified': 'Tue, 23 Sep 2026 10:00:00 GMT' },
  });
}

function responseFor(snapshot) {
  const documents = {
    'latest-tick': snapshot.latest,
    map: snapshot.map,
    players: snapshot.players,
    leaderboard: snapshot.leaderboard,
    history: snapshot.history,
    strains: snapshot.strains,
    replay: snapshot.replay,
  };
  return async (url) => {
    const name = new URL(url, 'http://fixture.test').pathname
      .split('/')
      .at(-1)
      .replace('.json', '');
    return jsonResponse(documents[name]);
  };
}

test('a mixed-tick refresh is rejected and cannot replace the known-good snapshot', async () => {
  const good = await fixture();
  const mixed = clone(good);
  mixed.latest.tick = 3;
  const states = [];
  let next = good;
  const store = createSnapshotStore({
    load: () => loadSnapshot({ fetchImpl: responseFor(next), token: 'fixture' }),
    onChange: (state) => states.push(state),
  });

  await store.refresh();
  const knownGood = store.getState().snapshot;
  next = mixed;
  await store.refresh();

  assert.equal(store.getState().phase, 'degraded');
  assert.equal(store.getState().snapshot, knownGood);
  assert.equal(states.at(-1).snapshot, knownGood);
});

test('an incoherent optional replay is isolated while the verified live board remains available', async () => {
  const source = await fixture();
  source.replay.frames.at(-1)[1][0][1] = null;
  source.replay.frames.at(-1)[2][0][0] = 1;
  const snapshot = await loadSnapshot({ fetchImpl: responseFor(source), token: 'fixture' });

  assert.equal(snapshot.map.tick, 2);
  assert.equal(snapshot.replay, null);
  assert.match(snapshot.replayProblem, /final ownership/);
});
