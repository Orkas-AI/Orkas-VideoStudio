---
name: gate-control
description: Resolve review gates for an explicitly requested legacy plan workflow.
---

# gate-control

Use this only when the user explicitly chooses the legacy plan/review workflow or an existing production already owns those persisted gates. New requests follow [video-studio](../video-studio/SKILL.md).

Resolve supplied user decisions with `ovs gate transition` or equivalent `gate_transition` MCP tool, using the actual plan/draft signature and persisted state. Never fabricate approval from an agent-written value, credentials or a successful tool call. Inspect `ovs gate transition --help` for the resolver input contract. Reuse unchanged decisions within their scope; content edits invalidate dependent draft evidence. A local visual-only change reuses unaffected assets and narration. Ask only when the requested action changes the approved scope or a required decision is genuinely missing.

Paid calls still require [native spending authority](../video-studio/references/generation.md). A gate transition does not create authority beyond the user's actual decision. Do not invent recovery forms or report a pending decision as completed work.
