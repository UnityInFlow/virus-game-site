import { resolvedColour, createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { cellIdAtPoint, createMapGeometry, moveCellCursor } from '../map-geometry.js';
import { playerName } from './leaderboard.js';

const canvas = byId('map');
const context = canvas.getContext('2d');
let geometry = null;
let current = null;
let selection = Object.freeze({ player: null, cell: null });
let cursorId = 0;
let callbacks = { onPinCell: () => {}, onClearSelection: () => {}, onResize: () => {} };
let resizeObserver = null;
let pointerFrame = null;
let pendingPointer = null;
let bound = false;

function cellFor(id) {
  return current && Number.isInteger(id) ? current.map.cells[id] || null : null;
}

function ownerFor(cell) {
  if (!cell || cell[1] === null) return null;
  return current.order[cell[1]] || null;
}

function coordinatesFor(id) {
  return { x: id % current.map.width, y: Math.floor(id / current.map.width) };
}

function describeCell(cell) {
  if (!cell) return 'outside the field map';
  const [id, , health, energy] = cell;
  const { x, y } = coordinatesFor(id);
  const owner = ownerFor(cell);
  if (!owner) return `cell ${id}, column ${x}, row ${y}: unoccupied`;
  const healthState = health === 0 ? 'inert' : `${health} health`;
  return `cell ${id}, column ${x}, row ${y}: ${playerName(current, owner)}, ${healthState}, ${energy} energy`;
}

function mapPoint(event) {
  if (!geometry || !current) return null;
  const rect = canvas.getBoundingClientRect();
  const id = cellIdAtPoint({ x: event.clientX - rect.left, y: event.clientY - rect.top }, geometry);
  return cellFor(id);
}

function drawOutline(id, colour, width = 1) {
  const cell = cellFor(id);
  if (!cell) return;
  const { x: column, y: row } = coordinatesFor(cell[0]);
  const x = geometry.offsetX + column * geometry.cellSize;
  const y = geometry.offsetY + row * geometry.cellSize;
  context.save();
  context.strokeStyle = colour;
  context.lineWidth = width;
  context.globalAlpha = 1;
  context.strokeRect(
    x + width / 2,
    y + width / 2,
    geometry.cellSize - width,
    geometry.cellSize - width,
  );
  context.restore();
}

function drawMap(style) {
  const empty = style.getPropertyValue('--empty').trim() || '#ded3c2';
  const ink = style.getPropertyValue('--ink').trim() || '#1d1812';
  const accent = style.getPropertyValue('--accent').trim() || '#ad341e';
  const focus = style.getPropertyValue('--focus').trim() || '#195f9d';
  const warning = style.getPropertyValue('--warning').trim() || '#a65318';
  const colours = current.order.map((id) => resolvedColour(current.order, id, style));
  const selectedIndex = current.order.indexOf(selection.player);
  const gap = geometry.cellSize >= 8 ? 1 : 0;

  context.clearRect(0, 0, geometry.cssWidth, geometry.cssHeight);
  for (const cell of current.map.cells) {
    const [id, owner, health] = cell;
    const { x: column, y: row } = coordinatesFor(id);
    const x = geometry.offsetX + column * geometry.cellSize;
    const y = geometry.offsetY + row * geometry.cellSize;
    const dimmed = selectedIndex >= 0 && owner !== null && owner !== selectedIndex;
    context.fillStyle = owner === null ? empty : colours[owner] || '#888';
    context.globalAlpha =
      owner === null ? 1 : (dimmed ? 0.18 : 1) * (0.28 + 0.72 * Math.min(1, health / 100));
    context.fillRect(x + gap / 2, y + gap / 2, geometry.cellSize - gap, geometry.cellSize - gap);

    if (owner === null && geometry.cellSize >= 8) {
      context.save();
      context.strokeStyle = ink;
      context.globalAlpha = 0.2;
      context.lineWidth = 0.75;
      context.beginPath();
      context.moveTo(x + 1, y + geometry.cellSize - 1);
      context.lineTo(x + geometry.cellSize - 1, y + 1);
      context.stroke();
      context.restore();
    } else if (health === 0 && geometry.cellSize >= 6) {
      context.save();
      context.strokeStyle = warning;
      context.globalAlpha = 0.85;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + 1, y + 1);
      context.lineTo(x + geometry.cellSize - 1, y + geometry.cellSize - 1);
      context.moveTo(x + geometry.cellSize - 1, y + 1);
      context.lineTo(x + 1, y + geometry.cellSize - 1);
      context.stroke();
      context.restore();
    }
  }
  if (selectedIndex >= 0 && geometry.cellSize >= 5) {
    for (const cell of current.map.cells) {
      if (cell[1] === selectedIndex) drawOutline(cell[0], ink, 1);
    }
  }
  if (selection.cell !== null)
    drawOutline(selection.cell, accent, Math.min(3, geometry.cellSize / 3));
  if (document.activeElement === canvas)
    drawOutline(cursorId, focus, Math.min(2, geometry.cellSize / 4));
  context.globalAlpha = 1;
}

function fact(label, value) {
  const item = element('div', { className: 'map-fact' });
  item.append(element('dt', { text: label }), element('dd', { text: value }));
  return item;
}

