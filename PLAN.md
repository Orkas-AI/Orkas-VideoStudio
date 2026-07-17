# OrkasVideoStudio — 开源技术方案（Plan v0.1）

> Coding-agent 驱动的视频工作室：让 Claude Code / Codex / Cursor 这类会写代码、会自验证的 agent
> 来 **合成 / 生成 / 剪辑** 视频。Agent 是大脑，本项目提供「知识层 + 确定性能力层 + 可读可 diff 的视频 IR」。
>
> 状态：方案定稿，**尚未写代码**。本文是施工前的技术方案与决策记录。
> 日期：2026-06-30。来源分支：AITeam `release_1.0.5` 的 `video-studio` 内置 agent（已端到端验证）。

---

## 0. 一句话定位

> **不是黑盒 video agent。** 视频被表达成一份可读、可 diff、可重渲染的 IR（`plan.json`）——
> agent 和人都能改它，改一行只重渲那一段。渲染/剪辑/转写是大路货（复用上游 OSS：HyperFrames + ffmpeg + whisper.cpp），
> 真正的价值在 **知识层（什么是好视频、三条产线怎么走）+ 这份 IR + BYO-key 的生成适配器**。

面向用户：把 `OrkasVideoStudio` 装进你的 coding agent，用自然语言说「做个 60 秒讲解 X 的竖屏动画」「给这段视频加中文旁白和字幕」「把这条 1 小时录屏剪成 3 分钟高光」，agent 自己读素材、写时间轴、出片。

---

## 1. 与既往工作的关系（必读，避免重复弯路）

本项目**不是从零开始**，它是两条既有线索的合流：

| 线索 | 时间 | 结论 |
|---|---|---|
| `~/Documents/GitHub/Orkas-VideoCut` | 2026-06-08 ~ 06-11 | 同一构想的**第一次开源尝试**：15-package 雄心架构（自建 IR + WebCodecs/WebGPU 实时引擎 + 可逆编辑 + 自动生成 NLE + 决策大脑）。spike **证明了 HyperFrames + ffmpeg 统一时间轴可行**，但卡在「从零自建引擎」的工程量上停摆。其核心洞察值得留：**真实素材的「看懂→取舍→粗剪」决策层才是唯一增量，渲染是大路货。** |
| Orkas `video-studio` 内置 agent | 2026-06-23 ~ 06-29 | 走了**相反的务实路线**：不自建引擎，薄封装上游 CLI + 把智能放进 8 个 host-neutral 的 `SKILL.md` + 一份 `plan.json` IR。**已在 app 内端到端验证**（compose/generate/edit 三线 + 旁白/字幕/本地化/多镜一致性）。当时刻意为开源保留 host-neutral。 |

**本方案的取舍**：以已验证的 `video-studio` 为主干做精简抽取（决策 #1）；`Orkas-VideoCut` 的「决策层」洞察作为 **P3 可选护城河阶段**吸收，但**不复活它的重引擎**（自建实时引擎 / 自建 NLE）。

> `Orkas-VideoCut` 旧仓保留作参考，不在本仓复用其 git 历史。

---

## 2. 决策记录（2026-06-30，已与负责人确认）

| # | 决策 | 选择 | 含义 |
|---|---|---|---|
| D1 | 整体定位/雄心 | **务实抽取 + 决策层留后期** | 主干 = 抽取 video-studio；不建 WebGPU 引擎/NLE；真实素材「决策层」与精修 UI 写进 roadmap 作可选后期阶段。 |
| D2 | 首发(v1)范围 | **全部产线一次到位** | v1 即覆盖 compose + generate + edit + 一致性/数字人/本地化（因为这些已验证，抽取可一次带全）。 |
| D3 | 驱动接口 | **CLI + MCP 双壳** | 一套 core，两个壳：bash CLI（任何能跑 shell 的 agent 通用）+ MCP server（Claude Code/Codex 的 typed tools 体验更好）。 |
| D4 | 渲染底座 | **显式依赖 `hyperframes@0.7.60`，渲染器做成可替换接口** | 默认调用本地包，`npx` 仅兼容回退；HyperFrames 0.7.60 声明 Apache-2.0。 |

