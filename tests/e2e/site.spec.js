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
  await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('shows a retryable initial data error instead of a partial dashboard', async ({ page }) => {
  await page.route('**/data/latest-tick.json?*', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/');
  await expect(page.getByText('Could not load public game data.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'retry' })).toBeVisible();
  await expect(page.getByRole('main')).toBeHidden();
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
});
