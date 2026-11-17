import * as fs from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork, spawn } from 'node:child_process';

export function studioAutoOpenEnabled() {
  return process.env.OVS_STUDIO_AUTO_OPEN === '1'
    || process.env.OVS_STUDIO_AUTO_OPEN !== '0' && process.env.CI !== 'true';
}

/** Only our authenticated loopback canvas link is eligible for OS opening. */
export async function openStudioUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || !parsed.port
    || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search
    || !/^#[a-f0-9]{64}$/.test(parsed.hash)) return false;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32.exe' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true, timeout: 5000, killSignal: 'SIGKILL' });
    child.once('error', () => resolve(false)); child.once('close', code => resolve(code === 0));
  });
}

/** Called only by public authoring commands, never core functions or read-only APIs. */
export async function autoOpenStudio(input: string): Promise<void> {
  if (!studioAutoOpenEnabled()) return;
  try {
    let production = await fs.realpath(resolve(input));
    if (basename(dirname(production)) === 'videos') production = dirname(dirname(production));
    // Legacy standalone compositions have no editable production canvas.
    if (!(await fs.stat(join(production, 'videos')).catch(() => null))?.isDirectory()) return;
    if (await fs.lstat(join(production, '.ovs-studio.lock')).catch(() => null)) return;
    const opened = await new Promise<boolean>(done => {
      const child = fork(fileURLToPath(new URL('./launch-worker.js', import.meta.url)), [production], {
        detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [],
      });
      let settled = false;
      const timer = setTimeout(() => { child.kill(); finish(false); }, 15000);
      function finish(ok: boolean) {
        if (settled) return; settled = true; clearTimeout(timer);
        if (child.connected) child.disconnect(); child.unref(); done(ok);
      }
      child.once('error', () => finish(false)); child.once('exit', () => finish(false));
      child.once('message', value => finish(!!value && typeof value === 'object' && 'ok' in value && value.ok === true));
    });
    if (!opened) process.stderr.write('Canvas could not open automatically. Open it with ovs studio --production <your-production>.\n');
  } catch {
    process.stderr.write('Canvas could not open automatically. Open it with ovs studio --production <your-production>.\n');
  }
}
