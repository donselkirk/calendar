// Calendar: month-only wall display.
(function () {
  'use strict';
  var D = window.DATA;
  var PX = 72, START = 6, END = 23; // 72px per hour, 6 AM → 11 PM
  var V = { mode: 'month', page: 'calendar', date: null, el: null, scroll: null, moving: false };

  function y(d) { return ((d.getHours() + d.getMinutes() / 60) - START) * PX; }
  function clampTop(e, day) {
    var s = App.dayStart(day);
    var a = e.start < s ? new Date(+s + START * 36e5) : e.start;
    var endOfDay = new Date(+s + END * 36e5);
    var b = e.end > endOfDay ? endOfDay : e.end;
    return { top: Math.max(0, y(a)), h: Math.max(24, y(b) - Math.max(0, y(a)) - 3) };
  }

  // Overlap layout → [{e, col, cols}] (cols capped at 2, extra returned as overflow groups)
  function layout(evs) {
    var out = [], clusters = [], cur = null, curEnd = 0;
    evs.forEach(function (e) {
      if (!cur || +e.start >= curEnd) { cur = []; clusters.push(cur); curEnd = 0; }
      cur.push(e); curEnd = Math.max(curEnd, +e.end);
    });
    clusters.forEach(function (c) {
      var cols = [], placed = [];
      c.forEach(function (e) {
        var i = cols.findIndex(function (end) { return end <= +e.start; });
        if (i < 0) { i = cols.length; cols.push(0); }
        cols[i] = +e.end;
        placed.push({ e: e, col: i });
      });
      var n = cols.length;
      if (n <= 2) placed.forEach(function (p) { out.push({ e: p.e, col: p.col, cols: n }); });
      else {
        var extra = placed.filter(function (p) { return p.col > 0; }).map(function (p) { return p.e; });
        placed.filter(function (p) { return p.col === 0; }).forEach(function (p) { out.push({ e: p.e, col: 0, cols: 2 }); });
        out.push({ more: extra, col: 1, cols: 2, start: new Date(Math.min.apply(null, extra.map(function (e) { return +e.start; }))), end: new Date(Math.max.apply(null, extra.map(function (e) { return +e.end; }))) });
      }
    });
    return out;
  }

  function evBlock(e, style, opts) {
    opts = opts || {};
    var now = App.now();
    var p = opts.color || App.evColor(e);
    var mins = (e.end - e.start) / 60000;
    var cls = 'ev' + (e.end <= now ? ' is-past' : '') + (e.start <= now && e.end > now ? ' is-now' : '') + (mins < 45 ? ' is-short' : '') + (App.isFamily(e) ? ' is-family' : '') + (opts.half ? ' is-half' : '');
    var others = opts.lane ? e.people.filter(function (id) { return id !== opts.lane; }) : (e.people.length > 1 && !App.isFamily(e) ? e.people : []);
    var travel = e.travel ? '<span class="ev-travel" style="height:' + (e.travel * PX / 60) + 'px"></span>' : '';
    return '<button class="' + cls + '" data-ev="' + e.id + '" style="' + App.pstyle(p) + ';' + style + '">' + travel +
      '<span class="ev-title">' + App.esc(e.title) + '</span>' +
      '<span class="ev-meta">' + App.fmt.range(e.start, e.end) + (e.travel ? ' · <b>' + App.icon('car', 16) + 'Leave ' + App.fmt.time(App.leaveBy(e), false) + '</b>' : '') + '</span>' +
      (others.length && !App.isFamily(e) ? '<span class="ev-with">' + App.dots(others, 14) + '</span>' : '') +
      (App.isFamily(e) ? '<span class="ev-with">' + App.dots(D.ALL, 14) + '</span>' : '') +
      '</button>';
  }

  function placeBlocks(list, colorFn, laneId) {
    return layout(list).map(function (it) {
      var w = 100 / it.cols, left = it.col * w;
      if (it.more) {
        var t = y(it.start), h = Math.max(30, y(it.end) - t - 3);
        return '<button class="ev ev--more" data-more="' + it.more.map(function (e) { return e.id; }).join(',') + '" style="top:' + t + 'px;height:' + h + 'px;left:calc(' + left + '% + 2px);width:calc(' + w + '% - 4px)">+' + it.more.length + '<small>more</small></button>';
      }
      var b = clampTop(it.e, V.date);
      return evBlock(it.e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:calc(' + left + '% + 2px);width:calc(' + w + '% - 4px)', { lane: laneId, color: colorFn ? colorFn(it.e) : null, half: it.cols > 1 });
    }).join('');
  }

  function hoursCol() {
    var h = '';
    for (var i = START; i <= END; i++) {
      h += '<div class="hr" style="top:' + (i - START) * PX + 'px"><span>' + (i === 12 ? 'Noon' : (i % 12 || 12) + (i < 12 ? ' AM' : ' PM')) + '</span></div>';
    }
    return h;
  }
  function nowLine(days) {
    var now = App.now(), idx = -1;
    days.forEach(function (d, i) { if (App.sameDay(d, now)) idx = i; });
    if (idx < 0 || now.getHours() < START || now.getHours() >= END) return '';
    return '<div class="now-line" style="top:' + y(now) + 'px"><span class="num">' + App.fmt.time(now, false) + '</span></div>';
  }

  // ------------------------------------------------------------ Today (lanes per person)
  function _dayView() {
    var day = V.date;
    var fam = App.timedOn(day).filter(App.isFamily);
    var allDay = App.allDayOn(day);
    var ad = allDay.length ? '<div class="allday"><div class="gutter label">All day</div><div class="allday-grid" style="grid-template-columns:repeat(' + D.people.length + ',1fr)">' + allDay.map(function (e) {
      var fam2 = App.isFamily(e);
      var idx = D.people.map(function (p) { return p.id; }).indexOf(e.people[0]);
      var col = fam2 ? '1 / -1' : (idx + 1) + ' / span 1';
      var s = App.dayStart(day), spanDays = Math.round((e.end - e.start) / 864e5), dayN = Math.round((s - e.start) / 864e5) + 1;
      return '<button class="ad' + (e.start < s ? ' ad--cont' : '') + '" data-ev="' + e.id + '" style="grid-column:' + col + ';' + App.pstyle(App.evColor(e)) + '">' +
        (e.start < s ? App.icon('left', 16) : '') + App.esc(e.title) + (spanDays > 1 ? ' <small>Day ' + dayN + ' of ' + spanDays + '</small>' : '') + '</button>';
    }).join('') + '</div></div>' : '';
    var grid = '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px">' +
      '<div class="hours">' + hoursCol() + '</div>' +
      '<div class="lanes" style="grid-template-columns:repeat(' + D.people.length + ',1fr)">' + D.people.map(function (p) {
        var list = App.timedOn(day, p.id).filter(function (e) { return !App.isFamily(e); });
        return '<div class="lane" style="' + App.pstyle(p) + '">' + placeBlocks(list, null, p.id) + '</div>';
      }).join('') +
      '<div class="lane-fam">' + fam.map(function (e) {
        var b = clampTop(e, day);
        return evBlock(e, 'top:' + b.top + 'px;height:' + b.h + 'px;left:2px;right:2px');
      }).join('') + '</div>' +
      nowLine([day]) + '</div>' +
      '</div></div>';
    var empty = !App.timedOn(day).length ? '<div class="cal-empty serif">Nothing on the calendar.<br><i>A rare, quiet day.</i></div>' : '';
    return '<div class="cal-day">' + ad + grid + empty + '</div>';
  }

  // ------------------------------------------------------------ 3 day
  function _threeDay() {
    var days = [0, 1, 2].map(function (i) { return App.addDays(V.date, i); });
    var now = App.now();
    var anyAllDay = days.some(function (d) { return App.allDayOn(d).length; });
    var head = '<div class="lanes-head"><div class="gutter"></div>' + days.map(function (d) {
      var today = App.sameDay(d, now);
      return '<div class="day-head' + (today ? ' is-today' : '') + '"><span class="num">' + d.getDate() + '</span><b>' + App.fmt.rel(d) + '</b><small>' + App.fmt.monthShort(d) + '</small></div>';
    }).join('') + '</div>';
    var ad = '';
    if (anyAllDay) {
      var s0 = App.dayStart(days[0]), s3 = App.addDays(s0, 3);
      var list = App.events().filter(function (e) { return e.allDay && e.start < s3 && e.end > s0; });
      ad = '<div class="allday"><div class="gutter label">All day</div><div class="allday-grid allday-grid--3">' + list.map(function (e) {
        var a = Math.max(0, Math.round((e.start - s0) / 864e5)), b = Math.min(3, Math.round((e.end - s0) / 864e5));
        return '<button class="ad' + (e.start < s0 ? ' ad--cont' : '') + '" data-ev="' + e.id + '" style="grid-column:' + (a + 1) + ' / ' + (b + 1) + ';' + App.pstyle(App.evColor(e)) + '">' +
          (e.start < s0 ? App.icon('left', 16) : '') + App.esc(e.title) + (e.end > s3 ? App.icon('right', 16) : '') + '</button>';
      }).join('') + '</div></div>';
    }
    var grid = '<div class="grid-scroll"><div class="grid" style="height:' + (END - START) * PX + 'px">' +
      '<div class="hours">' + hoursCol() + '</div>' +
      '<div class="lanes lanes--3">' + days.map(function (d) {
        var save = V.date; V.date = d;
        var html = '<div class="lane' + (App.sameDay(d, now) ? ' is-today' : '') + '">' + placeBlocks(App.timedOn(d)) + '</div>';
        V.date = save;
        return html;
      }).join('') + '</div>' +
      nowLine(days).replace('now-line', 'now-line now-line--' + days.findIndex(function (d) { return App.sameDay(d, now); })) +
      '</div></div>';
    return '<div class="cal-day cal-3">' + head + ad + grid + '</div>';
  }

  // ------------------------------------------------------------ rolling week
  function _weekView() {
    var now = App.now();
    return '<div class="week">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var d = App.addDays(V.date, i), today = App.sameDay(d, now);
      var ad = App.allDayOn(d), list = App.timedOn(d), max = 7 - ad.length, more = list.length - max;
      return '<div class="wk-col' + (today ? ' is-today' : '') + '" data-day="' + (+d) + '">' +
        '<div class="wk-head"><b>' + App.fmt.dayShort(d) + '</b><span class="num">' + d.getDate() + '</span></div>' +
        ad.map(function (e) { return '<button class="wk-ad" data-ev="' + e.id + '" style="' + App.pstyle(App.evColor(e)) + '">' + App.esc(e.title) + '</button>'; }).join('') +
        list.slice(0, max).map(function (e) {
          return '<button class="wk-ev' + (e.end <= now ? ' is-past' : '') + '" data-ev="' + e.id + '" style="' + App.pstyle(App.evColor(e)) + '">' +
            '<span class="wk-t">' + App.fmt.time(e.start, false) + '</span><span class="wk-n">' + App.esc(e.title) + '</span></button>';
        }).join('') +
        (more > 0 ? '<button class="wk-more" data-day="' + (+d) + '">+' + more + ' more</button>' : '') +
        (!list.length && !ad.length ? '<div class="wk-free serif"><i>Free</i></div>' : '') +
        '</div>';
    }).join('') + '</div>';
  }

  // ------------------------------------------------------------ month
  function monthView() {
    var now = App.now();
    var first = new Date(V.date.getFullYear(), V.date.getMonth(), 1);
    var start = App.addDays(first, -((first.getDay() + 6) % 7)); // Monday start
    var cells = '';
    for (var i = 0; i < 42; i++) {
      var d = App.addDays(start, i);
      var evs = App.allDayOn(d).concat(App.timedOn(d));
      var waste = App.wasteOn(d);
      var holidays = App.holidaysOn(d);
      var items = evs.slice(0, 3).map(function (e) {
        return '<button class="mo-event" data-ev="' + e.id + '" style="' + App.pstyle(App.evColor(e)) + '"><i></i><span>' +
          (e.allDay ? '' : '<b>' + App.fmt.time(e.start, false) + '</b> ') + App.esc(e.title) + '</span></button>';
      }).join('');
      cells += '<div class="mo-cell' + (d.getMonth() !== first.getMonth() ? ' is-out' : '') + (App.sameDay(d, now) ? ' is-today' : '') + '" data-day="' + (+d) + '">' +
        '<span class="num">' + d.getDate() + '</span>' +
        (waste.length ? '<div class="waste-markers">' + waste.map(App.wasteIcon).join('') + '</div>' : '') +
        (holidays.length ? '<div class="mo-holiday" title="Ontario public holiday">' + App.holidayIcon() + '<span>' + App.esc(holidays[0].name) + '</span></div>' : '') +
        '<div class="mo-events">' + items +
        (evs.length > 3 ? '<button class="mo-more" data-day="' + (+d) + '">+' + (evs.length - 3) + ' more</button>' : '') + '</div></div>';
    }
    return '<div class="month"><div class="mo-dow">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<span class="label">' + d + '</span>'; }).join('') + '</div>' +
      '<div class="mo-grid">' + cells + '</div></div>';
  }

  // ------------------------------------------------------------ header
  function title() {
    return { k: V.date.getFullYear(), t: App.fmt.month(V.date) };
  }
  function header() {
    var t = title();
    var isToday = V.date.getMonth() === App.now().getMonth() && V.date.getFullYear() === App.now().getFullYear();
    return '<header class="cal-head">' +
      '<div class="cal-head-left">' + App.weatherMarkup() + '</div>' +
      '<div class="cal-nav"><button class="icon-btn" data-nav="-1" aria-label="Previous month">' + App.icon('left', 26) + '</button>' +
      '<div class="cal-title serif">' + t.t + '</div>' +
      '<button class="icon-btn" data-nav="1" aria-label="Next month">' + App.icon('right', 26) + '</button>' +
      '<button class="btn btn--ghost cal-today' + (isToday ? ' is-hidden' : '') + '" data-today>Today</button></div>' +
      '<div class="cal-head-right">' + App.updateMarkup() + '<div class="cal-clock num" id="calendarClock"></div></div>' +
      (D.configMissing ? '<div class="config-warning" role="status">Device setup required</div>' : '') +
      '</header>';
  }

  function dateFromIso(value) {
    var parts = String(value || '').split('-');
    return parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2], 12) : new Date(value);
  }

  function weatherStat(icon, label, value) {
    return '<div class="forecast-stat">' + App.icon(icon, 24) + '<span>' + label + '</span><b class="num">' + value + '</b></div>';
  }

  function weatherVideo(scene) {
    var file = { clear: 'clear', partly: 'clear', cloud: 'cloudy', fog: 'fog', rain: 'rain', snow: 'snow', storm: 'storm' }[scene] || 'cloudy';
    return '<video class="weather-video" autoplay muted loop playsinline aria-hidden="true"><source src="/weather/' + file + '.mp4" type="video/mp4"></video><div class="weather-video-shade" aria-hidden="true"></div>';
  }

  function forecastPage() {
    var weather = App.weatherForecast();
    var data = weather.data;
    var now = App.now();
    var head = '<header class="forecast-head"><button class="btn btn--ghost" data-calendar>' + App.icon('left', 22) + 'Calendar</button>' +
      '<h1 class="serif">Ottawa Weather</h1>' +
      '<button class="btn btn--ghost" data-weather-refresh>' + App.icon('sun', 22) + 'Refresh</button></header>';
    if (!data || !data.current || !data.daily) {
      return '<div class="forecast-page">' + head + '<div class="forecast-empty">' + App.icon('cloud', 72) +
        '<h2 class="serif">Weather is loading</h2><p>The latest saved Ottawa forecast will appear here.</p></div></div>';
    }
    var current = data.current;
    var daily = data.daily;
    var isDay = Number(current.is_day) === 1;
    var todayCondition = weather.condition(current.weather_code, isDay);
    var todayHigh = Math.round(Number(daily.temperature_2m_max[0]));
    var todayLow = Math.round(Number(daily.temperature_2m_min[0]));
    var rain = Math.round(Number(daily.precipitation_probability_max[0]) || 0);
    var humidity = Math.round(Number(current.relative_humidity_2m) || 0);
    var wind = Math.round(Number(current.wind_speed_10m) || 0);
    var today = '<section class="forecast-today weather-' + todayCondition.scene + ' ' + (isDay ? 'is-day' : 'is-night') + '">' + weatherVideo(todayCondition.scene) +
      '<div class="forecast-today-copy"><div class="label label--light">Today · ' + App.fmt.day(now) + ', ' + App.fmt.month(now) + ' ' + now.getDate() + '</div>' +
      '<div class="forecast-now num">' + Math.round(Number(current.temperature_2m)) + '°</div>' +
      '<h2 class="serif">' + App.esc(todayCondition.label) + '</h2><p>Feels like <b class="num">' + Math.round(Number(current.apparent_temperature)) + '°</b></p>' +
      '<div class="forecast-stats">' + weatherStat('sun', 'High', todayHigh + '°') + weatherStat('moon', 'Low', todayLow + '°') +
      weatherStat('rain', 'Rain', rain + '%') + weatherStat('drop', 'Humidity', humidity + '%') + weatherStat('wind', 'Wind', wind + ' km/h') + '</div></div></section>';
    var days = [];
    for (var i = 1; i < 8; i++) {
      if (!daily.time || !daily.time[i]) continue;
      var date = dateFromIso(daily.time[i]);
      var c = weather.condition(daily.weather_code[i], true);
      var chance = Math.round(Number(daily.precipitation_probability_max[i]) || 0);
      days.push('<article class="forecast-day"><div class="forecast-day-date"><b>' + App.fmt.dayShort(date) + '</b><span class="num">' + date.getDate() + '</span></div>' +
        App.icon(c.icon, 58) + '<strong>' + App.esc(c.label) + '</strong><div class="forecast-day-temp num"><b>' + Math.round(Number(daily.temperature_2m_max[i])) + '°</b><span>' + Math.round(Number(daily.temperature_2m_min[i])) + '°</span></div>' +
        '<div class="forecast-rain">' + App.icon('rain', 18) + '<span class="num">' + chance + '%</span></div></article>');
    }
    return '<div class="forecast-page">' + head + today + '<div class="forecast-next"><div class="label">Next seven days</div><div class="forecast-days">' + days.join('') + '</div></div></div>';
  }

  function render() {
    if (!App.clockReady()) {
      V.el.innerHTML = '<div class="clock-wait">' + App.icon('clock', 64) + '<h1 class="serif">Setting today’s date</h1><p>Home HQ will open the calendar as soon as the frame is online.</p></div>';
      return;
    }
    if (V.page === 'forecast') {
      V.el.innerHTML = forecastPage();
      return;
    }
    V.el.innerHTML = '<div class="cal cal--month">' + header() + '<div class="cal-body">' + monthView() + '</div></div>';
    var clock = V.el.querySelector('#calendarClock'), nowForClock = App.now();
    if (clock) clock.innerHTML = '<div><b>' + App.fmt.time(nowForClock, false) + '</b><span>' + App.fmt.ampm(nowForClock) + '</span></div>' +
      '<small>' + App.fmt.dayShort(nowForClock) + ' · ' + App.fmt.monthShort(nowForClock) + ' ' + nowForClock.getDate() + ' · ' + nowForClock.getFullYear() + '</small>';
    var sc = V.el.querySelector('.grid-scroll');
    if (sc) {
      var now = App.now();
      sc.scrollTop = V.scroll != null ? V.scroll : Math.max(0, y(now) - 170);
      sc.addEventListener('scroll', function () { V.scroll = sc.scrollTop; });
    }
  }

  function nav(dir) {
    if (V.moving) return;
    var body = V.el.querySelector('.cal-body');
    if (!body) return;
    V.moving = true;
    body.classList.add(dir > 0 ? 'month-leave-left' : 'month-leave-right');
    window.setTimeout(function () {
      V.date = new Date(V.date.getFullYear(), V.date.getMonth() + dir, 1);
      V.scroll = null;
      render();
      var next = V.el.querySelector('.cal-body');
      if (next) {
        next.classList.add(dir > 0 ? 'month-enter-right' : 'month-enter-left');
        window.setTimeout(function () { next.classList.remove('month-enter-right', 'month-enter-left'); V.moving = false; }, 260);
      } else V.moving = false;
    }, 150);
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest('[data-ev]'))) return App.eventSheet(App.findEvent(t.dataset.ev));
    if ((t = e.target.closest('[data-more]'))) return moreSheet(t.dataset.more.split(','));
    if ((t = e.target.closest('[data-nav]'))) return nav(+t.dataset.nav);
    if ((t = e.target.closest('[data-forecast]'))) { V.page = 'forecast'; return render(); }
    if ((t = e.target.closest('[data-calendar]'))) { V.page = 'calendar'; return render(); }
    if ((t = e.target.closest('[data-weather-refresh]'))) return App.refreshWeather(true);
    if ((t = e.target.closest('[data-update]'))) return App.openUpdate();
    if ((t = e.target.closest('[data-today]'))) { V.date = new Date(App.now().getFullYear(), App.now().getMonth(), 1); V.scroll = null; return render(); }
    if ((t = e.target.closest('[data-day]'))) return daySheet(new Date(+t.dataset.day));
  }

  // Swipe anywhere on the month grid to change months. Mouse pointers are supported for preview.
  function swipe(el) {
    var sx, sy, st;
    el.addEventListener('pointerdown', function (e) {
      if (V.page !== 'calendar' || e.target.closest('button')) return;
      sx = e.clientX; sy = e.clientY; st = Date.now();
    });
    el.addEventListener('pointermove', function (e) {
      if (sx == null || V.moving) return;
      var body = V.el.querySelector('.cal-body');
      if (body && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) body.style.transform = 'translateX(' + Math.max(-90, Math.min(90, (e.clientX - sx) * .28)) + 'px)';
    });
    el.addEventListener('pointerup', function (e) {
      if (V.page !== 'calendar') { sx = null; return; }
      if (sx == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      var body = V.el.querySelector('.cal-body');
      if (body) body.style.transform = '';
      if (Math.abs(dx) > 70 && Math.abs(dy) < 75 && Date.now() - st < 900 && !e.target.closest('.cal-head')) nav(dx < 0 ? 1 : -1);
    });
    el.addEventListener('pointercancel', function () { sx = null; var body = V.el.querySelector('.cal-body'); if (body) body.style.transform = ''; });
  }

  // ------------------------------------------------------------ sheets
  function daySheet(day) {
    var list = App.allDayOn(day).concat(App.timedOn(day));
    var waste = App.wasteOn(day);
    var holidays = App.holidaysOn(day);
    var heading = list.length ? list.length + ' event' + (list.length === 1 ? '' : 's') : (holidays.length ? 'Ontario public holiday' : (waste.length ? 'Collection day' : 'Nothing scheduled'));
    App.sheet('<div class="sheet-pad"><div class="label">' + App.fmt.day(day) + ' · ' + App.fmt.month(day) + ' ' + day.getDate() + '</div>' +
      '<h2 class="serif sheet-h">' + heading + '</h2>' +
      (holidays.length ? '<div class="holiday-list">' + holidays.map(function (holiday) {
        return '<div class="holiday-row">' + App.holidayIcon() + '<b>' + App.esc(holiday.name) + '</b><span>Ontario public holiday</span></div>';
      }).join('') + '</div>' : '') +
      (waste.length ? '<div class="waste-list"><div class="label">Ottawa collection</div>' + waste.map(function (item) {
        return '<div class="waste-row">' + App.wasteIcon(item) + '<b>' + App.esc(item.label) + '</b><span>Official city schedule</span></div>';
      }).join('') + '</div>' : '') +
      (list.length ? '<div class="more-list">' + list.map(function (e) {
        return '<button class="more-row" data-ev="' + e.id + '" style="' + App.pstyle(App.evColor(e)) + '"><i></i><b>' + App.esc(e.title) + '</b><span>' +
          (e.allDay ? 'All day' : App.fmt.range(e.start, e.end)) + '</span></button>';
      }).join('') + '</div>' : '<p class="sheet-p">Tap below to add something to this date.</p>') +
      '<div class="sheet-actions"><button class="btn btn--solid" data-add-day>Add event</button></div></div>', {
      onMount: function (s, close) {
        s.addEventListener('click', function (ev) {
          var eventButton = ev.target.closest('[data-ev]');
          if (eventButton) return App.eventSheet(App.findEvent(eventButton.dataset.ev));
          if (ev.target.closest('[data-add-day]')) { close(); addSheet(day); }
        });
      }
    });
  }

  App.eventSheet = function (e) {
    if (!e) return;
    var p = App.evColor(e), fam = App.isFamily(e);
    App.sheet(
      '<div class="evs" style="' + App.pstyle(p) + '">' +
      '<div class="evs-band"><div class="label label--on">' + App.fmt.rel(e.start) + ' · ' + App.fmt.month(e.start) + ' ' + e.start.getDate() + '</div>' +
      '<h2 class="serif">' + App.esc(e.title) + '</h2>' +
      '<div class="evs-time num">' + (e.allDay ? 'All day' : App.fmt.range(e.start, e.end)) + '</div></div>' +
      '<div class="evs-body">' +
      (e.repeat ? '<div class="evs-row">' + App.icon('undo', 28) + '<div><b>' + App.repeatLabel(e.repeat) + '</b><span>Repeating event</span></div></div>' : '') +
      (e.travel ? '<div class="evs-row evs-leave">' + App.icon('car', 28) + '<div><b>Leave by ' + App.fmt.time(App.leaveBy(e)) + '</b><span>' + e.travel + ' min drive in current traffic</span></div></div>' : '') +
      (e.loc ? '<div class="evs-row">' + App.icon('pin', 28) + '<div><b>' + App.esc(e.loc) + '</b><span>Tap to send directions to phone</span></div></div>' : '') +
      '<div class="evs-row">' + App.icon('person', 28) + '<div class="evs-people">' + (fam ? D.people : e.people.map(App.person)).map(function (x) {
        return '<span class="chip" style="' + App.pstyle(x) + '">' + App.avatar(x, 32) + x.name + '</span>';
      }).join('') + '</div></div>' +
      (e.notes ? '<div class="evs-notes serif">“' + App.esc(e.notes) + '”</div>' : '') +
      '<div class="sheet-actions"><button class="btn btn--danger" data-delete>Delete ' + (e.seriesId ? 'series' : 'event') + '</button></div>' +
      '</div></div>', { cls: 'sheet--event' });
    var sheet = document.querySelector('.sheet--event');
    sheet.querySelector('[data-delete]').addEventListener('click', function () {
      var stored = e.seriesId ? D.events.filter(function (item) { return item.id === e.seriesId; })[0] : e;
      var index = D.events.indexOf(stored);
      if (index < 0) return;
      D.events.splice(index, 1);
      App.saveEvents();
      App.closeSheet();
      render();
      App.emit('data');
      App.toast('Deleted <b>' + App.esc(e.title) + '</b>', {
        icon: 'calendar', undo: function () {
          D.events.splice(index, 0, stored);
          App.saveEvents();
          render();
          App.emit('data');
        }
      });
    });
  };

  function moreSheet(ids) {
    var list = ids.map(App.findEvent).filter(Boolean);
    App.sheet('<div class="sheet-pad"><div class="label">Overlapping</div><h2 class="serif sheet-h">' + list.length + ' more events</h2>' +
      '<div class="more-list">' + list.map(function (e) {
        return '<button class="more-row" data-ev="' + e.id + '" style="' + App.pstyle(App.evColor(e)) + '"><i></i><b>' + App.esc(e.title) + '</b><span>' + App.fmt.range(e.start, e.end) + '</span></button>';
      }).join('') + '</div></div>', {
      onMount: function (s) { s.addEventListener('click', function (ev) { var t = ev.target.closest('[data-ev]'); if (t) App.eventSheet(App.findEvent(t.dataset.ev)); }); }
    });
  }

  function addSheet(initialDay) {
    var now = App.dayStart(initialDay || App.now());
    var st = { who: D.ALL.slice(), time12: 11 * 60, period: 'AM', dur: 60, title: '', allDay: true, repeat: '' };
    var ideas = ['Birthday', 'PD Day', 'Vacation', 'Doctor', 'Dentist', 'Eye'];
    function timeLabel() {
      var hour = Math.floor(st.time12 / 60), minute = st.time12 % 60;
      return hour + (minute ? ':30' : '');
    }
    function timeValue() {
      var hour = Math.floor(st.time12 / 60), minute = st.time12 % 60;
      var hour24 = hour % 12 + (st.period === 'PM' ? 12 : 0);
      return (hour24 < 10 ? '0' : '') + hour24 + ':' + (minute ? '30' : '00');
    }
    App.sheet(
      '<div class="sheet-pad add">' +
      '<div class="label">New event</div>' +
      '<input class="big-input serif" type="text" enterkeyhint="done" autocomplete="off" placeholder="What’s happening?" data-f="title">' +
      '<div class="chips">' + ideas.map(function (i) { return '<button class="chip chip--ghost" data-idea="' + i + '">' + i + '</button>'; }).join('') + '</div>' +
      '<div class="label">Calendar</div><div class="add-who"><button class="who-btn is-on" data-who="all" style="' + App.pstyle(D.family) + '">' + App.avatar(D.family, 56) + '<span>Family</span></button>' + D.people.map(function (p) {
        return '<button class="who-btn" data-who="' + p.id + '" style="' + App.pstyle(p) + '">' + App.avatar(p, 56) + '<span>' + p.name + '</span></button>';
      }).join('') + '</div>' +
      '<div class="label">Event type</div><div class="chips"><button class="chip is-on" data-kind="all-day">All day</button><button class="chip" data-kind="timed">Set a time</button></div>' +
      '<div class="add-row" data-timed-fields hidden><div><div class="label">Time</div><div class="time-picker">' +
      '<div class="time-stepper chip chip--ghost"><button class="time-stepper-adjust" type="button" data-time-step="1" aria-label="Move time forward 30 minutes">' + App.icon('up', 24) + '</button>' +
      '<span class="time-stepper-value num" data-time-label>' + timeLabel() + '</span>' +
      '<button class="time-stepper-adjust" type="button" data-time-step="-1" aria-label="Move time back 30 minutes">' + App.icon('down', 24) + '</button></div>' +
      '<div class="time-period"><button class="chip is-on" data-period="AM">AM</button><button class="chip" data-period="PM">PM</button></div></div></div>' +
      '<div><div class="label">Length</div><div class="chips">' + [[30, '30m'], [60, '1h'], [120, '2h']].map(function (t) {
        return '<button class="chip' + (t[0] === st.dur ? ' is-on' : '') + '" data-dur="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div></div></div>' +
      '<div class="label">Repeat</div><div class="chips"><button class="chip is-on" data-repeat="">Does not repeat</button>' +
      '<button class="chip" data-repeat="weekly">Weekly</button><button class="chip" data-repeat="monthly">Monthly</button><button class="chip" data-repeat="yearly">Yearly</button></div>' +
      '<div class="sheet-actions"><button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--solid" data-save>Add to calendar</button></div>' +
      '</div>', {
      cls: 'sheet--wide',
      onMount: function (s, close) {
        var input = s.querySelector('[data-f=title]');
        var timeText = s.querySelector('[data-time-label]');
        input.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          ev.preventDefault();
          input.blur();
        });
        s.addEventListener('click', function (ev) {
          var t = ev.target.closest('button');
          if (!t) return;
          if (t.dataset.idea) { input.value = t.dataset.idea; }
          if (t.dataset.who) {
            st.who = t.dataset.who === 'all' ? D.ALL.slice() : [t.dataset.who];
            App.$$('[data-who]', s).forEach(function (b) {
              b.classList.toggle('is-on', b.dataset.who === 'all' ? st.who.length === D.ALL.length : st.who.length === 1 && st.who[0] === b.dataset.who);
            });
          }
          if (t.dataset.kind) {
            st.allDay = t.dataset.kind === 'all-day';
            App.$$('[data-kind]', s).forEach(function (b) { b.classList.toggle('is-on', b === t); });
            s.querySelector('[data-timed-fields]').hidden = st.allDay;
          }
          if (t.hasAttribute('data-repeat')) {
            st.repeat = t.dataset.repeat;
            App.$$('[data-repeat]', s).forEach(function (b) { b.classList.toggle('is-on', b === t); });
          }
          if (t.hasAttribute('data-time-step')) {
            st.time12 += +t.dataset.timeStep * 30;
            if (st.time12 > 12 * 60 + 30) st.time12 = 60;
            if (st.time12 < 60) st.time12 = 12 * 60 + 30;
            timeText.textContent = timeLabel();
          }
          if (t.dataset.period) {
            st.period = t.dataset.period;
            App.$$('[data-period]', s).forEach(function (b) { b.classList.toggle('is-on', b === t); });
          }
          ['dur'].forEach(function (k) {
            if (t.dataset[k] != null) {
              App.$$('[data-' + k + ']', s).forEach(function (b) { b.classList.toggle('is-on', b === t); });
              st.dur = +t.dataset.dur;
            }
          });
          if (t.hasAttribute('data-save')) {
            var title = input.value.trim() || 'New event';
            var who = st.who.slice();
            var start = App.dayStart(now), p = timeValue().split(':');
            if (!st.allDay) start.setHours(+p[0], +p[1]);
            var end = st.allDay ? App.addDays(start, 1) : new Date(+start + st.dur * 60000);
            var e = { id: D._eid(), title: title, people: who, start: start, end: end, allDay: st.allDay, repeat: st.repeat };
            D.events.push(e);
            var saved = App.saveEvents();
            close();
            V.date = new Date(start.getFullYear(), start.getMonth(), 1); V.scroll = null;
            render();
            App.emit('data');
            if (!saved) App.toast('The event could not be saved to this device.', { tone: 'alert', ms: 8000 });
            else
            App.toast('Added <b>' + App.esc(title) + '</b> · ' + App.fmt.rel(start) + (st.allDay ? ' · All day' : ' ' + App.fmt.time(start)) + (st.repeat ? ' · ' + App.repeatLabel(st.repeat) : ''), {
              icon: 'calendar', undo: function () {
                D.events.splice(D.events.indexOf(e), 1);
                App.saveEvents();
                render();
                App.emit('data');
              }
            });
          }
        });
      }
    });
  }

  App.register('calendar', {
    show: function (el, opts) {
      if (!V.el) {
        V.el = el;
        el.addEventListener('click', onClick);
        swipe(el);
      }
      if (!V.date) V.date = App.dayStart(App.now());
      if (!opts.rerender) V.scroll = null;
      render();
    }
  });
  App.on('minute', function () {
    if (App.current !== 'calendar' || V.page !== 'calendar') return;
    var line = V.el.querySelector('.now-line');
    var now = App.now();
    if (line) { line.style.top = y(now) + 'px'; line.querySelector('span').textContent = App.fmt.time(now, false); }
  });
  App.on('time', function () { V.date = App.dayStart(App.now()); V.scroll = null; });
  App.on('datechange', function (now) {
    V.date = App.dayStart(now);
    V.scroll = null;
    if (V.el) render();
  });
  App.on('weather', function () { if (V.el) render(); });
  App.on('waste', function () { if (V.el) render(); });
  App.on('update', function () { if (V.el) render(); });
})();
