import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { DEFAULT_HYPERFRAMES_SPEC, hyperframesNpxArgs, resolveBinaries } from '@orkas/video-studio-core';

export interface HyperframesInvocation {
  command: string;
  args: string[];
  source: 'dependency' | 'override' | 'npx-fallback';
}

interface HyperframesPackageJson {
  bin?: string | Record<string, string>;
}

function dependencyCliPath(): string {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve('hyperframes/package.json');
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as HyperframesPackageJson;
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.hyperframes;
  if (!bin) throw new Error(`The installed HyperFrames package has no CLI bin entry: ${packagePath}`);
  return resolve(dirname(packagePath), bin);
}

/** Resolve the packaged HyperFrames CLI, with override and npx compatibility paths. */
export function resolveHyperframesInvocation(op: string, args: string[] = []): HyperframesInvocation {
  const override = process.env.OVS_HYPERFRAMES_BIN?.trim();
  if (override) return { command: override, args: [op, ...args], source: 'override' };

  try {
    return { command: process.execPath, args: [dependencyCliPath(), op, ...args], source: 'dependency' };
  } catch (dependencyError) {
    const { npx } = resolveBinaries();
    if (!npx) {
      const reason = dependencyError instanceof Error ? dependencyError.message : String(dependencyError);
      throw new Error(`HyperFrames ${DEFAULT_HYPERFRAMES_SPEC} is unavailable (${reason}) and npx fallback was not found.`);
    }
    return { command: npx, args: hyperframesNpxArgs(op, args), source: 'npx-fallback' };
  }
}
