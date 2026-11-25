import { readFileSync } from 'node:fs';
import { isIPv4 } from 'node:net';

const generic = [1, 2, 3, 4].map((number, index) => ({
  id: `person-${number}`, name: `Person ${number}`,
  color: ['#2D5BFF', '#E4007C', '#00A36C', '#9E6400'][index], ink: '#FFFFFF',
}));
const color = /^#[0-9a-f]{6}$/i;
const label = value => typeof value === 'string' && value.trim() && value.length <= 60;
export function privateIPv4(address) {
  return isIPv4(address) && /^(127\.0\.0\.1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
}

export function readConfig(file) {
  let raw = {};
  try { raw = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Invalid Home HQ configuration'); }
  const host = raw.host ?? '127.0.0.1';
  const port = raw.port ?? 8080;
  const proxyOrigins = raw.proxyOrigins ?? [];
  if (!Array.isArray(proxyOrigins) || proxyOrigins.some(value => {
    try {
      const url = new URL(value);
      return typeof value !== 'string' || !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== value || url.username || url.password;
    } catch { return true; }
  })) throw new Error('Invalid proxy origins');
  if (!privateIPv4(host) || !Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Use a private IP and a valid service port');
  }
  const people = raw.people ?? generic;
  if (!Array.isArray(people) || !people.length || people.length > 12 ||
      people.some(p => !p || typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(p.id) ||
        p.id === 'family' || !label(p.name) || !color.test(p.color) || !color.test(p.ink)) ||
      new Set(people.map(p => p.id)).size !== people.length) throw new Error('Invalid calendars');
  const familyLabel = raw.familyLabel ?? 'Family';
  if (!label(familyLabel)) throw new Error('Invalid family label');
  const waste = raw.waste;
  if (waste && (typeof waste.placeId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(waste.placeId) ||
      !Number.isInteger(waste.serviceId) || waste.serviceId < 1)) throw new Error('Invalid collection configuration');
  return { host, port, waste, proxyOrigins, publicConfig: {
    schemaVersion: 1, configured: Boolean(raw.people), familyLabel,
    people: people.map(({id, name, color, ink}) => ({id, name, color, ink})), wasteEnabled: Boolean(waste),
  } };
}
