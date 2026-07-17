---
name: composition-design-review
description: Design review layer for OrkasVideoStudio COMPOSE drafts. Use after stage-compose has produced an ok `ovs draft` report to assess template feel, first frame, hierarchy, readability, style consistency, purposeful motion, and adherence to DESIGN.md/brand tokens, returning only actionable fixes.
---

# composition-design-review

Use this after `stage-compose` has run `ovs draft` and produced an ok draft/report, but only when the compose task is design-sensitive. It is a design QA layer, not a renderer, line router, or generic video craft checklist.

Do not open a new user Gate. Read `steps.check.draft_disposition` when present. Treat visual/readability check findings as review evidence, not automatic blockers. If findings are blockers, make at most one localized repair to the manifest/HTML and re-run `ovs draft` before Gate D. If findings are `fix` or `polish`, include them in the Gate D note unless they are trivial to repair in the same pass.

## Activation

Run this review only when one of these is true:

- The approved brief is brand, product, promo, launch, version-update, portfolio, or other design-led COMPOSE work.
- `project/composition/composition-manifest.json#art_direction` contains a `style_source`.
- The draft or sampled frames show a visible design risk that deterministic QA cannot judge, such as a weak first frame, flat hierarchy, repeated scene grammar, or motion that hides the message.

Do not run this review for ordinary edit/TTS/clip-selection work, simple caption cards, or generic "make it polished" wording without a visible design risk.

## Review Inputs

Read only the relevant artifacts:

- `project/composition/composition-manifest.json`
- `project/render/draft-report.json`
- `project/composition/qa/check.json` or `steps.check` from the draft report
- Sampled evidence frames when available: first frame, one mid-frame per scene, and payoff/closing frame
- The approved script/shotlist only when a finding depends on message intent

## Findings Rubric

Tag each finding as `blocker`, `fix`, or `polish`.

Blockers must identify a specific scene/frame, the visible evidence, and the smallest repair. A finding is not a blocker just because the design could be more distinctive, or because check reported a visual advisory that does not break the approved promise.

Blockers:

- First frame is blank, unreadable, or fails to state the approved promise in a promo/version-update/launch deliverable.
- Text is unreadable in the supplied evidence frame, hides the approved promise/CTA, or materially blocks comprehension because of size, safe-zone, overlap, occlusion, or contrast.
- The draft report's contract/source/audio/media/video QA says approved scene copy, canvas, assets, runtime dependencies, narration mapping, or sampled frames do not match the model-authored HTML/contract.
- Visual language contradicts an explicit style source or ignores required brand tokens.
- The piece reads as a slideshow when the approved promise was motion graphics.
- Motion hides the message, distracts from the focal point, or breaks narration timing.
- A protected logo/asset/layout was copied without ownership or permission.

Fix:

- First frame is truthful and readable but could be a stronger thumbnail.
- Text has a visible safe-zone, size, overlap, occlusion, or contrast advisory, but the main message remains readable and the draft is useful for Gate D review.
- Repeated layout, transition, or card pattern three or more times in a row.
- Palette uses extra chromatic colors beyond the contract.
- Type hierarchy is flat or labels feel like UI residue instead of video graphics.
- English titles, body copy, captions, subtitles, or CTAs are forced to all caps, or two or more English text roles in one scene use all caps without an explicit user, brand, or art-direction reason. Restore approved natural casing and use scale, weight, width, color, or spacing for hierarchy; keep all caps only for one short metadata label, acronym, or code.
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

## Output Format

Return a compact review object or bullets:

- `verdict`: pass | repair | block
- `review_scope`: why this review was triggered
- `design_direction`: one line
- `blockers`: concrete location + evidence + repair
- `fixes`: concrete location + repair
- `polish`: optional
- `next_action`: rerun draft, open Gate D, or surface blocker
