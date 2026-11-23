---
name: stage-edit
description: Work on real footage with ffmpeg: trim, join, reframe, mix, burn subtitles, overlay, extract frames.
---

# stage-edit

The user's footage stays untouched: every operation writes a new file. An uploaded clip arrives as an attachment marked `model_readable="false"`. That means it is not vision input, not that it is unusable. `ovs timeline import --production <folder> --inputs '["<file>"]'` copies it into the production's `media/` folder; use that copy from then on. Never ask the user to upload it again.

## Calling

```bash
ovs edit probe media/clip.mp4
ovs edit trim media/clip.mp4 --start 12 --duration 8 --out cuts/seg-1.mp4
ovs edit concat --inputs cuts/seg-1.mp4,cuts/seg-2.mp4 --out render/edited.mp4
ovs edit extract-frame media/clip.mp4 --at 3 --out frames/at-3s.png
ovs edit reframe media/clip.mp4 --aspect 9:16 --out render/clip-9x16.mp4
```

Other ops: `burnsubs` (`--srt x.srt`), `overlay`, `mix`, `loudness`, `normalize-loudness`, `trim-silence`, `remove-fillers`. Scripts return JSON; a non-zero exit means it failed. Use `ovs transcribe` for speech timing.

`reframe` writes the standard canvas for the aspect. `--mode pad` keeps the whole frame on bars, `blur` fills them with a blurred copy, `crop` cuts the edges (`--focus-x`/`--focus-y` choose what stays). Keep `pad` or `blur` when the frame carries text or a UI. To follow whoever is speaking, `--plan` crops on a different point per stretch (`[{"start": 0, "centre_x": 0.3}, …]`, fractions of the source); `ovs activity --regions` measures motion in a box around each mouth and returns turns and a ready plan. `ovs beats` lists a track's beats with their frames; on a cut video it also says how far each cut lands from its beat.

`concat` joins clips of different sizes and rates by moving them all onto the largest canvas and highest rate, adding silence to silent clips. So reframe first: a 9:16 clip joined to a 16:9 clip becomes a letterboxed box.

`ovs speech-capabilities` and `ovs narration fit` govern synthesis; follow [audio guidance](../video-studio/references/audio.md). Mark speech mixes with `--narration`.

`mix` lays narration or music over a clip (`--base <clip> --segments '[{"path": "voice/1.mp3", "start_sec": 0}, …]'`, each entry placed at its own start, in seconds). If the clip already has sound, pass `--on-existing-audio mix` to keep it or `--on-existing-audio replace` to drop it; `replace` over sound returns a `warning`, because it drops every line of dialogue with it. With `mix`, add `--duck` to lower the original sound only while the added sound plays, such as narration over a scene's ambience. Narration never plays over someone talking in the clip: delivery reports it. For fixed-picture dubbing, `--segments` entries may declare an `end_sec` as well as `start_sec`; all entries then need ordered picture windows. The script measures existing speech before mixing and refuses a line that exceeds its window without generating audio or shortening the picture. Before processing localization audio, read [localization guidance](references/transcript-and-screen-grounded-editing.md); it owns picture timing, reuse and bounded re-voicing.

`burnsubs` raises plain dialogue captions on vertical video so platform buttons do not cover them. This default is not a layout for independently placed text: simultaneous SRT cues can stack over the subject. Inspect source frames before choosing text positions. Honor requested placement; otherwise choose stable positions clear of other text and important faces, products, labels and controls. Check moving content across its relevant motion. Adjust text position, wrapping and readable size without changing the source framing to make room. An authored `.ass` keeps its own placement; designed text and price cards use the page render. When the picture already has captions burned in, as when making another language's version, `--cover '{"top":0.75,"bottom":0.9}'` (the old captions' band, as fractions of the height read off a frame) lays an opaque bar over them and puts the new captions on it.

When no op covers it (rotate, speed change, GIF), run the bundled `ffmpeg` from bash; use `OVS_FFMPEG_PATH` when the runtime is not on PATH. Write to a new file, pass `-nostdin`, bound every input, then `probe` and `extract-frame` to look at the result. Never draw words with `drawtext`: without the right font, Chinese comes out as empty boxes. Burn captions through `burnsubs`; other words on screen go through the page render.

## Which tool

- One step (trim 0:10–0:35, make it 9:16, compress): do it, then `ovs timeline ship` with a JSON `--expect` containing durationSec, aspect and audio.
- Finding what to keep (remove dead air, fillers or retakes, pick the best take, pick highlights, cut 40 minutes to 2): read `stage-decide` first, however short the clip.
- Designed text, price cards or motion: use the page render. For a long cut that needs only a designed title, render just the title with `ovs timeline render` and `concat` it on.
- Changing what is in the picture (remove a watermark, change a background): `ovs video` with an explicitly supported native edit mode, which costs credits, then use the result as an asset.

For anything you may adjust later, save your cut list as a small file in the production (`cuts.json`: source, in, out, why), so the next change redoes only what changed.

Add outputs you reuse in a timeline to `assets.json` with `origin: "edited"`.

## Rules

- **Probe before planning.** A trim past the real length makes a broken clip. A trim returns the cut's real `duration_sec`, and a `warning` when it is shorter than asked; plan with that length or cut again.
- **Timecodes come from the user, a probe, a transcript or a frame you looked at.** Never guess them. A frame proves only that moment.
- **Cut on sentence and word gaps.** For someone talking, keep picture and sound together.
- **If you cannot see it, do not describe it.** Say so instead.
- **Do not re-transcribe a source you already have a transcript for.** Read only the sentences you need from the saved file.
- **For subjective choices (which moment is best), make a first version and let the user react.** Name the choice in your reply.

## Craft

- Cut the moment, not the clip: a 12s clip usually holds one 3s moment. End on a held look, not on action moving off.
- At most 4 transition types in one piece; a hard cut is the default.
- Do not put the same subject at the same size back to back. If you cannot give a one-line reason for a cut, reconsider it.
- Bridge the hardest cuts with sound.
- Social clip: hook in the first 2 seconds, clean ending, one style across a batch.
- Podcast or interview: pick quotable moments; keep the picture simple and consistent.
- Screen demo: zoom only for legibility, label sped-up sections, keep UI text sharp. A tutorial from a recording follows [explainer guidance](../video-craft/references/explainer.md).
- Localization: each language is its own deliverable. Replace baked-in text.
- Normalize the mix before delivering (`ovs edit normalize-loudness`).

Screen-grounded narration, localization and topic-based selection: [references/transcript-and-screen-grounded-editing.md](references/transcript-and-screen-grounded-editing.md).
