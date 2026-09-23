export class PublicDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PublicDataError';
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isString = (value) => typeof value === 'string' && value.length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

function fail(message) {
  throw new PublicDataError(message);
}

function requireObject(value, name) {
  if (!isObject(value)) fail(`${name} must be an object`);
  return value;
}

function requireArray(value, name) {
  if (!Array.isArray(value)) fail(`${name} must be an array`);
  return value;
}

function requireString(value, name) {
  if (!isString(value)) fail(`${name} must be a non-empty string`);
  return value;
}

function requireInteger(value, name) {
  if (!isNonNegativeInteger(value)) fail(`${name} must be a non-negative integer`);
  return value;
}

function requireNonNegativeFinite(value, name) {
  if (!isFiniteNumber(value) || value < 0) fail(`${name} must be a non-negative finite number`);
  return value;
}

function validateVersion(document, name) {
  const version = document.version ?? document.schemaVersion;
  if (version !== undefined && version !== 1) {
    fail(`${name} has unsupported version '${version}'`);
  }
}

function uniqueStrings(values, name) {
  const seen = new Set();
  values.forEach((value, index) => {
    requireString(value, `${name}[${index}]`);
    if (seen.has(value)) fail(`${name} contains duplicate '${value}'`);
    seen.add(value);
  });
  return seen;
}

function validateMap(map) {
  requireObject(map, 'map.json');
  validateVersion(map, 'map.json');
  const width = requireInteger(map.width, 'map.width');
  const height = requireInteger(map.height, 'map.height');
  if (width === 0 || height === 0) fail('map dimensions must be greater than zero');
  requireInteger(map.tick, 'map.tick');
  const players = requireArray(map.players, 'map.players');
  const playerIds = uniqueStrings(players, 'map.players');
  const cells = requireArray(map.cells, 'map.cells');
  if (cells.length !== width * height) fail(`map.cells must contain ${width * height} cells`);
  cells.forEach((cell, index) => {
    requireArray(cell, `map.cells[${index}]`);
    if (cell.length !== 4) fail(`map.cells[${index}] must contain exactly four values`);
    if (cell[0] !== index) fail(`map.cells[${index}] has id ${cell[0]}, expected ${index}`);
    const owner = cell[1];
    if (owner !== null && (!isNonNegativeInteger(owner) || owner >= players.length)) {
      fail(`map.cells[${index}] has an unknown owner index`);
    }
    requireNonNegativeFinite(cell[2], `map.cells[${index}].health`);
    requireNonNegativeFinite(cell[3], `map.cells[${index}].energy`);
  });
  return playerIds;
}

function validatePlayers(players, playerIds, cellCounts) {
  requireArray(players, 'players.json');
  const ids = new Set();
  players.forEach((player, index) => {
    requireObject(player, `players[${index}]`);
    const id = requireString(player.id, `players[${index}].id`);
    if (ids.has(id)) fail(`players contains duplicate '${id}'`);
    if (!playerIds.has(id)) fail(`players contains unknown player '${id}'`);
    ids.add(id);
    requireString(player.displayName, `players[${index}].displayName`);
    if (typeof player.enabled !== 'boolean') fail(`players[${index}].enabled must be boolean`);
    requireInteger(player.cells, `players[${index}].cells`);
    if (player.cells !== (cellCounts.get(id) || 0)) {
      fail(`player '${id}' cells do not match map ownership`);
    }
    requireInteger(player.kills, `players[${index}].kills`);
    if (!Number.isInteger(player.delta)) fail(`players[${index}].delta must be an integer`);
    requireArray(player.strains, `players[${index}].strains`);
    const strains = new Set();
    player.strains.forEach((strain, strainIndex) => {
      requireObject(strain, `players[${index}].strains[${strainIndex}]`);
      const strainId = requireString(strain.id, `players[${index}].strains[${strainIndex}].id`);
      if (strains.has(strainId)) fail(`player '${id}' has duplicate strain '${strainId}'`);
      strains.add(strainId);
      if (typeof strain.enabled !== 'boolean' || typeof strain.suspended !== 'boolean') {
        fail(`strain '${strainId}' must declare enabled and suspended booleans`);
      }
      requireInteger(strain.cells, `strain '${strainId}'.cells`);
      requireInteger(strain.kills, `strain '${strainId}'.kills`);
      if (strain.lastFailureKind !== undefined && strain.lastFailureKind !== null) {
        requireString(strain.lastFailureKind, `strain '${strainId}'.lastFailureKind`);
      }
    });
  });
  if (ids.size !== playerIds.size)
    fail('players.json does not contain the complete map player set');
}

