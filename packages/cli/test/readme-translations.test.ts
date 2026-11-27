import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// README.md is the English source. Each README.<lang>.md in its language
// switcher translates the prose only: code, inline code, links and structure
// match the English, so a README change that skips the translations fails here.
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFileSync(join(repo, name), 'utf8');

function parse(text: string) {
  const lines = text.split('\n');
  const fences: string[] = [];
  const prose: string[] = [];
  let open: string[] | null = null;
  for (const line of lines) {
    if (open) {
      open.push(line);
      if (/^\s*```\s*$/.test(line)) { fences.push(open.join('\n')); open = null; }
    } else if (/^\s*```/.test(line)) open = [line];
    else prose.push(line);
  }
  const body = prose.join('\n');
  const headings = prose.filter((l) => /^#{1,6} /.test(l));
  const targets = [...body.replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  const bare = prose.map((l) => l.trim()).filter((l) => /^https?:\/\/\S+$/.test(l));
  return {
    lines,
    fences,
    headings,
    levels: headings.map((h) => h.indexOf(' ')),
    inline: [...body.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).sort(),
    links: [...targets.filter((t) => !t.startsWith('#')), ...bare].sort(),
    anchors: targets.filter((t) => t.startsWith('#')).map((t) => decodeURIComponent(t.slice(1))),
    tableRows: prose.filter((l) => /^\s*\|/.test(l)).length,
  };
}

/** The anchor GitHub gives a heading: markup dropped, lowercased, punctuation and symbols removed, spaces to hyphens. */
function slug(heading: string): string {
  return heading.replace(/^#+ /, '').trim()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*~]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

function headingAnchors(headings: string[]): Set<string> {
  const seen = new Map<string, number>();
  return new Set(headings.map((h) => {
    const base = slug(h);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  }));
}

const english = parse(read('README.md'));
const switcher = english.lines.find((l) => l.startsWith('[English](./README.md)')) ?? '';
const translations = [...switcher.matchAll(/\]\(\.\/(README\.[\w-]+\.md)\)/g)].map((m) => m[1]);

describe('README translations', () => {
  it('lists every translation on disk exactly once', () => {
    expect(translations.length).toBeGreaterThan(10);
    expect(new Set(translations).size).toBe(translations.length);
    const onDisk = readdirSync(repo).filter((n) => /^README\.[\w-]+\.md$/.test(n)).sort();
    expect(onDisk).toEqual([...translations].sort());
  });

  it.each(translations)('%s keeps the code, links and structure of README.md', (name) => {
    const t = parse(read(name));
    expect(t.lines).toContain(switcher);
    expect(t.fences).toEqual(english.fences);
    expect(t.inline).toEqual(english.inline);
    expect(t.links).toEqual(english.links);
    expect(t.levels).toEqual(english.levels);
    expect(t.tableRows).toBe(english.tableRows);
    expect(t.anchors.length).toBe(english.anchors.length);
  });

  it.each(['README.md', ...translations])('%s links only to headings it has', (name) => {
    const t = parse(read(name));
    const known = headingAnchors(t.headings);
    expect(t.anchors.filter((a) => !known.has(a))).toEqual([]);
  });

  it('computes the anchors GitHub renders', () => {
    // Pairs taken from GitHub's own rendering of these headings.
    expect(slug('## OrkasVideoStudio vs Claude Motion vs CapCut')).toBe('orkasvideostudio-vs-claude-motion-vs-capcut');
    expect(slug('### From source (works today)')).toBe('from-source-works-today');
    expect(slug('## 常见问题（FAQ）')).toBe('常见问题faq');
    expect(slug('## 一起运行 Claude Code、Codex、OpenCode、OpenClaw 和 Hermes-Agent')).toBe('一起运行-claude-codecodexopencodeopenclaw-和-hermes-agent');
    expect(slug('## شغّل وكلاء Claude Code وCodex وOpenCode وOpenClaw وHermes-Agent معًا')).toBe('شغّل-وكلاء-claude-code-وcodex-وopencode-وopenclaw-وhermes-agent-معًا');
    expect(slug('## รัน Claude Code, Codex, OpenCode, OpenClaw และ Hermes-Agent ให้ทำงานร่วมกัน')).toBe('รัน-claude-code-codex-opencode-openclaw-และ-hermes-agent-ให้ทำงานร่วมกัน');
    expect(slug("### Limites d'exécution et reprise")).toBe('limites-dexécution-et-reprise');
    expect(headingAnchors(['## Notes', '### Notes'])).toEqual(new Set(['notes', 'notes-1']));
  });
});
