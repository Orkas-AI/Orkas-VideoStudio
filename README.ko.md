# OrkasVideoStudio

> OrkasVideoStudio는 코딩 에이전트를 동영상 스튜디오로 바꿔 주는 오픈소스 AI 동영상 편집기입니다. Claude Code, Codex, Cursor처럼 셸을 실행하거나 MCP를 지원하는 에이전트라면 어떤 에이전트에게든 완성된 동영상을 요청하세요. 에이전트가 영상 소스를 편집하고, 모션 그래픽을 디자인하고, 내레이션, 음악, 자막을 넣고, 부족한 샷은 내 키로 생성한 뒤, 검사를 마친 MP4를 전달합니다. 이 MP4는 브라우저 캔버스에서 계속 편집할 수 있습니다.

**Claude Motion, CapCut, Higgsfield의 오픈소스 대안으로, 이미 쓰고 있는 코딩 에이전트로 구동합니다.** MIT 라이선스이고 로컬 우선이며, Claude Team이나 Enterprise 플랜도, 동영상 플랫폼 구독도 필요 없습니다. 생성 샷은 자신의 키로 Seedance, Kling, Veo 등의 동영상 모델을 사용해 만듭니다. [비교 보기 ↓](#비교)

**코딩 에이전트 대신 앱으로 쓰고 싶으신가요?** OrkasVideoStudio는 macOS와 Windows용 무료 AI 팀 데스크톱 앱인 [**Orkas**](https://orkas.ai/?source=gh-orkas-vs)에 기본 탑재된 동영상 에이전트이기도 합니다. 채팅으로 원하는 동영상을 설명하면, 생성은 Orkas 내장 모델(신규 계정에는 500 크레딧이 무료로 제공됩니다)이나 자신의 키로 실행됩니다. **[Orkas 다운로드 →](https://orkas.ai/download/?source=gh-orkas-vs)** · [둘의 관계 ↓](#orkas와의-관계)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*위의 54초짜리 개요 영상은 브리프 하나가 완성된 동영상이 되는 과정을 보여 줍니다. 실제 영상 소스를 자르고, 모션을 디자인하고, 음성, 음악, 자막을 넣고, 캔버스에서 여러 샷을 살펴본 뒤, 문구를 바꾸거나 샷을 교체하거나 장면 순서를 바꿉니다.*

OrkasVideoStudio는 **블랙박스 동영상 에이전트가 아닙니다**. 생각하는 일은 내 에이전트가 맡습니다. 이 프로젝트는 에이전트가 즉석에서 만들어 낼 수 없는 부분을 제공합니다.

- **영상 제작 노하우.** 호스트에 종속되지 않는 `SKILL.md` 팩으로, 진입 스킬은 `video-studio`입니다. 언제 질문하고 언제 진행할지, 광고, 설명 영상, 제품 데모, 음악에 맞춘 편집, 프레젠터 영상, 단편 영화, 코멘터리 영상이 각각 어떻게 다른지, 그리고 완성이라고 판단하기 전에 편집본을 어떻게 검사할지를 다룹니다.
- **결정론적 도구.** `ovs` CLI와 이를 그대로 미러링하는 MCP 서버입니다. 제작 타임라인, ffmpeg 편집, 전사, 영상 소스 분석, 자신의 제공업체 계정을 통한 생성을 다룹니다. 페이지 렌더링과 프레임 캡처는 [HyperFrames](https://github.com/heygen-com/hyperframes)가 맡고, 편집과 측정은 `ffmpeg` 담당입니다.
- **편집 가능한 제작물.** 각 동영상은 평범한 폴더입니다. 장면 타임라인(`videos/main/manifest.json`), 에셋 대장, 출처가 기록된 제품 정보, 선택 사항인 디자인 페이지가 들어 있습니다. 사용자와 에이전트, 브라우저 캔버스가 모두 같은 파일을 편집합니다. 텍스트 한 줄을 바꾸거나 그림을 교체하거나 장면 순서를 바꾼 뒤 다시 렌더링하면 됩니다.

편집, 디자인된 모션 그래픽, 자막, 전사에는 **API 키가 필요 없습니다**. 이미지, 동영상, 음성 생성은 직접 켜야 하는 선택 기능이며 **자신의** 제공업체 계정을 사용합니다. 호스팅되는 백엔드가 없고, 만들어야 할 계정도 없습니다.

---

## 요청할 수 있는 것

한 번 요청하면 완성된 동영상 한 편을 받습니다. 에이전트는 요청에 필요한 요소를 하나의 타임라인에 모두 담습니다.

| 기능 | 다루는 범위 |
|---|---|
| **실제 영상 소스 편집** | 자르기, 이어 붙이기, 9:16 / 1:1 / 16:9로 리프레임, 클립 소리 유지 또는 믹스, 오버레이, 자막 입히기, 라우드니스 정규화. 긴 녹화본에서는 하이라이트를 찾고, 여러 번 찍은 테이크의 순위를 매기고, 무음 구간이나 필러 단어를 제거할 수도 있으며, 각 컷의 근거를 기록합니다. |
| **디자인된 모션** | 애니메이션이 들어간 HTML/CSS로 만드는 장면: 키네틱 타이포그래피, 가격 카드, 로어서드, 데이터 콜아웃, 트랜지션. 편집할 수 있는 문구는 이름이 붙은 텍스트 슬롯에 들어 있어, 문구를 바꾼다고 장면을 다시 만들 필요가 없습니다. |
| **사운드와 자막** | 장면 길이에 맞춘 장면별 내레이션. 말소리가 나올 때 음량이 줄어드는(더킹) 라이선스 배경 음악. 내레이션 텍스트나 측정한 단어 타이밍으로 만드는 자막. 비트에 맞춘 컷. |
| **생성 샷** | 가진 소재로는 보여 줄 수 없는 샷을 위해, 설정한 제공업체로 이미지, 동영상 클립, 생성 프레젠터(토킹 헤드)를 만듭니다. 생성은 사용자가 승인한 지출 범위 안에서만 이루어집니다. |

대본이나 스토리보드를 요청하면 에이전트는 문서까지만 만듭니다. 완성된 동영상을 요청하면 전달까지 진행합니다. 계획이나 미리 보기는 사용자가 요청했거나 동영상 길이가 약 2분을 넘을 때만 보여 줍니다. 동영상이 글자 그대로 따라갈 대본을 에이전트가 직접 쓴 경우에는 먼저 보여 주고, 사용자가 준 대본은 쓰인 그대로 제작합니다.

---

## Team 플랜 없이 Claude Code에서 모션 그래픽 만들기

Anthropic의 애니메이션 기능인 Claude Motion은 Claude Team과 Enterprise 플랜에서만 베타로 제공됩니다. OrkasVideoStudio를 사용하면 Pro, Max, Ultra 또는 API 키로 쓰는 Claude Code에서도 같은 방식의 코드 기반 모션 그래픽을 만들 수 있습니다. 에이전트가 각 장면을 애니메이션이 들어간 HTML과 CSS로 작성하고, 샘플링한 프레임을 확인한 뒤, 내 컴퓨터에서 MP4를 렌더링하므로 렌더링 자체에는 토큰이 들지 않습니다.

1. OrkasVideoStudio를 [설치](#설치)하고 `ovs skills --install --target claude`를 실행합니다(Codex라면 `--target codex`).
2. 동영상을 요청합니다. 예: *"우리 앱 출시용으로 20초짜리 16:9 모션 그래픽 영상을 만들어 줘. 제품 이름이 나오는 키네틱 타이포그래피 오프닝, 슬라이드로 들어오는 기능 카드 세 장, 가격이 나오는 마무리 카드로 구성해 줘. 렌더링하기 전에 장면마다 스틸 이미지를 보여 줘."*
3. 장면 파일이나 캔버스에서 단어, 색, 타이밍을 직접 바꾸거나 에이전트에게 요청한 다음 다시 렌더링합니다.

Claude Motion과 달리 같은 타임라인에 내 영상 소스, 내레이션, 음악, 자막도 담을 수 있습니다. [비교](#비교)를 참고하세요.

---

## 활용 사례

각 행은 에이전트에게 줄 수 있는 프롬프트 예시입니다. 어떤 도구를 쓸지는 `video-studio` 스킬이 고릅니다.

### 광고와 마케팅

| 요청 예시 | 진행 내용 |
|---|---|
| *"이 사진들과 제품 페이지로 이 책상 조명의 20초짜리 세로형 광고를 만들어 줘."* | 사진을 가져오고, 가격과 사양을 출처가 있는 정보로 기록하고, 훅, 기능, 가격 장면을 디자인하고, 내레이션과 자막을 넣은 다음 검사, 렌더링, 전달까지 진행합니다. |
| *"우리 앱 웹사이트를 바탕으로 30초짜리 출시 영상을 만들어 줘."* | 브라우저에서 실제 제품 페이지를 캡처하고, 제품의 실제 문구와 화면을 사용해, 다시 그린 목업 대신 그것들을 중심으로 장면을 구성합니다. |
| *"생성한 진행자가 이 세럼을 소개하는 30초짜리 프레젠터 영상을 만들어 줘."* | 먼저 독백 대본을 쓰고, 가상 진행자의 키 이미지 한 장을 만들어 모든 클립에 재사용하며, 내 동영상 제공업체로 말하는 클립을 생성하고, 가격과 주장 문구는 편집 가능한 화면 텍스트로 유지합니다. |
| *"이 대본으로 15초짜리 9:16 프로모션 영상을 만들어 줘. 오프닝은 생성하고, 기능 소개는 모션으로 구성하고, 보이스오버는 하나로."* | 하나의 타임라인에 생성한 오프닝, 디자인한 기능 장면, 단일 내레이션 트랙을 결합하고, 완성된 파일은 전달 전에 검사합니다. |

### 영화와 드라마

| 요청 예시 | 진행 내용 |
|---|---|
| *"야간 근무 간호사에 관한 1분짜리 단편 영화를 만들어 줘. 모든 샷에 같은 두 인물이 나오게 해 줘."* | 하나의 극적 질문을 중심으로 이야기를 세우고, 인물마다 외모 설명 한 줄과 키 이미지 하나를 고정해 샷 사이에서 일관성을 유지하며, 사용자가 승인한 예산 안에서 내 동영상 제공업체로 샷을 생성합니다. |
| *"이 드라마 세 편을 내레이션이 있는 3분짜리 요약 영상으로 만들어 줘."* | 에피소드를 전사하고, 이야기를 이끄는 장면을 고르고, 크레딧과 다음 회 예고는 건너뛰며, 요약 대본을 쓰고 음성으로 만든 뒤 그 아래에 내 영상 소스를 편집해 배치합니다. |
| *"오프닝에 쓸 새벽 도시 풍경 5초짜리 샷을 생성해 줘."* | 제공업체, 모델, 비용을 확인하고, 내 동영상 제공업체로 샷 하나를 만들어 타임라인에서 내 영상 소스 옆에 배치합니다. |

### 편집

| 요청 예시 | 진행 내용 |
|---|---|
| *"이 1시간짜리 화면 녹화로 자막이 들어간 30초 하이라이트 클립 세 개를 만들어 줘."* | 장면 분석과 품질 분석으로 좋은 부분을 찾습니다. 여러 번 찍은 테이크는 순위를 매기고, 무음과 필러는 잘라 내며, 측정한 단어 타이밍으로 자막을 입힙니다. |
| *"웹캠으로 찍은 영상에서 무음 구간과 '음', '어'를 없애고 템포를 살려 줘."* | 무음 구간과 필러 단어를 감지해 결정론적 점프 컷을 만들고, 제거한 모든 구간의 근거를 기록합니다. |
| *"product-demo.mp4에 영어 보이스오버와 자막을 넣고 음량을 고르게 맞춰 줘."* | 동영상을 전사하고, 각 줄을 번역해 해당 화면 구간 안에 들어가도록 음성으로 만든 뒤, 기존 소리 위에 음성을 믹스하고, 자막을 입히고, 라우드니스를 정규화합니다. |
| *"여행에서 찍은 이 클립 20개를 이 음악의 비트에 맞춰 편집해 줘."* | 음악의 비트를 측정해 클립을 비트에 맞춰 자르고, 전달된 파일의 비트 정렬을 검사합니다. |

### 설명 영상과 튜토리얼

| 요청 예시 | 진행 내용 |
|---|---|
| *"벡터 데이터베이스를 설명하는 60초짜리 영상을 중국어 보이스오버로 만들어 줘."* | 모션 그래픽 장면을 작성하고, 내 TTS 제공업체로 내레이션을 합성한 뒤, 각 줄을 해당 장면에 맞춥니다. |
| *"설정 페이지를 녹화한 화면을 90초짜리 튜토리얼로 만들어 줘."* | 녹화본을 다듬고, 실제 인터페이스에서 각 컨트롤을 단계별로 표시하며, 내레이션과 자막을 넣습니다. |

### 인기 영상 재현

| 요청 예시 | 진행 내용 |
|---|---|
| *"이 바이럴 영상의 구성과 페이스를 내 제품에 맞게 재현해 줘. 먼저 계획을 보여 줘."* | 레퍼런스를 분석하고, 그 전개 단위를 내 소재에 대응시킨 뒤, 제작에 들어가기 전에 사용자의 승인을 기다립니다. |
| *"이 경쟁사 광고는 성과가 좋아. 같은 훅과 리듬으로 우리 사진을 써서 우리 광고를 만들어 줘."* | 레퍼런스에서 빌려 오는 것은 훅, 증명, 행동 유도의 리듬이지 내용이 아닙니다. 모든 주장은 내 제품 정보에서, 모든 그림은 내 소재에서 가져옵니다. |

**레퍼런스 영상 파일**과 내 제품 에셋, 대본 또는 영상 소스를 에이전트에게 주세요. 에이전트는 OrkasVideoStudio를 사용해 레퍼런스의 **서사 구조, 시각 스타일, 편집 템포**를 새 콘텐츠로 재현할 수 있습니다.

1. **레퍼런스 분석.** 샘플링한 프레임과 관련 오디오를 살펴 훅, 시연이나 증명, 정보 순서, 타이포그래피, 트랜지션, 페이스, 행동 유도(CTA)를 파악합니다.
2. **각색 계획.** 무엇을 유지하고 무엇을 바꿀지 정한 뒤, 레퍼런스의 각 순간을 새 장면이나 타임라인에 대응시킵니다. 타이밍은 실제 내레이션과 읽는 시간에 맞게 조정합니다.
3. **제작과 수정.** 모션 그래픽을 구성하고, 영상 소스를 편집하고, 필요하면 부족한 비주얼을 생성합니다. 로컬에서 작성한 텍스트, 자막, 내레이션, 클립은 각각 따로 편집할 수 있습니다. 생성된 영상에 새겨진 텍스트는 그 영상 자체를 바꿔야만 바꿀 수 있습니다.

이 방식은 모션 그래픽 설명 영상, SaaS와 앱 데모, 기존 영상 소스로 만드는 제품 광고에 가장 잘 맞습니다. 소셜 플랫폼 공유 링크로 내려받는 기능은 내장되어 있지 않으므로, 에이전트가 읽을 수 있는 파일로 시작하세요. 정확한 카메라 움직임, 사람의 연기, 프레임 단위 일치는 보장되지 않습니다. 전달 검사는 결과물이 레퍼런스와 얼마나 비슷한지 점수를 매기지 않습니다. 자세한 내용은 [레퍼런스 재현 워크플로](./packages/skills/video-craft/references/reference-recreation.md)를 참고하세요.

---

## 설치

**사전 요구 사항:** Node ≥ 22와 `pnpm`이 필요하고, `PATH`에 `ffmpeg`, `ffprobe`가 있어야 합니다. 버전이 고정된 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 패키지가 의존성으로 설치되며, 검사와 렌더링을 위해 헤드리스 Chrome에서 페이지를 렌더링합니다. `npx`는 호환성을 위한 대체 경로일 뿐입니다. 생성은 선택 사항이며 자신의 키가 필요합니다.

### 소스에서 설치

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

npm 패키지는 아직 공개되지 않았으므로, 지금은 소스에서 설치하세요.

---

## Claude Code, Codex 등 코딩 에이전트에서 구동하기

기준이 되는 인터페이스는 `ovs` CLI이며, MCP 도구는 이를 그대로 미러링합니다. 에이전트가 지원하는 방식 중 하나를 사용하세요.

**1) 네이티브 스킬(Claude Code / Codex).** 스킬 팩을 설치하면 에이전트가 스스로 찾아 씁니다.

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

같은 스킬 팩이 [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio)에도 등록되어 있어 `npx skills add orkas-ai/orkas-videostudio`로도 설치할 수 있습니다. 스킬은 `ovs` CLI를 호출하므로, 위에서 설명한 대로 CLI를 먼저 설치하세요.

**2) MCP 도구.** 서버를 등록합니다.

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) 자기 설명형 CLI(셸을 쓸 수 있는 모든 에이전트).** 로더가 필요 없습니다.

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

그다음 에이전트에게 동영상을 요청하기만 하면 됩니다. 에이전트는 먼저 `video-studio`를 읽고, 필요한 단계별 참고 자료와 제작 기법 참고 자료를 불러옵니다.

---

## 제작 방식

에이전트는 짧은 폴더 이름을 정하고 모든 것을 그 안에 보관합니다.

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

장면 순서가 곧 재생 순서입니다. 시작 시간과 전체 길이는 장면에서 계산되며 저장되지 않으므로, 장면을 옮겨도 타이밍이 어긋날 수 없습니다. 가격은 `product.json`에 한 번만 기록되고, 가격을 보여 주는 모든 장면이 그곳에서 읽어 옵니다. 다른 화면비, 언어, A/B 컷처럼 병렬로 만드는 변형은 에이전트가 같은 에셋을 공유하는 동영상 ID를 추가해 만듭니다. [타임라인 사양](packages/skills/video-studio/references/timeline.md)을 참고하세요.

일반적인 실행 예시는 다음과 같습니다.

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship`은 최종 파일을 기록하기 전에 길이, 캔버스 설정, 오디오, 라우드니스, 내레이션 커버리지를 측정합니다. 자막 경고는 눈으로 확인하도록 표시되고, 실제 MP4에서 추출한 프레임이 반환됩니다. 전달할 때마다 변경할 수 없는 버전이 생깁니다. 최신 변경 이전에 만든 렌더링은 오래된 것으로 거부되며, 이전 전달본은 절대 덮어쓰지 않습니다. 이 검사를 통과했다고 해서 시각적 품질이 보증되는 것은 아닙니다. 누군가 실제로 프레임을 보기 전까지 시각 검토는 `not_checked` 상태로 남습니다.

남아 있는 특정 지적 사항을 명시적으로 수용할 때는 `--accept-findings '["CODE"]' --accept-reason '<your decision>'` 형식으로 정확한 코드를 넘기세요. 버전에 그 결정이 기록되며, 그 밖의 오류는 여전히 전달을 막습니다. 쓰기 작업은 `.ovs-timeline.lock` 파일로 직렬화됩니다. 비정상 종료로 이 파일이 남았다면, 이 파일을 가진 프로세스가 멈췄는지 확인한 뒤 삭제하세요. 두 가지 모두 [타임라인 사양](packages/skills/video-studio/references/timeline.md)에서 다룹니다.

**수정은 저렴하고 로컬에서 끝납니다.** 단어, 컷, 순서, 배경 음악, 자막을 바꾸면 그 자리에서 편집됩니다. 음성을 다시 만드는 것은 말하는 내용이 바뀐 줄뿐이고, 다시 생성하는 것은 잘못된 샷뿐이며, 둘 다 이미 승인된 지출 범위 안에서 이루어집니다. 자막 텍스트를 편집해도 음성은 바뀌지 않습니다. HyperFrames는 매번 동영상 전체를 렌더링하며, 이 포터블 빌드는 렌더링된 장면을 캐시하지 않습니다.

---

## 브라우저 동영상 캔버스

CLI나 MCP에서 `timeline import`, `timeline prepare`, `timeline render`, `timeline ship` 중 하나가 성공하면, OVS가 기본 브라우저에서 해당 제작물의 캔버스를 엽니다. 이후 명령은 새 탭을 열지 않고 같은 탭을 다시 사용합니다. 캔버스는 CLI 및 MCP와 같은 파일을 편집하므로 변경 사항이 양방향으로 반영됩니다. 에이전트가 작업하는 동안에는 보기 전용 상태로 표시됩니다.

캔버스에서는 다음과 같은 일을 할 수 있습니다.

- **보기와 내보내기.** 동영상을 재생하고, 전달된 버전 사이를 전환하고, 원하는 버전을 다운로드합니다.
- **소재 정리.** 영상 소스를 업로드하거나 끌어다 놓거나 붙여 넣은 뒤, 보드에서 카드를 옮기고 연결합니다.
- **장면 편집.** 문구, 순서, 그림을 바꾸고 장면을 추가, 삭제하거나 되돌려 놓습니다.
- **샷 생성과 다시 만들기.** 카드에서 새 이미지 샷이나 동영상 샷을 만들거나 기존 샷을 다시 생성합니다. 참조 자료 또는 첫 프레임과 마지막 프레임을 고르고, 모델, 해상도, 소리도 선택합니다. 모델이 지원하지 않는 옵션은 비활성화됩니다. 이전 결과를 차례로 넘겨 보며 사용할 것을 고를 수 있습니다. 유료 요청 전에는 매번 확인을 받습니다.
- **동영상 업데이트.** 일반적인 장면 편집은 로컬에서 렌더링되어 전달되고, 진행 상황은 동영상 카드에 표시됩니다. 제품 정보, 내레이션 한 줄, 동영상 전체의 목소리를 바꾸면 에이전트에게 보낼 요청이 만들어집니다. 이런 편집에는 에이전트의 판단이 필요하기 때문입니다. 장면이 정지 이미지로 멈춰 있다는 이유로 전달 검사가 업데이트를 멈추면, 동영상 카드에 **Preview this version**(이 버전 미리 보기), **Return to editing**(편집으로 돌아가기), **Update anyway**(그래도 업데이트)가 표시됩니다. 'Update anyway'를 고르면 다시 렌더링하지 않고 해당 렌더링을 유지합니다.
- **에이전트에게 말하기.** 장면, 샷, 영상 소스 카드, 동영상에 대한 짧은 요청을 작성합니다. 요청은 해당 카드의 맥락과 함께 전송됩니다.

캔버스는 중국어로 열립니다. 언어 버튼으로 중국어와 영어를 전환할 수 있으며, 선택한 언어를 기억합니다.

### 에이전트에게 요청 보내기

**Send**(보내기)는 이 제작물을 만든 대화로만 요청을 보냅니다. 그 대화가 요청을 받을 수 없으면 초안은 캔버스에 남습니다. 클립보드로 복사하거나, 자동으로 다시 보내거나, 새 세션으로 보내는 일은 없습니다. 편집, 업데이트, 내보내기는 연결된 에이전트가 없어도 계속 작동합니다.

- **Codex.** `ovs`가 Codex 스레드 안에서 실행되면 요청은 바로 그 스레드의 대기열에 들어갑니다. 이를 위해서는 Codex CLI 0.160.1 이상이 필요하고, 로컬 앱 서버가 실행 중이어야 합니다. 닫혔거나 로드되지 않은 스레드는 사용할 수 없음으로 표시됩니다.
- **Claude Code.** 요청은 MCP 채널을 통해 도착합니다. MCP 채널은 Claude Code의 리서치 프리뷰 기능이며, 일반 MCP 연결로는 충분하지 않습니다. `--claude-channel`을 붙여 서버를 등록한 다음, 채널을 활성화한 상태로 Claude Code를 시작하세요.

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  캔버스가 그 채널에 연결된 상태로 열리도록 `ovs` MCP 도구로 동영상을 만드세요. 셸 CLI에서 연 캔버스는 Claude Code에 연결할 수 없습니다. Claude Code는 시작할 때 로컬 개발 관련 경고를 표시합니다. 채널을 쓰려면 claude.ai 로그인이나 Console API 키가 필요하며, Team과 Enterprise 플랜에서는 관리자가 먼저 채널을 활성화해야 합니다. [Claude Code 채널](https://code.claude.com/docs/en/channels)을 참고하세요.

### 제작물 직접 열기

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

캔버스를 사용하는 동안에는 명령을 계속 실행해 두세요. `--agent`를 붙이면 캔버스가 제작 폴더에서 네이티브 세션을 실행하며, 이 세션은 CLI 자체의 로그인, 모델, 권한 설정을 사용합니다. 이 세션에는 Codex 0.160.1+ 또는 Claude Code 2.1.148+가 필요합니다. 권한 확인 요청과 질문은 캔버스에 표시됩니다. 기본적으로 해당 폴더에 저장된 세션을 복원하지만, `--resume <session-id>`를 넘기면 특정 세션을 이어받고, `--new-session`을 넘기면 새로 시작합니다. 기타 옵션은 다음과 같습니다.

- `--no-open`은 브라우저를 열지 않고 접속 링크를 출력합니다.
- `--port`는 루프백 포트를 지정합니다.
- `--recover`는 이전 소유자가 종료된 캔버스를 되찾습니다.

제작 작업 중 캔버스가 자동으로 열리지 않게 하려면 `OVS_STUDIO_AUTO_OPEN=0`을 설정하세요. CI에서는 이미 꺼져 있습니다.

---

## 생성 제공업체 직접 연결(BYO)

제공업체는 `~/.config/orkas-video-studio/config.json`(또는 `$OVS_CONFIG_DIR/config.json`)이나 환경 변수로 설정합니다. 환경 변수가 파일 설정보다 우선합니다.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| 기능 | `provider` 값 | 환경 변수 |
|---|---|---|
| 음성 합성(`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun`(Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| 이미지(`ovs image`) | `openai`(Seedream을 포함한 모든 OpenAI 호환 엔드포인트), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| 동영상(`ovs video`) | `doubao`(Seedance), `minimax`, `vidu`, `kling`, `google`(Veo), `google-cloud`(Veo), `runway`, `aliyun`(Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

유료 호출 없이 설정을 확인할 수 있습니다.

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

각 내레이션 줄이 장면이나 계획상의 시간 범위 안에 들어가도록 음성 합성 전후에 `ovs narration fit`을 실행하세요. 동영상 생성은 참조 이미지, 화면비, 길이, 해상도, 오디오 플래그를 명시적으로 받으므로, 제공업체 호출이 승인된 계획과 일치합니다. `plan.json` 프로젝트에서는 무엇이든 생성하기 전에 `ovs plan validate`가 각 생성 구간의 화면비, 길이, 작업도 설정된 `video.provider`와 대조해 검사합니다.

일부 제공업체는 추가 설정이 필요합니다.

- **Google Cloud Veo**는 `video.workspace_id`, `video.region`, 그리고 `video.api_key`에 넣은 API 토큰 또는 서비스 계정 JSON을 사용합니다.
- **Alibaba** 음성 합성은 `tts.base_url`에 지정한 워크스페이스 엔드포인트를 사용합니다. Wan 동영상에는 `video.workspace_id`와 `video.region`이 필요합니다.
- **클론 전용 음성**에는 제공업체에 등록한 음성 ID가 필요합니다.
- **WebSocket 음성 합성**은 직접 설정한 경우에만 `tts.proxy_url`을 거칩니다.
- **동영상 참조 자료**는 공개된 이미지 또는 동영상 URL로 전달됩니다. 지원 개수와 첫 프레임/마지막 프레임 지원 여부는 모델마다 다릅니다.
- [**MuAPI**](https://muapi.ai)는 `video.provider: "muapi"`로 명시적으로 선택해야 합니다. 선택하면 `MUAPI_API_KEY`가 `OVS_VIDEO_API_KEY`보다 우선하지만, 키만으로 MuAPI가 선택되지는 않습니다. `video.model` / `OVS_VIDEO_MODEL`은 검증된 Kling v2.1 엔드포인트인 `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v`, `kling-v2.1-pro-i2v`를 지원합니다. 그 밖의 슬러그는 맞지 않는 요청 본문으로 보내지 않고 거부합니다. 텍스트-동영상 생성의 기본값은 `kling-v2.1-master-t2v`이고, 첫 프레임 `image_url`이 있으면 기본값은 `kling-v2.1-master-i2v`입니다. 길이는 5초 또는 10초이고, 화면비는 `16:9`, `9:16`, `1:1` 중 하나입니다. 제공업체 중립적인 `resolution`, `generate_audio`, `quality` 입력은 서명된 계획과 호환됩니다. Kling은 해상도와 오디오를 무시하고, quality는 검증만 하고 전송하지 않습니다. 편집 및 추가 참조 자료 컨트롤은 일치하는 MuAPI 스키마가 지원될 때까지 거부됩니다. 기본 base URL에는 `/api/v1`이 포함되어 있으며, 사용자 지정 base URL에도 이를 포함해야 합니다. 제출 후 폴링하는 방식의 사양과 모델별 매개변수는 [MuAPI API 레퍼런스](https://muapi.ai/docs/api-reference)를 참고하세요.

제공업체 모델 카탈로그는 각 제공업체의 API 사양을 설명합니다. 실시간 이용 가능 여부나 가격을 보장하지는 않습니다.

---

## 생성 범위를 제한하는 장치

에이전트는 기존 소재로 해결되는 샷에는 그 소재를 쓰고, 부족한 것만 생성합니다. 인증 정보가 설정되어 있다고 해서 지출이 승인된 것은 아닙니다. 유료 작업을 하기 전에 에이전트는 제공업체, 모델, 목적, 재시도를 포함한 요청 수, 예상 비용을 확인하고, 그 뒤로는 그 범위를 지킵니다. 거절하면 해당 요청에 대한 유료 호출이 중단됩니다. 잘못된 샷은 최대 두 번까지만 수정본을 만들고, 그다음에는 에이전트가 접근 방식을 바꿔 달라고 요청합니다.

각 유료 요청은 출력물 옆에 영수증을 남깁니다. 결과를 알 수 없는 동영상 작업이 있으면 사용자가 확인하기 전까지 같은 출력에 대한 재제출이 차단되며, 그 작업이 자동으로 다시 실행되지도 않습니다. [생성 권한](packages/skills/video-studio/references/generation.md)을 참고하세요.

`ovs speak`는 출력물 옆에 요청 및 오디오 영수증을 기록합니다. 정확히 일치하는 요청이고 오디오 데이터가 온전한 경우에만 재사용하므로, 승인된 `--language`, 목소리, 모델, 속도, 형식을 넘기세요. 이 중 하나라도 바꾸면 재사용할 수 없습니다. 또한 요청을 보내기 전에 출력을 선점하므로, 동시에 중복 호출이 발생하지 않습니다.

호스팅되는 음악 서비스는 없습니다. 음악은 사용자가 제공한 라이선스 파일을 사용하며, 에이전트가 각 파일의 출처와 라이선스를 기록합니다.

---

## 명령어 참조

각 명령의 타입이 지정된 입력은 `ovs <command> --help`로 확인하세요. MCP 도구는 같은 이름을 밑줄로 연결해 사용합니다. 예: `timeline_prepare`, `edit_trim_silence`.

| 영역 | 명령 |
|---|---|
| 설정 | `doctor`, `skills [--install]`, `skill <name>` |
| 제작 | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| 편집(ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| 분석 | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| 내레이션 | `narration timing · fit`, `speech-capabilities`, `speak` |
| 생성 | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| 이전 프로젝트 | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect`(`check`의 별칭) |

이전 `plan.json` EDL 형식과 `composition-manifest.json` 형식으로 만든 프로젝트도 '이전 프로젝트' 명령으로 계속 사용할 수 있습니다. 새 작업에는 장면 타임라인을 사용합니다. 조립된 `plan.json`은 구성 영상 소스뿐 아니라 완성된 파일도 검증하세요.

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

같은 기능의 MCP 도구 `plan_promise_check`는 `probe_produced`와 `video`를 받습니다. 길이, 캔버스 설정, 오디오, 통합 라우드니스, 줄별 발화 구간을 측정합니다. 내레이션 근거가 없으면 검사에 실패하고, 자막을 입힌 경우 자막 경고는 눈으로 확인해야 합니다.

---

## 비교

### OrkasVideoStudio, Claude Motion, CapCut, Higgsfield 비교

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **개요** | 코딩 에이전트가 구동하는 오픈소스 동영상 스튜디오 | Claude 안의 애니메이션 출력 기능 | ByteDance의 동영상 편집 앱 | 호스팅형 AI 이미지 및 동영상 플랫폼 |
| **사용 대상** | 누구나. Claude Code, Codex, Cursor 등 셸을 실행하거나 MCP를 지원하는 모든 에이전트와 함께 내 컴퓨터에서 실행 | Claude Team 및 Enterprise 플랜(베타) | 데스크톱, 모바일, 웹 앱. 무료 및 유료 요금제 | Higgsfield 계정. 무료 또는 월간 크레딧 요금제로, 웹 앱, API, MCP 커넥터 또는 CLI를 통해 이용 |
| **편집 방법** | 에이전트에게 변경 사항을 설명하거나, 브라우저 캔버스에서 텍스트, 그림, 장면 순서를 변경 | Claude 편집기에서 직접 또는 Claude에게 요청 | 타임라인에서 수작업 | 생성이나 편집을 할 때마다 웹 스튜디오에서, 또는 커넥터를 통해 내 에이전트에서 프롬프트로 지시 |
| **영상 소스** | 자르기, 이어 붙이기, 9:16 / 1:1 / 16:9로 리프레임, 무음과 필러 단어 제거, 비트에 맞춘 컷 | 텍스트, 차트, 도형, 이미지에 애니메이션 적용. 생성 영상이나 인물은 없음 | 완전한 수동 편집 | 클립에 대한 AI 편집: 객체와 배경 제거 또는 교체, 스타일 변경, 리프레임, 샷 업스케일 또는 연장 |
| **모션 그래픽** | HTML/CSS 장면: 키네틱 타이포그래피, 가격 카드, 로어서드, 데이터 콜아웃, 트랜지션 | 코드로 만드는 설명 애니메이션 | 템플릿, 텍스트 애니메이션, 효과 | Higgsfield의 AI Motion Designer가 After Effects 또는 Premiere Pro에서 만드는 타이틀, 트랜지션, 로고 리빌 |
| **사운드** | 장면별 내레이션, 말소리가 나올 때 음량이 줄어드는 배경 음악, 측정한 단어 타이밍 기반 자막 | Anthropic 도움말 문서에서 다루지 않음 | 앱 내 음성, 음악, 자막 도구 | AI 보이스오버, 음성 번역, 립싱크 |
| **생성 샷** | 설정한 제공업체로 만드는 이미지, 동영상 클립, 프레젠터. 예: Seedance 2.5, Kling 4.0, Google Cloud의 Veo 3.1, Runway Gen-4.5, Wan 3.0. 요금은 내 키로 청구 | 없음 | 대본이나 이미지에서 시작하는 AI 동영상 생성기 | 하나의 계정으로 쓰는 여러 호스팅 모델. Seedance 2.5, Kling 4.0, Veo 3.1, 그리고 Higgsfield만 제공하는 MAGI-2 포함 |
| **출력** | 전달 전에 길이, 캔버스 설정, 라우드니스, 내레이션을 검사한 MP4 | MP4 내보내기 | MP4 내보내기 | 생성된 클립과 이미지, 그리고 Higgsfield 자체 스튜디오 앱으로 만든 동영상 |
| **소스** | MIT. 모든 동영상은 내가 소유한 로컬 폴더 | 독점, 호스팅형 | 독점 | 독점, 호스팅형 |

직접 손으로 편집하고 싶다면 **CapCut**이나 Shotcut, Kdenlive 같은 오픈소스 타임라인 편집기를 고르세요. 팀이 이미 Team 또는 Enterprise 플랜으로 Claude를 쓰고 있고 설명 애니메이션이 필요하다면 **Claude Motion**을 고르세요. 여러 호스팅 모델을 하나의 청구서로 쓰고 싶거나, MAGI-2처럼 Higgsfield만 제공하는 모델이 필요하다면 **Higgsfield**를 고르세요. 코딩 에이전트가 내 제공업체 키로 영상 소스, 모션, 사운드를 하나의 타임라인에 담은 동영상 전체를 만들고, 그 결과를 확인하고 편집하고 다시 렌더링할 수 있는 파일로 남기고 싶다면 **OrkasVideoStudio**를 고르세요. Higgsfield와 OrkasVideoStudio는 함께 쓸 수도 있습니다. Higgsfield에서 생성한 클립은 OrkasVideoStudio 제작물에서 일반 영상 소스로 쓸 수 있습니다. 관련 내용은 2026년 11월 기준 [Anthropic 도움말 센터](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), [CapCut AI 동영상 생성기 페이지](https://www.capcut.com/tools/ai-video-generator), [higgsfield.ai](https://higgsfield.ai/)의 정보입니다.

---

## 자주 묻는 질문

### Claude Code로 동영상을 만들 수 있나요?

네. OrkasVideoStudio를 설치하면 Claude Code가 `video-studio` 스킬을 읽고 `ovs` CLI나 MCP 도구를 사용해 영상 소스를 편집하고, 모션 그래픽을 만들고, 내레이션과 자막을 넣고, 검사를 마친 MP4를 내 컴퓨터에서 렌더링합니다. Codex, Cursor를 비롯해 셸을 실행하거나 MCP를 지원하는 다른 에이전트도 같은 방식으로 작동합니다. [Claude Code, Codex 등 코딩 에이전트에서 구동하기](#claude-code-codex-등-코딩-에이전트에서-구동하기)를 참고하세요.

### 무료인가요? API 키가 필요한가요?

OrkasVideoStudio는 무료이며 MIT 라이선스입니다. 편집, 디자인된 모션 그래픽, 자막, 전사는 로컬에서 실행되며 API 키가 필요 없습니다. 이미지, 동영상 클립, 음성 생성은 선택 사항이며 자신의 제공업체 계정을 사용하고, 요금은 제공업체가 사용자에게 직접 청구합니다. 유료 호출을 하기 전에는 항상 에이전트가 제공업체, 모델, 요청 수, 예상 비용을 사용자에게 확인합니다. [생성 범위를 제한하는 장치](#생성-범위를-제한하는-장치)를 참고하세요.

### Claude Motion, CapCut, Higgsfield의 오픈소스 대안인가요?

네. Claude Motion처럼 Claude Code가 모션 그래픽을 코드로 작성하게 하지만, Team과 Enterprise 플랜에서만이 아니라 Pro, Max, Ultra 또는 API 키로 쓰는 Claude Code에서도 작동하며, 다른 에이전트와도 함께 쓸 수 있습니다. CapCut과 달리 사용자가 타임라인에서 직접 자르는 대신 에이전트가 사용자의 설명에 따라 편집합니다. Higgsfield와 달리 모델을 호스팅하거나 크레딧을 판매하지 않습니다. 내 에이전트가 내 키로 Seedance, Kling, Veo 등의 동영상 모델을 호출한 다음, 그 샷을 내 영상 소스, 모션 그래픽, 내레이션, 자막과 결합합니다. [비교](#비교)를 참고하세요.

### 이미 가지고 있는 영상 소스도 편집할 수 있나요?

네. 클립을 자르고 이어 붙이고, 9:16, 1:1 또는 16:9로 리프레임하고, 무음 구간과 필러 단어를 제거하고, 비트에 맞춰 컷을 나누고, 자막을 입히고, 라우드니스를 정규화합니다. 내 영상 소스는 모션 그래픽, 생성 샷과 같은 타임라인에 놓입니다.

### 어떤 동영상, 이미지, 음성 모델을 쓸 수 있나요?

동영상에는 Seedance, Kling, Veo(Google 또는 Google Cloud 경유), Runway, Wan, MiniMax, Vidu와 함께 Atlas, MuAPI를 쓸 수 있습니다. 이미지에는 Gemini, 그리고 OpenAI, 또는 Seedream을 포함한 모든 OpenAI 호환 엔드포인트를 쓸 수 있습니다. 음성에는 OpenAI, Doubao, MiniMax, Alibaba(Qwen 및 CosyVoice), Google, ElevenLabs, OpenAI 호환 엔드포인트를 쓸 수 있습니다. 모두 자신의 키로 실행됩니다. [생성 제공업체 직접 연결(BYO)](#생성-제공업체-직접-연결byo)을 참고하세요.

### 어떻게 설치하나요?

소스에서 설치합니다. 저장소를 클론하고 `pnpm install && pnpm build`를 실행한 다음 `ovs doctor`로 설정을 확인하세요. Node 22 이상, pnpm, ffmpeg와 ffprobe가 필요합니다. npm 패키지는 아직 공개되지 않았습니다. [설치](#설치)를 참고하세요.

---

## Orkas와의 관계

OrkasVideoStudio는 AI 팀 데스크톱 앱인 **[Orkas](https://orkas.ai?source=gh-orkas-vs)의 기본 탑재 동영상 에이전트**로 시작했습니다. 그곳에서 처음부터 끝까지 검증된 뒤, 특정 에이전트에 얽매이지 않는 MIT 라이선스의 이 툴킷으로 분리되었습니다.

- **Orkas 안에서는** 별도 설치 없이 [기본 제공 에이전트](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs)로 제공됩니다. 터미널 대신 데스크톱 앱에서 대화하며, 생성은 Orkas 내장 모델(신규 계정에는 500 크레딧이 무료로 제공됩니다)이나 자신의 키로 실행할 수 있습니다. macOS 또는 Windows용 [Orkas를 다운로드](https://orkas.ai/download/?source=gh-orkas-vs)하세요.
- **그 밖의 환경에서는** 위에서 설명한 대로 내 코딩 에이전트에 설치하고, `ovs` CLI, MCP 서버, 캔버스를 통해 같은 핵심 기능을 사용할 수 있습니다. 호스팅 제공업체, 크레딧, 채팅 게시 같은 Orkas 계정 기능은 이 저장소에 포함되지 않습니다.

링크: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[이 저장소](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## 패키지

| 패키지 | 내용 |
|---|---|
| `@orkas/video-studio-core` | 장면 타임라인 및 레거시 EDL 스키마, 전달 검사, 의사결정 도우미, 내레이션 타이밍, 런타임과 설정 |
| `@orkas/video-studio-tools` | 타임라인, 렌더링, 편집, 분석, 음성, 이미지, 동영상 백엔드와 브라우저 캔버스 |
| `@orkas/video-studio` | `ovs` CLI |
| `@orkas/video-studio-mcp` | CLI를 미러링하는 MCP 서버(`ovs-mcp`) |
| `@orkas/video-studio-skills` | 호스트 중립적인 `SKILL.md` 지식 팩 |

기술 계획과 그 이력은 [`PLAN.md`](./PLAN.md)에 있습니다. 이 저장소에서 작업하는 코딩 에이전트를 위한 메모는 [`AGENTS.md`](./AGENTS.md)에 있습니다.

---

## 개발

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

`pnpm install`은 [`patches/`](./patches/)에 있는 버전 관리된 HyperFrames 패치를 적용합니다. 이 패치는 SDR H.264/H.265 출력이 메타데이터에 선언된 BT.709 행렬을 사용하도록 합니다. 외부 `OVS_HYPERFRAMES_BIN`이나 `npx` 호환 대체 경로에는 이 패치가 적용되지 않으므로, 해당 런타임에 같은 효과의 색상 수정이 포함되어 있어야 합니다. 이 패치는 Whisper의 중국어 및 일본어 단어 단위 타임스탬프도 유지합니다. 외부 런타임에도 같은 지원이 필요합니다.

`test:video`는 제공업체 크레딧을 절대 쓰지 않습니다. 로컬의 가짜 Seedance 엔드포인트가 실제 H.264 픽스처를 반환하고, OVS가 이를 내려받아 `ffprobe`로 검증합니다.

`test:video:e2e`는 빌드된 CLI를 통해 두 가지 제작 경로를 모두 다룹니다.

- **이전 컴포지션 경로.** composition prepare/reconcile, 스냅숏, 전체 초안 게이트, 자막 입히기, 최종 파일 promise 검사를 사용해 9초짜리 3장면 1080p 제작물을 만듭니다. MP4 전체를 디코딩해 장면 순서, 눈에 보이는 움직임, 모든 장면에서 들리는 오디오, 입혀진 자막 픽셀을 검사하고, 잘못된 전달 길이가 거부되는지도 확인합니다.
- **현재 장면 타임라인.** 실제 HyperFrames 검사 및 스냅숏 경로를 통해 3장면 타임라인을 렌더링합니다. 장면 색상, 작성된 모션, 디코딩한 원본 동영상의 움직임, 자막 픽셀, 오디오, 변경 불가능한 전달, 오래된 렌더링 거부를 검사합니다.

빌드된 CLI와 MCP 인터페이스도 실제로 실행해 확인합니다. 필요한 런타임이 없으면 두 동영상 명령 모두 조치 방법을 알려 주는 오류와 함께 실패합니다. 일반 테스트 스위트는 ffmpeg 또는 브라우저가 없는 컴퓨터에서 런타임 의존도가 높은 사례를 건너뛸 수 있습니다.

모든 Git 커밋이나 PR 전에 최종 후보에서 `pnpm verify`가 통과해야 합니다. 여기에는 실제 제작 사례가 포함되며 CI 진입점이기도 합니다. 테스트만 바꾸는 변경에도 같은 규칙이 적용됩니다. 동기화나 릴리스 검토를 할 때는 생성된 동영상, 미리 보기, 최종 프레임, 보고서를 보관하고 살펴보세요.

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

증거 디렉터리는 옵트인이며, 실행마다 별도의 하위 디렉터리를 사용합니다. 일반 CI 실행은 임시 미디어를 정리합니다. 픽스처는 자체 제작한 HTML/SVG와 로컬에서 생성한 연주 음악을 사용합니다. 유료 제공업체를 호출하지 않으며, TTS나 모델 품질까지 검증한다고 주장하지도 않습니다.

`pnpm benchmark`는 키가 필요 없고 결정론적입니다. 코어 패키지를 빌드하고 벤치마크 픽스처를 검증한 다음, 게이트 전환, EDL 검증과 전달 요약, composition-manifest 검증, 내레이션 추정을 측정합니다. 각 스위트에는 의도적으로 보수적인 처리량 하한이 있어, 큰 성능 저하는 실패로 잡히고 일반적인 기기 간 편차로는 실패하지 않습니다.

설정, 명령 및 증거 자료 보관 방법은 [선택적 모델 평가 안내서](./eval/video/README.md)(영어)를 참고하세요.

## 버전

모든 패키지는 하나의 달력 버전 `YYYY.M.D`(Asia/Shanghai 날짜 기준, 0 채움 없음)를 공유합니다. 태그가 붙은 릴리스는 `v<version>` 형식을 쓰고 [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases)로 게시되며, 게시된 날짜 버전은 절대 덮어쓰지 않습니다. 변경 사항은 [CHANGELOG.md](CHANGELOG.md)에 정리되어 있습니다. 이 버전은 Orkas 데스크톱 앱 및 마켓플레이스 에이전트 버전과 별개입니다.

## 라이선스

MIT — [`LICENSE`](./LICENSE)를 참고하세요. 렌더링에는 Apache-2.0 라이선스인 [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` 의존성을 사용합니다. 편집과 미디어 검사는 시스템의 `ffmpeg`에서 처리하고, 전사는 HyperFrames / whisper.cpp에 맡깁니다. 서드파티 런타임을 찾는 방법과 라이선스 관련 참고 사항은 [`PLAN.md`](./PLAN.md)에서 설명합니다.
