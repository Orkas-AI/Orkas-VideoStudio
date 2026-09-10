---
name: stage-compose
description: Authoring knowledge for Orkas/OVS HTML video compositions -- write an index.html, drive animation from a paused timeline, declare canvas + duration, then run the VideoStudio draft gate to render an mp4. Trigger for explainer / animation / motion-graphics / caption / lower-third / title-card work, or to build a compose segment inside an AUTO plan; do NOT trigger for cutting real footage (stage-edit) or AI footage (stage-generate).
---

# stage-compose

How to author an Orkas/OVS HTML composition and turn it into a video. `composition-manifest.json` v2 is the canonical timeline/audio/design artifact. In this open-source build, `ovs draft` is the VideoStudio-style production gate: it runs manifest/source/narration/local-asset checks, HyperFrames check/render, media QA, sampled-frame video QA, and writes one report. HyperFrames remains the render backend; do not bypass the draft gate for user-facing drafts.

For visual direction, apply `frontend-design` before writing manifest `art_direction`. If the user provides a reference image/video, DESIGN.md, brand guide, screenshot, design notes, existing app UI, or named style, apply `design-system-importer` to convert it into intent-bound reference constraints and compact tokens. `composition-design-review` is a bounded full-frame review before a visual preview is shown, with a post-draft fallback when preview is skipped.

Gate authorization belongs to `gate-control`. This skill supplies the canonical manifest, contact sheet, draft, and QA evidence; after any Gate B/Preview/Gate D decision or resumed approval, run `ovs gate transition` rather than inventing a second confirmation or recovery loop.

When the production runtime is unavailable, return a clearly unexecuted candidate package instead of fabricating a render: locked assumptions, final-form script/narration, timed storyboard, exact visible copy/captions, visual/audio and rights-safe asset plan, target export settings, and checkable preview/final QA.

## Fast COMPOSE Runbook

After Gate B approves the canonical composition manifest, keep the production turn narrow:

1. Read the approved `project/composition/composition-manifest.json` and this skill if not already loaded for the current turn. Also read `frontend-design`; read `design-system-importer` only when a concrete style source or explicit named reference exists. Read `composition-design-review` after snapshot evidence exists, or after the draft when preview was intentionally skipped and the fallback trigger applies.
2. If standalone narration is needed, capture the exact `ovs speech-capabilities` profile in the approved plan and run `ovs narration fit` before synthesis. Visual authoring, `ovs check`, and `ovs snapshot` may proceed while narration is pending so the visual candidate remains reviewable. Required narration blocks only complete `ovs draft`/final delivery. Before drafting, run `ovs speak` once to `project/composition/assets/narration.mp3`, declare the composition-owned track, probe its duration, rerun measured fit, and reconcile. Reuse an existing matching narration file; do not synthesize again just because a visual preview changed. For an AUTO segment, use `audio.owner: "assembler"` and render silent.
3. Keep the approved `project/composition/composition-manifest.json` with `schema_version: 2`, including approved timeline/copy/source mappings, audio ownership, and `art_direction`. Confirm its dedicated `cover`, any `references`/`reference_fidelity`, and `VisualDirectionV1`; then prepare and author static resolved/hero frames before deterministic motion. The exact 0s cover must already be readable. Reconcile after manifest timing/audio changes without replacing authored DOM/CSS/SVG/motion.
4. Decide whether to open the optional HTML Preview Gate before rendering mp4. Use the preview gate when expected render rework is expensive: target duration >= 20s, scene count >= 3, render cost is likely slow, or the composition has dense text, complex SVG/GSAP, many branded/supplied assets, tight narration timing, or a prior draft failure. Skip it for short/simple work: target duration < 20s, scene count <= 2, no narration/timing complexity, and no obvious visual-risk signal. The subject category alone never forces the preview gate.
5. If visual preview is needed, run `ovs check` and `ovs snapshot`. Review the complete contact-sheet index and open the cover, QA-named frames and risky cells at full size; compare declared references. Collect all blockers, apply one localized repair, then rerun check/snapshot and review the complete new revision. The contact sheet is only an index. The author checklist is advisory and adds no scored approval gate; present current passing snapshot evidence after addressing concrete visible blockers.
6. Run the draft command: `ovs draft project/composition --out project/render/draft.mp4 --quality draft --report project/render/draft-report.json --findings project/composition/qa/check.json`. Before rendering, this gate validates manifest/HTML consistency, prepares declared local vendor assets, blocks remote runtime resources, verifies local assets, checks shotlist/source alignment, and checks narration mapping. Then it runs HyperFrames check/render, media QA, sampled-frame QA, and writes one report.
7. If draft fails, repair the highest canonical source, reconcile when needed, and retry only after the authored signature changes. Do not delete QA state or repeat an unchanged strategy. After two non-converging passes, preserve the current artifact and show the visible unresolved issue with concrete options through gate-control; await a real user direction before another cycle.
8. If the draft command returns `ok: true`, the composition is frozen for final-video confirmation. Do not edit `index.html`, `composition-manifest.json`, assets, or narration again in the same turn unless the report contains a real blocker (check/source/audio/video QA failure), or the user explicitly asks for a revision. Visual/readability warnings and design-review `fix`/`polish` notes are advisories, not permission to self-repair.
9. If preview was skipped and the fallback trigger applies, run `composition-design-review` against representative draft frames. Open final-video confirmation only after the draft command returns `ok: true` and any triggered review has no concrete blockers.

