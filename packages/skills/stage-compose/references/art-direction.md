## Art Direction Before HTML

Before writing `project/composition/index.html`, write `project/composition/composition-manifest.json`. Treat its `art_direction` object as the composition budget, not a style note.

The contract must declare these budgets compactly:

- `composition`: id, width, height, approved duration, fps, language.
- `aesthetic`: from `frontend-design`: subject world, audience, one job, tone, signature device, aesthetic risk, and anti-template check.
- `visual_direction`: `VisualDirectionV1` from `frontend-design`: real design tradition/reference, composition behavior, lazy defaults rejected, video scale, depth-layer rule, motion-verb rule, typography register, and rhythm pattern. This is the front-loaded aesthetic director for HTML authoring, not a fixed template.
- `cover`: first canonical scene id, approved headline, at least two content signals, dominant hero, composition strategy, and `frame_time_sec:0`.
- `references` + `reference_fidelity`: required for every concrete reference image/video, with reproduce/edit/guide intent, roles, composition-local path, preserve/may-change boundary, target scenes, layout/temporal anchors, and scored verification floor.
- `style_source`: from `design-system-importer` when a DESIGN.md, brand guide, screenshot, reference site, Figma notes, existing app UI, or explicit named style was used. Omit when there is no external style source.
- `scenes`: canonical start/duration, approved on-screen copy, narration text/refs, source shots, and semantic roles. Put visual-only scene budgets under `art_direction.scenes[sceneId]`.
- `layout_boxes`: safe text box, visual box, caption box, and maximum label count per scene.
- `typography_tokens`: title/body/caption/label floors plus type roles and register. Default floors for 1920x1080: title >= 32px, body/supporting text >= 42px, safe margin >= 96px, no more than two text blocks and about 12-16 English words per scene. Preserve the same readability intent for 9:16 and 1:1. Preserve approved English casing by default: sentence/natural title case for titles and sentence case for body, captions, subtitles, and CTAs. Preserve all caps only when the user supplied that exact casing or an external brand requires it; model-authored art direction is not authorization, and broad `text-transform: uppercase` rules are forbidden. Avoid default two-sans pairings unless the style source explicitly requires them; use scale, weight, width, restrained case changes, mono/data roles, or serif/sans contrast to make hierarchy visible.
- `color_tokens`: named baseline values with rationale: background, surface, text, muted, primary accent, and any purposeful supporting accents the approved visual idea needs.
- `motion_budget`: max animated groups per scene, allowed transitions, easing, rhythm pattern, which SVG/HTML groups move, what each motion communicates, and the concrete motion verbs assigned to primary elements.
- `scene_variation`: how the sequence avoids three near-identical layouts, transitions, or card/title scenes in a row.
- `audio`: narration ownership, declarative local tracks, and the signed narration intent; use assembler ownership for silent AUTO segments.

The palette is a design contract, not a mechanical hue cap. The HTML/CSS/SVG should derive its main system from `color_tokens` through CSS variables or equivalent structured constants, but do not flatten or recolor a scene just to reduce a static color count.

The manifest is enforced, not advisory. `ovs composition prepare`, `ovs composition reconcile`, `ovs check`, `ovs snapshot`, and `ovs draft` validate its structural and design budgets. Repair the manifest and rerun; do not work around the gate. `ovs render` stays a raw diagnostic for work in progress.

In HTML, mark the topic-specific dominant cover visual with `data-role="visual" data-cover-hero` and at least two matching visible frame-0 elements with `data-cover-signal="<exact content_signals value>"`. Do not put those hooks on generic backgrounds, decoration, or the title.

Run a pre-code anti-template check from `frontend-design`: name the first generic design move you rejected and the brief-specific replacement. If you cannot name that replacement, the contract is not ready. The check should catch lazy defaults before HTML: purple/blue neon, glowing black-background circles, centered equal-weight layouts, identical cards, decorative emoji/icons, tiny badges, web-dashboard fragments, pure black/white, and web-scale type. When `style_source` exists, also name what was adapted, simplified, and not copied from the reference.
