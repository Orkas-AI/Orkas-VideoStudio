# Transcript and screen-grounded editing

Use this reference only for topic-based highlight selection, automatic
captions, localization/dubbing, or narration added to existing footage.

## Transcription-driven selection and localization

When the user wants highlights or clips "about X", automatic captions, or a
localized version, transcribe first with `ovs transcribe` with word timestamps:

- **Highlight / clip selection:** read the transcript, choose the time ranges
  whose words match the requested topic or moment, and use those `start` and
  `duration` values in your cut list. The timecodes must be evidence-based, not
  guessed.
- **Auto-captions:** make the `.srt` from a transcript of the finished cut, not of the source: every cut
  moves the times after it. First correct misheard names, numbers and product words against the script
  or the product facts (one test heard 户眼 for 护眼 and 无极 for 无级). With neither, correct what the
  sentence around a word makes plain (坑 heard as 康) and keep the rest as heard; do not stop to ask the
  user for a script. Break captions at punctuation or a pause. Then use `burnsubs`.
- **Localization / dubbing:** keep the original picture and timing unless the
  user asks for a recut. Map each complete utterance to one row of the existing
  dub. Run `ovs edit mix --fit-dub --on-existing-audio replace` first. The mix can
  fit existing lines into adjoining measured pauses and aligns the last line
  within the original speech end and its picture window. Use the resulting file
  when it fits. When `dub_fit_issues` identifies a line, check that line's audio
  and window. Re-voice only a missing, incorrect or confirmed overlong line, once
  within existing authority. Keep the other lines and the same picture.

  Each `--segments` row has `path`, `start_sec`, `end_sec` and `caption`.
  Start and end are the picture window in seconds. To reuse timed lines from
  one voice file, supply both `source_start` and `source_end` in that file's
  seconds. The command mixes each line and burns its caption where speech plays.
  For an existing burned caption, extract a full frame where it is visible and
  measure the top and bottom of the band as fractions of frame height. Pass
  `--cover '{"top":0.75,"bottom":0.9}'` with those measurements and examine the
  same moment in the output. Correct the band on the original picture if needed.
  Verify the delivered picture duration against the original, and preserve
  numbers and currency, for example “199 yuan” for “199 元”.

## Ground narration on on-screen text

Adding narration to an existing video goes in this order. Do not synthesize one narration blob and describe it afterward.

1. **Analyze the video first.** Probe duration and audio presence. For spoken
   audio, run `ovs transcribe`. For title cards,
   slideshows, screen recordings, or other on-screen content, use
   `ovs edit extract-frame` and inspect the returned files
   with the current model. Follow the frame-evidence rules below.
2. **Write one line per on-screen beat**, each with its start and target length,
   derived from what you observed. Save them in a small file in the production.
   Keep each line separate so a follow-up can re-voice one line.
3. **Generate them.** For several lines to synthesize in the same voice, follow [fixed-picture synthesis](#fixed-picture-synthesis). Run `ovs speak` once per line, after `ovs narration fit --target <seconds>`.
   If one line does not fit naturally, shorten it and retry once. Coverage should
   span the clip rather than stop midway.
4. **Assemble without changing the picture.** Place every line at its start in one
   `ovs edit mix` call via `--segments`, then run
   `ovs edit normalize-loudness`. Use `--on-existing-audio mix` to retain source
   sound or `replace` to drop it. Burn captions separately when wanted.
5. **Deliver** with `ovs timeline ship`, passing `--expect '{"audio":true}'`.

If the clip has no spoken audio, or meaning lives in on-screen text, an empty
transcript does not mean an empty screen. Resolve evidence in this order:

1. Extract a small set of frames spanning the whole clip, then inspect them
   with `read_files` using the current model's vision. Record each frame path,
   extraction time, readable text and uncertainty. Add nearby frames only where
   needed to locate a change or resolve unclear content; a sample is not an
   exact transition boundary. Align each narration line to observed evidence.
2. If the current model cannot read images, ask for readable text with timing
   or a vision-capable model. Do not invent on-screen content, install a local
   recognition engine, or escalate to a separate paid vision model.

Before the draft, confirm every narration segment matches the observed-frame or transcript
evidence in its time window.

## Fixed-picture synthesis

Keep existing takes that fit and preserve the start and end of each picture
window. Use a matching voice pace measured from a saved take when available.
Check remaining lines with `ovs narration fit --lines` as described in
[audio guidance](../../video-studio/references/audio.md). Shorten the flagged
lines only when the wording may change. Surface unresolved verbatim timing
conflicts as estimated or measured. Verify the actual audio in the mix, and
re-voice an overrun once within existing authority.
