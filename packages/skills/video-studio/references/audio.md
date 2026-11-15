# Sound

Use licensed music supplied by the user or otherwise available for this use. Record its source and license in `assets.json` and the delivery. No hosted music generation or separation is exposed by this build. Never fabricate a bed with code or test tones. If authorized narration can satisfy the brief without music, make that and disclose no music; otherwise explain the missing audio and obtain a specific alternative.

## Narration

Before synthesis follow [script timing](script-timing.md). `ovs speech-capabilities` lists the configured provider/model/voice and language constraints without secrets. Paid synthesis follows [generation authority](generation.md). Make one file per scene or fixed picture window with `ovs speak --text "Exact line" --out lamp-ad/voice/hook.mp3 `; pass the configured voice, model, language, format and speed explicitly when needed. Run `ovs narration fit` before and after synthesis. Register the returned file in `assets.json`, then reference its id in `narration.asset`.

Receipt reuse requires the same text, route, voice, model, format, speed and unchanged output bytes. To change spoken words, produce only that line under a new filename and update its asset. Changing `narration.text` changes captions alone. Keep natural speed (no more than 1.15); shorten overlong text or adjust scene timing only within the user's constraints. Fixed-picture dubbing preserves the picture and line windows: [localization](../../stage-edit/references/transcript-and-screen-grounded-editing.md).

## Captions and footage

`captions.enabled` displays narration text sentence by sentence; it works without recorded speech. For long edits use measured word timing from `ovs transcribe`, then `ovs edit burnsubs`. Keep clip sound with `audio:"keep"`. Preserve speaking-mouth audio and add narration exactly once. With `ovs edit mix --narration --on-existing-audio mix --duck`, delivery can check recorded narration against source speech; missing or stale overlap evidence remains unknown.

Timeline preparation mixes declared tracks and normalizes them around −14 LUFS. For a standalone edited file run `ovs edit normalize-loudness` before `ovs timeline ship`; inspect reported loudness and silence warnings. Use current measurements on unchanged media; null or missing values are not a clean result. Numbers do not establish a natural-sounding fade or subjective audio quality.
