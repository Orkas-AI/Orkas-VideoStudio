# OrkasVideoStudio

> Trasforma il tuo agente di programmazione in uno studio video. Chiedi un video finito a Claude Code, Codex, Cursor o a qualsiasi agente in grado di usare una shell o di comunicare tramite MCP. Monta il tuo girato, crea motion graphics, aggiunge narrazione, musica e sottotitoli, genera con le tue chiavi le inquadrature mancanti e consegna un MP4 verificato. Puoi continuare a modificare quell'MP4 in un'area di lavoro video nel browser.

**Un'alternativa open source a Claude Motion, CapCut e Higgsfield, guidata dall'agente di programmazione che usi già.** Licenza MIT e priorità al locale, senza bisogno di un piano Claude Team o Enterprise né di un abbonamento a una piattaforma video: le inquadrature generate provengono da Seedance, Kling, Veo e altri modelli video, con le tue chiavi. [Il confronto ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Preferisci un'app a un agente di programmazione?** OrkasVideoStudio è anche l'agente video integrato in **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, l'app desktop gratuita con un team di IA per macOS e Windows. Descrivi il video in chat; la generazione usa i modelli integrati di Orkas (i nuovi account ricevono 500 crediti gratuiti) oppure le tue chiavi. **[Scarica Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Come si collegano i due ↓](#rapporto-con-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

OrkasVideoStudio **non è un agente video a scatola nera**. A ragionare è il tuo agente. Questo progetto gli fornisce le parti che non può improvvisare:

- **Know-how video.** Un pacchetto di abilità (skill) `SKILL.md` indipendente dall'host, con `video-studio` come abilità di ingresso. Spiega quando chiedere e quando procedere, in cosa si differenziano annunci pubblicitari, video esplicativi, demo di prodotto, montaggi su musica, video con presentatore, cortometraggi e video di commento, e come verificare un montaggio prima di considerarlo finito.
- **Strumenti deterministici.** La CLI `ovs` e un server MCP che la rispecchia. Coprono la timeline di produzione, il montaggio con ffmpeg, la trascrizione, l'analisi del girato e la generazione tramite i tuoi account presso i provider. [HyperFrames](https://github.com/heygen-com/hyperframes) si occupa del rendering delle pagine e della cattura dei fotogrammi; `ffmpeg` del montaggio e delle misurazioni.
- **Una produzione modificabile.** Ogni video è una semplice cartella: una timeline delle scene (`videos/main/manifest.json`), un registro degli asset, i dati di prodotto con le relative fonti e una pagina progettata facoltativa. Tu, il tuo agente e l'area di lavoro nel browser modificate tutti gli stessi file. Cambia una riga di testo, sostituisci un'immagine o riordina le scene, poi esegui di nuovo il rendering.

Montaggio, motion graphics progettate, sottotitoli e trascrizione **non richiedono chiavi API**. La generazione di immagini, video e voce si attiva solo se lo scegli e usa **i tuoi** account presso i provider. Non c'è alcun backend in hosting né alcun account da creare.

---

## Cosa puoi chiedere

Chiedi una volta e ottieni un unico video finito. L'agente combina in un'unica timeline tutto ciò che serve alla richiesta:

| Funzionalità | Cosa comprende |
|---|---|
| **Montaggio di girato reale** | Taglia, unisce, riadatta l'inquadratura a 9:16 / 1:1 / 16:9, mantiene o mixa l'audio delle clip, sovrappone elementi, imprime i sottotitoli e normalizza il loudness. Per le registrazioni lunghe può anche trovare i momenti salienti, classificare le riprese ripetute e rimuovere silenzi o intercalari, registrando le prove alla base di ogni taglio. |
| **Motion graphics progettate** | Scene costruite in HTML/CSS con animazioni: tipografia cinetica, card dei prezzi, sottopancia, evidenziazioni di dati e transizioni. Le parole modificabili si trovano in slot di testo con nome, quindi cambiare un testo non significa mai ricostruire una scena. |
| **Audio e sottotitoli** | Narrazione per ogni scena, adattata alla durata di quella scena. Basi musicali con licenza che si abbassano sotto il parlato. Sottotitoli ricavati dal testo della narrazione o dai tempi misurati delle parole. Tagli allineati al beat. |
| **Inquadrature generate** | Immagini, clip video e presentatori generati (talking head) dal provider che hai configurato, per le inquadrature che il tuo materiale non può mostrare. Vengono create solo entro la spesa che approvi. |

Per uno script o uno storyboard, l'agente si ferma al documento. Per un video finito arriva fino alla consegna. Ti mostra un piano o un'anteprima solo se l'hai chiesto o se il video dura più di circa due minuti. Uno script che scrive perché il video lo segua parola per parola ti viene mostrato prima; uno script che fornisci tu viene realizzato così come è scritto.

---

## Motion graphics in Claude Code, senza un piano Team

Claude Motion, la funzione di animazione di Anthropic, è in beta solo sui piani Claude Team ed Enterprise. OrkasVideoStudio offre a Claude Code lo stesso tipo di motion graphics costruite con il codice su Pro, Max, Ultra o con una chiave API: l'agente scrive ogni scena in HTML e CSS con animazioni, esamina i fotogrammi campionati ed esegue il rendering di un MP4 sul tuo computer, quindi il rendering in sé non consuma token.

1. [Installa](#installazione) OrkasVideoStudio ed esegui `ovs skills --install --target claude` (oppure `--target codex` per Codex).
2. Chiedi il video, per esempio: *«Crea un video in motion graphics di 20 secondi in 16:9 per il lancio della nostra app: un'apertura in tipografia cinetica con il nome del prodotto, tre card delle funzionalità che entrano scorrendo e una card finale con il prezzo. Mostrami un fotogramma fisso di ogni scena prima di eseguire il rendering.»*
3. Cambia tu stesso una parola, un colore o i tempi nei file delle scene o nell'area di lavoro, oppure chiedilo all'agente, poi esegui di nuovo il rendering.

A differenza di Claude Motion, la stessa timeline può contenere anche il tuo girato, la narrazione, la musica e i sottotitoli. Vedi [il confronto](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Casi d'uso

Ogni riga è un prompt che potresti dare al tuo agente. L'abilità `video-studio` sceglie gli strumenti.

### Pubblicità e marketing

| Dici… | Cosa succede |
|---|---|
| *«Crea un annuncio verticale di 20 secondi per questa lampada da scrivania a partire da queste foto e dalla pagina del prodotto.»* | Importa le foto, registra prezzo e specifiche come dati con fonte, progetta le scene di aggancio, funzionalità e prezzo, aggiunge narrazione e sottotitoli, poi verifica, esegue il rendering e consegna. |
| *«Crea un video di lancio di 30 secondi per la nostra app a partire dal suo sito web.»* | Cattura nel tuo browser le vere pagine del prodotto, usa le parole e le schermate del prodotto stesso e costruisce le scene attorno a esse, invece che attorno a mock-up ridisegnati. |
| *«Crea un video di 30 secondi con presentatore, in cui un conduttore generato presenta questo siero.»* | Scrive prima il monologo, crea un'unica immagine chiave di un conduttore fittizio e la riusa in ogni clip, genera le clip parlate con il tuo provider video e mantiene prezzi e affermazioni come testo a schermo modificabile. |
| *«Crea un promo 9:16 di 15 s da questo script: genera l'apertura, componi i richiami delle funzionalità, una sola voce fuori campo.»* | Un'unica timeline combina l'apertura generata, le scene progettate delle funzionalità e un'unica traccia di narrazione, e il file finito viene verificato prima della consegna. |

### Film e fiction

| Dici… | Cosa succede |
|---|---|
| *«Crea un cortometraggio di un minuto su un'infermiera del turno di notte, con gli stessi due personaggi in ogni inquadratura.»* | Costruisce la storia attorno a un'unica domanda drammatica, mantiene per ogni personaggio un'unica descrizione dell'aspetto e un'unica immagine chiave, così restano coerenti da un'inquadratura all'altra, e genera le inquadrature con il tuo provider video entro il budget che approvi. |
| *«Trasforma questi tre episodi della serie in un riassunto narrato di 3 minuti.»* | Trascrive gli episodi, sceglie le scene che portano avanti la storia, salta i titoli di coda e le anteprime dell'episodio successivo, scrive il riassunto e ne genera la voce, poi ci monta sotto il tuo girato. |
| *«Genera un'inquadratura di 5 s della città all'alba per l'apertura.»* | Conferma provider, modello e costo, crea una sola inquadratura con il tuo provider video e la inserisce nella timeline accanto al tuo girato. |

### Montaggio

| Dici… | Cosa succede |
|---|---|
| *«Trasforma questa registrazione dello schermo di 1 ora in tre clip di momenti salienti da 30 s con sottotitoli.»* | L'analisi delle scene e della qualità trova le parti migliori. Le riprese ripetute vengono classificate, silenzi e intercalari vengono tagliati e i sottotitoli vengono impressi in base ai tempi misurati delle parole. |
| *«Togli i silenzi e gli "ehm" dalla mia registrazione con la webcam e rendila più serrata.»* | Rileva le pause di silenzio e gli intercalari, esegue un jump cut deterministico e registra le prove per ogni intervallo rimosso. |
| *«Aggiungi una voce fuori campo in inglese e i sottotitoli a product-demo.mp4 e uniforma il loudness.»* | Trascrive il video, traduce e dà voce a ogni battuta entro la finestra temporale della sua immagine, mixa la voce sopra l'audio esistente, imprime i sottotitoli e normalizza il loudness. |
| *«Monta queste 20 clip del nostro viaggio su questo brano, a tempo.»* | Misura i beat del brano, ci taglia sopra le clip e verifica l'allineamento ai beat del file consegnato. |

### Video esplicativi e tutorial

| Dici… | Cosa succede |
|---|---|
| *«Crea un video esplicativo di 60 s sui database vettoriali con una voce fuori campo in cinese.»* | Scrive scene in motion graphics, sintetizza la narrazione con il tuo provider TTS e adatta ogni battuta alla sua scena. |
| *«Trasforma la mia registrazione dello schermo della pagina delle impostazioni in un tutorial di 90 secondi.»* | Taglia la registrazione, evidenzia passo dopo passo ogni controllo sull'interfaccia reale e aggiunge narrazione e sottotitoli. |

### Ricreare video popolari

| Dici… | Cosa succede |
|---|---|
| *«Ricrea la struttura e il ritmo di questo video virale per il mio prodotto. Mostrami prima il piano.»* | Scompone il riferimento, associa i suoi momenti chiave al tuo materiale e attende la tua approvazione prima di produrre. |
| *«Questo annuncio di un concorrente funziona bene. Fai il nostro con lo stesso aggancio e lo stesso ritmo, usando le nostre foto.»* | Prende in prestito dal riferimento il ritmo di aggancio, prova e invito all'azione, non i suoi contenuti. Ogni affermazione proviene dai dati del tuo prodotto e ogni immagine dal tuo materiale. |

Dai al tuo agente un **file video di riferimento** e i tuoi asset di prodotto, il tuo script o il tuo girato. Il tuo agente può usare OrkasVideoStudio per ricrearne la **struttura narrativa, lo stile visivo e il ritmo di montaggio** per i nuovi contenuti:

1. **Analizzare il riferimento.** Esaminare i fotogrammi campionati e l'audio rilevante per individuare l'aggancio, la dimostrazione o la prova, l'ordine delle informazioni, la tipografia, le transizioni, il ritmo e l'invito all'azione.
2. **Pianificare l'adattamento.** Stabilire cosa mantenere e cosa sostituire, poi associare i momenti del riferimento alle nuove scene o alla timeline. Adattare i tempi alla narrazione effettiva e al tempo di lettura.
3. **Produrre e rivedere.** Comporre le motion graphics, montare il girato e generare gli elementi visivi mancanti quando serve. Testi, sottotitoli, narrazione e clip creati in locale restano modificabili separatamente. Il testo impresso nel girato generato si può cambiare solo cambiando quel girato.

Funziona al meglio con video esplicativi in motion graphics, demo di SaaS e di app e annunci di prodotto realizzati con girato esistente. Parti da un file che il tuo agente può leggere, perché il download dai link di condivisione dei social non è integrato. I movimenti di camera esatti, la recitazione delle persone e la corrispondenza fotogramma per fotogramma non sono garantiti. I controlli di consegna non valutano quanto il risultato somigli al riferimento. Per i dettagli, consulta il [flusso di lavoro per ricreare un video di riferimento](./packages/skills/video-craft/references/reference-recreation.md).

---

## Installazione

**Prerequisiti:** Node ≥ 22, `pnpm`, e `ffmpeg` + `ffprobe` nel tuo `PATH`. Il pacchetto [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, a versione fissata, viene installato come dipendenza ed esegue il rendering delle pagine in Chrome headless per i controlli e per il rendering; `npx` è solo un ripiego per compatibilità. La generazione è facoltativa e richiede le tue chiavi.

### Dal sorgente (funziona già oggi)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### Da npm (dopo la pubblicazione)

I pacchetti npm non sono ancora pubblicati. Una volta pubblicati, il comando `ovs` funzionerà allo stesso modo:

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Usalo da Claude Code, Codex o qualsiasi agente di programmazione

La CLI `ovs` è l'interfaccia canonica e gli strumenti MCP la rispecchiano. Scegli tra le seguenti modalità quella supportata dal tuo agente:

**1) Abilità native (Claude Code / Codex).** Installa il pacchetto di abilità perché l'agente lo trovi da solo:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Lo stesso pacchetto di abilità è elencato su [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), quindi lo installa anche `npx skills add orkas-ai/orkas-videostudio`. Le abilità chiamano la CLI `ovs`, quindi installala prima come descritto sopra.

**2) Strumenti MCP.** Registra il server:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) CLI autodescrittiva (qualsiasi agente con una shell).** Non serve alcun loader:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Poi chiedi semplicemente un video al tuo agente. Legge prima `video-studio` e carica i riferimenti sulle fasi e sul mestiere di cui ha bisogno.

---

## Come funziona una produzione

L'agente sceglie un breve nome di cartella e ci tiene dentro tutto:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

L'ordine delle scene è l'ordine di riproduzione. Gli istanti di inizio e la durata totale vengono calcolati dalle scene e non vengono mai salvati, quindi spostare una scena non può rendere incoerenti i tempi. Un prezzo si trova una sola volta in `product.json` e ogni scena che lo mostra lo legge da lì. Per le varianti parallele, come altri rapporti d'aspetto, altre lingue o montaggi A/B, l'agente aggiunge altri id video che condividono gli stessi asset. Vedi il [contratto della timeline](packages/skills/video-studio/references/timeline.md).

Un'esecuzione tipica:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` misura il file finale prima di registrarlo: durata, dimensioni del fotogramma, audio, loudness e copertura della narrazione. Gli avvisi sui sottotitoli vengono segnalati per una conferma visiva e vengono restituiti fotogrammi dell'MP4 effettivo. Ogni consegna diventa una versione immutabile. Un rendering eseguito prima dell'ultima modifica viene rifiutato perché obsoleto e le consegne precedenti non vengono mai sovrascritte. Superare questi controlli non certifica la qualità visiva. La revisione visiva risulta `not_checked` finché qualcuno non guarda davvero i fotogrammi.

Quando accetti esplicitamente una specifica segnalazione rimasta, passa il suo codice esatto con `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. La versione registra quella decisione e ogni altro errore continua a bloccare la consegna. Le scritture vengono serializzate con `.ovs-timeline.lock`; se un crash lo lascia sul disco, verifica che il processo che lo detiene si sia fermato prima di rimuoverlo. Il [contratto della timeline](packages/skills/video-studio/references/timeline.md) tratta entrambi gli aspetti.

**Le revisioni restano economiche e locali.** Una parola, un taglio, un ordine, una base musicale o un sottotitolo modificati vengono corretti sul posto. Solo una battuta parlata modificata viene doppiata di nuovo e solo un'inquadratura sbagliata viene rigenerata, entro la spesa già approvata. Modificare il testo dei sottotitoli non cambia l'audio parlato. HyperFrames esegue ogni volta il rendering dell'intero video; questa build portabile non mette in cache le scene già renderizzate.

---

## Area di lavoro video nel browser

Quando `timeline import`, `timeline prepare`, `timeline render` o `timeline ship` va a buon fine (dalla CLI o da MCP), OVS apre l'area di lavoro di quella produzione nel tuo browser predefinito. I comandi successivi riutilizzano la stessa scheda invece di aprirne di nuove. L'area di lavoro modifica gli stessi file della CLI e di MCP, quindi le modifiche passano in entrambe le direzioni. Mentre l'agente lavora, è in sola lettura.

Nell'area di lavoro puoi:

- **Guardare ed esportare.** Riprodurre il video, passare da una versione consegnata all'altra e scaricare quella che vuoi.
- **Organizzare il materiale.** Caricare, trascinare o incollare il girato, poi spostare e collegare le card sulla lavagna.
- **Modificare le scene.** Cambiare parole, ordine e immagini, e aggiungere, rimuovere o ripristinare scene.
- **Generare e rifare inquadrature.** Creare una nuova inquadratura (immagine o video) da una card, oppure generare di nuovo un'inquadratura esistente. Scegli i riferimenti oppure il primo e l'ultimo fotogramma, oltre a modello, risoluzione e audio; le opzioni che un modello non supporta sono disattivate. Puoi scorrere i risultati precedenti e scegliere quello da usare. Prima di ogni richiesta a pagamento viene chiesta la tua conferma.
- **Aggiornare il video.** Le normali modifiche alle scene vengono renderizzate e consegnate in locale, con l'avanzamento mostrato sulla card del video. Modificare un dato di prodotto, una battuta della narrazione o la voce dell'intero video genera una richiesta per il tuo agente, perché queste modifiche richiedono il suo giudizio. Se il controllo di consegna blocca un aggiornamento perché alcune scene contengono immagini ferme, la card del video offre **Anteprima di questa versione**, **Torna alla modifica** o **Aggiorna comunque**; Aggiorna comunque conserva quel rendering senza eseguirlo di nuovo.
- **Dirlo all'agente.** Scrivi una breve richiesta su una scena, un'inquadratura, una card del girato o un video. Viene inviata insieme al contesto di quella card.

L'area di lavoro si apre in cinese e ricorda la lingua che scegli tra 19 opzioni.

### Inviare le richieste al tuo agente

**Invia** consegna la richiesta solo alla conversazione che ha creato la produzione. Se quella conversazione non può riceverla, la bozza resta nell'area di lavoro. Nulla viene copiato negli appunti, rinviato automaticamente o inviato a una nuova sessione. Modifica, aggiornamento ed esportazione continuano a funzionare senza un agente collegato.

- **Codex.** Quando `ovs` viene eseguito all'interno di un thread di Codex, la richiesta viene messa in coda in quello stesso thread. Serve Codex CLI 0.160.1 o successiva con il suo app server locale in esecuzione. Un thread chiuso o non caricato risulta non disponibile.
- **Claude Code.** Le richieste arrivano tramite un canale MCP, una funzione in research preview di Claude Code, e una normale connessione MCP non basta. Registra il server con `--claude-channel`, poi avvia Claude Code con il canale abilitato:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Crea il video tramite gli strumenti MCP `ovs`, così l'area di lavoro si apre collegata a quel canale. Un'area di lavoro aperta dalla CLI nella shell non può raggiungere Claude Code. All'avvio Claude Code mostra un avviso di sviluppo locale. I canali richiedono un accesso a claude.ai o una chiave API della Console e, sui piani Team ed Enterprise, un amministratore deve prima abilitarli. Vedi [i canali di Claude Code](https://code.claude.com/docs/en/channels).

### Aprire tu stesso una produzione

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Lascia il comando in esecuzione mentre usi l'area di lavoro. Con `--agent`, l'area di lavoro esegue nella cartella della produzione una sessione nativa che usa l'accesso, il modello e le impostazioni dei permessi della tua CLI. Questa sessione richiede Codex 0.160.1+ o Claude Code 2.1.148+. Le sue richieste di permesso e le sue domande compaiono nell'area di lavoro. Ripristina la sessione salvata per la cartella, a meno che tu non passi `--resume <session-id>` per affidarle una sessione specifica o `--new-session` per ricominciare da zero. Altre opzioni:

- `--no-open` stampa il link di accesso senza aprire un browser.
- `--port` sceglie la porta di loopback.
- `--recover` recupera un'area di lavoro il cui proprietario precedente è terminato.

Per disattivare l'apertura automatica durante il lavoro di produzione, imposta `OVS_STUDIO_AUTO_OPEN=0`. In CI è già disattivata.

---

## Provider di generazione con le tue chiavi (BYO)

Configura i provider in `~/.config/orkas-video-studio/config.json` (o `$OVS_CONFIG_DIR/config.json`) oppure con variabili d'ambiente. Le variabili d'ambiente hanno la precedenza sul file.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Funzionalità | Valori di `provider` | Variabili d'ambiente |
|---|---|---|
| Voce (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Immagini (`ovs image`) | `openai` (qualsiasi endpoint compatibile con OpenAI, incluso Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Puoi esaminare una configurazione senza effettuare chiamate a pagamento:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Esegui `ovs narration fit` prima e dopo la sintesi, così ogni battuta della narrazione resta all'interno della finestra della sua scena o del piano. La generazione video riceve in modo esplicito immagini di riferimento, rapporto d'aspetto, durata, risoluzione e flag audio, così la chiamata al provider corrisponde al piano approvato. Per i progetti `plan.json`, `ovs plan validate` verifica anche rapporto d'aspetto, durata e operazione di ogni segmento da generare rispetto al `video.provider` configurato, prima che venga generato qualsiasi cosa.

Alcuni provider richiedono qualche impostazione in più:

- **Google Cloud Veo** usa `video.workspace_id`, `video.region` e un token API o un JSON di service account in `video.api_key`.
- **Alibaba**, per la voce, usa l'endpoint del proprio workspace in `tts.base_url`. Il video Wan richiede `video.workspace_id` e `video.region`.
- **Le voci disponibili solo tramite clonazione** richiedono l'id della voce che hai registrato presso il provider.
- **La voce via WebSocket** passa per `tts.proxy_url` solo se lo configuri.
- **I riferimenti video** vengono passati come URL pubblici di immagini o video. Il numero supportato e il supporto per primo/ultimo fotogramma variano a seconda del modello.
- **[MuAPI](https://muapi.ai)** deve essere selezionato esplicitamente con `video.provider: "muapi"`. Quando è selezionato, `MUAPI_API_KEY` ha la precedenza su `OVS_VIDEO_API_KEY`; la chiave, da sola, non seleziona mai MuAPI. `video.model` / `OVS_VIDEO_MODEL` supporta gli endpoint Kling v2.1 convalidati `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` e `kling-v2.1-pro-i2v`. Gli altri slug vengono rifiutati anziché essere inviati con un corpo non corrispondente. Per il text-to-video il valore predefinito è `kling-v2.1-master-t2v`, e con un `image_url` come primo fotogramma il valore predefinito è `kling-v2.1-master-i2v`. La durata è di 5 o 10 secondi e il rapporto d'aspetto è `16:9`, `9:16` o `1:1`. Gli input indipendenti dal provider `resolution`, `generate_audio` e `quality` restano compatibili con i piani firmati: Kling ignora risoluzione e audio, e la qualità viene convalidata ma non inviata. I controlli di modifica e di riferimenti aggiuntivi vengono rifiutati finché non sarà supportato uno schema MuAPI corrispondente. L'URL di base predefinito include `/api/v1`, e anche uno personalizzato deve includerlo. Consulta il [riferimento API di MuAPI](https://muapi.ai/docs/api-reference) per il contratto di invio e polling e per i parametri specifici dei modelli.

I cataloghi dei modelli dei provider descrivono il contratto API di ciascun provider. Non garantiscono la disponibilità effettiva né i prezzi.

---

## Cosa tiene sotto controllo la generazione

L'agente usa il tuo materiale esistente ovunque sia adatto all'inquadratura e genera solo ciò che manca. Avere credenziali configurate non vale come approvazione a spendere. Prima di qualsiasi lavoro a pagamento, l'agente conferma provider, modello, scopo, numero di richieste compresi i nuovi tentativi e costo stimato. Poi si attiene a quell'ambito. Se rifiuti, le chiamate a pagamento per quella richiesta si fermano, e un'inquadratura riuscita male ottiene al massimo due nuove versioni corrette prima che l'agente ti chieda di cambiare approccio.

Ogni richiesta a pagamento conserva una ricevuta accanto al suo output. Un'attività video dall'esito sconosciuto blocca un altro invio verso lo stesso output finché non la controlli, e non viene mai ripetuta automaticamente. Vedi [autorizzazione alla generazione](packages/skills/video-studio/references/generation.md).

`ovs speak` scrive una richiesta e una ricevuta audio accanto al suo output. Riusa solo una richiesta che corrisponde esattamente e i cui byte audio sono intatti, quindi passa i valori approvati di `--language`, voce, modello, velocità e formato; cambiarne uno qualsiasi invalida il riuso. Inoltre prenota l'output prima dell'invio, il che impedisce chiamate duplicate concorrenti.

Non esiste un servizio musicale in hosting. La musica proviene da file con licenza forniti da te, e l'agente registra la fonte e la licenza di ogni file.

---

## Riferimento dei comandi

Esegui `ovs <command> --help` per vedere l'input tipizzato di ogni comando. Gli strumenti MCP usano gli stessi nomi con i trattini bassi, per esempio `timeline_prepare` e `edit_trim_silence`.

| Area | Comandi |
|---|---|
| Configurazione | `doctor`, `skills [--install]`, `skill <name>` |
| Produzione | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Montaggio (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analisi | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narrazione | `narration timing · fit`, `speech-capabilities`, `speak` |
| Generazione | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Progetti precedenti | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias di `check`) |

I progetti creati con i formati precedenti, l'EDL `plan.json` e `composition-manifest.json`, funzionano ancora tramite i comandi di «Progetti precedenti». I nuovi lavori usano la timeline delle scene. Per un `plan.json` assemblato, verifica il file finito oltre al girato che lo compone:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

Lo strumento MCP equivalente `plan_promise_check` accetta `probe_produced` e `video`. Misura durata, dimensioni del fotogramma, audio, loudness integrato e intervalli parlati di ogni battuta. Se mancano le prove della narrazione il controllo fallisce, e gli avvisi sui sottotitoli richiedono un controllo visivo quando i sottotitoli sono stati impressi.

---

## Confronto con le alternative

### OrkasVideoStudio vs Claude Motion vs CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **Che cos'è** | uno studio video open source guidato dal tuo agente di programmazione | un tipo di output di animazione all'interno di Claude | un'app di montaggio video di ByteDance |
| **Chi può usarlo** | chiunque; gira sul tuo computer con Claude Code, Codex, Cursor o qualsiasi agente che usa una shell o comunica tramite MCP | piani Claude Team ed Enterprise (beta) | app desktop, mobile e web, con livelli gratuiti e a pagamento |
| **Come si modifica** | descrivi la modifica al tuo agente, oppure cambia testi, immagini e ordine delle scene nell'area di lavoro nel browser | nell'editor di Claude o chiedendo a Claude | a mano su una timeline |
| **Girato** | taglio, unione, riadattamento a 9:16 / 1:1 / 16:9, rimozione di silenzi e intercalari, montaggio a tempo di musica | anima testo, grafici, forme e immagini; niente girato o persone generati | montaggio manuale completo |
| **Motion graphics** | scene HTML/CSS: tipografia cinetica, card dei prezzi, sottopancia, evidenziazioni di dati, transizioni | animazioni esplicative costruite con il codice | modelli, animazioni di testo ed effetti |
| **Audio** | narrazione per scena, basi musicali che si abbassano sotto il parlato, sottotitoli dai tempi misurati delle parole | non trattato nell'articolo di assistenza di Anthropic | strumenti per voce, musica e sottotitoli nell'app |
| **Output** | MP4, verificato per durata, dimensioni del fotogramma, loudness e narrazione prima della consegna | esportazione MP4 | esportazione MP4 |
| **Codice sorgente** | MIT; ogni video è una cartella locale di tua proprietà | proprietario, in hosting | proprietario |

Scegli **CapCut**, o un editor di timeline open source come Shotcut o Kdenlive, se vuoi montare a mano. Scegli **Claude Motion** se il tuo team lavora già in Claude con un piano Team o Enterprise e ha bisogno di animazioni esplicative. Scegli **OrkasVideoStudio** se vuoi che il tuo agente di programmazione realizzi l'intero video, con girato, motion graphics e audio in un'unica timeline, e conservare il risultato come file che puoi esaminare, modificare e renderizzare di nuovo. I dettagli su Claude Motion provengono dal [centro assistenza di Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion) e sono aggiornati a novembre 2026.

### OrkasVideoStudio vs Higgsfield

Higgsfield è una piattaforma in hosting che vende l'accesso a molti modelli video e di immagini con un unico account, tramite la sua web app, un'API, un connettore MCP e una CLI. OrkasVideoStudio non ospita modelli: il tuo agente chiama i provider che configuri, poi trasforma le inquadrature in un video finito.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **Che cos'è** | uno studio video open source guidato dal tuo agente di programmazione | una piattaforma IA in hosting per immagini e video |
| **Modelli video** | i provider che configuri, come Seedance 2.5, Kling 4.0, Veo 3.1 su Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3 e Vidu Q3 | molti modelli in hosting con un unico account, tra cui Seedance 2.5, Kling 4.0, Veo 3.1 e MAGI-2, offerto solo da Higgsfield |
| **Come paghi** | ogni provider addebita l'uso sulla tua chiave; montaggio, motion graphics, sottotitoli e trascrizione girano in locale e non richiedono chiavi | crediti in abbonamento nella web app e nel connettore, oppure fondi a consumo al secondo sull'API |
| **Cosa ottieni** | un unico MP4 verificato che combina inquadrature generate con il tuo girato, motion graphics, narrazione, musica e sottotitoli, più una cartella di produzione che puoi modificare e renderizzare di nuovo | clip e immagini generate, e le app studio di Higgsfield |
| **Da un agente di programmazione** | abilità, la CLI `ovs` e un server MCP per Claude Code, Codex, Cursor o qualsiasi agente | il connettore MCP, la CLI e le abilità di Higgsfield |
| **Codice sorgente** | MIT; ogni video è una cartella locale di tua proprietà | proprietario, in hosting |

Scegli **Higgsfield** se vuoi molti modelli in hosting con un'unica fattura, o un modello che offre solo lui, come MAGI-2. Scegli **OrkasVideoStudio** se vuoi che il tuo agente di programmazione realizzi l'intero video con le chiavi dei tuoi provider e conservare il risultato come file. I due funzionano anche insieme: le clip che generi su Higgsfield sono normale girato per una produzione OrkasVideoStudio. I dettagli su Higgsfield provengono da [higgsfield.ai](https://higgsfield.ai/mcp) e dalla sua [pagina su MAGI-2](https://higgsfield.ai/magi-2-intro) e sono aggiornati a novembre 2026.

### OrkasVideoStudio vs framework, editor SaaS e wrapper

HyperFrames, ffmpeg e whisper.cpp qui sono **dipendenze**, non concorrenti. OrkasVideoStudio è lo strato rivolto all'agente che si appoggia su di essi: le conoscenze, i controlli di consegna, la produzione modificabile e l'area di lavoro.

| | OrkasVideoStudio | Framework programmatici (Remotion, Revideo) | Editor SaaS con IA (Descript, Opus Clip, Runway) | Wrapper MCP / ffmpeg minimali |
|---|---|---|---|---|
| **Chi lo guida** | qualsiasi agente di programmazione, in linguaggio naturale (CLI + MCP) | scrivi a mano codice React/TS | GUI / in hosting | un agente, ma solo strumenti |
| **Artefatto** | timeline delle scene modificabile in una cartella locale, più un'area di lavoro nel browser | codice (da rieseguire per il rendering) | timeline a scatola nera / progetto in hosting | nessuno |
| **Ambito** | montaggio del girato + motion graphics progettate + narrazione + generazione in un'unica timeline | composizione (programmatica) | per lo più montaggio *o* generazione, a seconda del prodotto | ciò che lo strumento espone |
| **Guida** | include «cosa rende buono un video» sotto forma di abilità, più controlli di consegna deterministici | nessuna, decidi tu | dettata dall'impostazione del prodotto | nessuna |
| **Chiavi / hosting** | nucleo senza chiavi; **le tue** chiavi per la generazione; priorità al locale | la tua infrastruttura | chiavi del fornitore + hosting, lock-in | variabile |
| **Licenza** | MIT | può richiedere una licenza aziendale per i team | proprietaria | variabile |

Scegli un **framework** se vuoi programmare a mano ogni fotogramma, o un **editor SaaS** se ciò che conta sono una GUI e l'hosting. Scegli **OrkasVideoStudio** se vuoi che sia il tuo *agente* a realizzare il video, conservare il risultato come file che puoi esaminare, modificare e renderizzare di nuovo, e restare in locale con le tue chiavi.

---

## Rapporto con Orkas

OrkasVideoStudio è nato come **agente video integrato in [Orkas](https://orkas.ai?source=gh-orkas-vs)**, l'app desktop con un team di IA. Lì è stato collaudato end-to-end, poi è stato estratto in questo toolkit con licenza MIT, indipendente dall'agente.

- **All'interno di Orkas**, viene fornito come [agente integrato](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) senza installazione separata. Gli parli in chat da un'app desktop invece che da un terminale, e la generazione può usare i modelli integrati di Orkas (i nuovi account ricevono 500 crediti gratuiti) oppure le tue chiavi. [Scarica Orkas](https://orkas.ai/download/?source=gh-orkas-vs) per macOS o Windows.
- **Ovunque altro**, lo installi nel tuo agente di programmazione come descritto sopra e ottieni le stesse funzionalità di base tramite la CLI `ovs`, il server MCP e l'area di lavoro. Le funzioni dell'account Orkas, come i provider in hosting, i crediti e la pubblicazione delle chat, non fanno parte di questo repository.

Link: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[questo repository](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Pacchetti

| Pacchetto | Cosa contiene |
|---|---|
| `@orkas/video-studio-core` | schemi della timeline delle scene e dell'EDL legacy, controlli di consegna, helper decisionali, tempi della narrazione, runtime e configurazione |
| `@orkas/video-studio-tools` | backend per timeline, rendering, montaggio, analisi, voce, immagini e video, più l'area di lavoro nel browser |
| `@orkas/video-studio` | la CLI `ovs` |
| `@orkas/video-studio-mcp` | il server MCP (`ovs-mcp`), che rispecchia la CLI |
| `@orkas/video-studio-skills` | il pacchetto di conoscenze `SKILL.md` indipendente dall'host |

Il piano tecnico e la sua cronologia si trovano in [`PLAN.md`](./PLAN.md). Le note per gli agenti di programmazione che lavorano su questo repository sono in [`AGENTS.md`](./AGENTS.md).

---

## Sviluppo

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

`pnpm install` applica la patch versionata di HyperFrames in [`patches/`](./patches/), che fa usare all'output SDR H.264/H.265 la matrice BT.709 dichiarata nei suoi metadati. Un `OVS_HYPERFRAMES_BIN` esterno o il ripiego di compatibilità `npx` non ricevono questa patch, quindi quel runtime deve includere una correzione del colore equivalente.

`test:video` non spende mai crediti dei provider. Un endpoint Seedance fittizio locale restituisce una vera fixture H.264, che OVS scarica e verifica con `ffprobe`.

`test:video:e2e` copre entrambi i percorsi di produzione tramite la CLI compilata:

- **Il percorso di composizione precedente.** Crea una produzione 1080p di nove secondi e tre scene con composition prepare/reconcile, snapshot, l'intero gate della bozza, l'impressione dei sottotitoli e i controlli promise-check sul file finale. Decodifica l'intero MP4 e verifica l'ordine delle scene, il movimento visibile, l'audio udibile in ogni scena e i pixel dei sottotitoli impressi, oltre al fatto che una durata di consegna errata venga rifiutata.
- **L'attuale timeline delle scene.** Esegue il rendering di una timeline di tre scene attraverso il vero percorso di check e snapshot di HyperFrames. Verifica i colori delle scene, il movimento definito nelle scene, il movimento decodificato del video sorgente, i pixel dei sottotitoli, l'audio, la consegna immutabile e il rifiuto dei rendering obsoleti.

Mette alla prova anche le interfacce della CLI e di MCP compilate. Entrambi i comandi video falliscono con un errore che indica come intervenire quando manca un runtime necessario. La normale suite di test può saltare i casi che dipendono da runtime pesanti sulle macchine senza ffmpeg o senza browser.

`pnpm verify` deve passare sul candidato finale prima di qualsiasi commit Git o PR. Include il caso di produzione reale ed è anche il punto di ingresso della CI, e anche le modifiche che riguardano solo i test seguono questa regola. Per la revisione di una sincronizzazione o di una release, conserva ed esamina il video prodotto, le anteprime, i fotogrammi finali e i report:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

La directory delle prove è facoltativa e ogni esecuzione usa una propria sottodirectory. Le normali esecuzioni della CI eliminano i propri file multimediali temporanei. Le fixture usano HTML/SVG originali e audio strumentale generato in locale. Non chiamano provider a pagamento né dichiarano di coprire la qualità del TTS o dei modelli.

`pnpm benchmark` non richiede chiavi ed è deterministico. Compila il pacchetto core, verifica le fixture del benchmark, poi misura le transizioni dei gate, la convalida dell'EDL e i riepiloghi di consegna, la convalida del composition manifest e la stima della narrazione. Ogni suite ha una soglia minima di throughput volutamente prudente, così le regressioni importanti falliscono e la normale variabilità tra macchine no.

## Versioni

Tutti i pacchetti condividono un'unica versione di calendario, `YYYY.M.D` (data di Asia/Shanghai, senza zeri iniziali). Le release con tag usano `v<version>` e vengono pubblicate come [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); una versione con data già pubblicata non viene mai sovrascritta. Le modifiche sono elencate in [CHANGELOG.md](CHANGELOG.md). Questa versione è indipendente dall'app desktop Orkas e dalle versioni dei suoi agenti del marketplace.

## Licenza

MIT — vedi [`LICENSE`](./LICENSE). Il rendering usa la dipendenza [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, con licenza Apache-2.0. Il montaggio e i controlli sui media usano il `ffmpeg` del tuo sistema, e la trascrizione è delegata a HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) spiega come vengono individuati i runtime di terze parti e contiene le note sulle licenze.
