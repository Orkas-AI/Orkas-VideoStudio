---
name: composition-design-review
description: Design review layer for OrkasVideoStudio COMPOSE previews and drafts. Review every immutable snapshot frame before showing a visual preview; when preview is skipped, use the draft as the fallback evidence. Return one complete, actionable repair set without opening another user gate.
---

# composition-design-review

Use this after `stage-compose` has run `ovs snapshot`, before showing the visual preview. The snapshot's `frame_paths` are the review set: inspect every frame individually. The contact sheet is only an index and never substitutes for full-size frame inspection.

If the visual preview is intentionally skipped, run the same review against representative draft frames after an ok `ovs draft` report. This is a design QA layer, not a renderer, line router, or generic video craft checklist. It does not create a new user gate or approval field.

## Activation

- Run for every visual preview before that preview is shown.
- Use the post-draft fallback for design-sensitive COMPOSE work when no preview was shown, including brand, product, promo, launch, version-update, portfolio, or other design-led work.
- Also use the fallback when the draft shows a visible design risk that deterministic QA cannot judge, such as a weak first frame, flat hierarchy, repeated scene grammar, or motion that hides the message.

Do not run the post-draft fallback for ordinary edit/TTS/clip-selection work, simple caption cards, or generic "make it polished" wording without a visible design risk.

## Review Inputs

Read only the relevant artifacts:

- `project/composition/composition-manifest.json`
- Every immutable path in the latest successful snapshot's `frame_paths`
- `project/composition/qa/check.json`
- For the fallback only: `project/render/draft-report.json` and representative draft frames
- The approved script/shotlist only when a finding depends on message intent

Do not review mutable aliases as if they were frozen evidence. Preserve the reviewed `frame_paths` in the review result so the exact revision is auditable.

## Findings Rubric

Tag each finding as `blocker`, `fix`, or `polish`. Inspect the complete frame set before repairing anything, then return all blockers in one batch.

Blockers must identify a specific scene/frame, the visible evidence, and the smallest repair. A finding is not a blocker just because the design could be more distinctive, or because check reported a visual advisory that does not break the approved promise.

Blockers:

- First frame is blank, unreadable, or fails to state the approved promise in a promo/version-update/launch deliverable.
- Text is unreadable, hides the approved promise/CTA, or materially blocks comprehension because of size, safe-zone, overlap, occlusion, or contrast.
- The contract/source/audio/media/video QA says approved scene copy, canvas, assets, runtime dependencies, narration mapping, or sampled frames do not match the model-authored HTML/contract.
- Visual language contradicts an explicit style source or ignores required brand tokens.
- The piece reads as a slideshow when the approved promise was motion graphics.
- Motion hides the message, distracts from the focal point, or breaks narration timing.
- A protected logo/asset/layout was copied without ownership or permission.

Fix:

- First frame is truthful and readable but could be a stronger thumbnail.
- Text has a visible safe-zone, size, overlap, occlusion, or contrast advisory, but the main message remains readable.
- Repeated layout, transition, or card pattern three or more times in a row.
- Palette uses extra chromatic colors beyond the contract.
- Type hierarchy is flat or labels feel like UI residue instead of video graphics.
- English titles, body copy, captions, subtitles, or CTAs are forced to all caps. Restore approved natural casing and use scale, weight, width, color, or spacing for hierarchy. Preserve all caps only when the user supplied that exact casing or an external brand requires it; model-authored art direction is not authorization.
- Scene density is too high for phone viewing.
- Style-source adaptation is vague: it borrows mood words but no concrete tokens.

Polish:

- Easing, stagger, spacing, shadow, stroke, or texture could better support the tone.
- A stronger thumbnail frame or payoff hold would improve memorability.
- A minor token mismatch that does not hurt comprehension.

## Repair Preference

Fix the highest-level artifact that caused the issue:

1. `composition-manifest.json#art_direction` when the thesis, tokens, layout budget, timing, narration mapping, or source-shot mapping is wrong; reconcile after structural changes.
2. `index.html` for visual hierarchy, typography, layout, motion, asset, or scene variation fixes.

Do not solve design problems by only nudging pixels. If the issue is "too generic", change the signature device or scene grammar. If the issue is "too dense", remove or split content.

After the full review, apply at most one localized repair pass containing the complete blocker set. Then run reconcile when needed, `ovs check`, and `ovs snapshot` again. Review every frame in the new `frame_paths`; never show a partially reviewed revision.

## Output Format

Return a compact review object or bullets:

- `verdict`: `passed | repair | blocked`
- `review_scope`: why this review was triggered
- `reviewed_frame_paths`: every immutable frame inspected
- `design_direction`: one line
- `blockers`: all concrete locations + evidence + repairs
- `fixes`: concrete location + repair
- `polish`: optional
- `next_action`: rerun check and snapshot, show the visual preview, continue to draft in the fallback path, or surface a blocker
