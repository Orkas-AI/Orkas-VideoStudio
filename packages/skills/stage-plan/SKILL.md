---
name: stage-plan
description: The "ingest + plan" half of end-to-end video orchestration — ingest the user's material from evidence, then decompose intent into ONE cross-modal EDL (plan.json: edit/generate/compose/provided segments + narration/music/caption tracks + a delivery promise), validate it with `ovs plan validate`. Trigger when the deliverable spans more than one axis (AUTO line); do NOT trigger for a pure single-axis job (route to that line). The assembler half is stage-assemble.
---

# stage-plan

How to turn "here is my material + here's the video I want" into a single, inspectable plan spanning reference images/videos, deterministic or semantic editing, generation, and composition. The output is `project/plan.json`—a cross-modal EDL that the assembler walks. Ingest with the public `ovs` analysis commands, validate with `ovs plan`, and execute through the compose/generate/edit lines.

Use this line when the deliverable is NOT cleanly one axis — e.g. "trim my clip, add a title card and captions, and a voiceover", or "my footage for the middle, generate an opener, compose the stats". For a pure single-axis job, route to that single line instead (see `video-router`).

## Step 1 — Ingest from evidence, never from assumption

You cannot plan against material you have not looked at. For EVERY supplied clip, before writing any segment:

1. **Probe** it (`ovs edit probe`) for real duration / resolution / fps / audio presence. A plan that cuts past the real duration breaks.
2. **Read its content** the cheapest way that fits:
   - spoken audio → `ovs transcribe raw/clip.mp4 --out project/transcripts/clip.json` (pass `--model large-v3` for non-English) → you now have timecoded words to cut on and a reusable transcript file for edit ops.
   - silent / screen-recording / slideshow → prefer `ovs ocr` → per-timecode on-screen text. The audio being empty does NOT mean the screen is. If local OCR reports a runtime/install/recognition failure, extract representative frames with `ovs edit extract-frame` and read them yourself; if you cannot inspect images, ask the user for the on-screen beats. Never infer slide/screen content from the topic alone.
   - need to judge what a moment LOOKS like (is the hero shot usable? is the product right-side up?) → read frames: `ovs edit extract-frame` then look at them. If you are multimodal you read them directly; if you cannot see images, say so and plan on probe/transcript/OCR evidence alone — mark those judgments unverified, do not invent them.
3. Record what each input is good for in `project/ingest.json`: `{input_id, duration, has_audio, content_summary, quality_risks:[...], usable_for:[...], planning_implications:[...]}`. This is the factual basis the plan cites — segments reference `input_id`s from here. Rules:
   - **`content_summary` is specific and from observation:** "45 s of interview, no b-roll, mono audio" — never "user provided footage". An entry is only "reviewed" if a real probe/transcript/OCR actually ran; never claim you looked at a clip you did not.
   - **Usability heuristics:** video > 10 s → hero footage; > 3 s → b-roll; has speech → dialogue source; audio-only → narration/music source, production must supply the visuals; image-only → motion must come from animation or generation.
   - **Quality risks to flag:** width < 720 / height < 480 (will look soft), clip < 3 s (limited use), mono audio, a still where the brief wants motion. A flagged risk the plan ignores is a planning bug — surface and resolve it at the Production plan confirmation.

For every supplied image/video that constrains the result, lock its requested relationship as `reproduce`, `edit`, or `guide`. Record roles, protected attributes, allowed changes, and target segments. Video reproduction/editing or motion/timing guidance requires source-time-to-target-segment anchors.

## Step 2 — Choose the delivery promise

Pick ONE `delivery_promise.type` and make the whole plan keep it:

- **source_led** — the user's footage is the hero (repurpose / highlight / localize). `source_required: true`.
- **motion_led** — real motion (footage or generated video) dominates; composed cards are accents.
- **compose_led** — designed HTML is the spine (explainer / data); footage/generation are accents.
- **hybrid** — a deliberate mix (e.g. source hero + composed framing + generated opener).

