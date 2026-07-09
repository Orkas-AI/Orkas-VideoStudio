---
name: stage-decide
description: The decision layer for real footage — understand → select → produce an EVIDENCE-bearing rough cut. Trigger when the EDIT task is "find / select / reduce / clean" (remove dead air, drop fillers, pick highlights, cut 1 hour to 3 minutes), NOT executing a known timecode edit (that is stage-edit). Deterministic auto-cuts (silence/filler/quality) are reliable; narrative/emotional selection is a low-confidence DRAFT for the user to review.
---

# stage-decide

The hard, valuable part of editing real footage is not executing a cut you already chose — it is
**figuring out WHAT to cut**: understanding opaque raw material, removing its intrinsic defects
(dead air, fillers, weak takes), and reducing it without losing the point. This skill is the
"understand → decide" layer; `stage-edit` executes the cuts you land on.

Describe what to produce; the operations run through the CLI (or the equivalent MCP tool):
`ovs edit trim-silence` / `ovs edit remove-fillers` (deterministic auto-cuts that return evidence),
`ovs scenes` (cut candidates), `ovs quality` (blur/exposure/black/freeze flags), `ovs transcribe --out`
(word timings saved as JSON), `ovs silence`.

## Use this when

The user supplies real footage AND the work is to **select or clean**, not to run a known edit:
"cut this 40-min recording to a 2-min highlight", "remove the ums and dead air", "make 3 clips from
this podcast", "tighten this talking-head". If they already gave you timecodes ("trim 0:10–0:35"),
skip this — that is plain `stage-edit`.

## Method

1. **Understand the material first** (never decide against footage you have not measured):
   - `ovs edit probe` for duration/resolution.
   - Spoken footage → `ovs transcribe raw/clip.mp4 --out project/transcripts/clip.json` (word-level timings) so you cut on sentence/word boundaries, never mid-word.
   - Visual reduction → `ovs scenes` for shot boundaries; bound the moments you keep on these candidates.
   - Dead air → `ovs silence` to see the gaps.
2. **Decide — deterministic first, judgment second:**
   - **Cleaning is mechanical** — use the auto-cuts: `ovs edit trim-silence` (drop dead air),
     `ovs edit remove-fillers` (transcribe → drop um/uh). They are reliable and return the spans they removed.
   - **Build a candidate pool first** — turn the signals into a structured list of selectable pieces:
     each transcript sentence (spoken footage) or scene segment (visual footage), annotated with its
     timecode, duration, and quality flags/score. Select FROM this list — do not eyeball raw footage.
   - **Selection is judgment** — when picking highlights / reducing length, ground EACH kept span on a
     measured signal (a scene boundary, a transcript sentence, a scored moment). Keep whole sentences;
     pad cuts so they are not jarring; for a talking-head the jump-cut keeps audio and video in sync —
     do not desync the lips.
   - **Best take among repeats** — when the same line was recorded several times, do NOT guess: write a
     `takes.json` (`[{id, text=the take's transcript, quality_score from `ovs quality`, duration_sec}]`)
     and run `ovs plan rank-takes takes.json`. It groups the repeats and tells you which to KEEP (best
     quality) and which to drop. Choosing what to keep across DIFFERENT moments is still your judgment;
     this only resolves "which of these identical takes".
   - **Quality triage** — `ovs quality` flags bad shots (blurry / too dark / over-exposed / black /
     frozen). Drop or avoid flagged spans; blur is content-relative (compare, do not threshold blindly),
     dark / black / freeze are absolute defects.
   - **Visual / silent footage (no speech)** — the content is in the PICTURE, so transcript is empty.
     Sample frames at candidate moments with `ovs edit extract-frame` and JUDGE THEM YOURSELF if you can
     see images (you are the vision — no separate vision model). If you CANNOT see images, ground on
     `ovs scenes` + `ovs quality` only and mark every visual judgment UNVERIFIED, or ask the user which
     moments matter — NEVER invent what is on screen, and never escalate to a separate vision model.
3. **Record evidence — make every cut auditable.** For each kept/cut segment in `plan.json`, set
   `reason` (why this moment), `confidence`, and `evidence` (the auto-cut tools return removed/kept
   spans; for your own selections, cite the signal). This is the whole point — not a black box.
4. **Produce** the tightened clip (the auto-cut tools output it directly; for selection, trim the kept
   spans and concat per `stage-edit`).

## Honest ceiling — present a DRAFT, let the user decide

- **High confidence (ship it):** silence/filler removal, transcript-driven sentence selection, quality
  filtering. These are deterministic and proven.
- **Low confidence (mark it, never claim it is "right"):** narrative arc, emotional beats, comedic
  timing, "does this cut FEEL right". These are subjective with no ground truth. Offer the rough cut as
  a first pass, flag the low-confidence calls, and invite the user to adjust at the draft gate.

Never over-claim. An evidence-backed rough cut the user can audit and tweak beats a confident black box.