The default path is **model-authored HTML -> draft**. Do not write or compile `spec.json`; fixed template compilation is not part of the COMPOSE path because visual quality and extensibility come first.

## HTML Preview Gate

Use the HTML Preview Gate to avoid expensive mp4 rerenders when visual rework is likely. It is a cost-control gate, not a new creative milestone, and it is only for the COMPOSE line. Decide from expected rework cost:

- **Preview first** when duration >= 20s or scene count >= 3.
- **Preview first** when a shorter piece has dense text, multiple chapters, many supplied/brand assets, complex SVG/GSAP motion, tight narration timing, or a prior draft/repair failure.
- **Skip preview** when duration < 20s, scene count <= 2, and the HTML is simple enough that rendering the draft is cheaper than asking for another confirmation.
- Do not use product/promo/version-update labels alone as the trigger. Those labels only contribute to risk when the piece is long, visually dense, or expensive to rerender.

When preview is triggered, run `ovs check` and `ovs snapshot`, review the complete contact-sheet index and open the cover and risky `frame_paths` with `composition-design-review`, and show only a fully reviewed revision. The contact sheet is an index; full-size frames resolve doubtful cells. Show the full frame evidence, the `index.html` path, and a compact status line:

- reason for preview: duration / scene count / complexity / prior failure
- check headline: blocking count or main advisory
- what approval means: render mp4 draft next

If the user revises, edit the manifest or HTML, reconcile when needed, then rerun check/snapshot and the complete frame review. Keep this loop lightweight; reuse materialized narration and do not render mp4 during visual preview.

The HTML Preview Gate does not replace the mp4 draft. It cannot validate audio muxing, final encoded video quality, sampled-frame video QA, or exact narration pacing. After approval, always run `ovs draft` and open Gate D with the video.

Read [manifest and authoring](references/manifest-and-authoring.md) before writing or reconciling manifest/HTML. It owns the canonical schema, offline assets, semantic hooks and HyperFrames timing contract.

Read [art direction](references/art-direction.md) before authoring the visual system. It owns the concrete design budgets and reference constraints.

## Check And Repair Policy

Run the draft command before any user-facing video. If structural/source/audio/video QA fails, repair the highest canonical source and retry only after its signature changes. After two non-converging passes, preserve the evidence and request a concrete user direction through gate-control. Technical errors with repair passes remaining do not create confirmation requests.

Repairs should address the cause, not just the symptom:

- `FONT_TOO_SMALL`: reduce text density, shorten copy, enlarge/reflow containers, or move labels out of small shapes. Do not simply increase every font size if that creates overflow.
- `missing_timeline_registry`, `gsap_timeline_not_registered`: register a paused GSAP timeline on `window.__timelines[compositionId]`, using the exact root `data-composition-id`.
- `timed_element_missing_clip_class`, `root_composition_missing_data_start`, `media_missing_data_start`, `imperative_media_control`: let the renderer own timing and media playback through `data-start`, `data-duration`, `.clip`, and media data attributes.
- `text_occluded`, `text_box_overflow`, `content_overlap`: restructure the scene layout or regenerate the affected scene from the contract's boxes. Do not rely on small numeric nudges.
- `FROZEN_FRAME_RUN`: treat repeated sampled frames as an advisory until semantic evidence confirms the timeline is frozen. Inspect the visual evidence; repair timeline registration, scene clip timing, or variation only when the frames actually fail to change as intended.

If only visual advisories remain and the draft render exists, present the mp4 draft with QA notes instead of silently looping. Repair the manifest or hand-authored HTML directly; do not introduce `spec.json` as a workaround.

