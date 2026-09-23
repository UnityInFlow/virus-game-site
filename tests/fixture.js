import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('./fixtures/', import.meta.url);

export async function fixture(name = 'normal') {
  const read = async (file) =>
    JSON.parse(await readFile(new URL(`${name}/data/${file}.json`, root), 'utf8'));
  const [latest, map, players, leaderboard, history] = await Promise.all(
    ['latest-tick', 'map', 'players', 'leaderboard', 'history'].map(read),
  );
  return { latest, map, players, leaderboard, history };
}

export function fixturePath(name, file) {
  return fileURLToPath(new URL(`${name}/data/${file}.json`, root));
}

export function clone(value) {
  return structuredClone(value);
}

export function tenPlayerSnapshot() {
  const ids = Array.from({ length: 10 }, (_, index) => `player-${index}`);
  const players = ids.map((id, index) => ({
    id,
    displayName: `Player ${index}`,
    enabled: true,
    cells: 1,
    kills: 0,
    delta: 0,
    strains: [],
  }));
  return {
    latest: {
      tick: 2,
      tickId: 'fixture-2',
      stateHash: 'c'.repeat(64),
      generatedAt: 'fixture-2',
      durations: {},
      strainFailures: {},
    },
    map: {
      width: 10,
      height: 1,
      tick: 2,
      players: ids,
      cells: ids.map((_, index) => [index, index, 100, 50]),
    },
    players,
    leaderboard: ids.map((id, index) => ({
      rank: index + 1,
      player: id,
      cells: 1,
      percentage: 10,
      delta: 0,
    })),
    history: {
      players: ids,
      columns: ['tick', 'cells'],
      ticks: [
        [1, ids.map(() => 1)],
        [2, ids.map(() => 1)],
      ],
    },
  };
}

/** A contract-valid maximum board with ten identities, empty territory, and inert ownership. */
export function maximumBoardSnapshot() {
  const width = 100;
  const height = 100;
  const ids = Array.from({ length: 10 }, (_, index) => `player-${index}`);
  const counts = ids.map(() => 0);
  const cells = Array.from({ length: width * height }, (_, id) => {
    const owner = id % 17 === 0 ? null : id % ids.length;
    if (owner !== null) counts[owner] += 1;
    return [id, owner, owner === null || id % 19 !== 0 ? 100 : 0, 50];
  });
  const players = ids.map((id, index) => ({
    id,
    displayName: `Player ${index}`,
    enabled: true,
    cells: counts[index],
    kills: 0,
    delta: 0,
    strains: [{ id: `${id}-v1`, enabled: true, suspended: false, cells: counts[index], kills: 0 }],
  }));
  const leaderboard = [...players]
    .sort((first, second) => second.cells - first.cells || first.id.localeCompare(second.id))
    .map((player, index) => ({
      rank: index + 1,
      player: player.id,
      cells: player.cells,
      percentage: (player.cells / cells.length) * 100,
      delta: 0,
    }));
  return {
    latest: {
      tick: 2,
      tickId: 'maximum-fixture-2',
      stateHash: 'd'.repeat(64),
      generatedAt: 'maximum-fixture-2',
      durations: {},
      strainFailures: {},
    },
    map: { width, height, tick: 2, players: ids, cells },
    players,
    leaderboard,
    history: {
      players: ids,
      columns: ['tick', 'cells'],
      ticks: [
        [1, counts],
        [2, counts],
      ],
    },
  };
}
