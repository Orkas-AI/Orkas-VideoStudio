# Opt-in model evaluation

Run the public production cases with an authenticated Codex CLI from the root of a built checkout.

```bash
pnpm eval:video --list
pnpm eval:video --case all --prepare
pnpm eval:video --case all
pnpm eval:video --case retake-cleanup
pnpm eval:video --case beat-montage --case clip-montage --case revision-journey
pnpm eval:video --case retake-preservation --case talking-head --case local-path
```

The default model is `gpt-6-luna`. Use `--model <id>` if your Codex account exposes
a different model. The runner needs a POSIX host, FFmpeg/ffprobe and the regular
OVS rendering prerequisites. `--prepare` builds the case inputs locally and
does not start the model. The spoken fixtures use macOS `say` with Tingting,
Samantha or Yelda. Narration uses a local OpenAI-compatible speech server. Set
`OVS_EVAL_ASR_MODEL` to a locally installed multilingual Whisper model to
preflight public transcription and tell the actor which model is available.
Cases in the same run share a successful transcription preflight.
On macOS, point `HYPERFRAMES_WHISPER_PATH` at a CPU-only Whisper binary
(or a launcher that passes `--no-gpu`) if Metal is unavailable to the actor.
The macOS evaluator uses a Codex CLI with named permission profiles and Unix socket rules.
It keeps the actor in Codex's workspace sandbox and provides a case-local Chromium socket.
The first browser request resolves the managed HyperFrames Chromium build for the run.
Chromium uses software rendering under a separate Seatbelt profile with read-only workspace
access and loopback networking. Direct-edit cases can complete without launching Chromium.
The report records browser requests and runtime availability. HyperFrames writes its font
cache inside each case workspace.

The catalog covers 28 production scenarios and three reference comparisons.
For host-specific scenarios, the public equivalents use a local attributed
stock catalog, an approved portrait-and-narration fallback, a simulated BYO
payment boundary, and the installed skill's routing from a plain request.
The asset and authorization substitutes are described in the corresponding
catalog entries. Reference runs include independent source and delivery
contact sheets for comparing layout, palette or beat order.

Each run keeps a private temporary evidence directory, or one below
`--output-dir <directory>` outside all Git worktrees. The runner rejects Git
paths before creating output, including paths through symlinks. Keep reports,
scores, replies, logs, shipped media, frames and selected proof in local storage.
Git tracks the reusable cases, fixtures and runner. The verification gate rejects
recognized model run paths in the Git index.

Each model run keeps JSONL events, replies, shipped versions, independently
sampled frames, and a per-case `result.json`. Delivery requires a
successful public CLI ship receipt, matching version bytes and full media
decode. A receipt can also identify a freshly shipped production in a system
temporary directory. Its verified video is copied into the case evidence.
Objective checks cover speech heard in the cut, source music and beat
timing, footage preserved across revisions, and authorization before delivery.
Single-turn cases use ephemeral Codex sessions. Multi-turn cases resume their
thread, and the final revision-journey turn opens a fresh session against the
saved production. Turns default to 20 minutes, or 40 for the long-form and
script-story cases. Override the limit with `--turn-timeout-seconds`.
After a terminal turn event, Codex has up to 15 seconds to exit. The report
records turn completion separately from the exit code, signal and shutdown timeout.

An `objective-pass` means the measured checks passed. Review the report's
visual criteria against the frames and mark visual acceptance separately.
Failures and environment blocks produce a nonzero exit code. Runs use the
configured Codex subscription or model allotment and stay outside `pnpm
verify` and CI. Each workspace uses an isolated OVS config. When a case
needs local services it uses a Codex workspace permission profile that allows
local binding for HyperFrames and fixture servers, with proxy domains limited to
loopback. The public case catalog records each originating Orkas case and
the reviewed source content hash.
