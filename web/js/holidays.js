// Ontario's nine public holidays under the Employment Standards Act. Dates are calculated locally
// for every year, so the wall calendar keeps extending without a feed or an internet connection.
(function () {
  'use strict';

  function addDays(date, count) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() + count);
    return copy;
  }

  function nthWeekday(year, month, weekday, ordinal) {
    var first = new Date(year, month, 1);
    return new Date(year, month, 1 + (weekday - first.getDay() + 7) % 7 + (ordinal - 1) * 7);
  }

  // Gregorian Easter (Meeus/Jones/Butcher); Good Friday is two days earlier.
  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = (h + l - 7 * m + 114) % 31 + 1;
    return new Date(year, month - 1, day);
  }

  function victoriaDay(year) {
    var may24 = new Date(year, 4, 24);
    return addDays(may24, -((may24.getDay() + 6) % 7)); // Monday preceding May 25
  }

  function canadaDay(year) {
    var july1 = new Date(year, 6, 1);
    // Under the federal Holidays Act, when July 1 is Sunday, July 2 is Canada Day.
    return july1.getDay() === 0 ? new Date(year, 6, 2) : july1;
  }

  function forYear(year) {
    return [
      { name: "New Year's Day", date: new Date(year, 0, 1) },
      { name: 'Family Day', date: nthWeekday(year, 1, 1, 3) },
      { name: 'Good Friday', date: addDays(easterSunday(year), -2) },
      { name: 'Victoria Day', date: victoriaDay(year) },
      { name: 'Canada Day', date: canadaDay(year) },
      { name: 'Labour Day', date: nthWeekday(year, 8, 1, 1) },
      { name: 'Thanksgiving Day', date: nthWeekday(year, 9, 1, 2) },
      { name: 'Christmas Day', date: new Date(year, 11, 25) },
      { name: 'Boxing Day', date: new Date(year, 11, 26) }
    ];
  }

  var cache = {};
  App.holidaysOn = function (day) {
    var year = day.getFullYear();
    if (!cache[year]) cache[year] = forYear(year);
    return cache[year].filter(function (holiday) { return App.sameDay(day, holiday.date); });
  };

  App.holidayIcon = function () {
    return '<span class="holiday-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2l1.7 4.1 3.8-2-1 4.3 4.2 1.2-3.4 2.8 2.3 2.2-5.2.8.4 5.7h-2.6l.4-5.7-5.2-.8 2.3-2.2-3.4-2.8 4.2-1.2-1-4.3 3.8 2z"/>' +
      '</svg></span>';
  };
})();
