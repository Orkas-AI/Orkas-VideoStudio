## Canonical Composition Manifest

Write one `composition-manifest.json` v2 before HTML. It is the source of truth for canvas, duration, scenes, source alignment, audio ownership, and art direction; do not maintain parallel `design-contract.json` and `scene-map.json` files for new work.

```json
{
  "schema_version": 2,
  "composition": { "id": "main", "width": 1920, "height": 1080, "duration": 10, "target_duration": 10, "fps": 30, "language": "en" },
  "audio": { "owner": "none", "tracks": [] },
  "source_alignment": { "merge_reason": "optional when combining approved shotlist beats" },
  "scenes": [
    {
      "id": "hook",
      "start": 0,
      "duration": 10,
      "approved_copy": ["Orkas VideoStudio"],
      "narration_refs": [],
      "source_shots": ["s01"],
      "roles": ["hook"]
    }
  ],
  "art_direction": {
    "aesthetic": { "tone": "precise and cinematic", "signature_device": "timeline ribbon" },
    "cover": { "scene_id": "hook", "headline": "Orkas VideoStudio", "content_signals": ["timeline", "video frame"], "hero_visual": "timeline ribbon", "composition_strategy": "hero ribbon with visible frame payoff", "frame_time_sec": 0 },
    "visual_direction": {},
    "typography_tokens": {},
    "color_tokens": {},
    "motion_budget": {},
    "scene_variation": {},
    "scenes": [{ "id": "hook", "hero_visual": "timeline ribbon", "depth_layers": ["grid", "ribbon", "labels"], "motion_verbs": ["reveal", "track"] }]
  }
}
```

If an approved beat is intentionally merged, add `source_alignment.merge_reason` or per-scene `source_shots`. Standalone narrated schema v2 manifests also require the exact Gate B-signed `audio.narration_intent` and a composition-owned narration track. AUTO child compositions use `audio.owner: "assembler"` and no tracks.

A scene `source_shots` entry may be an approved `shot.id` or a source alias uniquely owned by one shot through `shot.source_shots`; QA canonicalizes those representations. Unknown or multiply-owned aliases are real mapping errors.

## Composition Contract (The Minimum That Renders)

A composition is a directory with `composition-manifest.json` plus `index.html`. Run `ovs composition prepare` to establish the initial contract, and `ovs composition reconcile` after manifest timing/audio changes.

- The **root** element declares the timeline: `data-composition-id="main"`, `data-start="0"`, `data-duration` (seconds), `data-width`, `data-height` (px), and `data-fps`.
- Each visible timed **clip** is a direct child with `class="clip"`, `data-scene-id`, `data-start`, `data-duration`, and `data-track-index` (higher index = drawn on top).
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
- **Local GSAP vendor**: `ovs composition prepare` and the draft path prepare the built-in offline GSAP vendor. Do not manually patch `assets/vendor/gsap.min.js`; fix manifest/HTML issues, or report the vendor blocker.
