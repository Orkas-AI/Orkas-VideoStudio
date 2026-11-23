import sharp from 'sharp';
import { looksLikeScreen } from '@orkas/video-studio-core';

/** A still picture's width when it is read for whether it looks like a screen. */
const SCREEN_PROBE_WIDTH = 160;
/** A screen on for less than this is a glimpse, not a step to show. */
export const SCREEN_STEP_MIN_SEC = 1.5;
/** At most this many distinct pictures are read for one check. */
const SCREEN_PROBES_MAX = 64;

/**
 * Whether a still picture file looks like a screen of a site or app; false when it cannot be read.
 * Bilinear reduction: sharp's default Lanczos kernel rings around text and lowered real
 * screenshots under the threshold (2026-11-23: 0.65-0.77 against 0.70-0.82 bilinear, photographs
 * 0.16-0.44 either way).
 */
export async function pictureLooksLikeScreen(file: string): Promise<boolean> {
  try {
    const { data, info } = await sharp(file, { limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: SCREEN_PROBE_WIDTH, kernel: 'linear' }).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    return looksLikeScreen(data, info.width, info.height);
  } catch {
    return false;
  }
}

/** Said when pictures arrive, while the scenes are still to be planned: the ones that look
 *  like screens of a site or app, and how a step on them is shown. As a question, because a
 *  flat-lay photograph can look the same. */
export function importedScreensMessage(assetIds: readonly string[]): string {
  const many = assetIds.length > 1;
  return `${assetIds.join(', ')} ${many ? 'look' : 'looks'} like ${many ? 'screens' : 'a screen'} of a site or app. Where the video says what someone does there, plan that step done on the screen with ./assets/vendor/screen-demo.js (timeline.md): the tap or the typing, then the screen it leads to, rather than the screenshot under a caption. A photograph needs none of this.`;
}

/** Said as a question: a still the measure takes for a screen can be a flat-lay photograph,
 *  and a promotion can keep a screen still on purpose. */
export function screenStepMessage(sceneIds: readonly string[]): string {
  return `${sceneIds.length > 1 ? `Scenes ${sceneIds.join(', ')} show` : `Scene ${sceneIds[0]} shows`} what looks like a screen of a site or app, with nothing done on it. Where the line says what someone does there, show it done on that screen with ./assets/vendor/screen-demo.js (timeline.md): tap or type where it happens, cut to the screen it leads to, and ring what the line points at. A photograph needs none of this.`;
}

/** The imported pictures that look like screens, as the note `ovs timeline import` adds. */
export async function importedScreensNote(rows: ReadonlyArray<{ id: string; kind: string }>, fileOf: (id: string) => string): Promise<string | null> {
  const screens: string[] = [];
  for (const row of rows) {
    if (row.kind !== 'image' || screens.includes(row.id)) continue;
    if (await pictureLooksLikeScreen(fileOf(row.id))) screens.push(row.id);
  }
  return screens.length ? importedScreensMessage(screens) : null;
}

/** Whether a scene's marked motion script uses the screen-demo helper. Read from the page, so
 *  a scene counts as showing its steps once it calls ScreenDemo anywhere in that script. */
function sceneMotionUsesScreenDemo(html: string, sceneId: string): boolean {
  const start = html.indexOf(`// ORKAS-SCENE-MOTION-BEGIN:${sceneId}`);
  const end = html.indexOf(`// ORKAS-SCENE-MOTION-END:${sceneId}`);
  return start >= 0 && end > start && /\bScreenDemo\s*\(/.test(html.slice(start, end));
}

/**
 * Scenes that show a screen-like still for at least SCREEN_STEP_MIN_SEC while their motion script
 * does not use screen-demo.js, as one advisory warning. Static: it reads the page's scene scripts,
 * not the running page, so a ScreenDemo call anywhere in a scene covers all of that scene's stills.
 */
export async function screenStepIssues(input: {
  html: string;
  scenes: ReadonlyArray<{ id: string; index: number; clips: ReadonlyArray<{ assetId: string; frameCount: number }> }>;
  fps: number;
  stills: ReadonlyMap<string, string>;
}): Promise<Array<{ code: string; severity: 'warning'; message: string; source: string; selector: string; sceneId: string }>> {
  const verdicts = new Map<string, boolean>();
  const idle: Array<{ id: string; index: number }> = [];
  for (const scene of input.scenes) {
    if (sceneMotionUsesScreenDemo(input.html, scene.id)) continue;
    let shown = false;
    for (const clip of scene.clips) {
      const file = input.stills.get(clip.assetId);
      if (!file || clip.frameCount / input.fps < SCREEN_STEP_MIN_SEC) continue;
      if (!verdicts.has(clip.assetId)) {
        if (verdicts.size >= SCREEN_PROBES_MAX) continue;
        verdicts.set(clip.assetId, await pictureLooksLikeScreen(file));
      }
      if (verdicts.get(clip.assetId)) { shown = true; break; }
    }
    if (shown) idle.push({ id: scene.id, index: scene.index });
  }
  if (!idle.length) return [];
  return [{
    code: 'TIMELINE_SCREEN_WITHOUT_STEP',
    severity: 'warning',
    message: screenStepMessage(idle.map((scene) => scene.id)),
    source: 'orkas-video-timeline',
    selector: `manifest.json#scenes.${idle[0].index}`,
    sceneId: idle[0].id,
  }];
}
