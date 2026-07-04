import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBinaries, run } from '@orkas/video-studio-core';

// End-to-end smoke over the BUILT `ovs` CLI and `ovs-mcp` server — the surface a
// coding agent actually drives (and the commands the README documents). Opt-in:
// it needs the dist built (`pnpm build`) plus ffmpeg/ffprobe, so it is gated the
// same way as the render e2e — set OVS_E2E=1 to run it.
const bins = resolveBinaries();
const enabled = process.env.OVS_E2E === '1' && Boolean(bins.ffmpeg) && Boolean(bins.ffprobe);
const suite = enabled ? describe : describe.skip;

const cliDist = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));
const mcpDist = fileURLToPath(new URL('../../mcp/dist/index.js', import.meta.url));

/** Invoke the built CLI, capturing status/stdout/stderr (progress rides stderr). */
function ovs(args: string[]) {
  return spawnSync(process.execPath, [cliDist, ...args], { encoding: 'utf8' });
}

/** Initialize + tools/list handshake against the stdio MCP server → tool names. */
function mcpToolNames(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, [mcpDist], { stdio: ['pipe', 'pipe', 'ignore'] });
    let buf = '';
    const timer = setTimeout(() => { srv.kill(); reject(new Error('mcp tools/list timed out')); }, 8000);
    srv.stdout.on('data', (d: Buffer) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg: { id?: number; result?: { tools?: { name: string }[] } };
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 2 && msg.result) {
          clearTimeout(timer);
          srv.kill();
          resolve((msg.result.tools ?? []).map((t) => t.name));
        }
      }
    });
    srv.on('error', (e) => { clearTimeout(timer); reject(e); });
    const send = (o: unknown) => srv.stdin.write(JSON.stringify(o) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  });
}

suite('cli smoke (built ovs + ovs-mcp)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ovs-cli-smoke-'));
  const src = join(dir, 'src.mp4');
  const cut = join(dir, 'cut.mp4');

  beforeAll(async () => {
    if (!existsSync(cliDist)) throw new Error(`CLI not built at ${cliDist} — run \`pnpm build\` before OVS_E2E.`);
    if (!existsSync(mcpDist)) throw new Error(`MCP not built at ${mcpDist} — run \`pnpm build\` before OVS_E2E.`);
    // 6s 320x240 test pattern + a 440Hz tone (has both video and audio).
    await run(bins.ffmpeg as string, [
      '-y',
      '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=25:duration=6',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
      src,
    ]);
  }, 120_000);

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('doctor reports the local toolchain is ready', () => {
    const r = ovs(['doctor']);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(true);
    expect(j.binaries.ffmpeg).toBeTruthy();
    expect(j.binaries.ffprobe).toBeTruthy();
  });

  it('lists and installs the skill pack', () => {
    expect(ovs(['skills']).stdout).toContain('video-router');
    const skillsDir = join(dir, 'skills');
    const r = ovs(['skills', '--install', '--target', 'claude', '--dir', skillsDir]);
    expect(r.status).toBe(0);
    expect(existsSync(join(skillsDir, 'video-router', 'SKILL.md'))).toBe(true);
  });

  it('trims a clip and streams structured ffmpeg progress on stderr', () => {
    const r = ovs(['edit', 'trim', src, '--start', '1', '--duration', '3', '--out', cut]);
    expect(r.status).toBe(0);
    expect(existsSync(cut)).toBe(true);
    // Progress events go to stderr (stdout is reserved for the JSON result).
    const events = r.stderr.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    expect(events.some((e) => e.type === 'progress' && e.op === 'trim')).toBe(true);
    expect(events.some((e) => e.status === 'completed')).toBe(true);
  });

  it('rejects a trim window past the end of the input', () => {
    const r = ovs(['edit', 'trim', src, '--start', '100', '--duration', '3', '--out', join(dir, 'bad.mp4')]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/too close to the end/);
    expect(existsSync(join(dir, 'bad.mp4'))).toBe(false);
  });

  it('scores footage quality over real ffmpeg', () => {
    const r = ovs(['quality', src]);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(typeof j.score).toBe('number');
    expect(j.durationSec).toBeGreaterThan(4);
  });

  it('promise-check --probe-produced assesses the real produced cut', () => {
    const plan = join(dir, 'plan.json');
    writeFileSync(plan, JSON.stringify({
      aspect: '16:9', total_target_sec: 6, language: 'en',
      delivery_promise: { type: 'explainer', motion_min_ratio: 0.5, source_required: false },
      segments: [{ id: 's1', layer: 'primary', source: 'compose', role: 'primary', target_sec: 6, order: 0, produced_path: cut }],
    }), 'utf8');
    const r = ovs(['plan', 'promise-check', plan, '--probe-produced']);
    const j = JSON.parse(r.stdout);
    // The plan PLANNED 6s but the produced cut is ~3s — the guard uses the real one.
    expect(j.produced_sec.s1).toBeGreaterThan(2.5);
    expect(j.produced_sec.s1).toBeLessThan(3.5);
    expect(j.total_primary_sec).toBeLessThan(4);
  });

  it('mcp server lists its tools over stdio', async () => {
    const names = await mcpToolNames();
    expect(names.length).toBeGreaterThan(20);
    expect(names).toContain('edit_trim');
    expect(names).toContain('plan_promise_check');
  }, 30_000);
});
