#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { defineCommand, runMain } from 'citty';
import { doctor as runDoctor, validateEdl, summarizeEdl, assessDelivery, rankTakes } from '@orkas/video-studio-core';
import type { VideoEdl, Take, QualityThresholds } from '@orkas/video-studio-core';
import { edit, render as renderTool, analyze, speech, image, video, collectProducedSec } from '@orkas/video-studio-tools';
import type { EditProgressEvent } from '@orkas/video-studio-tools';
import { listSkills, readSkill, installSkills, type InstallTarget, type InstallScope } from './skills.js';

function printJson(x: unknown): void {
  process.stdout.write(JSON.stringify(x, null, 2) + '\n');
}
function out(s: string): void {
  process.stdout.write(s + '\n');
}
function num(v: unknown, name: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}
function optNum(v: unknown): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function readPlan(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}
// Stream ffmpeg progress as one JSON line per event on stderr — stdout carries
// the JSON result, so progress never corrupts a piped `ovs` invocation.
const editProgress: { onProgress: (e: EditProgressEvent) => void } = {
  onProgress: (e) => process.stderr.write(JSON.stringify(e) + '\n'),
};

// --- doctor ----------------------------------------------------------------

const doctor = defineCommand({
  meta: { name: 'doctor', description: 'Check that ffmpeg/ffprobe/npx are available.' },
  run() {
    const r = runDoctor();
    printJson(r);
    if (!r.ok) process.exitCode = 1;
  },
});

// --- compose / render ------------------------------------------------------

const render = defineCommand({
  meta: { name: 'render', description: 'Render a HyperFrames composition dir to a video (npx hyperframes).' },
  args: {
    project: { type: 'positional', required: true, description: 'composition directory (contains index.html)' },
    out: { type: 'string', required: true, description: 'output video path' },
    quality: { type: 'string', default: 'high', description: 'draft | high' },
  },
  async run({ args }) {
    const r = await renderTool.render({
      project: String(args.project),
      output: String(args.out),
      quality: args.quality === 'draft' ? 'draft' : 'high',
      onProgress: (c) => process.stderr.write(c),
    });
    printJson(r);
  },
});

const lint = defineCommand({
  meta: { name: 'lint', description: 'Structural QA of a composition (npx hyperframes lint).' },
  args: { project: { type: 'positional', required: true } },
  async run({ args }) {
    printJson(await renderTool.lint(String(args.project)));
  },
});

const inspect = defineCommand({
  meta: { name: 'inspect', description: 'Visual/layout QA of a composition in headless Chrome.' },
  args: { project: { type: 'positional', required: true } },
  async run({ args }) {
    printJson(await renderTool.inspect(String(args.project)));
  },
});

// --- edit ------------------------------------------------------------------

