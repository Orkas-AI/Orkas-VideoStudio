---
name: frontend-design
description: Aesthetic direction for OrkasVideoStudio HTML and motion-graphics compositions. Use before stage-compose writes design-contract.json and index.html to choose a subject-specific visual point of view, type, palette, layout signature, restrained motion, and anti-template checks.
---

# frontend-design

Use this as the design-lead layer for COMPOSE work. It shapes HTML/SVG motion graphics before `stage-compose` turns them into `project/composition/design-contract.json` and `index.html`.

This skill does not pick the video production line, replace `video-craft`, or relax HyperFrames/OVS renderer constraints. If there is a conflict, renderer determinism, safe zones, legibility, audio ownership, and user-approved creative direction win.

## Required generation references

For every non-trivial COMPOSE deliverable, read these compact references before authoring HTML:

- `references/html-generation-playbook.md` — the private pre-code art-direction pass, frame-composition rules, and opening/resolved-state authoring pattern.
- `references/visual-primitives.md` — reusable CSS/SVG composition primitives and scene-grammar selection guidance.
- `references/worked-compositions.md` — worked examples showing how subject matter becomes a cohesive visual system without copying a fixed template.

These references improve the initial generation. They do not create a new artifact, user gate, or approval step. Keep the art-direction pass internal and record only the decisions needed to make `design-contract.json` executable.

## Design Thesis

Before writing HTML, choose a compact visual thesis:

- `subject_world`: the real materials, artifacts, interface metaphors, gestures, environment, or culture of the topic.
- `audience`: who must understand this at phone size and what they already know.
- `one_job`: what this video frame sequence must make clear.
- `tone`: one or two precise words that shape type, color, spacing, and motion.
- `signature_device`: one memorable visual move that belongs to this brief.
- `aesthetic_risk`: one justified choice that avoids generic output without hurting readability.

Keep the thesis specific. "Modern tech style" is not a thesis. "Battery-lab oscilloscope traces become the progress line" is.

## Visual Direction

### Visual identity gate

Do not start `index.html` until `design-contract.json` carries a usable visual identity:

- `aesthetic.subject_world`, `aesthetic.one_job`, `aesthetic.signature_device`, `aesthetic.aesthetic_risk`, and `aesthetic.anti_template_check`
- role-based `typography_tokens` and baseline `color_tokens`
- `visual_direction` with a design tradition, lazy-default rejections, video-scale rule, depth-layer rule, motion-verb rule, and rhythm pattern
- a scene-level plan with `hero_visual`, `depth_layers`, `opening_state`, and `resolved_state`

If the first concrete visual move is a generic grid, circles connected by lines, a centered title card, emoji-as-icon, or a web-dashboard layout, the visual identity is not ready. Revise the direction first; do not compensate with more glows or animation.

### VisualDirectionV1

For non-trivial COMPOSE work, write a compact `visual_direction` object inside `design-contract.json`. It is the front-loaded aesthetic director for HTML authoring; it is not a template and not a user gate.

Required fields:

- `visual_tradition`: a real design tradition, designer, art movement, or cultural reference that controls composition behavior. Examples: `Swiss Pulse / Josef Müller-Brockmann precision grid`, `Data Drift / Refik Anadol data field`, `Velvet Standard / Vignelli restraint`, `Deconstructed / Neville Brody rupture`, `Maximalist Type / Paula Scher scale`. Avoid empty labels such as "modern tech", "premium", or "cinematic" by themselves.
- `composition_behavior`: how frames should be arranged and how the eye should travel: grid-locked data, research atlas, editorial archive, full-bleed object, kinetic type wall, product surface, map/flow, or diagram build.
- `lazy_defaults_rejected`: the first generic design move rejected and the brief-specific replacement. Question purple/blue neon gradients, black neon circles, centered equal-weight layouts, identical cards, decorative emoji/icons, tiny badges, default web dashboards, and pure black/white.
- `video_scale`: the scale floor for this canvas, at or above the `video-craft` floor that `ovs lint` checks. For 1920x1080, default to headline 72-140px, body/supporting text 42px and up, labels and captions at or above the ~40px legibility floor, borders 2-4px, safe padding 60-140px, and decorative opacity 12-25%.
- `depth_layer_rule`: how every scene will maintain background atmosphere, midground content, and foreground accents/metadata with topic-derived materials.
- `motion_verb_rule`: the verbs primary elements are allowed to use. Every meaningful element needs a verb such as draws, locks, counts up, slams, drifts, fractures, reveals, or resolves.
- `typography_register`: the communication roles for display, body, data/label, caption, and any expressive font. Do not pair two similar sans-serifs; use extreme weight/scale contrast and video-readable type.
- `rhythm_pattern`: the scene rhythm before HTML, such as `hook-build-HOLD-surge-resolve`, `drift-build-PEAK-drift-resolve`, or `fast-fast-SLOW-fast-hold`.

