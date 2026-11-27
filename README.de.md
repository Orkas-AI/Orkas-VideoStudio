# OrkasVideoStudio

> Machen Sie Ihren Coding-Agenten zum Videostudio. Bitten Sie Claude Code, Codex, Cursor oder jeden anderen Agenten, der eine Shell ausführen oder MCP sprechen kann, um ein fertiges Video. Er schneidet Ihr Filmmaterial, gestaltet Motion Graphics, fügt Sprecherstimme, Musik und Untertitel hinzu, generiert fehlende Shots mit Ihren eigenen Schlüsseln und liefert eine geprüfte MP4-Datei. Diese MP4 können Sie anschließend auf einer Arbeitsfläche im Browser weiter bearbeiten.

**Eine Open-Source-Alternative zu Claude Motion, CapCut und Higgsfield, gesteuert von dem Coding-Agenten, den Sie bereits nutzen.** MIT-lizenziert und Local-First, ohne Team- oder Enterprise-Tarif von Claude und ohne Abo einer Videoplattform: Generierte Shots kommen von Seedance, Kling, Veo und anderen Videomodellen über Ihre eigenen Schlüssel. [Im Vergleich ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs. Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Lieber eine App als einen Coding-Agenten?** OrkasVideoStudio ist auch der integrierte Video-Agent in **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, der kostenlosen Desktop-App mit KI-Team für macOS und Windows. Beschreiben Sie das Video im Chat; die Generierung läuft über die integrierten Modelle von Orkas (neue Konten erhalten 500 kostenlose Credits) oder über Ihre eigenen Schlüssel. **[Orkas herunterladen →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Wie beides zusammenhängt ↓](#beziehung-zu-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

OrkasVideoStudio ist **kein Blackbox-Video-Agent**. Das Denken übernimmt Ihr Agent. Dieses Projekt gibt ihm die Bausteine, die er nicht improvisieren kann:

- **Video-Know-how.** Ein hostunabhängiges `SKILL.md`-Paket mit `video-studio` als Einstiegs-Skill. Es behandelt, wann nachgefragt und wann weitergemacht wird, worin sich Werbespots, Erklärvideos, Produktdemos, Musikschnitte, Moderatorenvideos, Kurzfilme und Kommentarvideos unterscheiden und wie ein Schnitt geprüft wird, bevor er als fertig gilt.
- **Deterministische Tools.** Die `ovs`-CLI und ein MCP-Server, der sie spiegelt. Sie decken die Produktions-Timeline, Schnitt mit ffmpeg, Transkription, Analyse von Filmmaterial und Generierung über Ihre eigenen Anbieterkonten ab. [HyperFrames](https://github.com/heygen-com/hyperframes) übernimmt das Rendern der Seiten und die Frame-Erfassung; `ffmpeg` übernimmt Schnitt und Messungen.
- **Eine bearbeitbare Produktion.** Jedes Video ist ein gewöhnlicher Ordner: eine Szenen-Timeline (`videos/main/manifest.json`), ein Asset-Register, Produktfakten mit Quellenangabe und optional eine gestaltete Seite. Sie, Ihr Agent und die Arbeitsfläche im Browser bearbeiten alle dieselben Dateien. Ändern Sie eine Textzeile, tauschen Sie ein Bild aus oder ordnen Sie Szenen neu an, und rendern Sie dann erneut.

Schnitt, gestaltete Motion Graphics, Untertitel und Transkription brauchen **keine API-Schlüssel**. Bild-, Video- und Sprachgenerierung müssen ausdrücklich aktiviert werden und nutzen **Ihre eigenen** Anbieterkonten. Es gibt kein gehostetes Backend und kein Konto, das Sie anlegen müssen.

---

## Was Sie anfordern können

Sie stellen eine einzige Anfrage und erhalten ein fertiges Video. Der Agent kombiniert in einer einzigen Timeline alles, was die Anfrage erfordert:

| Fähigkeit | Was dazugehört |
|---|---|
| **Echtes Filmmaterial schneiden** | Kürzen, zusammenfügen, auf 9:16 / 1:1 / 16:9 umformatieren, Clip-Ton behalten oder mischen, überlagern, Untertitel einbrennen und die Lautheit normalisieren. Bei langen Aufnahmen kann er außerdem Highlights finden, wiederholte Takes in eine Rangfolge bringen und Stille oder Füllwörter entfernen und hält dabei für jeden Schnitt die Belege fest. |
| **Gestaltete Animation** | In HTML/CSS gebaute Szenen mit Animation: kinetische Typografie, Preiskarten, Bauchbinden, Daten-Callouts und Übergänge. Bearbeitbare Wörter liegen in benannten Textslots, sodass eine Textänderung nie den Neuaufbau einer Szene bedeutet. |
| **Ton und Untertitel** | Sprecherstimme für jede Szene, an deren Länge angepasst. Lizenzierte Musikbetten, die unter Sprache abgesenkt werden (Ducking). Untertitel aus dem Sprechertext oder aus gemessenem Wort-Timing. Schnitte, die auf dem Beat sitzen. |
| **Generierte Shots** | Bilder, Videoclips und generierte Moderatoren (Talking Head) von Ihrem konfigurierten Anbieter, für Shots, die Ihr Material nicht zeigen kann. Sie entstehen nur im Rahmen der Ausgaben, die Sie freigeben. |

Für ein Skript oder Storyboard hört der Agent beim Dokument auf. Für ein fertiges Video arbeitet er bis zur Auslieferung durch. Einen Plan oder eine Vorschau zeigt er Ihnen nur, wenn Sie danach gefragt haben oder wenn das Video länger als etwa zwei Minuten ist. Ein Skript, das er schreibt und dem das Video Wort für Wort folgen soll, legt er Ihnen zuerst vor; ein Skript, das Sie ihm geben, wird so umgesetzt, wie es geschrieben ist.

---

## Motion Graphics in Claude Code, ohne Team-Tarif

Claude Motion, die Animationsfunktion von Anthropic, ist als Beta nur in den Claude-Tarifen Team und Enterprise verfügbar. OrkasVideoStudio gibt Claude Code dieselbe Art von per Code gebauten Motion Graphics mit einem Pro-, Max- oder Ultra-Tarif oder einem API-Schlüssel: Der Agent schreibt jede Szene als HTML und CSS mit Animation, prüft Stichproben-Frames und rendert eine MP4 auf Ihrem Rechner, sodass das Rendern selbst keine Tokens verbraucht.

1. [Installieren](#installation) Sie OrkasVideoStudio und führen Sie `ovs skills --install --target claude` aus (oder `--target codex` für Codex).
2. Fordern Sie das Video an, zum Beispiel: *„Mach ein 20-sekündiges Motion-Graphics-Video im Format 16:9 für unseren App-Launch: einen Opener mit kinetischer Typografie und dem Produktnamen, drei Feature-Karten, die hereingleiten, und eine Abschlusskarte mit dem Preis. Zeig mir von jeder Szene ein Standbild, bevor du renderst.“*
3. Ändern Sie ein Wort, eine Farbe oder das Timing selbst in den Szenendateien oder auf der Arbeitsfläche, oder bitten Sie den Agenten darum, und rendern Sie dann erneut.

Anders als bei Claude Motion kann dieselbe Timeline auch Ihr eigenes Filmmaterial, Sprecherstimme, Musik und Untertitel enthalten. Siehe [den Vergleich](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Anwendungsfälle

Jede Zeile ist ein Prompt, den Sie Ihrem Agenten geben könnten. Der Skill `video-studio` wählt die Tools aus.

### Werbung und Marketing

| Sie sagen … | Was passiert |
|---|---|
| *„Mach aus diesen Fotos und der Produktseite eine 20-sekündige Hochformat-Anzeige für diese Schreibtischlampe.“* | Er importiert die Fotos, erfasst Preis und technische Daten als belegte Fakten, gestaltet die Szenen für Hook, Features und Preis, fügt Sprecherstimme und Untertitel hinzu und prüft, rendert und liefert dann aus. |
| *„Mach aus unserer Website ein 30-sekündiges Launch-Video für unsere App.“* | Er erfasst die echten Produktseiten in Ihrem Browser, verwendet die eigenen Formulierungen und Screens des Produkts und baut die Szenen um sie herum statt um nachgezeichnete Mock-ups. |
| *„Mach ein 30-sekündiges Moderatorenvideo, in dem ein generierter Moderator dieses Serum vorstellt.“* | Er schreibt zuerst den Monolog, erstellt ein Schlüsselbild eines fiktiven Moderators und verwendet es in jedem Clip wieder, generiert die Sprechclips mit Ihrem Videoanbieter und belässt Preise und Aussagen als bearbeitbaren Text im Bild. |
| *„Mach aus diesem Skript ein 15-sekündiges Promo-Video im Format 9:16: Generiere den Opener, gestalte die Feature-Callouts, ein einziges Voice-over.“* | Eine Timeline vereint den generierten Opener, gestaltete Feature-Szenen und eine einzige Sprecherspur, und die fertige Datei wird vor der Auslieferung geprüft. |

### Film und Drama

| Sie sagen … | Was passiert |
|---|---|
| *„Mach einen einminütigen Kurzfilm über eine Krankenpflegerin im Nachtdienst, mit denselben zwei Figuren in jedem Shot.“* | Er baut die Geschichte um eine einzige dramatische Frage auf, legt für jede Figur eine Beschreibung ihres Aussehens und ein Schlüsselbild fest, damit die Figuren über alle Shots hinweg konsistent bleiben, und generiert die Shots mit Ihrem Videoanbieter im Rahmen des Budgets, das Sie freigeben. |
| *„Mach aus diesen drei Drama-Episoden eine 3-minütige Zusammenfassung mit Sprecher.“* | Er transkribiert die Episoden, wählt die Szenen aus, die die Geschichte tragen, überspringt Abspann und Vorschauen auf die nächste Folge, schreibt und vertont die Zusammenfassung und schneidet Ihr Filmmaterial darunter. |
| *„Generiere für den Anfang einen 5-Sekunden-Shot der Stadt im Morgengrauen.“* | Er bestätigt Anbieter, Modell und Kosten, erstellt einen Shot mit Ihrem Videoanbieter und platziert ihn auf der Timeline neben Ihrem Filmmaterial. |

### Schnitt

| Sie sagen … | Was passiert |
|---|---|
| *„Mach aus dieser einstündigen Bildschirmaufnahme drei 30-Sekunden-Highlight-Clips mit Untertiteln.“* | Eine Szenen- und Qualitätsanalyse findet die guten Stellen. Wiederholte Takes werden in eine Rangfolge gebracht, Stille und Füllwörter herausgeschnitten, und Untertitel werden anhand von gemessenem Wort-Timing eingebrannt. |
| *„Schneid die Pausen und die ‚Ähms‘ aus meiner Webcam-Aufnahme und mach sie straffer.“* | Er erkennt stille Lücken und Füllwörter, setzt einen deterministischen Jump Cut und hält für jeden entfernten Abschnitt die Belege fest. |
| *„Füg product-demo.mp4 ein englisches Voice-over und Untertitel hinzu und gleich die Lautheit an.“* | Er transkribiert das Video, übersetzt und vertont jede Zeile innerhalb ihres Bildfensters, mischt die Stimme über den vorhandenen Ton, brennt Untertitel ein und normalisiert die Lautheit. |
| *„Schneid diese 20 Clips von unserer Reise auf diesen Track, im Takt.“* | Er misst die Beats des Tracks, schneidet die Clips darauf und prüft in der ausgelieferten Datei, ob die Schnitte auf den Beats liegen. |

### Erklärvideos und Tutorials

| Sie sagen … | Was passiert |
|---|---|
| *„Mach ein 60-sekündiges Erklärvideo über Vektordatenbanken mit chinesischem Voice-over.“* | Er schreibt Motion-Graphics-Szenen, synthetisiert die Sprecherstimme mit Ihrem TTS-Anbieter und passt jede Zeile an ihre Szene an. |
| *„Mach aus meiner Bildschirmaufnahme der Einstellungsseite ein 90-sekündiges Tutorial.“* | Er kürzt die Aufnahme, markiert Schritt für Schritt jedes Bedienelement auf der echten Oberfläche und fügt Sprecherstimme und Untertitel hinzu. |

### Beliebte Videos nachbauen

| Sie sagen … | Was passiert |
|---|---|
| *„Bau Struktur und Tempo dieses viralen Videos für mein Produkt nach. Zeig mir zuerst den Plan.“* | Er zerlegt die Referenz, ordnet ihre Story-Beats Ihrem Material zu und wartet auf Ihre Freigabe, bevor er produziert. |
| *„Diese Anzeige eines Konkurrenten läuft gut. Mach unsere mit demselben Hook und Rhythmus, mit unseren Fotos.“* | Er übernimmt von der Referenz den Rhythmus aus Hook, Beleg und Call-to-Action, nicht ihren Inhalt. Jede Aussage stammt aus Ihren Produktfakten und jedes Bild aus Ihrem Material. |

Geben Sie Ihrem Agenten eine **Referenzvideodatei** und Ihre eigenen Produkt-Assets, Ihr Skript oder Ihr Filmmaterial. Ihr Agent kann mit OrkasVideoStudio **Erzählstruktur, visuellen Stil und Schnitttempo** der Referenz für die neuen Inhalte nachbilden:

1. **Die Referenz analysieren.** Stichproben-Frames und das relevante Audio prüfen, um Hook, Demonstration oder Beleg, Reihenfolge der Informationen, Typografie, Übergänge, Tempo und Call-to-Action zu erkennen.
2. **Die Adaption planen.** Festlegen, was erhalten bleibt und was ersetzt wird, und dann Momente der Referenz den neuen Szenen oder der Timeline zuordnen. Das Timing an Ihre tatsächliche Sprecherstimme und Lesezeit anpassen.
3. **Produzieren und überarbeiten.** Motion Graphics gestalten, Ihr Filmmaterial schneiden und bei Bedarf fehlendes Bildmaterial generieren. Lokal erstellte Texte, Untertitel, Sprecherstimmen und Clips bleiben einzeln bearbeitbar. Text, der fest in generiertes Filmmaterial eingebrannt ist, lässt sich nur ändern, indem man dieses Material ändert.

Am besten funktioniert das bei Erklärvideos mit Motion Graphics, SaaS- und App-Demos sowie Produktanzeigen aus vorhandenem Filmmaterial. Beginnen Sie mit einer Datei, die Ihr Agent lesen kann, denn das Herunterladen über Share-Links von Social-Media-Plattformen ist nicht integriert. Exakte Kamerabewegungen, schauspielerische Leistungen von Menschen und eine Übereinstimmung Bild für Bild sind nicht garantiert. Die Auslieferungsprüfungen bewerten nicht, wie genau das Ergebnis der Referenz entspricht. Details finden Sie im [Workflow zur Nachbildung von Referenzvideos](./packages/skills/video-craft/references/reference-recreation.md).

---

## Installation

**Voraussetzungen:** Node ≥ 22, `pnpm` sowie `ffmpeg` + `ffprobe` in Ihrem `PATH`. Das fest versionierte Paket [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` wird als Abhängigkeit installiert und rendert Seiten in Headless Chrome, sowohl für Prüfungen als auch für das Rendern; `npx` ist nur ein Kompatibilitäts-Fallback. Generierung ist optional und erfordert Ihre eigenen Schlüssel.

### Aus dem Quellcode (funktioniert schon heute)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### Über npm (sobald veröffentlicht)

Die npm-Pakete sind noch nicht veröffentlicht. Sobald sie es sind, funktioniert der Befehl `ovs` genauso:

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Steuerung aus Claude Code, Codex oder einem beliebigen Coding-Agenten

Die `ovs`-CLI ist die maßgebliche Schnittstelle, und die MCP-Tools spiegeln sie. Verwenden Sie die Variante, die Ihr Agent unterstützt:

**1) Native Skills (Claude Code / Codex).** Installieren Sie das Skill-Paket, damit der Agent es von selbst findet:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Dasselbe Skill-Paket ist auf [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) gelistet, sodass es sich auch mit `npx skills add orkas-ai/orkas-videostudio` installieren lässt. Die Skills rufen die `ovs`-CLI auf; installieren Sie diese also zuerst wie oben beschrieben.

**2) MCP-Tools.** Registrieren Sie den Server:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) Selbstbeschreibende CLI (jeder Agent mit Shell).** Kein Loader nötig:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Bitten Sie Ihren Agenten dann einfach um ein Video. Er liest zuerst `video-studio` und lädt die Referenzen zu Produktionsphasen und Handwerk, die er braucht.

---

## So funktioniert eine Produktion

Der Agent wählt einen kurzen Ordnernamen und legt alles darin ab:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

Die Reihenfolge der Szenen ist die Wiedergabereihenfolge. Startzeiten und Gesamtlänge werden aus den Szenen berechnet und nie gespeichert, sodass das Verschieben einer Szene das Timing nicht inkonsistent machen kann. Ein Preis steht einmal in `product.json`, und jede Szene, die ihn zeigt, liest ihn von dort. Für parallele Varianten, etwa andere Seitenverhältnisse, Sprachen oder A/B-Schnitte, fügt der Agent weitere Video-IDs hinzu, die dieselben Assets nutzen. Siehe den [Timeline-Vertrag](packages/skills/video-studio/references/timeline.md).

Ein typischer Ablauf:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` misst die finale Datei, bevor es sie erfasst: Dauer, Bildmaße, Audio, Lautheit und Abdeckung durch die Sprecherstimme. Untertitelwarnungen werden zur visuellen Bestätigung markiert, und es werden Frames aus der tatsächlichen MP4 zurückgegeben. Jede Auslieferung wird zu einer unveränderlichen Version. Ein Render, der vor der letzten Änderung entstanden ist, wird als veraltet abgelehnt, und frühere Auslieferungen werden nie überschrieben. Das Bestehen dieser Prüfungen bescheinigt keine visuelle Qualität. Die visuelle Prüfung gilt als `not_checked`, bis sich jemand die Frames tatsächlich ansieht.

Wenn Sie einen bestimmten verbleibenden Befund ausdrücklich akzeptieren, übergeben Sie genau dessen Code mit `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. Die Version hält diese Entscheidung fest, und jeder andere Fehler blockiert die Auslieferung weiterhin. Schreibvorgänge werden über `.ovs-timeline.lock` serialisiert; bleibt die Datei nach einem Absturz zurück, vergewissern Sie sich, dass der zugehörige Prozess beendet ist, bevor Sie sie entfernen. Der [Timeline-Vertrag](packages/skills/video-studio/references/timeline.md) behandelt beides.

**Überarbeitungen bleiben günstig und lokal.** Ein geändertes Wort, ein geänderter Schnitt, eine geänderte Reihenfolge, ein anderes Musikbett oder ein geänderter Untertitel wird direkt bearbeitet. Nur eine geänderte gesprochene Zeile wird neu vertont, und nur ein falscher Shot wird neu generiert, im Rahmen der bereits freigegebenen Ausgaben. Das Bearbeiten von Untertiteltext ändert das gesprochene Audio nicht. HyperFrames rendert jedes Mal das ganze Video; dieser portable Build speichert gerenderte Szenen nicht im Cache.

---

## Video-Arbeitsfläche im Browser

Wenn `timeline import`, `timeline prepare`, `timeline render` oder `timeline ship` erfolgreich ist (über die CLI oder MCP), öffnet OVS die Arbeitsfläche dieser Produktion in Ihrem Standardbrowser. Spätere Befehle verwenden denselben Tab wieder, statt neue zu öffnen. Die Arbeitsfläche bearbeitet dieselben Dateien wie CLI und MCP, sodass Änderungen in beide Richtungen fließen. Während der Agent arbeitet, ist sie nur zur Ansicht freigegeben.

Auf der Arbeitsfläche können Sie:

- **Ansehen und exportieren.** Das Video abspielen, zwischen ausgelieferten Versionen wechseln und die gewünschte herunterladen.
- **Material anordnen.** Filmmaterial hochladen, per Drag-and-drop ablegen oder einfügen und dann Karten auf dem Board verschieben und verbinden.
- **Szenen bearbeiten.** Wörter, Reihenfolge und Bilder ändern sowie Szenen hinzufügen, entfernen oder zurückholen.
- **Shots generieren und neu erstellen.** Aus einer Karte einen neuen Bild- oder Video-Shot erstellen oder einen vorhandenen Shot erneut generieren. Sie wählen Referenzen oder ersten und letzten Frame sowie Modell, Auflösung und Ton; Optionen, die ein Modell nicht unterstützen kann, sind deaktiviert. Durch frühere Ergebnisse blättern und das auswählen, das verwendet werden soll. Vor jeder kostenpflichtigen Anfrage wird nachgefragt.
- **Das Video aktualisieren.** Gewöhnliche Szenenänderungen werden lokal gerendert und ausgeliefert, mit Fortschrittsanzeige auf der Videokarte. Wird ein Produktfakt, eine Sprecherzeile oder die Stimme für das ganze Video geändert, entsteht eine Anfrage an Ihren Agenten, weil diese Änderungen sein Urteilsvermögen erfordern. Stoppt die Auslieferungsprüfung ein Update, weil Szenen Standbilder enthalten, bietet die Videokarte **Preview this version** (Vorschau dieser Version), **Return to editing** (Zurück zur Bearbeitung) oder **Update anyway** (Trotzdem aktualisieren) an; „Update anyway“ behält diesen Render, ohne erneut zu rendern.
- **Dem Agenten etwas mitteilen.** Eine kurze Anfrage zu einer Szene, einem Shot, einer Filmmaterial-Karte oder einem Video schreiben. Sie wird mit dem Kontext dieser Karte gesendet.

Die Arbeitsfläche öffnet sich auf Chinesisch. Die Sprachschaltfläche schaltet zwischen Chinesisch und Englisch um und merkt sich Ihre Wahl.

### Anfragen an Ihren Agenten zurücksenden

**Send** (Senden) stellt Anfragen nur der Unterhaltung zu, die die Produktion erstellt hat. Kann diese Unterhaltung die Anfrage nicht empfangen, bleibt der Entwurf auf der Arbeitsfläche. Nichts wird in die Zwischenablage kopiert, automatisch erneut gesendet oder an eine neue Sitzung geschickt. Bearbeiten, Aktualisieren und Exportieren funktionieren auch ohne verbundenen Agenten weiter.

- **Codex.** Läuft `ovs` innerhalb eines Codex-Threads, wird die Anfrage in genau diesen Thread eingereiht. Dafür ist Codex CLI 0.160.1 oder neuer mit laufendem lokalem App-Server erforderlich. Ein geschlossener oder nicht geladener Thread wird als nicht verfügbar angezeigt.
- **Claude Code.** Anfragen kommen über einen MCP-Channel an, eine Research Preview von Claude Code; eine gewöhnliche MCP-Verbindung reicht nicht aus. Registrieren Sie den Server mit `--claude-channel` und starten Sie Claude Code dann mit aktiviertem Channel:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Erstellen Sie das Video über die MCP-Tools von `ovs`, damit sich die Arbeitsfläche an diesen Channel gebunden öffnet. Eine aus der Shell-CLI geöffnete Arbeitsfläche kann Claude Code nicht erreichen. Claude Code zeigt beim Start eine Warnung zur lokalen Entwicklung an. Channels erfordern eine Anmeldung bei claude.ai oder einen Console-API-Schlüssel, und in den Tarifen Team und Enterprise muss ein Admin sie zuerst aktivieren. Siehe [Claude Code Channels](https://code.claude.com/docs/en/channels).

### Eine Produktion selbst öffnen

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Lassen Sie den Befehl laufen, während Sie die Arbeitsfläche nutzen. Mit `--agent` führt die Arbeitsfläche im Produktionsordner eine native Sitzung aus, die die Anmeldung, das Modell und die Berechtigungseinstellungen Ihrer CLI verwendet. Diese Sitzung erfordert Codex 0.160.1+ oder Claude Code 2.1.148+. Deren Berechtigungsabfragen und Rückfragen erscheinen auf der Arbeitsfläche. Dabei wird die für den Ordner gespeicherte Sitzung wiederhergestellt, es sei denn, Sie übergeben `--resume <session-id>`, um eine bestimmte Sitzung zu übernehmen, oder `--new-session`, um neu zu beginnen. Weitere Optionen:

- `--no-open` gibt den Zugangslink aus, ohne einen Browser zu öffnen.
- `--port` legt den Loopback-Port fest.
- `--recover` übernimmt eine Arbeitsfläche, deren vorheriger Besitzer beendet wurde.

Um das automatische Öffnen während der Produktionsarbeit abzuschalten, setzen Sie `OVS_STUDIO_AUTO_OPEN=0`. In CI ist es bereits abgeschaltet.

---

## Eigene Generierungsanbieter (BYO)

Konfigurieren Sie Anbieter in `~/.config/orkas-video-studio/config.json` (oder `$OVS_CONFIG_DIR/config.json`) oder über Umgebungsvariablen. Umgebungsvariablen haben Vorrang vor der Datei.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Fähigkeit | `provider`-Werte | Umgebungsvariablen |
|---|---|---|
| Sprachausgabe (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Bild (`ovs image`) | `openai` (jeder OpenAI-kompatible Endpunkt, einschließlich Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Sie können eine Konfiguration prüfen, ohne kostenpflichtige Aufrufe auszulösen:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Führen Sie `ovs narration fit` vor und nach der Synthese aus, damit jede Sprecherzeile innerhalb ihres Szenen- oder Planfensters bleibt. Die Videogenerierung nimmt explizite Referenzbilder, Seitenverhältnis, Dauer, Auflösung und Audio-Flags entgegen, sodass der Anbieteraufruf dem freigegebenen Plan entspricht. Bei `plan.json`-Projekten prüft `ovs plan validate` außerdem Seitenverhältnis, Dauer und Operation jedes Generierungssegments gegen den konfigurierten `video.provider`, bevor irgendetwas generiert wird.

Einige Anbieter brauchen ein paar zusätzliche Einstellungen:

- **Google Cloud Veo** verwendet `video.workspace_id`, `video.region` und ein API-Token oder Service-Account-JSON in `video.api_key`.
- **Alibaba** verwendet für die Sprachausgabe seinen Workspace-Endpunkt in `tts.base_url`. Wan-Video benötigt `video.workspace_id` und `video.region`.
- **Reine Klon-Stimmen** benötigen die Stimmen-ID, die Sie beim Anbieter registriert haben.
- **WebSocket-Sprachausgabe** läuft nur dann über `tts.proxy_url`, wenn Sie das konfigurieren.
- **Videoreferenzen** werden als öffentliche Bild- oder Video-URLs übergeben. Die unterstützte Anzahl und die Unterstützung für ersten/letzten Frame variieren je nach Modell.
- **[MuAPI](https://muapi.ai)** muss ausdrücklich mit `video.provider: "muapi"` ausgewählt werden. Ist es ausgewählt, hat `MUAPI_API_KEY` Vorrang vor `OVS_VIDEO_API_KEY`; der Schlüssel allein wählt MuAPI nie aus. `video.model` / `OVS_VIDEO_MODEL` unterstützt die validierten Kling-v2.1-Endpunkte `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` und `kling-v2.1-pro-i2v`. Andere Slugs werden abgelehnt, statt mit einem unpassenden Body gesendet zu werden. Text-to-Video verwendet standardmäßig `kling-v2.1-master-t2v`, und eine `image_url` als erster Frame verwendet standardmäßig `kling-v2.1-master-i2v`. Die Dauer beträgt 5 oder 10 Sekunden, das Seitenverhältnis ist `16:9`, `9:16` oder `1:1`. Die anbieterneutralen Eingaben `resolution`, `generate_audio` und `quality` bleiben mit signierten Plänen kompatibel: Kling ignoriert Auflösung und Audio, und die Qualität wird validiert, aber nicht gesendet. Optionen für Bearbeitung und zusätzliche Referenzen werden abgelehnt, bis ein passendes MuAPI-Schema unterstützt wird. Die Standard-Basis-URL enthält `/api/v1`, und eine benutzerdefinierte muss es ebenfalls enthalten. Den Submit-and-Poll-Vertrag und modellspezifische Parameter finden Sie in der [MuAPI-API-Referenz](https://muapi.ai/docs/api-reference).

Die Modellkataloge der Anbieter beschreiben den API-Vertrag des jeweiligen Anbieters. Sie garantieren weder die aktuelle Verfügbarkeit noch die Preise.

---

## Was die Generierung begrenzt

Der Agent verwendet Ihr vorhandenes Material überall dort, wo es für den Shot taugt, und generiert nur, was fehlt. Konfigurierte Zugangsdaten gelten nicht als Freigabe für Ausgaben. Vor jeder kostenpflichtigen Arbeit bestätigt der Agent Anbieter, Modell, Zweck, Anzahl der Anfragen einschließlich Wiederholungen und die geschätzten Kosten. Danach hält er sich an diesen Rahmen. Lehnen Sie ab, werden die kostenpflichtigen Aufrufe für diese Anfrage gestoppt, und ein misslungener Shot erhält höchstens zwei überarbeitete Versuche, bevor der Agent Sie bittet, die Herangehensweise zu ändern.

Jede kostenpflichtige Anfrage hinterlegt eine Quittung neben ihrem Ergebnis. Eine Videoaufgabe mit unbekanntem Ausgang blockiert eine weitere Übermittlung an dieselbe Ausgabe, bis Sie sie geprüft haben, und sie wird nie automatisch wiederholt. Siehe [Generierungsbefugnis](packages/skills/video-studio/references/generation.md).

`ovs speak` schreibt eine Quittung über Anfrage und Audio neben seine Ausgabe. Es verwendet nur eine exakt übereinstimmende Anfrage wieder, deren Audiobytes intakt sind; übergeben Sie daher die freigegebenen Werte für `--language`, Stimme, Modell, Geschwindigkeit und Format – ändern Sie einen davon, ist keine Wiederverwendung mehr möglich. Außerdem reserviert es die Ausgabe vor dem Absenden, was gleichzeitige doppelte Aufrufe verhindert.

Es gibt keinen gehosteten Musikdienst. Musik stammt aus lizenzierten Dateien, die Sie bereitstellen, und der Agent hält zu jeder Datei Quelle und Lizenz fest.

---

## Befehlsreferenz

Führen Sie `ovs <command> --help` aus, um die typisierten Eingaben jedes Befehls zu sehen. MCP-Tools verwenden dieselben Namen mit Unterstrichen, zum Beispiel `timeline_prepare` und `edit_trim_silence`.

| Bereich | Befehle |
|---|---|
| Einrichtung | `doctor`, `skills [--install]`, `skill <name>` |
| Produktion | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Schnitt (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analyse | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Sprecherstimme | `narration timing · fit`, `speech-capabilities`, `speak` |
| Generierung | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Ältere Projekte | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (Alias von `check`) |

Projekte, die mit den älteren Formaten erstellt wurden (EDL in `plan.json` und `composition-manifest.json`), funktionieren weiterhin über die Befehle unter „Ältere Projekte“. Neue Arbeiten verwenden die Szenen-Timeline. Bei einer zusammengesetzten `plan.json` prüfen Sie die fertige Datei ebenso wie das Filmmaterial, aus dem sie besteht:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

Das entsprechende MCP-Tool `plan_promise_check` akzeptiert `probe_produced` und `video`. Es misst Dauer, Bildmaße, Audio, integrierte Lautheit und die gesprochenen Abschnitte jeder Zeile. Fehlende Belege für die Sprecherstimme lassen die Prüfung scheitern, und Untertitelwarnungen erfordern eine visuelle Prüfung, wenn Untertitel eingebrannt wurden.

---

## Im Vergleich

### OrkasVideoStudio vs. Claude Motion vs. CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **Was es ist** | ein Open-Source-Videostudio, das Ihr Coding-Agent steuert | eine Animationsausgabe innerhalb von Claude | eine Videoschnitt-App von ByteDance |
| **Wer es nutzen kann** | alle; läuft auf Ihrem Rechner mit Claude Code, Codex, Cursor oder jedem Agenten, der eine Shell ausführt oder MCP spricht | Claude-Tarife Team und Enterprise (Beta) | Desktop-, Mobil- und Web-Apps, kostenlose und kostenpflichtige Stufen |
| **Wie Sie bearbeiten** | die Änderung Ihrem Agenten beschreiben oder Text, Bilder und Szenenreihenfolge auf der Arbeitsfläche im Browser ändern | im Editor von Claude oder indem Sie Claude darum bitten | von Hand auf einer Timeline |
| **Filmmaterial** | kürzen, zusammenfügen, auf 9:16 / 1:1 / 16:9 umformatieren, Stille und Füllwörter entfernen, im Takt schneiden | animiert Text, Diagramme, Formen und Bilder; kein generiertes Filmmaterial und keine generierten Personen | vollständiger manueller Schnitt |
| **Motion Graphics** | HTML/CSS-Szenen: kinetische Typografie, Preiskarten, Bauchbinden, Daten-Callouts, Übergänge | per Code gebaute Erklär-Animationen | Vorlagen, Textanimationen und Effekte |
| **Ton** | Sprecherstimme pro Szene, Musikbetten, die unter Sprache abgesenkt werden, Untertitel aus gemessenem Wort-Timing | im Hilfeartikel von Anthropic nicht behandelt | Tools für Stimme, Musik und Untertitel in der App |
| **Ausgabe** | MP4, vor der Auslieferung auf Dauer, Bildmaße, Lautheit und Sprecherstimme geprüft | MP4-Export | MP4-Export |
| **Quellcode** | MIT; jedes Video ist ein lokaler Ordner, der Ihnen gehört | proprietär, gehostet | proprietär |

Wählen Sie **CapCut** oder einen Open-Source-Timeline-Editor wie Shotcut oder Kdenlive, wenn Sie von Hand schneiden möchten. Wählen Sie **Claude Motion**, wenn Ihr Team bereits mit einem Team- oder Enterprise-Tarif in Claude arbeitet und Erklär-Animationen braucht. Wählen Sie **OrkasVideoStudio**, wenn Ihr Coding-Agent das ganze Video machen soll – Filmmaterial, Animation und Ton in einer Timeline – und Sie das Ergebnis als Dateien behalten möchten, die Sie prüfen, bearbeiten und neu rendern können. Die Angaben zu Claude Motion stammen aus dem [Hilfecenter von Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion) (Stand: November 2026).

### OrkasVideoStudio vs. Higgsfield

Higgsfield ist eine gehostete Plattform, die Zugang zu vielen Video- und Bildmodellen über ein einziges Konto verkauft – über ihre Web-App, eine API, einen MCP-Connector und eine CLI. OrkasVideoStudio hostet keine Modelle: Ihr Agent ruft die Anbieter auf, die Sie konfigurieren, und macht aus den Shots dann ein fertiges Video.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **Was es ist** | ein Open-Source-Videostudio, das Ihr Coding-Agent steuert | eine gehostete KI-Plattform für Bilder und Videos |
| **Videomodelle** | die Anbieter, die Sie konfigurieren, etwa Seedance 2.5, Kling 4.0, Veo 3.1 auf Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3 und Vidu Q3 | viele gehostete Modelle unter einem Konto, darunter Seedance 2.5, Kling 4.0, Veo 3.1 und MAGI-2, das nur Higgsfield anbietet |
| **Wie Sie bezahlen** | jeder Anbieter rechnet über Ihren eigenen Schlüssel ab; Schnitt, Motion Graphics, Untertitel und Transkription laufen lokal und brauchen keinen Schlüssel | Abo-Credits in der Web-App und im Connector oder sekundengenau abgerechnetes Guthaben über die API |
| **Was Sie bekommen** | eine geprüfte MP4, die generierte Shots mit Ihrem Filmmaterial, Motion Graphics, Sprecherstimme, Musik und Untertiteln kombiniert, dazu einen Produktionsordner, den Sie bearbeiten und neu rendern können | generierte Clips und Bilder sowie die eigenen Studio-Apps von Higgsfield |
| **Aus einem Coding-Agenten** | Skills, die `ovs`-CLI und ein MCP-Server für Claude Code, Codex, Cursor oder jeden anderen Agenten | der MCP-Connector, die CLI und die Skills von Higgsfield |
| **Quellcode** | MIT; jedes Video ist ein lokaler Ordner, der Ihnen gehört | proprietär, gehostet |

Wählen Sie **Higgsfield**, wenn Sie viele gehostete Modelle auf einer Rechnung möchten oder ein Modell, das nur dort angeboten wird, etwa MAGI-2. Wählen Sie **OrkasVideoStudio**, wenn Ihr Coding-Agent das ganze Video mit Ihren eigenen Anbieterschlüsseln machen soll und Sie das Ergebnis als Dateien behalten möchten. Beide lassen sich auch kombinieren: Clips, die Sie auf Higgsfield generieren, sind gewöhnliches Filmmaterial für eine OrkasVideoStudio-Produktion. Die Angaben zu Higgsfield stammen von [higgsfield.ai](https://higgsfield.ai/mcp) und der [MAGI-2-Seite](https://higgsfield.ai/magi-2-intro) (Stand: November 2026).

### OrkasVideoStudio vs. Frameworks, SaaS-Editoren und Wrapper

HyperFrames, ffmpeg und whisper.cpp sind hier **Abhängigkeiten**, keine Konkurrenten. OrkasVideoStudio ist die darauf aufsetzende Schicht, mit der Agenten arbeiten: das Wissen, die Auslieferungsprüfungen, die bearbeitbare Produktion und die Arbeitsfläche.

| | OrkasVideoStudio | Programmatische Frameworks (Remotion, Revideo) | KI-SaaS-Editoren (Descript, Opus Clip, Runway) | Dünne MCP-/ffmpeg-Wrapper |
|---|---|---|---|---|
| **Steuerung** | jeder Coding-Agent, in natürlicher Sprache (CLI + MCP) | Sie schreiben React/TS von Hand | GUI / gehostet | ein Agent, aber nur Tools |
| **Artefakt** | bearbeitbare Szenen-Timeline in einem lokalen Ordner, dazu eine Arbeitsfläche im Browser | Code (zum Rendern erneut ausführen) | Blackbox-Timeline / gehostetes Projekt | keins |
| **Umfang** | Schnitt von Filmmaterial + gestaltete Animation + Sprecherstimme + Generierung in einer Timeline | Komposition (programmatisch) | meist Bearbeiten *oder* Generieren, je nach Produkt | was das Tool eben bereitstellt |
| **Anleitung** | liefert „was ein gutes Video ausmacht“ als Skills, dazu deterministische Auslieferungsprüfungen | keine, Sie entscheiden | vom Produkt vorgegeben | keine |
| **Schlüssel / Hosting** | Kern ohne Schlüssel; **Ihre eigenen** Schlüssel für die Generierung; Local-First | Ihre eigene Infrastruktur | Schlüssel des Anbieters + gehostet, Lock-in | unterschiedlich |
| **Lizenz** | MIT | kann für Teams eine Firmenlizenz erfordern | proprietär | unterschiedlich |

Greifen Sie zu einem **Framework**, wenn Sie jeden Frame von Hand programmieren möchten, oder zu einem **SaaS-Editor**, wenn es Ihnen gerade auf GUI und Hosting ankommt. Greifen Sie zu **OrkasVideoStudio**, wenn Ihr *Agent* das Video machen soll, Sie das Ergebnis als Dateien behalten möchten, die Sie prüfen, bearbeiten und neu rendern können, und Sie mit Ihren eigenen Schlüsseln lokal bleiben wollen.

---

## Beziehung zu Orkas

OrkasVideoStudio entstand als integrierter **Video-Agent in [Orkas](https://orkas.ai?source=gh-orkas-vs)**, der Desktop-App mit KI-Team. Dort wurde es durchgängig erprobt und anschließend als agentenunabhängiges, MIT-lizenziertes Toolkit in dieses Repository ausgelagert.

- **Innerhalb von Orkas** wird es als [integrierter Agent](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) mitgeliefert, ohne separate Installation. Sie chatten mit ihm in einer Desktop-App statt in einem Terminal, und die Generierung kann über die integrierten Modelle von Orkas (neue Konten erhalten 500 kostenlose Credits) oder über Ihre eigenen Schlüssel laufen. [Orkas herunterladen](https://orkas.ai/download/?source=gh-orkas-vs) – für macOS oder Windows.
- **Überall sonst** installieren Sie es wie oben beschrieben in Ihren eigenen Coding-Agenten und erhalten über die `ovs`-CLI, den MCP-Server und die Arbeitsfläche dieselben Kernfunktionen. Funktionen des Orkas-Kontos wie gehostete Anbieter, Credits und das Veröffentlichen aus dem Chat sind nicht Teil dieses Repositorys.

Links: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[dieses Repository](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Pakete

| Paket | Inhalt |
|---|---|
| `@orkas/video-studio-core` | Schemas für Szenen-Timeline und ältere EDL, Auslieferungsprüfungen, Entscheidungshilfen, Timing der Sprecherstimme, Laufzeit und Konfiguration |
| `@orkas/video-studio-tools` | Backends für Timeline, Rendern, Schnitt, Analyse, Sprachausgabe, Bild und Video, dazu die Arbeitsfläche im Browser |
| `@orkas/video-studio` | die `ovs`-CLI |
| `@orkas/video-studio-mcp` | der MCP-Server (`ovs-mcp`), der die CLI spiegelt |
| `@orkas/video-studio-skills` | das hostunabhängige `SKILL.md`-Wissenspaket |

Der technische Plan und seine Historie stehen in [`PLAN.md`](./PLAN.md). Hinweise für Coding-Agenten, die an diesem Repository arbeiten, finden Sie in [`AGENTS.md`](./AGENTS.md).

---

## Entwicklung

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

`pnpm install` wendet den versionierten HyperFrames-Patch in [`patches/`](./patches/) an, der dafür sorgt, dass SDR-Ausgaben in H.264/H.265 die BT.709-Matrix verwenden, die ihre Metadaten angeben. Ein externes `OVS_HYPERFRAMES_BIN` oder der `npx`-Kompatibilitäts-Fallback erhält diesen Patch nicht; diese Laufzeit muss daher eine gleichwertige Farbkorrektur enthalten.

`test:video` verbraucht nie Credits bei Anbietern. Ein lokaler, simulierter Seedance-Endpunkt liefert eine echte H.264-Fixture zurück, die OVS herunterlädt und mit `ffprobe` verifiziert.

`test:video:e2e` deckt beide Produktionspfade über die gebaute CLI ab:

- **Der ältere Kompositionspfad.** Der Test erstellt eine neunsekündige 1080p-Produktion mit drei Szenen, mit composition prepare/reconcile, Snapshot, dem vollständigen Draft-Gate, dem Einbrennen von Untertiteln und Promise-Checks an der finalen Datei. Er dekodiert die gesamte MP4 und prüft Szenenreihenfolge, sichtbare Bewegung, hörbares Audio in jeder Szene und eingebrannte Untertitelpixel sowie, dass eine falsche Auslieferungsdauer abgelehnt wird.
- **Die aktuelle Szenen-Timeline.** Der Test rendert eine Timeline mit drei Szenen über den echten Check- und Snapshot-Pfad von HyperFrames. Er prüft Szenenfarben, gestaltete Bewegung, dekodierte Bewegung im Quellvideo, Untertitelpixel, Audio, unveränderliche Auslieferung und die Ablehnung veralteter Renders.

Außerdem werden die gebauten CLI- und MCP-Oberflächen durchgespielt. Beide Videobefehle schlagen mit einer Fehlermeldung samt Lösungshinweis fehl, wenn eine benötigte Laufzeit fehlt. Die gewöhnliche Testsuite kann laufzeitintensive Fälle auf Rechnern ohne ffmpeg oder Browser überspringen.

`pnpm verify` muss auf dem finalen Kandidaten bestehen, bevor ein Git-Commit oder PR erfolgt. Es umfasst den echten Produktionsfall und ist zugleich der CI-Einstiegspunkt; für reine Teständerungen gilt dieselbe Regel. Bewahren Sie für Sync- oder Release-Reviews das erzeugte Video, die Vorschauen, die finalen Frames und die Berichte auf und prüfen Sie sie:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

Das Belegverzeichnis muss ausdrücklich aktiviert werden, und jeder Lauf verwendet ein eigenes Unterverzeichnis. Gewöhnliche CI-Läufe räumen ihre temporären Medien auf. Fixtures verwenden originales HTML/SVG und lokal erzeugtes Instrumental-Audio. Sie rufen keine kostenpflichtigen Anbieter auf und erheben keinen Anspruch, die TTS- oder Modellqualität abzudecken.

`pnpm benchmark` braucht keine Schlüssel und ist deterministisch. Es baut das Core-Paket, verifiziert die Benchmark-Fixtures und misst dann Gate-Übergänge, EDL-Validierung und Auslieferungszusammenfassungen, die Validierung von Composition-Manifests und die Schätzung der Sprechdauer. Jede Suite hat eine bewusst konservative Untergrenze für den Durchsatz, sodass große Regressionen fehlschlagen, normale Schwankungen zwischen Rechnern aber nicht.

## Versionen

Alle Pakete teilen sich eine Kalenderversion, `YYYY.M.D` (Datum in der Zeitzone Asia/Shanghai, ohne führende Nullen). Getaggte Releases verwenden `v<version>` und werden als [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) veröffentlicht; eine veröffentlichte Datumsversion wird nie überschrieben. Änderungen sind in [CHANGELOG.md](CHANGELOG.md) aufgeführt. Diese Version ist unabhängig von der Orkas-Desktop-App und den Versionen ihrer Marketplace-Agenten.

## Lizenz

MIT – siehe [`LICENSE`](./LICENSE). Das Rendern nutzt die Apache-2.0-lizenzierte Abhängigkeit [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`. Schnitt und Medienprüfungen verwenden das `ffmpeg` Ihres Systems, und die Transkription wird an HyperFrames / whisper.cpp delegiert. [`PLAN.md`](./PLAN.md) erklärt, wie Laufzeiten von Drittanbietern gefunden werden, und enthält die Lizenzhinweise.
