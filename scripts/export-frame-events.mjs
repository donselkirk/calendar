import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('Specify a new private export path');
const component = 'com.wesbos.homehq/.MainActivity';
const expected = 'http://127.0.0.1:8765';
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', timeout: 15_000 }).trim();
let port;
let ws;
try {
  adb('shell', 'am', 'start', '-n', component, '--ez', 'debug', 'true');
  let pid;
  for (let i = 0; i < 12 && !pid; i++) {
    const line = adb('shell', 'ps').split('\n').find(line => line.trim().endsWith(' com.wesbos.homehq'));
    pid = line?.trim().split(/\s+/)[1];
    if (!pid) await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!/^\d+$/.test(pid ?? '')) throw new Error('Legacy frame app is not running');
  port = adb('forward', 'tcp:0', 'localabstract:webview_devtools_remote_' + pid);
  if (!/^\d+$/.test(port)) throw new Error('ADB did not allocate a debugging port');
  let page;
  for (let i = 0; i < 12 && !page; i++) {
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
      page = (await reply.json()).find(target => target.type === 'page' && new URL(target.url).origin === expected);
    } catch { /* Wait for the original page to finish starting. */ }
    if (!page) await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!page) throw new Error('Original calendar origin is unavailable');
  const socketPath = new URL(page.webSocketDebuggerUrl).pathname;
  if (!/^\/devtools\/page\/[a-zA-Z0-9_-]+$/.test(socketPath)) throw new Error('Unexpected debugging target');
  ws = new WebSocket(`ws://127.0.0.1:${port}${socketPath}`);
  const raw = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Legacy export timed out')), 10_000);
    ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Could not connect to WebView')); });
    ws.addEventListener('open', () => ws.send(JSON.stringify({
      id: 1, method: 'Runtime.evaluate', params: {
        expression: `location.origin === "${expected}" && localStorage.getItem("homehq.local.calendar.v1")`,
        returnByValue: true,
      },
    })));
    ws.addEventListener('message', msg => {
      const result = JSON.parse(msg.data);
      if (result.id === 1) {
        clearTimeout(timeout);
        resolve(result.result?.result?.value);
      }
    });
  });
  if (typeof raw !== 'string' || !Array.isArray(JSON.parse(raw).events)) {
    throw new Error('The legacy event key was not found. Verify the calendar before proceeding.');
  }
  writeFileSync(out, raw, { flag: 'wx', mode: 0o600 });
  console.log(`Exported ${JSON.parse(raw).events.length} events to the private file.`);
} finally {
  ws?.close();
  try { if (/^\d+$/.test(port ?? '')) adb('forward', '--remove', 'tcp:' + port); }
  finally { adb('shell', 'am', 'start', '-n', component, '--ez', 'debug', 'false'); }
}
