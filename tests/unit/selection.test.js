import assert from 'node:assert/strict';
import test from 'node:test';
import { normaliseSelection, selectionFromUrl, selectionPath } from '../../src/selection.js';
import { fixture } from '../fixture.js';

test('selection deep links validate against the snapshot and bind a pinned cell to its owner', async () => {
  const snapshot = await fixture();
  const selected = selectionFromUrl(
    { ...snapshot, order: snapshot.map.players },
    new URL('https://example.test/?player=bob&cell=0'),
    'alice',
  );
  assert.deepEqual(selected, { player: 'alice', cell: 0 });
  assert.deepEqual(
    normaliseSelection(
      { ...snapshot, order: snapshot.map.players },
      { player: 'nobody', cell: 99 },
    ),
    { player: null, cell: null },
  );
});

test('selection paths preserve unrelated query and hash context', () => {
  const path = selectionPath(new URL('https://example.test/atlas?view=live#map'), {
    player: 'alice',
    cell: 3,
  });
  assert.equal(path, '/atlas?view=live&player=alice&cell=3#map');
});