待定（本方案给推荐，未最终拍板）：仓库 license（推荐 MIT；备选 Apache-2.0）、ffmpeg 分发方式、最终包名/scope。见 §11。

---

## 3. 目标架构（end-state，分期实现）

```
        Coding Agent (Claude Code / Codex / Cursor)   ← 大脑，不自带 agent loop
                 │
                 │   bash CLI            MCP server
                 ▼   (ovs ...)           (typed tools)
   ┌─────────────────────────────────────────────────────┐
   │  OrkasVideoStudio  (Node/TS monorepo, pnpm workspace) │
   │                                                       │
   │  packages/skills/   8 个 host-neutral SKILL.md +      │
   │                     顶层编排工作流（来自 agent.json）   │
   │  packages/core/     plan.json IR(EDL schema+validator)│
   │                     + 系统二进制探测 + BYO 配置加载     │
   │  packages/tools/    render · edit · analyze ·         │
   │                     speech · image · video（纯函数）   │
   │  packages/cli/      `ovs <cmd>`（薄壳，调 tools）       │
   │  packages/mcp/      MCP server（薄壳，调 tools）        │
   └─────────────────────────────────────────────────────┘
                 │ spawn / fetch
                 ▼
   上游 OSS：  hyperframes@0.7.60(渲染/检查/转写)  ·  ffmpeg/ffprobe(剪辑/媒体 QA)  ·  rapidocr(OCR)
   BYO 云端：  OpenAI / Gemini / Doubao(Volcengine) / 任意 OpenAI 兼容端点（image / video / TTS）
```

**核心原则**
1. **Agent 只读写结构化 IR（`plan.json`），不直接碰像素。**（沿用 Orkas-VideoCut 公理 #1，但用现成的 `video_edl.ts` schema 实现，不自建引擎。）
2. **一套 core，两个壳**：CLI 与 MCP 都是 `packages/tools` 的薄封装，业务逻辑只写一遍。
3. **能力 = 薄封装上游**：render/edit/analyze 不重写算法，只解耦 Orkas 宿主、改系统二进制探测。
4. **生成 = BYO-key 可插拔 adapter**：砍掉一切 Orkas 托管后端与 COS 上传。

---

## 4. 能力层：复用 / 移植 / 新建 一览

> 已用代码核实（AITeam `PC/src/main/features/*` + `model/core-agent/*`）。结论：**这是「抽取+解耦」工程，不是重写。**

| 能力 (CLI 命令) | 上游/实现 | 来源文件 | OSS 工作量 |
|---|---|---|---|
| `ovs render / lint / check / snapshot` | 本地 `hyperframes@0.7.60`（HTML→mp4，headless Chrome + ffmpeg） | `video_studio.ts` / HyperFrames contract | **委托+适配**：不移植 Electron renderer；工具优先调用目标包依赖，`npx` 仅回退；最终 QA 使用 `check` |
| `ovs edit <op>` (probe/trim/concat/burnsubs/overlay/extract_frame/loudness/mix) | 直接 ffmpeg/ffprobe | `video_edit.ts` | **移植**：纯 ffmpeg 封装，零 Orkas 算法耦合，去 logger/redact 即可用 |
| `ovs transcribe / silence / ocr` | whisper.cpp(经 hyperframes transcribe) + rapidocr-onnxruntime | `video_analyze.ts` + `ocr_runtime.ts` | **解耦**：复用上游；去宿主依赖 |
| `ovs plan validate / summarize / promise-check` | 纯 TS 类型 + 校验（**零 Orkas 耦合**） | `video_edl.ts` | **整体可搬**：这就是 IR 的 schema+validator，护城河组件 |
| `ovs speak`（TTS） | 可插拔 adapter：OpenAI 兼容 / Doubao V3 | `video_speech.ts` | **移植+裁剪**：保留 adapter 接口与 BYO 后端；**删** Orkas·Voice 托管 + 账号绑定声音表；Kokoro 本地留作可选 seam（上游 espeak-ng 崩溃，默认不启用） |
| `ovs image`（生成图） | 可插拔 adapter：OpenAI / Gemini / Doubao Seedream | `image_gen.ts` | **移植+裁剪**：保留 4 adapter 中的 3 个 BYO；**删** Orkas·Image 托管 + COS 上传 + client_config 开关 |
| `ovs video`（生成视频） | 可插拔 adapter：Doubao Seedance 2.0 | `video_gen.ts` | **移植+裁剪**：保留 Doubao 直连 adapter；**删** Orkas·Video 托管 |

