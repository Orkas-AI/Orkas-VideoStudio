export function visualProjectionOfCompositionManifest(raw: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return JSON.stringify(raw ?? null);
  const manifest = raw as Record<string, unknown>;
  const projected: Record<string, unknown> = { ...manifest };
  delete projected.audio;
  if (manifest.composition && typeof manifest.composition === 'object' && !Array.isArray(manifest.composition)) {
    const composition = { ...(manifest.composition as Record<string, unknown>) };
    delete composition.target_duration;
    projected.composition = composition;
  }
  if (Array.isArray(manifest.scenes)) {
    projected.scenes = manifest.scenes.map((scene) => {
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return scene;
      const visual = { ...(scene as Record<string, unknown>) };
      delete visual.narration_text;
      delete visual.narration_refs;
      return visual;
    });
  }
  return JSON.stringify(canonical(projected));
}

export function normalizeCompositionHtmlForVisualIdentity(html: string): string {
  let next = html;
  // The protected composition root always starts at zero. Older authored
  // files may omit that default and reconciliation materializes it; absence
  // versus explicit zero cannot change a frame.
  next = next.replace(
    /<([a-z][\w:-]*)\b[^>]*\bdata-composition-id=(?:"[^"]*"|'[^']*')[^>]*>/gi,
    (tag) => /\sdata-start=(?:"[^"]*"|'[^']*')/i.test(tag) ? tag.replace(/\sdata-start=(?:"[^"]*"|'[^']*')/i, ' data-start="0"') : tag.replace(/>$/, ' data-start="0">'),
  );
  // Declarative audio elements are runtime-owned and invisible to the preview,
  // so a file that carries one and a file that never did must normalize to the
  // same text. An element on its own line takes that whole line — its own
  // indentation and its newline — and an inline one is simply removed, leaving
  // the surrounding text spacing alone. The earlier rule collapsed the element
  // together with ALL adjacent whitespace into one newline, which swallowed the
  // FOLLOWING line's indentation: removing an audio track then re-hashed as a
  // visual change over two spaces. On 2026-09-01 that dropped the user's
  // keyframe go-ahead and asked them to re-approve a byte-identical contact
  // sheet. The previous fixture had no indentation at all, so it could not see
  // this; identity must not hinge on insertion residue.
  const audioElement = '<audio\\b[^>]*\\bdata-start=(?:"[^"]*"|\'[^\']*\')[^>]*>(?:\\s*<\\/audio>)?';
  next = next.replace(new RegExp(`^[ \\t]*${audioElement}[ \\t]*\\r?\\n`, 'gim'), '');
  next = next.replace(new RegExp(audioElement, 'gi'), '');
  next = next.replace(/\n[ \t]*(?:\n[ \t]*)+/g, '\n');
  return next;
}
