import { analyticsFromSnapshot, numericDomain, rowAtTick, seasonSummary } from '../analytics.js';
import { resolvedColour } from '../colours.js';
import { byId, clear, element } from '../dom.js';
import { number } from '../format.js';
import { playerName } from './leaderboard.js';

let visiblePlayers = null;

const svg = (name, attributes, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = text;
  return node;
};

const value = (numberValue, unit = '') =>
  numberValue === null || numberValue === undefined
    ? 'unavailable'
    : `${number(numberValue)}${unit}`;

function renderLineChart(node, { rows, series, focusedTick, label, unit = '', onTick }) {
  clear(node);
  if (!rows.length) {
    node.append(
      element('p', { className: 'muted', text: 'No published history is available yet.' }),
    );
    return;
  }
  const width = Math.max(260, Math.round(node.clientWidth || 600));
  const height = 190;
  const padding = { top: 12, right: 10, bottom: 24, left: 44 };
  const domain = numericDomain(series.flatMap((entry) => entry.values));
  const first = rows[0].tick;
  const last = rows.at(-1).tick;
  const spanX = last - first || 1;
  const spanY = domain.max - domain.min || 1;
  const x = (tick) =>
    padding.left + ((tick - first) / spanX) * (width - padding.left - padding.right);
  const y = (metric) =>
    height -
    padding.bottom -
    ((metric - domain.min) / spanY) * (height - padding.top - padding.bottom);
  const chart = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'application',
    tabindex: 0,
    'aria-label': `${label}. Use left and right arrow keys to select a tick.`,
  });
  for (let index = 0; index < 3; index += 1) {
    const metric = domain.min + ((domain.max - domain.min) * index) / 2;
    chart.append(
      svg('line', {
        class: 'gridline',
        x1: padding.left,
        x2: width - padding.right,
        y1: y(metric),
        y2: y(metric),
      }),
    );
    chart.append(
      svg(
        'text',
        { class: 'axis', x: padding.left - 6, y: y(metric) + 3, 'text-anchor': 'end' },
        value(Math.round(metric), unit),
      ),
    );
  }
  chart.append(svg('text', { class: 'axis', x: padding.left, y: height - 6 }, `tick ${first}`));
  chart.append(
    svg(
      'text',
      { class: 'axis', x: width - padding.right, y: height - 6, 'text-anchor': 'end' },
      `tick ${last}`,
    ),
  );
  series.forEach((entry) => {
    const path = rows
      .map(
        (row, index) =>
          `${index ? 'L' : 'M'}${x(row.tick).toFixed(1)} ${y(entry.values[index]).toFixed(1)}`,
      )
      .join(' ');
    chart.append(svg('path', { class: 'series', d: path, stroke: entry.colour }));
  });
  const focused = rowAtTick({ rows }, focusedTick);
  if (focused)
    chart.append(
      svg('line', {
        class: 'chart-cursor',
        x1: x(focused.tick),
        x2: x(focused.tick),
        y1: padding.top,
        y2: height - padding.bottom,
      }),
    );
  const choose = (event) => {
    const rect = chart.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onTick(rows[Math.round(fraction * (rows.length - 1))].tick);
  };
  chart.addEventListener('pointermove', choose);
  chart.addEventListener('click', choose);
  chart.addEventListener('keydown', (event) => {
    const current = Math.max(
      0,
      rows.findIndex((row) => row.tick === focusedTick),
    );
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? rows.length - 1
          : event.key === 'ArrowLeft'
            ? current - 1
            : event.key === 'ArrowRight'
              ? current + 1
              : null;
    if (target !== null) {
      event.preventDefault();
      onTick(rows[Math.max(0, Math.min(rows.length - 1, target))].tick);
    }
  });
  node.append(chart);
}

function renderTable(node, name, entries) {
  clear(node);
  const table = element('table', { attributes: { 'aria-label': name } });
  const body = element('tbody');
  entries.forEach(([label, metric]) => {
    const row = element('tr');
    row.append(
      element('th', { text: label, attributes: { scope: 'row' } }),
      element('td', { className: 'num', text: metric }),
    );
    body.append(row);
  });
  table.append(body);
  node.append(table);
}