**上游 OSS 依赖（直接复用，不重写）**：`hyperframes`(npm) · `ffmpeg`/`ffprobe` · `whisper.cpp`(经 hyperframes) · `rapidocr-onnxruntime`。

**要替换的 Orkas 宿主件**（不进 OSS）：`util/bundled-runtime.ts`(→系统 PATH 探测)、`util/path-sandbox.ts`(→简化沙箱)、`features/permissions.ts`、`features/user_workspace.ts`、`auth.ts`/`tts_auth.ts`/`account/*`/`token_store.ts`、`client_config.ts`、`generation_reference_assets.ts`(COS)、`util/redact.ts`(简化)、`i18n.ts`、IPC/SDK 工具壳。

---

## 5. 知识层抽取（8 个 SKILL.md + 顶层工作流）

> 已用代码核实：7/8 个 skill ≥85% 可直接复用，Orkas 工具名只在「开头一句免责声明 + 个别 op 调用点」零星出现。抽取 = **一遍 rename**（`in Orkas the X tool` → `run `ovs X``），外加 stage-compose 的 HyperFrames 合成契约（本身就是上游 host-neutral 契约，保留 HyperFrames 即 100% 可用）。

| Skill | 可复用度 | 抽取动作 |
|---|---|---|
| `video-router` | 100% | 直接搬 |
| `video-craft` | 90% | 去 stage-skill 互引 |
| `stage-plan` | 85% | `video_plan op=` → `ovs plan ...`；plan.json schema 全可搬 |
| `stage-edit` | 75% | `edit_video op=` → `ovs edit ...` |
| `stage-generate` | 70% | 工具名一行替换 |
| `stage-consistency` | 75% | `kb_*` 检索段改为通用 chunk/RAG 说明 |
| `stage-assemble` | 75% | op 名替换；去 `run_worker`/`E_EDIT_BASE_HAS_AUDIO` 等 Orkas 码 |
| `stage-compose` | 40%直接+40%契约 | 去 3 句 Orkas 免责声明；HyperFrames HTML 契约保留 |

**顶层编排工作流**：`video-studio` agent.json 里那段大 workflow（路由 + 三条产线 + GATE 检查点 + plan.json 作可编辑记录）抽成 OSS 的 **orchestration skill / 顶层 README**——它本身极少 Orkas 机制，主要改：
- `<agent-input-form>` 审批门 → 「向用户复述方案，等确认」的 coding-agent 友好措辞（Claude Code/Codex 没有 form 协议，用对话确认）。
- Orkas 宿主消息媒体引用 → 输出普通本地文件路径。
- 工具名 → CLI/MCP 命令名。

**分发形态**
- **Claude Code**：打成一个 plugin（`.claude/skills/*` + MCP server 配置 + 可选 slash command `/video`）。
- **Codex**：`AGENTS.md` 指向 skill 目录 + MCP 配置（`~/.codex` / 项目级）。
- **通用**：一个 `SKILLS/` 目录任何 agent 可读 + `ovs` CLI 自带 `--help`/`ovs skills` 自描述。

---

## 6. 视频 IR（`plan.json`）= 招牌差异化

沿用 `video_edl.ts` 的 schema（纯类型，零耦合，整体可搬）：`delivery_promise`(+motion_min_ratio 反幻灯片) + 跨模态 `segments`(source-edit/generate/compose/provided × primary/overlay/bg，各带 role+target_sec) + `tracks`(narration/music/captions) + `cost_estimate`。

**为什么它是护城河而非锦上添花**
- 每个 segment / 每条旁白 / 每条字幕都**独立可改、可重渲**——用户说「第 3 段配音换个声音」「这条字幕有错别字」，agent 只改 `plan.json` 对应一行 + 只重产那一块，不重做整片（这套增量编辑逻辑 agent.json 已验证）。
- 它是**可 diff、可审计**的：每一刀能溯源到目标时长/承诺，未来 P3 决策层可在每个切点挂 reason+confidence。
- 这就用极简方式实现了 Orkas-VideoCut「视频=可读代码、不是黑盒」的卖点，**不需要自建引擎**。

