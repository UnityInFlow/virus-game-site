import { PALETTE_SIZE } from './constants.js';

/**
 * Fixed, colour-blind-considered player identities. The same ordinal comes from the
 * public map roster everywhere, so map, standings, dossier and history never disagree.
 */
export const PLAYER_PALETTE = Object.freeze([
  Object.freeze({ light: '#8f3b1a', dark: '#ff9a6a' }),
  Object.freeze({ light: '#1e5eaa', dark: '#8fc7ff' }),
  Object.freeze({ light: '#427000', dark: '#b3da6f' }),
  Object.freeze({ light: '#6c458e', dark: '#dda1ec' }),
  Object.freeze({ light: '#795d00', dark: '#ffd66c' }),
  Object.freeze({ light: '#00756a', dark: '#79dec9' }),
  Object.freeze({ light: '#a02d50', dark: '#ff9eb3' }),
  Object.freeze({ light: '#46589f', dark: '#adb8ff' }),
  Object.freeze({ light: '#a74712', dark: '#ffb26a' }),
  Object.freeze({ light: '#087584', dark: '#72d8ec' }),
]);

if (PLAYER_PALETTE.length !== PALETTE_SIZE) {
  throw new Error(`Expected ${PALETTE_SIZE} player colours.`);
}

export function paletteIndex(players, id) {
  const index = players.indexOf(id);
  return index < 0 ? 0 : index % PALETTE_SIZE;
}

export function colourVariable(players, id) {
  return `var(--player-${paletteIndex(players, id)})`;
}

export function resolvedColour(players, id, style = getComputedStyle(document.documentElement)) {
  return style.getPropertyValue(`--player-${paletteIndex(players, id)}`).trim() || '#888';
}

export function createSwatch(players, id) {
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = colourVariable(players, id);
  swatch.setAttribute('aria-hidden', 'true');
  return swatch;
}

function linear(component) {
  const value = component / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative contrast ratio; retained here so palette evidence stays executable. */
export function contrastRatio(first, second) {
  const luminance = (value) => {
    const match = /^#([0-9a-f]{6})$/i.exec(value);
    if (!match) throw new Error(`Expected a six-digit hex colour, got ${value}.`);
    const hex = match[1];
    const red = linear(Number.parseInt(hex.slice(0, 2), 16));
    const green = linear(Number.parseInt(hex.slice(2, 4), 16));
    const blue = linear(Number.parseInt(hex.slice(4, 6), 16));
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
