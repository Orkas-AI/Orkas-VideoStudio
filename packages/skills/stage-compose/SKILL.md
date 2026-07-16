---
name: stage-compose
description: Authoring knowledge for Orkas/OVS HTML video compositions -- write an index.html, drive animation from a paused timeline, declare canvas + duration, then run the VideoStudio draft gate to render an mp4. Trigger for explainer / animation / motion-graphics / caption / lower-third / title-card work, or to build a compose segment inside an AUTO plan; do NOT trigger for cutting real footage (stage-edit) or AI footage (stage-generate).
---

# stage-compose

How to author an Orkas/OVS HTML composition and turn it into a video. This skill describes the artifact you produce and the outcome you want (a rendered mp4). In this open-source build, `ovs draft` is the VideoStudio-style production gate: it runs contract/source/narration/local-asset checks, HyperFrames lint/inspect/render, media QA, sampled-frame video QA, and writes one report. HyperFrames remains the render backend; do not bypass the draft gate for user-facing drafts.

For visual direction, apply `frontend-design` before writing the design contract. If the user provides a DESIGN.md, brand guide, reference site, screenshot, Figma notes, existing app UI, or explicit named style, apply `design-system-importer` to convert that source into compact VideoStudio tokens. `composition-design-review` is a bounded post-draft sanity check for design-sensitive work; it must not replace lint/inspect/render QA or create an open-ended redesign loop.

## Fast COMPOSE Runbook

After Gate B approves the script/storyboard, keep the production turn narrow:

1. Read only the approved `project/script.md`, `project/shotlist.json`, and this skill if not already loaded for the current turn. Also read `frontend-design`; read `design-system-importer` only when a concrete style source or explicit named reference exists. Do not read `composition-design-review` until a draft render exists and its trigger applies.
2. If standalone narration is needed, run `ovs speak` once to `project/composition/assets/narration.mp3`. For an AUTO/assemble segment, render silent and let `stage-assemble` own narration.
3. Write `project/composition/design-contract.json`, then model-author `project/composition/index.html` directly. Use the authoring discipline from `frontend-design`: first confirm the visual identity and `VisualDirectionV1` in the contract; then author each scene's resolved/hero frame as static HTML/CSS/SVG using the declared video scale, depth layers, typography register, motion verbs, and rhythm pattern; only after the resolved layout is readable add GSAP entrances, reveals, and transitions into that layout. Do not begin with hidden/offscreen animated start states, generic placeholder diagrams, decorative emoji/icons, centered equal-weight layouts, or web-scale type. For narrated work, also write `project/composition/scene-map.json` from the approved script/shotlist so timing QA can verify voiceover-to-visual alignment. If scenes use `narration_ref` or lack inline narration text with numeric windows, write `project/composition/narration-map.json` before draft.
4. Decide whether to open the optional HTML Preview Gate before rendering mp4. Use the preview gate when expected render rework is expensive: target duration >= 45s, scene count >= 7, render cost is likely slow, or the composition has dense text, complex SVG/GSAP, many branded/supplied assets, tight narration timing, or a prior draft failure. Skip it for short/simple work: target duration < 20s, scene count <= 4, no narration/timing complexity, and no obvious visual-risk signal. The subject category alone never forces the preview gate.
5. If the HTML Preview Gate is needed, run `ovs inspect project/composition` and `ovs snapshot project/composition --out project/composition/preview/first-frame.png`. Snapshot captures the hook frame, one midpoint per scene, and the payoff frame, and returns `first_frame`, `contact_sheet`, and the labelled `frames`. Before opening the gate, read the contact sheet as a design checkpoint: if a representative scene clearly fails its own `hero_visual`/`depth_layers`, reads as a generic slide, starts blank, substitutes labels for visuals, or uses decorative emoji/icons as the main graphic language, make one localized repair to `design-contract.json` or `index.html`, rerun inspect/snapshot, and then open the gate. Show the contact sheet as the primary review artifact, plus the inspect headline, `index.html` path, and why preview was inserted. Options: approve HTML preview, revise HTML/design, or render draft anyway. Stop. On approval, continue to the draft command. On revise, modify only `design-contract.json`, `scene-map.json`, or `index.html`, then rerun inspect/snapshot and reopen the same preview gate.
6. Run the draft command: `ovs draft project/composition --out project/render/draft.mp4 --quality draft --report project/render/draft-report.json --findings project/composition/qa/inspect.json`. Before rendering, this gate prepares declared local vendor assets, checks design-contract/scene-map/HTML consistency, blocks remote runtime resources, verifies local assets, checks shotlist/source alignment, and checks narration mapping. Then it runs HyperFrames lint/inspect/render, media QA, sampled-frame QA, and writes one report.
7. If the draft command fails, repair the design contract, scene-map, or HTML, then run it again. The draft gate enforces one initial failed draft plus at most two repair passes through `project/composition/qa/draft-repair-state.json`. The second repair pass is allowed and returns the real failing check if it still fails, with `repair_budget.budget_exhausted: true`; any later draft attempt returns `E_REPAIR_BUDGET_EXCEEDED`. Stop and report the blocker instead of continuing to patch.
8. If the draft command returns `ok: true`, the composition is frozen for Gate D. Do not edit `index.html`, `design-contract.json`, `scene-map.json`, assets, or narration again in the same turn unless the report contains a real blocker (lint/source/audio/video QA failure), or the user explicitly asks for a revision after Gate D. Visual/readability warnings and design-review `fix`/`polish` notes are Gate D advisories, not permission to self-repair.
9. Open Gate D after the draft command returns `ok: true` and any triggered design review has no concrete blockers.

