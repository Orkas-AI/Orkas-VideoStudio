---
name: video-studio
description: Make a whole video from one request: gather material, produce, check and deliver. Read first for a new video or script request.
---

# video-studio

Resolve the requested endpoint before making anything.

## Script or storyboard only

Read the supplied material and [video-craft](../video-craft/SKILL.md), choosing the matching reference: [marketing](../video-craft/references/marketing.md), [ecommerce](../video-craft/references/ecommerce.md), [short film](../video-craft/references/short-film.md), [presenter](../video-craft/references/presenter.md), [music cut](../video-craft/references/music-cut.md), [clips](../stage-decide/references/clips.md), [explainer](../video-craft/references/explainer.md) or [commentary](../video-craft/references/commentary.md). Check exact spoken lines with [script timing](references/script-timing.md), source facts and the brief. Deliver the requested document. Do not generate media or render for a document-only request.

## Finished video

Work through to one finished, postable file. Do not present a plan or preview for approval unless requested: the user reacts to the finished video, and changing a short one is cheap. A finished video over about 2 minutes is the exception, whether you make it or edit the user's footage: first finish one representative part of 30 to 60 seconds with everything the whole will have (look, captions, music, inserted pictures, pace), ship it, say in one line how the rest follows, and make the whole once the user agrees. If it must follow a script you write word for word, show that script first instead. A script the user gave is theirs: make it as written, without showing it back. Internal checks and sampled frames still apply.

Find what can be found before asking. Choose length (15–30 seconds for an ad), shape (9:16 for short social video), look, pacing and the user's language when unspecified. Ask only for user-owned missing facts: at most four questions together, with recommended answers. The words spoken in a recording are not such a fact: caption them from the transcript, which is not inventing them, and name in your reply any you were unsure of. Otherwise proceed and disclose material assumptions.

## Material

Choose a short production folder, such as `lamp-ad`. Import attachments first with `ovs timeline import --production lamp-ad --inputs '<JSON array of paths>'`; use its local copies and asset ids. Keep `assets.json`, sourced facts in `product.json`, `media/`, and `videos/main/{manifest.json,index.html}` there. For reference-led work load [design-system-importer](../design-system-importer/SKILL.md). Use the host browser to capture real product pages; never fabricate UI or claims.

When the request works on the user's own footage, such as a video they say they uploaded to cut, adapt or subtitle, and no video came with it, ask for it before doing anything else: say in one sentence that the footage did not arrive and ask them to add it again. Do not write the script, record narration or test the edit on stand-in footage while you wait.

For every product shot, decide whether existing material actually shows the required action. Reuse suitable footage. Missing product action may need 1–2 generated shots under [generation authority](references/generation.md). A zoom on a still does not replace required motion. Use [product fidelity](references/product-fidelity.md) and [image preparation](references/image-preparation.md) for stills.

After declined, unavailable or exhausted generation, continue only if existing material satisfies the shots or the user accepts a specific alternative. Otherwise explain the missing action, retained work and alternatives before making a substitute. Keep declined spending authority revoked for that request.

## Make

Use [stage-edit](../stage-edit/SKILL.md) for cuts, joins, reframing, mixing and plain subtitles; [stage-decide](../stage-decide/SKILL.md) for selecting what to keep. For designed text, price cards and motion use the [timeline and page](references/timeline.md), with [frontend-design](../frontend-design/SKILL.md) for the look. Combine both freely. Put editable words in `data-slot` elements and keep scene motion independent.

For sound load [audio](references/audio.md). An ad needs sound unless the user chose silence; use available licensed music or authorized narration. Caption text alone is not recorded speech. Never synthesize music from test tones.

## Check and deliver

These checks read a page timeline; a video made only with `ovs edit` or ffmpeg skips them and goes straight to delivery. Run `ovs timeline check` and `ovs timeline snapshot` for the current production. Inspect the complete returned frame set against the brief and the relevant craft review; a contact sheet is an index. Fix confirmed problems in a batch before `ovs timeline render`. Missing or stale visual evidence remains unknown. HyperFrames owns capture and rendering; do not introduce another renderer or imperative media playback.

Ship the exact path that `ovs timeline render` or `ovs edit` returned (when resuming, the verified path of the existing file): `ovs timeline ship --production lamp-ad --video-id main --input lamp-ad/render/main.mp4` for a timeline. For a standalone edited file omit `--video-id` and supply `--expect` with `aspect` and `audio`. Inspect frames from the actual final MP4 with `ovs edit extract-frame`, including opening, every scene, joins and ending. Technical success does not certify visual quality. Ship keeps immutable versions and rejects stale timeline renders.

Pass the user's requested length if known for either path, as `durationSec` in `--expect`; a difference is a warning, not a blocker. Use the brief and revisions to decide whether to keep or recut an off-target version. If you keep it, explain the length choice.

Repair other unmet requirements within available authority, verify the changed output and ship again. If input, authority or runtime prevents completion, report incomplete work, the specific unmet requirement, retained files and what enables continuation. Do not present a broken output as finished or convert findings into an unsolicited enhancement list. An error from your own call is not a blocker: a path that does not exist, JSON that does not parse, an unknown command or option, or a page-timeline command on a video made only with ffmpeg. Read the message, correct the call and carry on. Neither is work still to do: when the next step is one you can take with your tools, such as cutting more footage, voicing the narration or writing the timeline, take it now instead of replying with it.

Lead the final reply in the user's language with the video link, then briefly state choices, assumptions, accepted deviations, retained advisories and known provider costs. Name only changes the final frames show; a change you cannot see there did not reach the video. Keep command names and internal codes out of ordinary delivery prose.

## Revise

Change only what was asked at the cheapest level: edit words/cuts/order/music/captions locally; re-voice only a changed spoken line; regenerate only a wrong shot under existing spending authority. Changing caption text does not change spoken audio. Preserve prior delivered versions. Give parallel ratio/language/test variants distinct video ids sharing assets. Reuse current evidence for unchanged bytes, and never repeat an unknown paid request automatically.
