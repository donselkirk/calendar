// Minimal data shell for the calendar-only kiosk. Calendar events are populated from localStorage
// by app.js; no demo household, photo, shopping, weather, or automation data is bundled.
window.DATA = {
  people: [],
  family: {},
  ALL: [],
  events: [],
  busyExtras: [],
  configMissing: true
};

window.DEVICE_CONFIG = {
  schemaVersion: 1,
  configured: false,
  familyLabel: 'Family',
  people: [
    { id: 'person-1', name: 'Person 1', color: '#2D5BFF', ink: '#FFFFFF' },
    { id: 'person-2', name: 'Person 2', color: '#E4007C', ink: '#FFFFFF' },
    { id: 'person-3', name: 'Person 3', color: '#00A36C', ink: '#FFFFFF' },
    { id: 'person-4', name: 'Person 4', color: '#FFB000', ink: '#111111' }
  ],
  wasteEnabled: false
};
