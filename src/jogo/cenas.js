import * as THREE from 'three';
import { STACK } from './dados.js';
import { TIPOS, corpoPredio, portaria, emblema, decorar } from './predios.js';

/**
 * As duas cenas do jogo:
 *  - espaco: o mesmo sistema do site (9 planetas, um por area da stack) em
 *    escala de jogo, com sol, estrelas, poeira que da sensacao de velocidade
 *    e um cinturao de asteroides;
 *  - superficie: o chao de um planeta (morros low-poly na cor dele), ceu em
 *    degrade, cristais e a plataforma de pouso no centro.
 * Cada criador devolve { atualizar(dt, t, alvo), destruir() } e o que o loop
 * precisa (lista de planetas, altura do chao).
 */

// as mesmas areas da secao "Stack Universe" do site; cor por bioma no jogo
export const PLANETAS = [
  // igual ao "Stack Universe" do site (domains no index.html): orbita, angulo,
  // tamanho e matiz. atmosfera: ceu colorido, nuvens e camada de gas na
  // entrada; sem ela (tipo lua): ceu preto com estrelas, o chao so vai crescendo
  { key: 'frontend', nome: 'Frontend', orbita: 4.15, ang: .25, tam: 1.02, cor: 275, atmosfera: true },
  { key: 'backend', nome: 'Backend', orbita: 7.25, ang: 1.15, tam: .88, cor: 257, atmosfera: true },
  { key: 'mobile', nome: 'Mobile', orbita: 6.15, ang: 2.35, tam: .76, cor: 292, atmosfera: true },
  { key: 'data', nome: 'Data', orbita: 5.25, ang: 3.12, tam: .72, cor: 236, atmosfera: true },
  { key: 'security', nome: 'Security', orbita: 6.9, ang: 3.82, tam: .82, cor: 281, atmosfera: true },
  { key: 'infra', nome: 'Infra', orbita: 4.95, ang: 4.55, tam: .64, cor: 221, atmosfera: false },
  { key: 'tooling', nome: 'Tooling', orbita: 7.75, ang: 5.0, tam: .91, cor: 265, atmosfera: false },
  { key: 'analytics', nome: 'Analytics', orbita: 8.6, ang: 5.75, tam: .72, cor: 244, atmosfera: true },
  { key: 'ai', nome: 'AI Workflow', orbita: 5.95, ang: 6.2, tam: .79, cor: 286, atmosfera: false }
];
// escala do sistema: planetas e distancias grandes o bastante para a nave
// parecer pequena e o Shift (dobra) fazer sentido
// uma unidade do site = ESC metros: mesmas proporcoes de tamanho e distancia
// (os tamanhos crescem mais que as distancias: planetas bem maiores na tela,
// sem encostar uns nos outros — a menor folga fica em ~280 m)
const ESC = 700, ESC_ORBITA = ESC, ESC_TAM = 650;
export const LIMITE_ESPACO = 9500;
export const RAIO_SOL = 1.52 * ESC_TAM;

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// as texturas sao geradas uma vez (canvas em cache) e reaproveitadas pela
// superficie: o globo de la e o mesmo planeta visto do espaco
const _canvas = new Map();
function emCache(chave, gerar) { if (!_canvas.has(chave)) _canvas.set(chave, gerar()); return _canvas.get(chave); }
// a mesma textura procedural dos planetas do site (planetTexture)
export function canvasPlaneta(cor, seed) {
  return emCache(`p${cor}|${seed}`, () => {
    const hue = cor;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 1024, 512); grad.addColorStop(0, `hsl(${hue - 8},44%,7%)`); grad.addColorStop(.34, `hsl(${hue + 10},54%,16%)`); grad.addColorStop(.68, `hsl(${hue - 18},46%,12%)`); grad.addColorStop(1, `hsl(${hue + 6},42%,8%)`); x.fillStyle = grad; x.fillRect(0, 0, 1024, 512);
    let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    for (let i = 0; i < 220; i++) {
      const yy = rnd() * 512; const h = 5 + rnd() * 24;
      x.fillStyle = `hsla(${hue + (rnd() - .5) * 28},${42 + rnd() * 28}%,${12 + rnd() * 18}%,${.028 + rnd() * .06})`;
      x.fillRect(0, yy, 1024, h);
    }
    for (let i = 0; i < 210; i++) {
      const px = rnd() * 1024, py = rnd() * 512, rx = 18 + rnd() * 150, ry = 5 + rnd() * 40, a = .02 + rnd() * .08;
      x.fillStyle = `hsla(${hue + (rnd() - .5) * 40},${52 + rnd() * 28}%,${16 + rnd() * 30}%,${a})`; x.beginPath(); x.ellipse(px, py, rx, ry, rnd() * Math.PI, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 85; i++) {
      const px = rnd() * 1024, py = rnd() * 512, r = 10 + rnd() * 42;
      const g = x.createRadialGradient(px - r * .2, py - r * .25, 1, px, py, r);
      g.addColorStop(0, `hsla(${hue + 10},55%,${28 + rnd() * 16}%,${.16 + rnd() * .14})`);
      g.addColorStop(.55, `hsla(${hue - 8},45%,${12 + rnd() * 10}%,${.1 + rnd() * .12})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${.01 + rnd() * .025})`; x.fillRect(rnd() * 1024, rnd() * 512, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let y = 0; y < 512; y += 7) { x.fillStyle = `rgba(230,218,255,${.006 + (Math.sin(y * .11 + seed) * .004)})`; x.fillRect(0, y, 1024, 1); }
    const vign = x.createRadialGradient(512, 256, 30, 512, 256, 520); vign.addColorStop(0, 'rgba(255,255,255,.18)'); vign.addColorStop(.55, 'rgba(255,255,255,0)'); vign.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = vign; x.fillRect(0, 0, 1024, 512);
    return c;
  });
}
const semente = (i) => 27 + i * 41;   // a mesma do site
function texDeCanvas(c) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  return t;
}
// nuvens em volta do planeta (com atmosfera): uma casca transparente
function canvasNuvens(seed) {
  return emCache(`n${seed}`, () => {
    const W = 1024, H = 512;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); const r = rnd(seed);
    for (let i = 0; i < 55; i++) {
      // cada nuvem e um cacho de bolhas macias, esticado na horizontal
      const cx = r() * W, cy = H * .1 + r() * H * .8, n = 6 + r() * 16, esp = 20 + r() * 70;
      for (let k = 0; k < n; k++) {
        const px = cx + (r() - .5) * esp * 3, py = cy + (r() - .5) * esp * .6, R = 6 + r() * esp * .5;
        const g = x.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.beginPath(); x.ellipse(px, py, R * 1.8, R, 0, 0, Math.PI * 2); x.fill();
      }
    }
    return c;
  });
}
function texRadial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, cor]) => g.addColorStop(o, cor)); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------ pecas das duas cenas -- */
// a casca de nuvens fica a 8% do raio: no globo da superficie, ~480 m (a
// altura das nuvens de la)
const NUVENS_ALT = 1.08;
/**
 * Um planeta: grupo (posicao/escala) > corpo (gira), atmosfera, nuvens e,
 * no Tooling, o anel. Sem neblina: no espaco nao tem; no ceu da superficie os
 * outros planetas aparecem atras do ar. Quem entra liga a neblina (focar).
 */
