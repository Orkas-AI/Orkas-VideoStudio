---
name: stage-assemble
description: Deterministically assemble an approved cross-modal EDL (plan.json) into a finished video — produce each segment (edit/compose/generate/provided, delegated to its line), then assemble in ffmpeg tiers: concat primaries → overlay composed layers → mix narration once (coverage check) → burn captions → verify loudness; idempotent-resumable, with QA before the draft gate. Trigger after a plan is validated and approved; do NOT trigger to ingest or re-author the plan (stage-plan).
---

# stage-assemble

How to execute a validated `project/plan.json` into one finished file. By the time you are here the plan passed `ovs plan validate` and the user approved it at gate B. Walk it; do not re-plan. The producers are `ovs edit`, `ovs draft`, `ovs video`/`ovs image`, `ovs speak`, and the assembler is `ovs edit` (or the equivalent MCP tools).

## Step 1 — Produce each segment (delegate by source)

Iterate segments in `order`. For each, produce its `produced_path` according to `source`, then write that path + `status:"done"` back into the segment so a resume never re-produces it:

- **edit** → `stage-edit`: `ovs edit trim` the `input_id` to `[in_sec, out_sec]` → `project/cuts/<id>.mp4`.
- **compose** → `stage-compose`: build a small visual-only composition for `spec.kind` (title card, lower-third, stat card, captions) under `project/compositions/<id>/` → run `ovs draft project/compositions/<id> --out project/parts/<id>.mp4 --quality draft --report project/reports/<id>-compose-report.json`. This keeps compose segments on the same contract/source/inspect/video-QA path as standalone COMPOSE while still letting the assembler own narration and loudness.
- **generate** → `stage-generate` (+ `stage-consistency` for recurring characters): only AFTER gate C. `ovs video`/`ovs image` → `project/assets/<id>.mp4`. Generate at most ~4 shots in flight (do not assume unlimited parallelism); a failed shot retries without blocking the batch. Per `stage-consistency`: feed each shot the segment's `refs` (locked portrait + the prior same-scene shot's last frame) and honor its `variation_type`, then extract this shot's last frame to carry the look forward so multi-shot characters do not drift.
- **provided** → use `spec.asset_id` as-is (probe it first; conform aspect/fps if needed).

Billable `generate` segments must not run before gate C has confirmed the count from `cost_estimate`. Produce cheap/free segments (edit, compose, provided) freely.

## Step 2 — Assemble in ffmpeg tiers (the default path)

Assemble deterministically, bottom-up. This tiered order is the default; it is predictable and cheap, and keeps each clip's real audio intact:

1. **Primary track** — `ovs edit concat` the primary-layer `produced_path`s in `order` → `project/render/primary.mp4`. Conform aspect/fps on the way in if sources differ.
2. **Overlays / bg** — for each overlay/bg segment, `ovs edit overlay` its part onto the primary over the window of the segment named in `over` (title cards, lower-thirds, logos). Composed layers are VISUAL-ONLY — they must not carry their own narration audio. **This includes a compose segment that IS the primary track (a full-video composition): render it SILENT — do not put a narration `<audio>` in its `index.html`. The assembler owns narration (tier 3), so a composition that bakes it in would mean narration is added TWICE (the "two voices" defect).**
3. **Narration — added EXACTLY ONCE, here.** If `tracks.narration` exists, re-check line length against `target_sec` before synthesis; shorten over-budget lines in `project/plan.json` while preserving meaning. Then `ovs speak` each line with the planned `voice` and write each line's `produced_path` back (so a later edit can re-voice ONE line alone). Aim for one TTS call per line; allow at most one shortened retry after a real fit failure. Add the produced lines in ONE `ovs edit mix` call using `segments` JSON — one entry per line, each at its `start_sec` — so each line is delayed onto its scene (per-line placement; do NOT pre-bake one continuous narration file, that destroys per-line alignment and separability). The mix DEFAULTS to `--on-existing-audio reject`: if the base already has an audio track it FAILS — that means a compose segment baked narration into its render; go back and re-render that segment SILENT (remove its narration `<audio>`), then re-mix. Read the returned `coverage`: fix a surprising uncovered tail, overshoot, or silent lead-in before the draft; do not ship a voiceover that quits halfway. An intended music-only or silent tail (e.g. a CTA end card) is allowed, but state it explicitly in the Gate D note as acceptable-or-change. For a clip that already has lip-synced speech (a talking-head generate clip), KEEP its built-in audio — never synthesize a narration over a speaking mouth; if you must add music under it, that is a deliberate layer (`--on-existing-audio mix`), not a second voice.
4. **Music** — add `tracks.music` ducked under narration by the planned amount.
5. **Captions** — turn `tracks.captions.lines` (`{text, start_sec, target_sec}`) into a `.srt`, then `ovs edit burnsubs`. Captions are DATA in the plan — burned ONLY here at assemble — so a later typo fix is a one-line edit re-burned, never a re-render of the picture. If `burnsubs` fails because the runtime ffmpeg lacks subtitle filter support, stop and report that blocker; do not hand-write a fallback ffmpeg graph, PNG subtitle overlay, or drawtext pipeline.
6. **Loudness** — run `ovs edit normalize-loudness project/render/draft.mp4 --out project/render/video.mp4`. It normalizes to the `video-craft` §7 targets (~−14 LUFS integrated, true-peak ≤ ~−1 dBTP) and returns measured loudness; use `ovs edit loudness` only for diagnosis without writing an output.

