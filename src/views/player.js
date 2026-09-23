import { createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { number } from '../format.js';

function stat(key, value) {
  const box = element('div', { className: 'stat' });
  box.append(
    element('div', { className: 'k', text: key }),
    element('div', { className: 'v num', text: value }),
  );
  return box;
}

function chip(text, bad) {
  return element('span', { className: `chip${bad ? ' chip--bad' : ''}`, text });
}

export function renderPlayer(snapshot, selected) {
  const panel = clear(byId('player-detail'));
  const player = snapshot.players.find((candidate) => candidate.id === selected);
  if (!player) {
    panel.append(element('p', { className: 'muted', text: 'Select a player.' }));
    return;
  }
  const head = element('div', { className: 'who' });
  head.style.fontSize = '1.05rem';
  head.style.fontWeight = '600';
  head.append(createSwatch(snapshot.order, player.id), textNode(player.displayName));
  if (!player.enabled) head.append(chip('disabled', true));
  panel.append(head);
  const stats = element('div', { className: 'stats' });
  stats.append(
    stat('cells', number(player.cells)),
    stat('kills', number(player.kills)),
    stat('last tick', `${player.delta > 0 ? '+' : ''}${player.delta}`),
  );
  panel.append(stats);

  const failedNow = {};
  for (const [kind, strains] of Object.entries(snapshot.latest.strainFailures)) {
    for (const strain of strains) failedNow[strain] = kind;
  }
  for (const strain of player.strains) {
    const row = element('div', { className: 'strain' });
    const line = element('div', { className: 'strain-head' });
    line.append(
      element('span', { className: 'strain-id num', text: strain.id }),
      element('span', {
        className: 'muted num',
        text: `${number(strain.cells)} cells · ${number(strain.kills)} kills`,
      }),
    );
    row.append(line);
    const chips = element('div');
    if (strain.suspended) chips.append(chip('suspended', true));
    else if (!strain.enabled) chips.append(chip('disabled', true));
    if (failedNow[strain.id]) chips.append(chip(`failed this tick: ${failedNow[strain.id]}`, true));
    else if (strain.lastFailureKind)
      chips.append(chip(`last failure: ${strain.lastFailureKind}`, false));
    if (chips.children.length) {
      chips.className = 'chips';
      row.append(chips);
    }
    panel.append(row);
  }
  if (!player.strains.length)
    panel.append(element('p', { className: 'muted', text: 'No strains submitted.' }));
}
