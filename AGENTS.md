# Working with OrkasVideoStudio (for coding agents)

This repo lets you produce video by composing, generating, and editing through the `ovs` CLI
(and an equivalent MCP server). The knowledge for *how* to do it well lives in skills.

## Skills

Reusable, host-neutral `SKILL.md` knowledge is in `packages/skills/`. Native skill loaders
discover these automatically:

- **Claude Code**: install to `.claude/skills/` (repo) or `~/.claude/skills/` (user).
- **Codex**: install to `.agents/skills/` (repo) or `~/.agents/skills/` (user).

If your agent has no native skill loader, pull a skill on demand:

```bash
ovs skills              # list available skills
ovs skill video-router  # print one skill's full instructions
```

Start every video task by reading **`video-router`**; it routes you to the right line
(compose / generate / edit) and the stage skills. Read **`gate-control`** before the first
approval boundary so every line uses the same host-neutral transition policy.

## Capabilities

The CLI is the canonical interface; the MCP tools mirror it 1:1. Run `ovs --help` for the
full surface (render / edit / transcribe / narration fit / gate transition / speak /
speech-capabilities / image / video / plan). Run `ovs doctor`
to check that `ffmpeg`, `ffprobe`, and `node` are available.
