import { execFile, spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { promisify, stripVTControlCharacters } from 'node:util';

const script = fileURLToPath(import.meta.url);
const maxRequestBytes = 32 * 1024;
const maxBrowsers = 16;
const launchDeadlineMs = 60 * 60 * 1000;

export function localNetworkProfile(chromiumSocket) {
  const unixSocket = chromiumSocket ? `,unix_sockets={${JSON.stringify(chromiumSocket)}="allow"}` : '';
  return `permissions.ovs-eval={extends=":workspace",network={enabled=true,mode="limited",allow_local_binding=true,domains={"localhost"="allow","127.0.0.1"="allow"}${unixSocket}}}`;
}

export async function probeChromium(cwd, { executable, socket }, env, execute = promisify(execFile)) {
  const marker = 'ovs-chromium-startup';
  const deadlines = [15_000, 30_000];
  const args = [
    'sandbox', '-C', cwd, '-c', localNetworkProfile(socket), '-P', 'ovs-eval', '--',
    executable, '--headless', '--no-sandbox', '--disable-gpu', '--dump-dom', `data:text/html,${marker}`,
  ];
  const start = performance.now();
  for (const [index, timeout] of deadlines.entries()) {
    try {
      const { stdout } = await execute('codex', args, { cwd, env, timeout });
      if (!stdout.includes(`<body>${marker}</body>`)) throw new Error('Chromium started but did not load the evaluation probe page.');
      return { attempts: index + 1, seconds: (performance.now() - start) / 1000 };
    } catch (error) {
      if (!(error.killed && error.signal === 'SIGTERM')) throw error;
      if (index === deadlines.length - 1) throw new Error(`Chromium did not pass the readiness probe after ${index + 1} attempts.`);
    }
  }
}

/** Always settle the browser connection, including when macOS denies a group signal. */
export function stopBrowserGroup(child) {
  if (!child.pid) return null;
  try {
    process.kill(-child.pid, 'SIGKILL');
    return null;
  } catch (error) {
    if (error.code === 'ESRCH') return null;
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGKILL'); } catch { /* Report that the group could not be verified. */ }
    }
    return error.code ?? 'UNKNOWN';
  }
}

// Chromium needs macOS service access that the Codex command profile lacks.
// The separate profile applies to Chromium only and gives it no host profile,
// arbitrary executables, or filesystem access outside its runtime and case.
function browserPolicy(binary, workspace, scratch) {
  const readable = [
    '/System', '/usr/lib', '/usr/share', '/Library/Fonts', '/Library/Apple/System/Library/Fonts',
    '/private/var/db/dyld', '/private/var/db/timezone', '/dev', dirname(binary), workspace, scratch,
  ];
  const ancestors = new Set();
  for (const dir of readable) {
    for (let parent = dirname(dir); ; parent = dirname(parent)) {
      ancestors.add(parent);
      if (parent === '/') break;
    }
  }
  const services = [
    'com.apple.logd', 'com.apple.system.notification_center', 'com.apple.coreservices.launchservicesd',
    'com.apple.CoreServices.coreservicesd', 'com.apple.DiskArbitration.diskarbitrationd',
    'com.apple.dock.server', 'com.apple.system.opendirectoryd.api', 'com.apple.powerd',
    'com.apple.PowerManagement.control', 'com.apple.cfprefsd.agent', 'com.apple.cfprefsd.daemon',
    'com.apple.fonts', 'com.apple.securityd', 'com.apple.trustd',
  ];
  const rules = (kind, paths) => paths.map(path => `(${kind} ${JSON.stringify(path)})`).join(' ');
  const chromiumServices = '(global-name-prefix "org.chromium.")';
  return [
    '(version 1)',
    '(allow default)',
    '(deny file-read* file-write* network* process-exec signal appleevent-send mach-lookup mach-register)',
    `(allow file-read* ${rules('subpath', readable)} ${rules('literal', [...ancestors])})`,
    `(allow file-write* ${rules('subpath', [scratch])} (literal "/dev/null") (literal "/dev/dtracehelper"))`,
    `(allow process-exec ${rules('literal', [binary])})`,
    '(allow signal (target same-sandbox))',
    `(allow mach-lookup ${rules('global-name', services)} ${chromiumServices})`,
    `(allow mach-register ${chromiumServices})`,
    '(allow network-bind network-inbound (local ip "localhost:*"))',
    '(allow network-outbound (remote ip "localhost:*"))',
  ].join('\n');
}

