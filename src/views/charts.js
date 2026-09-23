import { resolvedColour, createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { number } from '../format.js';
import { playerName } from './leaderboard.js';

function historyColumn(snapshot, name) {
  const index = snapshot.history.columns.indexOf(name);
  return index < 0 ? null : (row) => row[index];
}

function lineChart(node, series, options = {}) {
  const width = Math.max(260, Math.round(node.clientWidth || 600));
  const height = options.height || 180;
  const padding = { top: 8, right: 8, bottom: 20, left: 38 };
  clear(node);
  const points = series.flatMap((entry) => entry.points);
  const ticks = new Set(points.map((point) => point[0]));
  if (ticks.size < 2) {
    node.append(element('p', { className: 'muted', text: 'Not enough ticks yet.' }));
    return;
  }
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(1, Math.max(...ys));
  const spanX = maxX - minX || 1;
  const px = (x) => padding.left + ((x - minX) / spanX) * (width - padding.left - padding.right);
  const py = (y) => height - padding.bottom - (y / maxY) * (height - padding.top - padding.bottom);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', options.label || 'chart');
  const add = (name, attributes, text) => {
    const child = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => child.setAttribute(key, value));
    if (text !== undefined) child.textContent = text;
    svg.append(child);
    return child;
  };
  const labelled = new Set();
  for (let index = 2; index >= 0; index -= 1) {
    const value = (maxY / 2) * index;
    const label = options.format ? options.format(value) : number(Math.round(value));
    if (labelled.has(label)) continue;
    labelled.add(label);
    const y = py(value);
    add('line', { class: 'gridline', x1: padding.left, x2: width - padding.right, y1: y, y2: y });
    add('text', { class: 'axis', x: padding.left - 6, y: y + 3, 'text-anchor': 'end' }, label);
  }
  add('text', { class: 'axis', x: padding.left, y: height - 6 }, `tick ${minX}`);
  add(
    'text',
    { class: 'axis', x: width - padding.right, y: height - 6, 'text-anchor': 'end' },
    `tick ${maxX}`,
  );
  for (const entry of series) {
    if (entry.bars) {
      const barWidth = Math.max(1, (width - padding.left - padding.right) / (spanX + 1) - 1);
      for (const [x, y] of entry.points) {
        if (!y) continue;
        add('rect', {
          x: px(x) - barWidth / 2,
          y: py(y),
          width: barWidth,
          height: Math.max(1, height - padding.bottom - py(y)),
          fill: entry.colour,
          opacity: 0.85,
        });
      }
      continue;
    }
    const path = entry.points
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'}${px(point[0]).toFixed(1)} ${py(point[1]).toFixed(1)}`,
      )
      .join(' ');
    if (entry.area)
      add('path', {
        d: `${path} L${px(maxX).toFixed(1)} ${py(0)} L${px(minX).toFixed(1)} ${py(0)} Z`,
        fill: entry.colour,
        opacity: 0.12,
        stroke: 'none',
      });
    add('path', { class: 'series', d: path, stroke: entry.colour });
  }
  node.append(svg);
}

export function renderCharts(snapshot) {
  const rows = snapshot.history.ticks;
  const tickOf = historyColumn(snapshot, 'tick');
  const cellsOf = historyColumn(snapshot, 'cells');
  const durationOf = historyColumn(snapshot, 'durationMs');
  const failuresOf = historyColumn(snapshot, 'strainFailures');
  const historyPlayers = snapshot.history.players;
  lineChart(
    byId('chart-cells'),
    historyPlayers.map((id, index) => ({
      colour: resolvedColour(snapshot.order, id),
      points: rows.map((row) => [tickOf(row), cellsOf(row)[index] || 0]),
    })),
    { height: 220, label: 'Cells held by each player, by tick' },
  );
  const legend = clear(byId('cells-legend'));
  for (const id of historyPlayers) {
    const tag = element('span', { className: 'who' });
    tag.append(createSwatch(snapshot.order, id), textNode(playerName(snapshot, id)));
    legend.append(tag);
  }
  const style = getComputedStyle(document.documentElement);
  if (durationOf)
    lineChart(
      byId('chart-duration'),
      [
        {
          colour: style.getPropertyValue('--accent').trim(),
          area: true,
          points: rows.map((row) => [tickOf(row), durationOf(row)]),
        },
      ],
      {
        height: 160,
        label: 'How long each tick took, in milliseconds',
        format: (value) => `${Math.round(value)}ms`,
      },
    );
  if (failuresOf) {
    const total = rows.reduce((sum, row) => sum + failuresOf(row), 0);
    byId('failures-note').textContent =
      rows.length === 0
        ? 'No tick has been published yet.'
        : total === 0
          ? `no strain has failed in the last ${rows.length === 1 ? 'tick' : `${number(rows.length)} ticks`}`
          : `${number(total)} ${total === 1 ? 'failure' : 'failures'} in the last ${rows.length === 1 ? 'tick' : `${number(rows.length)} ticks`}`;
    lineChart(
      byId('chart-failures'),
      [
        {
          colour: style.getPropertyValue('--warning').trim(),
          bars: true,
          points: rows.map((row) => [tickOf(row), failuresOf(row)]),
        },
      ],
      { height: 160, label: 'Strain failures per tick' },
    );
  }
}
