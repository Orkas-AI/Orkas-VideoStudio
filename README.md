# OrkasVideoStudio

> Turn your coding agent into a video studio. Ask Claude Code, Codex, Cursor or any agent that
> can run a shell or speak MCP for a finished video. It edits your footage, designs motion
> graphics, adds narration, music and captions, generates missing shots with your own keys,
> and delivers a checked MP4. You can keep editing that MP4 in a browser canvas.

**An open-source alternative to Claude Motion, CapCut and Higgsfield, driven by the coding
agent you already use.** MIT-licensed and local-first, with no Claude Team or Enterprise plan
and no video-platform subscription needed: generated shots come from Seedance, Kling, Veo and
other video models on your own keys.
[How it compares ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) ·
[vs Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Prefer an app to a coding agent?** OrkasVideoStudio is also the built-in video agent in
**[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, the free AI-team desktop app for macOS and
Windows. Describe the video in chat; generation runs on Orkas's built-in models (new accounts
get 500 free credits) or on your own keys.
**[Download Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** ·
[How the two relate ↓](#relationship-to-orkas)

https://github.com/user-attachments/assets/be790302-0c4a-4972-995b-9ac9de75fa12

OrkasVideoStudio is **not a black-box video agent**. Your agent does the thinking. This
project gives it the parts it can't improvise:

- **Video know-how.** A host-neutral `SKILL.md` pack, with `video-studio` as the entry skill.
  It covers when to ask and when to proceed, how ads, explainers, product demos, music cuts,
  presenter videos, short films and commentary differ, and how to check a cut before calling
  it done.
- **Deterministic tools.** The `ovs` CLI and an MCP server that mirrors it. They cover the
  production timeline, ffmpeg editing, transcription, footage analysis and generation through
  your own provider accounts. [HyperFrames](https://github.com/heygen-com/hyperframes) does the
  page rendering and frame capture; `ffmpeg` does editing and measurement.
- **An editable production.** Each video is a plain folder: a scene timeline
  (`videos/main/manifest.json`), an asset ledger, sourced product facts and an optional
  designed page. You, your agent and the browser canvas all edit the same files. Change one
  line of text, swap a picture or reorder scenes, then re-render.

Editing, designed motion graphics, captions and transcription need **no API keys**. Image,
video and speech generation are opt-in and use **your own** provider accounts. There is no
hosted backend and no account to create.

---

## What you can ask for

You ask once and get one finished video. The agent combines whatever the request needs in a
single timeline:

| Capability | What it covers |
|---|---|
| **Edit real footage** | Trim, join, reframe to 9:16 / 1:1 / 16:9, keep or mix clip sound, overlay, burn subtitles and normalize loudness. For long recordings it can also find highlights, rank repeated takes and remove silences or filler words, recording the evidence for each cut. |
| **Designed motion** | Scenes built in HTML/CSS with animation: kinetic type, price cards, lower-thirds, data callouts and transitions. Editable words live in named text slots, so changing copy never means rebuilding a scene. |
| **Sound and captions** | Narration for each scene, fitted to that scene's length. Licensed music beds that duck under speech. Captions from the narration text or from measured word timing. Cuts aligned to the beat. |
| **Generated shots** | Images, video clips and generated presenters (talking-head) from your configured provider, for shots your material can't show. They are made only within the spending you approve. |

For a script or storyboard, the agent stops at the document. For a finished video it works
through to delivery. It shows you a plan or preview only if you asked for one, or if the
video runs longer than about two minutes. A script it writes for the video to follow word
for word is shown to you first; a script you give it is made as written.

---

## Motion graphics in Claude Code, without a Team plan

Claude Motion, Anthropic's animation feature, is in beta on Claude Team and Enterprise plans
only. OrkasVideoStudio gives Claude Code the same kind of code-built motion graphics on Pro,
Max, Ultra or an API key: the agent writes each scene as HTML and CSS with animation, inspects
sampled frames and renders an MP4 on your machine, so the render itself spends no tokens.

1. [Install](#install) OrkasVideoStudio and run `ovs skills --install --target claude`
   (or `--target codex` for Codex).
2. Ask for the video, for example:
   *"Make a 20-second 16:9 motion graphics video for our app launch: a kinetic-type opener with
   the product name, three feature cards that slide in, and a closing card with the price. Show
   me a still of each scene before you render."*
3. Change a word, a color or the timing yourself in the scene files or the canvas, or ask the
   agent, then render again.

Unlike Claude Motion, the same timeline can also hold your own footage, narration, music and
captions. See [how it compares](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Use cases

Each row is a prompt you could give your agent. The `video-studio` skill picks the tools.

### Advertising and marketing

| You say… | What happens |
|---|---|
| *"Make a 20-second vertical ad for this desk lamp from these photos and the product page."* | It imports the photos, records the price and specs as sourced facts, designs the hook, feature and price scenes, adds narration and captions, then checks, renders and delivers. |
| *"Make a 30-second launch video for our app from its website."* | It captures the real product pages in your browser, uses the product's own words and screens, and builds the scenes around them instead of redrawn mock-ups. |
| *"Make a 30-second presenter video where a generated host introduces this serum."* | It writes the monologue first, makes one key image of a fictional host and reuses it on every clip, generates the talking clips with your video provider, and keeps prices and claims as editable on-screen text. |
| *"Make a 15s 9:16 promo from this script: generate the opener, compose the feature callouts, one voiceover."* | One timeline combines the generated opener, designed feature scenes and a single narration track, and the finished file is checked before delivery. |

### Film and drama

| You say… | What happens |
|---|---|
| *"Make a one-minute short film about a night-shift nurse, with the same two characters in every shot."* | It builds the story on one dramatic question, keeps one look line and key image per character so they stay consistent across shots, and generates the shots with your video provider within the budget you approve. |
| *"Turn these three drama episodes into a 3-minute narrated recap."* | It transcribes the episodes, picks the scenes that carry the story, skips credits and next-episode previews, writes and voices the recap, and cuts your footage under it. |
| *"Generate a 5s shot of the city at dawn for the opening."* | It confirms the provider, model and cost, makes one shot with your video provider and places it on the timeline next to your footage. |

### Editing

| You say… | What happens |
|---|---|
| *"Turn this 1-hour screen recording into three 30s highlight clips with captions."* | Scene and quality analysis finds the good parts. Repeated takes are ranked, silences and fillers are cut, and captions are burned in from measured word timing. |
| *"Clean the silences and 'um's out of my webcam take and tighten it."* | It detects silent gaps and filler words, makes a deterministic jump cut and records the evidence for every removed span. |
| *"Add an English voiceover and subtitles to product-demo.mp4 and even out the loudness."* | It transcribes the video, translates and voices each line inside its picture window, mixes the voice over the existing sound, burns in subtitles and normalizes loudness. |
| *"Cut these 20 clips from our trip to this track, on the beat."* | It measures the track's beats, cuts the clips to them and checks the beat alignment of the delivered file. |

### Explainers and tutorials

| You say… | What happens |
|---|---|
| *"Make a 60s explainer on vector databases with a Chinese voiceover."* | It writes motion-graphic scenes, synthesizes the narration with your TTS provider and fits each line to its scene. |
| *"Turn my screen recording of the settings page into a 90-second tutorial."* | It trims the recording, marks each control on the real interface step by step, and adds narration and captions. |

### Recreating popular videos

| You say… | What happens |
|---|---|
| *"Recreate this viral video's structure and pacing for my product. Show me the plan first."* | It breaks the reference down, maps its beats to your material and waits for your approval before producing. |
| *"This competitor ad performs well. Make ours with the same hook and rhythm, using our photos."* | It borrows the reference's hook, proof and call-to-action rhythm, not its content. Every claim comes from your product facts and every picture from your material. |

Give your agent a **reference video file** and your own product assets, script or footage.
Your agent can use OrkasVideoStudio to recreate its **narrative structure, visual style and
editing pace** for the new content:

1. **Analyze the reference.** Inspect sampled frames and the relevant audio to identify the
   hook, the demonstration or proof, the order of information, the typography, the
   transitions, the pacing and the call to action.
2. **Plan the adaptation.** State what to keep and what to replace, then map reference
   moments to the new scenes or timeline. Adapt the timing to your actual narration and
   reading time.
3. **Produce and revise.** Compose motion graphics, edit your footage and generate missing
   visuals when needed. Locally authored text, captions, narration and clips stay separately
   editable. Text baked into generated footage can only be changed by changing that footage.

This works best for motion-graphic explainers, SaaS and app demos, and product ads made from
existing footage. Start with a file your agent can read, because downloading from
social-platform share links is not built in. Exact camera moves, human performances and
frame-by-frame matching are not guaranteed. Delivery checks don't score how closely the
result matches the reference. For details, see the
[reference-recreation workflow](./packages/skills/video-craft/references/reference-recreation.md).

---

## Install

**Prerequisites:** Node ≥ 22, `pnpm`, and `ffmpeg` + `ffprobe` on your `PATH`. The pinned
[HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` package is installed as a
dependency and renders pages in headless Chrome for checks and rendering; `npx` is only a
compatibility fallback. Generation is optional and needs your own keys.

### From source (works today)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### From npm (once published)

The npm packages are not published yet. Once they are, the `ovs` command works the same way:

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Drive it from Claude Code, Codex or any coding agent

The `ovs` CLI is the canonical interface, and the MCP tools mirror it. Use whichever of
these your agent supports:

**1) Native skills (Claude Code / Codex).** Install the skill pack so the agent finds it on
its own:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

The same skill pack is listed on [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), so
`npx skills add orkas-ai/orkas-videostudio` installs it too. The skills call the `ovs` CLI, so
install that first as described above.

**2) MCP tools.** Register the server:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) Self-describing CLI (any agent with a shell).** No loader needed:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Then just ask your agent for a video. It reads `video-studio` first and loads the stage and
craft references it needs.

---

## How a production works

The agent picks a short folder name and keeps everything in it:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

Scene order is playback order. Start times and the total length are computed from the scenes
and never stored, so moving a scene can't leave the timing inconsistent. A price lives in
`product.json` once, and every scene that shows it reads it from there. For parallel variants,
such as other aspect ratios, languages or A/B cuts, the agent adds more video ids that share
the same assets. See the [timeline contract](packages/skills/video-studio/references/timeline.md).

A typical run:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` measures the final file before recording it: duration, canvas, audio, loudness and
narration coverage. Caption warnings are flagged for visual confirmation, and frames from the
actual MP4 are returned. Every delivery becomes an immutable version. A render made before
the latest change is rejected as stale, and earlier deliveries are never overwritten.
Passing these checks doesn't certify visual quality. Visual review counts as `not_checked`
until someone actually looks at the frames.

When you explicitly accept a specific remaining finding, pass its exact code with
`--accept-findings '["CODE"]' --accept-reason '<your decision>'`. The version records that
decision, and every other error still blocks delivery. Writes are serialized with
`.ovs-timeline.lock`; if a crash leaves it behind, confirm the owning process has stopped
before removing it. The [timeline contract](packages/skills/video-studio/references/timeline.md)
covers both.

**Revisions stay cheap and local.** A changed word, cut, order, music bed or caption is
edited in place. Only a changed spoken line gets re-voiced, and only a wrong shot gets
regenerated, within the spending already approved. Editing caption text doesn't change the
spoken audio. HyperFrames renders the full video each time; this portable build doesn't
cache rendered scenes.

---

## Browser video canvas

When `timeline import`, `timeline prepare`, `timeline render` or `timeline ship` succeeds
(from the CLI or MCP), OVS opens that production's canvas in your default browser. Later
commands reuse the same tab instead of opening new ones. The canvas edits the same files as
the CLI and MCP, so changes flow both ways. It shows a view-only state while the agent is
working.

In the canvas you can:

- **Watch and export.** Play the video, switch between delivered versions and download the
  one you want.
- **Arrange material.** Upload, drop or paste footage, then move and connect cards on the
  board.
- **Edit scenes.** Change words, order and pictures, and add, remove or put back scenes.
- **Generate and redo shots.** Make a new image or video shot from a card, or generate an
  existing shot again. You choose references or first and last frames, plus the model,
  resolution and sound; options a model can't support are disabled. Step through earlier
  results and pick the one to use. It asks before every paid request.
- **Update the video.** Ordinary scene edits are rendered and delivered locally, with
  progress shown on the video card. Changing a product fact, a narration line or the voice
  for the whole video produces a request for your agent, because those edits need its
  judgment. If the delivery check stops an update because scenes hold still pictures, the
  video card offers **Preview this version**, **Return to editing** or **Update anyway**;
  Update anyway keeps that render without rendering again.
- **Tell the Agent.** Write a short request about a scene, shot, footage card or video. It
  is sent with that card's context.

The canvas opens in Chinese and remembers the language you pick from 19 options.

### Sending requests back to your agent

**Send** only delivers to the conversation that made the production. If that conversation
can't receive the request, the draft stays in the canvas. Nothing is copied to the
clipboard, replayed automatically or sent to a new session. Editing, updating and exporting
keep working without a connected agent.

- **Codex.** When `ovs` runs inside a Codex thread, the request is queued into that same
  thread. This needs Codex CLI 0.160.1 or newer with its local app server running. A closed
  or unloaded thread shows as unavailable.
- **Claude Code.** Requests arrive through an MCP channel, which is a Claude Code research
  preview, and an ordinary MCP connection is not enough. Register the server with
  `--claude-channel`, then start Claude Code with the channel enabled:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Make the video through the `ovs` MCP tools so the canvas opens bound to that channel. A
  canvas opened from the shell CLI can't reach Claude Code. Claude Code shows a
  local-development warning at startup. Channels need a claude.ai login or a Console API key,
  and on Team and Enterprise plans an admin must enable them first. See
  [Claude Code channels](https://code.claude.com/docs/en/channels).

### Open a production yourself

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Keep the command running while you use the canvas. With `--agent`, the canvas runs a native
session in the production folder that uses your CLI's own sign-in, model and permission
settings. That session needs Codex 0.160.1+ or Claude Code 2.1.148+. Its permission prompts
and questions appear in the canvas. It restores the saved session for the folder, unless you
pass `--resume <session-id>` to hand over a specific session or `--new-session` to start
fresh. Other options:

- `--no-open` prints the access link without opening a browser.
- `--port` picks the loopback port.
- `--recover` reclaims a canvas whose previous owner has exited.

To turn off automatic opening during production work, set `OVS_STUDIO_AUTO_OPEN=0`. It is
already off in CI.

---

## BYO generation providers

Configure providers in `~/.config/orkas-video-studio/config.json` (or `$OVS_CONFIG_DIR/config.json`)
or with environment variables. Environment variables override the file.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Capability | `provider` values | Environment |
|---|---|---|
| Speech (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Image (`ovs image`) | `openai` (any OpenAI-compatible endpoint, including Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

You can inspect a configuration without making any paid calls:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Run `ovs narration fit` before and after synthesis so each narration line stays inside its
scene or plan window. Video generation takes explicit reference images, ratio, duration,
resolution and audio flags, so the provider call matches the approved plan. For `plan.json`
projects, `ovs plan validate` also checks each generate segment's ratio, duration and
operation against the configured `video.provider` before anything is generated.

Some providers need a few more settings:

- **Google Cloud Veo** uses `video.workspace_id`, `video.region`, and an API token or
  service-account JSON in `video.api_key`.
- **Alibaba** speech uses its workspace endpoint in `tts.base_url`. Wan video needs
  `video.workspace_id` and `video.region`.
- **Clone-only voices** need the voice id you enrolled with the provider.
- **WebSocket speech** goes through `tts.proxy_url` only when you configure it.
- **Video references** are passed as public image or video URLs. Supported counts and
  first/last-frame support vary by model.
- **[MuAPI](https://muapi.ai)** must be selected explicitly with `video.provider: "muapi"`.
  When it is selected, `MUAPI_API_KEY` takes precedence over `OVS_VIDEO_API_KEY`; the key
  never selects MuAPI by itself. `video.model` / `OVS_VIDEO_MODEL` supports the validated
  Kling v2.1 endpoints `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`,
  `kling-v2.1-standard-i2v` and `kling-v2.1-pro-i2v`. Other slugs are rejected rather than
  sent with a mismatched body. Text-to-video defaults to `kling-v2.1-master-t2v`, and a
  first-frame `image_url` defaults to `kling-v2.1-master-i2v`. Duration is 5 or 10 seconds
  and ratio is `16:9`, `9:16` or `1:1`. Provider-neutral `resolution`, `generate_audio` and
  `quality` inputs stay compatible with signed plans: Kling ignores resolution and audio,
  and quality is validated but not sent. Edit and additional-reference controls are
  rejected until a matching MuAPI schema is supported. The default base URL includes
  `/api/v1`, and a custom one must include it too. See the
  [MuAPI API reference](https://muapi.ai/docs/api-reference) for the submit-and-poll
  contract and model-specific parameters.

Provider model catalogs describe each provider's API contract. They don't guarantee live
availability or pricing.

---

## What keeps generation bounded

The agent uses your existing material wherever it serves the shot, and generates only what
is missing. Having credentials configured doesn't count as approval to spend. Before any paid
work, the agent confirms the provider, model, purpose, number of requests including retries,
and estimated cost. It then sticks to that scope. Declining stops the paid calls for that
request, and a bad shot gets at most two revised takes before the agent asks you to change
the approach.

Each paid request keeps a receipt next to its output. A video task whose outcome is unknown
blocks another submission to the same output until you inspect it, and it is never replayed
automatically. See [generation authority](packages/skills/video-studio/references/generation.md).

`ovs speak` writes a request and audio receipt beside its output. It reuses only an exact
matching request whose audio bytes are intact, so pass the approved `--language`, voice,
model, speed and format; changing any of them invalidates reuse. It also claims the output
before dispatch, which prevents concurrent duplicate calls.

There is no hosted music service. Music comes from licensed files you supply, and the agent
records each file's source and license.

---

## Command reference

Run `ovs <command> --help` for each command's typed input. MCP tools use the same names with
underscores, for example `timeline_prepare` and `edit_trim_silence`.

| Area | Commands |
|---|---|
| Setup | `doctor`, `skills [--install]`, `skill <name>` |
| Production | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edit (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analyze | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narration | `narration timing · fit`, `speech-capabilities`, `speak` |
| Generation | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Earlier projects | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias of `check`) |

Projects built with the earlier `plan.json` EDL and `composition-manifest.json` formats still
work through the "Earlier projects" commands. New work uses the scene timeline. For an
assembled `plan.json`, verify the finished file as well as its component footage:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

The equivalent MCP tool `plan_promise_check` accepts `probe_produced` and `video`. It
measures duration, canvas, audio, integrated loudness and per-line voiced spans. Missing
narration evidence fails the check, and caption warnings need a visual check when subtitles
were burned in.

---

## How it compares

### OrkasVideoStudio vs Claude Motion vs CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **What it is** | an open-source video studio that your coding agent drives | an animation output inside Claude | a video editor app from ByteDance |
| **Who can use it** | anyone; runs on your machine with Claude Code, Codex, Cursor or any agent that runs a shell or speaks MCP | Claude Team and Enterprise plans (beta) | desktop, mobile and web apps, free and paid tiers |
| **How you edit** | describe the change to your agent, or change text, pictures and scene order in the browser canvas | in Claude's editor or by asking Claude | by hand on a timeline |
| **Footage** | trim, join, reframe to 9:16 / 1:1 / 16:9, remove silences and filler words, cut to the beat | animates text, charts, shapes and images; no generated footage or people | full manual editing |
| **Motion graphics** | HTML/CSS scenes: kinetic type, price cards, lower-thirds, data callouts, transitions | code-built explainer animations | templates, text animations and effects |
| **Sound** | per-scene narration, music beds that duck under speech, captions from measured word timing | not covered in Anthropic's help article | voice, music and caption tools in the app |
| **Output** | MP4, checked for duration, canvas, loudness and narration before delivery | MP4 export | MP4 export |
| **Source** | MIT; every video is a local folder you own | proprietary, hosted | proprietary |

Pick **CapCut**, or an open-source timeline editor such as Shotcut or Kdenlive, when you want
to cut by hand. Pick **Claude Motion** when your team already works in Claude on a Team or
Enterprise plan and needs explainer animations. Pick **OrkasVideoStudio** when you want your
coding agent to make the whole video, footage and motion and sound in one timeline, and keep
the result as files you can inspect, edit and re-render. Claude Motion details are from
[Anthropic's help center](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion)
as of November 2026.

### OrkasVideoStudio vs Higgsfield

Higgsfield is a hosted platform that sells many video and image models on one account, through
its web app, an API, an MCP connector and a CLI. OrkasVideoStudio doesn't host models: your
agent calls the providers you configure, then turns the shots into a finished video.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **What it is** | an open-source video studio that your coding agent drives | a hosted AI image and video platform |
| **Video models** | the providers you configure, such as Seedance 2.5, Kling 4.0, Veo 3.1 on Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3 and Vidu Q3 | many hosted models on one account, including Seedance 2.5, Kling 4.0, Veo 3.1 and MAGI-2, which only Higgsfield offers |
| **How you pay** | each provider bills your own key; editing, motion graphics, captions and transcription run locally and need no key | subscription credits in the web app and the connector, or pay-per-second funds on the API |
| **What you get** | one checked MP4 that mixes generated shots with your footage, motion graphics, narration, music and captions, plus a production folder you can edit and re-render | generated clips and images, and Higgsfield's own studio apps |
| **From a coding agent** | skills, the `ovs` CLI and an MCP server for Claude Code, Codex, Cursor or any agent | Higgsfield's MCP connector, CLI and skills |
| **Source** | MIT; every video is a local folder you own | proprietary, hosted |

Pick **Higgsfield** when you want many hosted models on one bill, or a model only it offers,
such as MAGI-2. Pick **OrkasVideoStudio** when you want your coding agent to make the whole
video on your own provider keys and keep the result as files. The two also work together:
clips you generate on Higgsfield are ordinary footage for an OrkasVideoStudio production.
Higgsfield details are from [higgsfield.ai](https://higgsfield.ai/mcp) and its
[MAGI-2 page](https://higgsfield.ai/magi-2-intro) as of November 2026.

### OrkasVideoStudio vs frameworks, SaaS editors and wrappers

HyperFrames, ffmpeg and whisper.cpp are **dependencies** here, not competitors.
OrkasVideoStudio is the agent-facing layer on top of them: the knowledge, the delivery checks,
the editable production and the canvas.

| | OrkasVideoStudio | Programmatic frameworks (Remotion, Revideo) | AI SaaS editors (Descript, Opus Clip, Runway) | Thin MCP / ffmpeg wrappers |
|---|---|---|---|---|
| **Driver** | any coding agent, in natural language (CLI + MCP) | you hand-write React/TS | GUI / hosted | an agent, but tools only |
| **Artifact** | editable scene timeline in a local folder, plus a browser canvas | code (re-run to render) | black-box timeline / hosted project | none |
| **Scope** | footage editing + designed motion + narration + generation in one timeline | composition (programmatic) | mostly edit *or* generate, per product | whatever the tool exposes |
| **Guidance** | ships "what makes a good video" as skills, plus deterministic delivery checks | none, you decide | product-opinionated | none |
| **Keys / hosting** | zero-key core; **your own** keys for generation; local-first | your own infra | vendor keys + hosted, lock-in | varies |
| **License** | MIT | may require a company license for teams | proprietary | varies |

Reach for a **framework** when you want to hand-code every frame, or a **SaaS editor** when
a GUI and hosting are the point. Reach for **OrkasVideoStudio** when you want your *agent*
to make the video, keep the result as files you can inspect, edit and re-render, and stay
local with your own keys.

---

## Relationship to Orkas

OrkasVideoStudio began as the built-in **video agent in [Orkas](https://orkas.ai?source=gh-orkas-vs)**,
the AI-team desktop app. It was proven end to end there, then extracted into this
agent-agnostic, MIT-licensed toolkit.

- **Inside Orkas**, it ships as a [built-in agent](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs)
  with no separate install. You chat with it in a desktop app instead of a terminal, and
  generation can run on Orkas's built-in models (new accounts get 500 free credits) or on your
  own keys. [Download Orkas](https://orkas.ai/download/?source=gh-orkas-vs) for macOS or Windows.
- **Everywhere else**, you install it into your own coding agent as described above and get
  the same core capabilities through the `ovs` CLI, the MCP server and the canvas. Orkas
  account features, such as hosted providers, credits and chat publishing, are not part of
  this repository.

Links: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** ·
**[this repo](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Packages

| Package | What |
|---|---|
| `@orkas/video-studio-core` | scene timeline and legacy EDL schemas, delivery checks, decision helpers, narration timing, runtime and config |
| `@orkas/video-studio-tools` | backends for timeline, render, edit, analyze, speech, image and video, plus the browser canvas |
| `@orkas/video-studio` | the `ovs` CLI |
| `@orkas/video-studio-mcp` | the MCP server (`ovs-mcp`), mirroring the CLI |
| `@orkas/video-studio-skills` | the host-neutral `SKILL.md` knowledge pack |

The technical plan and its history live in [`PLAN.md`](./PLAN.md). Notes for coding agents
working on this repository are in [`AGENTS.md`](./AGENTS.md).

---

## Development

```bash
pnpm install
pnpm build            # tsc per package (core → tools → cli / mcp)
pnpm typecheck
pnpm test             # vitest
pnpm benchmark        # zero-key core correctness + throughput floors
pnpm test:video       # mock provider round-trip → real playable MP4 → ffprobe
pnpm test:video:e2e   # real three-scene production through the built CLI, plus CLI/MCP smoke
pnpm verify           # everything above; also the CI entry point
```

`pnpm install` applies the versioned HyperFrames patch in [`patches/`](./patches/), which
makes SDR H.264/H.265 output use the BT.709 matrix its metadata declares and
preserves timed Whisper tokens in Chinese and Japanese. An external
`OVS_HYPERFRAMES_BIN` or the `npx` compatibility fallback uses its own build and
needs equivalent fixes.

`test:video` never spends provider credits. A local fake Seedance endpoint returns a real
H.264 fixture, which OVS downloads and verifies with `ffprobe`.

`test:video:e2e` covers both production paths through the built CLI:

- **The earlier composition path.** It makes a nine-second, three-scene 1080p production
  with composition prepare/reconcile, snapshot, the full draft gate, subtitle burning and
  final-file promise checks. It decodes the entire MP4 and checks scene order, visible
  motion, audible audio in every scene and burned subtitle pixels, and that a wrong
  delivery duration is rejected.
- **The current scene timeline.** It renders a three-scene timeline through the real
  HyperFrames check and snapshot path. It checks scene colors, authored motion, decoded
  source-video motion, caption pixels, audio, immutable delivery and stale-render rejection.

It also exercises the built CLI and MCP surfaces. Both video commands fail with an
actionable error when a required runtime is missing. The ordinary test suite may skip
runtime-heavy cases on machines without ffmpeg or a browser.

`pnpm verify` must pass on the final candidate before any Git commit or PR. It includes the
real production case and is also the CI entry point, and test-only changes follow the same
rule. For sync or release review, keep and inspect the produced video, previews, final
frames and reports:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

The evidence directory is opt-in, and each run uses its own child directory. Ordinary CI
runs clean up their temporary media. Fixtures use original HTML/SVG and locally generated
instrumental audio. They don't call paid providers or claim coverage of TTS or model quality.

`pnpm benchmark` is zero-key and deterministic. It builds the core package, verifies the
benchmark fixtures, then measures gate transitions, EDL validation and delivery summaries,
composition-manifest validation and narration estimation. Each suite has a deliberately
conservative throughput floor, so large regressions fail and normal machine variance does
not.

### Opt-in model evaluation

Run the public production cases with an authenticated Codex CLI from a built checkout.

```bash
pnpm eval:video --list
pnpm eval:video --case retake-cleanup
pnpm eval:video --case beat-montage --case clip-montage --case revision-journey
pnpm eval:video --case retake-preservation --case talking-head --case local-path
```

The default model is `gpt-6-luna`. Use `--model <id>` if your Codex account exposes
a different model. The runner needs a POSIX host, FFmpeg/ffprobe and the regular
OVS rendering prerequisites. The spoken fixtures currently use macOS
`say` and the Tingting voice. English dubbing also uses Samantha and a local
OpenAI-compatible speech server with no paid media calls. Set
`OVS_EVAL_ASR_MODEL` to a locally installed multilingual Whisper model to
preflight public transcription and tell the actor which model is available.
On macOS, point `HYPERFRAMES_WHISPER_PATH` at a CPU-only Whisper binary
(or a launcher that passes `--no-gpu`) if Metal is unavailable to the actor.
Chromium must be able to render inside Codex's workspace-write sandbox for
the timeline cases.

Each run keeps a private temporary evidence directory, or one below
`--output-dir <directory>` outside all Git worktrees. The runner rejects Git
paths before creating output, including paths through symlinks. Keep reports,
scores, replies, logs, shipped media, frames and selected proof in local storage.
Git tracks the reusable cases, fixtures and runner. The verification gate rejects
recognized model run paths in the Git index.

Each directory contains JSONL model events, replies, shipped
versions, sampled frames, and a per-case `result.json`. Delivery requires a
successful public CLI ship receipt, matching version bytes and full media
decode. The objective checks measure speech heard in the cut, source music
and beat timing, or footage and audio preserved across revisions. For the
revision journey, Codex saves the first thread for three resumptions and
starts a fresh ephemeral thread for the final change using only the saved
production. The other cases use ephemeral Codex sessions. Each turn defaults to a 20-minute
limit, adjustable with `--turn-timeout-seconds`.

An `objective-pass` means the measured checks passed. Review the report's
visual criteria against the frames and mark visual acceptance separately.
Failures and environment blocks produce a nonzero exit code. Runs use the
configured Codex subscription or model allotment and stay outside `pnpm
verify` and CI. Each workspace uses an isolated OVS config. The render and
dub cases use a Codex workspace permission profile that allows local binding
for HyperFrames and the speech fixture, with proxy domains limited to
loopback. The public case catalog records each originating Orkas case and
the reviewed source content hash.

## Versions

All packages share one calendar version, `YYYY.M.D` (Asia/Shanghai date, no zero padding).
Tagged releases use `v<version>` and are published as
[GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); a published date
version is never overwritten. Changes are listed in [CHANGELOG.md](CHANGELOG.md). This
version is independent of the Orkas desktop app and its marketplace agent versions.

## License

MIT — see [`LICENSE`](./LICENSE). Rendering uses the Apache-2.0 licensed
[HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` dependency. Editing and
media checks use your system `ffmpeg`, and transcription is delegated to
HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) explains how third-party runtimes are
located, along with the licensing notes.
