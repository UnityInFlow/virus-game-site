/**
 * Keeps a last-known-good snapshot and makes refreshes monotonic. Views only receive a
 * new snapshot after the complete transaction validates.
 */
export function createSnapshotStore({ load, onChange }) {
  let generation = 0;
  let snapshot = null;
  let state = { phase: 'loading', snapshot: null, error: null, refreshedAt: null };

  function emit(next) {
    state = Object.freeze(next);
    onChange(state);
  }

  async function refresh({ retry = false } = {}) {
    const request = ++generation;
    emit({
      phase: snapshot ? (retry ? 'retrying' : 'refreshing') : retry ? 'retrying' : 'loading',
      snapshot,
      error: null,
      refreshedAt: state.refreshedAt,
    });
    try {
      const next = await load({ token: request });
      if (request !== generation) return { ignored: true };
      snapshot = next;
      emit({
        phase: next.map.tick === 0 ? 'empty' : 'live',
        snapshot,
        error: null,
        refreshedAt: Date.now(),
      });
      return { ignored: false, snapshot };
    } catch (error) {
      if (request !== generation) return { ignored: true };
      emit({
        phase: snapshot ? 'degraded' : 'error',
        snapshot,
        error: error instanceof Error ? error : new Error(String(error)),
        refreshedAt: state.refreshedAt,
      });
      return { ignored: false, error };
    }
  }

  return { refresh, getState: () => state };
}