function montarPlaneta(d, i, raio, guarda) {
  const g = new THREE.Group(), hue = d.cor;
  // material, atmosfera fina, "sombra" e anel: iguais ao site
  const tex = guarda(texDeCanvas(canvasPlaneta(hue, semente(i))));
  const corpo = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio, 80, 60)), guarda(new THREE.MeshPhysicalMaterial({
    map: tex, bumpMap: tex, bumpScale: .08, roughnessMap: tex, color: new THREE.Color(`hsl(${hue},52%,72%)`), roughness: .82, metalness: .03,
    clearcoat: .12, clearcoatRoughness: .68, sheen: .25, sheenColor: new THREE.Color(`hsl(${hue + 6},38%,74%)`),
    emissive: new THREE.Color(`hsl(${hue},78%,10%)`), emissiveIntensity: .42, fog: false
  })));
  g.add(corpo);
  g.add(new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * 1.055, 56, 40)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${hue},76%,70%)`), transparent: true, opacity: .085, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false }))));
  const sombra = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * 1.006, 48, 36)), guarda(new THREE.MeshBasicMaterial({ transparent: true, opacity: .06, color: 0xffffff, fog: false })));
  sombra.position.x = raio * .03; g.add(sombra);
  if (d.key === 'tooling') {
    const anel = new THREE.Mesh(guarda(new THREE.RingGeometry(raio * 1.25, raio * 1.85, 96)), guarda(new THREE.MeshBasicMaterial({ color: 0x9a78ff, transparent: true, opacity: .28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    anel.rotation.x = Math.PI / 2.55; anel.rotation.y = .35; g.add(anel);
  }
  // so do jogo, e so aparecem chegando perto (de longe fica igual ao site):
  // a atmosfera grossa e as nuvens
  const atm = atmosfera(raio, hue, guarda); atm.uniforms.forca.value = 0;
  let nuvens = null;
  if (d.atmosfera) {
    g.add(atm);
    nuvens = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * NUVENS_ALT, 96, 48)), guarda(new THREE.MeshStandardMaterial({
      map: guarda(texDeCanvas(canvasNuvens(90 + i))), color: new THREE.Color(`hsl(${hue},30%,82%)`), transparent: true, opacity: 0, depthWrite: false, roughness: 1, fog: false
    })));
    nuvens.visible = false; g.add(nuvens);
  }
  return { grupo: g, corpo, atm, nuvens };
}
/**
 * Atmosfera vista de fora: uma casca de 20% do raio que brilha mais rente ao
 * planeta e some na borda (pela distancia do raio de visao ao centro), mais
 * um brilho na beirada do disco. Aditiva; `forca` apaga quando a nave entra.
 */
const ATM_ALT = 1.2;
function atmosfera(raio, cor, guarda) {
  const u = { cor: { value: new THREE.Color(`hsl(${cor},85%,62%)`) }, forca: { value: 1 }, rP: { value: raio }, rS: { value: raio * ATM_ALT } };
  const vs = `varying vec3 vW; varying vec3 vC; varying float vE; varying vec3 vN;
    void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vC = (modelMatrix * vec4(0.,0.,0.,1.)).xyz;
      vE = length(modelMatrix[0].xyz); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
  const casca = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * ATM_ALT, 64, 32)), guarda(new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vs, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 cor; uniform float forca, rP, rS; varying vec3 vW; varying vec3 vC; varying float vE;
      void main(){
        vec3 d = normalize(vW - cameraPosition), oc = vC - cameraPosition;
        float b = length(oc - d * dot(oc, d));
        float h = clamp((b - rP * vE) / ((rS - rP) * vE), 0., 1.);
        float a = pow(1. - h, 2.4) * forca;
        gl_FragColor = vec4(cor * a, 1.);
      }`
  })));
  const borda = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * 1.004, 64, 32)), guarda(new THREE.ShaderMaterial({
    uniforms: u, vertexShader: vs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform vec3 cor; uniform float forca; varying vec3 vW; varying vec3 vN;
      void main(){ float f = 1. - max(0., dot(normalize(vN), normalize(cameraPosition - vW)));
        gl_FragColor = vec4(cor * pow(f, 3.) * .9 * forca, 1.); }`
  })));
  const g = new THREE.Group(); g.add(casca, borda); g.uniforms = u;
  return g;
}
// o sol do site: esfera com plasma procedural (shader) e tres brilhos
function texBrilhoSol() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,255,1)'); g.addColorStop(.1, 'rgba(212,179,255,.98)'); g.addColorStop(.35, 'rgba(135,80,255,.45)'); g.addColorStop(1, 'rgba(76,30,180,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
}
function texRaiosSol(seed) {
  return emCache(`sol${seed}`, () => {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const x = c.getContext('2d'), cx = 512, cy = 512;
    let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(cx, cy, 10, cx, cy, 500);
    g.addColorStop(0, 'rgba(255,255,255,.92)'); g.addColorStop(.07, 'rgba(246,225,255,.58)'); g.addColorStop(.18, 'rgba(201,158,255,.27)'); g.addColorStop(.42, 'rgba(126,76,255,.10)'); g.addColorStop(1, 'rgba(71,31,150,0)');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 54; i++) {
      const a = rnd() * Math.PI * 2, inner = 78 + rnd() * 70, len = 150 + rnd() * 330, width = .002 + rnd() * .012, alpha = .025 + rnd() * .11;
      x.save(); x.translate(cx, cy); x.rotate(a);
      const lg = x.createLinearGradient(inner, 0, inner + len, 0);
      lg.addColorStop(0, `rgba(255,247,255,${alpha})`); lg.addColorStop(.18, `rgba(224,190,255,${alpha * .78})`); lg.addColorStop(1, 'rgba(160,100,255,0)');
      x.fillStyle = lg; x.beginPath(); x.moveTo(inner, -inner * width); x.lineTo(inner + len, -(inner + len) * width * .22); x.lineTo(inner + len, (inner + len) * width * .22); x.lineTo(inner, inner * width); x.closePath(); x.fill(); x.restore();
    }
    [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].forEach((a, k) => {
      x.save(); x.translate(cx, cy); x.rotate(a);
      const lg = x.createLinearGradient(74, 0, 500, 0);
      lg.addColorStop(0, k < 2 ? 'rgba(255,255,255,.23)' : 'rgba(225,200,255,.12)'); lg.addColorStop(.25, k < 2 ? 'rgba(217,182,255,.10)' : 'rgba(180,135,255,.06)'); lg.addColorStop(1, 'rgba(155,95,255,0)');
      x.fillStyle = lg; x.beginPath(); x.moveTo(74, -3.1); x.lineTo(500, -.4); x.lineTo(500, .4); x.lineTo(74, 3.1); x.closePath(); x.fill(); x.restore();
    });
    return c;
  });
}
const SOL_FRAG = `precision highp float; uniform float uTime; uniform float uPulse; varying vec3 vP;
  float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
  float fbm(vec3 p){ float v=0.0,a=.55; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec3(1.7,-.9,1.2); a*=.48; } return v; }
  void main(){
    vec3 n=normalize(vP); float t=uTime*.16;
    float f1=fbm(n*3.2+vec3(t,-t*.7,t*.45)); float f2=fbm(n*6.4+vec3(-t*.45,t*.9,-t*.35));
    float plasma=smoothstep(.18,.88,f1*.76+f2*.42); float veins=pow(max(0.0,1.0-abs(f1-f2)*2.35),3.0);
    vec3 deep=vec3(.20,.02,.42), violet=vec3(.56,.15,1.0), hot=vec3(1.0,.68,1.0), whiteHot=vec3(1.0,.97,1.0);
    vec3 col=mix(deep,violet,plasma);
    col=mix(col,hot,smoothstep(.46,.86,plasma+veins*.18));
    col=mix(col,whiteHot,smoothstep(.73,1.04,plasma+veins*.36));
    col*=1.22+plasma*.9+veins*.5;
    col+=whiteHot*pow(plasma,5.0)*(1.0+.35*uPulse);
    gl_FragColor=vec4(col,1.0);
  }`;
