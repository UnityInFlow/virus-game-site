import { test, expect } from '@playwright/test';
import { clone, fixture, fixturePath, maximumBoardSnapshot } from '../fixture.js';

async function useFixture(page, name = 'normal') {
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    await route.fulfill({
      path: fixturePath(name, file),
      headers: { 'Last-Modified': 'Tue, 23 Sep 2026 10:00:00 GMT' },
    });
  });
}

async function useSnapshot(page, snapshot) {
  const documents = {
    'latest-tick': snapshot.latest,
    map: snapshot.map,
    players: snapshot.players,
    leaderboard: snapshot.leaderboard,
    history: snapshot.history,
    strains: snapshot.strains,
  };
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    await route.fulfill({ json: documents[file] });
  });
}

test('renders the verified desktop/mobile fixture with all main regions and no page errors', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error));
  await useFixture(page);
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('#tick-number')).toHaveText('tick 2');
  await expect(page.locator('#leaderboard-body tr')).toHaveCount(2);
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#chart-cells svg')).toBeVisible();
  await expect(page.locator('#chart-duration svg')).toBeVisible();
  await expect(page.locator('#chart-failures svg')).toBeVisible();
  await expect(page.locator('#data-health')).toHaveAttribute('data-state', 'live');
  await expect(page.locator('#health-label')).toHaveText('verified');
  await expect(page.locator('#app-status')).toBeHidden();
  await expect(page.locator('#player-detail')).toContainText('Alice');
  await expect(page.locator('#how-it-works')).toContainText('Programs propose.');
  await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Bob' }).click();
  await expect(page.locator('#player-detail')).toContainText('Bob');
  await page.locator('#map').dispatchEvent('click', { clientX: 0, clientY: 0 });
  expect(errors).toEqual([]);
});

test('keeps a deliberate Atlas hierarchy, persistent theme and a usable 320px layout', async ({
  page,
}) => {
  await useFixture(page);
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Game information' })).toBeVisible();
  await expect(page.locator('link[rel="icon"][href="assets/outbreak-mark.svg"]')).toHaveCount(1);

  const theme = page.getByRole('button', { name: /Switch to .* theme/ });
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(theme).toHaveAccessibleName('Switch to light theme');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.locator('#live-map')).toBeVisible();
  await expect(page.locator('#leaderboard-body tr')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('pins live map cells with mouse, touch, keyboard and a coherent shareable selection', async ({
  page,
}, testInfo) => {
  await useFixture(page);
  await page.goto('/');
  const map = page.getByRole('application', { name: 'Interactive territory map' });
  await expect(map).toBeVisible();

  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#map-announcement')).toContainText('cell 1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cell-inspector-detail')).toContainText('cell 1');
  await expect(page.locator('#cell-inspector-detail')).toContainText('Bob');
  await expect(page).toHaveURL(/\?player=bob&cell=1$/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#cell-inspector-detail')).toContainText('Pin a cell');
  await expect(page).not.toHaveURL(/[?&](player|cell)=/);

  const box = await map.boundingBox();
  const point = { x: box.width * 0.25, y: box.height * 0.75 };
  if (testInfo.project.use.hasTouch) await map.tap({ position: point });
  else await map.click({ position: point });
  await expect(page.locator('#cell-inspector-detail')).toContainText('unoccupied');
  await expect(page).toHaveURL(/\?cell=2$/);

  await page.goto('/?player=bob&cell=3');
  await expect(page.locator('#cell-inspector-detail')).toContainText('Alice');
  await expect(page).toHaveURL(/\?player=alice&cell=3$/);
});

test('keeps a ten-player 10,000-cell map sharp, bounded and scroll-safe after resize', async ({
  page,
}) => {
  await useSnapshot(page, maximumBoardSnapshot());
  await page.goto('/');
  const map = page.getByRole('application', { name: 'Interactive territory map' });
  await expect(page.locator('#legend button')).toHaveCount(10);
  await expect(map).toBeVisible();
  const before = await map.evaluate((node) => ({
    width: node.width,
    clientWidth: node.clientWidth,
  }));
  expect(before.width).toBeGreaterThanOrEqual(before.clientWidth);

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(map).toBeVisible();
  await expect.poll(() => map.evaluate((node) => node.width)).not.toBe(before.width);
  const after = await map.evaluate((node) => ({
    width: node.width,
    clientWidth: node.clientWidth,
  }));
  expect(after.width).toBeGreaterThanOrEqual(after.clientWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('inspects current active source safely, copies exact bytes, and supports player navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (value) => {
          window.copiedSource = value;
        },
      },
      configurable: true,
    });
  });
  await useFixture(page);
  await page.goto('/?player=alice');
  await expect(page.getByRole('tablist', { name: 'Alice strains' })).toBeVisible();
  await expect(page.locator('.source-view')).toContainText("print('alice')");
  await expect(page.locator('.source-line__number').first()).toHaveText('1');
  await page.getByRole('button', { name: 'copy exact source' }).click();
  await expect(page.locator('#source-copy-status')).toHaveText('Exact current source copied.');
  expect(await page.evaluate(() => window.copiedSource)).toBe("print('alice')\n");
  await page.getByRole('button', { name: 'next player' }).click();
  await expect(page).toHaveURL(/\?player=bob$/);
  await expect(page.locator('#player-detail')).toContainText('Bob');
});

