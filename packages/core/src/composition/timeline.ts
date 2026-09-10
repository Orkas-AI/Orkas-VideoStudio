const TIMELINE_POSITION_ARG_INDEX: Record<string, number> = {
  set: 2, to: 2, from: 2, fromTo: 3, add: 1, addLabel: 1, call: 2,
};

/** Timing tolerance shared with the scene-window checks in inspect. */
const TIMELINE_POSITION_TOLERANCE_SEC = 0.15;

export type AuthoredAbsolutePosition = {
  method: string;
  seconds: number;
  line: number;
  suggestion: string;
  /** The scene whose window contains the literal — the one `suggestion`
   *  offsets from. `scenes` is non-empty by the guard, so there is always one. */
  scene_id: string;
};

/** Split one call's top-level arguments, respecting nesting and strings. */
function splitCallArguments(source: string, openIndex: number): { args: string[]; endIndex: number } | null {
  const args: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      current += ch;
      if (ch === '\\') { current += source[++i] ?? ''; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth === 1) continue;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { args.push(current.trim()); return { args, endIndex: i }; }
    } else if (ch === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
      continue;
    }
    if (depth >= 1) current += ch;
  }
  return null;
}

/**
 * Timeline positions written as absolute seconds instead of `S(id)` offsets.
 *
 * The scene windows these literals encode are recomputed from the measured
 * narration audio, and that can happen after the HTML is authored — a TTS
 * retry reaches `materialize_narration` on an already-authored file. On
 * 2026-08-08 that left 46 literals pointing one scene off; the model spent 11
 * minutes and 13 round trips transcribing new ones by hand and did not finish.
 * The host knows every window, so it can hand back the exact replacement
 * expression rather than only the complaint.
 */
export function authoredAbsoluteTimelinePositions(
  html: string,
  scenes: { id: string; start: number; duration: number }[],
): AuthoredAbsolutePosition[] {
  const found: AuthoredAbsolutePosition[] = [];
  if (!scenes.length) return found;
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRe.exec(html)) !== null) {
    const script = scriptMatch[1];
    const scriptOffset = scriptMatch.index + scriptMatch[0].indexOf(script);
    const callRe = /\btl\s*\.\s*(set|to|from|fromTo|add|addLabel|call)\s*\(/g;
    let call: RegExpExecArray | null;
    while ((call = callRe.exec(script)) !== null) {
      const parsed = splitCallArguments(script, call.index + call[0].length - 1);
      if (!parsed) continue;
      callRe.lastIndex = parsed.endIndex;
      const method = call[1];
      const position = parsed.args[TIMELINE_POSITION_ARG_INDEX[method]];
      if (!position) continue;
      // `S(id) + 0.2` is the offset form this check exists to promote, and a
      // string position ("+=1", "<", a label) is relative to another tween
      // rather than to the timeline, so both survive a retime unchanged.
      if (/\b[SD]\s*\(/.test(position) || /^["'`]/.test(position)) continue;
      const literals = (position.match(/(?<![\w.])\d+(?:\.\d+)?/g) || []).map(Number);
      const seconds = literals.find((value) => value > TIMELINE_POSITION_TOLERANCE_SEC);
      if (seconds === undefined) continue;
      const owner = scenes.find((scene) => seconds >= scene.start && seconds < scene.start + scene.duration)
        || scenes[scenes.length - 1];
      const offset = Math.round((seconds - owner.start) * 1000) / 1000;
      found.push({
        method,
        seconds,
        line: html.slice(0, scriptOffset + call.index).split('\n').length,
        suggestion: offset === 0
          ? `S(${JSON.stringify(owner.id)})`
          : `S(${JSON.stringify(owner.id)}) + ${offset}`,
        scene_id: owner.id,
      });
    }
  }
  return found;
}
