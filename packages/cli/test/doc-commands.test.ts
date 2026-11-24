import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The skill pack and README are the interface a coding agent reads; every `ovs`
// command they show must exist with the options it names. citty ignores
// undeclared options, so a wrong flag otherwise fails silently at run time.
// Importing the entry runs `runMain`; capture its command tree instead.
const captured = vi.hoisted(() => ({ main: undefined as unknown }));
vi.mock('citty', async (importOriginal) => ({
  ...(await importOriginal<typeof import('citty')>()),
  runMain: (command: unknown) => { captured.main = command; },
}));

type ArgDef = { type?: string };
type Command = { args?: Record<string, ArgDef>; subCommands?: Record<string, Command> };

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const skillsDir = join(repo, 'packages/skills');

function markdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === 'node_modules') return [];
    if (d.isDirectory()) return markdown(join(dir, d.name));
    return d.name.endsWith('.md') ? [join(dir, d.name)] : [];
  });
}

/** Shell-like split that keeps quoted strings and `<placeholder text>` whole. */
function tokens(text: string): string[] {
  return text.match(/'[^']*'|"[^"]*"|<[^>]*>|[^\s'"<]+(?:<[^>]*>)?/g) ?? [];
}

const flagName = (token: string) => token.replace(/^--/, '').split('=')[0];
const isPlaceholder = (token: string) => /^<.*>$/.test(token) || token === '…' || token === '...';

function options(command: Command): Set<string> {
  const names = new Set(['help']);
  for (const [name, def] of Object.entries(command.args ?? {})) {
    if (def.type === 'positional') continue;
    names.add(name);
    if (def.type === 'boolean') names.add(`no-${name}`);
  }
  return names;
}

function allOptions(command: Command, into = new Set<string>()): Set<string> {
  for (const name of options(command)) into.add(name);
  for (const sub of Object.values(command.subCommands ?? {})) allOptions(sub, into);
  return into;
}

/** Problems with one `ovs …` invocation (first token is `ovs`). */
function checkInvocation(main: Command, words: string[]): string[] {
  let node = main;
  const path = ['ovs'];
  let i = 1;
  for (; i < words.length; i++) {
    const word = words[i];
    if (word.startsWith('-') || !node.subCommands) break;
    if (isPlaceholder(word)) return [];
    const next = node.subCommands[word];
    if (!next) return [`\`${path.join(' ')}\` has no subcommand \`${word}\``];
    node = next;
    path.push(word);
  }
  const known = options(node);
  return words.slice(i)
    .filter((word) => word.startsWith('--'))
    .map(flagName)
    .filter((name) => name && !known.has(name))
    .map((name) => `\`${path.join(' ')}\` has no option \`--${name}\``);
}

type Snippet = { where: string; text: string; kind: 'command' | 'flags' | 'prefixed' };

/** `ovs` commands in fenced blocks and inline code; in skill docs also bare `--flag`
 *  spans and spans that put another word before `ovs` (`stage-edit ovs scenes`). */
function snippets(file: string): Snippet[] {
  const rel = relative(repo, file);
  const inSkills = file.startsWith(skillsDir);
  const found: Snippet[] = [];
  let fenced = false;
  let pending = '';
  readFileSync(file, 'utf8').split('\n').forEach((raw, index) => {
    const where = `${rel}:${index + 1}`;
    if (/^\s*```/.test(raw)) { fenced = !fenced; pending = ''; return; }
    if (fenced) {
      const line = pending + raw.replace(/\s#\s.*$/, '');
      if (/\\\s*$/.test(line)) { pending = line.replace(/\\\s*$/, ' '); return; }
      pending = '';
      for (const part of line.split(/&&|\|\||;|\|/)) {
        const text = part.trim().replace(/^\$\s+/, '').replace(/^(?:[A-Z_]+=\S+\s+)+/, '');
        if (/^ovs(\s|$)/.test(text)) found.push({ where, text, kind: 'command' });
      }
      return;
    }
    for (const match of raw.matchAll(/`([^`]+)`/g)) {
      const text = match[1].trim();
      if (/^ovs(\s|$)/.test(text)) found.push({ where, text, kind: 'command' });
      else if (inSkills && text.startsWith('--')) found.push({ where, text, kind: 'flags' });
      else if (inSkills && /^[\w.-]+\s+ovs(\s|$)/.test(text)) found.push({ where, text, kind: 'prefixed' });
    }
  });
  return found;
}

describe('documented ovs commands', () => {
  let main: Command;
  beforeAll(async () => {
    await import('../src/index.js');
    main = captured.main as Command;
  });

  const files = [...markdown(skillsDir), join(repo, 'README.md'), join(repo, 'AGENTS.md')];

  it('finds the commands it checks', () => {
    expect(main?.subCommands?.edit?.subCommands?.['remove-fillers']).toBeDefined();
    const all = files.flatMap(snippets);
    expect(all.filter((s) => s.kind === 'command').length).toBeGreaterThan(100);
  });

  it('name only subcommands and options the CLI declares', () => {
    const every = allOptions(main);
    const problems = files.flatMap(snippets).flatMap(({ where, text, kind }) => {
      const words = tokens(text);
      if (kind === 'command') return checkInvocation(main, words).map((p) => `${where}: ${p}`);
      if (kind === 'prefixed') return [`${where}: \`${text}\` does not start with \`ovs\``];
      return words.filter((w) => w.startsWith('--')).map(flagName)
        .filter((name) => !every.has(name))
        .map((name) => `${where}: no ovs command has \`--${name}\``);
    });
    expect(problems).toEqual([]);
  });

  it('rejects the wrong forms a reader would otherwise run', () => {
    const problems = (text: string) => checkInvocation(main, tokens(text));
    expect(problems('ovs phrases clip.mp4 --transcript t.json --output view.json')).toEqual(['`ovs phrases` has no option `--output`']);
    expect(problems('ovs edit trim-silence clip.mp4 --op remove-fillers --out t.mp4')).toEqual(['`ovs edit trim-silence` has no option `--op`']);
    expect(problems('ovs image-prepare --project . --request inspect.json')).toEqual(['`ovs image-prepare` has no option `--request`']);
    expect(problems('ovs plan cost plan.json')).toEqual(['`ovs plan` has no subcommand `cost`']);
    expect(problems('ovs studio --production p --no-open')).toEqual([]);
    expect(problems('ovs <command> --help')).toEqual([]);
  });
});
