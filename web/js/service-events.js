import { eventFromWire, eventToWire } from './toronto.js';

const endpoint = '/api/v1/events';
const App = window.App;
let etag;
let reading = false;
let generation = 0;
const requestKeys = new WeakMap();

async function refresh() {
  if (reading || document.hidden) return;
  reading = true;
  const current = generation;
  try {
    const response = await fetch(endpoint, {
      headers: etag ? { 'If-None-Match': etag } : {}, cache: 'no-store',
    });
    if (!response.ok) return;
    const result = await response.json();
    if (current === generation) {
      etag = response.headers.get('ETag');
      App.state.events = result.events.map(eventFromWire);
      App.emit('data');
    }
  } catch { /* Preserve the open form and let the next refresh retry. */ }
  finally { reading = false; }
}

function key() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

async function mutate(path, method, more, data) {
  const headers = { 'Content-Type': 'application/json', 'X-HomeHQ-Client': '1', ...more };
  const response = await fetch(endpoint + path, { method, headers, body: data && JSON.stringify(data) });
  if (!response.ok) {
    if (response.status === 409) refresh();
    throw new Error(response.status === 409 ? 'The calendar changed. Try again.' : 'The calendar could not save the change.');
  }
  const saved = await response.json();
  generation++;
  etag = null;
  const events = App.state.events.filter(event => event.id !== saved.id);
  if (method !== 'DELETE') events.push(eventFromWire(saved));
  App.state.events = events;
  return saved;
}

App.createSharedEvent = function (event, form) {
  const data = eventToWire(event);
  const signature = JSON.stringify(data);
  let entry = requestKeys.get(form);
  if (!entry || entry.signature !== signature) {
    entry = { signature, key: key() };
    requestKeys.set(form, entry);
  }
  return mutate('', 'POST', { 'Idempotency-Key': entry.key }, data);
};
App.deleteSharedEvent = event => mutate('/' + event.id, 'DELETE', { 'If-Match': '"' + event.revision + '"' });
App.restoreSharedEvent = event => mutate('/' + event.id + '/restore', 'POST', { 'If-Match': '"' + event.revision + '"' });
App.on('ready', function () {
  refresh();
  setInterval(refresh, 15000);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
});
