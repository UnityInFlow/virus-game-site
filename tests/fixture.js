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