test('renders hostile source as inert text and explains unavailable active source', async ({
  page,
}) => {
  const snapshot = clone(await fixture());
  snapshot.strains.strains[0].source =
    '<img src=x onerror="window.pwned=1">\u202Every-long\tline\n';
  snapshot.players[0].strains.push({
    id: 'alice-v2',
    enabled: false,
    suspended: false,
    cells: 0,
    kills: 0,
  });
  snapshot.strains.strains.push({
    id: 'alice-v2',
    player: 'alice',
    runtime: 'python',
    apiVersion: 'v1',
    contentHash: 'c'.repeat(64),
    enabled: false,
    suspended: false,
  });
  await useSnapshot(page, snapshot);
  await page.goto('/?player=alice');
  await expect(page.locator('.source-view')).toContainText('<img src=x');
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  await page.getByRole('tab', { name: 'alice-v2' }).click();
  await expect(page.locator('.source-panel')).toContainText(
    'disabled; inactive source is deliberately not published',
  );
  await page.getByRole('tab', { name: 'alice-v2' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'alice-v1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'alice-v1' })).toBeFocused();
});

test('shows a retryable initial data error instead of a partial dashboard', async ({ page }) => {
  let unavailable = true;
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    if (unavailable && file === 'latest-tick') {
      await route.fulfill({ status: 503, body: 'unavailable' });
      return;
    }
    await route.fulfill({ path: fixturePath('normal', file) });
  });
  await page.goto('/');
  await expect(page.getByText('Could not load public game data.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'retry' })).toBeVisible();
  await expect(page.getByRole('main')).toBeHidden();
  unavailable = false;
  await page.getByRole('button', { name: 'retry' }).click();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('#tick-number')).toHaveText('tick 2');
});

test('rejects malformed fixture JSON before a dashboard can render', async ({ page }) => {
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    await route.fulfill({
      path: fixturePath(file === 'latest-tick' ? 'malformed' : 'normal', file),
    });
  });
  await page.goto('/');
  await expect(page.getByText('Could not load public game data.')).toBeVisible();
  await expect(page.getByRole('main')).toBeHidden();
});

test('renders the explicit empty-game state', async ({ page }) => {
  await useFixture(page, 'empty');
  await page.goto('/');
  await expect(page.getByText('No tick has been published yet.')).toBeVisible();
  await expect(page.getByRole('main')).toBeHidden();
  await page.setViewportSize({ width: 700, height: 700 });
  await expect(page.getByRole('main')).toBeHidden();
});

test('a failed refresh retains the dashboard, focus, and advancing refresh age', async ({
  page,
}) => {
  let unavailable = false;
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    if (unavailable && file === 'latest-tick') {
      await route.fulfill({ status: 503, body: 'unavailable' });
      return;
    }
    await route.fulfill({ path: fixturePath('normal', file) });
  });
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  const bob = page.getByRole('button', { name: 'Bob' });
  await bob.focus();
  unavailable = true;
  await page.evaluate(() => document.querySelector('#retry-load').click());
  await expect(page.getByText('Showing the last verified tick.')).toBeVisible();
  await expect(page.locator('#data-health')).toHaveAttribute('data-state', 'degraded');
  await expect(page.locator('#health-label')).toHaveText('stale data');
  await expect(bob).toBeFocused();
  await expect(page.locator('#last-refreshed')).not.toHaveText('refreshed 0s ago', {
    timeout: 2_500,
  });
  await expect(page.getByRole('main')).toBeVisible();
});