Set `motion_min_ratio` to the minimum share of runtime that must be real footage/generated motion rather than composed HTML. For `compose_led`, use exactly `0`; HTML animation quality is enforced by composition motion QA instead of this source-mix ratio. If you cannot hit a nonzero promise from the available material, say so at the Production plan confirmation instead of quietly shipping a slideshow. If `source_required` is true, at least one PRIMARY segment must be real footage (`source: edit | provided`) and the supplied footage must play in the rendered timeline, not merely appear as a still reference frame.

## Step 3 — Decompose into a cross-modal EDL

Write `project/plan.json`. Every segment declares HOW it is produced (`source`) and WHERE it sits (`layer`):

- `source`: **edit** (trim a real clip — needs `input_id` + `in_sec`/`out_sec`), **generate** (needs `prompt` + explicit `media_kind`; billable; video also signs `generation_duration_sec`, `ratio`, `resolution`, `generate_audio`, and any `reference_image_urls`; for recurring subjects also set `characters`, `refs`, and `variation_type`), **compose** (designed HTML — needs a `kind`), **provided** (needs `asset_id` and explicit `kind: video|image`; still images never count as real motion/source footage).
- `layer`: **primary** (the main timeline), **overlay** (sits over a primary via `over: <segment id>` — captions, lower-thirds, logo boxes), **bg** (behind). An overlay composited onto real footage must be SMALLER than the frame: composed overlays render as opaque video without an alpha channel, so a full-frame overlay replaces every pixel and deletes the footage under it — `ovs edit overlay` refuses that. Keep overlays to edge elements, or make the full-frame beat a composed `primary` segment with no footage underneath.
- `role`: MUST be exactly one of hook / body / proof / cta / transition — the schema rejects any other value (`E_SEG_ROLE`) and the plan fails validation. Narrative BEAT names from the arc ("payoff", "establishing", "climax", ...) are NOT roles: map a payoff / closing / CTA beat to `cta`, an establishing / evidence beat to `proof`. Front-load the hook.

Top-level `references` is mandatory for every edit/provided source and generation reference. Each entry uses `{id,media_type,source,intent,intent_basis,roles,required,preserve,may_change,target_segment_ids,temporal_anchors?}`. Omit the field when no references exist; never emit an empty array. Roles are exactly `content|identity|composition|structure|style|motion|timing|audio`. User requirements win; otherwise `guide`/`inferred` is safe. Preserve and may-change must not overlap. A temporal anchor signs the CONSUMED interval: a bounded 3s-7s child signs 3-7, while a full-duration edit of a 12s source signs 0-12; `may_change` separately limits the actual pixel change.

When OVS intelligently selects or transforms content, add `edit_strategy` with `{mode,objectives,decision_signals,preserve,may_change}` at the plan TOP LEVEL, as a sibling of `segments` — never inside a segment. `mode` is a string and the other four are non-empty string ARRAYS, one entry per item: a bare sentence in `objectives` is rejected as `E_EDIT_STRATEGY_BOUNDARY`, and `decision_signals` is a closed set the validator names on rejection (`E_EDIT_STRATEGY_SIGNAL`), never free-text findings. Use `deterministic` for evidence-driven cuts, `semantic` for AI pixel edits, and `mixed` for both. A semantic video edit stays an EDIT/AUTO workflow but is a billable `source:"generate"` video segment with `operation:"edit"` and at least one declared original in `reference_video_paths` or `reference_video_urls`. It requires `semantic_model`, a matching top-level edit reference and temporal anchor, and inclusion in the paid-generation count.

