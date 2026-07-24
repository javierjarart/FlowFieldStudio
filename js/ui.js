import { S, bus } from './state.js';
import { LFO } from './lfo.js';

let _effect = null;
let _recorder = null;
let _audioManager = null;
let _lfoManager = null;
let _postProcessor = null;

export function init(effectInstance, recorderInstance) {
  _effect = effectInstance;
  _recorder = recorderInstance;

  bindTabs();
  bindPanelToggle();
  bindSourceMode();
  bindTextControls();
  bindColorControls();
  bindImageControls();
  bindParticleSliders();
  bindParticleColorMode();
  bindParticleShape();
  bindBgControls();
  bindBgShape();
  bindFxControls();
  bindPostControls();
  bindAudioControls();
  bindLFOControls();
  bindExport();
  bindRecording();
  bindApplyAndReinit();
  bindPanelDrag();
}

export function wireAudio(audioMgr) { _audioManager = audioMgr; }
export function wireLFO(lfoMgr) { _lfoManager = lfoMgr; _lfoManager.initFromState(); }
export function wirePost(postProc) { _postProcessor = postProc; }

// ── Helpers ───────────────────────────────────────────────────────────
function bindSlider(id, valId, decimals, onChange) {
  const sl = document.getElementById(id);
  if (!sl) return;
  const vl = document.getElementById(valId);
  const upd = () => {
    const v = parseFloat(sl.value);
    if (vl) vl.textContent = v.toFixed(decimals);
    onChange(v);
  };
  sl.addEventListener('input', upd);
}

function bindToggle(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    el.classList.toggle('on');
    onChange(el.classList.contains('on'));
  });
}

function bindBtnGroup(selector, dataAttr, callback) {
  document.querySelectorAll(selector).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      callback(btn.dataset[dataAttr]);
    });
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = document.getElementById(btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}

// ── Panel collapse ────────────────────────────────────────────────────
function bindPanelToggle() {
  const panelEl = document.getElementById('panel');
  const toggleBtn = document.getElementById('togglePanel');
  const fab = document.getElementById('fab');
  if (!panelEl || !toggleBtn) return;

  const IS_MOBILE = window.matchMedia('(max-width: 767px)').matches;

  const update = () => {
    const collapsed = panelEl.classList.contains('collapsed');
    if (IS_MOBILE) {
      toggleBtn.textContent = collapsed ? '⚙' : '✕';
    } else {
      toggleBtn.textContent = collapsed ? '▼' : '▲';
    }
    toggleBtn.title = collapsed ? 'Abrir panel' : 'Cerrar panel';
  };

  toggleBtn.addEventListener('click', () => {
    panelEl.classList.toggle('collapsed');
    update();
  });

  if (fab) {
    fab.addEventListener('click', () => {
      panelEl.classList.toggle('collapsed');
      update();
    });
  }
}

// ── Source mode ───────────────────────────────────────────────────────
function bindSourceMode() {
  const textBtn = document.getElementById('srcModeText');
  const imgBtn  = document.getElementById('srcModeImg');
  if (!textBtn || !imgBtn) return;

  textBtn.addEventListener('click', () => {
    S.sourceMode = 'text';
    textBtn.classList.add('active');
    imgBtn.classList.remove('active');
    const textCtrls = document.getElementById('textSourceControls');
    const imgCtrls  = document.getElementById('imageSourceControls');
    if (textCtrls) textCtrls.style.display = 'block';
    if (imgCtrls)  imgCtrls.style.display  = 'none';
    _effect.init();
  });

  imgBtn.addEventListener('click', () => {
    S.sourceMode = 'image';
    imgBtn.classList.add('active');
    textBtn.classList.remove('active');
    const textCtrls = document.getElementById('textSourceControls');
    const imgCtrls  = document.getElementById('imageSourceControls');
    if (textCtrls) textCtrls.style.display = 'none';
    if (imgCtrls)  imgCtrls.style.display  = 'block';
    _effect.init();
  });
}

// ── Text controls ─────────────────────────────────────────────────────
function bindTextControls() {
  const textContent = document.getElementById('textContent');
  if (textContent) textContent.addEventListener('input', e => { S.text = e.target.value || ' '; });

  const fontFamily = document.getElementById('fontFamily');
  if (fontFamily) {
    fontFamily.addEventListener('change', e => {
      const v = e.target.value;
      const customRow = document.getElementById('customFontRow');
      if (customRow) customRow.style.display = v === 'custom' ? 'block' : 'none';
      if (v !== 'custom') S.fontFamily = v;
    });
  }

  const customFont = document.getElementById('customFontInput');
  if (customFont) customFont.addEventListener('input', e => { S.fontFamily = e.target.value; });

  const fontWeight = document.getElementById('fontWeight');
  if (fontWeight) fontWeight.addEventListener('change', e => { S.fontWeight = e.target.value; });

  bindSlider('fontSize',      'fontSizeVal',      0, v => { S.fontSize      = v; });
  bindSlider('letterSpacing', 'letterSpacingVal', 0, v => { S.letterSpacing = v; });
  bindSlider('bleedRadius',   'bleedVal',         0, v => { S.bleedRadius   = v; });
}