`ovs plan validate/summarize/promise-check` 是它的 CLI 入口；`promise-check` 是确定性的 source/幻灯片守卫（fail 阻断交付）。

---

## 7. BYO Provider 策略（生成线）

**零密钥可用面**：compose + edit + transcribe/ocr 全靠本地免费上游 → **任何人零配置即可做「脚本→带字幕解说 mp4」和「真实素材剪辑/字幕/本地化」**。生成（image/video/TTS）才需 BYO key，opt-in。

**配置**：`~/.config/orkas-video-studio/config.{json,toml}` + 环境变量覆盖（如 `OVS_TTS_BASE_URL` / `OVS_TTS_API_KEY` / `OVS_IMAGE_PROVIDER` / `OPENAI_API_KEY` 等）。沿用现有 adapter 的 env 习惯，去掉 Orkas profile store。

**Day-1 适配器**（均已在 Orkas 实现并验证，移植即可）：
- 图：OpenAI Images · Gemini · Doubao Seedream（含 image-to-image / 参考图）
- 视频：Doubao Seedance 2.0（image-to-video + 内置音频/口播）
- TTS：OpenAI 兼容（含 ElevenLabs 等）· Doubao V3

**红线**：绝不内置任何 Orkas 账号绑定的密钥或那张 `voice_type` 声音表（账号专属）。OSS 用通用/BYO 声音，文档给「如何填你自己的 voice id」。

---

## 8. 安全 / 隐私 / 合规红线（不可复制清单）

抽取时**严禁带入** OSS 仓：
- Orkas 部署密钥、`global.secret`/`.env` 类签名密钥（与 CLAUDE.md 一致）。
- `auth`/`account`/`token_store`/COS 上传/托管后端/`client_config` 特性开关。
- `agent.json` 里账号绑定的 `voice_type` 声音表。
- 内部 telemetry/Monitor 调用、内部域名、内部 dashboard URL。
- 任何 token / session id / 本地绝对路径 / 用户 prompt 的日志外泄（OSS 自带简化版 redact）。

**许可证合规**：ffmpeg 为 LGPL/GPL——OSS 代码用 **spawn** 调它（非链接），本仓代码可保持宽松 license；但**若分发 ffmpeg 二进制**则继承其义务（需 NOTICE + 源码披露）。推荐 v1 让用户自装 ffmpeg（peer dep / `ovs doctor` 检测并指引），不默认打包二进制（见 §11 待定）。

---

## 9. 渲染底座 posture（D4 落地）

- `packages/tools/render` 暴露 `render/lint/check/snapshot`，通过 `packages/tools/src/hyperframes/client.ts` 优先调用直接依赖 `hyperframes@0.7.60`；显式二进制覆盖与 `npx` 仅作为兼容路径。
- HyperFrames 0.7.60 npm 元数据声明 **Apache-2.0**；项目要求 Node >=22，并把 HyperFrames 版本作为 Orkas→OSS 同步检查项。
- `composition-manifest.json` v2 是 timeline/audio/art-direction 的 canonical artifact；`ovs composition prepare/reconcile` 生成或只更新 HyperFrames 受保护元数据，不覆盖模型创作的 DOM/CSS/SVG/motion。
- edit/generate 仍不依赖 HyperFrames；transcribe 明确委托 HyperFrames 的 whisper.cpp 能力。

---

## 10. 分期 Roadmap

> D2 = v1 全量；但仍按「先打通骨架，再铺满」分里程碑落地，降低风险。

