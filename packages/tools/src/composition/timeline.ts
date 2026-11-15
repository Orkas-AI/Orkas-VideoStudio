import * as fs from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  captionCues, compileVideoPage, deriveVideoTimeline, findElementEnd, parseHtmlStructure,
  parseVideoManifest, resolveSceneText, resolveFfmpegTools, runOk, timelineAudioTracks,
  validateVideoTimeline, VideoAssetLedgerSchema, VideoProductSchema,
  type CompositionManifest, type VideoAssetRecord,
} from '@orkas/video-studio-core';
import { probeMedia } from '../edit/edit.js';
import { buildCompositionScaffold, ensureGsapVendor, reconcileCompositionHtml } from './scaffold.js';

const MAX_JSON = 1024 * 1024;
export async function readTimelineJson(file: string, fallback?: unknown): Promise<unknown> {
  try {
    if (!(await fs.stat(file)).isFile() || (await fs.stat(file)).size > MAX_JSON) throw new Error('Project JSON exceeds 1 MiB or is not a file.');
    const bytes = await fs.readFile(file);
    if (bytes.length > MAX_JSON) throw new Error('Project JSON exceeds 1 MiB.');
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function timelineDigest(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
export async function writeTimelineJson(file: string, data: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
export async function withTimelineLock<T>(production: string, work: (root: string) => Promise<T>): Promise<T> {
  await fs.mkdir(production, { recursive: true });
  const root = await fs.realpath(resolve(production));
  const lock = join(root, '.ovs-timeline.lock');
  const handle = await fs.open(lock, 'wx').catch(() => { throw new Error('Another timeline operation owns this production; wait for it to finish.'); });
  try { return await work(root); }
  finally { await handle.close(); await fs.rm(lock, { force: true }); }
}
export function timelineContained(root: string, file: string): string {
  const rel = relative(root, file);
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Asset resolves outside its production.');
  return file;
}
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60) || 'asset';

export async function importTimelineAssets(p: { production: string; inputs: string[] }) {
  if (!p.inputs.length || p.inputs.length > 100) throw new Error('Import requires 1–100 files.');
  return withTimelineLock(p.production, async root => {
    const ledger = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] }));
    const assets: VideoAssetRecord[] = [];
    const media = join(root, 'media'); await fs.mkdir(media, { recursive: true });
    timelineContained(root, await fs.realpath(media));
    const created: string[] = [];
    try {
    for (const input of p.inputs) {
      const file = await fs.realpath(resolve(input));
      if (!(await fs.stat(file)).isFile()) throw new Error('Import input must be a regular file.');
      const extension = extname(file).toLowerCase();
      const kind = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'].includes(extension) ? 'image' : ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(extension) ? 'video' : ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus'].includes(extension) ? 'audio' : null;
      if (!kind) throw new Error('Import needs a supported image, video or audio file.');
      const id = `${slug(basename(file, extension))}-${randomUUID().slice(0, 8)}`;
      const destination = join(media, `${id}${extension}`);
      await fs.copyFile(file, destination, constants.COPYFILE_EXCL);
      created.push(destination);
      const row: VideoAssetRecord = { id, kind, label: basename(file), path: relative(root, destination).replaceAll('\\', '/'), origin: 'upload', sha256: await timelineDigest(destination) };
      if (kind !== 'image') { const measured = await probeMedia(destination); if (!(measured.duration > 0)) throw new Error('Imported media has no measurable duration.'); row.duration = measured.duration; }
      ledger.assets.push(row); assets.push(row);
    }
    await writeTimelineJson(join(root, 'assets.json'), ledger);
    return { ok: true, assets };
    } catch (error) { await Promise.all(created.map(file => fs.rm(file, { force: true }))); throw error; }
  });
}

