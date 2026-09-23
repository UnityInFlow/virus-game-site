import { PALETTE_SIZE } from './constants.js';

function indexOf(players, id) {
  const index = players.indexOf(id);
  return index < 0 ? 0 : index % PALETTE_SIZE;
}

export function colourVariable(players, id) {
  return `var(--p${indexOf(players, id)})`;
}

export function resolvedColour(players, id, style = getComputedStyle(document.documentElement)) {
  return style.getPropertyValue(`--p${indexOf(players, id)}`).trim() || '#888';
}

export function createSwatch(players, id) {
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = colourVariable(players, id);
  swatch.setAttribute('aria-hidden', 'true');
  return swatch;
}
