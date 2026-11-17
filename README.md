# OrkasVideoStudio

> Drive video **composition, generation, and editing** — and a fully **automatic end-to-end
> pipeline** — from your coding agent. Claude Code, Codex, Cursor: any agent that can run a
> shell or speak MCP can use it.

https://github.com/user-attachments/assets/13411470-06da-4f64-9bc1-fa52fe27216b

OrkasVideoStudio is **not a black-box video agent**. A video is expressed as a readable,
diffable scene timeline (`videos/main/manifest.json`) that your agent — and you — can edit.
Change copy, scene order or assets locally, then render and verify the finished video. Existing
`plan.json` EDL projects remain supported. The agent is the brain; this project ships the
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
- **Auto (end-to-end)** — the agent combines footage, designed HTML, narration and optional
  generated media in one editable scene timeline. It checks, snapshots, renders and verifies
  the finished file before recording an immutable delivery version. Authored text, captions,
  narration and media remain separately editable; revisions preserve earlier deliveries.

The entry skill is `video-studio`: script or storyboard requests end with the requested
document; finished-video requests continue through production, checks and delivery.
Plans and previews become approval steps only when requested, when the finished video
exceeds about two minutes, or when it must follow an exact script. Provider spending still
requires actual user authority for its bounded scope.

---

## Relationship to Orkas

