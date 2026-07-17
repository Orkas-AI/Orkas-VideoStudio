import { isAbsolute } from 'node:path';

export type CompositionManifestIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  selector: string;
  message: string;
  sceneId?: string;
};

export type CompositionAudioTrack = {
  id: string;
  kind: 'narration' | 'music' | 'sfx';
  src: string;
  start: number;
  duration: number;
  volume: number;
};

export type CompositionScene = {
  id: string;
  start: number;
  duration: number;
  approved_copy: string[];
  narration_refs: string[];
  narration_text?: string;
  source_shots: string[];
  roles: string[];
};

export type NarrationIntent = {
  route_ref: string;
  voice_ref: string;
  display_name: string;
  language: string;
  speed: number;
};

export type CompositionManifest = {
  schema_version: 1 | 2;
  composition: {
    id: string;
    width: number;
    height: number;
    duration: number;
    target_duration?: number;
    fps: number;
    language?: string;
  };
  scenes: CompositionScene[];
  audio: {
    owner: 'composition' | 'assembler' | 'none';
    tracks: CompositionAudioTrack[];
    narration_intent?: NarrationIntent;
  };
  source_alignment?: { merge_reason?: string };
  art_direction?: Record<string, unknown>;
};

export type CompositionManifestValidation = {
  ok: boolean;
  data: CompositionManifest | null;
  issues: CompositionManifestIssue[];
};

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const LANGUAGE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function issue(issues: CompositionManifestIssue[], code: string, selector: string, message: string, sceneId?: string): void {
  issues.push({ code, severity: 'error', selector, message, ...(sceneId ? { sceneId } : {}) });
}

function readIdentifier(value: unknown, selector: string, issues: CompositionManifestIssue[]): string {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', selector, 'Use a non-empty identifier containing only letters, numbers, hyphens, or underscores.');
    return '';
  }
  return value;
}

function readPositive(value: unknown, selector: string, issues: CompositionManifestIssue[], integer = false, max?: number): number {
  if (!finite(value) || value <= 0 || (integer && !Number.isInteger(value)) || (max !== undefined && value > max)) {
    issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', selector, `Expected a positive${integer ? ' integer' : ''}${max !== undefined ? ` no greater than ${max}` : ''}.`);
    return 0;
  }
  return value;
}

function readNonnegative(value: unknown, selector: string, issues: CompositionManifestIssue[]): number {
  if (!finite(value) || value < 0) {
    issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', selector, 'Expected a finite non-negative number.');
    return 0;
  }
  return value;
}

function readStringList(value: unknown, selector: string, issues: CompositionManifestIssue[]): string[] {
  if (!strings(value)) {
    issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', selector, 'Expected an array of non-empty strings.');
    return [];
  }
  return value.map((item) => item.trim());
}

