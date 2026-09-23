import { test, expect } from '@playwright/test';
import { fixturePath } from '../fixture.js';

async function useFixture(page, name = 'normal') {
  await page.route('**/data/*.json?*', async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').at(-1).replace('.json', '');
    await route.fulfill({
      path: fixturePath(name, file),
      headers: { 'Last-Modified': 'Tue, 23 Sep 2026 10:00:00 GMT' },
    });
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
