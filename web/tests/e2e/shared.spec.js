import { expect, test } from '@playwright/test';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { readConfig } from '../../../service/config.mjs';
import { openDatabase } from '../../../service/db.mjs';
import { makeServer } from '../../../service/server.mjs';

test('@service Toronto calendar shares events between desktop and frame layouts', async ({ browser }) => {
  const config = readConfig('/nonexistent-homehq-config.json');
  const db = openDatabase(':memory:', true);
  const server = makeServer({ config, db, port: 0, root: resolve('dist'), version: 'test',
    request: async () => new globalThis.Response(null, { status: 503 }) });
  server.listen(0, config.host);
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const desktop = await browser.newContext({ timezoneId: 'America/Los_Angeles', viewport: { width: 1024, height: 720 } });
  const frame = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const first = await desktop.newPage();
    const second = await frame.newPage();
    await first.addInitScript(() => {
      const request = window.fetch.bind(window);
      let drop = true;
      window.fetch = async (path, options) => {
        const reply = await request(path, options);
        if (drop && path === '/api/v1/events' && options?.method === 'POST') {
          drop = false;
          throw new Error('Simulated lost reply after the service saved the event');
        }
        return reply;
      };
    });
    await second.route('**/__device/v1/status', route => route.fulfill({ json: { kioskProtocol: 1, available: false } }));
    for (const page of [first, second]) {
      await page.addInitScript(() => { Date.now = () => 1795496460000; });
      await page.goto(origin);
      await expect(page.locator('.mo-cell.is-today')).toHaveCount(1);
      await expect(page.locator('.cal-clock')).toContainText('12:01');
      const paDay = page.locator('.mo-cell').filter({ has: page.locator('.school-pa-marker') });
      await expect(paDay).toHaveCount(1);
      await expect(paDay.locator('.num')).toHaveText('23');
      await paDay.click();
      await expect(page.getByText('No school for students')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    }
    await expect(first.locator('html')).toHaveClass('desktop');
    await expect(second.locator('html')).not.toHaveClass('desktop');
    await first.locator('.mo-cell.is-today').click();
    await first.locator('[data-add-day]').click();
    await first.locator('[data-f=title]').fill('Shared appointment');
    await first.locator('[data-save]').click();
    await expect(first.locator('[data-f=title]')).toHaveValue('Shared appointment');
    await expect(first.getByText(/Could not save/)).toBeVisible();
    await first.locator('[data-save]').click();
    await expect(first.getByText(/Added Shared appointment/)).toBeVisible();
    await second.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(second.locator('.mo-event').filter({ hasText: 'Shared appointment' })).toHaveCount(1);
    await second.locator('.mo-event').filter({ hasText: 'Shared appointment' }).click();
    await second.locator('[data-delete]').click();
    await expect(second.getByText(/Deleted Shared appointment/)).toBeVisible();
    await first.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(first.locator('.mo-event').filter({ hasText: 'Shared appointment' })).toHaveCount(0);

    await first.locator('.mo-cell.is-today').click();
    await first.locator('[data-add-day]').click();
    await first.locator('[data-f=title]').fill('Repeating appointment');
    await first.getByRole('button', { name: 'Yearly' }).click();
    await first.locator('[data-save]').click();
    await first.locator('.mo-event').filter({ hasText: 'Repeating appointment' }).click();
    const status = await second.evaluate(async () => {
      const path = '/api/v1/events';
      const list = await (await fetch(path)).json();
      const event = list.events.find(item => item.title === 'Repeating appointment');
      return (await fetch(path + '/' + event.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-HomeHQ-Client': '1', 'If-Match': '"1"' },
        body: JSON.stringify({ ...event, title: 'Updated appointment' }),
      })).status;
    });
    expect(status).toBe(200);
    await first.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(first.locator('.mo-event').filter({ hasText: 'Updated appointment' })).toHaveCount(1);
    await first.locator('[data-delete]').click();
    await expect(first.getByText('This event changed. Reopen it before deleting.')).toBeVisible();
    await expect(first.locator('.mo-event').filter({ hasText: 'Updated appointment' })).toHaveCount(1);
  } finally {
    await desktop.close();
    await frame.close();
    await new Promise(resolveClose => server.close(resolveClose));
    db.close();
  }
});

test('@service phone browsers can navigate, view forecasts and add timed calendar events', async ({ browser }) => {
  const config = readConfig('/nonexistent-homehq-config.json');
  const db = openDatabase(':memory:', true);
  const server = makeServer({ config, db, port: 0, root: resolve('dist'), version: 'test',
    request: async () => globalThis.Response.json({
      current: { temperature_2m: 4, apparent_temperature: 1, weather_code: 3, is_day: 1 },
      daily: { time: ['2026-11-24'], temperature_2m_max: [5], temperature_2m_min: [1], precipitation_probability_max: [20] },
    }) });
  server.listen(0, config.host);
  await once(server, 'listening');
  const phone = await browser.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  try {
    const page = await phone.newPage();
    await page.addInitScript(() => { Date.now = () => 1795496460000; });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const fitsScreen = () => page.evaluate(() =>
      document.documentElement.scrollWidth === document.documentElement.clientWidth);
    await expect(page.locator('.mo-grid')).toBeVisible();
    expect(await fitsScreen()).toBe(true);
    await page.getByRole('button', { name: 'Next month' }).tap();
    await expect(page.locator('.cal-title')).toHaveText('December');
    await page.getByRole('button', { name: 'Today', exact: true }).tap();
    await expect(page.locator('.cal-title')).toHaveText('November');
    await page.getByRole('button', { name: 'Open Ottawa forecast' }).tap();
    await expect(page.locator('.forecast-now')).toHaveText('4°');
    expect(await fitsScreen()).toBe(true);
    await page.locator('.forecast-day').last().scrollIntoViewIfNeeded();
    await expect(page.locator('.forecast-day').last()).toBeInViewport();
    await page.getByRole('button', { name: 'Calendar', exact: true }).tap();

    const today = page.locator('.mo-cell.is-today');
    await today.tap();
    await page.getByRole('button', { name: 'Add event', exact: true }).tap();
    await page.locator('[data-f=title]').fill('Phone appointment');
    await page.getByRole('button', { name: 'Set a time' }).tap();
    await page.setViewportSize({ width: 320, height: 340 });
    const sheet = page.locator('.sheet');
    await expect(sheet).toBeInViewport();
    expect(await sheet.evaluate(element => element.scrollWidth === element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Move time forward 30 minutes' }).tap();
    await page.getByRole('button', { name: 'Add to calendar' }).tap();
    await expect(today.locator('.mo-event-dots i')).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await today.tap();
    await page.getByRole('button', { name: /Phone appointment/ }).tap();
    await expect(page.getByRole('heading', { name: 'Phone appointment' })).toBeInViewport();
    expect(await fitsScreen()).toBe(true);
    await page.setViewportSize({ width: 932, height: 430 });
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
    expect(await fitsScreen()).toBe(true);
  } finally {
    await phone.close();
    await new Promise(resolveClose => server.close(resolveClose));
    db.close();
  }
});
