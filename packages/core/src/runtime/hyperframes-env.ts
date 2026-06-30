import type { FfmpegTools } from './binaries.js';

/**
 * The pinned HyperFrames CLI spec used with `npx`. Overridable via env so a user
 * can move forward/back without a release. HyperFrames renders HTML compositions
 * to mp4 and also ships transcription (whisper.cpp); we never bundle it — it is
 * fetched at use time through npx.
 */
export const DEFAULT_HYPERFRAMES_SPEC = process.env.OVS_HYPERFRAMES_SPEC || 'hyperframes@0.7.21';

/**
 * Build the environment for a `npx hyperframes` invocation: point HyperFrames at
 * our resolved ffmpeg/ffprobe (it requires both and bundles neither), and make
 * npx prefer the local cache + retry transient network blips instead of failing
 * a render on a flaky first fetch.
 */
export function buildHyperframesEnv(tools: FfmpegTools, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    HYPERFRAMES_FFMPEG_PATH: tools.ffmpeg,
    HYPERFRAMES_FFPROBE_PATH: tools.ffprobe,
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_PREFER_OFFLINE: 'true',
    NPM_CONFIG_FETCH_RETRIES: '4',
  };
}

/**
 * Build the `npx` argument vector for a HyperFrames subcommand:
 *   npx -y hyperframes@<spec> <op> <...args>
 * `-y` auto-confirms the one-time package install so a non-interactive agent run
 * never hangs on a prompt.
 */
export function hyperframesNpxArgs(op: string, args: string[] = [], spec: string = DEFAULT_HYPERFRAMES_SPEC): string[] {
  return ['-y', spec, op, ...args];
}
