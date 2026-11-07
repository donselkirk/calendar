// Holiday-adjusted Ottawa collection schedule for this frame's address. The Android kiosk exposes
// a fixed same-origin bridge because ReCollect's public feed does not permit browser CORS. Only the
// stable place identifier is used at refresh time; the street address is not stored or transmitted.
(function () {
  'use strict';
  var CACHE_KEY = 'homehq.waste.ottawa.v1';
  var REFRESH_MS = 6 * 60 * 60 * 1000;
  var state = { days: {}, fetchedAt: 0, loading: false, error: false };

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function validDays(days) {
    if (!days || typeof days !== 'object' || Array.isArray(days)) return {};
    var clean = {};
    Object.keys(days).forEach(function (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(days[day])) return;
      clean[day] = days[day].filter(function (item) {
        return item && ['garbage', 'blue', 'black'].indexOf(item.type) > -1 && typeof item.label === 'string';
      });
    });
    return clean;
  }

  try {
    var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.days) {
      state.days = validDays(cached.days);
      state.fetchedAt = Number(cached.fetchedAt) || 0;
    }
  } catch (err) {
    console.warn('Could not read cached Ottawa collection schedule', err);
  }

  function typeFor(flag) {
    var name = String(flag && flag.name || '').toLowerCase();
    var subject = String(flag && flag.subject || '').toLowerCase();
    if (name === 'garbage' || subject === 'garbage') return 'garbage';
    if (name === 'bluebox' || subject === 'blue bin') return 'blue';
    if (name === 'blackbox' || subject === 'black bin') return 'black';
    return null;
  }

  function parse(data) {
    if (!data || !Array.isArray(data.events)) throw new Error('Unexpected collection response');
    var days = {};
    data.events.forEach(function (event) {
      if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(event.day) || !Array.isArray(event.flags)) return;
      var seen = {};
      var items = event.flags.map(function (flag) {
        var type = typeFor(flag);
        if (!type || seen[type]) return null;
        seen[type] = true;
        return { type: type, label: type === 'garbage' ? 'Garbage' : (type === 'blue' ? 'Blue bin' : 'Black bin') };
      }).filter(Boolean);
      if (items.length) days[event.day] = items;
    });
    return days;
  }

  App.wasteOn = function (day) { return state.days[dateKey(day)] || []; };

  App.wasteIcon = function (item) {
    var art;
    if (item.type === 'garbage') {
      // Wheeled trash can.
      art = '<path d="M7 7h10l-1 12H8z" fill="currentColor"/>' +
        '<path d="M6 7h12M9 4h6l1 3H8zM10 10v6M14 10v6"/>' +
        '<circle cx="9" cy="20" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="20" r="1" fill="currentColor" stroke="none"/>';
    } else if (item.type === 'black') {
      // Stacked paper and flattened cardboard.
      art = '<path d="M5 7h11v12H5z"/><path d="M8 4h11v12"/>' +
        '<path d="M8 10h5M8 13h5M8 16h4"/>';
    } else {
      // Plastic bottle.
      art = '<path d="M10 3h4v3l2 3v10.5c0 .8-.7 1.5-1.5 1.5h-5C8.7 21 8 20.3 8 19.5V9l2-3z"/>' +
        '<path d="M10 6h4M8 11h8M10.5 14.5h3"/>';
    }
    return '<span class="waste-icon waste-icon--' + item.type + '" role="img" aria-label="' + App.esc(item.label) + '" title="' + App.esc(item.label) + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + art + '</svg></span>';
  };

  App.refreshWaste = function (manual) {
    if (state.loading) return;
    if (!manual && state.fetchedAt && App.now().getTime() - state.fetchedAt < REFRESH_MS) return;
    state.loading = true;
    state.error = false;
    var now = App.now();
    var after = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    var before = new Date(now.getFullYear(), now.getMonth() + 14, 1);
    if (!window.DEVICE_CONFIG.wasteEnabled) {
      state.loading = false;
      state.error = true;
      return;
    }
    return fetch('/__waste?after=' + dateKey(after) + '&before=' + dateKey(before), { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Collection HTTP ' + response.status);
        return response.json();
      }).then(function (data) {
        state.days = parse(data);
        state.fetchedAt = App.now().getTime();
        state.loading = false;
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, fetchedAt: state.fetchedAt, days: state.days }));
        } catch (_err) {}
        App.emit('waste');
        if (manual) App.toast('Ottawa collection schedule updated', { icon: 'calendar', ms: 2500 });
      }).catch(function (err) {
        state.loading = false;
        state.error = true;
        console.warn('Could not update Ottawa collection schedule', err);
        if (manual) App.toast('Could not update collection days. Showing the last saved schedule.', { tone: 'alert', ms: 5000 });
      });
  };

  App.on('ready', function () {
    App.refreshWaste(false);
    setInterval(function () { App.refreshWaste(false); }, REFRESH_MS);
    window.addEventListener('online', function () { App.refreshWaste(false); });
  });
  // Frames without a clock battery may briefly boot in 1970. Retry as soon as network time moves
  // the calendar to the real date, rather than waiting for the six-hour refresh interval.
  App.on('datechange', function () {
    if (state.error || !state.fetchedAt) App.refreshWaste(false);
  });
})();