const edit_ = defineCommand({
  meta: { name: 'edit', description: 'Edit real footage with ffmpeg (probe/trim/concat/burnsubs/overlay/extract-frame/loudness/mix).' },
  subCommands: {
    probe: defineCommand({
      meta: { name: 'probe', description: 'Probe duration/resolution/fps/audio.' },
      args: { input: { type: 'positional', required: true } },
      async run({ args }) {
        printJson(await edit.probeMedia(String(args.input)));
      },
    }),
    trim: defineCommand({
      meta: { name: 'trim', description: 'Cut [start, start+duration] (or [start, end]).' },
      args: {
        input: { type: 'positional', required: true },
        start: { type: 'string', required: true },
        duration: { type: 'string' },
        end: { type: 'string' },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        printJson(
          await edit.trim({
            input: String(args.input),
            start_sec: num(args.start, 'start'),
            duration_sec: optNum(args.duration),
            end_sec: optNum(args.end),
            output: String(args.out),
          }, editProgress),
        );
      },
    }),
    concat: defineCommand({
      meta: { name: 'concat', description: 'Join clips (comma-separated --inputs).' },
      args: {
        inputs: { type: 'string', required: true, description: 'comma-separated input paths' },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        const inputs = String(args.inputs).split(',').map((s) => s.trim()).filter(Boolean);
        printJson(await edit.concat(inputs, String(args.out), editProgress));
      },
    }),
    burnsubs: defineCommand({
      meta: { name: 'burnsubs', description: 'Burn an .srt/.ass subtitle file into the picture.' },
      args: {
        input: { type: 'positional', required: true },
        srt: { type: 'string', required: true },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        printJson(await edit.burnsubs(String(args.input), String(args.srt), String(args.out), editProgress));
      },
    }),
    overlay: defineCommand({
      meta: { name: 'overlay', description: 'Composite an overlay image/video at (x,y).' },
      args: {
        base: { type: 'string', required: true },
        overlay: { type: 'string', required: true },
        x: { type: 'string', default: '0' },
        y: { type: 'string', default: '0' },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        printJson(await edit.overlay(String(args.base), String(args.overlay), num(args.x, 'x'), num(args.y, 'y'), String(args.out), editProgress));
      },
    }),
    'extract-frame': defineCommand({
      meta: { name: 'extract-frame', description: 'Save a still frame at a timestamp.' },
      args: {
        input: { type: 'positional', required: true },
        at: { type: 'string', required: true },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        printJson(await edit.extractFrame(String(args.input), num(args.at, 'at'), String(args.out)));
      },
    }),
    loudness: defineCommand({
      meta: { name: 'loudness', description: 'Measure integrated loudness / true peak.' },
      args: { input: { type: 'positional', required: true } },
      async run({ args }) {
        printJson(await edit.loudness(String(args.input), editProgress));
      },
    }),
    mix: defineCommand({
      meta: { name: 'mix', description: 'Lay timed audio onto a base video (--segments JSON).' },
      args: {
        base: { type: 'string', required: true },
        segments: { type: 'string', required: true, description: 'JSON: [{path,start_sec,volume?}]' },
        'on-existing-audio': { type: 'string', default: 'reject', description: 'reject | mix | replace' },
        out: { type: 'string', required: true },
      },
      async run({ args }) {
        const segments = JSON.parse(String(args.segments)) as edit.AudioSegment[];
        const policy = String(args['on-existing-audio']) as edit.OnExistingAudio;
        printJson(await edit.mix({ base: String(args.base), segments, on_existing_audio: policy, output: String(args.out) }, editProgress));
      },
    }),
    'trim-silence': defineCommand({
      meta: { name: 'trim-silence', description: 'Drop silent gaps (deterministic auto-cut → tightened jump-cut); returns evidence.' },
      args: {
        input: { type: 'positional', required: true },
        out: { type: 'string', required: true },
        'noise-db': { type: 'string', description: 'silence threshold dB (default -40)' },
        'min-silence': { type: 'string', description: 'shortest silence to cut, seconds (default 0.5)' },
        pad: { type: 'string', description: 'breathing room kept at each cut, seconds (default 0.1)' },
        'min-keep': { type: 'string' },
      },
      async run({ args }) {
        printJson(await edit.trimSilence({
          input: String(args.input),
          output: String(args.out),
          noise_db: optNum(args['noise-db']),
          min_silence_sec: optNum(args['min-silence']),
          pad_sec: optNum(args.pad),
          min_keep_sec: optNum(args['min-keep']),
        }, editProgress));
      },
    }),
    'remove-fillers': defineCommand({
      meta: { name: 'remove-fillers', description: 'Drop filler words (um/uh) using a transcript JSON; returns evidence.' },
      args: {
        input: { type: 'positional', required: true },
        transcript: { type: 'string', required: true, description: 'transcript.json from `ovs transcribe`' },
        out: { type: 'string', required: true },
        fillers: { type: 'string', description: 'comma-separated tokens (default um/uh/erm/…)' },
        pad: { type: 'string' },
        'min-keep': { type: 'string' },
      },
      async run({ args }) {
        const fillers = args.fillers ? String(args.fillers).split(',').map((s) => s.trim()).filter(Boolean) : undefined;
        printJson(await edit.removeFillers({
          input: String(args.input),
          transcript: String(args.transcript),
          output: String(args.out),
          ...(fillers ? { fillers } : {}),
          pad_sec: optNum(args.pad),
          min_keep_sec: optNum(args['min-keep']),
        }, editProgress));
      },
    }),
  },
});

// --- analyze ---------------------------------------------------------------