// ── Color controls ────────────────────────────────────────────────────
function bindColorControls() {
  bindBtnGroup('[data-cmode]', 'cmode', val => {
    S.colorMode = val;
    const solidRow = document.getElementById('colorSolidRow');
    const gradRow  = document.getElementById('colorGradRow');
    if (solidRow) solidRow.style.display = val === 'solid' ? 'block' : 'none';
    if (gradRow)  gradRow.style.display  = val === 'gradient' ? 'block' : 'none';
  });

  const solidColor = document.getElementById('solidColor');
  if (solidColor) solidColor.addEventListener('input', e => { S.solidColor = e.target.value; });

  ['grad0','grad1','grad2','grad3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => { S.gradColors[i] = e.target.value; });
  });

  bindBtnGroup('[data-gdir]', 'gdir', val => { S.gradDir = val; });
}

// ── Image controls ────────────────────────────────────────────────────
function bindImageControls() {
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        S.bgImage = img;
        _effect.init();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  const fileInput = document.getElementById('srcImageFile');
  if (fileInput) fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

  bindSlider('bgImgOpac', 'bgImgOpacVal', 2, v => { S.bgImgOpac = v; });
  bindToggle('showBgImage', v => { S.showBgImg = v; });
}

// ── Particle sliders ──────────────────────────────────────────────────
function bindParticleSliders() {
  bindSlider('txtCount',    'txtCountVal',    0,   v => { S.txt.count    = v; _effect.respawnText(); });
  bindSlider('txtSpeedMin', 'txtSpeedMinVal', 1,   v => { S.txt.speedMin = v; });
  bindSlider('txtSpeedMax', 'txtSpeedMaxVal', 1,   v => { S.txt.speedMax = v; });
  bindSlider('txtBoost',    'txtBoostVal',    1,   v => { S.txt.boost    = v; });
  bindSlider('txtTrailMin', 'txtTrailMinVal', 0,   v => { S.txt.trailMin = v; });
  bindSlider('txtTrailMax', 'txtTrailMaxVal', 0,   v => { S.txt.trailMax = v; });
  bindSlider('txtLine',     'txtLineVal',     1,   v => { S.txt.lineWidth= v; });
  bindSlider('txtOpac',     'txtOpacVal',     2,   v => { S.txt.opacity  = v; });
  bindSlider('txtNoise',    'txtNoiseVal',    0,   v => { S.txt.noiseScale=v; _effect.refreshTextFlow(); });
  bindSlider('txtAngle',    'txtAngleVal',    2,   v => { S.txt.angleMult = v; _effect.refreshTextFlow(); });
}

function bindParticleColorMode() {
  bindBtnGroup('[data-txtcolor]', 'txtcolor', val => {
    S.txt.colorMode = val;
    const solidRow = document.getElementById('txtSolidColorRow');
    if (solidRow) solidRow.style.display = val === 'solid' ? 'block' : 'none';
    _effect.textParticles.forEach(p => {
      if (val === 'white')       p.color = 'rgba(255,255,255,1)';
      else if (val === 'solid')  p.color = S.txt.solidColor;
    });
  });

  const solidColor = document.getElementById('txtSolidColor');
  if (solidColor) {
    solidColor.addEventListener('input', e => {
      S.txt.solidColor = e.target.value;
      if (S.txt.colorMode === 'solid')
        _effect.textParticles.forEach(p => { p.color = S.txt.solidColor; });
    });
  }
}

function bindParticleShape() {
  bindBtnGroup('[data-txt-shape]', 'txtShape', val => {
    S.txt.shape = val;
  });
  bindSlider('txtShapeSize', 'txtShapeSizeVal', 1, v => { S.txt.shapeSize = v; });
}

function bindBgShape() {
  bindBtnGroup('[data-bg-shape]', 'bgShape', val => {
    S.bg.shape = val;
  });
  bindSlider('bgShapeSize', 'bgShapeSizeVal', 1, v => { S.bg.shapeSize = v; });
}

// ── Background controls ───────────────────────────────────────────────
function bindBgControls() {
  bindToggle('bgEnabled', v => { S.bg.enabled = v; _effect.respawnBg(); });

  bindSlider('bgCount',    'bgCountVal',    0,  v => { S.bg.count    = v; _effect.respawnBg(); });
  bindSlider('bgSpeedMin', 'bgSpeedMinVal', 1,  v => { S.bg.speedMin = v; });
  bindSlider('bgSpeedMax', 'bgSpeedMaxVal', 1,  v => { S.bg.speedMax = v; });
  bindSlider('bgTrailMin', 'bgTrailMinVal', 0,  v => { S.bg.trailMin = v; });
  bindSlider('bgTrailMax', 'bgTrailMaxVal', 0,  v => { S.bg.trailMax = v; });
  bindSlider('bgLine',     'bgLineVal',     1,  v => { S.bg.lineWidth= v; });
  bindSlider('bgOpac',     'bgOpacVal',     2,  v => { S.bg.opacity  = v; });

  const bgColor = document.getElementById('bgParticleColor');
  if (bgColor) {
    bgColor.addEventListener('input', e => {
      S.bg.color = e.target.value;
      _effect.bgParticles.forEach(p => { p.color = S.bg.color; });
    });
  }

  bindToggle('bgAvoidText', v => { S.bg.avoidText = v; });
  bindSlider('bgNoise',  'bgNoiseVal',  0,  v => { S.bg.noiseScale = v; _effect.refreshBgFlow(); });
  bindSlider('bgAngle',  'bgAngleVal',  2,  v => { S.bg.angleMult  = v; _effect.refreshBgFlow(); });
}

