import { mkdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';

/**
 * Resolve `target` (absolute or relative to `base`) and assert it stays within
 * `base`. The CLI runs under the user's own agent so this is a guard against
 * accidental `../` escapes, not a multi-tenant sandbox. Throws on escape.
 */
export function resolveInside(base: string, target: string): string {
  const baseAbs = resolve(base);
  const full = isAbsolute(target) ? resolve(target) : resolve(baseAbs, target);
  const rel = relative(baseAbs, full);
  if (rel === '' ) return full;
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`path "${target}" escapes the project directory`);
  }
  return full;
}

/** Ensure the parent directory of `filePath` exists (mkdir -p on the dirname). */
export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}
