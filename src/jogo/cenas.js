import * as THREE from 'three';
import { STACK } from './dados.js';

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
const ESC = 340, ESC_ORBITA = ESC, ESC_TAM = ESC;
export const LIMITE_ESPACO = 4000;
export const RAIO_SOL = 1.52 * ESC;

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
// estrelas e nebulosas (sempre as mesmas: a superficie dos tipo lua mostra o
// mesmo ceu, girado)
function ceuEstrelado(guarda, mats) {
  const ceu = new THREE.Group();
  const n = 3500, p = new Float32Array(n * 3), cor = new Float32Array(n * 3); const r = rnd(9);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 20000;
    p[i * 3] = s * Math.cos(a) * R; p[i * 3 + 1] = u * R; p[i * 3 + 2] = s * Math.sin(a) * R;
    const k = .55 + r() * .45, roxo = r() < .2;
    cor[i * 3] = k * (roxo ? .8 : 1); cor[i * 3 + 1] = k * (roxo ? .7 : .97); cor[i * 3 + 2] = k;
  }
  const g = guarda(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  const mEst = guarda(new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true, fog: false }));
  ceu.add(new THREE.Points(g, mEst)); mats?.push([mEst, 1]);
  const neb = guarda(texRadial([[0, 'rgba(140,90,255,.35)'], [1, 'rgba(140,90,255,0)']]));
  [[-1, .2, -.4, 0x7c4dff], [.6, -.1, .8, 0xff3d9a], [.2, .5, -1, 0x3d7bff]].forEach(([x, y, z, c]) => {
    const s = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: neb, color: c, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    mats?.push([s.material, .55]);
    s.position.set(x, y, z).normalize().multiplyScalar(19500); s.scale.setScalar(16000); ceu.add(s);
  });
  return ceu;
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

  // cinturao de asteroides entre Analytics e o resto
  const cinturao = (() => {
    const n = 2400, geo = guarda(new THREE.IcosahedronGeometry(1, 0));
    const mat = guarda(new THREE.MeshStandardMaterial({ color: 0x6e6385, roughness: 1, flatShading: true, transparent: true, fog: false }));
    const inst = new THREE.InstancedMesh(geo, mat, n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const r = rnd(77);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, R = 3700 + (r() - .5) * 360;
      p.set(Math.cos(a) * R, (r() - .5) * 160, Math.sin(a) * R * .55);
      q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); const k = 6 + r() * 30; s.set(k, k * (.6 + r() * .6), k);
      inst.setMatrixAt(i, m.compose(p, q, s));
    }
    cena.add(inst); return inst;
  })();

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
    planetas, cena,
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
      cinturao.material.opacity = 1 - o.kFora; cinturao.visible = o.kFora < 1;
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
      cinturao.material.opacity = 1; cinturao.visible = true;
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
const _cor = new THREE.Color(), _vs = new THREE.Vector3();

