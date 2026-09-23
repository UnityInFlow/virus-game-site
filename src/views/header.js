import { byId } from '../dom.js';
import { ageFrom, number } from '../format.js';

export function renderHeader(snapshot, refreshedAt) {
  const { latest, generated } = snapshot;
  byId('tick-number').textContent = `tick ${number(latest.tick)}`;
  const when = byId('generated-at');
  if (generated) {
    when.textContent = ageFrom(Date.now(), generated.at);
    when.title = `${new Date(generated.at).toISOString()} (${generated.source === 'last-modified' ? 'published' : 'tick id'})`;
  } else {
    when.textContent = `run ${latest.tickId}`;
    when.title = 'This tick identifier does not encode a publication time.';
  }
  const refreshed = byId('last-refreshed');
  refreshed.textContent = refreshedAt ? `refreshed ${ageFrom(Date.now(), refreshedAt)}` : '';
  refreshed.title = refreshedAt ? new Date(refreshedAt).toISOString() : '';
  byId('state-hash').textContent = latest.stateHash.slice(0, 12);
  byId('state-hash').title = latest.stateHash;
}
