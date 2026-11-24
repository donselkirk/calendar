import { holidaysForYear } from './holiday-dates.js';
(function () {
  'use strict';

  var cache = {};
  App.holidaysOn = function (day) {
    var year = day.getFullYear();
    var key = year + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    if (!cache[year]) {
      cache[year] = holidaysForYear(year);
      if (window.HOMEHQ_SERVICE) fetch('/api/v1/holidays?year=' + year)
        .then(function (response) { if (response.ok) return response.json(); })
        .then(function (list) {
          if (Array.isArray(list)) { cache[year] = list; App.emit('data'); }
        }).catch(function () {});
    }
    return cache[year].filter(function (holiday) { return holiday.date === key; });
  };

  App.holidayIcon = function () {
    return '<span class="holiday-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2l1.7 4.1 3.8-2-1 4.3 4.2 1.2-3.4 2.8 2.3 2.2-5.2.8.4 5.7h-2.6l.4-5.7-5.2-.8 2.3-2.2-3.4-2.8 4.2-1.2-1-4.3 3.8 2z"/>' +
      '</svg></span>';
  };
})();
