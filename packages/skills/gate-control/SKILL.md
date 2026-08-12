---
name: gate-control
description: Canonical VideoStudio review authorization and state-transition policy. Use after any Gate B/C/Preview/D decision, post-gate revision, resumed approval, or exhausted visual-QA result across COMPOSE/AUTO/GENERATE/EDIT; maps explicit user authority and durable artifact state to one next action with `ovs gate transition`. Do not use for ordinary planning or craft decisions before a gate exists.
---

# gate-control

This is the single authorization policy for every VideoStudio production line. Line skills own artifacts and production craft; they do not invent a second confirmation or recovery state machine.

Resolve the next operation from current facts—plan identity, artifact identity, narration materialization, paid-attempt facts, QA evidence, and explicit user authority—not from a monotonic stage rank. Preview/snapshot work may continue while required narration is missing; complete draft/final delivery may not. Stop the execution horizon at any operation whose returned evidence decides the next branch.

Gate-B identity is the normalized production-intent projection. Stable copy, timing, language, references, provider settings, and voice selection remain approval-bearing; execution-only fields such as produced paths/status and provider catalog display labels do not. Unknown plan fields remain signed so new semantics cannot bypass review.

## Canonical review gates

The names below are internal protocol identifiers. In normal user-facing headings and decisions, use plain localized names instead:

| Internal identifier | English | Simplified Chinese |
| --- | --- | --- |
| Gate A | Direction confirmation | 方向确认 |
| Gate B | Production plan confirmation | 制作计划确认 |
| Gate C | Paid generation confirmation | 付费生成确认 |
| HTML Preview | Visual preview | 视觉预览 |
| Gate D | Final video confirmation | 成片确认 |

Keep `Gate A/B/C/D` and `HTML Preview` for tool calls, stored state, and technical diagnostics only. Choose the production language from an explicit user request first, then the current UI/user language when known, otherwise English. Normalize Chinese to `zh-CN`, English to `en`, Japanese to `ja`, Portuguese to `pt-BR`, and unsupported languages to `en`; once submitted, keep that choice locked unless the user explicitly changes it.

Every gate shows the current artifact, a concise next-action/cost/QA note, one decision request, and then stops. A new turn, question, or unrelated message is not approval.

Gate B's review package opens with the locked direction summary — line, aspect, duration, video language, audio mode, supplied-asset usage, and any billable cost note. Do not re-ask a direction fact the user already settled: the plan confirmation restates it, it does not reopen it. A reply naming a different language is a revise instruction — rewrite the plan artifacts to that language and show the one updated confirmation; never approve artifacts that do not match the language you showed.

| Gate | Required artifact | Stable decision field | Approval authorizes |
| --- | --- | --- | --- |
| Gate B | the manifest's rendered plan (`ovs composition script`) or the `plan.json` summary, including narration profile | `gate_b_decision` | production from that exact plan |
| Gate C | exact billable segment count and exact provider settings | `gate_c_decision` | those generation calls only |
| HTML Preview | current contact sheet | `preview_decision` | `ovs draft` for that preview |
| Gate D | draft video plus QA headline | `gate_d_decision` | high-quality finalization of that draft |

Decision values are `approve` and `revise`; keep free-text adjustments separate. Gate A locks the creative brief but does not authorize production, paid work, rendering, or final delivery.

Gate C is one batch-level decision. A pending or failed paid request is not reusable authority for another request: a user-requested retry needs a fresh Gate C and a new output path. Do not interleave per-shot confirmations.

## Authority is not the same as recovery

- A Preview/Gate D `revise` authorizes editing the displayed artifact within the requested scope and any required non-billable restart of its visual-QA cycle.
- `approve` authorizes only the displayed artifact and next transition.
- An exhausted visual-QA cycle is a user fork, not a silent wait and not a form: show the current frames and the remaining findings, offer another repair round or skipping the named check, and end the turn. The user's reply grants the next cycle — never restart one as the silent default, and then make a materially different edit: the failed strategies are recorded, and repeating one spends the new budget for nothing.
- Whenever a quality finding blocks progress, tell the user in plain language what the check flagged and that they may skip it if they accept the look — they cannot choose an option they were never told exists. Skip with `ovs draft --waive <code>`; the waiver persists on the project, so never ask them to skip the same check twice. Evidence-integrity findings (missing or corrupt frames/maps, parse failures) are repaired, not offered.
- Legacy `visual_recovery_decision=new_visual_revision` input remains consumable for old clients, but must not be emitted in a new task.
- An error that says authorization is required does not itself prove recovery availability; query durable status first.
- A malformed local payload, missing file, stale evidence, failed check, or write error is system work, not a creative decision. Repair it without creating a gate when approved intent is unchanged.
- A recovery is executed, not narrated: a valid recovery trace contains the concrete file mutation BEFORE the validator retry. Re-running an unchanged validation is not progress, and a diagnosis-only response at that point is incomplete work, not a finished turn.

