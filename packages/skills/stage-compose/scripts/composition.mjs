#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const [op, project] = process.argv.slice(2);
if ((op !== 'prepare' && op !== 'reconcile') || !project) {
  process.stderr.write('usage: node composition.mjs <prepare|reconcile> <composition-dir>\n');
  process.exit(2);
}

const ovs = process.env.OVS_BIN || 'ovs';
const result = spawnSync(ovs, ['composition', op, project], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
