---
name: stage-assemble
description: Assemble legacy EDL parts or a current mixed-source video.
---

# stage-assemble

Use [video-studio](../video-studio/SKILL.md) for current work. For an existing EDL, validate it and produce only missing/changed segments; retain complete siblings and provider evidence. Assemble primaries, bounded overlays, narration once, music, captions, then `ovs edit normalize-loudness`. Check narration coverage, preserve fixed picture windows and lip-synced source audio, and mark narration mixes with `--narration`. Run `ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4`; measure the real final file. Do not use timestamps alone to infer safe paid reuse. For blocked children preserve work and repair the complete parent within authority. Caption failure is a runtime blocker: use `ovs edit burnsubs`, never a guessed drawtext fallback.
