# FlowFieldStudio — Manifiesto y Descripción

## Superficie

FlowFieldStudio es un instrumento visual generativo en tiempo real. Partículas guiadas por campos de flujo dibujan texto o siluetas sobre un lienzo vivo.

Abre el navegador, escribe una palabra, y miles de partículas la trazan como si el viento mismo se hubiera enamorado de las letras. El resultado es orgánico, impredecible, hipnótico. No es un render: es una performance que nunca se repite igual.

## Lo que ve el artista

Cada sesión con FlowFieldStudio es un acto de **co-creación con el ruido**. Tú defines una semilla (un texto, una imagen) y el sistema responde con flujos de partículas que se deslizan sobre ella como serpientes de luz.

El alma del proyecto está en el **ruido Perlin**, un generador de caos suave y direccional que convierte cada celda del espacio en una fuerza vectorial. Sobre esa matriz invisible, las partículas bailan. No hay rutas predefinidas, solo tendencias. El resultado visual oscila entre la caligrafía líquida y la pintura de humo.

Las partículas dejan **estelas** de longitud y grosor variable, con modos sólido, punteado, trazado discontinuo y glow. Cada trazo es único porque la historia de posiciones se desvanece gradualmente: el canvas respira con un **fade alpha** que controla la persistencia, permitiendo estelas largas y etéreas o trazos cortos y nítidos.

Las partículas pueden adoptar **formas geométricas** proyectadas sobre su historia: círculos, triángulos, diamantes, estrellas, cuadrados. No es solo un trail: es una constelación de formas coloridas danzando sobre la silueta del texto.

El **color** fluye con libertad: las partículas de texto heredan el color del píxel de origen (modo imagen), permiten un color sólido, o blanco puro. El texto fuente se colorea con degradados de 4 stops en dirección horizontal, vertical o diagonal. Las partículas de fondo tienen su propio matiz independiente.

El artista puede **empujar las partículas con el cursor** como si sus dedos deformaran el campo. Un arrastre del mouse genera una distorsión radial que aleja partículas del punto de contacto, permitiendo esculpir el flujo en directo.

Cuando el micrófono está activo, el sonido se convierte en un director de orquesta invisible: **tres bandas de frecuencia** (bajos, medios, agudos) mapean a cualquier parámetro — velocidad, escala de ruido, ángulo, opacidad — transformando la música en movimiento. Los beats de graves disparan eventos de sincronización.

Los **LFOs** (osciladores de baja frecuencia) añaden otra capa de modulación autónoma. Seno, cuadrada, sierra, triángulo: cada LFO respira a su propio ritmo, modulando cualquier parámetro del sistema en tiempo real. El panel muestra mini-osciloscopios que visualizan cada forma de onda.

El **post-procesado** envuelve todo en una estética de video arte analógico: bloom para halos luminosos, aberración cromática para desplazamiento RGB, viñeta para enfoque central, y grano de película para textura. Cada efecto es opcional y configurable con intensidad y radio.

## Lo que ve el desarrollador

FlowFieldStudio es una **aplicación web vanilla sin dependencias externas**. No usa npm, no tiene package.json, no necesita bundler en tiempo de ejecución. Es HTML + CSS + JavaScript puro que funciona en cualquier navegador moderno.

### Arquitectura

Todo orbita alrededor de un **estado reactivo central** (`S`), implementado como un Proxy ES6 que emite eventos de cambio a través de un bus pub/sub (`EventBus`). Cada cambio en `S` notifica a todos los suscriptores — la UI se actualiza, los renderers reaccionan, los flujos se regeneran.

```
S (Proxy reactivo)
 │
 ├─► UI (sliders, toggles, botones) ──► escucha 'state:change'
 ├─► Effect (orquestador) ───────────► construye flow fields, gestiona renderers
 ├─► Renderer (Canvas2D / WebGPU) ───► dibuja partículas
 ├─► AudioManager ──────────────────► FFT, beat detection, mapping banda→parámetro
 ├─► LFOManager ────────────────────► osciladores modulando S
 ├─► PostProcessor ─────────────────► bloom, CA, vignette, grain
 └─► RecorderManager ───────────────► máquina de estados IDLE→RECORDING→EXPORTING
```

