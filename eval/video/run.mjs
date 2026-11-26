import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deliveries, digest } from './delivery.mjs';

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

async function runCase(entry, model, folder, timeoutSeconds) {
  const { seed } = await import('./fixtures.mjs');
  const { runMedia, mediaTools, probeMedia, speak } = await import('./media.mjs');
  const { scoreCase } = await import('./score.mjs');
  const { startVoice } = await import('./voice.mjs');
  const { detectCuts } = await import('./evidence.mjs');
  const cwd = join(folder, 'workspace');
  const config = join(folder, 'config');
  const bin = join(folder, 'bin');
  const reportPath = join(folder, 'result.json');
  const report = { case: entry.id, sourceCaseId: entry.sourceCaseId, actor: model, judge: null, timeoutSeconds, turns: [], checks: [], manualReview: entry.review };
  let voice;
  let phase = 'preflight';
  try {
    const tools = mediaTools();
    if (process.platform === 'win32') throw new Error('The model runner requires a POSIX shell and process groups');
    if (!fs.existsSync(cli)) throw new Error('Build the OVS CLI first with pnpm build');
    execFileSync('codex', ['login', 'status'], { timeout: 15000, stdio: 'ignore' });
    fs.mkdirSync(join(cwd, 'attachments'), { recursive: true });
    for (const dir of [bin, config]) fs.mkdirSync(dir);
    fs.writeFileSync(join(config, 'config.json'), '{}', { mode: 0o400 });
    const env = actorEnvironment(bin, config, tools);
    const shQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    fs.writeFileSync(join(bin, 'ovs'), `#!/bin/sh\nexec ${shQuote(process.execPath)} ${shQuote(cli)} "$@"\n`, { mode: 0o500 });
    fs.cpSync(join(repo, 'AGENTS.md'), join(cwd, 'AGENTS.md'));
    execFileSync(process.execPath, [cli, 'skills', '--install', '--target', 'codex', '--scope', 'repo'], { cwd, env, timeout: 30000, stdio: 'ignore' });
    if (entry.fixture === 'dub') {
      await speak('Local evaluation voice check.', 'Samantha');
      voice = await startVoice(folder);
      fs.chmodSync(join(config, 'config.json'), 0o600);
      fs.writeFileSync(join(config, 'config.json'), JSON.stringify({
        tts: { provider: 'openai-compatible', base_url: voice.baseUrl, api_key: 'local-fixture', model: 'tts-1', voice: 'alloy', format: 'wav' },
      }));
      fs.chmodSync(join(config, 'config.json'), 0o400);
    }
    const fixtureDirectory = join(folder, 'fixture');
    fs.mkdirSync(join(fixtureDirectory, 'attachments'), { recursive: true });
    const { attachments, truth } = await seed[entry.fixture](fixtureDirectory, tools);
    const inputs = attachments.map(source => {
      const local = join(cwd, 'attachments', basename(source));
      fs.copyFileSync(source, local);
      return { local, sha256: digest(source) };
    });
    const asrModel = process.env.OVS_EVAL_ASR_MODEL;
    if ((entry.fixture === 'retakes' || entry.fixture === 'dub') && asrModel) {
      const transcript = join(folder, 'asr-preflight.json');
      try {
        execFileSync(process.execPath, [cli, 'transcribe', truth.file, '--model', asrModel, '--language', 'zh', '--out', transcript],
          { cwd, env, timeout: 180000, stdio: 'pipe' });
        if (!JSON.parse(fs.readFileSync(transcript, 'utf8')).words?.length) throw new Error('No timed words');
      } catch (error) {
        throw new Error(`Public ASR preflight failed for ${asrModel}: ${String(error.stderr || error.message).trim().slice(0, 1000)}`);
      }
    }
    const stages = [];
    const steps = [{ prompt: entry.prompt }, ...(entry.steps ?? [])];
    for (const [index, step] of steps.entries()) {
      const previous = stages.at(-1);
      if (index > 0 && (!previous?.completed || !previous.delivery)) break;
      phase = 'actor';
      const stageDir = join(folder, `turn-${index + 1}`);
      fs.mkdirSync(stageDir);
      let prompt = step.prompt;
      if (index === 0) {
        prompt += '\n附件：' + inputs.map(input => relative(cwd, input.local)).join('、');
        prompt += '\n这是隔离的本地制作任务。请读取 video-studio skill，直接制作并查看最终成片，用 ovs timeline ship 交付。只用本地素材与已明确允许的本地工具，不连接外部素材或收费服务。';
        if (asrModel && (entry.fixture === 'retakes' || entry.fixture === 'dub')) prompt += `\n本机已预装的转写模型是 ${asrModel}，可用 ovs transcribe --model ${asrModel} --language zh。`;
        if (voice) prompt += '\n已配置本地测试语音，ovs speak 的 WAV 调用免费，允许使用。';
      } else if (step.reopen) {
        prompt = prompt.replace('<previous-production>', relative(cwd, previous.delivery.production));
        prompt += '\n请从磁盘上的这份工程恢复并用 ovs timeline ship 交付。';
      }
      const turn = await actorTurn({ cwd, env, model, prompt, resume: step.reopen ? undefined : previous?.thread,
        persistent: steps.length > 1 && !step.reopen, localNetwork: entry.fixture !== 'retakes', stageDir, timeoutSeconds });
      phase = 'evidence';
      const old = new Set(stages.flatMap(stage => stage.versions.map(version => version.file)));
      const versions = deliveries(cwd, turn.events).filter(version => !old.has(version.file));
      const delivery = versions.at(-1);
      const record = { number: index + 1, thread: turn.thread, expired: turn.expired, exit: turn.exit,
        completed: turn.completed, seconds: turn.seconds, usage: turn.usage, versions: versions.map(version => ({ ...version, file: relative(folder, version.file) })) };
      report.turns.push(record);
      if (delivery) {
        delivery.probe = await probeMedia(tools, delivery.file);
        if (!delivery.probe.hasVideo || !(delivery.probe.duration > 0 && delivery.probe.duration <= 60)) {
          throw new Error('Delivered video is missing a bounded, readable picture stream');
        }
        await runMedia(tools.ffmpeg, ['-v', 'error', '-xerror', '-nostdin', '-i', delivery.file, '-map', '0:v:0', '-map', '0:a?', '-f', 'null', '-']);
        const { cuts } = entry.fixture === 'montage' ? await detectCuts(tools, delivery.file) : { cuts: [] };
        const last = Math.max(0, delivery.probe.duration - Math.max(0.08, 2 / (delivery.probe.fps || 25)));
        const beforeAndAfter = entry.fixture === 'clip-montage' ? [1, 3.85, 4.15, 8, 12.85, 13.15, 16, 20] : [];
        const samples = [...new Set([0, ...beforeAndAfter, ...cuts.slice(0, 12).map(cut => cut + 0.08),
          ...Array.from({ length: 8 }, (_, sample) => (sample + 1) * last / 9), last]
          .filter(time => time >= 0 && time <= last).map(time => Number(time.toFixed(3))))].sort((a, b) => a - b);
        for (const [frame, time] of samples.entries()) {
          await runMedia(tools.ffmpeg, ['-v', 'error', '-nostdin', '-ss', String(time), '-i', delivery.file,
            '-vf', 'scale=320:-2', '-frames:v', '1', join(stageDir, `frame-${String(frame).padStart(2, '0')}.png`)]);
        }
        record.sampleSeconds = samples;
      }
      const browserError = turn.events.some(event => event.item?.exit_code !== 0
        && /(?:Failed to launch (?:the browser process|chromium)|mach port rendezvous|SecTaskLoadEntitlements|ThermalState|Failed to create a ProcessSingleton)/i.test(event.item?.aggregated_output ?? ''));
      stages.push({ ...turn, versions, delivery, browserError });
    }
    const checks = await scoreCase(tools, truth, stages, voice?.requests ?? []);
    const allVersions = stages.flatMap(stage => stage.versions);
    checks.unshift(
      { id: 'all-turns-completed', pass: stages.length === steps.length && stages.every(stage => stage.completed) },
      { id: 'preserves-inputs', pass: inputs.every(input => digest(input.local) === input.sha256) },
      { id: 'preserves-deliveries', pass: allVersions.length >= steps.length && allVersions.every(version => digest(version.file) === version.sha256) },
    );
    if (entry.fixture === 'clip-montage') checks.push({ id: 'same-production', pass: !!allVersions.length && new Set(allVersions.map(version => version.production)).size === 1 });
    if (voice) report.localSpeechRequests = voice.attempted();
    report.checks = checks;
    report.result = checks.every(check => check.pass) ? 'objective-pass'
      : stages.some(stage => !stage.delivery && stage.browserError) ? 'environment-blocked' : 'failed';
  } catch (error) {
    report.result = phase === 'preflight' ? 'environment-blocked' : 'error';
    report.error = { phase, message: error.message };
  } finally {
    await voice?.close();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  }
  return report;
}

const { values } = parseArgs({
  options: { list: { type: 'boolean' }, case: { type: 'string', multiple: true }, model: { type: 'string' },
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
  const timeoutSeconds = Number(values['turn-timeout-seconds'] ?? defaultTurnTimeoutSeconds);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 30 || timeoutSeconds > 1800) {
    throw new Error('Use --turn-timeout-seconds with an integer from 30 to 1800.');
  }
  const parent = resolve(values['output-dir'] ?? tmpdir());
  fs.mkdirSync(parent, { recursive: true });
  const run = fs.realpathSync(fs.mkdtempSync(join(parent, 'ovs-model-eval-')));
  const model = values.model || 'gpt-6-luna';
  console.log(`Model evidence: ${run}`);
  for (const entry of selected) {
    const folder = join(run, entry.id);
    fs.mkdirSync(folder);
    const report = await runCase(entry, model, folder, timeoutSeconds);
    console.log(`${entry.id}\t${report.result}\t${join(folder, 'result.json')}`);
    if (report.result !== 'objective-pass') process.exitCode = 1;
  }
}
