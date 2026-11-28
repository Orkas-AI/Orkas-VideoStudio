# OrkasVideoStudio

> OrkasVideoStudio est un éditeur vidéo IA open source qui transforme votre agent de codage en studio vidéo. Demandez une vidéo finie à Claude Code, Codex, Cursor ou à n'importe quel agent capable d'exécuter un shell ou de parler MCP. Il monte vos séquences, conçoit le motion design, ajoute narration, musique et sous-titres, génère les plans manquants avec vos propres clés et livre un MP4 vérifié. Vous pouvez ensuite continuer à modifier ce MP4 dans un canevas ouvert dans le navigateur.

**Une alternative open source à Claude Motion, CapCut et Higgsfield, pilotée par l'agent de codage que vous utilisez déjà.** Sous licence MIT et conçue pour privilégier le local, sans offre Claude Team ou Enterprise ni abonnement à une plateforme vidéo : les plans générés proviennent de Seedance, Kling, Veo et d'autres modèles vidéo, avec vos propres clés. [Comparaison ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Vous préférez une application à un agent de codage ?** OrkasVideoStudio est aussi l'agent vidéo intégré d'**[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, l'application de bureau gratuite avec une équipe IA, pour macOS et Windows. Décrivez la vidéo dans la conversation ; la génération s'appuie sur les modèles intégrés d'Orkas (les nouveaux comptes reçoivent 500 crédits gratuits) ou sur vos propres clés. **[Télécharger Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Comment les deux s'articulent ↓](#relation-avec-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*Le tour d'horizon de 54 secondes ci-dessus montre comment un seul brief devient une vidéo finie : monter de vraies séquences, concevoir le motion design, ajouter voix, musique et sous-titres, explorer des plans dans un canevas, puis changer les mots, remplacer des plans ou réordonner les scènes.*

OrkasVideoStudio n'est **pas un agent vidéo boîte noire**. C'est votre agent qui réfléchit. Ce projet lui fournit les éléments qu'il ne peut pas improviser :

- **Savoir-faire vidéo.** Un pack `SKILL.md` indépendant de l'hôte, avec `video-studio` comme skill d'entrée. Il indique quand poser une question et quand continuer, en quoi diffèrent publicités, vidéos explicatives, démos produit, montages sur musique, vidéos avec présentateur, courts métrages et vidéos de commentaire, et comment vérifier un montage avant de le déclarer terminé.
- **Des outils déterministes.** La CLI `ovs` et un serveur MCP qui en est le miroir. Ils couvrent la timeline de production, le montage avec ffmpeg, la transcription, l'analyse des séquences et la génération via vos propres comptes de fournisseurs. [HyperFrames](https://github.com/heygen-com/hyperframes) se charge du rendu des pages et de la capture des images ; `ffmpeg`, du montage et des mesures.
- **Une production modifiable.** Chaque vidéo est un simple dossier : une timeline de scènes (`videos/main/manifest.json`), un registre des ressources, des données produit sourcées et, en option, une page conçue. Vous, votre agent et le canevas du navigateur modifiez tous les mêmes fichiers. Changez une ligne de texte, remplacez une image ou réordonnez les scènes, puis relancez le rendu.

Le montage, le motion design, les sous-titres et la transcription ne nécessitent **aucune clé API**. La génération d'images, de vidéos et de parole est facultative, s'active explicitement et utilise **vos propres** comptes de fournisseurs. Il n'y a ni backend hébergé ni compte à créer.

---

## Ce que vous pouvez demander

Vous demandez une fois et obtenez une vidéo finie. L'agent combine dans une seule timeline tout ce dont la demande a besoin :

| Capacité | Ce que cela couvre |
|---|---|
| **Monter de vraies séquences** | Couper, assembler, recadrer en 9:16 / 1:1 / 16:9, conserver ou mixer le son des clips, superposer, incruster des sous-titres et normaliser l'intensité sonore. Pour les longs enregistrements, il peut aussi repérer les meilleurs moments, classer les prises répétées et supprimer les silences ou les mots de remplissage, en consignant les preuves de chaque coupe. |
| **Animation conçue** | Des scènes construites en HTML/CSS avec animation : typographie cinétique, cartes de prix, bandeaux, encarts de données et transitions. Les mots modifiables se trouvent dans des emplacements de texte nommés : changer le texte n'oblige donc jamais à reconstruire une scène. |
| **Son et sous-titres** | Une narration pour chaque scène, ajustée à sa durée. Des fonds musicaux sous licence qui s'atténuent sous la voix. Des sous-titres tirés du texte de narration ou du minutage mesuré des mots. Des coupes calées sur les temps de la musique. |
| **Plans générés** | Images, clips vidéo et présentateurs générés (face caméra) par le fournisseur que vous avez configuré, pour les plans que vos contenus ne peuvent pas montrer. Ils ne sont créés que dans la limite des dépenses que vous approuvez. |

Pour un script ou un storyboard, l'agent s'arrête au document. Pour une vidéo finie, il va jusqu'à la livraison. Il ne vous montre un plan de production ou un aperçu que si vous l'avez demandé, ou si la vidéo dure plus de deux minutes environ. Un script qu'il rédige pour que la vidéo le suive mot pour mot vous est d'abord soumis ; un script que vous lui fournissez est réalisé tel quel.

---

## Du motion design dans Claude Code, sans offre Team

Claude Motion, la fonctionnalité d'animation d'Anthropic, est en bêta et réservée aux offres Claude Team et Enterprise. OrkasVideoStudio apporte à Claude Code le même type de motion design construit en code avec une offre Pro, Max ou Ultra, ou une clé API : l'agent écrit chaque scène en HTML et CSS avec animation, inspecte un échantillon d'images et effectue le rendu d'un MP4 sur votre machine ; le rendu lui-même ne consomme donc aucun token.

1. [Installez](#installation) OrkasVideoStudio et exécutez `ovs skills --install --target claude` (ou `--target codex` pour Codex).
2. Demandez la vidéo, par exemple : *« Fais une vidéo de motion design de 20 secondes en 16:9 pour le lancement de notre application : une ouverture en typographie cinétique avec le nom du produit, trois cartes de fonctionnalités qui glissent à l'écran et une carte de clôture avec le prix. Montre-moi une image fixe de chaque scène avant de lancer le rendu. »*
3. Changez vous-même un mot, une couleur ou le minutage dans les fichiers de scène ou dans le canevas, ou demandez-le à l'agent, puis relancez le rendu.

Contrairement à Claude Motion, la même timeline peut aussi accueillir vos propres séquences, votre narration, votre musique et vos sous-titres. Voir [la comparaison](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Cas d'usage

Chaque ligne est un prompt que vous pourriez donner à votre agent. Le skill `video-studio` choisit les outils.

### Publicité et marketing

| Vous dites… | Ce qui se passe |
|---|---|
| *« Fais une pub verticale de 20 secondes pour cette lampe de bureau à partir de ces photos et de la page produit. »* | Il importe les photos, enregistre le prix et les caractéristiques comme données sourcées, conçoit les scènes d'accroche, de fonctionnalités et de prix, ajoute narration et sous-titres, puis vérifie, effectue le rendu et livre. |
| *« Fais une vidéo de lancement de 30 secondes pour notre application à partir de son site web. »* | Il capture les vraies pages produit dans votre navigateur, reprend les formulations et les écrans du produit lui-même, et construit les scènes autour d'eux plutôt qu'autour de maquettes redessinées. |
| *« Fais une vidéo de 30 secondes où un présentateur généré présente ce sérum. »* | Il écrit d'abord le monologue, crée une image clé d'un présentateur fictif et la réutilise dans chaque clip, génère les clips parlés avec votre fournisseur vidéo, et garde prix et allégations sous forme de texte modifiable à l'écran. |
| *« Fais une promo 9:16 de 15 s à partir de ce script : génère l'ouverture, compose les encarts de fonctionnalités, une seule voix off. »* | Une seule timeline réunit l'ouverture générée, les scènes de fonctionnalités conçues et une piste de narration unique, et le fichier final est vérifié avant la livraison. |

### Cinéma et fiction

| Vous dites… | Ce qui se passe |
|---|---|
| *« Fais un court métrage d'une minute sur une infirmière de nuit, avec les deux mêmes personnages dans chaque plan. »* | Il construit l'histoire autour d'une seule question dramatique, conserve pour chaque personnage une description d'apparence et une image clé afin qu'ils restent cohérents d'un plan à l'autre, et génère les plans avec votre fournisseur vidéo dans la limite du budget que vous approuvez. |
| *« Transforme ces trois épisodes de série en un résumé narré de 3 minutes. »* | Il transcrit les épisodes, choisit les scènes qui portent l'histoire, ignore les génériques et les aperçus de l'épisode suivant, rédige le résumé et le met en voix, puis monte vos séquences dessous. |
| *« Génère un plan de 5 s de la ville à l'aube pour l'ouverture. »* | Il confirme le fournisseur, le modèle et le coût, crée un plan avec votre fournisseur vidéo et le place sur la timeline à côté de vos séquences. |

### Montage

| Vous dites… | Ce qui se passe |
|---|---|
| *« Transforme cet enregistrement d'écran d'une heure en trois extraits de 30 s des meilleurs moments, avec sous-titres. »* | L'analyse des scènes et de la qualité repère les bons passages. Les prises répétées sont classées, les silences et les mots de remplissage coupés, et les sous-titres incrustés d'après le minutage mesuré des mots. |
| *« Enlève les silences et les “euh” de ma prise webcam et resserre-la. »* | Il détecte les blancs et les mots de remplissage, réalise un jump cut déterministe et consigne les preuves pour chaque passage supprimé. |
| *« Ajoute une voix off anglaise et des sous-titres à product-demo.mp4 et harmonise l'intensité sonore. »* | Il transcrit la vidéo, traduit et met en voix chaque réplique dans la fenêtre de son image, mixe la voix par-dessus le son existant, incruste les sous-titres et normalise l'intensité sonore. |
| *« Monte ces 20 clips de notre voyage sur ce morceau, en rythme. »* | Il mesure les temps du morceau, y cale les coupes des clips et vérifie l'alignement sur les temps dans le fichier livré. |

### Vidéos explicatives et tutoriels

| Vous dites… | Ce qui se passe |
|---|---|
| *« Fais une vidéo explicative de 60 s sur les bases de données vectorielles, avec une voix off en chinois. »* | Il écrit des scènes de motion design, synthétise la narration avec votre fournisseur TTS et ajuste chaque réplique à sa scène. |
| *« Transforme mon enregistrement d'écran de la page des paramètres en tutoriel de 90 secondes. »* | Il coupe l'enregistrement, signale chaque élément de la vraie interface, étape par étape, et ajoute narration et sous-titres. |

### Recréer des vidéos populaires

| Vous dites… | Ce qui se passe |
|---|---|
| *« Reprends la structure et le rythme de cette vidéo virale pour mon produit. Montre-moi d'abord le plan de production. »* | Il décompose la référence, fait correspondre ses temps forts à vos contenus et attend votre accord avant de produire. |
| *« Cette pub d'un concurrent marche bien. Fais la nôtre avec la même accroche et le même rythme, en utilisant nos photos. »* | Il reprend le rythme accroche, preuve, appel à l'action de la référence, pas son contenu. Chaque allégation vient de vos données produit et chaque image de vos contenus. |

Donnez à votre agent un **fichier vidéo de référence** et vos propres ressources produit, votre script ou vos séquences. Votre agent peut utiliser OrkasVideoStudio pour en recréer la **structure narrative, le style visuel et le rythme de montage** avec le nouveau contenu :

1. **Analyser la référence.** Inspecter un échantillon d'images et l'audio pertinent pour identifier l'accroche, la démonstration ou la preuve, l'ordre des informations, la typographie, les transitions, le rythme et l'appel à l'action.
2. **Planifier l'adaptation.** Indiquer ce qu'il faut garder et ce qu'il faut remplacer, puis faire correspondre les moments de la référence aux nouvelles scènes ou à la timeline. Adapter le minutage à votre narration réelle et au temps de lecture.
3. **Produire et réviser.** Composer le motion design, monter vos séquences et générer les visuels manquants si nécessaire. Les textes, sous-titres, narrations et clips créés localement restent modifiables séparément. Le texte incrusté dans des séquences générées ne peut être modifié qu'en changeant ces séquences.

Cela fonctionne au mieux pour les vidéos explicatives en motion design, les démos de SaaS et d'applications, et les publicités produit construites à partir de séquences existantes. Commencez par un fichier que votre agent peut lire, car le téléchargement à partir de liens de partage des réseaux sociaux n'est pas intégré. Les mouvements de caméra exacts, le jeu des personnes à l'écran et la correspondance image par image ne sont pas garantis. Les contrôles de livraison n'évaluent pas à quel point le résultat se rapproche de la référence. Pour plus de détails, consultez le [processus de recréation à partir d'une référence](./packages/skills/video-craft/references/reference-recreation.md).

---

## Installation

**Prérequis :** Node ≥ 22, `pnpm`, ainsi que `ffmpeg` + `ffprobe` dans votre `PATH`. Le paquet [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, à version figée, est installé comme dépendance et effectue le rendu des pages dans Chrome headless, pour les contrôles comme pour le rendu ; `npx` n'est qu'une solution de repli pour la compatibilité. La génération est facultative et nécessite vos propres clés.

### Depuis les sources

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

Les paquets npm ne sont pas encore publiés ; pour l'instant, installez donc depuis les sources.

---

## Piloter depuis Claude Code, Codex ou n'importe quel agent de codage

La CLI `ovs` est l'interface de référence, et les outils MCP en sont le miroir. Utilisez l'option que votre agent prend en charge :

**1) Skills natifs (Claude Code / Codex).** Installez le pack de skills pour que l'agent le trouve de lui-même :

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

Le même pack de skills est référencé sur [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio) : `npx skills add orkas-ai/orkas-videostudio` permet donc aussi de l'installer. Les skills appellent la CLI `ovs` ; installez-la donc d'abord comme décrit ci-dessus.

**2) Outils MCP.** Enregistrez le serveur :

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) CLI autodescriptive (tout agent disposant d'un shell).** Aucun chargeur nécessaire :

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Ensuite, demandez simplement une vidéo à votre agent. Il lit d'abord `video-studio`, puis charge les références d'étape et de métier dont il a besoin.

---

## Déroulement d'une production

L'agent choisit un nom de dossier court et y conserve tout :

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

L'ordre des scènes est l'ordre de lecture. Les instants de début et la durée totale sont calculés à partir des scènes et ne sont jamais stockés : déplacer une scène ne peut donc pas rendre le minutage incohérent. Un prix figure une seule fois dans `product.json`, et chaque scène qui l'affiche le lit à partir de là. Pour des variantes parallèles, comme d'autres rapports d'aspect, d'autres langues ou des versions A/B, l'agent ajoute d'autres identifiants vidéo qui partagent les mêmes ressources. Voir le [contrat de la timeline](packages/skills/video-studio/references/timeline.md).

Un déroulement typique :

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` mesure le fichier final avant de l'enregistrer : durée, dimensions d'image, audio, intensité sonore et couverture de la narration. Les avertissements de sous-titres sont signalés pour confirmation visuelle, et des images du MP4 réel sont renvoyées. Chaque livraison devient une version immuable. Un rendu effectué avant la dernière modification est rejeté comme périmé, et les livraisons antérieures ne sont jamais écrasées. Réussir ces contrôles ne certifie pas la qualité visuelle. La revue visuelle reste `not_checked` tant que personne n'a réellement regardé les images.

Lorsque vous acceptez explicitement un constat précis encore ouvert, passez son code exact avec `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. La version consigne cette décision, et toute autre erreur continue de bloquer la livraison. Les écritures sont sérialisées avec `.ovs-timeline.lock` ; si un plantage laisse ce fichier derrière lui, vérifiez que le processus qui le détient est arrêté avant de le supprimer. Le [contrat de la timeline](packages/skills/video-studio/references/timeline.md) couvre ces deux points.

**Les révisions restent peu coûteuses et locales.** Un changement de mot, de coupe, d'ordre, de fond musical ou de sous-titre est appliqué sur place. Seule une réplique parlée modifiée est remise en voix, et seul un plan erroné est régénéré, dans la limite des dépenses déjà approuvées. Modifier le texte des sous-titres ne change pas l'audio parlé. HyperFrames effectue à chaque fois le rendu de toute la vidéo ; cette version portable ne met pas en cache les scènes rendues.

---

## Canevas vidéo dans le navigateur

Lorsque `timeline import`, `timeline prepare`, `timeline render` ou `timeline ship` réussit (depuis la CLI ou MCP), OVS ouvre le canevas de cette production dans votre navigateur par défaut. Les commandes suivantes réutilisent le même onglet au lieu d'en ouvrir de nouveaux. Le canevas modifie les mêmes fichiers que la CLI et MCP, si bien que les changements circulent dans les deux sens. Il passe en lecture seule pendant que l'agent travaille.

Dans le canevas, vous pouvez :

- **Regarder et exporter.** Lire la vidéo, passer d'une version livrée à l'autre et télécharger celle que vous voulez.
- **Organiser les contenus.** Importer, déposer ou coller des séquences, puis déplacer et relier des cartes sur le tableau.
- **Modifier les scènes.** Changer les mots, l'ordre et les images, et ajouter, supprimer ou remettre des scènes.
- **Générer et refaire des plans.** Créer un nouveau plan image ou vidéo à partir d'une carte, ou régénérer un plan existant. Vous choisissez des références ou une première et une dernière image, ainsi que le modèle, la résolution et le son ; les options qu'un modèle ne peut pas prendre en charge sont désactivées. Parcourir les résultats précédents et choisir celui à utiliser. Le canevas demande votre accord avant chaque requête payante.
- **Mettre à jour la vidéo.** Les modifications de scène ordinaires sont rendues et livrées localement, avec la progression affichée sur la carte vidéo. Modifier une donnée produit, une réplique de narration ou la voix de toute la vidéo crée une demande pour votre agent, car ces modifications exigent son jugement. Si le contrôle de livraison arrête une mise à jour parce que des scènes contiennent des images fixes, la carte vidéo propose **Preview this version** (Aperçu de cette version), **Return to editing** (Revenir au montage) ou **Update anyway** (Mettre à jour quand même) ; « Update anyway » conserve ce rendu sans relancer de rendu.
- **S'adresser à l'agent.** Écrire une courte demande concernant une scène, un plan, une carte de séquence ou une vidéo. Elle est envoyée avec le contexte de cette carte.

Le canevas s'ouvre en chinois. Son bouton de langue bascule entre le chinois et l'anglais et mémorise votre choix.

### Renvoyer des demandes à votre agent

**Send** (Envoyer) ne transmet la demande qu'à la conversation qui a créé la production. Si cette conversation ne peut pas recevoir la demande, le brouillon reste dans le canevas. Rien n'est copié dans le presse-papiers, rejoué automatiquement ni envoyé à une nouvelle session. La modification, la mise à jour et l'export continuent de fonctionner sans agent connecté.

- **Codex.** Quand `ovs` s'exécute dans un fil Codex, la demande est mise en file d'attente dans ce même fil. Cela nécessite Codex CLI 0.160.1 ou une version plus récente, avec son serveur d'application local en cours d'exécution. Un fil fermé ou non chargé apparaît comme indisponible.
- **Claude Code.** Les demandes arrivent par un canal MCP, une fonctionnalité de Claude Code en research preview ; une connexion MCP ordinaire ne suffit pas. Enregistrez le serveur avec `--claude-channel`, puis démarrez Claude Code avec le canal activé :

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Créez la vidéo au moyen des outils MCP `ovs` pour que le canevas s'ouvre lié à ce canal. Un canevas ouvert depuis la CLI dans le shell ne peut pas joindre Claude Code. Claude Code affiche un avertissement de développement local au démarrage. Les canaux nécessitent une connexion claude.ai ou une clé API Console, et sur les offres Team et Enterprise, un administrateur doit d'abord les activer. Voir [les canaux de Claude Code](https://code.claude.com/docs/en/channels).

### Ouvrir une production vous-même

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Laissez la commande s'exécuter pendant que vous utilisez le canevas. Avec `--agent`, le canevas lance dans le dossier de production une session native qui utilise la connexion, le modèle et les paramètres d'autorisation propres à votre CLI. Cette session nécessite Codex 0.160.1+ ou Claude Code 2.1.148+. Ses demandes d'autorisation et ses questions s'affichent dans le canevas. La session enregistrée pour le dossier est restaurée, sauf si vous passez `--resume <session-id>` pour reprendre une session précise ou `--new-session` pour repartir de zéro. Autres options :

- `--no-open` affiche le lien d'accès sans ouvrir de navigateur.
- `--port` choisit le port de loopback.
- `--recover` récupère un canevas dont le propriétaire précédent s'est arrêté.

Pour désactiver l'ouverture automatique pendant le travail de production, définissez `OVS_STUDIO_AUTO_OPEN=0`. Elle est déjà désactivée en CI.

---

## Fournisseurs de génération : vos propres clés (BYO)

Configurez les fournisseurs dans `~/.config/orkas-video-studio/config.json` (ou `$OVS_CONFIG_DIR/config.json`) ou avec des variables d'environnement. Les variables d'environnement l'emportent sur le fichier.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Capacité | Valeurs de `provider` | Environnement |
|---|---|---|
| Synthèse vocale (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Image (`ovs image`) | `openai` (tout point de terminaison compatible OpenAI, y compris Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Vidéo (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Vous pouvez inspecter une configuration sans effectuer le moindre appel payant :

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Exécutez `ovs narration fit` avant et après la synthèse pour que chaque réplique de narration reste dans la fenêtre prévue par sa scène ou par le plan de production. La génération vidéo prend en entrée des images de référence, un rapport d'aspect, une durée, une résolution et des options audio explicites, de sorte que l'appel au fournisseur corresponde au plan de production approuvé. Pour les projets `plan.json`, `ovs plan validate` vérifie aussi le rapport d'aspect, la durée et l'opération de chaque segment de génération par rapport au `video.provider` configuré, avant toute génération.

Certains fournisseurs nécessitent quelques réglages supplémentaires :

- **Google Cloud Veo** utilise `video.workspace_id`, `video.region` et un jeton d'API ou un JSON de compte de service dans `video.api_key`.
- **Alibaba** utilise, pour la synthèse vocale, son point de terminaison d'espace de travail dans `tts.base_url`. La vidéo Wan nécessite `video.workspace_id` et `video.region`.
- Les **voix uniquement clonées** nécessitent l'identifiant de voix que vous avez enregistré auprès du fournisseur.
- La **synthèse vocale via WebSocket** ne passe par `tts.proxy_url` que si vous le configurez.
- Les **références vidéo** sont transmises sous forme d'URL publiques d'images ou de vidéos. Le nombre pris en charge et la prise en charge de la première/dernière image varient selon le modèle.
- **[MuAPI](https://muapi.ai)** doit être sélectionné explicitement avec `video.provider: "muapi"`. Lorsqu'il est sélectionné, `MUAPI_API_KEY` a priorité sur `OVS_VIDEO_API_KEY` ; la clé ne sélectionne jamais MuAPI à elle seule. `video.model` / `OVS_VIDEO_MODEL` prend en charge les points de terminaison Kling v2.1 validés `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` et `kling-v2.1-pro-i2v`. Les autres slugs sont rejetés plutôt qu'envoyés avec un corps de requête inadapté. Le texte-vers-vidéo utilise par défaut `kling-v2.1-master-t2v`, et une `image_url` de première image utilise par défaut `kling-v2.1-master-i2v`. La durée est de 5 ou 10 secondes et le rapport d'aspect est `16:9`, `9:16` ou `1:1`. Les entrées indépendantes du fournisseur `resolution`, `generate_audio` et `quality` restent compatibles avec les plans de production signés : Kling ignore la résolution et l'audio, et la qualité est validée mais pas envoyée. Les options de modification et de références supplémentaires sont rejetées tant qu'un schéma MuAPI correspondant n'est pas pris en charge. L'URL de base par défaut inclut `/api/v1`, et une URL personnalisée doit l'inclure aussi. Consultez la [référence de l'API MuAPI](https://muapi.ai/docs/api-reference) pour le contrat de soumission et d'interrogation (submit-and-poll) et les paramètres propres à chaque modèle.

Les catalogues de modèles des fournisseurs décrivent le contrat d'API de chaque fournisseur. Ils ne garantissent ni la disponibilité en temps réel ni les tarifs.

---

## Ce qui encadre la génération

L'agent utilise vos contenus existants partout où ils conviennent à l'image voulue, et ne génère que ce qui manque. Le fait d'avoir configuré des identifiants ne vaut pas accord pour dépenser. Avant tout travail payant, l'agent confirme le fournisseur, le modèle, l'objectif, le nombre de requêtes, nouvelles tentatives comprises, et le coût estimé. Il s'en tient ensuite à ce périmètre. Un refus arrête les appels payants pour cette demande, et un plan raté a droit à deux prises révisées au maximum avant que l'agent vous demande de changer d'approche.

Chaque requête payante conserve un reçu à côté de son résultat. Une tâche vidéo dont l'issue est inconnue bloque toute nouvelle soumission vers la même sortie tant que vous ne l'avez pas inspectée, et elle n'est jamais relancée automatiquement. Voir [autorisation de génération](packages/skills/video-studio/references/generation.md).

`ovs speak` écrit un reçu de requête et d'audio à côté de sa sortie. Il ne réutilise qu'une requête exactement identique dont les octets audio sont intacts ; passez donc les valeurs approuvées de `--language`, de voix, de modèle, de vitesse et de format : changer l'une d'elles invalide la réutilisation. Il réserve aussi la sortie avant l'envoi, ce qui empêche les appels en double simultanés.

Il n'existe aucun service de musique hébergé. La musique provient de fichiers sous licence que vous fournissez, et l'agent consigne la source et la licence de chaque fichier.

---

## Référence des commandes

Exécutez `ovs <command> --help` pour connaître les entrées typées de chaque commande. Les outils MCP portent les mêmes noms avec des tirets bas, par exemple `timeline_prepare` et `edit_trim_silence`.

| Domaine | Commandes |
|---|---|
| Configuration | `doctor`, `skills [--install]`, `skill <name>` |
| Production | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Montage (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Analyse | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narration | `narration timing · fit`, `speech-capabilities`, `speak` |
| Génération | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Projets antérieurs | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias de `check`) |

Les projets créés avec les anciens formats (EDL `plan.json` et `composition-manifest.json`) fonctionnent toujours avec les commandes « Projets antérieurs ». Les nouveaux travaux utilisent la timeline de scènes. Pour un `plan.json` assemblé, vérifiez le fichier final ainsi que les séquences qui le composent :

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

L'outil MCP équivalent `plan_promise_check` accepte `probe_produced` et `video`. Il mesure la durée, les dimensions d'image, l'audio, l'intensité sonore intégrée et les passages parlés de chaque réplique. L'absence de preuves de narration fait échouer le contrôle, et les avertissements de sous-titres nécessitent une vérification visuelle lorsque des sous-titres ont été incrustés.

---

## Comparaison

### OrkasVideoStudio vs Claude Motion vs CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **Ce que c'est** | un studio vidéo open source piloté par votre agent de codage | une sortie d'animation dans Claude | une application de montage vidéo de ByteDance |
| **Qui peut l'utiliser** | tout le monde ; s'exécute sur votre machine avec Claude Code, Codex, Cursor ou tout agent qui exécute un shell ou parle MCP | offres Claude Team et Enterprise (bêta) | applications de bureau, mobiles et web, niveaux gratuit et payants |
| **Comment modifier** | décrire la modification à votre agent, ou changer le texte, les images et l'ordre des scènes dans le canevas du navigateur | dans l'éditeur de Claude ou en le demandant à Claude | à la main sur une timeline |
| **Séquences** | couper, assembler, recadrer en 9:16 / 1:1 / 16:9, supprimer silences et mots de remplissage, couper en rythme | anime du texte, des graphiques, des formes et des images ; ni séquences ni personnes générées | montage manuel complet |
| **Motion design** | scènes HTML/CSS : typographie cinétique, cartes de prix, bandeaux, encarts de données, transitions | animations explicatives construites en code | modèles, animations de texte et effets |
| **Son** | narration par scène, fonds musicaux qui s'atténuent sous la voix, sous-titres d'après le minutage mesuré des mots | non abordé dans l'article d'aide d'Anthropic | outils de voix, de musique et de sous-titres dans l'application |
| **Sortie** | MP4, vérifié avant livraison pour la durée, les dimensions d'image, l'intensité sonore et la narration | export MP4 | export MP4 |
| **Code source** | MIT ; chaque vidéo est un dossier local qui vous appartient | propriétaire, hébergé | propriétaire |

Choisissez **CapCut**, ou un éditeur de timeline open source comme Shotcut ou Kdenlive, si vous voulez monter à la main. Choisissez **Claude Motion** si votre équipe travaille déjà dans Claude avec une offre Team ou Enterprise et a besoin d'animations explicatives. Choisissez **OrkasVideoStudio** si vous voulez que votre agent de codage réalise toute la vidéo — séquences, animation et son dans une seule timeline — et conserver le résultat sous forme de fichiers que vous pouvez inspecter, modifier et dont vous pouvez relancer le rendu. Les informations sur Claude Motion proviennent du [centre d'aide d'Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), en date de novembre 2026.

### OrkasVideoStudio vs Higgsfield

Higgsfield est une plateforme hébergée qui vend l'accès à de nombreux modèles vidéo et image sur un seul compte, via son application web, une API, un connecteur MCP et une CLI. OrkasVideoStudio n'héberge aucun modèle : votre agent appelle les fournisseurs que vous configurez, puis transforme les plans générés en une vidéo finie.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **Ce que c'est** | un studio vidéo open source piloté par votre agent de codage | une plateforme hébergée d'IA pour l'image et la vidéo |
| **Modèles vidéo** | les fournisseurs que vous configurez, comme Seedance 2.5, Kling 4.0, Veo 3.1 sur Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3 et Vidu Q3 | de nombreux modèles hébergés sur un seul compte, dont Seedance 2.5, Kling 4.0, Veo 3.1 et MAGI-2, que seul Higgsfield propose |
| **Comment vous payez** | chaque fournisseur facture l'usage de votre propre clé ; le montage, le motion design, les sous-titres et la transcription s'exécutent en local et ne nécessitent aucune clé | crédits d'abonnement dans l'application web et le connecteur, ou fonds facturés à la seconde sur l'API |
| **Ce que vous obtenez** | un MP4 vérifié qui mêle plans générés et séquences, motion design, narration, musique et sous-titres, plus un dossier de production que vous pouvez modifier et dont vous pouvez relancer le rendu | des clips et des images générés, et les applications studio propres à Higgsfield |
| **Depuis un agent de codage** | des skills, la CLI `ovs` et un serveur MCP pour Claude Code, Codex, Cursor ou tout autre agent | le connecteur MCP, la CLI et les skills de Higgsfield |
| **Code source** | MIT ; chaque vidéo est un dossier local qui vous appartient | propriétaire, hébergé |

Choisissez **Higgsfield** si vous voulez de nombreux modèles hébergés sur une seule facture, ou un modèle qu'il est seul à proposer, comme MAGI-2. Choisissez **OrkasVideoStudio** si vous voulez que votre agent de codage réalise toute la vidéo avec vos propres clés de fournisseur et conserver le résultat sous forme de fichiers. Les deux fonctionnent aussi ensemble : les clips que vous générez sur Higgsfield sont des séquences ordinaires pour une production OrkasVideoStudio. Les informations sur Higgsfield proviennent de [higgsfield.ai](https://higgsfield.ai/mcp) et de sa [page MAGI-2](https://higgsfield.ai/magi-2-intro), en date de novembre 2026.

### OrkasVideoStudio vs video-use et OpenDesign Motion

[video-use](https://github.com/browser-use/video-use) et le mode Motion d'[OpenDesign](https://github.com/nexu-io/open-design) sont d'autres façons open source de créer des vidéos avec un agent de codage.

| | OrkasVideoStudio | video-use | OpenDesign Motion |
|---|---|---|---|
| **Ce que c'est** | un studio vidéo open source piloté par votre agent de codage | un skill open source pour monter des séquences avec un agent de codage | le mode vidéo animée d'OpenDesign, un espace de travail de design IA open source |
| **Point de départ** | vos séquences, un brief, une page produit ou une vidéo de référence | un dossier de séquences brutes | un brief, ou l'un des cinq exemples d'animation fournis |
| **Séquences** | couper, assembler, recadrer, supprimer silences et mots de remplissage, couper en rythme | coupe les mots de remplissage et les temps morts, étalonne les couleurs, applique un fondu audio à chaque coupe | non abordé dans son README |
| **Motion design** | scènes HTML/CSS avec emplacements de texte modifiables | animations en surimpression réalisées avec HyperFrames, Remotion, Manim ou PIL | motion design HyperFrames exporté en MP4 |
| **Son et sous-titres** | narration par scène, fonds musicaux qui s'atténuent sous la voix, sous-titres d'après le minutage mesuré des mots | sous-titres incrustés dans le style de votre choix | musique de Suno v5 ou Lyria 2, et templates avec voix et sous-titres synchronisés mot à mot |
| **Plans générés** | images, clips vidéo et présentateurs issus des fournisseurs que vous configurez | non abordé dans son README | Seedance, Veo, Sora et Kling, via les modèles vers lesquels il route les requêtes |
| **Clés** | aucune pour le montage, le motion design, les sous-titres et la transcription ; vos propres clés pour la génération | une clé API ElevenLabs pour la transcription | votre propre agent de codage et vos clés API, ou les offres hébergées d'OpenDesign |
| **Modifications ultérieures** | un dossier de production qui vous appartient, plus un canevas dans le navigateur | redemander à l'agent ; les notes sont conservées dans `project.md` | fichiers source modifiables dans l'espace de travail OpenDesign |
| **Licence** | MIT | MIT | Apache-2.0 |

Choisissez **video-use** si votre travail consiste à monter des séquences brutes jusqu'à obtenir un montage fini. Choisissez **OpenDesign** si la vidéo n'est qu'un livrable parmi d'autres, aux côtés de présentations, de prototypes et de sites web, dans un même espace de travail de design. Choisissez **OrkasVideoStudio** si une vidéo a besoin à la fois de séquences, de motion design, de narration, de sous-titres et de plans générés, vérifiée avant la livraison et modifiable ensuite. Les informations proviennent du [README de video-use](https://github.com/browser-use/video-use), du [README d'OpenDesign](https://github.com/nexu-io/open-design) et de ses [notes de version 0.25.0](https://github.com/nexu-io/open-design/releases/tag/open-design-v0.25.0), en date de novembre 2026.

### OrkasVideoStudio vs frameworks, éditeurs SaaS et wrappers

HyperFrames, ffmpeg et whisper.cpp sont ici des **dépendances**, pas des concurrents. OrkasVideoStudio est la couche destinée aux agents qui s'appuie sur eux : les connaissances, les contrôles de livraison, la production modifiable et le canevas.

| | OrkasVideoStudio | Frameworks programmatiques (Remotion, Revideo) | Éditeurs SaaS d'IA (Descript, Opus Clip, Runway) | Wrappers MCP / ffmpeg minimalistes |
|---|---|---|---|---|
| **Pilotage** | n'importe quel agent de codage, en langage naturel (CLI + MCP) | vous écrivez du React/TS à la main | interface graphique / hébergé | un agent, mais uniquement des outils |
| **Artefact** | timeline de scènes modifiable dans un dossier local, plus un canevas dans le navigateur | code (à réexécuter pour le rendu) | timeline boîte noire / projet hébergé | aucun |
| **Périmètre** | montage de séquences + animation conçue + narration + génération dans une seule timeline | composition (programmatique) | surtout montage *ou* génération, selon le produit | ce que l'outil expose |
| **Accompagnement** | fournit « ce qui fait une bonne vidéo » sous forme de skills, plus des contrôles de livraison déterministes | aucun, c'est vous qui décidez | dicté par les choix du produit | aucun |
| **Clés / hébergement** | cœur sans clé ; **vos propres** clés pour la génération ; privilégie le local | votre propre infrastructure | clés du fournisseur + hébergé, verrouillage fournisseur | variable |
| **Licence** | MIT | peut exiger une licence entreprise pour les équipes | propriétaire | variable |

Optez pour un **framework** si vous voulez coder chaque image à la main, ou pour un **éditeur SaaS** si l'interface graphique et l'hébergement sont justement ce que vous cherchez. Optez pour **OrkasVideoStudio** si vous voulez que votre *agent* réalise la vidéo, conserver le résultat sous forme de fichiers que vous pouvez inspecter, modifier et dont vous pouvez relancer le rendu, et rester en local avec vos propres clés.

---

## Questions fréquentes

### Claude Code peut-il créer des vidéos ?

Oui. Une fois OrkasVideoStudio installé, Claude Code lit le skill `video-studio` et utilise la CLI `ovs` ou les outils MCP pour monter des séquences, créer du motion design, ajouter narration et sous-titres, et effectuer sur votre machine le rendu d'un MP4 vérifié. Codex, Cursor et tout autre agent capable d'exécuter un shell ou de parler MCP fonctionnent de la même manière. Voir [Piloter depuis Claude Code, Codex ou n'importe quel agent de codage](#piloter-depuis-claude-code-codex-ou-nimporte-quel-agent-de-codage).

### Est-ce gratuit ? Ai-je besoin de clés API ?

OrkasVideoStudio est gratuit et sous licence MIT. Le montage, le motion design, les sous-titres et la transcription s'exécutent en local et ne nécessitent aucune clé API. La génération d'images, de clips vidéo ou de parole est facultative et utilise vos propres comptes de fournisseurs, qui vous facturent directement. Avant tout appel payant, l'agent confirme avec vous le fournisseur, le modèle, le nombre de requêtes et le coût estimé. Voir [Ce qui encadre la génération](#ce-qui-encadre-la-génération).

### Est-ce une alternative open source à Claude Motion, CapCut et Higgsfield ?

Oui. Comme Claude Motion, il fait écrire à Claude Code du motion design sous forme de code, mais il fonctionne avec Claude Code sur une offre Pro, Max ou Ultra ou avec une clé API, pas seulement sur les offres Team et Enterprise, et aussi avec d'autres agents. Contrairement à CapCut, c'est votre agent qui effectue les modifications à partir de votre description, au lieu que vous coupiez à la main sur une timeline. Contrairement à Higgsfield, il n'héberge aucun modèle et ne vend pas de crédits : votre agent appelle Seedance, Kling, Veo et d'autres modèles vidéo avec vos propres clés, puis combine les plans avec vos séquences, votre motion design, votre narration et vos sous-titres. Voir [Comparaison](#comparaison).

### Peut-il monter les séquences que j'ai déjà ?

Oui. Il coupe et assemble des clips, les recadre en 9:16, 1:1 ou 16:9, supprime les silences et les mots de remplissage, coupe en rythme, incruste des sous-titres et normalise l'intensité sonore. Vos séquences se trouvent dans la même timeline que le motion design et les plans générés.

### Quels modèles de vidéo, d'image et de synthèse vocale peut-il utiliser ?

Pour la vidéo : Seedance, Kling, Veo (via Google ou Google Cloud), Runway, Wan, MiniMax et Vidu, ainsi qu'Atlas et MuAPI. Pour les images : Gemini, et OpenAI ou tout point de terminaison compatible OpenAI, y compris Seedream. Pour la synthèse vocale : OpenAI, Doubao, MiniMax, Alibaba (Qwen et CosyVoice), Google, ElevenLabs et les points de terminaison compatibles OpenAI. Tous fonctionnent avec vos propres clés. Voir [Fournisseurs de génération : vos propres clés (BYO)](#fournisseurs-de-génération--vos-propres-clés-byo).

### En quoi diffère-t-il de Remotion ou de HyperFrames ?

HyperFrames est une dépendance : il effectue le rendu des scènes HTML et capture les images, et ffmpeg se charge du montage et des mesures. Remotion est un framework dans lequel vous écrivez du code React pour chaque image. OrkasVideoStudio est la couche avec laquelle votre agent travaille, par-dessus eux : le savoir-faire vidéo de ses skills, les contrôles de livraison, le dossier de production modifiable et le canevas du navigateur. Voir [OrkasVideoStudio vs frameworks, éditeurs SaaS et wrappers](#orkasvideostudio-vs-frameworks-éditeurs-saas-et-wrappers).

### Comment l'installer ?

Installez-le depuis les sources : clonez le dépôt, exécutez `pnpm install && pnpm build`, puis vérifiez votre configuration avec `ovs doctor`. Il vous faut Node 22 ou une version plus récente, pnpm, ainsi que ffmpeg et ffprobe. Les paquets npm ne sont pas encore publiés. Voir [Installation](#installation).

---

## Relation avec Orkas

OrkasVideoStudio est né comme **agent vidéo intégré d'[Orkas](https://orkas.ai?source=gh-orkas-vs)**, l'application de bureau avec une équipe IA. Il y a été éprouvé de bout en bout, puis extrait dans cette boîte à outils sous licence MIT, indépendante de l'agent utilisé.

- **Dans Orkas**, il est fourni comme [agent intégré](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs), sans installation séparée. Vous discutez avec lui dans une application de bureau plutôt que dans un terminal, et la génération peut s'appuyer sur les modèles intégrés d'Orkas (les nouveaux comptes reçoivent 500 crédits gratuits) ou sur vos propres clés. [Téléchargez Orkas](https://orkas.ai/download/?source=gh-orkas-vs) pour macOS ou Windows.
- **Partout ailleurs**, vous l'installez dans votre propre agent de codage comme décrit ci-dessus et obtenez les mêmes capacités essentielles via la CLI `ovs`, le serveur MCP et le canevas. Les fonctionnalités liées au compte Orkas, comme les fournisseurs hébergés, les crédits et la publication depuis la conversation, ne font pas partie de ce dépôt.

Liens : **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[ce dépôt](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Paquets

| Paquet | Contenu |
|---|---|
| `@orkas/video-studio-core` | schémas de la timeline de scènes et de l'ancien format EDL, contrôles de livraison, aides à la décision, minutage de la narration, runtime et configuration |
| `@orkas/video-studio-tools` | backends pour la timeline, le rendu, le montage, l'analyse, la synthèse vocale, l'image et la vidéo, plus le canevas du navigateur |
| `@orkas/video-studio` | la CLI `ovs` |
| `@orkas/video-studio-mcp` | le serveur MCP (`ovs-mcp`), miroir de la CLI |
| `@orkas/video-studio-skills` | le pack de connaissances `SKILL.md` indépendant de l'hôte |

Le plan technique et son historique se trouvent dans [`PLAN.md`](./PLAN.md). Les notes destinées aux agents de codage qui travaillent sur ce dépôt se trouvent dans [`AGENTS.md`](./AGENTS.md).

---

## Développement

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

`pnpm install` applique le correctif HyperFrames versionné de [`patches/`](./patches/), qui fait utiliser aux sorties SDR H.264/H.265 la matrice BT.709 que déclarent leurs métadonnées. Un `OVS_HYPERFRAMES_BIN` externe ou la solution de repli `npx` ne bénéficie pas de ce correctif : ce runtime doit donc inclure une correction de couleur équivalente. Le correctif préserve également les horodatages de Whisper au niveau des mots pour le chinois et le japonais. Les environnements externes doivent offrir la même prise en charge.

`test:video` ne dépense jamais de crédits de fournisseur. Un faux point de terminaison Seedance local renvoie une vraie fixture H.264, qu'OVS télécharge et vérifie avec `ffprobe`.

`test:video:e2e` couvre les deux chemins de production via la CLI compilée :

- **L'ancien chemin de composition.** Il crée une production 1080p de neuf secondes et trois scènes avec composition prepare/reconcile, le snapshot, le draft gate complet, l'incrustation des sous-titres et les promise checks sur le fichier final. Il décode l'intégralité du MP4 et vérifie l'ordre des scènes, le mouvement visible, la présence d'un audio audible dans chaque scène et les pixels des sous-titres incrustés, ainsi que le rejet d'une durée de livraison erronée.
- **La timeline de scènes actuelle.** Il effectue le rendu d'une timeline de trois scènes via le vrai chemin check et snapshot de HyperFrames. Il vérifie les couleurs des scènes, le mouvement conçu, le mouvement décodé de la vidéo source, les pixels des sous-titres, l'audio, la livraison immuable et le rejet des rendus périmés.

Il teste aussi les interfaces CLI et MCP compilées. Les deux commandes vidéo échouent avec un message d'erreur indiquant comment y remédier lorsqu'un runtime requis manque. La suite de tests ordinaire peut ignorer les cas gourmands en runtime sur les machines sans ffmpeg ni navigateur.

`pnpm verify` doit réussir sur le candidat final avant tout commit Git ou toute PR. Il inclut le vrai cas de production et sert aussi de point d'entrée CI ; les modifications portant uniquement sur les tests suivent la même règle. Pour une revue de synchronisation ou de release, conservez et inspectez la vidéo produite, les aperçus, les images finales et les rapports :

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

Le répertoire de preuves est facultatif et s'active explicitement, et chaque exécution utilise son propre sous-répertoire. Les exécutions CI ordinaires nettoient leurs médias temporaires. Les fixtures utilisent du HTML/SVG original et de l'audio instrumental généré localement. Elles n'appellent aucun fournisseur payant et ne prétendent pas couvrir la qualité du TTS ni des modèles.

`pnpm benchmark` ne nécessite aucune clé et est déterministe. Il compile le paquet core, vérifie les fixtures du benchmark, puis mesure les transitions de gate, la validation EDL et les résumés de livraison, la validation du composition manifest et l'estimation de la durée de narration. Chaque suite a un seuil de débit volontairement conservateur, si bien que les fortes régressions échouent, mais pas les variations normales d'une machine à l'autre.

Le [guide de l’évaluation facultative des modèles](./eval/video/README.md), en anglais, décrit la configuration, les commandes et la conservation des éléments de preuve.

## Versions

Tous les paquets partagent une même version calendaire, `YYYY.M.D` (date dans le fuseau Asia/Shanghai, sans zéro initial). Les releases taguées utilisent `v<version>` et sont publiées sous forme de [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases) ; une version datée publiée n'est jamais écrasée. Les changements sont listés dans [CHANGELOG.md](CHANGELOG.md). Cette version est indépendante de l'application de bureau Orkas et des versions de ses agents de la marketplace.

## Licence

MIT — voir [`LICENSE`](./LICENSE). Le rendu utilise la dépendance [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, sous licence Apache-2.0. Le montage et les contrôles des médias utilisent le `ffmpeg` de votre système, et la transcription est déléguée à HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) explique comment les runtimes tiers sont localisés et contient les notes de licence.
