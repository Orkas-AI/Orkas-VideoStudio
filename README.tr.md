# OrkasVideoStudio

> OrkasVideoStudio, kodlama ajanınızı bir video stüdyosuna dönüştüren açık kaynaklı bir yapay zekâ video düzenleyicisidir. Claude Code, Codex, Cursor veya kabuk (shell) komutu çalıştırabilen ya da MCP destekleyen herhangi bir ajandan tamamlanmış bir video isteyin. Görüntülerinizi kurgular, hareketli grafikler tasarlar, anlatım, müzik ve altyazı ekler, eksik çekimleri kendi anahtarlarınızla üretir ve kontrol edilmiş bir MP4 teslim eder. Bu MP4'ü bir tarayıcı tuvalinde düzenlemeye devam edebilirsiniz.

**Claude Motion, CapCut ve Higgsfield için zaten kullandığınız kodlama ajanının yönettiği, açık kaynaklı bir alternatif.** MIT lisanslı ve yerel önceliklidir; Claude Team veya Enterprise planı ya da video platformu aboneliği gerektirmez: üretilen çekimler, kendi anahtarlarınızla Seedance, Kling, Veo ve diğer video modellerinden gelir. [Karşılaştırma ↓](#karşılaştırma)

**Kodlama ajanı yerine bir uygulama mı tercih edersiniz?** OrkasVideoStudio, macOS ve Windows için ücretsiz yapay zekâ ekibi masaüstü uygulaması **[Orkas](https://orkas.ai/?source=gh-orkas-vs)** içinde yerleşik video ajanı olarak da yer alır. Videoyu sohbette tarif edin; üretim, Orkas'ın yerleşik modelleriyle (yeni hesaplar 500 ücretsiz kredi alır) ya da kendi anahtarlarınızla yapılır. **[Orkas'ı indirin →](https://orkas.ai/download/?source=gh-orkas-vs)** · [İkisi nasıl ilişkili ↓](#orkas-ile-ilişkisi)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*Yukarıdaki 54 saniyelik genel bakış, tek bir brifin nasıl tamamlanmış bir videoya dönüştüğünü gösteriyor: gerçek görüntüleri kurgulama, hareket tasarlama, seslendirme, müzik ve altyazı ekleme, tuvalde çekim seçeneklerini keşfetme ve ardından sözcükleri değiştirme, çekimlerin yerine başkalarını koyma veya sahneleri yeniden sıralama.*

OrkasVideoStudio **kara kutu bir video ajanı değildir**. Düşünme işini ajanınız yapar. Bu proje ona doğaçlama yapamayacağı parçaları sağlar:

- **Video uzmanlığı.** Giriş becerisi `video-studio` olan ve ajan ortamından bağımsız bir `SKILL.md` paketi. Ne zaman soru sorulacağını ve ne zaman devam edileceğini; reklamların, açıklayıcı videoların, ürün demolarının, müziğe göre kurgulanan videoların, sunuculu videoların, kısa filmlerin ve yorum videolarının nasıl farklılaştığını ve bir kurguyu bitti saymadan önce nasıl kontrol edileceğini kapsar.
- **Deterministik araçlar.** `ovs` CLI'ı ve onu birebir yansıtan bir MCP sunucusu. Prodüksiyon zaman çizelgesini, ffmpeg ile kurguyu, transkripsiyonu, görüntü analizini ve kendi sağlayıcı hesaplarınız üzerinden üretimi kapsarlar. Sayfa render'ını ve kare yakalamayı [HyperFrames](https://github.com/heygen-com/hyperframes) yapar; kurguyu ve ölçümü `ffmpeg` yapar.
- **Düzenlenebilir bir prodüksiyon.** Her video sıradan bir klasördür: bir sahne zaman çizelgesi (`videos/main/manifest.json`), bir varlık kaydı, kaynağı belirtilmiş ürün bilgileri ve isteğe bağlı, tasarlanmış bir sayfa. Siz, ajanınız ve tarayıcı tuvali aynı dosyaları düzenlersiniz. Bir satır metni değiştirin, bir görseli başkasıyla değiştirin ya da sahneleri yeniden sıralayın; ardından yeniden render alın.

Kurgu, tasarlanmış hareketli grafikler, altyazılar ve transkripsiyon için **API anahtarı gerekmez**. Görsel, video ve konuşma üretimi isteğe bağlıdır ve **kendi** sağlayıcı hesaplarınızı kullanır. Barındırılan bir arka uç yoktur ve oluşturmanız gereken bir hesap da yoktur.

---

## Neler isteyebilirsiniz

Bir kez istersiniz ve tamamlanmış tek bir video alırsınız. Ajan, isteğin gerektirdiği her şeyi tek bir zaman çizelgesinde birleştirir:

| Yetenek | Neleri kapsar |
|---|---|
| **Gerçek görüntüleri kurgulama** | Kırpma, birleştirme, 9:16 / 1:1 / 16:9 oranına yeniden kadrajlama, klip sesini koruma veya miksleme, bindirme, altyazıları görüntüye gömme ve ses yüksekliğini normalleştirme. Uzun kayıtlarda öne çıkan anları da bulabilir, aynı kısmın tekrar çekilmiş versiyonlarını sıralayabilir ve sessizlikleri ya da dolgu sözcüklerini çıkarabilir; her kesmenin kanıtını da kaydeder. |
| **Tasarlanmış hareket** | Animasyonlu HTML/CSS ile kurulan sahneler: kinetik tipografi, fiyat kartları, alt bantlar, veri vurguları ve geçişler. Düzenlenebilir sözcükler adlandırılmış metin yuvalarında durur; bu yüzden metni değiştirmek hiçbir zaman bir sahneyi yeniden kurmak anlamına gelmez. |
| **Ses ve altyazılar** | Her sahne için o sahnenin uzunluğuna uydurulmuş anlatım. Konuşma sırasında sesi kısılan lisanslı fon müzikleri. Anlatım metninden veya ölçülen kelime zamanlamasından altyazılar. Müziğin vuruşlarına hizalanmış kesmeler. |
| **Üretilen çekimler** | Malzemenizin gösteremediği çekimler için yapılandırdığınız sağlayıcıdan görseller, video klipler ve üretilmiş sunucular (kameraya konuşan kişi). Yalnızca onayladığınız harcama sınırları içinde üretilirler. |

Bir senaryo veya storyboard istediğinizde ajan belgede durur. Tamamlanmış bir video istediğinizde teslime kadar ilerler. Size bir plan veya önizleme yalnızca bunu istediyseniz ya da video yaklaşık iki dakikadan uzunsa gösterir. Videonun kelimesi kelimesine uyacağı, ajanın yazdığı bir senaryo önce size gösterilir; sizin verdiğiniz bir senaryo ise yazıldığı gibi hayata geçirilir.

---

## Team planı olmadan Claude Code'da hareketli grafikler

Anthropic'in animasyon özelliği Claude Motion, yalnızca Claude Team ve Enterprise planlarında beta olarak sunuluyor. OrkasVideoStudio, Claude Code'a aynı türden, kodla oluşturulan hareketli grafikleri Pro, Max, Ultra planlarında veya bir API anahtarıyla kazandırır: ajan her sahneyi animasyonlu HTML ve CSS olarak yazar, örneklenen kareleri inceler ve MP4'ü sizin bilgisayarınızda render eder; böylece render işleminin kendisi hiç token harcamaz.

1. OrkasVideoStudio'yu [kurun](#kurulum) ve `ovs skills --install --target claude` komutunu çalıştırın (Codex için `--target codex`).
2. Videoyu isteyin, örneğin: *"Uygulama lansmanımız için 20 saniyelik, 16:9 bir hareketli grafik videosu hazırla: ürün adını gösteren kinetik tipografili bir açılış, kayarak giren üç özellik kartı ve fiyatı gösteren bir kapanış kartı. Render etmeden önce her sahnenin durağan bir karesini bana göster."*
3. Bir sözcüğü, rengi veya zamanlamayı sahne dosyalarında ya da tuvalde kendiniz değiştirin veya bunu ajandan isteyin; ardından yeniden render alın.

Claude Motion'dan farklı olarak aynı zaman çizelgesi kendi görüntülerinizi, anlatımınızı, müziğinizi ve altyazılarınızı da barındırabilir. [Karşılaştırmaya](#karşılaştırma) bakın.

---

## Kullanım örnekleri

Her satır, ajanınıza verebileceğiniz bir istemdir. Araçları `video-studio` becerisi seçer.

### Reklam ve pazarlama

| Siz şunu söylersiniz… | Ne olur |
|---|---|
| *"Bu fotoğraflardan ve ürün sayfasından bu masa lambası için 20 saniyelik dikey bir reklam hazırla."* | Fotoğrafları içe aktarır, fiyatı ve teknik özellikleri kaynağı belirtilmiş bilgiler olarak kaydeder, dikkat çeken açılış, özellik ve fiyat sahnelerini tasarlar, anlatım ve altyazı ekler; ardından kontrol eder, render alır ve teslim eder. |
| *"Web sitesinden yola çıkarak uygulamamız için 30 saniyelik bir lansman videosu hazırla."* | Gerçek ürün sayfalarını tarayıcınızda yakalar, ürünün kendi ifadelerini ve ekranlarını kullanır ve sahneleri yeniden çizilmiş maketler yerine bunların etrafında kurar. |
| *"Üretilmiş bir sunucunun bu serumu tanıttığı 30 saniyelik bir sunuculu video hazırla."* | Önce monoloğu yazar, kurgusal bir sunucunun tek bir anahtar görselini oluşturup her klipte yeniden kullanır, konuşma kliplerini video sağlayıcınızla üretir ve fiyatları ve iddiaları ekranda düzenlenebilir metin olarak tutar. |
| *"Bu senaryodan 15 saniyelik 9:16 bir tanıtım hazırla: açılışı üret, özellik vurgularını tasarla, tek bir seslendirme kullan."* | Tek bir zaman çizelgesi; üretilen açılışı, tasarlanmış özellik sahnelerini ve tek bir anlatım kanalını birleştirir ve tamamlanan dosya teslimden önce kontrol edilir. |

### Film ve dizi

| Siz şunu söylersiniz… | Ne olur |
|---|---|
| *"Gece vardiyasında çalışan bir hemşire hakkında, her çekimde aynı iki karakterin yer aldığı bir dakikalık kısa film hazırla."* | Hikâyeyi tek bir dramatik soru üzerine kurar, karakterler çekimler boyunca tutarlı kalsın diye her karakter için tek satırlık bir görünüm tanımı ve tek bir anahtar görsel tutar ve çekimleri onayladığınız bütçe içinde video sağlayıcınızla üretir. |
| *"Bu üç dizi bölümünü 3 dakikalık, anlatımlı bir özete dönüştür."* | Bölümlerin transkriptini çıkarır, hikâyeyi taşıyan sahneleri seçer, jenerikleri ve sonraki bölüm fragmanlarını atlar, özeti yazıp seslendirir ve görüntülerinizi bu anlatımın altına kurgular. |
| *"Açılış için şehrin şafak vaktini gösteren 5 saniyelik bir çekim üret."* | Sağlayıcıyı, modeli ve maliyeti teyit eder, video sağlayıcınızla tek bir çekim üretir ve bunu zaman çizelgesinde görüntülerinizin yanına yerleştirir. |

### Kurgu

| Siz şunu söylersiniz… | Ne olur |
|---|---|
| *"Bu 1 saatlik ekran kaydını altyazılı, 30'ar saniyelik üç öne çıkanlar klibine dönüştür."* | Sahne ve kalite analizi iyi kısımları bulur. Tekrar çekilmiş versiyonlar sıralanır, sessizlikler ve dolgu sözcükleri kesilir, altyazılar ölçülen kelime zamanlamasına göre görüntüye gömülür. |
| *"Webcam kaydımdaki sessizlikleri ve 'ııı'ları temizle, kaydı sıkılaştır."* | Sessiz boşlukları ve dolgu sözcüklerini algılar, deterministik bir jump cut yapar ve çıkarılan her bölümün kanıtını kaydeder. |
| *"product-demo.mp4 dosyasına İngilizce seslendirme ve altyazı ekle, ses yüksekliğini de dengele."* | Videonun transkriptini çıkarır, her satırı çevirip ait olduğu görüntü aralığı içinde seslendirir, seslendirmeyi mevcut sesle miksler, altyazıları görüntüye gömer ve ses yüksekliğini normalleştirir. |
| *"Gezimizden bu 20 klibi bu parçaya göre, vuruşlara denk gelecek şekilde kes."* | Parçanın vuruşlarını ölçer, klipleri bu vuruşlara göre keser ve teslim edilen dosyanın vuruş hizalamasını kontrol eder. |

### Açıklayıcı videolar ve eğitimler

| Siz şunu söylersiniz… | Ne olur |
|---|---|
| *"Vektör veritabanları hakkında Çince seslendirmeli 60 saniyelik bir açıklayıcı video hazırla."* | Hareketli grafik sahneleri yazar, anlatımı TTS sağlayıcınızla sentezler ve her satırı kendi sahnesine uydurur. |
| *"Ayarlar sayfasının ekran kaydını 90 saniyelik bir eğitim videosuna dönüştür."* | Kaydı kırpar, gerçek arayüzdeki her öğeyi adım adım işaretler, anlatım ve altyazı ekler. |

### Popüler videoları yeniden oluşturma

| Siz şunu söylersiniz… | Ne olur |
|---|---|
| *"Bu viral videonun yapısını ve temposunu ürünüm için yeniden oluştur. Önce bana planı göster."* | Referansı çözümler, anlatı adımlarını sizin malzemenizle eşler ve prodüksiyona geçmeden önce onayınızı bekler. |
| *"Bu rakip reklam iyi performans gösteriyor. Bizimkini aynı açılış ve ritimle, kendi fotoğraflarımızı kullanarak hazırla."* | Referansın içeriğini değil; dikkat çeken açılışının, kanıtının ve harekete geçirici mesajının ritmini ödünç alır. Her iddia sizin ürün bilgilerinizden, her görsel sizin malzemenizden gelir. |

Ajanınıza bir **referans video dosyası** ve kendi ürün varlıklarınızı, senaryonuzu veya görüntülerinizi verin. Ajanınız OrkasVideoStudio'yu kullanarak referansın **anlatı yapısını, görsel stilini ve kurgu temposunu** yeni içerik için yeniden oluşturabilir:

1. **Referansı analiz edin.** Dikkat çeken açılışı, gösterimi veya kanıtı, bilgi sırasını, tipografiyi, geçişleri, tempoyu ve harekete geçirici mesajı belirlemek için örneklenen kareleri ve ilgili sesi inceleyin.
2. **Uyarlamayı planlayın.** Neyin korunacağını ve neyin değiştirileceğini belirtin, ardından referanstaki anları yeni sahnelere veya zaman çizelgesine eşleyin. Zamanlamayı gerçek anlatımınıza ve okuma süresine göre uyarlayın.
3. **Hazırlayın ve revize edin.** Gerektiğinde hareketli grafikler oluşturun, görüntülerinizi kurgulayın ve eksik görselleri üretin. Yerelde hazırlanan metinler, altyazılar, anlatım ve klipler ayrı ayrı düzenlenebilir kalır. Üretilmiş görüntülere gömülü metin ancak o görüntünün kendisi değiştirilerek değiştirilebilir.

Bu yöntem en iyi sonucu hareketli grafikli açıklayıcı videolarda, SaaS ve uygulama demolarında ve mevcut görüntülerden hazırlanan ürün reklamlarında verir. Ajanınızın okuyabileceği bir dosyayla başlayın, çünkü sosyal medya platformlarının paylaşım bağlantılarından indirme yerleşik değildir. Kamera hareketlerinin birebir aynısı, insan performansları ve kare kare eşleşme garanti edilmez. Teslim kontrolleri, sonucun referansa ne kadar benzediğini puanlamaz. Ayrıntılar için [referans videoyu yeniden oluşturma iş akışına](./packages/skills/video-craft/references/reference-recreation.md) bakın.

---

## Kurulum

**Ön koşullar:** Node ≥ 22, `pnpm` ve `PATH` değişkeninizde `ffmpeg` + `ffprobe`. Sürümü sabitlenmiş [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` paketi bağımlılık olarak kurulur ve kontroller ile render için sayfaları başsız (headless) Chrome'da işler; `npx` yalnızca bir uyumluluk yedeğidir. Üretim isteğe bağlıdır ve kendi anahtarlarınızı gerektirir.

### Kaynak koddan

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

npm paketleri henüz yayımlanmadı; bu yüzden şimdilik kaynak koddan kurun.

---

## Claude Code, Codex veya herhangi bir kodlama ajanıyla yönetin

`ovs` CLI'ı temel arayüzdür; MCP araçları onu birebir yansıtır. Ajanınızın desteklediği yöntemi kullanın:

**1) Yerel (native) beceriler (Claude Code / Codex).** Ajanın kendiliğinden bulabilmesi için beceri paketini kurun:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Aynı beceri paketi [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) üzerinde de listelenir; bu yüzden `npx skills add orkas-ai/orkas-videostudio` komutu da paketi kurar. Beceriler `ovs` CLI'ını çağırır; bu nedenle önce onu yukarıda anlatıldığı gibi kurun.

**2) MCP araçları.** Sunucuyu kaydedin:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) Kendini tanımlayan CLI (kabuk erişimi olan her ajan).** Yükleyici gerekmez:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Ardından ajanınızdan bir video istemeniz yeterli. Ajan önce `video-studio` becerisini okur, sonra ihtiyaç duyduğu aşama ve zanaat referanslarını yükler.

---

## Bir prodüksiyon nasıl işler

Ajan kısa bir klasör adı seçer ve her şeyi bu klasörde tutar:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

Sahne sırası oynatma sırasıdır. Başlangıç zamanları ve toplam uzunluk sahnelerden hesaplanır ve hiçbir zaman saklanmaz; bu yüzden bir sahneyi taşımak zamanlamayı tutarsız bırakamaz. Bir fiyat `product.json` içinde yalnızca bir kez bulunur ve onu gösteren her sahne fiyatı oradan okur. Farklı en-boy oranları, diller veya A/B kurguları gibi paralel varyantlar için ajan, aynı varlıkları paylaşan ek video kimlikleri ekler. [Zaman çizelgesi sözleşmesine](packages/skills/video-studio/references/timeline.md) bakın.

Tipik bir çalıştırma:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship`, son dosyayı kaydetmeden önce ölçer: süre, tuval boyutu, ses, ses yüksekliği ve anlatım kapsamı. Altyazı uyarıları görsel onay için işaretlenir ve gerçek MP4'ten kareler döndürülür. Her teslim değiştirilemez bir sürüm olur. En son değişiklikten önce alınmış bir render eskimiş olarak reddedilir ve önceki teslimlerin üzerine asla yazılmaz. Bu kontrollerden geçmek görsel kaliteyi onaylamaz. Biri kareleri gerçekten inceleyene kadar görsel inceleme `not_checked` olarak sayılır.

Kalan belirli bir bulguyu açıkça kabul ettiğinizde, o bulgunun tam kodunu `--accept-findings '["CODE"]' --accept-reason '<your decision>'` ile iletin. Sürüm bu kararı kaydeder; diğer tüm hatalar teslimi engellemeye devam eder. Yazma işlemleri `.ovs-timeline.lock` ile sıraya konur; bir çökme bu dosyayı geride bırakırsa, kaldırmadan önce dosyanın sahibi olan sürecin durduğundan emin olun. [Zaman çizelgesi sözleşmesi](packages/skills/video-studio/references/timeline.md) her ikisini de ele alır.

**Revizyonlar ucuz ve yerel kalır.** Değişen bir sözcük, kesme, sıra, fon müziği veya altyazı yerinde düzenlenir. Yalnızca değişen bir konuşma satırı yeniden seslendirilir ve yalnızca hatalı bir çekim yeniden üretilir; bunlar da önceden onaylanmış harcama içinde kalır. Altyazı metnini düzenlemek konuşma sesini değiştirmez. HyperFrames her seferinde videonun tamamını render eder; bu taşınabilir derleme render edilmiş sahneleri önbelleğe almaz.

---

## Tarayıcıdaki video tuvali

`timeline import`, `timeline prepare`, `timeline render` veya `timeline ship` başarılı olduğunda (CLI'dan ya da MCP'den), OVS o prodüksiyonun tuvalini varsayılan tarayıcınızda açar. Sonraki komutlar yeni sekmeler açmak yerine aynı sekmeyi yeniden kullanır. Tuval, CLI ve MCP ile aynı dosyaları düzenler; bu yüzden değişiklikler iki yönde de akar. Ajan çalışırken tuval salt görüntüleme durumunda gösterilir.

Tuvalde şunları yapabilirsiniz:

- **İzleyin ve dışa aktarın.** Videoyu oynatın, teslim edilmiş sürümler arasında geçiş yapın ve istediğiniz sürümü indirin.
- **Malzemeyi yerleştirin.** Görüntüleri yükleyin, sürükleyip bırakın veya yapıştırın; ardından çalışma alanındaki kartları taşıyın ve birbirine bağlayın.
- **Sahneleri düzenleyin.** Sözcükleri, sırayı ve görselleri değiştirin; sahne ekleyin, kaldırın veya kaldırılan sahneleri geri koyun.
- **Çekim üretin ve yeniden yapın.** Bir karttan yeni bir görsel veya video çekimi oluşturun ya da mevcut bir çekimi yeniden üretin. Referansları veya ilk ve son kareleri, ayrıca modeli, çözünürlüğü ve sesi siz seçersiniz; bir modelin destekleyemediği seçenekler devre dışı bırakılır. Önceki sonuçlar arasında gezinin ve kullanılacak olanı seçin. Tuval her ücretli istekten önce size sorar.
- **Videoyu güncelleyin.** Sıradan sahne düzenlemeleri yerelde render edilip teslim edilir; ilerleme video kartında gösterilir. Bir ürün bilgisini, bir anlatım satırını veya tüm videonun seslendirme sesini değiştirmek ajanınız için bir istek oluşturur, çünkü bu düzenlemeler onun muhakemesini gerektirir. Sahnelerde durağan görüntüler olduğu için teslim kontrolü bir güncellemeyi durdurursa video kartı **Preview this version** (Bu sürümü önizle), **Return to editing** (Düzenlemeye dön) veya **Update anyway** (Yine de güncelle) seçeneklerini sunar; Update anyway seçeneği, yeniden render almadan o render'ı korur.
- **Ajana söyleyin.** Bir sahne, çekim, görüntü kartı veya video hakkında kısa bir istek yazın. İstek, o kartın bağlamıyla birlikte gönderilir.

Tuval Çince açılır. Dil düğmesi Çince ile İngilizce arasında geçiş yapar ve seçiminizi hatırlar.

### İstekleri ajanınıza geri gönderme

**Send** (Gönder) düğmesi isteği yalnızca prodüksiyonu oluşturan sohbete iletir. O sohbet isteği alamıyorsa taslak tuvalde kalır. Hiçbir şey panoya kopyalanmaz, otomatik olarak yeniden gönderilmez veya yeni bir oturuma gönderilmez. Bağlı bir ajan olmadan da düzenleme, güncelleme ve dışa aktarma çalışmaya devam eder.

- **Codex.** `ovs` bir Codex konuşma dizisi (thread) içinde çalıştığında istek aynı konuşma dizisinin kuyruğuna eklenir. Bunun için Codex CLI 0.160.1 veya daha yenisi ve onun yerel uygulama sunucusunun (app server) çalışıyor olması gerekir. Kapatılmış veya yüklenmemiş bir konuşma dizisi kullanılamaz olarak gösterilir.
- **Claude Code.** İstekler, bir Claude Code araştırma önizlemesi (research preview) olan MCP kanalı üzerinden gelir; sıradan bir MCP bağlantısı yeterli değildir. Sunucuyu `--claude-channel` ile kaydedin, ardından Claude Code'u kanal etkinken başlatın:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Tuvalin bu kanala bağlı olarak açılması için videoyu `ovs` MCP araçları üzerinden yapın. Kabuktaki CLI'dan açılan bir tuval Claude Code'a ulaşamaz. Claude Code başlangıçta bir yerel geliştirme uyarısı gösterir. Kanallar için claude.ai ile oturum açmış olmanız veya bir Console API anahtarınızın olması gerekir; Team ve Enterprise planlarında ise önce bir yöneticinin kanalları etkinleştirmesi gerekir. [Claude Code kanallarına](https://code.claude.com/docs/en/channels) bakın.

### Bir prodüksiyonu kendiniz açın

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Tuvali kullandığınız sürece komutu çalışır durumda tutun. `--agent` ile tuval, prodüksiyon klasöründe CLI'ınızın kendi oturum açma, model ve izin ayarlarını kullanan yerel (native) bir oturum çalıştırır. Bu oturum için Codex 0.160.1+ veya Claude Code 2.1.148+ gerekir. Oturumun izin istemleri ve soruları tuvalde görünür. Belirli bir oturumu devretmek için `--resume <session-id>` ya da sıfırdan başlamak için `--new-session` vermediğiniz sürece tuval, klasör için kaydedilmiş oturumu geri yükler. Diğer seçenekler:

- `--no-open`, tarayıcı açmadan erişim bağlantısını yazdırır.
- `--port`, geri döngü (loopback) portunu seçer.
- `--recover`, önceki sahibi çıkmış bir tuvali geri alır.

Prodüksiyon çalışması sırasında otomatik açılmayı kapatmak için `OVS_STUDIO_AUTO_OPEN=0` ayarlayın. CI'da zaten kapalıdır.

---

## Kendi üretim sağlayıcılarınızı kullanın

Sağlayıcıları `~/.config/orkas-video-studio/config.json` (veya `$OVS_CONFIG_DIR/config.json`) dosyasında ya da ortam değişkenleriyle yapılandırın. Ortam değişkenleri dosyadaki ayarları geçersiz kılar.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Yetenek | `provider` değerleri | Ortam değişkenleri |
|---|---|---|
| Konuşma (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Görsel (`ovs image`) | `openai` (Seedream dahil, OpenAI uyumlu herhangi bir uç nokta), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Hiçbir ücretli çağrı yapmadan bir yapılandırmayı inceleyebilirsiniz:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Her anlatım satırının kendi sahnesinin veya plan penceresinin içinde kalması için sentezden önce ve sonra `ovs narration fit` komutunu çalıştırın. Video üretimi açıkça belirtilen referans görselleri, oran, süre, çözünürlük ve ses bayraklarını alır; böylece sağlayıcı çağrısı onaylanan planla eşleşir. `plan.json` projelerinde `ovs plan validate`, herhangi bir şey üretilmeden önce her üretim segmentinin oranını, süresini ve işlemini yapılandırılmış `video.provider` değerine göre de kontrol eder.

Bazı sağlayıcılar birkaç ek ayar gerektirir:

- **Google Cloud Veo**, `video.workspace_id`, `video.region` ve `video.api_key` içinde bir API token'ı veya hizmet hesabı JSON'u kullanır.
- **Alibaba** konuşma hizmeti, `tts.base_url` içinde kendi çalışma alanı uç noktasını kullanır. Wan video için `video.workspace_id` ve `video.region` gerekir.
- **Yalnızca klonlama yoluyla kullanılabilen sesler**, sağlayıcıya kaydettirdiğiniz ses kimliğini gerektirir.
- **WebSocket üzerinden konuşma**, yalnızca siz yapılandırdığınızda `tts.proxy_url` üzerinden geçer.
- **Video referansları** herkese açık görsel veya video URL'leri olarak iletilir. Desteklenen referans sayısı ve ilk/son kare desteği modele göre değişir.
- **[MuAPI](https://muapi.ai)**, `video.provider: "muapi"` ile açıkça seçilmelidir. Seçildiğinde `MUAPI_API_KEY`, `OVS_VIDEO_API_KEY` değerinden önceliklidir; anahtar tek başına hiçbir zaman MuAPI'yi seçmez. `video.model` / `OVS_VIDEO_MODEL`, doğrulanmış Kling v2.1 uç noktaları olan `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` ve `kling-v2.1-pro-i2v` değerlerini destekler. Diğer slug'lar, uyumsuz bir gövdeyle gönderilmek yerine reddedilir. Metinden videoya üretimde varsayılan `kling-v2.1-master-t2v`, ilk kare olarak bir `image_url` verildiğinde varsayılan `kling-v2.1-master-i2v` olur. Süre 5 veya 10 saniyedir; oran `16:9`, `9:16` veya `1:1` olur. Sağlayıcıdan bağımsız `resolution`, `generate_audio` ve `quality` girdileri imzalı planlarla uyumlu kalır: Kling çözünürlüğü ve sesi yok sayar; kalite doğrulanır ancak gönderilmez. Düzenleme ve ek referans seçenekleri, eşleşen bir MuAPI şeması desteklenene kadar reddedilir. Varsayılan temel URL `/api/v1` içerir; özel bir temel URL de bunu içermelidir. Gönderme ve yoklama (submit-and-poll) sözleşmesi ve modele özgü parametreler için [MuAPI API başvurusuna](https://muapi.ai/docs/api-reference) bakın.

Sağlayıcı model katalogları her sağlayıcının API sözleşmesini tanımlar. Anlık erişilebilirliği veya fiyatlandırmayı garanti etmez.

---

## Üretimi sınırlı tutan güvenceler

Ajan, mevcut malzemeniz çekimin işini gördüğü her yerde onu kullanır ve yalnızca eksik olanı üretir. Kimlik bilgilerinin yapılandırılmış olması harcama onayı sayılmaz. Ücretli herhangi bir işten önce ajan; sağlayıcıyı, modeli, amacı, yeniden denemeler dahil istek sayısını ve tahmini maliyeti teyit eder. Ardından bu kapsamın dışına çıkmaz. Reddetmeniz o isteğe ait ücretli çağrıları durdurur; kötü bir çekim için en fazla iki düzeltilmiş deneme yapılır, sonrasında ajan sizden yaklaşımı değiştirmenizi ister.

Her ücretli istek, çıktısının yanında bir makbuz tutar. Sonucu bilinmeyen bir video görevi, siz inceleyene kadar aynı çıktıya yeni bir gönderimi engeller ve hiçbir zaman otomatik olarak yeniden gönderilmez. [Üretim yetkisine](packages/skills/video-studio/references/generation.md) bakın.

`ovs speak`, çıktısının yanına bir istek ve ses makbuzu yazar. Yalnızca birebir eşleşen ve ses baytları bozulmamış bir isteği yeniden kullanır; bu yüzden onaylanan `--language`, ses, model, hız ve format değerlerini iletin; bunlardan herhangi birini değiştirmek yeniden kullanımı geçersiz kılar. Ayrıca istek gönderilmeden önce çıktıyı sahiplenir; bu da eşzamanlı yinelenen çağrıları önler.

Barındırılan bir müzik hizmeti yoktur. Müzik, sizin sağladığınız lisanslı dosyalardan gelir ve ajan her dosyanın kaynağını ve lisansını kaydeder.

---

## Komut başvurusu

Her komutun tipli girdileri için `ovs <command> --help` çalıştırın. MCP araçları aynı adları alt çizgiyle kullanır; örneğin `timeline_prepare` ve `edit_trim_silence`.

| Alan | Komutlar |
|---|---|
| Kurulum | `doctor`, `skills [--install]`, `skill <name>` |
| Prodüksiyon | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Kurgu (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analiz | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Anlatım | `narration timing · fit`, `speech-capabilities`, `speak` |
| Üretim | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Önceki projeler | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (`check` komutunun takma adı) |

Önceki `plan.json` EDL ve `composition-manifest.json` biçimleriyle oluşturulmuş projeler "Önceki projeler" komutlarıyla çalışmaya devam eder. Yeni işler sahne zaman çizelgesini kullanır. Birleştirilmiş bir `plan.json` için bileşen görüntülerinin yanı sıra tamamlanmış dosyayı da doğrulayın:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

Eşdeğer MCP aracı `plan_promise_check`, `probe_produced` ve `video` parametrelerini kabul eder. Süreyi, tuval boyutunu, sesi, entegre ses yüksekliğini ve satır başına seslendirilmiş aralıkları ölçer. Eksik anlatım kanıtı kontrolün başarısız olmasına yol açar; altyazılar görüntüye gömüldüğünde altyazı uyarıları görsel kontrol gerektirir.

---

## Karşılaştırma

### OrkasVideoStudio, Claude Motion, CapCut ve Higgsfield karşılaştırması

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **Nedir** | kodlama ajanınızın yönettiği açık kaynaklı bir video stüdyosu | Claude içindeki bir animasyon çıktısı | ByteDance'in bir video düzenleme uygulaması | barındırılan bir yapay zekâ görsel ve video platformu |
| **Kimler kullanabilir** | herkes; Claude Code, Codex, Cursor veya kabuk komutu çalıştıran ya da MCP destekleyen herhangi bir ajanla sizin bilgisayarınızda çalışır | Claude Team ve Enterprise planları (beta) | masaüstü, mobil ve web uygulamaları; ücretsiz ve ücretli katmanlar | ücretsiz ya da aylık kredi planlı bir Higgsfield hesabı; web uygulaması, API'si, MCP bağlayıcısı veya CLI'ı üzerinden |
| **Nasıl düzenlersiniz** | değişikliği ajanınıza anlatırsınız ya da tarayıcı tuvalinde metni, görselleri ve sahne sırasını değiştirirsiniz | Claude'un düzenleyicisinde veya Claude'dan isteyerek | zaman çizelgesinde elle | web stüdyolarında her üretim veya düzenleme için bir istem yazarsınız ya da bunu bağlayıcısı üzerinden ajanınızdan yaparsınız |
| **Görüntüler** | kırpma, birleştirme, 9:16 / 1:1 / 16:9 oranına yeniden kadrajlama, sessizlikleri ve dolgu sözcüklerini çıkarma, vuruşlara göre kesme | metni, grafikleri, şekilleri ve görselleri canlandırır; üretilmiş görüntü veya insan yok | tam manuel kurgu | bir klip üzerinde yapay zekâ düzenlemeleri: nesneleri ve arka planları kaldırma ya da değiştirme, yeni bir stil uygulama, yeniden kadrajlama, çözünürlüğü yükseltme veya bir çekimi uzatma |
| **Hareketli grafikler** | HTML/CSS sahneler: kinetik tipografi, fiyat kartları, alt bantlar, veri vurguları, geçişler | kodla oluşturulan açıklayıcı animasyonlar | şablonlar, metin animasyonları ve efektler | AI Motion Designer aracının After Effects veya Premiere Pro'da oluşturduğu başlıklar, geçişler ve logo açılış animasyonları |
| **Ses** | sahne başına anlatım, konuşma sırasında sesi kısılan fon müzikleri, ölçülen kelime zamanlamasından altyazılar | Anthropic'in yardım makalesinde ele alınmıyor | uygulama içinde ses, müzik ve altyazı araçları | yapay zekâ seslendirmesi, ses çevirisi ve dudak senkronizasyonu |
| **Üretilen çekimler** | yapılandırdığınız sağlayıcılardan görseller, video klipler ve sunucular; örneğin Seedance 2.5, Kling 4.0, Google Cloud üzerinde Veo 3.1, Runway Gen-4.5 ve Wan 3.0; kendi anahtarlarınız üzerinden faturalandırılır | yok | bir senaryodan veya görselden yola çıkan bir yapay zekâ video oluşturucusu | tek hesapta birçok barındırılan model; Seedance 2.5, Kling 4.0, Veo 3.1 ve yalnızca Higgsfield'in sunduğu MAGI-2 dahil |
| **Çıktı** | teslimden önce süre, tuval boyutu, ses yüksekliği ve anlatım açısından kontrol edilmiş MP4 | MP4 dışa aktarma | MP4 dışa aktarma | üretilmiş klipler ve görseller ile stüdyo uygulamalarında hazırlanan videolar |
| **Kaynak** | MIT; her video, sahibi olduğunuz yerel bir klasördür | tescilli, barındırılan | tescilli | tescilli, barındırılan |

Elle kurgu yapmak istiyorsanız **CapCut**'ı ya da Shotcut veya Kdenlive gibi açık kaynaklı bir zaman çizelgesi düzenleyicisini seçin. Ekibiniz zaten Team veya Enterprise planıyla Claude'da çalışıyor ve açıklayıcı animasyonlara ihtiyaç duyuyorsa **Claude Motion**'ı seçin. Tek faturada birçok barındırılan model ya da MAGI-2 gibi yalnızca onun sunduğu bir model istiyorsanız **Higgsfield**'i seçin. Kodlama ajanınızın videonun tamamını (görüntü, hareket ve ses tek bir zaman çizelgesinde) kendi sağlayıcı anahtarlarınızla yapmasını ve sonucu inceleyebileceğiniz, düzenleyebileceğiniz ve yeniden render alabileceğiniz dosyalar olarak tutmayı istiyorsanız **OrkasVideoStudio**'yu seçin. Higgsfield ve OrkasVideoStudio birlikte de çalışır: Higgsfield'de ürettiğiniz klipler, bir OrkasVideoStudio prodüksiyonu için sıradan görüntülerdir. Ayrıntılar, Kasım 2026 itibarıyla [Anthropic'in yardım merkezinden](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), [CapCut'ın yapay zekâ video oluşturucu sayfasından](https://www.capcut.com/tools/ai-video-generator) ve [higgsfield.ai](https://higgsfield.ai/) adresinden alınmıştır.

---

## SSS

### Claude Code video oluşturabilir mi?

Evet. OrkasVideoStudio kuruluysa Claude Code `video-studio` becerisini okur; görüntüleri kurgulamak, hareketli grafikler oluşturmak, anlatım ve altyazı eklemek ve bilgisayarınızda kontrol edilmiş bir MP4 render etmek için `ovs` CLI'ını veya MCP araçlarını kullanır. Codex, Cursor ve kabuk komutu çalıştırabilen ya da MCP destekleyen diğer tüm ajanlar da aynı şekilde çalışır. [Claude Code, Codex veya herhangi bir kodlama ajanıyla yönetin](#claude-code-codex-veya-herhangi-bir-kodlama-ajanıyla-yönetin) bölümüne bakın.

### OrkasVideoStudio ücretsiz mi, API anahtarı gerekiyor mu?

OrkasVideoStudio ücretsizdir ve MIT lisanslıdır. Kurgu, tasarlanmış hareketli grafikler, altyazılar ve transkripsiyon yerelde çalışır ve API anahtarı gerektirmez. Görsel, video klip veya konuşma üretmek isteğe bağlıdır ve size doğrudan fatura kesen kendi sağlayıcı hesaplarınızı kullanır. Ücretli herhangi bir çağrıdan önce ajan; sağlayıcıyı, modeli, istek sayısını ve tahmini maliyeti sizinle teyit eder. [Üretimi sınırlı tutan güvenceler](#üretimi-sınırlı-tutan-güvenceler) bölümüne bakın.

### OrkasVideoStudio; Claude Motion, CapCut ve Higgsfield için açık kaynaklı bir alternatif mi?

Evet. Claude Motion gibi, hareketli grafikleri Claude Code'a kod olarak yazdırır; ancak yalnızca Team ve Enterprise planlarında değil, Pro, Max, Ultra planlarında veya bir API anahtarıyla Claude Code ile, ayrıca başka ajanlarla da çalışır. CapCut'tan farklı olarak düzenlemeleri, sizin bir zaman çizelgesinde elle kesmeniz yerine ajanınız sizin tarifinize göre yapar. Higgsfield'den farklı olarak ne model barındırır ne de kredi satar: ajanınız Seedance, Kling, Veo ve diğer video modellerini kendi anahtarlarınızla çağırır, ardından çekimleri görüntülerinizle, hareketli grafiklerle, anlatımla ve altyazılarla birleştirir. [Karşılaştırma](#karşılaştırma) bölümüne bakın.

### Elimdeki görüntüleri kurgulayabilir mi?

Evet. Klipleri kırpar ve birleştirir, 9:16, 1:1 veya 16:9 oranına yeniden kadrajlar, sessizlikleri ve dolgu sözcüklerini çıkarır, vuruşlara göre keser, altyazıları görüntüye gömer ve ses yüksekliğini normalleştirir. Görüntüleriniz, hareketli grafikler ve üretilen çekimlerle aynı zaman çizelgesinde yer alır.

### Hangi video, görsel ve konuşma modellerini kullanabilir?

Video için: Seedance, Kling, Veo (Google veya Google Cloud üzerinden), Runway, Wan, MiniMax ve Vidu, ayrıca Atlas ve MuAPI. Görsel için: Gemini ve OpenAI ya da Seedream dahil OpenAI uyumlu herhangi bir uç nokta. Konuşma için: OpenAI, Doubao, MiniMax, Alibaba (Qwen ve CosyVoice), Google, ElevenLabs ve OpenAI uyumlu uç noktalar. Hepsi kendi anahtarlarınızla çalışır. [Kendi üretim sağlayıcılarınızı kullanın](#kendi-üretim-sağlayıcılarınızı-kullanın) bölümüne bakın.

### OrkasVideoStudio nasıl kurulur?

Kaynak koddan kurun: depoyu klonlayın, `pnpm install && pnpm build` komutunu çalıştırın, ardından kurulumunuzu `ovs doctor` ile kontrol edin. Node 22 veya daha yenisi, pnpm, ayrıca ffmpeg ve ffprobe gerekir. npm paketleri henüz yayımlanmadı. [Kurulum](#kurulum) bölümüne bakın.

---

## Orkas ile ilişkisi

OrkasVideoStudio, yapay zekâ ekibi masaüstü uygulaması **[Orkas](https://orkas.ai?source=gh-orkas-vs) içindeki yerleşik video ajanı** olarak başladı. Orada uçtan uca kanıtlandı, ardından oradan ayrılarak ajandan bağımsız, MIT lisanslı bu araç setine dönüştürüldü.

- **Orkas içinde**, ayrı bir kurulum gerektirmeyen [yerleşik bir ajan](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) olarak gelir. Onunla terminal yerine bir masaüstü uygulamasında sohbet edersiniz; üretim, Orkas'ın yerleşik modelleriyle (yeni hesaplar 500 ücretsiz kredi alır) veya kendi anahtarlarınızla çalışabilir. macOS veya Windows için [Orkas'ı indirin](https://orkas.ai/download/?source=gh-orkas-vs).
- **Diğer her yerde**, yukarıda anlatıldığı gibi kendi kodlama ajanınıza kurarsınız ve aynı temel yetenekleri `ovs` CLI'ı, MCP sunucusu ve tuval üzerinden elde edersiniz. Barındırılan sağlayıcılar, krediler ve sohbet yayınlama gibi Orkas hesap özellikleri bu deponun parçası değildir.

Bağlantılar: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[bu depo](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Paketler

| Paket | İçerik |
|---|---|
| `@orkas/video-studio-core` | sahne zaman çizelgesi ve eski EDL şemaları, teslim kontrolleri, karar yardımcıları, anlatım zamanlaması, çalışma zamanı ve yapılandırma |
| `@orkas/video-studio-tools` | zaman çizelgesi, render, kurgu, analiz, konuşma, görsel ve video için arka uçlar, ayrıca tarayıcı tuvali |
| `@orkas/video-studio` | `ovs` CLI'ı |
| `@orkas/video-studio-mcp` | CLI'ı birebir yansıtan MCP sunucusu (`ovs-mcp`) |
| `@orkas/video-studio-skills` | ajan ortamından bağımsız `SKILL.md` bilgi paketi |

Teknik plan ve geçmişi [`PLAN.md`](./PLAN.md) dosyasındadır. Bu depo üzerinde çalışan kodlama ajanları için notlar [`AGENTS.md`](./AGENTS.md) dosyasındadır.

---

## Geliştirme

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

`pnpm install`, [`patches/`](./patches/) içindeki sürümlü HyperFrames yamasını uygular; bu yama, SDR H.264/H.265 çıktısının meta verisinde bildirdiği BT.709 matrisini kullanmasını sağlar. Harici bir `OVS_HYPERFRAMES_BIN` veya `npx` uyumluluk yedeği bu yamayı almaz; bu nedenle o çalışma zamanı eşdeğer bir renk düzeltmesi içermelidir. Yama ayrıca Whisper’ın Çince ve Japonca için sözcük düzeyindeki zaman damgalarını korur. Harici çalışma ortamları da bu özelliği desteklemelidir.

`test:video` hiçbir zaman sağlayıcı kredisi harcamaz. Yerel, sahte bir Seedance uç noktası gerçek bir H.264 test dosyası döndürür; OVS bu dosyayı indirir ve `ffprobe` ile doğrular.

`test:video:e2e`, derlenmiş CLI üzerinden her iki prodüksiyon yolunu da kapsar:

- **Önceki kompozisyon yolu.** Kompozisyon prepare/reconcile, snapshot, tam taslak kapısı (draft gate), altyazı gömme ve son dosya promise kontrolleriyle dokuz saniyelik, üç sahneli 1080p bir prodüksiyon oluşturur. MP4'ün tamamını çözer; sahne sırasını, görünür hareketi, her sahnede duyulabilir sesi ve gömülü altyazı piksellerini kontrol eder ve yanlış bir teslim süresinin reddedildiğini doğrular.
- **Güncel sahne zaman çizelgesi.** Üç sahneli bir zaman çizelgesini gerçek HyperFrames check ve snapshot yolu üzerinden render eder. Sahne renklerini, tasarlanan hareketi, çözülmüş kaynak video hareketini, altyazı piksellerini, sesi, değiştirilemez teslimi ve eskimiş render'ın reddedilmesini kontrol eder.

Ayrıca derlenmiş CLI ve MCP yüzeylerini de çalıştırır. Gerekli bir çalışma zamanı eksik olduğunda her iki video komutu da ne yapılması gerektiğini söyleyen bir hatayla başarısız olur. Sıradan test paketi, ffmpeg veya tarayıcı bulunmayan makinelerde çalışma zamanı açısından ağır senaryoları atlayabilir.

`pnpm verify`, herhangi bir Git commit'inden veya PR'dan önce son aday üzerinde başarılı olmalıdır. Gerçek prodüksiyon senaryosunu içerir ve aynı zamanda CI giriş noktasıdır; yalnızca testleri değiştiren değişiklikler de aynı kurala uyar. Senkronizasyon veya sürüm incelemesi için üretilen videoyu, önizlemeleri, son kareleri ve raporları saklayın ve inceleyin:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

Kanıt dizini isteğe bağlıdır ve her çalıştırma kendi alt dizinini kullanır. Sıradan CI çalıştırmaları geçici medyalarını temizler. Test verileri özgün HTML/SVG ve yerelde üretilmiş enstrümantal ses kullanır. Ücretli sağlayıcıları çağırmazlar ve TTS ya da model kalitesini kapsadıklarını iddia etmezler.

`pnpm benchmark` anahtar gerektirmez ve deterministiktir. Çekirdek paketi derler, benchmark test verilerini doğrular, ardından kapı geçişlerini, EDL doğrulamasını ve teslim özetlerini, composition-manifest doğrulamasını ve anlatım tahminini ölçer. Her test paketinin bilinçli olarak temkinli belirlenmiş bir verim alt sınırı vardır; böylece büyük gerilemeler testi başarısız kılar, normal makine farklılıkları ise kılmaz.

Kurulum, komutlar ve kanıtların saklanması için İngilizce [isteğe bağlı model değerlendirme kılavuzuna](./eval/video/README.md) bakın.

## Sürümler

Tüm paketler tek bir takvim sürümünü paylaşır: `YYYY.M.D` (Asia/Shanghai tarihi, başında sıfır olmadan). Etiketli sürümler `v<version>` biçimini kullanır ve [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) olarak yayımlanır; yayımlanmış bir tarih sürümünün üzerine asla yazılmaz. Değişiklikler [CHANGELOG.md](CHANGELOG.md) dosyasında listelenir. Bu sürüm, Orkas masaüstü uygulamasından ve onun mağaza ajanlarının sürümlerinden bağımsızdır.

## Lisans

MIT — [`LICENSE`](./LICENSE) dosyasına bakın. Render, Apache-2.0 lisanslı [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` bağımlılığını kullanır. Kurgu ve medya kontrolleri sisteminizdeki `ffmpeg`'i kullanır; transkripsiyon HyperFrames / whisper.cpp'ye devredilir. [`PLAN.md`](./PLAN.md), üçüncü taraf çalışma zamanlarının nasıl bulunduğunu lisans notlarıyla birlikte açıklar.
