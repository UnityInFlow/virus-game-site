function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive.`);
  return value;
}

/**
 * Canvas geometry in CSS pixels and backing-store pixels. Fractional CSS cells deliberately
 * share one origin, so a wide map does not acquire a cumulative gap at its far edge.
 */
export function createMapGeometry({ width, height, cssWidth, devicePixelRatio = 1, border = 2 }) {
  positiveFinite(width, 'width');
  positiveFinite(height, 'height');
  positiveFinite(cssWidth, 'cssWidth');
  positiveFinite(devicePixelRatio, 'devicePixelRatio');
  if (!Number.isFinite(border) || border < 0) throw new RangeError('border must not be negative.');

  const cellSize = Math.max(1, (cssWidth - border) / width);
  const cssHeight = cellSize * height + border;
  return Object.freeze({
    width,
    height,
    cssWidth,
    cssHeight,
    cellSize,
    offsetX: border / 2,
    offsetY: border / 2,
    pixelWidth: Math.round(cssWidth * devicePixelRatio),
    pixelHeight: Math.round(cssHeight * devicePixelRatio),
    devicePixelRatio,
  });
}

/** Return the logical cell under a canvas-relative point, or null for border/padding. */
export function cellIdAtPoint({ x, y }, geometry) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const column = Math.floor((x - geometry.offsetX) / geometry.cellSize);
  const row = Math.floor((y - geometry.offsetY) / geometry.cellSize);
  if (column < 0 || row < 0 || column >= geometry.width || row >= geometry.height) return null;
  return row * geometry.width + column;
}

/** Move a logical cursor without allowing keyboard navigation to leave the board. */
export function moveCellCursor(cellId, key, width, height) {
  const total = width * height;
  if (!Number.isInteger(cellId) || cellId < 0 || cellId >= total) return 0;
  const column = cellId % width;
  const row = Math.floor(cellId / width);
  if (key === 'ArrowLeft') return row * width + Math.max(0, column - 1);
  if (key === 'ArrowRight') return row * width + Math.min(width - 1, column + 1);
  if (key === 'ArrowUp') return Math.max(0, row - 1) * width + column;
  if (key === 'ArrowDown') return Math.min(height - 1, row + 1) * width + column;
  if (key === 'Home') return row * width;
  if (key === 'End') return row * width + width - 1;
  return cellId;
}