function montarSol(guarda) {
  const raio = RAIO_SOL, u = { uTime: { value: 0 }, uPulse: { value: 1 } };
  const sol = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio, 96, 64)), guarda(new THREE.ShaderMaterial({
    uniforms: u, fragmentShader: SOL_FRAG,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
  })));
  sol.uniforms = u;
  // os brilhos (no site: 4.9, 8.7 e 11.3 para um sol de raio 1.52)
  const k = raio / 1.52;
  const sp = (map, cor, op, esc) => { const s = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map, color: cor, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); s.scale.setScalar(esc * k); sol.add(s); };
  sp(guarda(texBrilhoSol()), 0xf4e9ff, .5, 4.9);
  const raios = (s) => { const tx = new THREE.CanvasTexture(texRaiosSol(s)); tx.colorSpace = THREE.SRGBColorSpace; return guarda(tx); };
  sp(raios(41), 0xb584ff, .56, 8.7);
  sp(raios(93), 0xf0d9ff, .31, 11.3);
  return sol;
}
// ceu: um fundo pintado (faixa da Via Lactea e nebulosas) e tres camadas de
// estrelas com brilho, cor e cintilar proprios (sempre as mesmas: a
// superficie dos tipo lua mostra o mesmo ceu, girado)
function canvasFundo() {
  return emCache('fundo', () => {
    const W = 2048, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), r = rnd(4242);
    x.fillStyle = '#04030a'; x.fillRect(0, 0, W, H);
    const nuvem = (cx, cy, rx, ry, cor, a) => {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rx); g.addColorStop(0, cor.replace('A', a)); g.addColorStop(1, cor.replace('A', 0));
      x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rx, 0, Math.PI * 2); x.fill(); x.restore();
    };
    x.globalCompositeOperation = 'lighter';
    // faixa da galaxia: ondula pelo meio da textura
    for (let i = 0; i < 520; i++) {
      const px = r() * W, py = H / 2 + Math.sin(px / W * Math.PI * 2) * 60 + (r() - .5) * (r() < .7 ? 90 : 220);
      const cores = ['rgba(150,110,255,A)', 'rgba(255,120,200,A)', 'rgba(110,160,255,A)', 'rgba(255,220,240,A)'];
      nuvem(px, py, 30 + r() * 130, 14 + r() * 50, cores[Math.floor(r() * cores.length)], .025 + r() * .05);
    }
    // poeira escura cortando a faixa
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 160; i++) { const px = r() * W, py = H / 2 + Math.sin(px / W * Math.PI * 2) * 60 + (r() - .5) * 40; nuvem(px, py, 20 + r() * 60, 6 + r() * 14, 'rgba(4,3,10,A)', .25 + r() * .3); }
    x.globalCompositeOperation = 'lighter';
    // nebulosas soltas
    for (let i = 0; i < 9; i++) {
      const px = r() * W, py = 120 + r() * (H - 240), cor = ['rgba(124,77,255,A)', 'rgba(255,61,154,A)', 'rgba(61,123,255,A)', 'rgba(61,220,200,A)'][i % 4];
      for (let k = 0; k < 26; k++) nuvem(px + (r() - .5) * 260, py + (r() - .5) * 140, 40 + r() * 140, 30 + r() * 90, cor, .02 + r() * .04);
    }
    // poeira de estrelas fininha (mais densa na faixa)
    for (let i = 0; i < 14000; i++) {
      const naFaixa = r() < .55, px = r() * W, py = naFaixa ? H / 2 + Math.sin(px / W * Math.PI * 2) * 60 + (r() - .5) * (r() * 200) : r() * H;
      x.fillStyle = `rgba(255,255,255,${.08 + r() * .3})`; x.fillRect(px, py, 1, 1);
    }
    return c;
  });
}
function ceuEstrelado(guarda, mats) {
  const ceu = new THREE.Group();
  const tf = guarda(new THREE.CanvasTexture(canvasFundo())); tf.colorSpace = THREE.SRGBColorSpace;
  const fundo = new THREE.Mesh(guarda(new THREE.SphereGeometry(21000, 48, 24)), guarda(new THREE.MeshBasicMaterial({ map: tf, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false })));
  fundo.rotation.set(.35, 0, .55); fundo.renderOrder = -3; ceu.add(fundo); mats?.push([fundo.material, 1]);
  // estrelas: tamanho, cor (azulada, branca, amarela, avermelhada) e cintilar
  const uni = { tempo: { value: 0 }, opacidade: { value: 1 } };
  const camada = (n, R, tMin, tMax, seed, faixa) => {
    const p = new Float32Array(n * 3), cor = new Float32Array(n * 3), tam = new Float32Array(n), fase = new Float32Array(n); const r = rnd(seed);
    for (let i = 0; i < n; i++) {
      let u = r() * 2 - 1, a = r() * Math.PI * 2;
      if (faixa && r() < .5) u = (r() - .5) * .25;            // parte delas junto da faixa
      const s = Math.sqrt(1 - u * u);
      p[i * 3] = s * Math.cos(a) * R; p[i * 3 + 1] = u * R; p[i * 3 + 2] = s * Math.sin(a) * R;
      const tipo = r(), c = tipo < .18 ? [.7, .8, 1] : tipo < .7 ? [1, 1, 1] : tipo < .9 ? [1, .92, .75] : [1, .7, .6];
      cor.set(c, i * 3); tam[i] = tMin + Math.pow(r(), 3) * (tMax - tMin); fase[i] = r() * 100;
    }
    const g = guarda(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    g.setAttribute('tam', new THREE.BufferAttribute(tam, 1)); g.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    const pts = new THREE.Points(g, guarda(new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float tam; attribute float fase; varying vec3 vC; varying float vB; uniform float tempo;
        void main(){ vC = color; vB = .65 + .35 * sin(tempo * (1.5 + fract(fase) * 3.) + fase);
          vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = tam * (.8 + .4 * vB); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float opacidade; varying vec3 vC; varying float vB;
        void main(){ vec2 d = gl_PointCoord - .5; float r = length(d) * 2.;
          float nucleo = smoothstep(1., .0, r); float cruz = max(0., 1. - abs(d.x) * 14.) * max(0., 1. - abs(d.y) * 2.) + max(0., 1. - abs(d.y) * 14.) * max(0., 1. - abs(d.x) * 2.);
          float a = (pow(nucleo, 2.5) + cruz * .35) * vB * opacidade; if (a < .01) discard;
          gl_FragColor = vec4(vC * a, a); }`,
      vertexColors: true
    })));
    pts.frustumCulled = false; ceu.add(pts);
  };
  camada(7000, 19000, 1.2, 2.6, 9, true);
  camada(1400, 18500, 2.2, 5.5, 19, true);
  camada(160, 18000, 5, 11, 29, false);
  mats?.push([{ set opacity(v) { uni.opacidade.value = v; } }, 1]);
  ceu.userData.tempo = uni.tempo;
  return ceu;
}
/**
 * Buraco negro (cenario, longe): horizonte preto, anel de fotons, disco de
 * acrecao girando (shader) e um anel "dobrado" por cima, de frente para a
 * camera (o efeito de lente do disco de tras).
 */
function buracoNegro(raio, guarda) {
  const g = new THREE.Group();
  const u = { tempo: { value: 0 } };
  const disco = new THREE.Mesh(guarda(new THREE.RingGeometry(raio * 1.5, raio * 5.5, 160, 4)), guarda(new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float tempo; varying vec2 vP;
      float h(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x);
        float k = clamp((r - ${(raio * 1.5).toFixed(1)}) / ${(raio * 4).toFixed(1)}, 0., 1.);
        float giro = a + tempo * (1.4 - k) * 1.2 + k * 6.;
        float faixas = .55 + .45 * sin(giro * 3. + k * 40.) * sin(giro * 7. - k * 23. + 1.7);
        vec3 quente = vec3(1., .95, .85), meio = vec3(1., .55, .2), frio = vec3(.55, .25, .9);
        vec3 c = mix(quente, meio, smoothstep(0., .35, k)); c = mix(c, frio, smoothstep(.35, 1., k));
        float al = (1. - smoothstep(.7, 1., k)) * smoothstep(0., .05, k) * (.55 + .45 * faixas);
        gl_FragColor = vec4(c * al * 1.6, al);
      }`
  })));
  disco.rotation.x = Math.PI / 2 - .22; g.add(disco);
  // brilho/anel de fotons e o arco de lente, sempre de frente (sprites)
  const tex = (f) => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); f(x); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return guarda(t); };
  const anel = tex((x) => { const gr = x.createRadialGradient(256, 256, 70, 256, 256, 256); gr.addColorStop(0, 'rgba(255,240,220,0)'); gr.addColorStop(.36, 'rgba(255,230,200,0)'); gr.addColorStop(.4, 'rgba(255,235,210,1)'); gr.addColorStop(.47, 'rgba(255,150,80,.55)'); gr.addColorStop(.7, 'rgba(160,80,255,.12)'); gr.addColorStop(1, 'rgba(120,60,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 512, 512); });
  const sp = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: anel, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  sp.scale.setScalar(raio * 5.4); g.add(sp);
  const horizonte = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio, 48, 32)), guarda(new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })));
  horizonte.renderOrder = 2; g.add(horizonte);
  g.userData.u = u;
  return g;
}
// rocha: icosaedro amassado por ruido (o mesmo deslocamento para vertices
// repetidos: sem rachaduras)
function geoRocha(seed, guarda) {
  const geo = guarda(new THREE.IcosahedronGeometry(1, 1)), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * .5 + Math.sin(v.z * 4.3 + v.x * 1.7 + seed * 2) * .25;
    v.multiplyScalar(1 + n * .35); p.setXYZ(i, v.x, v.y * .8, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
// ceu com ar: degrade da cor do planeta (claro no horizonte, escuro no alto).
// O "alto" e o y local; no espaco o domo e girado para o "cima" da superficie
function domoCeu(cor, ar, guarda) {
  return new THREE.Mesh(guarda(new THREE.SphereGeometry(9000, 32, 16)), guarda(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, transparent: true,
    uniforms: { forca: { value: 1 }, baixo: { value: ar ? new THREE.Color(`hsl(${cor},55%,32%)`) : new THREE.Color(0x05050c) }, alto: { value: ar ? new THREE.Color(`hsl(${(cor + 30) % 360},60%,6%)`) : new THREE.Color(0x000000) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 baixo; uniform vec3 alto; uniform float forca; varying float h; void main(){ gl_FragColor = vec4(mix(baixo, alto, smoothstep(-.05,.6,h)), forca); }'
  })));
}
// cor do chao / ceu de um planeta (o globo da superficie usa corChao * 1.6)
export function coresPlaneta(d) {
  const ar = d.atmosfera !== false;
  return {
    chao: ar ? new THREE.Color(`hsl(${d.cor},35%,34%)`) : new THREE.Color(`hsl(${d.cor},10%,38%)`),
    ceu: ar ? new THREE.Color(`hsl(${d.cor},45%,18%)`) : new THREE.Color(0x020207)
  };
}
// os planetas e o sol vistos de longe ficam a esta distancia da camera (com o
// tamanho na mesma proporcao: o angulo na tela e o mesmo)
export const DIST_CEU = 7000;
// luzes da superficie (o espaco acende as mesmas no fim da entrada)
const LUZ_SUP = new THREE.Vector3(200, 300, 120).normalize();
export function luzesSuperficie(d) {
  return { cima: new THREE.Color(`hsl(${d.cor},60%,70%)`), baixo: new THREE.Color(`hsl(${d.cor},40%,12%)`) };
}

/* ================================================================ espaco == */
export function criarEspaco(cena) {
  const lixo = [];
  const guarda = (o) => { lixo.push(o); return o; };
  cena.background = new THREE.Color(0x05040b);
  cena.fog = null;

  const matsCeu = [], orbitas = [];       // o que some ao entrar na atmosfera de um planeta
  let focado = null;                      // planeta em que a nave esta entrando (para de girar)
  // estrelas (acompanham a camera: sao o "ceu")
  const ceu = ceuEstrelado(guarda, matsCeu); cena.add(ceu);
  // ceu do planeta em que se entra (aparece com a atmosfera)
  let domo = null;

  // sol (a luz vai junto quando ele e reposicionado)
  const sol = montarSol(guarda); cena.add(sol);
  // as luzes do site, em escala (a pontual cai com a distancia: intensidade
  // corrigida por ESC^decaimento para iluminar igual)
  const luzSol = new THREE.PointLight(0xf2ddff, 235 * Math.pow(ESC, 1.34), 50 * ESC, 1.34); cena.add(luzSol);
  const luzSolSup = new THREE.PointLight(0xfff0dd, 0, 0, 0); cena.add(luzSolSup);   // a do ceu da superficie
  const luzesSite = [
    [new THREE.HemisphereLight(0x9084ff, 0x120f1d, .88), .88],
    [new THREE.DirectionalLight(0xb59cff, 1.8), 1.8],
    [new THREE.PointLight(0x6ec8ff, 28 * Math.pow(ESC, 1.9), 70 * ESC, 1.9), 28 * Math.pow(ESC, 1.9)],
    [new THREE.AmbientLight(0x201a2f, .92), .92]
  ];
  luzesSite[1][0].position.set(-12, 10, 12); luzesSite[2][0].position.set(-14 * ESC, 4 * ESC, -18 * ESC);
  luzesSite.forEach(([l]) => cena.add(l));
  // na entrada acendem as luzes da superficie (o "sol" de la e o ceu): entrando
  // pelo lado da noite, o planeta era uma bola escura, e a troca de cena casa
  const luzEntrada = new THREE.DirectionalLight(0xfff1e0, 0); cena.add(luzEntrada, luzEntrada.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0); cena.add(hemi);

  // planetas
  const planetas = PLANETAS.map((d, i) => {
    const raio = d.tam * ESC_TAM;
    const m = montarPlaneta(d, i, raio, guarda);
    const R = d.orbita * ESC_ORBITA;
    // orbitas elipticas como no site (z * .55)
    m.grupo.position.set(Math.cos(d.ang) * R, 0, Math.sin(d.ang) * R * .55);
    cena.add(m.grupo);
    // orbita desenhada
    const pts = []; for (let k = 0; k <= 180; k++) { const a = k / 180 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R * .55)); }
    const orb = new THREE.Line(guarda(new THREE.BufferGeometry().setFromPoints(pts)), guarda(new THREE.LineBasicMaterial({ color: 0x7350c7, transparent: true, opacity: .15, fog: false })));
    cena.add(orb); orbitas.push(orb);
    return { ...d, i, raio, ...m, pos: m.grupo.position, orig: m.grupo.position.clone() };
  });

  // cinturao de asteroides por fora do sistema (girando devagar)
  const matRocha = guarda(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true, transparent: true, fog: false }));
  const corRocha = (r, c) => c.setHSL(.7 + (r() - .5) * .12, .12 + r() * .15, .32 + r() * .25);
  const cinturao = (() => {
    const n = 5000, geo = geoRocha(1.7, guarda);
    const inst = new THREE.InstancedMesh(geo, matRocha, n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const r = rnd(77);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, R = 9.4 * ESC + (r() - .5) * 700 * (r() < .8 ? 1 : 2);
      p.set(Math.cos(a) * R, (r() - .5) * 260 * r(), Math.sin(a) * R * .55);
      q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); const k = 8 + Math.pow(r(), 3) * 70; s.set(k, k * (.6 + r() * .6), k * (.8 + r() * .4));
      inst.setMatrixAt(i, m.compose(p, q, s)); inst.setColorAt(i, corRocha(r, c));
    }
    cena.add(inst); return inst;
  })();
  // campos de asteroides grandes, girando: dao para atravessar desviando e
  // para destruir com os tiros
  const rochas = (() => {
    const centros = [[2050, 3.8, 260], [8100, 1.0, 520], [8400, 3.4, 520], [8000, 5.4, 520]];
    const lista = [], r = rnd(555);
    centros.forEach(([R, a, esp]) => {
      const cx = Math.cos(a) * R, cz = Math.sin(a) * R * .55;
      for (let i = 0; i < 60; i++) {
        const k = 18 + Math.pow(r(), 2.2) * 150;
        lista.push({ c: new THREE.Vector3(cx + (r() - .5) * esp * 2, (r() - .5) * esp * .7, cz + (r() - .5) * esp * 2), k, eixo: new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(), w: (r() - .5) * .5, a: r() * 6, vivo: true, volta: 0, cor: corRocha(r, new THREE.Color()) });
      }
    });
    const inst = new THREE.InstancedMesh(geoRocha(4.2, guarda), matRocha, lista.length);
    lista.forEach((x, i) => inst.setColorAt(i, x.cor));
    cena.add(inst);
    return { inst, lista };
  })();
  // buracos negros no cenario (longe, fora do limite do voo)
  const buracos = [[-15500, 3200, -11000, 900], [17000, -4200, 7500, 600]].map(([x, y, z, r]) => {
    const b = buracoNegro(r, guarda); b.position.set(x, y, z); b.lookAt(0, 0, 0); b.rotateX(1.1); cena.add(b); return b;
  });

  // poeira perto da camera: e ela que mostra velocidade (o ceu esta longe
  // demais). Cada grao e um segmento: parado e um ponto; em dobra (Shift)
  // estica ao longo da velocidade e vira os riscos da "velocidade da luz".
  const NP = 700, BOX = 260;
  const base = new Float32Array(NP * 3); { const r = rnd(5); for (let i = 0; i < NP * 3; i++) base[i] = (r() - .5) * BOX; }
  const seg = new Float32Array(NP * 6), corSeg = new Float32Array(NP * 6);
  const gp = guarda(new THREE.BufferGeometry());
  gp.setAttribute('position', new THREE.BufferAttribute(seg, 3)); gp.setAttribute('color', new THREE.BufferAttribute(corSeg, 3));
  const poeira = new THREE.LineSegments(gp, guarda(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  poeira.frustumCulled = false; cena.add(poeira);
  const _dir = new THREE.Vector3(), _v = new THREE.Vector3();

  // camada de gas da atmosfera (so existe depois da primeira entrada)
  let gas = null, gasK = 0, gasVel = 0, fiapos = null;
  const corGas = new THREE.Color(), FI = 80, fiapoLocal = new Float32Array(FI * 3);
  const texFiapo = guarda(texRadial([[0, 'rgba(255,255,255,.9)'], [.45, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]));
  function criarGas(p) {
    corGas.set(`hsl(${p.cor},60%,62%)`);
    gas = new THREE.Mesh(guarda(new THREE.SphereGeometry(75, 24, 16)), guarda(new THREE.MeshBasicMaterial({ color: corGas, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false })));
    gas.renderOrder = 10; gas.frustumCulled = false; cena.add(gas);
    fiapos = [];
    const r = rnd(13);
    for (let i = 0; i < FI; i++) {
      const sp = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFiapo, color: corGas.clone().lerp(new THREE.Color(1, 1, 1), .35), transparent: true, opacity: 0, depthWrite: false, fog: false })));
      sp.renderOrder = 11; sp.frustumCulled = false; cena.add(sp); fiapos.push(sp);
      novoFiapo(i, r, -40 - r() * 230);
    }
  }
  function novoFiapo(i, r = Math.random, z = -230 - Math.random() * 60) {
    const a = r() * Math.PI * 2, d = 5 + Math.pow(r(), .7) * 70;
    fiapoLocal[i * 3] = Math.cos(a) * d; fiapoLocal[i * 3 + 1] = Math.sin(a) * d; fiapoLocal[i * 3 + 2] = z;
    if (fiapos) fiapos[i].scale.set(14 + r() * 40, 8 + r() * 22, 1);
  }
  function atualizarGas(dt, camera) {
    if (!gas) return;
    gas.visible = gasK > .002; gas.position.copy(camera.position); gas.material.opacity = gasK * .86;
    for (let i = 0; i < FI; i++) {
      const sp = fiapos[i]; sp.visible = gas.visible; if (!sp.visible) continue;
      fiapoLocal[i * 3 + 2] += gasVel * dt;
      if (fiapoLocal[i * 3 + 2] > 8) novoFiapo(i);
      const z = fiapoLocal[i * 3 + 2];
      sp.position.set(fiapoLocal[i * 3], fiapoLocal[i * 3 + 1], z).applyQuaternion(camera.quaternion).add(camera.position);
      sp.material.opacity = gasK * .55 * Math.min(1, (z + 290) / 80) * Math.min(1, (8 - z) / 20);
    }
  }

  function porNoCeu(obj, orig, olho, verdadeiro, S, m) {
    // escala em volta do olho: mesma direcao e mesmo tamanho na tela. Cresce
    // junto com o planeta (S), para quem esta atras dele continuar atras, mas
    // no maximo ate DIST_CEU (dentro do alcance da camera)
    _v.subVectors(orig, verdadeiro); const dist = _v.length();
    const kk = Math.max(1, Math.min(S, DIST_CEU / dist));
    obj.position.copy(olho).addScaledVector(_v, kk); obj.scale.setScalar(kk * m);
  }

  return {
    planetas, cena, rochas, buracos,
    mapaInfo: { cinturao: { raio: 9.4 * ESC, largura: 700 }, campos: [[2050, 3.8, 260], [8100, 1.0, 520], [8400, 3.4, 520], [8000, 5.4, 520]].map(([R, a, e]) => ({ x: Math.cos(a) * R, z: Math.sin(a) * R * .55, r: e * 1.2 })) },
    /** esfera (c, r) bate em alguma rocha viva? devolve a rocha */
    rochaEm(c, r) { for (const x of rochas.lista) if (x.vivo && x.c.distanceToSquared(c) < (x.k + r) * (x.k + r)) return x; return null; },
    quebrarRocha(x) { x.vivo = false; x.volta = 25; },
    sol: { pos: sol.position, raio: RAIO_SOL },
    /** comeca a entrar (ou acabou de sair) de p: ele para de girar e ganha neblina */
    focar(p) {
      focado = p;
      p.grupo.traverse((o) => { if (o.material && !o.material.isShaderMaterial) { o.material.fog = true; o.material.needsUpdate = true; } });
      if (p.atmosfera) cena.fog = new THREE.Fog(coresPlaneta(p).ceu, 1e6, 2e6);
      if (!domo) { domo = domoCeu(p.cor, p.atmosfera, guarda); domo.material.uniforms.forca.value = 0; domo.renderOrder = -1; cena.add(domo); }
      const l = luzesSuperficie(p); hemi.color.copy(l.cima); hemi.groundColor.copy(l.baixo);
    },
    /**
     * Entrada/saida de um planeta: em vez de a nave (enorme perto de um planeta
     * de 60 m) encostar nele, o planeta CRESCE em volta do ponto embaixo da
     * nave ate virar o globo da superficie (raio R_GLOBO). O resto do sistema
     * e "escalado em volta do olho" (porNoCeu): continua na mesma direcao e do
     * mesmo tamanho na tela, so que a DIST_CEU, entao nada some nem e engolido.
     * o: { R, centro, olho, verdadeiro (onde a nave estaria no sistema de
     *      verdade), k (0..1 o quanto ja foi para o ceu), m (aumento dos
     *      astros no ceu), kCeu, kLuz, kFora (orbitas/cinturao somem),
     *      qS2W (giro superficie -> mundo), hNeb (altitude p/ neblina) }
     */
    aproximar(p, o) {
      const s = o.R / p.raio;
      p.grupo.scale.setScalar(s); p.grupo.position.copy(o.centro);
      p.atm.uniforms.forca.value = o.halo;
      if (p.nuvens) { p.nuvens.material.opacity = .7 * o.nuv; p.nuvens.visible = o.nuv > .002; }
      // a camada de gas: uma esfera em volta da camera (a nave fica dentro e
      // aparece) e fiapos passando rapido (ver atualizar)
      gasK = p.atmosfera ? o.gas : 0; gasVel = o.velGas || 0;
      if (gasK > 0) { if (!gas) criarGas(p); gas.material.color.copy(corGas); }
      for (const x of planetas) if (x !== p) porNoCeu(x.grupo, x.orig, o.olho, o.verdadeiro, s, o.m);
      porNoCeu(sol, _dir.set(0, 0, 0), o.olho, o.verdadeiro, s, o.m); luzSol.position.copy(sol.position); luzSolSup.position.copy(sol.position);
      orbitas.forEach((l) => { l.material.opacity = .18 * (1 - o.kFora); l.visible = o.kFora < 1; });
      cinturao.material.opacity = 1 - o.kFora; cinturao.visible = rochas.inst.visible = o.kFora < 1;
      // as luzes viram as da superficie
      luzEntrada.intensity = 2.2 * o.kLuz; luzEntrada.target.position.copy(o.centro);
      luzEntrada.position.copy(LUZ_SUP).applyQuaternion(o.qS2W).multiplyScalar(o.R * 3).add(o.centro);
      hemi.intensity = .9 * o.kLuz; hemi.position.set(0, 1, 0).applyQuaternion(o.qS2W);
      luzesSite.forEach(([l, i]) => { l.intensity = i * (1 - o.kLuz); });
      luzSol.intensity = 235 * Math.pow(ESC, 1.34) * (1 - o.kLuz); luzSolSup.intensity = 3 * o.kLuz;
      // o planeta vai ganhando a cor do globo da superficie
      // com atmosfera: o ceu da cor do planeta cobre as estrelas e entra a
      // mesma neblina da superficie naquela altitude
      domo.quaternion.copy(o.qS2W); domo.material.uniforms.forca.value = p.atmosfera ? o.kCeu : 0;
      if (p.atmosfera) {
        const lg = (a, b) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * o.kCeu);
        cena.fog.near = lg(4e5, 150 + o.hNeb * 1.4); cena.fog.far = lg(8e5, 700 + o.hNeb * 5.5);
        matsCeu.forEach(([m, op]) => { m.opacity = op * (1 - o.kCeu); });
      }
    },
    /** fim da saida: tudo de volta ao lugar de verdade */
    restaurar() {
      const p = focado; if (!p) return;
      p.grupo.scale.setScalar(1); p.grupo.position.copy(p.orig); p.atm.uniforms.forca.value = 0; gasK = 0;
      if (p.nuvens) { p.nuvens.material.opacity = 0; p.nuvens.visible = false; }
      for (const x of planetas) { x.grupo.position.copy(x.orig); x.grupo.scale.setScalar(1); }
      sol.position.set(0, 0, 0); sol.scale.setScalar(1); luzSol.position.set(0, 0, 0); luzSolSup.position.set(0, 0, 0);
      luzSol.intensity = 235 * Math.pow(ESC, 1.34); luzSolSup.intensity = 0; luzesSite.forEach(([l, i]) => { l.intensity = i; });
      orbitas.forEach((l) => { l.material.opacity = .18; l.visible = true; });
      cinturao.material.opacity = 1; cinturao.visible = rochas.inst.visible = true;
      luzEntrada.intensity = 0; hemi.intensity = 0;
      if (domo) domo.material.uniforms.forca.value = 0;
      matsCeu.forEach(([m, op]) => { m.opacity = op; });
      cena.fog = null; focado = null;
    },
    /** extra: { vel (Vector3 da nave), dobra 0..1 } */
    atualizar(dt, t, camera, extra = {}) {
      ceu.position.copy(camera.position);
      if (domo) domo.position.copy(camera.position);
      sol.uniforms.uTime.value = t;
      atualizarGas(dt, camera);
      planetas.forEach((p, i) => { if (!focado) { p.corpo.rotation.y += dt * (.05 + i * .006); if (p.nuvens) p.nuvens.rotation.y += dt * (.065 + i * .006); } });
      cinturao.rotation.y += dt * .002;
      ceu.userData.tempo.value = t; buracos.forEach((b) => { b.userData.u.tempo.value = t; });
      {
        const m = _m4, q = _q4, s = _s4;
        rochas.lista.forEach((x, i) => {
          if (x.volta > 0) { x.volta -= dt; if (x.volta <= 0) x.vivo = true; }
          x.a += x.w * dt;
          rochas.inst.setMatrixAt(i, m.compose(x.c, q.setFromAxisAngle(x.eixo, x.a), s.setScalar(x.vivo ? x.k : 0)));
        });
        rochas.inst.instanceMatrix.needsUpdate = true;
      }
      const c = camera.position, dobra = extra.dobra || 0;
      const v = extra.vel ? extra.vel.length() : 0;
      if (extra.vel && v > .01) _dir.copy(extra.vel).divideScalar(v); else _dir.set(0, 0, 0);
      const comp = .25 + v * .012 + dobra * 34;           // comprimento do risco
      for (let i = 0; i < NP; i++) {
        let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        // wrap em volta da camera
        if (x - c.x > BOX / 2) x -= BOX; else if (x - c.x < -BOX / 2) x += BOX;
        if (y - c.y > BOX / 2) y -= BOX; else if (y - c.y < -BOX / 2) y += BOX;
        if (z - c.z > BOX / 2) z -= BOX; else if (z - c.z < -BOX / 2) z += BOX;
        base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
        const o = i * 6;
        seg[o] = x; seg[o + 1] = y; seg[o + 2] = z;
        seg[o + 3] = x - _dir.x * comp; seg[o + 4] = y - _dir.y * comp; seg[o + 5] = z - _dir.z * comp;
        // ponta clara, cauda some; em dobra fica azulada
        const k = .55 + dobra * .45;
        corSeg[o] = .8 * k; corSeg[o + 1] = (.74 + dobra * .2) * k; corSeg[o + 2] = k;
        corSeg[o + 3] = 0; corSeg[o + 4] = 0; corSeg[o + 5] = dobra * .25;
      }
      gp.attributes.position.needsUpdate = true; gp.attributes.color.needsUpdate = true;
    },
    destruir() {
      lixo.forEach((o) => o.dispose && o.dispose());
      cena.clear();
    }
  };
}
const _cor = new THREE.Color(), _vs = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _s4 = new THREE.Vector3();

