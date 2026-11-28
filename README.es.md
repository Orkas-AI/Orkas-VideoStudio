# OrkasVideoStudio

> OrkasVideoStudio es un editor de vídeo con IA de código abierto que convierte tu agente de programación en un estudio de vídeo. Pide un vídeo terminado a Claude Code, Codex, Cursor o cualquier agente que pueda ejecutar una shell o comunicarse por MCP. El agente edita tu material grabado, diseña motion graphics, añade narración, música y subtítulos, genera con tus propias claves las tomas que faltan y entrega un MP4 comprobado. Puedes seguir editando ese MP4 en un lienzo en el navegador.

**Una alternativa de código abierto a Claude Motion, CapCut y Higgsfield, controlada por el agente de programación que ya usas.** Con licencia MIT y con prioridad local, sin necesidad de un plan Claude Team o Enterprise ni de una suscripción a una plataforma de vídeo: las tomas generadas proceden de Seedance, Kling, Veo y otros modelos de vídeo, con tus propias claves. [Comparativa ↓](#comparativa)

**¿Prefieres una aplicación en lugar de un agente de programación?** OrkasVideoStudio también es el agente de vídeo integrado en **[Orkas](https://orkas.ai/?source=gh-orkas-vs)**, la aplicación de escritorio gratuita con un equipo de IA para macOS y Windows. Describe el vídeo en el chat; la generación se ejecuta con los modelos integrados de Orkas (las cuentas nuevas reciben 500 créditos gratis) o con tus propias claves. **[Descargar Orkas →](https://orkas.ai/download/?source=gh-orkas-vs)** · [Cómo se relacionan ↓](#relación-con-orkas)

[English](./README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Bahasa Indonesia](./README.id.md) · [Español (Latinoamérica)](./README.es-419.md) · [Русский](./README.ru.md) · [Português (Brasil)](./README.pt-BR.md) · [Türkçe](./README.tr.md) · [繁體中文](./README.zh-TW.md) · [Tiếng Việt](./README.vi.md) · [Deutsch](./README.de.md) · [ไทย](./README.th.md) · [Français](./README.fr.md) · [Italiano](./README.it.md) · [Português (Portugal)](./README.pt-PT.md) · [العربية](./README.ar.md)

https://github.com/user-attachments/assets/3d60ad25-7f4d-4599-b842-e6e45cce9fdf

*El vídeo de presentación de 54 segundos que aparece arriba muestra cómo un único briefing se convierte en un vídeo terminado: cortar material grabado real, diseñar la animación, añadir voz, música y subtítulos, explorar tomas en un lienzo y, después, cambiar los textos, sustituir tomas o reordenar las escenas.*

OrkasVideoStudio **no es un agente de vídeo de caja negra**. Quien piensa es tu agente. Este proyecto le da las piezas que no puede improvisar:

- **Conocimiento de vídeo.** Un paquete de skills `SKILL.md` independiente del host, con `video-studio` como skill de entrada. Explica cuándo preguntar y cuándo seguir adelante, en qué se diferencian los anuncios, los vídeos explicativos, las demos de producto, los montajes musicales, los vídeos con presentador, los cortometrajes y los vídeos de comentario, y cómo comprobar un montaje antes de darlo por terminado.
- **Herramientas deterministas.** La CLI `ovs` y un servidor MCP que la replica. Cubren la línea de tiempo de producción, la edición con ffmpeg, la transcripción, el análisis del material grabado y la generación a través de tus propias cuentas de proveedor. [HyperFrames](https://github.com/heygen-com/hyperframes) se encarga del renderizado de las páginas y de la captura de fotogramas; `ffmpeg`, de la edición y las mediciones.
- **Una producción editable.** Cada vídeo es una carpeta normal y corriente: una línea de tiempo de escenas (`videos/main/manifest.json`), un registro de recursos, datos del producto con su fuente y una página diseñada opcional. Tú, tu agente y el lienzo del navegador editáis los mismos archivos. Cambia una línea de texto, sustituye una imagen o reordena las escenas, y vuelve a renderizar.

La edición, los motion graphics diseñados, los subtítulos y la transcripción **no necesitan claves de API**. La generación de imágenes, vídeo y voz solo se usa si la activas y funciona con **tus propias** cuentas de proveedor. No hay ningún backend alojado ni hace falta crear una cuenta.

---

## Qué puedes pedir

Lo pides una vez y recibes un único vídeo terminado. El agente combina en una sola línea de tiempo todo lo que necesite la petición:

| Capacidad | Qué incluye |
|---|---|
| **Editar material grabado real** | Recorta, une, reencuadra a 9:16 / 1:1 / 16:9, conserva o mezcla el sonido de los clips, superpone elementos, incrusta subtítulos y normaliza la sonoridad. En grabaciones largas también puede encontrar los mejores momentos, clasificar las tomas repetidas y eliminar silencios o muletillas, y deja registrada la evidencia de cada corte. |
| **Animación diseñada** | Escenas creadas en HTML/CSS con animación: tipografía cinética, tarjetas de precio, rótulos inferiores, datos destacados y transiciones. Los textos editables están en campos de texto con nombre, así que cambiar un texto nunca obliga a reconstruir una escena. |
| **Sonido y subtítulos** | Narración para cada escena, ajustada a su duración. Música de fondo con licencia que baja de volumen cuando hay voz. Subtítulos a partir del texto de la narración o de los tiempos medidos de cada palabra. Cortes alineados con el ritmo de la música. |
| **Tomas generadas** | Imágenes, clips de vídeo y presentadores generados (talking head) con el proveedor que hayas configurado, para las tomas que tu material no puede mostrar. Solo se crean dentro del gasto que apruebes. |

Si pides un guion o un storyboard, el agente se detiene en el documento. Si pides un vídeo terminado, trabaja hasta la entrega. Solo te enseña un plan o una vista previa si lo has pedido o si el vídeo dura más de unos dos minutos. Si escribe un guion que el vídeo debe seguir palabra por palabra, primero te lo enseña; un guion que le des tú se produce tal como está escrito.

---

## Motion graphics en Claude Code, sin plan Team

Claude Motion, la función de animación de Anthropic, está en beta y solo está disponible en los planes Claude Team y Enterprise. OrkasVideoStudio ofrece a Claude Code el mismo tipo de motion graphics creados con código con los planes Pro, Max o Ultra, o con una clave de API: el agente escribe cada escena en HTML y CSS con animación, inspecciona fotogramas de muestra y renderiza un MP4 en tu ordenador, así que el renderizado en sí no gasta tokens.

1. [Instala](#instalación) OrkasVideoStudio y ejecuta `ovs skills --install --target claude` (o `--target codex` para Codex).
2. Pide el vídeo, por ejemplo: *«Haz un vídeo de motion graphics de 20 segundos en 16:9 para el lanzamiento de nuestra aplicación: una apertura con tipografía cinética y el nombre del producto, tres tarjetas de funciones que entren deslizándose y una tarjeta final con el precio. Enséñame una imagen fija de cada escena antes de renderizar».*
3. Cambia tú mismo una palabra, un color o los tiempos en los archivos de escena o en el lienzo, o pídeselo al agente, y vuelve a renderizar.

A diferencia de Claude Motion, la misma línea de tiempo también puede incluir tu propio material grabado, narración, música y subtítulos. Consulta [la comparativa](#comparativa).

---

## Casos de uso

Cada fila es una petición que podrías hacerle a tu agente. La skill `video-studio` elige las herramientas.

### Publicidad y marketing

| Tú dices… | Qué ocurre |
|---|---|
| *«Haz un anuncio vertical de 20 segundos para este flexo a partir de estas fotos y de la página del producto».* | Importa las fotos, registra el precio y las especificaciones como datos con su fuente, diseña las escenas de gancho, funciones y precio, añade narración y subtítulos, y después lo comprueba, lo renderiza y lo entrega. |
| *«Haz un vídeo de lanzamiento de 30 segundos para nuestra aplicación a partir de su web».* | Captura las páginas reales del producto en tu navegador, usa las propias palabras y pantallas del producto y construye las escenas en torno a ellas en lugar de usar maquetas redibujadas. |
| *«Haz un vídeo de 30 segundos con un presentador generado que presente este sérum».* | Primero escribe el monólogo, crea una imagen clave de un presentador ficticio y la reutiliza en todos los clips, genera los clips en los que habla con tu proveedor de vídeo y mantiene los precios y las afirmaciones como texto editable en pantalla. |
| *«Haz una promo de 15 s en 9:16 a partir de este guion: genera la apertura, compón los destacados de funciones y usa una sola locución».* | Una sola línea de tiempo combina la apertura generada, las escenas de funciones diseñadas y una única pista de narración, y el archivo final se comprueba antes de la entrega. |

### Cine y ficción

| Tú dices… | Qué ocurre |
|---|---|
| *«Haz un cortometraje de un minuto sobre una enfermera del turno de noche, con los mismos dos personajes en todas las tomas».* | Construye la historia en torno a una única pregunta dramática, mantiene una descripción de aspecto y una imagen clave por personaje para que sean coherentes de una toma a otra, y genera las tomas con tu proveedor de vídeo dentro del presupuesto que apruebes. |
| *«Convierte estos tres episodios de la serie en un resumen narrado de 3 minutos».* | Transcribe los episodios, elige las escenas que sostienen la historia, omite los créditos y los avances del siguiente episodio, escribe y locuta el resumen, y monta tu material grabado debajo. |
| *«Genera una toma de 5 s de la ciudad al amanecer para la apertura».* | Confirma el proveedor, el modelo y el coste, crea una toma con tu proveedor de vídeo y la coloca en la línea de tiempo junto a tu material grabado. |

### Edición

| Tú dices… | Qué ocurre |
|---|---|
| *«Convierte esta grabación de pantalla de 1 hora en tres clips de 30 s con los mejores momentos y subtítulos».* | El análisis de escenas y de calidad encuentra las partes buenas. Las tomas repetidas se clasifican, los silencios y las muletillas se cortan, y los subtítulos se incrustan a partir de los tiempos medidos de cada palabra. |
| *«Quita los silencios y los “eh” de mi grabación con la webcam y dale más ritmo».* | Detecta los silencios y las muletillas, hace un jump cut determinista y deja registrada la evidencia de cada fragmento eliminado. |
| *«Añade una locución en inglés y subtítulos a product-demo.mp4 e iguala la sonoridad».* | Transcribe el vídeo, traduce y locuta cada frase dentro del tramo de imagen que le corresponde, mezcla la voz sobre el sonido existente, incrusta los subtítulos y normaliza la sonoridad. |
| *«Monta estos 20 clips de nuestro viaje al ritmo de esta canción».* | Mide los beats de la pista, corta los clips sobre ellos y comprueba la alineación con los beats en el archivo entregado. |

### Vídeos explicativos y tutoriales

| Tú dices… | Qué ocurre |
|---|---|
| *«Haz un vídeo explicativo de 60 s sobre bases de datos vectoriales con locución en chino».* | Escribe escenas de motion graphics, sintetiza la narración con tu proveedor de TTS y ajusta cada frase a su escena. |
| *«Convierte mi grabación de pantalla de la página de ajustes en un tutorial de 90 segundos».* | Recorta la grabación, señala paso a paso cada control sobre la interfaz real y añade narración y subtítulos. |

### Recrear vídeos populares

| Tú dices… | Qué ocurre |
|---|---|
| *«Recrea la estructura y el ritmo de este vídeo viral para mi producto. Enséñame primero el plan».* | Desglosa la referencia, asigna sus momentos clave a tu material y espera tu aprobación antes de producir. |
| *«Este anuncio de la competencia funciona bien. Haz el nuestro con el mismo gancho y el mismo ritmo, usando nuestras fotos».* | Toma de la referencia el ritmo de gancho, prueba y llamada a la acción, no su contenido. Cada afirmación sale de los datos de tu producto y cada imagen, de tu material. |

Dale a tu agente un **archivo de vídeo de referencia** y tus propios recursos de producto, guion o material grabado. Tu agente puede usar OrkasVideoStudio para recrear su **estructura narrativa, estilo visual y ritmo de montaje** con el nuevo contenido:

1. **Analizar la referencia.** Inspeccionar fotogramas de muestra y el audio relevante para identificar el gancho, la demostración o prueba, el orden de la información, la tipografía, las transiciones, el ritmo y la llamada a la acción.
2. **Planificar la adaptación.** Indicar qué se conserva y qué se sustituye, y después asignar los momentos de la referencia a las nuevas escenas o a la línea de tiempo. Adaptar los tiempos a tu narración real y al tiempo de lectura.
3. **Producir y revisar.** Componer motion graphics, editar tu material grabado y generar los elementos visuales que falten cuando sea necesario. Los textos, subtítulos, narraciones y clips creados localmente se pueden editar por separado. El texto incrustado en el metraje generado solo se puede cambiar cambiando ese metraje.

Esto funciona mejor con vídeos explicativos de motion graphics, demos de SaaS y de aplicaciones, y anuncios de producto hechos a partir de material grabado que ya existe. Empieza con un archivo que tu agente pueda leer, porque la descarga desde enlaces compartidos de redes sociales no está integrada. No se garantiza reproducir con exactitud los movimientos de cámara ni las actuaciones de personas, ni una coincidencia fotograma a fotograma. Las comprobaciones de entrega no puntúan cuánto se parece el resultado a la referencia. Para más detalles, consulta el [flujo de trabajo de recreación de referencias](./packages/skills/video-craft/references/reference-recreation.md).

---

## Instalación

**Requisitos previos:** Node ≥ 22, `pnpm` y `ffmpeg` + `ffprobe` en tu `PATH`. El paquete [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, con versión fijada, se instala como dependencia y renderiza las páginas en Chrome sin interfaz (headless) para las comprobaciones y el renderizado; `npx` es solo una alternativa de compatibilidad. La generación es opcional y requiere tus propias claves.

### Desde el código fuente

```bash
git clone https://github.com/Orkas-AI/Orkas-VideoStudio.git
cd Orkas-VideoStudio
pnpm install && pnpm build
alias ovs="node $PWD/packages/cli/dist/index.js"
ovs doctor          # checks Node, ffmpeg and ffprobe and explains how to install anything missing
```

Los paquetes de npm todavía no están publicados, así que, de momento, instálalo desde el código fuente.

---

## Úsalo desde Claude Code, Codex o cualquier agente de programación

La CLI `ovs` es la interfaz canónica, y las herramientas MCP la replican. Usa la opción que admita tu agente:

**1) Skills nativas (Claude Code / Codex).** Instala el paquete de skills para que el agente lo encuentre por su cuenta:

```bash
ovs skills --install --target claude   # → ~/.claude/skills  (add --scope repo for ./.claude/skills)
ovs skills --install --target codex    # → ~/.agents/skills  (add --scope repo for ./.agents/skills)
```

El mismo paquete de skills está publicado en [skills.sh](https://skills.sh/orkas-ai/orkas-videostudio), así que `npx skills add orkas-ai/orkas-videostudio` también lo instala. Las skills llaman a la CLI `ovs`, así que instálala primero como se describe más arriba.

**2) Herramientas MCP.** Registra el servidor:

```bash
claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Claude Code
codex  mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js   # Codex
```

**3) CLI autodescriptiva (cualquier agente con shell).** No hace falta ningún cargador:

```bash
ovs skills               # list the skills
ovs skill video-studio   # print the entry skill into context
ovs --help               # the full command surface
```

Después, basta con pedirle un vídeo a tu agente. Lo primero que hace es leer `video-studio`, y después carga las referencias de etapa y de técnica que necesite.

---

## Cómo funciona una producción

El agente elige un nombre de carpeta corto y lo guarda todo en ella:

```text
lamp-ad/
  assets.json            every file the video uses: id, kind, path, origin (upload / page / generated / edited)
  product.json           sourced facts such as price and specs, referenced from scenes by id
  media/                 imported and generated files
  videos/main/
    manifest.json        the scene timeline: scenes, clips, text, narration, music tracks, captions
    index.html           optional designed page for text and motion
```

El orden de las escenas es el orden de reproducción. Los tiempos de inicio y la duración total se calculan a partir de las escenas y nunca se guardan, así que mover una escena no puede dejar los tiempos incoherentes. Un precio se guarda una sola vez en `product.json`, y cada escena que lo muestra lo lee de ahí. Para variantes paralelas, como otras relaciones de aspecto, otros idiomas o montajes A/B, el agente añade más identificadores de vídeo que comparten los mismos recursos. Consulta el [contrato de la línea de tiempo](packages/skills/video-studio/references/timeline.md).

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

`ship` mide el archivo final antes de registrarlo: duración, tamaño de imagen y frecuencia de fotogramas, audio, sonoridad y cobertura de la narración. Los avisos sobre subtítulos se marcan para confirmarlos visualmente y se devuelven fotogramas del MP4 real. Cada entrega se convierte en una versión inmutable. Un render hecho antes del último cambio se rechaza por obsoleto, y las entregas anteriores nunca se sobrescriben. Superar estas comprobaciones no certifica la calidad visual. La revisión visual cuenta como `not_checked` hasta que alguien mire de verdad los fotogramas.

Cuando aceptes explícitamente un hallazgo pendiente concreto, pasa su código exacto con `--accept-findings '["CODE"]' --accept-reason '<your decision>'`. La versión registra esa decisión y cualquier otro error sigue bloqueando la entrega. Las escrituras se serializan con `.ovs-timeline.lock`; si un cierre inesperado lo deja sin eliminar, confirma que el proceso que lo creó se ha detenido antes de borrarlo. El [contrato de la línea de tiempo](packages/skills/video-studio/references/timeline.md) cubre ambos casos.

**Las revisiones siguen siendo baratas y locales.** Un cambio de palabra, de corte, de orden, de música de fondo o de subtítulo se edita directamente. Solo se vuelve a locutar una frase hablada que haya cambiado y solo se regenera una toma equivocada, dentro del gasto ya aprobado. Editar el texto de los subtítulos no cambia el audio hablado. HyperFrames renderiza el vídeo completo cada vez; esta compilación portable no guarda en caché las escenas renderizadas.

---

## Lienzo de vídeo en el navegador

Cuando `timeline import`, `timeline prepare`, `timeline render` o `timeline ship` terminan correctamente (desde la CLI o MCP), OVS abre el lienzo de esa producción en tu navegador predeterminado. Los comandos posteriores reutilizan la misma pestaña en lugar de abrir otras nuevas. El lienzo edita los mismos archivos que la CLI y MCP, así que los cambios fluyen en ambos sentidos. Mientras el agente trabaja, el lienzo se muestra en modo de solo lectura.

En el lienzo puedes:

- **Ver y exportar.** Reproducir el vídeo, cambiar entre las versiones entregadas y descargar la que quieras.
- **Organizar el material.** Subir, soltar o pegar material grabado, y después mover y conectar tarjetas en el tablero.
- **Editar escenas.** Cambiar textos, orden e imágenes, y añadir, quitar o volver a poner escenas.
- **Generar y rehacer tomas.** Crear una nueva toma de imagen o de vídeo a partir de una tarjeta, o volver a generar una toma existente. Tú eliges las referencias o el primer y el último fotograma, además del modelo, la resolución y el sonido; las opciones que un modelo no admite aparecen desactivadas. Puedes recorrer los resultados anteriores y elegir el que quieras usar. El lienzo pide confirmación antes de cada solicitud de pago.
- **Actualizar el vídeo.** Las ediciones normales de escenas se renderizan y se entregan en local, con el progreso visible en la tarjeta del vídeo. Cambiar un dato del producto, una frase de la narración o la voz de todo el vídeo genera una petición para tu agente, porque esas ediciones requieren su criterio. Si la comprobación de entrega detiene una actualización porque hay escenas con imágenes fijas, la tarjeta del vídeo ofrece **Preview this version** (previsualizar esta versión), **Return to editing** (volver a la edición) o **Update anyway** (actualizar de todos modos); Update anyway conserva ese render sin volver a renderizar.
- **Decirle al agente.** Escribir una petición breve sobre una escena, una toma, una tarjeta de material grabado o un vídeo. Se envía con el contexto de esa tarjeta.

El lienzo se abre en chino. Su botón de idioma alterna entre chino e inglés y recuerda tu elección.

### Enviar peticiones de vuelta a tu agente

**Send** (enviar) solo entrega la petición a la conversación que creó la producción. Si esa conversación no puede recibirla, el borrador se queda en el lienzo. No se copia nada al portapapeles, ni se reenvía automáticamente, ni se manda a una sesión nueva. La edición, la actualización y la exportación siguen funcionando sin un agente conectado.

- **Codex.** Cuando `ovs` se ejecuta dentro de un hilo de Codex, la petición se pone en cola en ese mismo hilo. Esto requiere Codex CLI 0.160.1 o posterior con su app server local en ejecución. Un hilo cerrado o no cargado aparece como no disponible.
- **Claude Code.** Las peticiones llegan a través de un canal MCP, que es una función de Claude Code en vista previa de investigación (research preview), y una conexión MCP normal no basta. Registra el servidor con `--claude-channel` y después inicia Claude Code con el canal habilitado:

  ```bash
  claude mcp add ovs -- node /path/to/Orkas-VideoStudio/packages/mcp/dist/index.js --claude-channel
  claude --dangerously-load-development-channels server:ovs
  ```

  Crea el vídeo mediante las herramientas MCP de `ovs` para que el lienzo se abra vinculado a ese canal. Un lienzo abierto desde la CLI en la shell no puede comunicarse con Claude Code. Claude Code muestra un aviso de desarrollo local al iniciarse. Los canales requieren iniciar sesión en claude.ai o una clave de API de Console y, en los planes Team y Enterprise, un administrador debe habilitarlos primero. Consulta [Canales de Claude Code](https://code.claude.com/docs/en/channels).

### Abrir una producción por tu cuenta

```bash
ovs studio --production ./lamp-ad                   # canvas only
ovs studio --production ./lamp-ad --agent codex     # canvas with its own Codex session
ovs studio --production ./lamp-ad --agent claude    # canvas with its own Claude Code session
```

Mantén el comando en ejecución mientras usas el lienzo. Con `--agent`, el lienzo ejecuta en la carpeta de la producción una sesión nativa que usa el inicio de sesión, el modelo y la configuración de permisos de tu propia CLI. Esa sesión requiere Codex 0.160.1+ o Claude Code 2.1.148+. Sus solicitudes de permiso y sus preguntas aparecen en el lienzo. El lienzo restaura la sesión guardada de la carpeta, salvo que pases `--resume <session-id>` para traspasarle una sesión concreta o `--new-session` para empezar de cero. Otras opciones:

- `--no-open` muestra el enlace de acceso sin abrir un navegador.
- `--port` elige el puerto de loopback.
- `--recover` recupera un lienzo cuyo propietario anterior ha terminado.

Para desactivar la apertura automática durante el trabajo de producción, define `OVS_STUDIO_AUTO_OPEN=0`. En CI ya está desactivada.

---

## Usa tus propios proveedores de generación

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
| Vídeo (`ovs video`) | `doubao` (Seedance), `minimax`, `vidu`, `kling`, `google` (Veo), `google-cloud` (Veo), `runway`, `aliyun` (Wan), `atlas`, `muapi` | `OVS_VIDEO_PROVIDER` · `_BASE_URL` · `_API_KEY` · `_MODEL` |

Puedes inspeccionar una configuración sin hacer ninguna llamada de pago:

```bash
ovs speech-capabilities                                    # resolved voice/model/language profile, no secrets printed
ovs video-models                                           # what the configured video model supports
ovs video-params --request '{"duration":5,"ratio":"9:16"}' # what that request would actually send
```

Ejecuta `ovs narration fit` antes y después de la síntesis para que cada frase de la narración quede dentro de la ventana de su escena o del plan. La generación de vídeo recibe de forma explícita las imágenes de referencia, la relación de aspecto, la duración, la resolución y los indicadores de audio, de modo que la llamada al proveedor coincide con el plan aprobado. En los proyectos con `plan.json`, `ovs plan validate` también comprueba la relación de aspecto, la duración y la operación de cada segmento de generación frente al `video.provider` configurado antes de generar nada.

Algunos proveedores necesitan unos cuantos ajustes más:

- **Google Cloud Veo** usa `video.workspace_id`, `video.region` y un token de API o un JSON de cuenta de servicio en `video.api_key`.
- **Alibaba** usa para la voz su endpoint de espacio de trabajo en `tts.base_url`. El vídeo de Wan necesita `video.workspace_id` y `video.region`.
- **Las voces que solo se obtienen por clonación** necesitan el id de voz que hayas registrado con el proveedor.
- **La voz por WebSocket** pasa por `tts.proxy_url` solo si lo configuras.
- **Las referencias de vídeo** se pasan como URL públicas de imagen o de vídeo. El número admitido y la compatibilidad con primer y último fotograma varían según el modelo.
- **[MuAPI](https://muapi.ai)** debe seleccionarse explícitamente con `video.provider: "muapi"`. Cuando está seleccionado, `MUAPI_API_KEY` tiene prioridad sobre `OVS_VIDEO_API_KEY`; la clave nunca selecciona MuAPI por sí sola. `video.model` / `OVS_VIDEO_MODEL` admite los endpoints validados de Kling v2.1 `kling-v2.1-master-t2v`, `kling-v2.1-master-i2v`, `kling-v2.1-standard-i2v` y `kling-v2.1-pro-i2v`. Otros slugs se rechazan en lugar de enviarse con un cuerpo que no corresponde. El texto a vídeo usa por defecto `kling-v2.1-master-t2v`, y un `image_url` de primer fotograma usa por defecto `kling-v2.1-master-i2v`. La duración es de 5 o 10 segundos y la relación de aspecto es `16:9`, `9:16` o `1:1`. Las entradas `resolution`, `generate_audio` y `quality`, independientes del proveedor, siguen siendo compatibles con los planes firmados: Kling ignora la resolución y el audio, y la calidad se valida pero no se envía. Los controles de edición y de referencias adicionales se rechazan hasta que se admita un esquema de MuAPI correspondiente. La URL base predeterminada incluye `/api/v1`, y una personalizada también debe incluirlo. Consulta la [referencia de la API de MuAPI](https://muapi.ai/docs/api-reference) para conocer el contrato de envío y sondeo, y los parámetros específicos de cada modelo.

Los catálogos de modelos de los proveedores describen el contrato de API de cada proveedor. No garantizan la disponibilidad en tiempo real ni los precios.

---

## Qué mantiene acotada la generación

El agente usa tu material existente siempre que sirva para la toma y solo genera lo que falta. Tener credenciales configuradas no cuenta como aprobación para gastar. Antes de cualquier trabajo de pago, el agente confirma el proveedor, el modelo, el propósito, el número de solicitudes, incluidos los reintentos, y el coste estimado. Después se ciñe a ese alcance. Si lo rechazas, se detienen las llamadas de pago de esa petición, y una toma fallida se rehace, con correcciones, como máximo dos veces antes de que el agente te pida cambiar de enfoque.

Cada solicitud de pago guarda un recibo junto a su archivo de salida. Una tarea de vídeo cuyo resultado se desconoce bloquea cualquier otro envío al mismo archivo de salida hasta que la revises, y nunca se repite automáticamente. Consulta [la autorización de la generación](packages/skills/video-studio/references/generation.md).

`ovs speak` escribe un recibo de la solicitud y del audio junto a su archivo de salida. Solo reutiliza una solicitud que coincida exactamente y cuyos bytes de audio estén intactos, así que pasa el `--language`, la voz, el modelo, la velocidad y el formato aprobados; cambiar cualquiera de ellos invalida la reutilización. Además, reserva el archivo de salida antes del envío, lo que evita llamadas duplicadas simultáneas.

No hay ningún servicio de música alojado. La música procede de archivos con licencia que aportas tú, y el agente registra la fuente y la licencia de cada archivo.

---

## Referencia de comandos

Ejecuta `ovs <command> --help` para ver la entrada tipada de cada comando. Las herramientas MCP usan los mismos nombres con guiones bajos, por ejemplo `timeline_prepare` y `edit_trim_silence`.

| Área | Comandos |
|---|---|
| Configuración | `doctor`, `skills [--install]`, `skill <name>` |
| Producción | `timeline import · prepare · status · check · snapshot · render · ship`, `studio` |
| Edición (ffmpeg) | `edit probe · trim · concat · reframe · burnsubs · overlay · extract-frame · loudness · normalize-loudness · mix · select · trim-silence · remove-fillers` |
| Análisis | `transcribe`, `phrases`, `silence`, `scenes`, `quality`, `beats`, `activity` |
| Narración | `narration timing · fit`, `speech-capabilities`, `speak` |
| Generación | `image`, `image-prepare`, `video`, `video-models`, `video-params` |
| Proyectos anteriores | `composition prepare · reconcile`, `plan validate · summarize · promise-check · rank-takes`, `draft`, `render`, `lint`, `check`, `snapshot`, `gate transition`, `inspect` (alias de `check`) |

Los proyectos creados con los formatos anteriores, el EDL `plan.json` y `composition-manifest.json`, siguen funcionando con los comandos de «Proyectos anteriores». El trabajo nuevo usa la línea de tiempo de escenas. Para un `plan.json` ensamblado, verifica el archivo final además del material que lo compone:

```bash
ovs plan promise-check project/plan.json --probe-produced --video project/render/video.mp4
```

La herramienta MCP equivalente, `plan_promise_check`, acepta `probe_produced` y `video`. Mide la duración, el tamaño de imagen y la frecuencia de fotogramas, el audio, la sonoridad integrada y los tramos con voz de cada frase. Si falta evidencia de la narración, la comprobación falla, y los avisos sobre subtítulos requieren una comprobación visual cuando los subtítulos se han incrustado.

---

## Comparativa

### OrkasVideoStudio frente a Claude Motion, CapCut y Higgsfield

| | OrkasVideoStudio | Claude Motion | CapCut | Higgsfield |
|---|---|---|---|---|
| **Qué es** | un estudio de vídeo de código abierto que maneja tu agente de programación | una salida de animación dentro de Claude | una aplicación de edición de vídeo de ByteDance | una plataforma alojada de imagen y vídeo con IA |
| **Quién puede usarlo** | cualquiera; se ejecuta en tu ordenador con Claude Code, Codex, Cursor o cualquier agente que ejecute una shell o se comunique por MCP | planes Claude Team y Enterprise (beta) | aplicaciones de escritorio, móviles y web, con planes gratuitos y de pago | una cuenta de Higgsfield, gratuita o con un plan mensual de créditos, a través de su aplicación web, su API, su conector MCP o su CLI |
| **Cómo editas** | le describes el cambio a tu agente, o cambias textos, imágenes y el orden de las escenas en el lienzo del navegador | en el editor de Claude o pidiéndoselo a Claude | a mano, en una línea de tiempo | con una instrucción para cada generación o edición, en sus estudios web o desde tu agente a través de su conector |
| **Material grabado** | recorta, une, reencuadra a 9:16 / 1:1 / 16:9, elimina silencios y muletillas, corta al ritmo de la música | anima textos, gráficos, formas e imágenes; sin metraje ni personas generados | edición manual completa | ediciones con IA sobre un clip: eliminar o sustituir objetos y fondos, cambiar el estilo, reencuadrar, aumentar la resolución o alargar una toma |
| **Motion graphics** | escenas HTML/CSS: tipografía cinética, tarjetas de precio, rótulos inferiores, datos destacados, transiciones | animaciones explicativas creadas con código | plantillas, animaciones de texto y efectos | títulos, transiciones y animaciones de logotipo que su AI Motion Designer crea en After Effects o Premiere Pro |
| **Sonido** | narración por escena, música de fondo que baja de volumen cuando hay voz, subtítulos a partir de los tiempos medidos de cada palabra | no se trata en el artículo de ayuda de Anthropic | herramientas de voz, música y subtítulos en la aplicación | locución con IA, traducción de voz y sincronización labial |
| **Tomas generadas** | imágenes, clips de vídeo y presentadores de los proveedores que configures, como Seedance 2.5, Kling 4.0, Veo 3.1 en Google Cloud, Runway Gen-4.5 y Wan 3.0, con cargo a tus propias claves | ninguna | un generador de vídeo con IA que parte de un guion o de una imagen | muchos modelos alojados con una sola cuenta, entre ellos Seedance 2.5, Kling 4.0, Veo 3.1 y MAGI-2, que solo ofrece Higgsfield |
| **Salida** | MP4, con la duración, el tamaño de imagen y la frecuencia de fotogramas, la sonoridad y la narración comprobados antes de la entrega | exportación a MP4 | exportación a MP4 | clips e imágenes generados, y vídeos de sus aplicaciones de estudio |
| **Código fuente** | MIT; cada vídeo es una carpeta local que te pertenece | propietario, alojado | propietario | propietario, alojado |

Elige **CapCut**, o un editor de línea de tiempo de código abierto como Shotcut o Kdenlive, si quieres montar a mano. Elige **Claude Motion** si tu equipo ya trabaja en Claude con un plan Team o Enterprise y necesita animaciones explicativas. Elige **Higgsfield** si quieres muchos modelos alojados en una sola factura, o un modelo que solo ofrece esa plataforma, como MAGI-2. Elige **OrkasVideoStudio** si quieres que tu agente de programación haga el vídeo completo, con material grabado, animación y sonido en una sola línea de tiempo y con tus propias claves de proveedor, y conservar el resultado como archivos que puedes inspeccionar, editar y volver a renderizar. Higgsfield y OrkasVideoStudio también funcionan juntos: los clips que generes en Higgsfield son material normal para una producción de OrkasVideoStudio. Los datos proceden del [centro de ayuda de Anthropic](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion), de la [página del generador de vídeo con IA de CapCut](https://www.capcut.com/tools/ai-video-generator) y de [higgsfield.ai](https://higgsfield.ai/) a fecha de noviembre de 2026.

---

## Preguntas frecuentes

### ¿Puede Claude Code hacer vídeos?

Sí. Con OrkasVideoStudio instalado, Claude Code lee la skill `video-studio` y usa la CLI `ovs` o las herramientas MCP para editar material grabado, crear motion graphics, añadir narración y subtítulos, y renderizar en tu ordenador un MP4 comprobado. Codex, Cursor y cualquier otro agente que pueda ejecutar una shell o comunicarse por MCP funcionan igual. Consulta [Úsalo desde Claude Code, Codex o cualquier agente de programación](#úsalo-desde-claude-code-codex-o-cualquier-agente-de-programación).

### ¿Es gratis y hacen falta claves de API?

OrkasVideoStudio es gratuito y tiene licencia MIT. La edición, los motion graphics diseñados, los subtítulos y la transcripción se ejecutan en local y no necesitan claves de API. La generación de imágenes, clips de vídeo o voz es opcional y usa tus propias cuentas de proveedor, que te facturan directamente. Antes de cualquier llamada de pago, el agente confirma contigo el proveedor, el modelo, el número de solicitudes y el coste estimado. Consulta [Qué mantiene acotada la generación](#qué-mantiene-acotada-la-generación).

### ¿Es una alternativa de código abierto a Claude Motion, CapCut y Higgsfield?

Sí. Igual que Claude Motion, hace que Claude Code escriba motion graphics como código, pero funciona con Claude Code en los planes Pro, Max o Ultra o con una clave de API, no solo en los planes Team y Enterprise, y también con otros agentes. A diferencia de CapCut, es tu agente quien hace las ediciones a partir de tu descripción, en lugar de que tú cortes a mano en una línea de tiempo. A diferencia de Higgsfield, no aloja modelos ni vende créditos: tu agente llama a Seedance, Kling, Veo y otros modelos de vídeo con tus propias claves, y después combina las tomas con tu material grabado, motion graphics, narración y subtítulos. Consulta [Comparativa](#comparativa).

### ¿Puede editar el material que ya tengo grabado?

Sí. Recorta y une clips, los reencuadra a 9:16, 1:1 o 16:9, elimina silencios y muletillas, corta al ritmo de la música, incrusta subtítulos y normaliza la sonoridad. Tu material grabado va en la misma línea de tiempo que los motion graphics y las tomas generadas.

### ¿Qué modelos de vídeo, imagen y voz puede usar?

Para vídeo: Seedance, Kling, Veo (a través de Google o de Google Cloud), Runway, Wan, MiniMax y Vidu, además de Atlas y MuAPI. Para imágenes: Gemini, y OpenAI o cualquier endpoint compatible con OpenAI, incluido Seedream. Para voz: OpenAI, Doubao, MiniMax, Alibaba (Qwen y CosyVoice), Google, ElevenLabs y endpoints compatibles con OpenAI. Todos funcionan con tus propias claves. Consulta [Usa tus propios proveedores de generación](#usa-tus-propios-proveedores-de-generación).

### ¿Cómo se instala?

Instálalo desde el código fuente: clona el repositorio, ejecuta `pnpm install && pnpm build` y después comprueba tu configuración con `ovs doctor`. Necesitas Node 22 o posterior, pnpm, y ffmpeg y ffprobe. Los paquetes de npm todavía no están publicados. Consulta [Instalación](#instalación).

---

## Relación con Orkas

OrkasVideoStudio nació como el **agente de vídeo integrado en [Orkas](https://orkas.ai?source=gh-orkas-vs)**, la aplicación de escritorio con un equipo de IA. Allí se probó de principio a fin y después se extrajo a este conjunto de herramientas con licencia MIT e independiente del agente.

- **Dentro de Orkas**, se incluye como [agente integrado](https://orkas.ai/agents/video-studio/?source=gh-orkas-vs) sin instalación aparte. Chateas con él en una aplicación de escritorio en lugar de en un terminal, y la generación puede ejecutarse con los modelos integrados de Orkas (las cuentas nuevas reciben 500 créditos gratis) o con tus propias claves. [Descarga Orkas](https://orkas.ai/download/?source=gh-orkas-vs) para macOS o Windows.
- **En cualquier otro lugar**, lo instalas en tu propio agente de programación como se describe más arriba y obtienes las mismas capacidades principales a través de la CLI `ovs`, el servidor MCP y el lienzo. Las funciones de la cuenta de Orkas, como los proveedores alojados, los créditos y la publicación de chats, no forman parte de este repositorio.

Enlaces: **[orkas.ai](https://orkas.ai?source=gh-orkas-vs)** · **[github.com/Orkas-AI](https://github.com/Orkas-AI)** · **[este repositorio](https://github.com/Orkas-AI/Orkas-VideoStudio)**

---

## Paquetes

| Paquete | Qué contiene |
|---|---|
| `@orkas/video-studio-core` | esquemas de la línea de tiempo de escenas y del EDL heredado, comprobaciones de entrega, utilidades de decisión, tiempos de narración, entorno de ejecución y configuración |
| `@orkas/video-studio-tools` | backends de línea de tiempo, renderizado, edición, análisis, voz, imagen y vídeo, además del lienzo del navegador |
| `@orkas/video-studio` | la CLI `ovs` |
| `@orkas/video-studio-mcp` | el servidor MCP (`ovs-mcp`), que replica la CLI |
| `@orkas/video-studio-skills` | el paquete de conocimiento `SKILL.md` independiente del host |

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

`pnpm install` aplica el parche versionado de HyperFrames que hay en [`patches/`](./patches/), que hace que la salida SDR H.264/H.265 use la matriz BT.709 que declaran sus metadatos. Un `OVS_HYPERFRAMES_BIN` externo o la alternativa de compatibilidad con `npx` no reciben este parche, así que ese entorno de ejecución debe incluir una corrección de color equivalente. El parche también conserva las marcas de tiempo de cada palabra de Whisper para chino y japonés. Los entornos de ejecución externos requieren la misma compatibilidad.

`test:video` nunca gasta créditos de proveedores. Un endpoint local que simula Seedance devuelve un fixture H.264 real, que OVS descarga y verifica con `ffprobe`.

`test:video:e2e` cubre las dos rutas de producción a través de la CLI compilada:

- **La ruta de composición anterior.** Crea una producción 1080p de nueve segundos y tres escenas con composition prepare/reconcile, snapshot, la compuerta de borrador completa, la incrustación de subtítulos y las comprobaciones promise-check del archivo final. Decodifica el MP4 entero y comprueba el orden de las escenas, el movimiento visible, que haya audio audible en cada escena y los píxeles de los subtítulos incrustados, y que se rechace una duración de entrega incorrecta.
- **La línea de tiempo de escenas actual.** Renderiza una línea de tiempo de tres escenas a través de la ruta real de check y snapshot de HyperFrames. Comprueba los colores de las escenas, el movimiento diseñado, el movimiento decodificado del vídeo de origen, los píxeles de los subtítulos, el audio, la entrega inmutable y el rechazo de renders obsoletos.

También pone a prueba las interfaces de la CLI compilada y de MCP. Ambos comandos de vídeo fallan con un error que indica qué hacer cuando falta un entorno de ejecución necesario. La suite de pruebas normal puede omitir los casos que más dependen del entorno de ejecución en máquinas sin ffmpeg o sin navegador.

`pnpm verify` debe pasar en el candidato final antes de cualquier commit de Git o PR. Incluye el caso de producción real y también es el punto de entrada de CI; los cambios que solo afectan a las pruebas siguen la misma regla. Para revisiones de sincronización o de publicación, conserva e inspecciona el vídeo producido, las vistas previas, los fotogramas finales y los informes:

```bash
OVS_VIDEO_EVIDENCE_DIR=../Orkas-VideoStudio-artifacts pnpm test:video:e2e
```

El directorio de evidencias solo se usa si lo activas, y cada ejecución usa su propio subdirectorio. Las ejecuciones normales de CI eliminan sus archivos multimedia temporales. Los fixtures usan HTML/SVG original y audio instrumental generado localmente. No llaman a proveedores de pago ni afirman cubrir la calidad del TTS ni de los modelos.

`pnpm benchmark` no necesita claves y es determinista. Compila el paquete core, verifica los fixtures del benchmark y después mide las transiciones de compuerta, la validación del EDL y los resúmenes de entrega, la validación del manifiesto de composición y la estimación de la narración. Cada suite tiene un umbral mínimo de rendimiento deliberadamente conservador, de modo que las regresiones grandes fallan y la variación normal entre máquinas no.

La [guía de evaluación opcional de modelos](./eval/video/README.md), en inglés, describe la configuración, los comandos y el almacenamiento de las evidencias.

## Versiones

Todos los paquetes comparten una misma versión de calendario, `YYYY.M.D` (fecha en la zona horaria Asia/Shanghai, sin ceros a la izquierda). Las versiones etiquetadas usan `v<version>` y se publican como [GitHub Releases](https://github.com/Orkas-AI/Orkas-VideoStudio/releases); una versión de fecha ya publicada nunca se sobrescribe. Los cambios se recogen en [CHANGELOG.md](CHANGELOG.md). Esta versión es independiente de la aplicación de escritorio de Orkas y de las versiones de sus agentes del marketplace.

## Licencia

MIT — consulta [`LICENSE`](./LICENSE). El renderizado usa la dependencia [HyperFrames](https://github.com/heygen-com/hyperframes) `0.7.60`, con licencia Apache-2.0. La edición y las comprobaciones multimedia usan el `ffmpeg` de tu sistema, y la transcripción se delega en HyperFrames / whisper.cpp. [`PLAN.md`](./PLAN.md) explica cómo se localizan los entornos de ejecución de terceros, junto con las notas de licencia.
