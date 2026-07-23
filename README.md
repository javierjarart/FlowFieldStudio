<div align="center">

# Flow Field · Source Engine

**Generador de partículas con flow fields a partir de texto o imágenes**

Renderiza en canvas con captura de video en WebM (VP9).

[![Live Demo](https://img.shields.io/badge/demo-online-8a2be2?style=for-the-badge&logo=cloudflare&logoColor=white)](https://flowfieldstudio.jaralorescl.workers.dev)
[![GitHub](https://img.shields.io/badge/source-github-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/javierjarart/FlowFieldStudio)

<img src="Flowfieldstudio.png" alt="Flow Field Studio screenshot" width="700">

---

</div>

## 🚀 Probar online

[https://flowfieldstudio.jaralorescl.workers.dev](https://flowfieldstudio.jaralorescl.workers.dev)

## 💻 Uso local

```bash
# clonar
git clone https://github.com/javierjarart/FlowFieldStudio.git
cd FlowFieldStudio

# abrir directo (sin servidor)
node build.js
# luego abrir index.html en el navegador

# o con servidor (desarrollo con módulos ES)
python3 -m http.server 8080
# abrir http://localhost:8080
```

## 🎮 Controles

| Componente | Descripción |
|---|---|
| **Panel flotante** | Se arrastra desde el header, colapsa con ▲ y reaparece con ⚙ |
| **Pestañas** | ORÍGEN, PARTÍCULAS, P. FONDO, EFECTOS |
| **Origen** | Texto (fuente, tamaño, peso) o imagen |
| **Grabación** | Botón en EFECTOS → exporta WebM (VP9, 15 Mbps) |

## 🔧 Build

El proyecto usa módulos ES. Para usarlo sin servidor HTTP:

```bash
node build.js
```

Esto emsambla todos los módulos en un solo `<script>` inline dentro de `index.html`.

---

<div align="center">
  <sub>Flow Field · Source Engine &mdash; 2026</sub>
</div>
