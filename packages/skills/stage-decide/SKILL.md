---
name: stage-decide
description: "EDIT with content judgment: pick highlights, remove dead air or fillers, shorten recordings into a reviewable rough cut."
---

# stage-decide

The hard, valuable part of editing real footage is not executing a cut you already chose — it is
**figuring out WHAT to cut**: understanding opaque raw material, removing its intrinsic defects
(dead air, fillers, weak takes), and reducing it without losing the point. This skill is the
"understand → decide" layer; `stage-edit` executes the cuts you land on.

Use the portable operations:
`ovs edit trim-silence` / `ovs edit remove-fillers` (deterministic auto-cuts that return evidence),
`ovs scenes` (cut candidates), `ovs quality` (blur/exposure/black/freeze flags),
`ovs transcribe` for transcription (its result opens with the phrase view),
`ovs phrases` for the same view of a transcript you already have, and
`ovs silence`.

## Use this when

The user supplies real footage AND the work is to **select or clean**, not to run a known edit:
"cut this 40-min recording to a 2-min highlight", "remove the ums and dead air", "make 3 clips from
this podcast", "tighten this talking-head". If they already gave you timecodes ("trim 0:10–0:35"),
skip this — that is plain `stage-edit`. For short clips cut from a long recording (切片, highlights for
social), also read [references/clips.md](references/clips.md).

## Method

1. **Understand the material first** (never decide against footage you have not measured):
   - `probe` for duration/resolution.
   - Spoken footage → use `ovs transcribe` with word timestamps and cut on the
     times in the measured view from `ovs phrases`: one line per phrase, split at the pauses measured in the
     recording, with shorter pauses marked like `(0.31s)`. Speech recognition folds short pauses into the words
     around them, so the transcript's own word and sentence times hide most cut points. A long view is cut short
     there; make the whole one with `ovs phrases <media> --transcript <json> --out <phrases.json>`.
   - Visual reduction → `scenes` for shot boundaries; bound the moments you keep on these candidates.
   - Dead air → `silence` to see the gaps.
2. **Decide — deterministic first, judgment second:**
   - **Cleaning is mechanical** — use the auto-cuts: `trim-silence` (drop dead air), `remove-fillers`
     (transcribe → drop um/uh by default). For Chinese or another language, pass the fillers the
     transcript actually contains (`--fillers 嗯,呃`); speech recognition often leaves fillers out, so
     read the transcript first. Both return the spans they removed.
   - **Build a candidate pool first** — turn the signals into a structured list of selectable pieces:
     each transcript sentence (spoken footage) or scene segment (visual footage), annotated with its
     timecode, duration, and quality flags/score. Select FROM this list — do not eyeball raw footage.
   - **Selection is judgment** — when picking highlights / reducing length, ground EACH kept span on a
     measured signal (a scene boundary, a transcript sentence, a scored moment). Keep whole sentences;
     pad cuts so they are not jarring; for a talking-head the jump-cut keeps audio and video in sync —
     do not desync the lips.
   - **Cut in a pause.** One of 0.4s or more is a clean cut. Between 0.15s and 0.4s, look at the frames on
     both sides first. Inside a phrase with no marked pause, do not cut.
   - **Best take among repeats** — make one candidate per measured phrase before choosing a span; do not
     keep a broad interval that contains both a false start and its complete retake. Compare neighbouring
     phrases for the same beat: an unfinished start followed by a complete version, or a correction that
     replaces an earlier mistaken take. Pauses, repeated words and fillers are candidate signals, not
     deletion rules. Preserve intentional emphasis, meaningful pauses and corrections the user wants kept.
     Judge wording in context because recognition can move a word across a pause; cut at measured phrase
     edges, not at that word's reported timestamp. Keep the complete supported take for each beat; use
     `quality` only to break a tie on the picture. Keep uncertain material rather than deleting by a
     keyword, and record the uncertainty in the cut list.
   - A selection row with `review` is a short isolated sound without aligned words.
     When it matters to the cleanup, trim the indicated range from the source
     and transcribe it once in the source language. Choose that row's ID
     explicitly; retain meaningful or uncertain sound.
   - **Keep the reaction.** After a punchline, a reveal or an answer, hold through the laugh, smile or nod
     before cutting; it is part of the beat.
   - **Fit the length.** Add up the kept spans against the target. If over, drop the weakest beat rather
     than shaving every one.
   - **Quality triage** — `quality` flags bad shots (blurry / too dark / over-exposed / black / frozen).
     Drop or avoid flagged spans; blur is content-relative (compare, do not threshold blindly), dark /
     black / freeze are absolute defects.
   - **Visual / silent footage (no speech)** — the content is in the PICTURE, so transcript is empty.
     Sample frames at candidate moments with `ovs edit extract-frame` and JUDGE THEM YOURSELF if
     you can see images (you are the vision — no separate vision model). If you CANNOT see images, ground
     on `scenes` + `quality` only and mark every visual judgment UNVERIFIED, or ask the user which moments
     matter — NEVER invent what is on screen, and never escalate to a separate billable vision model.
3. **Keep and execute a cut list.** For retake cleanup, run `ovs edit select
   --input <source> --transcript <saved-word-transcript>` to list measured candidate
   IDs and a `selection_id`. Save chosen IDs, reasons and uncertainty in `cuts.json`.
   Execute those choices with the same command plus `--keep '[1,3]' --selection-id
   <returned-id> --out <new-file>`, rather than retyping cut times. The script
   rechecks the inputs, keeps whole selected phrases and pauses between adjacent
   selected phrases, and writes the actual frame-aligned intervals beside the
   output as `.selection.json`. Keeping all IDs preserves the source unchanged.
   Keep uncertain candidates; this executor does not decide which speech is bad.
   User-supplied timecodes and other edits still use `stage-edit` normally.
4. **Mark what is judgment.** Silence and filler removal are measured; which moment is best is your call. Say which is which in your reply.
5. **Produce** the tightened clip (the auto-cut tools output it directly; for selection, trim the kept
   spans and concat per `stage-edit`).
6. **Check the cut, not the sources.** Extract a frame just before and just after each join and look for
   a jump or a flash; look at the first and last 2 seconds too. Transcribe the cut once and compare it with
   the selected candidates: required meaning and complete words remain, and the rejected false starts
   are gone. A shorter duration alone does not prove a clean edit. Captions must come from this transcript,
   because every cut moves the times after it. Reuse the saved source transcript rather than transcribing
   it again. You cannot listen; if a join depends on how it sounds, say so.

## Honest ceiling — present a DRAFT, let the user decide

- **High confidence (ship it):** silence/filler removal, transcript-driven sentence selection, quality
  filtering. These are deterministic and proven.
- **Low confidence (mark it, never claim it is "right"):** narrative arc, emotional beats, comedic
  timing, "does this cut FEEL right". These are subjective with no ground truth. Offer the rough cut as
  a first pass, flag the low-confidence calls, and invite the user to adjust it.

Never over-claim. An evidence-backed rough cut the user can audit and tweak beats a confident black box.
