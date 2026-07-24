# Guía de Usuario — Flow Field Studio

## Índice

1. [Primeros pasos](#1-primeros-pasos)
2. [Panel de control](#2-panel-de-control)
3. [Origen: texto](#3-origen-texto)
4. [Origen: imagen](#4-origen-imagen)
5. [Partículas de texto](#5-partículas-de-texto)
6. [Partículas de fondo](#6-partículas-de-fondo)
7. [Efectos visuales](#7-efectos-visuales)
8. [Interacciones](#8-interacciones)
9. [Grabación de video](#9-grabación-de-video)
10. [Exportar HTML standalone](#10-exportar-html-standalone)
11. [Modo móvil](#11-modo-móvil)
12. [WebGPU vs Canvas2D](#12-webgpu-vs-canvas2d)
13. [Atajos de teclado](#13-atajos-de-teclado)
14. [Solución de problemas](#14-solución-de-problemas)

---

## 1. Primeros pasos

Al abrir la aplicación, el canvas ocupa toda la pantalla y las partículas comienzan a animarse inmediatamente. El panel de control está en la esquina superior derecha (o deslizando desde abajo en móvil).

**Flujo típico:**

1. Elige el **texto** o **imagen** que servirá como origen del flow field (pestaña *ORÍGEN*)
2. Ajusta la **cantidad y comportamiento** de las partículas (pestaña *PARTÍCULAS*)
3. Configura las **partículas de fondo** si lo deseas (pestaña *P.FONDO*)
4. Modifica **efectos globales** como la persistencia del trail, blend mode, o fondo degradado (pestaña *EFECTOS*)
5. ¡Arrastra el mouse sobre el canvas para interactuar con las partículas!

---

## 2. Panel de control

### Desktop

| Elemento | Descripción |
|---|---|
| Panel flotante | Se arrastra desde el header. Colapsar con **▲** / **▼**. Reabrir con el botón **⚙** |
| Pestañas | ORÍGEN, PARTÍCULAS, P. FONDO, EFECTOS |
| HUD | Esquina inferior izquierda: Muestra FPS y cantidad de partículas activas |

### Móvil (≤767px)

- El panel se convierte en **bottom sheet** (se desliza desde abajo)
- Botón **⚙** para abrir, **✕** para cerrar
- Al girar el teléfono a horizontal (landscape), entra en **fullscreen automático**
- Vuelve a vertical (portrait) → sale de fullscreen
- El HUD se reposiciona automáticamente para no superponerse al panel

---

## 3. Origen: texto

### Contenido y tipografía

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Texto | texto (soporta `\n`) | `FLWR` | El texto a renderizar |
| Fuente | Arial Black, Impact, Anton, Bebas Neue, Georgia, Courier New, Brush Script, Custom | Arial Black | Tipografía (Custom permite ingresar cualquier fuente del sistema) |
| Peso | Regular 400, Bold 700, Black 900 | Black 900 | CSS font-weight |
| Tamaño | 40–600 px, step 5 | 280 | Font size |
| Espaciado | -20 – 80 px, step 1 | 0 | CSS letter-spacing |

### Color del texto

| Control | Valores | Default | Descripción |
|---|---|---|---|
| Color mode | Gradiente / Sólido | Gradiente | Cómo se colorea el texto en la imagen fuente |
| Color sólido | color picker | `#ffffff` | Color sólido del texto |
| Stops degradado | 4 color pickers | naranja → rosa → púrpura → azul | Colores en 0%, 33%, 66%, 100% |
| Dirección degradado | → H / ↓ V / ↘ Diag | H | Dirección del gradiente lineal |

### Bleed radius

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Bleed | 0–60 px, step 1 | 0 | Expande el máscara del texto hacia afuera. Útil para fuentes delgadas o para crear un área de influencia más amplia |

**Requiere hacer clic en "Apply Changes"** o "Reinicializar campo" para que los cambios tomen efecto.

---

## 4. Origen: imagen

### Subir imagen

Haz clic en el botón **Imagen** en *ORÍGEN* → se activa el selector de archivos. La imagen se usa como máscara para determinar qué celdas del flow field están activas.

### Control

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Opacidad overlay | 0–1, step 0.05 | 0.8 | Opacidad de la imagen mostrada como superposición |
| Mostrar imagen fondo | toggle | off | Dibuja la imagen cargada como capa semi-transparente de fondo |

---

## 5. Partículas de texto

Estos parámetros controlan las partículas que siguen el flow field generado a partir del texto o imagen.

### Cinemática

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Cantidad | 100–8000, step 100 | 2000 | Número de partículas de texto |
| Velocidad mín. | 0.2–5, step 0.1 | 1 | Velocidad mínima por partícula (se asigna aleatoriamente al nacer) |
| Velocidad máx. | 0.5–10, step 0.1 | 3 | Velocidad máxima |
| Boost en zona origen | 1–8, step 0.5 | 3 | Multiplicador de velocidad cuando la partícula está dentro del área del texto/origen |

### Trail

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Long. mín. trail | 2–200, step 2 | 2 | Largo mínimo del historial de posiciones |
| Long. máx. trail | 10–500, step 5 | 10 | Largo máximo del historial |
| Grosor línea | 0.2–4, step 0.1 | 1.0 | Grosor del trazo en modo trail |
| Opacidad | 0.05–1, step 0.05 | 1.0 | Opacidad global de las partículas |

### Forma

| Control | Valores | Default | Descripción |
|---|---|---|---|
| Estilo | Trazo, Círculo, Triángulo, Diamante, Estrella, Cuadrado | Trazo | En modo Trazo se dibuja un trail continuo. En otras formas, cada punto del historial dibuja la figura geométrica |
| Tamaño forma | 0.3–4, step 0.1 | 1.0 | Tamaño de las formas (solo aplica si el estilo no es Trazo) |

### Estilo de trail

| Valor | Descripción |
|---|---|
| `Aleatorio` | Cada partícula elige aleatoriamente uno de los 4 estilos al nacer |
| `Sólido` | Trazo continuo normal |
| `Dashed` | Línea punteada (segmentos de 8px con espacios de 6px) |
| `Dotted` | Línea de puntos redondos |
| `Glow` | Trazo con resplandor (shadowBlur) |

### Color de partícula

| Modo | Default | Descripción |
|---|---|---|
| `Origen` | activo | El color se toma del pixel de la imagen fuente en la posición de la celda |
| `Sólido` | `#ff6600` | Todas las partículas usan el mismo color |
| `Blanco` | — | Partículas blancas con la opacidad configurada |

### Flow field (texto)

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Escala ruido | 50–2000, step 10 | 500 | Escala del ruido Perlin. Valores más altos → flow field más suave y amplio. Valores más bajos → más caótico y detallado |
| Mult. ángulo | 0.5–12, step 0.25 | 4 | Multiplicador del ángulo de flujo (×π). Más alto → las partículas giran más bruscamente |

---

## 6. Partículas de fondo

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Habilitar | toggle | on | Activa/desactiva las partículas de fondo |
| Cantidad | 0–3000, step 50 | 400 | Número de partículas de fondo |
| Velocidad mín. | 0.1–5, step 0.1 | 0.5 | Velocidad mínima |
| Velocidad máx. | 0.2–8, step 0.1 | 1.5 | Velocidad máxima |
| Long. mín. trail | 2–100, step 2 | 2 | Largo mínimo del trail |
| Long. máx. trail | 5–300, step 5 | 10 | Largo máximo del trail |
| Grosor línea | 0.2–4, step 0.1 | 0.5 | Grosor del trazo |
| Opacidad | 0.02–1, step 0.02 | 0.4 | Opacidad |
| Color | color picker | `#4466aa` | Color de las partículas de fondo |
| Forma | (mismos estilos que texto) | Trazo | Estilo de dibujo |
| Tamaño forma | 0.3–4, step 0.1 | 0.8 | Tamaño de formas (no trail) |
| Evitar zona origen | toggle | on | Si está activo, las partículas de fondo evitan aparecer dentro del texto y se mueven al 10% de velocidad cuando están dentro |

### Flow field (fondo)

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Escala ruido | 50–3000, step 25 | 800 | Escala de ruido (independiente del texto) |
| Mult. ángulo | 0.5–12, step 0.25 | 2 | Multiplicador de ángulo |

---

## 7. Efectos visuales

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Color de fondo | color picker | `#000000` | Color usado para el fade overlay. Con `fadeAlpha` bajo, el fondo se construye gradualmente hacia este color |
| Fade / persistencia | 0.005–0.5, step 0.005 | 0.05 | Opacidad de la capa de desvanecimiento por frame. **Bajo** (ej. 0.01) = trails muy largos. **Alto** (ej. 0.3) = trails cortos, parpadeo rápido |
| Blend mode | Normal, Screen, Overlay, Color Dodge | Normal | Modo de mezcla Canvas para el renderizado de partículas |

### Blend modes

| Modo | Efecto |
|---|---|
| **Normal** (`source-over`) | Mezcla alfa estándar |
| **Screen** | Aclara (bueno para efectos de glow/luminosidad) |
| **Overlay** | Multiplica o aclara según el color de base |
| **Color Dodge** | Efecto brillante y saturado |

### Debug

| Control | Descripción |
|---|---|
| Grilla debug | Muestra la cuadrícula del flow field + celdas del texto resaltadas en azul |
| Imagen fuente debug | Superpone la imagen fuente original al 30% de opacidad |

### Cell size

| Control | Rango | Default | Descripción |
|---|---|---|---|
| Cell size | 2–20 px, step 1 | 5 | Tamaño de cada celda del flow field. **Más pequeño** = grid más fino (más precisión, más cómputo). Requiere "Reinicializar campo" |

---

## 8. Interacciones

### Push distortion

Arrastra el mouse/touch sobre el canvas: las partículas dentro del radio de influencia son empujadas hacia afuera.

| Parámetro | Default | Descripción |
|---|---|---|
| Radio | 120 px | Distancia máxima a la que el cursor afecta partículas |
| Fuerza | 3 | Intensidad del empuje. La fuerza disminuye linealmente con la distancia |

### Panel drag (solo desktop)

Arrastra el header del panel (zona con el título "FLOW FIELD · ENGINE") para reposicionarlo en cualquier lugar de la pantalla.

---

## 9. Grabación de video

### Cómo grabar

1. Ve a la pestaña **EFECTOS**
2. Configura la escena como desees
3. Haz clic en **"Iniciar grabación"** (el botón se pone rojo)
4. La grabación captura el canvas a 30 FPS en formato **WebM VP9** a 15 Mbps
5. Haz clic en **"Detener grabación"**
6. El navegador descarga automáticamente el archivo

### Detalles técnicos

| Aspecto | Especificación |
|---|---|
| Códec | VP9 (fallback VP8 si VP9 no está disponible) |
| Bitrate | 15 Mbps |
| FPS | 30 frames por segundo |
| Formato | WebM |
| Nombre archivo | `flowfield-YYYYMMDD-HHMMSS.webm` |

> **Nota:** La grabación se detiene automáticamente si la escena se reinicializa (por ejemplo, al cambiar el texto y aplicar cambios).

---

## 10. Exportar HTML standalone

### Cómo exportar

1. Configura la escena exactamente como la deseas
2. En la pestaña **ORÍGEN**, haz clic en **"Exportar HTML"**
3. El navegador descarga un archivo HTML completamente autónomo

### Características del archivo exportado

- **No necesita servidor** — se abre directamente en cualquier navegador
- El estado actual queda **incrustado** en el archivo (texto, colores, parámetros)
- Incluye su propio loop de animación y lógica de partículas
- Pesa aproximadamente 100–200 KB (dependiendo del estado serializado)

### Limitaciones

- Usa **Canvas2D exclusivamente** (no WebGPU)
- No incluye el panel de control ni UI interactiva
- No tiene grabación de video
- No tiene interacción push distortion
- Las fuentes externas (Google Fonts: Anton, Bebas Neue) se cargan al abrir el archivo

---

## 11. Modo móvil

En pantallas de **767 px o menos**, la interfaz se adapta automáticamente:

| Feature | Comportamiento |
|---|---|
| Panel | Se convierte en bottom sheet (se desliza desde abajo). Tapa ~65% de la pantalla |
| Botón toggle | Muestra **⚙** (abrir) / **✕** (cerrar) |
| FAB | El botón flotante ⚙ siempre visible en la esquina superior derecha |
| Fullscreen | Al girar a horizontal (landscape), entra automáticamente a fullscreen. Al volver a vertical, sale |
| HUD | Se reposiciona automáticamente arriba del panel cuando está abierto |
| Scroll | El contenido del panel se desplaza verticalmente (overflow scroll) |

---

## 12. WebGPU vs Canvas2D

### WebGPU

- **Se usa automáticamente** si el navegador lo soporta (`navigator.gpu`)
- Computa las partículas en la GPU (computo paralelo masivo)
- Renderiza trails/shapes con shaders WGSL dedicados
- Más rápido con muchas partículas (>5000)
- Puede no estar disponible en navegadores antiguos o algunos dispositivos móviles

### Canvas2D (fallback)

- Se usa si WebGPU no está disponible o falla la inicialización
- Cada partícula se actualiza y dibuja individualmente en JavaScript
- Más compatible (funciona en todos los navegadores modernos)
- Rendimiento adecuado hasta ~3000 partículas

La selección es automática y transparente. No hay controles para forzar uno u otro.

---

## 13. Atajos de teclado

| Tecla | Acción |
|---|---|
| `D` / `d` | Alternar grilla debug |

Solo existe un atajo de teclado. Se muestra en el footer del panel como "D = grilla debug".

---

## 14. Solución de problemas

### El canvas se ve negro y no pasan partículas

- **Causa posible**: Error en el bundle (syntax error). El build transform elimina imports línea por línea; si hay un `import { ... }` multi-línea, las líneas restantes generan syntax error
- **Solución**: Asegurarse de que todos los imports estén en una sola línea, o rebuildear con `node build.js`

### No se ven partículas pero los botones funcionan

- **Causa posible**: La importación dinámica de WebGPU falla en el bundle (la ruta relativa es incorrecta en el IIFE)
- **Solución**: Si el navegador soporta WebGPU, el código intenta hacer `import('./renderers/webgpu.js')` que no existe como archivo separado. El fallback a Canvas2D debería activarse automáticamente

### El rendimiento es lento en Canvas2D

- **Sugerencias**:
  - Reducir cantidad de partículas de texto (`S.txt.count`: 2000 → 1000)
  - Reducir cantidad de partículas de fondo (`S.bg.count`: 400 → 200)
  - Usar cell size más grande (5 → 8)
  - Usar modo **Normal** blend mode (es el más rápido)

### La grabación no inicia

- **Causas posibles**:
  - El navegador no soporta `MediaRecorder` con códec VP9 (intenta con Chrome/Edge)
  - La pestaña está en segundo plano (algunos navegadores limitan la captura en background)
- **Solución**: Usar Chrome o Edge, mantener la pestaña activa durante la grabación

### El panel no aparece en móvil

- **Asegúrate** de que el ancho de pantalla sea ≤ 767px (el modo bottom sheet solo se activa en ese rango)
- Si el panel no se ve, toca el botón **⚙** en la esquina superior derecha
