import { validateReplay, validateSnapshot } from '../src/contracts.js';

const base = process.env.VIRUS_GAME_SITE_URL || 'https://unityinflow.github.io/virus-game-site/';
const names = ['latest-tick', 'map', 'players', 'leaderboard', 'history', 'strains', 'replay'];
const responses = await Promise.all(
  names.map(async (name) => {
    const response = await fetch(new URL(`data/${name}.json`, base), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${name}.json returned HTTP ${response.status}`);
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error(`${name}.json has non-JSON content type`);
    return [name, await response.json()];
  }),
);
const documents = Object.fromEntries(responses);
const snapshot = validateSnapshot({
  latest: documents['latest-tick'],
  map: documents.map,
  players: documents.players,
  leaderboard: documents.leaderboard,
  history: documents.history,
  strains: documents.strains,
});
const replay = validateReplay(documents.replay, snapshot);
if (replay.endTick !== snapshot.map.tick)
  throw new Error('replay endpoint is not coherent with the map endpoint');
console.log(
  `Live smoke passed at tick ${snapshot.map.tick}: ${snapshot.players.length} players, ${replay.frames.length} replay frames, ${snapshot.strains.length} current strains.`,
);
