import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export class LeaseBusyError extends Error {
  constructor() { super('busy'); }
}

function alive(pid: unknown) {
  if (!Number.isSafeInteger(pid) || Number(pid) < 1) return true;
  try { process.kill(Number(pid), 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
/** Explicit stale recovery is permitted only after every recorded owner has exited. */
export async function acquireLease(file: string, recover = false) {
  const nonce = randomUUID();
  async function open() { return fs.open(file, 'wx', 0o600); }
  let handle: fs.FileHandle;
  let guard: fs.FileHandle | undefined;
  try {
  try { handle = await open(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!recover) throw new LeaseBusyError();
    guard = await fs.open(`${file}.recovery`, 'wx', 0o600).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new LeaseBusyError();
      throw error;
    });
    await guard.writeFile(JSON.stringify({ pid: process.pid }));
    const stat = await fs.lstat(file).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new LeaseBusyError();
      throw error;
    });
    if (!stat.isFile() || stat.size > 4096) throw new LeaseBusyError();
    const before = await fs.readFile(file, 'utf8');
    let previous: { pid?: number; child_pid?: number };
    try { previous = JSON.parse(before); } catch { throw new LeaseBusyError(); }
    if (alive(previous?.pid) || previous.child_pid !== undefined && alive(previous.child_pid)) throw new LeaseBusyError();
    // Recovery is fail-closed if another claimant changed this record.
    if (await fs.readFile(file, 'utf8') !== before) throw new LeaseBusyError();
    await fs.unlink(file);
    handle = await open().catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new LeaseBusyError();
      throw error;
    });
  }
  let released = false;
  const value = { pid: process.pid, nonce, started_at: new Date().toISOString(), child_pid: undefined as number | undefined };
  const update = async (childPid?: number) => {
    value.child_pid = childPid;
    const bytes = Buffer.from(JSON.stringify(value));
    await handle.write(bytes, 0, bytes.length, 0); await handle.truncate(bytes.length);
  };
  try { await update(); } catch (error) { await handle.close(); await fs.rm(file, { force: true }); throw error; }
  return { update, async release() {
    if (released) return; released = true;
    await handle.close();
    const current = await fs.readFile(file, 'utf8').catch(() => '');
    try { if (JSON.parse(current).nonce === nonce) await fs.unlink(file); } catch { /* A newer claimant keeps its lock. */ }
  } };
  } finally { if (guard) { await guard.close(); await fs.rm(`${file}.recovery`, { force: true }); } }
}

