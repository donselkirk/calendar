import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  window.HOMEHQ_SERVICE = false;
  window.HOMEHQ_FRAME = false;
});

it('labels stale service feeds and leaves copies on the server', async () => {
  window.HOMEHQ_SERVICE = true;
  const data = {
    current: { temperature_2m: 4, is_day: 1, weather_code: 0 },
    daily: { temperature_2m_max: [8], temperature_2m_min: [2] }
  };
  window.DEVICE_CONFIG.wasteEnabled = true;
  await import('../js/icons.js');
  await import('../js/app.js');
  await import('../js/weather.js');
  await import('../js/waste.js');
  const app = window.App;
  vi.mocked(fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data, fetchedAt: 1, stale: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { events: [] }, fetchedAt: 1, stale: true }) });
  await app.refreshWeather(true);
  await app.refreshWaste(true);
  expect(app.weatherMarkup()).toContain('is-stale');
  expect(app.wasteStale()).toBe(true);
  expect(fetch.mock.calls[0][0]).toBe('/api/v1/weather');
  expect(fetch.mock.calls[1][0]).toBe('/api/v1/waste');
  expect(localStorage.getItem('homehq.weather.ottawa.v1')).toBeNull();
  expect(localStorage.getItem('homehq.waste.ottawa.v1')).toBeNull();
});

it('loads service holidays and exposes the updater only in the frame', async () => {
  window.HOMEHQ_SERVICE = true;
  await import('../js/icons.js');
  await import('../js/app.js');
  await import('../js/holidays.js');
  await import('../js/updates.js');
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => [{ date: '2026-12-25', name: 'Christmas Day' }] });
  const app = window.App;
  app.holidaysOn(new app.CalendarDate(2026, 11, 25));
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/v1/holidays?year=2026'));
  await app.refreshUpdateStatus();
  expect(fetch).toHaveBeenCalledTimes(1);
  window.HOMEHQ_FRAME = true;
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ available: true, latestVersionName: '1.12.1' }) });
  await app.refreshUpdateStatus();
  expect(fetch.mock.calls[1][0]).toBe('/__device/v1/status');
  expect(app.updateMarkup()).toContain('1.12.1');
});
