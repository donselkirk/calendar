import { describe, expect, it, vi } from 'vitest';

describe('native update status boundary', () => {
  it('shows a quiet badge and delegates confirmation to the native URL', async () => {
    vi.resetModules();
    window.App = {
      icon: () => '<svg></svg>', esc: (value) => value, on: vi.fn(), emit: vi.fn()
    };
    fetch.mockResolvedValue({ ok: true, json: async () => ({ available: true, latestVersionName: '1.12.0', state: 'idle', notes: 'Safe update' }) });
    await import('../js/updates.js');
    await window.App.refreshUpdateStatus();
    await Promise.resolve();
    expect(window.App.updateMarkup()).toContain('Update 1.12.0');
    expect(window.App.emit).toHaveBeenCalledWith('update');
  });

  it('keeps the badge absent when no release is available', async () => {
    vi.resetModules();
    window.App = { icon: () => '', esc: (value) => value, on: vi.fn(), emit: vi.fn() };
    fetch.mockResolvedValue({ ok: true, json: async () => ({ available: false, state: 'idle' }) });
    await import('../js/updates.js');
    await window.App.refreshUpdateStatus();
    await Promise.resolve();
    expect(window.App.updateMarkup()).toBe('');
  });

  it('shows noninteractive progress states and tolerates a missing native endpoint', async () => {
    vi.resetModules();
    window.App = { icon: () => '', esc: (value) => value, on: vi.fn(), emit: vi.fn() };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ available: false, state: 'downloading' }) });
    await import('../js/updates.js');
    await window.App.refreshUpdateStatus();
    expect(window.App.updateMarkup()).toContain('Downloading update');
    fetch.mockRejectedValueOnce(new Error('preview has no native endpoint'));
    await expect(window.App.refreshUpdateStatus()).resolves.toBeUndefined();
  });

  it('registers startup polling and renders the installing state', async () => {
    vi.resetModules();
    const handlers = {};
    window.App = {
      icon: () => '', esc: (value) => value,
      on: vi.fn((name, callback) => { handlers[name] = callback; }), emit: vi.fn()
    };
    fetch.mockResolvedValue({ ok: true, json: async () => ({ available: false, state: 'installing' }) });
    await import('../js/updates.js');
    handlers.ready();
    await window.App.refreshUpdateStatus();
    expect(window.App.updateMarkup()).toContain('Installing update');
    expect(window.App.on).toHaveBeenCalledWith('ready', expect.any(Function));
  });
});