- **P0 脚手架** ✅ DONE (2026-06-30)：pnpm monorepo + TS + vitest；`core` 的 plan.json IR(validate/summarize/promise-check) + 系统二进制探测 `ovs doctor` + 配置加载；9 个 host-neutral SKILL.md（泄漏扫描 clean）；MIT/README/AGENTS.md。
- **P1 零密钥主干（Compose + Edit）** ✅ DONE + verified (2026-06-30，2026-07-17 更新)：`tools` 的 render/check/snapshot(HyperFrames)/edit(ffmpeg)/analyze；CLI/MCP 使用同一工具层。2026-07-17 起显式依赖 HyperFrames 0.7.60、Node >=22，新增 manifest v2 与 composition prepare/reconcile；`inspect` 仅保留兼容别名。
- **P2 生成线 + BYO providers** ✅ DONE + verified (2026-06-30)：`tools` 的 speech(OpenAI 兼容 TTS) / image(OpenAI 兼容 + Gemini) / video(Doubao Seedance 异步 task+poll)，全部 BYO-key、砍掉托管后端；配置走 `~/.config/orkas-video-studio` + `OVS_*` env；CLI 的 speak/image/video 从 stub 变真命令；MCP 增至 **22 tool**。**验证**：9 个 mock-server 单测（TTS/图像/视频 请求体+鉴权+落盘、视频 task 轮询 running→succeeded + failed 路径、config env 覆盖）全绿；CLI `ovs speak/image` 对 mock server 真跑落盘 + no-provider 干净报错；MCP client list 22 tool。剩（follow-up）：Doubao TTS 流式、image-to-video 需公网图 URL、analyze `ocr`、Seedream 尺寸归一化等高级项。GENERATE 知识层(stage-generate/consistency)已在 skill 包内。
- **P3 决策层 ✅ DONE + verified (2026-06-30)**：真实素材「看懂→取舍」护城河，先在 Orkas dogfood、再端到端搬到 OSS。纯核心 `packages/core/src/decide/decide.ts`（keepIntervals/complementIntervals/fillerSpans/normalizeTranscriptWords/parseSceneChanges/buildKeepFilterComplex/decisionEvidence + 质量 parseQualityFrames/parseLabeledIntervals/summarizeQuality + best-take textSimilarity/clusterTakes/rankTakes，**38 单测**）；ops `ovs edit trim-silence`/`remove-fillers`（单遍 select/aselect jump-cut + 证据）、`ovs scenes`、`ovs quality`（blur/exposure/black/freeze，零新依赖全用 ffmpeg）、`ovs plan rank-takes`；IR 加 evidence/reason/confidence；CLI + MCP(27 tools) 全接。**验证**：build+typecheck 0、87 单测、真实 ffmpeg CLI 烟测全过。**视觉判断无独立 VLM**——靠驱动 agent 自身多模态读 extract-frame 帧。后续可选：shake(vidstabdetect)、按镜头质量分桶、人脸 best-take(OpenCV)。
- **P4（可选，重）本地精修 NLE**：一个本地 Web NLE，读写**同一份 `plan.json`**，承接最后 10% 人工精修。先用 ffmpeg draft 渲染满足多数需求；实时 WebCodecs/WebGPU 引擎仅当 UI 需要逐帧 scrub 才考虑，默认无限期推迟。

---

## 11. 测试方案（对齐 Orkas 测试纪律）

- **L1 单元**（vitest，无模型）：IR validator 的匹配/反例 fixtures；ffmpeg 参数构造；各 adapter 的请求 shape（mock server 验证请求体与落盘）；系统二进制探测。
- **L2 端到端**：真跑一支 compose→mp4 + 一段 edit（trim/concat/burnsubs）→ 有效 mp4（对齐 Orkas-VideoCut spike 与 video-studio 的 smoke）；`ovs plan promise-check` 守卫的正/反例。
- **解析/改写 LLM 输出的代码**（plan.json 解析、skill 契约）需匹配 + look-alike 反例 fixtures。
- **CI 红线扫描**：禁止出现 §8 清单中的 Orkas 密钥/域名/声音表/托管端点字符串。

---

## 12. 开放问题 / 行动项

1. **HyperFrames 升级审计**——当前固定 0.7.60 / Apache-2.0；任何升级先核对 Node engine、license、CLI 命令与渲染回归，再修改同步规则。
2. **仓库 license**：推荐 **MIT**（最简、利于采用）；若需专利授权可选 **Apache-2.0**。
3. **ffmpeg 分发**：v1 推荐用户自装（`ovs doctor` 指引），不打包二进制以避开 GPL 分发义务；若要开箱即用再评估 `ffmpeg-static` + NOTICE。
4. **包名/scope**：CLI 暂定 `ovs`（`@orkas/video-studio`?）；待定最终 npm scope。
5. **Claude Code 分发形态**：plugin（skills + MCP + slash command）打包细节待 P1 敲定。

---

