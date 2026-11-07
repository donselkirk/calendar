// Calendar-only entry point. Order matters: each module attaches to the shared window.App.
import './icons.js';
import './calendar-data.js';

function validConfig(value) {
  return value && value.schemaVersion === 1 && Array.isArray(value.people) && value.people.length &&
    value.people.every(function (person) {
      return person && /^[a-z0-9][a-z0-9-]{0,39}$/.test(person.id) && person.name &&
        /^#[0-9a-f]{6}$/i.test(person.color) && /^#[0-9a-f]{6}$/i.test(person.ink);
    });
}

async function boot() {
  try {
    var response = await fetch('/__config', { cache: 'no-store' });
    var config = response.ok ? await response.json() : null;
    if (validConfig(config)) window.DEVICE_CONFIG = config;
  } catch (_err) {
    // Browser previews and unprovisioned frames intentionally use the safe generic configuration.
  }
  await import('./app.js');
  await import('./holidays.js');
  await import('./weather.js');
  await import('./waste.js');
  await import('./updates.js');
  await import('./views/calendar.js');
  window.App.start();
}

boot();
