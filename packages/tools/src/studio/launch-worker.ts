import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { startStudio } from './server.js';
import { openStudioUrl } from './launch.js';

// A separate CLI-owned service survives the authoring command's completion.
// Its production lease arbitrates simultaneous CLI/MCP opens; no native Agent runs.
let service: Awaited<ReturnType<typeof startStudio>> | undefined;
let stopping = false;
async function stop() { stopping = true; if (service) { await service.close(); process.exit(0); } }
process.once('SIGINT', () => { void stop(); }); process.once('SIGTERM', () => { void stop(); });
try {
  const production = process.argv[2];
  try { service = await startStudio({ production }); }
  catch (error) {
    // Another owner may have won between the parent's check and this claim.
    if (await fs.lstat(join(production, '.ovs-studio.lock')).catch(() => null)) {
      process.send?.({ ok: true });
    } else process.send?.({ ok: false });
    process.exit(0);
  }
  if (stopping) await stop();
  const opened = await openStudioUrl(service.url);
  if (!opened) await service.close();
  process.send?.({ ok: opened });
  if (!opened) process.exit(0);
} catch {
  await service?.close().catch(() => {}); process.send?.({ ok: false }); process.exit(1);
}
