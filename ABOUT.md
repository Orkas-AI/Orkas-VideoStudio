# About OrkasVideoStudio

**OrkasVideoStudio turns your coding agent into a video studio.** You describe a
video in plain language — *"make a 60-second vertical explainer on vector databases
with a Chinese voiceover and captions"* — and the agent reads the material, writes the
timeline, and produces the file. Claude Code, Codex, Cursor: any agent that can run a
shell or speak MCP can drive it.

## Why it exists

Most ways to make video with AI are black boxes: a hosted editor or a one-shot "video
agent" hands you a finished file and nothing you can steer. OrkasVideoStudio takes the
opposite stance. **A video is a readable, diffable, re-renderable plan (`plan.json`)** —
change one line and only that piece re-renders. The agent is the brain; this project
ships the parts an agent can't improvise:

- **Knowledge** — skills that encode what makes a good video and which production line to
  take, discovered by progressive disclosure.
- **Deterministic capabilities** — draft QA / render / edit / transcribe / generate, as
  auditable wrappers over [HyperFrames](https://github.com/heygen-com/hyperframes),
  `ffmpeg`, and `whisper.cpp`.
- **An editable IR** — the `plan.json` timeline that stays yours to inspect and re-render.

## What it does — the four production lines

- **Compose** — script → designed HTML motion graphics → mp4 (explainers, kinetic type,
  lower-thirds, data viz, transitions). No paid keys.
- **Edit** — cut / join / trim-silence / de-filler / mix / burn-in subtitles / dub /
  localize real footage you supply, plus highlight selection over long recordings. No paid
  keys.
- **Generate** — talking-head or cinematic AI footage and imagery via **your own** provider
  keys (OpenAI, Gemini, Doubao — no managed backend, no lock-in).
- **Auto** — when a deliverable needs more than one axis, the agent routes to a single
  cross-modal `plan.json`, assembles it segment by segment, and a deterministic **delivery
  guard** verifies the finished cut keeps its promise before anything ships.

## Who it's for

Reach for OrkasVideoStudio when you want your *agent* to make the video, keep the result as
an auditable file you can edit and re-render, and stay local and open with your own keys —
rather than hand-coding every frame in a framework or handing the job to a hosted SaaS editor.

## Where it comes from

OrkasVideoStudio began as the built-in video agent inside [Orkas](https://orkas.ai), the
AI-team desktop app, where it was validated end-to-end — then extracted into this
agent-agnostic, MIT-licensed toolkit. Inside Orkas it ships built in; everywhere else you
install it into your own coding agent and get the same capabilities via the `ovs` CLI and
MCP server.

Links: **[orkas.ai](https://orkas.ai)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** ·
**[repository](https://github.com/Orkas-AI/Orkas-VideoStudio)**

## Learn more

- **[README](./README.md)** — install, use cases, the full command surface, and how it compares.
- **[PLAN.md](./PLAN.md)** — the technical plan and roadmap.
- **[AGENTS.md](./AGENTS.md)** — how a coding agent picks up the skills and capabilities.

MIT licensed — see [`LICENSE`](./LICENSE).