export function renderCharts(snapshot, { focusedTick, onSelectTick } = {}) {
  const analytics = analyticsFromSnapshot(snapshot);
  if (!visiblePlayers) visiblePlayers = new Set(analytics.players);
  const focused = rowAtTick(analytics, focusedTick);
  const summary = seasonSummary(analytics);
  byId('history-focus').textContent = focused
    ? `Focused tick ${focused.tick}. ${summary.leader ? `${playerName(snapshot, summary.leader)} leads the current board.` : ''} Select another point to replay its retained ownership.`
    : `Aggregate history begins at tick ${analytics.availableTicks[0] ?? '—'}; this replay position has no aggregate row.`;
  const controls = clear(byId('cells-controls'));
  const refresh = () => renderCharts(snapshot, { focusedTick, onSelectTick });
  for (const [label, action] of [
    [
      'all',
      () => {
        visiblePlayers = new Set(analytics.players);
      },
    ],
    [
      'none',
      () => {
        visiblePlayers = new Set();
      },
    ],
  ]) {
    const button = element('button', { text: label, attributes: { type: 'button' } });
    button.addEventListener('click', () => {
      action();
      refresh();
    });
    controls.append(button);
  }
  analytics.players.forEach((id) => {
    const button = element('button', {
      text: playerName(snapshot, id),
      attributes: {
        type: 'button',
        'aria-label': `toggle territory series for ${playerName(snapshot, id)}`,
        'aria-pressed': visiblePlayers.has(id),
      },
    });
    button.addEventListener('click', () => {
      if (visiblePlayers.has(id)) visiblePlayers.delete(id);
      else visiblePlayers.add(id);
      refresh();
    });
    controls.append(button);
  });
  const select = (tick) => onSelectTick?.(tick, { announce: true });
  renderLineChart(byId('chart-cells'), {
    rows: analytics.rows,
    focusedTick,
    onTick: select,
    label: 'Cells held by selected players',
    series: analytics.players.flatMap((id, index) =>
      visiblePlayers.has(id)
        ? [
            {
              colour: resolvedColour(snapshot.order, id),
              values: analytics.rows.map((row) => row.cells[index]),
            },
          ]
        : [],
    ),
  });
  clear(byId('cells-legend')).append(
    ...analytics.players
      .filter((id) => visiblePlayers.has(id))
      .map((id) => element('span', { className: 'who', text: playerName(snapshot, id) })),
  );
  renderTable(
    byId('cells-table'),
    'Territory at focused tick',
    focused
      ? analytics.players.map((id, index) => [
          playerName(snapshot, id),
          number(focused.cells[index]),
        ])
      : [['status', 'unavailable']],
  );
  const style = getComputedStyle(document.documentElement);
  renderLineChart(byId('chart-duration'), {
    rows: analytics.rows,
    focusedTick,
    onTick: select,
    label: 'Total tick duration in milliseconds',
    unit: ' ms',
    series: [
      {
        colour: style.getPropertyValue('--accent').trim(),
        values: analytics.rows.map((row) => row.durationMs ?? 0),
      },
    ],
  });
  renderTable(
    byId('duration-table'),
    'Engine health at focused tick',
    focused ? [['total duration', value(focused.durationMs, ' ms')]] : [['status', 'unavailable']],
  );
  const activity = [
    ['accepted', '--ok'],
    ['rejected', '--warning'],
    ['kills', '--danger'],
    ['deaths', '--line-strong'],
    ['spreads', '--focus'],
    ['strainFailures', '--warning'],
  ];
  renderLineChart(byId('chart-failures'), {
    rows: analytics.rows,
    focusedTick,
    onTick: select,
    label: 'Accepted, rejected and outcome counts per tick',
    series: activity.map(([field, token]) => ({
      colour: style.getPropertyValue(token).trim(),
      values: analytics.rows.map((row) => row[field] ?? 0),
    })),
  });
  byId('failures-note').textContent =
    'Each line is a count in the same tick, so their shared scale is comparable.';
  renderTable(
    byId('activity-table'),
    'Actions and outcomes at focused tick',
    focused
      ? activity.map(([field]) => [
          field.replace(/([A-Z])/g, ' $1').toLowerCase(),
          value(focused[field]),
        ])
      : [['status', 'unavailable']],
  );
}
