/** Join the narrow public source contract to the player-visible strain summaries. */
export function playerStrains(snapshot, player) {
  const publicById = new Map(snapshot.strains.map((strain) => [strain.id, strain]));
  return player.strains.map((summary) =>
    Object.freeze({ ...summary, public: publicById.get(summary.id) }),
  );
}

export function sourceStatus(strain) {
  const published = strain.public;
  if (!published) return 'No public source record is available for this strain.';
  if (published.suspended)
    return 'This strain is suspended; inactive source is deliberately not published.';
  if (!published.enabled)
    return 'This strain is disabled; inactive source is deliberately not published.';
  if (typeof published.source !== 'string')
    return 'No active entrypoint source was published for this strain.';
  return 'Current active source is available to every player and spectator.';
}

export function displayLanguage(runtime) {
  if (runtime === 'python') return 'Python';
  if (runtime === 'kotlin') return 'Kotlin';
  return runtime || 'Unknown runtime';
}