### Flujo de renderizado

1. El orquestador (`Effect`) construye la **imagen fuente** desde texto (renderizado vía SVG inline → Image → Canvas) o desde una imagen cargada por el usuario.
2. Escanea la imagen por celdas (cell size configurable, típicamente 5px) y genera dos **flow fields**: uno para las partículas de texto (con ángulos derivados de Perlin + zona de influencia del texto) y otro para partículas de fondo (Perlin independiente con offset).
3. Las partículas de texto se inicializan aleatoriamente sobre las celdas activas (donde hay píxeles de la fuente). Las de fondo se distribuyen por todo el canvas, opcionalmente evitando la zona de texto.
4. Cada frame:
   - El `AudioManager` lee el analizador FFT (fftSize=256), calcula energía por banda, aplica el mapeo a los parámetros de `S`.
   - El `LFOManager` actualiza sus osciladores y modula los parámetros destino en `S`.
   - El renderer aplica fade (rectángulo semitransparente sobre todo el canvas) para crear persistencia.
   - Las partículas se actualizan (posición según ángulo del flow field, boost en zona de texto, distorsión por cursor).
   - Se dibujan las estelas/historial de cada partícula.
   - El `PostProcessor` aplica efectos en cadena sobre el canvas completo.

### Renderers

**Canvas2D** es el renderer universal. Cada partícula (`TextParticle` / `BgParticle`) mantiene su propio array de posiciones históricas. El render dibuja estelas con `ctx.stroke()` o formas geométricas con `ctx.fill()`. Soporta blend modes (normal, screen, overlay, color-dodge) via `globalCompositeOperation`.

**WebGPU** es el renderer acelerado, usado automáticamente si `navigator.gpu` está disponible. Utiliza:
- **Compute shader** (WGSL): 256 workgroup items por dispatch. Actualiza posición, dirección, trail y color de cada partícula. Lee texturas de flow field, aplica distorsión por mouse, y gestiona respawn cuando las partículas expiran.
- **Render pipelines**: Trail pipeline (vertex shader por segmento de trail, 6 vértices por quad, instance por segmento), Shape pipeline (triangle-fan por forma geométrica, vertex buffer con vértices precomputados de cada forma), Fade pipeline (fullscreen quad con alpha configurable), Debug pipeline (grilla de celdas semitransparente).
- Buffers: partículas como storage buffer (64 bytes por partícula: pos, prev, dir, params, color), trail como storage buffer de vec2, uniforms vía buffer mapeado.

El fallback de WebGPU a Canvas2D es automático y transparente.

### Sistema de audio

`AudioManager` captura el micrófono vía `getUserMedia`, crea un `AudioContext` con `AnalyserNode` (fftSize=256). Divide el espectro en tres bandas (bass: 0-10%, mid: 10-40%, treble: 40-100%), normaliza a [0,1] y aplica smoothing. Cada banda mapea a un parámetro configurable con rango min/max. La detección de beat usa un umbral sobre la energía de bajos con histéresis para evitar falsos positivos.

### Sistema LFO

`LFOManager` gestiona una colección de osciladores. Cada `LFO` tiene forma de onda (sine, square, saw, triangle), frecuencia, amplitud, offset y un target (ruta de propiedad en `S`). Cada frame, el LFO evalúa su función de onda, escala por amplitud, suma offset, y asigna el valor a la propiedad destino de `S` usando la ruta de puntos.

### Post-procesado

Implementado en Canvas2D (extensible a WebGPU). La cadena se aplica en orden: aberración cromática → viñeta → grano → bloom. Cada efecto usa offscreen canvas para no alterar el original. Bloom usa `ctx.filter = 'blur()'` con composite 'screen'. CA desplaza canales RGB en X. Viñeta usa radial gradient. Grano genera un canvas de ruido procedural reutilizado.

### Grabación y exportación

`RecorderManager` implementa una máquina de estados (Idle → Recording → Exporting → Idle). Usa `canvas.captureStream(fps)` + `MediaRecorder` con codec VP9/VP8 a 15 Mbps. Al detener, genera un blob y descarga automática con timestamp en el nombre.

