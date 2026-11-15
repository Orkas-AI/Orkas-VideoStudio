---
name: stage-compose
description: Author scene-based HTML video with declarative HyperFrames timing; retain legacy v2 composition APIs for existing projects.
---

# stage-compose

For current work use [timeline and page](../video-studio/references/timeline.md). Apply [frontend-design](../frontend-design/SKILL.md), [design-system-importer](../design-system-importer/SKILL.md) for references, and [composition-design-review](../composition-design-review/SKILL.md) to the complete sampled frame set. These are internal production checks, not extra user approvals.

Use one `data-scene-id` section per manifest scene, editable `data-slot` text and `<img data-clip>` placeholders. Keep each paused scene timeline between its motion markers. `ovs timeline prepare` supplies local media, captions, mixed audio, canonical timing and `./assets/vendor/gsap.min.js`. HyperFrames owns seek and playback. Never write imperative play/pause/currentTime loops, remote runtime dependencies, nondeterministic timers or a second renderer. Frame zero must show the promise and hero; animate supporting elements from a visible base.

Run check, snapshot, inspect all frames, batch confirmed fixes, render and ship. A contact sheet is an index, so examine its original frames. A stale or unavailable visual review remains unknown. Inspect final encoded frames as well. Use caption-safe composition and keep text off real products, faces and controls. Preserve approved casing, exact copy and intentional silent windows. Narration is mixed exactly once; captions alone do not supply speech.

## Existing v2 compositions

The public v2 `composition-manifest.json` APIs remain supported independently: `ovs composition prepare`, `ovs composition reconcile`, `ovs check`, `ovs snapshot`, `ovs draft` and `ovs render`. Keep v2-owned projects separate from v3 video folders. Existing v2 design budgets, cover markers (`data-cover-hero`), narration ownership and bounded repair evidence remain enforced by those commands. For a legacy draft, use `ovs draft <directory> --out <file> --quality draft`; inspect its complete report, rather than treating an output file as success. Use [gate-control](../gate-control/SKILL.md) only for an explicitly selected legacy review workflow. Its resolver does not become mandatory for new requests.