// ── Fx controls ───────────────────────────────────────────────────────
function bindFxControls() {
  const bgColor = document.getElementById('bgColor');
  if (bgColor) bgColor.addEventListener('input', e => { S.bgColor = e.target.value; });

  bindSlider('fadeAlpha', 'fadeVal', 3, v => { S.fadeAlpha = v; });
  bindBtnGroup('[data-blend]', 'blend', val => { S.blendMode = val; });
  bindToggle('debugToggle',    v => { S.debug    = v; });
  bindToggle('debugImgToggle', v => { S.debugImg = v; });
  bindSlider('cellSize', 'cellSizeVal', 0, v => { S.cellSize = v; });
}

// ── Apply & Reinit ────────────────────────────────────────────────────
function bindApplyAndReinit() {
  const applyBtn = document.getElementById('applyBtn');
  if (applyBtn) applyBtn.addEventListener('click', () => { _effect.init(); });

  const reinitBtn = document.getElementById('reinitBtn');
  if (reinitBtn) reinitBtn.addEventListener('click', () => { _effect.init(); });
}

// ── Export ────────────────────────────────────────────────────────────
function bindExport() {
  const exportBtn = document.getElementById('exportHtmlBtn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => {
    const S_copy = {
      sourceMode:    S.sourceMode,
      text:          S.text,
      fontFamily:    S.fontFamily,
      fontWeight:    S.fontWeight,
      fontSize:      S.fontSize,
      letterSpacing: S.letterSpacing,
      colorMode:     S.colorMode,
      solidColor:    S.solidColor,
      gradColors:    [...S.gradColors],
      gradDir:       S.gradDir,
      bleedRadius:   S.bleedRadius,
      txt:           { ...S.txt },
      bg:            { ...S.bg },
      fadeAlpha:     S.fadeAlpha,
      bgColor:       S.bgColor,
      blendMode:     S.blendMode,
      cellSize:      S.cellSize,
      bgImgOpac:     S.bgImgOpac,
      showBgImg:     S.showBgImg,
      bgImageSrc:    S.bgImage ? S.bgImage.src : null,
      debug:         false,
      debugImg:      false
    };

    const code = [
      '<!DOCTYPE html>',
      '<html lang="es">',
      '<head>',
      '<meta charset="UTF-8"/>',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
      '<title>Flow Field · Animated</title>',
      '<style>',
      '  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }',
      '  body { background: ' + S_copy.bgColor + '; overflow: hidden; font-family: \'Segoe UI\', system-ui, monospace; }',
      '  canvas { display: block; position: fixed; top:0; left:0; }',
      '</style>',
      '<link rel="preconnect" href="https://fonts.googleapis.com">',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&display=swap">',
      '</head>',
      '<body>',
      '<canvas id="canvas1"></canvas>',
      '<script>',
      'var _p=(()=>{var p=Array.from({length:256},(_,i)=>i);for(let i=255;i>0;i--){var j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]]}return[...p,...p]})();',
      'function _fade(t){return t*t*t*(t*(t*6-15)+10)}function _lerp(t,a,b){return a+t*(b-a)}',
      'function _grad(h,x,y){var hh=h&3,u=hh<2?x:y,v=hh<2?y:x;return((hh&1)?-u:u)+((hh&2)?-v:v)}',
      'function noise(x,y){var X=Math.floor(x)&255,Y=Math.floor(y)&255;x-=Math.floor(x);y-=Math.floor(y);var u=_fade(x),v=_fade(y),a=_p[X]+Y,b=_p[X+1]+Y;return _lerp(v,_lerp(u,_grad(_p[a],x,y),_grad(_p[b],x-1,y)),_lerp(u,_grad(_p[a+1],x,y-1),_grad(_p[b+1],x-1,y-1)))*0.5+0.5}',
      '',
      'var S=' + JSON.stringify(S_copy) + ';',
      '',
      'var c=document.getElementById("canvas1"),ctx=c.getContext("2d");c.width=innerWidth;c.height=innerHeight;',
      '',
      'function drawShape(c,t,x,y,s){var d=s*2;c.save();c.translate(x,y);switch(t){case"circle":c.beginPath();c.arc(0,0,d/2,0,Math.PI*2);c.fill();break;case"triangle":c.beginPath();c.moveTo(0,-d/2);c.lineTo(-d/2,d/2);c.lineTo(d/2,d/2);c.closePath();c.fill();break;case"diamond":c.beginPath();c.moveTo(0,-d/2);c.lineTo(d/2,0);c.lineTo(0,d/2);c.lineTo(-d/2,0);c.closePath();c.fill();break;case"star":c.beginPath();for(var i=0;i<10;i++){var a=i*Math.PI/5-Math.PI/2,r=i%2===0?d/2:d/4;i===0?c.moveTo(Math.cos(a)*r,Math.sin(a)*r):c.lineTo(Math.cos(a)*r,Math.sin(a)*r)}c.closePath();c.fill();break;case"square":c.fillRect(-d/2,-d/2,d,d);break}c.restore()}',
      '',
      'class TextParticle{constructor(e){this.e=e;this._init()}_init(){var e=this.e,s=S.txt,cl=e.textCells[Math.floor(Math.random()*e.textCells.length)];this.x=cl.x+Math.random()*e.cellSize;this.y=cl.y+Math.random()*e.cellSize;this.speedMod=s.speedMin+Math.random()*(s.speedMax-s.speedMin);this.maxLen=Math.floor(s.trailMin+Math.random()*(s.trailMax-s.trailMin));this.history=[{x:this.x,y:this.y}];this.timer=this.maxLen*2;if(s.colorMode=="image")this.color=cl.color;else if(s.colorMode=="white")this.color="rgba(255,255,255,"+s.opacity+")";else this.color=s.solidColor}draw(c){if(this.history.length<2)return;c.save();c.globalCompositeOperation=S.blendMode;var sh=S.txt.shape;if(sh==="trail"){c.globalAlpha=S.txt.opacity;c.lineWidth=S.txt.lineWidth;c.strokeStyle=this.color;c.beginPath();c.moveTo(this.history[0].x,this.history[0].y);for(var i=1;i<this.history.length;i++)c.lineTo(this.history[i].x,this.history[i].y);c.stroke()}else{var L=this.history.length;c.fillStyle=this.color;for(var i=0;i<L;i++){var t=i/L,a=S.txt.opacity*(0.3+0.7*t),sz=S.txt.shapeSize*(0.2+0.8*t);c.globalAlpha=a;drawShape(c,sh,this.history[i].x,this.history[i].y,sz)}}c.restore()}update(){this.timer--;var e=this.e;if(this.timer>=1){var col=Math.max(0,Math.min(Math.floor(this.x/e.cellSize),e.columns-1)),row=Math.max(0,Math.min(Math.floor(this.y/e.cellSize),e.rows-1)),f=e.flowField[row*e.columns+col],a=f?f.angle:0,bo=(f&&f.inText)?S.txt.boost:1;this.x+=Math.cos(a)*this.speedMod*bo;this.y+=Math.sin(a)*this.speedMod*bo;this.history.push({x:this.x,y:this.y});if(this.history.length>this.maxLen)this.history.shift()}else if(this.history.length>1)this.history.shift();else this._init()}}',
      '',
      'class BgParticle{constructor(e){this.e=e;this._init()}_init(){var e=this.e,s=S.bg,t=0;do{this.x=Math.random()*e.width;this.y=Math.random()*e.height;t++}while(s.avoidText&&e.isTextZone(this.x,this.y)&&t<20);this.speedMod=s.speedMin+Math.random()*(s.speedMax-s.speedMin);this.maxLen=Math.floor(s.trailMin+Math.random()*(s.trailMax-s.trailMin));this.history=[{x:this.x,y:this.y}];this.timer=this.maxLen*2;this.color=s.color}draw(c){if(this.history.length<2)return;c.save();c.globalCompositeOperation=S.blendMode;var sh=S.bg.shape;if(sh==="trail"){c.globalAlpha=S.bg.opacity;c.lineWidth=S.bg.lineWidth;c.strokeStyle=this.color;c.beginPath();c.moveTo(this.history[0].x,this.history[0].y);for(var i=1;i<this.history.length;i++)c.lineTo(this.history[i].x,this.history[i].y);c.stroke()}else{var L=this.history.length;c.fillStyle=this.color;for(var i=0;i<L;i++){var t=i/L,a=S.bg.opacity*(0.3+0.7*t),sz=S.bg.shapeSize*(0.2+0.8*t);c.globalAlpha=a;drawShape(c,sh,this.history[i].x,this.history[i].y,sz)}}c.restore()}update(){this.timer--;var e=this.e,s=S.bg;if(this.timer>=1){var col=Math.max(0,Math.min(Math.floor(this.x/e.cellSize),e.columns-1)),row=Math.max(0,Math.min(Math.floor(this.y/e.cellSize),e.rows-1)),f=e.bgFlowField[row*e.columns+col],a=f?f.angle:0,i=e.isTextZone(this.x,this.y),sp=(s.avoidText&&i)?this.speedMod*0.1:this.speedMod;this.x+=Math.cos(a)*sp;this.y+=Math.sin(a)*sp;this.history.push({x:this.x,y:this.y});if(this.history.length>this.maxLen)this.history.shift();if(this.x<0||this.x>e.width||this.y<0||this.y>e.height)this._init()}else if(this.history.length>1)this.history.shift();else this._init()}}',
      '',
      'class Effect{constructor(c,ctx){this.canvas=c;this.context=ctx;this.width=c.width;this.height=c.height;this.cellSize=S.cellSize;this.flowField=[];this.bgFlowField=[];this.textCells=[];this.textMask=null;this.textParticles=[];this.bgParticles=[];this.rows=0;this.columns=0;this._srcImg=null;addEventListener("resize",()=>{this.resize(innerWidth,innerHeight)})}buildSourceImage(){if(S.sourceMode=="text")return this.buildTextImage();return new Promise(r=>{if(S.bgImage){r(S.bgImage)}else{var t=document.createElement("canvas");t.width=this.width;t.height=this.height;var tc=t.getContext("2d"),g=tc.createRadialGradient(this.width/2,this.height/2,20,this.width/2,this.height/2,Math.min(this.width,this.height)*0.35);g.addColorStop(0,"#0ff");g.addColorStop(0.5,"#70f");g.addColorStop(1,"#f07");tc.fillStyle=g;tc.beginPath();tc.arc(this.width/2,this.height/2,Math.min(this.width,this.height)*0.35,0,Math.PI*2);tc.fill();tc.fillStyle="#fff";tc.font="900 24px system-ui";tc.textAlign="center";tc.fillText("CARGA UNA IMAGEN",this.width/2,this.height/2);var i=new Image;i.onload=()=>r(i);i.src=t.toDataURL()}})}buildTextImage(){return new Promise(r=>{var w=this.width,h=this.height,fs=S.fontSize,lsp=S.letterSpacing,fill="",defs="";if(S.colorMode=="solid"){fill=S.solidColor}else{var x2="100%",y2="0%",x1="0%",y1="0%";if(S.gradDir=="v"){x2="0%";y2="100%"}if(S.gradDir=="d"){x2="100%";y2="100%"}var stops=S.gradColors.map((c,i)=>{var p=[0,33,66,100][i];return\'<stop offset="\'+p+\'%" stop-color="\'+c+\'"/>\'}).join("");defs=\'<defs><linearGradient id="tg" x1="\'+x1+\'" y1="\'+y1+\'" x2="\'+x2+\'" y2="\'+y2+\'">\'+stops+"</linearGradient></defs>";fill="url(#tg)"}var fontStr=S.fontWeight+" "+fs+"px "+S.fontFamily,oC=document.createElement("canvas").getContext("2d");oC.font=fontStr;var lines=S.text.split("\\n"),lineH=fs*1.1,totalH=lines.length*lineH,cy=h/2+fs*0.35-(totalH-lineH)/2,lspAttr=lsp!==0?"letter-spacing=\'"+lsp+"\'":"",textEls=lines.map((l,i)=>\'<text x="50%" y="\'+(cy+i*lineH)+\'" font-family="\'+S.fontFamily.replace(/"/g,"\'")+\'" font-weight="\'+S.fontWeight+\'" font-size="\'+fs+\'" \'+lspAttr+" text-anchor=\\"middle\\" dominant-baseline=\\"auto\\" fill=\'"+fill+"\'>"+l+"</text>").join(""),svg=\'<svg xmlns="http://www.w3.org/2000/svg" width="\'+w+\'" height="\'+h+\'">\'+defs+textEls+"</svg>",img=new Image;img.onload=()=>r(img);img.onerror=()=>{console.warn("SVG error");r(null)};img.src="data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(svg)))})}async init(){this.cellSize=S.cellSize;this.rows=Math.floor(this.height/this.cellSize);this.columns=Math.floor(this.width/this.cellSize);var img=await this.buildSourceImage();if(!img)return;this._srcImg=img;var off=document.createElement("canvas");off.width=this.width;off.height=this.height;var oCtx=off.getContext("2d");if(S.sourceMode=="text"){oCtx.drawImage(img,0,0)}else{var sc=Math.max(this.width/img.width,this.height/img.height);oCtx.drawImage(img,(this.width-img.width*sc)/2,(this.height-img.height*sc)/2,img.width*sc,img.height*sc)}var pixels=oCtx.getImageData(0,0,this.width,this.height),totalCells=this.rows*this.columns,rawMask=new Uint8Array(totalCells);this.flowField=[];this.textCells=[];for(var row=0;row<this.rows;row++){for(var col=0;col<this.columns;col++){var x=col*this.cellSize,y=row*this.cellSize,pi=(y*this.width+x)*4,r=pixels.data[pi],g=pixels.data[pi+1],b=pixels.data[pi+2],a=pixels.data[pi+3],idx=row*this.columns+col,inSource=a>10;rawMask[idx]=inSource?1:0;var angle=inSource?noise(x/S.txt.noiseScale,y/S.txt.noiseScale)*Math.PI*S.txt.angleMult:0;if(inSource)this.textCells.push({x,y,color:"rgb("+r+","+g+","+b+")"});this.flowField.push({angle,inText:inSource})}}this.textMask=this._dilate(rawMask,S.bleedRadius);if(S.bleedRadius>0){for(row=0;row<this.rows;row++){for(col=0;col<this.columns;col++){idx=row*this.columns+col;this.flowField[idx].inText=this.textMask[idx]>0}}}this.bgFlowField=[];for(row=0;row<this.rows;row++){for(col=0;col<this.columns;col++){x=col*this.cellSize;y=row*this.cellSize;this.bgFlowField.push({angle:noise(x/S.bg.noiseScale+100,y/S.bg.noiseScale+100)*Math.PI*S.bg.angleMult})}}this._spawnTextParticles();this._spawnBgParticles()}_dilate(mask,radius){if(radius<=0)return mask.slice();var out=new Uint8Array(mask.length),r=Math.ceil(radius/this.cellSize);for(var row=0;row<this.rows;row++){for(var col=0;col<this.columns;col++){if(mask[row*this.columns+col]){out[row*this.columns+col]=1;continue}outer:for(var dr=-r;dr<=r;dr++){for(var dc=-r;dc<=r;dc++){if(dr*dr+dc*dc>r*r)continue;var nr=row+dr,nc=col+dc;if(nr>=0&&nr<this.rows&&nc>=0&&nc<this.columns){if(mask[nr*this.columns+nc]){out[row*this.columns+col]=1;break outer}}}}}}return out}isTextZone(x,y){if(!this.textMask)return false;var col=Math.max(0,Math.min(Math.floor(x/this.cellSize),this.columns-1)),row=Math.max(0,Math.min(Math.floor(y/this.cellSize),this.rows-1));return this.textMask[row*this.columns+col]>0}_spawnTextParticles(){if(!this.textCells.length){this.textParticles=[];return}this.textParticles=Array.from({length:S.txt.count},()=>new TextParticle(this))}_spawnBgParticles(){if(!S.bg.enabled){this.bgParticles=[];return}this.bgParticles=Array.from({length:S.bg.count},()=>new BgParticle(this))}respawnText(){this._spawnTextParticles()}respawnBg(){this._spawnBgParticles()}refreshTextFlow(){for(var row=0;row<this.rows;row++){for(var col=0;col<this.columns;col++){var idx=row*this.columns+col;if(this.flowField[idx].inText){var x=col*this.cellSize,y=row*this.cellSize;this.flowField[idx].angle=noise(x/S.txt.noiseScale,y/S.txt.noiseScale)*Math.PI*S.txt.angleMult}}}}refreshBgFlow(){this.bgFlowField=[];for(var row=0;row<this.rows;row++){for(var col=0;col<this.columns;col++){var x=col*this.cellSize,y=row*this.cellSize;this.bgFlowField.push({angle:noise(x/S.bg.noiseScale+100,y/S.bg.noiseScale+100)*Math.PI*S.bg.angleMult})}}}render(c){this.bgParticles.forEach(function(p){p.draw(c);p.update()});this.textParticles.forEach(function(p){p.draw(c);p.update()})}resize(w,h){this.canvas.width=w;this.canvas.height=h;this.width=w;this.height=h;this.init()}}',
      '',
      'function hexToRgb(h){var n=parseInt(h.replace("#",""),16);return[(n>>16)&255,(n>>8)&255,n&255]}',
      '',
      'var ef=new Effect(c,ctx);ef.init().then(function(){function a(t){var _=hexToRgb(S.bgColor);ctx.fillStyle="rgba("+_[0]+","+_[1]+","+_[2]+","+S.fadeAlpha+")";ctx.fillRect(0,0,c.width,c.height);ef.render(ctx);requestAnimationFrame(a)}requestAnimationFrame(a)});',
      '<' + '/script>',
      '</body>',
      '</html>'
    ].join('\n');

    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = S.sourceMode === 'text' ? S.text : 'image';
    a.download = `flowfield-${filename.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'design'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ── Recording controls ────────────────────────────────────────────────
function bindRecording() {
  const startBtn = document.getElementById('recStart');
  const stopBtn  = document.getElementById('recStop');
  const elapsed  = document.getElementById('recElapsed');
  if (!startBtn || !stopBtn) return;

  startBtn.addEventListener('click', () => _recorder.start());
  stopBtn.addEventListener('click', () => _recorder.stop());

  bus.on('recorder:state', ({ state }) => {
    startBtn.style.display = state === 'IDLE' ? '' : 'none';
    stopBtn.style.display  = state === 'RECORDING' ? '' : 'none';
    if (state === 'IDLE' && elapsed) elapsed.textContent = '00:00';
  });

  bus.on('recorder:export', () => {
    if (elapsed) elapsed.textContent = '00:00';
  });

  setInterval(() => {
    if (_recorder.isRecording && elapsed) {
      const sec = Math.floor(_recorder.elapsed / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      elapsed.textContent = `${m}:${s}`;
    }
  }, 500);
}

// ── Post-processing controls ──────────────────────────────────────────
function bindPostControls() {
  bindToggle('postEnabled', v => { S.post.enabled = v; });
  bindToggle('postBloom', v => { S.post.bloom.enabled = v; });
  bindToggle('postCA', v => { S.post.ca.enabled = v; });
  bindToggle('postVignette', v => { S.post.vignette.enabled = v; });
  bindToggle('postGrain', v => { S.post.grain.enabled = v; });
  bindSlider('postBloomIntensity', 'postBloomIntensityVal', 2, v => { S.post.bloom.intensity = v; });
  bindSlider('postBloomRadius', 'postBloomRadiusVal', 0, v => { S.post.bloom.radius = v; });
  bindSlider('postCAAmount', 'postCAAmountVal', 1, v => { S.post.ca.amount = v; });
  bindSlider('postVignetteIntensity', 'postVignetteIntensityVal', 2, v => { S.post.vignette.intensity = v; });
  bindSlider('postGrainIntensity', 'postGrainIntensityVal', 3, v => { S.post.grain.intensity = v; });
}

// ── Audio controls ────────────────────────────────────────────────────
function bindAudioControls() {
  const micBtn = document.getElementById('audioMicBtn');
  if (micBtn) {
    micBtn.addEventListener('click', async () => {
      if (_audioManager && _audioManager.enabled) {
        _audioManager.stop();
        micBtn.textContent = '\u25cf Conectar microfono';
        micBtn.classList.remove('active', 'danger');
        const bars = ['audioBassBar','audioMidBar','audioTrebleBar'];
        bars.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
      } else if (_audioManager) {
        micBtn.textContent = '\u25b6 Conectando...';
        await _audioManager.start();
        micBtn.textContent = '\u25cf Desconectar';
        micBtn.classList.add('active');
        const bars = ['audioBassBar','audioMidBar','audioTrebleBar'];
        bars.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });
      }
    });
  }

  bindSlider('audioSensitivity', 'audioSensitivityVal', 2, v => { S.audio.sensitivity = v; });

  function bindBandMapping(band) {
    const targetSel = document.getElementById('audio' + band[0].toUpperCase() + band.slice(1) + 'Target');
    const minSl = document.getElementById('audio' + band[0].toUpperCase() + band.slice(1) + 'Min');
    const maxSl = document.getElementById('audio' + band[0].toUpperCase() + band.slice(1) + 'Max');
    const minVal = document.getElementById('audio' + band[0].toUpperCase() + band.slice(1) + 'MinVal');
    const maxVal = document.getElementById('audio' + band[0].toUpperCase() + band.slice(1) + 'MaxVal');

    const mapping = S.audio.mapping.find(m => m.band === band);
    if (!mapping) return;

    if (targetSel) {
      targetSel.value = mapping.target;
      targetSel.addEventListener('change', e => { mapping.target = e.target.value; });
    }
    if (minSl && minVal) {
      minSl.value = mapping.min;
      minVal.textContent = mapping.min;
      minSl.addEventListener('input', () => {
        const v = parseFloat(minSl.value);
        mapping.min = v;
        minVal.textContent = v;
      });
    }
    if (maxSl && maxVal) {
      maxSl.value = mapping.max;
      maxVal.textContent = mapping.max;
      maxSl.addEventListener('input', () => {
        const v = parseFloat(maxSl.value);
        mapping.max = v;
        maxVal.textContent = v;
      });
    }
  }

  bindBandMapping('bass');
  bindBandMapping('mid');
  bindBandMapping('treble');

  bus.on('frame', () => {
    if (!_audioManager || !_audioManager.enabled || !S.audio.enabled) return;
    const bands = _audioManager.bands;
    const barIds = [
      { id: 'audioBassBar', val: bands.bass || 0 },
      { id: 'audioMidBar', val: bands.mid || 0 },
      { id: 'audioTrebleBar', val: bands.treble || 0 },
    ];
    for (const { id, val } of barIds) {
      const el = document.getElementById(id);
      if (el) {
        const inner = el.querySelector('div');
        if (inner) inner.style.width = (val * 100) + '%';
      }
    }
  });
}

// ── LFO controls ──────────────────────────────────────────────────────
function bindLFOControls() {
  const addBtn = document.getElementById('lfoAddBtn');
  const listEl = document.getElementById('lfoList');
  if (!addBtn || !listEl) return;

  document.querySelector('[data-tab="tab-mod"]')?.addEventListener('click', () => {
    renderLFOList();
  });

  const TARGETS = [
    { value: 'txt.speedMax', label: 'Velocidad max' },
    { value: 'txt.speedMin', label: 'Velocidad min' },
    { value: 'txt.boost', label: 'Boost origen' },
    { value: 'txt.noiseScale', label: 'Escala ruido txt' },
    { value: 'txt.angleMult', label: 'Angulo txt' },
    { value: 'txt.lineWidth', label: 'Grosor trail' },
    { value: 'txt.opacity', label: 'Opacidad txt' },
    { value: 'txt.shapeSize', label: 'Tamano forma txt' },
    { value: 'bg.speedMax', label: 'Vel. fondo max' },
    { value: 'bg.noiseScale', label: 'Escala ruido bg' },
    { value: 'bg.angleMult', label: 'Angulo bg' },
    { value: 'bg.lineWidth', label: 'Grosor bg' },
    { value: 'bg.opacity', label: 'Opacidad bg' },
    { value: 'fadeAlpha', label: 'Fade' },
  ];

  function renderLFOList() {
    if (!_lfoManager) return;
    listEl.innerHTML = '';
    _lfoManager.lfos.forEach((lfo, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#1a1a28; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:8px; margin-bottom:6px;';

      const header = document.createElement('div');
      header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';

      const title = document.createElement('span');
      title.textContent = 'LFO ' + (idx + 1);
      title.style.cssText = 'font-weight:600; font-size:10px; color:#8ad;';

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'background:none; border:none; color:#d96c6c; cursor:pointer; font-size:12px;';
      delBtn.addEventListener('click', () => {
        _lfoManager.removeLFO(lfo.id);
        S.lfos = _lfoManager.lfos.map(l => ({ ...l }));
        renderLFOList();
      });

      header.appendChild(title);
      header.appendChild(delBtn);
      card.appendChild(header);

      // Waveform selector
      const waveRow = document.createElement('div');
      waveRow.style.cssText = 'display:flex; gap:4px; margin-bottom:4px;';
      ['sine','square','saw','triangle'].forEach(w => {
        const btn = document.createElement('button');
        btn.textContent = w;
        btn.className = 'ctrl';
        if (w === lfo.waveform) btn.classList.add('active');
        btn.style.cssText = 'flex:1; padding:3px 4px; font-size:9px;';
        btn.addEventListener('click', () => {
          lfo.waveform = w;
          _lfoManager.syncToState();
          renderLFOList();
        });
        waveRow.appendChild(btn);
      });
      card.appendChild(waveRow);

      // Target selector
      const targetSel = document.createElement('select');
      targetSel.innerHTML = TARGETS.map(t =>
        `<option value="${t.value}"${t.value === lfo.target ? ' selected' : ''}>${t.label}</option>`
      ).join('');
      targetSel.style.cssText = 'width:100%; margin-bottom:4px;';
      targetSel.addEventListener('change', e => {
        lfo.target = e.target.value;
        _lfoManager.syncToState();
      });
      card.appendChild(targetSel);

      // Enable toggle
      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;';
      const toggleLabel = document.createElement('span');
      toggleLabel.textContent = 'Activo';
      toggleLabel.style.cssText = 'font-size:10px; color:rgba(255,255,255,0.6);';
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle' + (lfo.enabled ? ' on' : '');
      toggleBtn.addEventListener('click', () => {
        lfo.enabled = !lfo.enabled;
        toggleBtn.classList.toggle('on');
        _lfoManager.syncToState();
      });
      toggleRow.appendChild(toggleLabel);
      toggleRow.appendChild(toggleBtn);
      card.appendChild(toggleRow);

      // Frequency slider
      card.appendChild(makeSlider('Freq', lfo, 'frequency', 0.05, 10, 0.05, 2));
      // Amplitude slider
      card.appendChild(makeSlider('Amp', lfo, 'amplitude', 0, 5, 0.1, 1));
      // Offset slider
      card.appendChild(makeSlider('Offset', lfo, 'offset', -5, 5, 0.1, 1));

      // Oscilloscope mini preview
      const scope = document.createElement('canvas');
      scope.width = 260; scope.height = 24;
      scope.style.cssText = 'width:100%; height:24px; border-radius:3px; margin-top:4px; background:#0a0a14;';
      card.appendChild(scope);
      lfo._scopeCanvas = scope;
      lfo._scopeCtx = scope.getContext('2d');

      listEl.appendChild(card);
    });
  }

  function makeSlider(label, lfo, key, min, max, step, decimals) {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:4px;';
    const lbl = document.createElement('label');
    lbl.textContent = label + ' ';
    lbl.style.cssText = 'font-size:9.5px; color:rgba(255,255,255,0.5);';
    const valSpan = document.createElement('span');
    valSpan.className = 'badge';
    valSpan.style.cssText = 'font-size:9px; color:#8ad;';
    valSpan.textContent = lfo[key].toFixed(decimals);
    lbl.appendChild(valSpan);
    row.appendChild(lbl);

    const wrapper = document.createElement('div');
    wrapper.className = 'row-val';
    const sl = document.createElement('input');
    sl.type = 'range';
    sl.min = min; sl.max = max; sl.step = step;
    sl.value = lfo[key];
    sl.style.cssText = 'width:100%;';
    sl.addEventListener('input', () => {
      const v = parseFloat(sl.value);
      lfo[key] = v;
      valSpan.textContent = v.toFixed(decimals);
      _lfoManager.syncToState();
    });
    wrapper.appendChild(sl);
    row.appendChild(wrapper);
    return row;
  }

  addBtn.addEventListener('click', () => {
    if (!_lfoManager) return;
    _lfoManager.addLFO({ target: 'txt.speedMax', frequency: 0.5, amplitude: 2, offset: 2 });
    renderLFOList();
  });

  bus.on('frame', () => {
    if (!_lfoManager) return;
    for (const lfo of _lfoManager.lfos) {
      if (!lfo._scopeCtx || !lfo.enabled) continue;
      const c = lfo._scopeCtx;
      const w = c.canvas.width, h = c.canvas.height;
      c.clearRect(0, 0, w, h);
      c.strokeStyle = '#6c9ed9';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x < w; x++) {
        const t = x / w * 2;
        const fn = lfo._waveformFn || (() => 0);
        const phase = t + (lfo._phase || 0);
        let raw = 0;
        switch (lfo.waveform) {
          case 'sine': raw = Math.sin(phase * Math.PI * 2); break;
          case 'square': raw = Math.sin(phase * Math.PI * 2) >= 0 ? 1 : -1; break;
          case 'saw': raw = ((phase * 2) % 2) - 1; break;
          case 'triangle': raw = Math.abs(((phase * 2) % 2) - 1) * 2 - 1; break;
        }
        const y = h / 2 + raw * (h / 2 - 2);
        x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
  });
}

// ── Panel draggable ────────────────────────────────────────────────────
function bindPanelDrag() {
  if (window.matchMedia('(max-width: 767px)').matches) return;
  const panel = document.getElementById('panel');
  const header = document.getElementById('panel-header');
  if (!panel || !header) return;

  let dragging = false;
  let dragStartX, dragStartY, origLeft, origTop;

  header.addEventListener('mousedown', e => {
    if (e.target.id === 'togglePanel') return;
    if (panel.style.right !== '' && panel.style.right !== 'auto') {
      panel.style.right = '';
      panel.style.left = '';
    }
    const rect = panel.getBoundingClientRect();
    origLeft = rect.left;
    origTop  = rect.top;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragging = true;
    header.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panel.style.left = (origLeft + dx) + 'px';
    panel.style.top  = (origTop  + dy) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = 'grab';
  });
}
