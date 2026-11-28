# OrkasVideoStudio

> O OrkasVideoStudio é um editor de vídeo com IA de código aberto que transforma seu agente de programação em um estúdio de vídeo. Peça um vídeo pronto ao Claude Code, ao Codex, ao Cursor ou a qualquer agente que consiga executar um shell ou falar MCP. Ele edita suas gravações, cria motion graphics, adiciona narração, música e legendas, gera as tomadas que faltam com suas próprias chaves e entrega um MP4 verificado. Você pode continuar editando esse MP4 em um canvas no navegador.

**Uma alternativa de código aberto ao Claude Motion, ao CapCut e ao Higgsfield, comandada pelo agente de programação que você já usa.** Com licença MIT e local-first, sem precisar de um plano Claude Team ou Enterprise nem de assinatura de plataforma de vídeo: as tomadas geradas vêm do Seedance, do Kling, do Veo e de outros modelos de vídeo, usando suas próprias chaves. [Como ele se compara ↓](#orkasvideostudio-vs-claude-motion-vs-capcut) · [vs. Higgsfield ↓](#orkasvideostudio-vs-higgsfield)

**Prefere um aplicativo a um agente de programação?** O OrkasVideoStudio também é o agente de vídeo integrado do **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, o aplicativo gratuito para desktop com uma equipe de IA, para macOS e Windows. Descreva o vídeo no chat; a geração roda nos modelos integrados do Orkas (contas novas ganham 500 créditos grátis) ou nas suas próprias chaves. **[Baixe o Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Como os dois se relacionam ↓](#relação-com-o-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*O vídeo de apresentação de 54 segundos acima mostra um único briefing se transformando em um vídeo pronto: cortar gravações reais, criar a animação, adicionar voz, música e legendas, explorar tomadas em um canvas e, depois, mudar as palavras, trocar tomadas ou reordenar as cenas.*

O OrkasVideoStudio **não é um agente de vídeo caixa-preta**. Quem pensa é o seu agente. Este projeto entrega a ele as partes que ele não consegue improvisar:

- **Conhecimento de vídeo.** Um pacote de habilidades `SKILL.md` independente do host, com `video-studio` como habilidade de entrada. Ele aborda quando perguntar e quando seguir em frente, como anúncios, vídeos explicativos, demos de produto, montagens musicais, vídeos com apresentador, curtas-metragens e vídeos de comentário se diferenciam, e como verificar uma edição antes de considerá-la pronta.
- **Ferramentas determinísticas.** A CLI `ovs` e um servidor MCP que a espelha. Elas cobrem a linha do tempo da produção, a edição com ffmpeg, a transcrição, a análise de gravações e a geração por meio das suas próprias contas de provedores. O [HyperFrames](https://github.com/heygen-com/hyperframes) faz a renderização das páginas e a captura de quadros; o `ffmpeg` cuida da edição e das medições.
- **Uma produção editável.** Cada vídeo é uma pasta comum: uma linha do tempo de cenas (`videos/main/manifest.json`), um registro de materiais, fatos do produto com fonte indicada e uma página projetada opcional. Você, seu agente e o canvas no navegador editam os mesmos arquivos. Mude uma linha de texto, troque uma imagem ou reordene as cenas e depois renderize de novo.

Edição, motion graphics sob medida, legendas e transcrição **não precisam de chaves de API**. A geração de imagens, vídeos e fala é opcional, só acontece se você ativá-la e usa **suas próprias** contas de provedores. Não há backend hospedado nem conta para criar.

---

## O que você pode pedir

Você pede uma vez e recebe um vídeo pronto. O agente combina o que o pedido exigir em uma única linha do tempo:

| Recurso | O que cobre |
|---|---|
| **Editar gravações reais** | Cortar, unir, reenquadrar para 9:16 / 1:1 / 16:9, manter ou mixar o som dos clipes, sobrepor elementos, embutir legendas e normalizar o loudness. Em gravações longas, ele também pode encontrar os melhores momentos, classificar takes repetidos e remover silêncios ou palavras de preenchimento, registrando as evidências de cada corte. |
| **Animação sob medida** | Cenas construídas em HTML/CSS com animação: tipografia cinética, cartões de preço, lower thirds, destaques de dados e transições. As palavras editáveis ficam em slots de texto nomeados, então mudar o texto nunca exige reconstruir uma cena. |
| **Som e legendas** | Narração para cada cena, ajustada à duração dela. Trilhas de fundo licenciadas que abaixam durante a fala. Legendas geradas a partir do texto da narração ou do tempo medido de cada palavra. Cortes alinhados à batida. |
| **Tomadas geradas** | Imagens, clipes de vídeo e apresentadores gerados (talking-head) pelo provedor que você configurou, para as tomadas que seu material não consegue mostrar. Elas só são feitas dentro dos gastos que você aprovar. |

Para um roteiro ou storyboard, o agente para no documento. Para um vídeo pronto, ele trabalha até a entrega. Ele só mostra um plano ou uma prévia se você tiver pedido ou se o vídeo tiver mais de uns dois minutos. Um roteiro que ele escreve para o vídeo seguir palavra por palavra é mostrado a você primeiro; um roteiro que você fornece é produzido exatamente como foi escrito.

---

## Motion graphics no Claude Code, sem plano Team

O Claude Motion, o recurso de animação da Anthropic, está em beta apenas nos planos Claude Team e Enterprise. O OrkasVideoStudio dá ao Claude Code o mesmo tipo de motion graphics construído com código nos planos Pro, Max e Ultra ou com uma chave de API: o agente escreve cada cena em HTML e CSS com animação, inspeciona quadros amostrados e renderiza um MP4 na sua máquina, então a renderização em si não gasta tokens.

1. [Instale](#instalação) o OrkasVideoStudio e execute `ovs skills --install --target claude` (ou `--target codex` para o Codex).
2. Peça o vídeo, por exemplo: *"Faça um vídeo de motion graphics de 20 segundos em 16:9 para o lançamento do nosso app: uma abertura com tipografia cinética mostrando o nome do produto, três cartões de recursos que entram deslizando e um cartão final com o preço. Me mostre uma imagem estática de cada cena antes de renderizar."*
3. Mude você mesmo uma palavra, uma cor ou o timing nos arquivos das cenas ou no canvas, ou peça ao agente, e depois renderize de novo.

Diferentemente do Claude Motion, a mesma linha do tempo também pode conter suas próprias gravações, narração, música e legendas. Veja [como ele se compara](#orkasvideostudio-vs-claude-motion-vs-capcut).

---

## Casos de uso

Cada linha é um prompt que você poderia dar ao seu agente. A habilidade `video-studio` escolhe as ferramentas.

### Publicidade e marketing

| Você diz… | O que acontece |
|---|---|
| *"Faça um anúncio vertical de 20 segundos para esta luminária de mesa a partir destas fotos e da página do produto."* | Ele importa as fotos, registra o preço e as especificações como fatos com fonte, cria as cenas de gancho, de recursos e de preço, adiciona narração e legendas e, por fim, verifica, renderiza e entrega. |
| *"Faça um vídeo de lançamento de 30 segundos para o nosso app a partir do site dele."* | Ele captura as páginas reais do produto no seu navegador, usa as próprias palavras e telas do produto e constrói as cenas em torno delas, em vez de usar mock-ups redesenhados. |
| *"Faça um vídeo de 30 segundos em que um apresentador gerado mostra este sérum."* | Ele escreve o monólogo primeiro, cria uma imagem-chave de um apresentador fictício e a reutiliza em todos os clipes, gera os clipes falados com seu provedor de vídeo e mantém preços e alegações como texto editável na tela. |
| *"Faça uma promo de 15 s em 9:16 a partir deste roteiro: gere a abertura, componha os destaques dos recursos, uma única locução."* | Uma única linha do tempo combina a abertura gerada, as cenas de recursos sob medida e uma única faixa de narração, e o arquivo final é verificado antes da entrega. |

### Filmes e séries

| Você diz… | O que acontece |
|---|---|
| *"Faça um curta-metragem de um minuto sobre uma enfermeira do turno da noite, com os mesmos dois personagens em todas as tomadas."* | Ele constrói a história em torno de uma única pergunta dramática, mantém uma descrição visual de uma linha e uma imagem-chave por personagem para que eles fiquem consistentes entre as tomadas, e gera as tomadas com seu provedor de vídeo dentro do orçamento que você aprovar. |
| *"Transforme estes três episódios da série em um resumo narrado de 3 minutos."* | Ele transcreve os episódios, escolhe as cenas que sustentam a história, pula os créditos e as prévias do próximo episódio, escreve e narra o resumo e monta suas gravações por baixo da narração. |
| *"Gere uma tomada de 5 s da cidade ao amanhecer para a abertura."* | Ele confirma o provedor, o modelo e o custo, cria uma tomada com seu provedor de vídeo e a coloca na linha do tempo ao lado das suas gravações. |

### Edição

| Você diz… | O que acontece |
|---|---|
| *"Transforme esta gravação de tela de 1 hora em três clipes de destaques de 30 s com legendas."* | A análise de cenas e de qualidade encontra as partes boas. Os takes repetidos são classificados, os silêncios e as palavras de preenchimento são cortados, e as legendas são embutidas a partir do tempo medido de cada palavra. |
| *"Tire os silêncios e os 'hã' da minha gravação da webcam e deixe tudo mais enxuto."* | Ele detecta pausas silenciosas e palavras de preenchimento, faz um jump cut determinístico e registra as evidências de cada trecho removido. |
| *"Adicione uma locução em inglês e legendas ao product-demo.mp4 e deixe o volume uniforme."* | Ele transcreve o vídeo, traduz e narra cada fala dentro da janela de imagem correspondente, mixa a voz sobre o som existente, embute as legendas e normaliza o loudness. |
| *"Edite estes 20 clipes da nossa viagem com esta música, no ritmo da batida."* | Ele mede as batidas da música, corta os clipes de acordo com elas e verifica o alinhamento com a batida no arquivo entregue. |

### Vídeos explicativos e tutoriais

| Você diz… | O que acontece |
|---|---|
| *"Faça um vídeo explicativo de 60 s sobre bancos de dados vetoriais com locução em chinês."* | Ele escreve cenas de motion graphics, sintetiza a narração com seu provedor de TTS e ajusta cada fala à sua cena. |
| *"Transforme minha gravação de tela da página de configurações em um tutorial de 90 segundos."* | Ele corta a gravação, marca cada controle na interface real, passo a passo, e adiciona narração e legendas. |

### Recriando vídeos populares

| Você diz… | O que acontece |
|---|---|
| *"Recrie a estrutura e o ritmo deste vídeo viral para o meu produto. Me mostre o plano primeiro."* | Ele decompõe a referência, mapeia os momentos-chave dela para o seu material e espera sua aprovação antes de produzir. |
| *"Este anúncio do concorrente tem um bom desempenho. Faça o nosso com o mesmo gancho e o mesmo ritmo, usando nossas fotos."* | Ele aproveita o ritmo de gancho, prova e chamada para ação da referência, não o conteúdo dela. Toda alegação vem dos fatos do seu produto, e toda imagem, do seu material. |

Dê ao seu agente um **arquivo de vídeo de referência** e seus próprios materiais de produto, roteiro ou gravações. Seu agente pode usar o OrkasVideoStudio para recriar a **estrutura narrativa, o estilo visual e o ritmo de edição** dele no novo conteúdo:

1. **Analise a referência.** Inspecione quadros amostrados e o áudio relevante para identificar o gancho, a demonstração ou prova, a ordem das informações, a tipografia, as transições, o ritmo e a chamada para ação.
2. **Planeje a adaptação.** Diga o que manter e o que substituir e, depois, mapeie os momentos da referência para as novas cenas ou para a linha do tempo. Adapte o timing à sua narração real e ao tempo de leitura.
3. **Produza e revise.** Componha motion graphics, edite suas gravações e gere os visuais que faltarem quando necessário. Textos, legendas, narração e clipes criados localmente continuam editáveis separadamente. Para mudar um texto embutido em vídeos gerados, é preciso alterar esses vídeos.

Isso funciona melhor com vídeos explicativos em motion graphics, demos de SaaS e de aplicativos e anúncios de produto feitos com gravações já existentes. Comece com um arquivo que seu agente consiga ler, porque o download a partir de links de compartilhamento de redes sociais não está incluído. Movimentos de câmera exatos, atuações humanas e correspondência quadro a quadro não são garantidos. As verificações de entrega não avaliam o quanto o resultado se parece com a referência. Para mais detalhes, veja o [fluxo de recriação a partir de referência](./packages/skills/video-craft/references/reference-recreation.md).

---

## Instalação

**Pré-requisitos:** Node ≥ 22, `pnpm` e `ffmpeg` + `ffprobe` no seu `PATH`. O pacote fixado do [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60` é instalado como dependência e renderiza páginas em um Chrome headless para as verificações e a renderização; o `npx` é apenas um fallback de compatibilidade. A geração é opcional e precisa das suas próprias chaves.

### A partir do código-fonte

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

Os pacotes npm ainda não foram publicados, então, por enquanto, instale a partir do código-fonte.

---

## Controle pelo Claude Code, pelo Codex ou por qualquer agente de programação

A CLI `ovs` é a interface canônica, e as ferramentas MCP a espelham. Use a opção que seu agente suportar:

**1) Habilidades nativas (Claude Code / Codex).** Instale o pacote de habilidades para que o agente o encontre sozinho:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

O mesmo pacote de habilidades está listado no [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), então `npx skills add orkas-ai/orkas-videostudio` também o instala. As habilidades chamam a CLI `ovs`, então instale-a primeiro, como descrito acima.

**2) Ferramentas MCP.** Registre o servidor:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) CLI autodescritiva (qualquer agente com shell).** Não precisa de carregador:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Depois, é só pedir um vídeo ao seu agente. Ele lê `video-studio` primeiro e carrega as referências de etapa e de técnica de que precisar.

---

## Como funciona uma produção

O agente escolhe um nome curto para a pasta e guarda tudo nela:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

A ordem das cenas é a ordem de reprodução. Os tempos de início e a duração total são calculados a partir das cenas e nunca são armazenados, então mover uma cena não tem como deixar o timing inconsistente. Um preço fica em `product.json` uma única vez, e toda cena que o exibe lê o valor de lá. Para variantes paralelas, como outras proporções, idiomas ou montagens para teste A/B, o agente adiciona mais IDs de vídeo que compartilham os mesmos materiais. Veja o [contrato da linha do tempo](packages/skills/video-studio/references/timeline.md).

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

O `ship` mede o arquivo final antes de registrá-lo: duração, tamanho do quadro, áudio, loudness e cobertura da narração. Os avisos de legenda são sinalizados para confirmação visual, e o comando retorna quadros do MP4 real. Cada entrega vira uma versão imutável. Uma renderização feita antes da última alteração é rejeitada como desatualizada, e as entregas anteriores nunca são sobrescritas. Passar nessas verificações não certifica a qualidade visual. A revisão visual conta como `not_checked` até que alguém de fato olhe os quadros.

Quando você aceitar explicitamente um apontamento pendente específico, passe o código exato dele com `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. A versão registra essa decisão, e todos os outros erros continuam bloqueando a entrega. As operações de escrita são serializadas com `.ovs-timeline.lock`; se uma falha deixar esse arquivo para trás, confirme que o processo dono dele parou antes de removê-lo. O [contrato da linha do tempo](packages/skills/video-studio/references/timeline.md) cobre os dois casos.

**As revisões continuam baratas e locais.** Uma palavra, um corte, uma ordem, uma trilha de fundo ou uma legenda alterados são editados no próprio lugar. Só uma fala alterada é narrada de novo, e só uma tomada errada é gerada de novo, dentro dos gastos já aprovados. Editar o texto de uma legenda não altera o áudio falado. O HyperFrames renderiza o vídeo completo a cada vez; esta versão portátil não guarda cenas renderizadas em cache.

---

## Canvas de vídeo no navegador

Quando `timeline import`, `timeline prepare`, `timeline render` ou `timeline ship` termina com sucesso (pela CLI ou pelo MCP), o OVS abre o canvas dessa produção no seu navegador padrão. Os comandos seguintes reutilizam a mesma aba em vez de abrir novas. O canvas edita os mesmos arquivos que a CLI e o MCP, então as alterações fluem nos dois sentidos. Enquanto o agente está trabalhando, o canvas fica no modo só de visualização.

No canvas, você pode:

- **Assistir e exportar.** Reproduzir o vídeo, alternar entre as versões entregues e baixar a que você quiser.
- **Organizar o material.** Enviar, soltar ou colar materiais e depois mover e conectar cartões no quadro.
- **Editar cenas.** Mudar palavras, ordem e imagens, além de adicionar, excluir ou recolocar cenas.
- **Gerar e refazer tomadas.** Criar uma nova tomada de imagem ou de vídeo a partir de um cartão, ou gerar de novo uma tomada existente. Você escolhe referências ou o primeiro e o último quadro, além do modelo, da resolução e do som; as opções que um modelo não suporta ficam desativadas. Navegue pelos resultados anteriores e escolha qual usar. O canvas pede confirmação antes de cada requisição paga.
- **Atualizar o vídeo.** As edições comuns de cenas são renderizadas e entregues localmente, com o progresso exibido no cartão do vídeo. Mudar um fato do produto, uma fala da narração ou a voz do vídeo inteiro gera um pedido para o seu agente, porque essas edições precisam do julgamento dele. Se a verificação de entrega interromper uma atualização porque as cenas mantêm imagens estáticas, o cartão do vídeo oferece **Preview this version** (Visualizar esta versão), **Return to editing** (Voltar à edição) ou **Update anyway** (Atualizar mesmo assim); a opção Update anyway mantém essa renderização sem renderizar de novo.
- **Dizer ao agente.** Escreva um pedido curto sobre uma cena, uma tomada, um cartão de material ou um vídeo. Ele é enviado com o contexto desse cartão.

O canvas abre em chinês. O botão de idioma alterna entre chinês e inglês e lembra a sua escolha.

### Enviando pedidos de volta ao seu agente

O botão **Send** (Enviar) só entrega o pedido à conversa que criou a produção. Se essa conversa não puder recebê-lo, o rascunho fica no canvas. Nada é copiado para a área de transferência, reenviado automaticamente ou enviado para uma nova sessão. Editar, atualizar e exportar continuam funcionando sem um agente conectado.

- **Codex.** Quando o `ovs` roda dentro de uma thread do Codex, o pedido entra na fila dessa mesma thread. Isso exige o Codex CLI 0.160.1 ou mais recente, com o app server local em execução. Uma thread fechada ou não carregada aparece como indisponível.
- **Claude Code.** Os pedidos chegam por um canal MCP, que é uma prévia de pesquisa do Claude Code; uma conexão MCP comum não basta. Registre o servidor com `--claude-channel` e depois inicie o Claude Code com o canal ativado:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Crie o vídeo pelas ferramentas MCP do `ovs` para que o canvas abra vinculado a esse canal. Um canvas aberto pela CLI no shell não consegue chegar ao Claude Code. O Claude Code mostra um aviso de desenvolvimento local na inicialização. Os canais exigem login no claude.ai ou uma chave de API do Console e, nos planos Team e Enterprise, um administrador precisa ativá-los primeiro. Veja [Canais do Claude Code](https://code.claude.com/docs/en/channels).

### Abra uma produção você mesmo

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Mantenha o comando em execução enquanto usa o canvas. Com `--agent`, o canvas executa na pasta da produção uma sessão nativa que usa o login, o modelo e as configurações de permissão da sua própria CLI. Essa sessão exige o Codex 0.160.1+ ou o Claude Code 2.1.148+. Os pedidos de permissão e as perguntas dela aparecem no canvas. O canvas restaura a sessão salva da pasta, a menos que você passe `--resume <session-id>` para entregar a ele uma sessão específica ou `--new-session` para começar do zero. Outras opções:

- `--no-open` imprime o link de acesso sem abrir um navegador.
- `--port` escolhe a porta de loopback.
- `--recover` retoma um canvas cujo dono anterior já foi encerrado.

Para desativar a abertura automática durante o trabalho de produção, defina `OVS_STUDIO_AUTO_OPEN=0`. Em CI, ela já vem desativada.

---

## Use seus próprios provedores de geração

Configure os provedores em `~/.config/orkas-video-studio/config.json` (ou `$OVS_CONFIG_DIR/config.json`) ou com variáveis de ambiente. As variáveis de ambiente têm prioridade sobre o arquivo.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Recurso | Valores de `provider` | Ambiente |
|---|---|---|
| Fala (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Imagem (`ovs image`) | `openai` (qualquer endpoint compatível com OpenAI, incluindo o Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Vídeo (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Você pode inspecionar uma configuração sem fazer nenhuma chamada paga:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Execute `ovs narration fit` antes e depois da síntese para que cada fala da narração fique dentro da janela da cena ou do plano. A geração de vídeo recebe explicitamente as imagens de referência, a proporção, a duração, a resolução e as flags de áudio, para que a chamada ao provedor corresponda ao plano aprovado. Em projetos com `plan.json`, o `ovs plan validate` também verifica a proporção, a duração e a operação de cada segmento de geração em relação ao `video.provider` configurado, antes que qualquer coisa seja gerada.

Alguns provedores precisam de mais algumas configurações:

- **Google Cloud Veo** usa `video.workspace_id`, `video.region` e um token de API ou o JSON de uma conta de serviço em `video.api_key`.
- **Alibaba** usa, para fala, o endpoint do seu workspace em `tts.base_url`. O vídeo Wan precisa de `video.workspace_id` e `video.region`.
- **Vozes somente de clonagem** precisam do ID de voz que você cadastrou no provedor.
- **Fala via WebSocket** passa por `tts.proxy_url` somente quando você o configura.
- **Referências de vídeo** são passadas como URLs públicas de imagem ou de vídeo. A quantidade suportada e o suporte a primeiro/último quadro variam conforme o modelo.
- **[MuAPI](https://muapi.ai)** precisa ser selecionado explicitamente com `video.provider: "muapi"`. Quando ele está selecionado, `MUAPI_API_KEY` tem precedência sobre `OVS_VIDEO_API_KEY`; a chave nunca seleciona o MuAPI sozinha. `video.model` / `OVS_VIDEO_MODEL` aceita os endpoints validados do Kling v2.1 `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` e `kling-v2.1-pro-i2v`. Outros slugs são rejeitados em vez de serem enviados com um corpo incompatível. Texto para vídeo usa `kling-v2.1-master-t2v` por padrão, e uma `image_url` de primeiro quadro usa `kling-v2.1-master-i2v` por padrão. A duração é de 5 ou 10 segundos, e a proporção é `16:9`, `9:16` ou `1:1`. As entradas `resolution`, `generate_audio` e `quality`, neutras em relação ao provedor, continuam compatíveis com planos de produção assinados: o Kling ignora a resolução e o áudio, e a qualidade é validada, mas não enviada. Os controles de edição e de referências adicionais são rejeitados até que um esquema correspondente do MuAPI seja suportado. A URL base padrão inclui `/api/v1`, e uma URL personalizada também precisa incluí-lo. Veja a [referência da API do MuAPI](https://muapi.ai/docs/api-reference) para o contrato de envio e consulta periódica e os parâmetros específicos de cada modelo.

Os catálogos de modelos dos provedores descrevem o contrato de API de cada provedor. Eles não garantem disponibilidade em tempo real nem preços.

---

## O que mantém a geração dentro dos limites

O agente usa o material que você já tem sempre que ele serve para a tomada e gera apenas o que falta. Ter credenciais configuradas não conta como aprovação para gastar. Antes de qualquer trabalho pago, o agente confirma o provedor, o modelo, a finalidade, o número de requisições (incluindo novas tentativas) e o custo estimado. Depois, ele se mantém dentro desse escopo. Recusar interrompe as chamadas pagas daquele pedido, e uma tomada ruim recebe no máximo dois takes revisados antes de o agente pedir que você mude a abordagem.

Cada requisição paga guarda um recibo ao lado da saída. Uma tarefa de vídeo cujo resultado é desconhecido bloqueia um novo envio para a mesma saída até que você a inspecione, e ela nunca é reenviada automaticamente. Veja [autorização de geração](packages/skills/video-studio/references/generation.md).

O `ovs speak` grava a requisição e um recibo de áudio ao lado da saída. Ele só reutiliza uma requisição exatamente igual cujos bytes de áudio estejam intactos, então passe o `--language`, a voz, o modelo, a velocidade e o formato aprovados; mudar qualquer um deles invalida a reutilização. Ele também reserva a saída antes do envio, o que impede chamadas duplicadas simultâneas.

Não há serviço de música hospedado. A música vem de arquivos licenciados fornecidos por você, e o agente registra a origem e a licença de cada arquivo.

---

## Referência de comandos

Execute `ovs <command> --help` para ver a entrada tipada de cada comando. As ferramentas MCP usam os mesmos nomes com sublinhados, por exemplo `timeline_prepare` e `edit_trim_silence`.

| Área | Comandos |
|---|---|
| Configuração | `doctor`, `skills [--install]`, `skill <name>` |
| Produção | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edição (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Análise | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narração | `narration timing · fit`, `speech-capabilities`, `speak` |
| Geração | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Projetos anteriores | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias de `check`) |

Os projetos criados com os formatos anteriores de EDL `plan.json` e `composition-manifest.json` continuam funcionando com os comandos de "Projetos anteriores". Os trabalhos novos usam a linha do tempo de cenas. Para um `plan.json` montado, verifique o arquivo final e também as gravações que o compõem:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

A ferramenta MCP equivalente, `plan_promise_check`, aceita `probe_produced` e `video`. Ela mede a duração, o tamanho do quadro, o áudio, o loudness integrado e os trechos com voz de cada fala. A falta de evidências da narração reprova a verificação, e os avisos de legenda exigem uma verificação visual quando as legendas foram embutidas.

---

## Como ele se compara

### OrkasVideoStudio vs. Claude Motion vs. CapCut

| | OrkasVideoStudio | Claude Motion | CapCut |
|---|---|---|---|
| **O que é** | um estúdio de vídeo de código aberto comandado pelo seu agente de programação | uma saída de animação dentro do Claude | um aplicativo de edição de vídeo da ByteDance |
| **Quem pode usar** | qualquer pessoa; roda na sua máquina com Claude Code, Codex, Cursor ou qualquer agente que execute um shell ou fale MCP | planos Claude Team e Enterprise (beta) | apps para desktop, celular e web, com planos gratuitos e pagos |
| **Como você edita** | descreve a alteração ao seu agente ou muda textos, imagens e a ordem das cenas no canvas no navegador | no editor do Claude ou pedindo ao Claude | manualmente, em uma linha do tempo |
| **Gravações** | cortar, unir, reenquadrar para 9:16 / 1:1 / 16:9, remover silêncios e palavras de preenchimento, cortar na batida | anima textos, gráficos, formas e imagens; sem vídeo gerado nem pessoas | edição manual completa |
| **Motion graphics** | cenas em HTML/CSS: tipografia cinética, cartões de preço, lower thirds, destaques de dados, transições | animações explicativas construídas com código | templates, animações de texto e efeitos |
| **Som** | narração por cena, trilhas de fundo que abaixam durante a fala, legendas a partir do tempo medido de cada palavra | não abordado no artigo de ajuda da Anthropic | ferramentas de voz, música e legendas no app |
| **Saída** | MP4, verificado quanto a duração, tamanho do quadro, loudness e narração antes da entrega | exportação em MP4 | exportação em MP4 |
| **Código-fonte** | MIT; cada vídeo é uma pasta local que pertence a você | proprietário, hospedado | proprietário |

Escolha o **CapCut**, ou um editor de linha do tempo de código aberto como o Shotcut ou o Kdenlive, quando quiser editar manualmente. Escolha o **Claude Motion** quando sua equipe já trabalha no Claude em um plano Team ou Enterprise e precisa de animações explicativas. Escolha o **OrkasVideoStudio** quando quiser que seu agente de programação faça o vídeo inteiro, com gravações, animação e som em uma só linha do tempo, e manter o resultado como arquivos que você pode inspecionar, editar e renderizar de novo. Os detalhes do Claude Motion vêm da [central de ajuda da Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), consultada em novembro de 2026.

### OrkasVideoStudio vs. Higgsfield

O Higgsfield é uma plataforma hospedada que vende muitos modelos de vídeo e imagem em uma única conta, pelo app web, por uma API, por um conector MCP e por uma CLI. O OrkasVideoStudio não hospeda modelos: seu agente chama os provedores que você configurar e depois transforma as tomadas em um vídeo pronto.

| | OrkasVideoStudio | Higgsfield |
|---|---|---|
| **O que é** | um estúdio de vídeo de código aberto comandado pelo seu agente de programação | uma plataforma hospedada de imagem e vídeo com IA |
| **Modelos de vídeo** | os provedores que você configurar, como Seedance 2.5, Kling 4.0, Veo 3.1 no Google Cloud, Runway Gen-4.5, Wan 3.0, MiniMax H3 e Vidu Q3 | muitos modelos hospedados em uma única conta, incluindo Seedance 2.5, Kling 4.0, Veo 3.1 e MAGI-2, que só o Higgsfield oferece |
| **Como você paga** | cada provedor cobra diretamente pela sua própria chave; edição, motion graphics, legendas e transcrição rodam localmente e não precisam de chave | créditos de assinatura no app web e no conector, ou saldo cobrado por segundo na API |
| **O que você recebe** | um MP4 verificado que mistura tomadas geradas com suas gravações, motion graphics, narração, música e legendas, além de uma pasta de produção que você pode editar e renderizar de novo | clipes e imagens gerados, além dos apps de estúdio do próprio Higgsfield |
| **A partir de um agente de programação** | habilidades, a CLI `ovs` e um servidor MCP para Claude Code, Codex, Cursor ou qualquer agente | o conector MCP, a CLI e as habilidades do Higgsfield |
| **Código-fonte** | MIT; cada vídeo é uma pasta local que pertence a você | proprietário, hospedado |

Escolha o **Higgsfield** quando quiser muitos modelos hospedados em uma única fatura, ou um modelo que só ele oferece, como o MAGI-2. Escolha o **OrkasVideoStudio** quando quiser que seu agente de programação faça o vídeo inteiro com as chaves dos seus próprios provedores e manter o resultado como arquivos. Os dois também funcionam juntos: os clipes que você gera no Higgsfield são material comum para uma produção do OrkasVideoStudio. Os detalhes do Higgsfield vêm do [higgsfield.ai](https://higgsfield.ai/mcp) e da [página do MAGI-2](https://higgsfield.ai/magi-2-intro), consultados em novembro de 2026.

### OrkasVideoStudio vs. video-use e OpenDesign Motion

O [video-use](https://github.com/browser-use/video-use) e o modo Motion do [OpenDesign](https://github.com/nexu-io/open-design) são outras formas de código aberto de fazer vídeos com um agente de programação.

| | OrkasVideoStudio | video-use | OpenDesign Motion |
|---|---|---|---|
| **O que é** | um estúdio de vídeo de código aberto comandado pelo seu agente de programação | uma habilidade de código aberto para editar gravações com um agente de programação | o modo de vídeo animado do OpenDesign, um espaço de trabalho de design com IA de código aberto |
| **Ponto de partida** | suas gravações, um briefing, uma página de produto ou um vídeo de referência | uma pasta de gravações brutas | um briefing ou um dos cinco exemplos de animação incluídos |
| **Gravações** | cortar, unir, reenquadrar, remover silêncios e palavras de preenchimento, cortar na batida | corta palavras de preenchimento e tempo morto, faz color grading e aplica fade no áudio a cada corte | não abordado no README dele |
| **Motion graphics** | cenas em HTML/CSS com slots de texto editáveis | sobreposições animadas feitas com HyperFrames, Remotion, Manim ou PIL | motion graphics do HyperFrames exportados para MP4 |
| **Som e legendas** | narração por cena, trilhas de fundo que abaixam durante a fala, legendas a partir do tempo medido de cada palavra | legendas embutidas no estilo que você escolher | música do Suno v5 ou do Lyria 2 e templates com fala e legendas sincronizadas palavra por palavra |
| **Tomadas geradas** | imagens, clipes de vídeo e apresentadores dos provedores que você configurar | não abordado no README dele | Seedance, Veo, Sora e Kling pelos modelos que ele roteia |
| **Chaves** | nenhuma para edição, motion graphics, legendas e transcrição; suas próprias chaves para a geração | uma chave de API da ElevenLabs para a transcrição | seu próprio agente de programação e suas próprias chaves de API, ou os planos hospedados do OpenDesign |
| **Edição posterior** | uma pasta de produção que pertence a você, além de um canvas no navegador | pedir de novo ao agente; as anotações continuam em `project.md` | arquivos-fonte editáveis no espaço de trabalho do OpenDesign |
| **Licença** | MIT | MIT | Apache-2.0 |

Escolha o **video-use** quando o trabalho for transformar gravações brutas em uma edição pronta. Escolha o **OpenDesign** quando o vídeo for um entre vários entregáveis, ao lado de apresentações, protótipos e sites, em um mesmo espaço de trabalho de design. Escolha o **OrkasVideoStudio** quando um único vídeo precisar reunir gravações, motion graphics, narração, legendas e tomadas geradas, ser verificado antes da entrega e continuar editável depois. Os detalhes vêm do [README do video-use](https://github.com/browser-use/video-use), do [README do OpenDesign](https://github.com/nexu-io/open-design) e das [notas da versão 0.25.0](https://github.com/nexu-io/open-design/releases/tag/open-design-v0.25.0) do projeto, consultados em novembro de 2026.

### OrkasVideoStudio vs. frameworks, editores SaaS e wrappers

HyperFrames, ffmpeg e whisper.cpp são **dependências** aqui, não concorrentes. O OrkasVideoStudio é a camada voltada para agentes construída sobre eles: o conhecimento, as verificações de entrega, a produção editável e o canvas.

| | OrkasVideoStudio | Frameworks programáticos (Remotion, Revideo) | Editores SaaS com IA (Descript, Opus Clip, Runway) | Wrappers simples de MCP / ffmpeg |
|---|---|---|---|---|
| **Quem comanda** | qualquer agente de programação, em linguagem natural (CLI + MCP) | você escreve React/TS à mão | GUI / hospedado | um agente, mas só com ferramentas |
| **Artefato** | linha do tempo de cenas editável em uma pasta local, além de um canvas no navegador | código (execute de novo para renderizar) | linha do tempo caixa-preta / projeto hospedado | nenhum |
| **Escopo** | edição de gravações + animação sob medida + narração + geração em uma só linha do tempo | composição (programática) | em geral edição *ou* geração, conforme o produto | o que a ferramenta expuser |
| **Orientação** | traz "o que faz um bom vídeo" como habilidades, além de verificações de entrega determinísticas | nenhuma, você decide | definida pelas opiniões do produto | nenhuma |
| **Chaves / hospedagem** | núcleo sem chaves; **suas próprias** chaves para a geração; local-first | sua própria infraestrutura | chaves do fornecedor + hospedagem, lock-in | varia |
| **Licença** | MIT | pode exigir uma licença empresarial para equipes | proprietária | varia |

Recorra a um **framework** quando quiser codificar cada quadro à mão, ou a um **editor SaaS** quando a interface gráfica e a hospedagem forem o objetivo. Recorra ao **OrkasVideoStudio** quando quiser que seu *agente* faça o vídeo, manter o resultado como arquivos que você pode inspecionar, editar e renderizar de novo e continuar trabalhando localmente com suas próprias chaves.

---

## Perguntas frequentes

### Dá para fazer vídeos com o Claude Code?

Sim. Com o OrkasVideoStudio instalado, o Claude Code lê a habilidade `video-studio` e usa a CLI `ovs` ou as ferramentas MCP para editar gravações, criar motion graphics, adicionar narração e legendas e renderizar um MP4 verificado na sua máquina. O Codex, o Cursor e qualquer outro agente que consiga executar um shell ou falar MCP funcionam do mesmo jeito. Veja [Controle pelo Claude Code, pelo Codex ou por qualquer agente de programação](#controle-pelo-claude-code-pelo-codex-ou-por-qualquer-agente-de-programação).

### É grátis? Preciso de chaves de API?

O OrkasVideoStudio é gratuito e tem licença MIT. Edição, motion graphics sob medida, legendas e transcrição rodam localmente e não precisam de chaves de API. A geração de imagens, clipes de vídeo ou fala é opcional e usa suas próprias contas de provedores, que cobram você diretamente. Antes de qualquer chamada paga, o agente confirma com você o provedor, o modelo, o número de requisições e o custo estimado. Veja [O que mantém a geração dentro dos limites](#o-que-mantém-a-geração-dentro-dos-limites).

### É uma alternativa de código aberto ao Claude Motion, ao CapCut e ao Higgsfield?

Sim. Assim como o Claude Motion, ele faz o Claude Code escrever motion graphics como código, mas funciona com o Claude Code nos planos Pro, Max ou Ultra ou com uma chave de API, não apenas nos planos Team e Enterprise, e também com outros agentes. Diferentemente do CapCut, é o seu agente que faz as edições a partir da sua descrição, em vez de você cortar manualmente em uma linha do tempo. Diferentemente do Higgsfield, ele não hospeda modelos nem vende créditos: seu agente chama o Seedance, o Kling, o Veo e outros modelos de vídeo com suas próprias chaves e depois combina as tomadas com suas gravações, motion graphics, narração e legendas. Veja [Como ele se compara](#como-ele-se-compara).

### Ele consegue editar gravações que eu já tenho?

Sim. Ele corta e une clipes, reenquadra para 9:16, 1:1 ou 16:9, remove silêncios e palavras de preenchimento, corta na batida, embute legendas e normaliza o loudness. Suas gravações ficam na mesma linha do tempo que os motion graphics e as tomadas geradas.

### Quais modelos de vídeo, imagem e fala ele pode usar?

Para vídeo: Seedance, Kling, Veo (pelo Google ou pelo Google Cloud), Runway, Wan, MiniMax e Vidu, além de Atlas e MuAPI. Para imagens: Gemini, e OpenAI ou qualquer endpoint compatível com OpenAI, incluindo o Seedream. Para fala: OpenAI, Doubao, MiniMax, Alibaba (Qwen e CosyVoice), Google, ElevenLabs e endpoints compatíveis com OpenAI. Todos funcionam com suas próprias chaves. Veja [Use seus próprios provedores de geração](#use-seus-próprios-provedores-de-geração).

### Qual é a diferença dele para o Remotion ou o HyperFrames?

O HyperFrames é uma dependência: ele renderiza as cenas HTML e captura os quadros, e o ffmpeg cuida da edição e das medições. O Remotion é um framework em que você escreve código React para cada quadro. O OrkasVideoStudio é a camada construída sobre eles com a qual o seu agente trabalha: o conhecimento de vídeo contido nas habilidades, as verificações de entrega, a pasta de produção editável e o canvas no navegador. Veja [OrkasVideoStudio vs. frameworks, editores SaaS e wrappers](#orkasvideostudio-vs-frameworks-editores-saas-e-wrappers).

### Como instalar?

Instale a partir do código-fonte: clone o repositório, execute `pnpm install && pnpm build` e depois verifique sua configuração com `ovs doctor`. Você precisa do Node 22 ou mais recente, do pnpm, e do ffmpeg e do ffprobe. Os pacotes npm ainda não foram publicados. Veja [Instalação](#instalação).

---

## Relação com o Orkas

O OrkasVideoStudio começou como o **agente de vídeo integrado ao [Orkas](https://orkas.ai?source=gh-orkas-vs)**, o aplicativo para desktop com uma equipe de IA. Ele foi validado de ponta a ponta lá e depois extraído para este kit de ferramentas com licença MIT, independente de agente.

- **Dentro do Orkas**, ele vem como um [agente integrado](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs), sem instalação separada. Você conversa com ele em um aplicativo para desktop em vez de um terminal, e a geração pode rodar nos modelos integrados do Orkas (contas novas ganham 500 créditos grátis) ou nas suas próprias chaves. [Baixe o Orkas](https://orkas.ai/download/?source=gh-orkas-vs) para macOS ou Windows.
- **Em qualquer outro lugar**, você o instala no seu próprio agente de programação, como descrito acima, e obtém os mesmos recursos principais pela CLI `ovs`, pelo servidor MCP e pelo canvas. Os recursos da conta Orkas, como provedores hospedados, créditos e publicação no chat, não fazem parte deste repositório.

Links: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[este repositório](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Pacotes

| Pacote | O que é |
|---|---|
| `@orkas/video-studio-core` | esquemas da linha do tempo de cenas e da EDL legada, verificações de entrega, auxiliares de decisão, timing da narração, ambiente de execução e configuração |
| `@orkas/video-studio-tools` | backends de linha do tempo, renderização, edição, análise, fala, imagem e vídeo, além do canvas no navegador |
| `@orkas/video-studio` | a CLI `ovs` |
| `@orkas/video-studio-mcp` | o servidor MCP (`ovs-mcp`), que espelha a CLI |
| `@orkas/video-studio-skills` | o pacote de conhecimento `SKILL.md` independente do host |

O plano técnico e o histórico dele ficam em [`PLAN.md`](./PLAN.md). As notas para agentes de programação que trabalham neste repositório estão em [`AGENTS.md`](./AGENTS.md).

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

O `pnpm install` aplica o patch versionado do HyperFrames que fica em [`patches/`](./patches/), que faz a saída SDR H.264/H.265 usar a matriz BT.709 declarada nos metadados dela. Um `OVS_HYPERFRAMES_BIN` externo ou o fallback de compatibilidade via `npx` não recebe esse patch, então esse ambiente de execução precisa incluir uma correção de cor equivalente. O patch também preserva as marcações de tempo por palavra do Whisper para chinês e japonês. Ambientes externos precisam oferecer o mesmo suporte.

O `test:video` nunca gasta créditos de provedores. Um endpoint local falso do Seedance retorna uma fixture H.264 real, que o OVS baixa e verifica com `ffprobe`.

O `test:video:e2e` cobre os dois caminhos de produção pela CLI compilada:

- **O caminho anterior, por composição.** Ele cria uma produção 1080p de nove segundos e três cenas com composition prepare/reconcile, snapshot, o draft gate completo, as legendas embutidas e as verificações de promessa no arquivo final. Ele decodifica o MP4 inteiro e verifica a ordem das cenas, o movimento visível, o áudio audível em todas as cenas e os pixels das legendas embutidas, além de confirmar que uma duração de entrega errada é rejeitada.
- **A linha do tempo de cenas atual.** Ele renderiza uma linha do tempo de três cenas pelo caminho real de check e snapshot do HyperFrames. Verifica as cores das cenas, o movimento definido nas cenas, o movimento decodificado do vídeo de origem, os pixels das legendas, o áudio, a entrega imutável e a rejeição de renderizações desatualizadas.

Ele também exercita as interfaces da CLI compilada e do MCP. Os dois comandos de vídeo falham com um erro acionável quando falta um ambiente de execução necessário. A suíte de testes comum pode pular os casos que dependem muito de ambientes de execução em máquinas sem ffmpeg ou sem navegador.

O `pnpm verify` precisa passar no candidato final antes de qualquer commit no Git ou PR. Ele inclui o caso de produção real e também é o ponto de entrada da CI, e as mudanças que só alteram testes seguem a mesma regra. Para uma revisão de sincronização ou de release, guarde e inspecione o vídeo produzido, as prévias, os quadros finais e os relatórios:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

O diretório de evidências é opcional, e cada execução usa o próprio subdiretório. As execuções comuns da CI limpam a mídia temporária. As fixtures usam HTML/SVG originais e áudio instrumental gerado localmente. Elas não chamam provedores pagos nem afirmam cobrir a qualidade de TTS ou de modelos.

O `pnpm benchmark` não usa chaves e é determinístico. Ele compila o pacote core, verifica as fixtures do benchmark e, depois, mede as transições de gate, a validação de EDL e os resumos de entrega, a validação do composition-manifest e a estimativa de narração. Cada suíte tem um piso de throughput deliberadamente conservador, de modo que grandes regressões falham e a variação normal entre máquinas, não.

O [guia de avaliação opcional de modelos](./eval/video/README.md), em inglês, explica a configuração, os comandos e como armazenar as evidências.

## Versões

Todos os pacotes compartilham uma única versão de calendário, `YYYY.M.D` (data de Asia/Shanghai, sem zeros à esquerda). Os releases com tag usam `v<version>` e são publicados como [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); uma versão de data publicada nunca é sobrescrita. As mudanças estão listadas no [CHANGELOG.md](CHANGELOG.md). Essa versão é independente do aplicativo para desktop do Orkas e das versões dos agentes do mercado de agentes dele.

## Licença

MIT — veja [`LICENSE`](./LICENSE). A renderização usa a dependência [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, com licença Apache-2.0. A edição e as verificações de mídia usam o `ffmpeg` do seu sistema, e a transcrição é delegada ao HyperFrames / whisper.cpp. O [`PLAN.md`](./PLAN.md) explica como os ambientes de execução de terceiros são localizados, junto com as notas de licenciamento.
