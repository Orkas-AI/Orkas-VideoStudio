---
name: stage-plan
description: Maintain an existing legacy EDL or prepare a user-requested plan.
---

# stage-plan

Current work follows [video-studio](../video-studio/SKILL.md). Show a plan only when requested, longer than about two minutes or constrained to an exact script. Legacy EDL commands remain `ovs plan validate`, `ovs plan summarize` and `ovs plan promise-check`. The existing schema requires `tracks`; use `{}` when none. Preserve reference intent, source mapping and `edit_strategy`. `delivery_promise.motion_min_ratio` is the minimum actual primary motion share; use exactly zero for `compose_led`. Validate real produced files before delivery. Load [legacy EDL reference](references/legacy-edl.md) only when editing that format.
