# OrkasVideoStudio

> Drive video **composition, generation, and editing** from your coding agent.
> Claude Code, Codex, Cursor — any agent that can run a shell or speak MCP can use it.

OrkasVideoStudio is **not a black-box video agent**. A video is expressed as a readable,
diffable, re-renderable plan (`plan.json`) that your agent — and you — can edit; change one
line and only that piece re-renders. The agent is the brain; this project ships the
**knowledge** (what makes a good video, and the three production lines), the **deterministic
capabilities** (render / edit / transcribe / generate, thin wrappers over `hyperframes`,
`ffmpeg`, and `whisper.cpp`), and that **editable IR**.

- **Compose** — script → designed HTML motion graphics → mp4 (no paid keys).
- **Edit** — cut / subtitle / dub / localize real footage you supply (no paid keys).
- **Generate** — talking-head / cinematic AI footage via **your own** provider keys (BYO).

## Status

Early development. The technical plan lives in [`PLAN.md`](./PLAN.md). Packages:

| Package | What |
|---|---|
| `@orkas/video-studio-core` | the `plan.json` IR (schema + validator + delivery guard), runtime/config |
| `@orkas/video-studio-tools` | capability backends (render / edit / analyze / speech / image / video) |
| `@orkas/video-studio` | the `ovs` CLI |
| `@orkas/video-studio-mcp` | MCP server (mirrors the CLI 1:1) |
| `@orkas/video-studio-skills` | the host-neutral `SKILL.md` knowledge pack |

## Development

```bash
pnpm install
pnpm test         # vitest
pnpm typecheck
```

## License

MIT — see [`LICENSE`](./LICENSE). Rendering uses [HyperFrames](https://github.com/heygen-com/hyperframes)
at runtime via `npx`; editing/transcription use system `ffmpeg` and `whisper.cpp`. See `PLAN.md` for
how third-party runtimes are located and the licensing notes.
