#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2e = process.argv.includes('--e2e');
const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const env = {
  ...process.env,
  OVS_VIDEO_TEST: '1',
  ...(e2e ? { OVS_E2E: '1' } : {}),
};

function runPnpm(args) {
  const result = spawnSync(corepack, ['pnpm', ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (e2e) runPnpm(['build']);

const tests = e2e
  ? [
      'packages/tools/test/gen.test.ts',
      'packages/tools/test/video-generation-smoke.test.ts',
      'packages/tools/test/render-e2e.test.ts',
      'packages/tools/test/cli-smoke.test.ts',
    ]
  : [
      'packages/tools/test/gen.test.ts',
      'packages/tools/test/video-generation-smoke.test.ts',
    ];

runPnpm(['exec', 'vitest', 'run', ...tests]);
