// Virus Game — the public page.
//
// Reads only the five generated documents under data/ (spec §47). No build step, no
// framework, no dependency: what is in this file is what the browser runs.
//
// Everything here is a projection of data the engine already decided. Nothing on this
// page computes a game rule, and nothing it shows is authoritative — the game repository
// is. If a number here disagrees with the state file, the state file is right.

'use strict';

const DATA = 'data/';
const FILES = ['latest-tick', 'map', 'players', 'leaderboard', 'history'];

/** Four hours: a tick is scheduled every three, so one missed tick is not yet news. */
const STALE_AFTER_MS = 4 * 60 * 60 * 1000;

/** How often the page looks for a newer tick. The engine ticks every three hours. */
const POLL_MS = 60 * 1000;

const PALETTE_SIZE = 8;

const el = (id) => document.getElementById(id);

const game = {
  map: null,
  players: null,
  leaderboard: null,
  history: null,
  latest: null,
  order: [],        // player ids, in the order the generated files use
  selected: null,
  generated: null,  // { at: epoch ms, source: 'last-modified' | 'generatedAt' } or null
};

// ---------------------------------------------------------------- loading

async function load() {
  const responses = await Promise.all(
    FILES.map((name) => fetch(DATA + name + '.json', { cache: 'no-cache' })),
  );
  const missing = responses.filter((r) => !r.ok);
  if (missing.length) {
    throw new Error('data/' + FILES[responses.indexOf(missing[0])] + '.json: HTTP ' + missing[0].status);
  }
  const [latest, map, players, leaderboard, history] = await Promise.all(
    responses.map((r) => r.json()),
  );

  game.latest = latest;
  game.map = map;
  game.players = players;
  game.leaderboard = leaderboard;
  game.history = history;
  game.order = map.players || history.players || players.map((p) => p.id);
  game.generated = generatedAt(responses[0], latest);

  if (!game.selected || !game.players.some((p) => p.id === game.selected)) {
    game.selected = (leaderboard[0] && leaderboard[0].player) || (players[0] && players[0].id) || null;
  }
}

/**
 * When this data was produced — which is harder than it looks, and worth saying why.
 *
 * `latest-tick.json.generatedAt` is the tick id (STORY-0501), because the generated files
 * have to be byte-identical for the same tick and a wall clock inside the engine would
 * break that (§12). Locally the tick id *is* an ISO instant, so it doubles as a timestamp.
 * On the runner it is `github.run_id` — a number, not a time.
 *
 * So the HTTP response's `Last-Modified` is the primary source: the site repository commits
 * these files when the tick pushes them, and Pages serves that commit's time. `generatedAt`
 * is the fallback, and covers a local `python3 -m http.server` over a game you ticked
 * yourself. When neither answers, the page says the tick id and shows no staleness claim —
 * an unknown age is not the same as fresh, and it is certainly not the same as stale.
 */
function generatedAt(response, latest) {
  const header = response.headers.get('Last-Modified');
  if (header) {
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return { at, source: 'last-modified' };
  }
  const iso = isoPrefix(latest && latest.generatedAt);
  if (iso !== null) return { at: iso, source: 'generatedAt' };
  return null;
}

/** An ISO-8601 instant at the start of the string, or null. */
function isoPrefix(value) {
  if (typeof value !== 'string') return null;
  // A local run of several ticks numbers them `<id>+0`, `<id>+1`, … so the instant is a
  // prefix rather than the whole string.
  const match = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/);
  if (!match) return null;
  const at = Date.parse(match[0]);
  return Number.isNaN(at) ? null : at;
}

// ---------------------------------------------------------------- formatting

const fmt = new Intl.NumberFormat('en-US');
const n = (value) => fmt.format(value);

function ago(ms) {
  const seconds = Math.round((Date.now() - ms) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 90) return seconds + 's ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return minutes + ' min ago';
  const hours = Math.round(minutes / 60);
  if (hours < 36) return hours + ' h ago';
  return Math.round(hours / 24) + ' d ago';
}

function colourOf(id) {
  const index = game.order.indexOf(id);
  return 'var(--p' + ((index < 0 ? 0 : index) % PALETTE_SIZE) + ')';
}

