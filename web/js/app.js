// Core shell: router, demo clock, idle/ambient, toasts, sheets, helpers.
(function () {
  'use strict';
  var D = window.DATA;

  // The kiosk calendar is deliberately device-local. The static demo data is still used by the
  // other prototype views, but calendar events are loaded only from this WebView's localStorage.
  // Keeping the storage key versioned gives us a safe migration point if the shape changes later.
  var CALENDAR_KEY = 'homehq.local.calendar.v1';
  var config = window.DEVICE_CONFIG;
  function rgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }).join(' ');
  }
  D.people = config.people.map(function (person) {
    return {
      id: person.id, name: person.name, color: person.color.toUpperCase(),
      rgb: rgb(person.color), ink: person.ink.toUpperCase(), home: true, status: ''
    };
  });
  D.ALL = D.people.map(function (p) { return p.id; });
  D.family = { id: 'family', name: config.familyLabel || 'Family', color: '#111111', rgb: '17 17 17', ink: '#FFFFFF' };
  D.configMissing = !config.configured;
  var legacyIds = ['personal', 'familycal', 'work', 'other'];
  var LEGACY_CALENDARS = {};
  legacyIds.forEach(function (id, index) {
    if (D.people[index]) LEGACY_CALENDARS[id] = D.people[index].id;
  });

  function loadLocalEvents() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(CALENDAR_KEY) || '{"events":[]}');
      if (!saved || !Array.isArray(saved.events)) return [];
      return saved.events.map(function (e) {
        if (!e || typeof e !== 'object') return null;
        var start = new Date(e.start), end = new Date(e.end);
        if (!e.id || !e.title || isNaN(+start) || isNaN(+end) || end <= start) return null;
        var people = Array.isArray(e.people) ? e.people.map(function (id) {
          return LEGACY_CALENDARS[id] || id;
        }).filter(function (id, index, all) {
          return D.ALL.indexOf(id) > -1 && all.indexOf(id) === index;
        }) : [];
        return {
          id: String(e.id), title: String(e.title), people: people.length ? people : D.ALL.slice(),
          start: start, end: end, allDay: !!e.allDay,
          repeat: ['weekly', 'monthly', 'yearly'].indexOf(e.repeat) > -1 ? e.repeat : '',
          loc: e.loc ? String(e.loc) : '', notes: e.notes ? String(e.notes) : '',
          travel: Number(e.travel) > 0 ? Number(e.travel) : 0
        };
      }).filter(Boolean);
    } catch (err) {
      console.warn('Could not read the local calendar', err);
      return [];
    }
  }

  D.events = loadLocalEvents();
  D.busyExtras = [];
  var localEventSequence = 0;
  D._eid = function () {
    localEventSequence++;
    return 'local-' + App.now().getTime().toString(36) + '-' + localEventSequence.toString(36);
  };

  var App = window.App = { state: D, views: {}, current: null, mode: 'day', calMode: 'normal' };
  var $ = App.$ = function (s, r) { return (r || document).querySelector(s); };
  App.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  App.saveEvents = function () {
    try {
      window.localStorage.setItem(CALENDAR_KEY, JSON.stringify({ version: 2, events: D.events }));
      return true;
    } catch (err) {
      console.error('Could not save the local calendar', err);
      return false;
    }
  };

  // ------------------------------------------------------------ events
  var handlers = {};
  App.on = function (e, fn) { (handlers[e] = handlers[e] || []).push(fn); };
  App.emit = function (e, a) { (handlers[e] || []).forEach(function (fn) { fn(a); }); };

  // ------------------------------------------------------------ time
  // This frame has no dependable RTC and briefly boots at the Unix epoch. Seed the display from
  // the last known-good instant so December 1969 never becomes the visible calendar. A native
  // same-origin endpoint refreshes this anchor over plain HTTP; once Android network time arrives,
  // the app automatically returns to the system clock.
  var CLOCK_KEY = 'homehq.clock.anchor.v1';
  var CLOCK_MIN = +new Date(2020, 0, 1);
  var trustedEpoch = null;
  var trustedStarted = 0;
  var clockRequestPending = false;
  var offset = 0;

  function validEpoch(value) { return isFinite(Number(value)) && Number(value) >= CLOCK_MIN; }
  function cachedClock() {
    var best = 0;
    try {
      var saved = JSON.parse(window.localStorage.getItem(CLOCK_KEY) || 'null');
      if (saved && validEpoch(saved.epoch)) best = Number(saved.epoch);
    } catch (_err) {}
    // Home HQ 1.9 already has this cache, so the first launch of this update can also skip 1969.
    try {
      var weather = JSON.parse(window.localStorage.getItem('homehq.weather.ottawa.v1') || 'null');
      if (weather && validEpoch(weather.fetchedAt)) best = Math.max(best, Number(weather.fetchedAt));
    } catch (_err) {}
    return best || null;
  }
  function rememberClock(epoch) {
    if (!validEpoch(epoch)) return;
    try { window.localStorage.setItem(CLOCK_KEY, JSON.stringify({ epoch: Math.round(epoch) })); } catch (_err) {}
  }
  function useTrustedClock(epoch) {
    if (!validEpoch(epoch)) return false;
    trustedEpoch = Number(epoch);
    trustedStarted = window.performance && performance.now ? performance.now() : 0;
    offset = 0;
    rememberClock(trustedEpoch);
    lastMin = -1;
    App.emit('time');
    if (App.rerender) App.rerender();
    return true;
  }
  if (!validEpoch(Date.now())) useTrustedClock(cachedClock());

  App.now = function () {
    if (trustedEpoch != null) {
      var elapsed = window.performance && performance.now ? performance.now() - trustedStarted : 0;
      return new Date(trustedEpoch + elapsed);
    }
    return new Date(Date.now() + offset);
  };
  App.clockReady = function () { return validEpoch(App.now().getTime()); };
  App.setTrustedNow = useTrustedClock;
  App.refreshClock = function () {
    if (validEpoch(Date.now()) || clockRequestPending) return;
    clockRequestPending = true;
    fetch('/__network_time', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Clock HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      clockRequestPending = false;
      if (!useTrustedClock(data && data.epoch)) throw new Error('Invalid network time');
    }).catch(function (err) {
      clockRequestPending = false;
      console.warn('Could not refresh the frame clock', err);
    });
  };
  App.setTime = function (h, m) {
    trustedEpoch = null;
    if (h == null) offset = 0;
    else { var d = new Date(); d.setHours(h, m, 0, 0); offset = d - Date.now(); }
    lastMin = -1;
    App.emit('time');
    App.rerender();
  };
  App.dayStart = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  App.addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  App.sameDay = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  App.isNight = function () { var h = App.now().getHours(); return h >= 22 || h < 6; };

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  App.fmt = {
    time: function (d, ampm) {
      var h = d.getHours(), m = d.getMinutes();
      var s = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
      return ampm === false ? s : s + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    // "4 PM", "3:45 PM"
    hour: function (d) {
      var h = d.getHours(), m = d.getMinutes();
      return (h % 12 || 12) + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ' ' + (h >= 12 ? 'PM' : 'AM');
    },
    ampm: function (d) { return d.getHours() >= 12 ? 'PM' : 'AM'; },
    range: function (a, b) {
      var same = App.fmt.ampm(a) === App.fmt.ampm(b);
      return (same ? App.fmt.time(a, false) : App.fmt.time(a)) + ' – ' + App.fmt.time(b);
    },
    day: function (d) { return DAYS[d.getDay()]; },
    dayShort: function (d) { return DAYS[d.getDay()].slice(0, 3); },
    month: function (d) { return MONTHS[d.getMonth()]; },
    monthShort: function (d) { return MON_SHORT[d.getMonth()]; },
    mins: function (m) {
      m = Math.max(0, Math.round(m));
      if (m < 60) return m + ' min';
      var h = Math.floor(m / 60), r = m % 60;
      return h + ' hr' + (r ? ' ' + r + ' min' : '');
    },
    rel: function (d) {
      var t = App.dayStart(App.now()), x = App.dayStart(d), diff = Math.round((x - t) / 864e5);
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      if (diff === -1) return 'Yesterday';
      return DAYS[d.getDay()];
    }
  };
  App.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  // ------------------------------------------------------------ icons + people
  App.icon = function (name, size, cls) {
    size = size || 24;
    return '<svg class="i ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.ICONS[name] || '') + '</svg>';
  };
  App.person = function (id) {
    if (id === 'family' || id === 'any') return D.family;
    for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i];
    return D.family;
  };
  App.pstyle = function (p) {
    if (typeof p === 'string') p = App.person(p);
    return '--c:' + p.color + ';--c-rgb:' + p.rgb + ';--c-ink:' + p.ink;
  };
  App.avatar = function (p, size, cls) {
    if (typeof p === 'string') p = App.person(p);
    size = size || 48;
    return '<span class="avatar ' + (cls || '') + '" style="' + App.pstyle(p) + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px">' + (p.id === 'family' ? '★' : p.name[0]) + '</span>';
  };
  App.dots = function (ids, size) {
    return '<span class="dots">' + ids.map(function (id) { return '<i style="' + App.pstyle(id) + (size ? ';width:' + size + 'px;height:' + size + 'px' : '') + '"></i>'; }).join('') + '</span>';
  };

  // ------------------------------------------------------------ calendar helpers
  App.events = function () {
    var list = D.events.slice();
    var today = App.dayStart(App.now());
    if (App.calMode === 'busy') list = list.concat(D.busyExtras);
    if (App.calMode === 'empty') list = list.filter(function (e) { return e.allDay || !App.sameDay(e.start, today); });
    return list;
  };
  App.isFamily = function (e) { return e.people.length >= D.people.length; };
  App.evColor = function (e) { return App.isFamily(e) ? D.family : App.person(e.people[0]); };
  var occurrenceCache = {};
  function dayNumber(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5; }
  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function occurrenceOn(ev, day) {
    if (!ev.repeat) return null;
    var target = App.dayStart(day), origin = App.dayStart(ev.start);
    if (dayNumber(target) < dayNumber(origin)) return null;
    var matches = false;
    if (ev.repeat === 'weekly') {
      matches = (dayNumber(target) - dayNumber(origin)) % 7 === 0;
    } else if (ev.repeat === 'monthly') {
      var months = (target.getFullYear() - origin.getFullYear()) * 12 + target.getMonth() - origin.getMonth();
      matches = months >= 0 && target.getDate() === Math.min(origin.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
    } else if (ev.repeat === 'yearly') {
      matches = target.getMonth() === origin.getMonth() &&
        target.getDate() === Math.min(origin.getDate(), daysInMonth(target.getFullYear(), origin.getMonth()));
    }
    if (!matches) return null;
    var start = new Date(target);
    if (!ev.allDay) start.setHours(ev.start.getHours(), ev.start.getMinutes(), ev.start.getSeconds(), 0);
    var end;
    if (ev.allDay) {
      var span = Math.max(1, dayNumber(ev.end) - dayNumber(ev.start));
      end = App.addDays(start, span);
    } else {
      end = new Date(+start + (ev.end - ev.start));
    }
    var copy = {};
    Object.keys(ev).forEach(function (key) { copy[key] = ev[key]; });
    copy.id = ev.id + '@' + target.getFullYear() + String(target.getMonth() + 1).padStart(2, '0') + String(target.getDate()).padStart(2, '0');
    copy.seriesId = ev.id;
    copy.start = start;
    copy.end = end;
    occurrenceCache[copy.id] = copy;
    return copy;
  }
  function eventsOn(day, allDay, pid) {
    var s = App.dayStart(day), e = App.addDays(s, 1), out = [];
    App.events().forEach(function (ev) {
      var shown = ev.repeat ? occurrenceOn(ev, day) : ev;
      if (!shown || shown.allDay !== allDay || pid && shown.people.indexOf(pid) < 0) return;
      if (shown.start < e && shown.end > s) out.push(shown);
    });
    return out;
  }
  App.timedOn = function (day, pid) {
    return eventsOn(day, false, pid).sort(function (a, b) { return a.start - b.start || b.end - a.end; });
  };
  App.allDayOn = function (day, pid) {
    return eventsOn(day, true, pid);
  };
  App.leaveBy = function (e) { return e.travel ? new Date(+e.start - e.travel * 60000) : e.start; };
  // The next thing someone needs to act on: earliest upcoming "leave by" today.
  App.nextEvent = function () {
    var now = App.now();
    var list = App.timedOn(now).filter(function (e) { return e.start > now; });
    list.sort(function (a, b) { return App.leaveBy(a) - App.leaveBy(b); });
    return list[0] || null;
  };
  App.findEvent = function (id) {
    return occurrenceCache[id] || App.events().filter(function (e) { return e.id === id; })[0];
  };
  App.repeatLabel = function (repeat) {
    return { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' }[repeat] || '';
  };

  // ------------------------------------------------------------ chores + weather helpers
  App.currentRoutine = function () {
    var h = App.now().getHours();
    for (var i = 0; i < D.routines.length; i++) if (h >= D.routines[i].from && h < D.routines[i].to) return D.routines[i];
    return D.routines[2];
  };
  App.weatherNow = function () {
    var W = D.weather, h = App.now().getHours();
    var rainAt = -1;
    for (var i = h; i < 24; i++) if (W.p[i] >= 50) { rainAt = i; break; }
    var summary, advice;
    if (rainAt === h) {
      var stop = h; while (stop < 24 && W.p[stop] >= 50) stop++;
      summary = 'Rain until ' + App.fmt.hour(new Date(2000, 0, 1, stop));
      advice = 'Umbrella weather';
    } else if (rainAt > -1) {
      summary = 'Rain from ' + App.fmt.hour(new Date(2000, 0, 1, rainAt));
      var soccer = App.timedOn(App.now()).filter(function (e) { return /soccer/i.test(e.title) && e.start > App.now(); })[0];
      advice = soccer ? 'Pack a rain jacket for soccer' : 'Grab a rain jacket';
    } else {
      summary = W.t[h] < 12 ? 'Clear and cool' : 'Dry all day';
      advice = W.t[h] < 12 ? 'Jacket weather' : 'Light layers';
    }
    var labels = { sun: 'Sunny', moon: 'Clear', partly: 'Partly cloudy', cloud: 'Overcast', rain: 'Rain' };
    return { temp: W.t[h], cond: W.c[h], label: labels[W.c[h]], hi: W.hi, lo: W.lo, summary: summary, advice: advice, hour: h };
  };
  App.hourly = function (count) {
    var W = D.weather, h = App.now().getHours(), out = [];
    for (var i = 0; i < count; i++) {
      var x = (h + i) % 24;
      out.push({ h: x, t: W.t[x], c: W.c[x], p: W.p[x], label: i === 0 ? 'Now' : ((x % 12 || 12) + (x >= 12 ? 'p' : 'a')) });
    }
    return out;
  };

  // ------------------------------------------------------------ router
  App.register = function (name, view) { App.views[name] = view; };
  // Views are built once and kept laid out (hidden with content-visibility), so switching tabs
  // only has to paint. A view is rebuilt when its data changed ('data'/'time' events) or, for
  // time-sensitive views (minutely: true), when the minute has rolled over since it was built.
  function minuteKey() { return Math.floor(App.now().getTime() / 60000); }
  function build(name, opts) {
    var view = App.views[name];
    view.show($('#view-' + name), opts || {});
    view._built = true; view._dirty = false; view._min = minuteKey();
  }
  App.go = function (name, opts) {
    opts = opts || {};
    if (!App.views[name]) name = 'calendar';
    if (App.current && App.current !== name && App.views[App.current].hide) App.views[App.current].hide();
    App.$$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
    App.$$('.rail-item').forEach(function (b) { b.classList.toggle('is-active', b.dataset.go === name); });
    App.current = name;
    var view = App.views[name];
    if (!view._built || view._dirty || opts.rerender || (view.minutely && view._min !== minuteKey())) build(name, opts);
    else if (view.resume) view.resume($('#view-' + name));
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  };
  // Build a hidden view and lay it out now (cached by content-visibility; no paint happens).
  function prebuild(name) {
    var el = $('#view-' + name), view = App.views[name];
    build(name);
    if (view.hide) view.hide();
    el.classList.add('is-warming');
    el.offsetHeight;
    el.classList.remove('is-warming');
  }
  // Pre-build (startup) and re-build (after data changes) hidden views in the background, one per
  // slot, so navigating to them never pays the rebuild cost.
  var refreshTimer = null;
  function refreshStale(delay) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(function next() {
      var name = Object.keys(App.views).filter(function (k) {
        var v = App.views[k];
        return k !== App.current && (!v._built || v._dirty);
      })[0];
      if (!name) return;
      prebuild(name);
      refreshTimer = setTimeout(next, 400);
    }, delay);
  }
  function markStale() {
    Object.keys(App.views).forEach(function (k) { if (k !== App.current) App.views[k]._dirty = true; });
    refreshStale(1500);
  }
  App.on('data', markStale);
  App.on('time', markStale);
  App.rerender = function () {
    if (App.current) App.views[App.current].show($('#view-' + App.current), { rerender: true });
  };

  // ------------------------------------------------------------ toasts (single, with undo)
  var toastTimer;
  App.toast = function (html, opts) {
    opts = opts || {};
    var box = $('#toasts');
    box.innerHTML = '';
    clearTimeout(toastTimer);
    var ms = opts.ms || 5000;
    var t = document.createElement('div');
    t.className = 'toast' + (opts.tone ? ' toast--' + opts.tone : '');
    t.style.setProperty('--ms', ms + 'ms');
    t.innerHTML = (opts.icon ? App.icon(opts.icon, 26) : '') + '<span class="toast-msg">' + html + '</span>' +
      (opts.undo ? '<button class="toast-undo">' + App.icon('undo', 22) + 'Undo</button>' : '');
    box.appendChild(t);
    t.classList.add('is-in');
    function kill() { t.remove(); }
    toastTimer = setTimeout(kill, ms);
    if (opts.undo) t.querySelector('.toast-undo').addEventListener('click', function () { clearTimeout(toastTimer); opts.undo(); kill(); });
  };

  // ------------------------------------------------------------ sheets (modal cards)
  App.sheet = function (html, opts) {
    opts = opts || {};
    var layer = $('#sheetLayer');
    layer.innerHTML = '<div class="sheet-scrim"></div><div class="sheet ' + (opts.cls || '') + '">' +
      '<button class="sheet-x" data-close aria-label="Close">' + App.icon('x', 28) + '</button>' + html + '</div>';
    layer.classList.add('is-open');
    function close() {
      if (!layer.classList.contains('is-open')) return;
      layer.classList.remove('is-open');
      if (opts.onClose) opts.onClose();
      layer.innerHTML = '';
    }
    App.closeSheet = close;
    layer.querySelector('.sheet-scrim').addEventListener('click', close);
    App.$$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', close); });
    if (opts.onMount) opts.onMount(layer.querySelector('.sheet'), close);
    return close;
  };
  App.closeSheet = function () {};

  // Stage-local coordinates for an element's center (stage may be scaled on desktop)
  App.centerOf = function (el) {
    var stage = $('#stage').getBoundingClientRect(), r = el.getBoundingClientRect(), k = stage.height / 800;
    return { x: (r.left + r.width / 2 - stage.left) / k, y: (r.top + r.height / 2 - stage.top) / k };
  };

  // ------------------------------------------------------------ press-and-hold
  App.hold = function (el, ms, cb) {
    var t = null;
    el.style.setProperty('--hold', ms + 'ms');
    el.addEventListener('pointerdown', function () {
      if (cb.enabled && !cb.enabled()) return;
      el.classList.add('is-holding');
      t = setTimeout(function () { t = null; el.classList.remove('is-holding'); cb.done(); }, ms);
    });
    function cancel(e) {
      if (!t) return;
      clearTimeout(t); t = null;
      el.classList.remove('is-holding');
      if (cb.cancel && e.type === 'pointerup') cb.cancel();
    }
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  };

  // ------------------------------------------------------------ modes: day / ambient / night
  App.setMode = function (m) {
    var stage = $('#stage');
    App.mode = m;
    stage.dataset.mode = m;
    App.emit('mode', m);
  };

  // ------------------------------------------------------------ idle
  // Calendar-only kiosk: interaction never redirects to another view or ambient screen.
  App.resetIdle = function () {};

  // ------------------------------------------------------------ stage scaling
  // Designed at 1280×800. Screens wider than 16:10 (e.g. 1920×1080 frames) widen the stage to their
  // aspect instead of pillarboxing; narrower screens letterbox as before.
  var STAGE_H = 800, STAGE_MIN_W = 1280;
  function fit() {
    var stage = $('#stage');
    var w = Math.max(STAGE_MIN_W, Math.round(STAGE_H * window.innerWidth / window.innerHeight));
    stage.style.setProperty('--stage-w', w + 'px');
    var s = Math.min(window.innerWidth / w, window.innerHeight / STAGE_H);
    stage.style.transform = Math.abs(s - 1) < 0.01 ? '' : 'scale(' + s + ')';
  }

  // ------------------------------------------------------------ clock tick
  App.updateClock = function (clock, now) {
    if (!clock) return;
    var time = clock.querySelector('b');
    var period = clock.querySelector('span');
    if (!time || !period) return;
    time.textContent = App.fmt.time(now, false);
    period.textContent = App.fmt.ampm(now);
  };

  var lastMin = -1, lastDateKey = null;
  function tick() {
    // Android may correct itself several seconds after our HTTP clock has already made the
    // calendar usable. Switch once, without applying the old offset to the newly-correct time.
    if (trustedEpoch != null && validEpoch(Date.now())) {
      trustedEpoch = null;
      offset = 0;
      lastMin = -1;
      App.emit('time');
      App.rerender();
    }
    var n = App.now();
    var dateKey = n.getFullYear() + '-' + n.getMonth() + '-' + n.getDate();
    if (lastDateKey !== null && dateKey !== lastDateKey) App.emit('datechange', n);
    lastDateKey = dateKey;
    App.emit('second', n);
    if (n.getMinutes() !== lastMin) {
      lastMin = n.getMinutes();
      if (validEpoch(n.getTime())) rememberClock(n.getTime());
      App.updateClock($('#calendarClock'), n);
      App.emit('minute', n);
    }
  }

  // ------------------------------------------------------------ boot
  App.start = function () {
    // Keep the cached/network anchor selected when Android is still reporting 1969.
    if (validEpoch(Date.now())) App.setTime(null);
    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('pointerdown', App.resetIdle, true);
    window.addEventListener('hashchange', function () { App.go(location.hash.slice(1)); });
    App.go(location.hash.slice(1) || 'calendar');
    tick();
    setInterval(tick, 1000);
    App.emit('ready');
    App.refreshClock();
    setInterval(App.refreshClock, 15000);
    refreshStale(1500);
  };
  // main.js calls start only after private device configuration and all feature modules load.
})();
