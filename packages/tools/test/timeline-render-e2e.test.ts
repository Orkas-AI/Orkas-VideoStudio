import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveFfmpegTools } from '@orkas/video-studio-core';
import { checkTimeline, renderTimeline } from '../src/composition/timeline-actions.js';
import { resolveHyperframesInvocation } from '../src/hyperframes/client.js';
import { createChromiumResolver, startChromium } from '../../../eval/video/chromium.mjs';
const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));

if (process.platform === 'darwin' && process.env.OVS_E2E === '1') {
  it('scores a temporary direct-edit delivery with Chromium unavailable and attributes an actual browser request separately', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-eval-runtime-test-')));
    const bin = join(root, 'bin');
    const out = join(root, 'runs');
    const calls = join(root, 'hyperframes-calls');
    mkdirSync(bin);
    try {
      const hyperframes = join(bin, 'hyperframes');
      writeFileSync(hyperframes, `#!${process.execPath}
const fs = require('node:fs');
const command = process.argv[2];
fs.appendFileSync(${JSON.stringify(calls)}, command + '\\n');
if (command !== 'transcribe') process.exit(1);
console.log(JSON.stringify({ words: [{ text: '测试', start: 0, end: 0.5 }] }));
`, { mode: 0o700 });
      writeFileSync(join(bin, 'codex'), `#!${process.execPath}
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readdirSync } = require('node:fs');
const { basename, dirname, join } = require('node:path');
if (process.argv[2] === 'login') process.exit(0);
console.log(JSON.stringify({ type: 'thread.started', thread_id: 'runtime-fixture' }));
const browser = basename(dirname(process.cwd())) === 'talking-head';
const production = browser ? null : mkdtempSync(${JSON.stringify(join(root, 'production-'))});
const tool = browser ? process.env.HYPERFRAMES_BROWSER_PATH : 'ovs';
const args = browser ? ['--headless', '--dump-dom', 'data:text/html,probe']
  : ['timeline', 'ship', '--production', production, '--input', join('attachments', readdirSync('attachments').find(name => name.endsWith('.mp4')))];
const result = spawnSync(tool, args, { encoding: 'utf8', timeout: 15000 });
const command = browser ? tool : 'ovs timeline ship --production ' + production;
console.log(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command, exit_code: result.status, aggregated_output: result.stdout } }));
if (!browser && (result.status !== 0 || JSON.parse(result.stdout).ok !== true)) process.exit(2);
console.log(JSON.stringify({ type: 'turn.completed' }));
`, { mode: 0o700 });
      const launcher = fileURLToPath(new URL('../../../eval/video/run.mjs', import.meta.url));
      const ids = ['retake-cleanup', 'talking-head'];
      const result = spawnSync(process.execPath, [launcher, ...ids.flatMap(id => ['--case', id]), '--output-dir', out], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, OVS_HYPERFRAMES_BIN: hyperframes, OVS_EVAL_ASR_MODEL: 'base' },
        encoding: 'utf8', timeout: 90_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(1);
      const folder = join(out, readdirSync(out)[0]);
      const [cleanup, talking] = ids.map(id => JSON.parse(readFileSync(join(folder, id, 'result.json'), 'utf8')));
      expect(cleanup.result).toBe('failed');
      expect(cleanup.turns).toMatchObject([{ completed: true, expired: false }]);
      const [delivered] = cleanup.turns[0].versions;
      expect(delivered).toMatchObject({ temporary: true, file: 'turn-1/version-1.mp4' });
      expect(readFileSync(join(folder, 'retake-cleanup', delivered.file)).byteLength).toBeGreaterThan(0);
      expect(cleanup.checks).toContainEqual({ id: 'delivered', pass: true });
      expect(cleanup.chromiumRuntime).toEqual({ requests: 0, unavailable: 0 });
      expect(talking.result).toBe('environment-blocked');
      expect(talking.turns).toMatchObject([{ completed: true, expired: false }]);
      expect(talking.chromiumRuntime).toEqual({ requests: 1, unavailable: 1 });
      expect(cleanup.asrReadiness).toMatchObject({ words: 1 });
      expect(talking.asrReadiness).toMatchObject({ seconds: 0, words: 1, reused: true });
      expect(readFileSync(calls, 'utf8').trim().split('\n')).toEqual(['transcribe', 'browser']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 100_000);

  it('renders visible frames with the evaluation browser and confines file reads to the case', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-chromium-test-')));
    const cwd = join(root, 'workspace');
    const bin = join(root, 'bin');
    mkdirSync(cwd);
    mkdirSync(bin);
    writeFileSync(join(cwd, 'input.html'), '<p>workspace test marker</p>');
    writeFileSync(join(root, 'outside.html'), '<p>outside test marker</p>');
    symlinkSync(join(root, 'outside.html'), join(cwd, 'linked.html'));
    let browser;
    try {
      const resolveBinary = createChromiumResolver(() => resolveHyperframesInvocation('browser', ['ensure']));
      const chromium = await startChromium({ cwd, bin, resolveBinary });
      browser = chromium;
      const dump = (file: string) => promisify(execFile)(chromium.executable,
        ['--headless', '--no-sandbox', '--disable-gpu', '--dump-dom', pathToFileURL(join(cwd, file)).href],
        { cwd, timeout: 15_000 });
      expect((await dump('input.html')).stdout).toContain('<p>workspace test marker</p>');
      expect((await dump('linked.html')).stdout).not.toContain('outside test marker');

      writeFileSync(join(cwd, 'index.html'), `<!doctype html><html><head><style>
        body { margin: 0; } main { width: 160px; height: 96px; background: #e82919; }
        </style></head><body><main data-composition-id="main" data-start="0"
        data-duration="1" data-width="160" data-height="96" data-no-timeline></main></body></html>`);
      const video = join(cwd, 'render.mp4');
      await promisify(execFile)(process.execPath, [cli, 'render', cwd, '--out', video, '--quality', 'draft'],
        { cwd, env: { ...process.env, ...chromium.env }, timeout: 90_000 });
      const frame = spawnSync(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-i', video, '-vf', 'scale=1:1',
        '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'], { timeout: 10_000 });
      expect(frame.status, String(frame.stderr)).toBe(0);
      expect(frame.stdout.length).toBe(3);
      expect(frame.stdout[0]).toBeGreaterThan(175);
      expect(frame.stdout[1]).toBeLessThan(80);
      expect(frame.stdout[2]).toBeLessThan(80);
    } finally {
      await browser?.close();
      rmSync(root, { recursive: true, force: true });
    }
  }, 135_000);
}

