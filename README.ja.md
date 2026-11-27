# OrkasVideoStudio

> コーディングエージェントを動画スタジオに変えます。Claude Code、Codex、Cursor など、シェルを実行できるか MCP に対応したエージェントに、完成した動画を頼んでください。エージェントは映像素材を編集し、モーショングラフィックスをデザインし、ナレーション、音楽、字幕を加え、足りないショットを自分のキーで生成して、チェック済みの MP4 を納品します。その MP4 は、ブラウザのキャンバスで引き続き編集できます。

**Claude Motion、CapCut、Higgsfield のオープンソース代替。すでにお使いのコーディングエージェントで動かせます。** MIT ライセンスでローカルファーストなので、Claude の Team プランや Enterprise プランも、動画プラットフォームのサブスクリプションも必要ありません。生成するショットは、自分のキーで Seedance、Kling、Veo などの動画モデルを使って作ります。[比較を見る ↓](#orkasvideostudio-と-claude-motioncapcut-の比較) · [Higgsfield との比較 ↓](#orkasvideostudio-と-higgsfield-の比較)

**コーディングエージェントではなくアプリで使いたいですか？** OrkasVideoStudio は、macOS と Windows 向けの無料の AI チーム・デスクトップアプリ **[Orkas](https://orkas.ai/?source=gh-orkas-vs)** に内蔵された動画エージェントでもあります。チャットで動画の内容を伝えると、生成は Orkas の内蔵モデル（新規アカウントには 500 クレジットが無料で付与されます）または自分のキーで実行されます。**[Orkas をダウンロード →](https://orkas.ai/download/?source=gh-orkas-vs)** · [両者の関係 ↓](#orkas-との関係)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

OrkasVideoStudio は**ブラックボックスの動画エージェントではありません**。考えるのはあなたのエージェントです。このプロジェクトは、エージェントがその場では用意できない部分を提供します。

- **動画制作のノウハウ**：特定のホストに依存しない `SKILL.md` パックで、入口となるスキルは `video-studio` です。いつ質問していつ作業を進めるか、広告、解説動画、製品デモ、音楽に合わせた編集、プレゼンター動画、短編映画、コメンタリーがそれぞれどう違うか、そして完成と判断する前に編集結果をどうチェックするかを扱います。
- **決定論的なツール**：`ovs` CLI と、それと同じ機能を持つ MCP サーバーです。制作タイムライン、ffmpeg による編集、文字起こし、映像素材の分析、自分のプロバイダーアカウントを通じた生成を扱います。ページのレンダリングとフレームキャプチャは [HyperFrames](https://github.com/heygen-com/hyperframes) が、編集と計測は `ffmpeg` が担います。
- **編集できる制作物**：各動画は普通のフォルダーで、シーンタイムライン（`videos/main/manifest.json`）、アセット台帳、出典付きの製品情報、任意のデザイン済みページが入っています。あなたもエージェントもブラウザのキャンバスも、同じファイルを編集します。テキストを 1 行変える、画像を差し替える、シーンを並べ替えるといった変更をしたら、再レンダリングするだけです。

編集、デザインされたモーショングラフィックス、字幕、文字起こしには **API キーは不要**です。画像・動画・音声の生成はオプトインで、**自分の**プロバイダーアカウントを使います。ホスト型のバックエンドはなく、アカウントを作成する必要もありません。

---

## 頼めること

一度頼めば、完成した動画が 1 本届きます。エージェントは、リクエストに必要な要素を 1 つのタイムラインにまとめます。

| 機能 | 内容 |
|---|---|
| **実際の映像素材を編集** | トリミング、結合、9:16 / 1:1 / 16:9 へのリフレーム、クリップの音声の保持またはミックス、オーバーレイ、字幕の焼き込み、ラウドネスの正規化。長い録画では、ハイライトを見つけ、繰り返し撮ったテイクをランク付けし、無音やフィラーワードを取り除くこともでき、各カットの根拠を記録します。 |
| **デザインされたモーション** | HTML/CSS とアニメーションで作るシーン：キネティックタイポグラフィ、価格カード、ロワーサード、データコールアウト、トランジション。編集できる文言は名前付きのテキストスロットに入っているため、文言を変えるためにシーンを作り直す必要はありません。 |
| **サウンドと字幕** | シーンごとのナレーションを、そのシーンの長さに合わせて用意します。ライセンス済みの BGM は、話し声に合わせて音量が下がります（ダッキング）。字幕はナレーションのテキストか、計測した単語のタイミングから作ります。カットはビートに合わせます。 |
| **生成ショット** | 手持ちの素材では見せられないショットのために、設定したプロバイダーで画像、動画クリップ、生成プレゼンター（トーキングヘッド）を作ります。生成は、あなたが承認した支出の範囲内でのみ行われます。 |

台本や絵コンテを頼んだ場合、エージェントはドキュメントの作成で止まります。完成した動画を頼んだ場合は、納品まで進めます。計画やプレビューを見せるのは、あなたが求めた場合か、動画が約 2 分を超える場合だけです。動画で一字一句そのまま使う台本をエージェントが書いた場合は、先にあなたに見せます。あなたが渡した台本は、書かれたとおりに制作されます。

---

## Team プランなしで、Claude Code でモーショングラフィックスを作る

Anthropic のアニメーション機能である Claude Motion は、Claude の Team プランと Enterprise プランでのみベータ提供されています。OrkasVideoStudio を使えば、Pro、Max、Ultra、または API キーで使う Claude Code でも、同じようにコードで作るモーショングラフィックスを実現できます。エージェントが各シーンをアニメーション付きの HTML と CSS で書き、サンプリングしたフレームを確認して、あなたのマシン上で MP4 をレンダリングします。そのため、レンダリング自体はトークンを消費しません。

1. OrkasVideoStudio を[インストール](#インストール)し、`ovs skills --install --target claude` を実行します（Codex の場合は `--target codex`）。
2. 動画を依頼します。たとえば：*「アプリのローンチ用に、20 秒・16:9 のモーショングラフィックス動画を作って。製品名を見せるキネティックタイポグラフィのオープニング、スライドインする 3 枚の機能カード、価格入りのエンディングカードで構成して。レンダリングする前に、各シーンの静止画を見せて。」*
3. 単語、色、タイミングを、シーンファイルやキャンバスで自分で変えるか、エージェントに頼んでから、もう一度レンダリングします。

Claude Motion と違い、同じタイムラインに自分の映像素材、ナレーション、音楽、字幕も入れられます。[比較](#orkasvideostudio-と-claude-motioncapcut-の比較)をご覧ください。

---

## ユースケース

各行は、エージェントに渡せるプロンプトの例です。使うツールは `video-studio` スキルが選びます。

### 広告・マーケティング

| 依頼の例 | 実行される内容 |
|---|---|
| *「この写真と商品ページから、このデスクランプの 20 秒の縦型広告を作って。」* | 写真を取り込み、価格と仕様を出典付きの情報として記録し、フック、機能、価格のシーンをデザインし、ナレーションと字幕を加えてから、チェック、レンダリング、納品を行います。 |
| *「うちのアプリの Web サイトから、30 秒のローンチ動画を作って。」* | ブラウザで実際の製品ページをキャプチャし、製品自身の文言と画面を使って、描き直したモックアップではなく、それらを中心にシーンを組み立てます。 |
| *「生成したホストがこの美容液を紹介する、30 秒のプレゼンター動画を作って。」* | まずモノローグを書き、架空のホストのキー画像を 1 枚作ってすべてのクリップで使い回し、あなたの動画プロバイダーで話すクリップを生成します。価格や訴求は、編集できる画面上のテキストとして残します。 |
| *「この台本から 15 秒・9:16 のプロモーションを作って。オープニングは生成、機能の紹介はモーションで構成、ナレーションは 1 本で。」* | 1 つのタイムラインに、生成したオープニング、デザインした機能紹介のシーン、1 本のナレーショントラックをまとめ、完成ファイルを納品前にチェックします。 |

### 映画・ドラマ

| 依頼の例 | 実行される内容 |
|---|---|
| *「夜勤の看護師を描いた 1 分の短編映画を作って。どのショットにも同じ 2 人の登場人物を出して。」* | 1 つのドラマチックな問いを軸に物語を組み立て、登場人物ごとに外見を表す 1 行の記述とキー画像 1 枚を固定してショット間の一貫性を保ち、あなたが承認した予算の範囲内で、あなたの動画プロバイダーでショットを生成します。 |
| *「このドラマ 3 話分を、ナレーション付きの 3 分のあらすじ動画にして。」* | 各話を文字起こしし、物語を担うシーンを選び、クレジットと次回予告を飛ばして、あらすじを書いて音声化し、その下にあなたの映像素材を編集して並べます。 |
| *「オープニング用に、夜明けの街の 5 秒のショットを生成して。」* | プロバイダー、モデル、費用を確認してから、あなたの動画プロバイダーでショットを 1 つ作り、タイムライン上であなたの映像素材の隣に配置します。 |

### 編集

| 依頼の例 | 実行される内容 |
|---|---|
| *「この 1 時間の画面録画から、字幕付きの 30 秒のハイライトクリップを 3 本作って。」* | シーン分析と品質分析で良い部分を見つけます。繰り返し撮ったテイクはランク付けされ、無音とフィラーはカットされ、計測した単語のタイミングから字幕が焼き込まれます。 |
| *「Web カメラで撮った動画から無音と『えー』を取り除いて、テンポよくして。」* | 無音の区間とフィラーワードを検出し、決定論的なジャンプカットを行い、削除したすべての区間について根拠を記録します。 |
| *「product-demo.mp4 に英語のナレーションと字幕を付けて、音量をそろえて。」* | 動画を文字起こしし、各行を翻訳して、対応する映像の時間枠に収まるように音声化します。その音声を既存の音にミックスし、字幕を焼き込み、ラウドネスを正規化します。 |
| *「旅行で撮ったこの 20 本のクリップを、この曲のビートに合わせて編集して。」* | 曲のビートを計測してクリップをそれに合わせてカットし、納品したファイルのビート合わせをチェックします。 |

### 解説動画・チュートリアル

| 依頼の例 | 実行される内容 |
|---|---|
| *「ベクトルデータベースについて、中国語ナレーション付きの 60 秒の解説動画を作って。」* | モーショングラフィックスのシーンを書き、あなたの TTS プロバイダーでナレーションを合成して、各行をそのシーンに収めます。 |
| *「設定ページの画面録画を、90 秒のチュートリアルにして。」* | 録画をトリミングし、実際の画面上で各コントロールを順を追って示し、ナレーションと字幕を加えます。 |

### 人気動画の再現

| 依頼の例 | 実行される内容 |
|---|---|
| *「このバズった動画の構成とテンポを、私の製品で再現して。まず計画を見せて。」* | 参考動画を分解し、その展開の区切りをあなたの素材に割り当て、制作に入る前にあなたの承認を待ちます。 |
| *「この競合の広告は成果が出ている。同じフックとリズムで、うちの写真を使って広告を作って。」* | 参考動画から借りるのはフック、根拠の提示、CTA のリズムであり、内容は借りません。すべての訴求はあなたの製品情報から、すべての画像はあなたの素材から取ります。 |

エージェントに**参考動画ファイル**と、自分の製品素材、台本、映像素材を渡してください。エージェントは OrkasVideoStudio を使って、その**物語の構成、映像スタイル、編集のテンポ**を新しいコンテンツで再現できます。

1. **参考動画を分析する**：サンプリングしたフレームと関連する音声を確認し、フック、実演や根拠、情報の順序、タイポグラフィ、トランジション、テンポ、CTA（行動喚起）を特定します。
2. **翻案を計画する**：何を残して何を差し替えるかを明示し、参考動画の各場面を新しいシーンやタイムラインに対応づけます。タイミングは、実際のナレーションと読むのにかかる時間に合わせて調整します。
3. **制作して修正する**：モーショングラフィックスを構成し、映像素材を編集し、必要に応じて足りない映像を生成します。ローカルで作成したテキスト、字幕、ナレーション、クリップは個別に編集できます。生成した映像に焼き込まれたテキストは、その映像自体を変えなければ変更できません。

この方法は、モーショングラフィックスの解説動画、SaaS やアプリのデモ、既存の映像から作る製品広告に最も適しています。SNS の共有リンクからのダウンロード機能は内蔵されていないため、エージェントが読み込めるファイルから始めてください。正確なカメラワーク、人物の演技、フレーム単位での一致は保証されません。納品チェックでは、結果が参考動画にどれだけ近いかは採点しません。詳しくは[参考動画再現ワークフロー](./packages/skills/video-craft/references/reference-recreation.md)をご覧ください。

---

## インストール

**前提条件**：Node ≥ 22、`pnpm`、そして `PATH` 上にある `ffmpeg` と `ffprobe`。バージョン固定の [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` パッケージが依存関係としてインストールされ、チェックとレンダリングのためにヘッドレス Chrome でページを描画します。`npx` は互換性のためのフォールバックにすぎません。生成は任意で、自分のキーが必要です。

### ソースから（現在利用可能）

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### npm から（公開後）

npm パッケージはまだ公開されていません。公開後も、`ovs` コマンドは同じように動作します。

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Claude Code、Codex、その他のコーディングエージェントから操作する

正規のインターフェースは `ovs` CLI で、MCP ツールはそれと同じ機能を提供します。エージェントが対応している方法を使ってください。

**1) ネイティブスキル（Claude Code / Codex）**：スキルパックをインストールすると、エージェントが自分で見つけられるようになります。

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

同じスキルパックは [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) にも掲載されているので、`npx skills add orkas-ai/orkas-videostudio` でもインストールできます。スキルは `ovs` CLI を呼び出すため、先に上記の手順で CLI をインストールしてください。

**2) MCP ツール**：サーバーを登録します。

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) 自己記述型の CLI（シェルを使える任意のエージェント）**：ローダーは不要です。

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

あとはエージェントに動画を頼むだけです。エージェントはまず `video-studio` を読み、必要な工程別のリファレンスと制作技法のリファレンスを読み込みます。

---

## 制作の仕組み

エージェントは短いフォルダー名を決め、すべてをその中にまとめます。

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

シーンの順序がそのまま再生順です。開始時刻と全体の長さはシーンから計算され、保存されることはないため、シーンを移動してもタイミングが食い違うことはありません。価格は `product.json` に 1 回だけ記録され、それを表示するすべてのシーンがそこから読み取ります。別のアスペクト比、言語、A/B カットといった並行するバリエーションでは、エージェントが同じアセットを共有する動画 ID を追加します。[タイムラインの仕様](packages/skills/video-studio/references/timeline.md)をご覧ください。

典型的な流れは次のとおりです。

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` は、記録する前に最終ファイルを計測します。対象は、長さ、キャンバス設定、音声、ラウドネス、ナレーションのカバー率です。字幕の警告は目視で確認すべきものとして示され、実際の MP4 から取り出したフレームが返されます。納品はそれぞれ変更不可のバージョンになります。最新の変更より前に作られたレンダリングは古いものとして拒否され、以前の納品が上書きされることはありません。これらのチェックに合格しても、映像の品質が保証されるわけではありません。誰かが実際にフレームを見るまで、目視レビューは `not_checked` として扱われます。

残っている特定の指摘を明示的に受け入れる場合は、その正確なコードを `--accept-findings '["CODE"]' --accept-reason '<your decision>'` で渡します。その判断はバージョンに記録され、ほかのエラーは引き続き納品をブロックします。書き込みは `.ovs-timeline.lock` で直列化されます。クラッシュでこのファイルが残った場合は、所有していたプロセスが停止していることを確認してから削除してください。どちらについても[タイムラインの仕様](packages/skills/video-studio/references/timeline.md)で説明しています。

**修正は安く、ローカルで済みます。** 単語、カット、順序、BGM、字幕の変更は、その場で編集されます。音声を作り直すのは話す内容が変わった行だけ、再生成するのは問題のあるショットだけで、どちらもすでに承認された支出の範囲内で行います。字幕のテキストを編集しても、話している音声は変わりません。HyperFrames は毎回動画全体をレンダリングします。このポータブル版は、レンダリング済みのシーンをキャッシュしません。

---

## ブラウザの動画キャンバス

CLI または MCP から `timeline import`、`timeline prepare`、`timeline render`、`timeline ship` を実行して成功すると、OVS はその制作物のキャンバスを既定のブラウザで開きます。以降のコマンドは、新しいタブを開かずに同じタブを再利用します。キャンバスは CLI や MCP と同じファイルを編集するため、変更は双方向に反映されます。エージェントが作業している間は、閲覧のみの状態になります。

キャンバスでは次のことができます。

- **再生と書き出し**：動画を再生し、納品済みのバージョンを切り替えて、必要なものをダウンロードできます。
- **素材の整理**：映像素材をアップロード、ドロップ、貼り付けし、ボード上でカードを移動したりつないだりできます。
- **シーンの編集**：文言、順序、画像を変更し、シーンを追加、削除、または元に戻せます。
- **ショットの生成とやり直し**：カードから新しい画像ショットや動画ショットを作ったり、既存のショットを生成し直したりできます。参照素材、または最初と最後のフレームを選び、さらにモデル、解像度、音を選びます。モデルが対応できないオプションは無効になります。以前の結果を順に見て、使うものを選べます。有料のリクエストの前には毎回確認を求めます。
- **動画の更新**：通常のシーン編集はローカルでレンダリング・納品され、進捗は動画カードに表示されます。製品情報、ナレーションの行、動画全体の声を変更すると、エージェント向けのリクエストが作成されます。これらの編集にはエージェントの判断が必要だからです。シーンが静止画のままになっているために納品チェックが更新を止めた場合、動画カードには **この版をプレビュー**、**編集に戻る**、**そのまま更新** が表示されます。「そのまま更新」を選ぶと、再レンダリングせずにそのレンダリング結果を残します。
- **エージェントに伝える**：シーン、ショット、素材カード、動画について短いリクエストを書きます。リクエストはそのカードのコンテキストと一緒に送られます。

キャンバスは中国語で開き、19 の選択肢から選んだ言語を記憶します。

### エージェントへリクエストを送り返す

**Send** は、その制作物を作った会話にだけ届けます。その会話がリクエストを受け取れない場合、下書きはキャンバスに残ります。クリップボードへのコピー、自動での再送、新しいセッションへの送信は一切行いません。編集、更新、書き出しは、エージェントが接続されていなくても引き続き使えます。

- **Codex**：`ovs` が Codex のスレッド内で実行されている場合、リクエストはその同じスレッドのキューに入ります。これには Codex CLI 0.160.1 以降が必要で、そのローカルアプリサーバーが起動している必要があります。閉じられた、または読み込まれていないスレッドは利用不可と表示されます。
- **Claude Code**：リクエストは MCP チャネル経由で届きます。MCP チャネルは Claude Code のリサーチプレビュー機能で、通常の MCP 接続では足りません。`--claude-channel` を付けてサーバーを登録し、チャネルを有効にして Claude Code を起動します。

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  キャンバスがそのチャネルに紐づいた状態で開くよう、動画は `ovs` の MCP ツールを通じて作成してください。シェルの CLI から開いたキャンバスは Claude Code に届きません。Claude Code は起動時にローカル開発に関する警告を表示します。チャネルには claude.ai へのログインまたは Console の API キーが必要で、Team プランと Enterprise プランでは、先に管理者がチャネルを有効にする必要があります。[Claude Code のチャネル](https://code.claude.com/docs/en/channels)をご覧ください。

### 制作物を自分で開く

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

キャンバスを使っている間は、コマンドを実行したままにしてください。`--agent` を付けると、キャンバスは制作フォルダー内でネイティブセッションを実行します。このセッションは、CLI 自身のサインイン、モデル、権限設定を使い、Codex 0.160.1+ または Claude Code 2.1.148+ が必要です。権限の確認や質問はキャンバスに表示されます。通常はそのフォルダーに保存されたセッションを復元しますが、`--resume <session-id>` を渡すと特定のセッションを引き継ぎ、`--new-session` を渡すと新しく始めます。そのほかのオプションは次のとおりです。

- `--no-open` は、ブラウザを開かずにアクセスリンクを表示します。
- `--port` は、ループバックポートを指定します。
- `--recover` は、以前の所有者が終了したキャンバスを取り戻します。

制作作業中の自動オープンを無効にするには、`OVS_STUDIO_AUTO_OPEN=0` を設定します。CI では最初から無効です。

---

## 生成プロバイダーの持ち込み（BYO）

プロバイダーは `~/.config/orkas-video-studio/config.json`（または `$OVS_CONFIG_DIR/config.json`）か、環境変数で設定します。環境変数はファイルの設定より優先されます。

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| 機能 | `provider` の値 | 環境変数 |
|---|---|---|
| 音声合成（`ovs speak`） | `openai`、`openai-compatible`、`doubao`、`minimax`、`aliyun`（Qwen / CosyVoice）、`google`、`elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| 画像（`ovs image`） | `openai`（Seedream を含む任意の OpenAI 互換エンドポイント）、`gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| 動画（`ovs video`） | `doubao`（Seedance）、`minimax`、`vidu`、`kling`、`google`（Veo）、`google-cloud`（Veo）、`runway`、`aliyun`（Wan）、`atlas`、`muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

有料の呼び出しを一切行わずに、設定を確認できます。

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

各ナレーション行がシーンまたは計画上の時間枠に収まるよう、音声合成の前後に `ovs narration fit` を実行してください。動画生成では、参照画像、アスペクト比、長さ、解像度、音声フラグを明示的に受け取るため、プロバイダーへの呼び出しが承認された計画と一致します。`plan.json` プロジェクトでは、何かを生成する前に、`ovs plan validate` が各生成セグメントのアスペクト比、長さ、操作を、設定された `video.provider` に照らしてチェックします。

一部のプロバイダーでは、追加の設定が必要です。

- **Google Cloud Veo** は、`video.workspace_id`、`video.region`、および `video.api_key` に入れた API トークンまたはサービスアカウント JSON を使います。
- **Alibaba** の音声合成は、`tts.base_url` に指定したワークスペースのエンドポイントを使います。Wan の動画には `video.workspace_id` と `video.region` が必要です。
- **クローン専用の声**には、プロバイダーに登録した音声 ID が必要です。
- **WebSocket の音声合成**は、`tts.proxy_url` を設定した場合にのみ、そのプロキシを経由します。
- **動画の参照素材**は、公開された画像または動画の URL として渡されます。対応する数や、最初/最後のフレームへの対応はモデルによって異なります。
- **[MuAPI](https://muapi.ai)** は、`video.provider: "muapi"` で明示的に選択する必要があります。選択した場合は `MUAPI_API_KEY` が `OVS_VIDEO_API_KEY` より優先されますが、キーがあるだけで MuAPI が選択されることはありません。`video.model` / `OVS_VIDEO_MODEL` は、検証済みの Kling v2.1 エンドポイント `kling-v2.1-master-t2v`、`kling-v2.1-master-i2v`、`kling-v2.1-standard-i2v`、`kling-v2.1-pro-i2v` に対応しています。それ以外のスラッグは、合わないリクエスト本文のまま送信されるのではなく、拒否されます。テキストからの動画生成のデフォルトは `kling-v2.1-master-t2v`、最初のフレームとして `image_url` を指定した場合のデフォルトは `kling-v2.1-master-i2v` です。長さは 5 秒または 10 秒、アスペクト比は `16:9`、`9:16`、`1:1` のいずれかです。プロバイダーに依存しない `resolution`、`generate_audio`、`quality` の入力は、署名済みの計画との互換性を保ちます。Kling は解像度と音声を無視し、quality は検証されますが送信されません。編集と追加の参照素材の指定は、対応する MuAPI スキーマがサポートされるまで拒否されます。デフォルトのベース URL には `/api/v1` が含まれており、カスタムのベース URL にも含める必要があります。送信とポーリングの仕様やモデル固有のパラメーターについては、[MuAPI API リファレンス](https://muapi.ai/docs/api-reference)をご覧ください。

プロバイダーのモデルカタログは、各プロバイダーの API 仕様を記述したものです。現時点での利用可否や料金を保証するものではありません。

---

## 生成を範囲内に抑える仕組み

エージェントは、既存の素材で用が足りるショットにはその素材を使い、足りないものだけを生成します。認証情報が設定されていても、支出が承認されたことにはなりません。有料の作業を始める前に、エージェントはプロバイダー、モデル、目的、リトライを含むリクエスト数、見積もり費用を確認し、その後はその範囲を守ります。断ると、そのリクエストに対する有料の呼び出しは止まります。出来の悪いショットの作り直しは最大 2 回までで、その後はアプローチを変えるようエージェントがあなたに求めます。

有料のリクエストは、それぞれ出力の隣にレシートを残します。結果が不明な動画タスクがあると、あなたが確認するまで同じ出力への再送信はブロックされ、そのタスクが自動で再実行されることもありません。[生成の権限](packages/skills/video-studio/references/generation.md)をご覧ください。

`ovs speak` は、出力の隣にリクエストと音声のレシートを書き出します。再利用するのは、完全に一致するリクエストで、かつ音声データが壊れていない場合だけです。そのため、承認された `--language`、声、モデル、速度、フォーマットを渡してください。いずれかを変えると再利用できなくなります。また、送信前に出力先を確保するため、同時に重複した呼び出しが起きるのを防ぎます。

ホスト型の音楽サービスはありません。音楽はあなたが用意したライセンス済みのファイルを使い、エージェントは各ファイルの入手元とライセンスを記録します。

---

## コマンドリファレンス

各コマンドの型付き入力は `ovs <command> --help` で確認できます。MCP ツールは同じ名前をアンダースコアでつないだものを使います（例：`timeline_prepare`、`edit_trim_silence`）。

| 分野 | コマンド |
|---|---|
| セットアップ | `doctor`、`skills [--install]`、`skill <name>` |
| 制作 | `timeline import · prepare · status · check · snapshot · render · ship`、`studio` |
| 編集（ffmpeg） | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| 分析 | `transcribe`、`phrases`、`silence`、`scenes`、`quality`、`beats`、`activity` |
| ナレーション | `narration timing · fit`、`speech-capabilities`、`speak` |
| 生成 | `image`、`image-prepare`、`video`、`video-models`、`video-params` |
| 旧形式のプロジェクト | `composition prepare · reconcile`、`plan validate · summarize · promise-check · rank-takes`、`draft`、`render`、`lint`、`check`、`snapshot`、`gate transition`、`inspect`（`check` の別名） |

以前の `plan.json` EDL 形式や `composition-manifest.json` 形式で作られたプロジェクトも、「旧形式のプロジェクト」のコマンドで引き続き扱えます。新しい作業ではシーンタイムラインを使います。組み立て済みの `plan.json` では、構成要素の映像素材だけでなく、完成ファイルも検証してください。

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

同等の MCP ツール `plan_promise_check` は、`probe_produced` と `video` を受け付けます。長さ、キャンバス設定、音声、統合ラウドネス、行ごとの発話区間を計測します。ナレーションの根拠が欠けているとチェックは失敗し、字幕を焼き込んだ場合は、字幕の警告を目視で確認する必要があります。

---

## 比較

### OrkasVideoStudio と Claude Motion・CapCut の比較

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **概要** | コーディングエージェントが操作する、オープンソースの動画スタジオ | Claude 内のアニメーション出力機能 | ByteDance の動画編集アプリ |
| **利用できる人** | 誰でも。Claude Code、Codex、Cursor など、シェルを実行できるか MCP に対応した任意のエージェントで、あなたのマシン上で動作 | Claude の Team プランと Enterprise プラン（ベータ） | デスクトップ、モバイル、Web のアプリ。無料プランと有料プランあり |
| **編集方法** | エージェントに変更内容を伝えるか、ブラウザのキャンバスでテキスト、画像、シーンの順序を変更 | Claude のエディターで編集するか、Claude に頼む | タイムライン上で手作業 |
| **映像素材** | トリミング、結合、9:16 / 1:1 / 16:9 へのリフレーム、無音とフィラーワードの除去、ビートに合わせたカット | テキスト、グラフ、図形、画像をアニメーション化。生成映像や人物はなし | フル機能の手動編集 |
| **モーショングラフィックス** | HTML/CSS のシーン：キネティックタイポグラフィ、価格カード、ロワーサード、データコールアウト、トランジション | コードで作る解説アニメーション | テンプレート、テキストアニメーション、エフェクト |
| **サウンド** | シーンごとのナレーション、話し声に合わせて音量が下がる BGM、計測した単語のタイミングによる字幕 | Anthropic のヘルプ記事には記載なし | アプリ内の音声、音楽、字幕ツール |
| **出力** | MP4。納品前に長さ、キャンバス設定、ラウドネス、ナレーションをチェック | MP4 書き出し | MP4 書き出し |
| **ソース** | MIT。すべての動画はあなたが所有するローカルフォルダー | プロプライエタリ、ホスト型 | プロプライエタリ |

手作業でカット編集したいなら、**CapCut** か、Shotcut や Kdenlive などのオープンソースのタイムラインエディターを選んでください。チームがすでに Team プランか Enterprise プランで Claude を使っていて、解説アニメーションが必要なら **Claude Motion** を選んでください。映像素材、モーション、サウンドを 1 つのタイムラインにまとめた動画全体をコーディングエージェントに作らせ、その結果を確認・編集・再レンダリングできるファイルとして残したいなら、**OrkasVideoStudio** を選んでください。Claude Motion の情報は、2026 年 11 月時点の [Anthropic のヘルプセンター](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion)に基づいています。

### OrkasVideoStudio と Higgsfield の比較

Higgsfield は、多数の動画モデルと画像モデルを 1 つのアカウントで販売するホスト型プラットフォームで、Web アプリ、API、MCP コネクター、CLI から利用できます。OrkasVideoStudio はモデルをホストしません。あなたのエージェントが設定されたプロバイダーを呼び出し、そのショットを完成した動画に仕上げます。

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **概要** | コーディングエージェントが操作する、オープンソースの動画スタジオ | ホスト型の AI 画像・動画プラットフォーム |
| **動画モデル** | 設定したプロバイダー。Seedance 2.5、Kling 4.0、Google Cloud 上の Veo 3.1、Runway Gen-4.5、Wan 3.0、MiniMax H3、Vidu Q3 など | 1 つのアカウントで使える多数のホスト型モデル。Seedance 2.5、Kling 4.0、Veo 3.1、そして Higgsfield だけが提供する MAGI-2 を含む |
| **支払い方法** | 各プロバイダーが自分のキーに課金。編集、モーショングラフィックス、字幕、文字起こしはローカルで動作し、キーは不要 | Web アプリとコネクターではサブスクリプションのクレジット、API では入金した残高からの秒単位の従量課金 |
| **得られるもの** | 生成ショットを、あなたの映像素材、モーショングラフィックス、ナレーション、音楽、字幕と組み合わせた、チェック済みの MP4 1 本。さらに、編集・再レンダリングできる制作フォルダー | 生成されたクリップと画像、Higgsfield 独自のスタジオアプリ |
| **コーディングエージェントから** | Claude Code、Codex、Cursor など任意のエージェント向けのスキル、`ovs` CLI、MCP サーバー | Higgsfield の MCP コネクター、CLI、スキル |
| **ソース** | MIT。すべての動画はあなたが所有するローカルフォルダー | プロプライエタリ、ホスト型 |

多数のホスト型モデルを 1 つの請求にまとめたい場合や、MAGI-2 のように Higgsfield だけが提供するモデルを使いたい場合は、**Higgsfield** を選んでください。自分のプロバイダーキーで動画全体をコーディングエージェントに作らせ、その結果をファイルとして残したい場合は、**OrkasVideoStudio** を選んでください。両者は併用もできます。Higgsfield で生成したクリップは、OrkasVideoStudio の制作物では普通の映像素材として扱えます。Higgsfield の情報は、2026 年 11 月時点の [higgsfield.ai](https://higgsfield.ai/mcp) と [MAGI-2 のページ](https://higgsfield.ai/magi-2-intro)に基づいています。

### OrkasVideoStudio とフレームワーク、SaaS エディター、ラッパーの比較

HyperFrames、ffmpeg、whisper.cpp は、ここでは競合ではなく**依存関係**です。OrkasVideoStudio は、それらの上にあるエージェント向けのレイヤーで、知識、納品チェック、編集可能な制作物、キャンバスを提供します。

| | OrkasVideoStudio | プログラマティックなフレームワーク（Remotion、Revideo） | AI SaaS エディター（Descript、Opus Clip、Runway） | 薄い MCP / ffmpeg ラッパー |
|---|---|---|---|---|
| **操作する主体** | 任意のコーディングエージェントが自然言語で操作（CLI + MCP） | あなたが React/TS を手書き | GUI / ホスト型 | エージェント。ただしツールのみ |
| **成果物** | ローカルフォルダー内の編集可能なシーンタイムラインと、ブラウザのキャンバス | コード（再実行してレンダリング） | ブラックボックスのタイムライン / ホスト型のプロジェクト | なし |
| **対応範囲** | 映像素材の編集 + デザインされたモーション + ナレーション + 生成を 1 つのタイムラインで | コンポジション（プログラマティック） | 製品ごとに、主に編集*か*生成のどちらか | ツールが公開している範囲 |
| **ガイダンス** | 「良い動画の条件」をスキルとして同梱し、決定論的な納品チェックも提供 | なし。自分で判断 | 製品の方針に依存 | なし |
| **キー / ホスティング** | コア機能はキー不要。生成には**自分の**キー。ローカルファースト | 自前のインフラ | ベンダーのキー + ホスト型、ロックイン | まちまち |
| **ライセンス** | MIT | チームでの利用には企業ライセンスが必要な場合あり | プロプライエタリ | まちまち |

すべてのフレームを手でコーディングしたいなら**フレームワーク**を、GUI とホスティングが目的なら **SaaS エディター**を選んでください。動画を*エージェント*に作らせ、その結果を確認・編集・再レンダリングできるファイルとして残し、自分のキーでローカルにとどまりたいなら、**OrkasVideoStudio** を選んでください。

---

## Orkas との関係

OrkasVideoStudio は、AI チーム・デスクトップアプリである **[Orkas](https://orkas.ai?source=gh-orkas-vs) の内蔵動画エージェント**として始まりました。そこでエンドツーエンドで実績を積んだのち、エージェントに依存しない MIT ライセンスのこのツールキットとして切り出されました。

- **Orkas の中では**、[内蔵エージェント](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs)として提供され、別途インストールする必要はありません。ターミナルではなくデスクトップアプリでチャットし、生成は Orkas の内蔵モデル（新規アカウントには 500 クレジットが無料で付与されます）または自分のキーで実行できます。macOS 版または Windows 版の [Orkas をダウンロード](https://orkas.ai/download/?source=gh-orkas-vs)してください。
- **それ以外の環境では**、上記の手順で自分のコーディングエージェントにインストールし、`ovs` CLI、MCP サーバー、キャンバスを通じて同じコア機能を利用できます。ホスト型プロバイダー、クレジット、チャットへの公開といった Orkas アカウントの機能は、このリポジトリには含まれていません。

リンク：**[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[このリポジトリ](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## パッケージ

| パッケージ | 内容 |
|---|---|
| `@orkas/video-studio-core` | シーンタイムラインと旧 EDL のスキーマ、納品チェック、意思決定ヘルパー、ナレーションのタイミング、ランタイムと設定 |
| `@orkas/video-studio-tools` | タイムライン、レンダリング、編集、分析、音声合成、画像、動画のバックエンドと、ブラウザのキャンバス |
| `@orkas/video-studio` | `ovs` CLI |
| `@orkas/video-studio-mcp` | CLI と同じ機能を持つ MCP サーバー（`ovs-mcp`） |
| `@orkas/video-studio-skills` | ホストに依存しない `SKILL.md` 知識パック |

技術計画とその経緯は [`PLAN.md`](./PLAN.md) にあります。このリポジトリで作業するコーディングエージェント向けのメモは [`AGENTS.md`](./AGENTS.md) にあります。

---

## 開発

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

`pnpm install` は、[`patches/`](./patches/) にあるバージョン管理された HyperFrames のパッチを適用します。このパッチにより、SDR の H.264/H.265 出力は、メタデータで宣言している BT.709 マトリクスを使うようになります。外部の `OVS_HYPERFRAMES_BIN` や `npx` による互換フォールバックにはこのパッチが適用されないため、そのランタイムには同等の色の修正が含まれている必要があります。

`test:video` がプロバイダーのクレジットを消費することはありません。ローカルの偽の Seedance エンドポイントが本物の H.264 フィクスチャを返し、OVS がそれをダウンロードして `ffprobe` で検証します。

`test:video:e2e` は、ビルド済みの CLI を通じて両方の制作パスをカバーします。

- **旧来のコンポジションパス**：composition prepare/reconcile、スナップショット、完全なドラフトゲート、字幕の焼き込み、最終ファイルの promise チェックを使って、9 秒・3 シーン・1080p の制作物を作ります。MP4 全体をデコードし、シーンの順序、目に見える動き、すべてのシーンで音声が聞こえること、焼き込まれた字幕のピクセルをチェックし、誤った納品の長さが拒否されることも確認します。
- **現在のシーンタイムライン**：実際の HyperFrames のチェックとスナップショットのパスを通じて、3 シーンのタイムラインをレンダリングします。シーンの色、作成したモーション、デコードした元動画の動き、字幕のピクセル、音声、変更不可の納品、古いレンダリングの拒否をチェックします。

ビルド済みの CLI と MCP のインターフェースも実際に動かして確認します。必要なランタイムがない場合、どちらの動画コマンドも対処方法がわかるエラーで失敗します。通常のテストスイートは、ffmpeg やブラウザがないマシンでは、ランタイムへの依存が大きいケースをスキップすることがあります。

Git のコミットや PR の前には、最終候補で `pnpm verify` が通っている必要があります。これには実際の制作ケースが含まれ、CI のエントリーポイントでもあります。テストだけの変更にも同じルールが適用されます。同期やリリースのレビューでは、生成された動画、プレビュー、最終フレーム、レポートを残して確認してください。

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

証跡ディレクトリはオプトインで、実行ごとに専用の子ディレクトリを使います。通常の CI 実行では、一時的なメディアは削除されます。フィクスチャには、オリジナルの HTML/SVG とローカルで生成したインストゥルメンタル音声を使います。有料のプロバイダーは呼び出さず、TTS やモデルの品質をカバーしているとも主張しません。

`pnpm benchmark` はキー不要で決定論的です。コアパッケージをビルドし、ベンチマークのフィクスチャを検証してから、ゲートの遷移、EDL の検証と納品サマリー、composition-manifest の検証、ナレーションの見積もりを計測します。各スイートには意図的に控えめなスループットの下限が設定されているため、大きな性能低下は失敗になりますが、通常のマシン差では失敗しません。

## バージョン

すべてのパッケージは、1 つのカレンダーバージョン `YYYY.M.D`（Asia/Shanghai の日付、ゼロ埋めなし）を共有します。タグ付きリリースは `v<version>` を使い、[GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) として公開されます。公開済みの日付バージョンが上書きされることはありません。変更点は [CHANGELOG.md](CHANGELOG.md) に記載されています。このバージョンは、Orkas デスクトップアプリやそのマーケットプレイスのエージェントのバージョンとは独立しています。

## ライセンス

MIT — [`LICENSE`](./LICENSE) をご覧ください。レンダリングには、Apache-2.0 ライセンスの依存関係である [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` を使用します。編集とメディアのチェックにはシステムの `ffmpeg` を使い、文字起こしは HyperFrames / whisper.cpp に委ねます。サードパーティのランタイムの探し方とライセンスに関する注記は、[`PLAN.md`](./PLAN.md) で説明しています。