Example:

```json
{
  "visual_direction": {
    "visual_tradition": "Swiss Pulse precision grid + Data Drift AI atmosphere",
    "composition_behavior": "research atlas: huge years anchor a coordinate grid while model/paper fragments lock into position",
    "lazy_defaults_rejected": "reject glowing circles on a thin timeline; replace with paper fragments, parameter contours, and data-field coordinates",
    "video_scale": "1920x1080: headline 88-132px, body 44-56px, labels 40-44px, borders 2-4px, safe padding 96-140px, atmospheric opacity 12-22%",
    "depth_layer_rule": "BG token field/grid/grain, MG timeline and model artifacts, FG large year + metadata ticks",
    "motion_verb_rule": "timeline draws, years stamp, nodes lock, token fields drift, paper fragments slide/resolve",
    "typography_register": "large tabular years as display voice, concise labels as body, monospace metadata for data",
    "rhythm_pattern": "hook-build-HOLD-surge-resolve"
  }
}
```

### Resolved frame before motion

For each scene, build the fully readable resolved frame first in static HTML/CSS/SVG. This is the frame where the scene's message, hierarchy, and hero visual are clearest.

Then add GSAP entrances and meaningful reveals from that static state. The CSS/SVG resolved layout is the source of truth; the timeline describes how the viewer arrives there. Do not design a scene by placing elements at their animated start state and hoping the tween lands in a good composition.

For every non-trivial scene, internally check before writing tweens:

- What is the one dominant visual object at the resolved frame?
- Does meaningful visual material occupy the safe canvas, or is it a small cluster in empty space?
- Which topic-derived background, midground hero, and foreground annotation layers are visible?
- What changes between opening and resolved state beyond a container fade?
- Which element carries continuity from the prior scene?

### Preview critique before draft

When the HTML Preview Gate is required, treat the snapshot contact sheet as the design checkpoint, and judge every returned frame rather than the opening one alone. If a scene reads as a low-effort slide, a generic diagram, a blank start, or text labels substituting for the promised visual, repair the contract or the affected HTML before moving to an mp4 draft. This is a localized HTML-preview correction, not an open-ended final-video rerender loop.

## Avoid Template Gravity

Reject choices that could fit almost any brief:

- Purple/blue neon gradients, glass panels, generic bento cards, floating UI cards, decorative blobs, and stock SaaS dashboards unless the subject truly calls for them.
- Numbered markers, timelines, terminal windows, blueprint grids, or newspaper rules when the content is not actually sequential, technical, architectural, or editorial.
- A palette made from one hue family with lighter/darker variations only.
- Long labels in circles, tiny badges, dense microcopy, or walls of text doing the visual's job.
- Motion everywhere. Spend motion on the one thing the viewer must notice.
- Decorative emoji/icons as the primary graphic language. Use topic-specific SVG marks, diagrams, data forms, object silhouettes, or typographic systems instead unless the user explicitly asked for playful emoji language.

If the first design idea feels like a reusable demo template, revise the thesis before coding.

## Contract Fields

Add an `aesthetic` object to `project/composition/design-contract.json`:

```json
{
  "aesthetic": {
    "subject_world": "what the visual language borrows from",
    "audience": "who it is for",
    "one_job": "the frame sequence's job",
    "tone": ["precise", "brief"],
    "signature_device": "one remembered visual behavior",
    "aesthetic_risk": "the deliberate non-default choice",
    "anti_template_check": "what was rejected as too generic"
  }
}
```

The rest of the contract must make the thesis executable:

