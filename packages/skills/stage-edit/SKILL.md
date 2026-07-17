---
name: stage-edit
description: Deterministic editing of real user-supplied footage — probe inputs, then trim / concat / burn-subtitles / overlay / mix by explicit timecodes via an edit_decisions or plan.json timeline, with `ovs edit`. Trigger for clip-factory / montage / repurpose / localization / adding narration to existing footage; do NOT trigger for designed HTML (stage-compose) or AI-generated footage (stage-generate).
---

# stage-edit

How to edit **real user-supplied footage** deterministically (cut / join / burn subtitles / overlay), as opposed to composing designed HTML (that is `stage-compose`). Describe what to produce; the editing operations run through `ovs edit` (or the equivalent MCP tool — ops: `probe` / `trim` / `concat` / `burnsubs` / `overlay` / `mix`). Read `gate-control` for Gate B/D ownership and resume behavior; this line must not create a parallel confirmation protocol.

**Subtitle safety hard rule.** Burn captions only through `ovs edit burnsubs`; do not hand-write ffmpeg subtitle, `drawtext`, or PNG-overlay fallback commands. If `burnsubs` fails because the runtime ffmpeg lacks subtitle filter support, stop and report the blocker instead of improvising a custom ffmpeg graph.

**If the task is to FIND / SELECT / REDUCE / CLEAN rather than run a known timecode edit** — remove dead air, drop fillers, pick highlights, cut a long recording down — read `stage-decide` first: it covers understanding the footage and producing an evidence-bearing rough cut (the deterministic auto-cuts `ovs edit trim-silence` / `remove-fillers`, plus `ovs scenes` / `ovs quality` / `ovs plan rank-takes`). This skill is for executing cuts you have already chosen.

**Two assembly paths — pick by whether the result needs to stay re-editable:**

- **Plan-backed (anything the user may later adjust: narration, multi-shot, segmented edits).** Author `project/plan.json` (the segments EDL — see `stage-plan`) carrying ONLY the operations the user asked for (the deltas) — everything else is the source, passed through untouched. Keep each editable concern SEPARATE in the plan: each narration line in `tracks.narration.segments` with its own `produced_path`, each caption in `tracks.captions.lines` as data, each segment carrying `status`/`produced_path`. Assemble with `ovs edit` (trim → concat → mix → burnsubs). Because plan.json holds every piece separately, a later "fix one caption / re-voice one line" is a one-entry edit + one re-render — do NOT pre-bake (e.g. one big narration file), which destroys that separability.
- **One-shot deterministic (a plain trim or concat the user just wants done).** Use `ovs edit` directly; write no plan.json.

## The deterministic editing loop

1. **Ingest — always probe first.** For every input clip, read its metadata (duration, resolution, fps, codecs) with `ovs edit probe`. Never plan a cut blind; a `trim` past the real duration produces an empty or broken clip.
2. **Plan — write an `edit_decisions` timeline.** From the user's intent + the probe results, decide the exact segments and order, and write them to `project/edit_plan.json` so the plan is inspectable and re-runnable. Shape:
   ```json
   {
     "segments": [
       { "input": "raw/clipA.mp4", "start": 12.0, "duration": 8.0 },
       { "input": "raw/clipB.mp4", "start": 0.0,  "duration": 5.5 }
     ],
     "subtitles": "raw/captions.srt",
     "overlay": { "media": "assets/logo.png", "x": 40, "y": 40 }
   }
   ```
   Every `start`/`duration` must be inside the probed duration of its input.
3. **Execute in order.**
   - `ovs edit trim` each segment to its own file (`project/cuts/seg-1.mp4`, ...).
   - `ovs edit concat` the cut files (in plan order) into one (`project/render/edited.mp4`).
   - If subtitles: `ovs edit burnsubs` the `.srt`/`.ass` onto the concatenated video.
   - If an overlay (logo / lower-third image / PiP): `ovs edit overlay` it at the planned position.
4. **Publish** the final file.

## Transcription-driven selection & localization

When the user wants highlights / clips "about X" or a localized version, transcribe first with `ovs transcribe raw/clip.mp4 --out project/transcripts/clip.json`, which writes a word-level transcript with timestamps. The default model is English-only; for non-English / Chinese audio pass `--model large-v3` — but warn the user that `large-v3` downloads ~3GB on its FIRST use (only once, then cached), so the first non-English transcribe can take several minutes before any result:

