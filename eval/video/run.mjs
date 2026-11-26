import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { containsWorkingVideo, deliveries, digest } from './delivery.mjs';
import { shouldRunStep, validateCases } from './case-flow.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).cases;
const cli = join(repo, 'packages', 'cli', 'dist', 'index.js');
const defaultTurnTimeoutSeconds = 20 * 60;
const localNetworkProfile = 'permissions.ovs-eval={extends=":workspace",network={enabled=true,mode="limited",allow_local_binding=true,domains={"localhost"="allow","127.0.0.1"="allow"}}}';

function actorEnvironment(bin, config, tools) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(?:OVS_|BASH_ENV$|ENV$|NODE_OPTIONS$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$)/i.test(name)
    && !/(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/i.test(name)));
  return {
    ...env,
    PATH: [bin, dirname(tools.ffmpeg), process.env.PATH].join(delimiter),
    OVS_CONFIG_DIR: config, OVS_FFMPEG_PATH: tools.ffmpeg, OVS_FFPROBE_PATH: tools.ffprobe,
    OVS_STUDIO_AUTO_OPEN: '0', NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1',
  };
}

async function actorTurn({ cwd, env, model, prompt, resume, persistent, localNetwork, stageDir, timeoutSeconds }) {
  const common = ['--json', '--ignore-user-config', '--skip-git-repo-check', '--model', model,
    '-c', 'shell_environment_policy.inherit=all',
    '--output-last-message', join(stageDir, 'reply.txt')];
  if (!persistent) common.push('--ephemeral');
  const permissions = localNetwork
    ? ['-c', localNetworkProfile, '-c', 'default_permissions="ovs-eval"']
    : ['--sandbox', 'workspace-write'];
  const args = [...permissions, '--ask-for-approval', 'never', '--cd', cwd, 'exec',
    ...(resume ? ['resume', ...common, resume, '-'] : [...common, '-'])];
  const eventLog = join(stageDir, 'actor.jsonl');
  const stdout = fs.openSync(eventLog, 'wx', 0o600);
  const stderr = fs.openSync(join(stageDir, 'actor-stderr.log'), 'wx', 0o600);
  let expired = false;
  const start = Date.now();
  let exit;
  try {
    exit = await new Promise((resolve, reject) => {
      const child = spawn('codex', args, { cwd, env, stdio: ['pipe', stdout, stderr], detached: true });
      const timer = setTimeout(() => {
        expired = true;
        if (child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') reject(error); }
        }
      }, timeoutSeconds * 1000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => { clearTimeout(timer); resolve(code); });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
  } finally {
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
  if (fs.statSync(eventLog).size > 64 * 1024 * 1024) throw new Error('Actor log exceeded the evidence limit');
  const events = fs.readFileSync(eventLog, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const terminal = events.findLast(event => event.type === 'turn.completed' || event.type === 'turn.failed');
  const thread = events.find(event => event.type === 'thread.started')?.thread_id;
  return {
    events, exit, expired, thread, seconds: (Date.now() - start) / 1000,
    completed: exit === 0 && terminal?.type === 'turn.completed' && !!thread && !expired,
    usage: terminal?.usage ?? null,
  };
}

function hashes(files) {
  return files.map(local => {
    const sha256 = digest(local);
    if (!sha256) throw new Error('Missing or oversized evaluation input');
    return { local, sha256 };
  });
}

async function runCase(entry, model, folder, timeoutSeconds, prepareOnly) {
  const { seed } = await import('./fixtures.mjs');
  const { runMedia, mediaTools, probeMedia, speak } = await import('./media.mjs');
  const { scoreCase } = await import('./score.mjs');
  const { startVoice } = await import('./voice.mjs');
  const { evenTimes, frameSheet, visualTimeline, visualSampleTimes } = await import('./evidence.mjs');
  const { startFixtureServer } = await import('./fixture-server.mjs');
  const cwd = join(folder, 'workspace');
  const config = join(folder, 'config');
  const bin = join(folder, 'bin');
  const reportPath = join(folder, 'result.json');
  const report = { case: entry.id, sourceCaseId: entry.sourceCaseId, actor: prepareOnly ? null : model, judge: null,
    timeoutSeconds, turns: [], checks: [], manualReview: entry.review, ...(entry.scope ? { scope: entry.scope } : {}) };
  let voice;
  let service;
  let seeded;
  let phase = 'preflight';
  try {
    const tools = mediaTools();
    if (process.platform === 'win32') throw new Error('The model runner requires a POSIX shell and process groups');
    if (!fs.existsSync(cli)) throw new Error('Build the OVS CLI first with pnpm build');
    if (!prepareOnly) execFileSync('codex', ['login', 'status'], { timeout: 15000, stdio: 'ignore' });
    fs.mkdirSync(join(cwd, 'attachments'), { recursive: true });
    for (const dir of [bin, config]) fs.mkdirSync(dir);
    const env = actorEnvironment(bin, config, tools);
    const shQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    fs.writeFileSync(join(bin, 'ovs'), `#!/bin/sh\nexec ${shQuote(process.execPath)} ${shQuote(cli)} "$@"\n`, { mode: 0o500 });
    fs.cpSync(join(repo, 'AGENTS.md'), join(cwd, 'AGENTS.md'));
    execFileSync(process.execPath, [cli, 'skills', '--install', '--target', 'codex', '--scope', 'repo'], { cwd, env, timeout: 30000, stdio: 'ignore' });
    const fixtureDirectory = join(folder, 'fixture');
    fs.mkdirSync(join(fixtureDirectory, 'attachments'), { recursive: true });
    if (typeof seed[entry.fixture] !== 'function') throw new Error(`Missing fixture: ${entry.fixture}`);
    const makeFixture = () => seed[entry.fixture](fixtureDirectory, tools, entry);
    // The actor can read sibling paths. A late upload must not exist anywhere
    // in the run until the evaluator issues the turn that actually attaches it.
    if (prepareOnly || entry.mode !== 'late-attachments') seeded = await makeFixture();
    const { attachments = [], outside = [] } = seeded ?? {};
    let truth = seeded?.truth ?? { kind: 'footage' };
    const protectedSource = hashes([...attachments, ...(seeded?.later ?? []), ...outside]);
    const copyInputs = sources => sources.map(source => {
      const local = join(cwd, 'attachments', basename(source));
      fs.copyFileSync(source, local, fs.constants.COPYFILE_EXCL);
      return { local, sha256: protectedSource.find(input => input.local === source).sha256 };
    });
    const inputs = copyInputs(attachments);
    const language = truth.language;
    const configJson = {};
    if (!prepareOnly && (entry.fixture === 'dub' || entry.voice)) {
      await speak(language === 'tr' ? 'Ses kontrolü.' : 'Local evaluation voice check.', language === 'tr' ? 'Yelda' : 'Samantha');
      voice = await startVoice(folder, { language, limit: entry.mode === 'long-form' ? 80 : 24 });
      configJson.tts = { provider: 'openai-compatible', base_url: voice.baseUrl, api_key: 'local-fixture', model: 'tts-1', voice: 'alloy', format: 'wav' };
    }
    if (entry.service) {
      service = await startFixtureServer(seeded, entry.service);
      if (entry.service === 'budget') configJson.video = { provider: 'doubao', base_url: service.baseUrl, api_key: 'local-fixture' };
    }
    fs.writeFileSync(join(config, 'config.json'), JSON.stringify(configJson), { mode: 0o400 });
    if (prepareOnly) {
      report.result = 'prepared';
      report.checks = [{ id: 'fixture-ready', pass: true, detail: { attachments: attachments.length, later: seeded.later?.length ?? 0, outside: outside.length } }];
      return report;
    }
    const asrModel = process.env.OVS_EVAL_ASR_MODEL;
    const usesAsr = entry.asr || ['retakes', 'dub', 'talk'].includes(truth.kind);
    if (usesAsr && asrModel) {
      const transcript = join(folder, 'asr-preflight.json');
      try {
        const source = truth.file ?? truth.episodes[0].file;
        execFileSync(process.execPath, [cli, 'transcribe', source, '--model', asrModel, '--language', 'zh', '--out', transcript],
          { cwd, env, timeout: entry.maxDuration ? 360000 : 180000, stdio: 'pipe' });
        if (!JSON.parse(fs.readFileSync(transcript, 'utf8')).words?.length) throw new Error('No timed words');
      } catch (error) {
        throw new Error(`Public ASR preflight failed for ${asrModel}: ${String(error.stderr || error.message).trim().slice(0, 1000)}`);
      }
    }
    const stages = [];
    const steps = [{ prompt: entry.prompt }, ...(entry.steps ?? [])];
    const journey = entry.mode === 'revision-journey';
    for (const [index, step] of steps.entries()) {
      const previous = stages.at(-1);
      if (index > 0 && !shouldRunStep(step, previous)) break;
      phase = 'actor';
      const stageDir = join(folder, `turn-${index + 1}`);
      fs.mkdirSync(stageDir);
      let prompt = step.prompt;
      if (step.attachments === 'later' && !seeded) {
        seeded = await makeFixture();
        truth = seeded.truth;
        protectedSource.push(...hashes(seeded.later));
      }
      const turnInputs = index === 0 ? inputs.slice() : step.attachments === 'later' ? copyInputs(seeded.later) : [];
      if (index > 0) inputs.push(...turnInputs);
      if (turnInputs.length) prompt += '\n附件：' + turnInputs.map(input => relative(cwd, input.local)).join('、');
      if (index === 0) {
        if (outside.length) prompt = prompt.replace('<path>', () => outside[0]);
        if (entry.service === 'page') {
          prompt = prompt.replace('<product-page>', service.baseUrl + '/product');
          prompt += '\n这首免付费背景音乐可以用：' + service.baseUrl + '/music.wav';
        }
        if (entry.service === 'stock') prompt = prompt.replace('<stock-library>', service.baseUrl + '/catalog.json');
        if (entry.mode !== 'skill-routing') {
          prompt += '\nThis is a local production task. Use the installed video-studio skill and inspect the finished video. Deliver using ovs timeline ship. Use supplied assets and the stated local services only.';
        }
        if (asrModel && usesAsr) prompt += entry.mode === 'skill-routing'
          ? `\n本机已装 ${asrModel} 中文转写模型。`
          : `\n本机已预装的转写模型是 ${asrModel}，可用 ovs transcribe --model ${asrModel} --language zh。`;
        if (voice) prompt += '\nThe configured local WAV speech through ovs speak is free.';
      } else if (step.reopen) {
        prompt = prompt.replace('<previous-production>', relative(cwd, previous.delivery.production));
        prompt += '\n请从磁盘上的这份工程恢复并用 ovs timeline ship 交付。';
      }
      const turn = await actorTurn({ cwd, env, model, prompt, resume: step.reopen ? undefined : previous?.thread,
        persistent: steps.length > 1 && !step.reopen,
        localNetwork: !!voice || !!service || truth.kind !== 'retakes', stageDir, timeoutSeconds });
      phase = 'evidence';
      const old = new Set(stages.flatMap(stage => stage.versions.map(version => version.file)));
      const versions = deliveries(cwd, turn.events).filter(version => !old.has(version.file));
      const delivery = versions.at(-1);
      const record = { number: index + 1, thread: turn.thread, expired: turn.expired, exit: turn.exit,
        completed: turn.completed, seconds: turn.seconds, usage: turn.usage, versions: [] };
      report.turns.push(record);
      if (versions.length > 8) throw new Error('Too many versions for the bounded evidence scan');
      for (const [versionIndex, version] of versions.entries()) {
        version.probe = await probeMedia(tools, version.file);
        if (!version.probe.hasVideo || !(version.probe.duration > 0 && version.probe.duration <= (entry.maxDuration ?? 60))) {
          throw new Error('Delivered video is missing a bounded, readable picture stream');
        }
        await runMedia(tools.ffmpeg, ['-v', 'error', '-xerror', '-nostdin', '-i', version.file, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-'],
          undefined, 300_000);
        version.visual = await visualTimeline(tools, version.file);
        const samples = visualSampleTimes(version.visual, 8);
        const sheet = join(stageDir, `version-${versionIndex + 1}-frames.png`);
        fs.writeFileSync(sheet, await frameSheet(tools, version.file, samples, truth.kind === 'tutorial' ? 400 : 270));
        record.versions.push({ ...version, file: relative(folder, version.file), frames: relative(folder, sheet), sampleSeconds: samples });
      }
      const browserError = turn.events.some(event => event.item?.exit_code !== 0
        && /(?:Failed to launch (?:the browser process|chromium)|mach port rendezvous|SecTaskLoadEntitlements|ThermalState|Failed to create a ProcessSingleton)/i.test(event.item?.aggregated_output ?? ''));
      const prematureMedia = entry.mode === 'late-attachments' && index === 0 && containsWorkingVideo(cwd);
      record.prematureMedia = prematureMedia;
      stages.push({ ...turn, versions, delivery, browserError, step, prematureMedia });
    }
    const references = truth.kind === 'reference' ? [truth.reference, ...(truth.source ? [truth.source] : [])] : [];
    if (references.length) {
      report.referenceFrames = [];
      for (const [index, item] of references.entries()) {
        const file = join(folder, `reference-${index + 1}-frames.png`);
        const times = evenTimes(item.duration, 6);
        fs.writeFileSync(file, await frameSheet(tools, item.file, times, 270));
        report.referenceFrames.push({ file: relative(folder, file), sourceSha256: digest(item.file), sampleSeconds: times });
      }
    }
    const serviceRequests = service?.requests ?? [];
    const checks = await scoreCase(tools, truth, stages, voice?.requests ?? [], { journey, entry, serviceRequests });
    const allVersions = stages.flatMap(stage => stage.versions);
    checks.unshift(
      { id: 'all-turns-completed', pass: stages.length === steps.length && stages.every(stage => stage.completed) },
      { id: 'preserves-inputs', pass: [...inputs, ...protectedSource].every(input => digest(input.local) === input.sha256) },
      { id: 'preserves-deliveries', pass: allVersions.length >= (entry.deliveryCount ?? (journey ? steps.length : 1))
        && allVersions.every(version => digest(version.file) === version.sha256) },
    );
    if (journey) checks.push({ id: 'same-production', pass: !!allVersions.length && new Set(allVersions.map(version => version.production)).size === 1 });
    if (voice) report.localSpeechRequests = voice.attempted();
    if (service) report.localServiceRequests = serviceRequests;
    report.checks = checks;
    report.result = checks.every(check => check.pass) ? 'objective-pass'
      : stages.some(stage => !stage.delivery && stage.browserError) ? 'environment-blocked' : 'failed';
  } catch (error) {
    report.result = phase === 'preflight' ? 'environment-blocked' : 'error';
    report.error = { phase, message: error.message };
  } finally {
    await service?.close();
    await voice?.close();
    if (seeded) {
      const { truth, attachments, later = [], outside = [] } = seeded;
      fs.writeFileSync(join(folder, 'fixture.json'), JSON.stringify({ truth, attachments, later, outside }, null, 2), { mode: 0o600 });
    }
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}

function requireOutsideGit(directory) {
  let existing = directory;
  while (!fs.existsSync(existing)) existing = dirname(existing);
  for (const root of [directory, fs.realpathSync(existing)]) {
    let cursor = root;
    for (;;) {
      if (fs.existsSync(join(cursor, '.git'))) {
        throw new Error('Model evaluation output must be outside Git worktrees. Choose an external --output-dir.');
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
}

const { values } = parseArgs({
  options: { list: { type: 'boolean' }, prepare: { type: 'boolean' }, case: { type: 'string', multiple: true }, model: { type: 'string' },
    'output-dir': { type: 'string' }, 'turn-timeout-seconds': { type: 'string' } },
});
if (values.list) {
  for (const item of catalog) console.log(`${item.id}\t${item.sourceCaseId}`);
} else {
  if (!values.case?.length) throw new Error('Select --case <id> or --case all; use --list to see the catalog');
  const selected = values.case.includes('all') ? catalog : [...new Set(values.case)].map(id => {
    const entry = catalog.find(item => item.id === id);
    if (!entry) throw new Error(`Unknown case: ${id}`);
    return entry;
  });
  const timeoutSeconds = values['turn-timeout-seconds'] === undefined ? undefined : Number(values['turn-timeout-seconds']);
  if (timeoutSeconds !== undefined && (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 3600)) {
    throw new Error('Use --turn-timeout-seconds with an integer from 30 to 3600.');
  }
  const parent = resolve(values['output-dir'] ?? tmpdir());
  requireOutsideGit(parent);
  validateCases(catalog, (await import('./fixtures.mjs')).seed);
  fs.mkdirSync(parent, { recursive: true });
  requireOutsideGit(parent);
  const run = fs.realpathSync(fs.mkdtempSync(join(parent, 'ovs-model-eval-')));
  const model = values.model || 'gpt-6-luna';
  console.log(`Model evidence: ${run}`);
  for (const entry of selected) {
    const folder = join(run, entry.id);
    fs.mkdirSync(folder);
    const report = await runCase(entry, model, folder, timeoutSeconds ?? entry.turnTimeoutSeconds ?? defaultTurnTimeoutSeconds, values.prepare);
    console.log(`${entry.id}\t${report.result}\t${join(folder, 'result.json')}`);
    if (report.result !== (values.prepare ? 'prepared' : 'objective-pass')) process.exitCode = 1;
  }
}
