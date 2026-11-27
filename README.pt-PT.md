# OrkasVideoStudio

> Transforme o seu agente de programação num estúdio de vídeo. Peça um vídeo concluído ao Claude Code, ao Codex, ao Cursor ou a qualquer agente capaz de executar uma shell ou de comunicar por MCP. O agente edita as suas filmagens, desenha motion graphics, acrescenta narração, música e legendas, gera os planos em falta com as suas próprias chaves e entrega um MP4 verificado. Pode continuar a editar esse MP4 numa tela no navegador.

**Uma alternativa de código aberto ao Claude Motion, ao CapCut e ao Higgsfield, comandada pelo agente de programação que já utiliza.** Tem licença MIT e dá prioridade ao funcionamento local, sem exigir um plano Claude Team ou Enterprise nem uma subscrição de uma plataforma de vídeo: os planos gerados vêm do Seedance, do Kling, do Veo e de outros modelos de vídeo, com as suas próprias chaves. [Como se compara ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs. Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Prefere uma aplicação a um agente de programação?** O OrkasVideoStudio é também o agente de vídeo integrado do **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, a aplicação gratuita para computador com uma equipa de IA, disponível para macOS e Windows. Descreva o vídeo na conversa; a geração é feita com os modelos integrados do Orkas (as contas novas recebem 500 créditos gratuitos) ou com as suas próprias chaves. **[Transferir o Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Como os dois se relacionam ↓](#relação-com-o-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

O OrkasVideoStudio **não é um agente de vídeo de caixa negra**. Quem pensa é o seu agente. Este projeto dá-lhe as peças que ele não consegue improvisar:

- **Conhecimentos de vídeo.** Um pacote de competências `SKILL.md` independente do anfitrião, com `video-studio` como competência de entrada. Explica quando perguntar e quando avançar, em que diferem anúncios, vídeos explicativos, demonstrações de produto, montagens musicais, vídeos com apresentador, curtas-metragens e vídeos de comentário, e como verificar uma montagem antes de a dar por concluída.
- **Ferramentas determinísticas.** A CLI `ovs` e um servidor MCP que a replica. Abrangem a linha cronológica da produção, a edição com ffmpeg, a transcrição, a análise de filmagens e a geração através das suas próprias contas nos fornecedores. O [HyperFrames](https://github.com/heygen-com/hyperframes) trata da renderização das páginas e da captura de fotogramas; o `ffmpeg` trata da edição e das medições.
- **Uma produção editável.** Cada vídeo é uma pasta normal: uma linha cronológica de cenas (`videos/main/manifest.json`), um registo de recursos, factos do produto com fonte indicada e uma página desenhada opcional. Os mesmos ficheiros são editados por si, pelo seu agente e pela tela no navegador. Altere uma linha de texto, substitua uma imagem ou reordene as cenas e volte a renderizar.

A edição, os motion graphics desenhados à medida, as legendas e a transcrição **não precisam de chaves de API**. A geração de imagem, vídeo e fala é opcional, só é feita se a ativar e utiliza **as suas próprias** contas nos fornecedores. Não existe nenhum backend alojado nem é preciso criar conta.

---

## O que pode pedir

Faz o pedido uma vez e recebe um vídeo concluído. O agente combina tudo aquilo de que o pedido precisa numa única linha cronológica:

| Capacidade | O que abrange |
|---|---|
| **Editar filmagens reais** | Cortar, juntar, reenquadrar para 9:16 / 1:1 / 16:9, manter ou misturar o som dos clipes, sobrepor elementos, gravar legendas na imagem e normalizar a intensidade sonora. Em gravações longas, também consegue encontrar os melhores momentos, ordenar takes repetidos e remover silêncios ou palavras de preenchimento, com registo das provas de cada corte. |
| **Animação à medida** | Cenas construídas em HTML/CSS com animação: tipografia cinética, cartões de preço, lower thirds, destaques de dados e transições. As palavras editáveis ficam em campos de texto com nome, pelo que alterar o texto nunca obriga a reconstruir uma cena. |
| **Som e legendas** | Narração para cada cena, ajustada à duração dessa cena. Músicas de fundo licenciadas que baixam de volume durante a fala. Legendas a partir do texto da narração ou da temporização medida de cada palavra. Cortes alinhados com a batida. |
| **Planos gerados** | Imagens, clipes de vídeo e apresentadores gerados (talking-head) pelo fornecedor que configurou, para os planos que o seu material não consegue mostrar. Só são criados dentro da despesa que aprovar. |

Para um guião ou storyboard, o agente fica pelo documento. Para um vídeo concluído, trabalha até à entrega. Só lhe mostra um plano de trabalho ou uma pré-visualização se o tiver pedido ou se o vídeo tiver mais de cerca de dois minutos. Um guião que o agente escreva para o vídeo seguir palavra a palavra é-lhe mostrado primeiro; um guião fornecido por si é produzido tal como está escrito.

---

## Motion graphics no Claude Code, sem plano Team

O Claude Motion, a funcionalidade de animação da Anthropic, está em beta apenas nos planos Claude Team e Enterprise. O OrkasVideoStudio dá ao Claude Code o mesmo tipo de motion graphics feitos com código nos planos Pro, Max e Ultra ou com uma chave de API: o agente escreve cada cena em HTML e CSS com animação, inspeciona fotogramas de amostra e renderiza um MP4 no seu computador, pelo que a renderização propriamente dita não gasta tokens.

1. [Instale](#instalação) o OrkasVideoStudio e execute `ovs skills --install --target claude` (ou `--target codex` para o Codex).
2. Peça o vídeo, por exemplo: *«Faça um vídeo de motion graphics de 20 segundos em 16:9 para o lançamento da nossa aplicação: uma abertura com tipografia cinética com o nome do produto, três cartões de funcionalidades que entram a deslizar e um cartão final com o preço. Mostre-me uma imagem estática de cada cena antes de renderizar.»*
3. Altere uma palavra, uma cor ou a temporização nos ficheiros das cenas ou na tela, ou peça ao agente que o faça, e volte a renderizar.

Ao contrário do Claude Motion, a mesma linha cronológica pode também conter as suas próprias filmagens, narração, música e legendas. Consulte [como se compara](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Casos de utilização

Cada linha é um pedido que pode fazer ao seu agente. A competência `video-studio` escolhe as ferramentas.

### Publicidade e marketing

| O que diz… | O que acontece |
|---|---|
| *«Faça um anúncio vertical de 20 segundos para este candeeiro de secretária a partir destas fotografias e da página do produto.»* | Importa as fotografias, regista o preço e as especificações como factos com fonte, desenha as cenas de gancho, de funcionalidades e de preço, acrescenta narração e legendas e, por fim, verifica, renderiza e entrega. |
| *«Faça um vídeo de lançamento de 30 segundos da nossa aplicação a partir do respetivo site.»* | Captura as páginas reais do produto no seu navegador, utiliza as palavras e os ecrãs do próprio produto e constrói as cenas à volta deles, em vez de maquetas redesenhadas. |
| *«Faça um vídeo de 30 segundos em que um apresentador gerado dá a conhecer este sérum.»* | Escreve primeiro o monólogo, cria uma imagem-chave de um apresentador fictício e reutiliza-a em todos os clipes, gera os clipes falados com o seu fornecedor de vídeo e mantém os preços e as alegações como texto editável no ecrã. |
| *«Faça um vídeo promocional de 15 s em 9:16 a partir deste guião: gere a abertura, componha os destaques das funcionalidades, uma só locução.»* | Uma única linha cronológica combina a abertura gerada, as cenas de funcionalidades desenhadas à medida e uma única faixa de narração, e o ficheiro final é verificado antes da entrega. |

### Cinema e séries

| O que diz… | O que acontece |
|---|---|
| *«Faça uma curta-metragem de um minuto sobre uma enfermeira do turno da noite, com as mesmas duas personagens em todos os planos.»* | Constrói a história em torno de uma única pergunta dramática, mantém uma descrição visual de uma linha e uma imagem-chave por personagem para que se mantenham coerentes de plano para plano, e gera os planos com o seu fornecedor de vídeo dentro do orçamento que aprovar. |
| *«Transforme estes três episódios da série num resumo narrado de 3 minutos.»* | Transcreve os episódios, escolhe as cenas que fazem avançar a história, salta os genéricos e as antevisões do episódio seguinte, escreve e narra o resumo e monta as suas filmagens por baixo da narração. |
| *«Gere um plano de 5 s da cidade ao amanhecer para a abertura.»* | Confirma o fornecedor, o modelo e o custo, cria um plano com o seu fornecedor de vídeo e coloca-o na linha cronológica junto das suas filmagens. |

### Edição

| O que diz… | O que acontece |
|---|---|
| *«Transforme esta gravação de ecrã de 1 hora em três clipes de 30 s com os melhores momentos e legendas.»* | A análise de cenas e de qualidade encontra as boas partes. Os takes repetidos são ordenados, os silêncios e as palavras de preenchimento são cortados e as legendas são gravadas na imagem a partir da temporização medida de cada palavra. |
| *«Retire os silêncios e os "hum" da minha gravação na webcam e torne-a mais concisa.»* | Deteta pausas silenciosas e palavras de preenchimento, faz um jump cut determinístico e regista as provas de cada trecho removido. |
| *«Acrescente uma locução em inglês e legendas ao product-demo.mp4 e uniformize o volume.»* | Transcreve o vídeo, traduz e narra cada fala dentro da janela de imagem correspondente, mistura a voz com o som existente, grava as legendas na imagem e normaliza a intensidade sonora. |
| *«Monte estes 20 clipes da nossa viagem ao ritmo desta música.»* | Mede as batidas da música, corta os clipes em função delas e verifica o alinhamento com as batidas no ficheiro entregue. |

### Vídeos explicativos e tutoriais

| O que diz… | O que acontece |
|---|---|
| *«Faça um vídeo explicativo de 60 s sobre bases de dados vetoriais com locução em chinês.»* | Escreve cenas de motion graphics, sintetiza a narração com o seu fornecedor de TTS e ajusta cada fala à respetiva cena. |
| *«Transforme a minha gravação de ecrã da página de definições num tutorial de 90 segundos.»* | Corta a gravação, assinala cada controlo na interface real, passo a passo, e acrescenta narração e legendas. |

### Recriar vídeos populares

| O que diz… | O que acontece |
|---|---|
| *«Recrie a estrutura e o ritmo deste vídeo viral para o meu produto. Mostre-me primeiro o plano.»* | Decompõe a referência, faz corresponder os momentos-chave dela ao seu material e aguarda a sua aprovação antes de produzir. |
| *«Este anúncio da concorrência tem bons resultados. Faça o nosso com o mesmo gancho e o mesmo ritmo, com as nossas fotografias.»* | Aproveita o ritmo de gancho, prova e apelo à ação da referência, mas não o conteúdo. Todas as alegações vêm dos factos do seu produto e todas as imagens, do seu material. |

Dê ao seu agente um **ficheiro de vídeo de referência** e os seus próprios recursos de produto, guião ou filmagens. O agente pode utilizar o OrkasVideoStudio para recriar a **estrutura narrativa, o estilo visual e o ritmo de montagem** da referência no novo conteúdo:

1. **Analisar a referência.** Inspecionar fotogramas de amostra e o áudio relevante para identificar o gancho, a demonstração ou prova, a ordem da informação, a tipografia, as transições, o ritmo e o apelo à ação.
2. **Planear a adaptação.** Indicar o que manter e o que substituir e, depois, fazer corresponder os momentos da referência às novas cenas ou à linha cronológica. Adaptar a temporização à narração real e ao tempo de leitura.
3. **Produzir e rever.** Compor motion graphics, editar as suas filmagens e gerar os elementos visuais em falta quando for necessário. Os textos, as legendas, a narração e os clipes criados localmente continuam a poder ser editados em separado. Para alterar texto incorporado em vídeo gerado, é necessário alterar esse vídeo.

Funciona melhor com vídeos explicativos em motion graphics, demonstrações de SaaS e de aplicações e anúncios de produtos feitos a partir de filmagens já existentes. Comece com um ficheiro que o seu agente consiga ler, porque a transferência a partir de ligações de partilha de redes sociais não está incluída. Não são garantidos movimentos de câmara exatos, interpretações humanas nem correspondência fotograma a fotograma. As verificações de entrega não avaliam até que ponto o resultado se aproxima da referência. Para mais pormenores, consulte o [fluxo de trabalho de recriação de referências](./packages/skills/video-craft/references/reference-recreation.md).

---

## Instalação

**Pré-requisitos:** Node ≥ 22, `pnpm` e `ffmpeg` + `ffprobe` no seu `PATH`. O pacote do [HyperFrames](https://github.com/heygen-com/hyperframes) com a versão fixada `0.7.60` é instalado como dependência e renderiza as páginas num Chrome headless para as verificações e a renderização; o `npx` serve apenas de alternativa de compatibilidade. A geração é opcional e requer as suas próprias chaves.

### A partir do código-fonte (já funciona)

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

### Através do npm (quando estiver publicado)

Os pacotes npm ainda não foram publicados. Quando forem, o comando `ovs` funcionará da mesma forma:

```bash
npm i -g @orkas/video-studio     # provides the `ovs` command
ovs doctor
```

---

## Comandar a partir do Claude Code, do Codex ou de qualquer agente de programação

A CLI `ovs` é a interface de referência e as ferramentas MCP replicam-na. Utilize a opção que o seu agente suportar:

**1) Competências nativas (Claude Code / Codex).** Instale o pacote de competências para que o agente o encontre sozinho:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

O mesmo pacote de competências está listado no [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), pelo que `npx skills add orkas-ai/orkas-videostudio` também o instala. As competências chamam a CLI `ovs`, por isso instale-a primeiro, tal como descrito acima.

**2) Ferramentas MCP.** Registe o servidor:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
# once the npm packages are published:  claude mcp add ovs -- npx -y @orkas/video-studio-mcp
```

**3) CLI autodescritiva (qualquer agente com acesso a uma shell).** Não é preciso nenhum carregador:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Depois, basta pedir um vídeo ao seu agente. O agente lê primeiro `video-studio` e carrega as referências de etapa e de técnica de que precisar.

---

## Como funciona uma produção

O agente escolhe um nome curto para a pasta e guarda tudo lá dentro:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

A ordem das cenas é a ordem de reprodução. Os instantes de início e a duração total são calculados a partir das cenas e nunca são guardados, pelo que mover uma cena não pode deixar a temporização incoerente. Um preço é guardado uma única vez em `product.json` e todas as cenas que o mostram vão buscá-lo lá. Para variantes paralelas, como outras proporções, outros idiomas ou montagens para testes A/B, o agente acrescenta mais IDs de vídeo que partilham os mesmos recursos. Consulte o [contrato da linha cronológica](packages/skills/video-studio/references/timeline.md).

Uma execução típica:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

O `ship` mede o ficheiro final antes de o registar: duração, dimensões da imagem, áudio, intensidade sonora e cobertura da narração. Os avisos sobre legendas ficam assinalados para confirmação visual e são devolvidos fotogramas do MP4 real. Cada entrega dá origem a uma versão imutável. Uma renderização feita antes da última alteração é rejeitada por estar desatualizada e as entregas anteriores nunca são substituídas. Passar nestas verificações não certifica a qualidade visual. A revisão visual conta como `not_checked` até alguém olhar efetivamente para os fotogramas.

Quando aceitar explicitamente uma constatação pendente específica, indique o código exato com `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. A versão regista essa decisão e todos os outros erros continuam a bloquear a entrega. As escritas são serializadas através de `.ovs-timeline.lock`; se uma falha o deixar para trás, confirme que o processo que o detém já terminou antes de o remover. O [contrato da linha cronológica](packages/skills/video-studio/references/timeline.md) aborda as duas situações.

**As revisões continuam baratas e locais.** Uma palavra, um corte, uma ordem, uma música de fundo ou uma legenda alterados são editados no próprio sítio. Só uma fala alterada volta a ser narrada e só um plano errado volta a ser gerado, dentro da despesa já aprovada. Editar o texto de uma legenda não altera o áudio falado. O HyperFrames renderiza o vídeo completo de cada vez; esta versão portátil não guarda em cache as cenas renderizadas.

---

## Tela de vídeo no navegador

Quando `timeline import`, `timeline prepare`, `timeline render` ou `timeline ship` é concluído com êxito (a partir da CLI ou do MCP), o OVS abre a tela dessa produção no seu navegador predefinido. Os comandos seguintes reutilizam o mesmo separador em vez de abrirem novos. A tela edita os mesmos ficheiros que a CLI e o MCP, pelo que as alterações circulam nos dois sentidos. Enquanto o agente está a trabalhar, a tela fica só de visualização.

Na tela, pode:

- **Ver e exportar.** Reproduzir o vídeo, alternar entre as versões entregues e transferir a que pretender.
- **Organizar o material.** Carregar, largar ou colar materiais e, depois, mover e ligar cartões no quadro.
- **Editar cenas.** Alterar palavras, a ordem e as imagens, bem como adicionar, eliminar ou repor cenas.
- **Gerar e refazer planos.** Criar um novo plano de imagem ou de vídeo a partir de um cartão ou voltar a gerar um plano existente. Escolhe referências ou o primeiro e o último fotograma, além do modelo, da resolução e do som; as opções que um modelo não suporta ficam desativadas. Percorra os resultados anteriores e escolha o que vai utilizar. A tela pede confirmação antes de cada pedido pago.
- **Atualizar o vídeo.** As edições normais de cenas são renderizadas e entregues localmente, com o progresso apresentado no cartão do vídeo. Alterar um facto do produto, uma fala da narração ou a voz de todo o vídeo gera um pedido para o seu agente, porque essas edições precisam do critério dele. Se a verificação de entrega interromper uma atualização porque há cenas com imagens estáticas, o cartão do vídeo oferece **Preview this version** (Pré-visualizar esta versão), **Return to editing** (Voltar à edição) ou **Update anyway** (Atualizar mesmo assim); a opção Update anyway mantém essa renderização sem voltar a renderizar.
- **Dizer ao agente.** Escreva um pedido curto sobre uma cena, um plano, um cartão de material ou um vídeo. O pedido é enviado com o contexto desse cartão.

A tela abre em chinês. O botão de idioma alterna entre chinês e inglês e memoriza a sua escolha.

### Enviar pedidos de volta ao seu agente

O botão **Send** (Enviar) só entrega o pedido à conversa que criou a produção. Se essa conversa não o puder receber, o rascunho fica na tela. Nada é copiado para a área de transferência, reenviado automaticamente ou enviado para uma nova sessão. Editar, atualizar e exportar continuam a funcionar sem um agente ligado.

- **Codex.** Quando o `ovs` é executado dentro de uma thread do Codex, o pedido é colocado na fila dessa mesma thread. Para isso é preciso o Codex CLI 0.160.1 ou posterior, com o respetivo app server local em execução. Uma thread fechada ou não carregada aparece como indisponível.
- **Claude Code.** Os pedidos chegam através de um canal MCP, que é uma pré-visualização de investigação do Claude Code; uma ligação MCP normal não chega. Registe o servidor com `--claude-channel` e, em seguida, inicie o Claude Code com o canal ativado:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Crie o vídeo através das ferramentas MCP do `ovs` para que a tela abra associada a esse canal. Uma tela aberta a partir da CLI na shell não consegue chegar ao Claude Code. O Claude Code mostra um aviso de desenvolvimento local no arranque. Os canais requerem uma sessão iniciada no claude.ai ou uma chave de API da Console e, nos planos Team e Enterprise, um administrador tem de os ativar primeiro. Consulte [Canais do Claude Code](https://code.claude.com/docs/en/channels).

### Abrir uma produção manualmente

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Mantenha o comando em execução enquanto utiliza a tela. Com `--agent`, a tela executa na pasta da produção uma sessão nativa que utiliza o início de sessão, o modelo e as definições de permissões da sua própria CLI. Essa sessão requer o Codex 0.160.1+ ou o Claude Code 2.1.148+. Os pedidos de permissão e as perguntas da sessão aparecem na tela. A tela retoma a sessão guardada para a pasta, a menos que indique `--resume <session-id>` para lhe passar uma sessão específica ou `--new-session` para começar do zero. Outras opções:

- `--no-open` mostra a ligação de acesso sem abrir um navegador.
- `--port` escolhe a porta de loopback.
- `--recover` recupera uma tela cujo proprietário anterior já terminou.

Para desativar a abertura automática durante o trabalho de produção, defina `OVS_STUDIO_AUTO_OPEN=0`. Em CI, já está desativada.

---

## Utilizar os seus próprios fornecedores de geração

Configure os fornecedores em `~/.config/orkas-video-studio/config.json` (ou `$OVS_CONFIG_DIR/config.json`) ou através de variáveis de ambiente. As variáveis de ambiente sobrepõem-se ao ficheiro.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Capacidade | Valores de `provider` | Ambiente |
|---|---|---|
| Fala (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Imagem (`ovs image`) | `openai` (qualquer endpoint compatível com OpenAI, incluindo o Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Vídeo (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Pode inspecionar uma configuração sem fazer nenhuma chamada paga:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Execute `ovs narration fit` antes e depois da síntese para que cada fala da narração caiba na janela da respetiva cena ou do plano. A geração de vídeo recebe explicitamente as imagens de referência, a proporção, a duração, a resolução e as opções de áudio, para que a chamada ao fornecedor corresponda ao plano aprovado. Nos projetos com `plan.json`, o `ovs plan validate` também verifica a proporção, a duração e a operação de cada segmento de geração face ao `video.provider` configurado, antes de ser gerado o que quer que seja.

Alguns fornecedores precisam de mais algumas definições:

- **Google Cloud Veo** utiliza `video.workspace_id`, `video.region` e um token de API ou o JSON de uma conta de serviço em `video.api_key`.
- **Alibaba** utiliza, para a fala, o endpoint do respetivo workspace em `tts.base_url`. O vídeo Wan precisa de `video.workspace_id` e `video.region`.
- **Vozes apenas de clonagem** precisam do ID da voz que registou junto do fornecedor.
- **Fala por WebSocket** passa por `tts.proxy_url` apenas quando o configurar.
- **Referências de vídeo** são passadas como URL públicos de imagem ou de vídeo. O número suportado e o suporte para primeiro/último fotograma variam consoante o modelo.
- **[MuAPI](https://muapi.ai)** tem de ser selecionado explicitamente com `video.provider: "muapi"`. Quando está selecionado, `MUAPI_API_KEY` tem precedência sobre `OVS_VIDEO_API_KEY`; a chave, por si só, nunca seleciona o MuAPI. `video.model` / `OVS_VIDEO_MODEL` suporta os endpoints validados do Kling v2.1 `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` e `kling-v2.1-pro-i2v`. Os restantes slugs são rejeitados, em vez de serem enviados com um corpo que não corresponde. Por predefinição, texto para vídeo utiliza `kling-v2.1-master-t2v` e um `image_url` de primeiro fotograma utiliza `kling-v2.1-master-i2v`. A duração é de 5 ou 10 segundos e a proporção é `16:9`, `9:16` ou `1:1`. As entradas `resolution`, `generate_audio` e `quality`, que não dependem do fornecedor, continuam compatíveis com planos de produção assinados: o Kling ignora a resolução e o áudio, e a qualidade é validada, mas não é enviada. Os controlos de edição e de referências adicionais são rejeitados até ser suportado um esquema do MuAPI correspondente. O URL base predefinido inclui `/api/v1` e um URL personalizado também o tem de incluir. Consulte a [referência da API do MuAPI](https://muapi.ai/docs/api-reference) para conhecer o contrato de submissão e consulta periódica e os parâmetros específicos de cada modelo.

Os catálogos de modelos dos fornecedores descrevem o contrato da API de cada fornecedor. Não garantem disponibilidade em tempo real nem preços.

---

## O que mantém a geração dentro de limites

O agente utiliza o material que já tem sempre que este sirva para o plano e só gera o que falta. Ter credenciais configuradas não equivale a aprovar despesa. Antes de qualquer trabalho pago, o agente confirma o fornecedor, o modelo, a finalidade, o número de pedidos (incluindo novas tentativas) e o custo estimado. A partir daí, cinge-se a esse âmbito. Recusar interrompe as chamadas pagas desse pedido e um plano mal conseguido tem no máximo dois takes revistos antes de o agente lhe pedir que mude de abordagem.

Cada pedido pago guarda um recibo junto do resultado. Uma tarefa de vídeo cujo desfecho é desconhecido bloqueia uma nova submissão para o mesmo resultado até que a inspecione, e nunca é reenviada automaticamente. Consulte [autorização de geração](packages/skills/video-studio/references/generation.md).

O `ovs speak` grava o pedido e um recibo do áudio junto do resultado. Só reutiliza um pedido exatamente igual cujos bytes de áudio estejam intactos, por isso indique o `--language`, a voz, o modelo, a velocidade e o formato aprovados; alterar qualquer um deles impede a reutilização. Também reserva o resultado antes do envio, o que evita chamadas duplicadas em simultâneo.

Não existe nenhum serviço de música alojado. A música vem de ficheiros licenciados fornecidos por si e o agente regista a origem e a licença de cada ficheiro.

---

## Referência de comandos

Execute `ovs <command> --help` para ver a entrada tipada de cada comando. As ferramentas MCP utilizam os mesmos nomes com traços de sublinhado, por exemplo `timeline_prepare` e `edit_trim_silence`.

| Área | Comandos |
|---|---|
| Configuração | `doctor`, `skills [--install]`, `skill <name>` |
| Produção | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edição (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Análise | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narração | `narration timing · fit`, `speech-capabilities`, `speak` |
| Geração | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Projetos anteriores | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias de `check`) |

Os projetos criados com os formatos anteriores de EDL `plan.json` e `composition-manifest.json` continuam a funcionar através dos comandos de «Projetos anteriores». O trabalho novo utiliza a linha cronológica de cenas. Num `plan.json` montado, verifique tanto o ficheiro final como as filmagens que o compõem:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

A ferramenta MCP equivalente, `plan_promise_check`, aceita `probe_produced` e `video`. Mede a duração, as dimensões da imagem, o áudio, a intensidade sonora integrada e os trechos com voz de cada fala. A falta de provas da narração faz falhar a verificação e os avisos sobre legendas exigem uma verificação visual quando as legendas foram gravadas na imagem.

---

## Como se compara

### OrkasVideoStudio vs. Claude Motion vs. CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **O que é** | um estúdio de vídeo de código aberto comandado pelo seu agente de programação | um resultado de animação dentro do Claude | uma aplicação de edição de vídeo da ByteDance |
| **Quem pode utilizar** | qualquer pessoa; é executado no seu computador com o Claude Code, o Codex, o Cursor ou qualquer agente que execute uma shell ou comunique por MCP | planos Claude Team e Enterprise (beta) | aplicações para computador, telemóvel e web, com planos gratuitos e pagos |
| **Como edita** | descreve a alteração ao seu agente ou altera textos, imagens e a ordem das cenas na tela no navegador | no editor do Claude ou através de pedidos ao Claude | manualmente, numa linha cronológica |
| **Filmagens** | cortar, juntar, reenquadrar para 9:16 / 1:1 / 16:9, remover silêncios e palavras de preenchimento, cortar ao ritmo da música | anima texto, gráficos, formas e imagens; sem vídeo gerado nem pessoas | edição manual completa |
| **Motion graphics** | cenas em HTML/CSS: tipografia cinética, cartões de preço, lower thirds, destaques de dados, transições | animações explicativas feitas com código | templates, animações de texto e efeitos |
| **Som** | narração por cena, músicas de fundo que baixam de volume durante a fala, legendas a partir da temporização medida de cada palavra | não abordado no artigo de ajuda da Anthropic | ferramentas de voz, música e legendas na aplicação |
| **Resultado** | MP4, verificado quanto a duração, dimensões da imagem, intensidade sonora e narração antes da entrega | exportação em MP4 | exportação em MP4 |
| **Código-fonte** | MIT; cada vídeo é uma pasta local que lhe pertence | proprietário, alojado | proprietário |

Escolha o **CapCut**, ou um editor de linha cronológica de código aberto como o Shotcut ou o Kdenlive, se quiser editar manualmente. Escolha o **Claude Motion** se a sua equipa já trabalha no Claude com um plano Team ou Enterprise e precisa de animações explicativas. Escolha o **OrkasVideoStudio** se quiser que o seu agente de programação faça o vídeo completo, com filmagens, animação e som numa só linha cronológica, e guardar o resultado como ficheiros que pode inspecionar, editar e voltar a renderizar. Os pormenores sobre o Claude Motion provêm do [centro de ajuda da Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), consultado em novembro de 2026.

### OrkasVideoStudio vs. Higgsfield

O Higgsfield é uma plataforma alojada que vende muitos modelos de vídeo e de imagem numa só conta, através da aplicação web, de uma API, de um conector MCP e de uma CLI. O OrkasVideoStudio não aloja modelos: o seu agente chama os fornecedores que configurar e, depois, transforma os planos num vídeo concluído.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **O que é** | um estúdio de vídeo de código aberto comandado pelo seu agente de programação | uma plataforma alojada de imagem e vídeo com IA |
| **Modelos de vídeo** | os fornecedores que configurar, como o Seedance 2.5, o Kling 4.0, o Veo 3.1 no Google Cloud, o Runway Gen-4.5, o Wan 3.0, o MiniMax H3 e o Vidu Q3 | muitos modelos alojados numa só conta, incluindo o Seedance 2.5, o Kling 4.0, o Veo 3.1 e o MAGI-2, que só o Higgsfield oferece |
| **Como paga** | cada fornecedor fatura através da sua própria chave; a edição, os motion graphics, as legendas e a transcrição são executados localmente e não precisam de chave | créditos de subscrição na aplicação web e no conector, ou saldo pago ao segundo na API |
| **O que recebe** | um MP4 verificado que mistura planos gerados com as suas filmagens, motion graphics, narração, música e legendas, além de uma pasta de produção que pode editar e voltar a renderizar | clipes e imagens gerados, além das aplicações de estúdio do próprio Higgsfield |
| **A partir de um agente de programação** | competências, a CLI `ovs` e um servidor MCP para o Claude Code, o Codex, o Cursor ou qualquer agente | o conector MCP, a CLI e as competências do Higgsfield |
| **Código-fonte** | MIT; cada vídeo é uma pasta local que lhe pertence | proprietário, alojado |

Escolha o **Higgsfield** se quiser muitos modelos alojados numa única fatura, ou um modelo que só ele oferece, como o MAGI-2. Escolha o **OrkasVideoStudio** se quiser que o seu agente de programação faça o vídeo completo com as chaves dos seus próprios fornecedores e guardar o resultado como ficheiros. Os dois também funcionam em conjunto: os clipes que gerar no Higgsfield são material normal para uma produção do OrkasVideoStudio. Os pormenores sobre o Higgsfield provêm de [higgsfield.ai](https://higgsfield.ai/mcp) e da respetiva [página do MAGI-2](https://higgsfield.ai/magi-2-intro), consultados em novembro de 2026.

### OrkasVideoStudio vs. frameworks, editores SaaS e wrappers

O HyperFrames, o ffmpeg e o whisper.cpp são **dependências** deste projeto, não concorrentes. O OrkasVideoStudio é a camada orientada para agentes que assenta sobre eles: o conhecimento, as verificações de entrega, a produção editável e a tela.

| | OrkasVideoStudio | Frameworks programáticas (Remotion, Revideo) | Editores SaaS com IA (Descript, Opus Clip, Runway) | Wrappers simples de MCP / ffmpeg |
|---|---|---|---|---|
| **Quem comanda** | qualquer agente de programação, em linguagem natural (CLI + MCP) | o utilizador escreve React/TS à mão | GUI / alojado | um agente, mas apenas com ferramentas |
| **Artefacto** | linha cronológica de cenas editável numa pasta local, além de uma tela no navegador | código (volta a ser executado para renderizar) | linha cronológica de caixa negra / projeto alojado | nenhum |
| **Âmbito** | edição de filmagens + animação à medida + narração + geração numa só linha cronológica | composição (programática) | sobretudo edição *ou* geração, consoante o produto | o que a ferramenta disponibilizar |
| **Orientação** | inclui «o que faz um bom vídeo» sob a forma de competências, além de verificações de entrega determinísticas | nenhuma, o utilizador decide | definida pelas opções do produto | nenhuma |
| **Chaves / alojamento** | núcleo sem chaves; **as suas próprias** chaves para a geração; dá prioridade ao funcionamento local | a sua própria infraestrutura | chaves do fornecedor + alojamento, dependência do fornecedor | varia |
| **Licença** | MIT | pode exigir uma licença empresarial para equipas | proprietária | varia |

Recorra a uma **framework** se quiser programar cada fotograma à mão, ou a um **editor SaaS** se o que lhe interessa é uma interface gráfica e o alojamento. Recorra ao **OrkasVideoStudio** se quiser que o seu *agente* faça o vídeo, guardar o resultado como ficheiros que pode inspecionar, editar e voltar a renderizar, e continuar a trabalhar localmente com as suas próprias chaves.

---

## Relação com o Orkas

O OrkasVideoStudio nasceu como o **agente de vídeo integrado no [Orkas](https://orkas.ai?source=gh-orkas-vs)**, a aplicação para computador com uma equipa de IA. Foi validado de ponta a ponta nesse contexto e, depois, extraído para este conjunto de ferramentas com licença MIT, independente do agente utilizado.

- **No Orkas**, é fornecido como [agente integrado](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs), sem instalação separada. Conversa com ele numa aplicação para computador em vez de num terminal, e a geração pode ser feita com os modelos integrados do Orkas (as contas novas recebem 500 créditos gratuitos) ou com as suas próprias chaves. [Transfira o Orkas](https://orkas.ai/download/?source=gh-orkas-vs) para macOS ou Windows.
- **Em qualquer outro lado**, instala-o no seu próprio agente de programação, tal como descrito acima, e obtém as mesmas capacidades essenciais através da CLI `ovs`, do servidor MCP e da tela. As funcionalidades da conta Orkas, como os fornecedores alojados, os créditos e a publicação na conversa, não fazem parte deste repositório.

Ligações: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[este repositório](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Pacotes

| Pacote | O que é |
|---|---|
| `@orkas/video-studio-core` | esquemas da linha cronológica de cenas e da EDL antiga, verificações de entrega, auxiliares de decisão, temporização da narração, ambiente de execução e configuração |
| `@orkas/video-studio-tools` | backends de linha cronológica, renderização, edição, análise, fala, imagem e vídeo, além da tela no navegador |
| `@orkas/video-studio` | a CLI `ovs` |
| `@orkas/video-studio-mcp` | o servidor MCP (`ovs-mcp`), que replica a CLI |
| `@orkas/video-studio-skills` | o pacote de conhecimento `SKILL.md` independente do anfitrião |

O plano técnico e o respetivo histórico estão em [`PLAN.md`](./PLAN.md). As notas para os agentes de programação que trabalham neste repositório estão em [`AGENTS.md`](./AGENTS.md).

---

## Desenvolvimento

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

O `pnpm install` aplica o patch versionado do HyperFrames que se encontra em [`patches/`](./patches/), o qual faz com que a saída SDR H.264/H.265 utilize a matriz BT.709 declarada nos respetivos metadados. Um `OVS_HYPERFRAMES_BIN` externo ou a alternativa de compatibilidade `npx` não recebem este patch, pelo que esse ambiente de execução tem de incluir uma correção de cor equivalente. A correção também preserva as marcas temporais por palavra do Whisper para chinês e japonês. Os ambientes externos precisam de oferecer o mesmo suporte.

O `test:video` nunca gasta créditos de fornecedores. Um endpoint local simulado do Seedance devolve uma fixture H.264 real, que o OVS transfere e verifica com `ffprobe`.

O `test:video:e2e` abrange os dois percursos de produção através da CLI compilada:

- **O percurso anterior, por composição.** Cria uma produção 1080p de nove segundos e três cenas com composition prepare/reconcile, snapshot, o draft gate completo, a gravação de legendas na imagem e as verificações de promessa do ficheiro final. Descodifica o MP4 inteiro e verifica a ordem das cenas, o movimento visível, a existência de áudio audível em todas as cenas e os píxeis das legendas gravadas na imagem, bem como a rejeição de uma duração de entrega errada.
- **A linha cronológica de cenas atual.** Renderiza uma linha cronológica de três cenas através do percurso real de check e snapshot do HyperFrames. Verifica as cores das cenas, o movimento definido nas cenas, o movimento descodificado do vídeo de origem, os píxeis das legendas, o áudio, a entrega imutável e a rejeição de renderizações desatualizadas.

Também põe à prova as interfaces da CLI compilada e do MCP. Os dois comandos de vídeo falham com um erro que indica o que fazer quando falta um ambiente de execução necessário. O conjunto de testes normal pode ignorar casos que dependem muito do ambiente de execução em computadores sem ffmpeg ou sem navegador.

O `pnpm verify` tem de passar no candidato final antes de qualquer commit no Git ou PR. Inclui o caso de produção real e é também o ponto de entrada da CI; as alterações que só mexem em testes seguem a mesma regra. Para revisões de sincronização ou de lançamento, guarde e inspecione o vídeo produzido, as pré-visualizações, os fotogramas finais e os relatórios:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

O diretório de provas é opcional e cada execução utiliza o seu próprio subdiretório. As execuções normais da CI limpam os ficheiros multimédia temporários. As fixtures utilizam HTML/SVG originais e áudio instrumental gerado localmente. Não chamam fornecedores pagos nem afirmam cobrir a qualidade do TTS ou dos modelos.

O `pnpm benchmark` não precisa de chaves e é determinístico. Compila o pacote core, verifica as fixtures do benchmark e, depois, mede as transições de gate, a validação de EDL e os resumos de entrega, a validação do composition-manifest e a estimativa da narração. Cada conjunto tem um limite mínimo de débito deliberadamente conservador, para que as grandes regressões falhem e a variação normal entre computadores não.

O [guia de avaliação opcional de modelos](./eval/video/README.md), em inglês, descreve a configuração, os comandos e a conservação das evidências.

## Versões

Todos os pacotes partilham uma única versão de calendário, `YYYY.M.D` (data de Asia/Shanghai, sem zeros à esquerda). As versões com tag utilizam `v<version>` e são publicadas como [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); uma versão de data já publicada nunca é substituída. As alterações estão listadas em [CHANGELOG.md](CHANGELOG.md). Esta versão é independente da aplicação para computador Orkas e das versões dos agentes do respetivo catálogo.

## Licença

MIT — consulte [`LICENSE`](./LICENSE). A renderização utiliza a dependência [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, com licença Apache-2.0. A edição e as verificações multimédia utilizam o `ffmpeg` do seu sistema e a transcrição é delegada no HyperFrames / whisper.cpp. O [`PLAN.md`](./PLAN.md) explica como são localizados os ambientes de execução de terceiros, juntamente com as notas de licenciamento.