it('renders and delivers the current scene timeline through the public CLI, then rejects stale output after a local revision', () => {
  const root = mkdtempSync(join(process.env.OVS_VIDEO_EVIDENCE_DIR ?? tmpdir(), 'ovs-v3-'));
  const project = join(root, 'videos/main'); mkdirSync(project, { recursive: true }); mkdirSync(join(root, 'media'));
  let step=0;
  const run = (bin: string, args: string[], status = 0) => {
    const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
    const prefix=join(root, `command-${step++}`); writeFileSync(prefix+'-stdout.log',r.stdout??'');writeFileSync(prefix+'-stderr.log',r.stderr??'');
    const lines=(r.stderr??'').split(/\r?\n/).filter(Boolean);
    if(bin===process.execPath && args[1]==='timeline' && args[2]==='render') {
      for(const line of lines) expect(line.startsWith('[INFO] ')||line.startsWith('[hyperframes] browserGpuMode '),'unclassified renderer stderr').toBe(true);
      expect(r.stderr).not.toContain('Sub-composition timelines not registered');
    }
    else expect(lines,'unexpected command stderr').toEqual([]);
    expect(r.error).toBeUndefined(); expect(r.status, (r.stdout ?? '') + (r.stderr ?? '')).toBe(status); return r.stdout;
  };
  const ovs = (args: string[], status = 0) => JSON.parse(run(process.execPath, [cli, 'timeline', ...args, '--production', root], status));
  try {
    run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', join(root, 'media/music.wav')]);
    // Two distinct image scenes catch parent-relative image timing and flat
    // track collisions; the white marker cannot come from the page background.
    for (const [i, color] of ['0xc03030', '0x30a030'].entries()) run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=640x360`, '-vf', 'drawbox=x=250:y=20:w=20:h=30:color=white:t=fill', '-frames:v', '1', '-threads', '1', join(root, `media/photo-${i}.png`)]);
    // The final scene consumes real footage at a nonzero source in-point.
    run(resolveFfmpegTools().ffmpeg, ['-v','error','-y','-f','lavfi','-i','color=c=yellow:s=640x360:r=24:d=0.25','-f','lavfi','-i','color=c=0x3030c0:s=640x360:r=24:d=1.25','-filter_complex',"[1:v]format=gbrp,geq=r='48+207*between(X,250+N*4,270+N*4)*between(Y,20,50)':g='48+207*between(X,250+N*4,270+N*4)*between(Y,20,50)':b='192+63*between(X,250+N*4,270+N*4)*between(Y,20,50)'[moving];[0:v][moving]concat=n=2:v=1:a=0[v]",'-map','[v]','-c:v','libx264','-pix_fmt','yuv420p',join(root,'media/footage.mp4')]);
    writeFileSync(join(root, 'assets.json'), JSON.stringify({ assets: [{ id: 'bed', kind: 'audio', label: 'Music', path: 'media/music.wav', origin: 'upload' }, { id:'footage',kind:'video',label:'Blue footage',path:'media/footage.mp4',origin:'upload' }, ...[0, 1].map(i => ({ id: `photo-${i}`, kind: 'image', label: `Photo ${i}`, path: `media/photo-${i}.png`, origin: 'upload' }))] }));
    const manifest = { schema_version: 3, id: 'main', label: 'Three scenes', canvas: { width: 640, height: 360, fps: 24 }, tracks: [{ kind: 'music', asset: 'bed', volume: .4 }], captions: { enabled: true }, scenes: ['First', 'Second', 'Third'].map((title, i) => ({ id: `s${i}`, clips: [{ id: `source-${i}`, asset: i === 2 ? 'footage' : `photo-${i}`, in: i === 2 ? .25 : 0, dur: 1 }], text: { title: { value: title } }, narration: { text: `Caption ${title}` } })) };
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    expect(ovs(['prepare']).ok).toBe(true);
    let page = readFileSync(join(project, 'index.html'), 'utf8');
    page = page.replace('</head>', '<style>.scene-background{display:none}h1{font-size:64px!important;background:rgba(0,0,0,.78);width:max-content;padding:4px 12px}.scene-content{padding:50px!important}</style></head>');
    const motionScenes = [0, 2];
    for (const i of motionScenes) page = page.replace(new RegExp(`(<section[^>]*data-scene-id="s${i}"[^>]*>)`), '$1<i class="motion-probe" style="position:absolute;left:40px;top:210px;width:30px;height:30px;background:var(--probe-color, black);z-index:2"></i>');
    const script = join(project, 'color.js');
    writeFileSync(script, 'document.documentElement.style.setProperty("--probe-color", "white");');
    page = page.replace('</body>', `<script src="./color.js"></script><script>${motionScenes.map(i => `// ORKAS-SCENE-MOTION-BEGIN:s${i}\nwindow.__timelines.s${i}=gsap.timeline({paused:true}).to('#scene-s${i} .motion-probe',{x:120,duration:.8,ease:'none'},0);\n// ORKAS-SCENE-MOTION-END:s${i}`).join('\n')}</script></body>`);
    writeFileSync(join(project, 'index.html'), page);
    expect(ovs(['check']).ok).toBe(true);
    const preview=ovs(['snapshot','--out',join(root,'preview.png')]);expect(preview.frame_paths.length).toBeGreaterThan(1);
    const video = join(root, 'finished.mp4');
    const rendered = ovs(['render', '--out', video]); expect(rendered.ok).toBe(true);
    expect(ovs(['status']).stale).toBe(false);
    const probe = JSON.parse(run(process.execPath, [cli, 'edit', 'probe', video])); expect(probe.video_duration).toBeCloseTo(3, 1); expect(probe.has_audio).toBe(true);
    run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-i', video, '-f', 'null', '-']);
    const frame = (t: number) => {
      const result = spawnSync(resolveFfmpegTools().ffmpeg, ['-v','error','-ss',String(t),'-i',video,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-'], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
      expect(result.stderr.toString()).toBe(''); expect(result.status, result.stderr?.toString()).toBe(0); expect(result.stdout.length).toBe(640*360*3); return result.stdout;
    };
    const white = (bytes: Buffer, x0: number, y0: number, x1: number, y1: number) => {
      let n = 0;
      for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) { const k=(y*640+x)*3; if(bytes[k]>220&&bytes[k+1]>220&&bytes[k+2]>220)n++; }
      return n;
    };
    for (let i=0;i<3;i++) {
      const early=frame(i+.15), late=frame(i+.75), pixel=(10*640+10)*3;
      expect(late[pixel+i]).toBeGreaterThan(140);
      expect(late[pixel+i]).toBeGreaterThan(late[pixel+(i+1)%3]+60);
      expect(white(late, 100, 288, 540, 320), `caption pixels in scene ${i}`).toBeGreaterThan(50);
      if (motionScenes.includes(i)) {
        expect(white(early, 40, 210, 110, 242)).toBeGreaterThan(300);
        expect(white(late, 40, 210, 110, 242)).toBeLessThan(30);
        expect(white(late, 130, 210, 200, 242)).toBeGreaterThan(300);
      }
      if (i < 2) { expect(white(early,250,20,270,50)).toBeGreaterThan(300); expect(white(late,250,20,270,50)).toBeGreaterThan(300); }
      if(i===2) { expect(white(early,250,20,295,51)).toBeGreaterThan(300);expect(white(late,250,20,295,51)).toBeLessThan(50);expect(white(late,310,20,360,51)).toBeGreaterThan(300); }
      const sound = spawnSync(resolveFfmpegTools().ffmpeg, ['-hide_banner','-ss',String(i+.25),'-i',video,'-t','0.4','-vn','-af','volumedetect','-f','null','-'], { encoding:'utf8',timeout:30_000,maxBuffer:64*1024 });
      writeFileSync(join(root,`scene-${i}-audio.log`),sound.stderr);expect(sound.status).toBe(0); const volume=sound.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/); expect(volume).not.toBeNull(); expect(Number(volume![1])).toBeGreaterThan(-50);
    }
    const version = ovs(['ship', '--video-id', 'main', '--input', video]); expect(version.ok).toBe(true); expect(version.version.path).toContain('versions/');
    writeFileSync(script, 'document.documentElement.style.setProperty("--probe-color", "blue");');
    expect(ovs(['status']).stale).toBe(true);
    const rejected = ovs(['ship', '--video-id', 'main', '--input', video], 1); expect(rejected.ok).toBe(false); expect(rejected.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DELIVERY_TIMELINE_CHANGED' })]));
  } finally { if (!process.env.OVS_VIDEO_EVIDENCE_DIR) rmSync(root, { recursive: true, force: true }); }
}, 180_000);

// screen-demo.js moves a scene's <img data-clip> screenshots into its own box. HyperFrames must
// still show each screenshot in its own window, under the helper's pointer, in check and render.
it.runIf(process.env.OVS_E2E === '1')('shows each screenshot in its own window inside the screen-demo box, with the pointer over it', async () => {
  const root = mkdtempSync(join(process.env.OVS_VIDEO_EVIDENCE_DIR ?? tmpdir(), 'ovs-screen-demo-'));
  const project = join(root, 'videos/main'); mkdirSync(project, { recursive: true }); mkdirSync(join(root, 'media'));
  const ffmpeg = resolveFfmpegTools().ffmpeg;
  const run = (args: string[]) => {
    const r = spawnSync(ffmpeg, ['-v', 'error', '-nostdin', ...args], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    expect(r.status, String(r.stderr)).toBe(0); return r.stdout;
  };
  try {
    // Two screens, red then green, each with a white field near its top.
    for (const [name, color] of [['search', '0xc03030'], ['results', '0x30a030']]) run(['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=640x360`, '-vf', 'drawbox=x=40:y=24:w=560:h=40:color=white:t=fill', '-frames:v', '1', join(root, `media/${name}.png`)]);
    writeFileSync(join(root, 'assets.json'), JSON.stringify({ assets: ['search', 'results'].map(name => ({ id: name, kind: 'image', label: name, path: `media/${name}.png`, origin: 'upload' })) }));
    writeFileSync(join(project, 'manifest.json'), JSON.stringify({ schema_version: 3, id: 'main', label: 'Screen demo', canvas: { width: 640, height: 360, fps: 24 },
      scenes: [{ id: 'find', clips: [{ id: 'search-shot', asset: 'search', in: 0, dur: 1 }, { id: 'results-shot', asset: 'results', in: 0, dur: 1 }] }] }));
    writeFileSync(join(project, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8">
<script src="./assets/vendor/gsap.min.js"></script><script src="./assets/vendor/screen-demo.js"></script>
<style>html,body{width:640px;height:360px;margin:0;overflow:hidden;background:#000}main{position:relative;width:100%;height:100%;overflow:hidden}section{position:absolute;inset:0}.demo{position:absolute;left:0;top:0;width:640px;height:360px}</style>
</head><body><main data-composition-id="main">
<section data-scene-id="find"><div class="demo"><img data-clip="search-shot" alt=""><img data-clip="results-shot" alt=""></div></section>
</main><script>
window.__timelines = {};
// ORKAS-SCENE-MOTION-BEGIN:find
const tl = window.__timelines.find = gsap.timeline({ paused: true });
ScreenDemo('[data-scene-id="find"] .demo', tl, { frame: 'none', follow: false, pointer: 'arrow' }).tap(0.5, 0.5, 0.5);
// ORKAS-SCENE-MOTION-END:find
</script></body></html>`);
    // The runtime check only: this page declares no design contract, which is a separate gate.
    const checked = await checkTimeline({ production: root }, { design: false }) as { ok: boolean; issues: Array<{ code: string }>; check?: unknown };
    expect(checked.ok, JSON.stringify(checked.check ?? checked.issues)).toBe(true);
    expect(readFileSync(join(project, 'assets/vendor/screen-demo.js'), 'utf8')).toContain('window.ScreenDemo');
    expect(checked.issues.map(issue => issue.code)).not.toContain('TIMELINE_SCREEN_WITHOUT_STEP');
    const video = join(root, 'demo.mp4');
    expect((await renderTimeline({ production: root, output: video })).ok).toBe(true);
    const frame = (t: number) => run(['-ss', String(t), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    const at = (bytes: Buffer, x: number, y: number) => [...bytes.subarray((y * 640 + x) * 3, (y * 640 + x) * 3 + 3)];
    const dark = (bytes: Buffer, x0: number, y0: number, x1: number, y1: number) => {
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const [r, g, b] = at(bytes, x, y); if (r < 60 && g < 60 && b < 60) n++; }
      return n;
    };
    const first = frame(0.75), second = frame(1.5);
    // The first screenshot in its window, the second in its own, both filling the box.
    expect(at(first, 10, 300)[0]).toBeGreaterThan(150); expect(at(first, 10, 300)[1]).toBeLessThan(90);
    expect(at(second, 10, 300)[1]).toBeGreaterThan(120); expect(at(second, 10, 300)[0]).toBeLessThan(90);
    expect(Math.min(...at(first, 320, 40))).toBeGreaterThan(200);
    // The pointer arrived at the middle by 0.5s and stays over the screen.
    expect(dark(first, 310, 170, 380, 250)).toBeGreaterThan(20);
    expect(dark(second, 310, 170, 380, 250)).toBeGreaterThan(20);
  } finally { if (!process.env.OVS_VIDEO_EVIDENCE_DIR) rmSync(root, { recursive: true, force: true }); }
}, 180_000);