- `visual_direction`: the `VisualDirectionV1` object: design tradition, composition behavior, rejected lazy defaults, video scale, depth-layer rule, motion-verb rule, typography register, and rhythm pattern.
- `typography_tokens`: role-based, not just sizes. Include display, body, data/label, and caption roles when needed.
- `color_tokens`: named baseline values with rationale. Include neutrals, primary accent, and any purposeful supporting accents needed for brand, hierarchy, data meaning, or scene variation.
- `layout_boxes`: describe visual hierarchy, not only coordinates. Name the focal zone and supporting zones.
- `motion_budget`: state what carries meaning, what stays still, and how each transition maps to the story.
- `scene_variation`: prevent three near-identical card/title scenes in a row.
- Each designed `scene` should compactly name `scene_world`, `hero_visual`, `composition`, `depth_layers`, `motion_verbs`, `opening_state`, `resolved_state`, `continuity_in`, `continuity_out`, and any `primitive_refs` selected from the generation references. Keep these fields inside the existing contract; do not create another user-facing planning artifact.

## HTML Direction

When writing `index.html`:

- Complete the private art-direction pass from `references/html-generation-playbook.md` immediately before coding. Decide the dominant visual, spatial tension, depth layers, opening/resolved states, and continuity behavior for every scene; do not output this as a new user gate.
- Select and adapt primitives from `references/visual-primitives.md`. They are ingredients, not templates: change geometry, scale, rhythm, and content so the result belongs to the brief.
- Use video scale, not web scale, and keep every readable element at or above the `video-craft` floor. Build each frame in three semantic depth layers: a topic-derived background field, a dominant midground message/diagram, and foreground accents or metadata. Do not add arbitrary decoration; every layer should reinforce subject, hierarchy, scale, direction, or continuity.
- Give every meaningful element a motion verb before writing GSAP. If the author cannot say whether a path draws, a year stamps, a number counts up, a card locks, or a texture drifts, the element is not yet designed.
- Derive the main CSS variables from `design-contract.json`; keep extra chromatic colors intentional and named enough to audit. Do not flatten the design or recolor the whole video only to reduce a static palette count.
- Let one element carry personality: a custom progress line, typographic reveal, diagram grammar, texture, data mark, or transition family. Keep surrounding elements quiet.
- Use type as design material: contrast display/body roles, make title/body hierarchy unmistakable, and keep labels large enough for the `video-craft` floor.
- Use structural marks only when they encode meaning: steps for sequences, coordinates for maps, ticks for time, nodes for relationships, brackets for comparison.
- Prefer SVG for diagrams, paths, meters, masks, charts, and signature geometry; keep prose and captions as real HTML text.
- Default to SVG/static held states first. Use GSAP only when a timed reveal, transition, or emphasis genuinely improves comprehension; animate SVG groups or a few containers instead of many HTML cards.
- For vertical video, design for platform UI: keep essential text away from the bottom action area and make the first frame readable as a thumbnail.
- Respect `prefers-reduced-motion` in CSS where practical, but drive render-critical animation through the paused GSAP timeline.

## Build Loop

1. Draft the thesis and contract.
2. Self-critique the contract: name the most generic choice and replace it.
3. Run the internal pre-code art-direction pass: choose `VisualDirectionV1`, scene grammar, hero visual, three depth layers, motion verbs, typography register, rhythm pattern, opening/resolved states, and cross-scene continuity. Keep it inside the generation turn; no new user confirmation.
4. Write HTML/SVG from the contract using adapted visual primitives and worked examples as references, not fixed templates.
5. Run `ovs draft ... --quality draft`. If structural, contract, source, audio, media, or sampled-frame QA fails, repair the contract or scene structure first; do not only nudge CSS numbers. Missing preview-required art direction is a blocking contract error, not a cosmetic note: `ovs draft` returns `E_DESIGN_CONTRACT_BLOCKED` until the aesthetic thesis, `VisualDirectionV1`, motion budget, scene variation budget, per-scene depth layers, and per-scene motion verbs are complete. Treat visual/readability findings as draft notes unless they make the approved message unreadable.
6. After the draft report is written, judge the evidence frames/contact sheet for: clear focal point, subject-specific visual language, readable type, and motion with purpose.

## Output Standard

When reporting a COMPOSE draft or blocker, include the short design direction used: thesis, signature device, and any inspect/craft issue that forced a design change.