## 13. coding agent 如何读 skill（重点：Codex / Claude Code / 通用）

> 已查证官方文档（2026-06）。**好消息：Codex 与 Claude Code 已收敛到同一套 `SKILL.md` 格式 + 渐进式披露**，
> 我们的 skill 包基本是「写一次，装两处」，差异只在安装目录与可选的厂商元数据 sidecar。

### 13.1 两家的机制（核实结论）

| 维度 | Claude Code | Codex CLI |
|---|---|---|
| 单元格式 | `SKILL.md`，YAML frontmatter `name` + `description` | **同上**（`description` 要写清「何时触发、何时不触发」） |
| 仓库级目录 | `.claude/skills/<name>/SKILL.md` | `./.agents/skills/<name>/`（含父目录、`$REPO_ROOT/.agents/skills`） |
| 用户级目录 | `~/.claude/skills/` | `~/.agents/skills/` |
| 加载模型 | 渐进式披露：启动只载 name+description，命中后才载正文 | **同样渐进式披露**：启动只载 skills 列表（≤2% 上下文/8000 字符），选中才载 `SKILL.md` 正文 |
| 触发 | 描述匹配（隐式）+ 显式调用 | 描述匹配（隐式）+ `$` 提及 / `/skills` |
| 附属文件 | `scripts/`/`references/`/`assets/` | `scripts/`/`references/`/`assets/` + 可选 `agents/openai.yaml`（Codex UI 元数据/依赖） |
| 工具接入 | MCP（`.mcp.json` / `claude mcp add`） | MCP（`~/.codex/config.toml` `[mcp_servers.*]` / `codex mcp add`） |

**核心含义**：`packages/skills/<name>/SKILL.md` 是**唯一事实源**，两家共用；不同的只是「拷到哪个目录」和一个可选 sidecar。skill 的 `description` 按 Codex 要求写「何时该/不该触发」，对 Claude Code 同样最佳。

### 13.2 我们的分发设计（三条路，覆盖所有 agent）

1. **原生 skill（首选，Claude Code + Codex 通吃）**：CLI 提供
   `ovs skills install --target claude|codex|cursor [--user|--repo]`，把 `packages/skills/*` 物化到对应目录
   （Claude `~/.claude/skills` 或 `.claude/skills`；Codex `~/.agents/skills` 或 `.agents/skills`）。两家都靠渐进式披露自动发现。
2. **MCP typed tools（D3 的另一壳）**：`packages/mcp` 的 server 把 `render/edit/analyze/speak/image/video/plan` 暴露成
   MCP 工具；并把每个 skill 也作为 **MCP resource / prompt** 暴露，供任何 MCP 客户端（含 Codex、Claude Code）拉取。
   注册：Codex `codex mcp add ovs -- npx -y @orkas/video-studio-mcp`；Claude `claude mcp add ovs ...`。
3. **自描述 CLI（兜底，任何能跑 bash 的 agent）**：`ovs skills`（列出）+ `ovs skill <name>`（打印正文）。
   即便某 agent 没有原生 skill 加载、或跨 skill 互引没自动解析，agent 也能用 bash 把任意 skill 正文拉进上下文。
   再配一个极薄的 `AGENTS.md` / `.cursorrules` 指针文件指向 `ovs skills`，让无原生 skill 的 agent 也能上手。

> 设计取舍：**skill 正文围绕 `ovs` CLI 写**（最通用），MCP 工具与 CLI 子命令 **1:1 镜像**，
> 这样「bash 驱动」和「MCP 驱动」拿到的是同一套能力面，skill 不必为两套接口分叉。

### 13.3 用 Codex 驱动的端到端流程（示例）

