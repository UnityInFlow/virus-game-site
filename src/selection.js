function cellIdFrom(value, cellCount) {
  if (value === null || value === '') return null;
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id < cellCount ? id : null;
}

/** Keep player and cell selection coherent with one trusted public map snapshot. */
export function normaliseSelection(snapshot, candidate = {}) {
  const cell =
    Number.isInteger(candidate.cell) &&
    candidate.cell >= 0 &&
    candidate.cell < snapshot.map.cells.length
      ? candidate.cell
      : null;
  const player = snapshot.players.some((entry) => entry.id === candidate.player)
    ? candidate.player
    : null;
  if (cell === null) return Object.freeze({ player, cell: null });
  const ownerIndex = snapshot.map.cells[cell][1];
  return Object.freeze({ player: ownerIndex === null ? null : snapshot.order[ownerIndex], cell });
}

/** Read a deep link. A missing selection uses the supplied first-visit player fallback. */
export function selectionFromUrl(snapshot, location, fallbackPlayer) {
  const requestedPlayer = location.searchParams.get('player');
  const requestedCell = cellIdFrom(location.searchParams.get('cell'), snapshot.map.cells.length);
  if (requestedPlayer === null && requestedCell === null) {
    return normaliseSelection(snapshot, { player: fallbackPlayer, cell: null });
  }
  return normaliseSelection(snapshot, { player: requestedPlayer, cell: requestedCell });
}

/** Serialize just the two shareable selection parameters and retain unrelated link context. */
export function selectionPath(location, selection) {
  const next = new URL(location.href);
  next.searchParams.delete('player');
  next.searchParams.delete('cell');
  if (selection.player) next.searchParams.set('player', selection.player);
  if (selection.cell !== null) next.searchParams.set('cell', String(selection.cell));
  return `${next.pathname}${next.search}${next.hash}`;
}
