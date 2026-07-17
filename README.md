# OrkasVideoStudio

> Drive video **composition, generation, and editing** — and a fully **automatic end-to-end
> pipeline** — from your coding agent. Claude Code, Codex, Cursor: any agent that can run a
> shell or speak MCP can use it.

https://github.com/user-attachments/assets/13411470-06da-4f64-9bc1-fa52fe27216b

OrkasVideoStudio is **not a black-box video agent**. A video is expressed as a readable,
diffable, re-renderable plan (`plan.json`) that your agent — and you — can edit; change one
line and only that piece re-renders. The agent is the brain; this project ships the
**knowledge** (what makes a good video, and which production line to take), the
**deterministic capabilities** (render / edit / transcribe / generate — thin wrappers over
[`hyperframes`](https://github.com/heygen-com/hyperframes), `ffmpeg`, and `whisper.cpp`), and
that **editable IR**.

You talk to your agent in plain language — *"make a 60-second vertical explainer on vector
databases with a Chinese voiceover and captions"* — and it reads the material, writes the
timeline, and produces the file.

---

## The four production lines

Three orthogonal capability axes, plus an automatic pipeline that weaves them together:

- **Compose** — script → designed HTML motion graphics → mp4. Explainers, kinetic typography,
  lower-thirds, data viz, title cards, transitions. **No paid keys.**
- **Edit** — cut / join / trim-silence / de-filler / mix / burn-in subtitles / dub / localize
  real footage you supply, plus highlight selection over long recordings. **No paid keys.**
- **Generate** — talking-head or cinematic AI footage and imagery via **your own** provider
  keys (BYO — OpenAI, Gemini, Doubao; no managed backend, no lock-in).
- **Auto (end-to-end)** — when a deliverable needs more than one axis, the agent routes to a
  single cross-modal `plan.json`: `stage-plan` builds the EDL, `stage-assemble` walks it and
  delegates each segment back to compose / generate / edit, and a deterministic
  **delivery guard** (`ovs plan promise-check`) verifies the finished cut keeps its promise
  (e.g. real motion, not a silent slideshow) before anything ships.

The plan is the contract: *"the footage in the middle, generate an opener, compose the stats,
one voiceover over all of it"* becomes one editable file where every segment, caption, and
narration line is independently re-renderable.

---

## Relationship to Orkas

OrkasVideoStudio began life as the built-in **video agent inside [Orkas](https://orkas.ai)** —
the AI-team desktop app — where it was validated end-to-end, then extracted into this
agent-agnostic, MIT-licensed toolkit.

- **Inside Orkas** it ships as a built-in agent — no separate install; the zero-key trunk
  works out of the box.
- **Everywhere else** you install it into your own coding agent (below) and get the same
  capabilities via the `ovs` CLI and MCP server.

Links: **[orkas.ai](https://orkas.ai)** (website) · **[github.com/Orkas-AI](https://github.com/Orkas-AI)**
(open-source projects) · **[this repo](https://github.com/Orkas-AI/Orkas-VideoStudio)**.

---

## Use cases

Each is a real prompt you'd give your agent; the router picks the line for you.

| You say… | Line | What happens |
|---|---|---|
| *"Make a 60s vertical explainer on what a vector DB is, Chinese voiceover + captions."* | Compose | HTML motion-graphic scenes → narration (BYO TTS) → burned-in captions → mp4. |
| *"Turn this 1-hour screen recording into three 30s highlight clips with captions."* | Edit | `scenes`/`quality` find the good parts, `rank-takes` picks, `trim-silence`/`remove-fillers` tighten, subtitles burned in. |
| *"Add an English voiceover + subtitles to product-demo.mp4 and normalize the loudness."* | Edit | transcribe → localize → `speak` → `mix` → `burnsubs` → loudness pass. |
| *"Clean the silences and 'um's out of my webcam take and tighten it."* | Edit | deterministic jump-cut with an auditable evidence trail. |
| *"Generate a 5s cinematic shot of a city at dawn for the intro."* | Generate | BYO image/video provider → clip on your timeline. |
| *"Make a 15s 9:16 promo from this script: generate the opener, compose the feature callouts, one VO."* | Auto | one `plan.json` woven across generate + compose + narration, guarded before delivery. |

---

## Install

**Prerequisites:** Node ≥ 22, and `ffmpeg` + `ffprobe` on your `PATH` (needed for edit /
transcribe / local media QA). Compose drafts use a VideoStudio QA gate backed by the pinned
[HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` package dependency; `npx`
is only a compatibility fallback. Generation is opt-in and needs your own keys.

> **Early development:** the npm packages are being published. Until then, install from source
> — the `ovs` CLI works exactly the same.

### From source (works today)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
node packages/cli/dist/index.js doctor     # verify ffmpeg/ffprobe/node
# optionally alias it:  alias ovs="node $PWD/packages/cli/dist/index.js"
```

### From npm (once published)

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor                       # checks ffmpeg/ffprobe/node; guides any install
```

---

## Drive it from your coding agent

The `ovs` CLI is the canonical interface; the MCP tools mirror it 1:1. There are three ways an
agent picks it up — use whichever your agent supports:

**1) Native skills (Claude Code / Codex).** Materialize the `SKILL.md` knowledge pack so the
agent discovers it by progressive disclosure:

```bash
ovs skills --install --target claude   # → ~/.claude/skills   (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills
```

**2) MCP typed tools.** Register the server (mirrors the CLI):

```bash
claude mcp add ovs -- npx -y @orkas/video-studio-mcp     # Claude Code
codex  mcp add ovs -- npx -y @orkas/video-studio-mcp     # Codex
# from source (until published): point it at  node <repo>/packages/mcp/dist/index.js
```

**3) Self-describing CLI (any agent that can run a shell).** No native loader needed:

```bash
ovs skills               # list the skills
ovs skill video-router   # print a skill's full instructions into context
ovs --help               # the full command surface
```

**How a session flows.** The agent reads **`video-router`** first (it locks the line), then the
relevant stage skills, authors the composition and/or `plan.json`, runs the deterministic
ops, and self-verifies with the delivery guard:

```text
You:   Make a 60s vertical explainer on vector databases, with a Chinese voiceover.
Agent: → reads video-router (locks: compose-primary)
       → reads stage-plan / stage-compose / video-craft
       → writes composition/composition-manifest.json + plan.json
       → ovs composition prepare composition
       → authors composition/index.html on the prepared HyperFrames scaffold
       → ovs draft composition --out draft.mp4 --report draft-report.json
       → ovs plan promise-check plan.json         # guard passes
       → returns draft.mp4
```

The full command surface: `doctor · composition {prepare,reconcile} · draft · render · lint · check · snapshot · edit {probe,trim,concat,
burnsubs,overlay,extract-frame,loudness,mix,trim-silence,remove-fillers} · transcribe ·
silence · scenes · quality · plan {validate,summarize,promise-check,rank-takes} · narration fit ·
gate transition · speak · speech-capabilities · image · video · skills`.

---

## BYO generation providers

The compose / edit / transcribe trunk is **zero-key**. Generation (image / video / TTS) is
opt-in and uses **your** keys — no managed backend, no account binding. Configure via
`~/.config/orkas-video-studio/config.json` (or `OVS_CONFIG_DIR`) or environment variables:

| Capability | Providers | Env |
|---|---|---|
| Image (`ovs image`) | OpenAI-compatible · Gemini · Doubao Seedream | `OVS_IMAGE_PROVIDER` · `OVS_IMAGE_BASE_URL` · `OVS_IMAGE_API_KEY` · `OVS_IMAGE_MODEL` |
| Video (`ovs video`) | Doubao Seedance (image-to-video) | `OVS_VIDEO_PROVIDER` · `OVS_VIDEO_BASE_URL` · `OVS_VIDEO_API_KEY` · `OVS_VIDEO_MODEL` |
| TTS (`ovs speak`) | OpenAI-compatible (incl. ElevenLabs-style) | `OVS_TTS_BASE_URL` · `OVS_TTS_API_KEY` · `OVS_TTS_MODEL` · `OVS_TTS_VOICE` · `OVS_TTS_FORMAT` |

Use `ovs speech-capabilities` to resolve the exact configured narration profile without
printing credentials, then `ovs narration fit` before and after synthesis to keep each line
inside its plan window. Video generation accepts explicit reference images, ratio, duration,
resolution, and audio generation flags so the provider call matches the approved plan.

---

## How it compares

HyperFrames, ffmpeg, and whisper.cpp are **dependencies** here, not competitors — OrkasVideoStudio
is the agent-facing knowledge, draft QA gate, and IR layer on top of them. Against other ways to make video:

| | OrkasVideoStudio | Programmatic frameworks (Remotion, Revideo) | AI SaaS editors (Descript, Opus Clip, Runway) | Thin MCP / ffmpeg wrappers |
|---|---|---|---|---|
| **Driver** | any coding agent, in natural language (CLI + MCP) | you hand-write React/TS | GUI / hosted | an agent, but tools only |
| **Artifact** | editable, diffable `plan.json` IR — per-segment re-render | code (re-run to render) | black-box timeline / hosted project | none |
| **Scope** | compose + edit + generate + **AUTO** end-to-end | composition (programmatic) | mostly edit *or* generate, per product | whatever the tool exposes |
| **Guidance** | ships "what makes a good video" as skills + a deterministic delivery guard | none — you decide | product-opinionated | none |
| **Keys / hosting** | zero-key trunk; **BYO** keys for generation; local-first, self-host | your own infra | vendor keys + hosted, lock-in | varies |
| **License** | MIT | may require a company license for teams | proprietary | varies |

Where it fits: reach for a **framework** when you want to hand-code every frame; a **SaaS
editor** when a GUI and hosting are the point; **OrkasVideoStudio** when you want your *agent*
to make the video, keep the result as an auditable file you can edit and re-render, and stay
local + open with your own keys.

---

## Packages

| Package | What |
|---|---|
| `@orkas/video-studio-core` | the `plan.json` IR (schema + validator + delivery guard), decision layer, runtime/config |
| `@orkas/video-studio-tools` | capability backends (render / edit / analyze / speech / image / video) |
| `@orkas/video-studio` | the `ovs` CLI |
| `@orkas/video-studio-mcp` | MCP server (mirrors the CLI 1:1) |
| `@orkas/video-studio-skills` | the host-neutral `SKILL.md` knowledge pack |

The technical plan and roadmap live in [`PLAN.md`](./PLAN.md).

## Development

```bash
pnpm install
pnpm build        # tsc per package (core → tools → cli/mcp)
pnpm test         # vitest
pnpm test:video   # mock provider round-trip → real playable MP4 → ffprobe
pnpm test:video:e2e # build + real HyperFrames compose→MP4 + built CLI/MCP smoke
pnpm typecheck
```

`test:video` is deterministic and never spends provider credits: a local fake Seedance endpoint
returns a real H.264 fixture, then OVS downloads it and verifies the result with `ffprobe`.
`test:video:e2e` additionally runs the packaged HyperFrames dependency through `check` and
`render`, validates the resulting 1080p MP4, and exercises the built CLI/MCP surfaces. Both
commands fail with an actionable error when required video runtimes are missing; the ordinary
test suite may skip runtime-heavy cases on machines without ffmpeg or a browser.

## License

MIT — see [`LICENSE`](./LICENSE). Rendering uses the Apache-2.0 licensed
[HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` dependency; editing and media QA
use system `ffmpeg`, while transcription is delegated to HyperFrames/whisper.cpp. See
[`PLAN.md`](./PLAN.md) for how third-party runtimes are located and the licensing notes.
