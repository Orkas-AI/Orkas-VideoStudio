# OrkasVideoStudio

> OrkasVideoStudio là một trình chỉnh sửa video AI mã nguồn mở, biến tác tử lập trình của bạn thành một xưởng video. Hãy yêu cầu Claude Code, Codex, Cursor hoặc bất kỳ tác tử nào có thể chạy shell hoặc hỗ trợ MCP làm ra một video hoàn chỉnh. Tác tử sẽ biên tập tư liệu quay của bạn, thiết kế motion graphic, thêm lời thuyết minh, nhạc và phụ đề, tạo các cảnh quay còn thiếu bằng khóa của riêng bạn, rồi bàn giao một tệp MP4 đã được kiểm tra. Bạn có thể tiếp tục chỉnh sửa tệp MP4 đó trên bảng vẽ (canvas) trong trình duyệt.

**Một lựa chọn thay thế mã nguồn mở cho Claude Motion, CapCut và Higgsfield, do chính tác tử lập trình bạn đang dùng điều khiển.** Giấy phép MIT và ưu tiên cục bộ, không cần gói Claude Team hay Enterprise và không cần thuê bao nền tảng video: các cảnh quay do AI tạo đến từ Seedance, Kling, Veo và các mô hình video khác, dùng khóa của riêng bạn. [Xem so sánh ↓](#so-sánh)

**Thích dùng ứng dụng hơn tác tử lập trình?** OrkasVideoStudio cũng là tác tử video tích hợp sẵn trong **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, ứng dụng desktop đội ngũ AI miễn phí cho macOS và Windows. Hãy mô tả video trong cuộc trò chuyện; việc tạo nội dung chạy trên các mô hình tích hợp sẵn của Orkas (tài khoản mới nhận 500 tín dụng miễn phí) hoặc trên khóa của riêng bạn. **[Tải Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Quan hệ giữa hai sản phẩm ↓](#quan-hệ-với-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*Video tổng quan dài 54 giây ở trên cho thấy một bản brief trở thành một video hoàn chỉnh: cắt tư liệu quay thật, thiết kế chuyển động, thêm giọng nói, nhạc và phụ đề, thử các cảnh quay trên bảng vẽ, rồi đổi chữ, thay cảnh quay hoặc sắp xếp lại các phân cảnh.*

OrkasVideoStudio **không phải là một tác tử video hộp đen**. Tác tử của bạn đảm nhận phần suy nghĩ. Dự án này cung cấp cho nó những phần mà nó không thể tự ứng biến:

- **Kiến thức về video.** Một gói `SKILL.md` không phụ thuộc vào host, với `video-studio` là kỹ năng khởi đầu. Gói này hướng dẫn khi nào nên hỏi và khi nào nên làm tiếp, quảng cáo, video giải thích, demo sản phẩm, video dựng theo nhạc, video có người dẫn, phim ngắn và video bình luận khác nhau thế nào, và cách kiểm tra một bản dựng trước khi coi là xong.
- **Công cụ tất định.** CLI `ovs` và một máy chủ MCP phản chiếu nó. Chúng bao gồm dòng thời gian sản xuất, biên tập bằng ffmpeg, chép lời, phân tích tư liệu quay và tạo nội dung qua tài khoản nhà cung cấp của riêng bạn. [HyperFrames](https://github.com/heygen-com/hyperframes) đảm nhận việc kết xuất trang và chụp khung hình; `ffmpeg` đảm nhận việc biên tập và đo lường.
- **Một dự án sản xuất có thể chỉnh sửa.** Mỗi video là một thư mục thông thường: dòng thời gian phân cảnh (`videos/main/manifest.json`), sổ ghi tư liệu, thông tin sản phẩm có dẫn nguồn và một trang thiết kế tùy chọn. Bạn, tác tử của bạn và bảng vẽ trong trình duyệt đều chỉnh sửa cùng các tệp đó. Đổi một dòng chữ, thay một hình ảnh hoặc sắp xếp lại các phân cảnh, rồi kết xuất lại.

Biên tập, motion graphic được thiết kế, phụ đề và chép lời **không cần khóa API**. Việc tạo hình ảnh, video và giọng nói chỉ chạy khi bạn chủ động bật và dùng tài khoản nhà cung cấp **của riêng bạn**. Không có backend lưu trữ trên đám mây và không cần tạo tài khoản.

---

## Bạn có thể yêu cầu những gì

Bạn chỉ cần yêu cầu một lần và nhận về một video hoàn chỉnh. Tác tử kết hợp mọi thứ mà yêu cầu cần đến trong một dòng thời gian duy nhất:

| Khả năng | Bao gồm những gì |
|---|---|
| **Biên tập tư liệu quay thật** | Cắt, nối, đổi khung hình sang 9:16 / 1:1 / 16:9, giữ hoặc trộn âm thanh của clip, chèn lớp phủ, chèn cứng phụ đề và chuẩn hóa độ lớn âm thanh. Với các bản ghi dài, tác tử còn có thể tìm đoạn nổi bật, xếp hạng các lần quay lặp lại và loại bỏ khoảng lặng hoặc từ đệm, đồng thời ghi lại bằng chứng cho từng điểm cắt. |
| **Chuyển động được thiết kế** | Các phân cảnh dựng bằng HTML/CSS có hoạt ảnh: chữ chuyển động, thẻ giá, lower-third, chú thích dữ liệu và hiệu ứng chuyển cảnh. Chữ có thể chỉnh sửa nằm trong các ô văn bản được đặt tên, nên đổi nội dung chữ không bao giờ đồng nghĩa với dựng lại cả phân cảnh. |
| **Âm thanh và phụ đề** | Lời thuyết minh cho từng phân cảnh, khớp với độ dài của phân cảnh đó. Nhạc nền có giấy phép tự giảm âm lượng khi có lời nói. Phụ đề lấy từ văn bản thuyết minh hoặc từ thời điểm từng từ đã đo. Điểm cắt khớp theo nhịp. |
| **Cảnh quay do AI tạo** | Hình ảnh, clip video và người dẫn do AI tạo (talking-head) từ nhà cung cấp bạn đã cấu hình, cho những cảnh quay mà tư liệu của bạn không thể hiện được. Chúng chỉ được tạo trong phạm vi mức chi tiêu bạn phê duyệt. |

Với kịch bản hoặc storyboard, tác tử dừng lại ở tài liệu. Với video hoàn chỉnh, tác tử làm đến tận khâu bàn giao. Tác tử chỉ cho bạn xem kế hoạch hoặc bản xem trước nếu bạn yêu cầu, hoặc nếu video dài hơn khoảng hai phút. Kịch bản do tác tử viết để video bám sát từng chữ sẽ được đưa cho bạn xem trước; kịch bản do bạn cung cấp sẽ được làm đúng như đã viết.

---

## Motion graphic trong Claude Code, không cần gói Team

Claude Motion, tính năng hoạt ảnh của Anthropic, đang ở giai đoạn beta và chỉ có trên gói Claude Team và Enterprise. OrkasVideoStudio mang đến cho Claude Code cùng kiểu motion graphic dựng bằng mã trên gói Pro, Max, Ultra hoặc với khóa API: tác tử viết từng phân cảnh dưới dạng HTML và CSS có hoạt ảnh, kiểm tra các khung hình lấy mẫu và kết xuất MP4 ngay trên máy của bạn, nên bản thân quá trình kết xuất không tốn token.

1. [Cài đặt](#cài-đặt) OrkasVideoStudio và chạy `ovs skills --install --target claude` (hoặc `--target codex` cho Codex).
2. Yêu cầu video, ví dụ: *"Làm một video motion graphic 16:9 dài 20 giây cho buổi ra mắt ứng dụng của chúng tôi: phần mở đầu bằng chữ chuyển động hiển thị tên sản phẩm, ba thẻ tính năng trượt vào và một thẻ kết thúc có giá. Cho tôi xem ảnh tĩnh của từng phân cảnh trước khi kết xuất."*
3. Tự đổi một từ, một màu hoặc thời gian trong các tệp phân cảnh hay trên bảng vẽ, hoặc nhờ tác tử làm, rồi kết xuất lại.

Khác với Claude Motion, cùng một dòng thời gian còn có thể chứa tư liệu quay, lời thuyết minh, nhạc và phụ đề của chính bạn. Xem [phần so sánh](#so-sánh).

---

## Trường hợp sử dụng

Mỗi hàng là một câu lệnh bạn có thể đưa cho tác tử. Kỹ năng `video-studio` sẽ chọn công cụ.

### Quảng cáo và marketing

| Bạn nói… | Điều gì xảy ra |
|---|---|
| *"Làm một quảng cáo dọc dài 20 giây cho chiếc đèn bàn này từ những ảnh này và trang sản phẩm."* | Tác tử nhập ảnh, ghi lại giá và thông số dưới dạng thông tin có dẫn nguồn, thiết kế các phân cảnh mở đầu thu hút (hook), tính năng và giá, thêm lời thuyết minh và phụ đề, rồi kiểm tra, kết xuất và bàn giao. |
| *"Làm video ra mắt dài 30 giây cho ứng dụng của chúng tôi từ website của nó."* | Tác tử chụp lại các trang sản phẩm thật trong trình duyệt của bạn, dùng chính câu chữ và màn hình của sản phẩm, rồi dựng các phân cảnh xoay quanh chúng thay vì dùng bản mô phỏng vẽ lại. |
| *"Làm một video người dẫn dài 30 giây, trong đó một người dẫn do AI tạo giới thiệu loại serum này."* | Tác tử viết lời độc thoại trước, tạo một ảnh chính của người dẫn hư cấu và dùng lại ảnh đó cho mọi clip, tạo các clip nói bằng nhà cung cấp video của bạn, và giữ giá cùng các tuyên bố dưới dạng chữ trên màn hình có thể chỉnh sửa. |
| *"Làm một promo 15 giây 9:16 từ kịch bản này: tạo đoạn mở đầu bằng AI, dựng các chú thích tính năng, một giọng thuyết minh."* | Một dòng thời gian kết hợp đoạn mở đầu do AI tạo, các phân cảnh tính năng được thiết kế và một track thuyết minh duy nhất, và tệp hoàn chỉnh được kiểm tra trước khi bàn giao. |

### Phim và phim truyền hình

| Bạn nói… | Điều gì xảy ra |
|---|---|
| *"Làm một phim ngắn dài một phút về một y tá làm ca đêm, với cùng hai nhân vật trong mọi cảnh quay."* | Tác tử xây dựng câu chuyện quanh một câu hỏi kịch tính, giữ một dòng mô tả ngoại hình và một ảnh chính cho mỗi nhân vật để họ nhất quán qua các cảnh quay, rồi tạo các cảnh quay bằng nhà cung cấp video của bạn trong phạm vi ngân sách bạn phê duyệt. |
| *"Biến ba tập phim truyền hình này thành một bản tóm tắt có thuyết minh dài 3 phút."* | Tác tử chép lời các tập phim, chọn những phân cảnh mang mạch truyện, bỏ qua phần danh đề và đoạn giới thiệu tập sau, viết và lồng tiếng bản tóm tắt, rồi dựng tư liệu quay của bạn bên dưới phần thuyết minh. |
| *"Tạo một cảnh quay 5 giây về thành phố lúc bình minh cho đoạn mở đầu."* | Tác tử xác nhận nhà cung cấp, mô hình và chi phí, tạo một cảnh quay bằng nhà cung cấp video của bạn và đặt nó lên dòng thời gian cạnh tư liệu quay của bạn. |

### Biên tập

| Bạn nói… | Điều gì xảy ra |
|---|---|
| *"Biến bản ghi màn hình dài 1 giờ này thành ba clip nổi bật 30 giây có phụ đề."* | Phân tích phân cảnh và chất lượng tìm ra những phần hay. Các lần quay lặp lại được xếp hạng, khoảng lặng và từ đệm bị cắt bỏ, và phụ đề được chèn cứng dựa trên thời điểm từng từ đã đo. |
| *"Làm sạch các khoảng lặng và tiếng 'ờ' trong đoạn quay webcam của tôi rồi làm cho nó gọn hơn."* | Tác tử phát hiện các khoảng lặng và từ đệm, tạo một jump cut tất định và ghi lại bằng chứng cho mọi đoạn bị xóa. |
| *"Thêm giọng thuyết minh tiếng Anh và phụ đề vào product-demo.mp4 và cân bằng độ lớn âm thanh."* | Tác tử chép lời video, dịch và lồng tiếng từng câu trong đúng khoảng hình ảnh của câu đó, trộn giọng nói lên âm thanh sẵn có, chèn cứng phụ đề và chuẩn hóa độ lớn âm thanh. |
| *"Cắt 20 clip từ chuyến đi của chúng tôi theo bản nhạc này, đúng nhịp."* | Tác tử đo nhịp của bản nhạc, cắt các clip theo nhịp đó và kiểm tra độ khớp nhịp của tệp được bàn giao. |

### Video giải thích và hướng dẫn

| Bạn nói… | Điều gì xảy ra |
|---|---|
| *"Làm một video giải thích 60 giây về cơ sở dữ liệu vector với giọng thuyết minh tiếng Trung."* | Tác tử viết các phân cảnh motion graphic, tổng hợp lời thuyết minh bằng nhà cung cấp TTS của bạn và khớp từng câu với phân cảnh của nó. |
| *"Biến bản ghi màn hình trang cài đặt của tôi thành một video hướng dẫn 90 giây."* | Tác tử cắt gọn bản ghi, đánh dấu từng điều khiển trên giao diện thật theo từng bước, rồi thêm lời thuyết minh và phụ đề. |

### Tái tạo video thịnh hành

| Bạn nói… | Điều gì xảy ra |
|---|---|
| *"Tái tạo cấu trúc và nhịp độ của video viral này cho sản phẩm của tôi. Cho tôi xem kế hoạch trước."* | Tác tử phân tích video tham chiếu, ánh xạ các nhịp kể chuyện của nó vào tư liệu của bạn và chờ bạn phê duyệt trước khi sản xuất. |
| *"Quảng cáo này của đối thủ đang hiệu quả. Làm quảng cáo của chúng tôi với cùng kiểu mở đầu thu hút và nhịp điệu, dùng ảnh của chúng tôi."* | Tác tử mượn nhịp điệu của phần mở đầu thu hút, phần chứng minh và lời kêu gọi hành động của video tham chiếu, chứ không mượn nội dung. Mọi tuyên bố đều đến từ thông tin sản phẩm của bạn và mọi hình ảnh đều đến từ tư liệu của bạn. |

Hãy đưa cho tác tử một **tệp video tham chiếu** cùng tư liệu sản phẩm, kịch bản hoặc tư liệu quay của chính bạn. Tác tử có thể dùng OrkasVideoStudio để tái tạo **cấu trúc kể chuyện, phong cách hình ảnh và nhịp dựng** của video đó cho nội dung mới:

1. **Phân tích video tham chiếu.** Kiểm tra các khung hình lấy mẫu và phần âm thanh liên quan để xác định phần mở đầu thu hút, phần trình diễn hoặc chứng minh, thứ tự thông tin, kiểu chữ, hiệu ứng chuyển cảnh, nhịp độ và lời kêu gọi hành động.
2. **Lên kế hoạch chuyển thể.** Nêu rõ phần nào giữ lại và phần nào thay thế, rồi ánh xạ các khoảnh khắc trong video tham chiếu vào các phân cảnh hoặc dòng thời gian mới. Điều chỉnh thời gian theo lời thuyết minh và thời gian đọc thực tế của bạn.
3. **Sản xuất và chỉnh sửa.** Dựng motion graphic, biên tập tư liệu quay của bạn và tạo hình ảnh còn thiếu khi cần. Chữ, phụ đề, lời thuyết minh và clip được tạo cục bộ vẫn có thể chỉnh sửa riêng. Chữ đã nằm sẵn trong cảnh quay do AI tạo chỉ có thể thay đổi bằng cách thay đổi chính cảnh quay đó.

Cách này hiệu quả nhất với video giải thích dạng motion graphic, video demo SaaS và ứng dụng, và quảng cáo sản phẩm dựng từ tư liệu quay sẵn có. Hãy bắt đầu với một tệp mà tác tử của bạn có thể đọc được, vì tính năng tải xuống từ liên kết chia sẻ của các nền tảng mạng xã hội không được tích hợp sẵn. Không đảm bảo tái hiện chính xác chuyển động máy quay, diễn xuất của người thật hay khớp từng khung hình. Các bước kiểm tra khi bàn giao không chấm điểm mức độ giống với video tham chiếu. Để biết chi tiết, xem [quy trình tái tạo video tham chiếu](./packages/skills/video-craft/references/reference-recreation.md).

---

## Cài đặt

**Điều kiện tiên quyết:** Node ≥ 22, `pnpm`, và `ffmpeg` + `ffprobe` trong `PATH` của bạn. Gói [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` đã ghim phiên bản được cài như một phụ thuộc và kết xuất trang trong Chrome headless để kiểm tra và kết xuất; `npx` chỉ là phương án dự phòng để tương thích. Việc tạo nội dung là tùy chọn và cần khóa của riêng bạn.

### Từ mã nguồn

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

Các gói npm chưa được phát hành, nên hiện tại hãy cài đặt từ mã nguồn.

---

## Điều khiển từ Claude Code, Codex hoặc bất kỳ tác tử lập trình nào

CLI `ovs` là giao diện chuẩn, và các công cụ MCP phản chiếu nó. Hãy dùng cách mà tác tử của bạn hỗ trợ:

**1) Kỹ năng native (Claude Code / Codex).** Cài gói kỹ năng để tác tử tự tìm thấy:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Gói kỹ năng này cũng có trên [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), nên `npx skills add orkas-ai/orkas-videostudio` cũng cài được gói này. Các kỹ năng gọi CLI `ovs`, vì vậy hãy cài CLI đó trước như mô tả ở trên.

**2) Công cụ MCP.** Đăng ký máy chủ:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) CLI tự mô tả (mọi tác tử có shell).** Không cần trình nạp:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Sau đó chỉ cần yêu cầu tác tử làm video. Tác tử sẽ đọc `video-studio` trước và nạp các tài liệu tham khảo về từng giai đoạn và kỹ thuật mà nó cần.

---

## Một dự án sản xuất hoạt động thế nào

Tác tử chọn một tên thư mục ngắn và lưu mọi thứ trong đó:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

Thứ tự phân cảnh chính là thứ tự phát. Thời điểm bắt đầu và tổng độ dài được tính từ các phân cảnh và không bao giờ được lưu lại, nên việc di chuyển một phân cảnh không thể làm thời gian bị lệch. Giá chỉ nằm một lần trong `product.json`, và mọi phân cảnh hiển thị giá đều đọc từ đó. Với các biến thể song song, chẳng hạn tỷ lệ khung hình hoặc ngôn ngữ khác, hay bản dựng A/B, tác tử thêm các id video khác dùng chung tư liệu. Xem [đặc tả dòng thời gian](packages/skills/video-studio/references/timeline.md).

Một lượt chạy điển hình:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` đo tệp cuối cùng trước khi ghi nhận: thời lượng, kích thước và tốc độ khung hình, âm thanh, độ lớn âm thanh và mức độ phủ của lời thuyết minh. Các cảnh báo về phụ đề được gắn cờ để xác nhận bằng mắt, và các khung hình từ chính tệp MP4 thực tế được trả về. Mỗi lần bàn giao trở thành một phiên bản bất biến. Bản kết xuất được tạo trước thay đổi mới nhất sẽ bị từ chối vì đã lỗi thời, và các lần bàn giao trước không bao giờ bị ghi đè. Vượt qua các bước kiểm tra này không chứng nhận chất lượng hình ảnh. Phần duyệt hình ảnh được tính là `not_checked` cho đến khi có người thực sự xem các khung hình.

Khi bạn chủ động chấp nhận một phát hiện cụ thể còn tồn đọng, hãy truyền đúng mã của nó bằng `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. Phiên bản sẽ ghi lại quyết định đó, và mọi lỗi khác vẫn chặn việc bàn giao. Các thao tác ghi được tuần tự hóa bằng `.ovs-timeline.lock`; nếu một sự cố khiến tệp này còn sót lại, hãy xác nhận tiến trình sở hữu nó đã dừng trước khi xóa. [Đặc tả dòng thời gian](packages/skills/video-studio/references/timeline.md) đề cập cả hai điều này.

**Các bản chỉnh sửa luôn rẻ và cục bộ.** Một từ, điểm cắt, thứ tự, nhạc nền hay phụ đề bị thay đổi sẽ được sửa tại chỗ. Chỉ câu thoại bị thay đổi mới được lồng tiếng lại, và chỉ cảnh quay sai mới được tạo lại, trong phạm vi mức chi tiêu đã phê duyệt. Sửa chữ phụ đề không làm thay đổi âm thanh lời nói. HyperFrames kết xuất toàn bộ video mỗi lần; bản build portable này không lưu bộ nhớ đệm các phân cảnh đã kết xuất.

---

## Bảng vẽ video trên trình duyệt

Khi `timeline import`, `timeline prepare`, `timeline render` hoặc `timeline ship` thành công (từ CLI hoặc MCP), OVS mở bảng vẽ của dự án sản xuất đó trong trình duyệt mặc định của bạn. Các lệnh sau dùng lại cùng tab đó thay vì mở tab mới. Bảng vẽ chỉnh sửa cùng các tệp với CLI và MCP, nên thay đổi được đồng bộ theo cả hai chiều. Bảng vẽ hiển thị trạng thái chỉ xem trong khi tác tử đang làm việc.

Trên bảng vẽ, bạn có thể:

- **Xem và xuất.** Phát video, chuyển giữa các phiên bản đã bàn giao và tải xuống phiên bản bạn muốn.
- **Sắp xếp tư liệu.** Tải lên, kéo thả hoặc dán tư liệu quay, rồi di chuyển và nối các thẻ trên bảng.
- **Chỉnh sửa phân cảnh.** Đổi chữ, thứ tự và hình ảnh, cũng như thêm, xóa hoặc khôi phục phân cảnh.
- **Tạo và làm lại cảnh quay.** Tạo một cảnh quay hình ảnh hoặc video mới từ một thẻ, hoặc tạo lại một cảnh quay sẵn có. Bạn chọn tư liệu tham chiếu hoặc khung đầu và khung cuối, cùng mô hình, độ phân giải và âm thanh; các tùy chọn mà mô hình không hỗ trợ sẽ bị vô hiệu hóa. Duyệt qua các kết quả trước đó và chọn kết quả muốn dùng. Bảng vẽ hỏi bạn trước mọi yêu cầu trả phí.
- **Cập nhật video.** Các chỉnh sửa phân cảnh thông thường được kết xuất và bàn giao cục bộ, với tiến độ hiển thị trên thẻ video. Thay đổi thông tin sản phẩm, một câu thuyết minh hoặc giọng cho cả video sẽ tạo ra một yêu cầu gửi tác tử của bạn, vì những chỉnh sửa đó cần đến sự đánh giá của nó. Nếu bước kiểm tra bàn giao dừng một lần cập nhật vì có phân cảnh giữ ảnh tĩnh, thẻ video sẽ hiện **Preview this version** (xem trước bản này), **Return to editing** (quay lại chỉnh sửa) hoặc **Update anyway** (vẫn cập nhật); Update anyway giữ bản kết xuất đó mà không kết xuất lại.
- **Nói với tác tử.** Viết một yêu cầu ngắn về một phân cảnh, cảnh quay, thẻ tư liệu quay hoặc video. Yêu cầu được gửi kèm ngữ cảnh của thẻ đó.

Bảng vẽ mở bằng tiếng Trung. Nút ngôn ngữ của bảng vẽ chuyển đổi giữa tiếng Trung và tiếng Anh, và ghi nhớ lựa chọn của bạn.

### Gửi yêu cầu ngược lại cho tác tử

**Send** (Gửi) chỉ chuyển yêu cầu đến cuộc trò chuyện đã tạo ra dự án sản xuất đó. Nếu cuộc trò chuyện đó không thể nhận yêu cầu, bản nháp vẫn nằm trên bảng vẽ. Không có gì được sao chép vào clipboard, tự động gửi lại hay gửi sang một phiên mới. Việc chỉnh sửa, cập nhật và xuất vẫn hoạt động khi không có tác tử nào được kết nối.

- **Codex.** Khi `ovs` chạy bên trong một thread Codex, yêu cầu được đưa vào hàng đợi của chính thread đó. Điều này cần Codex CLI 0.160.1 trở lên với app server cục bộ của nó đang chạy. Thread đã đóng hoặc chưa được tải sẽ hiển thị là không khả dụng.
- **Claude Code.** Yêu cầu đến qua một channel MCP, vốn là một research preview của Claude Code, và một kết nối MCP thông thường là không đủ. Đăng ký máy chủ với `--claude-channel`, rồi khởi động Claude Code với channel được bật:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Hãy làm video thông qua các công cụ MCP `ovs` để bảng vẽ mở ra gắn với channel đó. Bảng vẽ mở từ CLI trong shell không thể liên lạc với Claude Code. Claude Code hiển thị cảnh báo phát triển cục bộ khi khởi động. Channel cần đăng nhập claude.ai hoặc khóa API Console, và trên gói Team và Enterprise, quản trị viên phải bật chúng trước. Xem [channel của Claude Code](https://code.claude.com/docs/en/channels).

### Tự mở một dự án sản xuất

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Hãy giữ lệnh chạy trong khi bạn dùng bảng vẽ. Với `--agent`, bảng vẽ chạy một phiên native trong thư mục sản xuất, dùng thông tin đăng nhập, mô hình và cài đặt quyền của chính CLI của bạn. Phiên đó cần Codex 0.160.1+ hoặc Claude Code 2.1.148+. Các lời nhắc cấp quyền và câu hỏi của phiên xuất hiện trên bảng vẽ. Bảng vẽ khôi phục phiên đã lưu cho thư mục đó, trừ khi bạn truyền `--resume <session-id>` để chuyển giao một phiên cụ thể hoặc `--new-session` để bắt đầu mới. Các tùy chọn khác:

- `--no-open` in ra liên kết truy cập mà không mở trình duyệt.
- `--port` chọn cổng loopback.
- `--recover` giành lại một bảng vẽ mà chủ sở hữu trước đó đã thoát.

Để tắt tính năng tự động mở trong quá trình sản xuất, đặt `OVS_STUDIO_AUTO_OPEN=0`. Tính năng này đã tắt sẵn trong CI.

---

## Nhà cung cấp tạo nội dung của riêng bạn (BYO)

Cấu hình nhà cung cấp trong `~/.config/orkas-video-studio/config.json` (hoặc `$OVS_CONFIG_DIR/config.json`) hoặc bằng biến môi trường. Biến môi trường được ưu tiên hơn tệp cấu hình.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Khả năng | Giá trị `provider` | Biến môi trường |
|---|---|---|
| Giọng nói (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Hình ảnh (`ovs image`) | `openai` (mọi endpoint tương thích OpenAI, bao gồm Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Bạn có thể kiểm tra cấu hình mà không thực hiện bất kỳ lệnh gọi trả phí nào:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Chạy `ovs narration fit` trước và sau khi tổng hợp để mỗi câu thuyết minh nằm gọn trong khung thời gian của phân cảnh hoặc của kế hoạch. Việc tạo video nhận các giá trị tường minh cho ảnh tham chiếu, tỷ lệ, thời lượng, độ phân giải và cờ âm thanh, nên lệnh gọi đến nhà cung cấp khớp với kế hoạch đã duyệt. Với các dự án `plan.json`, `ovs plan validate` còn kiểm tra tỷ lệ, thời lượng và thao tác của từng phân đoạn loại generate so với `video.provider` đã cấu hình trước khi bất cứ thứ gì được tạo.

Một số nhà cung cấp cần thêm vài cài đặt:

- **Google Cloud Veo** dùng `video.workspace_id`, `video.region`, và một token API hoặc JSON tài khoản dịch vụ trong `video.api_key`.
- **Alibaba**: phần giọng nói dùng endpoint workspace của Alibaba trong `tts.base_url`. Video Wan cần `video.workspace_id` và `video.region`.
- **Giọng chỉ dùng qua nhân bản (clone)** cần id giọng mà bạn đã đăng ký với nhà cung cấp.
- **Giọng nói qua WebSocket** chỉ đi qua `tts.proxy_url` khi bạn cấu hình nó.
- **Tham chiếu video** được truyền dưới dạng URL ảnh hoặc video công khai. Số lượng được hỗ trợ và việc hỗ trợ khung đầu/cuối khác nhau tùy mô hình.
- **[MuAPI](https://muapi.ai)** phải được chọn rõ ràng bằng `video.provider: "muapi"`. Khi đã chọn, `MUAPI_API_KEY` được ưu tiên hơn `OVS_VIDEO_API_KEY`; chỉ có khóa thôi thì không bao giờ tự chọn MuAPI. `video.model` / `OVS_VIDEO_MODEL` hỗ trợ các endpoint Kling v2.1 đã được kiểm chứng là `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` và `kling-v2.1-pro-i2v`. Các slug khác bị từ chối thay vì được gửi đi với phần thân không khớp. Text-to-video mặc định dùng `kling-v2.1-master-t2v`, còn yêu cầu có `image_url` khung đầu mặc định dùng `kling-v2.1-master-i2v`. Thời lượng là 5 hoặc 10 giây và tỷ lệ là `16:9`, `9:16` hoặc `1:1`. Các đầu vào `resolution`, `generate_audio` và `quality` trung lập với nhà cung cấp vẫn tương thích với các kế hoạch đã ký: Kling bỏ qua độ phân giải và âm thanh, còn chất lượng được kiểm tra hợp lệ nhưng không được gửi đi. Các điều khiển chỉnh sửa và tham chiếu bổ sung bị từ chối cho đến khi một schema MuAPI tương ứng được hỗ trợ. URL gốc mặc định có `/api/v1`, và URL tùy chỉnh cũng phải có. Xem [tài liệu tham khảo API của MuAPI](https://muapi.ai/docs/api-reference) để biết quy ước submit-and-poll (gửi rồi thăm dò kết quả) và các tham số riêng của từng mô hình.

Danh mục mô hình của nhà cung cấp mô tả quy ước API của từng nhà cung cấp. Chúng không đảm bảo tình trạng khả dụng hay giá cả tại thời điểm thực tế.

---

## Điều gì giữ việc tạo nội dung trong giới hạn

Tác tử dùng tư liệu sẵn có của bạn ở bất cứ chỗ nào phù hợp với cảnh quay, và chỉ tạo những gì còn thiếu. Việc đã cấu hình thông tin xác thực không được tính là đồng ý chi tiêu. Trước mọi công việc trả phí, tác tử xác nhận nhà cung cấp, mô hình, mục đích, số lượng yêu cầu kể cả số lần thử lại, và chi phí ước tính. Sau đó tác tử bám sát phạm vi đó. Từ chối sẽ dừng các lệnh gọi trả phí cho yêu cầu đó, và một cảnh quay không đạt chỉ được làm lại tối đa hai lần trước khi tác tử đề nghị bạn thay đổi cách tiếp cận.

Mỗi yêu cầu trả phí lưu một biên nhận bên cạnh đầu ra của nó. Một tác vụ video có kết quả không xác định sẽ chặn việc gửi thêm yêu cầu khác tới cùng đầu ra cho đến khi bạn kiểm tra nó, và tác vụ đó không bao giờ được tự động gửi lại. Xem [thẩm quyền tạo nội dung](packages/skills/video-studio/references/generation.md).

`ovs speak` ghi yêu cầu và biên nhận âm thanh bên cạnh đầu ra của nó. Lệnh này chỉ dùng lại một yêu cầu khớp hoàn toàn có dữ liệu byte âm thanh còn nguyên vẹn, vì vậy hãy truyền đúng `--language`, giọng, mô hình, tốc độ và định dạng đã được duyệt; thay đổi bất kỳ giá trị nào trong số đó sẽ làm mất hiệu lực việc dùng lại. Lệnh này cũng giành quyền ghi đầu ra trước khi gửi yêu cầu, giúp ngăn các lệnh gọi trùng lặp đồng thời.

Không có dịch vụ nhạc nào được lưu trữ trên đám mây. Nhạc đến từ các tệp có giấy phép do bạn cung cấp, và tác tử ghi lại nguồn và giấy phép của từng tệp.

---

## Tham khảo lệnh

Chạy `ovs <command> --help` để xem đầu vào có kiểu của từng lệnh. Các công cụ MCP dùng cùng tên nhưng với dấu gạch dưới, ví dụ `timeline_prepare` và `edit_trim_silence`.

| Lĩnh vực | Lệnh |
|---|---|
| Thiết lập | `doctor`, `skills [--install]`, `skill <name>` |
| Sản xuất | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Biên tập (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Phân tích | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Thuyết minh | `narration timing · fit`, `speech-capabilities`, `speak` |
| Tạo nội dung | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Dự án cũ | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (bí danh của `check`) |

Các dự án được tạo bằng định dạng cũ là EDL `plan.json` và `composition-manifest.json` vẫn hoạt động qua các lệnh "Dự án cũ". Công việc mới dùng dòng thời gian phân cảnh. Với một `plan.json` đã được lắp ráp, hãy xác minh tệp hoàn chỉnh cũng như tư liệu quay thành phần của nó:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

Công cụ MCP tương đương `plan_promise_check` nhận `probe_produced` và `video`. Công cụ này đo thời lượng, kích thước và tốc độ khung hình, âm thanh, độ lớn âm thanh tích hợp (integrated loudness) và các khoảng có giọng nói theo từng câu. Thiếu bằng chứng thuyết minh sẽ khiến bước kiểm tra thất bại, và các cảnh báo phụ đề cần kiểm tra bằng mắt khi phụ đề đã được chèn cứng.

---

## So sánh

### OrkasVideoStudio vs Claude Motion vs CapCut vs Higgsfield

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **Đó là gì** | một xưởng video mã nguồn mở do tác tử lập trình của bạn điều khiển | một dạng đầu ra hoạt ảnh bên trong Claude | ứng dụng biên tập video của ByteDance | một nền tảng hình ảnh và video AI lưu trữ trên đám mây |
| **Ai có thể dùng** | bất kỳ ai; chạy trên máy của bạn với Claude Code, Codex, Cursor hoặc bất kỳ tác tử nào chạy được shell hoặc hỗ trợ MCP | gói Claude Team và Enterprise (beta) | ứng dụng desktop, di động và web, có bản miễn phí và trả phí | một tài khoản Higgsfield, miễn phí hoặc theo gói tín dụng hằng tháng, qua ứng dụng web, API, trình kết nối MCP hoặc CLI |
| **Cách chỉnh sửa** | mô tả thay đổi cho tác tử, hoặc đổi chữ, hình ảnh và thứ tự phân cảnh trên bảng vẽ trong trình duyệt | trong trình biên tập của Claude hoặc bằng cách nhờ Claude | thủ công trên dòng thời gian | viết câu lệnh cho từng lần tạo hoặc chỉnh sửa trong các studio web của Higgsfield, hoặc từ tác tử của bạn qua trình kết nối |
| **Tư liệu quay** | cắt, nối, đổi khung hình sang 9:16 / 1:1 / 16:9, loại bỏ khoảng lặng và từ đệm, cắt theo nhịp | tạo hoạt ảnh cho chữ, biểu đồ, hình khối và hình ảnh; không có tư liệu quay hay con người do AI tạo | biên tập thủ công đầy đủ | chỉnh sửa clip bằng AI: xóa hoặc thay vật thể và nền, đổi phong cách, đổi khung hình, nâng độ phân giải hoặc kéo dài một cảnh quay |
| **Motion graphic** | phân cảnh HTML/CSS: chữ chuyển động, thẻ giá, lower-third, chú thích dữ liệu, chuyển cảnh | hoạt ảnh giải thích dựng bằng mã | mẫu, hoạt ảnh chữ và hiệu ứng | tiêu đề, chuyển cảnh và hiệu ứng xuất hiện logo do AI Motion Designer của Higgsfield dựng trong After Effects hoặc Premiere Pro |
| **Âm thanh** | lời thuyết minh theo từng phân cảnh, nhạc nền tự giảm âm lượng khi có lời nói, phụ đề từ thời điểm từng từ đã đo | không được đề cập trong bài viết trợ giúp của Anthropic | công cụ giọng nói, nhạc và phụ đề trong ứng dụng | giọng thuyết minh AI, dịch giọng nói và khớp khẩu hình |
| **Cảnh quay do AI tạo** | hình ảnh, clip video và người dẫn từ các nhà cung cấp bạn cấu hình, như Seedance 2.5, Kling 4.0, Veo 3.1 trên Google Cloud, Runway Gen-4.5 và Wan 3.0, tính phí trên khóa của riêng bạn | không có | trình tạo video AI bắt đầu từ một kịch bản hoặc một hình ảnh | nhiều mô hình được lưu trữ sẵn trong một tài khoản, bao gồm Seedance 2.5, Kling 4.0, Veo 3.1 và MAGI-2, mô hình mà chỉ Higgsfield cung cấp |
| **Đầu ra** | MP4, được kiểm tra thời lượng, kích thước và tốc độ khung hình, độ lớn âm thanh và lời thuyết minh trước khi bàn giao | xuất MP4 | xuất MP4 | các clip và hình ảnh do AI tạo, cùng video từ các ứng dụng studio riêng của Higgsfield |
| **Mã nguồn** | MIT; mỗi video là một thư mục cục bộ do bạn sở hữu | độc quyền, lưu trữ trên đám mây | độc quyền | độc quyền, lưu trữ trên đám mây |

Hãy chọn **CapCut**, hoặc một trình biên tập dòng thời gian mã nguồn mở như Shotcut hay Kdenlive, khi bạn muốn tự cắt bằng tay. Chọn **Claude Motion** khi đội của bạn đã làm việc trong Claude với gói Team hoặc Enterprise và cần hoạt ảnh giải thích. Chọn **Higgsfield** khi bạn muốn nhiều mô hình được lưu trữ sẵn trên cùng một hóa đơn, hoặc một mô hình chỉ có ở đó, như MAGI-2. Chọn **OrkasVideoStudio** khi bạn muốn tác tử lập trình làm toàn bộ video, gồm tư liệu quay, chuyển động và âm thanh trong một dòng thời gian, bằng khóa nhà cung cấp của riêng bạn, và giữ kết quả dưới dạng các tệp bạn có thể kiểm tra, chỉnh sửa và kết xuất lại. Higgsfield và OrkasVideoStudio cũng có thể dùng cùng nhau: các clip bạn tạo trên Higgsfield là tư liệu quay thông thường cho một dự án sản xuất OrkasVideoStudio. Thông tin lấy từ [trung tâm trợ giúp của Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), [trang trình tạo video AI của CapCut](https://www.capcut.com/tools/ai-video-generator) và [higgsfield.ai](https://higgsfield.ai/), tính đến tháng 11 năm 2026.

---

## Câu hỏi thường gặp

### Claude Code có làm được video không?

Có. Khi đã cài OrkasVideoStudio, Claude Code đọc kỹ năng `video-studio` và dùng CLI `ovs` hoặc các công cụ MCP để biên tập tư liệu quay, dựng motion graphic, thêm lời thuyết minh và phụ đề, rồi kết xuất một tệp MP4 đã được kiểm tra ngay trên máy của bạn. Codex, Cursor và mọi tác tử khác có thể chạy shell hoặc hỗ trợ MCP đều hoạt động theo cùng cách. Xem [Điều khiển từ Claude Code, Codex hoặc bất kỳ tác tử lập trình nào](#điều-khiển-từ-claude-code-codex-hoặc-bất-kỳ-tác-tử-lập-trình-nào).

### Có miễn phí không, và có cần khóa API không?

OrkasVideoStudio miễn phí và dùng giấy phép MIT. Biên tập, motion graphic được thiết kế, phụ đề và chép lời chạy cục bộ và không cần khóa API. Việc tạo hình ảnh, clip video hoặc giọng nói là tùy chọn và dùng tài khoản nhà cung cấp của riêng bạn; các nhà cung cấp này tính phí trực tiếp cho bạn. Trước mọi lệnh gọi trả phí, tác tử xác nhận với bạn nhà cung cấp, mô hình, số lượng yêu cầu và chi phí ước tính. Xem [Điều gì giữ việc tạo nội dung trong giới hạn](#điều-gì-giữ-việc-tạo-nội-dung-trong-giới-hạn).

### Đây có phải là lựa chọn thay thế mã nguồn mở cho Claude Motion, CapCut và Higgsfield không?

Có. Giống Claude Motion, công cụ này để Claude Code viết motion graphic dưới dạng mã, nhưng hoạt động với Claude Code trên gói Pro, Max, Ultra hoặc với khóa API, không chỉ trên gói Team và Enterprise, và với cả các tác tử khác. Khác với CapCut, tác tử của bạn thực hiện các chỉnh sửa dựa trên mô tả của bạn thay vì bạn tự cắt bằng tay trên dòng thời gian. Khác với Higgsfield, công cụ này không lưu trữ mô hình hay bán tín dụng: tác tử của bạn gọi Seedance, Kling, Veo và các mô hình video khác bằng khóa của riêng bạn, rồi kết hợp các cảnh quay với tư liệu quay, motion graphic, lời thuyết minh và phụ đề của bạn. Xem [So sánh](#so-sánh).

### Có thể biên tập tư liệu quay tôi đã có sẵn không?

Có. Công cụ này cắt và nối clip, đổi khung hình sang 9:16, 1:1 hoặc 16:9, loại bỏ khoảng lặng và từ đệm, cắt theo nhịp, chèn cứng phụ đề và chuẩn hóa độ lớn âm thanh. Tư liệu quay của bạn nằm trong cùng một dòng thời gian với motion graphic và cảnh quay do AI tạo.

### Có thể dùng những mô hình video, hình ảnh và giọng nói nào?

Với video: Seedance, Kling, Veo (qua Google hoặc Google Cloud), Runway, Wan, MiniMax và Vidu, cùng Atlas và MuAPI. Với hình ảnh: Gemini, và OpenAI hoặc mọi endpoint tương thích OpenAI, bao gồm Seedream. Với giọng nói: OpenAI, Doubao, MiniMax, Alibaba (Qwen và CosyVoice), Google, ElevenLabs và các endpoint tương thích OpenAI. Tất cả đều chạy bằng khóa của riêng bạn. Xem [Nhà cung cấp tạo nội dung của riêng bạn (BYO)](#nhà-cung-cấp-tạo-nội-dung-của-riêng-bạn-byo).

### Cài đặt như thế nào?

Cài đặt từ mã nguồn: clone kho mã, chạy `pnpm install && pnpm build`, rồi kiểm tra thiết lập bằng `ovs doctor`. Bạn cần Node 22 trở lên, pnpm, cùng ffmpeg và ffprobe. Các gói npm chưa được phát hành. Xem [Cài đặt](#cài-đặt).

---

## Quan hệ với Orkas

OrkasVideoStudio khởi đầu là **tác tử video tích hợp sẵn trong [Orkas](https://orkas.ai?source=gh-orkas-vs)**, ứng dụng desktop đội ngũ AI. Nó đã được kiểm chứng trọn vẹn từ đầu đến cuối ở đó, rồi được tách ra thành bộ công cụ giấy phép MIT này, không phụ thuộc vào tác tử cụ thể nào.

- **Bên trong Orkas**, nó có sẵn dưới dạng một [tác tử tích hợp sẵn](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) mà không cần cài đặt riêng. Bạn trò chuyện với nó trong một ứng dụng desktop thay vì terminal, và việc tạo nội dung có thể chạy trên các mô hình tích hợp sẵn của Orkas (tài khoản mới nhận 500 tín dụng miễn phí) hoặc trên khóa của riêng bạn. [Tải Orkas](https://orkas.ai/download/?source=gh-orkas-vs) cho macOS hoặc Windows.
- **Ở mọi nơi khác**, bạn cài nó vào tác tử lập trình của riêng mình như mô tả ở trên và nhận được cùng các khả năng cốt lõi qua CLI `ovs`, máy chủ MCP và bảng vẽ. Các tính năng tài khoản Orkas, như nhà cung cấp được lưu trữ sẵn, tín dụng và xuất bản cuộc trò chuyện, không thuộc kho mã này.

Liên kết: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[kho mã này](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Các gói

| Gói | Nội dung |
|---|---|
| `@orkas/video-studio-core` | schema dòng thời gian phân cảnh và EDL cũ, các bước kiểm tra bàn giao, hàm hỗ trợ ra quyết định, căn thời gian thuyết minh, runtime và cấu hình |
| `@orkas/video-studio-tools` | backend cho dòng thời gian, kết xuất, biên tập, phân tích, giọng nói, hình ảnh và video, cùng bảng vẽ trên trình duyệt |
| `@orkas/video-studio` | CLI `ovs` |
| `@orkas/video-studio-mcp` | máy chủ MCP (`ovs-mcp`), phản chiếu CLI |
| `@orkas/video-studio-skills` | gói kiến thức `SKILL.md` không phụ thuộc host |

Kế hoạch kỹ thuật và lịch sử của nó nằm trong [`PLAN.md`](./PLAN.md). Ghi chú cho các tác tử lập trình làm việc trên kho mã này nằm trong [`AGENTS.md`](./AGENTS.md).

---

## Phát triển

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

`pnpm install` áp dụng bản vá HyperFrames có đánh phiên bản trong [`patches/`](./patches/), giúp đầu ra SDR H.264/H.265 dùng ma trận BT.709 đúng như metadata của nó khai báo. Một `OVS_HYPERFRAMES_BIN` bên ngoài hoặc phương án dự phòng tương thích `npx` không nhận được bản vá này, nên runtime đó phải có bản sửa màu tương đương. Bản vá cũng giữ lại mốc thời gian theo từng từ của Whisper cho tiếng Trung và tiếng Nhật. Môi trường chạy bên ngoài cần hỗ trợ tương đương.

`test:video` không bao giờ tiêu tốn tín dụng của nhà cung cấp. Một endpoint Seedance giả lập cục bộ trả về một tệp video mẫu H.264 thật, được OVS tải xuống và xác minh bằng `ffprobe`.

`test:video:e2e` bao quát cả hai luồng sản xuất qua CLI đã build:

- **Luồng composition cũ.** Bài kiểm thử tạo một dự án sản xuất 1080p dài chín giây gồm ba phân cảnh, với composition prepare/reconcile, snapshot, toàn bộ cổng kiểm tra bản nháp (draft gate), chèn cứng phụ đề và promise check trên tệp cuối. Nó giải mã toàn bộ MP4 và kiểm tra thứ tự phân cảnh, chuyển động nhìn thấy được, âm thanh nghe được trong mọi phân cảnh và điểm ảnh của phụ đề đã chèn cứng, đồng thời kiểm tra rằng thời lượng bàn giao sai sẽ bị từ chối.
- **Dòng thời gian phân cảnh hiện tại.** Bài kiểm thử kết xuất một dòng thời gian ba phân cảnh qua luồng check và snapshot thật của HyperFrames. Nó kiểm tra màu phân cảnh, chuyển động được thiết kế, chuyển động video nguồn đã giải mã, điểm ảnh phụ đề, âm thanh, bàn giao bất biến và việc từ chối bản kết xuất lỗi thời.

Nó cũng chạy thử các bề mặt CLI và MCP đã build. Cả hai lệnh video đều thất bại với thông báo lỗi có hướng xử lý cụ thể khi thiếu runtime cần thiết. Bộ kiểm thử thông thường có thể bỏ qua các trường hợp nặng về runtime trên máy không có ffmpeg hoặc trình duyệt.

`pnpm verify` phải vượt qua trên ứng viên cuối cùng trước mọi Git commit hoặc PR. Lệnh này bao gồm trường hợp sản xuất thật và cũng là điểm vào của CI, và các thay đổi chỉ liên quan đến kiểm thử cũng tuân theo cùng quy tắc. Khi duyệt đồng bộ hoặc phát hành, hãy giữ lại và kiểm tra video được tạo ra, các bản xem trước, khung hình cuối và báo cáo:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

Thư mục bằng chứng chỉ dùng khi bạn chủ động bật, và mỗi lượt chạy dùng một thư mục con riêng. Các lượt chạy CI thông thường sẽ dọn sạch tệp media tạm thời. Dữ liệu kiểm thử mẫu dùng HTML/SVG nguyên bản và âm thanh nhạc không lời được tạo cục bộ. Chúng không gọi nhà cung cấp trả phí và không tuyên bố bao quát chất lượng TTS hay chất lượng mô hình.

`pnpm benchmark` không cần khóa và có tính tất định. Lệnh này build gói lõi, xác minh dữ liệu kiểm thử mẫu của benchmark, rồi đo việc chuyển trạng thái cổng kiểm tra, kiểm tra hợp lệ EDL và tóm tắt bàn giao, kiểm tra hợp lệ composition-manifest và ước lượng lời thuyết minh. Mỗi bộ kiểm thử có một ngưỡng thông lượng tối thiểu được đặt thận trọng có chủ ý, nên các hồi quy lớn sẽ thất bại còn dao động bình thường giữa các máy thì không.

Xem [hướng dẫn đánh giá mô hình tùy chọn](./eval/video/README.md) bằng tiếng Anh để biết cách thiết lập, chạy lệnh và lưu bằng chứng.

## Phiên bản

Tất cả các gói dùng chung một phiên bản theo lịch, `YYYY.M.D` (ngày theo múi giờ Asia/Shanghai, không thêm số 0 ở đầu). Các bản phát hành được gắn thẻ dùng `v<version>` và được xuất bản dưới dạng [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); một phiên bản theo ngày đã xuất bản không bao giờ bị ghi đè. Các thay đổi được liệt kê trong [CHANGELOG.md](CHANGELOG.md). Phiên bản này độc lập với ứng dụng desktop Orkas và các phiên bản tác tử trên marketplace của nó.

## Giấy phép

MIT — xem [`LICENSE`](./LICENSE). Việc kết xuất dùng phụ thuộc [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` theo giấy phép Apache-2.0. Biên tập và kiểm tra media dùng `ffmpeg` trên hệ thống của bạn, còn việc chép lời được giao cho HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) giải thích cách các runtime của bên thứ ba được định vị, cùng với các ghi chú về giấy phép.
