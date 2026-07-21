#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import {
  assessDelivery,
  estimateNarrationDuration,
  resolveGateTransition,
  summarizeEdl,
  validateCompositionManifest,
  validateEdl,
} from '../packages/core/dist/index.js';

const jsonOnly = process.argv.includes('--json');
const multiplierRaw = Number(process.env.OVS_BENCH_MULTIPLIER || 1);
const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 1;

function assert(condition, message) {
  if (!condition) throw new Error(`benchmark contract failed: ${message}`);
}

function percentile(values, ratio) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * ratio))];
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function runCase({ name, iterations, minOpsPerSecond, execute }) {
  const count = Math.max(1, Math.round(iterations * multiplier));
  let checksum = 0;
  for (let index = 0; index < Math.min(500, count); index += 1) checksum ^= execute(index);

  const samples = [];
  for (let sample = 0; sample < 7; sample += 1) {
    const started = performance.now();
    for (let index = 0; index < count; index += 1) checksum ^= execute(index + sample);
    samples.push(performance.now() - started);
  }
  const medianMs = percentile(samples, 0.5);
  const p95Ms = percentile(samples, 0.95);
  const opsPerSecond = count / (medianMs / 1000);
  assert(opsPerSecond >= minOpsPerSecond, `${name} throughput ${round(opsPerSecond)} ops/s is below ${minOpsPerSecond}`);
  return {
    name,
    iterations_per_sample: count,
    samples: samples.length,
    median_ms: round(medianMs, 3),
    p95_ms: round(p95Ms, 3),
    median_us_per_op: round((medianMs * 1000) / count, 3),
    ops_per_second: Math.round(opsPerSecond),
    minimum_ops_per_second: minOpsPerSecond,
    checksum,
    passed: true,
  };
}

function segment(id, order, source = 'compose') {
  const spec = source === 'edit'
    ? { input_id: `clip-${id}`, in_sec: 0, out_sec: 5 }
    : source === 'provided'
      ? { asset_id: `asset-${id}`, kind: 'video' }
      : { kind: 'motion-card' };
  return { id, order, role: order === 0 ? 'hook' : 'body', layer: 'primary', source, target_sec: 5, spec };
}

const edl = {
  aspect: '16:9',
  total_target_sec: 60,
  language: 'en',
  delivery_promise: { type: 'hybrid', source_required: true, motion_min_ratio: 0.3 },
  style_kit: { palette: ['#081018', '#f3f0e8', '#ffb000'], fonts: ['Inter'] },
  segments: Array.from({ length: 12 }, (_, index) => segment(`s${index + 1}`, index, index % 3 === 0 ? 'edit' : 'compose')),
  tracks: {},
};

const manifest = {
  schema_version: 2,
  composition: { id: 'main', width: 1920, height: 1080, duration: 60, target_duration: 60, fps: 30, language: 'en' },
  scenes: Array.from({ length: 12 }, (_, index) => ({
    id: `s${index + 1}`,
    start: index * 5,
    duration: 5,
    approved_copy: [`Scene ${index + 1}`],
    narration_refs: [],
    source_shots: [`shot-${index + 1}`],
    roles: [index === 0 ? 'hook' : index === 11 ? 'payoff' : 'body'],
  })),
  audio: { owner: 'none', tracks: [] },
  art_direction: { aesthetic: { signature_device: 'timeline ribbon' } },
};

const transitions = [
  [{ line: 'compose', artifact: 'composition', gate: 'preview', decision: 'revise', scope: 'visual_only', recovery: 'available' }, 'edit_and_restart_visual_qa'],
  [{ line: 'compose', artifact: 'composition', gate: 'gate_d', decision: 'revise', scope: 'visual_only', recovery: 'not_available' }, 'edit_current_cycle'],
  [{ line: 'compose', artifact: 'composition', gate: 'preview', decision: 'approve', scope: 'none', recovery: 'not_available' }, 'render_approved_preview'],
  [{ line: 'edit', artifact: 'production', approvalStatus: 'approved', artifactState: 'unchanged', recovery: 'not_available' }, 'continue_from_existing_approval'],
];

assert(validateEdl(edl).ok, 'EDL fixture must be valid');
assert(assessDelivery(edl).verdict === 'pass', 'delivery fixture must pass');
assert(summarizeEdl(edl).split('\n').filter((line) => /^\s+\d+\./.test(line)).length === 12, 'EDL summary must include every primary segment');
assert(validateCompositionManifest(manifest).ok, 'composition manifest fixture must be valid');
for (const [input, expected] of transitions) {
  assert(resolveGateTransition(input).next_action === expected, `gate transition must resolve ${expected}`);
}

const narrationSamples = [
  'A concise narration line with a measured delivery window.',
  '2017年，Transformer 与 GPT-4 改变了 AI。下一步，是 Agent。',
  'Numbers such as 16:9 and 1920 by 1080 need conservative timing.',
];

const suites = [
  runCase({
    name: 'gate-transition',
    iterations: 50_000,
    minOpsPerSecond: 100_000,
    execute(index) {
      const [input, expected] = transitions[index % transitions.length];
      const result = resolveGateTransition(input);
      return result.next_action === expected ? result.allowed_ops.length + 1 : 0;
    },
  }),
  runCase({
    name: 'edl-validation',
    iterations: 10_000,
    minOpsPerSecond: 20_000,
    execute() {
      const result = validateEdl(edl);
      return result.ok ? result.errors.length + result.warnings.length + 1 : 0;
    },
  }),
  runCase({
    name: 'edl-delivery-and-summary',
    iterations: 20_000,
    minOpsPerSecond: 10_000,
    execute() {
      const assessment = assessDelivery(edl);
      return assessment.verdict === 'pass' ? summarizeEdl(edl).length : 0;
    },
  }),
  runCase({
    name: 'composition-manifest-validation',
    iterations: 10_000,
    minOpsPerSecond: 20_000,
    execute() {
      const result = validateCompositionManifest(manifest);
      return result.ok ? (result.data?.scenes.length || 0) : 0;
    },
  }),
  runCase({
    name: 'narration-estimation',
    iterations: 50_000,
    minOpsPerSecond: 50_000,
    execute(index) {
      const result = estimateNarrationDuration(narrationSamples[index % narrationSamples.length], 1);
      return Math.round(result.estimatedSec * 100);
    },
  }),
];

const report = {
  schema_version: 1,
  benchmark: 'orkas-video-studio-core',
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  multiplier,
  suites,
  aggregate: {
    passed: suites.every((suite) => suite.passed),
    suite_count: suites.length,
    total_timed_operations: suites.reduce((total, suite) => total + suite.iterations_per_sample * suite.samples, 0),
  },
};

if (jsonOnly) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`Core benchmark (${report.node}, ${report.platform})\n`);
  for (const suite of suites) {
    process.stdout.write(`${suite.name.padEnd(34)} ${String(suite.ops_per_second).padStart(9)} ops/s  p50=${String(suite.median_us_per_op).padStart(7)} us/op  p95=${suite.p95_ms} ms\n`);
  }
  process.stdout.write(`PASS ${report.aggregate.suite_count} suites, ${report.aggregate.total_timed_operations} timed operations\n`);
}
