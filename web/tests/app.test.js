import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadApp(events) {
  vi.resetModules();
  if (events) localStorage.setItem('homehq.local.calendar.v1', JSON.stringify({ events }));
  await import('../js/icons.js');
  await import('../js/app.js');
  return window.App;
}

describe('calendar data model', () => {
  beforeEach(() => { window.ICONS = {}; });

  it('loads private display configuration without embedding it in source defaults', async () => {
    const app = await loadApp();
    expect(app.state.people.map((person) => person.id)).toEqual(['alpha', 'beta']);
    expect(app.state.family.name).toBe('Household');
    expect(app.state.people[0].rgb).toBe('45 91 255');
    expect(app.person('missing')).toBe(app.state.family);
  });

  it('sanitizes stored events and migrates legacy calendar slots by position', async () => {
    const app = await loadApp([
      { id: 'ok', title: 'Appointment', people: ['personal', 'beta', 'missing'], start: '2026-11-07T14:00:00', end: '2026-11-07T15:00:00', repeat: 'weekly' },
      { id: 'bad', title: '', people: [], start: 'invalid', end: 'invalid' }
    ]);
    expect(app.state.events).toHaveLength(1);
    expect(app.state.events[0].people).toEqual(['alpha', 'beta']);
    expect(app.state.events[0].repeat).toBe('weekly');
    expect(app.saveEvents()).toBe(true);
    expect(JSON.parse(localStorage.getItem('homehq.local.calendar.v1')).version).toBe(2);
  });

  it('expands weekly, monthly and yearly recurrences directly from their series', async () => {
    const app = await loadApp([
      { id: 'weekly', title: 'Weekly', people: ['alpha'], start: '2026-10-31T09:30:00', end: '2026-10-31T10:30:00', repeat: 'weekly' },
      { id: 'monthly', title: 'Month end', people: ['alpha'], start: '2026-01-31T11:00:00', end: '2026-01-31T12:00:00', repeat: 'monthly' },
      { id: 'yearly', title: 'Leap', people: ['beta'], start: '2024-02-29T00:00:00', end: '2024-03-01T00:00:00', allDay: true, repeat: 'yearly' }
    ]);
    expect(app.timedOn(new Date(2026, 10, 7)).map((event) => event.title)).toContain('Weekly');
    expect(app.timedOn(new Date(2026, 1, 28)).map((event) => event.title)).toContain('Month end');
    expect(app.allDayOn(new Date(2026, 1, 28)).map((event) => event.title)).toContain('Leap');
    expect(app.timedOn(new Date(2026, 10, 8))).toHaveLength(0);
  });

  it('uses a cached trusted clock instead of rendering the Unix epoch', async () => {
    vi.setSystemTime(new Date(0));
    localStorage.setItem('homehq.clock.anchor.v1', JSON.stringify({ epoch: +new Date(2026, 10, 7, 8) }));
    const app = await loadApp();
    expect(app.clockReady()).toBe(true);
    expect(app.now().getFullYear()).toBe(2026);
  });

  it('formats and escapes user-controlled content', async () => {
    const app = await loadApp();
    expect(app.esc('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    expect(app.fmt.time(new Date(2026, 1, 1, 13, 30))).toBe('1:30 PM');
    expect(app.repeatLabel('yearly')).toBe('Every year');
  });
});
