import { DATA_DIRECTORY, DOCUMENTS, REPLAY_DOCUMENT } from './constants.js';
import { PublicDataError, validateReplay, validateSnapshot } from './contracts.js';
import { generatedAt } from './format.js';

function documentUrl(name, token) {
  return `${DATA_DIRECTORY}/${name}.json?refresh=${encodeURIComponent(token)}`;
}

async function readJson(response, name) {
  try {
    return await response.json();
  } catch {
    throw new PublicDataError(`${name}.json is not valid JSON`);
  }
}

/** Fetch and validate every public artifact as one snapshot transaction. */
export async function loadSnapshot({
  fetchImpl = fetch,
  token = `${Date.now()}-${Math.random()}`,
} = {}) {
  const responses = await Promise.all(
    DOCUMENTS.map(async (name) => {
      let response;
      try {
        response = await fetchImpl(documentUrl(name, token), { cache: 'no-store' });
      } catch {
        throw new PublicDataError(`${name}.json could not be requested`);
      }
      if (!response.ok) throw new PublicDataError(`${name}.json returned HTTP ${response.status}`);
      return response;
    }),
  );
  const [latest, map, players, leaderboard, history, strains] = await Promise.all(
    responses.map((response, index) => readJson(response, DOCUMENTS[index])),
  );
  const snapshot = validateSnapshot({ latest, map, players, leaderboard, history, strains });
  let replay = null;
  let replayProblem = null;
  try {
    const response = await fetchImpl(documentUrl(REPLAY_DOCUMENT, token), { cache: 'no-store' });
    if (!response.ok) throw new PublicDataError(`replay.json returned HTTP ${response.status}`);
    replay = validateReplay(await readJson(response, REPLAY_DOCUMENT), snapshot);
  } catch (error) {
    replayProblem = error instanceof Error ? error.message : 'replay.json could not be loaded';
  }
  return Object.freeze({
    ...snapshot,
    replay,
    replayProblem,
    generated: generatedAt(responses[0], latest),
    key: JSON.stringify({ latest, map, players, leaderboard, history, strains, replay }),
  });
}
