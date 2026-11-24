const zone = 'America/Toronto';
const intl = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

// Calendar arithmetic uses a UTC date as a container for Toronto wall-clock fields.
export function wallTime(epoch) {
  const p = Object.fromEntries(intl.formatToParts(epoch).map(part => [part.type, Number(part.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, epoch % 1000);
}

// Prefer the first occurrence during fall-back and move forward through a spring gap.
export function instant(wall) {
  const offsets = [-86400000, 86400000].map(delta => wallTime(wall + delta) - (wall + delta));
  const candidates = offsets.map(offset => wall - offset).sort((a, b) => a - b);
  return candidates.find(value => wallTime(value) === wall)
    ?? candidates.find(value => wallTime(value) > wall);
}

export class TorontoDate extends Date {
  constructor(...args) {
    super(args.length > 1 ? Date.UTC(...args) : args.length ? args[0] : wallTime(Date.now()));
  }
  getFullYear() { return this.getUTCFullYear(); }
  getMonth() { return this.getUTCMonth(); }
  getDate() { return this.getUTCDate(); }
  getDay() { return this.getUTCDay(); }
  getHours() { return this.getUTCHours(); }
  getMinutes() { return this.getUTCMinutes(); }
  getSeconds() { return this.getUTCSeconds(); }
  setFullYear(...args) { return this.setUTCFullYear(...args); }
  setMonth(...args) { return this.setUTCMonth(...args); }
  setDate(...args) { return this.setUTCDate(...args); }
  setHours(...args) { return this.setUTCHours(...args); }
}

export function eventFromWire(event) {
  const date = value => new TorontoDate(event.allDay ? Date.parse(value) : wallTime(Date.parse(value)));
  return { ...event, start: date(event.start), end: date(event.end),
    durationMs: Date.parse(event.end) - Date.parse(event.start) };
}

export function eventToWire(event) {
  const start = event.allDay ? event.start.toISOString().slice(0, 10) : new Date(instant(+event.start)).toISOString();
  const end = event.allDay ? event.end.toISOString().slice(0, 10)
    : new Date(Date.parse(start) + (+event.end - +event.start)).toISOString();
  const { title, people, allDay, repeat, loc, notes, travel } = event;
  return { title, people, allDay, repeat, loc, notes, travel, start, end };
}