```bash
# 安装一次
npm i -g @orkas/video-studio          # 得到 ovs（CLI）
ovs doctor                            # 探测 ffmpeg/ffprobe/node，缺啥给安装指引
ovs skills install --codex            # 把 SKILL.md 包拷进 ~/.agents/skills/
codex mcp add ovs -- npx -y @orkas/video-studio-mcp   # 可选：注册 MCP typed tools
```
```text
# Codex 会话里
用户：做个 60 秒竖屏解说动画讲「什么是向量数据库」，配中文旁白
  → Codex 渐进式披露，按 description 命中 video-router（仅载列表→选中载正文）
  → router 指示读 stage-plan / stage-compose / video-craft（$ 提及或 `ovs skill stage-compose` 拉正文）
  → agent 写 composition/index.html + plan.json（旁白走 §2.6 之外的 BYO voice）
  → 执行：`ovs render --project ... --out draft.mp4`（bash）  或  调用 MCP 的 render_composition 工具
  → `ovs plan promise-check` 守卫 → 出片，路径回传给用户
```
skill 是大脑的知识，`ovs`/MCP 是手；Codex 负责编排与自验证。Cursor / 其它 agent 同理：能跑 bash 就能用 `ovs`，支持 MCP 就多一套 typed tools。

---

## 14. P0 脚手架草案（目录 + package.json + workspace；不写实现）

> pnpm workspace（沿用 Orkas-VideoCut 习惯）+ TypeScript + vitest。Node ≥ 20。**仅为方案草案，未安装任何依赖。**

### 14.1 目录结构

```
OrkasVideoStudio/
├── PLAN.md
├── README.md                    # 进入实现后写（English）
├── LICENSE                      # P0 决策：推荐 MIT
├── package.json                 # 根：private workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .npmrc                       # 锁 pnpm 行为
├── .gitignore
├── turbo.json                   # 可选：turbo 编排 build/test
├── packages/
│   ├── core/                    # @orkas/video-studio-core
│   │   └── src/
│   │       ├── ir/              # plan.json EDL schema + validator（移植 video_edl.ts，纯函数）
│   │       ├── runtime/         # 系统二进制探测（ffmpeg/ffprobe/node）+ npx 环境构建
│   │       ├── config/          # BYO 配置加载（env + ~/.config/orkas-video-studio）
│   │       └── index.ts
│   ├── tools/                   # @orkas/video-studio-tools（纯函数，无 CLI/MCP/Electron 耦合）
│   │   └── src/
│   │       ├── render/          # Renderer + packaged HyperFrames client（direct dependency first）
│   │       ├── edit/            # ffmpeg ops：probe/trim/concat/burnsubs/overlay/extract_frame/loudness/mix
│   │       ├── analyze/         # transcribe(whisper.cpp)/silence/ocr(rapidocr)
│   │       ├── speech/          # TtsBackend 接口 + OpenAI兼容 / Doubao 适配器
│   │       ├── image/           # ImageBackend：OpenAI / Gemini / Doubao
│   │       ├── video/           # VideoBackend：Doubao Seedance
│   │       └── index.ts
│   ├── cli/                     # @orkas/video-studio（bin: ovs）—— citty 命令树，薄壳调 tools
│   │   └── src/index.ts         # ovs render|edit|transcribe|speak|image|video|plan|skills|doctor
│   ├── mcp/                     # @orkas/video-studio-mcp（bin）—— @modelcontextprotocol/sdk，薄壳调 tools
│   │   └── src/index.ts         # 工具与 CLI 子命令 1:1；skills 作为 resource/prompt 暴露
│   └── skills/                  # 唯一事实源的 SKILL.md 包（English 正文）
│       ├── video-router/SKILL.md
│       ├── video-craft/SKILL.md
│       ├── stage-plan/SKILL.md
│       ├── stage-compose/SKILL.md
│       ├── stage-edit/SKILL.md
│       ├── stage-generate/SKILL.md
│       ├── stage-consistency/SKILL.md
│       ├── stage-assemble/SKILL.md
│       └── orchestration/SKILL.md   # 顶层工作流（来自 agent.json，去 Orkas 化）
├── .claude/skills/  ->  ../packages/skills   # 本仓自用：软链，dogfood Claude Code
├── AGENTS.md                    # 极薄指针：告诉无原生 skill 的 agent 用 `ovs skills`
└── examples/                    # 示例工程：explainer / footage-edit（L2 e2e 用）
```

### 14.2 根 `package.json`（草案）

```jsonc
{
  "name": "orkas-video-studio",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.x",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "@types/node": "^22",
    "turbo": "^2",
    "typescript": "^5.7",
    "vitest": "^2",
    "tsup": "^8"            // 或 esbuild，打 ESM/CJS + bin
  }
}
```