- **Highlight / clip selection:** read the transcript, choose the time ranges whose words match the requested topic/moment, and feed those `start`/`duration` into the `edit_decisions` segments. Now the timecodes are evidence-based, not guessed.
- **Auto-captions:** turn the transcript into an `.srt`, then `ovs edit burnsubs` it onto the video.
- **Localization / dubbing:** transcribe → translate the text → synthesize the translated narration (`ovs speak`) → `ovs edit mix --on-existing-audio replace` (the dub REPLACES the original voice — do not stack it on top), and `ovs edit burnsubs` translated captions.

## Grounding narration on on-screen text (silent / screen-recording footage)

**HARD RULE — adding narration to ANY existing video. Plan-first, IN ORDER. The plan.json is authored BEFORE any speech is generated and DRIVES the generation; do not synthesize a blob first and describe it after. Skipping a step is the #1 failure (a voiceover "about the right topic" that does not track the screen, crammed into half the runtime):**

1. **Analyze the video FIRST — never narrate from topic knowledge.** Probe duration, then: prefer `ovs ocr` for on-screen text AND `ovs transcribe` for any spoken audio. A title-card / slideshow / screen-recording is the on-screen-text case. If local OCR reports `E_OCR_RUNTIME_MISSING`, `E_OCR_INSTALL_FAILED`, or `E_OCR_FAILED`, extract frames across the clip and read them yourself; that is the fallback. Do NOT describe the product from memory.
2. **Author `project/plan.json` NOW (plan-first, not at the end) as the segments EDL** (copy `stage-plan`'s exact JSON skeleton — `source` is the method enum `edit`, NOT a file path (the clip goes in `spec.input_id`); use `target_sec`; `tracks` is an object), carrying ONLY what the user asked for — keep the picture, add narration — and nothing else:
   - one **primary `edit` segment** for the source spanning the whole timeline (`source:"edit"`, `layer:"primary"`, `target_sec` = clip length, `spec.input_id`/`in_sec`/`out_sec` covering the clip). Source-led keep — do NOT add crop/scale/reframe; you weren't asked to.
   - a **`tracks.narration`** track with an exact `synthesis` profile from `ovs speech-capabilities` (`route_ref`, `model`, `voice`, `language`, `speed`, `format`) and ONE LINE per on-screen beat: `{ text, start_sec, target_sec }`, the window and text derived from the OCR/transcript table — segmented and time-aligned to the picture BEFORE any TTS. One line per beat; never one paragraph for the whole clip.
   - `delivery_promise:{ type:"source_led", source_required:true }`; set `aspect` from the SOURCE's real probed dimensions (a landscape source is `16:9`, not the portrait default).
   Each narration line stays its own entry, so a later edit can re-voice ONE line without touching the rest.
3. **Generate each beat FROM the plan, then record its `produced_path`.** Run `ovs narration fit --text ... --target ...` before TTS and shorten until it fits naturally. Run `ovs speak` per line, save the audio under `project/assets/narration/line-XX.*`, probe the measured duration, then run `ovs narration fit --measured ...` and retime/shorten any miss before writing `produced_path`. Never speed up past the approved natural profile or let a line run long/short. Coverage must span ~0→clip-end, not stop at the halfway mark.
4. **Assemble with `ovs edit` — keep the picture untouched.** Place the narration lines at their `start_sec` in ONE `ovs edit mix` call via `segments` JSON (one entry per line — that is HOW per-line `start_sec` alignment happens), then use `ovs edit normalize-loudness` for the deliverable. Burn captions from `tracks.captions.lines` (.srt → `ovs edit burnsubs`) if present. The source footage usually already HAS audio, so `mix` rejects by default — choose `--on-existing-audio mix` to keep the original sound under the voiceover, or `--on-existing-audio replace` to drop it. Write each line's `produced_path` + `status` and the top-level `draft` / `video` paths back to plan.json so the record matches the result. Never pre-bake one big narration file — that destroys per-line separability.
5. **Self-check before presenting:** `project/plan.json` validates (`ovs plan validate project/plan.json`); every narration line has a `produced_path` and a window matching its OCR/transcript/frame-read text; mix returned a coverage report with no surprising uncovered tail or overshoot; `project/render/video.mp4` exists. Then tell the user the draft is ready and they can ask for follow-up tweaks (re-voice a line, fix a caption) and you'll change only that.

When the clip has NO spoken audio, or its meaning lives in ON-SCREEN TEXT (a screen-recording, a slideshow, a captioned montage), transcription returns nothing — the content is in the pixels, not the audio. An empty audio track does NOT mean an empty screen. Read what is on screen instead of guessing, in this strict order (cost-first):

1. **OCR the on-screen text — preferred, cheapest, no extra cost when available.** `ovs ocr` is the local OCR surface. It uses a local RapidOCR runtime; if Python/uv setup is unavailable or OCR fails on the clip, fall back immediately to frame extraction.
2. **Frame-read fallback:** extract frames across the whole clip with `ovs edit extract-frame` and read them directly to build the same `{startSec, endSec, text}` table.
3. **If you cannot see images either:** STOP and ask the user for the on-screen beats (a short outline of what each part shows). Never write narration from prior knowledge of the topic alone, and never escalate to a separate paid vision model.

This is the difference between "a voiceover that happens to be about the right product" and "a voiceover that tracks what is actually on screen at each moment" — the latter is the bar. As a final check before the draft, confirm each narration segment matches the OCR text for its window.

## Director judgment (editing line)

Craft calls per repurpose/montage line, on top of the shared craft reference (video-craft).

**Cut craft (every editing job — this is the canonical set; the assembly line references it).** On top of `video-craft` (pacing §3, transitions §5, audio §7):

- **Cut the moment, not the clip.** A 12 s clip usually holds one ~3 s moment that earns its slot — trim to that window. End the cut on a held look, not on the action moving off; leave a few frames of handle at each end so a dissolve doesn't clip the moment, and never freeze on a static last frame (reads as a glitch).
- **A restrained transition vocabulary for cut-driven pieces:** ≤ 4 types across the whole piece — hard cut (default, most invisible), dissolve (emotional siblings / time passage), fade-to-black (act breaks), fade bookends. In a documentary/montage register, wipes / push-slide / zoom-blur / glitch read as social-media language — avoid (this is stricter than the explainer norm in `video-craft` §5, where a wipe can mark a step).
- **Bridge the hardest cuts with sound** — carry the outgoing clip's ambient under the incoming for ~0.5–1.5 s (L-cut), or start the next audio early (J-cut); audio continuity hides a visual seam. Plus the one held silence from `video-craft` §7.
- **Adjacent-diversity + a reason per cut.** Don't place the same subject at the same shot size, or the same palette, back-to-back — break the pattern at least every ~4 cuts. If you can't write a one-line reason for a cut, it's arbitrary — reconsider it.

Per repurpose/montage line:

- **Social clip / clip-factory** — per clip = hook (0–2 s) → sustain → clean outro; optimize the first 2 frames; start on motion/face/result; lock a batch style (caption / hook position / watermark) so a series feels cohesive; don't crowd frame 1 with hook + caption + watermark + lower-third at once.
- **Podcast-repurpose** — audio is the hero; pick quotable moments; speaker video if it exists, else a simple audiogram / quote card; keep the visual system simple and repeatable; preserve attribution + CTA.
- **Screen-demo** — zoom only for legibility/orientation, steady while the viewer reads; reset to wide context between phases; ≤ 2 attention cues at once; label sped-up sections; keep UI text sharp (higher bitrate), don't force an unreadable vertical crop.
- **Localization** — treat each language as its own deliverable; dubbed audio won't match source timing, so plan holds to flex; re-render or cover any baked-in text per language; subtitle line lengths differ by language; lip-sync only where a close-up mouth mismatch would distract.
- **Documentary-montage** — concrete sensory shot descriptions, not abstract themes; one grade/LUT across all clips is what unifies mixed sources; budget 2–3 hero slots longer holds; a music bed + an end-tag.
- Before publishing, normalize the mix against the targets in video-craft §7 (~−14 LUFS integrated, true-peak ≤ ~−1 dBTP) with `ovs edit normalize-loudness`; use `ovs edit loudness` for diagnosis.

## Rules

- **Timecodes come from the user, from probe, from a transcript, or from on-screen text (OCR) — never guessed.** If the target moment can't be located deterministically (no timecode, no transcript/OCR match), ask the user for the timestamp.
- **Layer composition over footage when the brief needs designed elements** (animated lower-thirds, kinetic captions, hooks): produce those with `stage-compose` as an overlay/element and `ovs edit overlay` them, rather than trying to draw them in ffmpeg.
- **One output file** at the end; intermediate cuts live under `project/cuts/` and are not the deliverable.

## Boundary / non-goals

This skill does deterministic, timecode-driven editing only. It does not author HTML compositions (stage-compose), and does not generate footage (stage-generate).