`tracks` is required even when the project has no audio or captions; use `{}` for the empty case. Tracks are separate from the visual timeline. For narration, run `ovs speech-capabilities` and sign its executable route/model/voice/format together with the BCP-47 video language and speed under `tracks.narration.synthesis`; raw `voice` is legacy recovery only. Timed lines are `{text,start_sec,target_sec}` and each receives a `produced_path`. `target_sec` is the line's DURATION, never its end time, and windows must not overlap — the validator rejects `E_NARRATION_WINDOWS_OVERLAP`, because overlapping windows mix as two voices speaking at once. Music is path + ducking. Captions stay editable DATA under `tracks.captions.lines`. Put the exact number of generate segments in `cost_estimate.billable_generations`; a mismatch is a validation error because paid-generation confirmation reviews that count.

Fit narration in the plan before any TTS call: use natural cadence (about 2.2-2.7 English words/sec or 4-5 Chinese chars/sec), shorten over-budget lines here, and do not rely on repeated synthesis to discover timing. Reserve explicitly silent opening/ending beats at their designed length and fit speech to the remaining time — silent windows are not speech budget. When measured speech plus reserved silence exceeds the target, prefer letting the timeline grow over truncating speech or dropping a silent beat; after one automatic timing revision, stop and give the user the real choices (revise again, or proceed keeping the complete current audio).

**Author plan.json in EXACTLY this shape (copy the field names — `ovs plan validate` rejects any other shape):**

```json
{
  "aspect": "9:16",
  "total_target_sec": 30,
  "language": "en",
  "delivery_promise": { "type": "hybrid", "source_required": true, "motion_min_ratio": 0.6 },
  "segments": [
    { "id": "s1_hook", "order": 1, "role": "hook", "layer": "primary", "source": "edit",
      "target_sec": 6, "spec": { "input_id": "clipA", "in_sec": 12, "out_sec": 18 } },
    { "id": "s2_body", "order": 2, "role": "body", "layer": "primary", "source": "compose",
      "target_sec": 8, "spec": { "kind": "stat-card" } },
    { "id": "s2_cap", "order": 3, "role": "body", "layer": "overlay", "over": "s2_body",
      "source": "compose", "target_sec": 3, "spec": { "kind": "lower-third" } }
  ],
  "references": [
    {
      "id": "clip-a-source", "media_type": "video", "source": "raw/clipA.mp4",
      "intent": "edit", "intent_basis": "user", "roles": ["content", "timing", "audio"],
      "required": true, "preserve": ["approved content", "audio sync"],
      "may_change": ["signed timeline cuts"], "target_segment_ids": ["s1_hook"],
      "temporal_anchors": [{ "source_start_sec": 12, "source_end_sec": 18, "target_segment_id": "s1_hook" }]
    }
  ],
  "tracks": {
    "narration": { "synthesis": { "route_ref": "openai-compatible", "voice": "nova", "model": "tts-1", "format": "mp3", "language": "en-US", "speed": 1 },
      "segments": [ { "text": "one line of narration", "start_sec": 0, "target_sec": 6 } ] },
    "music": { "path": "assets/bed.mp3", "duck": true },
    "captions": { "style": "bold-bottom", "lines": [ { "text": "one caption line", "start_sec": 0, "target_sec": 3 } ] }
  },
  "cost_estimate": { "billable_generations": 0 }
}
```

Field gotchas the validator enforces (these are the common breakers):
- `source` is the **production-method enum** `edit | generate | compose | provided` — NOT a file path. The actual clip/asset goes in `spec.input_id` (edit) or `spec.asset_id` (provided).
- Every segment needs `order` + `layer` + `spec`; use `target_sec` (not `target_duration_sec`/`duration`). At least one segment must be `layer:"primary"`.
- Every edit/provided source and generation reference needs a matching top-level reference declaration; `spec.input_id` does not express intent or preservation boundaries.
- `operation:"edit"` requires reference video input plus `edit_strategy.mode:"semantic"|"mixed"` and may change only the declared axes.
- `tracks` is a **required object** `{narration, music, captions}` — NOT an array or `null`. Use `{}` when no tracks are needed.
- `delivery_promise` must MATCH this deliverable (Step 2) — do NOT copy the example's `hybrid`/`source_required:true`/`0.6`. A designed-HTML explainer is `type:"compose_led"`, `source_required:false`, `motion_min_ratio:0`; set `source_required:true` ONLY when the user's real footage must star; for other promise types, `motion_min_ratio` is the real-motion floor you are actually committing to.