function validateSemantics(manifest: CompositionManifest, issues: CompositionManifestIssue[]): void {
  const sceneIds = new Set<string>();
  let previousEnd = 0;
  manifest.scenes.forEach((scene, index) => {
    const selector = `composition-manifest.json#scenes.${index}`;
    if (sceneIds.has(scene.id)) issue(issues, 'COMPOSITION_MANIFEST_SCENE_ID_DUPLICATE', `${selector}.id`, `Scene id "${scene.id}" is duplicated.`, scene.id);
    sceneIds.add(scene.id);
    if (scene.start > previousEnd + 0.05) issue(issues, 'COMPOSITION_MANIFEST_SCENE_GAP', selector, `Scene "${scene.id}" leaves a timeline gap after ${previousEnd}s.`, scene.id);
    if (scene.start < previousEnd - 0.001) issue(issues, 'COMPOSITION_MANIFEST_SCENE_OVERLAP', selector, `Scene "${scene.id}" overlaps the previous scene.`, scene.id);
    if (scene.start + scene.duration > manifest.composition.duration + 0.05) issue(issues, 'COMPOSITION_MANIFEST_SCENE_OUT_OF_RANGE', selector, `Scene "${scene.id}" ends after the composition.`, scene.id);
    previousEnd = Math.max(previousEnd, scene.start + scene.duration);
  });
  if (Math.abs(previousEnd - manifest.composition.duration) > 0.15) {
    issue(issues, 'COMPOSITION_MANIFEST_TIMELINE_COVERAGE_MISMATCH', 'composition-manifest.json#scenes', `Scene timeline ends at ${previousEnd}s but composition duration is ${manifest.composition.duration}s.`);
  }

  const trackIds = new Set<string>();
  manifest.audio.tracks.forEach((track, index) => {
    const selector = `composition-manifest.json#audio.tracks.${index}`;
    if (trackIds.has(track.id)) issue(issues, 'COMPOSITION_MANIFEST_AUDIO_ID_DUPLICATE', `${selector}.id`, `Audio track id "${track.id}" is duplicated.`);
    trackIds.add(track.id);
    const src = track.src.replace(/\\/g, '/');
    if (isAbsolute(track.src) || /^(?:https?:|data:|blob:|file:)/i.test(track.src) || src === '..' || src.startsWith('../') || src.includes('/../')) {
      issue(issues, 'COMPOSITION_MANIFEST_AUDIO_PATH_INVALID', `${selector}.src`, `Audio track "${track.id}" must use a composition-local relative path.`);
    }
    if (track.start + track.duration > manifest.composition.duration + 0.15) issue(issues, 'COMPOSITION_MANIFEST_AUDIO_OUT_OF_RANGE', selector, `Audio track "${track.id}" extends beyond the composition.`);
  });
  const narrated = manifest.scenes.some((scene) => Boolean(scene.narration_text?.trim()) || scene.narration_refs.length > 0);
  if (manifest.audio.owner === 'composition' && manifest.audio.tracks.length === 0) issue(issues, 'COMPOSITION_MANIFEST_AUDIO_TRACKS_MISSING', 'composition-manifest.json#audio', 'Audio owner "composition" requires at least one declarative audio track.');
  if (manifest.audio.owner === 'composition' && narrated && !manifest.audio.tracks.some((track) => track.kind === 'narration')) issue(issues, 'COMPOSITION_MANIFEST_NARRATION_TRACK_MISSING', 'composition-manifest.json#audio', 'Narrated scenes require a declarative narration audio track.');
  if (manifest.audio.owner !== 'composition' && manifest.audio.tracks.length > 0) issue(issues, 'COMPOSITION_MANIFEST_AUDIO_OWNERSHIP_CONFLICT', 'composition-manifest.json#audio', `Audio tracks are not allowed when audio owner is "${manifest.audio.owner}".`);
  if (manifest.schema_version === 2 && narrated && manifest.audio.owner !== 'assembler' && !manifest.audio.narration_intent) issue(issues, 'COMPOSITION_MANIFEST_NARRATION_INTENT_MISSING', 'composition-manifest.json#audio.narration_intent', 'Standalone narration in schema v2 requires the Gate B-approved narration intent.');
}

