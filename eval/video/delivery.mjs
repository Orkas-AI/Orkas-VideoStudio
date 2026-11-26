import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { join, resolve, sep } from 'node:path';

const maximumFileBytes = 128 * 1024 * 1024;

export function digest(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > maximumFileBytes) return undefined;
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function contained(root, file) {
  return fs.realpathSync(file).startsWith(root + sep);
}

function deliveryReceipts(events) {
  return events.flatMap(({ type, item }) => {
    if (type !== 'item.completed' || item?.type !== 'command_execution' || item.exit_code !== 0
      || !/\btimeline\s+ship\b/.test(item.command ?? '')) return [];
    const output = item.aggregated_output ?? '';
    const json = output.matchAll(/^\{\s*"ok"\s*:\s*true\s*,\s*"version"\s*:[\s\S]*?^\}/gm);
    return [...json].flatMap(([receipt]) => {
      const version = JSON.parse(receipt).version;
      return typeof version?.path === 'string' && version.path.endsWith('.mp4') && /^[0-9a-f]{64}$/.test(version.sha256 ?? '')
        ? [{ path: version.path, sha256: version.sha256 }]
        : [];
    });
  });
}

export function deliveries(workspace, events) {
  workspace = fs.realpathSync(workspace);
  const receipts = deliveryReceipts(events);
  const versions = [];
  const visit = (dir, depth) => {
    if (depth > 5) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.name.startsWith('.') || ['attachments', 'media', 'preview', 'render', 'versions'].includes(entry.name)) continue;
      if (entry.isDirectory()) visit(file, depth + 1);
      if (!entry.isFile() || entry.name !== 'versions.json' || fs.statSync(file).size > 1024 * 1024) continue;
      const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const version of ledger.versions ?? []) {
        if (version.override || !receipts.some(receipt => receipt.path === version.path && receipt.sha256 === version.sha256)) continue;
        const output = resolve(dir, version.path);
        if (!output.startsWith(join(dir, 'versions') + sep) || !fs.existsSync(output) || !contained(workspace, output)) continue;
        if (digest(output) === version.sha256) versions.push({ id: version.id, file: output, sha256: version.sha256, production: dir });
      }
    }
  };
  visit(workspace, 0);
  return versions;
}
