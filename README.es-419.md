# OrkasVideoStudio

> OrkasVideoStudio es un editor de video con IA de código abierto que convierte tu agente de programación en un estudio de video. Pídele un video terminado a Claude Code, Codex, Cursor o cualquier agente que pueda ejecutar una shell o comunicarse por MCP. El agente edita tus grabaciones, diseña motion graphics, agrega narración, música y subtítulos, genera con tus propias claves las tomas que faltan y entrega un MP4 verificado. Puedes seguir editando ese MP4 en un lienzo desde el navegador.

**Una alternativa de código abierto a Claude Motion, CapCut y Higgsfield, controlada por el agente de programación que ya usas.** Tiene licencia MIT y prioridad local, y no requiere un plan Claude Team o Enterprise ni una suscripción a una plataforma de video: las tomas generadas vienen de Seedance, Kling, Veo y otros modelos de video que usas con tus propias claves. [Cómo se compara ↓](#cómo-se-compara)

**¿Prefieres una app en lugar de un agente de programación?** OrkasVideoStudio también es el agente de video integrado en **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, la app de escritorio gratuita con un equipo de IA para macOS y Windows. Describe el video en el chat; la generación se ejecuta con los modelos integrados de Orkas (las cuentas nuevas reciben 500 créditos gratis) o con tus propias claves. **[Descargar Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Cómo se relacionan ↓](#relación-con-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*El video de presentación de 54 segundos de arriba muestra cómo un solo brief se convierte en un video terminado: cortar grabaciones reales, diseñar la animación, agregar voz, música y subtítulos, explorar tomas en un lienzo y luego cambiar los textos, reemplazar tomas o reordenar las escenas.*

OrkasVideoStudio **no es un agente de video de caja negra**. El que razona es tu agente. Este proyecto le da las piezas que no puede improvisar:

- **Conocimiento de video.** Un paquete de skills `SKILL.md` que no depende de ningún host, con `video-studio` como skill de entrada. Explica cuándo preguntar y cuándo continuar, en qué se diferencian los anuncios, los videos explicativos, las demos de producto, los montajes musicales, los videos con presentador, los cortometrajes y los videos de comentario, y cómo revisar una edición antes de darla por terminada.
- **Herramientas deterministas.** La CLI `ovs` y un servidor MCP que la replica. Abarcan la línea de tiempo de producción, la edición con ffmpeg, la transcripción, el análisis de las grabaciones y la generación mediante tus propias cuentas de proveedor. [HyperFrames](https://github.com/heygen-com/hyperframes) se encarga de renderizar las páginas y capturar los fotogramas; `ffmpeg`, de la edición y las mediciones.
- **Una producción editable.** Cada video es una carpeta común y corriente: una línea de tiempo de escenas (`videos/main/manifest.json`), un registro de recursos, datos del producto con su fuente y una página diseñada opcional. Tú, tu agente y el lienzo del navegador editan los mismos archivos. Cambia una línea de texto, reemplaza una imagen o reordena las escenas, y vuelve a renderizar.

La edición, los motion graphics diseñados, los subtítulos y la transcripción **no requieren claves de API**. La generación de imágenes, video y voz solo se usa si la activas y funciona con **tus propias** cuentas de proveedor. No hay un backend alojado ni necesitas crear una cuenta.

---

## Qué puedes pedir

Lo pides una sola vez y recibes un video terminado. El agente combina en una sola línea de tiempo todo lo que la solicitud requiera:

| Capacidad | Qué abarca |
|---|---|
| **Editar grabaciones reales** | Recorta, une, reencuadra a 9:16 / 1:1 / 16:9, conserva o mezcla el sonido de los clips, superpone elementos, incrusta subtítulos y normaliza la sonoridad. En grabaciones largas también puede encontrar los mejores momentos, jerarquizar las tomas repetidas y eliminar silencios o muletillas, y registra la evidencia de cada corte. |
| **Animación diseñada** | Escenas hechas en HTML/CSS con animación: tipografía cinética, tarjetas de precio, tercios inferiores, datos destacados y transiciones. Los textos editables se guardan en campos de texto con nombre, así que cambiar un texto nunca implica reconstruir una escena. |
| **Sonido y subtítulos** | Narración para cada escena, ajustada a su duración. Música de fondo con licencia que baja de volumen cuando alguien habla. Subtítulos a partir del texto de la narración o de los tiempos medidos de cada palabra. Cortes sincronizados con el ritmo. |
| **Tomas generadas** | Imágenes, clips de video y presentadores generados (talking head) con el proveedor que configuraste, para tomas que tu material no puede mostrar. Solo se generan dentro del gasto que apruebes. |

Si pides un guion o un storyboard, el agente se detiene en el documento. Si pides un video terminado, trabaja hasta la entrega. Solo te muestra un plan o una vista previa si lo pediste o si el video dura más de unos dos minutos. Si escribe un guion que el video debe seguir palabra por palabra, primero te lo muestra; si el guion lo das tú, se produce tal como está escrito.

---

## Motion graphics en Claude Code, sin un plan Team

Claude Motion, la función de animación de Anthropic, está en beta y solo está disponible en los planes Claude Team y Enterprise. OrkasVideoStudio le da a Claude Code el mismo tipo de motion graphics hechos con código con los planes Pro, Max o Ultra, o con una clave de API: el agente escribe cada escena en HTML y CSS con animación, inspecciona fotogramas de muestra y renderiza un MP4 en tu computadora, por lo que el renderizado en sí no consume tokens.

1. [Instala](#instalación) OrkasVideoStudio y ejecuta `ovs skills --install --target claude` (o `--target codex` para Codex).
2. Pide el video, por ejemplo: *“Haz un video de motion graphics de 20 segundos en 16:9 para el lanzamiento de nuestra app: una apertura con tipografía cinética y el nombre del producto, tres tarjetas de funciones que entren deslizándose y una tarjeta de cierre con el precio. Muéstrame una imagen fija de cada escena antes de renderizar”.*
3. Cambia tú mismo una palabra, un color o los tiempos en los archivos de escena o en el lienzo, o pídeselo al agente, y luego vuelve a renderizar.

A diferencia de Claude Motion, la misma línea de tiempo también puede incluir tus propias grabaciones, narración, música y subtítulos. Consulta [cómo se compara](#cómo-se-compara).

---

## Casos de uso

Cada fila es una instrucción que podrías darle a tu agente. La skill `video-studio` elige las herramientas.

### Publicidad y marketing

| Tú dices… | Qué sucede |
|---|---|
| *“Haz un anuncio vertical de 20 segundos para esta lámpara de escritorio a partir de estas fotos y la página del producto”.* | Importa las fotos, registra el precio y las especificaciones como datos con su fuente, diseña las escenas del gancho, las funciones y el precio, agrega narración y subtítulos, y luego verifica, renderiza y entrega. |
| *“Haz un video de lanzamiento de 30 segundos para nuestra app a partir de su sitio web”.* | Captura las páginas reales del producto en tu navegador, usa las propias palabras y pantallas del producto, y arma las escenas en torno a ellas en vez de usar maquetas redibujadas. |
| *“Haz un video de 30 segundos en el que un presentador generado presente este sérum”.* | Primero escribe el monólogo, crea una imagen clave de un presentador ficticio y la reutiliza en cada clip, genera los clips hablados con tu proveedor de video y mantiene los precios y las afirmaciones como texto editable en pantalla. |
| *“Haz un video promocional de 15 s en 9:16 con este guion: genera la apertura, arma los textos destacados de las funciones y usa una sola voz en off”.* | Una sola línea de tiempo combina la apertura generada, las escenas de funciones diseñadas y una única pista de narración, y el archivo final se verifica antes de la entrega. |

### Cine y series

| Tú dices… | Qué sucede |
|---|---|
| *“Haz un cortometraje de un minuto sobre una enfermera del turno nocturno, con los mismos dos personajes en todas las tomas”.* | Construye la historia en torno a una sola pregunta dramática, mantiene una descripción de apariencia y una imagen clave por personaje para que se vean consistentes en todas las tomas, y genera las tomas con tu proveedor de video dentro del presupuesto que apruebes. |
| *“Convierte estos tres episodios de la serie en un resumen narrado de 3 minutos”.* | Transcribe los episodios, elige las escenas que sostienen la historia, omite los créditos y los avances del próximo episodio, escribe el resumen y le pone voz, y edita tus grabaciones debajo de la narración. |
| *“Genera una toma de 5 s de la ciudad al amanecer para la apertura”.* | Confirma el proveedor, el modelo y el costo, genera una toma con tu proveedor de video y la coloca en la línea de tiempo junto a tus grabaciones. |

### Edición

| Tú dices… | Qué sucede |
|---|---|
| *“Convierte esta grabación de pantalla de 1 hora en tres clips de 30 s con los mejores momentos y subtítulos”.* | El análisis de escenas y de calidad encuentra las partes buenas. Las tomas repetidas se jerarquizan, los silencios y las muletillas se eliminan, y los subtítulos se incrustan según los tiempos medidos de cada palabra. |
| *“Quita los silencios y los ‘eh’ de mi grabación con la webcam y hazla más dinámica”.* | Detecta los silencios y las muletillas, hace un jump cut determinista y registra la evidencia de cada fragmento eliminado. |
| *“Agrega una voz en off en inglés y subtítulos a product-demo.mp4, y nivela el volumen”.* | Transcribe el video, traduce cada línea y le pone voz dentro de la ventana de imagen que le corresponde, mezcla la voz sobre el sonido existente, incrusta los subtítulos y normaliza la sonoridad. |
| *“Edita estos 20 clips de nuestro viaje con esta canción, siguiendo el ritmo”.* | Mide los beats de la pista, corta los clips sobre ellos y verifica que el archivo entregado esté alineado con los beats. |

### Videos explicativos y tutoriales

| Tú dices… | Qué sucede |
|---|---|
| *“Haz un video explicativo de 60 s sobre bases de datos vectoriales con voz en off en chino”.* | Escribe escenas de motion graphics, sintetiza la narración con tu proveedor de TTS y ajusta cada línea a su escena. |
| *“Convierte mi grabación de pantalla de la página de configuración en un tutorial de 90 segundos”.* | Recorta la grabación, señala paso a paso cada control en la interfaz real, y agrega narración y subtítulos. |

### Recrear videos populares

| Tú dices… | Qué sucede |
|---|---|
| *“Recrea la estructura y el ritmo de este video viral para mi producto. Muéstrame primero el plan”.* | Analiza la referencia parte por parte, asigna sus momentos clave a tu material y espera tu aprobación antes de producir. |
| *“Este anuncio de la competencia funciona bien. Haz el nuestro con el mismo gancho y el mismo ritmo, usando nuestras fotos”.* | Retoma de la referencia el ritmo de gancho, prueba y llamado a la acción, pero no su contenido. Cada afirmación viene de los datos de tu producto y cada imagen, de tu material. |

Dale a tu agente un **archivo de video de referencia** y tus propios recursos de producto, guion o grabaciones. Tu agente puede usar OrkasVideoStudio para recrear su **estructura narrativa, estilo visual y ritmo de edición** con el contenido nuevo:

1. **Analizar la referencia.** Revisar fotogramas de muestra y el audio relevante para identificar el gancho, la demostración o prueba, el orden de la información, la tipografía, las transiciones, el ritmo y el llamado a la acción.
2. **Planear la adaptación.** Definir qué se conserva y qué se reemplaza, y luego asignar los momentos de la referencia a las escenas nuevas o a la línea de tiempo. Adaptar los tiempos a tu narración real y al tiempo de lectura.
3. **Producir y revisar.** Componer motion graphics, editar tus grabaciones y generar los visuales que falten cuando sea necesario. Los textos, subtítulos, narraciones y clips creados localmente se pueden editar por separado. El texto incrustado en un video generado solo se puede cambiar modificando ese video.

Esto funciona mejor para videos explicativos con motion graphics, demos de SaaS y de apps, y anuncios de producto hechos con grabaciones existentes. Empieza con un archivo que tu agente pueda leer, porque la descarga desde enlaces compartidos de redes sociales no viene incluida. No se garantiza replicar con exactitud los movimientos de cámara ni las actuaciones de personas, ni una coincidencia cuadro por cuadro. Las verificaciones de entrega no califican qué tanto se parece el resultado a la referencia. Para más detalles, consulta el [flujo de trabajo para recrear videos de referencia](./packages/skills/video-craft/references/reference-recreation.md).

---

## Instalación

**Requisitos previos:** Node ≥ 22, `pnpm` y `ffmpeg` + `ffprobe` en tu `PATH`. El paquete [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, con versión fija, se instala como dependencia y renderiza las páginas en Chrome headless para las verificaciones y el renderizado; `npx` solo es una alternativa de compatibilidad. La generación es opcional y requiere tus propias claves.

### Desde el código fuente

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

Los paquetes de npm aún no están publicados, así que por ahora instálalo desde el código fuente.

---

## Contrólalo desde Claude Code, Codex o cualquier agente de programación

La CLI `ovs` es la interfaz canónica, y las herramientas MCP la replican. Usa la opción que tu agente soporte:

**1) Skills nativas (Claude Code / Codex).** Instala el paquete de skills para que el agente lo encuentre por sí solo:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

El mismo paquete de skills aparece en [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), así que `npx skills add orkas-ai/orkas-videostudio` también lo instala. Las skills llaman a la CLI `ovs`, así que primero instálala como se explica arriba.

**2) Herramientas MCP.** Registra el servidor:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) CLI autodescriptiva (cualquier agente con shell).** No se necesita ningún cargador:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Luego solo pídele un video a tu agente. Lo primero que hace es leer `video-studio`, y luego carga las referencias de etapa y de técnica que necesite.

---

## Cómo funciona una producción

El agente elige un nombre corto para la carpeta y guarda todo ahí:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

El orden de las escenas es el orden de reproducción. Los tiempos de inicio y la duración total se calculan a partir de las escenas y nunca se almacenan, así que mover una escena no puede dejar los tiempos inconsistentes. Un precio se define una sola vez en `product.json`, y cada escena que lo muestra lo lee desde ahí. Para variantes paralelas, como otras relaciones de aspecto, otros idiomas o ediciones A/B, el agente agrega más IDs de video que comparten los mismos recursos. Consulta el [contrato de la línea de tiempo](packages/skills/video-studio/references/timeline.md).

Una ejecución típica:

```text
ovs timeline import   --production lamp-ad --inputs '["/path/to/lamp.jpg"]'
ovs timeline prepare  --production lamp-ad --video-id main
ovs timeline check    --production lamp-ad --video-id main
ovs timeline snapshot --production lamp-ad --video-id main --out lamp-ad/preview.png
#   the agent inspects every sampled frame and fixes confirmed problems in one batch
ovs timeline render   --production lamp-ad --video-id main --out lamp-ad/render/main.mp4
ovs timeline ship     --production lamp-ad --video-id main --input lamp-ad/render/main.mp4
```

`ship` mide el archivo final antes de registrarlo: duración, tamaño de imagen y frecuencia de fotogramas, audio, sonoridad y cobertura de la narración. Las advertencias de subtítulos se marcan para confirmarlas visualmente, y se devuelven fotogramas del MP4 real. Cada entrega se convierte en una versión inmutable. Un render hecho antes del último cambio se rechaza por desactualizado, y las entregas anteriores nunca se sobrescriben. Pasar estas verificaciones no certifica la calidad visual. La revisión visual cuenta como `not_checked` hasta que alguien realmente mire los fotogramas.

Cuando aceptes explícitamente un hallazgo pendiente específico, pasa su código exacto con `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. La versión registra esa decisión, y cualquier otro error sigue bloqueando la entrega. Las escrituras se serializan con `.ovs-timeline.lock`; si un cierre inesperado lo deja sin borrar, confirma que el proceso propietario ya se detuvo antes de eliminarlo. El [contrato de la línea de tiempo](packages/skills/video-studio/references/timeline.md) explica ambos casos.

**Las revisiones siguen siendo económicas y locales.** Si cambias una palabra, un corte, el orden, la música de fondo o un subtítulo, se edita directamente. Solo se vuelve a generar la voz de una línea hablada que haya cambiado, y solo se regenera una toma incorrecta, dentro del gasto ya aprobado. Editar el texto de los subtítulos no cambia el audio hablado. HyperFrames renderiza el video completo cada vez; esta compilación portable no guarda en caché las escenas renderizadas.

---

## Lienzo de video en el navegador

Cuando `timeline import`, `timeline prepare`, `timeline render` o `timeline ship` terminan correctamente (desde la CLI o MCP), OVS abre el lienzo de esa producción en tu navegador predeterminado. Los comandos siguientes reutilizan la misma pestaña en vez de abrir otras. El lienzo edita los mismos archivos que la CLI y MCP, así que los cambios van en ambas direcciones. Mientras el agente está trabajando, el lienzo se muestra en modo de solo lectura.

En el lienzo puedes:

- **Ver y exportar.** Reproducir el video, cambiar entre las versiones entregadas y descargar la que quieras.
- **Organizar el material.** Subir, arrastrar y soltar o pegar grabaciones, y luego mover y conectar tarjetas en el tablero.
- **Editar escenas.** Cambiar textos, orden e imágenes, y agregar, quitar o volver a poner escenas.
- **Generar y rehacer tomas.** Crear una nueva toma de imagen o video a partir de una tarjeta, o volver a generar una toma existente. Tú eliges las referencias o el primer y último fotograma, además del modelo, la resolución y el sonido; las opciones que un modelo no soporta se desactivan. Puedes revisar uno por uno los resultados anteriores y elegir el que vas a usar. Antes de cada solicitud de pago, el lienzo te pide confirmación.
- **Actualizar el video.** Las ediciones comunes de escenas se renderizan y se entregan localmente, y el progreso se muestra en la tarjeta del video. Cambiar un dato del producto, una línea de la narración o la voz de todo el video genera una solicitud para tu agente, porque esas ediciones requieren su criterio. Si la verificación de entrega detiene una actualización porque hay escenas con imágenes fijas, la tarjeta del video ofrece **Preview this version** (vista previa de esta versión), **Return to editing** (volver a editar) o **Update anyway** (actualizar de todos modos); Update anyway conserva ese render sin volver a renderizar.
- **Decirle al agente.** Escribir una solicitud breve sobre una escena, una toma, una tarjeta de grabación o un video. Se envía con el contexto de esa tarjeta.

El lienzo se abre en chino. Su botón de idioma cambia entre chino e inglés y recuerda tu elección.

### Enviar solicitudes de vuelta a tu agente

**Send** (enviar) solo entrega la solicitud a la conversación que creó la producción. Si esa conversación no puede recibirla, el borrador se queda en el lienzo. No se copia nada al portapapeles, no se reenvía automáticamente ni se manda a una sesión nueva. La edición, la actualización y la exportación siguen funcionando sin un agente conectado.

- **Codex.** Cuando `ovs` se ejecuta dentro de un hilo de Codex, la solicitud se pone en cola en ese mismo hilo. Esto requiere Codex CLI 0.160.1 o posterior, con su app server local en ejecución. Un hilo cerrado o que no está cargado aparece como no disponible.
- **Claude Code.** Las solicitudes llegan a través de un canal MCP, que es una función de Claude Code en vista previa de investigación (research preview); una conexión MCP normal no es suficiente. Registra el servidor con `--claude-channel` y luego inicia Claude Code con el canal habilitado:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Crea el video con las herramientas MCP de `ovs` para que el lienzo se abra vinculado a ese canal. Un lienzo abierto desde la CLI en la shell no puede comunicarse con Claude Code. Claude Code muestra una advertencia de desarrollo local al iniciar. Los canales requieren iniciar sesión en claude.ai o una clave de API de Console, y en los planes Team y Enterprise un administrador tiene que habilitarlos primero. Consulta [Canales de Claude Code](https://code.claude.com/docs/en/channels).

### Abrir una producción por tu cuenta

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Deja el comando en ejecución mientras usas el lienzo. Con `--agent`, el lienzo ejecuta en la carpeta de la producción una sesión nativa que usa el inicio de sesión, el modelo y la configuración de permisos de tu propia CLI. Esa sesión requiere Codex 0.160.1+ o Claude Code 2.1.148+. Sus solicitudes de permiso y sus preguntas aparecen en el lienzo. El lienzo restaura la sesión guardada de la carpeta, a menos que pases `--resume <session-id>` para transferirle una sesión específica o `--new-session` para empezar desde cero. Otras opciones:

- `--no-open` muestra el enlace de acceso sin abrir un navegador.
- `--port` define el puerto de loopback.
- `--recover` recupera un lienzo cuyo dueño anterior ya terminó.

Para desactivar la apertura automática durante el trabajo de producción, establece `OVS_STUDIO_AUTO_OPEN=0`. En CI ya viene desactivada.

---

## Trae tus propios proveedores de generación

Configura los proveedores en `~/.config/orkas-video-studio/config.json` (o `$OVS_CONFIG_DIR/config.json`) o con variables de entorno. Las variables de entorno tienen prioridad sobre el archivo.

```json
{
  "tts":   { "provider": "openai", "api_key": "…", "model": "gpt-4o-mini-tts", "voice": "…" },
  "image": { "provider": "gemini", "api_key": "…" },
  "video": { "provider": "kling", "api_key": "…", "model": "…" }
}
```

| Capacidad | Valores de `provider` | Entorno |
|---|---|---|
| Voz (`ovs speak`) | `openai`, `openai-compatible`, `doubao`, `minimax`, `aliyun` (Qwen / CosyVoice), `google`, `elevenlabs` | `OVS_TTS_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` · `_VOICE` · `_FORMAT` · `_PROXY_URL` |
| Imagen (`ovs image`) | `openai` (cualquier endpoint compatible con OpenAI, incluido Seedream), `gemini` | `OVS_IMAGE_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |
| Video (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Puedes revisar una configuración sin hacer ninguna llamada de pago:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Ejecuta `ovs narration fit` antes y después de la síntesis para que cada línea de la narración quede dentro de la ventana de su escena o del plan. La generación de video recibe explícitamente las imágenes de referencia, la relación de aspecto, la duración, la resolución y los indicadores de audio, para que la llamada al proveedor coincida con el plan aprobado. En proyectos con `plan.json`, `ovs plan validate` también verifica la relación de aspecto, la duración y la operación de cada segmento de generación contra el `video.provider` configurado antes de generar cualquier cosa.

Algunos proveedores necesitan unos ajustes más:

- **Google Cloud Veo** usa `video.workspace_id`, `video.region`, y un token de API o un JSON de cuenta de servicio en `video.api_key`.
- **Alibaba** usa, para voz, su endpoint de espacio de trabajo en `tts.base_url`. Para video, Wan necesita `video.workspace_id` y `video.region`.
- **Las voces disponibles solo por clonación** necesitan el ID de voz que registraste con el proveedor.
- **La voz por WebSocket** pasa por `tts.proxy_url` solo si lo configuras.
- **Las referencias de video** se pasan como URLs públicas de imagen o video. La cantidad admitida y el soporte para primer y último fotograma varían según el modelo.
- **[MuAPI](https://muapi.ai)** se debe seleccionar explícitamente con `video.provider: "muapi"`. Cuando está seleccionado, `MUAPI_API_KEY` tiene prioridad sobre `OVS_VIDEO_API_KEY`; la clave nunca selecciona MuAPI por sí sola. `video.model` / `OVS_VIDEO_MODEL` soporta los endpoints validados de Kling v2.1 `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` y `kling-v2.1-pro-i2v`. Otros slugs se rechazan en vez de enviarse con un cuerpo que no corresponde. Para texto a video, el valor predeterminado es `kling-v2.1-master-t2v`, y con un `image_url` de primer fotograma, el predeterminado es `kling-v2.1-master-i2v`. La duración es de 5 o 10 segundos y la relación de aspecto es `16:9`, `9:16` o `1:1`. Las entradas `resolution`, `generate_audio` y `quality`, que no dependen del proveedor, siguen siendo compatibles con los planes firmados: Kling ignora la resolución y el audio, y la calidad se valida pero no se envía. Los controles de edición y de referencias adicionales se rechazan hasta que se soporte un esquema de MuAPI equivalente. La URL base predeterminada incluye `/api/v1`, y una personalizada también debe incluirlo. Consulta la [referencia de la API de MuAPI](https://muapi.ai/docs/api-reference) para conocer el contrato de envío y consulta periódica (polling), y los parámetros específicos de cada modelo.

Los catálogos de modelos de los proveedores describen el contrato de API de cada uno. No garantizan la disponibilidad en tiempo real ni los precios.

---

## Qué mantiene la generación bajo control

El agente usa tu material existente siempre que sirva para la toma, y solo genera lo que falta. Tener credenciales configuradas no cuenta como aprobación para gastar. Antes de cualquier trabajo de pago, el agente confirma el proveedor, el modelo, el propósito, la cantidad de solicitudes (incluidos los reintentos) y el costo estimado. Después se apega a ese alcance. Si no lo apruebas, se detienen las llamadas de pago para esa solicitud, y una toma defectuosa tiene como máximo dos intentos corregidos antes de que el agente te pida cambiar de enfoque.

Cada solicitud de pago guarda un comprobante junto a su archivo de salida. Una tarea de video con resultado desconocido bloquea cualquier otro envío al mismo archivo de salida hasta que la revises, y nunca se repite automáticamente. Consulta [la autorización de generación](packages/skills/video-studio/references/generation.md).

`ovs speak` escribe un comprobante de la solicitud y del audio junto a su archivo de salida. Solo reutiliza una solicitud que coincida exactamente y cuyos bytes de audio estén intactos, así que pasa el `--language`, la voz, el modelo, la velocidad y el formato aprobados; si cambias cualquiera de ellos, ya no se puede reutilizar. Además, reserva el archivo de salida antes de enviar la solicitud, lo que evita llamadas duplicadas simultáneas.

No hay un servicio de música alojado. La música viene de archivos con licencia que tú proporcionas, y el agente registra la fuente y la licencia de cada archivo.

---

## Referencia de comandos

Ejecuta `ovs <command> --help` para ver la entrada tipada de cada comando. Las herramientas MCP usan los mismos nombres con guiones bajos, por ejemplo, `timeline_prepare` y `edit_trim_silence`.

| Área | Comandos |
|---|---|
| Configuración inicial | `doctor`, `skills [--install]`, `skill <name>` |
| Producción | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edición (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Análisis | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narración | `narration timing · fit`, `speech-capabilities`, `speak` |
| Generación | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Proyectos anteriores | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias de `check`) |

Los proyectos hechos con los formatos anteriores, el EDL `plan.json` y `composition-manifest.json`, siguen funcionando mediante los comandos de “Proyectos anteriores”. El trabajo nuevo usa la línea de tiempo de escenas. Para un `plan.json` ensamblado, verifica el archivo terminado además del material que lo compone:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

La herramienta MCP equivalente, `plan_promise_check`, acepta `probe_produced` y `video`. Mide la duración, el tamaño de imagen y la frecuencia de fotogramas, el audio, la sonoridad integrada y los segmentos con voz de cada línea. Si falta evidencia de la narración, la verificación falla, y las advertencias de subtítulos requieren una revisión visual cuando los subtítulos se incrustaron.

---

## Cómo se compara

### OrkasVideoStudio vs. Claude Motion vs. CapCut vs. Higgsfield

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **Qué es** | un estudio de video de código abierto que controla tu agente de programación | una salida de animación dentro de Claude | una app de edición de video de ByteDance | una plataforma alojada de imagen y video con IA |
| **Quién puede usarlo** | cualquier persona; se ejecuta en tu computadora con Claude Code, Codex, Cursor o cualquier agente que ejecute una shell o se comunique por MCP | planes Claude Team y Enterprise (beta) | apps de escritorio, para celular y web, con planes gratuitos y de pago | una cuenta de Higgsfield, gratuita o con un plan mensual de créditos, a través de su app web, su API, su conector MCP o su CLI |
| **Cómo editas** | le describes el cambio a tu agente, o cambias textos, imágenes y el orden de las escenas en el lienzo del navegador | en el editor de Claude o pidiéndoselo a Claude | a mano, en una línea de tiempo | con una instrucción para cada generación o edición, en sus estudios web o desde tu agente a través de su conector |
| **Grabaciones** | recorta, une, reencuadra a 9:16 / 1:1 / 16:9, elimina silencios y muletillas, corta siguiendo el ritmo | anima textos, gráficas, formas e imágenes; no incluye video ni personas generados | edición manual completa | ediciones con IA sobre un clip: eliminar o reemplazar objetos y fondos, cambiar el estilo, reencuadrar, aumentar la resolución o extender una toma |
| **Motion graphics** | escenas HTML/CSS: tipografía cinética, tarjetas de precio, tercios inferiores, datos destacados, transiciones | animaciones explicativas hechas con código | plantillas, animaciones de texto y efectos | títulos, transiciones y animaciones de logo que su AI Motion Designer crea en After Effects o Premiere Pro |
| **Sonido** | narración por escena, música de fondo que baja de volumen cuando alguien habla, subtítulos a partir de los tiempos medidos de cada palabra | no se menciona en el artículo de ayuda de Anthropic | herramientas de voz, música y subtítulos dentro de la app | voz en off con IA, traducción de voz y sincronización labial |
| **Tomas generadas** | imágenes, clips de video y presentadores de los proveedores que configures, como Seedance 2.5, Kling 4.0, Veo 3.1 en Google Cloud, Runway Gen-4.5 y Wan 3.0, que se cobran a través de tus propias claves | ninguna | un generador de video con IA que parte de un guion o de una imagen | muchos modelos alojados en una sola cuenta, incluidos Seedance 2.5, Kling 4.0, Veo 3.1 y MAGI-2, que solo ofrece Higgsfield |
| **Salida** | MP4 con la duración, el tamaño de imagen y la frecuencia de fotogramas, la sonoridad y la narración verificados antes de la entrega | exportación a MP4 | exportación a MP4 | clips e imágenes generados, y videos de sus apps de estudio |
| **Código fuente** | MIT; cada video es una carpeta local que te pertenece | propietario, alojado | propietario | propietario, alojado |

Elige **CapCut**, o un editor de línea de tiempo de código abierto como Shotcut o Kdenlive, si quieres editar a mano. Elige **Claude Motion** si tu equipo ya trabaja en Claude con un plan Team o Enterprise y necesita animaciones explicativas. Elige **Higgsfield** si quieres muchos modelos alojados con una sola factura, o un modelo que solo ofrece esa plataforma, como MAGI-2. Elige **OrkasVideoStudio** si quieres que tu agente de programación haga todo el video, con grabaciones, animación y sonido en una sola línea de tiempo y con tus propias claves de proveedor, y conservar el resultado como archivos que puedes revisar, editar y volver a renderizar. Higgsfield y OrkasVideoStudio también se pueden usar juntos: los clips que generes en Higgsfield son material común para una producción de OrkasVideoStudio. La información proviene del [centro de ayuda de Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), de la [página del generador de video con IA de CapCut](https://www.capcut.com/tools/ai-video-generator) y de [higgsfield.ai](https://higgsfield.ai/), con datos de noviembre de 2026.

---

## Preguntas frecuentes

### ¿Claude Code puede hacer videos?

Sí. Con OrkasVideoStudio instalado, Claude Code lee la skill `video-studio` y usa la CLI `ovs` o las herramientas MCP para editar grabaciones, crear motion graphics, agregar narración y subtítulos, y renderizar en tu computadora un MP4 verificado. Codex, Cursor y cualquier otro agente que pueda ejecutar una shell o comunicarse por MCP funcionan de la misma manera. Consulta [Contrólalo desde Claude Code, Codex o cualquier agente de programación](#contrólalo-desde-claude-code-codex-o-cualquier-agente-de-programación).

### ¿Es gratis y necesito claves de API?

OrkasVideoStudio es gratis y tiene licencia MIT. La edición, los motion graphics diseñados, los subtítulos y la transcripción se ejecutan localmente y no requieren claves de API. La generación de imágenes, clips de video o voz es opcional y usa tus propias cuentas de proveedor, que te cobran directamente. Antes de cualquier llamada de pago, el agente confirma contigo el proveedor, el modelo, la cantidad de solicitudes y el costo estimado. Consulta [Qué mantiene la generación bajo control](#qué-mantiene-la-generación-bajo-control).

### ¿Es una alternativa de código abierto a Claude Motion, CapCut y Higgsfield?

Sí. Al igual que Claude Motion, hace que Claude Code escriba motion graphics como código, pero funciona con Claude Code en los planes Pro, Max o Ultra o con una clave de API, no solo en los planes Team y Enterprise, y también con otros agentes. A diferencia de CapCut, es tu agente el que hace las ediciones a partir de tu descripción, en vez de que tú cortes a mano en una línea de tiempo. A diferencia de Higgsfield, no aloja modelos ni vende créditos: tu agente llama a Seedance, Kling, Veo y otros modelos de video con tus propias claves, y luego combina las tomas con tus grabaciones, motion graphics, narración y subtítulos. Consulta [Cómo se compara](#cómo-se-compara).

### ¿Puede editar las grabaciones que ya tengo?

Sí. Recorta y une clips, los reencuadra a 9:16, 1:1 o 16:9, elimina silencios y muletillas, corta siguiendo el ritmo, incrusta subtítulos y normaliza la sonoridad. Tus grabaciones van en la misma línea de tiempo que los motion graphics y las tomas generadas.

### ¿Qué modelos de video, imagen y voz puede usar?

Para video: Seedance, Kling, Veo (mediante Google o Google Cloud), Runway, Wan, MiniMax y Vidu, además de Atlas y MuAPI. Para imágenes: Gemini, y OpenAI o cualquier endpoint compatible con OpenAI, incluido Seedream. Para voz: OpenAI, Doubao, MiniMax, Alibaba (Qwen y CosyVoice), Google, ElevenLabs y endpoints compatibles con OpenAI. Todos funcionan con tus propias claves. Consulta [Trae tus propios proveedores de generación](#trae-tus-propios-proveedores-de-generación).

### ¿Cómo lo instalo?

Instálalo desde el código fuente: clona el repositorio, ejecuta `pnpm install && pnpm build` y luego verifica tu configuración con `ovs doctor`. Necesitas Node 22 o posterior, pnpm, y ffmpeg y ffprobe. Los paquetes de npm aún no están publicados. Consulta [Instalación](#instalación).

---

## Relación con Orkas

OrkasVideoStudio empezó como el **agente de video integrado en [Orkas](https://orkas.ai?source=gh-orkas-vs)**, la app de escritorio con un equipo de IA. Ahí se probó de punta a punta y luego se extrajo a este kit de herramientas con licencia MIT, que funciona con cualquier agente.

- **Dentro de Orkas**, viene como [agente integrado](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) y no requiere una instalación aparte. Chateas con él en una app de escritorio en lugar de una terminal, y la generación puede ejecutarse con los modelos integrados de Orkas (las cuentas nuevas reciben 500 créditos gratis) o con tus propias claves. [Descarga Orkas](https://orkas.ai/download/?source=gh-orkas-vs) para macOS o Windows.
- **En cualquier otro lugar**, lo instalas en tu propio agente de programación como se explica arriba y obtienes las mismas capacidades principales mediante la CLI `ovs`, el servidor MCP y el lienzo. Las funciones de la cuenta de Orkas, como los proveedores alojados, los créditos y la publicación de chats, no forman parte de este repositorio.

Enlaces: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[este repositorio](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Paquetes

| Paquete | Qué incluye |
|---|---|
| `@orkas/video-studio-core` | esquemas de la línea de tiempo de escenas y del EDL heredado, verificaciones de entrega, funciones auxiliares de decisión, tiempos de narración, entorno de ejecución y configuración |
| `@orkas/video-studio-tools` | backends para línea de tiempo, renderizado, edición, análisis, voz, imagen y video, además del lienzo del navegador |
| `@orkas/video-studio` | la CLI `ovs` |
| `@orkas/video-studio-mcp` | el servidor MCP (`ovs-mcp`), que replica la CLI |
| `@orkas/video-studio-skills` | el paquete de conocimiento `SKILL.md` que no depende de ningún host |

El plan técnico y su historial están en [`PLAN.md`](./PLAN.md). Las notas para los agentes de programación que trabajan en este repositorio están en [`AGENTS.md`](./AGENTS.md).

---

## Desarrollo

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

`pnpm install` aplica el parche versionado de HyperFrames de [`patches/`](./patches/), que hace que la salida SDR H.264/H.265 use la matriz BT.709 que declaran sus metadatos. Un `OVS_HYPERFRAMES_BIN` externo o la alternativa de compatibilidad con `npx` no reciben este parche, así que ese entorno de ejecución debe incluir una corrección de color equivalente. El parche también conserva las marcas de tiempo por palabra de Whisper para chino y japonés. Los entornos externos necesitan el mismo soporte.

`test:video` nunca gasta créditos de los proveedores. Un endpoint local que simula Seedance devuelve un fixture H.264 real, que OVS descarga y verifica con `ffprobe`.

`test:video:e2e` cubre ambas rutas de producción a través de la CLI compilada:

- **La ruta de composición anterior.** Crea una producción de nueve segundos, tres escenas y 1080p con composition prepare/reconcile, snapshot, la compuerta de borrador completa, el incrustado de subtítulos y las verificaciones promise-check sobre el archivo final. Decodifica todo el MP4 y verifica el orden de las escenas, el movimiento visible, que haya audio audible en cada escena y los píxeles de los subtítulos incrustados, además de que se rechace una duración de entrega incorrecta.
- **La línea de tiempo de escenas actual.** Renderiza una línea de tiempo de tres escenas mediante la ruta real de check y snapshot de HyperFrames. Verifica los colores de las escenas, el movimiento diseñado, el movimiento decodificado del video de origen, los píxeles de los subtítulos, el audio, la entrega inmutable y el rechazo de renders desactualizados.

También pone a prueba las interfaces de la CLI compilada y de MCP. Ambos comandos de video fallan con un error que indica cómo resolverlo cuando falta un entorno de ejecución necesario. La suite de pruebas normal puede omitir los casos que más dependen del entorno de ejecución en máquinas sin ffmpeg o sin navegador.

`pnpm verify` debe pasar en el candidato final antes de cualquier commit de Git o PR. Incluye el caso de producción real y también es el punto de entrada de CI, y los cambios que solo tocan pruebas siguen la misma regla. Para revisiones de sincronización o de release, conserva y revisa el video producido, las vistas previas, los fotogramas finales y los reportes:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

El directorio de evidencia solo se usa si lo activas, y cada ejecución usa su propio subdirectorio. Las ejecuciones normales de CI eliminan sus archivos multimedia temporales. Los fixtures usan HTML/SVG original y audio instrumental generado localmente. No llaman a proveedores de pago ni afirman cubrir la calidad del TTS o de los modelos.

`pnpm benchmark` no requiere claves y es determinista. Compila el paquete core, verifica los fixtures del benchmark y luego mide las transiciones de compuerta, la validación del EDL y los resúmenes de entrega, la validación del manifiesto de composición y la estimación de la narración. Cada suite tiene un umbral mínimo de rendimiento deliberadamente conservador, de modo que las regresiones grandes fallan y la variación normal entre máquinas no.

La [guía de evaluación opcional de modelos](./eval/video/README.md), en inglés, explica la configuración, los comandos y cómo guardar las evidencias.

## Versiones

Todos los paquetes comparten una única versión de calendario, `YYYY.M.D` (fecha en la zona horaria Asia/Shanghai, sin ceros a la izquierda). Las versiones etiquetadas usan `v<version>` y se publican como [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); una versión de fecha ya publicada nunca se sobrescribe. Los cambios se registran en [CHANGELOG.md](CHANGELOG.md). Esta versión es independiente de la app de escritorio de Orkas y de las versiones de sus agentes del marketplace.

## Licencia

MIT — consulta [`LICENSE`](./LICENSE). El renderizado usa la dependencia [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, con licencia Apache-2.0. La edición y las verificaciones multimedia usan el `ffmpeg` de tu sistema, y la transcripción se delega a HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) explica cómo se ubican los entornos de ejecución de terceros, junto con las notas de licencia.
