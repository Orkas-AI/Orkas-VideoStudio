import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { Script } from 'node:vm';
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

  it('provides the vendored page helpers from the built package as classic scripts, byte for byte', async () => {
    const built = fileURLToPath(new URL('../dist/composition/scaffold.js', import.meta.url));
    const { ensureBundledVendors } = await import(built) as { ensureBundledVendors: (project: string, html: string) => Promise<void> };
    const project = join(dir, 'vendor-project');
    await ensureBundledVendors(project, '<script src="./assets/vendor/gsap.min.js"></script><script src="./assets/vendor/screen-demo.js"></script>');
    for (const file of ['gsap.min.js', 'screen-demo.js']) {
      const copied = readFileSync(join(project, 'assets', 'vendor', file));
      expect(copied.equals(readFileSync(fileURLToPath(new URL(`../src/render/vendor/${file}`, import.meta.url))))).toBe(true);
      expect(() => new Script(copied.toString('utf8'))).not.toThrow();
    }
  });

  it('inspects native video parameters through the public CLI without provider credentials', () => {
    const env = { ...process.env, OVS_VIDEO_PROVIDER: 'runway', OVS_VIDEO_MODEL: 'gen4.5', OVS_VIDEO_API_KEY: 'never-dispatched-secret' };
    const invoke = (args: string[]) => spawnSync(process.execPath, [cliDist, ...args], { encoding: 'utf8', timeout: 15_000, env });
    const list = invoke(['video-models']); expect(list.status, list.stderr).toBe(0);
    expect(JSON.parse(list.stdout).provider).toBe('runway'); expect(list.stdout).not.toContain('never-dispatched-secret');
    const fitted = invoke(['video-params', '--request', '{"ratio":"1:1","duration":3,"resolution":"1080p"}']);
    expect(fitted.status, fitted.stderr).toBe(0); const result = JSON.parse(fitted.stdout);
    expect(result.wanted.ratio).toBe('1:1'); expect(['16:9','9:16']).toContain(result.native.ratio);
    expect(fitted.stdout).not.toContain('never-dispatched-secret');
  });

  it('gives narration pace, fill limits and timing-input fixes through the public CLI without a provider call', () => {
    const env = { ...process.env, OVS_TTS_PROVIDER: 'openai-compatible', OVS_TTS_BASE_URL: 'http://127.0.0.1:9/v1', OVS_TTS_API_KEY: 'never-dispatched-secret', OVS_TTS_MODEL: 'tts-1' };
    const invoke = (args: string[]) => spawnSync(process.execPath, [cliDist, ...args], { encoding: 'utf8', timeout: 15_000, env });
    const paced = invoke(['speech-capabilities', '--language', 'zh-CN']);
    expect(paced.status, paced.stderr).toBe(0);
    expect(JSON.parse(paced.stdout)).toMatchObject({ configured: true, requested_language: 'zh-CN',
      pace: expect.stringContaining('so a 5 s scene holds about 20 characters') });
    expect(paced.stdout).not.toContain('never-dispatched-secret');
    expect(JSON.parse(invoke(['speech-capabilities']).stdout)).not.toHaveProperty('pace');
    const short = invoke(['narration', 'fit', '--text', 'hello there', '--target', '10', '--measured', '1']);
    expect(short.status, short.stderr).toBe(0);
    expect(JSON.parse(short.stdout)).toMatchObject({ status: 'under', fillLimitReached: false });
    const capped = invoke(['narration', 'fit', '--text', 'hello there', '--target', '10', '--measured', '1', '--fills', '2']);
    expect(JSON.parse(capped.stdout)).toMatchObject({ status: 'under', fillLimitReached: true,
      timingAction: "This is the audio's real length. Keep this audio and the scene's planned length; do not generate this line again." });
    expect(invoke(['narration', 'fit', '--text', 'hello', '--target', '10', '--measured', '1', '--fills', '1.5']).status).not.toBe(0);
    const inline = invoke(['narration', 'timing', '--input', '{"duration_sec":30,"segments":[]}']);
    expect(inline.status).toBe(1);
    expect(JSON.parse(inline.stdout)).toMatchObject({ ok: false, errorCode: 'E_STORYBOARD_TIMING_INPUT' });
    expect(inline.stdout).toContain('Write the JSON to a file in the production');
    expect(inline.stdout).toContain('run it again');
  });

  it('doctor reports the local toolchain is ready', () => {
    const r = ovs(['doctor']);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(true);
    expect(j.binaries.ffmpeg).toBeTruthy();
    expect(j.binaries.ffprobe).toBeTruthy();
  });

  it('lists and installs the skill pack', () => {
    expect(ovs(['skills']).stdout).toContain('video-studio');
    const skillsDir = join(dir, 'skills');
    const r = ovs(['skills', '--install', '--target', 'claude', '--dir', skillsDir]);
    expect(r.status).toBe(0);
    expect(existsSync(join(skillsDir, 'video-router', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'video-studio', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(skillsDir, 'video-studio', 'references', 'timeline.md'))).toBe(true);
    const presets = join(skillsDir, 'frontend-design', 'references', 'design-presets');
    expect(existsSync(join(presets, 'blue-professional.md'))).toBe(true);
    expect(existsSync(join(presets, 'LICENSE-hyperframes.txt'))).toBe(true);
  });

  it('resolves an exhausted preview revision without a second recovery form', () => {
    const r = ovs([
      'gate', 'transition',
      '--line', 'compose',
      '--artifact', 'composition',
      '--gate', 'preview',
      '--decision', 'revise',
      '--scope', 'visual_only',
      '--recovery', 'available',
    ]);
    expect(r.status).toBe(0);
    const transition = JSON.parse(r.stdout);
    expect(transition).toMatchObject({
      next_action: 'edit_and_restart_visual_qa',
      form: null,
      authorities: ['edit_current_artifact', 'restart_visual_qa_cycle'],
    });
    expect(transition.allowed_ops).toContain('ovs draft');
    expect(transition.prohibited_ops).toContain('emit_form');
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

  // A start 3.005s into a 4s clip returned a 0.97s piece as a plain success.
  it('reports the length a trim actually cut and why it is short', () => {
    const r = ovs(['edit', 'trim', src, '--start', '5', '--duration', '2', '--out', join(dir, 'tail.mp4')]);
    expect(r.status, r.stderr).toBe(0);
    const result = JSON.parse(r.stdout);
    expect(result.duration_sec).toBeLessThan(1.1);
    expect(result.warning).toContain('not the 2.00s asked for');
    expect(result.warning).toContain('--start (start_sec) is a time inside the input');
  });

  // An op the call did not read was ignored, so reframe with a range reframed a whole podcast.
  it('refuses range options on edit ops that work on the whole input', () => {
    const ranged = ovs(['edit', 'reframe', src, '--start', '10.7', '--duration', '11.5', '--aspect', '9:16', '--out', join(dir, 'tall-range.mp4')]);
    expect(ranged.status).not.toBe(0);
    expect(ranged.stderr).toContain('reframe does not take --start or --duration: it works on the whole input. Cut the part you want with `ovs edit trim` first, then run reframe on that file.');
    expect(existsSync(join(dir, 'tall-range.mp4'))).toBe(false);
    const startOnly = ovs(['edit', 'burnsubs', src, '--start', '2', '--srt', join(dir, 'x.srt'), '--out', join(dir, 'subs.mp4')]);
    expect(startOnly.stderr).toContain('burnsubs does not take --start: it works on the whole input.');
    const frame = ovs(['edit', 'extract-frame', src, '--start', '1', '--at', '1', '--out', join(dir, 'frame.png')]);
    expect(frame.status).not.toBe(0);
    expect(frame.stderr).toContain('extract-frame takes --at, not --start.');
  });

  // Runs passed a path list where JSON was asked for, or a path from the wrong folder,
  // then reported the edit tool as broken and stopped.
  it('says how to correct a JSON option or an input path the call got wrong', () => {
    const segments = ovs(['edit', 'mix', '--base', src, '--segments', 'voice/1.mp3,voice/2.mp3', '--out', join(dir, 'out.mp4')]);
    expect(segments.status).not.toBe(0);
    expect(segments.stderr).toContain('--segments is not valid JSON');
    expect(segments.stderr).toContain(`'[{"path": "voice/1.mp3", "start_sec": 0}]'`);
    expect(segments.stderr).toContain('run it again');
    const plan = ovs(['edit', 'reframe', src, '--aspect', '9:16', '--mode', 'crop', '--plan', 'not json', '--out', join(dir, 'tall.mp4')]);
    expect(plan.stderr).toContain('--plan is not valid JSON');
    expect(plan.stderr).not.toContain('voice/1.mp3');
    const missing = ovs(['edit', 'probe', 'project/media/nothing-here.mp4']);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain('input is not a file');
    expect(missing.stderr).toContain(`Paths are read from ${process.cwd()}`);
    expect(missing.stderr).toContain('check the name with ls and run it again');
  });

  it('reframes a clip to a portrait canvas while keeping its timeline and audio', async () => {
    const output = join(dir, 'portrait.mp4');
    const r = ovs(['edit', 'reframe', src, '--width', '180', '--height', '320', '--out', output]);
    expect(r.status, r.stderr).toBe(0);
    const probe = ovs(['edit', 'probe', output]);
    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout)).toMatchObject({ width: 180, height: 320, has_audio: true });
    expect(JSON.parse(probe.stdout).duration).toBeCloseTo(6, 0);
    expect(await mcpToolNames()).toContain('edit_reframe');
  });

  it('scores footage quality over real ffmpeg', () => {
    const r = ovs(['quality', src]);
    expect(r.status).toBe(0);
    const j = JSON.parse(r.stdout);
    expect(typeof j.score).toBe('number');
    expect(j.durationSec).toBeGreaterThan(4);
  });

  it('does not expose the retired local OCR command', () => {
    const r = ovs(['ocr', src]);
    expect(r.status).not.toBe(0);
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

  it('promise-check --video reports delivered-file errors on the public CLI', () => {
    const planPath = join(dir, 'delivery-plan.json');
    writeFileSync(planPath, JSON.stringify({ aspect: '9:16', total_target_sec: 8, language: 'en', delivery_promise: { type: 'motion_led', source_required: false, motion_min_ratio: 0 }, segments: [{ id: 's1', layer: 'primary', source: 'provided', spec: { kind: 'video' }, target_sec: 8, order: 1 }], tracks: {} }));
    const result = ovs(['plan', 'promise-check', planPath, '--video', src]);
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.verdict).toBe('fail');
    expect(report.delivery.issues.map((issue: { code: string }) => issue.code)).toEqual(expect.arrayContaining(['DELIVERY_DURATION_DRIFT', 'DELIVERY_ASPECT_MISMATCH']));
  });

  it('mcp server lists its tools over stdio', async () => {
    const names = await mcpToolNames();
    expect(names.length).toBeGreaterThan(20);
    expect(names).toContain('edit_trim');
    expect(names).toContain('plan_promise_check');
    expect(names).toContain('gate_transition');
    for (const name of ['timeline_prepare','timeline_status','timeline_check','timeline_snapshot','timeline_render','timeline_ship','timeline_import','analyze_phrases','analyze_beats','analyze_activity','edit_select','narration_timing','image_prepare','video_models','video_params']) expect(names).toContain(name);
    expect(names).not.toContain('ocr');
  }, 30_000);
});