Apply the plan's `style_kit` for cohesion: composed layers (titles/captions/cards) use its `palette` + `fonts`. A single `lut` graded across all clips is what unifies tonally mixed sources — until a grade op is available, keep mixed sources close at capture/trim and lean on the shared palette + consistent captions for cohesion rather than promising a uniform grade.

Output `project/render/video.mp4` as the deliverable; `project/render/draft.mp4` is the pre-normalized intermediate.

## Director judgment (end-to-end assembly)

The craft of making mixed sources feel like one video, on top of the shared craft (`video-craft`). The seams between footage / generated / composed are where multi-source assembly falls apart — engineer continuity across them:

- **One look across every source.** Apply the `style_kit` so a cut from real footage → a generated shot → a composed card does not read as three videos: one type system + palette on every composed layer, one caption style throughout, matched aspect / fps, tonal proximity (a shared LUT is the unifier when available; `video-craft` §4).
- **Audio is the through-line that hides the visual seam.** One narration voice; a continuous music bed UNDER the cuts (do not restart it per segment); duck consistently (`video-craft` §7). The ear's continuity carries the eye across a source change — a reveal may drop music, but the bed bridges the cut.
- **Rhythm over a mixed cut.** Alternate motion vs. static and source types for momentum — do not stack three composed cards or three talking-head shots in a row (that is the repetition / slideshow smell, `video-craft` §3, §12). Vary holds.
- **Cut on a content change, not just plan order.** A hard cut on a beat / word change is invisible and professional; a crossfade signals a gentle topic shift (`video-craft` §5).
- **Don't bury the hero.** On a `source_led` piece, composed lower-thirds and captions FRAME the footage — they never cover its subject / face (`video-craft` §6).
- **Apply the editing cut craft ACROSS the seams.** The cut mechanics live in `stage-edit` → "Cut craft" (best sub-window, ≤ 4 transitions, L/J-cut sound bridges, handles / no freeze-frame, adjacent-diversity, a reason per cut) — apply them at every junction between sources, since the footage → generated → composed seams are exactly where a mixed cut betrays itself.

## Step 3 — Idempotent resume

The plan is the checkpoint. On a re-run, skip any segment already `status:"done"` with a present `produced_path`, and skip assembly tiers whose output already exists and is newer than its inputs. Never re-run a billable `generate` segment that is already produced.

## Step 4 — QA report, then gate D

Before showing the draft, run the QA pass and write `project/render_report.json` with these sections:

- **technical_probe** — `ovs edit probe` the draft/final (real duration / resolution / fps / audio present); confirm it matches the plan's aspect + total.
- **promise_preservation** — `ovs plan promise-check project/plan.json --probe-produced`. At gate D this probes each primary segment's `produced_path` and computes the REAL primary-track motion ratio vs. `motion_min_ratio` plus the `source_required` invariant; missing/unreadable produced media or a fail means **"slideshow / promise broken" — do not deliver**. Send it back (below). Do not eyeball this; let the numbers decide.
- **visual_spotcheck** — extract ~4 frames across the draft (`ovs edit extract-frame`) and read them for upside-down / garbled-caption / empty / wrong-product frames. Read them yourself if you are multimodal; if you cannot see images, record the spot-check as `unverified` and proceed — do not invent what the frames show.
- **audio_spotcheck** — the `normalize-loudness` measured loudness numbers + the narration coverage result from step 2 (uncovered tail / overshoot / silent lead-in).
- **transcript_comparison** (when there is narration) — optionally `ovs transcribe` the draft and confirm the spoken words match the planned narration lines.

Each section carries `pass` / `warn` / `fail` + a one-line reason. Then present the draft `[video]` + the report's headline findings at **gate D**.

On approve → finalize `project/render/video.mp4` (loudness / captions only; never re-synthesize a talking-head voice). On revise → redo only the affected segment(s) and re-assemble.

## Send-back (self-correction on a QA fail)

A QA `fail` does not go to the user as "here's a broken video". Diagnose which segment(s) caused it and redo ONLY those, then re-assemble and re-run QA:

- promise_preservation fail (slideshow) → the static composed segments are too long / the motion segments too short. Rebalance segment durations or convert a static beat to footage, re-assemble.
- visual_spotcheck fail (bad frame) → re-produce that one segment (re-trim / re-compose / re-generate), not the whole video.
- audio fail (uncovered tail) → re-time or extend the narration / trim the tail.

Bound the loop: at most **2** send-back rounds for the same failing check. If it still fails, surface it honestly at gate D with the report and ask the user how to proceed — do not loop forever and do not quietly ship a known-failing draft.

## Rules

- Walk the approved plan; if assembly reveals the plan is wrong, surface it and re-gate — do not silently re-plan.
- Write `produced_path` + `status` back per segment as you go (resumability + the QA pass depend on it).
- One output file is the deliverable; `cuts/` and `parts/` are intermediates.
- **Narration is added exactly ONCE — in the mix tier, never baked into a compose render.** Compose segments (including a full-video composition used as the primary track) render SILENT (no narration `<audio>`); the assembler mixes narration via `ovs edit mix` with `segments` placed per line. The mix's default `--on-existing-audio reject` enforces this — a "base already has audio" mix rejection is the signal a segment wrongly baked audio in; re-render it silent, then re-mix.
- **No ad-hoc ffmpeg fallbacks for captions.** Caption burn-in is a low-freedom operation owned by `ovs edit burnsubs`; a failed burnsubs call is a tool/runtime blocker, not permission to invent a custom subtitles/drawtext/PNG-overlay command.

## Boundary / non-goals

This skill assembles an already-approved plan. It does not ingest or decide the plan (`stage-plan`), and it delegates the actual production of each segment to the compose / generate / edit / consistency skills rather than re-deriving their craft here.