### 14.3 `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"
```

### 14.4 leaf 示例 `packages/cli/package.json`（草案）

```jsonc
{
  "name": "@orkas/video-studio",
  "version": "0.0.0",
  "type": "module",
  "bin": { "ovs": "./dist/index.js" },
  "dependencies": {
    "@orkas/video-studio-core": "workspace:*",
    "@orkas/video-studio-tools": "workspace:*",
    "citty": "^0.2"          // 与 hyperframes 一致的 CLI 框架
  }
}
```

### 14.5 拟引入的运行时依赖（**需先讨论再装**）

| 依赖 | 用途 | 备注 |
|---|---|---|
| `citty` | CLI 命令树 | HyperFrames 同款，轻 |
| `@modelcontextprotocol/sdk` | MCP server | D3 的 MCP 壳 |
| `zod` | IR / 工具入参校验 | 也可复用移植自 `video_edl.ts` 的手写校验，二选一 |
| `hyperframes` | 渲染、check、snapshot、transcribe（**直接依赖 0.7.60**） | Apache-2.0；Node >=22；`npx` 仅兼容回退 |
| `rapidocr-onnxruntime` | OCR（**懒加载/可选**） | 体积大，仅 analyze ocr 用到 |
| ffmpeg/ffprobe | 剪辑/探测 | **系统 peer dep**，v1 不打包二进制（§8/§12） |
| whisper.cpp | 转写 | 经直接依赖的 `hyperframes transcribe` 委托 |

> 生成线（image/video/TTS）**只用原生 `fetch`**，不引第三方 SDK（沿用 Orkas 现状，降依赖面）。

---

## 15. 实现后同步记录（从私有主干回吸）

> OSS 首发抽取自 `release_1.0.5` 的 `video-studio` 内置 agent（2026-06-30/07-01）。此后私有侧的增量按「手工 re-map」回吸——只搬**能力/知识层的语义改动**，私有的宿主胶水（`.cjs` core 构建、skill-script 目录搬迁、`agent.json`、Orkas 托管件）不进 OSS。

- **2026-07-04**（源：私有 7/3 的 `31b5923f`/`55fad18e`/`68a9ff8c`）：
  - **craft-lint**（`tools/render/craft-lint.ts`）：纯静态阈值检查（字号下限随画布高度缩放、调色板≤3–5 色），接进 `render` 的 `qa()`，作为 lint/check 的 advisory findings 附加，永不阻断渲染。
  - **trim 校验**（`tools/edit`）：cut 前按输入真实时长校验窗口（`validateTrimRequest`，`E`≥0.1s），cut 后校验产出非空/非过短——挡住静默产出 0 字节/超短片。
  - **`plan promise-check --probe-produced`**（CLI/MCP + `tools/plan-produced.ts`）：探测各 primary 段 `produced_path` 的真实时长喂给 core 既有的 `assessDelivery(producedSec)`，用**实际剪辑**而非计划 `target_sec` 守卫交付（防「计划达标、成片是短幻灯片」）。
  - **ffmpeg 流式进度**（`tools/progress.ts`）：解析 `-progress pipe:2`，把 edit（trim/concat/burnsubs/overlay/mix/trim-silence/remove-fillers）与 analyze（silence/scenes/quality/loudness）op 变成 heartbeat + 节流 running + 终态 completed/failed 的结构化事件；工具层不碰进程 IO（走 `onProgress` 回调），CLI/MCP 把事件按行写 stderr（stdout 留给结果）。沿用 `render` 已有的 `onProgress` 约定，与私有侧对齐。
  - 验证：`build`+`typecheck` 全绿；`vitest run` 110 过 1 skip（新增 craft-lint 10、progress/trim 校验 13）；真实 ffmpeg 端到端跑通 trim 进度流、两类 trim 校验报错、`--probe-produced`（planned 6s → produced 3s）。私有的 mix-coverage 并发化**不适用**（OSS `mix` 无 coverage 评估）。

---

## 附：项目文本语言约定

本 PLAN（施工前内部方案）用中文，便于评审。**进入实现后**，仓库对外文本（README、SKILL.md 正文、代码注释、CLI/错误信息、telemetry 名）一律 **English**——这是 OSS 惯例，也与 AITeam「in-repo project text is English」一致。双语 `description_zh/en` 字段例外。
