# Production method and current-video checks

## Decide before deep reference analysis

Users describe an outcome, not a renderer. Use the requested changes, reference availability/type/duration/canvas, and a light visual look when needed to choose the method. A representative frame can distinguish filmed action from designed typography; it does not establish every shot or word. Do not transcribe or densely sample a reference merely to make this decision.

Realistic subject action, camera movement, atmosphere, or a semantic pixel edit usually calls for a video model. Precisely editable copy, prices, diagrams, layout, or timed overlays calls for composition or deterministic editing. A reference can lead to either. Ask only when a missing fact changes the outcome.

The canonical `plan.json` decides the current production method:

- **Direct generation:** exactly one `source:"generate"`, `layer:"primary"`, `spec.media_kind:"video"` segment, with `operation` omitted or set to `generate`/`edit`, and no active local tracks. Input references do not turn direct generation into assembly.
- **Local assembly:** HTML, deterministic edits, multiple clips, or any local captions, overlays, narration, music, or other output processing. A generated clip that later receives local captions is local assembly for that version.

Runtime notes such as `_runtime.is_generation` are advisory. Re-evaluate from the executable plan whenever the requested output changes. The distinction changes analysis and QA depth, never authorization.

## Reference depth

For direct generation, pass the actual accessible reference images/videos to the provider with their signed roles, preservation boundary, allowed changes, and whole-clip temporal anchors when applicable. Do not add shot decomposition, dense extraction, transcript, or a reconstruction report. A textual “see reference” is not a media binding.

For local reference-led creative work, read `video-craft/references/reference-recreation.md` and turn observations into executable design/timeline decisions. An exact known-timecode cut needs its source probe and requested interval, not a creative reconstruction exercise.

## Review before delivery

Run `ovs plan promise-check project/plan.json --video <delivered-video>` against the current plan and artifact.

For direct generation, require an existing readable video stream. Duration or canvas differences are warnings to report; do not automatically trim, stretch, crop, or start another paid generation. Do not add creative scoring, reference/product-fidelity inspection, dense frame QA, transcription, loudness normalization, or repair loops. An unreadable return is a delivery failure; preserve provider transaction evidence before applying normal recovery rules.

For local assembly, validate the actual local operations: HTML, cuts/joins, caption text and placement, timing, and audio mixing as applicable. Inspect the local integration without reopening or regenerating already-completed model pixels. Gate and paid-attempt authority remain owned by `gate-control`.