const transcribe = defineCommand({
  meta: { name: 'transcribe', description: 'Transcribe speech (npx hyperframes transcribe / whisper.cpp).' },
  args: {
    input: { type: 'positional', required: true },
    model: { type: 'string', description: 'whisper model (use large-v3 for non-English)' },
    language: { type: 'string' },
  },
  async run({ args }) {
    printJson(await analyze.transcribe({ input: String(args.input), model: args.model ? String(args.model) : undefined, language: args.language ? String(args.language) : undefined }));
  },
});

const silence = defineCommand({
  meta: { name: 'silence', description: 'Detect silent spans (ffmpeg silencedetect).' },
  args: {
    input: { type: 'positional', required: true },
    'noise-db': { type: 'string', default: '-40' },
    'min-sec': { type: 'string', default: '0.5' },
  },
  async run({ args }) {
    printJson(await analyze.silence({ input: String(args.input), noise_db: optNum(args['noise-db']), min_sec: optNum(args['min-sec']) }, editProgress));
  },
});

const ocr = defineCommand({
  meta: { name: 'ocr', description: 'Read on-screen text (not available yet — planned).' },
  async run() {
    await analyze.ocr().catch((e: Error) => {
      process.stderr.write(`ovs: ${e.message}\n`);
      process.exitCode = 1;
    });
  },
});

const scenes = defineCommand({
  meta: { name: 'scenes', description: 'Detect scene/shot boundaries → cut candidates (for reducing long footage).' },
  args: {
    input: { type: 'positional', required: true },
    threshold: { type: 'string', description: 'scene sensitivity 0..1 (default 0.4; lower = more cuts)' },
  },
  async run({ args }) {
    printJson(await analyze.scenes({ input: String(args.input), threshold: optNum(args.threshold) }, editProgress));
  },
});

const quality = defineCommand({
  meta: { name: 'quality', description: 'Score footage quality (blur/exposure/black/freeze) → flags + 0..1 score.' },
  args: {
    input: { type: 'positional', required: true },
    'blur-threshold': { type: 'string', description: 'mean blur above this flags "blurry" (default 15)' },
    'dark-below': { type: 'string', description: 'mean luma below this flags "too_dark" (default 50)' },
    'bright-above': { type: 'string', description: 'mean luma above this flags "too_bright" (default 200)' },
  },
  async run({ args }) {
    const t: QualityThresholds = {};
    const blur = optNum(args['blur-threshold']); if (blur !== undefined) t.blur = blur;
    const dark = optNum(args['dark-below']); if (dark !== undefined) t.darkBelow = dark;
    const bright = optNum(args['bright-above']); if (bright !== undefined) t.brightAbove = bright;
    printJson(await analyze.quality({ input: String(args.input), ...(Object.keys(t).length ? { thresholds: t } : {}) }, editProgress));
  },
});

// --- plan (the plan.json IR) ----------------------------------------------

const plan = defineCommand({
  meta: { name: 'plan', description: 'Work with the plan.json video IR.' },
  subCommands: {
    validate: defineCommand({
      meta: { name: 'validate', description: 'Validate a plan.json; exit 1 on errors.' },
      args: { file: { type: 'positional', required: true } },
      run({ args }) {
        const r = validateEdl(readPlan(String(args.file)));
        printJson(r);
        if (!r.ok) process.exitCode = 1;
      },
    }),
    summarize: defineCommand({
      meta: { name: 'summarize', description: 'Print a human-readable timeline of a plan.json.' },
      args: { file: { type: 'positional', required: true } },
      run({ args }) {
        out(summarizeEdl(readPlan(String(args.file)) as VideoEdl));
      },
    }),
    'promise-check': defineCommand({
      meta: { name: 'promise-check', description: 'Deterministic delivery guard; exit 1 on a fail verdict.' },
      args: {
        file: { type: 'positional', required: true },
        'probe-produced': {
          type: 'boolean',
          description: 'probe each primary segment\'s produced_path and assess the real cut, not the planned target_sec',
        },
      },
      async run({ args }) {
        const file = String(args.file);
        const plan = readPlan(file) as VideoEdl;
        const producedSec = args['probe-produced'] ? await collectProducedSec(plan, file) : undefined;
        const a = assessDelivery(plan, producedSec ? { producedSec } : {});
        printJson(producedSec ? { ...a, produced_sec: producedSec } : a);
        if (a.verdict === 'fail') process.exitCode = 1;
      },
    }),
    'rank-takes': defineCommand({
      meta: { name: 'rank-takes', description: 'De-duplicate repeated takes and pick the best (reads a takes.json).' },
      args: { file: { type: 'positional', required: true, description: 'JSON array of {id, text, quality_score, duration_sec}' } },
      run({ args }) {
        const takes = readPlan(String(args.file));
        if (!Array.isArray(takes)) {
          process.stderr.write('rank-takes: file must be a JSON array of takes\n');
          process.exitCode = 1;
          return;
        }
        printJson(rankTakes(takes as Take[]));
      },
    }),
  },
});