/** Canvas takes pixels, not `var(--p3)`. */
function resolved(id) {
  const index = game.order.indexOf(id);
  const name = '--p' + ((index < 0 ? 0 : index) % PALETTE_SIZE);
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function swatch(id) {
  const box = document.createElement('span');
  box.className = 'swatch';
  box.style.background = colourOf(id);
  return box;
}

function displayName(id) {
  const player = (game.players || []).find((p) => p.id === id);
  return (player && player.displayName) || id;
}

// ---------------------------------------------------------------- header

function renderHeader() {
  const latest = game.latest;
  el('tick-number').textContent = 'tick ' + n(latest.tick);

  const when = el('generated-at');
  const badge = el('stale-badge');
  if (game.generated) {
    when.textContent = ago(game.generated.at);
    when.title =
      new Date(game.generated.at).toISOString() +
      (game.generated.source === 'last-modified' ? ' (published)' : ' (tick id)');
    const stale = Date.now() - game.generated.at > STALE_AFTER_MS;
    badge.hidden = !stale;
    badge.title = 'no tick for more than four hours; the schedule is one every three';
  } else {
    // §55's tick id on the runner is a run number. Saying "unknown" is the honest answer,
    // and a link to the run is more use than a guessed age.
    when.textContent = 'run ' + latest.tickId;
    when.title = 'this tick was identified by its workflow run, which carries no time';
    badge.hidden = true;
  }

  el('state-hash').textContent = latest.stateHash.slice(0, 12);
  el('state-hash').title = latest.stateHash;
}

// ---------------------------------------------------------------- map

const canvas = el('map');
const ctx = canvas.getContext('2d');
let geometry = { size: 0, offsetX: 0, offsetY: 0 };

function renderMap() {
  const map = game.map;
  const width = canvas.clientWidth;
  if (!width) return;

  // A cell is square, and the canvas is exactly as tall as the grid needs. Fitting the
  // map to a fixed box instead would letterbox every game that is not 16:9.
  const size = Math.max(3, Math.floor((width - 2) / map.width));
  const height = size * map.height + 2;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = height + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  geometry = { size, offsetX: Math.floor((width - size * map.width) / 2), offsetY: 1 };

  const style = getComputedStyle(document.documentElement);
  const empty = style.getPropertyValue('--empty').trim() || '#eee';
  const colours = game.order.map((id) => resolved(id));

  ctx.clearRect(0, 0, width, height);
  // A visible gap only once cells are big enough to have one; below that it eats the map.
  const gap = size >= 7 ? 1 : 0;

  for (const cell of map.cells) {
    const [id, owner, health] = cell;
    const x = geometry.offsetX + (id % map.width) * size;
    const y = geometry.offsetY + Math.floor(id / map.width) * size;
    if (owner === null || owner === undefined) {
      ctx.fillStyle = empty;
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = colours[owner] || '#888';
      // Health as opacity, floored well above invisible: a cell on 3 health is nearly
      // dead, not nearly absent, and a player looking for their weak edge needs to see it.
      ctx.globalAlpha = 0.42 + 0.58 * Math.min(1, Math.max(0, health / 100));
    }
    ctx.fillRect(x, y, size - gap, size - gap);
  }
  ctx.globalAlpha = 1;

  // The selected player, outlined. Colour alone does not survive eight players.
  if (game.selected) {
    const index = game.order.indexOf(game.selected);
    if (index >= 0 && size >= 5) {
      ctx.strokeStyle = style.getPropertyValue('--text').trim() || '#000';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (const [id, owner] of map.cells) {
        if (owner !== index) continue;
        const x = geometry.offsetX + (id % map.width) * size;
        const y = geometry.offsetY + Math.floor(id / map.width) * size;
        ctx.strokeRect(x + 0.5, y + 0.5, size - gap - 1, size - gap - 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  canvas.setAttribute(
    'aria-label',
    map.width + ' by ' + map.height + ' map at tick ' + map.tick + '. ' +
      game.leaderboard.map((e) => displayName(e.player) + ' holds ' + e.cells + ' cells').join('. ') + '.',
  );
}

function cellAt(event) {
  const rect = canvas.getBoundingClientRect();
  const { size, offsetX, offsetY } = geometry;
  if (!size) return null;
  const x = Math.floor((event.clientX - rect.left - offsetX) / size);
  const y = Math.floor((event.clientY - rect.top - offsetY) / size);
  if (x < 0 || y < 0 || x >= game.map.width || y >= game.map.height) return null;
  const id = y * game.map.width + x;
  return game.map.cells[id] && game.map.cells[id][0] === id ? game.map.cells[id] : null;
}

function bindMap() {
  const tip = el('map-tooltip');

  canvas.addEventListener('mousemove', (event) => {
    const cell = cellAt(event);
    if (!cell) {
      tip.hidden = true;
      return;
    }
    const [id, owner, health, energy] = cell;
    const x = id % game.map.width;
    const y = Math.floor(id / game.map.width);
    const who = owner === null || owner === undefined ? 'empty' : displayName(game.order[owner]);
    tip.innerHTML = '';
    if (owner !== null && owner !== undefined) tip.appendChild(swatch(game.order[owner]));
    tip.append(
      document.createTextNode(' '),
      Object.assign(document.createElement('b'), { textContent: who }),
      document.createTextNode(
        ' · ' + x + ',' + y + (owner === null || owner === undefined ? '' : ' · hp ' + health + ' · en ' + energy),
      ),
    );
    const rect = canvas.getBoundingClientRect();
    tip.style.left = event.clientX - rect.left + 'px';
    tip.style.top = event.clientY - rect.top + 'px';
    tip.hidden = false;
  });

  canvas.addEventListener('mouseleave', () => { tip.hidden = true; });

  canvas.addEventListener('click', (event) => {
    const cell = cellAt(event);
    if (!cell) return;
    const owner = cell[1];
    if (owner === null || owner === undefined) return;
    select(game.order[owner]);
  });
}

// ---------------------------------------------------------------- leaderboard

function renderLeaderboard() {
  const body = el('leaderboard-body');
  body.innerHTML = '';

  for (const entry of game.leaderboard) {
    const row = document.createElement('tr');
    row.className = 'row';
    row.setAttribute('aria-selected', String(entry.player === game.selected));
    row.tabIndex = 0;
    row.addEventListener('click', () => select(entry.player));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select(entry.player);
      }
    });

    const rank = document.createElement('td');
    rank.className = 'num';
    rank.textContent = entry.rank;
    rank.style.color = 'var(--muted)';

    const who = document.createElement('td');
    const wrap = document.createElement('span');
    wrap.className = 'who';
    wrap.append(swatch(entry.player), document.createTextNode(displayName(entry.player)));
    who.appendChild(wrap);

    const cells = document.createElement('td');
    cells.className = 'num';
    cells.textContent = n(entry.cells);

    const share = document.createElement('td');
    share.className = 'num muted';
    share.textContent = entry.percentage.toFixed(1) + '%';

    const delta = document.createElement('td');
    delta.className = 'num ' + (entry.delta > 0 ? 'delta-up' : entry.delta < 0 ? 'delta-down' : 'muted');
    delta.textContent = entry.delta > 0 ? '+' + entry.delta : String(entry.delta);

    row.append(rank, who, cells, share, delta);
    body.appendChild(row);
  }

  el('share-note').textContent =
    'share of the ' + n(game.leaderboard.reduce((sum, e) => sum + e.cells, 0)) + ' living cells';
}

function renderLegend() {
  const legend = el('legend');
  legend.innerHTML = '';
  for (const id of game.order) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(id === game.selected));
    button.append(swatch(id), document.createTextNode(displayName(id)));
    button.addEventListener('click', () => select(id));
    legend.appendChild(button);
  }
}

