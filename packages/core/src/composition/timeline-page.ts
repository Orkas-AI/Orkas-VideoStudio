import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractHtmlResourceRefs, parseHtmlStructure, type HtmlStartTag } from './html-structure.js';
import { resolveSceneText, type ContractIssue, type VideoManifestV3, type VideoScene, type VideoAssetRecord, type VideoProduct } from './timeline-v3.js';
const SOURCE = 'orkas-video-timeline';
const WARNING_MESSAGE_MAX = 200;
function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

/** End offset of the element a start tag opens, or null when it never closes.
 *  Comments and raw script/style text cannot close it. */
export function findElementEnd(html: string, tag: HtmlStartTag): { innerEnd: number; end: number } | null {
  const closeRe = /<(\/?)([a-zA-Z][\w:-]*)\b[^>]*>|<!--[\s\S]*?-->/g;
  closeRe.lastIndex = tag.end;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = closeRe.exec(html))) {
    if (!match[2]) continue;
    const name = match[2].toLowerCase();
    if (!match[1] && (name === 'script' || name === 'style')) {
      const rawEnd = html.toLowerCase().indexOf(`</${name}`, closeRe.lastIndex);
      if (rawEnd < 0) return null;
      closeRe.lastIndex = rawEnd;
      continue;
    }
    if (name !== tag.tagName) continue;
    if (match[1]) {
      depth -= 1;
      if (depth === 0) return { innerEnd: match.index, end: match.index + match[0].length };
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }
  return null;
}

type Edit = { start: number; end: number; text: string };

/** Where a scene's motion script sits between its markers, when each marker appears once. */
function sceneMotionRegion(source: string, sceneId: string): { start: number; end: number } | null {
  const begin = `// ORKAS-SCENE-MOTION-BEGIN:${sceneId}`;
  const end = `// ORKAS-SCENE-MOTION-END:${sceneId}`;
  const beginAt = source.indexOf(begin);
  const endAt = source.indexOf(end);
  return beginAt >= 0 && endAt > beginAt
    && source.indexOf(begin, beginAt + begin.length) < 0
    && source.indexOf(end, endAt + end.length) < 0
    ? { start: beginAt + begin.length, end: endAt }
    : null;
}

function applyEdits(source: string, edits: Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((out, edit) => `${out.slice(0, edit.start)}${edit.text}${out.slice(edit.end)}`, source);
}

function fillImg(clipId: string): string {
  return `<img data-clip="${escapeHtmlAttr(clipId)}" class="orkas-fill" alt="">`;
}

/** Slots filled, unplaced clips laid behind the content, captions added. */
function rewriteSceneSubtree(input: {
  subtree: string;
  scene: VideoScene;
  values: Record<string, string>;
  captions: boolean;
  issues: ContractIssue[];
}): string {
  const { subtree, scene, values, issues } = input;
  const structure = parseHtmlStructure(subtree);
  const [open] = structure.tags;
  const edits: Edit[] = [];
  const add = (code: string, message: string) => {
    issues.push({ code, severity: 'error', message, source: SOURCE, sceneId: scene.id, selector: `[data-scene-id="${scene.id}"]` });
  };

  const clipIds = new Set((scene.clips ?? []).map((clip) => clip.id));
  const placedClips = new Set<string>();
  const filledSlots = new Set<string>();
  let coveredUntil = 0;
  for (const tag of structure.tags.slice(1)) {
    if (tag.start < coveredUntil) continue;
    if (tag.attrs['data-clip'] !== undefined) {
      const clipId = tag.attrs['data-clip'];
      if (tag.tagName !== 'img') add('PAGE_CLIP_NOT_IMG', `data-clip="${clipId}" is on a <${tag.tagName}>; clips are shown through <img data-clip>.`);
      else if (!clipIds.has(clipId)) add('PAGE_CLIP_UNKNOWN', `<img data-clip="${clipId}"> is not a clip of scene "${scene.id}".`);
      else placedClips.add(clipId);
    }
    if (tag.attrs['data-slot'] === undefined) continue;
    const slot = tag.attrs['data-slot'];
    const close = findElementEnd(subtree, tag);
    if (!close) {
      add('PAGE_SLOT_INVALID', `data-slot="${slot}" is on a <${tag.tagName}> that holds no text.`);
      continue;
    }
    if (values[slot] === undefined) {
      add('PAGE_SLOT_UNFILLED', `Slot "${slot}" in scene "${scene.id}" has no text. Add it to the scene's "text".`);
    } else {
      edits.push({ start: tag.end, end: close.innerEnd, text: escapeHtmlText(values[slot]) });
    }
    filledSlots.add(slot);
    coveredUntil = close.end;
  }
  for (const slot of Object.keys(values)) {
    if (!filledSlots.has(slot)) add('PAGE_SLOT_MISSING', `Scene "${scene.id}" has text for slot "${slot}", but the page has no data-slot="${slot}" there.`);
  }

  const unplaced = [...clipIds].filter((id) => !placedClips.has(id));
  if (unplaced.length) {
    edits.push({ start: open.end, end: open.end, text: unplaced.map(fillImg).join('') });
    edits.push({ start: open.end - 1, end: open.end - 1, text: ' data-orkas-has-fill' });
  }
  if (input.captions && !subtree.includes('data-orkas-caption')) {
    const close = findElementEnd(subtree, open);
    if (close) edits.push({ start: close.innerEnd, end: close.innerEnd, text: '<div class="orkas-caption" data-orkas-caption></div>' });
  }
  return applyEdits(subtree, edits);
}

