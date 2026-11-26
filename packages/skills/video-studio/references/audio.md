# Sound

Use licensed music supplied by the user or otherwise available for this use. Record its source and license in `assets.json` and the delivery. No hosted music generation or separation is exposed by this build. Never fabricate a bed with code or test tones. If authorized narration can satisfy the brief without music, make that and disclose no music; otherwise explain the missing audio and obtain a specific alternative.

## Narration

Before synthesis follow [script timing](script-timing.md). `ovs speech-capabilities` lists the configured provider/model/voice and language constraints without secrets. Paid synthesis follows [generation authority](generation.md). Make one file per scene or fixed picture window with `ovs speak --text "Exact line" --out lamp-ad/voice/hook.mp3 `; pass the configured voice, model, language, format and speed explicitly when needed. Run `ovs narration fit` before and after synthesis. Register the returned file in `assets.json`, then reference its id in `narration.asset`. Lines for different scenes that do not depend on each other can be voiced at the same time, each with its own `--out` path; a line whose wording depends on another take's timing waits for that take's measured length.

For several lines in the same voice, keep the first fitting take. Use its measured
duration divided by its generic estimate as `--duration-scale`, when available.
Check only the remaining lines with
`ovs narration fit --lines '[{"text":"Exact line","target_duration":4}]'`.
It accepts up to 50 lines, reports estimated overruns by input index and sends
no synthesis request. Revise the flagged wording or timing within the brief,
then check the actual audio after synthesis.

After synthesis, `ovs narration fit --measured <seconds> --target <scene seconds>` with the line's text returns a `timingAction`; follow it. The scene must be at least as long as its audio. When the user did not ask for the video's length, make each scene its line plus about half a second, so no scene ends in silence. When the user did and a line comes out short, its `message` says how much to add: voice the longer line under a new file name and point its scene at it. Each fill is a paid synthesis within the approved request budget, at most two per line: pass `--fills <n>` with how many times the line was already filled, and once `fillLimitReached` is true keep the audio and let the scene finish early. `ovs timeline check` and `ovs timeline render` refuse a video that would go silent: in a narrated video, 3 s or more of consecutive scenes with no voiced line, kept clip sound or music under them; or narration text that was never voiced.

Receipt reuse requires the same text, route, voice, model, format, speed and unchanged output bytes. To change spoken words, produce only that line under a new filename and update its asset. Changing `narration.text` changes captions alone. Keep natural speed (no more than 1.15); shorten overlong text or adjust scene timing only within the user's constraints. Fixed-picture dubbing preserves the picture and line windows: [localization](../../stage-edit/references/transcript-and-screen-grounded-editing.md).

For a change to specific words, such as a price, start from the saved script and replace only those words. Use the original take's measured length as `--target` for `ovs narration fit` if known. If the new audio fits its original slot, keep it and leave the remaining time for the existing bed or pause, even if `ovs narration fit` suggests adding words. When the edited words are in a whole narration track, revoice that take with its saved voice and point the track at the new asset. If the last delivery was mixed outside the timeline, check its audio and the available source tracks before re-rendering so the sound the user wants to keep goes into the new delivery.

## Captions and footage

`captions.enabled` displays narration text sentence by sentence; it works without recorded speech. For long edits use measured word timing from `ovs transcribe`, then `ovs edit burnsubs`. Keep clip sound with `audio:"keep"`. Preserve speaking-mouth audio and add narration exactly once. With `ovs edit mix --narration --on-existing-audio mix --duck`, delivery can check recorded narration against source speech; missing or stale overlap evidence remains unknown.

Timeline preparation mixes declared tracks and normalizes them around −14 LUFS. For a standalone edited file run `ovs edit normalize-loudness` before `ovs timeline ship`; inspect reported loudness and silence warnings. Use current measurements on unchanged media; null or missing values are not a clean result. Numbers do not establish a natural-sounding fade or subjective audio quality.
