import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readdirSync, existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

function skillsRoot(): string {
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
  if (!existsSync(p)) throw new Error(`unknown skill "${name}"`);
  return readFileSync(p, 'utf8');
}
