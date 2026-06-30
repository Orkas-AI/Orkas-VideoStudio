---
name: orchestration
description: The master program for producing or editing a video end to end — read this at the START of any video task (after video-router), then follow the gates and the per-line steps. Trigger for "make / edit / cut / caption / dub / animate a video"; it sequences the compose / generate / edit lines and the approval gates. Do NOT trigger for a single low-level operation (just transcribe a file, just probe a clip) — call that operation directly.
---

# orchestration

You are producing a short video. Run this as a TIGHT program — lean turns — but STOP at every GATE so the creative decisions stay the user's. Only the technical/assembly steps between gates run unattended. The CLI surface is `ovs ...` (an MCP server mirrors it 1:1; use whichever your host exposes). All work for one deliverable lives under a single project dir, e.g. `project/`.

## Checkpoint protocol — how every GATE works (there is no special form UI)

1. **Show the artifact in chat** so the user can actually see it — script/plan as markdown, images inline, a draft video as its output file path — plus one line of "what I'll do next" and any cost/QA note.
2. **State the options** for that gate and **WAIT for the user to reply**. Do not run the next production step in the same turn as the gate.
3. **On reply, apply the choice**: approve → continue; revise → redo ONLY that artifact with the feedback, re-show, re-gate; abort → stop. Never pass a gate without an explicit user confirmation. Keep gate messages short — the artifact is the message.

## 1. Route + lock (read `video-router`)

Classify and LOCK the line (no silent switching):
- **COMPOSE** — explain / teach / animate / motion-graphics / kinetic text, no source footage → `ovs render` (+ optional `ovs image` / `ovs video` imagery, optional `ovs speak` narration).
- **GENERATE** — "footage of / a scene of / cinematic / a presenter or avatar speaking / talking-head" → AI footage via `ovs video` (+ `ovs image` for the subject, `ovs speak` for voice), assembled with `ovs edit`.
- **EDIT** — the user supplied real clips to cut / join / subtitle / localize → `ovs edit` (+ `ovs transcribe` for transcript-driven work).
- **AUTO (end-to-end)** — the deliverable spans MORE THAN ONE axis. Run the cross-modal orchestration (read `stage-plan`, then `stage-assemble`); the lock is the plan's `delivery_promise`.

## 2. GATE A — Proposal (all lines)

Show: the brief you inferred (line, aspect, duration, language) for the user to correct, plus 1–3 differentiated concepts (each: hook + look + rough length; for GENERATE add the shot count and that each clip is a billable call; for AUTO also state the proposed delivery promise — source_led / motion_led / compose_led / hybrid — and the rough segment mix). Options: pick a concept / adjust the brief / new direction. STOP.

## 2.5 Craft standard (ALL lines — read `video-craft`)

Before scripting / storyboarding / composing / generating, hold the output to `video-craft`: a hook in the first seconds, one idea per beat, readable type inside safe zones, restrained easing, muted-friendly captions, ducked audio, the right aspect for the platform. Bake these into the script/shotlist/composition — don't leave them to chance.

## 2.6 Narration voice

When the piece has a voiceover, pick a voice id from **your configured TTS provider** (`ovs speak` uses it). If the user names or describes a voice, map it to the closest id your provider offers; if nothing fits, ask the user for a voice id rather than guessing. If no TTS provider is configured or `ovs speak` errors, DEGRADE GRACEFULLY: tell the user narration needs a TTS provider and either proceed silent or fall back to a basic system voice — never silently pass a fallback off as the chosen voice, and never let "no provider" mean "no narration at all" without saying so.

TALKING-HEAD note: if a GENERATE clip already returned lip-synced built-in speech, THAT is the voice — do NOT synthesize a narration over it (a fresh TTS track desyncs from the mouth). Use `ovs speak` only for a silent clip, or for COMPOSE / EDIT / off-screen voiceover.

---

## COMPOSE line

3C. Script + storyboard (ONE step) → `project/script.md` + `project/shotlist.json`.
4C. **GATE B** — Script + storyboard sign-off. Show `script.md` + a shotlist summary. Options: approve / revise / change direction. STOP.
5C. (optional) Narration: `ovs speak` → `project/assets/narration.mp3`, add as an `<audio>` track (see `stage-compose`). For a STANDALONE compose deliverable only; in the AUTO line the assembler mixes narration and compose segments render SILENT.
6C. (optional) Visual assets via `ovs image` / `ovs video` → `project/assets/`. Skip for pure typographic explainers. **If any asset is billable: GATE C first** — state the count + that they're billable; options approve & generate / adjust / skip. STOP, then generate.
7C. Compose (`stage-compose`) → `project/composition/index.html`.
8C. QA: `ovs inspect project/composition` → fix issues, inspect again (cap ONE fix pass).
9C. **GATE D** — Draft review. `ovs render project/composition --out project/render/draft.mp4 --quality draft` → show the draft path + the inspect/craft findings. Options: approve → render high / revise. STOP, then render ONCE at `--quality high` → `project/render/video.mp4`.

## GENERATE line (follow `stage-generate`; for recurring characters / a story, ALSO `stage-consistency`)

