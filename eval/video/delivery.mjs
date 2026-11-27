import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

const maximumFileBytes = 256 * 1024 * 1024;

export function digest(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > maximumFileBytes) return undefined;
  const fd = fs.openSync(file, 'r');
  try {
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let offset = 0;
    while (offset < stat.size) {
      const read = fs.readSync(fd, buffer, 0, Math.min(buffer.length, stat.size - offset), offset);
      if (!read) return undefined;
      hash.update(buffer.subarray(0, read));
      offset += read;
    }
    return fs.fstatSync(fd).size === stat.size ? hash.digest('hex') : undefined;
  } finally {
    fs.closeSync(fd);
  }
}

function contained(root, file) {
  return fs.realpathSync(file).startsWith(root + sep);
}

export function containsWorkingVideo(directory, depth = 0) {
  if (depth > 6) return false;
  return fs.readdirSync(directory, { withFileTypes: true }).some(entry => {
    if (entry.name.startsWith('.')) return false;
    if (entry.isDirectory()) return containsWorkingVideo(join(directory, entry.name), depth + 1);
    return entry.isFile() && /\.(?:mp4|m4v|mov|webm)$/i.test(entry.name);
  });
}

function deliveryReceipts(events) {
  return events.flatMap(({ type, item }) => {
    if (type !== 'item.completed' || item?.type !== 'command_execution' || item.exit_code !== 0
      || !/\btimeline\s+ship\b/.test(item.command ?? '')) return [];
    const output = item.aggregated_output ?? '';
    const json = output.matchAll(/^\{\s*"ok"\s*:\s*true\s*,\s*"version"\s*:[\s\S]*?^\}/gm);
    return [...json].flatMap(([receipt]) => {
      let payload;
      try { payload = JSON.parse(receipt); } catch { return []; }
      const { version, contact_sheet: contactSheet, frames } = payload;
      return typeof version?.path === 'string' && version.path.endsWith('.mp4') && /^[0-9a-f]{64}$/.test(version.sha256 ?? '')
        ? [{ id: version.id, path: version.path, sha256: version.sha256, evidence: contactSheet ?? frames?.[0]?.path }]
        : [];
    });
  });
}

function temporaryDeliveries(receipts, { temporaryRoots, runRoot, startedAt }) {
  const versions = new Map();
  const ledgers = new Map();
  for (const [receipt, { id, path, sha256, evidence }] of receipts.entries()) {
    if (typeof id !== 'string' || !/^versions\/[^/\\]+\.mp4$/.test(path)
      || typeof evidence !== 'string' || !isAbsolute(evidence) || resolve(evidence) !== evidence
      || !/^(?:contact-sheet\.svg|\d+\.png)$/.test(basename(evidence))) continue;
    // OVS emits absolute paths for its preview/<uuid> delivery frames and sheet.
    const preview = dirname(evidence);
    if (basename(dirname(preview)) !== 'preview' || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(basename(preview))) continue;
    const production = dirname(dirname(preview));
    if (production === runRoot || production.startsWith(runRoot + sep)
      || !temporaryRoots.some(root => production.startsWith(root + sep))) continue;
    try {
      if (fs.realpathSync(evidence) !== evidence || !fs.lstatSync(evidence).isFile()) continue;
      if (!ledgers.has(production)) {
        const ledgerPath = join(production, 'versions.json');
        const stat = fs.lstatSync(ledgerPath);
        if (!stat.isFile() || stat.size > 1024 * 1024) continue;
        const { versions: rows } = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
        ledgers.set(production, Array.isArray(rows) ? rows : []);
      }
      const row = ledgers.get(production).find(version => version?.id === id && version.path === path && version.sha256 === sha256);
      if (!row || row.override || !(Date.parse(row.shipped_at) >= startedAt)) continue;
      const file = join(production, path);
      if (fs.realpathSync(file) !== file || !(fs.lstatSync(file).mtimeMs >= startedAt) || digest(file) !== sha256) continue;
      versions.set(file, { id, file, sha256, production, videoId: row.video_id, receipt, temporary: true });
    } catch {
      // Missing, malformed or inaccessible external evidence cannot be scored.
    }
  }
  return [...versions.values()];
}

export function deliveries(workspace, events, scope) {
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
        const receipt = receipts.findLastIndex(item => item.path === version.path && item.sha256 === version.sha256);
        if (version.override || receipt < 0) continue;
        const output = resolve(dir, version.path);
        if (!output.startsWith(join(dir, 'versions') + sep) || !fs.existsSync(output) || !contained(workspace, output)) continue;
        if (digest(output) === version.sha256) versions.push({
          id: version.id, file: output, sha256: version.sha256, production: dir, videoId: version.video_id, receipt,
        });
      }
    }
  };
  visit(workspace, 0);
  if (scope && Number.isFinite(scope.startedAt)) versions.push(...temporaryDeliveries(receipts, scope));
  return versions.sort((a, b) => a.receipt - b.receipt).map(({ receipt, ...version }) => version);
}
