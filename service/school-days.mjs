import { torontoDay } from '../web/js/toronto.js';

export const schoolCalendarUrl = 'https://www.ocdsb.ca/ics/10612';

// Ministry-approved OCDSB secondary calendar, https://www.ocdsb.ca/download/556471
export const publishedPaDays = [
  '2026-08-31', '2026-10-02', '2026-11-23', '2027-01-29', '2027-04-16', '2027-06-24', '2027-06-25',
];

const DAY_MS = 86_400_000;

function calendarDate(value = '') {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  const date = year + '-' + month + '-' + day;
  const instant = Date.parse(date + 'T' + (hour ? hour + ':' + minute + ':' + second : '00:00:00') + 'Z');
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== date) return null;
  return utc ? torontoDay(instant) : date;
}

export function parseSecondaryPaDays(raw) {
  const calendar = raw.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').trim();
  if (!calendar.startsWith('BEGIN:VCALENDAR\n') || !calendar.endsWith('\nEND:VCALENDAR')) return null;
  const days = new Set();
  for (const [, event] of calendar.matchAll(/^BEGIN:VEVENT\n([\s\S]*?)^END:VEVENT$/gm)) {
    const title = /^SUMMARY(?:;[^:\n]*)?:(.+)$/m.exec(event)?.[1] || '';
    if (!/\b(?:professional activity|p\.?a\.?|p\.?d\.?) days?\b/i.test(title) ||
        !/\bsecondary\b/i.test(title) || /^STATUS:CANCELLED$/mi.test(event)) continue;
    const start = calendarDate(/^DTSTART(?:;[^:\n]*)?:(.+)$/m.exec(event)?.[1]);
    if (!start) continue;
    days.add(start);
    const end = calendarDate(/^DTEND(?:;[^:\n]*)?:(.+)$/m.exec(event)?.[1]);
    if (!end) continue;
    const first = Date.parse(start), last = Date.parse(end);
    if (last - first > 7 * DAY_MS) continue;
    for (let date = first + DAY_MS; date < last; date += DAY_MS) {
      days.add(new Date(date).toISOString().slice(0, 10));
    }
  }
  return [...days].sort();
}
