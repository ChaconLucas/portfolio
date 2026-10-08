import * as THREE from 'three';

/**
 * Etapa 3: cada tecnologia ganha um predio com cara propria (8 tipos, um por
 * tecnologia da area, entao numa praca nao se repete) e um emblema holografico
 * girando em cima. Todos tem a mesma "portaria" na frente (+z local, em
 * z = 4.5), onde fica a porta de luz: so o corpo muda.
 *
 * E cada planeta ganha uma decoracao com o tema da area (paineis de UI no
 * Frontend, torres de dados no Data, graficos de barra no Analytics...).
 */

export const TIPOS = ['torre', 'domo', 'zigurate', 'silo', 'cubo', 'antena', 'torcida', 'servidor'];

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// janelas acesas (algumas apagadas), usadas como emissiveMap
const _janelas = new Map();
function canvasJanelas(seed) {
  if (_janelas.has(seed)) return _janelas.get(seed);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d'); const r = rnd(seed);
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const v = r(); if (v < .3) continue;
    x.fillStyle = `rgba(255,255,255,${.35 + v * .65})`; x.fillRect(3 + i * 16, 4 + j * 16, 10, 8);
  }
  _janelas.set(seed, c); return c;
}

// emblema: sigla da tecnologia num circulo de neon (um sprite que gira)
function sigla(nome) {
  const limpo = nome.replace(/[^A-Za-z0-9+#. ]/g, '');
  const palavras = limpo.split(/[\s.]+/).filter(Boolean);
  if (palavras.length > 1) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  const p = palavras[0] || nome;
  return p.length <= 3 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1, 2).toLowerCase();
}
function texEmblema(nome, cor) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 40, 128, 128, 128);
  g.addColorStop(0, 'rgba(10,8,20,.85)'); g.addColorStop(.75, 'rgba(10,8,20,.6)'); g.addColorStop(1, 'rgba(10,8,20,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = cor; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 96, 0, Math.PI * 2); x.stroke();
  x.globalAlpha = .45; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 112, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1;
  const s = sigla(nome);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 ${s.length > 2 ? 64 : 88}px ui-monospace, Menlo, monospace`;
  x.shadowColor = cor; x.shadowBlur = 24; x.fillText(s, 128, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * Corpo de um predio. Devolve { grupo, topo (altura do teto), animar(t) }.
 * mats: { corpo, neon, vidro } compartilhados da praca; guarda: para descartar.
 */
export function corpoPredio(tipo, alt, cor, mats, guarda, seed) {
  const g = new THREE.Group();
  const neon = mats.neon, r = rnd(seed);
  const anim = [];
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); g.add(m); return m; };
  const cil = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 28) => { const m = new THREE.Mesh(guarda(new THREE.CylinderGeometry(rt, rb, h, seg)), mat); m.position.set(x, y, z); g.add(m); return m; };
  const arestas = (w, h, d, y0) => [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]].forEach(([ax, az]) => box(.16, h, .16, neon, ax, y0 + h / 2, az));
  // material com janelas acesas (repeticao conforme o tamanho)
  const matJanelas = (w, h) => {
    const t = guarda(new THREE.CanvasTexture(canvasJanelas(seed % 7 + 1))); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
    return guarda(new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: .5, metalness: .5, emissive: cor, emissiveMap: t, emissiveIntensity: 1.1 }));
  };
  let topo = alt;

  if (tipo === 'torre') {
    // tres blocos afinando, com janelas
    const n = 3; let y = 0, w = 8.4;
    for (let i = 0; i < n; i++) {
      const h = alt * (i === 0 ? .45 : i === 1 ? .33 : .22);
      box(w, h, w, matJanelas(w, h), 0, y + h / 2, 0); arestas(w, h, w, y);
      box(w + .3, .2, w + .3, neon, 0, y + h, 0);
      y += h; w *= .72;
    }
    const ant = cil(.08, .12, 4, neon, 0, y + 2, 0, 8); topo = y + 4;
    const luz = new THREE.Mesh(guarda(new THREE.SphereGeometry(.35, 10, 8)), mats.luz); luz.position.y = y + 4.1; g.add(luz);
    anim.push((t) => { luz.visible = (t * 1.3) % 1 < .5; });
  } else if (tipo === 'domo') {
    cil(4.6, 4.8, 1.6, mats.corpo, 0, .8, 0, 40);
    const domo = new THREE.Mesh(guarda(new THREE.SphereGeometry(4.4, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), mats.vidro); domo.position.y = 1.6; domo.scale.y = alt / 9; g.add(domo);
    const grade = new THREE.Mesh(guarda(new THREE.SphereGeometry(4.45, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)), mats.grade); grade.position.y = 1.6; grade.scale.y = alt / 9; g.add(grade);
    const anel = new THREE.Mesh(guarda(new THREE.TorusGeometry(4.75, .12, 8, 64)), neon); anel.rotation.x = Math.PI / 2; anel.position.y = 1.6; g.add(anel);
    const nucleo = new THREE.Mesh(guarda(new THREE.IcosahedronGeometry(1.4, 0)), mats.nucleo); nucleo.position.y = 1.6 + alt * .22; g.add(nucleo);
    anim.push((t) => { nucleo.rotation.y = t * .8; nucleo.rotation.x = t * .5; nucleo.position.y = 1.6 + alt * .22 + Math.sin(t * 1.6) * .3; });
    topo = 1.6 + 4.4 * alt / 9;
  } else if (tipo === 'zigurate') {
    let y = 0, w = 9;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const h = alt / n;
      box(w, h, w, i % 2 ? mats.corpo : matJanelas(w, h), 0, y + h / 2, 0);
      box(w + .25, .18, w + .25, neon, 0, y + h, 0);
      y += h; w -= 1.9;
    }
    const piramide = new THREE.Mesh(guarda(new THREE.ConeGeometry(w * .75, 2.6, 4)), mats.nucleo); piramide.rotation.y = Math.PI / 4; piramide.position.y = y + 1.3; g.add(piramide);
    anim.push((t) => { piramide.rotation.y = Math.PI / 4 + t * .4; });
    topo = y + 2.6;
  } else if (tipo === 'silo') {
    // dois tanques (banco de dados) ligados por uma ponte
    [-2.2, 2.2].forEach((x, k) => {
      const h = alt * (k ? .85 : 1);
      cil(2, 2, h, mats.corpo, x, h / 2, -.5, 32);
      for (let j = 1; j < 4; j++) { const a = new THREE.Mesh(guarda(new THREE.TorusGeometry(2.04, .08, 6, 40)), neon); a.rotation.x = Math.PI / 2; a.position.set(x, h * j / 4, -.5); g.add(a); }
      const tampa = new THREE.Mesh(guarda(new THREE.SphereGeometry(2, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mats.corpo); tampa.position.set(x, h, -.5); tampa.scale.y = .45; g.add(tampa);
    });
    box(2.6, .8, 1.2, neon, 0, alt * .7, -.5);
    // "dados" subindo entre os tanques
    const bits = [];
    for (let i = 0; i < 6; i++) { const b = box(.4, .4, .4, mats.luz, 0, 0, -.5); bits.push(b); }
    anim.push((t) => { bits.forEach((b, i) => { b.position.y = ((t * 2 + i * alt / 6) % alt); }); });
    topo = alt + .9;
  } else if (tipo === 'cubo') {
    // pedestal e um cubo holografico flutuando, girando
    cil(3.6, 4.2, 2.2, mats.corpo, 0, 1.1, 0, 6);
    const anel = new THREE.Mesh(guarda(new THREE.TorusGeometry(3.7, .1, 6, 6)), neon); anel.rotation.x = Math.PI / 2; anel.position.y = 2.2; g.add(anel);
    const lado = Math.min(5.2, alt * .45);
    const cubo = new THREE.Mesh(guarda(new THREE.BoxGeometry(lado, lado, lado)), mats.vidro); g.add(cubo);
    const fio = new THREE.LineSegments(guarda(new THREE.EdgesGeometry(cubo.geometry)), mats.linha); cubo.add(fio);
    const miolo = new THREE.Mesh(guarda(new THREE.BoxGeometry(lado * .4, lado * .4, lado * .4)), mats.nucleo); cubo.add(miolo);
    const y0 = 2.2 + lado * .9;
    anim.push((t) => { cubo.position.y = y0 + Math.sin(t * 1.2) * .5; cubo.rotation.y = t * .5; cubo.rotation.x = Math.sin(t * .4) * .3; miolo.rotation.y = -t * 1.4; });
    topo = y0 + lado * .8;
  } else if (tipo === 'antena') {
    box(7, 3, 7, matJanelas(7, 3), 0, 1.5, -.5); arestas(7, 3, 7, 0);
    cil(.5, .9, alt, mats.corpo, 0, 3 + alt / 2, -.5, 12);
    const prato = new THREE.Mesh(guarda(new THREE.SphereGeometry(2.6, 24, 10, 0, Math.PI * 2, 0, Math.PI / 3.2)), mats.corpo);
    prato.material = mats.prato; prato.position.set(0, 3 + alt, -.5); prato.rotation.x = -Math.PI * .7; g.add(prato);
    const giro = new THREE.Group(); giro.position.set(0, 3 + alt, -.5); g.add(giro); giro.add(prato); prato.position.set(0, 0, 0);
    const ondas = [0, 1, 2].map((k) => { const o = new THREE.Mesh(guarda(new THREE.TorusGeometry(1, .06, 6, 40)), mats.linha2.clone()); guarda(o.material); o.rotation.x = Math.PI / 2; o.position.set(0, 3 + alt + 1, -.5); g.add(o); return o; });
    anim.push((t) => {
      giro.rotation.y = t * .6;
      ondas.forEach((o, k) => { const f = (t * .6 + k / 3) % 1; o.scale.setScalar(1 + f * 5); o.position.y = 3 + alt + 1 + f * 3; o.material.opacity = (1 - f) * .8; });
    });
    topo = 3 + alt + 2.6;
  } else if (tipo === 'torcida') {
    // lajes giradas umas sobre as outras (torre torcida de vidro)
    const n = Math.round(alt / 1.1);
    const lajes = [];
    for (let i = 0; i < n; i++) {
      const m = box(6.2, 1.0, 6.2, i % 3 === 2 ? neon : mats.vidro, 0, .5 + i * 1.1, -.4);
      if (i % 3 === 2) m.scale.set(1.04, .14, 1.04);
      m.rotation.y = i * .09; lajes.push(m);
    }
    box(7.2, .8, 7.2, mats.corpo, 0, .4, -.4);
    anim.push((t) => { lajes.forEach((m, i) => { m.rotation.y = i * (.09 + Math.sin(t * .5) * .015); }); });
    topo = n * 1.1 + .5;
  } else {
    // servidor: bloco largo com fileiras de LEDs piscando
    const h = Math.min(alt, 9);
    box(8.6, h, 8, mats.corpo, 0, h / 2, -.5); arestas(8.6, h, 8, 0);
    const leds = new THREE.InstancedMesh(guarda(new THREE.BoxGeometry(.32, .14, .05)), mats.ledInst, 4 * 14 * 2);
    const m4 = new THREE.Matrix4(); let k = 0;
    for (const lx of [-4.31, 4.31]) for (let fy = 0; fy < 14; fy++) for (let fz = 0; fz < 4; fz++) {
      m4.makeRotationY(Math.PI / 2).setPosition(lx, .8 + fy * (h - 1.4) / 13, -3.6 + fz * 1.9); leds.setMatrixAt(k++, m4);
    }
    const corLed = new THREE.Color(), base = new THREE.Color(cor);
    for (let i = 0; i < k; i++) leds.setColorAt(i, base);
    g.add(leds);
    const vent = cil(1.2, 1.2, .5, neon, 2.2, h + .25, -1.5, 20);
    const helice = box(2.2, .1, .3, mats.luz, 2.2, h + .55, -1.5);
    anim.push((t) => {
      helice.rotation.y = t * 9;
      const f = Math.floor(t * 6);
      for (let i = 0; i < k; i++) { const v = ((i * 7919 + f * 104729) % 97) / 97; leds.setColorAt(i, v > .55 ? corLed.copy(base).multiplyScalar(1.6) : v > .2 ? base : corLed.setRGB(.05, .05, .08)); }
      leds.instanceColor.needsUpdate = true;
    });
    topo = h + 1;
  }
  return { grupo: g, topo, animar: (t) => anim.forEach((f) => f(t)) };
}

/** a portaria (igual em todos): moldura e degrau na frente da porta */
export function portaria(mats, guarda, P) {
  const g = new THREE.Group();
  const moldura = new THREE.Mesh(guarda(new THREE.BoxGeometry(4.2, 5.4, .9)), mats.corpo); moldura.position.set(0, 2.7, P / 2 - .2); g.add(moldura);
  const degrau = new THREE.Mesh(guarda(new THREE.BoxGeometry(5, .25, 2)), mats.corpo); degrau.position.set(0, .12, P / 2 + .9); g.add(degrau);
  return g;
}

/** emblema holografico (sprite com a sigla) */
export function emblema(nome, cor, guarda) {
  const sp = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: guarda(texEmblema(nome, cor)), transparent: true, depthWrite: false })));
  sp.scale.setScalar(4.2);
  return sp;
}

/**
 * Decoracao tematica espalhada pelo planeta (instanciada). Devolve a lista de
 * meshes e um animar(t) (as que flutuam/piscam).
 */
export function decorar(key, cor, alturaChao, livre, guarda, ext = 3600, fator = 1) {
  const r = rnd(key.length * 977 + 13);
  const corNeon = new THREE.Color(`hsl(${cor},95%,66%)`);
  const matBrilho = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},70%,55%)`), emissive: corNeon, emissiveIntensity: .9, roughness: .3, flatShading: true }));
  const matEscuro = guarda(new THREE.MeshStandardMaterial({ color: 0x1a1626, roughness: .6, metalness: .4, emissive: new THREE.Color(`hsl(${cor},80%,20%)`), emissiveIntensity: .4, flatShading: true }));
  const T = {
    frontend: { geo: () => new THREE.BoxGeometry(6, 3.6, .15), mat: guarda(new THREE.MeshBasicMaterial({ color: corNeon, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })), n: 220, voa: 7, esc: [.6, 1.6] },  // paineis de interface
    backend: { geo: () => new THREE.CylinderGeometry(.6, .6, 10, 8), mat: matEscuro, n: 260, esc: [.6, 1.8], deitado: .5 },   // canos
    mobile: { geo: () => new THREE.BoxGeometry(2.4, 5, .5), mat: matBrilho, n: 220, esc: [.6, 1.4] },                              // monolitos-tela
    data: { geo: () => new THREE.CylinderGeometry(2, 2, .9, 20), mat: matBrilho, n: 160, pilha: 4, esc: [.7, 1.5] },              // discos de banco
    security: { geo: () => new THREE.OctahedronGeometry(1.4, 0), mat: matBrilho, n: 200, voa: 5, esc: [.6, 1.3] },                  // pilones de escudo
    infra: { geo: () => new THREE.CylinderGeometry(.12, .25, 9, 6), mat: matEscuro, n: 180, esc: [.7, 1.6] },                     // antenas
    tooling: { geo: () => new THREE.TorusGeometry(1.8, .55, 6, 10), mat: matEscuro, n: 200, esc: [.6, 1.6], deitado: 1 },          // engrenagens
    analytics: { geo: () => new THREE.BoxGeometry(1.6, 1, 1.6), mat: matBrilho, n: 300, barra: true, esc: [1, 1] },              // barras
    ai: { geo: () => new THREE.SphereGeometry(1.2, 14, 10), mat: matBrilho, n: 220, voa: 9, esc: [.5, 1.5] }                       // orbes
  }[key];
  if (!T) return { animar() {} };
  const geo = guarda(T.geo());
  const nBase = Math.round(T.n * fator), n = nBase * (T.pilha || 1);
  const inst = new THREE.InstancedMesh(geo, T.mat, n);
  const base = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  let k = 0;
  for (let i = 0; i < nBase; i++) {
    let x, z; do { x = (r() - .5) * ext; z = (r() - .5) * ext; } while (!livre(x, z, 20));
    const esc = T.esc[0] + r() * (T.esc[1] - T.esc[0]);
    const chao = alturaChao(x, z);
    if (T.barra) {
      const h = 2 + Math.pow(r(), 2) * 22;
      v.set(x, chao + h / 2, z); s.set(1, h, 1); q.identity();
      base.push(null); inst.setMatrixAt(k++, m.compose(v, q, s));
      continue;
    }
    const pilha = T.pilha || 1;
    for (let p = 0; p < pilha; p++) {
      if (T.pilha && p > 0 && r() < .35) { inst.setMatrixAt(k++, m.makeScale(0, 0, 0)); base.push(null); continue; }
      const y = chao + (T.voa ? T.voa + r() * T.voa : 0) + (T.pilha ? .5 + p * 1.2 : (T.deitado ? .6 : 2.2 * esc));
      e.set(T.deitado ? Math.PI / 2 * T.deitado : 0, r() * 6.28, T.deitado ? r() * .4 : 0);
      q.setFromEuler(e); s.setScalar(esc); v.set(x, y, z);
      inst.setMatrixAt(k++, m.compose(v, q, s));
      base.push(T.voa ? { x, y, z, esc, rot: e.y, fase: r() * 6.28 } : null);
    }
  }
  inst.count = k;
  const voam = base.map((b, i) => b && [i, b]).filter(Boolean);
  return {
    mesh: inst,
    animar(t) {
      if (!voam.length) return;
      for (const [i, b] of voam) {
        v.set(b.x, b.y + Math.sin(t * .8 + b.fase) * 1.2, b.z);
        q.setFromEuler(e.set(0, b.rot + t * .3, 0)); s.setScalar(b.esc);
        inst.setMatrixAt(i, m.compose(v, q, s));
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  };
}
