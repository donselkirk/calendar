// Ottawa weather for the calendar-only kiosk. No account or API key is required. The most recent
// successful response is cached locally so a Wi-Fi outage does not leave a blank header.
(function () {
  'use strict';
  var CACHE_KEY = 'homehq.weather.ottawa.v1';
  var URL = 'https://api.open-meteo.com/v1/forecast' +
    '?latitude=45.4215&longitude=-75.6972' +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,is_day,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto&forecast_days=8';
  var state = { data: null, fetchedAt: 0, loading: false, error: false };

  try {
    var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.data && cached.data.current) {
      state.data = cached.data;
      state.fetchedAt = Number(cached.fetchedAt) || 0;
    }
  } catch (err) {
    console.warn('Could not read cached Ottawa weather', err);
  }

  function valid(data) {
    return data && data.current && isFinite(Number(data.current.temperature_2m)) &&
      data.daily && Array.isArray(data.daily.temperature_2m_max) &&
      Array.isArray(data.daily.temperature_2m_min);
  }

  function condition(code, day) {
    code = Number(code);
    if (code === 0) return { icon: day ? 'sun' : 'moon', label: 'Clear', scene: 'clear' };
    if (code <= 2) return { icon: 'partly', label: 'Partly cloudy', scene: 'partly' };
    if (code === 3) return { icon: 'cloud', label: 'Cloudy', scene: 'cloud' };
    if (code === 45 || code === 48) return { icon: 'cloud', label: 'Fog', scene: 'fog' };
    if (code >= 71 && code <= 77 || code >= 85 && code <= 86) return { icon: 'snow', label: 'Snow', scene: 'snow' };
    if (code >= 95) return { icon: 'bolt', label: 'Storm', scene: 'storm' };
    return { icon: 'rain', label: code >= 80 ? 'Showers' : 'Rain', scene: 'rain' };
  }

  App.weatherForecast = function () {
    return { data: state.data, fetchedAt: state.fetchedAt, loading: state.loading, error: state.error, condition: condition };
  };

  App.weatherMarkup = function () {
    if (!state.data) {
      return '<button class="cal-weather is-loading" data-forecast aria-label="Open Ottawa forecast">' +
        App.icon('cloud', 28) + '<span><b>--°</b><small>Ottawa · ' + (state.error ? 'Unavailable' : 'Loading') + '</small></span></button>';
    }
    var cur = state.data.current, daily = state.data.daily;
    var c = condition(cur.weather_code, Number(cur.is_day) === 1);
    var stale = App.now().getTime() - state.fetchedAt > 3 * 60 * 60 * 1000;
    var temp = Math.round(Number(cur.temperature_2m));
    var hi = Math.round(Number(daily.temperature_2m_max[0]));
    var lo = Math.round(Number(daily.temperature_2m_min[0]));
    return '<button class="cal-weather' + (stale ? ' is-stale' : '') + '" data-forecast aria-label="Open Ottawa forecast">' +
      App.icon(c.icon, 30) + '<span><b class="num">' + temp + '°</b><small>Ottawa · ' + c.label + '<br>H ' + hi + '° · L ' + lo + '°</small></span></button>';
  };

  App.refreshWeather = function (manual) {
    if (state.loading) return;
    state.loading = true;
    state.error = false;
    return fetch(URL, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('Weather HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      if (!valid(data)) throw new Error('Unexpected weather response');
      state.data = data;
      state.fetchedAt = App.now().getTime();
      state.loading = false;
      try { window.localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: state.fetchedAt, data: data })); } catch (_err) {}
      App.emit('weather');
      if (manual) App.toast('Ottawa weather updated', { icon: 'sun', ms: 2200 });
    }).catch(function (err) {
      state.loading = false;
      state.error = true;
      console.warn('Could not update Ottawa weather', err);
      App.emit('weather');
      if (manual) App.toast('Could not update weather. Showing the last saved reading.', { tone: 'alert', ms: 5000 });
    });
  };

  App.on('ready', function () {
    App.refreshWeather(false);
    setInterval(function () { App.refreshWeather(false); }, 30 * 60 * 1000);
  });
})();
