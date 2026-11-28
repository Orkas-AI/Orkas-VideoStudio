# OrkasVideoStudio

> OrkasVideoStudio 是一款開源的 AI 影片編輯器，能把你的程式設計智能體變成影片工作室。向 Claude Code、Codex、Cursor，或任何能執行 shell 或支援 MCP 的智能體要一支成品影片：它會剪輯你的素材，設計動態圖形，加上旁白、音樂與字幕，用你自己的 Key 生成缺少的鏡頭，並交付一個經過檢查的 MP4。之後你還能在瀏覽器畫布中繼續編輯這個 MP4。

**Claude Motion、CapCut 與 Higgsfield 的開源替代方案，由你已在使用的程式設計智能體驅動。** 採用 MIT 授權、本地優先，不需要 Claude Team 或 Enterprise 方案，也不必訂閱影片平台：生成的鏡頭來自 Seedance、Kling、Veo 等影片模型，使用你自己的 Key。[比較一覽 ↓](#orkasvideostudio-與-claude-motioncapcut-比較) · [與 Higgsfield 比較 ↓](#orkasvideostudio-與-higgsfield-比較)

**比起程式設計智能體，更想用應用程式？** OrkasVideoStudio 也是 **[Orkas](https://orkas.ai/?source=gh-orkas-vs)** 內建的影片智能體；Orkas 是一款適用於 macOS 與 Windows 的免費 AI 團隊桌面應用程式。在對話中描述你想要的影片即可；生成可以使用 Orkas 的內建模型（新帳號贈送 500 積分），也可以使用你自己的 Key。**[下載 Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [兩者的關係 ↓](#與-orkas-的關係)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*上方這段 54 秒的概覽影片，展示了一份需求如何變成一支成品影片：剪輯真實素材，設計動態圖形，加上配音、音樂與字幕，在畫布上嘗試不同的鏡頭，接著修改文字、替換鏡頭或調整場景順序。*

OrkasVideoStudio **不是黑盒式的影片智能體**。思考由你的智能體負責；這個專案則提供它無法臨場即興發揮的部分：

- **影片專業知識**：一套不綁定特定宿主的 `SKILL.md` 技能包，入口技能是 `video-studio`。內容涵蓋何時該提問、何時直接進行，廣告、解說影片、產品展示、音樂剪輯、主持人出鏡影片、短片與評論影片各有什麼不同，以及在宣告完成之前如何檢查剪輯成果。
- **確定性工具**：`ovs` CLI，以及一個與它一一對應的 MCP 伺服器。它們涵蓋製作時間軸、ffmpeg 剪輯、轉錄、素材分析，以及透過你自己的服務商帳號進行的生成。[HyperFrames](https://github.com/heygen-com/hyperframes) 負責頁面渲染與影格擷取；`ffmpeg` 負責剪輯與量測。
- **可編輯的製作專案**：每支影片都是一個普通的資料夾，內含場景時間軸（`videos/main/manifest.json`）、素材清冊、附出處的產品資訊，以及一個選用的設計頁面。你、你的智能體與瀏覽器畫布編輯的是同一批檔案。改一行文字、換一張圖片或調整場景順序，再重新渲染即可。

剪輯、設計動態圖形、字幕與轉錄都**不需要 API Key**。圖片、影片與語音生成需自行啟用，並使用**你自己的**服務商帳號。沒有託管後端，也不需要建立帳號。

---

## 你可以提出哪些需求

你只要提出一次需求，就能拿到一支成品影片。智能體會把這項需求用到的各種能力，組合進同一條時間軸：

| 能力 | 涵蓋內容 |
|---|---|
| **剪輯實拍素材** | 修剪、串接、重新構圖為 9:16 / 1:1 / 16:9，保留或混合片段原音，疊加畫面，內嵌字幕並進行響度正規化。面對長時間的錄影，它還能找出精華片段、為重複的鏡次排序、移除靜音或贅詞，並為每一刀剪接記錄依據。 |
| **設計動態圖形** | 以 HTML/CSS 加上動畫建構場景：動態文字、價格卡、下三分之一字卡、資料標註與轉場。可編輯的文字放在具名的文字欄位中，因此修改文案絕不需要重做場景。 |
| **聲音與字幕** | 為每個場景配上旁白，並配合該場景的長度。使用已授權的背景音樂，人聲出現時自動降低音量。字幕可以來自旁白文字，也可以來自實測的逐字時間。剪接點對齊節拍。 |
| **生成鏡頭** | 用你設定的服務商生成圖片、影片片段與出鏡主持人（口播），補上你的素材拍不到的鏡頭。只會在你核准的花費範圍內生成。 |

如果你要的是腳本或分鏡，智能體交出文件就會停下；如果你要的是成品影片，它會一路做到交付。只有在你要求，或影片長度超過約兩分鐘時，它才會先給你看計畫或預覽。由它撰寫、需讓影片逐字照念的腳本，會先給你過目；你自己提供的腳本，則照原文製作。

---

## 在 Claude Code 中製作動態圖形，不需要 Team 方案

Claude Motion 是 Anthropic 的動畫功能，目前僅在 Claude Team 與 Enterprise 方案中以 beta 版提供。OrkasVideoStudio 讓使用 Pro、Max、Ultra 方案或 API Key 的 Claude Code，也能製作同類型、以程式碼建構的動態圖形：智能體把每個場景寫成帶有動畫的 HTML 與 CSS，檢查取樣影格，並在你的電腦上渲染出 MP4，因此渲染本身不耗用 token。

1. [安裝](#安裝) OrkasVideoStudio，然後執行 `ovs skills --install --target claude`（Codex 請改用 `--target codex`）。
2. 提出需求，例如：*「幫我們的 App 發表做一支 20 秒、16:9 的動態圖形影片：開場用動態文字呈現產品名稱，接著三張功能卡片依序滑入，最後用一張結尾卡顯示價格。渲染之前先讓我看每個場景的靜態畫面。」*
3. 你可以自己在場景檔案或畫布中修改一個字、一種顏色或時間安排，也可以請智能體修改，然後重新渲染。

與 Claude Motion 不同，同一條時間軸還能容納你自己的素材、旁白、音樂與字幕。請參閱[比較一覽](#orkasvideostudio-與-claude-motioncapcut-比較)。

---

## 使用情境

每一列都是你可以對智能體說的提示詞，由 `video-studio` 技能挑選工具。

### 廣告與行銷

| 你說…… | 智能體怎麼做 |
|---|---|
| *「用這些照片和產品頁面，幫這盞檯燈做一支 20 秒的直式廣告。」* | 匯入照片，把價格與規格記錄為附出處的事實，設計開場鉤子、功能與價格場景，加上旁白與字幕，然後檢查、渲染並交付。 |
| *「根據我們 App 的官網，做一支 30 秒的發表影片。」* | 在你的瀏覽器中擷取真實的產品頁面，沿用產品本身的文案與畫面，並以這些內容為核心建構場景，而不是使用重新繪製的示意稿。 |
| *「做一支 30 秒的主持人影片，由 AI 生成的主持人介紹這款精華液。」* | 先寫好獨白，為虛構的主持人製作一張關鍵形象圖並在每個片段中沿用，再用你的影片服務商生成說話片段，並將價格與產品宣稱保留為可編輯的畫面文字。 |
| *「照這份腳本做一支 15 秒 9:16 的宣傳影片：開場用生成畫面，功能重點用設計的動態圖形，配一條旁白。」* | 一條時間軸結合生成的開場、設計好的功能場景與單一旁白音軌，完成的檔案在交付前會先經過檢查。 |

### 電影與戲劇

| 你說…… | 智能體怎麼做 |
|---|---|
| *「做一部一分鐘的短片，講一位夜班護理師的故事，每個鏡頭裡都是同樣的兩個角色。」* | 圍繞單一戲劇性問題建構故事，為每個角色固定一句外貌描述與一張關鍵形象圖，讓角色在各鏡頭間保持一致，並在你核准的預算內用你的影片服務商生成鏡頭。 |
| *「把這三集劇做成一段 3 分鐘、附旁白的劇情回顧。」* | 轉錄各集內容，挑出撐起劇情的場景，略過演職員名單與下集預告，撰寫回顧旁白並配音，再把你的素材剪接在旁白底下。 |
| *「幫開場生成一個 5 秒的黎明城市鏡頭。」* | 先確認服務商、模型與費用，用你的影片服務商生成一個鏡頭，並放到時間軸上你的素材旁邊。 |

### 剪輯

| 你說…… | 智能體怎麼做 |
|---|---|
| *「把這段 1 小時的螢幕錄影剪成三支 30 秒、附字幕的精華片段。」* | 透過場景與畫質分析找出精彩的部分。重複的鏡次會經過排序，靜音與贅詞會被剪掉，字幕則依實測的逐字時間內嵌進畫面。 |
| *「把我這段網路攝影機錄影裡的靜音和『嗯』都清掉，剪得緊湊一點。」* | 偵測靜音空檔與贅詞，進行確定性的跳接剪輯，並為每一段被移除的內容記錄依據。 |
| *「幫 product-demo.mp4 加上英文配音與字幕，並把響度調勻。」* | 轉錄影片，逐句翻譯並在對應畫面的時間範圍內配音，把配音混在原有聲音之上，內嵌字幕並進行響度正規化。 |
| *「把我們旅行拍的這 20 段影片，配合這首曲子的節拍剪輯。」* | 量測曲子的節拍，依節拍剪接片段，並檢查交付檔案的節拍對齊情形。 |

### 解說與教學

| 你說…… | 智能體怎麼做 |
|---|---|
| *「做一支 60 秒介紹向量資料庫的解說影片，配中文旁白。」* | 撰寫動態圖形場景，用你的 TTS 服務商合成旁白，並讓每句旁白配合對應的場景。 |
| *「把我錄的設定頁面螢幕錄影做成一支 90 秒的教學影片。」* | 修剪錄影，在真實介面上逐步標出每個控制項，並加上旁白與字幕。 |

### 復刻熱門影片

| 你說…… | 智能體怎麼做 |
|---|---|
| *「照這支爆紅影片的結構與節奏，幫我的產品做一支。先給我看計畫。」* | 拆解參考影片，把它的敘事節點對應到你的素材，等你核准後才開始製作。 |
| *「這支競爭對手的廣告成效很好。用我們的照片，做一支鉤子和節奏都一樣的。」* | 借用參考影片的鉤子、佐證與行動呼籲節奏，而不是它的內容。每項宣稱都來自你的產品資訊，每個畫面都來自你的素材。 |

給你的智能體一個**參考影片檔案**，以及你自己的產品素材、腳本或拍攝素材。你的智能體就能用 OrkasVideoStudio，為新內容復刻參考影片的**敘事結構、視覺風格與剪輯節奏**：

1. **分析參考影片**：檢查取樣影格與相關音訊，找出鉤子、示範或佐證、資訊順序、字體排版、轉場、節奏與行動呼籲。
2. **規劃改編方式**：說明哪些保留、哪些替換，再把參考影片中的各個時刻對應到新的場景或時間軸。依你實際的旁白與閱讀時間調整時間安排。
3. **製作與修改**：視需要製作動態圖形、剪輯你的素材，並生成缺少的畫面。在本地製作的文字、字幕、旁白與片段都能分別編輯。嵌在生成畫面裡的文字，只能透過修改那段畫面來變更。

這種做法最適合動態圖形解說影片、SaaS 與 App 展示，以及用既有素材製作的產品廣告。請從智能體讀得到的檔案開始，因為目前沒有內建從社群平台分享連結下載的功能。不保證能精確重現運鏡、真人表演或逐格對應。交付檢查不會評分成品與參考影片的相似程度。詳情請參閱[參考復刻工作流程](./packages/skills/video-craft/references/reference-recreation.md)。

---

## 安裝

**前置需求**：Node ≥ 22、`pnpm`，以及 `PATH` 中可用的 `ffmpeg` + `ffprobe`。固定版本的 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 套件會作為相依套件安裝，並在無頭 Chrome 中渲染頁面，供檢查與渲染使用；`npx` 只是相容性備援。生成功能為選用，需要你自己的 Key。

### 從原始碼安裝

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

npm 套件尚未發布，因此目前請先從原始碼安裝。

---

## 從 Claude Code、Codex 或任何程式設計智能體驅動

`ovs` CLI 是主要介面，MCP 工具與它一一對應。依你的智能體支援的方式擇一使用：

**1) 原生技能（Claude Code / Codex）。** 安裝技能包後，智能體就能自行找到它：

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

同一個技能包也已在 [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) 上架，因此也可以用 `npx skills add orkas-ai/orkas-videostudio` 安裝。這些技能會呼叫 `ovs` CLI，所以請先依上述說明安裝它。

**2) MCP 工具。** 註冊伺服器：

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) 自我描述的 CLI（適用於任何能使用 shell 的智能體）。** 不需要載入器：

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

接著直接向你的智能體要影片即可。它會先讀取 `video-studio`，再載入所需的階段參考與製作技法參考。

---

## 製作專案如何運作

智能體會挑一個簡短的資料夾名稱，把所有內容都放在裡面：

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

場景順序就是播放順序。開始時間與總長度由場景計算而來，從不儲存，因此移動場景不會讓時間安排變得不一致。價格只在 `product.json` 中存放一次，所有顯示價格的場景都從那裡讀取。若要製作平行變體，例如其他畫面比例、語言或 A/B 剪輯，智能體會新增更多共用同一批素材的影片 ID。請參閱[時間軸契約](packages/skills/video-studio/references/timeline.md)。

一次典型的執行流程：

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` 會在記錄最終檔案之前先量測它：長度、畫面規格、音訊、響度與旁白涵蓋率。字幕警告會被標記出來等待目視確認，同時回傳實際 MP4 的影格。每次交付都會成為一個不可變的版本。在最新一次修改之前完成的渲染會被視為過時而遭到拒絕，先前的交付也絕不會被覆寫。通過這些檢查並不代表視覺品質合格。在有人實際看過這些影格之前，視覺審查都記為 `not_checked`。

當你明確接受某一項尚未解決的檢查問題時，用 `--accept-findings '["CODE"]' --accept-reason '<your decision>'` 傳入它的確切代碼。該版本會記錄這個決定，其他任何錯誤仍會阻擋交付。寫入作業透過 `.ovs-timeline.lock` 依序進行；如果程式崩潰後留下這個檔案，請先確認持有它的處理程序已經停止，再將它刪除。[時間軸契約](packages/skills/video-studio/references/timeline.md)對這兩點都有說明。

**修改成本低，而且都在本地完成。** 改一個字、一處剪接、順序、背景音樂或字幕，都是直接就地編輯。只有改過的台詞才會重新配音，只有有問題的鏡頭才會重新生成，而且都在已核准的花費範圍內。編輯字幕文字不會改變語音音訊。HyperFrames 每次都會渲染整支影片；這個可攜式版本不會快取已渲染的場景。

---

## 瀏覽器影片畫布

當 `timeline import`、`timeline prepare`、`timeline render` 或 `timeline ship` 執行成功時（無論來自 CLI 或 MCP），OVS 會在你的預設瀏覽器中開啟該製作專案的畫布。之後的指令會沿用同一個分頁，而不會開啟新分頁。畫布編輯的檔案與 CLI 和 MCP 相同，因此變更會雙向同步。智能體工作期間，畫布會顯示為唯讀狀態。

在畫布中你可以：

- **觀看與匯出**：播放影片、在已交付的各個版本之間切換，並下載你想要的那一版。
- **整理素材**：上傳、拖放或貼上素材，然後在畫布上移動與連接卡片。
- **編輯場景**：修改文字、順序與圖片，新增、移除場景，或把移除的場景放回來。
- **生成與重做鏡頭**：從一張卡片生成新的圖片或影片鏡頭，或重新生成既有的鏡頭。你可以選擇參考素材或首尾影格，以及模型、解析度與聲音；模型無法支援的選項會停用。你可以逐一瀏覽先前的結果，挑出要使用的那一個。每次付費請求之前，它都會先詢問你。
- **更新影片**：一般的場景編輯會在本地渲染並交付，進度顯示在影片卡片上。修改產品資訊、旁白台詞或全片音色時，會產生一則交給智能體的請求，因為這些修改需要它的判斷。如果交付檢查因場景中有靜止畫面而中止更新，影片卡片會提供 **預覽本版**、**返回編輯** 或 **仍然更新**；選擇「仍然更新」會保留這次的渲染結果，不再重新渲染。
- **告訴智能體**：針對某個場景、鏡頭、素材卡片或影片寫一則簡短的請求，它會連同該卡片的上下文一起送出。

畫布預設以中文開啟。它的語言按鈕可在中文與英文之間切換，並會記住你的選擇。

### 把請求傳回你的智能體

**發送**只會送達建立這個製作專案的那個對話。如果該對話無法接收請求，草稿會留在畫布中。請求不會被複製到剪貼簿、不會自動重送，也不會傳送到新的工作階段。即使沒有連接智能體，編輯、更新與匯出都能照常運作。

- **Codex**：當 `ovs` 在某個 Codex 對話串中執行時，請求會排入同一個對話串。這需要 Codex CLI 0.160.1 或更新版本，且其本地 app server 正在執行。已關閉或未載入的對話串會顯示為無法使用。
- **Claude Code**：請求透過 MCP 頻道（channel）送達，這是 Claude Code 的研究預覽功能，一般的 MCP 連線並不足夠。以 `--claude-channel` 註冊伺服器，然後在啟用頻道的情況下啟動 Claude Code：

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  請透過 `ovs` MCP 工具製作影片，這樣開啟的畫布才會綁定到該頻道。從 shell CLI 開啟的畫布無法連到 Claude Code。Claude Code 啟動時會顯示本地開發警告。頻道需要 claude.ai 登入或 Console API Key，而且在 Team 與 Enterprise 方案中，必須先由管理員啟用。請參閱 [Claude Code 頻道說明](https://code.claude.com/docs/en/channels)。

### 自行開啟製作專案

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

使用畫布期間，請讓該指令持續執行。加上 `--agent` 時，畫布會在製作資料夾中執行一個原生工作階段，使用你的 CLI 本身的登入、模型與權限設定。該工作階段需要 Codex 0.160.1+ 或 Claude Code 2.1.148+。它的權限提示與提問會顯示在畫布中。它會還原該資料夾已儲存的工作階段，除非你傳入 `--resume <session-id>` 接手指定的工作階段，或傳入 `--new-session` 重新開始。其他選項：

- `--no-open` 只印出存取連結，不開啟瀏覽器。
- `--port` 指定本機迴路（loopback）連接埠。
- `--recover` 接管前一個擁有者已結束的畫布。

若要在製作過程中關閉自動開啟，請設定 `OVS_STUDIO_AUTO_OPEN=0`。在 CI 中它預設已關閉。

---

## 自備生成服務商

在 `~/.config/orkas-video-studio/config.json`（或 `$OVS_CONFIG_DIR/config.json`）中設定服務商，也可以使用環境變數。環境變數會覆寫檔案中的設定。

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| 能力 | `provider` 值 | 環境變數 |
|---|---|---|
| 語音（`ovs speak`） | `openai`、`openai-compatible`、`doubao`、`minimax`、`aliyun`（Qwen / CosyVoice）、`google`、`elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| 圖片（`ovs image`） | `openai`（任何 OpenAI 相容端點，包括 Seedream）、`gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| 影片（`ovs video`） | `doubao`（Seedance）、`minimax`、`vidu`、`kling`、`google`（Veo）、`google-cloud`（Veo）、`runway`、`aliyun`（Wan）、`atlas`、`muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

你可以在不發出任何付費呼叫的情況下檢查設定：

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

在語音合成前後都執行 `ovs narration fit`，讓每句旁白都落在對應場景或計畫的時間範圍內。影片生成會接收明確的參考圖片、畫面比例、長度、解析度與音訊參數，讓對服務商的呼叫與已核准的計畫一致。對於 `plan.json` 專案，`ovs plan validate` 也會在生成任何內容之前，依已設定的 `video.provider` 檢查每個生成片段的畫面比例、長度與操作類型。

有些服務商還需要額外幾項設定：

- **Google Cloud Veo** 使用 `video.workspace_id`、`video.region`，以及放在 `video.api_key` 中的 API 權杖或服務帳戶 JSON。
- **阿里雲**的語音服務在 `tts.base_url` 中使用其工作空間端點。Wan 影片需要 `video.workspace_id` 與 `video.region`。
- **僅限複製的音色**需要你在服務商註冊的音色 ID。
- **WebSocket 語音**只有在你設定了 `tts.proxy_url` 時才會經由它連線。
- **影片參考素材**以公開的圖片或影片 URL 傳入。支援的數量與是否支援首尾影格，依模型而異。
- **[MuAPI](https://muapi.ai)** 必須透過 `video.provider: "muapi"` 明確選取。選取後，`MUAPI_API_KEY` 的優先順序高於 `OVS_VIDEO_API_KEY`；光有這個 Key 絕不會自動選取 MuAPI。`video.model` / `OVS_VIDEO_MODEL` 支援已驗證的 Kling v2.1 端點 `kling-v2.1-master-t2v`、`kling-v2.1-master-i2v`、`kling-v2.1-standard-i2v` 與 `kling-v2.1-pro-i2v`。其他模型識別碼會直接遭到拒絕，而不會帶著不相符的請求主體送出。文字生成影片預設使用 `kling-v2.1-master-t2v`，帶有首影格 `image_url` 時預設使用 `kling-v2.1-master-i2v`。長度為 5 或 10 秒，畫面比例為 `16:9`、`9:16` 或 `1:1`。與服務商無關的 `resolution`、`generate_audio` 與 `quality` 輸入仍與已簽署的計畫相容：Kling 會忽略解析度與音訊，品質參數會經過驗證但不會送出。在支援對應的 MuAPI schema 之前，編輯與額外參考素材相關的控制項都會遭到拒絕。預設的 base URL 包含 `/api/v1`，自訂的 base URL 也必須包含它。提交與輪詢的流程約定以及各模型的專屬參數，請參閱 [MuAPI API 參考文件](https://muapi.ai/docs/api-reference)。

服務商的模型目錄描述的是各服務商的 API 約定，並不保證即時可用性或價格。

---

## 如何讓生成維持在可控範圍內

只要你現有的素材能滿足鏡頭需要，智能體就會使用它們，只生成缺少的部分。設定好憑證不等於核准花費。在任何付費工作之前，智能體會確認服務商、模型、用途、包含重試在內的請求次數，以及預估費用，然後嚴格遵守這個範圍。你拒絕後，該需求的付費呼叫就會停止；效果不佳的鏡頭最多再重做兩次，之後智能體會請你改變做法。

每個付費請求都會在其輸出旁保留一份收據。結果不明的影片任務會阻擋對同一輸出的再次送出，直到你檢查過為止，而且絕不會被自動重送。請參閱[生成授權規則](packages/skills/video-studio/references/generation.md)。

`ovs speak` 會在輸出旁寫入一份請求與音訊收據。它只會重用完全相符、且音訊位元組完好的請求，因此請傳入已核准的 `--language`、音色、模型、語速與格式；變更其中任何一項都會讓重用失效。它也會在送出請求之前先佔用輸出，避免同時發生重複呼叫。

沒有託管的音樂服務。音樂來自你提供的已授權檔案，智能體會記錄每個檔案的來源與授權。

---

## 指令參考

執行 `ovs <command> --help` 查看各指令的具型別輸入。MCP 工具使用相同的名稱，只是改用底線，例如 `timeline_prepare` 與 `edit_trim_silence`。

| 類別 | 指令 |
|---|---|
| 設定 | `doctor`、`skills [--install]`、`skill <name>` |
| 製作 | `timeline import · prepare · status · check · snapshot · render · ship`、`studio` |
| 剪輯（ffmpeg） | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| 分析 | `transcribe`、`phrases`、`silence`、`scenes`、`quality`、`beats`、`activity` |
| 旁白 | `narration timing · fit`、`speech-capabilities`、`speak` |
| 生成 | `image`、`image-prepare`、`video`、`video-models`、`video-params` |
| 舊版專案 | `composition prepare · reconcile`、`plan validate · summarize · promise-check · rank-takes`、`draft`、`render`、`lint`、`check`、`snapshot`、`gate transition`、`inspect`（`check` 的別名） |

以舊版 `plan.json` EDL 與 `composition-manifest.json` 格式建立的專案，仍可透過「舊版專案」中的指令繼續使用。新的工作使用場景時間軸。對於已組裝完成的 `plan.json`，除了驗證組成它的素材，也要驗證最終檔案：

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

對應的 MCP 工具 `plan_promise_check` 接受 `probe_produced` 與 `video`。它會量測長度、畫面規格、音訊、整合響度，以及每句台詞的有聲片段。缺少旁白證據會使檢查失敗；如果字幕已內嵌進畫面，字幕警告還需要目視檢查。

---

## 比較一覽

### OrkasVideoStudio 與 Claude Motion、CapCut 比較

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **它是什麼** | 由你的程式設計智能體驅動的開源影片工作室 | Claude 中的一種動畫輸出 | 字節跳動推出的影片編輯應用程式 |
| **誰能使用** | 任何人；在你的電腦上執行，搭配 Claude Code、Codex、Cursor，或任何能執行 shell 或支援 MCP 的智能體 | Claude Team 與 Enterprise 方案（beta） | 桌面、行動裝置與網頁應用程式，有免費與付費方案 |
| **如何編輯** | 向你的智能體描述修改，或在瀏覽器畫布中修改文字、圖片與場景順序 | 在 Claude 的編輯器中修改，或直接請 Claude 修改 | 在時間軸上手動編輯 |
| **素材處理** | 修剪、串接、重新構圖為 9:16 / 1:1 / 16:9，移除靜音與贅詞，依節拍剪接 | 為文字、圖表、形狀與圖片製作動畫；不生成影片素材或人物 | 完整的手動剪輯 |
| **動態圖形** | HTML/CSS 場景：動態文字、價格卡、下三分之一字卡、資料標註、轉場 | 以程式碼建構的解說動畫 | 範本、文字動畫與特效 |
| **聲音** | 逐場景旁白、人聲出現時自動降低音量的背景音樂、依實測逐字時間產生的字幕 | Anthropic 的說明文章中未提及 | 應用程式內的配音、音樂與字幕工具 |
| **輸出** | MP4，交付前檢查長度、畫面規格、響度與旁白 | 匯出 MP4 | 匯出 MP4 |
| **原始碼** | MIT；每支影片都是你擁有的本地資料夾 | 專有、託管 | 專有 |

如果你想手動剪輯，請選 **CapCut**，或 Shotcut、Kdenlive 等開源時間軸編輯器。如果你的團隊已在 Team 或 Enterprise 方案上使用 Claude，並需要解說動畫，請選 **Claude Motion**。如果你希望由程式設計智能體完成整支影片，把素材、動態圖形與聲音放在同一條時間軸，並將結果保留為可以檢查、編輯與重新渲染的檔案，請選 **OrkasVideoStudio**。Claude Motion 的資訊來自 [Anthropic 說明中心](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion)，截至 2026 年 11 月。

### OrkasVideoStudio 與 Higgsfield 比較

Higgsfield 是一個託管平台，以單一帳號販售多種影片與圖片模型，可透過它的網頁應用程式、API、MCP 連接器與 CLI 使用。OrkasVideoStudio 不託管模型：你的智能體會呼叫你設定的服務商，再把這些鏡頭做成一支成品影片。

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **它是什麼** | 由你的程式設計智能體驅動的開源影片工作室 | 託管式 AI 圖片與影片平台 |
| **影片模型** | 你設定的服務商，例如 Seedance 2.5、Kling 4.0、Google Cloud 上的 Veo 3.1、Runway Gen-4.5、Wan 3.0、MiniMax H3 與 Vidu Q3 | 一個帳號即可使用多種託管模型，包括 Seedance 2.5、Kling 4.0、Veo 3.1，以及只有 Higgsfield 提供的 MAGI-2 |
| **如何付費** | 各服務商依你自己的 Key 計費；剪輯、動態圖形、字幕與轉錄在本地執行，不需要 Key | 網頁應用程式與連接器使用訂閱積分，或在 API 上使用按秒計費的儲值金額 |
| **你會得到** | 一個經過檢查的 MP4，將生成的鏡頭與你的素材、動態圖形、旁白、音樂和字幕混合在一起，外加一個可以編輯並重新渲染的製作資料夾 | 生成的片段與圖片，以及 Higgsfield 自家的 Studio 應用程式 |
| **從程式設計智能體使用** | 技能、`ovs` CLI 與 MCP 伺服器，適用於 Claude Code、Codex、Cursor 或任何智能體 | Higgsfield 的 MCP 連接器、CLI 與技能 |
| **原始碼** | MIT；每支影片都是你擁有的本地資料夾 | 專有、託管 |

如果你想用一張帳單使用多種託管模型，或需要只有它提供的模型（例如 MAGI-2），請選 **Higgsfield**。如果你希望程式設計智能體用你自己的服務商 Key 完成整支影片，並將結果保留為檔案，請選 **OrkasVideoStudio**。兩者也能搭配使用：你在 Higgsfield 上生成的片段，對 OrkasVideoStudio 製作專案來說就是一般素材。Higgsfield 的資訊來自 [higgsfield.ai](https://higgsfield.ai/mcp) 及其 [MAGI-2 頁面](https://higgsfield.ai/magi-2-intro)，截至 2026 年 11 月。

### OrkasVideoStudio 與 video-use、OpenDesign Motion 比較

[video-use](https://github.com/browser-use/video-use) 與 [OpenDesign](https://github.com/nexu-io/open-design) 的 Motion 模式，是另外兩種以程式設計智能體製作影片的開源方式。

| | OrkasVideoStudio | video-use | OpenDesign Motion |
|---|---|---|---|
| **它是什麼** | 由你的程式設計智能體驅動的開源影片工作室 | 以程式設計智能體剪輯素材的開源技能 | 開源 AI 設計工作空間 OpenDesign 中的動態影片模式 |
| **起點** | 你的素材、一份需求、一個產品頁面或一支參考影片 | 一個裝有原始素材的資料夾 | 一份需求，或五個內建動態範例之一 |
| **素材處理** | 修剪、串接、重新構圖，移除靜音與贅詞，依節拍剪接 | 剪掉贅詞與空白片段、調色，並在每個剪接點為音訊做淡入淡出 | 其 README 中未提及 |
| **動態圖形** | 附有可編輯文字欄位的 HTML/CSS 場景 | 以 HyperFrames、Remotion、Manim 或 PIL 製作的動畫疊加層 | 以 HyperFrames 製作並匯出為 MP4 的動態圖形 |
| **聲音與字幕** | 逐場景旁白、人聲出現時自動降低音量的背景音樂、依實測逐字時間產生的字幕 | 依你選擇的樣式內嵌的字幕 | 來自 Suno v5 或 Lyria 2 的音樂，以及附語音與逐字同步字幕的範本 |
| **生成鏡頭** | 用你設定的服務商生成的圖片、影片片段與出鏡主持人 | 其 README 中未提及 | 透過它路由的模型使用 Seedance、Veo、Sora 與 Kling |
| **所需 Key** | 剪輯、動態圖形、字幕與轉錄都不需要；生成使用你自己的 Key | 轉錄需要一組 ElevenLabs API Key | 你自己的程式設計智能體與 API Key，或 OpenDesign 的託管方案 |
| **後續編輯** | 你擁有的製作資料夾，外加瀏覽器畫布 | 再請智能體修改一次；筆記會保存在 `project.md` 中延續下去 | OpenDesign 工作空間中可編輯的原始檔 |
| **授權** | MIT | MIT | Apache-2.0 |

如果你的工作是把原始素材剪成成品影片，請選 **video-use**。如果影片只是你在同一個設計工作空間中製作的交付成果之一，與簡報、原型和網站並列，請選 **OpenDesign**。如果一支影片需要同時結合素材、動態圖形、旁白、字幕與生成鏡頭，在交付前經過檢查，之後還能編輯，請選 **OrkasVideoStudio**。以上資訊來自 [video-use 的 README](https://github.com/browser-use/video-use)、[OpenDesign 的 README](https://github.com/nexu-io/open-design) 及其 [0.25.0 版本發布說明](https://github.com/nexu-io/open-design/releases/tag/open-design-v0.25.0)，截至 2026 年 11 月。

### OrkasVideoStudio 與框架、SaaS 編輯器及封裝工具比較

在這裡，HyperFrames、ffmpeg 與 whisper.cpp 是**相依套件**，而不是競爭對手。OrkasVideoStudio 是建立在它們之上、面向智能體的一層：專業知識、交付檢查、可編輯的製作專案與畫布。

| | OrkasVideoStudio | 程式化框架（Remotion、Revideo） | AI SaaS 編輯器（Descript、Opus Clip、Runway） | 輕量 MCP / ffmpeg 封裝工具 |
|---|---|---|---|---|
| **驅動方式** | 任何程式設計智能體，以自然語言驅動（CLI + MCP） | 由你手寫 React/TS | 圖形介面 / 託管 | 智能體，但只有工具 |
| **產出物** | 本地資料夾中可編輯的場景時間軸，外加瀏覽器畫布 | 程式碼（需重新執行才能渲染） | 黑盒時間軸 / 託管專案 | 無 |
| **範圍** | 素材剪輯 + 設計動態圖形 + 旁白 + 生成，集中在同一條時間軸 | 合成（程式化） | 依產品而定，大多只做剪輯*或*生成 | 取決於工具開放了什麼 |
| **指引** | 以技能形式提供「怎樣才算好影片」，外加確定性的交付檢查 | 沒有，由你決定 | 帶有產品自身的主張 | 沒有 |
| **Key / 託管** | 核心功能不需 Key；生成使用**你自己的** Key；本地優先 | 你自己的基礎設施 | 廠商的 Key + 託管，有綁定風險 | 視情況而定 |
| **授權** | MIT | 團隊使用可能需要公司授權 | 專有 | 視情況而定 |

如果你想親手為每一格畫面寫程式碼，就選**框架**；如果圖形介面與託管服務本身就是你要的，就選 **SaaS 編輯器**。如果你希望由你的*智能體*製作影片，將結果保留為可以檢查、編輯與重新渲染的檔案，並用你自己的 Key 留在本地，就選 **OrkasVideoStudio**。

---

## 常見問題（FAQ）

### Claude Code 能做影片嗎？

可以。安裝 OrkasVideoStudio 後，Claude Code 會讀取 `video-studio` 技能，並使用 `ovs` CLI 或 MCP 工具剪輯素材、製作動態圖形、加上旁白與字幕，然後在你的電腦上渲染出一個經過檢查的 MP4。Codex、Cursor，以及其他任何能執行 shell 或支援 MCP 的智能體，用法都一樣。請參閱[從 Claude Code、Codex 或任何程式設計智能體驅動](#從-claude-codecodex-或任何程式設計智能體驅動)。

### 是免費的嗎？需要 API Key 嗎？

OrkasVideoStudio 免費，並採用 MIT 授權。剪輯、設計動態圖形、字幕與轉錄都在本地執行，不需要 API Key。生成圖片、影片片段或語音為選用功能，使用你自己的服務商帳號，由服務商直接向你計費。在任何付費呼叫之前，智能體都會先與你確認服務商、模型、請求次數與預估費用。請參閱[如何讓生成維持在可控範圍內](#如何讓生成維持在可控範圍內)。

### 它是 Claude Motion、CapCut 與 Higgsfield 的開源替代方案嗎？

是的。與 Claude Motion 一樣，它讓 Claude Code 以程式碼撰寫動態圖形；但它支援使用 Pro、Max、Ultra 方案或 API Key 的 Claude Code，而不只限於 Team 與 Enterprise 方案，也支援其他智能體。與 CapCut 不同，修改是由你的智能體依你的描述完成，而不是由你在時間軸上手動剪輯。與 Higgsfield 不同，它不託管模型，也不販售積分：你的智能體會用你自己的 Key 呼叫 Seedance、Kling、Veo 等影片模型，再把這些鏡頭與你的素材、動態圖形、旁白和字幕結合在一起。請參閱[比較一覽](#比較一覽)。

### 能剪輯我手邊現有的素材嗎？

可以。它能修剪與串接片段，重新構圖為 9:16、1:1 或 16:9，移除靜音與贅詞，依節拍剪接，內嵌字幕並進行響度正規化。你的素材會和動態圖形、生成鏡頭放在同一條時間軸上。

### 支援哪些影片、圖片與語音模型？

影片：Seedance、Kling、Veo（透過 Google 或 Google Cloud）、Runway、Wan、MiniMax 與 Vidu，以及 Atlas 和 MuAPI。圖片：Gemini，以及 OpenAI 或任何 OpenAI 相容端點，包括 Seedream。語音：OpenAI、豆包、MiniMax、阿里雲（Qwen 與 CosyVoice）、Google、ElevenLabs，以及 OpenAI 相容端點。這些全都使用你自己的 Key。請參閱[自備生成服務商](#自備生成服務商)。

### 它和 Remotion、HyperFrames 有什麼不同？

HyperFrames 是相依套件：它負責渲染 HTML 場景並擷取影格，ffmpeg 則負責剪輯與量測。Remotion 是一個框架，你在其中為每一格畫面撰寫 React 程式碼。OrkasVideoStudio 是建立在它們之上、供你的智能體使用的一層：技能中的影片專業知識、交付檢查、可編輯的製作資料夾與瀏覽器畫布。請參閱 [OrkasVideoStudio 與框架、SaaS 編輯器及封裝工具比較](#orkasvideostudio-與框架saas-編輯器及封裝工具比較)。

### 要怎麼安裝？

從原始碼安裝：複製儲存庫，執行 `pnpm install && pnpm build`，再用 `ovs doctor` 檢查你的環境。你需要 Node 22 或更新版本、pnpm，以及 ffmpeg 與 ffprobe。npm 套件尚未發布。請參閱[安裝](#安裝)。

---

## 與 Orkas 的關係

OrkasVideoStudio 最初是內建於 **[Orkas](https://orkas.ai?source=gh-orkas-vs) 的影片智能體**；Orkas 是一款 AI 團隊桌面應用程式。它先在 Orkas 中完成端到端的驗證，之後才抽離成這個不綁定特定智能體、採用 MIT 授權的工具包。

- **在 Orkas 中**，它以[內建智能體](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs)的形式提供，不需要另外安裝。你在桌面應用程式而不是終端機中與它對話，生成可以使用 Orkas 的內建模型（新帳號贈送 500 積分），也可以使用你自己的 Key。可[下載 Orkas](https://orkas.ai/download/?source=gh-orkas-vs) 的 macOS 或 Windows 版。
- **在其他任何地方**，你可以依上述說明把它安裝到你自己的程式設計智能體，透過 `ovs` CLI、MCP 伺服器與畫布取得相同的核心能力。Orkas 的帳號功能，例如託管服務商、積分與對話發布，不包含在本儲存庫中。

連結：**[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[本儲存庫](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## 套件

| 套件 | 內容 |
|---|---|
| `@orkas/video-studio-core` | 場景時間軸與舊版 EDL schema、交付檢查、決策輔助函式、旁白時間計算、執行環境與設定 |
| `@orkas/video-studio-tools` | 時間軸、渲染、剪輯、分析、語音、圖片與影片的後端，以及瀏覽器畫布 |
| `@orkas/video-studio` | `ovs` CLI |
| `@orkas/video-studio-mcp` | MCP 伺服器（`ovs-mcp`），與 CLI 一一對應 |
| `@orkas/video-studio-skills` | 不綁定特定宿主的 `SKILL.md` 知識包 |

技術計畫及其歷史記錄在 [`PLAN.md`](./PLAN.md)。給在此儲存庫上工作的程式設計智能體的說明，請見 [`AGENTS.md`](./AGENTS.md)。

---

## 開發

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

`pnpm install` 會套用 [`patches/`](./patches/) 中帶版本號的 HyperFrames 修補程式，讓 SDR H.264/H.265 輸出使用其中繼資料所宣告的 BT.709 矩陣。外部的 `OVS_HYPERFRAMES_BIN` 或 `npx` 相容性備援不會套用這個修補程式，因此該執行環境必須包含同等的色彩修正。 這項修補也會保留 Whisper 中文和日文轉錄中的詞級時間戳記。外部執行環境需要提供同等支援。

`test:video` 絕不會耗用服務商的付費額度。本地的模擬 Seedance 端點會回傳一個真實的 H.264 測試樣本，由 OVS 下載後再用 `ffprobe` 驗證。

`test:video:e2e` 會透過建置好的 CLI 涵蓋兩條製作路徑：

- **舊版合成路徑**：製作一支 9 秒、三個場景的 1080p 影片，涵蓋 composition prepare/reconcile、快照、完整的草稿關卡、字幕內嵌與最終檔案的承諾檢查。它會解碼整個 MP4，檢查場景順序、可見的動態、每個場景中都聽得到的音訊與內嵌字幕的像素，並確認錯誤的交付長度會遭到拒絕。
- **目前的場景時間軸**：透過真實的 HyperFrames 檢查與快照路徑，渲染一條三個場景的時間軸。它會檢查場景顏色、撰寫的動態效果、解碼後來源影片的動態、字幕像素、音訊、不可變的交付，以及過時渲染的拒絕。

它也會測試建置好的 CLI 與 MCP 介面。缺少必要的執行環境時，兩個影片指令都會失敗，並提供可據以處理的錯誤訊息。在沒有 ffmpeg 或瀏覽器的機器上，一般測試套件可能會略過需要大量執行環境的案例。

`pnpm verify` 必須在任何 Git commit 或 PR 之前，於最終候選版本上通過。它包含真實的製作案例，也是 CI 的進入點；僅涉及測試的變更也遵循相同規則。進行同步或發行審查時，請保留並檢查產生的影片、預覽、最終影格與報告：

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

證據目錄需自行啟用，每次執行都使用各自的子目錄。一般的 CI 執行會清除暫存媒體。測試素材使用原創的 HTML/SVG 與本地生成的純音樂音訊。它們不會呼叫付費服務商，也不宣稱涵蓋 TTS 或模型品質。

`pnpm benchmark` 不需要 Key，結果具確定性。它會建置 core 套件、驗證基準測試素材，然後量測關卡轉換、EDL 驗證與交付摘要、composition-manifest 驗證，以及旁白估算。每組測試都設有刻意保守的處理量下限，因此大幅的效能退化會失敗，而正常的機器差異則不會。

設定方式、執行指令與證據儲存規則請見[選用的模型評測指南](./eval/video/README.md)（英文）。

## 版本

所有套件共用同一個日曆版本號 `YYYY.M.D`（依 Asia/Shanghai 日期，不補零）。加上標籤的發行版本使用 `v<version>`，並以 [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) 的形式發布；已發布的日期版本絕不會被覆寫。變更內容列於 [CHANGELOG.md](CHANGELOG.md)。此版本號與 Orkas 桌面應用程式及其市集智能體的版本彼此獨立。

## 授權

MIT —— 請參閱 [`LICENSE`](./LICENSE)。渲染使用採 Apache-2.0 授權的 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 相依套件。剪輯與媒體檢查使用你系統上的 `ffmpeg`，轉錄則交由 HyperFrames / whisper.cpp 處理。[`PLAN.md`](./PLAN.md) 說明了如何尋找第三方執行環境，並附有授權說明。