function validateLeaderboard(leaderboard, playerIds, players) {
  requireArray(leaderboard, 'leaderboard.json');
  const ids = new Set();
  leaderboard.forEach((entry, index) => {
    requireObject(entry, `leaderboard[${index}]`);
    if (entry.rank !== index + 1) fail(`leaderboard rank ${entry.rank} is not contiguous`);
    const id = requireString(entry.player, `leaderboard[${index}].player`);
    if (!playerIds.has(id) || ids.has(id)) fail(`leaderboard has invalid player '${id}'`);
    ids.add(id);
    requireInteger(entry.cells, `leaderboard '${id}'.cells`);
    requireNonNegativeFinite(entry.percentage, `leaderboard '${id}'.percentage`);
    if (!Number.isInteger(entry.delta)) fail(`leaderboard '${id}'.delta must be an integer`);
    const player = players.get(id);
    if (entry.cells !== player.cells || entry.delta !== player.delta) {
      fail(`leaderboard '${id}' does not match players.json`);
    }
  });
  if (ids.size !== playerIds.size) fail('leaderboard does not contain the complete map player set');
}

function validateHistory(history, playerOrder, expectedTick, playersById) {
  requireObject(history, 'history.json');
  validateVersion(history, 'history.json');
  const players = requireArray(history.players, 'history.players');
  if (
    players.length !== playerOrder.length ||
    players.some((id, index) => id !== playerOrder[index])
  ) {
    fail('history.players does not match map.players');
  }
  uniqueStrings(players, 'history.players');
  const columns = requireArray(history.columns, 'history.columns');
  uniqueStrings(columns, 'history.columns');
  const tickIndex = columns.indexOf('tick');
  const cellsIndex = columns.indexOf('cells');
  if (tickIndex < 0 || cellsIndex < 0) fail('history requires tick and cells columns');
  const ticks = requireArray(history.ticks, 'history.ticks');
  let previous = -1;
  ticks.forEach((row, index) => {
    requireArray(row, `history.ticks[${index}]`);
    if (row.length !== columns.length) fail(`history.ticks[${index}] has the wrong width`);
    const tick = requireInteger(row[tickIndex], `history.ticks[${index}].tick`);
    if (tick <= previous) fail('history ticks must be strictly increasing');
    previous = tick;
    const cells = requireArray(row[cellsIndex], `history.ticks[${index}].cells`);
    if (cells.length !== players.length)
      fail(`history.ticks[${index}].cells has the wrong player count`);
    cells.forEach((value, cellIndex) =>
      requireInteger(value, `history.ticks[${index}].cells[${cellIndex}]`),
    );
    row.forEach((value, columnIndex) => {
      if (columnIndex !== cellsIndex)
        requireNonNegativeFinite(value, `history.ticks[${index}][${columns[columnIndex]}]`);
    });
  });
  const latestHistoryTick = ticks.at(-1)?.[tickIndex];
  if (expectedTick === 0 && ticks.length !== 0) fail('history must be empty before the first tick');
  if (expectedTick > 0 && latestHistoryTick !== expectedTick) {
    fail(`history latest tick ${latestHistoryTick} does not match map tick ${expectedTick}`);
  }
  const latestCells = ticks.at(-1)?.[cellsIndex];
  const previousCells = ticks.at(-2)?.[cellsIndex];
  if (latestCells) {
    playerOrder.forEach((id, index) => {
      const player = playersById.get(id);
      if (latestCells[index] !== player.cells) {
        fail(`history cells for '${id}' do not match players.json`);
      }
      const expectedDelta = previousCells ? latestCells[index] - previousCells[index] : 0;
      if (player.delta !== expectedDelta) {
        fail(`player '${id}' delta does not match history`);
      }
    });
  }
}

function validateLatest(latest, tick) {
  requireObject(latest, 'latest-tick.json');
  validateVersion(latest, 'latest-tick.json');
  if (latest.tick !== tick) fail(`latest tick ${latest.tick} does not match map tick ${tick}`);
  requireString(latest.tickId, 'latest.tickId');
  requireString(latest.stateHash, 'latest.stateHash');
  requireString(latest.generatedAt, 'latest.generatedAt');
  requireObject(latest.durations, 'latest.durations');
  Object.entries(latest.durations).forEach(([name, value]) =>
    requireNonNegativeFinite(value, `latest.durations.${name}`),
  );
  requireObject(latest.strainFailures, 'latest.strainFailures');
  Object.entries(latest.strainFailures).forEach(([kind, strains]) => {
    requireArray(strains, `latest.strainFailures.${kind}`);
    uniqueStrings(strains, `latest.strainFailures.${kind}`);
  });
}

