import { resolvedColour, createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { playerName } from './leaderboard.js';

const canvas = byId('map');
const context = canvas.getContext('2d');
let geometry = { size: 0, offsetX: 0, offsetY: 0 };
let current = null;
let onSelectPlayer = () => {};

function cellAt(event) {
  if (!current || !geometry.size) return null;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left - geometry.offsetX) / geometry.size);
  const y = Math.floor((event.clientY - rect.top - geometry.offsetY) / geometry.size);
  if (x < 0 || y < 0 || x >= current.map.width || y >= current.map.height) return null;
  const id = y * current.map.width + x;
  return current.map.cells[id]?.[0] === id ? current.map.cells[id] : null;
}

function renderTooltip(event) {
  const tip = byId('map-tooltip');
  const cell = cellAt(event);
  if (!cell) {
    tip.hidden = true;
    return;
  }
  const [id, owner, health, energy] = cell;
  const x = id % current.map.width;
  const y = Math.floor(id / current.map.width);
  const ownerId = owner === null ? null : current.order[owner];
  clear(tip);
  if (ownerId) tip.append(createSwatch(current.order, ownerId));
  tip.append(
    textNode(' '),
    element('b', { text: ownerId ? playerName(current, ownerId) : 'empty' }),
    textNode(` · ${x},${y}${ownerId ? ` · hp ${health} · en ${energy}` : ''}`),
  );
  const rect = canvas.getBoundingClientRect();
  tip.style.left = `${event.clientX - rect.left}px`;
  tip.style.top = `${event.clientY - rect.top}px`;
  tip.hidden = false;
}

export function renderMap(snapshot, selected) {
  current = snapshot;
  const width = canvas.clientWidth;
  if (!width) return;
  const size = Math.max(3, Math.floor((width - 2) / snapshot.map.width));
  const height = size * snapshot.map.height + 2;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  geometry = {
    size,
    offsetX: Math.floor((width - size * snapshot.map.width) / 2),
    offsetY: 1,
  };

  const style = getComputedStyle(document.documentElement);
  const empty = style.getPropertyValue('--empty').trim() || '#eee';
  const colours = snapshot.order.map((id) => resolvedColour(snapshot.order, id, style));
  const gap = size >= 7 ? 1 : 0;
  context.clearRect(0, 0, width, height);
  for (const [id, owner, health] of snapshot.map.cells) {
    const x = geometry.offsetX + (id % snapshot.map.width) * size;
    const y = geometry.offsetY + Math.floor(id / snapshot.map.width) * size;
    if (owner === null) {
      context.fillStyle = empty;
      context.globalAlpha = 1;
    } else {
      context.fillStyle = colours[owner] || '#888';
      context.globalAlpha = 0.42 + 0.58 * Math.min(1, Math.max(0, health / 100));
    }
    context.fillRect(x, y, size - gap, size - gap);
  }
  context.globalAlpha = 1;
  const selectedIndex = snapshot.order.indexOf(selected);
  if (selectedIndex >= 0 && size >= 5) {
    context.strokeStyle = style.getPropertyValue('--text').trim() || '#000';
    context.lineWidth = 1;
    context.globalAlpha = 0.55;
    for (const [id, owner] of snapshot.map.cells) {
      if (owner !== selectedIndex) continue;
      const x = geometry.offsetX + (id % snapshot.map.width) * size;
      const y = geometry.offsetY + Math.floor(id / snapshot.map.width) * size;
      context.strokeRect(x + 0.5, y + 0.5, size - gap - 1, size - gap - 1);
    }
    context.globalAlpha = 1;
  }
  canvas.setAttribute(
    'aria-label',
    `${snapshot.map.width} by ${snapshot.map.height} map at tick ${snapshot.map.tick}. ${snapshot.leaderboard.map((entry) => `${playerName(snapshot, entry.player)} holds ${entry.cells} cells`).join('. ')}.`,
  );
}

export function bindMap(onSelect) {
  onSelectPlayer = onSelect;
  canvas.addEventListener('mousemove', renderTooltip);
  canvas.addEventListener('mouseleave', () => {
    byId('map-tooltip').hidden = true;
  });
  canvas.addEventListener('click', (event) => {
    const cell = cellAt(event);
    if (cell?.[1] !== null) onSelectPlayer(current.order[cell[1]]);
  });
}
