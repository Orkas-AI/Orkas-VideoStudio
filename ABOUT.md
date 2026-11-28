# About OrkasVideoStudio

**OrkasVideoStudio is an open-source AI video editor that turns your coding agent into a video
studio.** Ask Claude Code, Codex,
Cursor or any agent that can run a shell or speak MCP for a finished video. It edits your
footage, designs motion graphics, adds narration, music and captions, generates missing shots
with your own keys, and delivers a checked MP4 that you can keep editing in a browser canvas.
It is an open-source alternative to Claude Motion and CapCut, and to hosted video-model
platforms such as Higgsfield: generated shots come from your own Seedance, Kling, Veo or other
provider keys, with no platform subscription.

## Why it exists

Most ways to make video with AI are black boxes: a hosted editor or a one-shot "video agent"
hands you a finished file and nothing you can steer. OrkasVideoStudio takes the opposite
stance. Your agent does the thinking, and this project gives it the parts it can't improvise:

- **Video know-how.** A host-neutral `SKILL.md` pack, with `video-studio` as the entry skill.
- **Deterministic tools.** The `ovs` CLI and an MCP server that mirrors it, covering the
  production timeline, ffmpeg editing, transcription, footage analysis and generation through
  your own provider accounts.
- **An editable production.** Each video is a plain folder: a scene timeline
  (`videos/main/manifest.json`), an asset ledger, sourced product facts and an optional
  designed page. You, your agent and the browser canvas all edit the same files.

## What it does

- **Edit real footage**: trim, join, reframe to 9:16 / 1:1 / 16:9, remove silences and filler
  words, burn in subtitles and normalize loudness.
- **Designed motion**: HTML/CSS scenes with kinetic type, price cards, lower-thirds, data
  callouts and transitions, with editable text slots.
- **Sound and captions**: narration fitted to each scene, music beds that duck under speech,
  captions from the narration or from measured word timing, cuts aligned to the beat.
- **Generated shots**: images, video clips and presenters from your configured provider,
  only within the spending you approve.

Editing, designed motion graphics, captions and transcription need no API keys. There is no
hosted backend and no account to create.

## Who it's for

Reach for OrkasVideoStudio when you want your *agent* to make the video, keep the result as
files you can inspect, edit and re-render, and stay local with your own keys. That includes
making Claude Motion-style animation in Claude Code on any paid plan, without a Team plan.

## Where it comes from

OrkasVideoStudio began as the built-in video agent inside [Orkas](https://orkas.ai/?source=gh-orkas-vs),
the AI-team desktop app for macOS and Windows, where it was proven end to end, then extracted
into this agent-agnostic, MIT-licensed toolkit. Inside Orkas it ships built in and can run on
Orkas's built-in models or your own keys; everywhere else you install it into your own coding
agent and get the same core capabilities through the `ovs` CLI, the MCP server and the canvas.

Links: **[orkas.ai](https://orkas.ai/?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** ·
**[repository](https://github.com/Orkas-AI/Orkas-VideoStudio)**

## Learn more

- **[README](./README.md)**: install, use cases, the full command surface and how it compares.
- **[PLAN.md](./PLAN.md)**: the original technical plan from June 2026, in Chinese. It is kept
  for history and is out of date; the README describes the project as it works now.
- **[AGENTS.md](./AGENTS.md)**: how a coding agent picks up the skills and capabilities.

MIT licensed, see [`LICENSE`](./LICENSE).
