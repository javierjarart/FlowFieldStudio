const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, 'js');
const HTML_FILE = path.join(__dirname, 'index.html');

const MODULE_ORDER = [
  'event-bus.js',
  'state.js',
  'perlin.js',
  'audio.js',
  'lfo.js',
  'renderers/canvas2d.js',
  'gpu/render.js',
  'gpu/compute.js',
  'renderers/webgpu.js',
  'postprocess.js',
  'effect.js',
  'recorder.js',
  'ui.js',
  'main.js',
];

function transform(src) {
  const lines = src.split('\n');
  const out = [];
  for (const raw of lines) {
    let line = raw;
    const trimmed = line.trim();

    // import { X as Y } from './...'  →  const Y = X;
    const namedAliasMatch = trimmed.match(/^import\s*\{\s*(\w+)\s+as\s+(\w+)\s*\}\s+from\s/);
    if (namedAliasMatch) {
      out.push(line.replace(trimmed, `const ${namedAliasMatch[2]} = ${namedAliasMatch[1]};`));
      continue;
    }

    // import { X, Y } from './...'  →  remove line
    const namedMatch = trimmed.match(/^import\s*\{/);
    if (namedMatch) {
      continue;
    }

    // import X from './...'  →  remove line
    const defaultMatch = trimmed.match(/^import\s+\w+\s+from\s/);
    if (defaultMatch) {
      continue;
    }

    // export default function X(...)  →  function X(...)
    // export default class X {...}    →  class X {...}
    // export default X;               →  // X is assigned to a var in scope
    line = line.replace(/^export\s+default\s+(function|class)\s+/, '$1 ');
    line = line.replace(/^\s*export\s+default\s+/, '');

    // export function X(...)  →  function X(...)
    // export class X {...}    →  class X {...}
    // export const X = ...    →  const X = ...
    // export let X = ...      →  let X = ...
    // export var X = ...      →  var X = ...
    line = line.replace(/^export\s+(function|class|const|let|var)\s+/, '$1 ');

    // export { X }  →  remove
    line = line.replace(/^export\s*\{[^}]*\}\s*;?\s*$/, '');

    out.push(line);
  }
  return out.join('\n');
}

function loadModule(filename) {
  const filepath = path.join(JS_DIR, filename);
  const src = fs.readFileSync(filepath, 'utf8');
  return transform(src);
}

function build() {
  const allJS = MODULE_ORDER.map(f => loadModule(f)).join('\n\n');
  const wrapped = `(function(){\n${allJS}\n})();`;

  let html = fs.readFileSync(HTML_FILE, 'utf8');
  const hasInline = html.includes('<script>(function(){');
  if (hasInline) {
    html = html.replace(/<script>\(function\(\)\{[\s\S]*?\}\)\(\)\;<\/script>/, () => `<script>${wrapped}</script>`);
  } else {
    html = html.replace('<script type="module" src="js/main.js">', () => `<script>${wrapped}</script>`);
  }
  fs.writeFileSync(HTML_FILE, html, 'utf8');
  console.log('index.html ensamblado');
}

build();