/* ============================================================ superficie == */
// a plataforma central (onde a nave chega) fica numa praca plana de raio 40;
// cada tecnologia tem o seu LOCAL espalhado pelo mapa (raio plano 60): uma
// praca com o predio, uma plataforma de pouso e um feixe de luz que se ve de
// longe. Entre eles, morros e montanhas.
export const RAIO_PRACA = 40, RAIO_LOCAL = 60, LIMITE_SUP = 2000;
// o chao curva junto com um globo gigante por baixo: descendo do alto se ve o
// horizonte curvo do planeta, que vai achatando ate virar chao
export const R_GLOBO = 6000;
const suaveC = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
// os locais das tecnologias: espalhados em volta da plataforma, alternando
// perto e longe, sem encostar uns nos outros
function locaisDe(key, n) {
  const r = rnd(key.length * 7919 + 17), out = [];
  for (let i = 0; i < n; i++) {
    let x, z, ok = false, tent = 0;
    while (!ok && tent++ < 200) {
      const ang = (i / n) * Math.PI * 2 + (r() - .5) * .5, R = (i % 2 ? 900 : 480) + r() * 420;
      x = Math.cos(ang) * R; z = Math.sin(ang) * R;
      ok = out.every((o) => Math.hypot(o.x - x, o.z - z) > 330);
    }
    out.push({ x, z });
  }
  return out;
}
function criarAltura(locais) {
  const zonas = [{ x: 0, z: 0, r: RAIO_PRACA + 25 }, ...locais.map((l) => ({ x: l.x, z: l.z, r: RAIO_LOCAL }))];
  return function alturaChao(x, z) {
    // morros + montanhas "de crista" que crescem longe das pracas
    const h = Math.sin(x * .021) * Math.cos(z * .017) * 11 + Math.sin(x * .053 + z * .031) * 4 + Math.cos(z * .071 - x * .013) * 2.5;
    const crista = 1 - Math.abs(Math.sin(x * .0042 + Math.cos(z * .0031) * 1.7) * Math.cos(z * .0047 - x * .0012));
    let longe = 1;
    for (const zn of zonas) { const d = Math.hypot(x - zn.x, z - zn.z); longe = Math.min(longe, suaveC((d - zn.r) / 70)); }
    const montanha = Math.pow(crista, 3) * 120 * suaveC((Math.hypot(x, z) - 250) / 400);
    return (h + montanha * longe) * longe - (x * x + z * z) / (2 * R_GLOBO);
  };
}