// ---------------------------------------------------------------- player detail

function renderPlayer() {
  const panel = el('player-detail');
  panel.innerHTML = '';

  const player = (game.players || []).find((p) => p.id === game.selected);
  if (!player) {
    panel.innerHTML = '<p class="muted">Select a player.</p>';
    return;
  }

  const head = document.createElement('div');
  head.className = 'who';
  head.style.fontSize = '1.05rem';
  head.style.fontWeight = '600';
  head.append(swatch(player.id), document.createTextNode(player.displayName));
  if (!player.enabled) {
    const chip = document.createElement('span');
    chip.className = 'chip chip--bad';
    chip.textContent = 'disabled';
    head.appendChild(chip);
  }
  panel.appendChild(head);

  const stats = document.createElement('div');
  stats.className = 'stats';
  stats.append(
    stat('cells', n(player.cells)),
    stat('kills', n(player.kills)),
    stat('last tick', (player.delta > 0 ? '+' : '') + player.delta),
  );
  panel.appendChild(stats);

  // Which of this player's strains failed in the tick on screen, by kind. The generated
  // file groups them the other way round, so invert once here rather than per strain.
  const failedNow = {};
  for (const [kind, strains] of Object.entries(game.latest.strainFailures || {})) {
    for (const strain of strains) failedNow[strain] = kind;
  }

  for (const strain of player.strains) {
    const row = document.createElement('div');
    row.className = 'strain';

    const line = document.createElement('div');
    line.className = 'strain-head';
    const id = document.createElement('span');
    id.className = 'strain-id num';
    id.textContent = strain.id;
    const counts = document.createElement('span');
    counts.className = 'muted num';
    counts.textContent = n(strain.cells) + ' cells · ' + n(strain.kills) + ' kills';
    line.append(id, counts);
    row.appendChild(line);

    const chips = document.createElement('div');
    if (strain.suspended) chips.appendChild(chip('suspended', true));
    else if (!strain.enabled) chips.appendChild(chip('disabled', true));
    if (failedNow[strain.id]) chips.appendChild(chip('failed this tick: ' + failedNow[strain.id], true));
    else if (strain.lastFailureKind) chips.appendChild(chip('last failure: ' + strain.lastFailureKind, false));
    if (chips.children.length) {
      chips.style.marginTop = '4px';
      chips.style.display = 'flex';
      chips.style.gap = '6px';
      chips.style.flexWrap = 'wrap';
      row.appendChild(chips);
    }
    panel.appendChild(row);
  }

  if (!player.strains.length) {
    panel.insertAdjacentHTML('beforeend', '<p class="muted">No strains submitted.</p>');
  }
}

