## Narration / Audio Track

**WHO OWNS NARRATION -- decide this first:**

- **Standalone COMPOSE deliverable** (the composition IS the finished video, no assemble step): embed the narration as an `<audio>` track here; the renderer muxes it. Single add -- correct.
- **Composition is a SEGMENT in an AUTO/assemble pipeline** (the assembler will mix narration in its mix tier -- `stage-assemble` step 3): render this composition **SILENT -- do NOT add a narration `<audio>` track**. If you bake narration in here AND the assembler mixes it, narration is added twice and you get two overlapping, drifting voices. The mix step refuses a non-silent base by default to catch this.

To give a STANDALONE explainer a voiceover: synthesize the narration to an audio file with `ovs speak`, then add it as an **audio track** in the composition. The renderer muxes audio tracks into the output.

```html
<audio id="narration" src="./assets/narration.mp3"
       data-start="0" data-duration="60" data-track-index="0" data-volume="1"></audio>
```

- Declare audio in the manifest; reconcile generates the direct-child `<audio>` element. Its duration, the root duration, and the final scene end must agree with the approved delivery timeline.
- Before the first TTS call, estimate the script length from `video-craft` cadence (~150-160 wpm for explainers) and trim the text to the approved target duration. Do not synthesize multiple full versions just to discover timing. One full TTS pass plus at most one shortened retry is the limit.
- After the one successful synthesis, probe the produced file (`ovs edit probe project/composition/assets/narration.mp3`). If it differs from the estimate, keep the audio, retime manifest scene windows only within the approved delivery duration, update the narration track duration, then reconcile. Do **not** synthesize another full version merely to chase the original estimate.
- If an exact fixed duration was an explicit user constraint and the measured audio cannot be accommodated, stop and ask before another paid synthesis. Otherwise prefer the measured audio duration. This rule is for standalone COMPOSE; EDIT/AUTO may have supplied footage as the master timeline.
- If `ovs speak` fails, never silently continue: tell the user, then either fix and retry the narration or explicitly proceed silent with that stated at the gate.
- Use a project path such as `project/composition/assets/narration.mp3` so the composition stays self-contained.
- For background music plus voiceover, use two `<audio>` tracks with different `data-track-index` and lower the music `data-volume` (e.g. 0.2).
- **Talking-head caveat:** when this composition is being overlaid onto AI-generated talking-head footage that already has lip-synced built-in speech, do NOT add a narration `<audio>` track.
