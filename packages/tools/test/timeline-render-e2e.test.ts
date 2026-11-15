import { expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveFfmpegTools } from '@orkas/video-studio-core';
const cli = fileURLToPath(new URL('../../cli/dist/index.js', import.meta.url));
it('renders and delivers the current scene timeline through the public CLI, then rejects stale output after a local revision', () => {
  const root = mkdtempSync(join(process.env.OVS_VIDEO_EVIDENCE_DIR ?? tmpdir(), 'ovs-v3-'));
  const project = join(root, 'videos/main'); mkdirSync(project, { recursive: true }); mkdirSync(join(root, 'media'));
  let step=0;
  const run = (bin: string, args: string[], status = 0) => {
    const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
    const prefix=join(root, `command-${step++}`); writeFileSync(prefix+'-stdout.log',r.stdout??'');writeFileSync(prefix+'-stderr.log',r.stderr??'');
    const lines=(r.stderr??'').split(/\r?\n/).filter(Boolean);
    if(bin===process.execPath && args[1]==='timeline' && args[2]==='render') { for(const line of lines) expect(line.startsWith('[INFO] ')||line.startsWith('[hyperframes] browserGpuMode '),'unclassified renderer stderr').toBe(true); }
    else expect(lines,'unexpected command stderr').toEqual([]);
    expect(r.error).toBeUndefined(); expect(r.status, (r.stdout ?? '') + (r.stderr ?? '')).toBe(status); return r.stdout;
  };
  const ovs = (args: string[], status = 0) => JSON.parse(run(process.execPath, [cli, 'timeline', ...args, '--production', root], status));
  try {
    run(resolveFfmpegTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', join(root, 'media/music.wav')]);
    // The final scene consumes real footage at a nonzero source in-point.
    run(resolveFfmpegTools().ffmpeg, ['-v','error','-y','-f','lavfi','-i','color=c=yellow:s=640x360:r=24:d=0.25','-f','lavfi','-i','color=c=0x3030c0:s=640x360:r=24:d=1.25','-filter_complex',"[1:v]format=gbrp,geq=r='48+207*between(X,250+N*4,270+N*4)*between(Y,20,50)':g='48+207*between(X,250+N*4,270+N*4)*between(Y,20,50)':b='192+63*between(X,250+N*4,270+N*4)*between(Y,20,50)'[moving];[0:v][moving]concat=n=2:v=1:a=0[v]",'-map','[v]','-c:v','libx264','-pix_fmt','yuv420p',join(root,'media/footage.mp4')]);
    writeFileSync(join(root, 'assets.json'), JSON.stringify({ assets: [{ id: 'bed', kind: 'audio', label: 'Music', path: 'media/music.wav', origin: 'upload' }, { id:'footage',kind:'video',label:'Blue footage',path:'media/footage.mp4',origin:'upload' }] }));
    const manifest = { schema_version: 3, id: 'main', label: 'Three scenes', canvas: { width: 640, height: 360, fps: 24 }, tracks: [{ kind: 'music', asset: 'bed', volume: .4 }], captions: { enabled: true }, scenes: ['First', 'Second', 'Third'].map((title, i) => ({ id: `s${i}`, ...(i===2 ? { clips:[{id:'source',asset:'footage',in:.25,dur:1}] } : { duration:1 }), text: { title: { value: title } }, narration: { text: `Caption ${title}` } })) };
    writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    expect(ovs(['prepare']).ok).toBe(true);
    let page = readFileSync(join(project, 'index.html'), 'utf8');
    page = page.replace('</head>', '<style>#scene-s0 .scene-background{background:#c03030}#scene-s1 .scene-background{background:#30a030}#scene-s2 .scene-background{display:none}h1{font-size:64px!important;background:rgba(0,0,0,.78);width:max-content;padding:4px 12px}.scene-content{padding:50px!important}</style></head>');
    for (let i = 0; i < 3; i++) page = page.replace(new RegExp(`(<section[^>]*data-scene-id="s${i}"[^>]*>)`), '$1<i class="motion-probe" style="position:absolute;left:40px;top:210px;width:30px;height:30px;background:white;z-index:2"></i>');
    page = page.replace('</body>', `<script>${[0,1,2].map(i => `// ORKAS-SCENE-MOTION-BEGIN:s${i}\nwindow.__timelines.s${i}=gsap.timeline({paused:true}).to('#scene-s${i} .motion-probe',{x:120,duration:.8,ease:'none'},0);\n// ORKAS-SCENE-MOTION-END:s${i}`).join('\n')}</script></body>`);
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
      expect(white(early, 40, 210, 110, 242)).toBeGreaterThan(300);
      expect(white(late, 40, 210, 110, 242)).toBeLessThan(30);
      expect(white(late, 130, 210, 200, 242)).toBeGreaterThan(300);
      if(i===2) { expect(white(early,250,20,295,51)).toBeGreaterThan(300);expect(white(late,250,20,295,51)).toBeLessThan(50);expect(white(late,310,20,360,51)).toBeGreaterThan(300); }
      const sound = spawnSync(resolveFfmpegTools().ffmpeg, ['-hide_banner','-ss',String(i+.25),'-i',video,'-t','0.4','-vn','-af','volumedetect','-f','null','-'], { encoding:'utf8',timeout:30_000,maxBuffer:64*1024 });
      writeFileSync(join(root,`scene-${i}-audio.log`),sound.stderr);expect(sound.status).toBe(0); const volume=sound.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/); expect(volume).not.toBeNull(); expect(Number(volume![1])).toBeGreaterThan(-50);
    }
    const version = ovs(['ship', '--video-id', 'main', '--input', video]); expect(version.ok).toBe(true); expect(version.version.path).toContain('versions/');
    manifest.scenes[1].text.title.value = 'Revised'; writeFileSync(join(project, 'manifest.json'), JSON.stringify(manifest));
    expect(ovs(['status']).stale).toBe(true);
    const rejected = ovs(['ship', '--video-id', 'main', '--input', video], 1); expect(rejected.ok).toBe(false); expect(rejected.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DELIVERY_TIMELINE_CHANGED' })]));
  } finally { if (!process.env.OVS_VIDEO_EVIDENCE_DIR) rmSync(root, { recursive: true, force: true }); }
}, 180_000);