After the draft render succeeds, use `composition-design-review` only as the fallback when preview was skipped and its trigger applies. A review blocker must be visible in a specific scene/frame and must break readability, the approved promise, required brand/style tokens, motion timing, or asset safety. Allow at most one localized repair and re-draft only for concrete blockers. Treat `fix` and `polish` findings as final-video confirmation notes.

Read [narration and audio](references/narration.md) only when this composition carries speech or other audio. It owns narration fitting, existing-speech preservation and audio ownership.

## Render (The Outcome)

Produce the finished video by running the draft gate over the composition **directory**. Iterate at draft quality, then do one high-quality pass once the layout and timing pass review:

- Draft: `ovs draft project/composition --out project/render/draft.mp4 --quality draft --report project/render/draft-report.json --findings project/composition/qa/check.json`
- Final: `ovs draft project/composition --out project/render/video.mp4 --quality high --report project/render/final-report.json --findings project/composition/qa/final-check.json`

Use `ovs render` only as a narrow diagnostic render when QA has already identified the blocker. User-facing drafts and finals go through `ovs draft` so contract, source, narration, media, and sampled-frame QA are not skipped.

After final-video approval, a local visual-only revision reuses the approved plan, assets, and narration. Change only the affected scene, run reconcile when needed, then `ovs check`, `ovs snapshot`, full-frame design review, and one revised high-quality encode. Do not request production-plan confirmation again or synthesize narration/generation again unless the requested edit changes signed copy, timing, language, narration, source mapping, or provider intent.

## Director Judgment (Compose Line)

Craft calls specific to designed/animated explainers, on top of the shared craft reference (video-craft):

- **One concept per visual chapter** -- do not stack two ideas in one scene; give each its own build.
- **Concrete before abstract** -- real data, diagrams, steps before a metaphor; the metaphor only lands once the concrete version is understood.
- **Aesthetic thesis before styling** -- use `frontend-design` to choose one signature visual device that comes from the subject matter; spend distinctiveness there and keep the rest disciplined.
- **Reference styles become tokens** -- use `design-system-importer` for DESIGN.md/brand/reference input, then adapt the tokens to video safe zones and motion. Do not clone protected layouts or assets.
- **Design review is a pre-preview guardrail** -- inspect the entire snapshot frame set before showing it; when preview is skipped, use the triggered post-draft fallback. Block only on concrete visible failures; template feel, hierarchy, and polish issues that do not break the promise become final-video confirmation notes.
- **Render exact text as real text** -- stats, names, CTAs are typed into the composition, never baked into AI imagery.
- **Build to the narration words**, not arbitrary beats; hold a fully-built scene/chart >= 2-3 s before moving on.
- **Vary scene types** -- no three near-identical layouts in a row; alternate full-frame / split / diagram / quote.
- **Spoken/readable captions live in the plan's `tracks.captions.lines` (data), NOT burned into this composition** -- the assembler burns them via `burnsubs` at the end, so a later typo fix is a one-line edit, not a re-render of the whole composition. Only a purely decorative caption treatment that is the visual design may live inside the composition.
- Surface craft-threshold warnings on the composition when you QA it before rendering. In draft mode, small readable text is a QA advisory rather than a render blocker; oversized palette is advisory and should be judged against the design thesis, brand, and scene clarity.

## Constraints

- Deterministic only: no real-time timers, no network-dependent runtime behavior, no randomness without a fixed seed -- the renderer seeks discrete frames.
- Keep all referenced assets inside the composition directory so the render is self-contained.
- This skill authors and renders compositions; it does not pick the production line (see `video-router`) or generate AI footage.

## Scene timing and narration identity

Position authored tweens with scaffold `S("scene-id")` and `D("scene-id")`, which read canonical scene attributes after reconcile. Never move HyperFrames-owned clip visibility into custom playback code. The delivered opening must already carry visible title/hero content at exactly zero; animate from a visible base, not a blank fade. Every child also starts with visible content; only the delivered opening needs the whole-video cover promise.

An explicit empty `narration_text` marks a silent scene and clears stale narration references. Preserve those silent windows when fitting speech. Shorter speech that fits the existing spoken windows leaves the visual timeline unchanged. Keep the declared target separate from measured audio; do not truncate speech or silently change a fixed user duration. Narration-only changes reuse visual approval only if all visual assets and scene windows remain identical. New pixels or timing require a current complete preview.

Reuse speech only when text, route, voice, model, format, speed and output bytes match its receipt. Keep one file per line in EDIT/AUTO. Their signed `start_sec` and `target_sec` are fixed windows: shortening text or using an approved retry fits the audio into the window; moving the timeline requires the corresponding user authority. Music/SFX ownership alone does not imply narration.
