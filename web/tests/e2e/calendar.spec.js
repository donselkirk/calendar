import { expect, test } from '@playwright/test';

const config = {
  schemaVersion: 1, configured: true, familyLabel: 'Family', wasteEnabled: true,
  people: [
    { id: 'one', name: 'One', color: '#2D5BFF', ink: '#FFFFFF' },
    { id: 'two', name: 'Two', color: '#E4007C', ink: '#FFFFFF' }
  ]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/__config', (route) => route.fulfill({ json: config }));
  await page.route('**/__update_status', (route) => route.fulfill({ json: { available: false, state: 'idle' } }));
  await page.route('**/__waste**', (route) => route.fulfill({ json: { events: [] } }));
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill({ json: {
    current: { temperature_2m: 7, apparent_temperature: 5, relative_humidity_2m: 70, wind_speed_10m: 8, is_day: 1, weather_code: 1 },
    daily: {
      time: ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'],
      weather_code: [1, 0, 2, 3, 61, 71, 45, 95], temperature_2m_max: [9, 10, 8, 7, 6, 3, 5, 4],
      temperature_2m_min: [2, 3, 1, 0, -1, -4, -2, -3], precipitation_probability_max: [10, 5, 20, 15, 80, 60, 20, 50]
    }
  } }));
  await page.goto('/');
});

test('month calendar fits the frame and forecast returns to the calendar', async ({ page }) => {
  await expect(page.locator('.mo-grid')).toBeVisible();
  await expect(page.locator('.cal-title')).toContainText(/2026|2027/);
  const body = await page.locator('body').boundingBox();
  expect(body.width).toBe(1280);
  expect(body.height).toBe(800);
  await page.locator('[data-forecast]').first().click();
  await expect(page.getByText('8-day forecast')).toBeVisible();
  await expect(page.locator('.forecast-day')).toHaveCount(7);
  await page.locator('[data-calendar]').click();
  await expect(page.locator('.mo-grid')).toBeVisible();
});

test('creates an all-day recurring family event with the touch controls', async ({ page }) => {
  await page.locator('.mo-cell:not(.is-out)').nth(10).click();
  await page.locator('[data-add-day]').click();
  await expect(page.locator('[data-kind="all-day"]')).toHaveClass(/is-on/);
  await page.locator('[data-idea="Birthday"]').click();
  await page.locator('[data-repeat="yearly"]').click();
  await page.locator('[data-save]').click();
  await expect(page.getByText(/Added Birthday/)).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('homehq.local.calendar.v1')));
  expect(stored.events[0].allDay).toBe(true);
  expect(stored.events[0].repeat).toBe('yearly');
  expect(stored.events[0].people).toEqual(['one', 'two']);

  await page.getByRole('button', { name: /Birthday/ }).first().click();
  await page.locator('[data-delete]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('homehq.local.calendar.v1')).events)).toHaveLength(0);
  await page.locator('.toast-undo').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('homehq.local.calendar.v1')).events)).toHaveLength(1);
});

test('timed event stepper exposes large left and right tap targets', async ({ page }) => {
  await page.locator('.mo-cell:not(.is-out)').nth(11).click();
  await page.locator('[data-add-day]').click();
  await page.locator('[data-kind="timed"]').click();
  const up = page.locator('[data-time-step="1"]');
  const down = page.locator('[data-time-step="-1"]');
  expect((await up.boundingBox()).width).toBeGreaterThanOrEqual(44);
  expect((await down.boundingBox()).width).toBeGreaterThanOrEqual(44);
  await up.click();
  await expect(page.locator('[data-time-label]')).toHaveText('11:30');
  await page.locator('[data-period="PM"]').click();
  await page.locator('[data-f="title"]').fill('Doctor');
  await page.locator('[data-save]').click();
  const event = await page.evaluate(() => JSON.parse(localStorage.getItem('homehq.local.calendar.v1')).events[0]);
  expect(new Date(event.start).getHours()).toBe(23);
  expect(new Date(event.start).getMinutes()).toBe(30);
});