OrkasVideoStudio began life as the built-in **video agent inside [Orkas](https://orkas.ai?source=gh-orkas-vs)** —
the AI-team desktop app — where it was validated end-to-end, then extracted into this
agent-agnostic, MIT-licensed toolkit.

- **Inside Orkas** it ships as a [built-in agent](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) —
  no separate install; the zero-key trunk works out of the box.
- **Everywhere else** you install it into your own coding agent (below) and get the same
  capabilities via the `ovs` CLI and MCP server.

Links: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** (website) · **[github.com/Orkas-AI](https://github.com/Orkas-AI)**
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
| *"Make a 15s 9:16 promo from this script: generate the opener, compose the feature callouts, one VO."* | Auto | one scene timeline woven across generate + compose + narration, guarded before delivery. |
| *"Recreate this reference video's structure, style and pacing for my product, using my script and footage. Show me the breakdown and plan first."* | Compose / Edit / Auto | Inspect the reference, map its hook and visual beats to your content, then author scenes or an editable timeline. |

### Recreate a reference video with your own content

Supply a **reference video file** and your own product assets, script or footage.
Your agent can use OrkasVideoStudio to recreate its **narrative structure, visual
style and editing pace** for the new content:

1. **Analyze the reference** — inspect sampled frames and relevant audio to identify
   the hook, demonstration or proof, information order, typography, transitions,
   pacing and call to action.
2. **Plan the adaptation** — state what to preserve and what to replace, then map
   reference moments to the new scenes or timeline. Adapt timing to your actual
   narration and reading time.
3. **Produce and revise** — compose motion graphics, edit your footage and generate
   missing visuals when needed. Keep locally authored text, captions, narration
   and clips separately editable; text baked into generated footage requires
   changing that footage.

This is best suited to motion-graphic explainers, SaaS or app demos, and product
ads made from existing footage. Start with a file your agent can read;
social-platform share-link downloading is not built in. Exact camera moves,
human performances and frame-by-frame matching are not guaranteed, and delivery
checks do not automatically score similarity to the reference.

The [reference-recreation workflow](./packages/skills/video-craft/references/reference-recreation.md)
documents how source observations become authored scenes and timeline decisions.

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
ovs skill video-studio   # print a skill's full instructions into context
ovs --help               # the full command surface
```

**How a video session flows.** The agent reads `video-studio`, gathers the available material,
creates `assets.json` and `videos/main/manifest.json`, and authors optional scene HTML:

```text
ovs timeline prepare --production project --video-id main
ovs timeline check --production project --video-id main
ovs timeline snapshot --production project --video-id main --out project/preview.png
# inspect all sampled frames and fix confirmed problems
ovs timeline render --production project --video-id main --out project/render/main.mp4
ovs timeline ship --production project --video-id main --input project/render/main.mp4
```

Delivery returns final-file frames, audio measurements and advisory static/shot hints.
Visual review remains `not_checked` until the caller actually examines those frames.
For revisions, the agent changes only the affected text, cuts or scenes, re-voices only a
changed spoken line, and regenerates only a wrong shot within the approved scope. Caption
edits do not change spoken audio. Revisions invalidate stale render receipts and preserve
earlier delivered bytes. See the
[timeline contract](packages/skills/video-studio/references/timeline.md), including lock
recovery and explicitly accepted findings. HyperFrames renders the full video; this portable
backend does not promise scene render caching.

The CLI and MCP expose `timeline {prepare,status,check,snapshot,render,ship,import}`, the
legacy `composition {prepare,reconcile}` and `plan` commands, `draft`, `render`, `lint`,
`check`, `snapshot`, `edit {probe,trim,concat,reframe,burnsubs,overlay,extract-frame,loudness,
normalize-loudness,mix,trim-silence,remove-fillers,select}`, `transcribe`, `phrases`, `beats`,
`activity`, `silence`, `scenes`, `quality`, `narration {fit,timing}`, `image-prepare`,
`speech-capabilities`, `speak`, `image`, `video`, `video-models`, `video-params`, and `skills`.
Run `ovs <command> --help` for the typed input contract. Legacy `gate transition` is opt-in.

---

## Browser video canvas

Codex and Claude Code automatically open the production canvas in your default
browser after a successful public `timeline prepare`, `timeline import`,
`timeline render` or `timeline ship` (CLI or MCP). Later commands reuse the
same production canvas instead of opening more tabs.

- **Preview and export** — watch the video, play earlier deliveries and download
  the version you want.
- **Arrange material** — import, drop or paste footage; move and connect cards.
- **Edit scenes** — change text, order and pictures; add, remove or restore scenes.
- **Generate and revise shots** — create image/video shots, compare takes and
  reuse or redo generated assets with recorded generation settings.
- **Update video** — render and deliver ordinary scene edits with progress on the
  video card. Production changes and new deliveries refresh in the same canvas;
  earlier exports remain available.

The full-window canvas opens in Chinese by default and remembers your language
choice. It edits the same production files used by the CLI and MCP.

To open an existing production manually:

```bash
ovs studio --production ./lamp-ad
```

Keep this command running while using the canvas. Use `--no-open` to print the
access link without opening a browser, or set `OVS_STUDIO_AUTO_OPEN=0` to disable
automatic opening during production work. CI defaults to no automatic opening.

---

## BYO generation providers

The compose / edit / transcribe trunk is **zero-key**. Generation (image / video / TTS) is
opt-in and uses **your** keys — no managed backend, no account binding. Configure via
`~/.config/orkas-video-studio/config.json` (or `OVS_CONFIG_DIR`) or environment variables:

| Capability | Providers | Env |
|---|---|---|
| Image (`ovs image`) | OpenAI-compatible (including configured Seedream endpoints) · Gemini | `OVS_IMAGE_PROVIDER` · `OVS_IMAGE_BASE_URL` · `OVS_IMAGE_API_KEY` · `OVS_IMAGE_MODEL` |
| Video (`ovs video`) | Doubao Seedance · MiniMax · Vidu · Kling · Google / Google Cloud Veo · Runway · Alibaba Wan · Atlas Cloud · MuAPI | `OVS_VIDEO_PROVIDER` · `OVS_VIDEO_BASE_URL` · `OVS_VIDEO_API_KEY` · `OVS_VIDEO_MODEL` |
| TTS (`ovs speak`) | OpenAI / compatible · Doubao · MiniMax · Alibaba Qwen / CosyVoice · Google · ElevenLabs | `OVS_TTS_PROVIDER` · `OVS_TTS_BASE_URL` · `OVS_TTS_API_KEY` · `OVS_TTS_MODEL` · `OVS_TTS_VOICE` · `OVS_TTS_FORMAT` |

Use `ovs speech-capabilities` to resolve the exact configured narration profile without
printing credentials, then `ovs narration fit` before and after synthesis to keep each line
inside its plan window. Video generation accepts explicit reference images, ratio, duration,
resolution, and audio generation flags so the provider call matches the approved plan.
`ovs plan validate` also checks each generate segment's ratio, duration, and operation against
the configured `video.provider`, before generation. `ovs video-models` and `ovs video-params --request '{"duration":5,"ratio":"9:16"}'` inspect the configured model contract without dispatching a task.

For [MuAPI](https://muapi.ai), explicitly set `video.provider` to `"muapi"` and provide
`MUAPI_API_KEY` (or use `OVS_VIDEO_API_KEY`). `MUAPI_API_KEY` takes precedence over the generic
key when MuAPI is selected, and never selects MuAPI by itself. `video.model` /
`OVS_VIDEO_MODEL` currently supports these validated Kling v2.1 endpoint slugs:
`kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v`, and
`kling-v2.1-pro-i2v`; unsupported slugs are rejected rather than sent with a mismatched body.
Text-to-video defaults to `kling-v2.1-master-t2v`, while a first-frame `image_url` defaults to
`kling-v2.1-master-i2v`. The default base URL includes `/api/v1`; custom MuAPI base URLs must
include that path. See the [MuAPI API reference](https://muapi.ai/docs/api-reference) for the
submit-and-poll contract and model-specific parameters. This adapter accepts the common
prompt, aspect-ratio, duration, and first-frame inputs; for the supported Kling endpoints,
duration is 5 or 10 seconds and ratio is `16:9`, `9:16`, or `1:1`. Provider-neutral `resolution`,
`generate_audio`, and `quality` inputs remain compatible with signed plans; resolution and audio
are ignored by Kling, while quality is validated but not sent. Edit and additional-reference
controls are rejected until a matching MuAPI schema is supported.

---

## What keeps generation bounded

Use supplied material when it serves the requested shot; generate missing material only
within actual user authority. Provider credentials are not spending authority. Confirm the
provider, model, purpose, request count (including retries) and estimated cost before a paid
scope begins, then reuse that decision unchanged. A declined scope stops its paid calls.

Keep generated assets, authored text, captions and narration independently editable. Revise
at the cheapest affected level and retain completed siblings. Video create requests are
never automatically replayed after an ambiguous dispatch; inspect the retained task id
before starting another billable task. Speech reuses only an exact request with verified
bytes and claims an output before dispatch to prevent concurrent duplicate calls.

Native provider model catalogs are the synchronized source contracts, not live availability
or pricing guarantees. Configure service-specific fields in `config.json`: Google Cloud
uses `video.workspace_id`, `video.region` and an API token or service-account JSON in
`video.api_key`; Alibaba TTS uses its workspace endpoint in `tts.base_url`; clone-only voices
require the user's enrolled voice id. WebSocket TTS uses `tts.proxy_url` / `OVS_TTS_PROXY_URL`
when explicitly configured. There is no managed provider, billing account or hosted music
service in this package. See [generation authority](packages/skills/video-studio/references/generation.md).

---

## How it compares

HyperFrames, ffmpeg, and whisper.cpp are **dependencies** here, not competitors — OrkasVideoStudio
is the agent-facing knowledge, draft QA gate, and IR layer on top of them. Against other ways to make video:

| | OrkasVideoStudio | Programmatic frameworks (Remotion, Revideo) | AI SaaS editors (Descript, Opus Clip, Runway) | Thin MCP / ffmpeg wrappers |
|---|---|---|---|---|
| **Driver** | any coding agent, in natural language (CLI + MCP) | you hand-write React/TS | GUI / hosted | an agent, but tools only |
| **Artifact** | editable, diffable scene timeline (`videos/main/manifest.json`); full-video rendering | code (re-run to render) | black-box timeline / hosted project | none |
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
| `@orkas/video-studio-core` | scene timeline and legacy EDL schemas, delivery guard, decisions, narration timing, runtime/config |
| `@orkas/video-studio-tools` | capability backends (render / edit / analyze / speech / image / video) |
| `@orkas/video-studio` | the `ovs` CLI |
| `@orkas/video-studio-mcp` | MCP server (mirrors the CLI 1:1) |
| `@orkas/video-studio-skills` | the host-neutral `SKILL.md` knowledge pack |

The technical plan and roadmap live in [`PLAN.md`](./PLAN.md).

## Development

`pnpm install` applies the versioned HyperFrames color-conversion patch in
[`patches/`](./patches/) to the pinned dependency. It makes SDR H.264/H.265
encoding convert to the BT.709 matrix declared in the output metadata. The
external `OVS_HYPERFRAMES_BIN` override and compatibility `npx` fallback do not
use workspace patches; their runtime must supply the equivalent color fix.

```bash
pnpm install
pnpm build        # tsc per package (core → tools → cli/mcp)
pnpm test         # vitest
pnpm test:video   # mock provider round-trip → real playable MP4 → ffprobe
pnpm test:video:e2e # build + real CLI production (motion/audio/captions) + CLI/MCP smoke
pnpm benchmark    # deterministic core correctness + latency/throughput benchmark
pnpm typecheck
pnpm verify       # all checks, including mandatory real video production
```

`test:video` is deterministic and never spends provider credits: a local fake Seedance endpoint
returns a real H.264 fixture, then OVS downloads it and verifies the result with `ffprobe`.
`test:video:e2e` creates a nine-second, three-scene 1080p production through the
built CLI: composition prepare/reconcile, snapshot, the full draft gate, subtitle
burning and final-file promise checks. It decodes the entire MP4 and checks scene
order, visible motion, audible audio in every scene, burned subtitle pixels and
rejection of a wrong delivery duration. The suite also renders the current three-scene timeline, checking the real HyperFrames check/snapshot path, scene colors, authored motion, decoded source-video motion, caption pixels, audio, immutable delivery and stale-render rejection. It exercises the built CLI/MCP surfaces. Both
commands fail with an actionable error when required video runtimes are missing; the ordinary
test suite may skip runtime-heavy cases on machines without ffmpeg or a browser.

Before any Git commit or PR, `pnpm verify` must pass on the final candidate; it
includes the real production case and is also the CI entry point. Test-only
changes follow the same rule. For sync/release review, retain and inspect the
produced video, previews, final frames and reports:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

The directory is opt-in and each run uses a unique child directory. Ordinary CI
runs clean up their temporary media. Fixtures use original HTML/SVG and locally
generated instrumental audio; they do not call paid providers or claim TTS/model
quality coverage.

`pnpm benchmark` is zero-key and deterministic. It builds the core package, verifies benchmark
fixtures, then measures gate transitions, EDL validation/delivery summaries, composition-manifest
validation, and narration estimation. Each suite carries a deliberately conservative throughput
floor so large regressions fail while normal CI and developer-machine variance does not.

## License

MIT — see [`LICENSE`](./LICENSE). Rendering uses the Apache-2.0 licensed
[HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` dependency; editing and media QA
use system `ffmpeg`, while transcription is delegated to HyperFrames/whisper.cpp. See
[`PLAN.md`](./PLAN.md) for how third-party runtimes are located and the licensing notes.

### Versions and delivered-video checks

All OVS packages share an independent `YYYY.M.D` calendar version, using the
Asia/Shanghai release-candidate date without zero padding. See [CHANGELOG.md](CHANGELOG.md)
for prepared/released changes. This version is independent of the Orkas desktop
application and marketplace Agent versions. Tags, when explicitly released, use
`v<version>`; never overwrite a published date version.

For an assembled plan, verify the finished file as well as its component footage:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

The equivalent MCP `plan_promise_check` accepts `probe_produced` and `video`.
Delivery verification measures duration, canvas, audio, integrated loudness and
per-line voiced spans. Missing narration evidence fails the check. Caption
warnings require visual confirmation when subtitles were burned in.

`ovs speak` writes a request/audio receipt beside its output and reuses only an
exact matching request with intact bytes. Include the approved `--language`,
voice, model, speed and format; changing those settings invalidates reuse.

Synchronization uses a dedicated branch and PR. The diff and verification are
reviewed by the requester before creating the PR; merge and release are separate
explicit actions.
