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

Follow the requested `reproduce`/`edit`/`guide` relationship. Preserve user-owned or explicitly authorized assets when fidelity requires them; otherwise respect stated exclusions and ownership constraints. Do not force variation merely to appear original when the user asked to reproduce a source.
Keep extraction small enough to fit inside the design contract. Do not load or recreate unrelated parts of an external design system.

## Extract Compact Tokens

Write a `style_source` object into `project/composition/composition-manifest.json#art_direction`:

```json
{
  "style_source": {
    "source_type": "brand_system | design_notes | reference_media | existing_product | named_reference",
    "source_basis": "file path, user note, or inspected artifact",
    "adaptation_boundary": "what must be preserved, may change, or is excluded",
    "observed_signature": "the concrete geometry, hierarchy, type, palette, and motion behavior seen in evidence",
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
- `excluded_elements`: user exclusions and any assets that cannot be reused; do not invent blanket exclusions that contradict an explicit reproduce/edit request.

Keep the imported style small. If more than 6 chromatic colors or 3 font roles are needed, summarize the conflict and pick the smallest faithful subset.

## Executable Media Contract

For every concrete reference, add `art_direction.references` with `id`, `media_type`, local `path`, `intent`, `intent_basis`, allowed `roles`, `required`, `preserve`, `may_change`, and `target_scene_ids`. Use only these roles: `content`, `identity`, `composition`, `structure`, `style`, `motion`, `timing`, and `audio`.

Add shared `art_direction.reference_fidelity` with `mode: exact|close|adapt`, non-overlapping `preserve`/`may_change`, normalized `layout_anchors` for composition/structure roles, and concrete observable comparison criteria. Video reproduce/edit/motion/timing references also need source-time-to-target-scene `temporal_anchors`.

`exact` preserves every declared axis except explicit `may_change`; `close` keeps the recognizable system while adapting named content or aspect constraints; `adapt` borrows only selected declared principles. Review with paired source/target frames and concrete findings, never a numeric similarity score.

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
- Which elements are excluded and why.
- What observed visual signature must remain recognizable for the declared intent.
- Which reference intent, roles, protected/allowed changes, target scenes, anchors, and observable comparison criteria apply.
