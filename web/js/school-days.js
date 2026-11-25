(function () {
  'use strict';
  var days = new Set();
  var source = 'OCDSB secondary calendar';
  var loading = false;

  App.schoolPaDayOn = function (date) { return days.has(date.toISOString().slice(0, 10)); };
  App.schoolPaDaySource = function () { return source; };

  function refresh() {
    if (loading) return;
    loading = true;
    fetch('/api/v1/school-days', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('School calendar request failed');
      return response.json();
    }).then(function (result) {
      if (!Array.isArray(result.data)) return;
      days = new Set(result.data);
      source = result.published ? 'Published OCDSB secondary calendar' :
        (result.stale ? 'Last saved OCDSB secondary calendar' : 'OCDSB secondary calendar');
      App.emit('school-days');
    }).catch(function () {
      source = 'Last saved OCDSB secondary calendar';
    }).finally(function () { loading = false; });
  }

  App.on('ready', function () {
    if (!window.HOMEHQ_SERVICE) return;
    refresh();
    setInterval(refresh, 15 * 60 * 1000);
    window.addEventListener('online', refresh);
  });
})();
