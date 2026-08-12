---
name: composition-design-review
description: Advisory visual checklist for OrkasVideoStudio COMPOSE previews and drafts. Apply it yourself to snapshot evidence before showing a visual preview; when preview is skipped, use the draft as the fallback evidence. Nothing is scored and nothing is submitted — return one complete, actionable repair set without opening another user gate.
---

# composition-design-review

Use this after `stage-compose` has run `ovs snapshot`, before showing the visual preview. There is no score to compute and nothing to submit: quality is judged by what is visibly broken in a specific frame, never by a number.

Review economically: the snapshot's contact sheet is the complete index — read it once, then open at full scale only the frame-0 cover, every frame a QA finding names, and frames whose sheet cell shows risk (dense or doubtful text, suspected overlap or blankness). Opening every `frame_paths` entry individually costs minutes per pass and repeats what deterministic QA already sampled.

If the visual preview is intentionally skipped, run the same review against representative draft frames after an ok `ovs draft` report. This is a design QA layer, not a renderer, line router, or generic video craft checklist. It does not create a new user gate or approval field.

## Activation

Apply the checklist whenever snapshot evidence exists, and give it extra weight when:

- The work is design-sensitive COMPOSE — brand, product, promo, launch, version-update, portfolio, or other design-led work.
- The draft shows a visible design risk that deterministic QA cannot judge, such as a weak first frame, flat hierarchy, repeated scene grammar, or motion that hides the message.

Do not run the post-draft fallback for ordinary edit/TTS/clip-selection work, simple caption cards, or generic "make it polished" wording without a visible design risk.

## Review Inputs

Read only the relevant artifacts:

- `project/composition/composition-manifest.json`
- Every composition-local image/video in `art_direction.references`, including its intent, roles, preserve/may-change boundary, target scenes, and spatial/temporal anchors
- The latest successful snapshot's contact sheet as the index, drilling into `frame_paths` entries only where evidence points (cover, QA-named, risky cells)
- `project/composition/qa/check.json`
- `project/composition/narration-map.json` as READ-ONLY evidence when detailed narration-line alignment matters — check what the voice actually speaks against each scene window. Do not edit it from design review; hand alignment findings back to `stage-compose`.
- For the fallback only: `project/render/draft-report.json` and representative draft frames
- The approved script/shotlist only when a finding depends on message intent

Do not review mutable aliases as if they were frozen evidence. Preserve the reviewed `frame_paths` in the review result so the exact revision is auditable.

## Findings Rubric

Tag each finding as `blocker`, `fix`, or `polish`. Inspect the complete frame set before repairing anything, then return all blockers in one batch.

Blockers must identify a specific scene/frame, the visible evidence, and the smallest repair. A finding is not a blocker just because the design could be more distinctive, or because check reported a visual advisory that does not break the approved promise.

Blockers:

- First frame is blank, unreadable, or fails the dedicated cover contract: approved promise, dominant hero, and at least two recognizable signals of the actual video content.
- Text is unreadable, hides the approved promise/CTA, or materially blocks comprehension because of size, safe-zone, overlap, occlusion, or contrast.
- The contract/source/audio/media/video QA says approved scene copy, canvas, assets, runtime dependencies, narration mapping, or sampled frames do not match the model-authored HTML/contract.
- Visual language contradicts an explicit style source or ignores required brand tokens.
- A reference image or video loses a declared preserve axis, changes something outside `may_change`, violates an anchor, misses the requested edit, or falls below `reference_fidelity.verification.minimum_score`.
- The piece reads as a slideshow when the approved promise was motion graphics.
- Motion hides the message, distracts from the focal point, or breaks narration timing.
- A protected logo/asset/layout was copied without ownership or permission.

Fix:

- First frame is truthful and readable but its topic signals are too generic or weak to work as a strong cover.
- Text has a visible safe-zone, size, overlap, occlusion, or contrast advisory, but the main message remains readable.
- Repeated layout, transition, or card pattern three or more times in a row.
- Palette uses extra chromatic colors beyond the contract.
- Type hierarchy is flat or labels feel like UI residue instead of video graphics.
- English titles, body copy, captions, subtitles, or CTAs are forced to all caps. Restore approved natural casing and use scale, weight, width, color, or spacing for hierarchy. Preserve all caps only when the user supplied that exact casing or an external brand requires it; model-authored art direction is not authorization.
- Scene density is too high for phone viewing.
- Style-source adaptation is vague: it borrows mood words but no concrete tokens.
- Reference comparison is based on provenance or mood rather than the declared intent, roles, protected attributes, allowed changes, and anchors.

Polish:

- Easing, stagger, spacing, shadow, stroke, or texture could better support the tone.
- A stronger thumbnail frame or payoff hold would improve memorability.
- A minor token mismatch that does not hurt comprehension.

## Repair Preference

Fix the highest-level artifact that caused the issue:

1. `composition-manifest.json#art_direction` when the thesis, tokens, layout budget, timing, narration mapping, or source-shot mapping is wrong; reconcile after structural changes.
2. `index.html` for visual hierarchy, typography, layout, motion, asset, or scene variation fixes.

Do not solve design problems by only nudging pixels. If the issue is "too generic", change the signature device or scene grammar. If the issue is "too dense", remove or split content.

After the full review, apply at most one localized repair pass containing the complete blocker set. Then run reconcile when needed, `ovs check`, and `ovs snapshot` again, and review the new snapshot the same economical way; never show a revision you have not checked.

## Output Format

Return three bullets that travel with the Gate D note:

- `blockers`: all concrete locations + visible evidence + the smallest repair for each
- `fixes`: concrete location + repair
- `polish`: optional

There is no verdict, no score, and no submission — do not repeat the full pass after the draft renders when the preview already reviewed these frames; hand readiness to `gate-control`.