The default path is **model-authored HTML -> draft**. Do not write or compile `spec.json`; fixed template compilation is not part of the COMPOSE path because visual quality and extensibility come first.

## HTML Preview Gate

Use the HTML Preview Gate to avoid expensive mp4 rerenders when visual rework is likely. It is a cost-control gate, not a new creative milestone, and it is only for the COMPOSE line. Decide from expected rework cost:

- **Preview first** when duration >= 45s or scene count >= 7.
- **Preview first** when a 20-45s piece has dense text, multiple chapters, many supplied/brand assets, complex SVG/GSAP motion, tight narration timing, or a prior draft/repair failure.
- **Skip preview** when duration < 20s, scene count <= 4, and the HTML is simple enough that rendering the draft is cheaper than asking for another confirmation.
- Do not use product/promo/version-update labels alone as the trigger. Those labels only contribute to risk when the piece is long, visually dense, or expensive to rerender.

When preview is triggered, run `ovs inspect` and `ovs snapshot`; show the first-frame evidence, the `index.html` path, and a compact status line:

- reason for preview: duration / scene count / complexity / prior failure
- inspect headline: blocking count or main advisory
- what approval means: render mp4 draft next

If the user revises, edit the design contract, scene-map, or HTML, then rerun inspect/snapshot. Keep this loop lightweight; do not synthesize new narration or render mp4 during HTML preview.

The HTML Preview Gate does not replace the mp4 draft. It cannot validate audio muxing, final encoded video quality, sampled-frame video QA, or exact narration pacing. After approval, always run `ovs draft` and open Gate D with the video.

## Scene Map For QA

For narrated or tightly timed work, write `project/composition/scene-map.json` beside `index.html`. It is not a template; it is the audit map that lets the agent verify timing/source alignment while the model keeps full control of HTML/CSS/SVG/GSAP.

```json
{
  "canvas": { "width": 1920, "height": 1080, "duration": 60, "language": "en" },
  "audio": { "narration": "assets/narration.mp3" },
  "source_alignment": { "merge_reason": "optional when combining approved shotlist beats" },
  "scenes": [
    {
      "id": "hook",
      "start": 0,
      "duration": 5,
      "headline": "Orkas 1.5.0",
      "narration": "A concise line or narration_ref for this exact window.",
      "source_shots": ["s01"]
    }
  ]
}
```

If the approved shotlist beat is intentionally merged into a longer visual scene, add `source_alignment.merge_reason` or per-scene `source_shots`. When audio exists, every scene must include either concise `narration` text or a `narration_ref`/`source_shots` mapping to the approved script/shotlist.

When scenes use `narration_ref`, add `project/composition/narration-map.json` before draft:

```json
{
  "lines": [
    { "id": "n01", "scene_id": "hook", "start": 0.0, "end": 3.2, "text": "Meet Orkas 1.5.0." }
  ]
}
```