/** Prepare a self-contained HyperFrames project from the scene timeline. */
export async function prepareTimeline(p: { production: string; video_id?: string; signal?: AbortSignal }) {
  const videoId = p.video_id ?? 'main';
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(videoId)) throw new Error('Invalid video id.');
  return withTimelineLock(p.production, async root => {
    const project = timelineContained(root, await fs.realpath(join(root, 'videos', videoId)));
    const parsed = parseVideoManifest(await readTimelineJson(join(project, 'manifest.json')));
    if (!parsed.manifest) return { ok: false, project, issues: parsed.issues };
    const manifest = parsed.manifest;
    if (manifest.id !== videoId) throw new Error('Manifest id must match its video folder.');
    const assets = VideoAssetLedgerSchema.parse(await readTimelineJson(join(root, 'assets.json'), { assets: [] })).assets;
    if (new Set(assets.map(a => a.id)).size !== assets.length || assets.length > 1000) throw new Error('Asset ids must be unique, with at most 1000 records.');
    const productRaw = await readTimelineJson(join(root, 'product.json'), null);
    const product = productRaw === null ? null : VideoProductSchema.parse(productRaw);
    const paths = new Map<string, string>(), durations = new Map<string, number>(), hashes = new Map<string, string>();
    const referenced = new Set(manifest.scenes.flatMap(s => [...(s.clips ?? []).map(c => c.asset), ...(s.narration?.asset ? [s.narration.asset] : [])]).concat((manifest.tracks ?? []).map(t => t.asset)));
    const media = join(project, 'assets', 'media'); await fs.mkdir(media, { recursive: true }); timelineContained(root, await fs.realpath(media));
    for (const row of assets.filter(a => referenced.has(a.id))) {
      const source = timelineContained(root, await fs.realpath(resolve(root, row.path)));
      const sha = await timelineDigest(source); hashes.set(row.id, sha);
      const cached = join(media, `${row.id}-${sha}${extname(source).toLowerCase()}`);
      try { await fs.copyFile(source, cached, constants.COPYFILE_EXCL); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await timelineDigest(cached) !== sha) throw error; }
      if (await timelineDigest(cached) !== sha) throw new Error('An asset changed while it was being prepared; prepare it again.');
      paths.set(row.id, cached);
      if (row.kind !== 'image') durations.set(row.id, (await probeMedia(cached)).duration);
    }
    const issues = [...parsed.issues, ...validateVideoTimeline({ manifest, assets, product, mediaDurations: durations })];
    if (issues.some(i => i.severity === 'error')) return { ok: false, project, issues };
    const timeline = deriveVideoTimeline(manifest);
    const tracks = timelineAudioTracks({ manifest, timeline, resolve: id => paths.get(id)! });
    let audioSrc: string | undefined;
    if (tracks.length) {
      const key = createHash('sha256').update(JSON.stringify([tracks, [...hashes], timeline.durationSec])).digest('hex');
      const output = join(media, `mix-${key}.wav`);
      if (!(await fs.stat(output).catch(() => null))) {
        const temporary = `${output}.${randomUUID()}.wav`;
        const args = ['-y', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo:d=${timeline.durationSec}`];
        const filters: string[] = [], voices: string[] = [], beds: string[] = [];
        tracks.forEach((track, i) => {
          if (track.loop) args.push('-stream_loop', '-1');
          args.push('-i', track.absPath);
          const duration = track.durSec ?? (track.loop ? timeline.durationSec : Math.min(durations.get([...paths].find(([, path]) => path === track.absPath)?.[0] ?? '') ?? timeline.durationSec, timeline.durationSec - track.startSec));
          let chain = `[${i + 1}:a]atrim=start=${track.inSec ?? 0}:duration=${duration},asetpts=PTS-STARTPTS,volume=${track.volume}`;
          if (track.fadeInSec) chain += `,afade=t=in:st=0:d=${track.fadeInSec}`;
          if (track.fadeOutSec) chain += `,afade=t=out:st=${Math.max(0, duration - track.fadeOutSec)}:d=${track.fadeOutSec}`;
          chain += `,adelay=${Math.round(track.startSec * 1000)}:all=1[t${i}]`; filters.push(chain);
          (track.voice ? voices : beds).push(`[t${i}]`);
        });
        const labels = ['[0:a]'];
        if (voices.length) { filters.push(`${voices.join('')}amix=inputs=${voices.length}:normalize=0[voice]`); if (tracks.some(t => t.duck) && beds.length) { filters.push('[voice]asplit=2[voiceout][control]'); labels.push('[voiceout]'); } else labels.push('[voice]'); }
        if (beds.length) { filters.push(`${beds.join('')}amix=inputs=${beds.length}:normalize=0[bed]`); if (tracks.some(t => t.duck) && voices.length) { filters.push('[bed][control]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=300[ducked]'); labels.push('[ducked]'); } else labels.push('[bed]'); }
        filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,atrim=duration=${timeline.durationSec},loudnorm=I=-14:TP=-1:LRA=11,aresample=48000,aformat=channel_layouts=stereo[out]`);
        try {
          await runOk(resolveFfmpegTools().ffmpeg, [...args, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', String(timeline.durationSec), '-c:a', 'pcm_s16le', temporary], { signal: p.signal, timeoutMs: 600_000, maxBuffer: 1024 * 1024 });
          await fs.link(temporary, output);
        } finally { await fs.rm(temporary, { force: true }); }
      }
      audioSrc = relative(project, output).replaceAll('\\', '/');
    }
    const legacy: CompositionManifest = {
      schema_version: 2,
      composition: { id: manifest.id, width: manifest.canvas.width, height: manifest.canvas.height, fps: timeline.fps, duration: timeline.durationSec, language: manifest.canvas.language },
      scenes: timeline.scenes.map(s => ({ id: s.id, start: s.startSec, duration: s.durationSec, approved_copy: Object.values(resolveSceneText(manifest.scenes[s.index], product)), narration_refs: manifest.scenes[s.index].narration?.asset ? [relative(project, paths.get(manifest.scenes[s.index].narration!.asset!)!).replaceAll('\\', '/')] : [], narration_text: manifest.scenes[s.index].narration?.text, source_shots: [], roles: [] })),
      audio: { owner: audioSrc ? 'composition' : 'none', tracks: audioSrc ? [{ id: 'timeline-mix', kind: 'music', src: audioSrc, start: 0, duration: timeline.durationSec, volume: 1 }] : [] },
      art_direction: manifest.art_direction,
    };
    const statePath = join(project, '.ovs-timeline.json');
    if (await fs.stat(join(project, 'composition-manifest.json')).catch(() => null)) {
      if (!(await readTimelineJson(statePath, null))) throw new Error('An existing legacy manifest is independently owned; use another video folder.');
    }
    const htmlPath = join(project, 'index.html');
    const existingHtml = await fs.realpath(htmlPath).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
    if (existingHtml) { timelineContained(root, existingHtml); if ((await fs.stat(existingHtml)).size > 2 * 1024 * 1024) throw new Error('Authored HTML exceeds 2 MiB.'); }
    let html = await fs.readFile(htmlPath, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return ''; throw error; });
    if (html.length > 2 * 1024 * 1024) throw new Error('Authored HTML exceeds 2 MiB.');
    if (!html) {
      html = buildCompositionScaffold(legacy);
      for (const scene of manifest.scenes) html = html.replace(`<h1 id="title-${scene.id}" data-role="title">${escape(legacy.scenes.find(s => s.id === scene.id)!.approved_copy[0] || scene.id)}</h1>`, Object.keys(scene.text ?? {}).map(slot => `<h1 data-slot="${escape(slot)}"></h1>`).join(''));
    }
    html = html.replace(/<!-- OVS-TIMELINE-BEGIN -->[\s\S]*?<!-- OVS-TIMELINE-END -->/g, '').replace(/<style data-orkas-host>[\s\S]*?<\/style>/g, '');
    for (const tag of [...parseHtmlStructure(html).tags].reverse()) {
      if (tag.tagName !== 'video' || tag.attrs['data-clip'] === undefined) continue;
      const end = findElementEnd(html, tag)?.end;
      if (end) html = html.slice(0, tag.start) + '<img' + html.slice(tag.start + 6, tag.end) + html.slice(end);
    }
    // Removed scenes remain editable but must never be rendered.
    const active = new Set(manifest.scenes.map(s => s.id));
    for (const tag of [...parseHtmlStructure(html).tags].reverse()) {
      const id = tag.attrs['data-scene-id'];
      if (id === undefined) continue;
      let opening = html.slice(tag.start, tag.end).replace(/\sdata-orkas-hidden(?:="[^"]*")?/g, '');
      if (!active.has(id)) opening = opening.replace(/>$/, ' data-orkas-hidden>');
      html = html.slice(0, tag.start) + opening + html.slice(tag.end);
    }
    const compiled = compileVideoPage({ html, manifest, product, baseHref: '' });
    issues.push(...compiled.issues);
    if (issues.some(i => i.severity === 'error')) return { ok: false, project, issues };
    const reconciled = reconcileCompositionHtml(compiled.html, legacy);
    issues.push(...reconciled.issues);
    let next = reconciled.html;
    const edits: Array<{ start: number; end: number; text: string }> = [];
    const structure = parseHtmlStructure(next);
    for (const derived of timeline.scenes) {
      const section = structure.tags.find(t => t.attrs['data-scene-id'] === derived.id)!;
      const compositionId = `ovs-scene-${manifest.id}-${derived.id}`;
      const sectionAttrs = Object.entries(section.attrs).filter(([key]) => !['data-composition-id', 'data-width', 'data-height', 'data-fps'].includes(key)).map(([key, value]) => `${key}="${escape(value)}"`).join(' ');
      edits.push({ start: section.start, end: section.end, text: `<${section.tagName} ${sectionAttrs} data-composition-id="${compositionId}" data-width="${manifest.canvas.width}" data-height="${manifest.canvas.height}" data-fps="${timeline.fps}">` });
      for (const clip of derived.clips) {
        const tag = structure.tags.find(t => t.attrs['data-clip'] === clip.id);
        if (!tag) continue;
        const row = assets.find(a => a.id === clip.assetId)!;
        const src = relative(project, paths.get(row.id)!).replaceAll('\\', '/');
        const attrs = Object.entries(tag.attrs).filter(([k]) => !['src', 'data-start', 'data-duration', 'data-media-start', 'data-volume', 'class', 'muted', 'data-track-index', 'id'].includes(k)).map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
        const mediaTag = row.kind === 'video' ? 'video' : 'img';
        const text = `<${mediaTag} ${attrs} id="${escape(tag.attrs.id ?? `ovs-media-${derived.id}-${clip.id}`)}" class="${escape(tag.attrs.class ?? '')} clip" src="./${escape(src)}" data-start="${derived.startSec + clip.startFrame / timeline.fps}" data-duration="${clip.frameCount / timeline.fps}" data-media-start="${clip.inSec}" data-volume="0" data-track-index="${clip.overlay ? 3 : 2}"${row.kind === 'video' ? ' muted></video>' : '>'}`;
        edits.push({ start: tag.start, end: tag.tagName === 'video' ? findElementEnd(next, tag)?.end ?? tag.end : tag.end, text });
      }
    }
    for (const edit of edits.sort((a, b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.text + next.slice(edit.end);
    // Authoring uses scene ids; HyperFrames requires each registered key to
    // name a real composition. Adapt only marked scene scripts, preserving the
    // root timeline and scene-local time even when a scene is named "main".
    for (const scene of manifest.scenes) {
      const marker = `// ORKAS-SCENE-MOTION-BEGIN:${scene.id}`;
      const start = next.indexOf(marker), end = next.indexOf(`// ORKAS-SCENE-MOTION-END:${scene.id}`);
      if (start < 0 || end < start) continue;
      const body = next.slice(start + marker.length, end).replace(/\/\* OVS-SCENE-REGISTER-BEGIN \*\/[\s\S]*?\/\* OVS-SCENE-REGISTER-END \*\//g, '').replace(/window\.__timelines\b/g, 'window.__ovsSceneTimelines');
      const init = 'window.__ovsSceneTimelines=window.__ovsSceneTimelines||{};';
      const register = `/* OVS-SCENE-REGISTER-BEGIN */window.__timelines=window.__timelines||{};if(window.__ovsSceneTimelines[${JSON.stringify(scene.id)}])window.__timelines[${JSON.stringify(`ovs-scene-${manifest.id}-${scene.id}`)}]=window.__ovsSceneTimelines[${JSON.stringify(scene.id)}];/* OVS-SCENE-REGISTER-END */`;
      next = next.slice(0, start + marker.length) + '\n' + (body.includes(init) ? body.trim() : `${init}\n${body.trim()}`) + `\n${register}\n` + next.slice(end);
    }
    const motion = `<script>(()=>{window.__timelines=window.__timelines||{};const master=window.__timelines[${JSON.stringify(manifest.id)}]||gsap.timeline({paused:true});${timeline.scenes.map(s => `{const child=window.__ovsSceneTimelines&&window.__ovsSceneTimelines[${JSON.stringify(s.id)}];if(child){window.__timelines[${JSON.stringify(`ovs-scene-${manifest.id}-${s.id}`)}]=child;master.add(child.paused(false),${s.startSec});}}`).join('')}master.to({}, {duration:${timeline.durationSec}},0);window.__timelines[${JSON.stringify(manifest.id)}]=master;})();</script>`;
    const captions = manifest.captions?.enabled ? timeline.scenes.flatMap(s => captionCues(manifest.scenes[s.index].narration?.text ?? '', s.durationSec).map((c, i) => `<div class="clip orkas-caption ovs-caption" data-start="${s.startSec + c.startSec}" data-duration="${c.endSec - c.startSec}" data-track-index="20" id="caption-${s.id}-${i}" style="position:absolute;top:auto;left:50%;right:auto;bottom:12%;height:auto;width:max-content;max-width:84%;transform:translateX(-50%);padding:.2em .5em;border-radius:4px;background:rgba(0,0,0,.78);color:white;text-align:center;font:600 ${Math.round(Math.min(manifest.canvas.width, manifest.canvas.height) * .05)}px/1.3 system-ui;text-shadow:0 2px 8px black">${escape(c.text)}</div>`)).join('') : '';
    const rootTag = parseHtmlStructure(next).tags.find(t => t.attrs['data-composition-id'] === manifest.id);
    const rootEnd = rootTag && findElementEnd(next, rootTag);
    if (!rootEnd) throw new Error('The authored page needs one composition root.');
    next = next.slice(0, rootEnd.innerEnd) + `<!-- OVS-TIMELINE-BEGIN -->${captions}<!-- OVS-TIMELINE-END -->` + next.slice(rootEnd.innerEnd);
    next = next.replace('</body>', `<!-- OVS-TIMELINE-BEGIN -->${motion}<!-- OVS-TIMELINE-END --></body>`);
    if (issues.some(i => i.severity === 'error')) return { ok: false, project, issues };
    await ensureGsapVendor(project);
    await writeTimelineJson(join(project, 'composition-manifest.json'), legacy);
    const htmlTemporary = `${htmlPath}.${randomUUID()}.tmp`;
    try { await fs.writeFile(htmlTemporary, next, { encoding: 'utf8', flag: 'wx' }); await fs.rename(htmlTemporary, htmlPath); }
    finally { await fs.rm(htmlTemporary, { force: true }); }
    await writeTimelineJson(statePath, { schema_version: 1, manifest_sha256: await timelineDigest(join(project, 'manifest.json')), html_sha256: await timelineDigest(htmlPath), prepared_at: new Date().toISOString() });
    return { ok: true, project, duration_sec: timeline.durationSec, timeline, issues };
  });
}
