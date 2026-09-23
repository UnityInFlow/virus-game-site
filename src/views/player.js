import { createSwatch } from '../colours.js';
import { byId, clear, element, textNode } from '../dom.js';
import { number } from '../format.js';
import { displayLanguage, playerStrains, sourceStatus } from '../strain-inspector.js';

let activeStrainId = null;

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

function failedThisTick(snapshot) {
  const failures = {};
  for (const [kind, strains] of Object.entries(snapshot.latest.strainFailures)) {
    for (const strain of strains) failures[strain] = kind;
  }
  return failures;
}

function sourceLines(source) {
  const code = element('code', { className: 'source-code' });
  source.split('\n').forEach((line, index) => {
    const row = element('span', { className: 'source-line' });
    row.append(
      element('span', { className: 'source-line__number num', text: index + 1 }),
      element('span', { className: 'source-line__text', text: line || '\u00a0' }),
    );
    code.append(row);
  });
  return code;
}

function copyButton(source) {
  const button = element('button', { className: 'copy-source', attributes: { type: 'button' } });
  button.textContent = 'copy exact source';
  button.addEventListener('click', async () => {
    const announcement = byId('source-copy-status');
    try {
      await navigator.clipboard.writeText(source);
      announcement.textContent = 'Exact current source copied.';
    } catch {
      announcement.textContent = 'Could not copy source. Select the code and copy it manually.';
    }
  });
  return button;
}

function sourcePanel(snapshot, strain) {
  const panel = element('div', {
    className: 'source-panel',
    attributes: {
      role: 'tabpanel',
      id: `strain-panel-${strain.id}`,
      'aria-labelledby': `strain-tab-${strain.id}`,
    },
  });
  const published = strain.public;
  panel.append(
    element('p', {
      className: 'source-panel__status',
      text: sourceStatus(strain),
    }),
  );
  if (!published) return panel;
  const metadata = element('dl', { className: 'source-metadata' });
  metadata.append(
    element('div', {
      text: `${displayLanguage(published.runtime)} · API ${published.apiVersion}`,
    }),
    element('div', { text: `identity ${published.contentHash.slice(0, 12)}…` }),
  );
  panel.append(metadata);
  if (typeof published.source !== 'string') return panel;
  const sourceHead = element('div', { className: 'source-panel__head' });
  sourceHead.append(
    element('p', {
      text: `Current active source at live tick ${snapshot.latest.tick}. It is not historical replay source.`,
    }),
    copyButton(published.source),
  );
  panel.append(sourceHead);
  const source = element('pre', { className: 'source-view', attributes: { tabindex: '0' } });
  source.append(sourceLines(published.source));
  panel.append(source);
  const identity = element('details', { className: 'source-identity' });
  identity.append(
    element('summary', { text: 'Source identity and terminology' }),
    element('p', {
      text: `Runtime is the language sandbox. API ${published.apiVersion} is the decision interface. Full SHA-256: ${published.contentHash}`,
    }),
  );
  panel.append(identity);
  return panel;
}

function strainTabs(snapshot, player) {
  const strains = playerStrains(snapshot, player);
  if (!strains.length)
    return element('p', { className: 'muted', text: 'No strains are registered.' });
  if (!strains.some((strain) => strain.id === activeStrainId)) activeStrainId = strains[0].id;
  const wrapper = element('div', { className: 'strain-inspector' });
  const activate = (id, focus = false) => {
    activeStrainId = id;
    const replacement = strainTabs(snapshot, player);
    wrapper.replaceWith(replacement);
    if (focus) {
      Array.from(replacement.querySelectorAll('[role="tab"]'))
        .find((tab) => tab.dataset.strainId === id)
        ?.focus();
    }
  };
  const tabs = element('div', {
    className: 'strain-tabs',
    attributes: { role: 'tablist', 'aria-label': `${player.displayName} strains` },
  });
  const panelHost = element('div');
  for (const strain of strains) {
    const active = strain.id === activeStrainId;
    const tab = element('button', {
      attributes: {
        type: 'button',
        role: 'tab',
        id: `strain-tab-${strain.id}`,
        'aria-controls': `strain-panel-${strain.id}`,
        'aria-selected': active,
        tabindex: active ? '0' : '-1',
        'data-strain-id': strain.id,
      },
      text: strain.id,
    });
    tab.addEventListener('click', () => {
      activate(strain.id, true);
    });
    tab.addEventListener('keydown', (event) => {
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const next = strains[(strains.indexOf(strain) + direction + strains.length) % strains.length];
      activate(next.id, true);
    });
    tabs.append(tab);
    if (active) panelHost.append(sourcePanel(snapshot, strain));
  }
  wrapper.append(tabs, panelHost);
  return wrapper;
}

function playerControls(snapshot, player, onSelect) {
  const index = snapshot.order.indexOf(player.id);
  const previous = snapshot.order[(index - 1 + snapshot.order.length) % snapshot.order.length];
  const next = snapshot.order[(index + 1) % snapshot.order.length];
  const controls = element('div', { className: 'player-controls' });
  for (const [label, id] of [
    ['previous player', previous],
    ['next player', next],
  ]) {
    const button = element('button', { attributes: { type: 'button' }, text: label });
    button.addEventListener('click', () => onSelect(id));
    controls.append(button);
  }
  return controls;
}

export function renderPlayer(snapshot, selected, onSelect) {
  const panel = clear(byId('player-detail'));
  const player = snapshot.players.find((candidate) => candidate.id === selected);
  if (!player) {
    activeStrainId = null;
    panel.append(
      element('p', { className: 'muted', text: 'Select a player to inspect their live strategy.' }),
    );
    return;
  }
  const head = element('div', { className: 'player-dossier-head' });
  const identity = element('div', { className: 'who' });
  identity.append(createSwatch(snapshot.order, player.id), textNode(player.displayName));
  if (!player.enabled) identity.append(chip('disabled', true));
  head.append(identity, playerControls(snapshot, player, onSelect));
  panel.append(head);
  const stats = element('div', { className: 'stats' });
  stats.append(
    stat('cells', number(player.cells)),
    stat('kills', number(player.kills)),
    stat('last tick', `${player.delta > 0 ? '+' : ''}${player.delta}`),
  );
  panel.append(stats);

  const failures = failedThisTick(snapshot);
  const status = element('div', { className: 'chips' });
  for (const strain of player.strains) {
    if (strain.suspended) status.append(chip(`${strain.id}: suspended`, true));
    else if (!strain.enabled) status.append(chip(`${strain.id}: disabled`, true));
    if (failures[strain.id])
      status.append(chip(`${strain.id}: failed ${failures[strain.id]}`, true));
    else if (strain.lastFailureKind)
      status.append(chip(`${strain.id}: last ${strain.lastFailureKind}`, false));
  }
  if (status.children.length) panel.append(status);
  panel.append(strainTabs(snapshot, player));
  const publicNote = element('p', { className: 'source-public-note' });
  publicNote.append(
    textNode('Active source is public to all players and spectators. '),
    element('a', {
      text: 'Read the rules and submission guide.',
      attributes: {
        href: 'https://github.com/UnityInFlow/virus-game/blob/main/docs/rules.md',
        rel: 'noopener noreferrer',
      },
    }),
  );
  panel.append(
    publicNote,
    element('p', { attributes: { id: 'source-copy-status', 'aria-live': 'polite' } }),
  );
}