export function validateCompositionManifest(value: unknown): CompositionManifestValidation {
  const issues: CompositionManifestIssue[] = [];
  const root = record(value);
  if (!root) return { ok: false, data: null, issues: [{ code: 'COMPOSITION_MANIFEST_SCHEMA_INVALID', severity: 'error', selector: 'composition-manifest.json', message: 'Expected a JSON object.' }] };
  const schemaVersion = root.schema_version;
  if (schemaVersion !== 1 && schemaVersion !== 2) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#schema_version', 'Expected schema_version 1 or 2.');

  const compositionRaw = record(root.composition);
  if (!compositionRaw) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#composition', 'Expected a composition object.');
  const composition = {
    id: readIdentifier(compositionRaw?.id, 'composition-manifest.json#composition.id', issues),
    width: readPositive(compositionRaw?.width, 'composition-manifest.json#composition.width', issues, true),
    height: readPositive(compositionRaw?.height, 'composition-manifest.json#composition.height', issues, true),
    duration: readPositive(compositionRaw?.duration, 'composition-manifest.json#composition.duration', issues, false, 600),
    fps: readPositive(compositionRaw?.fps, 'composition-manifest.json#composition.fps', issues, true, 60),
    ...(compositionRaw?.target_duration === undefined ? {} : { target_duration: readPositive(compositionRaw.target_duration, 'composition-manifest.json#composition.target_duration', issues, false, 600) }),
    ...(compositionRaw?.language === undefined ? {} : typeof compositionRaw.language === 'string' && compositionRaw.language.trim() ? { language: compositionRaw.language.trim() } : (() => { issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#composition.language', 'Expected a non-empty language string.'); return {}; })()),
  };

  const scenesRaw = Array.isArray(root.scenes) ? root.scenes : [];
  if (!scenesRaw.length) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#scenes', 'Expected at least one scene.');
  const scenes = scenesRaw.map((raw, index): CompositionScene => {
    const item = record(raw);
    if (!item) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#scenes.${index}`, 'Expected a scene object.');
    const narrationText = item?.narration_text;
    if (narrationText !== undefined && (typeof narrationText !== 'string' || !narrationText.trim())) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#scenes.${index}.narration_text`, 'Expected a non-empty string.');
    return {
      id: readIdentifier(item?.id, `composition-manifest.json#scenes.${index}.id`, issues),
      start: readNonnegative(item?.start, `composition-manifest.json#scenes.${index}.start`, issues),
      duration: readPositive(item?.duration, `composition-manifest.json#scenes.${index}.duration`, issues),
      approved_copy: readStringList(item?.approved_copy ?? [], `composition-manifest.json#scenes.${index}.approved_copy`, issues),
      narration_refs: readStringList(item?.narration_refs ?? [], `composition-manifest.json#scenes.${index}.narration_refs`, issues),
      ...(typeof narrationText === 'string' && narrationText.trim() ? { narration_text: narrationText.trim() } : {}),
      source_shots: readStringList(item?.source_shots ?? [], `composition-manifest.json#scenes.${index}.source_shots`, issues),
      roles: readStringList(item?.roles ?? [], `composition-manifest.json#scenes.${index}.roles`, issues),
    };
  });

  const audioRaw = record(root.audio);
  if (!audioRaw) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#audio', 'Expected an audio object.');
  const owner = audioRaw?.owner;
  if (owner !== 'composition' && owner !== 'assembler' && owner !== 'none') issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#audio.owner', 'Expected composition, assembler, or none.');
  const tracksRaw = Array.isArray(audioRaw?.tracks) ? audioRaw.tracks : [];
  if (audioRaw && !Array.isArray(audioRaw.tracks)) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#audio.tracks', 'Expected an array.');
  const tracks = tracksRaw.map((raw, index): CompositionAudioTrack => {
    const item = record(raw);
    if (!item) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#audio.tracks.${index}`, 'Expected an audio track object.');
    const kind = item?.kind;
    if (kind !== 'narration' && kind !== 'music' && kind !== 'sfx') issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#audio.tracks.${index}.kind`, 'Expected narration, music, or sfx.');
    if (typeof item?.src !== 'string' || !item.src.trim()) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#audio.tracks.${index}.src`, 'Expected a non-empty path.');
    const volume = item?.volume;
    if (!finite(volume) || volume < 0 || volume > 1) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', `composition-manifest.json#audio.tracks.${index}.volume`, 'Expected a number from 0 to 1.');
    return {
      id: readIdentifier(item?.id, `composition-manifest.json#audio.tracks.${index}.id`, issues),
      kind: kind === 'music' || kind === 'sfx' ? kind : 'narration',
      src: typeof item?.src === 'string' ? item.src.trim() : '',
      start: readNonnegative(item?.start, `composition-manifest.json#audio.tracks.${index}.start`, issues),
      duration: readPositive(item?.duration, `composition-manifest.json#audio.tracks.${index}.duration`, issues),
      volume: finite(volume) ? volume : 0,
    };
  });

  const intentRaw = record(audioRaw?.narration_intent);
  let narrationIntent: NarrationIntent | undefined;
  if (audioRaw?.narration_intent !== undefined) {
    if (!intentRaw) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#audio.narration_intent', 'Expected an object.');
    const route = typeof intentRaw?.route_ref === 'string' ? intentRaw.route_ref.trim() : '';
    const voice = typeof intentRaw?.voice_ref === 'string' ? intentRaw.voice_ref.trim() : '';
    const display = typeof intentRaw?.display_name === 'string' ? intentRaw.display_name.trim() : '';
    const language = typeof intentRaw?.language === 'string' ? intentRaw.language.trim() : '';
    const speed = intentRaw?.speed;
    if (!route || !voice || !display || !LANGUAGE.test(language) || !finite(speed) || speed < 0.5 || speed > 2) issue(issues, 'COMPOSITION_MANIFEST_SCHEMA_INVALID', 'composition-manifest.json#audio.narration_intent', 'Narration intent requires route_ref, voice_ref, display_name, a language tag, and speed from 0.5 to 2.');
    if (route && voice && display && LANGUAGE.test(language) && finite(speed)) narrationIntent = { route_ref: route, voice_ref: voice, display_name: display, language, speed };
  }

  const manifest: CompositionManifest = {
    schema_version: schemaVersion === 1 ? 1 : 2,
    composition,
    scenes,
    audio: { owner: owner === 'composition' || owner === 'assembler' ? owner : 'none', tracks, ...(narrationIntent ? { narration_intent: narrationIntent } : {}) },
    ...(record(root.source_alignment) ? { source_alignment: { ...(typeof record(root.source_alignment)?.merge_reason === 'string' ? { merge_reason: String(record(root.source_alignment)?.merge_reason).trim() } : {}) } } : {}),
    ...(record(root.art_direction) ? { art_direction: record(root.art_direction) as Record<string, unknown> } : {}),
  };
  validateSemantics(manifest, issues);
  return { ok: issues.every((entry) => entry.severity !== 'error'), data: issues.some((entry) => entry.severity === 'error') ? null : manifest, issues };
}

export function parseCompositionManifest(text: string): CompositionManifestValidation {
  try {
    return validateCompositionManifest(JSON.parse(text));
  } catch (error) {
    return { ok: false, data: null, issues: [{ code: 'COMPOSITION_MANIFEST_PARSE_FAILED', severity: 'error', selector: 'composition-manifest.json', message: error instanceof Error ? error.message : String(error) }] };
  }
}

export function manifestAsSceneMap(manifest: CompositionManifest): Record<string, unknown> {
  const narration = manifest.audio.tracks.find((track) => track.kind === 'narration');
  return {
    schema_version: manifest.schema_version,
    canvas: { ...manifest.composition },
    audio: { owner: manifest.audio.owner, ...(narration ? { narration: narration.src, narration_duration_seconds: narration.duration } : {}), ...(manifest.audio.owner !== 'composition' ? { render_silent: true } : {}) },
    ...(manifest.source_alignment ? { source_alignment: manifest.source_alignment } : {}),
    scenes: manifest.scenes.map((scene) => ({ ...scene, ...(scene.narration_refs.length ? { narration_ref: scene.narration_refs.length === 1 ? scene.narration_refs[0] : scene.narration_refs } : {}) })),
  };
}

export function manifestAsDesignContract(manifest: CompositionManifest): Record<string, unknown> {
  const artDirection = manifest.art_direction ?? {};
  const sceneDesign = Array.isArray(artDirection.scenes)
    ? artDirection.scenes.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry))
    : [];
  const designById = new Map(sceneDesign.map((entry) => [String(entry.id || ''), entry]));
  return {
    ...artDirection,
    canvas: { ...manifest.composition },
    scenes: manifest.scenes.map((scene) => ({ ...scene, ...(designById.get(scene.id) ?? {}) })),
    audio: manifestAsSceneMap(manifest).audio,
  };
}
