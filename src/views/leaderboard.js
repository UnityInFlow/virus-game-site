import { createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { number } from '../format.js';

export function playerName(snapshot, id) {
  return snapshot.players.find((player) => player.id === id)?.displayName || id;
}

export function renderLeaderboard(snapshot, selected, onSelect) {
  const body = clear(byId('leaderboard-body'));
  for (const entry of snapshot.leaderboard) {
    const row = element('tr', {
      className: 'row',
      attributes: { 'aria-selected': entry.player === selected, tabindex: '0' },
    });
    row.addEventListener('click', () => onSelect(entry.player));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(entry.player);
      }
    });
    const rank = element('td', { className: 'num muted', text: entry.rank });
    const name = element('td');
    const who = element('span', { className: 'who' });
    who.append(
      createSwatch(snapshot.order, entry.player),
      textNode(playerName(snapshot, entry.player)),
    );
    name.append(who);
    const cells = element('td', { className: 'num', text: number(entry.cells) });
    const share = element('td', {
      className: 'num muted',
      text: `${entry.percentage.toFixed(1)}%`,
    });
    const delta = element('td', {
      className: `num ${entry.delta > 0 ? 'delta-up' : entry.delta < 0 ? 'delta-down' : 'muted'}`,
      text: entry.delta > 0 ? `+${entry.delta}` : entry.delta,
    });
    row.append(rank, name, cells, share, delta);
    body.append(row);
  }
  byId('share-note').textContent =
    `share of the ${number(snapshot.leaderboard.reduce((sum, entry) => sum + entry.cells, 0))} living cells`;
}

export function renderLegend(snapshot, selected, onSelect) {
  const legend = clear(byId('legend'));
  for (const id of snapshot.order) {
    const button = element('button', {
      attributes: { type: 'button', 'aria-pressed': id === selected },
    });
    button.append(createSwatch(snapshot.order, id), textNode(playerName(snapshot, id)));
    button.addEventListener('click', () => onSelect(id));
    legend.append(button);
  }
}