Plan to the craft bar (`video-craft`): a hook in the first seconds, one idea per beat, readable type in safe zones, ducked audio, the right aspect.

## Step 4 — Validate, then gate B

1. `ovs plan validate` on `project/plan.json`. Fix EVERY error before going further — errors mean the plan cannot be executed or it breaks its own promise (e.g. `source_required` but no source segment). Reconsider warnings.
2. `ovs plan promise-check` on the PLAN, before producing anything. It computes the planned motion ratio vs. the promise — a fail means the plan is already a slideshow / breaks its promise. Fixing the plan now is free; re-assembling later is not. Rebalance durations or convert a static beat to footage until it passes (gate D re-checks against the real cut).
3. A passing `ovs plan validate` already returns the plan summary — present that host-rendered summary VERBATIM in the user's language for **production plan confirmation** (a locked-facts line plus the per-segment timeline with its copy is the minimum; never a hand-written abstract), including the exact narrator and generation settings, invite changes in one line, and end the turn. Gate B is two turns, not a state to re-check: in the NEXT turn the user's reply is the decision — run `ovs gate transition`. Never present the same plan's summary twice, and never ask for approval of a plan you have not shown; an unapproved plan after the user already answered means you owe the transition, not another confirmation.

## Director judgment (end-to-end planning)

The craft of weaving ONE good video across sources, on top of the shared craft (`video-craft`). This is where a multi-source plan becomes a video instead of a tour of clips:

- **Decide the spine before the sources.** Write the beat arc (hook → gap → core → proof → payoff/CTA, `video-craft` §2) source-agnostic FIRST, then assign each beat its cheapest sufficient source. Letting the material on hand dictate the structure is how end-to-end videos turn into a disjointed reel.
- **Assign each beat to the source that earns it.** Real footage (edit / provided) carries proof / authenticity / the actual product or result — make it the hero of a `source_led` piece, not a cameo. `generate` is a last resort for a beat you can neither film nor compose (an impossible / expensive establishing shot, missing b-roll) — it is billable and reads synthetic if overused. `compose` is the connective tissue — titles, stats, definitions, transitions, the CTA card — cheapest and crispest for anything textual.
- **Treat the promise as an editorial commitment, not a ratio to satisfy.** `source_led` means the user's material genuinely stars (the hero beats + real screen time), not 6 s buried under composed cards. Set `motion_min_ratio` to the feel you are promising.
- **Pace the plan in `target_sec`** to `video-craft` §3: front-load the first payoff, one idea per beat, don't plan three equal-length beats in a row.
- **Cost-aware craft.** Reach ~90% of the result with zero billable generation — reuse the user's footage, compose instead of generate, pull b-roll from existing frames. Generation is the exception you justify, not the default.
- **Plan the moment, not the whole clip.** Set each edit segment's `in_sec`/`out_sec` to the one ~3 s window that earns its slot (the cut craft itself is in `stage-edit`). Every beat must earn a purpose (establish / proof / reaction); a beat you can't justify shouldn't be in the plan.
- **Write each visual beat as a concrete photograph, not an emotion** — subject, action, environment, lighting (the rule + examples are in `video-craft` §11). If you can't picture a specific frame from the spec, neither can the generator.

## Rules

- The plan is the source of production intent. Gate-B signing ignores known execution-only fields such as `status`/`produced_path` and provider catalog labels, while stable content/references/settings and unknown new fields remain approval-bearing.
- Reference real `input_id`s from `ingest.json`; never cite a clip you have not probed.
- Keep the billable count honest in `cost_estimate` — gate C depends on it.

## Boundary / non-goals

This skill ingests and PLANS. It does not produce or assemble — that is `stage-assemble`, which walks the validated plan and delegates each segment to the compose / generate / edit lines.
