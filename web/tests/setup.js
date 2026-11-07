import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 7, 11, 0, 0));
  window.localStorage.clear();
  window.DATA = { people: [], family: {}, ALL: [], events: [], busyExtras: [] };
  window.DEVICE_CONFIG = {
    schemaVersion: 1,
    configured: true,
    familyLabel: 'Household',
    people: [
      { id: 'alpha', name: 'Alpha', color: '#2D5BFF', ink: '#FFFFFF' },
      { id: 'beta', name: 'Beta', color: '#FFB000', ink: '#111111' }
    ],
    wasteEnabled: true
  };
  document.body.innerHTML = '<div id="stage"><main class="views"><section class="view" id="view-calendar" data-view="calendar"></section></main><div id="toasts"></div><div id="sheetLayer"></div></div>';
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