Then use `"narration_ref": "n01"` or a comma-separated list on the matching scene. Timed media refs such as `"assets/narration.mp3#t=0.0,3.2"` are also valid when the map line includes `scene_id` or matching start/end. If no map is present, every narrated scene must include inline `narration`/`narration_text` plus numeric start/duration or start/end.

## Composition Contract (The Minimum That Renders)

A composition is a directory with an `index.html`. The renderer reads these `data-*` attributes; get them right or the render is wrong.

- The **root** element declares the timeline: `data-composition-id="main"`, `data-start`, `data-duration` (seconds), `data-width`, `data-height` (px).
- Each **clip** is a child with `class="clip"` and its own `data-start`, `data-duration`, `data-track-index` (higher index = drawn on top).
- A paused **GSAP timeline** registered on `window.__timelines["main"]` drives all animation; the renderer seeks it frame by frame. Never use real-time animation (`setInterval`, CSS `animation`) -- only timeline-driven motion renders deterministically.

Canonical minimal `index.html` (16:9, 10s):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="./assets/vendor/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; }
      body { font-family: "Inter", sans-serif; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="10" data-width="1920" data-height="1080">
      <div id="title" class="clip" data-start="0" data-duration="5" data-track-index="1"
           style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-size:96px">
        Hello World
      </div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.from("#title", { opacity: 0, y: -50, duration: 1 }, 0)
        .to("#title", { opacity: 0, duration: 0.5 }, 4.5);
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
```

## Authoring Patterns

- **Canvas per aspect ratio**: 16:9 -> 1920x1080, 9:16 -> 1080x1920, 1:1 -> 1080x1080. Set the same values in the viewport meta, the body CSS, and the root `data-width`/`data-height`.
- **Scenes**: one clip (or a group) per storyboard shot; set each clip's `data-start`/`data-duration` from the shot list so the timeline sums to the brief's duration.
- **On-screen text**: keep it inside the frame with padding; large, high-contrast type; one idea per scene.
- **Assets**: reference images/footage produced upstream by relative path inside the composition dir (e.g. `./assets/shot1.png`).
- **Timing**: position every tween on the GSAP timeline with an explicit time so it is reproducible; the total of `data-duration` on the root is the final length.
- **SVG-first visual layer**: prefer inline SVG for non-text motion graphics such as diagrams, connectors, nodes, progress paths, charts, orbit lines, icon-like marks, and background geometry. Keep readable prose in normal HTML text boxes unless the SVG text is large, simple, and verified.
- **Use GSAP only when time-based motion is needed**: static SVG, CSS layout, and simple held states do not need GSAP. When animation is needed, keep GSAP as the timeline/orchestration layer that animates SVG groups or a small set of HTML containers.
- **No remote runtime resources in final HTML**: do not leave CDN scripts, remote fonts, remote images, or remote CSS in the render path. Fetch or copy permitted runtime files into `project/composition/assets/` during authoring, then reference them with relative paths such as `./assets/vendor/gsap.min.js`. If you cannot source a permitted local GSAP/runtime file, report that blocker rather than shipping a network-dependent composition.
- **Local GSAP vendor**: if `index.html` references `./assets/vendor/gsap.min.js`, the `ovs draft` path prepares the built-in offline GSAP vendor in the workspace composition directory. It keeps compatible existing GSAP files and blocks missing or incompatible vendor files before rendering. Do not manually patch `assets/vendor/gsap.min.js` inside a composition; fix HTML/scene-map/design-contract issues, or report the vendor blocker.

## Design Contract Before HTML

Before writing `project/composition/index.html`, write `project/composition/design-contract.json`. This is an internal artifact, not a user gate. Treat it as the composition budget, not a style note.

The contract must declare these budgets compactly:

- `canvas`: aspect ratio, width, height, duration, fps, language.
- `aesthetic`: from `frontend-design`: subject world, audience, one job, tone, signature device, aesthetic risk, and anti-template check.
- `visual_direction`: `VisualDirectionV1` from `frontend-design`: real design tradition/reference, composition behavior, lazy defaults rejected, video scale, depth-layer rule, motion-verb rule, typography register, and rhythm pattern. This is the front-loaded aesthetic director for HTML authoring, not a fixed template.
- `style_source`: from `design-system-importer` when a DESIGN.md, brand guide, screenshot, reference site, Figma notes, existing app UI, or explicit named style was used. Omit when there is no external style source.
- `scenes`: start/duration, approved on-screen copy, narration timing, visual focus, and layout type. Designed scenes may also carry `scene_world`, `hero_visual`, `composition`, `depth_layers`, `motion_verbs`, `opening_state`, `resolved_state`, `continuity_in`, `continuity_out`, and selected `primitive_refs`.
- `layout_boxes`: safe text box, visual box, caption box, and maximum label count per scene.
- `typography_tokens`: title/body/caption/label floors plus type roles and register. Default floors for 1920x1080: title >= 72px, body/supporting text >= 42px, safe margin >= 96px, no more than two text blocks and about 12-16 English words per scene. Preserve the same readability intent for 9:16 and 1:1. Avoid default two-sans pairings unless the style source explicitly requires them; use scale, weight, width, case, mono/data roles, or serif/sans contrast to make hierarchy visible.
- `color_tokens`: named baseline values with rationale: background, surface, text, muted, primary accent, and any purposeful supporting accents the approved visual idea needs.
- `motion_budget`: max animated groups per scene, allowed transitions, easing, rhythm pattern, which SVG/HTML groups move, what each motion communicates, and the concrete motion verbs assigned to primary elements.
- `scene_variation`: how the sequence avoids three near-identical layouts, transitions, or card/title scenes in a row.
- `audio`: narration ownership, audio path, target duration, and whether the composition must render silent for assemble.

The palette is a design contract, not a mechanical hue cap. The HTML/CSS/SVG should derive its main system from `color_tokens` through CSS variables or equivalent structured constants, but do not flatten or recolor a scene just to reduce a static color count.

Run a pre-code anti-template check from `frontend-design`: name the first generic design move you rejected and the brief-specific replacement. If you cannot name that replacement, the contract is not ready. The check should catch lazy defaults before HTML: purple/blue neon, glowing black-background circles, centered equal-weight layouts, identical cards, decorative emoji/icons, tiny badges, web-dashboard fragments, pure black/white, and web-scale type. When `style_source` exists, also name what was adapted, simplified, and not copied from the reference.

## Inspect And Repair Policy

Run the draft command before any user-facing render. If lint, contract/source/audio timing, media/video-frame QA, or inspect `draft_disposition.blocking_error_count` is not OK, repair once and run the draft command again. Visual inspect advisories are not blockers for the first mp4 draft; include them in Gate D notes and do not loop for advisory-only findings. A second repair pass is allowed only when the remaining blockers are fewer and clearly localized. If the command returns `E_REPAIR_BUDGET_EXCEEDED`, do not delete the repair state or run another draft command; show a concise blocker with the report path and the last error.

Repairs should address the cause, not just the symptom:

- `FONT_TOO_SMALL`: reduce text density, shorten copy, enlarge/reflow containers, or move labels out of small shapes. Do not simply increase every font size if that creates overflow.
- `missing_timeline_registry`, `gsap_timeline_not_registered`: register a paused GSAP timeline on `window.__timelines[compositionId]`, using the exact root `data-composition-id`.
- `timed_element_missing_clip_class`, `root_composition_missing_data_start`, `media_missing_data_start`, `imperative_media_control`: let the renderer own timing and media playback through `data-start`, `data-duration`, `.clip`, and media data attributes.
- `text_occluded`, `text_box_overflow`, `content_overlap`: restructure the scene layout or regenerate the affected scene from the contract's boxes. Do not rely on small numeric nudges.
- `FROZEN_FRAME_RUN`: fix the timeline registration, scene clip timing, or scene variation; do not deliver a draft whose sampled frames are identical across multiple scenes.

If only visual advisories remain and the draft render exists, present the mp4 draft with QA notes instead of silently looping. Repair the design contract, scene-map, or hand-authored HTML directly; do not introduce `spec.json` as a workaround.

After the draft render succeeds, run `composition-design-review` only when its trigger applies. A review blocker must be visible in a specific scene/frame and must break readability, the approved promise, required brand/style tokens, motion timing, or asset safety. Allow at most one localized repair and re-draft only for concrete blockers. Treat `fix` and `polish` findings as Gate D notes.

## Narration / Audio Track

**WHO OWNS NARRATION -- decide this first:**

- **Standalone COMPOSE deliverable** (the composition IS the finished video, no assemble step): embed the narration as an `<audio>` track here; the renderer muxes it. Single add -- correct.
- **Composition is a SEGMENT in an AUTO/assemble pipeline** (the assembler will mix narration in its mix tier -- `stage-assemble` step 3): render this composition **SILENT -- do NOT add a narration `<audio>` track**. If you bake narration in here AND the assembler mixes it, narration is added twice and you get two overlapping, drifting voices. The mix step refuses a non-silent base by default to catch this.

To give a STANDALONE explainer a voiceover: synthesize the narration to an audio file with `ovs speak`, then add it as an **audio track** in the composition. The renderer muxes audio tracks into the output.

```html
<audio id="narration" src="./assets/narration.mp3"
       data-start="0" data-duration="60" data-track-index="0" data-volume="1"></audio>
```

- Place the `<audio>` inside the root composition div. `data-duration` should cover the spoken length; size the scene timing to the narration, not the other way around.
- Before the first TTS call, estimate the script length from `video-craft` cadence (~150-160 wpm for explainers) and trim the text to the approved target duration. Do not synthesize multiple full versions just to discover timing. One full TTS pass plus at most one shortened retry is the limit.
- If `ovs speak` fails, never silently continue: tell the user, then either fix and retry the narration or explicitly proceed silent with that stated at the gate.
- Use a project path such as `project/composition/assets/narration.mp3` so the composition stays self-contained.
- For background music plus voiceover, use two `<audio>` tracks with different `data-track-index` and lower the music `data-volume` (e.g. 0.2).
- **Talking-head caveat:** when this composition is being overlaid onto AI-generated talking-head footage that already has lip-synced built-in speech, do NOT add a narration `<audio>` track.

## Render (The Outcome)

Produce the finished video by running the draft gate over the composition **directory**. Iterate at draft quality, then do one high-quality pass once the layout and timing pass review:

- Draft: `ovs draft project/composition --out project/render/draft.mp4 --quality draft --report project/render/draft-report.json --findings project/composition/qa/inspect.json`
- Final: `ovs draft project/composition --out project/render/video.mp4 --quality high --report project/render/final-report.json --findings project/composition/qa/final-inspect.json`

Use `ovs render` only as a narrow diagnostic render when QA has already identified the blocker. User-facing drafts and finals go through `ovs draft` so contract, source, narration, media, and sampled-frame QA are not skipped.

## Director Judgment (Compose Line)

Craft calls specific to designed/animated explainers, on top of the shared craft reference (video-craft):

- **One concept per visual chapter** -- do not stack two ideas in one scene; give each its own build.
- **Concrete before abstract** -- real data, diagrams, steps before a metaphor; the metaphor only lands once the concrete version is understood.
- **Aesthetic thesis before styling** -- use `frontend-design` to choose one signature visual device that comes from the subject matter; spend distinctiveness there and keep the rest disciplined.
- **Reference styles become tokens** -- use `design-system-importer` for DESIGN.md/brand/reference input, then adapt the tokens to video safe zones and motion. Do not clone protected layouts or assets.
- **Design review is a last-mile guardrail** -- use `composition-design-review` only when its trigger applies. Block only on concrete visible failures; template feel, hierarchy, and polish issues that do not break the promise go to the Gate D note.
- **Render exact text as real text** -- stats, names, CTAs are typed into the composition, never baked into AI imagery.
- **Build to the narration words**, not arbitrary beats; hold a fully-built scene/chart >= 2-3 s before moving on.
- **Vary scene types** -- no three near-identical layouts in a row; alternate full-frame / split / diagram / quote.
- **Spoken/readable captions live in the plan's `tracks.captions.lines` (data), NOT burned into this composition** -- the assembler burns them via `burnsubs` at the end, so a later typo fix is a one-line edit, not a re-render of the whole composition. Only a purely decorative caption treatment that is the visual design may live inside the composition.
- Surface craft-threshold warnings on the composition when you QA it before rendering. In draft mode, small readable text is a QA advisory rather than a render blocker; oversized palette is advisory and should be judged against the design thesis, brand, and scene clarity.

## Constraints

- Deterministic only: no real-time timers, no network-dependent runtime behavior, no randomness without a fixed seed -- the renderer seeks discrete frames.
- Keep all referenced assets inside the composition directory so the render is self-contained.
- This skill authors and renders compositions; it does not pick the production line (see `video-router`) or generate AI footage.
