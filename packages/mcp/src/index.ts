#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { doctor as runDoctor, validateEdl, summarizeEdl, assessDelivery, rankTakes } from '@orkas/video-studio-core';
import type { VideoEdl } from '@orkas/video-studio-core';
import { edit, render as renderTool, analyze, speech, image, video, collectProducedSec } from '@orkas/video-studio-tools';
import type { EditProgressEvent } from '@orkas/video-studio-tools';
import { listSkills, readSkill } from './skills.js';

interface ToolReturn {
  // The MCP SDK's CallToolResult carries an open index signature; mirror it so
  // our result objects are structurally assignable to the tool callback return.
  [x: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/** Run a producer, formatting its result (or error) as MCP text content. */
async function format(p: Promise<unknown> | unknown): Promise<ToolReturn> {
  try {
    const r = await p;
    const text = typeof r === 'string' ? r : JSON.stringify(r, null, 2);
    return { content: [{ type: 'text', text }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true };
  }
}

const readPlan = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));
const toStderr = (c: string) => process.stderr.write(c); // never write progress to stdout (the protocol channel)
// ffmpeg progress → one JSON line per event on stderr (stdout is the MCP channel).
const editProgress = { onProgress: (e: EditProgressEvent) => toStderr(JSON.stringify(e) + '\n') };

const server = new McpServer({ name: 'orkas-video-studio', version: '0.0.0' });

// --- environment -----------------------------------------------------------
server.tool('ovs_doctor', 'Check that ffmpeg/ffprobe/npx are available.', {}, () => format(runDoctor()));

// --- compose / render ------------------------------------------------------
server.tool(
  'render',
  'Render a HyperFrames composition directory to a video file.',
  { project: z.string(), out: z.string(), quality: z.enum(['draft', 'high']).optional() },
  ({ project, out, quality }) => format(renderTool.render({ project, output: out, quality, onProgress: toStderr })),
);
server.tool(
  'draft',
  'Run the VideoStudio draft gate for a composition, using HyperFrames as the render backend.',
  {
    project: z.string(),
    out: z.string(),
    quality: z.enum(['draft', 'high']).optional(),
    report_path: z.string().optional(),
    findings_path: z.string().optional(),
    frame_evidence_dir: z.string().optional(),
  },
  ({ project, out, quality, report_path, findings_path, frame_evidence_dir }) =>
    format(renderTool.draft({
      project,
      output: out,
      quality,
      reportPath: report_path,
      findingsPath: findings_path,
      frameEvidenceDir: frame_evidence_dir,
      onProgress: toStderr,
    })),
);
server.tool('lint', 'Structural QA of a composition.', { project: z.string() }, ({ project }) => format(renderTool.lint(project)));
server.tool('inspect', 'Visual/layout QA of a composition in headless Chrome.', { project: z.string() }, ({ project }) => format(renderTool.inspect(project)));
server.tool('snapshot', 'Capture the first composition frame through HyperFrames snapshot.', { project: z.string(), out: z.string() }, ({ project, out }) => format(renderTool.snapshot({ project, output: out })));

// --- edit (ffmpeg) ---------------------------------------------------------
server.tool('edit_probe', 'Probe duration/resolution/fps/audio.', { input: z.string() }, ({ input }) => format(edit.probeMedia(input)));
server.tool(
  'edit_trim',
  'Cut [start, start+duration] (or [start, end]) into a new clip.',
  { input: z.string(), start_sec: z.number(), duration_sec: z.number().optional(), end_sec: z.number().optional(), output: z.string() },
  (a) => format(edit.trim(a, editProgress)),
);
server.tool('edit_concat', 'Join clips that share stream layout.', { inputs: z.array(z.string()), output: z.string() }, ({ inputs, output }) => format(edit.concat(inputs, output, editProgress)));
server.tool('edit_burnsubs', 'Burn an .srt/.ass subtitle file into the picture.', { input: z.string(), srt: z.string(), output: z.string() }, ({ input, srt, output }) => format(edit.burnsubs(input, srt, output, editProgress)));
server.tool(
  'edit_overlay',
  'Composite an overlay image/video at (x,y).',
  { base: z.string(), overlay: z.string(), x: z.number().optional(), y: z.number().optional(), output: z.string() },
  ({ base, overlay, x, y, output }) => format(edit.overlay(base, overlay, x ?? 0, y ?? 0, output, editProgress)),
);
server.tool('edit_extract_frame', 'Save a still frame at a timestamp.', { input: z.string(), at_sec: z.number(), output: z.string() }, ({ input, at_sec, output }) => format(edit.extractFrame(input, at_sec, output)));
server.tool('edit_loudness', 'Measure integrated loudness / true peak.', { input: z.string() }, ({ input }) => format(edit.loudness(input, editProgress)));
server.tool(
  'edit_mix',
  'Lay timed audio segments onto a base video, then loudness-normalize.',
  {
    base: z.string(),
    segments: z.array(z.object({ path: z.string(), start_sec: z.number(), volume: z.number().optional() })),
    on_existing_audio: z.enum(['reject', 'mix', 'replace']).optional(),
    output: z.string(),
  },
  ({ base, segments, on_existing_audio, output }) => format(edit.mix({ base, segments, on_existing_audio, output }, editProgress)),
);
server.tool(
  'edit_trim_silence',
  'Drop silent gaps (deterministic auto-cut → tightened jump-cut); returns auditable evidence.',
  { input: z.string(), output: z.string(), noise_db: z.number().optional(), min_silence_sec: z.number().optional(), pad_sec: z.number().optional(), min_keep_sec: z.number().optional() },
  (a) => format(edit.trimSilence(a, editProgress)),
);
server.tool(
  'edit_remove_fillers',
  'Drop filler words ("um", "uh", …) using a word-level transcript JSON; returns evidence.',
  { input: z.string(), transcript: z.string(), output: z.string(), fillers: z.array(z.string()).optional(), pad_sec: z.number().optional(), min_keep_sec: z.number().optional() },
  (a) => format(edit.removeFillers(a, editProgress)),
);

// --- analyze ---------------------------------------------------------------
server.tool(
  'transcribe',
  'Transcribe speech to word-level timed segments (whisper.cpp), optionally writing transcript JSON.',
  { input: z.string(), model: z.string().optional(), language: z.string().optional(), transcript_path: z.string().optional() },
  ({ input, model, language, transcript_path }) => format(analyze.transcribe({ input, model, language, output: transcript_path })),
);
server.tool('silence', 'Detect silent spans.', { input: z.string(), noise_db: z.number().optional(), min_sec: z.number().optional() }, (a) => format(analyze.silence(a, editProgress)));
server.tool('scenes', 'Detect scene/shot boundaries → cut candidates (for reducing long footage).', { input: z.string(), threshold: z.number().optional() }, (a) => format(analyze.scenes(a, editProgress)));
server.tool(
  'quality',
  'Score footage quality (blur/exposure/black/freeze) → flags ("blurry"/"too_dark"/…) + a 0..1 score.',
  { input: z.string(), thresholds: z.object({ blur: z.number().optional(), darkBelow: z.number().optional(), brightAbove: z.number().optional() }).optional() },
  (a) => format(analyze.quality(a, editProgress)),
);

// --- plan IR ---------------------------------------------------------------
server.tool('plan_validate', 'Validate a plan.json (structural + promise consistency).', { file: z.string() }, ({ file }) => format(validateEdl(readPlan(file))));
server.tool('plan_summarize', 'Render a human-readable timeline of a plan.json.', { file: z.string() }, ({ file }) => format(summarizeEdl(readPlan(file) as VideoEdl)));
server.tool(
  'plan_promise_check',
  'Deterministic delivery guard (anti-slideshow); reports a pass/warn/fail verdict. Set probe_produced to assess the REAL produced cut (each primary segment\'s produced_path), not the planned target_sec.',
  { file: z.string(), probe_produced: z.boolean().optional() },
  ({ file, probe_produced }) =>
    format(
      (async () => {
        const plan = readPlan(file) as VideoEdl;
        const producedSec = probe_produced ? await collectProducedSec(plan, file) : undefined;
        const a = assessDelivery(plan, producedSec ? { producedSec } : {});
        return producedSec ? { ...a, produced_sec: producedSec } : a;
      })(),
    ),
);
server.tool(
  'plan_rank_takes',
  'De-duplicate repeated takes (same line recorded several times) and pick the best of each by quality.',
  { takes: z.array(z.object({ id: z.string(), text: z.string().optional(), quality_score: z.number().optional(), duration_sec: z.number().optional() })) },
  ({ takes }) => format(rankTakes(takes)),
);

// --- BYO generation --------------------------------------------------------
server.tool(
  'speak',
  'Synthesize narration to an audio file via the configured BYO TTS provider.',
  { text: z.string(), output: z.string(), voice: z.string().optional(), model: z.string().optional(), format: z.string().optional(), speed: z.number().optional() },
  (a) => format(speech.speak(a)),
);
server.tool(
  'image',
  'Generate an image via the configured BYO provider (OpenAI-compatible or Gemini).',
  { prompt: z.string(), output: z.string(), model: z.string().optional(), size: z.string().optional() },
  (a) => format(image.generateImage(a)),
);
server.tool(
  'video',
  'Generate a video clip via the configured BYO provider (Doubao Seedance); pass image_url for image-to-video.',
  { prompt: z.string(), output: z.string(), model: z.string().optional(), image_url: z.string().optional() },
  (a) => format(video.generateVideo(a)),
);

// --- skills ----------------------------------------------------------------
server.tool('list_skills', 'List the available video skills.', {}, () => format(listSkills()));
server.tool('get_skill', 'Print one skill’s full instructions.', { name: z.string() }, ({ name }) => format(readSkill(name)));

await server.connect(new StdioServerTransport());
