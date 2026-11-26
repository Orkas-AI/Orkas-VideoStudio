import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (existsSync('.git')) {
  const paths = execFileSync('git', ['ls-files', '--cached', '-z', '--',
    ':(glob)**/ovs-model-eval-*/**', ':(glob)**/*-model-eval.retained.json',
    ':(glob)eval/video/results/**',
  ], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of paths) console.error(`Keep model evaluation output outside Git: ${path}`);
  if (paths.length) process.exitCode = 1;
}
