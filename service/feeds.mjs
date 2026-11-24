const weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=45.4215&longitude=-75.6972' +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,is_day,weather_code' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
  '&temperature_unit=celsius&wind_speed_unit=kmh&timezone=America%2FToronto&forecast_days=8';

export function feeds(db, config, request = fetch) {
  const pending = new Map();
  const failedAt = new Map();
  async function refresh(key, url, interval, normalize) {
    const cached = db.prepare('SELECT * FROM cache WHERE key=?').get(key);
    if (cached && Date.now() - cached.fetched < interval) {
      return { data: JSON.parse(cached.value), fetchedAt: cached.fetched, stale: false };
    }
    if (pending.has(key)) return pending.get(key);
    const stale = () => ({ data: cached ? JSON.parse(cached.value) : null, fetchedAt: cached?.fetched ?? 0, stale: true });
    if (Date.now() - (failedAt.get(key) ?? 0) < 60_000) return stale();
    const task = (async () => {
      try {
        const response = await request(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
        if (!response.ok) throw new Error('Feed unavailable');
        const data = normalize(await response.json());
        if (!data) throw new Error('Invalid feed');
        const fetchedAt = Date.now();
        db.prepare('INSERT OR REPLACE INTO cache VALUES (?, ?, ?)').run(key, JSON.stringify(data), fetchedAt);
        return { data, fetchedAt, stale: false };
      } catch {
        failedAt.set(key, Date.now());
        return stale();
      }
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  return {
    weather: () => refresh('weather', weatherUrl, 30 * 60_000,
      data => Number.isFinite(data?.current?.temperature_2m) && Array.isArray(data?.daily?.temperature_2m_max) ? data : null),
    waste() {
      const waste = config.waste;
      if (!waste) return { data: null, fetchedAt: 0, stale: true };
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto', year: 'numeric', month: '2-digit',
      }).formatToParts();
      const year = Number(parts.find(part => part.type === 'year').value);
      const month = Number(parts.find(part => part.type === 'month').value);
      const iso = delta => new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 10);
      return refresh(`waste:${waste.placeId}:${waste.serviceId}`, `https://api.recollect.net/api/places/${waste.placeId}/services/${waste.serviceId}` +
        `/events?hide=reminder_only&after=${iso(-2)}&before=${iso(14)}`, 6 * 60 * 60_000,
        data => Array.isArray(data?.events) ? { events: data.events
          .filter(event => /^\d{4}-\d{2}-\d{2}$/.test(event?.day) && Array.isArray(event.flags))
          .map(event => ({ day: event.day, flags: event.flags
            .map(flag => ({
              name: ['garbage', 'bluebox', 'blackbox'].find(name => name === flag?.name?.toLowerCase?.()),
              subject: ['garbage', 'blue bin', 'black bin'].find(name => name === flag?.subject?.toLowerCase?.()),
            })).filter(flag => flag.name || flag.subject) })) } : null);
    },
  };
}