function validateStrains(document, tick, playerIds, playersById) {
  requireObject(document, 'strains.json');
  validateVersion(document, 'strains.json');
  if (document.tick !== tick) fail(`strains tick ${document.tick} does not match map tick ${tick}`);
  const strains = requireArray(document.strains, 'strains.strains');
  const ids = new Set();
  const represented = new Set();
  strains.forEach((strain, index) => {
    requireObject(strain, `strains[${index}]`);
    const id = requireString(strain.id, `strains[${index}].id`);
    if (ids.has(id)) fail(`strains contains duplicate '${id}'`);
    ids.add(id);
    const player = requireString(strain.player, `strains[${index}].player`);
    if (!playerIds.has(player)) fail(`strain '${id}' belongs to an unknown player`);
    const playerStrain = playersById.get(player).strains.find((entry) => entry.id === id);
    if (!playerStrain) fail(`strain '${id}' is not present in players.json`);
    represented.add(`${player}:${id}`);
    requireString(strain.runtime, `strain '${id}'.runtime`);
    requireString(strain.apiVersion, `strain '${id}'.apiVersion`);
    if (!/^[a-f0-9]{64}$/i.test(requireString(strain.contentHash, `strain '${id}'.contentHash`))) {
      fail(`strain '${id}' contentHash must be a SHA-256 hex digest`);
    }
    if (typeof strain.enabled !== 'boolean' || typeof strain.suspended !== 'boolean') {
      fail(`strain '${id}' must declare enabled and suspended booleans`);
    }
    if (strain.source !== undefined && strain.source !== null) {
      if (typeof strain.source !== 'string') fail(`strain '${id}' source must be a string`);
      if (!strain.enabled || strain.suspended)
        fail(`inactive strain '${id}' must not publish source`);
    }
  });
  playersById.forEach((player) => {
    player.strains.forEach((strain) => {
      if (!represented.has(`${player.id}:${strain.id}`)) {
        fail(`players.json strain '${strain.id}' is absent from strains.json`);
      }
    });
  });
  return strains;
}

function replayOwner(owner, players, name) {
  if (owner === null) return null;
  if (!isNonNegativeInteger(owner) || owner >= players.length) {
    fail(`${name} has an unknown owner index`);
  }
  return owner;
}

/**
 * Validate the optional replay against a snapshot that has already passed the
 * ordinary public-data contract.  It returns a compact, immutable adapter with
 * replay owner indices translated to the current map player order.
 */
