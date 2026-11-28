# OrkasVideoStudio

> OrkasVideoStudio 是一款开源的 AI 视频编辑器，可以把你的编程智能体变成视频工作室。向 Claude Code、Codex、Cursor，或任何能运行 shell 或支持 MCP 的智能体要一条成片：它会剪辑你的素材，设计动态图形，加上旁白、音乐和字幕，用你自己的 Key 生成缺少的镜头，并交付一个经过检查的 MP4。之后你还可以在浏览器画布中继续编辑这个 MP4。

**Claude Motion、CapCut 和 Higgsfield 的开源替代方案，由你已经在用的编程智能体驱动。** 采用 MIT 许可证、本地优先，不需要 Claude Team 或 Enterprise 套餐，也不需要订阅视频平台：生成的镜头来自 Seedance、Kling、Veo 等视频模型，使用你自己的 Key。[对比一览 ↓](#对比一览)

**比起编程智能体，更想用应用？** OrkasVideoStudio 也是 **[Orkas](https://orkas.ai/?source=gh-orkas-vs)** 内置的视频智能体；Orkas 是一款适用于 macOS 和 Windows 的免费 AI 团队桌面应用。在对话中描述你想要的视频即可；生成可以使用 Orkas 内置模型（新账号赠送 500 积分），也可以使用你自己的 Key。**[下载 Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [两者的关系 ↓](#与-orkas-的关系)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*上面这段 54 秒的概览视频，展示了一个需求如何变成一条成片：剪辑真实素材，设计动效，加上配音、音乐和字幕，在画布上尝试不同的镜头，然后修改文字、替换镜头或调整场景顺序。*

OrkasVideoStudio **不是黑盒式的视频智能体**。思考交给你的智能体完成；本项目为它提供那些它无法临场即兴发挥的部分：

- **视频专业知识**：一套不绑定宿主的 `SKILL.md` 技能包，入口技能是 `video-studio`。它涵盖何时该提问、何时直接推进，广告、讲解视频、产品演示、音乐剪辑、出镜主讲视频、短片和评论类视频各有什么不同，以及在宣布完成之前如何检查一版剪辑。
- **确定性工具**：`ovs` CLI，以及一个与它一一对应的 MCP 服务器。它们覆盖制作时间线、ffmpeg 剪辑、转写、素材分析，以及通过你自己的服务商账号进行的生成。[HyperFrames](https://github.com/heygen-com/hyperframes) 负责页面渲染和帧捕获；`ffmpeg` 负责剪辑和测量。
- **可编辑的制作项目**：每个视频都是一个普通文件夹，包含场景时间线（`videos/main/manifest.json`）、素材台账、有出处的产品信息，以及一个可选的设计页面。你、你的智能体和浏览器画布编辑的是同一批文件。改一行文字、换一张图片或调整场景顺序，然后重新渲染即可。

剪辑、设计动态图形、字幕和转写都**不需要 API Key**。图片、视频和语音生成需要你主动开启，并使用**你自己的**服务商账号。没有托管后端，也不需要注册账号。

---

## 你可以提出哪些需求

你只需提一次需求，就能拿到一条成片。智能体会把这个需求用到的各项能力组合进同一条时间线：

| 能力 | 涵盖内容 |
|---|---|
| **剪辑实拍素材** | 修剪、拼接、重新构图为 9:16 / 1:1 / 16:9，保留或混合片段原声，叠加画面，烧录字幕并做响度标准化。对于较长的录像，它还能找出精彩片段、为重复的镜次排序、删除静音段或语气词，并为每一处剪切记录依据。 |
| **设计动态图形** | 用 HTML/CSS 加动画构建场景：动态文字、价格卡、下三分之一字幕条、数据标注和转场。可编辑的文字放在命名的文字槽位中，所以修改文案永远不需要重做场景。 |
| **声音与字幕** | 为每个场景配旁白，并贴合该场景的时长。使用有授权的背景音乐，人声出现时自动压低。字幕可以来自旁白文本，也可以来自实测的逐词时间。剪辑点与节拍对齐。 |
| **生成镜头** | 用你配置的服务商生成图片、视频片段和出镜主播（口播），补上你的素材拍不到的镜头。只在你批准的花费范围内生成。 |

如果你要的是脚本或分镜，智能体交出文档就会停下；如果你要的是成片，它会一直做到交付。只有在你要求时，或视频长度超过约两分钟时，它才会先给你看方案或预览。由它撰写、需要视频逐字照念的脚本，会先给你过目；你自己提供的脚本，则按原文制作。

---

## 在 Claude Code 中做动态图形，无需 Team 套餐

Claude Motion 是 Anthropic 的动画功能，目前仅在 Claude Team 和 Enterprise 套餐中以 beta 形式提供。OrkasVideoStudio 让使用 Pro、Max、Ultra 套餐或 API Key 的 Claude Code 也能做出同类的代码构建动态图形：智能体把每个场景写成带动画的 HTML 和 CSS，检查抽样帧，并在你的电脑上渲染出 MP4，因此渲染本身不消耗 token。

1. [安装](#安装) OrkasVideoStudio，然后运行 `ovs skills --install --target claude`（Codex 则用 `--target codex`）。
2. 提出需求，例如：*“为我们的 App 发布做一条 20 秒、16:9 的动态图形视频：开场用动态文字展示产品名，接着三张功能卡片依次滑入，最后用一张结尾卡展示价格。渲染之前先给我看每个场景的静帧。”*
3. 你可以自己在场景文件或画布里改一个词、一种颜色或时间安排，也可以让智能体来改，然后重新渲染。

与 Claude Motion 不同，同一条时间线还能容纳你自己的素材、旁白、音乐和字幕。参见[对比一览](#对比一览)。

---

## 使用场景

每一行都是你可以对智能体说的一句提示词，由 `video-studio` 技能挑选工具。

### 广告与营销

| 你说…… | 智能体怎么做 |
|---|---|
| *“用这些照片和产品页面，给这款台灯做一条 20 秒的竖屏广告。”* | 导入照片，把价格和规格记录为有出处的事实，设计开场钩子、功能和价格场景，加上旁白和字幕，然后检查、渲染并交付。 |
| *“根据我们 App 的官网，做一条 30 秒的发布视频。”* | 在你的浏览器里截取真实的产品页面，使用产品自己的文案和界面，并围绕这些内容搭建场景，而不是用重新绘制的示意稿。 |
| *“做一条 30 秒的口播视频，由 AI 生成的主播介绍这款精华液。”* | 先写好独白，为虚构主播生成一张关键形象图并在每个片段中复用，再用你的视频服务商生成口播片段，价格和产品宣称保留为可编辑的屏幕文字。 |
| *“按这份脚本做一条 15 秒 9:16 的宣传片：开场用生成画面，功能亮点用设计动效，全片一条配音。”* | 一条时间线里同时包含生成的开场、设计好的功能场景和一条旁白音轨，成片在交付前会经过检查。 |

### 电影与剧集

| 你说…… | 智能体怎么做 |
|---|---|
| *“做一部一分钟的短片，讲一位夜班护士的故事，每个镜头里都是同样的两个角色。”* | 围绕一个戏剧性问题构建故事，为每个角色固定一句外貌描述和一张关键形象图，让角色在不同镜头间保持一致，并在你批准的预算内用你的视频服务商生成镜头。 |
| *“把这三集剧做成一段 3 分钟、带旁白的剧情回顾。”* | 转写各集内容，挑出推动剧情的场景，跳过演职员表和下集预告，撰写回顾解说并配音，再把你的素材剪辑到解说下面。 |
| *“为开场生成一个 5 秒的黎明城市镜头。”* | 先确认服务商、模型和费用，用你的视频服务商生成一个镜头，并把它放到时间线上你的素材旁边。 |

### 剪辑

| 你说…… | 智能体怎么做 |
|---|---|
| *“把这段 1 小时的录屏剪成三条 30 秒、带字幕的精彩片段。”* | 通过场景和画质分析找出好的部分。重复的镜次会被排序，静音段和语气词会被剪掉，字幕会按实测的逐词时间烧录进画面。 |
| *“把我这段摄像头录像里的静音和‘嗯’都清掉，剪得紧凑一些。”* | 检测静音间隙和语气词，做确定性的跳切，并为每一段删除的内容记录依据。 |
| *“给 product-demo.mp4 加上英文配音和字幕，并把响度调平。”* | 转写视频，逐句翻译并在对应画面的时间窗口内配音，把配音混到原有声音之上，烧录字幕并做响度标准化。 |
| *“把我们旅行拍的这 20 段素材，按这首曲子的节拍卡点剪辑。”* | 测量曲子的节拍，按节拍剪切片段，并检查交付文件的节拍对齐情况。 |

### 讲解与教程

| 你说…… | 智能体怎么做 |
|---|---|
| *“做一条 60 秒讲解向量数据库的视频，配中文旁白。”* | 编写动态图形场景，用你的 TTS 服务商合成旁白，并让每句旁白贴合对应的场景。 |
| *“把我录的设置页面录屏做成一条 90 秒的教程。”* | 修剪录屏，在真实界面上逐步标出每个控件，并加上旁白和字幕。 |

### 复刻爆款视频

| 你说…… | 智能体怎么做 |
|---|---|
| *“照这条爆款视频的结构和节奏，给我的产品做一条。先给我看方案。”* | 拆解参考视频，把它的叙事节点对应到你的素材上，等你批准后再开始制作。 |
| *“这条竞品广告效果很好。用我们的照片，做一条钩子和节奏都一样的。”* | 借用参考视频的钩子、证明环节和行动引导的节奏，而不是它的内容。每一条宣称都来自你的产品信息，每一个画面都来自你的素材。 |

给你的智能体一个**参考视频文件**，再加上你自己的产品素材、脚本或拍摄素材。你的智能体就能用 OrkasVideoStudio，为新内容复刻参考视频的**叙事结构、视觉风格和剪辑节奏**：

1. **分析参考视频**：检查抽样帧和相关音频，识别钩子、演示或证明环节、信息顺序、字体排版、转场、节奏和行动引导。
2. **规划改编方案**：说明哪些保留、哪些替换，然后把参考视频中的各个时刻对应到新的场景或时间线上。按你实际的旁白和阅读时长调整时间安排。
3. **制作与修改**：在需要时设计动态图形、剪辑你的素材，并生成缺少的画面。在本地制作的文字、字幕、旁白和片段都可以分别编辑。嵌在生成画面里的文字，只能通过修改那段画面来更改。

这种做法最适合动态图形讲解视频、SaaS 和 App 演示，以及用现有素材制作的产品广告。请从智能体能读取的文件开始，因为目前没有内置从社交平台分享链接下载的功能。不保证精确的运镜、真人表演或逐帧匹配。交付检查不会评估成片与参考视频有多接近。详情参见[参考复刻工作流](./packages/skills/video-craft/references/reference-recreation.md)。

---

## 安装

**前置条件**：Node ≥ 22、`pnpm`，以及 `PATH` 中可用的 `ffmpeg` + `ffprobe`。固定版本的 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 包会作为依赖安装，在无头 Chrome 中渲染页面，供检查和渲染使用；`npx` 只是兼容性兜底。生成功能是可选的，需要你自己的 Key。

### 从源码安装

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

npm 包尚未发布，所以目前请从源码安装。

---

## 从 Claude Code、Codex 或任何编程智能体驱动

`ovs` CLI 是主接口，MCP 工具与它一一对应。按你的智能体支持的方式任选其一：

**1) 原生技能（Claude Code / Codex）。** 安装技能包，智能体就能自己找到它：

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

同一个技能包也已在 [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) 上架，所以也可以用 `npx skills add orkas-ai/orkas-videostudio` 安装。这些技能会调用 `ovs` CLI，因此请先按上文说明安装它。

**2) MCP 工具。** 注册服务器：

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) 自描述 CLI（适用于任何能使用 shell 的智能体）。** 不需要加载器：

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

然后直接向智能体要视频即可。它会先读取 `video-studio`，再加载所需的阶段参考和制作技法参考。

---

## 制作项目如何运作

智能体会挑一个简短的文件夹名，把所有内容都放在里面：

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

场景顺序就是播放顺序。开始时间和总时长由场景计算得出，从不存储，所以移动场景不会让时间安排变得不一致。价格只在 `product.json` 中存一次，每个展示价格的场景都从那里读取。对于并行的变体，例如其他画幅比例、语言或 A/B 剪辑，智能体会添加更多共享同一批素材的视频 ID。参见[时间线契约](packages/skills/video-studio/references/timeline.md)。

一次典型的运行：

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` 会在记录最终文件之前先测量它：时长、画面规格、音频、响度和旁白覆盖情况。字幕警告会被标记出来，等待目视确认，同时返回实际 MP4 中的帧。每次交付都会成为一个不可变的版本。在最近一次修改之前完成的渲染会被视为过时而被拒绝，之前的交付也永远不会被覆盖。通过这些检查并不代表视觉质量合格。在有人真正看过这些帧之前，视觉审查都记为 `not_checked`。

当你明确接受某一条剩余的检查问题时，用 `--accept-findings '["CODE"]' --accept-reason '<your decision>'` 传入它的确切代码。该版本会记录这个决定，其他任何错误仍会阻止交付。写入操作通过 `.ovs-timeline.lock` 串行执行；如果程序崩溃后留下了这个文件，请先确认持有它的进程已经停止，再删除它。[时间线契约](packages/skills/video-studio/references/timeline.md)对这两点都有说明。

**修改成本低，并且在本地完成。** 改一个词、一处剪切、顺序、背景音乐或字幕，都是原地编辑。只有改动过的台词才会重新配音，只有出错的镜头才会重新生成，而且都在已批准的花费范围内。修改字幕文字不会改变语音音频。HyperFrames 每次都会渲染完整视频；这个可移植版本不会缓存已渲染的场景。

---

## 浏览器视频画布

当 `timeline import`、`timeline prepare`、`timeline render` 或 `timeline ship` 执行成功时（无论来自 CLI 还是 MCP），OVS 会在你的默认浏览器中打开该制作项目的画布。之后的命令会复用同一个标签页，而不会打开新的标签页。画布编辑的是与 CLI 和 MCP 相同的文件，所以修改是双向同步的。智能体工作期间，画布显示为只读状态。

在画布中你可以：

- **观看与导出**：播放视频，在已交付的各个版本之间切换，并下载你想要的那一版。
- **整理素材**：上传、拖入或粘贴素材，然后在画板上移动和连接卡片。
- **编辑场景**：修改文字、顺序和图片，添加、删除场景，或把删掉的场景放回来。
- **生成与重做镜头**：从一张卡片生成新的图片或视频镜头，或重新生成已有镜头。你可以选择参考素材或首尾帧，以及模型、分辨率和声音；模型不支持的选项会被禁用。你可以逐个翻看之前的结果，挑出要用的那一个。每次付费请求之前，它都会先询问你。
- **更新视频**：普通的场景编辑会在本地渲染并交付，进度显示在视频卡片上。修改产品信息、旁白台词或全片音色时，会生成一条交给智能体的请求，因为这些修改需要它来判断。如果交付检查因为场景中有静止画面而中止了更新，视频卡片会提供 **预览本版**、**返回编辑** 或 **仍然更新**；选择“仍然更新”会保留这次渲染结果，不再重新渲染。
- **告诉智能体**：针对某个场景、镜头、素材卡片或视频写一条简短的请求，它会连同那张卡片的上下文一起发送。

画布默认以中文打开。它的语言按钮可在中文和英文之间切换，并会记住你的选择。

### 把请求发回给你的智能体

**发送**只会投递到创建这个制作项目的那个对话。如果那个对话无法接收请求，草稿会留在画布中。请求不会被复制到剪贴板，不会自动重放，也不会发送到新的会话。即使没有连接智能体，编辑、更新和导出也都照常可用。

- **Codex**：当 `ovs` 在某个 Codex 对话线程中运行时，请求会排入同一个线程。这需要 Codex CLI 0.160.1 或更高版本，并且它的本地 app server 正在运行。已关闭或未加载的线程会显示为不可用。
- **Claude Code**：请求通过 MCP 通道（channel）送达，这是 Claude Code 的研究预览功能，普通的 MCP 连接并不够。用 `--claude-channel` 注册服务器，然后在启用通道的情况下启动 Claude Code：

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  请通过 `ovs` MCP 工具制作视频，这样打开的画布才会绑定到该通道。从 shell CLI 打开的画布无法连到 Claude Code。Claude Code 启动时会显示本地开发警告。通道需要 claude.ai 登录或 Console API Key，并且在 Team 和 Enterprise 套餐中，需要管理员先启用。参见 [Claude Code 通道文档](https://code.claude.com/docs/en/channels)。

### 自己打开一个制作项目

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

使用画布期间，请保持该命令运行。加上 `--agent` 时，画布会在制作文件夹中运行一个原生会话，使用你的 CLI 自己的登录、模型和权限设置。该会话需要 Codex 0.160.1+ 或 Claude Code 2.1.148+。它的权限确认和提问会显示在画布中。它会恢复该文件夹已保存的会话，除非你传入 `--resume <session-id>` 接管指定的会话，或传入 `--new-session` 重新开始。其他选项：

- `--no-open` 只打印访问链接，不打开浏览器。
- `--port` 指定回环端口。
- `--recover` 接管一个原所有者已退出的画布。

如需在制作过程中关闭自动打开，设置 `OVS_STUDIO_AUTO_OPEN=0`。在 CI 中它默认已关闭。

---

## 自带生成服务商

在 `~/.config/orkas-video-studio/config.json`（或 `$OVS_CONFIG_DIR/config.json`）中配置服务商，也可以用环境变量配置。环境变量会覆盖文件中的设置。

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| 能力 | `provider` 取值 | 环境变量 |
|---|---|---|
| 语音（`ovs speak`） | `openai`、`openai-compatible`、`doubao`、`minimax`、`aliyun`（Qwen / CosyVoice）、`google`、`elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| 图片（`ovs image`） | `openai`（任何 OpenAI 兼容端点，包括 Seedream）、`gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| 视频（`ovs video`） | `doubao`（Seedance）、`minimax`、`vidu`、`kling`、`google`（Veo）、`google-cloud`（Veo）、`runway`、`aliyun`（Wan）、`atlas`、`muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

你可以在不发起任何付费调用的情况下检查配置：

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

在语音合成前后都运行 `ovs narration fit`，确保每句旁白都落在其场景或方案的时间窗口内。视频生成接受明确的参考图、画幅比例、时长、分辨率和音频开关，因此对服务商的调用与已批准的方案一致。对于 `plan.json` 项目，`ovs plan validate` 还会在生成任何内容之前，对照已配置的 `video.provider` 检查每个生成片段的画幅比例、时长和操作类型。

有些服务商还需要额外几项设置：

- **Google Cloud Veo** 使用 `video.workspace_id`、`video.region`，以及放在 `video.api_key` 中的 API 令牌或服务账号 JSON。
- **阿里云**的语音在 `tts.base_url` 中使用其工作空间端点。Wan 视频需要 `video.workspace_id` 和 `video.region`。
- **仅限克隆的音色**需要你在服务商处注册的音色 ID。
- **WebSocket 语音**只有在你配置了 `tts.proxy_url` 时才会经由它连接。
- **视频参考素材**以公开的图片或视频 URL 传入。支持的数量以及是否支持首尾帧因模型而异。
- **[MuAPI](https://muapi.ai)** 必须通过 `video.provider: "muapi"` 显式选择。选中后，`MUAPI_API_KEY` 优先于 `OVS_VIDEO_API_KEY`；单凭这个 Key 永远不会自动选中 MuAPI。`video.model` / `OVS_VIDEO_MODEL` 支持已验证的 Kling v2.1 端点 `kling-v2.1-master-t2v`、`kling-v2.1-master-i2v`、`kling-v2.1-standard-i2v` 和 `kling-v2.1-pro-i2v`。其他模型标识会被直接拒绝，而不会带着不匹配的请求体发送出去。文生视频默认使用 `kling-v2.1-master-t2v`，带首帧 `image_url` 时默认使用 `kling-v2.1-master-i2v`。时长为 5 或 10 秒，画幅比例为 `16:9`、`9:16` 或 `1:1`。与服务商无关的 `resolution`、`generate_audio` 和 `quality` 输入仍与已签名的方案兼容：Kling 会忽略分辨率和音频，质量参数会被校验但不会发送。在支持对应的 MuAPI schema 之前，编辑和额外参考相关的控制项会被拒绝。默认 base URL 包含 `/api/v1`，自定义的 base URL 也必须包含它。提交与轮询的约定以及各模型的专属参数，参见 [MuAPI API 参考](https://muapi.ai/docs/api-reference)。

服务商模型目录描述的是各服务商的 API 约定，并不保证实时可用性或价格。

---

## 生成如何保持在可控范围内

只要你现有的素材能满足镜头需要，智能体就会使用它们，只生成缺少的部分。配置了凭据并不等于批准花费。在任何付费工作之前，智能体会确认服务商、模型、用途、包括重试在内的请求次数，以及预估费用，然后严格遵守这个范围。你拒绝后，该需求的付费调用就会停止；效果不好的镜头最多再重做两次，之后智能体会请你换一种做法。

每个付费请求都会在其输出旁边保留一份回执。结果未知的视频任务会阻止对同一输出的再次提交，直到你检查过它为止，而且它永远不会被自动重放。参见[生成授权规则](packages/skills/video-studio/references/generation.md)。

`ovs speak` 会在输出旁边写入一份请求和音频回执。它只会复用完全匹配、且音频字节完好的请求，所以请传入已批准的 `--language`、音色、模型、语速和格式；更改其中任何一项都会使复用失效。它还会在发出请求之前先占用输出，从而防止并发的重复调用。

没有托管的音乐服务。音乐来自你提供的有授权文件，智能体会记录每个文件的来源和许可。

---

## 命令参考

运行 `ovs <command> --help` 查看每个命令的类型化输入。MCP 工具使用同样的名称，只是改用下划线，例如 `timeline_prepare` 和 `edit_trim_silence`。

| 领域 | 命令 |
|---|---|
| 设置 | `doctor`、`skills [--install]`、`skill <name>` |
| 制作 | `timeline import · prepare · status · check · snapshot · render · ship`、`studio` |
| 剪辑（ffmpeg） | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| 分析 | `transcribe`、`phrases`、`silence`、`scenes`、`quality`、`beats`、`activity` |
| 旁白 | `narration timing · fit`、`speech-capabilities`、`speak` |
| 生成 | `image`、`image-prepare`、`video`、`video-models`、`video-params` |
| 早期项目 | `composition prepare · reconcile`、`plan validate · summarize · promise-check · rank-takes`、`draft`、`render`、`lint`、`check`、`snapshot`、`gate transition`、`inspect`（`check` 的别名） |

用早期 `plan.json` EDL 和 `composition-manifest.json` 格式构建的项目，仍可以通过“早期项目”中的命令继续使用。新工作使用场景时间线。对于组装完成的 `plan.json`，除了检查组成它的素材，还要验证最终文件：

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

等价的 MCP 工具 `plan_promise_check` 接受 `probe_produced` 和 `video`。它会测量时长、画面规格、音频、综合响度以及每句台词的有声片段。缺少旁白证据会导致检查失败；如果字幕已烧录进画面，字幕警告还需要目视检查。

---

## 对比一览

### OrkasVideoStudio 与 Claude Motion、CapCut、Higgsfield 对比

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **它是什么** | 由你的编程智能体驱动的开源视频工作室 | Claude 中的一种动画输出 | 字节跳动出品的视频编辑应用 | 托管式 AI 图片与视频平台 |
| **谁可以使用** | 任何人；在你的电脑上运行，配合 Claude Code、Codex、Cursor 或任何能运行 shell 或支持 MCP 的智能体 | Claude Team 和 Enterprise 套餐（beta） | 桌面、移动端和网页应用，有免费版和付费版 | Higgsfield 账号，免费或订阅月度积分套餐，可通过它的网页应用、API、MCP 连接器或 CLI 使用 |
| **如何编辑** | 向你的智能体描述修改，或在浏览器画布中修改文字、图片和场景顺序 | 在 Claude 的编辑器中修改，或直接让 Claude 修改 | 在时间线上手动编辑 | 在它的网页版 Studio 中为每次生成或编辑写提示词，或由你的智能体通过它的连接器发起 |
| **素材处理** | 修剪、拼接、重新构图为 9:16 / 1:1 / 16:9，删除静音段和语气词，按节拍剪辑 | 为文字、图表、形状和图片制作动画；不生成视频素材或人物 | 完整的手动剪辑 | 用 AI 编辑片段：移除或替换物体和背景、转换风格、重新构图、提升分辨率或延长镜头 |
| **动态图形** | HTML/CSS 场景：动态文字、价格卡、下三分之一字幕条、数据标注、转场 | 代码构建的讲解动画 | 模板、文字动画和特效 | 由它的 AI Motion Designer 在 After Effects 或 Premiere Pro 中制作的标题、转场和 Logo 出场动画 |
| **声音** | 按场景配旁白，人声出现时自动压低的背景音乐，基于实测逐词时间的字幕 | Anthropic 的帮助文章中未提及 | 应用内的配音、音乐和字幕工具 | AI 配音、语音翻译和口型同步 |
| **生成镜头** | 用你配置的服务商（例如 Seedance 2.5、Kling 4.0、Google Cloud 上的 Veo 3.1、Runway Gen-4.5 和 Wan 3.0）生成的图片、视频片段和出镜主播，按你自己的 Key 计费 | 无 | AI 视频生成器，可从一份脚本或一张图片开始 | 一个账号即可使用多种托管模型，包括 Seedance 2.5、Kling 4.0、Veo 3.1，以及只有 Higgsfield 提供的 MAGI-2 |
| **输出** | MP4，交付前检查时长、画面规格、响度和旁白 | 导出 MP4 | 导出 MP4 | 生成的片段和图片，以及用它的 Studio 应用制作的视频 |
| **源码** | MIT；每个视频都是你拥有的本地文件夹 | 专有、托管 | 专有 | 专有、托管 |

如果你想手动剪辑，选 **CapCut**，或者 Shotcut、Kdenlive 等开源时间线编辑器。如果你的团队已经在 Team 或 Enterprise 套餐上使用 Claude，并且需要讲解动画，选 **Claude Motion**。如果你想用一份账单使用多种托管模型，或者需要只有它提供的模型（例如 MAGI-2），选 **Higgsfield**。如果你希望由编程智能体用你自己的服务商 Key 完成整条视频，把素材、动态图形和声音放进同一条时间线，并把结果保留为可以检查、编辑和重新渲染的文件，选 **OrkasVideoStudio**。Higgsfield 和 OrkasVideoStudio 也可以配合使用：你在 Higgsfield 上生成的片段，对 OrkasVideoStudio 制作项目来说就是普通素材。以上信息来自 [Anthropic 帮助中心](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion)、[CapCut 的 AI 视频生成器页面](https://www.capcut.com/tools/ai-video-generator)和 [higgsfield.ai](https://higgsfield.ai/)，截至 2026 年 11 月。

---

## 常见问题（FAQ）

### Claude Code 能做视频吗？

能。安装 OrkasVideoStudio 后，Claude Code 会读取 `video-studio` 技能，并使用 `ovs` CLI 或 MCP 工具剪辑素材、制作动态图形、加上旁白和字幕，然后在你的电脑上渲染出一个经过检查的 MP4。Codex、Cursor 以及其他任何能运行 shell 或支持 MCP 的智能体，用法都一样。参见[从 Claude Code、Codex 或任何编程智能体驱动](#从-claude-codecodex-或任何编程智能体驱动)。

### 是免费的吗？需要 API Key 吗？

OrkasVideoStudio 免费，采用 MIT 许可证。剪辑、设计动态图形、字幕和转写都在本地运行，不需要 API Key。生成图片、视频片段或语音是可选的，使用你自己的服务商账号，由服务商直接向你计费。在任何付费调用之前，智能体都会先和你确认服务商、模型、请求次数和预估费用。参见[生成如何保持在可控范围内](#生成如何保持在可控范围内)。

### 它是 Claude Motion、CapCut 和 Higgsfield 的开源替代方案吗？

是的。和 Claude Motion 一样，它让 Claude Code 用代码编写动态图形；但它支持使用 Pro、Max、Ultra 套餐或 API Key 的 Claude Code，而不仅限于 Team 和 Enterprise 套餐，也支持其他智能体。与 CapCut 不同，修改由你的智能体根据你的描述完成，而不是由你在时间线上手动剪辑。与 Higgsfield 不同，它不托管模型，也不出售积分：你的智能体用你自己的 Key 调用 Seedance、Kling、Veo 等视频模型，再把这些镜头与你的素材、动态图形、旁白和字幕组合起来。参见[对比一览](#对比一览)。

### 能剪辑我已有的素材吗？

能。它可以修剪和拼接片段，重新构图为 9:16、1:1 或 16:9，删除静音段和语气词，按节拍剪辑，烧录字幕并做响度标准化。你的素材与动态图形、生成镜头放在同一条时间线中。

### 支持哪些视频、图片和语音模型？

视频：Seedance、Kling、Veo（通过 Google 或 Google Cloud）、Runway、Wan、MiniMax 和 Vidu，以及 Atlas 和 MuAPI。图片：Gemini，以及 OpenAI 或任何 OpenAI 兼容端点，包括 Seedream。语音：OpenAI、豆包、MiniMax、阿里云（Qwen 和 CosyVoice）、Google、ElevenLabs 和 OpenAI 兼容端点。它们全部使用你自己的 Key。参见[自带生成服务商](#自带生成服务商)。

### 怎么安装？

从源码安装：克隆仓库，运行 `pnpm install && pnpm build`，然后用 `ovs doctor` 检查你的环境。你需要 Node 22 或更高版本、pnpm，以及 ffmpeg 和 ffprobe。npm 包尚未发布。参见[安装](#安装)。

---

## 与 Orkas 的关系

OrkasVideoStudio 最初是内置于 **[Orkas](https://orkas.ai?source=gh-orkas-vs) 的视频智能体**；Orkas 是一款 AI 团队桌面应用。它先在 Orkas 中经过了端到端的验证，随后被抽离成这个不绑定特定智能体、采用 MIT 许可证的工具包。

- **在 Orkas 中**，它作为[内置智能体](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs)提供，无需单独安装。你在桌面应用里而不是终端里与它对话，生成可以使用 Orkas 内置模型（新账号赠送 500 积分），也可以使用你自己的 Key。可[下载 Orkas](https://orkas.ai/download/?source=gh-orkas-vs) 的 macOS 或 Windows 版。
- **在其他任何地方**，你可以按上文说明把它安装到你自己的编程智能体中，通过 `ovs` CLI、MCP 服务器和画布获得同样的核心能力。Orkas 的账号功能，例如托管服务商、积分和对话发布，不包含在本仓库中。

链接：**[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[本仓库](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## 软件包

| 包 | 内容 |
|---|---|
| `@orkas/video-studio-core` | 场景时间线与旧版 EDL schema、交付检查、决策辅助函数、旁白时间计算、运行时与配置 |
| `@orkas/video-studio-tools` | 时间线、渲染、剪辑、分析、语音、图片和视频的后端，以及浏览器画布 |
| `@orkas/video-studio` | `ovs` CLI |
| `@orkas/video-studio-mcp` | MCP 服务器（`ovs-mcp`），与 CLI 一一对应 |
| `@orkas/video-studio-skills` | 不绑定宿主的 `SKILL.md` 知识包 |

技术方案及其历史见 [`PLAN.md`](./PLAN.md)。面向在本仓库中工作的编程智能体的说明见 [`AGENTS.md`](./AGENTS.md)。

---

## 开发

```bash
pnpm install
pnpm build            # tsc per package (core → tools → cli / mcp)
pnpm typecheck
pnpm test             # vitest
pnpm benchmark        # zero-key core correctness + throughput floors
pnpm test:video       # mock provider round-trip → real playable MP4 → ffprobe
pnpm test:video:e2e   # real three-scene production through the built CLI, plus CLI/MCP smoke
pnpm verify           # everything above; also the CI entry point
```

`pnpm install` 会应用 [`patches/`](./patches/) 中带版本的 HyperFrames 补丁，让 SDR H.264/H.265 输出使用其元数据所声明的 BT.709 矩阵。外部的 `OVS_HYPERFRAMES_BIN` 或 `npx` 兼容性兜底不会带上这个补丁，因此那个运行时必须包含等效的色彩修复。 该补丁也会保留 Whisper 中文和日文转写中的词级时间戳。外部运行时需要提供同等支持。

`test:video` 从不消耗服务商的付费额度。一个本地的模拟 Seedance 端点会返回真实的 H.264 测试样片，OVS 会下载它并用 `ffprobe` 验证。

`test:video:e2e` 会通过构建好的 CLI 覆盖两条制作路径：

- **早期的合成路径**：制作一个 9 秒、三个场景的 1080p 视频，涵盖 composition prepare/reconcile、快照、完整的草稿关卡、字幕烧录和最终文件的承诺检查。它会解码整个 MP4，检查场景顺序、可见的运动、每个场景中可听见的音频和烧录字幕的像素，并检查错误的交付时长会被拒绝。
- **当前的场景时间线**：通过真实的 HyperFrames 检查与快照路径渲染一条三个场景的时间线。它会检查场景颜色、编写的动效、解码后源视频的运动、字幕像素、音频、不可变交付，以及过时渲染的拒绝。

它还会测试构建好的 CLI 和 MCP 接口。缺少必需的运行时时，两个视频命令都会失败，并给出可据此处理的错误信息。在没有 ffmpeg 或浏览器的机器上，普通测试套件可能会跳过依赖较重运行时的用例。

`pnpm verify` 必须在任何 Git 提交或 PR 之前，在最终候选版本上通过。它包含真实的制作用例，也是 CI 的入口；仅涉及测试的改动也遵循同样的规则。进行同步或发布审查时，请保留并检查生成的视频、预览、最终帧和报告：

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

证据目录需要主动开启，每次运行都使用各自的子目录。普通的 CI 运行会清理临时媒体文件。测试夹具使用原创的 HTML/SVG 和本地生成的纯音乐音频。它们不调用付费服务商，也不声称覆盖 TTS 或模型质量。

`pnpm benchmark` 无需 Key，且结果是确定性的。它会构建 core 包，验证基准测试夹具，然后测量关卡切换、EDL 校验与交付摘要、composition-manifest 校验以及旁白估算。每组测试都设有刻意保守的吞吐量下限，因此大的性能退化会失败，而正常的机器差异不会。

设置方法、运行命令和证据保存规则见[可选模型评测指南](./eval/video/README.md)（英文）。

## 版本

所有包共用一个日历版本号 `YYYY.M.D`（按 Asia/Shanghai 日期，不补零）。打标签的发布使用 `v<version>`，并以 [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) 的形式发布；已发布的日期版本永远不会被覆盖。变更记录见 [CHANGELOG.md](CHANGELOG.md)。这个版本号独立于 Orkas 桌面应用及其市场智能体的版本。

## 许可证

MIT —— 参见 [`LICENSE`](./LICENSE)。渲染使用以 Apache-2.0 许可证发布的 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 依赖。剪辑和媒体检查使用你系统中的 `ffmpeg`，转写交由 HyperFrames / whisper.cpp 完成。[`PLAN.md`](./PLAN.md) 说明了如何查找第三方运行时，并附有许可说明。
