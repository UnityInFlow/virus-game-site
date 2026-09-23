import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshotStore } from '../../src/store.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const snapshot = (tick) => ({ map: { tick }, latest: { stateHash: `hash-${tick}` } });

test('a slower old refresh cannot overwrite a newer accepted snapshot', async () => {
  const first = deferred();
  const second = deferred();
  const changes = [];
  const store = createSnapshotStore({
    load: ({ token }) => (token === 1 ? first.promise : second.promise),
    onChange: (state) => changes.push(state),
  });
  const oldRequest = store.refresh();
  const newRequest = store.refresh();
  second.resolve(snapshot(2));
  await newRequest;
  first.resolve(snapshot(1));
  await oldRequest;
  assert.equal(store.getState().snapshot.map.tick, 2);
  assert.equal(changes.at(-1).phase, 'live');
});

test('a failed later refresh preserves the last verified snapshot and reports degraded state', async () => {
  let attempt = 0;
  const states = [];
  const store = createSnapshotStore({
    load: async () => {
      attempt += 1;
      if (attempt === 1) return snapshot(4);
      throw new Error('history.json returned HTTP 503');
    },
    onChange: (state) => states.push(state),
  });
  await store.refresh();
  await store.refresh();
  assert.equal(store.getState().phase, 'degraded');
  assert.equal(store.getState().snapshot.map.tick, 4);
  assert.match(store.getState().error.message, /503/);
  assert.equal(states.at(-1).snapshot.map.tick, 4);
});
