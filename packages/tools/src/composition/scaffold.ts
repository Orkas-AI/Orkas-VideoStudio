import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import {
  manifestAsDesignContract,
  manifestAsSceneMap,
  parseCompositionManifest,
  type CompositionManifest,
  type CompositionManifestIssue,
} from '@orkas/video-studio-core';
import { designContractReadiness } from '../render/composition-qa.js';

export type CompositionPrepareResult = {
  ok: boolean;
  manifest_path: string;
  html_path: string;
  scaffold_created: boolean;
  reconciled: boolean;
  issues: CompositionManifestIssue[];
  /** Design-contract readiness at hand-off time. Every design fixHint says
   *  "before writing HTML" — reporting the gap here, instead of first at
   *  inspect/draft, is the only moment that instruction can still be
   *  followed. Cover-family checks stay with inspect (frame evidence). */
  design_contract?: ReturnType<typeof designContractReadiness>;
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setOpeningTagAttribute(tag: string, name: string, value: string): string {
  const attr = new RegExp(`\\s${escapeRegExp(name)}=(?:"[^"]*"|'[^']*')`, 'i');
  if (attr.test(tag)) return tag.replace(attr, ` ${name}="${escapeHtml(value)}"`);
  return tag.replace(/>$/, ` ${name}="${escapeHtml(value)}">`);
}

function ensureOpeningTagClass(tag: string, token: string): string {
  const match = tag.match(/\bclass=(?:"([^"]*)"|'([^']*)')/i);
  const classes = (match?.[1] || match?.[2] || '').split(/\s+/).filter(Boolean);
  if (!classes.includes(token)) classes.push(token);
  return setOpeningTagAttribute(tag, 'class', classes.join(' '));
}

function audioMarkup(manifest: CompositionManifest): string {
  if (manifest.audio.owner !== 'composition') return '';
  return manifest.audio.tracks.map((track, index) =>
    `    <audio id="audio-${escapeHtml(track.id)}" src="./${escapeHtml(track.src.replace(/^\.\//, ''))}" data-start="${track.start}" data-duration="${track.duration}" data-track-index="${index + 10}" data-volume="${track.volume}"></audio>`,
  ).join('\n');
}

export function buildCompositionScaffold(manifest: CompositionManifest): string {
  const { composition } = manifest;
  const cover = manifest.art_direction?.cover && typeof manifest.art_direction.cover === 'object' && !Array.isArray(manifest.art_direction.cover)
    ? manifest.art_direction.cover as Record<string, unknown>
    : null;
  const coverSceneId = typeof cover?.scene_id === 'string' ? cover.scene_id : '';
  const coverSignals = Array.isArray(cover?.content_signals)
    ? cover.content_signals.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const clips = manifest.scenes.map((scene) => {
    const title = scene.approved_copy[0] || scene.id;
    const isCover = scene.id === coverSceneId;
    const signals = isCover
      ? coverSignals.map((signal) => `        <span class="cover-signal" data-cover-signal="${escapeHtml(signal)}">${escapeHtml(signal)}</span>`).join('\n')
      : '';
    return [
      `    <section id="scene-${escapeHtml(scene.id)}" class="clip" data-scene-id="${escapeHtml(scene.id)}" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="1">`,
      '      <div class="scene-background" aria-hidden="true"></div>',
      '      <div class="scene-content">',
      `        <h1 id="title-${escapeHtml(scene.id)}" data-role="title">${escapeHtml(title)}</h1>`,
      `        <div data-role="visual"${isCover ? ' data-cover-hero' : ''} aria-label="${escapeHtml(scene.id)} visual"></div>`,
      ...(signals ? [signals] : []),
      '      </div>',
      '    </section>',
    ].join('\n');
  }).join('\n');
  const audio = audioMarkup(manifest);
  const timeline = manifest.scenes.map((scene) => {
    const selector = JSON.stringify(`#scene-${scene.id} .scene-content`);
    const revealDuration = Math.min(0.6, scene.duration);
    return `      tl.fromTo(${selector}, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: ${revealDuration}, ease: "power3.out" }, ${scene.start});`;
  }).join('\n');
  return `<!doctype html>
<html lang="${escapeHtml(composition.language || 'en')}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${composition.width}, height=${composition.height}" />
  <script src="./assets/vendor/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { width: ${composition.width}px; height: ${composition.height}px; margin: 0; overflow: hidden; background: #000; color: #fff; }
    #composition-root { position: relative; width: ${composition.width}px; height: ${composition.height}px; overflow: hidden; }
    .clip { position: absolute; inset: 0; overflow: hidden; }
    .scene-background { position: absolute; inset: 0; background: #000; }
    .scene-content { position: relative; width: 100%; height: 100%; padding: 96px; display: flex; flex-direction: column; justify-content: center; gap: 32px; }
    h1 { margin: 0; font: 700 96px/1.05 system-ui, sans-serif; }
    .cover-signal { font: 500 32px/1.2 system-ui, sans-serif; opacity: 0.8; }
  </style>
</head>
<body>
  <!-- OVS-GENERATED-SCAFFOLD: edit visual content; keep root/clip/audio timing declarative. -->
  <main id="composition-root" data-composition-id="${escapeHtml(composition.id)}" data-start="0" data-duration="${composition.duration}" data-width="${composition.width}" data-height="${composition.height}" data-fps="${composition.fps}">
${clips}${audio ? `\n${audio}` : ''}
  </main>
  <script>
    (() => {
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines[${JSON.stringify(composition.id)}] = tl;
${timeline}
      // Add deterministic scene motion to tl. HyperFrames owns media playback.
    })();
  </script>
</body>
</html>
`;
}

function vendorCandidates(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    join(here, '..', 'render', 'vendor', 'gsap.min.js'),
    resolve(here, '..', '..', 'src', 'render', 'vendor', 'gsap.min.js'),
    resolve(process.cwd(), 'packages', 'tools', 'src', 'render', 'vendor', 'gsap.min.js'),
  ];
}

