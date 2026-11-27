# Changelog

## 2026.11.27

### Highlights

- 在全片渲染前查看场景首尾帧，直接检查切点两侧的画面和字幕位置。
- 为现有视频重新配音时复用仍适合的录音，并按实际播放区间对齐字幕。
- 画布导出新版前会核对素材和上次交付，保留可播放和下载的历史版本。
- 可用 17 种新增语言阅读项目介绍和安装说明。

### Fixes

- 改进中文转写的词级时间戳，使停顿前后的内容可以分别选段。
- 使用自有 API 密钥通过 Seedance 修改视频时，按所选模型明确提交编辑请求。

## 2026.11.17

### Highlights

- Make and revise videos in a browser canvas that opens automatically from your coding agent.
- Import footage, arrange cards and edit scene text, order and images in the same production.
- Render updated videos with visible progress, while keeping earlier deliveries available to play and download.

### Fixes

- Keep image clips visible in later scenes without disturbing their animation and caption timing.

## 2026.11.15

### Highlights

- Create and revise videos through an editable scene timeline, with local assets, HTML motion graphics and independently editable captions and narration.
- Keep delivered versions intact and reject stale renders after project changes, with checks for duration, audio, captions and source media identity.
- Prepare images, select measured clips and edit footage with precise timing, preserved audio, dynamic reframing and narration-aware mixing.

### Improvements

- Use more speech and video providers with your own credentials, recoverable generation receipts and protection against duplicate paid requests.
- Access matching video tools through the CLI and MCP, with updated skills for scripts, production, product fidelity and reference-led videos.

### Fixes

- Correct scene registration and media playback timing so source footage, animations, audio and burned captions appear in the intended scenes.

## 2026.9.10 — prepared, unreleased

- Adopt independent calendar versions across all packages.
- Sync generation-spec and source-preservation contracts, narration window and
  voiced-span checks, and route-independent finished-video verification.
- Preserve explicitly silent composition scenes, caption intent, scene-relative
  animation timing and actual rendered frame-rate sampling.
- Reuse speech only with matching request and audio receipts; preserve BYO video
  provider additions and the pinned HyperFrames renderer.
- Update routing, canonical composition planning, advisory design review and
  current-user revision guidance for the public CLI/MCP workflow.
- Require a real CLI production before Git commits and PRs: three scenes, animation, audio, burned subtitles, full decoding and delivery checks; retain optional review artifacts.
