import * as fs from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { assessNarrationOverSpeech, normalizeTranscriptWords, speechSpansFromWords, type DeliveryIssue } from '@orkas/video-studio-core';
import { transcribe } from '../analyze/analyze.js';
import { mediaDigest } from '../media-evidence.js';
export const narrationRecordPath = (file: string) => join(dirname(resolve(file)), `.${basename(file)}.narration.json`);
export type NarrationRecord = { kind: 'orkas-mix-narration'; version: 1; output: { sha256: string }; base: { path: string; sha256: string }; lines: Array<{ index: number; start: number; end: number }> };
export async function carryNarrationRecord(input: string, output: string) {
  try {
    const record = await readRecord(input);
    if (record && record.output.sha256 === await mediaDigest(input)) {
      record.output.sha256 = await mediaDigest(output);
      await fs.writeFile(narrationRecordPath(output), JSON.stringify(record) + '\n');
    }
  } catch { /* Evidence is advisory; the embedded marker preserves unknown status. */ }
}
async function readRecord(input: string): Promise<NarrationRecord | null> {
  const path = narrationRecordPath(input), size = (await fs.stat(path)).size;
  if (size > 1024 * 1024) return null;
  const bytes = await fs.readFile(path); if (bytes.length > 1024 * 1024) return null;
  const record = JSON.parse(bytes.toString('utf8')) as NarrationRecord;
  if (record?.kind !== 'orkas-mix-narration' || record.version !== 1 || !/^[a-f0-9]{64}$/.test(record.output?.sha256) || !/^[a-f0-9]{64}$/.test(record.base?.sha256) || typeof record.base?.path !== 'string' || !Array.isArray(record.lines) || !record.lines.length || record.lines.length > 1000 || record.lines.some(l => !l || !Number.isInteger(l.index) || l.index < 1 || !Number.isFinite(l.start) || l.start < 0 || !Number.isFinite(l.end) || l.end <= l.start)) return null;
  return record;
}
export async function narrationOverSpeechIssues(delivered: string, production: string, signal?: AbortSignal, expected = false): Promise<DeliveryIssue[]> {
  const unverified = (): DeliveryIssue[] => [{ code: 'DELIVERY_NARRATION_UNVERIFIABLE', severity: 'warning', message: 'The narration-over-dialogue check could not complete: mix evidence is missing, stale or unreadable. Speech overlap remains unverified.' }];
  let record: NarrationRecord | null;
  try { record = await readRecord(delivered); } catch { return expected ? unverified() : []; }
  if (!record) return expected ? unverified() : [];
  try {
    if (record.output.sha256 !== await mediaDigest(delivered)) return expected ? unverified() : [];
    const root = await fs.realpath(resolve(production)), base = await fs.realpath(resolve(record.base.path)), rel = relative(root, base);
    if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel) || record.base.sha256 !== await mediaDigest(base)) return unverified();
    const heard = await transcribe({ input: base, signal });
    const words = normalizeTranscriptWords(heard);
    if (!words.length) return unverified();
    return assessNarrationOverSpeech(record.lines, speechSpansFromWords(words));
  } catch (error) { if (signal?.aborted) throw error; return unverified(); }
}