export function validateReplay(document, snapshot) {
  requireObject(document, 'replay.json');
  if (document.version !== 1) fail(`replay has unsupported version '${document.version}'`);
  const width = requireInteger(document.width, 'replay.width');
  const height = requireInteger(document.height, 'replay.height');
  if (width !== snapshot.map.width || height !== snapshot.map.height) {
    fail('replay dimensions do not match map.json');
  }
  const startTick = requireInteger(document.startTick, 'replay.startTick');
  const endTick = requireInteger(document.endTick, 'replay.endTick');
  if (endTick < startTick) fail('replay.endTick must not precede replay.startTick');
  if (endTick !== snapshot.map.tick) fail('replay end tick does not match map.json');
  if (typeof document.truncated !== 'boolean') fail('replay.truncated must be boolean');

  const players = requireArray(document.players, 'replay.players');
  uniqueStrings(players, 'replay.players');
  const playerToMapOwner = players.map((id) => snapshot.order.indexOf(id));
  if (playerToMapOwner.some((owner) => owner < 0) || players.length !== snapshot.order.length) {
    fail('replay players do not match map.json player lookup');
  }

  const cellCount = width * height;
  const initial = requireArray(document.initial, 'replay.initial');
  if (initial.length !== cellCount) fail(`replay.initial must contain ${cellCount} cells`);
  initial.forEach((owner, index) => replayOwner(owner, players, `replay.initial[${index}]`));

  const columns = requireArray(document.columns, 'replay.columns');
  uniqueStrings(columns, 'replay.columns');
  const cellsColumn = columns.indexOf('cells');
  if (cellsColumn < 0) fail('replay.columns requires cells');

  const frames = requireArray(document.frames, 'replay.frames');
  if (frames.length === 0 && endTick !== startTick) fail('replay has no frame for its end tick');
  let previousTick = startTick;
  const reconstructed = initial.slice();
  const preparedFrames = frames.map((frame, frameIndex) => {
    requireArray(frame, `replay.frames[${frameIndex}]`);
    if (frame.length !== 3)
      fail(`replay.frames[${frameIndex}] must contain tick, changes and metrics`);
    const tick = requireInteger(frame[0], `replay.frames[${frameIndex}].tick`);
    if (tick <= previousTick || tick > endTick)
      fail('replay frame ticks must be ordered and retained');
    previousTick = tick;
    const seenCells = new Set();
    const changes = requireArray(frame[1], `replay.frames[${frameIndex}].changes`).map(
      (change, changeIndex) => {
        requireArray(change, `replay.frames[${frameIndex}].changes[${changeIndex}]`);
        if (change.length !== 2) fail(`replay frame ${tick} changes must have cell and owner`);
        const cellId = requireInteger(change[0], `replay frame ${tick} cell`);
        if (cellId >= cellCount || seenCells.has(cellId))
          fail(`replay frame ${tick} has invalid cell change`);
        seenCells.add(cellId);
        const owner = replayOwner(change[1], players, `replay frame ${tick} owner`);
        reconstructed[cellId] = owner;
        return Object.freeze([cellId, owner]);
      },
    );
    const metrics = requireArray(frame[2], `replay.frames[${frameIndex}].metrics`);
    if (metrics.length !== columns.length)
      fail(`replay frame ${tick} metrics have the wrong width`);
    metrics.forEach((value, columnIndex) => {
      if (columnIndex === cellsColumn) {
        requireArray(value, `replay frame ${tick} cells`);
        if (value.length !== players.length)
          fail(`replay frame ${tick} cells has the wrong player count`);
        value.forEach((count, owner) =>
          requireInteger(count, `replay frame ${tick} cells[${owner}]`),
        );
      } else {
        requireNonNegativeFinite(value, `replay frame ${tick} ${columns[columnIndex]}`);
      }
    });
    const expectedCounts = players.map((_, owner) =>
      reconstructed.reduce((count, cellOwner) => count + Number(cellOwner === owner), 0),
    );
    if (metrics[cellsColumn].some((count, owner) => count !== expectedCounts[owner])) {
      fail(`replay frame ${tick} cells do not match its ownership changes`);
    }
    return Object.freeze([tick, Object.freeze(changes), Object.freeze(metrics.slice())]);
  });
  if (previousTick !== endTick) fail('replay does not retain its end tick');

  const mapOwners = snapshot.map.cells.map(([, owner]) => owner);
  const translatedFinalOwners = reconstructed.map((owner) =>
    owner === null ? null : playerToMapOwner[owner],
  );
  if (translatedFinalOwners.some((owner, index) => owner !== mapOwners[index])) {
    fail('replay final ownership does not match map.json');
  }
  const finalCells = preparedFrames.at(-1)?.[2][cellsColumn];
  if (finalCells) {
    players.forEach((id, owner) => {
      if (finalCells[owner] !== snapshot.players.find((player) => player.id === id).cells) {
        fail(`replay final cells do not match players.json for '${id}'`);
      }
    });
  }

  return Object.freeze({
    startTick,
    endTick,
    truncated: document.truncated,
    players: Object.freeze(players.slice()),
    columns: Object.freeze(columns.slice()),
    initial: Object.freeze(
      initial.map((owner) => (owner === null ? null : playerToMapOwner[owner])),
    ),
    frames: Object.freeze(
      preparedFrames.map(([tick, changes, metrics]) =>
        Object.freeze([
          tick,
          Object.freeze(
            changes.map(([cellId, owner]) =>
              Object.freeze([cellId, owner === null ? null : playerToMapOwner[owner]]),
            ),
          ),
          metrics,
        ]),
      ),
    ),
  });
}

/** Validate one complete public snapshot before any view receives it. */
export function validateSnapshot({ latest, map, players, leaderboard, history, strains }) {
  const playerIds = validateMap(map);
  const cellCounts = new Map(map.players.map((id) => [id, 0]));
  map.cells.forEach(([, owner]) => {
    if (owner !== null) cellCounts.set(map.players[owner], cellCounts.get(map.players[owner]) + 1);
  });
  validatePlayers(players, playerIds, cellCounts);
  const playersById = new Map(players.map((player) => [player.id, player]));
  validateLeaderboard(leaderboard, playerIds, playersById);
  validateHistory(history, map.players, map.tick, playersById);
  validateLatest(latest, map.tick);
  const publicStrains = validateStrains(strains, map.tick, playerIds, playersById);
  return Object.freeze({
    latest,
    map,
    players,
    leaderboard,
    history,
    strains: publicStrains,
    order: map.players.slice(),
  });
}
