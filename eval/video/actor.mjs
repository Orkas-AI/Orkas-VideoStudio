import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { localNetworkProfile } from './chromium.mjs';

const maxEventLogBytes = 64 * 1024 * 1024;
const shutdownGraceMs = 15_000;

export function actorEnvironment(cwd, bin, config, tools) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(?:OVS_|BASH_ENV$|ENV$|NODE_OPTIONS$|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$)/i.test(name)
    && !/(?:API_KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL)/i.test(name)));
  return {
    ...env,
    PATH: [bin, dirname(tools.ffmpeg), process.env.PATH].join(delimiter),
    OVS_CONFIG_DIR: config, OVS_FFMPEG_PATH: tools.ffmpeg, OVS_FFPROBE_PATH: tools.ffprobe,
    OVS_STUDIO_AUTO_OPEN: '0', NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1',
    HYPERFRAMES_FONT_CACHE_DIR: join(cwd, '.ovs-font-cache'),
  };
}

export async function actorTurn({
  cwd, env, model, prompt, resume, persistent, localNetwork, chromiumSocket, stageDir, timeoutSeconds,
  shutdownTimeoutMs = shutdownGraceMs,
}) {
  const common = ['--json', '--ignore-user-config', '--skip-git-repo-check', '--model', model,
    '-c', 'shell_environment_policy.inherit=all',
    '--output-last-message', join(stageDir, 'reply.txt')];
  if (!persistent) common.push('--ephemeral');
  const permissions = localNetwork || chromiumSocket
    ? ['-c', localNetworkProfile(chromiumSocket), '-c', 'default_permissions="ovs-eval"']
    : ['--sandbox', 'workspace-write'];
  const args = [...permissions, '--ask-for-approval', 'never', '--cd', cwd, 'exec',
    ...(resume ? ['resume', ...common, resume, '-'] : [...common, '-'])];
  const stdout = fs.openSync(join(stageDir, 'actor.jsonl'), 'wx', 0o600);
  const start = performance.now();
  const deadline = start + timeoutSeconds * 1000;
  const events = [];
  let terminal;
  let terminalAt;
  let expired = false;
  let shutdownExpired = false;
  let thread;
  try {
    const stderr = fs.openSync(join(stageDir, 'actor-stderr.log'), 'wx', 0o600);
    let result;
    try {
      result = await new Promise((resolve, reject) => {
        const child = spawn('codex', args, { cwd, env, stdio: ['pipe', 'pipe', stderr], detached: true });
        let fault;
        let logBytes = 0;
        function stop(error) {
          fault ??= error;
          try {
            if (child.pid) process.kill(-child.pid, 'SIGKILL');
          } catch (killError) {
            if (killError.code !== 'ESRCH') fault ??= killError;
          }
          // An inherited stdout in a descendant must not keep the runner open.
          child.stdout.destroy();
        }
        let timer = setTimeout(() => {
          expired = true;
          stop();
        }, Math.max(0, Math.ceil(deadline - performance.now())));
        child.stdout.on('data', chunk => {
          if (fault) return;
          try {
            logBytes += chunk.length;
            if (logBytes > maxEventLogBytes) throw new Error('Actor log exceeded the evidence limit');
            fs.writeSync(stdout, chunk);
          } catch (error) {
            stop(error);
          }
        });
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
        lines.on('line', line => {
          if (fault || !line.trim()) return;
          try {
            const event = JSON.parse(line);
            events.push(event);
            if (event.type === 'thread.started') thread ??= event.thread_id;
            if (event.type !== 'turn.completed' && event.type !== 'turn.failed') return;
            if (terminalAt !== undefined) return;
            const receivedAt = performance.now();
            if (receivedAt > deadline || expired) {
              expired = true;
              return;
            }
            terminal = event;
            terminalAt = receivedAt;
            clearTimeout(timer);
            timer = setTimeout(() => {
              shutdownExpired = true;
              stop();
            }, shutdownTimeoutMs);
          } catch (error) {
            stop(error);
          }
        });
        lines.on('error', stop);
        child.once('error', error => { fault ??= error; });
        child.once('close', (exit, exitSignal) => {
          clearTimeout(timer);
          lines.close();
          if (fault) reject(fault);
          else resolve({ exit, exitSignal });
        });
        child.stdin.on('error', () => {});
        child.stdin.end(prompt);
      });
    } finally {
      fs.closeSync(stderr);
    }
    return {
      ...result, events, thread, expired, shutdownExpired, seconds: (performance.now() - start) / 1000,
      turnSeconds: terminalAt === undefined ? null : (terminalAt - start) / 1000,
      completed: terminalAt !== undefined && terminal?.type === 'turn.completed' && !!thread,
      usage: terminal?.usage ?? null,
    };
  } finally {
    fs.closeSync(stdout);
  }
}
