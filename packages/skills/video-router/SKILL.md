---
name: video-router
description: Read this FIRST on any video-production request to pick and lock the line — generate (AI footage), compose (designed HTML), edit (cut real footage), or AUTO end-to-end. Trigger when classifying a brief and committing to a primary path; do NOT trigger for authoring compositions, generating assets, or rendering output (those have their own stage skills).
---

# video-router

Knowledge for picking a video production line and locking it before work begins. This skill is read for guidance; it describes **what to decide**, not any tool mechanics.

Read [production method and current-video checks](references/production-method.md) before deep reference analysis or delivery review. It distinguishes direct provider output from locally assembled output using the current executable plan, not the route label.

## Unavailable Production Runtime

If production, rendering, or paid tools are explicitly unavailable, still select the line and return a complete **unexecuted production package** for a clear brief: assumptions, script/narration, timed storyboard/shotlist, exact visible copy and captions, visual/audio direction, rights-safe asset provenance/fallbacks, export target, preview checklist, and final encoding/playback QA. Clearly distinguish planned from produced media and do not withhold the package behind a direction form.

## The three capability axes

A finished video is built from one or more of three orthogonal axes. Decide which dominate, then lock them.

- **Generate (A)** — AI-generated footage/imagery: photoreal shots, b-roll, motion, talking-head. Use when the brief needs real-looking or cinematic visuals.
- **Compose (B)** — deterministic HTML composition: explainers, kinetic typography, motion graphics, captions / lower-thirds / overlays, data viz, title cards, transitions. Use when the visuals are designed rather than filmed. This is the default for explainer/animation work.
- **Edit (C)** — intelligent editing of supplied footage: evidence-based selection/cleanup, deterministic cut/join/reframe/captions/audio work, and semantic AI video editing for bounded pixel-level changes.

## Decision rules

1. First distinguish an edit target from a production input. Keeping supplied video or its timeline as the spine remains EDIT, including captions, overlays, localization and supplied narration. Video used only as a reference, or supplied images/audio/scripts, do not select EDIT. Ask only if the requested output is ambiguous.
2. Read the brief (topic, aspect ratio, language, duration) and classify the **dominant work object**:
   - "explain / teach / animate / motion-graphics / kinetic text" → **Compose (B)** primary, optionally Generate (A) for b-roll.
   - "make footage of / cinematic / a scene of / a character doing" → **Generate (A)** primary, Compose (B) to overlay captions.
   - "cut / clip / trim / repurpose / make highlights / remove or change something in my video" → **Edit (C)** primary. Keep EDIT as the route even when a billable `operation:"edit"` segment is required.
3. Most explainer/animation requests are **Compose-primary**: typographic and motion-graphic scenes assembled as an HTML composition, with AI imagery only where a shot genuinely needs it.
4. For supplied reference media, classify the requested relationship as `reproduce`, `edit`, or `guide` before choosing execution. Apply the same classification regardless of origin. Images can control content/identity/composition/structure/style; videos can additionally control motion/timing/audio through temporal anchors.
5. Aspect ratio drives the canvas: 16:9 → 1920×1080, 9:16 → 1080×1920, 1:1 → 1080×1080.

## End-to-end (AUTO) — when the job spans lines

Pick a **single line** when one axis cleanly dominates (just trim a clip; just an explainer; just generate a scene). Route to **AUTO end-to-end** when the deliverable genuinely needs MORE THAN ONE axis woven into the primary timeline — most often the user supplies their own material AND wants finished framing/voice/motion around it:

- "use my clip in the middle, author a motion-graphics opener, and add generated b-roll" (edit + compose + generate)
- "my footage in the middle, generate an opener, compose the stats" (edit + generate + compose)
- "make a finished video from these assets" where the assets alone are not the deliverable.

AUTO does not abandon the axes — it sequences them through one cross-modal plan (`stage-plan` builds the EDL, `stage-assemble` walks it), delegating each segment back to the generate / compose / edit lines. Choosing AUTO is itself the lock: the *primary* still gets named via the plan's `delivery_promise` (source_led / motion_led / compose_led / hybrid).

## Lock the runtime

- Decide the primary axis at the brief/proposal stage and **state it in the proposal**.
- Once locked, do not silently switch the primary axis mid-run. If a later step reveals the wrong choice, surface it to the user and re-confirm rather than quietly changing course.
- Layering is fine and expected (e.g. Compose captions over Generated footage); "locking" governs the **primary** path, not the allowed overlays.

## Boundary / non-goals

This skill only routes and locks. Semantic editing is not a silent switch to GENERATE: it remains an EDIT/AUTO job with a signed billable video edit segment and explicit original/preservation boundary.

## Runtime handoff

For a fully specified one-shot deterministic edit, state EDIT, probe and execute through `stage-edit` without a direction artifact or plan. Load `stage-decide` first only when the content or timing must be located.

For other production work, show two or three direction concepts and the facts already settled by the brief. Do not write a manifest, narration or art direction before that choice. Follow `gate-control` for the decision and its localized title. The public runtime uses OVS and HyperFrames; do not invent desktop-host operations.