function browserArguments(value, profile) {
  if (!Array.isArray(value) || value.length > 256 || value.some(arg => typeof arg !== 'string' || arg.includes('\0'))
    || value.some(arg => arg === '--' || /^--(?:remote-debugging-pipe|user-data-dir|remote-debugging-address)$/.test(arg)
      || arg.startsWith('--remote-debugging-pipe='))) {
    throw new Error('Invalid Chromium launcher arguments. HyperFrames must connect over loopback CDP.');
  }
  return [...value.filter(arg => !/^--(?:user-data-dir|remote-debugging-address)=/.test(arg)),
    `--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1'];
}

async function serveBrowser(req, res, options) {
  if (req.method !== 'POST' || req.url !== '/') return res.writeHead(404).end();
  const { binary, workspace, scratch, active, cleanupWarnings } = options;
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxRequestBytes) return res.writeHead(413).end();
    chunks.push(chunk);
  }
  if (res.destroyed) return;
  if (active.size >= maxBrowsers) return res.writeHead(503).end();
  const userDir = mkdtempSync(join(scratch, 'browser-'));
  let args;
  try {
    args = browserArguments(JSON.parse(Buffer.concat(chunks).toString()), userDir);
  } catch {
    rmSync(userDir, { recursive: true, force: true });
    return res.writeHead(400).end();
  }
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
  res.flushHeaders();
  const child = spawn('/usr/bin/sandbox-exec', ['-p', browserPolicy(binary, workspace, userDir), binary, ...args], {
    cwd: userDir, env: { TMPDIR: userDir, PATH: '/usr/bin:/bin' },
    stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  active.add(child);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const warning = stopBrowserGroup(child);
    if (warning) cleanupWarnings.add(`browser-group-signal:${warning}`);
  };
  const timer = setTimeout(stop, launchDeadlineMs);
  const disconnect = () => {
    stop();
    child.stdout.resume();
    child.stderr.resume();
  };
  res.once('close', disconnect);
  const emit = value => !res.destroyed && res.write(JSON.stringify(value) + '\n');
  for (const stream of ['stdout', 'stderr']) {
    child[stream].on('data', data => {
      if (!res.destroyed && !emit({ stream, data: data.toString('base64') })) {
        child[stream].pause();
        res.once('drain', () => child[stream].resume());
      }
    });
  }
  child.once('error', error => emit({ stream: 'stderr', data: Buffer.from(error.message + '\n').toString('base64') }));
  child.once('close', code => {
    stop();
    res.off('close', disconnect);
    clearTimeout(timer);
    active.delete(child);
    try { rmSync(userDir, { recursive: true, force: true }); }
    catch (error) { cleanupWarnings.add(`browser-profile-removal:${error.code ?? 'UNKNOWN'}`); }
    if (!res.destroyed) res.end(JSON.stringify({ code: code ?? 1 }) + '\n');
  });
}

export async function startChromium({ cwd, bin, invocation }) {
  // `browser ensure` selects the managed build used by render, even if an older
  // Puppeteer cache entry would take precedence in `browser path`.
  const { stdout } = await promisify(execFile)(invocation.command, invocation.args, { timeout: 300_000 });
  const browserPath = stripVTControlCharacters(stdout).match(/^ *Path: +(.+)$/m)?.[1]?.trim();
  if (!browserPath) throw new Error('HyperFrames did not report a Chromium executable path.');
  const binary = realpathSync(browserPath);
  if (basename(binary) !== 'chrome-headless-shell') {
    throw new Error('Install the HyperFrames Chromium headless shell before running macOS model evaluation.');
  }
  const workspace = realpathSync(cwd);
  // Keep the broker's socket and browser profiles outside Codex's writable temp roots.
  const scratch = realpathSync(mkdtempSync(join(homedir(), 'Library', 'Caches', 'ovs-chromium-')));
  const socket = join(scratch, 'browser.sock');
  const executable = join(bin, 'chrome-headless-shell');
  const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  const active = new Set();
  const cleanupWarnings = new Set();
  const server = createServer({ requestTimeout: 15_000 }, (req, res) => {
    serveBrowser(req, res, { binary, workspace, scratch, active, cleanupWarnings }).catch(() => res.destroy());
  });
  server.maxConnections = 2 * maxBrowsers;
  const close = async () => {
    const serverClosed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await serverClosed;
    if (active.size) {
      let timer;
      try {
        const closed = await Promise.race([
          Promise.all([...active].map(child => new Promise(resolve => child.once('close', resolve)))).then(() => true),
          new Promise(resolve => { timer = setTimeout(resolve, 10_000, false); }),
        ]);
        if (!closed) {
          cleanupWarnings.add('browser-close-deadline');
          for (const child of active) {
            child.stdout.destroy();
            child.stderr.destroy();
            child.unref();
          }
        }
      } finally { clearTimeout(timer); }
    }
    try { rmSync(scratch, { recursive: true, force: true }); }
    catch (error) { cleanupWarnings.add(`browser-scratch-removal:${error.code ?? 'UNKNOWN'}`); }
    return [...cleanupWarnings];
  };
  try {
    writeFileSync(executable, `#!/bin/sh\nexec ${[process.execPath, script, socket].map(shellQuote).join(' ')} "$@"\n`, { mode: 0o500 });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(socket, () => {
        server.off('error', reject);
        resolve();
      });
    });
    chmodSync(socket, 0o600);
    const env = {
      HYPERFRAMES_BROWSER_PATH: executable,
      PRODUCER_HEADLESS_SHELL_PATH: executable,
      // Keep software rasterization in the supervised browser. OVS verifies
      // BeginFrame's output and retries using screenshots for a black capture.
      PRODUCER_BROWSER_GPU_MODE: 'software',
      PRODUCER_FORCE_SCREENSHOT: 'false',
      OVS_EVAL_CHECK_CAPTURE: '1',
    };
    return { executable, socket, env, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function launch(socketPath, args) {
  const req = request({ socketPath, path: '/', method: 'POST' });
  const reply = new Promise((resolve, reject) => {
    req.once('response', resolve);
    req.once('error', reject);
  });
  const cancel = () => req.destroy();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  req.end(JSON.stringify(args));
  const res = await reply;
  if (res.statusCode !== 200) throw new Error(`Chromium launcher rejected the request (HTTP ${res.statusCode}).`);
  for await (const line of createInterface({ input: res, crlfDelay: Infinity })) {
    const event = JSON.parse(line);
    if ('code' in event) return event.code;
    const stream = event.stream === 'stderr' ? process.stderr : process.stdout;
    await new Promise((resolve, reject) => stream.write(Buffer.from(event.data, 'base64'), error => error ? reject(error) : resolve()));
  }
  throw new Error('Chromium launcher disconnected before the browser exited.');
}

if (process.argv[1] === script) {
  try { process.exitCode = await launch(process.argv[2], process.argv.slice(3)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