function stat(key, value) {
  const box = document.createElement('div');
  box.className = 'stat';
  box.innerHTML = '<div class="k"></div><div class="v num"></div>';
  box.querySelector('.k').textContent = key;
  box.querySelector('.v').textContent = value;
  return box;
}

function chip(text, bad) {
  const span = document.createElement('span');
  span.className = 'chip' + (bad ? ' chip--bad' : '');
  span.textContent = text;
  return span;
}

// ---------------------------------------------------------------- charts

/**
 * One line chart, drawn as SVG.
 *
 * Hand-drawn rather than pulled from a chart library: the site repository has no build
 * step and no dependency, and a `<script src="https://…">` on a page that shows a game's
 * standings is a third party who can change what the standings say.
 */
function lineChart(node, series, options) {
  const opts = options || {};
  // The viewBox is the panel's real width, so one SVG unit is one CSS pixel and the axis
  // labels come out at the size they are written in. A fixed viewBox stretched to fit
  // would give the wide chart 16px labels and the narrow pair 5px ones.
  const W = Math.max(260, Math.round(node.clientWidth || 600));
  const H = opts.height || 180;
  const pad = { top: 8, right: 8, bottom: 20, left: 38 };

  node.innerHTML = '';
  const points = series.flatMap((s) => s.points);
  // Distinct ticks, not total points. Counting points let a two-player chart through on
  // the game's very first tick — two series of one point each — and drew a pair of axes
  // with nothing between them, while the single-series charts beside it correctly said
  // there was not enough history yet. A line needs two ticks whatever the player count.
  const ticks = new Set(points.map((p) => p[0]));
  if (ticks.size < 2) {
    node.innerHTML = '<p class="muted" style="margin:0">Not enough ticks yet.</p>';
    return;
  }

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(1, Math.max(...ys));
  const spanX = maxX - minX || 1;

  const px = (x) => pad.left + ((x - minX) / spanX) * (W - pad.left - pad.right);
  const py = (y) => H - pad.bottom - (y / maxY) * (H - pad.top - pad.bottom);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opts.label || '');

  const add = (name, attrs, text) => {
    const child = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) child.setAttribute(key, value);
    if (text !== undefined) child.textContent = text;
    svg.appendChild(child);
    return child;
  };

  // Three gridlines and their labels: enough to read a value off, few enough to ignore.
  // Deduplicated, because a chart whose maximum is 1 would otherwise label its middle
  // line "1" as well and claim two different heights are the same number.
  const labelled = new Set();
  for (let i = 2; i >= 0; i -= 1) {
    const value = (maxY / 2) * i;
    const label = opts.format ? opts.format(value) : n(Math.round(value));
    if (labelled.has(label)) continue;
    labelled.add(label);
    const y = py(value);
    add('line', { class: 'gridline', x1: pad.left, x2: W - pad.right, y1: y, y2: y });
    add('text', { class: 'axis', x: pad.left - 6, y: y + 3, 'text-anchor': 'end' }, label);
  }
  add('text', { class: 'axis', x: pad.left, y: H - 6 }, 'tick ' + minX);
  add('text', { class: 'axis', x: W - pad.right, y: H - 6, 'text-anchor': 'end' }, 'tick ' + maxX);

  for (const s of series) {
    if (s.bars) {
      const width = Math.max(1, (W - pad.left - pad.right) / (spanX + 1) - 1);
      for (const [x, y] of s.points) {
        if (!y) continue;
        add('rect', {
          x: px(x) - width / 2, y: py(y), width, height: Math.max(1, H - pad.bottom - py(y)), fill: s.colour, opacity: 0.85,
        });
      }
      continue;
    }
    const d = s.points.map((p, i) => (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join(' ');
    if (s.area) {
      add('path', {
        d: d + ' L' + px(maxX).toFixed(1) + ' ' + py(0) + ' L' + px(minX).toFixed(1) + ' ' + py(0) + ' Z',
        fill: s.colour, opacity: 0.12, stroke: 'none',
      });
    }
    add('path', { class: 'series', d, stroke: s.colour });
  }

  node.appendChild(svg);
}

function historyColumn(name) {
  const index = game.history.columns.indexOf(name);
  return index < 0 ? null : (row) => row[index];
}

function renderCharts() {
  const rows = game.history.ticks || [];
  const tickOf = historyColumn('tick');
  const cellsOf = historyColumn('cells');
  const durationOf = historyColumn('durationMs');
  const failuresOf = historyColumn('strainFailures');
  const historyPlayers = game.history.players || game.order;

  lineChart(
    el('chart-cells'),
    historyPlayers.map((id, index) => ({
      colour: resolved(id),
      points: rows.map((row) => [tickOf(row), (cellsOf(row) || [])[index] || 0]),
    })),
    { height: 220, label: 'Cells held by each player, by tick' },
  );

  el('cells-legend').innerHTML = '';
  for (const id of historyPlayers) {
    const tag = document.createElement('span');
    tag.className = 'who';
    tag.style.fontSize = '.82rem';
    tag.append(swatch(id), document.createTextNode(displayName(id)));
    el('cells-legend').appendChild(tag);
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const warn = getComputedStyle(document.documentElement).getPropertyValue('--warn').trim();

  if (durationOf) {
    lineChart(
      el('chart-duration'),
      [{ colour: accent, area: true, points: rows.map((row) => [tickOf(row), durationOf(row)]) }],
      { height: 160, label: 'How long each tick took, in milliseconds', format: (v) => Math.round(v) + 'ms' },
    );
  }

  if (failuresOf) {
    const total = rows.reduce((sum, row) => sum + failuresOf(row), 0);
    // Spelled out rather than concatenated: the first published tick read "1 in the last
    // 1 ticks", directly under a panel saying there was not enough history to plot.
    if (rows.length === 0) {
      el('failures-note').textContent = 'No tick has been published yet.';
    } else {
      const span = rows.length === 1 ? 'the last tick' : 'the last ' + n(rows.length) + ' ticks';
      el('failures-note').textContent =
        total === 0
          ? 'no strain has failed in ' + span
          : n(total) + (total === 1 ? ' failure in ' : ' failures in ') + span;
    }
    lineChart(
      el('chart-failures'),
      [{ colour: warn, bars: true, points: rows.map((row) => [tickOf(row), failuresOf(row)]) }],
      { height: 160, label: 'Strain failures per tick' },
    );
  }
}

// ---------------------------------------------------------------- wiring

function select(id) {
  game.selected = id;
  renderLeaderboard();
  renderLegend();
  renderPlayer();
  renderMap();
}

function renderAll() {
  el('empty-state').hidden = true;
  el('content').hidden = false;
  renderHeader();
  renderLeaderboard();
  renderLegend();
  renderPlayer();
  renderMap();
  renderCharts();
}

function showEmpty(message) {
  el('content').hidden = true;
  const empty = el('empty-state');
  empty.hidden = false;
  el('empty-detail').textContent = message;
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!game.map) return;
    renderMap();
    // The charts are sized in real pixels too, so they are redrawn rather than rescaled.
    renderCharts();
  }, 120);
});

// Both themes are drawn, not declared: the canvas holds pixels, so a system switching to
// dark has to be repainted rather than restyled.
const scheme = window.matchMedia('(prefers-color-scheme: dark)');
const repaint = () => { if (game.map) { renderMap(); renderCharts(); } };
if (scheme.addEventListener) scheme.addEventListener('change', repaint);

async function refresh(first) {
  try {
    const before = game.latest && game.latest.stateHash;
    await load();
    if (first || before !== game.latest.stateHash) renderAll();
    else renderHeader(); // the age still moves between ticks
  } catch (error) {
    if (first) {
      showEmpty(
        String(error.message || error) +
          '. The season has not started, or the tick has not published yet.',
      );
    }
    // A failed poll on a page that is already showing a tick changes nothing: the last
    // good tick stays on screen, and the next poll is a minute away.
  }
}

bindMap();
refresh(true);
window.setInterval(() => refresh(false), POLL_MS);
