# Flow Field Studio

Generador de partículas con flow fields a partir de texto o imágenes. Renderiza en canvas con WebGL (Captura de Video).

## Probar online

[https://flowfieldstudio.jaralorescl.workers.dev](https://flowfieldstudio.jaralorescl.workers.dev)

## Uso local

```bash
# 1. Clonar
git clone https://github.com/javierjarart/FlowFieldStudio.git
cd FlowFieldStudio

# 2. Abrir directo (sin servidor)
node build.js
# luego abrir index.html en el navegador

# 3. O con servidor (para desarrollo con módulos ES)
python3 -m http.server 8080
# abrir http://localhost:8080
```

## Controles

- **Panel flotante**: se arrastra desde el header, colapsa con ▲ y reaparece con ⚙
- **Pestañas**: ORÍGEN, PARTÍCULAS, P. FONDO, EFECTOS
- **Origen**: Texto (fuente, tamaño, peso) o Imagen
- **Grabación**: botón en pestaña EFECTOS, exporta en WebM (VP9, 15 Mbps)

## Build

El proyecto usa módulos ES. Para usarlo sin servidor HTTP:

```bash
node build.js
```

Esto emsambla todos los módulos en un solo `<script>` inline dentro de `index.html`.