3G. Plan shots → `project/shotlist.json` (each: prompt, motion, duration, which characters are visible + camera angle). Keep the count tight (cost). For a STORY / long script: first build the global character bible + scene plan per `stage-consistency`.
4G. **GATE B** — Script + shotlist sign-off. Options: approve / revise / change direction. STOP.
5G. Character anchors (talking-head / any recurring character) — per `stage-consistency`: generate ONE locked front portrait per character with `ovs image` → `project/characters/` (or, for a cameo, use the user-uploaded photo AS the front portrait); record in `project/characters/bible.json`. NEVER regenerate a locked portrait.
6G. **GATE C** — Pre-generation confirm. State "N shots + M portraits ≈ X billable generations"; show the locked portrait(s) for approval. Options: approve & generate / adjust portrait / reduce scope. STOP.
7G. Generate each shot — per `stage-consistency`: pick references (angle-matched portrait of each visible character + the most recent prior frame), write an explicit ref→element prompt, `ovs video` image-to-video → `project/assets/shot-N.mp4` (KEEP the clip's built-in lip-synced audio; call `ovs speak` ONLY when the clip came back silent). After each shot, `ovs edit extract-frame` its last frame → `project/frames/` to carry forward.
8G. Assemble: `ovs edit concat` the shots → `project/render/draft.mp4`; add captions/lower-thirds via a small composition (`stage-compose`) + `ovs edit overlay` / `ovs edit burnsubs`. Captions/overlays are VISUAL-ONLY — preserve each clip's built-in audio through assembly.
9G. **GATE D** — Draft review. Show the assembled draft + craft findings. Options: approve / revise. STOP, then finalize → `project/render/video.mp4` (carry talking-head audio through UNCHANGED; captions/loudness only).

## EDIT line (read `stage-edit`)

3E. Ingest — `ovs edit probe` each clip for durations/resolution.
4E. Plan → `project/plan.json` (the segments EDL + a `tracks.narration` track of timed lines, so each narration line / caption stays separately re-editable). GROUND the plan on the clip's ACTUAL content BEFORE writing any narration:
   - spoken audio → `ovs transcribe` (model `large-v3` for non-English), pick timecodes from the transcript.
   - SILENT / screen-recording / slideshow → `ovs ocr` for per-timecode on-screen text, then write each narration segment to match the slide in its window. Do NOT narrate from prior knowledge of the topic.
   - If OCR errors and you can read images yourself, `ovs edit extract-frame` across the clip and read them; otherwise STOP and ask the user for the on-screen beats. Never invent narration.
5E. **GATE B** — Edit plan sign-off. Show the plan (segments / order / subtitles / localization; for highlights, the chosen moments + timecodes). Options: approve / revise / change selection. STOP.
6E. Execute: `ovs edit trim` → `project/cuts/`; `ovs edit concat` → `project/render/draft.mp4`; optional `burnsubs` / `overlay`. Adding narration to footage that ALREADY has audio: `ovs edit mix` — choose on purpose: keep the original under the voice (`--on-existing-audio mix`) or drop it (`--on-existing-audio replace`). It rejects by default when the base already has audio, so decide explicitly. Localization/dubbing: transcribe → translate → `ovs speak` → `ovs edit mix --on-existing-audio replace` + burn captions.
7E. **GATE D** — Draft review. Show the edited draft + the loudness check (`ovs edit loudness` vs ~−14 LUFS / −1 dBTP). Options: approve / revise. STOP, then finalize → `project/render/edited.mp4`.

## AUTO end-to-end line (read `stage-plan`, then `stage-assemble`)

Ingest every supplied clip from evidence (probe + transcribe/ocr/extract-frame), author ONE cross-modal `project/plan.json`, `ovs plan validate` and fix every error, **GATE B** on the timeline (`ovs plan summarize`), **GATE C** only if the plan has billable `generate` segments, then assemble per `stage-assemble` (produce each segment via its line, mix narration ONCE, music ducked, burnsubs, loudness ~−14 LUFS). At **GATE D** run `ovs plan promise-check` (a deterministic source/slideshow guard — a fail BLOCKS delivery) plus a draft review, then finalize.

---

## plan.json as the editable record (all lines) — keep follow-up edits cheap

Once a draft exists, keep `project/plan.json` faithful so a later tweak only re-touches one piece (never the whole video): (1) every produced segment carries its real output under `produced_path` + `status:"done"`; (2) narration is `tracks.narration` whose lines each carry their own `produced_path`, so one line can be re-voiced alone; (3) captions are DATA in `tracks.captions.lines` ({text, start_sec, target_sec}) — NOT burned into the picture — so a typo is a one-line edit re-burned at assemble; (4) set top-level `"draft": "render/draft.mp4"`.

**Local follow-up edits — make the minimal targeted change; never redo the whole video.** Once a `plan.json` is present and the user asks to change ONE local thing (a segment's narration / caption / text, a trim, volume / speed, a single shot swap), edit ONLY the matching entry in `plan.json` and re-produce ONLY what it touched (`ovs speak` for that one line, `ovs render` for that one compose segment, or `ovs edit` for that one cut), then re-assemble. Do NOT re-author the whole EDL and do NOT regenerate a segment whose `status` is `done` that the user did not touch. Fall back to a full re-plan only when the request genuinely restructures the timeline.

## Deliver (all lines)

Run the `video-craft` pre-publish review on the FINAL file (readable / timed / on-message / consistent / audio [talking-head: confirm the built-in lip-synced voice is intact] / platform; fix any blocker first). Present the final output file path + a one-line summary. End the turn.
