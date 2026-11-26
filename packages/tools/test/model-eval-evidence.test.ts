import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deliveries, digest } from '../../../eval/video/delivery.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('public model evaluation delivery evidence', () => {
  function fixture() {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'ovs-model-receipt-')));
    roots.push(root);
    const production = join(root, 'production');
    const file = join(production, 'versions', 'clip-v1.mp4');
    mkdirSync(join(production, 'versions'), { recursive: true });
    writeFileSync(file, 'fixture bytes');
    const version = { id: 'v1', product_facts: [{ id: 'fact', text: 'A fixture.' }], path: 'versions/clip-v1.mp4', sha256: digest(file) };
    writeFileSync(join(production, 'versions.json'), JSON.stringify({ versions: [version] }));
    const receipt = { type: 'item.completed', item: {
      type: 'command_execution', command: 'ovs timeline ship --production production', exit_code: 0,
      aggregated_output: 'diagnostic header\n' + JSON.stringify({ ok: true, version }, null, 2) + '\n',
    } };
    return { root, file, version, receipt, production };
  }

  it('requires both a public ship receipt and the matching immutable version', () => {
    const { root, file, version, receipt } = fixture();
    expect(deliveries(root, [])).toEqual([]);
    expect(deliveries(root, [receipt])).toMatchObject([{ file, id: 'v1', sha256: version.sha256 }]);
    writeFileSync(file, 'modified output');
    expect(deliveries(root, [receipt])).toEqual([]);
  });

  it('rejects a rejected or overridden delivery', () => {
    const { root, receipt, production, version } = fixture();
    expect(deliveries(root, [{ ...receipt, item: { ...receipt.item, exit_code: 1 } }])).toEqual([]);
    writeFileSync(join(production, 'versions.json'), JSON.stringify({
      versions: [{ ...version, override: { reason: 'test override' } }],
    }));
    expect(deliveries(root, [receipt])).toEqual([]);
  });
});