/**
 * opc (vem da entrada, para a superficie comecar IGUAL ao fim dela):
 *  qW2S: giro mundo do espaco -> superficie; rotCorpo/rotNuvens: giro do
 *  planeta quando a nave entrou; astros: [{ d, i, orig }] os outros planetas
 *  (posicao no espaco) para o ceu.
 */
export function criarSuperficie(cena, planeta, opc = {}) {
  const lixo = []; const guarda = (o) => { lixo.push(o); return o; };
  const cor = planeta.cor, ar = planeta.atmosfera !== false;
  const qW2S = opc.qW2S || new THREE.Quaternion();
  const area = STACK[planeta.key] || { techs: [] };
  const locais = locaisDe(planeta.key, area.techs.length);
  const alturaChao = criarAltura(locais);
  const livre = (x, z, folga = 0) => Math.hypot(x, z) > RAIO_PRACA + 15 + folga && locais.every((l) => Math.hypot(x - l.x, z - l.z) > RAIO_LOCAL + 10 + folga);
  const toque = typeof matchMedia !== 'undefined' && matchMedia('(pointer:coarse)').matches;
  const { ceu: ceuCor, chao: corChao } = coresPlaneta(planeta);
  cena.background = ceuCor;
  // neblina so com atmosfera; a distancia acompanha a altitude (ver atualizar)
  cena.fog = ar ? new THREE.Fog(ceuCor, 150, 700) : null;

  // ceu: degrade com atmosfera; sem ela (tipo lua), o mesmo ceu estrelado do
  // espaco, girado
  const ceu = domoCeu(cor, ar, guarda); ceu.renderOrder = -1; cena.add(ceu);
  let estrelas = null;
  if (!ar) { estrelas = ceuEstrelado(guarda); estrelas.quaternion.copy(qW2S); cena.add(estrelas); }

  // os outros planetas e o sol no ceu, onde estao de verdade no sistema
  // (posicionados a cada quadro em atualizar)
  const ceuAstros = (opc.astros || []).map((a) => {
    const m = montarPlaneta(a.d, a.i, a.d.tam * ESC_TAM, guarda);
    m.corpo.rotation.y = a.rotCorpo || 0; if (m.nuvens) m.nuvens.rotation.y = a.rotNuvens || 0;
    m.grupo.quaternion.copy(qW2S); cena.add(m.grupo);
    return { obj: m.grupo, orig: a.orig };
  });
  const sol = montarSol(guarda); cena.add(sol);
  const luzSol = new THREE.PointLight(0xfff0dd, 3, 0, 0); cena.add(luzSol);
  ceuAstros.push({ obj: sol, orig: new THREE.Vector3() });

  // globo: o proprio planeta (mesma malha, textura e nuvens do espaco) com o
  // raio R_GLOBO, abaixo do terreno (a beirada do terreno encosta nele)
  const iPl = PLANETAS.findIndex((d) => d.key === planeta.key);
  const raioPl = planeta.tam * ESC_TAM;
  const gl = montarPlaneta(planeta, iPl, raioPl, guarda);
  gl.grupo.scale.setScalar(R_GLOBO / raioPl); gl.grupo.quaternion.copy(qW2S);
  // 22 m abaixo: os vales do terreno descem ate ~ -15 e o globo aparecia neles
  gl.grupo.position.y = -R_GLOBO - 22; cena.add(gl.grupo);
  gl.corpo.rotation.y = opc.rotCorpo || 0; if (gl.nuvens) gl.nuvens.rotation.y = opc.rotNuvens || 0;
  gl.atm.visible = false;
  gl.grupo.traverse((o) => { if (o.material && !o.material.isShaderMaterial) o.material.fog = true; });
  if (gl.nuvens) { gl.nuvens.material.side = THREE.DoubleSide; gl.nuvens.material.opacity = .7; gl.nuvens.visible = true; }   // vistas de baixo tambem

  // terreno low-poly (curva junto com o globo: ver alturaChao)
  const TAM = 4600, SEG = toque ? 170 : 260;
  const geo = guarda(new THREE.PlaneGeometry(TAM, TAM, SEG, SEG)); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alturaChao(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  // a cor de cada vertice vem da textura do globo logo abaixo: visto do alto, o
  // terreno some no planeta (mesmas manchas), sem um "quadrado" de outra cor
  {
    const cv = canvasPlaneta(cor, semente(iPl)), W = cv.width, H = cv.height;
    const px = cv.getContext('2d').getImageData(0, 0, W, H).data;
    gl.grupo.updateMatrixWorld(true);
    const inv = gl.corpo.getWorldQuaternion(new THREE.Quaternion()).invert();
    const cores = new Float32Array(p.count * 3), v = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i) + R_GLOBO + 22, p.getZ(i)).normalize().applyQuaternion(inv);
      let phi = Math.atan2(v.z, -v.x); if (phi < 0) phi += Math.PI * 2;
      const col = Math.min(W - 1, Math.floor(phi / (Math.PI * 2) * W)), lin = Math.min(H - 1, Math.floor(Math.acos(Math.max(-1, Math.min(1, v.y))) / Math.PI * H));
      const o = (lin * W + col) * 4;
      c.setRGB(px[o] / 255, px[o + 1] / 255, px[o + 2] / 255, THREE.SRGBColorSpace);
      cores[i * 3] = c.r; cores[i * 3 + 1] = c.g; cores[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  }
  // mesmo tom e brilho do material do planeta (o do site)
  const chao = new THREE.Mesh(geo, guarda(new THREE.MeshStandardMaterial({ color: gl.corpo.material.color, emissive: gl.corpo.material.emissive, emissiveIntensity: .42, vertexColors: true, roughness: .85, flatShading: true })));
  cena.add(chao);

  // cristais espalhados (instanciados)
  {
    const n = 420, cg = guarda(new THREE.OctahedronGeometry(1, 0)); cg.scale(.6, 1.8, .6);
    const inst = new THREE.InstancedMesh(cg, guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${(cor + 20) % 360},80%,62%)`), emissive: new THREE.Color(`hsl(${cor},80%,30%)`), roughness: .3, flatShading: true })), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(); const r = rnd(planeta.key.length * 101);
    for (let i = 0; i < n; i++) {
      let x, z; do { x = (r() - .5) * 3800; z = (r() - .5) * 3800; } while (!livre(x, z));
      const k = 1 + r() * 3.5;
      v.set(x, alturaChao(x, z) + k * .8, z); q.setFromAxisAngle(new THREE.Vector3(r() - .5, 1, r() - .5).normalize(), r() * .6); s.setScalar(k);
      inst.setMatrixAt(i, m.compose(v, q, s));
    }
    cena.add(inst);
  }

  // decoracao com o tema da area (paineis, canos, discos de dados, barras...)
  const decor = decorar(planeta.key, cor, alturaChao, livre, guarda);
  if (decor.mesh) cena.add(decor.mesh);

  // plataforma de pouso
  const pad = new THREE.Group(); cena.add(pad);
  pad.add(new THREE.Mesh(guarda(new THREE.CylinderGeometry(11, 12, .6, 48)), guarda(new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: .6, metalness: .4 }))));
  const anel = new THREE.Mesh(guarda(new THREE.RingGeometry(8.6, 9.2, 64)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,70%)`) })));
  anel.rotation.x = -Math.PI / 2; anel.position.y = .32; pad.add(anel);
  const hMat = guarda(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  [[0, 0, 1.2, 6], [-2.2, 0, 1, 6], [2.2, 0, 1, 6]].forEach(([x, , w, h], k) => {
    const b = new THREE.Mesh(guarda(new THREE.PlaneGeometry(k ? w : 4.4, k ? h : 1)), hMat);
    b.rotation.x = -Math.PI / 2; b.position.set(x, .33, 0); pad.add(b);
  });
  const luzes = [];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const l = new THREE.Mesh(guarda(new THREE.SphereGeometry(.22, 8, 6)), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    l.position.set(Math.cos(a) * 10.4, .5, Math.sin(a) * 10.4); pad.add(l); luzes.push(l.material); lixo.push(l.material);
  }
  // farol: um feixe vertical para achar a plataforma do alto
  const farol = new THREE.Mesh(guarda(new THREE.CylinderGeometry(.6, 3, 160, 16, 1, true)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,70%)`), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  farol.position.y = 80; cena.add(farol);

  { const luz = new THREE.DirectionalLight(0xfff1e0, 2.2); luz.position.copy(LUZ_SUP).multiplyScalar(400); cena.add(luz); }
  { const l = luzesSuperficie(planeta); cena.add(new THREE.HemisphereLight(l.cima, l.baixo, .9)); }

  // poeira levantada no pouso
  const NP = 90, pp = new Float32Array(NP * 3), vp = new Float32Array(NP * 3), vidaP = new Float32Array(NP);
  const gp = guarda(new THREE.BufferGeometry()); gp.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const poeira = new THREE.Points(gp, guarda(new THREE.PointsMaterial({ color: new THREE.Color(`hsl(${cor},30%,70%)`), size: .7, transparent: true, opacity: .6, depthWrite: false })));
  poeira.frustumCulled = false; cena.add(poeira);

  /* ---- predios da stack: um por tecnologia, cada um no seu local ---- */
  const corNeon = new THREE.Color(`hsl(${cor},95%,68%)`);
  const matCorpo = guarda(new THREE.MeshStandardMaterial({ color: 0x16131f, roughness: .55, metalness: .5 }));
  const matNeon = guarda(new THREE.MeshBasicMaterial({ color: corNeon }));
  const matPorta = guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .85 }));
  // materiais dos corpos dos predios (predios.js)
  const mats = {
    corpo: matCorpo, neon: matNeon,
    vidro: guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},60%,40%)`), transparent: true, opacity: .45, roughness: .1, metalness: .6, emissive: new THREE.Color(`hsl(${cor},80%,25%)`), emissiveIntensity: .5 })),
    grade: guarda(new THREE.MeshBasicMaterial({ color: corNeon, wireframe: true, transparent: true, opacity: .35 })),
    nucleo: guarda(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: corNeon, emissiveIntensity: 1.6, flatShading: true })),
    luz: guarda(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    linha: guarda(new THREE.LineBasicMaterial({ color: corNeon })),
    linha2: guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .8, depthWrite: false })),
    prato: guarda(new THREE.MeshStandardMaterial({ color: 0xd8d2ea, roughness: .4, metalness: .6, side: THREE.DoubleSide })),
    ledInst: guarda(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  };
  const animados = [];
  const texFeixe = guarda(texRadial([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
  const matPracaL = guarda(new THREE.MeshStandardMaterial({ color: 0x1b1726, roughness: .7, metalness: .3 }));
  const matPadL = guarda(new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: .6, metalness: .4 }));
  const predios = area.techs.map((tec, i) => {
    const { x, z } = locais[i];
    const g = new THREE.Group(); g.position.set(x, alturaChao(x, z), z);
    g.rotation.y = Math.atan2(-x, -z);           // porta (+z local) virada para a plataforma central
    const alt = tec.nivel === 'Primary' || tec.nivel === 'Core' ? 13 : tec.nivel === 'Professional' ? 11 : 9;
    const L = 9, P = 9;
    // corpo com cara propria: um tipo por tecnologia da area (nao repete na praca)
    const tipo = TIPOS[(i + planeta.key.length) % TIPOS.length];
    const cp = corpoPredio(tipo, alt, corNeon, mats, guarda, i * 31 + cor);
    g.add(cp.grupo); animados.push(cp.animar);
    g.add(portaria(mats, guarda, P));
    // porta
    const porta = new THREE.Mesh(guarda(new THREE.PlaneGeometry(3, 4.6)), matPorta); porta.position.set(0, 2.3, P / 2 + .27); g.add(porta);
    const batente = new THREE.Mesh(guarda(new THREE.BoxGeometry(3.6, .25, .3)), matNeon); batente.position.set(0, 4.75, P / 2 + .35); g.add(batente);
    // letreiro (os dois lados): nome e nivel
    const tx = document.createElement('canvas'); tx.width = 512; tx.height = 160; const c = tx.getContext('2d');
    const desenharLetreiro = (visto) => {
      c.clearRect(0, 0, 512, 160);
      c.fillStyle = 'rgba(10,8,18,.88)'; c.fillRect(0, 0, 512, 160);
      c.strokeStyle = visto ? '#2bff8f' : corNeon.getStyle(); c.lineWidth = 6; c.strokeRect(3, 3, 506, 154);
      c.fillStyle = '#fff'; c.font = '800 58px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(tec.nome.length > 13 ? tec.nome.slice(0, 12) + '…' : tec.nome, 256, 66);
      c.fillStyle = visto ? '#2bff8f' : corNeon.getStyle(); c.font = '700 26px ui-monospace, Menlo, monospace';
      c.fillText((visto ? '✓ VISITADO · ' : '') + tec.nivel.toUpperCase(), 256, 124);
    };
    desenharLetreiro(false);
    const texL = guarda(new THREE.CanvasTexture(tx)); texL.colorSpace = THREE.SRGBColorSpace;
    const placa = new THREE.Mesh(guarda(new THREE.PlaneGeometry(8, 2.5)), guarda(new THREE.MeshBasicMaterial({ map: texL, transparent: true, side: THREE.DoubleSide })));
    placa.position.set(0, cp.topo + 2, 0); g.add(placa);
    // emblema holografico com a sigla, girando em cima
    const emb = emblema(tec.nome, corNeon.getStyle(), guarda); emb.position.y = cp.topo + 6.2; g.add(emb);
    animados.push((t) => { emb.position.y = cp.topo + 6.2 + Math.sin(t * 1.5 + i) * .35; emb.material.rotation = Math.sin(t * .7 + i) * .12; });
    // circulo de luz na frente da porta (onde da para entrar)
    const marca = new THREE.Mesh(guarda(new THREE.RingGeometry(1.4, 1.75, 40)), matNeon); marca.rotation.x = -Math.PI / 2; marca.position.set(0, .06, P / 2 + 3.2); g.add(marca);
    // o local: praca com anel de neon, plataforma de pouso pequena na frente e
    // trilha de luzes ate a porta
    const praca = new THREE.Mesh(guarda(new THREE.CylinderGeometry(26, 27, .5, 48)), matPracaL); praca.position.y = -.2; g.add(praca);
    const anelL = new THREE.Mesh(guarda(new THREE.RingGeometry(25.4, 26.2, 64)), matNeon); anelL.rotation.x = -Math.PI / 2; anelL.position.y = .07; g.add(anelL);
    const padL = new THREE.Mesh(guarda(new THREE.CylinderGeometry(7, 7.4, .5, 32)), matPadL); padL.position.set(0, .05, 19); g.add(padL);
    const anelP = new THREE.Mesh(guarda(new THREE.RingGeometry(5.4, 5.9, 40)), matNeon); anelP.rotation.x = -Math.PI / 2; anelP.position.set(0, .32, 19); g.add(anelP);
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(guarda(new THREE.BoxGeometry(.5, .15, .5)), matNeon); l.position.set(-1.6, .1, P / 2 + 4.5 + k * 2); g.add(l); const l2 = l.clone(); l2.position.x = 1.6; g.add(l2); }
    // feixe de luz alto (de longe da para achar o local) e o nome la em cima
    const feixe = new THREE.Mesh(guarda(new THREE.CylinderGeometry(1.2, 5, 420, 20, 1, true)), guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    feixe.position.y = 210; g.add(feixe);
    const brilhoTopo = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFeixe, color: corNeon, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    brilhoTopo.position.y = 150; brilhoTopo.scale.setScalar(26); g.add(brilhoTopo);
    const tn = document.createElement('canvas'); tn.width = 512; tn.height = 128; const cn = tn.getContext('2d');
    const desenharNome = (visto) => {
      cn.clearRect(0, 0, 512, 128); cn.font = '900 64px ui-monospace, Menlo, monospace'; cn.textAlign = 'center'; cn.textBaseline = 'middle';
      cn.shadowColor = visto ? '#2bff8f' : corNeon.getStyle(); cn.shadowBlur = 18; cn.fillStyle = '#fff';
      cn.fillText((visto ? '✓ ' : '') + (tec.nome.length > 12 ? tec.nome.slice(0, 11) + '…' : tec.nome), 256, 64);
    };
    desenharNome(false);
    const texN = guarda(new THREE.CanvasTexture(tn)); texN.colorSpace = THREE.SRGBColorSpace;
    const nomeAlto = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texN, transparent: true, depthWrite: false, fog: false })));
    nomeAlto.position.y = 172; nomeAlto.scale.set(64, 16, 1); g.add(nomeAlto);
    animados.push((t) => { feixe.material.opacity = .13 + Math.sin(t * 1.7 + i) * .04; brilhoTopo.scale.setScalar(24 + Math.sin(t * 2.2 + i) * 4); });
    cena.add(g);
    const eixoY = new THREE.Vector3(0, 1, 0);
    const portaMundo = new THREE.Vector3(0, 0, P / 2 + 3.2).applyAxisAngle(eixoY, g.rotation.y).add(g.position);
    const padMundo = new THREE.Vector3(0, 0, 19).applyAxisAngle(eixoY, g.rotation.y).add(g.position);
    return {
      tec, grupo: g, pos: g.position, porta: portaMundo, pad: padMundo, raio: 6.6, visto: false, tipo,
      marcarVisto() {
        this.visto = true; desenharLetreiro(true); texL.needsUpdate = true; desenharNome(true); texN.needsUpdate = true;
        feixe.material.color.set(0x2bff8f); brilhoTopo.material.color.set(0x2bff8f);
      }
    };
  });

  /* ---- camada de nuvens (so com atmosfera): a nave atravessa descendo (y 450-750) ---- */
  const texNuvem = guarda(texRadial([[0, 'rgba(255,255,255,.95)'], [.4, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]));
  const nuvens = new THREE.Group(); cena.add(nuvens);
  if (ar) {
    const r = rnd(41); const corN = new THREE.Color(`hsl(${cor},35%,82%)`);
    for (let i = 0; i < 200; i++) {
      // vistas do chao viravam manchas brancas: mais transparentes e com neblina
      const sp = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texNuvem, color: corN, transparent: true, opacity: .28 + r() * .2, depthWrite: false })));
      const a = r() * Math.PI * 2, R = Math.sqrt(r()) * 2300;
      sp.position.set(Math.cos(a) * R, 450 + r() * 300, -300 + Math.sin(a) * R);
      sp.scale.setScalar(180 + r() * 260); nuvens.add(sp);
    }
  }

  return {
    alturaChao, predios, nuvens, atmosfera: ar, corCeu: ceuCor, corChao, ceuAstros, limite: LIMITE_SUP, corNeon: corNeon.getStyle(), cena,
    levantarPoeira(x, z, forca) {
      for (let i = 0; i < NP; i++) {
        if (vidaP[i] > 0 && Math.random() > forca) continue;
        const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 10;
        pp[i * 3] = x; pp[i * 3 + 1] = alturaChao(x, z) + .3; pp[i * 3 + 2] = z;
        vp[i * 3] = Math.cos(a) * v; vp[i * 3 + 1] = 1 + Math.random() * 3; vp[i * 3 + 2] = Math.sin(a) * v; vidaP[i] = 1;
      }
    },
    /** extra: { verdadeiro (onde a camera estaria no sistema), W2S (Matrix4), m (aumento) } */
    atualizar(dt, t, camera, extra = {}) {
      // ceu acompanha a camera; com atmosfera, a neblina abre com a altitude
      // (do alto se ve o globo inteiro; no chao fecha como antes)
      if (camera) {
        ceu.position.copy(camera.position);
        if (estrelas) { estrelas.position.copy(camera.position); estrelas.userData.tempo.value = t; }
        if (extra.verdadeiro) for (const a of ceuAstros) {
          _vs.subVectors(a.orig, extra.verdadeiro); const dist = _vs.length();
          _vs.applyMatrix4(extra.W2S).multiplyScalar(DIST_CEU / dist);
          a.obj.position.copy(camera.position).add(_vs); a.obj.scale.setScalar(DIST_CEU / dist * (extra.m || 1));
        }
        luzSol.position.copy(sol.position); sol.uniforms.uTime.value = t;
        if (cena.fog) { const h = Math.max(0, camera.position.y); cena.fog.near = 150 + h * 1.4; cena.fog.far = 700 + h * 5.5; }
      }
      luzes.forEach((m, k) => m.color.setHex(((k + Math.floor(t * 8)) % 12) < 3 ? 0xffffff : 0xffb13b));
      animados.forEach((f) => f(t)); decor.animar(t);
      farol.material.opacity = .08 + Math.sin(t * 2) * .04;
      for (let i = 0; i < NP; i++) {
        if (vidaP[i] <= 0) { pp[i * 3 + 1] = -999; continue; }
        vidaP[i] -= dt * .9;
        pp[i * 3] += vp[i * 3] * dt; pp[i * 3 + 1] += vp[i * 3 + 1] * dt; pp[i * 3 + 2] += vp[i * 3 + 2] * dt;
        vp[i * 3] *= .96; vp[i * 3 + 2] *= .96;
      }
      gp.attributes.position.needsUpdate = true;
      poeira.material.opacity = .6;
    },
    destruir() { lixo.forEach((o) => o.dispose && o.dispose()); cena.clear(); }
  };
}
