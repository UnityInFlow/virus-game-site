import { DATA_DIRECTORY, DOCUMENTS } from './constants.js';
import { PublicDataError, validateSnapshot } from './contracts.js';
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
  return Object.freeze({
    ...snapshot,
    generated: generatedAt(responses[0], latest),
    key: JSON.stringify({ latest, map, players, leaderboard, history, strains }),
  });
}
