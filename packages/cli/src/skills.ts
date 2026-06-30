import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync, readFileSync, cpSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);

/** Absolute path to the installed @orkas/video-studio-skills package dir. */
export function skillsRoot(): string {
  return dirname(require.resolve('@orkas/video-studio-skills/package.json'));
}

export function listSkills(): string[] {
  const root = skillsRoot();
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
}

export function readSkill(name: string): string {
  const p = join(skillsRoot(), name, 'SKILL.md');
  if (!existsSync(p)) throw new Error(`unknown skill "${name}". Run \`ovs skills\` to list available skills.`);
  return readFileSync(p, 'utf8');
}

export type InstallTarget = 'claude' | 'codex';
export type InstallScope = 'user' | 'repo';

/** Where each agent runtime discovers skills. */
export function installDir(target: InstallTarget, scope: InstallScope, override?: string): string {
  if (override) return override;
  const folder = target === 'claude' ? '.claude' : '.agents';
  const base = scope === 'user' ? homedir() : process.cwd();
  return join(base, folder, 'skills');
}

export function installSkills(target: InstallTarget, scope: InstallScope, override?: string): { dest: string; installed: string[] } {
  const dest = installDir(target, scope, override);
  mkdirSync(dest, { recursive: true });
  const root = skillsRoot();
  const installed: string[] = [];
  for (const name of listSkills()) {
    cpSync(join(root, name), join(dest, name), { recursive: true });
    installed.push(name);
  }
  return { dest, installed };
}