async function ensureGsapVendor(project: string): Promise<void> {
  const target = join(project, 'assets', 'vendor', 'gsap.min.js');
  if ((await fs.stat(target).catch(() => null))?.isFile()) return;
  for (const candidate of vendorCandidates()) {
    if (!(await fs.stat(candidate).catch(() => null))?.isFile()) continue;
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.copyFile(candidate, target);
    return;
  }
  throw new Error('Bundled GSAP vendor was not found in @orkas/video-studio-tools.');
}

async function loadManifest(project: string): Promise<{ manifest: CompositionManifest | null; issues: CompositionManifestIssue[]; path: string }> {
  const path = join(project, 'composition-manifest.json');
  const text = await fs.readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (!text) return { manifest: null, path, issues: [{ code: 'COMPOSITION_MANIFEST_MISSING', severity: 'error', selector: 'composition-manifest.json', message: 'Write composition-manifest.json before preparing the composition.' }] };
  const result = parseCompositionManifest(text);
  return { manifest: result.data, issues: result.issues, path };
}

/** Create the initial HyperFrames HTML scaffold without overwriting authored HTML. */
export async function prepareComposition(projectPath: string): Promise<CompositionPrepareResult> {
  const project = resolve(projectPath);
  const loaded = await loadManifest(project);
  const htmlPath = join(project, 'index.html');
  if (!loaded.manifest) return { ok: false, manifest_path: loaded.path, html_path: htmlPath, scaffold_created: false, reconciled: false, issues: loaded.issues };
  const exists = (await fs.stat(htmlPath).catch(() => null))?.isFile() ?? false;
  if (!exists) {
    await fs.mkdir(project, { recursive: true });
    await fs.writeFile(htmlPath, buildCompositionScaffold(loaded.manifest), 'utf8');
  }
  await ensureGsapVendor(project);
  const designContract = designContractReadiness(
    manifestAsDesignContract(loaded.manifest),
    manifestAsSceneMap(loaded.manifest),
  );
  return {
    ok: true,
    manifest_path: loaded.path,
    html_path: htmlPath,
    scaffold_created: !exists,
    reconciled: false,
    issues: loaded.issues,
    design_contract: designContract,
  };
}