function defaultPage(manifest: VideoManifestV3): string {
  const { width, height, language } = manifest.canvas;
  return `<!doctype html>
<html lang="${escapeHtmlAttr(language || 'en')}">
<head>
<meta charset="UTF-8">
<style>html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; background: #000; }</style>
</head>
<body>
<main data-composition-id="${escapeHtmlAttr(manifest.id)}" style="position: relative; width: 100%; height: 100%; overflow: hidden"></main>
</body>
</html>
`;
}

function hostStyle(manifest: VideoManifestV3): string {
  const unit = Math.min(manifest.canvas.width, manifest.canvas.height);
  return `<style data-orkas-host>
[data-orkas-hidden] { display: none !important; }
[data-orkas-has-fill] { isolation: isolate; }
.orkas-fill { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1; }
.orkas-caption { position: absolute; left: 8%; right: 8%; bottom: 12%; z-index: 10; text-align: center; color: #fff; font: 600 ${Math.round(unit * 0.05)}px/1.3 -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85); }
.orkas-caption:empty { display: none; }
</style>`;
}

export type CompiledVideoPage = {
  /** What the render window loads. */
  html: string;
  issues: ContractIssue[];
  /** Per-scene rendering inputs; every other byte of the page is in `shared`. */
  scenes: Record<string, { subtree: string; motion: string }>;
  shared: string;
};

/**
 * Turn the authored page plus the manifest into the page the window renders.
 *
 * Slots are filled in the page text rather than in the DOM after load: the page's
 * own scripts measure and animate text as they run, so words injected later would
 * sit in boxes sized for the placeholder.
 */
export function compileVideoPage(input: {
  html: string | null;
  manifest: VideoManifestV3;
  product: VideoProduct | null;
  /** File URL of the video directory, ending in a slash. */
  baseHref: string;
}): CompiledVideoPage {
  const { manifest, product } = input;
  const issues: ContractIssue[] = [];
  const source = input.html ?? defaultPage(manifest);
  const structure = parseHtmlStructure(source);
  const pageIssue = (code: string, message: string, selector: string) => {
    issues.push({ code, severity: 'error', message, selector, source: SOURCE });
  };

  for (const tag of structure.tags) {
    if (tag.tagName === 'base') pageIssue('PAGE_BASE_FORBIDDEN', 'Remove <base>; page resources resolve against the video directory.', 'base');
  }

  const captionsOn = manifest.captions?.enabled === true;
  const edits: Edit[] = [];
  const sharedEdits: Edit[] = [];
  const scenes: CompiledVideoPage['scenes'] = {};
  const inserted: string[] = [];

  for (const scene of manifest.scenes) {
    const values = resolveSceneText(scene, product);
    const captions = captionsOn && !!scene.narration;
    const sections = structure.tags.filter((tag) => tag.attrs['data-scene-id'] === scene.id);
    if (sections.length > 1) {
      pageIssue('PAGE_SCENE_DUPLICATE', `The page has ${sections.length} data-scene-id="${scene.id}" elements.`, `[data-scene-id="${scene.id}"]`);
      continue;
    }
    if (!sections.length) {
      if (!scene.clips?.length) {
        pageIssue('PAGE_SCENE_MISSING', `Scene "${scene.id}" has no footage and no <section data-scene-id="${scene.id}"> in index.html.`, `[data-scene-id="${scene.id}"]`);
        continue;
      }
      const subtree = rewriteSceneSubtree({
        subtree: `<section data-scene-id="${escapeHtmlAttr(scene.id)}" style="position: absolute; inset: 0; overflow: hidden"></section>`,
        scene,
        values,
        captions,
        issues,
      });
      scenes[scene.id] = { subtree, motion: '' };
      inserted.push(subtree);
      continue;
    }
    const [tag] = sections;
    const close = findElementEnd(source, tag);
    if (!close) {
      pageIssue('PAGE_SCENE_UNCLOSED', `<${tag.tagName} data-scene-id="${scene.id}"> never closes.`, `[data-scene-id="${scene.id}"]`);
      continue;
    }
    const subtree = rewriteSceneSubtree({
      subtree: source.slice(tag.start, close.end),
      scene,
      values,
      captions,
      issues,
    });
    edits.push({ start: tag.start, end: close.end, text: subtree });
    sharedEdits.push({ start: tag.start, end: close.end, text: `<!--orkas-scene:${scene.id}-->` });
    scenes[scene.id] = { subtree, motion: '' };

    const motion = sceneMotionRegion(source, scene.id);
    if (motion) {
      scenes[scene.id].motion = source.slice(motion.start, motion.end);
      sharedEdits.push({ ...motion, text: '' });
    }
  }

  // A scene taken off the timeline stays in the page and never shows. It leaves the shared
  // surface the way a listed scene does, or removing one would re-render all the others.
  const listed = new Set(manifest.scenes.map((scene) => scene.id));
  for (const tag of structure.tags) {
    const id = tag.attrs['data-scene-id'];
    if (id === undefined || listed.has(id)) continue;
    const close = findElementEnd(source, tag);
    if (close) sharedEdits.push({ start: tag.start, end: close.end, text: `<!--orkas-scene:${id}-->` });
    const motion = sceneMotionRegion(source, id);
    if (motion) sharedEdits.push({ ...motion, text: '' });
  }

  // Nested markup outside the marked regions stays in the shared surface, which
  // only costs extra re-rendering. A scene's identity can never miss a byte.
  const shared = applyEdits(source, sharedEdits);

  if (inserted.length) {
    const root = structure.tags.find((tag) => tag.attrs['data-composition-id'] !== undefined);
    const rootClose = root ? findElementEnd(source, root) : null;
    const body = structure.tags.find((tag) => tag.tagName === 'body');
    const bodyClose = body ? findElementEnd(source, body) : null;
    const at = rootClose?.innerEnd ?? bodyClose?.innerEnd ?? source.length;
    edits.push({ start: at, end: at, text: inserted.join('\n') });
  }

  const hostHead = hostStyle(manifest);
  const head = structure.tags.find((tag) => tag.tagName === 'head');
  if (head) {
    edits.push({ start: head.end, end: head.end, text: hostHead });
  } else {
    const html = structure.tags.find((tag) => tag.tagName === 'html');
    const at = html ? html.end : 0;
    edits.push({ start: at, end: at, text: `<head>${hostHead}</head>` });
  }

  return { html: applyEdits(source, edits), issues, scenes, shared };
}