When production or rendering tools are explicitly unavailable, return a clearly unexecuted production package for an otherwise clear brief: assumptions, complete narration/script, timed storyboard, exact visible copy/captions, visual/audio and rights-safe asset plan, export target, preview checklist, and final playback/encoding QA. Do not claim files exist or withhold the package behind a direction form.

## Required resolution

After a gate submission, a post-gate edit, a resumed turn with prior approval, or a visual-revision error:

1. Identify the locked `line`: `compose`, `auto`, `generate`, or `edit`.
2. Identify the reviewed `artifact`: `composition` for COMPOSE (and AUTO child compositions), otherwise `production`.
3. Classify revision scope:
   - `visual_only`: HTML/CSS/SVG/layout/motion/palette/assets; no approved wording, timing, language, narration, delivery, source mapping, role, or provider-setting change.
   - `gate_b_payload`: approved copy/casing/punctuation, timing, language, narration, delivery, source mapping, semantic roles, or signed provider intent.
   - `unknown`: inspect the requested files before asking a technical question.
4. Classify who asked for the change (`--origin`). `user` means the CURRENT turn names the change in the user's own words — the resolver then returns `apply_user_instruction_then_approve_plan`: apply exactly that change and re-sign, and never ask them to confirm a change they dictated (that costs a full round trip and teaches them their instructions are not taken at face value). A model-initiated change, or a reply that mixes an instruction with your own proposal, is `model` — the higher bar wins. Nothing verifies `origin`; report it honestly.
5. Set recovery only from deterministic evidence: `available`, `not_available`, or `unknown`. This selects internal control flow, not a new form.
6. Run `ovs gate transition` and obey `next_action`, `form`, `allowed_ops`, and `prohibited_ops`.

Always invoke the resolver through the public `ovs gate transition` command (or the equivalent `gate_transition` MCP tool). Never execute a resolver by referencing an installed skill or Marketplace path directly.
Pass only the decision field present in the current user submission. Never combine a current `--decision` with a cached `--recovery-decision`.

```bash
ovs gate transition \
  --line compose \
  --artifact composition \
  --gate gate_d \
  --decision revise \
  --scope visual_only \
  --recovery not_available
```

Optional evidence inputs are `--error-code`, `--artifact-state`, `--approval-status`, and `--origin` (step 4). `--recovery-decision` is backward-compatible input for an already-visible old form only. Use `unknown` when evidence is missing; never guess `available` — and never claim `--origin user` for a change the user did not name in the current turn.

## Invariants

- A Preview/Gate D `visual_only` revision with recovery `not_available` goes directly to a localized edit and deterministic QA. It emits no recovery question.
- The same revision with recovery `available` still emits no form: make the localized edit, then use `ovs check`, `ovs snapshot`, and `ovs draft`. OVS automatically starts a fresh persisted repair cycle after the authored content signature changes.
- A `gate_b_payload` revision creates exactly one Gate B amendment. Its approved signature starts a fresh QA cycle, so recovery from the old signature is irrelevant and must not be combined into the form. The aftermath follows the visual identity: a narration-only amendment keeps the prior silent preview and its go-ahead (scene windows and pixels unchanged), while a visual amendment clears preview evidence — re-run visual QA and the preview only when the visual identity changed.
- An unchanged artifact with recorded approval continues from that approval; never ask again merely because the task resumed.
- A passing snapshot may create one Preview Gate. A passing draft may create one Gate D. No status check, advisory, retry, or bookkeeping step creates a user gate.
- A content edit changes the draft signature and starts a fresh bounded repair cycle automatically. There is no public/manual reset operation; do not delete QA state by hand.
- One user decision may produce at most one follow-up authorization request, and only for authority that decision did not already grant.
- `E_VISUAL_REVISION_EXPLICIT_AUTHORIZATION_REQUIRED` never justifies a form. With recovery `unknown`, query status; with recovery `available` and no current revise decision, present the frames and remaining findings with the real choices — another repair round, or skipping the named check — and end the turn. Never a reason-only blocker or a generic "how should I proceed?".
- After final-video approval, a local visual-only revision reuses the approved plan, assets, and narration. Edit only the affected scene, run `ovs check` and `ovs snapshot`, then encode the revised final; do not ask for production-plan confirmation again or repeat TTS/generation unless the requested scope changes signed content or provider intent.

## Signed amendments

For a Gate B amendment, apply only the approved bounded patch, revalidate the changed plan/artifact, then continue through the real Preview/Gate D path. A current Gate B approval wins over cached approval for the old signature. Do not promise an immediate render when a newly materialized preview still needs review.

Status checks, plan bookkeeping, advisory QA, repair passes that remain, and tool misuse errors never stop for the user. An exhausted visual-QA cycle does: show its evidence and choices once and wait. Never emit `visual_recovery_decision` in new VideoStudio output.
