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
  var preview = import.meta.env.DEV || import.meta.env.MODE === 'preview';
  try {
    var response = await fetch(preview ? '/__config' : '/api/v1/bootstrap', { cache: 'no-store' });
    var config = response.ok ? await response.json() : null;
    if (validConfig(config)) window.DEVICE_CONFIG = config;
    if (!preview && !validConfig(config)) throw new Error('Service unavailable');
  } catch (_err) {
    if (!preview) {
      document.body.textContent = '';
      var retry = document.createElement('button');
      retry.className = 'service-unavailable';
      retry.textContent = 'Calendar unavailable · Retry';
      retry.onclick = function () { window.location.reload(); };
      document.body.appendChild(retry);
      return;
    }
  }
  window.HOMEHQ_SERVICE = !preview;
  if (!preview) {
    try {
      var status = await fetch('/__device/v1/status', { cache: 'no-store' });
      window.HOMEHQ_FRAME = status.ok && (await status.json()).kioskProtocol === 1;
    } catch (_err) { window.HOMEHQ_FRAME = false; }
    if (!window.HOMEHQ_FRAME) {
      document.documentElement.classList.add('desktop');
      document.querySelector('meta[name=viewport]').setAttribute('content', 'width=device-width, initial-scale=1');
    }
  }
  await import('./app.js');
  if (!preview) await import('./service-events.js');
  await import('./holidays.js');
  await import('./weather.js');
  await import('./waste.js');
  await import('./school-days.js');
  await import('./updates.js');
  await import('./views/calendar.js');
  window.App.start();
}

boot();
