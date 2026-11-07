import { describe, expect, it, vi } from 'vitest';

async function base() {
  vi.resetModules();
  window.ICONS = { cloud: '', sun: '', moon: '', calendar: '' };
  await import('../js/app.js');
  return window.App;
}

describe('official calendar feeds', () => {
  it('calculates Ontario holiday dates locally', async () => {
    const app = await base();
    await import('../js/holidays.js');
    expect(app.holidaysOn(new Date(2026, 1, 16))[0].name).toBe('Family Day');
    expect(app.holidaysOn(new Date(2026, 6, 1))[0].name).toBe('Canada Day');
    expect(app.holidaysOn(new Date(2026, 11, 25))[0].name).toBe('Christmas Day');
    expect(app.holidaysOn(new Date(2018, 6, 2))[0].name).toBe('Canada Day');
    expect(app.holidaysOn(new Date(2026, 10, 7))).toEqual([]);
    expect(app.holidayIcon()).toContain('holiday-icon');
  });

  it('maps garbage, blue plastic and black paper collections to distinct markers', async () => {
    const app = await base();
    fetch.mockResolvedValue({ ok: true, json: async () => ({ events: [{ day: '2026-11-09', flags: [
      { name: 'garbage' }, { name: 'bluebox' }, { subject: 'Black bin' }, { name: 'bluebox' }
    ] }] }) });
    await import('../js/waste.js');
    await app.refreshWaste(false);
    const items = app.wasteOn(new Date(2026, 10, 9));
    expect(items.map((item) => item.type)).toEqual(['garbage', 'blue', 'black']);
    expect(app.wasteIcon(items[0])).toContain('waste-icon--garbage');
    expect(app.wasteIcon(items[1])).toContain('waste-icon--blue');
    expect(app.wasteIcon(items[2])).toContain('waste-icon--black');
  });

  it('caches an eight-day Ottawa forecast and classifies conditions', async () => {
    const app = await base();
    const weather = {
      current: { temperature_2m: 4, apparent_temperature: 1, relative_humidity_2m: 80, wind_speed_10m: 10, is_day: 1, weather_code: 0 },
      daily: { temperature_2m_max: [7], temperature_2m_min: [0], weather_code: [0], precipitation_probability_max: [5], time: ['2026-11-07'] }
    };
    fetch.mockResolvedValue({ ok: true, json: async () => weather });
    await import('../js/weather.js');
    await app.refreshWeather(false);
    expect(app.weatherForecast().data).toEqual(weather);
    expect(app.weatherForecast().condition(0, true).scene).toBe('clear');
    expect(app.weatherForecast().condition(71, true).scene).toBe('snow');
    expect(app.weatherForecast().condition(2, true).scene).toBe('partly');
    expect(app.weatherForecast().condition(3, true).scene).toBe('cloud');
    expect(app.weatherForecast().condition(45, true).scene).toBe('fog');
    expect(app.weatherForecast().condition(61, true).scene).toBe('rain');
    expect(app.weatherForecast().condition(95, true).scene).toBe('storm');
    expect(app.weatherForecast().condition(0, false).icon).toBe('moon');
    expect(app.weatherMarkup()).toContain('Ottawa · Clear');
    expect(JSON.parse(localStorage.getItem('homehq.weather.ottawa.v1')).data.current.temperature_2m).toBe(4);
  });

  it('retains cached weather and collection data across network errors', async () => {
    localStorage.setItem('homehq.weather.ottawa.v1', JSON.stringify({ fetchedAt: Date.now(), data: {
      current: { temperature_2m: 3, weather_code: 3, is_day: 1 },
      daily: { temperature_2m_max: [5], temperature_2m_min: [-1] }
    } }));
    localStorage.setItem('homehq.waste.ottawa.v1', JSON.stringify({ fetchedAt: Date.now(), days: {
      '2026-11-09': [{ type: 'blue', label: 'Blue bin' }, { type: 'invalid', label: 'Ignored' }]
    } }));
    const app = await base();
    app.toast = vi.fn();
    fetch.mockResolvedValue({ ok: false, status: 503 });
    await import('../js/weather.js');
    await import('../js/waste.js');
    expect(app.weatherMarkup()).toContain('Ottawa · Cloudy');
    expect(app.wasteOn(new Date(2026, 10, 9))).toEqual([{ type: 'blue', label: 'Blue bin' }]);
    await app.refreshWeather(true);
    await app.refreshWaste(true);
    expect(app.weatherForecast().error).toBe(true);
    expect(app.toast).toHaveBeenCalledTimes(2);
  });

  it('does not contact the private collection endpoint when device setup is missing', async () => {
    window.DEVICE_CONFIG.wasteEnabled = false;
    const app = await base();
    await import('../js/waste.js');
    app.refreshWaste(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles empty, malformed and partial feed data without exposing stale UI', async () => {
    localStorage.setItem('homehq.weather.ottawa.v1', '{broken');
    localStorage.setItem('homehq.waste.ottawa.v1', '{broken');
    const app = await base();
    app.toast = vi.fn();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ invalid: true }) });
    await import('../js/weather.js');
    expect(app.weatherMarkup()).toContain('Loading');
    await app.refreshWeather(true);
    expect(app.weatherForecast().error).toBe(true);

    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ events: [
      null,
      { day: 'bad', flags: [] },
      { day: '2026-11-10', flags: [{ subject: 'garbage' }, { subject: 'blue bin' }, { name: 'blackbox' }, { name: 'unknown' }] }
    ] }) });
    await import('../js/waste.js');
    await app.refreshWaste(true);
    expect(app.wasteOn(new Date(2026, 10, 10)).map((item) => item.type)).toEqual(['garbage', 'blue', 'black']);
  });
});
