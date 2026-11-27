# OrkasVideoStudio

> Ubah agen pemrograman Anda menjadi studio video. Mintalah video jadi kepada Claude Code, Codex, Cursor, atau agen apa pun yang dapat menjalankan shell atau mendukung MCP. Agen akan menyunting rekaman Anda, merancang motion graphic, menambahkan narasi, musik, dan caption, membuat cuplikan yang belum ada dengan kunci Anda sendiri, lalu menyerahkan MP4 yang sudah diperiksa. Anda dapat terus menyunting MP4 itu di kanvas browser.

**Alternatif sumber terbuka untuk Claude Motion, CapCut, dan Higgsfield, yang dikendalikan oleh agen pemrograman yang sudah Anda gunakan.** Berlisensi MIT dan mengutamakan lokal, tanpa perlu paket Claude Team atau Enterprise dan tanpa langganan platform video: cuplikan buatan AI berasal dari Seedance, Kling, Veo, dan model video lain dengan kunci Anda sendiri. [Lihat perbandingannya ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Lebih suka aplikasi daripada agen pemrograman?** OrkasVideoStudio juga merupakan agen video bawaan di **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, aplikasi desktop tim AI gratis untuk macOS dan Windows. Jelaskan videonya di obrolan; pembuatan konten berjalan dengan model bawaan Orkas (akun baru mendapat 500 kredit gratis) atau dengan kunci Anda sendiri. **[Unduh Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Hubungan keduanya ↓](#hubungan-dengan-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

OrkasVideoStudio **bukan agen video kotak hitam**. Agen Anda yang berpikir. Proyek ini memberinya bagian-bagian yang tidak bisa ia improvisasikan:

- **Pengetahuan video.** Paket `SKILL.md` yang netral terhadap host, dengan `video-studio` sebagai keterampilan pintu masuk. Isinya mencakup kapan harus bertanya dan kapan langsung melanjutkan, apa perbedaan antara iklan, video penjelasan, demo produk, video yang dipotong mengikuti musik, video presenter, film pendek, dan video komentar, serta cara memeriksa hasil suntingan sebelum menyatakannya selesai.
- **Alat deterministik.** CLI `ovs` dan server MCP yang mencerminkannya. Keduanya mencakup timeline produksi, penyuntingan dengan ffmpeg, transkripsi, analisis rekaman, dan pembuatan konten melalui akun penyedia Anda sendiri. [HyperFrames](https://github.com/heygen-com/hyperframes) menangani perenderan halaman dan pengambilan frame; `ffmpeg` menangani penyuntingan dan pengukuran.
- **Produksi yang dapat diedit.** Setiap video adalah folder biasa: timeline adegan (`videos/main/manifest.json`), daftar aset, fakta produk beserta sumbernya, dan halaman rancangan opsional. Anda, agen Anda, dan kanvas browser semuanya mengedit file yang sama. Ubah satu baris teks, ganti gambar, atau susun ulang adegan, lalu render ulang.

Penyuntingan, motion graphic rancangan, caption, dan transkripsi **tidak memerlukan kunci API**. Pembuatan gambar, video, dan suara ucapan hanya berjalan jika Anda mengaktifkannya dan menggunakan akun penyedia **milik Anda sendiri**. Tidak ada backend yang di-hosting dan tidak ada akun yang perlu dibuat.

---

## Apa yang bisa Anda minta

Anda cukup meminta sekali dan mendapatkan satu video jadi. Agen menggabungkan apa pun yang dibutuhkan permintaan itu dalam satu timeline:

| Kemampuan | Cakupannya |
|---|---|
| **Menyunting rekaman asli** | Memangkas, menggabungkan, mengubah bingkai ke 9:16 / 1:1 / 16:9, mempertahankan atau mencampur suara klip, menambahkan overlay, menanamkan (burn-in) subtitle, dan menormalkan kenyaringan. Untuk rekaman panjang, agen juga dapat menemukan bagian sorotan, memeringkat take yang diulang, serta menghapus jeda hening atau kata pengisi, sambil mencatat bukti untuk setiap potongan. |
| **Animasi rancangan** | Adegan yang dibangun dengan HTML/CSS beranimasi: tipografi kinetik, kartu harga, lower-third, callout data, dan transisi. Kata-kata yang dapat diedit berada di slot teks bernama, sehingga mengubah teks tidak pernah berarti membangun ulang adegan. |
| **Suara dan caption** | Narasi untuk setiap adegan, disesuaikan dengan durasi adegan tersebut. Musik latar berlisensi yang volumenya otomatis turun saat ada ucapan. Caption dari teks narasi atau dari waktu kata yang diukur. Potongan yang diselaraskan dengan ketukan. |
| **Cuplikan buatan AI** | Gambar, klip video, dan presenter buatan AI (talking-head) dari penyedia yang Anda konfigurasi, untuk cuplikan yang tidak dapat ditampilkan oleh materi Anda. Semuanya hanya dibuat dalam batas pengeluaran yang Anda setujui. |

Untuk naskah atau storyboard, agen berhenti di dokumen. Untuk video jadi, agen bekerja sampai penyerahan. Agen hanya menunjukkan rencana atau pratinjau jika Anda memintanya, atau jika durasi video lebih dari sekitar dua menit. Naskah yang ditulis agen untuk diikuti video kata demi kata akan ditunjukkan kepada Anda terlebih dahulu; naskah yang Anda berikan dibuat persis seperti yang tertulis.

---

## Motion graphic di Claude Code, tanpa paket Team

Claude Motion, fitur animasi dari Anthropic, masih berstatus beta dan hanya tersedia di paket Claude Team dan Enterprise. OrkasVideoStudio memberi Claude Code jenis motion graphic berbasis kode yang sama pada paket Pro, Max, Ultra, atau dengan kunci API: agen menulis setiap adegan sebagai HTML dan CSS beranimasi, memeriksa frame sampel, dan merender MP4 di komputer Anda, sehingga proses render itu sendiri tidak menghabiskan token.

1. [Instal](#instalasi) OrkasVideoStudio dan jalankan `ovs skills --install --target claude` (atau `--target codex` untuk Codex).
2. Mintalah videonya, misalnya: *"Buat video motion graphic 16:9 berdurasi 20 detik untuk peluncuran aplikasi kami: pembuka bertipografi kinetik dengan nama produk, tiga kartu fitur yang meluncur masuk, dan kartu penutup berisi harga. Tunjukkan gambar diam setiap adegan sebelum Anda merender."*
3. Ubah sendiri kata, warna, atau waktunya di file adegan atau di kanvas, atau minta agen melakukannya, lalu render lagi.

Berbeda dengan Claude Motion, timeline yang sama juga dapat memuat rekaman, narasi, musik, dan caption Anda sendiri. Lihat [perbandingannya](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Contoh penggunaan

Setiap baris adalah prompt yang bisa Anda berikan kepada agen Anda. Keterampilan `video-studio` yang memilih alatnya.

### Iklan dan pemasaran

| Anda berkata… | Yang terjadi |
|---|---|
| *"Buat iklan vertikal 20 detik untuk lampu meja ini dari foto-foto ini dan halaman produknya."* | Agen mengimpor foto, mencatat harga dan spesifikasi sebagai fakta beserta sumbernya, merancang adegan hook, fitur, dan harga, menambahkan narasi dan caption, lalu memeriksa, merender, dan menyerahkan hasilnya. |
| *"Buat video peluncuran 30 detik untuk aplikasi kami dari situs webnya."* | Agen menangkap halaman produk yang asli di browser Anda, memakai kata-kata dan layar milik produk itu sendiri, lalu membangun adegan di sekitarnya alih-alih memakai mock-up yang digambar ulang. |
| *"Buat video presenter 30 detik dengan pembawa acara buatan AI yang memperkenalkan serum ini."* | Agen menulis monolognya terlebih dahulu, membuat satu gambar kunci untuk pembawa acara fiktif dan memakainya kembali di setiap klip, membuat klip berbicara dengan penyedia video Anda, serta mempertahankan harga dan klaim sebagai teks di layar yang dapat diedit. |
| *"Buat promo 15 detik 9:16 dari naskah ini: buat pembukanya dengan AI, susun callout fiturnya, satu narasi suara."* | Satu timeline menggabungkan pembuka buatan AI, adegan fitur rancangan, dan satu trek narasi, lalu file jadinya diperiksa sebelum diserahkan. |

### Film dan drama

| Anda berkata… | Yang terjadi |
|---|---|
| *"Buat film pendek satu menit tentang perawat shift malam, dengan dua karakter yang sama di setiap cuplikan."* | Agen membangun cerita di atas satu pertanyaan dramatis, menyimpan satu deskripsi tampilan dan satu gambar kunci untuk setiap karakter agar mereka tetap konsisten di semua cuplikan, lalu membuat cuplikan dengan penyedia video Anda dalam anggaran yang Anda setujui. |
| *"Ubah tiga episode drama ini menjadi rekap bernarasi berdurasi 3 menit."* | Agen mentranskripsikan episode-episodenya, memilih adegan yang membawa alur cerita, melewati bagian kredit dan pratinjau episode berikutnya, menulis dan menyuarakan rekapnya, lalu memotong rekaman Anda di bawah narasi itu. |
| *"Hasilkan cuplikan 5 detik kota saat fajar untuk pembukaan."* | Agen mengonfirmasi penyedia, model, dan biayanya, membuat satu cuplikan dengan penyedia video Anda, lalu menempatkannya di timeline di samping rekaman Anda. |

### Penyuntingan

| Anda berkata… | Yang terjadi |
|---|---|
| *"Ubah rekaman layar 1 jam ini menjadi tiga klip sorotan 30 detik dengan caption."* | Analisis adegan dan kualitas menemukan bagian-bagian yang bagus. Take yang diulang diberi peringkat, jeda hening dan kata pengisi dipotong, dan caption ditanamkan berdasarkan waktu kata yang diukur. |
| *"Bersihkan jeda hening dan 'emm' dari rekaman webcam saya lalu buat lebih rapat."* | Agen mendeteksi jeda hening dan kata pengisi, membuat jump cut yang deterministik, dan mencatat bukti untuk setiap rentang yang dihapus. |
| *"Tambahkan narasi suara bahasa Inggris dan subtitle ke product-demo.mp4 dan ratakan kenyaringannya."* | Agen mentranskripsikan video, menerjemahkan dan menyuarakan setiap baris di dalam rentang gambarnya, mencampur suara itu di atas audio yang sudah ada, menanamkan subtitle, dan menormalkan kenyaringan. |
| *"Potong 20 klip perjalanan kami ini mengikuti lagu ini, tepat di ketukan."* | Agen mengukur ketukan lagu, memotong klip mengikuti ketukan itu, dan memeriksa keselarasan ketukan pada file yang diserahkan. |

### Video penjelasan dan tutorial

| Anda berkata… | Yang terjadi |
|---|---|
| *"Buat video penjelasan 60 detik tentang basis data vektor dengan narasi suara bahasa Mandarin."* | Agen menulis adegan motion graphic, menyintesis narasi dengan penyedia TTS Anda, dan menyesuaikan setiap baris dengan adegannya. |
| *"Ubah rekaman layar halaman pengaturan saya menjadi tutorial 90 detik."* | Agen memangkas rekaman, menandai setiap kontrol pada antarmuka asli langkah demi langkah, serta menambahkan narasi dan caption. |

### Membuat ulang video populer

| Anda berkata… | Yang terjadi |
|---|---|
| *"Tiru struktur dan tempo video viral ini untuk produk saya. Tunjukkan rencananya dulu."* | Agen menguraikan referensinya, memetakan beat ceritanya ke materi Anda, dan menunggu persetujuan Anda sebelum memproduksi. |
| *"Iklan pesaing ini performanya bagus. Buat iklan kami dengan hook dan ritme yang sama, memakai foto-foto kami."* | Agen meminjam ritme hook, bukti, dan ajakan bertindak dari referensi, bukan kontennya. Setiap klaim berasal dari fakta produk Anda dan setiap gambar dari materi Anda. |

Berikan agen Anda **file video referensi** beserta aset produk, naskah, atau rekaman Anda sendiri. Agen Anda dapat menggunakan OrkasVideoStudio untuk membuat ulang **struktur naratif, gaya visual, dan tempo penyuntingannya** untuk konten baru:

1. **Analisis referensi.** Periksa frame sampel dan audio yang relevan untuk mengidentifikasi hook, demonstrasi atau bukti, urutan informasi, tipografi, transisi, tempo, dan ajakan bertindak.
2. **Rencanakan adaptasinya.** Tentukan apa yang dipertahankan dan apa yang diganti, lalu petakan momen-momen dalam referensi ke adegan atau timeline baru. Sesuaikan waktunya dengan narasi dan waktu baca Anda yang sebenarnya.
3. **Produksi dan revisi.** Susun motion graphic, sunting rekaman Anda, dan buat visual yang belum ada bila diperlukan. Teks, caption, narasi, dan klip yang dibuat secara lokal tetap dapat diedit secara terpisah. Teks yang menyatu dalam rekaman buatan AI hanya bisa diubah dengan mengubah rekaman tersebut.

Cara ini paling cocok untuk video penjelasan motion graphic, demo SaaS dan aplikasi, serta iklan produk yang dibuat dari rekaman yang sudah ada. Mulailah dengan file yang dapat dibaca agen Anda, karena mengunduh dari tautan berbagi platform media sosial tidak didukung secara bawaan. Gerakan kamera yang persis sama, performa manusia, dan kecocokan bingkai demi bingkai tidak dijamin. Pemeriksaan penyerahan tidak menilai seberapa mirip hasilnya dengan referensi. Untuk detailnya, lihat [alur kerja pembuatan ulang video referensi](./packages/skills/video-craft/references/reference-recreation.md).

---

## Instalasi

**Prasyarat:** Node ≥ 22, `pnpm`, serta `ffmpeg` + `ffprobe` di `PATH` Anda. Paket [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` dengan versi yang dipatok diinstal sebagai dependensi dan merender halaman di Chrome headless untuk pemeriksaan dan perenderan; `npx` hanya merupakan fallback kompatibilitas. Pembuatan konten bersifat opsional dan memerlukan kunci Anda sendiri.

### Dari kode sumber (sudah berfungsi sekarang)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### Dari npm (setelah dipublikasikan)

Paket npm belum dipublikasikan. Setelah dipublikasikan, perintah `ovs` akan bekerja dengan cara yang sama:

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Jalankan dari Claude Code, Codex, atau agen pemrograman apa pun

CLI `ovs` adalah antarmuka utamanya, dan alat MCP mencerminkannya. Gunakan mana saja yang didukung agen Anda:

**1) Keterampilan native (Claude Code / Codex).** Instal paket keterampilan agar agen dapat menemukannya sendiri:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Paket keterampilan yang sama tercantum di [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), sehingga `npx skills add orkas-ai/orkas-videostudio` juga dapat menginstalnya. Keterampilan tersebut memanggil CLI `ovs`, jadi instal CLI itu terlebih dahulu seperti dijelaskan di atas.

**2) Alat MCP.** Daftarkan servernya:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) CLI yang menjelaskan dirinya sendiri (agen apa pun yang memiliki shell).** Tidak perlu loader:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Setelah itu, cukup minta video kepada agen Anda. Agen akan membaca `video-studio` terlebih dahulu lalu memuat referensi tahapan dan teknik yang dibutuhkannya.

---

## Cara kerja sebuah produksi

Agen memilih nama folder yang singkat dan menyimpan semuanya di dalamnya:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

Urutan adegan adalah urutan pemutaran. Waktu mulai dan durasi total dihitung dari adegan dan tidak pernah disimpan, sehingga memindahkan adegan tidak dapat membuat waktunya menjadi tidak konsisten. Harga disimpan satu kali di `product.json`, dan setiap adegan yang menampilkannya membacanya dari sana. Untuk varian paralel, seperti rasio aspek lain, bahasa lain, atau potongan A/B, agen menambahkan ID video lain yang berbagi aset yang sama. Lihat [kontrak timeline](packages/skills/video-studio/references/timeline.md).

Contoh proses yang umum:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` mengukur file akhir sebelum mencatatnya: durasi, kanvas keluaran, audio, kenyaringan, dan cakupan narasi. Peringatan caption ditandai untuk dikonfirmasi secara visual, dan frame dari MP4 yang sebenarnya dikembalikan. Setiap penyerahan menjadi versi yang tidak dapat diubah. Render yang dibuat sebelum perubahan terbaru ditolak karena kedaluwarsa, dan penyerahan sebelumnya tidak pernah ditimpa. Lolos pemeriksaan ini tidak menjamin kualitas visual. Tinjauan visual dihitung sebagai `not_checked` sampai seseorang benar-benar melihat frame-nya.

Jika Anda secara eksplisit menerima satu temuan tertentu yang masih tersisa, berikan kode persisnya dengan `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. Versi tersebut mencatat keputusan itu, dan setiap error lain tetap memblokir penyerahan. Penulisan diserialkan dengan `.ovs-timeline.lock`; jika crash meninggalkan file itu, pastikan proses pemiliknya sudah berhenti sebelum menghapusnya. [Kontrak timeline](packages/skills/video-studio/references/timeline.md) membahas keduanya.

**Revisi tetap murah dan lokal.** Kata, potongan, urutan, musik latar, atau caption yang diubah diedit di tempat. Hanya baris ucapan yang diubah yang disuarakan ulang, dan hanya cuplikan yang salah yang dibuat ulang, dalam batas pengeluaran yang sudah disetujui. Mengedit teks caption tidak mengubah audio ucapan. HyperFrames merender seluruh video setiap kali; build portabel ini tidak menyimpan cache adegan yang sudah dirender.

---

## Kanvas video di browser

Ketika `timeline import`, `timeline prepare`, `timeline render`, atau `timeline ship` berhasil (dari CLI atau MCP), OVS membuka kanvas produksi tersebut di browser default Anda. Perintah berikutnya memakai tab yang sama alih-alih membuka tab baru. Kanvas mengedit file yang sama dengan CLI dan MCP, sehingga perubahan mengalir ke dua arah. Kanvas menampilkan mode hanya-lihat selama agen sedang bekerja.

Di kanvas, Anda dapat:

- **Menonton dan mengekspor.** Memutar video, beralih di antara versi yang sudah diserahkan, dan mengunduh versi yang Anda inginkan.
- **Menata materi.** Mengunggah, menyeret masuk, atau menempelkan rekaman, lalu memindahkan dan menghubungkan kartu di papan.
- **Mengedit adegan.** Mengubah kata, urutan, dan gambar, serta menambah, menghapus, atau mengembalikan adegan.
- **Membuat dan mengulang cuplikan.** Membuat cuplikan gambar atau video baru dari sebuah kartu, atau membuat ulang cuplikan yang sudah ada. Anda memilih referensi atau frame pertama dan terakhir, ditambah model, resolusi, dan audio; opsi yang tidak didukung suatu model akan dinonaktifkan. Telusuri hasil-hasil sebelumnya dan pilih yang akan dipakai. Kanvas meminta persetujuan sebelum setiap permintaan berbayar.
- **Memperbarui video.** Suntingan adegan biasa dirender dan diserahkan secara lokal, dengan progres yang ditampilkan di kartu video. Mengubah fakta produk, baris narasi, atau suara untuk seluruh video akan menghasilkan permintaan untuk agen Anda, karena suntingan tersebut membutuhkan penilaiannya. Jika pemeriksaan penyerahan menghentikan pembaruan karena ada adegan yang berisi gambar diam, kartu video menawarkan **Preview this version** (pratinjau versi ini), **Return to editing** (kembali mengedit), atau **Update anyway** (tetap perbarui); Update anyway mempertahankan render tersebut tanpa merender ulang.
- **Memberi tahu agen.** Menulis permintaan singkat tentang sebuah adegan, cuplikan, kartu rekaman, atau video. Permintaan itu dikirim bersama konteks kartu tersebut.

Kanvas terbuka dalam bahasa Mandarin. Tombol bahasanya beralih antara bahasa Mandarin dan bahasa Inggris, serta mengingat pilihan Anda.

### Mengirim permintaan kembali ke agen Anda

Tombol **Send** (Kirim) hanya mengirimkan permintaan ke percakapan yang membuat produksi tersebut. Jika percakapan itu tidak dapat menerima permintaan, drafnya tetap berada di kanvas. Tidak ada yang disalin ke clipboard, dikirim ulang secara otomatis, atau dikirim ke sesi baru. Penyuntingan, pembaruan, dan ekspor tetap berfungsi tanpa agen yang terhubung.

- **Codex.** Saat `ovs` berjalan di dalam thread Codex, permintaan dimasukkan ke antrean thread yang sama itu. Ini memerlukan Codex CLI 0.160.1 atau yang lebih baru dengan app server lokalnya dalam keadaan berjalan. Thread yang ditutup atau tidak dimuat ditampilkan sebagai tidak tersedia.
- **Claude Code.** Permintaan masuk melalui channel MCP, yang merupakan research preview Claude Code, dan koneksi MCP biasa tidak cukup. Daftarkan server dengan `--claude-channel`, lalu jalankan Claude Code dengan channel diaktifkan:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Buat video melalui alat MCP `ovs` agar kanvas terbuka dalam keadaan terikat ke channel tersebut. Kanvas yang dibuka dari CLI shell tidak dapat menjangkau Claude Code. Claude Code menampilkan peringatan pengembangan lokal saat dimulai. Channel memerlukan login claude.ai atau kunci API Console, dan pada paket Team dan Enterprise, admin harus mengaktifkannya terlebih dahulu. Lihat [channel Claude Code](https://code.claude.com/docs/en/channels).

### Buka produksi sendiri

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Biarkan perintah tetap berjalan selama Anda memakai kanvas. Dengan `--agent`, kanvas menjalankan sesi native di folder produksi yang memakai login, model, dan pengaturan izin milik CLI Anda sendiri. Sesi itu memerlukan Codex 0.160.1+ atau Claude Code 2.1.148+. Prompt izin dan pertanyaan dari sesi itu muncul di kanvas. Kanvas memulihkan sesi yang tersimpan untuk folder tersebut, kecuali Anda memberikan `--resume <session-id>` untuk menyerahkan sesi tertentu atau `--new-session` untuk memulai dari awal. Opsi lain:

- `--no-open` mencetak tautan akses tanpa membuka browser.
- `--port` memilih port loopback.
- `--recover` mengambil alih kanvas dari pemilik sebelumnya yang sudah keluar.

Untuk mematikan pembukaan otomatis selama pekerjaan produksi, setel `OVS_STUDIO_AUTO_OPEN=0`. Pembukaan otomatis sudah nonaktif di CI.

---

## Penyedia pembuatan konten milik Anda sendiri (BYO)

Konfigurasikan penyedia di `~/.config/orkas-video-studio/config.json` (atau `$OVS_CONFIG_DIR/config.json`) atau dengan variabel lingkungan. Variabel lingkungan menimpa isi file.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Kemampuan | Nilai `provider` | Variabel lingkungan |
|---|---|---|
| Suara ucapan (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Gambar (`ovs image`) | `openai` (endpoint apa pun yang kompatibel dengan OpenAI, termasuk Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Anda dapat memeriksa konfigurasi tanpa melakukan panggilan berbayar apa pun:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Jalankan `ovs narration fit` sebelum dan sesudah sintesis agar setiap baris narasi tetap berada di dalam jendela adegan atau rencananya. Pembuatan video menerima gambar referensi, rasio, durasi, resolusi, dan flag audio secara eksplisit, sehingga panggilan ke penyedia sesuai dengan rencana yang disetujui. Untuk proyek `plan.json`, `ovs plan validate` juga memeriksa rasio, durasi, dan operasi setiap segmen pembuatan terhadap `video.provider` yang dikonfigurasi sebelum apa pun dibuat.

Beberapa penyedia memerlukan beberapa pengaturan tambahan:

- **Google Cloud Veo** menggunakan `video.workspace_id`, `video.region`, serta token API atau JSON akun layanan di `video.api_key`.
- **Alibaba**: layanan suara ucapannya memakai endpoint workspace di `tts.base_url`. Video Wan memerlukan `video.workspace_id` dan `video.region`.
- **Suara khusus kloning** memerlukan ID suara yang Anda daftarkan pada penyedia.
- **Suara ucapan via WebSocket** melewati `tts.proxy_url` hanya jika Anda mengonfigurasinya.
- **Referensi video** diberikan sebagai URL gambar atau video publik. Jumlah yang didukung dan dukungan frame pertama/terakhir berbeda-beda menurut model.
- **[MuAPI](https://muapi.ai)** harus dipilih secara eksplisit dengan `video.provider: "muapi"`. Saat dipilih, `MUAPI_API_KEY` didahulukan daripada `OVS_VIDEO_API_KEY`; keberadaan kunci itu saja tidak pernah membuat MuAPI terpilih. `video.model` / `OVS_VIDEO_MODEL` mendukung endpoint Kling v2.1 yang sudah divalidasi, yaitu `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v`, dan `kling-v2.1-pro-i2v`. Slug lain ditolak alih-alih dikirim dengan body yang tidak sesuai. Text-to-video secara default memakai `kling-v2.1-master-t2v`, dan permintaan dengan `image_url` frame pertama secara default memakai `kling-v2.1-master-i2v`. Durasinya 5 atau 10 detik dan rasionya `16:9`, `9:16`, atau `1:1`. Input `resolution`, `generate_audio`, dan `quality` yang netral terhadap penyedia tetap kompatibel dengan rencana yang ditandatangani: Kling mengabaikan resolusi dan audio, sedangkan kualitas divalidasi tetapi tidak dikirim. Kontrol edit dan referensi tambahan ditolak sampai skema MuAPI yang sesuai didukung. URL dasar default menyertakan `/api/v1`, dan URL kustom juga harus menyertakannya. Lihat [referensi API MuAPI](https://muapi.ai/docs/api-reference) untuk kontrak submit-and-poll dan parameter khusus model.

Katalog model penyedia menjelaskan kontrak API setiap penyedia. Katalog ini tidak menjamin ketersediaan atau harga yang berlaku saat ini.

---

## Yang menjaga pembuatan konten tetap terbatas

Agen memakai materi yang sudah Anda miliki di mana pun materi itu cocok untuk cuplikannya, dan hanya membuat apa yang belum ada. Kredensial yang sudah dikonfigurasi tidak dianggap sebagai persetujuan untuk mengeluarkan biaya. Sebelum pekerjaan berbayar apa pun, agen mengonfirmasi penyedia, model, tujuan, jumlah permintaan termasuk percobaan ulang, dan estimasi biaya. Setelah itu agen tetap berada dalam cakupan tersebut. Menolak akan menghentikan panggilan berbayar untuk permintaan itu, dan cuplikan yang buruk mendapat paling banyak dua take revisi sebelum agen meminta Anda mengubah pendekatannya.

Setiap permintaan berbayar menyimpan tanda terima di samping keluarannya. Tugas video yang hasilnya tidak diketahui akan memblokir pengiriman lain ke keluaran yang sama sampai Anda memeriksanya, dan tugas itu tidak pernah dikirim ulang secara otomatis. Lihat [otoritas pembuatan konten](packages/skills/video-studio/references/generation.md).

`ovs speak` menulis permintaan dan tanda terima audio di samping keluarannya. Perintah ini hanya memakai ulang permintaan yang sama persis yang byte audionya masih utuh, jadi berikan `--language`, suara, model, kecepatan, dan format yang sudah disetujui; mengubah salah satunya membatalkan pemakaian ulang. Perintah ini juga mengklaim keluaran sebelum permintaan dikirim, sehingga mencegah panggilan duplikat secara bersamaan.

Tidak ada layanan musik yang di-hosting. Musik berasal dari file berlisensi yang Anda sediakan, dan agen mencatat sumber dan lisensi setiap file.

---

## Referensi perintah

Jalankan `ovs <command> --help` untuk melihat input bertipe setiap perintah. Alat MCP memakai nama yang sama dengan garis bawah, misalnya `timeline_prepare` dan `edit_trim_silence`.

| Area | Perintah |
|---|---|
| Penyiapan | `doctor`, `skills [--install]`, `skill <name>` |
| Produksi | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edit (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analisis | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narasi | `narration timing · fit`, `speech-capabilities`, `speak` |
| Pembuatan konten | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Proyek lama | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias dari `check`) |

Proyek yang dibuat dengan format lama EDL `plan.json` dan `composition-manifest.json` masih berfungsi melalui perintah "Proyek lama". Pekerjaan baru memakai timeline adegan. Untuk `plan.json` yang sudah dirakit, verifikasi file jadinya serta rekaman komponennya:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

Alat MCP padanannya, `plan_promise_check`, menerima `probe_produced` dan `video`. Alat ini mengukur durasi, kanvas keluaran, audio, kenyaringan terintegrasi, dan rentang bersuara per baris. Bukti narasi yang hilang membuat pemeriksaan gagal, dan peringatan caption memerlukan pemeriksaan visual jika subtitle ditanamkan.

---

## Perbandingan

### OrkasVideoStudio vs Claude Motion vs CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **Apa itu** | studio video sumber terbuka yang dikendalikan oleh agen pemrograman Anda | keluaran animasi di dalam Claude | aplikasi editor video dari ByteDance |
| **Siapa yang bisa memakainya** | siapa saja; berjalan di komputer Anda dengan Claude Code, Codex, Cursor, atau agen apa pun yang dapat menjalankan shell atau mendukung MCP | paket Claude Team dan Enterprise (beta) | aplikasi desktop, seluler, dan web, dengan tingkat gratis dan berbayar |
| **Cara mengedit** | jelaskan perubahannya kepada agen Anda, atau ubah teks, gambar, dan urutan adegan di kanvas browser | di editor Claude atau dengan meminta kepada Claude | secara manual di timeline |
| **Rekaman** | memangkas, menggabungkan, mengubah bingkai ke 9:16 / 1:1 / 16:9, menghapus jeda hening dan kata pengisi, memotong sesuai ketukan | menganimasikan teks, grafik, bentuk, dan gambar; tanpa rekaman atau orang buatan AI | penyuntingan manual penuh |
| **Motion graphic** | adegan HTML/CSS: tipografi kinetik, kartu harga, lower-third, callout data, transisi | animasi penjelasan yang dibangun dengan kode | template, animasi teks, dan efek |
| **Suara** | narasi per adegan, musik latar yang volumenya otomatis turun saat ada ucapan, caption dari waktu kata yang diukur | tidak dibahas dalam artikel bantuan Anthropic | alat suara, musik, dan caption di dalam aplikasi |
| **Keluaran** | MP4, diperiksa durasi, kanvas keluaran, kenyaringan, dan narasinya sebelum diserahkan | ekspor MP4 | ekspor MP4 |
| **Kode sumber** | MIT; setiap video adalah folder lokal milik Anda | proprietary, di-hosting | proprietary |

Pilih **CapCut**, atau editor timeline sumber terbuka seperti Shotcut atau Kdenlive, jika Anda ingin memotong secara manual. Pilih **Claude Motion** jika tim Anda sudah bekerja di Claude dengan paket Team atau Enterprise dan membutuhkan animasi penjelasan. Pilih **OrkasVideoStudio** jika Anda ingin agen pemrograman Anda membuat seluruh video, yaitu rekaman, animasi, dan suara dalam satu timeline, lalu menyimpan hasilnya sebagai file yang dapat Anda periksa, edit, dan render ulang. Detail Claude Motion diambil dari [pusat bantuan Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion) per November 2026.

### OrkasVideoStudio vs Higgsfield

Higgsfield adalah platform yang di-hosting yang menjual banyak model video dan gambar dalam satu akun, melalui aplikasi webnya, API, konektor MCP, dan CLI. OrkasVideoStudio tidak meng-hosting model: agen Anda memanggil penyedia yang Anda konfigurasi, lalu mengubah cuplikan-cuplikannya menjadi video jadi.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **Apa itu** | studio video sumber terbuka yang dikendalikan oleh agen pemrograman Anda | platform gambar dan video AI yang di-hosting |
| **Model video** | penyedia yang Anda konfigurasi, seperti Seedance 2.5, Kling 4.0, Veo 3.1 di Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3, dan Vidu Q3 | banyak model yang di-hosting dalam satu akun, termasuk Seedance 2.5, Kling 4.0, Veo 3.1, dan MAGI-2, yang hanya ditawarkan oleh Higgsfield |
| **Cara membayar** | setiap penyedia menagih lewat kunci Anda sendiri; penyuntingan, motion graphic, caption, dan transkripsi berjalan secara lokal dan tidak memerlukan kunci | kredit langganan di aplikasi web dan konektor, atau dana bayar per detik di API |
| **Yang Anda dapatkan** | satu MP4 yang sudah diperiksa, yang memadukan cuplikan buatan AI dengan rekaman Anda, motion graphic, narasi, musik, dan caption, ditambah folder produksi yang dapat Anda edit dan render ulang | klip dan gambar buatan AI, serta aplikasi studio milik Higgsfield sendiri |
| **Dari agen pemrograman** | keterampilan, CLI `ovs`, dan server MCP untuk Claude Code, Codex, Cursor, atau agen apa pun | konektor MCP, CLI, dan keterampilan milik Higgsfield |
| **Kode sumber** | MIT; setiap video adalah folder lokal milik Anda | proprietary, di-hosting |

Pilih **Higgsfield** jika Anda menginginkan banyak model yang di-hosting dalam satu tagihan, atau model yang hanya ditawarkan olehnya, seperti MAGI-2. Pilih **OrkasVideoStudio** jika Anda ingin agen pemrograman Anda membuat seluruh video dengan kunci penyedia Anda sendiri dan menyimpan hasilnya sebagai file. Keduanya juga dapat dipakai bersama: klip yang Anda buat di Higgsfield adalah rekaman biasa untuk produksi OrkasVideoStudio. Detail Higgsfield diambil dari [higgsfield.ai](https://higgsfield.ai/mcp) dan [halaman MAGI-2](https://higgsfield.ai/magi-2-intro) miliknya per November 2026.

### OrkasVideoStudio vs framework, editor SaaS, dan wrapper

HyperFrames, ffmpeg, dan whisper.cpp adalah **dependensi** di sini, bukan pesaing. OrkasVideoStudio adalah lapisan yang menghadap agen di atas semuanya: pengetahuan, pemeriksaan penyerahan, produksi yang dapat diedit, dan kanvas.

| | OrkasVideoStudio | Framework terprogram (Remotion, Revideo) | Editor SaaS AI (Descript, Opus Clip, Runway) | Wrapper MCP / ffmpeg yang tipis |
|---|---|---|---|---|
| **Pengendali** | agen pemrograman apa pun, dengan bahasa alami (CLI + MCP) | Anda menulis React/TS secara manual | GUI / di-hosting | agen, tetapi hanya alat |
| **Artefak** | timeline adegan yang dapat diedit di folder lokal, ditambah kanvas browser | kode (jalankan ulang untuk merender) | timeline kotak hitam / proyek yang di-hosting | tidak ada |
| **Cakupan** | penyuntingan rekaman + animasi rancangan + narasi + pembuatan konten dalam satu timeline | komposisi (terprogram) | kebanyakan menyunting *atau* membuat, tergantung produknya | apa pun yang diekspos alat tersebut |
| **Panduan** | menyertakan "apa yang membuat video bagus" sebagai keterampilan, ditambah pemeriksaan penyerahan yang deterministik | tidak ada, Anda yang memutuskan | mengikuti pandangan produknya | tidak ada |
| **Kunci / hosting** | inti tanpa kunci; kunci **milik Anda sendiri** untuk pembuatan konten; mengutamakan lokal | infrastruktur Anda sendiri | kunci vendor + di-hosting, lock-in | bervariasi |
| **Lisensi** | MIT | mungkin memerlukan lisensi perusahaan untuk tim | proprietary | bervariasi |

Gunakan **framework** jika Anda ingin menulis kode setiap frame secara manual, atau **editor SaaS** jika GUI dan hosting memang yang Anda cari. Gunakan **OrkasVideoStudio** jika Anda ingin *agen* Anda yang membuat video, menyimpan hasilnya sebagai file yang dapat Anda periksa, edit, dan render ulang, serta tetap lokal dengan kunci Anda sendiri.

---

## Hubungan dengan Orkas

OrkasVideoStudio berawal sebagai **agen video bawaan di [Orkas](https://orkas.ai?source=gh-orkas-vs)**, aplikasi desktop tim AI. Di sana ia teruji secara menyeluruh, lalu diekstrak menjadi toolkit berlisensi MIT ini yang tidak terikat pada agen tertentu.

- **Di dalam Orkas**, ia hadir sebagai [agen bawaan](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) tanpa instalasi terpisah. Anda mengobrol dengannya di aplikasi desktop alih-alih terminal, dan pembuatan konten dapat berjalan dengan model bawaan Orkas (akun baru mendapat 500 kredit gratis) atau dengan kunci Anda sendiri. [Unduh Orkas](https://orkas.ai/download/?source=gh-orkas-vs) untuk macOS atau Windows.
- **Di tempat lain**, Anda menginstalnya ke agen pemrograman Anda sendiri seperti dijelaskan di atas dan mendapatkan kemampuan inti yang sama melalui CLI `ovs`, server MCP, dan kanvas. Fitur akun Orkas, seperti penyedia yang di-hosting, kredit, dan publikasi obrolan, bukan bagian dari repositori ini.

Tautan: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[repositori ini](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Paket

| Paket | Isi |
|---|---|
| `@orkas/video-studio-core` | skema timeline adegan dan EDL lama, pemeriksaan penyerahan, helper keputusan, pengaturan waktu narasi, runtime, dan konfigurasi |
| `@orkas/video-studio-tools` | backend untuk timeline, render, edit, analisis, suara ucapan, gambar, dan video, ditambah kanvas browser |
| `@orkas/video-studio` | CLI `ovs` |
| `@orkas/video-studio-mcp` | server MCP (`ovs-mcp`), yang mencerminkan CLI |
| `@orkas/video-studio-skills` | paket pengetahuan `SKILL.md` yang netral terhadap host |

Rencana teknis dan riwayatnya ada di [`PLAN.md`](./PLAN.md). Catatan untuk agen pemrograman yang mengerjakan repositori ini ada di [`AGENTS.md`](./AGENTS.md).

---

## Pengembangan

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

`pnpm install` menerapkan patch HyperFrames berversi di [`patches/`](./patches/), yang membuat keluaran SDR H.264/H.265 memakai matriks BT.709 sesuai yang dinyatakan metadatanya. `OVS_HYPERFRAMES_BIN` eksternal atau fallback kompatibilitas `npx` tidak mendapatkan patch ini, sehingga runtime tersebut harus menyertakan perbaikan warna yang setara.

`test:video` tidak pernah menghabiskan kredit penyedia. Endpoint Seedance palsu lokal mengembalikan fixture H.264 asli, yang diunduh OVS lalu diverifikasi dengan `ffprobe`.

`test:video:e2e` mencakup kedua jalur produksi melalui CLI yang sudah di-build:

- **Jalur komposisi lama.** Pengujian ini membuat produksi 1080p berdurasi sembilan detik dengan tiga adegan menggunakan composition prepare/reconcile, snapshot, draft gate penuh, penanaman subtitle, dan promise check pada file akhir. Pengujian ini mendekode seluruh MP4 dan memeriksa urutan adegan, gerakan yang terlihat, audio yang terdengar di setiap adegan, dan piksel subtitle yang ditanamkan, serta memastikan durasi penyerahan yang salah ditolak.
- **Timeline adegan saat ini.** Pengujian ini merender timeline tiga adegan melalui jalur check dan snapshot HyperFrames yang sebenarnya. Pengujian ini memeriksa warna adegan, gerakan yang dirancang, gerakan video sumber yang didekode, piksel caption, audio, penyerahan yang tidak dapat diubah, dan penolakan render yang kedaluwarsa.

Pengujian ini juga menjalankan permukaan CLI dan MCP yang sudah di-build. Kedua perintah video gagal dengan error yang dapat ditindaklanjuti saat runtime yang diperlukan tidak ada. Rangkaian pengujian biasa dapat melewati kasus yang membutuhkan runtime berat pada mesin tanpa ffmpeg atau browser.

`pnpm verify` harus lolos pada kandidat akhir sebelum commit Git atau PR apa pun. Perintah ini mencakup kasus produksi yang sebenarnya dan juga merupakan titik masuk CI, dan perubahan yang hanya menyentuh pengujian mengikuti aturan yang sama. Untuk tinjauan sinkronisasi atau rilis, simpan dan periksa video yang dihasilkan, pratinjau, frame akhir, dan laporannya:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

Direktori bukti hanya dipakai jika Anda mengaktifkannya, dan setiap kali dijalankan memakai subdirektorinya sendiri. Proses CI biasa membersihkan media sementaranya. Fixture memakai HTML/SVG orisinal dan audio instrumental yang dibuat secara lokal. Fixture tidak memanggil penyedia berbayar dan tidak mengklaim mencakup kualitas TTS atau model.

`pnpm benchmark` tidak memerlukan kunci dan bersifat deterministik. Perintah ini mem-build paket inti, memverifikasi fixture benchmark, lalu mengukur transisi gate, validasi EDL dan ringkasan penyerahan, validasi composition-manifest, dan estimasi narasi. Setiap suite memiliki batas bawah throughput yang sengaja dibuat konservatif, sehingga regresi besar akan gagal sementara variasi normal antarmesin tidak.

## Versi

Semua paket berbagi satu versi kalender, `YYYY.M.D` (tanggal Asia/Shanghai, tanpa nol di depan). Rilis bertag memakai `v<version>` dan dipublikasikan sebagai [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); versi tanggal yang sudah dipublikasikan tidak pernah ditimpa. Perubahan dicantumkan di [CHANGELOG.md](CHANGELOG.md). Versi ini terpisah dari versi aplikasi desktop Orkas dan versi agen marketplace-nya.

## Lisensi

MIT — lihat [`LICENSE`](./LICENSE). Perenderan memakai dependensi [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` yang berlisensi Apache-2.0. Penyuntingan dan pemeriksaan media memakai `ffmpeg` di sistem Anda, dan transkripsi didelegasikan ke HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) menjelaskan cara runtime pihak ketiga ditemukan, beserta catatan lisensinya.