// --- skills ----------------------------------------------------------------

const skills = defineCommand({
  meta: { name: 'skills', description: 'List or install the video skill pack.' },
  args: {
    install: { type: 'boolean', description: 'install the skill pack instead of listing' },
    target: { type: 'string', default: 'claude', description: 'claude | codex' },
    scope: { type: 'string', default: 'user', description: 'user | repo' },
    dir: { type: 'string', description: 'override install directory' },
  },
  run({ args }) {
    if (args.install) {
      const r = installSkills(String(args.target) as InstallTarget, String(args.scope) as InstallScope, args.dir ? String(args.dir) : undefined);
      out(`Installed ${r.installed.length} skill(s) to ${r.dest}:`);
      for (const n of r.installed) out(`  - ${n}`);
      return;
    }
    for (const n of listSkills()) out(n);
  },
});

const skill = defineCommand({
  meta: { name: 'skill', description: 'Print one skill’s full instructions.' },
  args: { name: { type: 'positional', required: true } },
  run({ args }) {
    out(readSkill(String(args.name)));
  },
});

// --- BYO generation (uses the user's own provider keys) --------------------

const speak = defineCommand({
  meta: { name: 'speak', description: 'Synthesize narration to audio via your configured TTS provider.' },
  args: {
    text: { type: 'string', required: true },
    out: { type: 'string', required: true },
    voice: { type: 'string' },
    model: { type: 'string' },
    format: { type: 'string' },
    speed: { type: 'string' },
  },
  async run({ args }) {
    printJson(
      await speech.speak({
        text: String(args.text),
        output: String(args.out),
        voice: args.voice ? String(args.voice) : undefined,
        model: args.model ? String(args.model) : undefined,
        format: args.format ? String(args.format) : undefined,
        speed: optNum(args.speed),
      }),
    );
  },
});

const imageCmd = defineCommand({
  meta: { name: 'image', description: 'Generate an image via your configured image provider (BYO key).' },
  args: {
    prompt: { type: 'string', required: true },
    out: { type: 'string', required: true },
    model: { type: 'string' },
    size: { type: 'string' },
  },
  async run({ args }) {
    printJson(await image.generateImage({ prompt: String(args.prompt), output: String(args.out), model: args.model ? String(args.model) : undefined, size: args.size ? String(args.size) : undefined }));
  },
});

const videoCmd = defineCommand({
  meta: { name: 'video', description: 'Generate a video clip via your configured video provider (BYO key).' },
  args: {
    prompt: { type: 'string', required: true },
    out: { type: 'string', required: true },
    model: { type: 'string' },
    'image-url': { type: 'string', description: 'public image URL for image-to-video' },
  },
  async run({ args }) {
    printJson(await video.generateVideo({ prompt: String(args.prompt), output: String(args.out), model: args.model ? String(args.model) : undefined, image_url: args['image-url'] ? String(args['image-url']) : undefined }));
  },
});

const main = defineCommand({
  meta: { name: 'ovs', description: 'OrkasVideoStudio — drive video compose/edit/generate from your coding agent.' },
  subCommands: {
    doctor,
    render,
    lint,
    inspect,
    edit: edit_,
    transcribe,
    silence,
    ocr,
    scenes,
    quality,
    plan,
    skills,
    skill,
    speak,
    image: imageCmd,
    video: videoCmd,
  },
});

runMain(main);
