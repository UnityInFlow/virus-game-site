import assert from 'node:assert/strict';
import test from 'node:test';
import { PALETTE_SIZE } from '../../src/constants.js';
import { PLAYER_PALETTE, contrastRatio, paletteIndex } from '../../src/colours.js';

test('the ten player identities are stable, unique, and legible against each theme surface', () => {
  assert.equal(PLAYER_PALETTE.length, PALETTE_SIZE);
  assert.equal(new Set(PLAYER_PALETTE.map((colour) => colour.light)).size, PALETTE_SIZE);
  assert.equal(new Set(PLAYER_PALETTE.map((colour) => colour.dark)).size, PALETTE_SIZE);
  for (const colour of PLAYER_PALETTE) {
    assert.ok(
      contrastRatio(colour.light, '#f7f1e7') >= 3,
      `${colour.light} needs non-text contrast on the paper surface`,
    );
    assert.ok(
      contrastRatio(colour.dark, '#111820') >= 3,
      `${colour.dark} needs non-text contrast in the dark lab`,
    );
  }
});

test('a public roster always assigns the same bounded player identity', () => {
  const roster = Array.from({ length: PALETTE_SIZE }, (_, index) => `player-${index}`);
  assert.equal(paletteIndex(roster, 'player-0'), 0);
  assert.equal(paletteIndex(roster, 'player-9'), 9);
  assert.equal(paletteIndex(roster, 'unknown'), 0);
});
