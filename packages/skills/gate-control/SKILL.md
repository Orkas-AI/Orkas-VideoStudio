---
name: gate-control
description: Canonical VideoStudio review authorization and state-transition policy. Use after any Gate B/C/Preview/D decision, post-gate revision, resumed approval, or exhausted visual-QA result across COMPOSE/AUTO/GENERATE/EDIT; maps explicit user authority and durable artifact state to one next action with `ovs gate transition`. Do not use for ordinary planning or craft decisions before a gate exists.
---

# gate-control

This is the single authorization policy for every VideoStudio production line. Line skills own artifacts and production craft; they do not invent a second confirmation or recovery state machine.

## Canonical review gates

Every gate shows the current artifact, a concise next-action/cost/QA note, one decision request, and then stops. A new turn, question, or unrelated message is not approval.

| Gate | Required artifact | Stable decision field | Approval authorizes |
| --- | --- | --- | --- |
| Gate B | script + shotlist or `plan.json` summary, including narration profile | `gate_b_decision` | production from that exact plan |
| Gate C | exact billable segment count and exact provider settings | `gate_c_decision` | those generation calls only |
| HTML Preview | current contact sheet | `preview_decision` | `ovs draft` for that preview |
| Gate D | draft video plus QA headline | `gate_d_decision` | high-quality finalization of that draft |

Decision values are `approve` and `revise`; keep free-text adjustments separate. Gate A locks the creative brief but does not authorize production, paid work, rendering, or final delivery.

Gate C is one batch-level decision. A pending or failed paid request is not reusable authority for another request: a user-requested retry needs a fresh Gate C and a new output path. Do not interleave per-shot confirmations.

## Authority is not the same as recovery

- A Preview/Gate D `revise` authorizes editing the displayed artifact within the requested scope and any required non-billable restart of its visual-QA cycle.
- `approve` authorizes only the displayed artifact and next transition.
- Technical QA exhaustion is not a second user decision and must never create a new recovery form.
- Legacy `visual_recovery_decision=new_visual_revision` input remains consumable for old clients, but must not be emitted in a new task.
- An error that says authorization is required does not itself prove recovery availability; query durable status first.

## Required resolution

After a gate submission, a post-gate edit, a resumed turn with prior approval, or a visual-revision error:

1. Identify the locked `line`: `compose`, `auto`, `generate`, or `edit`.
2. Identify the reviewed `artifact`: `composition` for COMPOSE (and AUTO child compositions), otherwise `production`.
3. Classify revision scope:
   - `visual_only`: HTML/CSS/SVG/layout/motion/palette/assets; no approved wording, timing, language, narration, delivery, source mapping, role, or provider-setting change.
   - `gate_b_payload`: approved copy/casing/punctuation, timing, language, narration, delivery, source mapping, semantic roles, or signed provider intent.
   - `unknown`: inspect the requested files before asking a technical question.
4. Set recovery only from deterministic evidence: `available`, `not_available`, or `unknown`. This selects internal control flow, not a new form.
5. Run `ovs gate transition` and obey `next_action`, `form`, `allowed_ops`, and `prohibited_ops`.

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

Optional evidence inputs are `--error-code`, `--artifact-state`, and `--approval-status`. `--recovery-decision` is backward-compatible input for an already-visible old form only. Use `unknown` when evidence is missing; never guess `available`.

## Invariants

- A Preview/Gate D `visual_only` revision with recovery `not_available` goes directly to a localized edit and deterministic QA. It emits no recovery question.
- The same revision with recovery `available` still emits no form: make the localized edit, then use `ovs check`, `ovs snapshot`, and `ovs draft`. OVS automatically starts a fresh persisted repair cycle after the authored content signature changes.
- A `gate_b_payload` revision creates exactly one Gate B amendment. Its approved signature starts a fresh QA cycle, so recovery from the old signature is irrelevant and must not be combined into the form.
- An unchanged artifact with recorded approval continues from that approval; never ask again merely because the task resumed.
- A passing snapshot may create one Preview Gate. A passing draft may create one Gate D. No status check, advisory, retry, or bookkeeping step creates a user gate.
- A content edit changes the draft signature and starts a fresh bounded repair cycle automatically. There is no public/manual reset operation; do not delete QA state by hand.
- One user decision may produce at most one follow-up authorization request, and only for authority that decision did not already grant.
- `E_VISUAL_REVISION_EXPLICIT_AUTHORIZATION_REQUIRED` never justifies a form. With recovery `unknown`, query status; with recovery `available` and no current revise decision, report the blocker and wait for the next real revision request.

## Signed amendments

For a Gate B amendment, apply only the approved bounded patch, revalidate the changed plan/artifact, then continue through the real Preview/Gate D path. A current Gate B approval wins over cached approval for the old signature. Do not promise an immediate render when a newly materialized preview still needs review.

Status checks, plan bookkeeping, advisory QA, repair passes that remain, QA-cycle restart, and tool misuse errors never create a gate. Never emit `visual_recovery_decision` in new VideoStudio output.
