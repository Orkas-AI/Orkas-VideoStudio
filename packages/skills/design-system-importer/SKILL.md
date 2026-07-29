---
name: design-system-importer
description: Reference-media and design-system input layer for OrkasVideoStudio. Treat reference images, videos, screenshots, brand guides, and design notes uniformly, compiling reproduce/edit/guide intent into executable spatial and temporal constraints.
---

# design-system-importer

Use this when COMPOSE or an AUTO compose segment has external reference media or a style source: an image, video, `DESIGN.md`, brand guide, screenshot, existing website, design notes, or an explicit named visual direction.

Do not use it for ordinary editing, TTS, shot generation, or clip selection. Do not introduce a new user Gate. The output is an internal style extraction that feeds `project/composition/composition-manifest.json#art_direction` and the hand-authored `project/composition/index.html`.

Do not use it for vague adjectives like "modern", "clean", "premium", "dynamic", or "more polished" when no source is named. In those cases, let `frontend-design` choose the aesthetic thesis directly from the video brief.

## Reference Intent Before Input Technique

For every supplied image or video, classify the requested relationship before extracting style:

- `reproduce`: preserve the declared content, identity, composition, structure, style, motion, timing, or audio axes.
- `edit`: use the media as the original, protect unaffected axes, and change only `may_change`.
- `guide`: borrow only declared roles without implying exact fidelity. This is the safe default when intent is unspecified.

Use `intent_basis:"user"` for explicit requirements and `"inferred"` only for a fallback. The contract depends on requested intent, not whether the pixels came from a camera, website, design tool, model, or another authoring format. Copy each inspected source into `project/composition/assets/references/` and reference that stable local path.

Adapt style; do not copy logos, protected assets, proprietary text, or trademarked UI one-to-one.
Keep extraction small enough to fit inside the design contract. Do not load or recreate an entire external design system.

## Extract Compact Tokens

Write a `style_source` object into `project/composition/composition-manifest.json#art_direction`:

```json
{
  "style_source": {
    "source_type": "brand_system | design_notes | reference_media | existing_product | named_reference",
    "source_basis": "file path, user note, or inspected artifact",
    "adaptation_boundary": "what may be borrowed vs what must not be copied",
    "confidence": "high | medium | low",
    "fidelity_mode": "exact | close | adapt"
  }
}
```

Then normalize the source into tokens that hand-authored HTML/CSS/SVG can consume:

- `color_tokens`: background, surface, text, muted, primary accent, optional secondary accent, plus intended contrast relationship.
- `typography_tokens`: display, body, data/label, caption roles; scale and weight intent; avoid relying on fonts that are not available.
- `shape_tokens`: radius, stroke, shadow, divider, border, and density.
- `layout_language`: grid, editorial, cinematic, dashboard, diagrammatic, poster, product-demo, or another concrete grammar.
- `motion_language`: entrance, transition, emphasis, data-build, and exit patterns; keep it compatible with GSAP timeline seeking.
- `asset_rules`: what images/icons/marks are allowed, need replacement, or must be avoided.
- `do_not_copy`: logos, exact layouts, trademarked copy, screenshots, or protected illustrations unless the user owns them.

Keep the imported style small. If more than 6 chromatic colors or 3 font roles are needed, summarize the conflict and pick the smallest faithful subset.

## Executable Media Contract

For every concrete reference, add `art_direction.references` with `id`, `media_type`, local `path`, `intent`, `intent_basis`, allowed `roles`, `required`, `preserve`, `may_change`, and `target_scene_ids`. Use only these roles: `content`, `identity`, `composition`, `structure`, `style`, `motion`, `timing`, and `audio`.

Add shared `art_direction.reference_fidelity` with `mode: exact|close|adapt`, non-overlapping `preserve`/`may_change`, normalized `layout_anchors` for composition/structure roles, and a scored verification floor. Video reproduce/edit/motion/timing references also need source-time-to-target-scene `temporal_anchors`.

`exact` preserves at least three named axes and uses a minimum score of 85; `close` keeps the recognizable system while adapting content or aspect; `adapt` borrows selected principles without claiming pixel fidelity.

## Map To Video

Web and brand systems are not videos. Convert them for motion:

- First frame: choose the style's strongest thumbnail-friendly signal.
- Safe zones: enlarge type and spacing beyond web density.
- Scene variation: turn repeated web sections into distinct beats.
- Motion: make the brand grammar move with purpose; do not animate every component.
- Captions: keep ordinary subtitles in `tracks.captions.lines`, not in the style system.

## Output

After extraction, the design contract must state:

- What source was used.
- Which tokens were adopted.
- Which tokens were deliberately simplified.
- Which elements must not be copied.
- What visual signature will make the video feel related to the reference without becoming a clone.
- Which reference intent, roles, protected/allowed changes, target scenes, anchors, and scored verification floor apply.