export type PagePictureRefs = {
  /** Placed outside every scene, so shown throughout. */
  shared: string[];
  /** By scene on the timeline. A scene taken off it shows nothing, so it is not here. */
  scenes: Record<string, string[]>;
};

/** The ledger pictures a page shows by file, through src or a CSS url(), rather than as
 *  clips. Both are read the way the render window reads them, against the video folder. */
export function pagePictureRefs(input: {
  compiled: CompiledVideoPage;
  assets: readonly VideoAssetRecord[];
  videoDirAbs: string;
  productionDirAbs: string;
}): PagePictureRefs {
  const base = pathToFileURL(`${input.videoDirAbs}${path.sep}`);
  const idOfFile = new Map(input.assets
    .filter((row) => row.kind !== 'audio')
    .map((row) => [path.resolve(input.productionDirAbs, row.path), row.id]));
  const idsIn = (markup: string): string[] => {
    const ids: string[] = [];
    for (const { attr, ref } of extractHtmlResourceRefs(parseHtmlStructure(markup))) {
      if (attr !== 'src' && attr !== 'style-url') continue;
      let file = '';
      try {
        const url = new URL(ref, base);
        if (url.protocol === 'file:') file = path.resolve(fileURLToPath(url));
      } catch {
        continue;
      }
      const id = idOfFile.get(file);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  };
  return {
    shared: idsIn(input.compiled.shared),
    scenes: Object.fromEntries(Object.entries(input.compiled.scenes).map(([id, scene]) => [id, idsIn(scene.subtree)])),
  };
}

/** A scene that places ledger pictures by file keeps them off the canvas, which reads a
 *  scene's pictures from its clips. Markup shared by every scene has no clip to move into. */
export function pagePictureIssues(manifest: VideoManifestV3, refs: PagePictureRefs): ContractIssue[] {
  return manifest.scenes.flatMap((scene) => {
    const ids = refs.scenes[scene.id] ?? [];
    if (!ids.length) return [];
    const several = ids.length > 1;
    const message = (named: number) => {
      const quoted = ids.slice(0, named).map((id) => `"${id}"`);
      const list = !named ? (several ? `${ids.length} pictures` : 'a picture')
        : named < ids.length ? `${quoted.join(', ')} and ${ids.length - named} more`
          : several ? `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}` : quoted[0];
      return `Scene "${scene.id}" places ${list} from assets.json straight in its page markup, so the canvas cannot show or swap ${several ? 'them' : 'it'}. Add ${several ? 'each' : 'it'} to the scene's "clips" and show it with <img data-clip="id">.`;
    };
    // The check reports a shortened message, and the fix is its last sentence.
    let named = ids.length;
    while (named > 0 && message(named).length > WARNING_MESSAGE_MAX) named -= 1;
    return [{
      code: 'PAGE_PICTURE_NOT_A_CLIP',
      severity: 'warning' as const,
      message: message(named),
      selector: `[data-scene-id="${scene.id}"]`,
      source: SOURCE,
      sceneId: scene.id,
    }];
  });
}