/** Update manifest-owned timing attributes while preserving authored DOM/CSS/motion. */
export function reconcileCompositionHtml(html: string, manifest: CompositionManifest): { html: string; changed: boolean; issues: CompositionManifestIssue[] } {
  const issues: CompositionManifestIssue[] = [];
  let next = html;
  const rootRe = /<([a-z][\w:-]*)\b[^>]*\bdata-composition-id=(?:"[^"]*"|'[^']*')[^>]*>/i;
  const rootMatch = rootRe.exec(next);
  if (!rootMatch) return { html, changed: false, issues: [{ code: 'COMPOSITION_ROOT_MISSING', severity: 'error', selector: '[data-composition-id]', message: 'Cannot reconcile because the HyperFrames composition root is missing.' }] };
  let rootTag = rootMatch[0];
  for (const [name, value] of Object.entries({
    'data-composition-id': manifest.composition.id,
    'data-start': '0',
    'data-duration': String(manifest.composition.duration),
    'data-width': String(manifest.composition.width),
    'data-height': String(manifest.composition.height),
    'data-fps': String(manifest.composition.fps),
  })) rootTag = setOpeningTagAttribute(rootTag, name, value);
  next = `${next.slice(0, rootMatch.index)}${rootTag}${next.slice(rootMatch.index + rootMatch[0].length)}`;

  for (const scene of manifest.scenes) {
    const id = escapeRegExp(scene.id);
    const sceneRe = new RegExp(`<([a-z][\\w:-]*)\\b[^>]*\\bdata-scene-id=(?:"${id}"|'${id}')[^>]*>`, 'i');
    const match = sceneRe.exec(next);
    if (!match) {
      issues.push({ code: 'SEMANTIC_SCENE_HOOKS_MISSING', severity: 'error', selector: `[data-scene-id="${scene.id}"]`, message: `Scene "${scene.id}" is missing from index.html.`, sceneId: scene.id });
      continue;
    }
    let tag = ensureOpeningTagClass(match[0], 'clip');
    tag = setOpeningTagAttribute(tag, 'data-start', String(scene.start));
    tag = setOpeningTagAttribute(tag, 'data-duration', String(scene.duration));
    tag = setOpeningTagAttribute(tag, 'data-track-index', '1');
    next = `${next.slice(0, match.index)}${tag}${next.slice(match.index + match[0].length)}`;
  }

  // Update only the reveal tweens emitted by buildCompositionScaffold;
  // authored tweens and visual structure remain untouched.
  manifest.scenes.forEach((scene) => {
    const selector = JSON.stringify(`#scene-${scene.id} .scene-content`);
    const selectorPattern = escapeRegExp(selector);
    const reveal = new RegExp(`tl\\.fromTo\\(\\s*${selectorPattern}\\s*,\\s*\\{\\s*opacity\\s*:\\s*0\\s*,\\s*y\\s*:\\s*48\\s*\\}\\s*,\\s*\\{\\s*opacity\\s*:\\s*1\\s*,\\s*y\\s*:\\s*0\\s*,\\s*duration\\s*:\\s*[0-9.]+\\s*,\\s*ease\\s*:\\s*"power3\\.out"\\s*\\}\\s*,\\s*-?[0-9.]+\\s*\\);`);
    const revealDuration = Math.min(0.6, scene.duration);
    next = next.replace(reveal, `tl.fromTo(${selector}, { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: ${revealDuration}, ease: "power3.out" }, ${scene.start});`);
  });
  next = next.replace(/window\.__timelines\[(?:"[^"]*"|'[^']*')\]\s*=\s*tl;/, `window.__timelines[${JSON.stringify(manifest.composition.id)}] = tl;`);

  next = next.replace(/\n?\s*<audio\b[^>]*\bdata-start=(?:"[^"]*"|'[^']*')[^>]*>(?:\s*<\/audio>)?/gi, '');
  const audio = audioMarkup(manifest);
  if (audio) {
    const closeRoot = new RegExp(`</${rootMatch[1]}>`, 'i');
    const remaining = next.slice(rootMatch.index);
    const closeMatch = closeRoot.exec(remaining);
    if (!closeMatch) issues.push({ code: 'COMPOSITION_ROOT_UNCLOSED', severity: 'error', selector: '[data-composition-id]', message: 'Cannot add declarative audio because the composition root is not closed.' });
    else {
      const insertion = rootMatch.index + closeMatch.index;
      next = `${next.slice(0, insertion)}\n${audio}\n  ${next.slice(insertion)}`;
    }
  }
  return { html: next, changed: next !== html, issues };
}

export async function reconcileComposition(projectPath: string): Promise<CompositionPrepareResult> {
  const project = resolve(projectPath);
  const loaded = await loadManifest(project);
  const htmlPath = join(project, 'index.html');
  if (!loaded.manifest) return { ok: false, manifest_path: loaded.path, html_path: htmlPath, scaffold_created: false, reconciled: false, issues: loaded.issues };
  const html = await fs.readFile(htmlPath, 'utf8').catch(() => '');
  if (!html) return prepareComposition(project);
  const reconciled = reconcileCompositionHtml(html, loaded.manifest);
  const issues = [...loaded.issues, ...reconciled.issues];
  if (!issues.some((entry) => entry.severity === 'error') && reconciled.changed) await fs.writeFile(htmlPath, reconciled.html, 'utf8');
  await ensureGsapVendor(project);
  return { ok: !issues.some((entry) => entry.severity === 'error'), manifest_path: loaded.path, html_path: htmlPath, scaffold_created: false, reconciled: reconciled.changed, issues };
}
