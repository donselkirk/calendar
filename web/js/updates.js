// Read-only presentation of native updater state. The install decision remains entirely native.
(function () {
  'use strict';
  var state = { available: false, versionName: '', status: 'idle', notes: '', error: '' };

  function clean(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      available: value.available === true,
      versionName: typeof value.latestVersionName === 'string' ? value.latestVersionName : '',
      status: typeof value.state === 'string' ? value.state : 'idle',
      notes: typeof value.notes === 'string' ? value.notes : '',
      error: typeof value.error === 'string' ? value.error : ''
    };
  }

  App.updateMarkup = function () {
    if (!state.available && state.status !== 'downloading' && state.status !== 'installing') return '';
    var label = state.status === 'downloading' ? 'Downloading update' :
      (state.status === 'installing' ? 'Installing update' : 'Update ' + App.esc(state.versionName));
    return '<button class="update-badge" data-update aria-label="' + label + '">' +
      App.icon('download', 22) + '</button>';
  };

  App.refreshUpdateStatus = function () {
    if (window.HOMEHQ_SERVICE && !window.HOMEHQ_FRAME) return;
    return fetch(window.HOMEHQ_SERVICE ? '/__device/v1/status' : '/__update_status', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('status unavailable');
      return response.json();
    }).then(function (value) {
      var next = clean(value);
      if (!next) return;
      state = next;
      App.emit('update');
    }).catch(function () {
      // A normal browser preview has no native endpoint. Keep the badge absent.
    });
  };

  App.openUpdate = function () { window.location.href = window.HOMEHQ_SERVICE ? '/__device/v1/update' : '/__update_ui'; };
  App.on('ready', function () {
    App.refreshUpdateStatus();
    setInterval(App.refreshUpdateStatus, 60 * 1000);
  });
})();
