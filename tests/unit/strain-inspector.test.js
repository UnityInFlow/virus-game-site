import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSnapshot } from '../../src/contracts.js';
import { sourceStatus, playerStrains } from '../../src/strain-inspector.js';
import { fixture } from '../fixture.js';

test('joins public source records to a player in their stable submission order', async () => {
  const snapshot = validateSnapshot(await fixture());
  const alice = snapshot.players[0];
  const strains = playerStrains(snapshot, alice);
  assert.equal(strains.length, 1);
  assert.equal(strains[0].public.id, 'alice-v1');
  assert.equal(
    sourceStatus(strains[0]),
    'Current active source is available to every player and spectator.',
  );
});

test('explains inactive and unavailable source without guessing source text', () => {
  assert.match(sourceStatus({ public: undefined }), /No public source record/);
  assert.match(sourceStatus({ public: { enabled: false, suspended: false } }), /disabled/);
  assert.match(sourceStatus({ public: { enabled: true, suspended: true } }), /suspended/);
  assert.match(
    sourceStatus({ public: { enabled: true, suspended: false } }),
    /No active entrypoint/,
  );
});