function renderInspector() {
  const detail = clear(byId('cell-inspector-detail'));
  const clearSelection = byId('clear-map-selection');
  clearSelection.hidden = !selection.player && selection.cell === null;
  if (selection.cell === null) {
    detail.append(
      element('p', {
        className: 'muted',
        text: 'Pin a cell with a click, tap, or Enter. Arrow keys move the map cursor.',
      }),
    );
    return;
  }

  const cell = cellFor(selection.cell);
  if (!cell) return;
  const [id, , health, energy] = cell;
  const owner = ownerFor(cell);
  const { x, y } = coordinatesFor(id);
  detail.append(
    element('p', { className: 'map-inspector__location num', text: `cell ${id} · ${x},${y}` }),
  );
  const facts = element('dl', { className: 'map-facts' });
  facts.append(
    fact('status', owner ? (health === 0 ? 'claimed, inert' : 'occupied') : 'unoccupied'),
  );
  facts.append(fact('live health', owner ? String(health) : 'not applicable'));
  facts.append(fact('live energy', owner ? String(energy) : 'not applicable'));
  detail.append(facts);
  if (!owner) {
    detail.append(
      element('p', { className: 'muted', text: 'No player or strain owns this cell.' }),
    );
    return;
  }

  const player = current.players.find((entry) => entry.id === owner);
  const ownerLine = element('p', { className: 'who' });
  ownerLine.append(createSwatch(current.order, owner), textNode(playerName(current, owner)));
  detail.append(ownerLine);
  const strains = player?.strains || [];
  if (strains.length === 1) {
    detail.append(
      element('p', {
        className: 'muted',
        text: `Owner's registered strain: ${strains[0].id}. Individual-cell strain attribution is not public.`,
      }),
    );
  } else if (strains.length > 1) {
    detail.append(
      element('p', {
        className: 'muted',
        text: `Owner has ${strains.length} registered strains. Individual-cell strain attribution is not public.`,
      }),
    );
  } else {
    detail.append(
      element('p', {
        className: 'muted',
        text: 'The owner has no registered strain in this public snapshot.',
      }),
    );
  }
}

function renderSummary() {
  const occupied = current.map.cells.filter((cell) => cell[1] !== null).length;
  const empty = current.map.cells.length - occupied;
  const selected =
    selection.cell === null
      ? 'No cell pinned.'
      : `Pinned ${describeCell(cellFor(selection.cell))}.`;
  byId('map-summary').textContent =
    `${current.map.width} by ${current.map.height} interactive field map. ${occupied} occupied cells and ${empty} unoccupied cells. ${selected}`;
  canvas.setAttribute('aria-label', 'Interactive territory map. Use arrow keys to inspect cells.');
}

function announce(text) {
  byId('map-announcement').textContent = text;
}

function renderTooltip(event) {
  const tip = byId('map-tooltip');
  const cell = mapPoint(event);
  if (!cell) {
    tip.hidden = true;
    return;
  }
  const owner = ownerFor(cell);
  clear(tip);
  if (owner) tip.append(createSwatch(current.order, owner));
  tip.append(textNode(describeCell(cell)));
  const rect = canvas.getBoundingClientRect();
  tip.style.left = `${event.clientX - rect.left}px`;
  tip.style.top = `${event.clientY - rect.top}px`;
  tip.hidden = false;
}

function scheduleTooltip(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  pendingPointer = { clientX: event.clientX, clientY: event.clientY };
  if (pointerFrame !== null) return;
  pointerFrame = window.requestAnimationFrame(() => {
    pointerFrame = null;
    if (pendingPointer) renderTooltip(pendingPointer);
    pendingPointer = null;
  });
}

function pinPoint(event) {
  const cell = mapPoint(event);
  if (!cell) return;
  cursorId = cell[0];
  callbacks.onPinCell(cell[0]);
}

function handleKeydown(event) {
  if (!current) return;
  const movement = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (movement.includes(event.key)) {
    event.preventDefault();
    cursorId = moveCellCursor(cursorId, event.key, current.map.width, current.map.height);
    renderMap(current, selection);
    announce(describeCell(cellFor(cursorId)));
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callbacks.onPinCell(cursorId);
    announce(`Pinned ${describeCell(cellFor(cursorId))}.`);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    callbacks.onClearSelection();
    announce('Map selection cleared.');
  }
}

/** Render only on data, selection, size, or theme changes; pointer moves only update the tooltip. */
export function renderMap(snapshot, nextSelection) {
  current = snapshot;
  selection = nextSelection;
  const cssWidth = canvas.clientWidth;
  if (!cssWidth) return;
  geometry = createMapGeometry({
    width: snapshot.map.width,
    height: snapshot.map.height,
    cssWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
  });
  canvas.width = geometry.pixelWidth;
  canvas.height = geometry.pixelHeight;
  canvas.style.height = `${geometry.cssHeight}px`;
  context.setTransform(geometry.devicePixelRatio, 0, 0, geometry.devicePixelRatio, 0, 0);
  if (!cellFor(cursorId)) cursorId = selection.cell ?? 0;
  drawMap(getComputedStyle(document.documentElement));
  renderInspector();
  renderSummary();
}

export function bindMap(nextCallbacks) {
  callbacks = { ...callbacks, ...nextCallbacks };
  if (bound) return;
  bound = true;
  canvas.addEventListener('pointermove', scheduleTooltip);
  canvas.addEventListener('pointerleave', () => {
    pendingPointer = null;
    byId('map-tooltip').hidden = true;
  });
  canvas.addEventListener('click', pinPoint);
  canvas.addEventListener('keydown', handleKeydown);
  canvas.addEventListener('focus', () => {
    if (current) {
      renderMap(current, selection);
      announce(describeCell(cellFor(cursorId)));
    }
  });
  canvas.addEventListener('blur', () => {
    if (current) renderMap(current, selection);
  });
  resizeObserver = new ResizeObserver(() => callbacks.onResize());
  resizeObserver.observe(canvas.parentElement);
}