/* ============================================================ superficie == */
// altura do terreno: morros suaves; a praca (raio 70: plataforma + anel de
// predios da stack) e plana
export const RAIO_PRACA = 70, RAIO_PREDIOS = 46;
// o chao curva junto com um globo gigante por baixo: descendo do alto se ve o
// horizonte curvo do planeta, que vai achatando ate virar chao
export const R_GLOBO = 6000;
export function alturaChao(x, z) {
  const h = Math.sin(x * .021) * Math.cos(z * .017) * 9 + Math.sin(x * .053 + z * .031) * 3.5 + Math.cos(z * .071 - x * .013) * 2;
  const d = Math.hypot(x, z);
  const plano = Math.min(1, Math.max(0, (d - RAIO_PRACA) / 40));
  return h * plano * plano * (3 - 2 * plano) - (x * x + z * z) / (2 * R_GLOBO);
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
  const TAM = 3000, SEG = 220;
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
    const n = 320, cg = guarda(new THREE.OctahedronGeometry(1, 0)); cg.scale(.6, 1.8, .6);
    const inst = new THREE.InstancedMesh(cg, guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${(cor + 20) % 360},80%,62%)`), emissive: new THREE.Color(`hsl(${cor},80%,30%)`), roughness: .3, flatShading: true })), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(); const r = rnd(planeta.key.length * 101);
    for (let i = 0; i < n; i++) {
      let x, z; do { x = (r() - .5) * 1400; z = (r() - .5) * 1400; } while (Math.hypot(x, z) < RAIO_PRACA + 10);
      const k = 1 + r() * 3.5;
      v.set(x, alturaChao(x, z) + k * .8, z); q.setFromAxisAngle(new THREE.Vector3(r() - .5, 1, r() - .5).normalize(), r() * .6); s.setScalar(k);
      inst.setMatrixAt(i, m.compose(v, q, s));
    }
    cena.add(inst);
  }

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

  /* ---- predios da stack: um por tecnologia da area, em anel na praca ---- */
  const area = STACK[planeta.key] || { techs: [] };
  const corNeon = new THREE.Color(`hsl(${cor},95%,68%)`);
  const matCorpo = guarda(new THREE.MeshStandardMaterial({ color: 0x16131f, roughness: .55, metalness: .5 }));
  const matNeon = guarda(new THREE.MeshBasicMaterial({ color: corNeon }));
  const matPorta = guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .85 }));
  const predios = area.techs.map((tec, i) => {
    const n = area.techs.length;
    const ang = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.cos(ang) * RAIO_PREDIOS, z = Math.sin(ang) * RAIO_PREDIOS;
    const g = new THREE.Group(); g.position.set(x, alturaChao(x, z), z);
    g.rotation.y = Math.atan2(-x, -z);           // porta (+z local) virada para o centro
    const alt = tec.nivel === 'Primary' || tec.nivel === 'Core' ? 13 : tec.nivel === 'Professional' ? 11 : 9;
    const L = 9, P = 9;
    const corpo = new THREE.Mesh(guarda(new THREE.BoxGeometry(L, alt, P)), matCorpo); corpo.position.y = alt / 2; g.add(corpo);
    // arestas em neon
    [[-L / 2, P / 2], [L / 2, P / 2], [-L / 2, -P / 2], [L / 2, -P / 2]].forEach(([ax, az]) => {
      const e = new THREE.Mesh(guarda(new THREE.BoxGeometry(.18, alt, .18)), matNeon); e.position.set(ax, alt / 2, az); g.add(e);
    });
    const topo = new THREE.Mesh(guarda(new THREE.BoxGeometry(L + .2, .18, P + .2)), matNeon); topo.position.y = alt; g.add(topo);
    // porta
    const porta = new THREE.Mesh(guarda(new THREE.PlaneGeometry(3, 4.6)), matPorta); porta.position.set(0, 2.3, P / 2 + .02); g.add(porta);
    const batente = new THREE.Mesh(guarda(new THREE.BoxGeometry(3.6, .25, .3)), matNeon); batente.position.set(0, 4.75, P / 2 + .1); g.add(batente);
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
    placa.position.set(0, alt + 2.2, 0); g.add(placa);
    // circulo de luz na frente da porta (onde da para entrar)
    const marca = new THREE.Mesh(guarda(new THREE.RingGeometry(1.4, 1.75, 40)), matNeon); marca.rotation.x = -Math.PI / 2; marca.position.set(0, .06, P / 2 + 3.2); g.add(marca);
    cena.add(g);
    // caminho de luz ate a plataforma
    const caminho = new THREE.Mesh(guarda(new THREE.PlaneGeometry(.35, RAIO_PREDIOS - P / 2 - 13)), guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .35 })));
    caminho.rotation.x = -Math.PI / 2; caminho.rotation.z = -ang + Math.PI / 2;
    const meio = (13 + RAIO_PREDIOS - P / 2) / 2; caminho.position.set(Math.cos(ang) * meio, alturaChao(Math.cos(ang) * meio, Math.sin(ang) * meio) + .05, Math.sin(ang) * meio); cena.add(caminho);
    const portaMundo = new THREE.Vector3(0, 0, P / 2 + 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
    return { tec, grupo: g, pos: g.position, porta: portaMundo, raio: 6.6, visto: false, marcarVisto() { this.visto = true; desenharLetreiro(true); texL.needsUpdate = true; } };
  });

  /* ---- camada de nuvens (so com atmosfera): a nave atravessa descendo (y 450-750) ---- */
  const texNuvem = guarda(texRadial([[0, 'rgba(255,255,255,.95)'], [.4, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]));
  const nuvens = new THREE.Group(); cena.add(nuvens);
  if (ar) {
    const r = rnd(41); const corN = new THREE.Color(`hsl(${cor},35%,82%)`);
    for (let i = 0; i < 140; i++) {
      // vistas do chao viravam manchas brancas: mais transparentes e com neblina
      const sp = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texNuvem, color: corN, transparent: true, opacity: .28 + r() * .2, depthWrite: false })));
      const a = r() * Math.PI * 2, R = Math.sqrt(r()) * 1700;
      sp.position.set(Math.cos(a) * R, 450 + r() * 300, -500 + Math.sin(a) * R);
      sp.scale.setScalar(180 + r() * 260); nuvens.add(sp);
    }
  }

  return {
    alturaChao, predios, nuvens, atmosfera: ar, corCeu: ceuCor, corChao, ceuAstros,
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
        if (estrelas) estrelas.position.copy(camera.position);
        if (extra.verdadeiro) for (const a of ceuAstros) {
          _vs.subVectors(a.orig, extra.verdadeiro); const dist = _vs.length();
          _vs.applyMatrix4(extra.W2S).multiplyScalar(DIST_CEU / dist);
          a.obj.position.copy(camera.position).add(_vs); a.obj.scale.setScalar(DIST_CEU / dist * (extra.m || 1));
        }
        luzSol.position.copy(sol.position); sol.uniforms.uTime.value = t;
        if (cena.fog) { const h = Math.max(0, camera.position.y); cena.fog.near = 150 + h * 1.4; cena.fog.far = 700 + h * 5.5; }
      }
      luzes.forEach((m, k) => m.color.setHex(((k + Math.floor(t * 8)) % 12) < 3 ? 0xffffff : 0xffb13b));
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
