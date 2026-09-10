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

## Versioning and synchronization

Use one independent calendar version `YYYY.M.D` across root and all workspace
package manifests; `package.json` is the source of truth. Use the Asia/Shanghai
release-candidate date without zero padding (for example `2026.9.10`), as in
OrkasOpen. Keep the MCP-reported version consistent. Do not copy the Orkas app
version or its marketplace Agent version; dependency and schema versions are
independent. Ordinary changes preserve a valid version until preparing a release.
Record release changes in `CHANGELOG.md`; release tags use `v<version>` and an
already published date version must never be overwritten.

Sync from Orkas by reviewed semantic adaptation on a dedicated branch and a PR
to main. Follow the source repository's `OpenSource/SyncVideoStudio` rules.
Prepare the diff and required verification first. Create even a draft PR only
after the requester confirms that concrete result. This does not authorize
merging, tagging, npm publication, or a release.
