import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyticsFromSnapshot,
  numericDomain,
  rowAtTick,
  seasonSummary,
  tooltipPosition,
} from '../../src/analytics.js';
import { fixture } from '../fixture.js';
import { validateSnapshot } from '../../src/contracts.js';

test('builds exact analytics rows and data-derived season summaries', async () => {
  const analytics = analyticsFromSnapshot(validateSnapshot(await fixture()));
  assert.deepEqual(analytics.availableTicks, [1, 2]);
  assert.deepEqual(rowAtTick(analytics, 2).cells, [2, 1]);
  assert.equal(rowAtTick(analytics, 99), null);
  const summary = seasonSummary(analytics);
  assert.equal(summary.leader, 'alice');
  assert.equal(summary.leaderChanges, 0);
  assert.equal(summary.occupiedShare, 1);
});

test('keeps chart domains and tooltip positions usable at empty, equal, negative and boundary values', () => {
  assert.deepEqual(numericDomain([]), { min: 0, max: 1 });
  assert.deepEqual(numericDomain([4, 4]), { min: 3, max: 5 });
  assert.deepEqual(numericDomain([-10, 10]), { min: -11.2, max: 11.2 });
  assert.deepEqual(
    tooltipPosition({ x: 2, y: 4, width: 100, height: 80, tooltipWidth: 40, tooltipHeight: 20 }),
    { x: 0, y: 0 },
  );
});

test('summarises zero-player and unavailable-history states without invented values', () => {
  const empty = Object.freeze({ players: Object.freeze([]), rows: Object.freeze([]) });
  assert.deepEqual(seasonSummary(empty), {
    latest: null,
    leader: null,
    leaderChanges: 0,
    occupiedShare: null,
  });
});
