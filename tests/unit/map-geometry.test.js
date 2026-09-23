import assert from 'node:assert/strict';
import test from 'node:test';
import { cellIdAtPoint, createMapGeometry, moveCellCursor } from '../../src/map-geometry.js';

test('map geometry preserves a shared fractional grid and a sharp retina backing store', () => {
  const geometry = createMapGeometry({
    width: 50,
    height: 37,
    cssWidth: 503,
    devicePixelRatio: 2,
  });
  assert.equal(geometry.cellSize, 10.02);
  assert.equal(geometry.cssHeight, 372.74);
  assert.equal(geometry.pixelWidth, 1006);
  assert.equal(geometry.pixelHeight, 745);
  assert.equal(cellIdAtPoint({ x: 501.9, y: 371 }, geometry), 1849);
});

test('pointer hit testing excludes map borders and padding', () => {
  const geometry = createMapGeometry({ width: 2, height: 2, cssWidth: 102, devicePixelRatio: 1 });
  assert.equal(cellIdAtPoint({ x: 0.9, y: 1 }, geometry), null);
  assert.equal(cellIdAtPoint({ x: 1, y: 1 }, geometry), 0);
  assert.equal(cellIdAtPoint({ x: 100.9, y: 100.9 }, geometry), 3);
  assert.equal(cellIdAtPoint({ x: 102, y: 101 }, geometry), null);
});

test('keyboard cursor movement remains on the logical board edge', () => {
  assert.equal(moveCellCursor(0, 'ArrowLeft', 3, 2), 0);
  assert.equal(moveCellCursor(0, 'ArrowUp', 3, 2), 0);
  assert.equal(moveCellCursor(0, 'ArrowRight', 3, 2), 1);
  assert.equal(moveCellCursor(4, 'ArrowDown', 3, 2), 4);
  assert.equal(moveCellCursor(4, 'Home', 3, 2), 3);
  assert.equal(moveCellCursor(4, 'End', 3, 2), 5);
});