El exportador HTML standalone serializa la configuración actual (como JSON en `S`) y genera un documento HTML autónomo con una versión minificada del renderer Canvas2D, Perlin noise inline, y lógica de partículas. El resultado funciona arrastrando el archivo al navegador, sin dependencias.

### Build system

`build.js` lee los archivos JS en orden de dependencia (`MODULE_ORDER`), elimina statements `import`/`export` línea por línea, y emsambla todo dentro de un IIFE en el `<script>` de `index.html`. El resultado es un único archivo HTML autónomo. El script detecta si index.html está en modo dev (con `<script type="module">`) o en modo build (con `<script>`) y alterna entre ambos.

## La intersección

FlowFieldStudio ocupa el espacio donde el **arte generativo** se encuentra con la **ingeniería web de bajo nivel**. Es una herramienta de expresión visual construida desde cero, sin middleware, sin frameworks, sin concesiones.

Para el artista, es un pincel que respira. Para el desarrollador, es un caso de estudio en sistemas reactivos, renderizado GPU, procesamiento de audio en tiempo real y arquitectura de plugins sin dependencias.

El proyecto no distingue entre "feature técnica" y "decisión estética". El fade alpha es tanto una necesidad de renderizado (evitar limpiar el canvas cada frame) como una elección artística (controlar la persistencia de la memoria visual). El ruido Perlin es a la vez un generador matemático de números pseudoaleatorios y el corazón expresivo de cada trazo. La detección de beat no es solo DSP: es el pulso que sincroniza la máquina con la música.

Cada parámetro expuesto en el panel de control es una invitación a explorar: modificar la escala de ruido cambia la granularidad del flujo (valores bajos = remolinos cerrados, valores altos = corrientes suaves); ajustar el multiplicador de ángulo rota la intensidad direccional (π bajo = flujo laminar, π alto = turbulencia); alterar el boost de origen acelera las partículas dentro del texto (las letras "empujan" más fuerte).

La arquitectura de plugins invisible — cualquier módulo puede suscribirse a cambios de estado o emitir eventos — permite que el audio module parámetros, los LFOs module otros, y el usuario module el resto, todo simultáneamente sin conflictos porque el Proxy de `S` serializa las escrituras.

## Resumen técnico

| Dimensión | Detalle |
|---|---|
| Lenguaje | JavaScript vanilla (ES6+) |
| Renderizado | WebGPU (WGSL compute + render) con fallback Canvas2D |
| Audio | Web Audio API, AnalyserNode FFT 256, 3 bandas |
| Ruido | Perlin 2D clásico (permutation table + fade + lerp + grad) |
| Estado | Proxy reactivo con EventBus pub/sub |
| Build | Script Node.js → IIFE inline en index.html |
| Sin dependencias | 0 packages, 0 frameworks, 0 CDN scripts |
| Export | HTML standalone autónomo, WebM VP9/VP8 |
| Móvil | Bottom sheet, fullscreen landscape, pointer events |

## Parámetros artísticos clave

| Parámetro | Rango | Expresividad |
|---|---|---|
| `txt.noiseScale` | 50–2000 | De remolinos microscópicos a corrientes continentales |
| `txt.angleMult` | 0.5–12 × π | De flujo laminar a tormenta caótica |
| `txt.boost` | 1–8 × | Intensidad del "abrazo" de las letras |
| `txt.trailMin/Max` | 2–500 | De cola de cometa a serpiente infinita |
| `fadeAlpha` | 0.005–0.5 | De memoria eterna a amnesia instantánea |
| `blendMode` | normal/screen/overlay/dodge | De tinta opaca a luz superpuesta |
| `post.bloom.intensity` | 0–1 | Brillo etéreo sobre las estelas |
| `post.ca.amount` | 0–10 | Separación cromática, estética glitch |
| `cellSize` | 2–20 | De alta definición a pixel art abstracto |
| `bleedRadius` | 0–60 | Expansión de la silueta, efecto "derrame" |

---

*FlowFieldStudio no es un producto. Es un experimento abierto, un cuaderno de trabajo donde el código y la estética se escriben en la misma página.*
