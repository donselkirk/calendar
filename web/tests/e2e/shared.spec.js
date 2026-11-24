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
  } finally {
    await desktop.close();
    await frame.close();
    await new Promise(resolveClose => server.close(resolveClose));
    db.close();
  }
});
