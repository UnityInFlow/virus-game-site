const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function column(snapshot, name) {
  const index = snapshot.history.columns.indexOf(name);
  return index < 0 ? null : (row) => row[index];
}

/** A padded numeric domain that remains useful for empty, equal and negative values. */
export function numericDomain(values) {
  const finiteValues = values.filter(finite);
  if (finiteValues.length === 0) return Object.freeze({ min: 0, max: 1 });
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * 0.1);
    return Object.freeze({ min: min - padding, max: max + padding });
  }
  const padding = (max - min) * 0.06;
  return Object.freeze({ min: min - padding, max: max + padding });
}

/** Keep an SVG/canvas tooltip inside a drawing rectangle. */
export function tooltipPosition({ x, y, width, height, tooltipWidth, tooltipHeight }) {
  return Object.freeze({
    x: Math.max(0, Math.min(width - tooltipWidth, x - tooltipWidth / 2)),
    y: Math.max(0, Math.min(height - tooltipHeight, y - tooltipHeight - 12)),
  });
}

/** Normalize compact history rows once so every chart and accessible summary agrees. */
export function analyticsFromSnapshot(snapshot) {
  const tickOf = column(snapshot, 'tick');
  const cellsOf = column(snapshot, 'cells');
  const rows =
    !tickOf || !cellsOf
      ? []
      : snapshot.history.ticks.map((row) =>
          Object.freeze({
            tick: tickOf(row),
            cells: Object.freeze(cellsOf(row).slice()),
            totalLivingCells: column(snapshot, 'totalLivingCells')?.(row) ?? null,
            accepted: column(snapshot, 'accepted')?.(row) ?? null,
            rejected: column(snapshot, 'rejected')?.(row) ?? null,
            kills: column(snapshot, 'kills')?.(row) ?? null,
            deaths: column(snapshot, 'deaths')?.(row) ?? null,
            spreads: column(snapshot, 'spreads')?.(row) ?? null,
            durationMs: column(snapshot, 'durationMs')?.(row) ?? null,
            strainFailures: column(snapshot, 'strainFailures')?.(row) ?? null,
          }),
        );
  return Object.freeze({
    players: Object.freeze(snapshot.history.players.slice()),
    rows: Object.freeze(rows),
    availableTicks: Object.freeze(rows.map((row) => row.tick)),
  });
}

export function rowAtTick(analytics, tick) {
  return analytics.rows.find((row) => row.tick === tick) || null;
}

export function seasonSummary(analytics) {
  const latest = analytics.rows.at(-1) || null;
  const previous = analytics.rows.at(-2) || null;
  if (!latest)
    return Object.freeze({ latest: null, leader: null, leaderChanges: 0, occupiedShare: null });
  const leaderAt = (row) => {
    const high = Math.max(...row.cells);
    const owner = row.cells.indexOf(high);
    return high > 0 ? analytics.players[owner] : null;
  };
  let leaderChanges = 0;
  let leader = null;
  for (const row of analytics.rows) {
    const next = leaderAt(row);
    if (next !== leader && leader !== null && next !== null) leaderChanges += 1;
    leader = next;
  }
  const occupiedShare =
    latest.totalLivingCells && latest.totalLivingCells > 0
      ? latest.cells.reduce((total, value) => total + value, 0) / latest.totalLivingCells
      : null;
  return Object.freeze({
    latest,
    previous,
    leader,
    leaderChanges,
    occupiedShare,
  });
}
