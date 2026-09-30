import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * A fila da balada do GateCheck, viva: o seguranca le o ingresso no celular
 * de quem esta na frente. Verde: a catraca abre e a pessoa entra pela porta.
 * Vermelho: ele balanca a cabeca e a pessoa vai embora. A fila anda e chega
 * gente nova pelo fim (a mesma figura, com outra cara, roupa e altura).
 *
 * Coordenadas no espaco da balada (ver criarBalada): parede em Z, porta em X.
 * criarFila devolve { atualizar(dt, t) }.
 */

const caixa = (l, a, p, r = .015) => new RoundedBoxGeometry(l, a, p, 3, r);
function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function tex(w, h, desenhar) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  desenhar(cv.getContext('2d'), w, h);
  return t;
}
const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 22);
const sorteio = (a) => a[Math.floor(Math.random() * a.length)];
const suaviza = (k, dt) => 1 - Math.exp(-k * dt);
function giraPara(atual, alvo, f) {
  let d = alvo - atual; d = Math.atan2(Math.sin(d), Math.cos(d));
  return atual + d * f;
}

const PELES = [0x8d5a3b, 0xe0b08a, 0x5b3a26, 0xc98f6a, 0xf0c7a3, 0xb07a52, 0x3f2a1e];
const CABELOS = [0x120c0a, 0x5a2a16, 0x0a0808, 0x1d120c, 0xc9a25a, 0x7a3b1c, 0xd94f8a, 0x3a5bff];
const CAMISAS = [0xe8e2ff, 0xff3d8b, 0x2de0c4, 0xffb02e, 0x7c4dff, 0x3dd6ff, 0xff5a3d, 0xb6ff3d, 0xf5f5f5, 0x26263a];
const CALCAS = [0x23233a, 0x14141c, 0x2b3f6b, 0x2a2a2a, 0x3a4a5a, 0x4a3b2a, 0x5b1d2e];
const ESTILOS = ['curto', 'longo', 'coque', 'raspado'];

let _qr = null;
function texQR() {
  if (_qr) return _qr;
  _qr = tex(64, 128, (c, w, h) => {
    c.fillStyle = '#10151a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7c4dff'; c.fillRect(4, 8, w - 8, 12);
    c.fillStyle = '#f4fff8'; c.fillRect(8, 30, w - 16, w - 16);
    c.fillStyle = '#10151a';
    const n = 12, t = (w - 24) / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const canto = (x < 3 && y < 3) || (x > 8 && y < 3) || (x < 3 && y > 8);
      if (canto ? !(x % 9 === 1 && y % 9 === 1) : Math.random() > .52) c.fillRect(12 + x * t, 34 + y * t, t, t);
    }
    c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('PISTA', w / 2, h - 14);
  });
  return _qr;
}
let _brilho = null;
function texBrilho() {
  if (_brilho) return _brilho;
  _brilho = tex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  return _brilho;
}
function texSinal(ok) {
  return tex(128, 128, (c, w, h) => {
    c.fillStyle = ok ? '#2bff8f' : '#ff3b4e';
    c.beginPath(); c.arc(w / 2, h / 2, 56, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    if (ok) { c.moveTo(38, 66); c.lineTo(56, 84); c.lineTo(92, 46); }
    else { c.moveTo(42, 42); c.lineTo(86, 86); c.moveTo(86, 42); c.lineTo(42, 86); }
    c.stroke();
  });
}

/* Figura estilizada: tronco e quadril torneados (a camisa cobre a cintura da
   calca, sem a emenda serrilhada das capsulas), ombro redondo ligando o braco,
   pernas com pivo no quadril para andar, cabelo como calota inclinada para
   tras (deixa a testa e os olhos livres). Frente = +z local. */
export function criarPessoa(visual = {}) {
  const g = new THREE.Group();
  const corpo = new THREE.Group(); g.add(corpo);
  const std = (r) => new THREE.MeshStandardMaterial({ roughness: r });
  const m = { pele: std(.6), cabelo: std(.75), camisa: std(.72), calca: std(.85), tenis: std(.45) };
  const add = (pai, geo, mat, x, y, z) => { const me = peca(geo, mat, x, y, z); pai.add(me); return me; };

  const pernas = [-1, 1].map((l) => {
    const piv = new THREE.Group(); piv.position.set(l * .085, .8, 0); corpo.add(piv);
    add(piv, new THREE.CapsuleGeometry(.068, .6, 4, 10), m.calca, 0, -.37, 0);
    add(piv, caixa(.105, .075, .25, .03), m.tenis, 0, -.762, .035);
    return piv;
  });
  const quadril = add(corpo, lathe([[0, .72], [.15, .72], [.165, .8], [.155, .9], [0, .9]]), m.calca, 0, 0, 0); quadril.scale.z = .7;
  const tronco = add(corpo, lathe([[0, .8], [.172, .8], [.176, .88], [.168, 1.0], [.19, 1.18], [.2, 1.28], [.17, 1.36], [.08, 1.405], [0, 1.41]]), m.camisa, 0, 0, 0);
  tronco.scale.z = .64;
  add(corpo, new THREE.CylinderGeometry(.044, .05, .1, 12), m.pele, 0, 1.44, 0);

  const cabeca = new THREE.Group(); cabeca.position.set(0, 1.575, 0); corpo.add(cabeca);
  add(cabeca, new THREE.SphereGeometry(.1, 22, 16), m.pele, 0, 0, 0).scale.set(.9, 1.08, .96);
  const mOlho = new THREE.MeshBasicMaterial({ color: 0x141217 });
  [-1, 1].forEach((l) => {
    add(cabeca, new THREE.SphereGeometry(.0105, 8, 6), mOlho, l * .033, .004, .091);
    add(cabeca, new THREE.SphereGeometry(.018, 8, 6), m.pele, l * .092, -.005, 0).scale.set(.5, 1, .8);   // orelhas
    const sob = add(cabeca, new THREE.BoxGeometry(.03, .007, .008), m.cabelo, l * .034, .03, .094); sob.rotation.z = -l * .1;
  });
  add(cabeca, new THREE.SphereGeometry(.013, 8, 6), m.pele, 0, -.018, .098);
  const calota = add(cabeca, new THREE.SphereGeometry(.107, 22, 12, 0, Math.PI * 2, 0, Math.PI * .47), m.cabelo, 0, .006, -.006);
  calota.rotation.x = -.5; calota.scale.set(.95, 1.04, 1);
  const longo = add(cabeca, new THREE.CapsuleGeometry(.088, .17, 4, 12), m.cabelo, 0, -.075, -.05); longo.scale.set(1.08, 1, .62);
  const coque = add(cabeca, new THREE.SphereGeometry(.05, 12, 10), m.cabelo, 0, .1, -.075);

  const bracos = [-1, 1].map((l) => {
    const ombro = new THREE.Group(); ombro.position.set(l * .205, 1.31, 0); corpo.add(ombro);
    add(ombro, new THREE.SphereGeometry(.062, 14, 10), m.camisa, 0, 0, 0);
    add(ombro, new THREE.CapsuleGeometry(.056, .12, 4, 10), m.camisa, 0, -.1, 0);
    add(ombro, new THREE.CapsuleGeometry(.045, .1, 4, 10), m.pele, 0, -.2, 0);
    const cot = new THREE.Group(); cot.position.y = -.26; ombro.add(cot);
    add(cot, new THREE.CapsuleGeometry(.042, .17, 4, 10), m.pele, 0, -.11, 0);
    add(cot, new THREE.SphereGeometry(.046, 10, 8), m.pele, 0, -.24, 0);
    return { ombro, cot, l };
  });
  // celular na mao direita: o grupo gira +90 graus em x para a tela ficar em pe
  // olhando para a frente quando o antebraco esta na horizontal
  const cel = new THREE.Group(); cel.position.set(0, -.31, 0); cel.rotation.x = Math.PI / 2; bracos[1].cot.add(cel);
  add(cel, caixa(.075, .145, .014, .01), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: .3, metalness: .6 }), 0, 0, 0);
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(.066, .134), new THREE.MeshBasicMaterial({ map: texQR(), toneMapped: false }));
  tela.position.z = .0085; cel.add(tela);

  let fase = 0, segura = 0, alvoSegura = 0, olhaBaixo = 0;
  const api = {
    g, corpo, cabeca, cel, tela,
    vestir(v = {}) {
      m.pele.color.setHex(v.pele ?? sorteio(PELES));
      m.cabelo.color.setHex(v.cabelo ?? sorteio(CABELOS));
      m.camisa.color.setHex(v.camisa ?? sorteio(CAMISAS));
      m.calca.color.setHex(v.calca ?? sorteio(CALCAS));
      m.tenis.color.setHex(v.tenis ?? (Math.random() > .6 ? 0xf2f2f2 : 0x1b1b22));
      const e = v.estilo ?? sorteio(ESTILOS);
      calota.visible = e !== 'raspado' || Math.random() > .5; calota.scale.y = e === 'raspado' ? .9 : 1.04;
      longo.visible = e === 'longo'; coque.visible = e === 'coque';
      corpo.scale.setScalar((v.altura ?? (1.6 + Math.random() * .26)) / 1.72);
      corpo.scale.x *= v.largura ?? (.95 + Math.random() * .12);
    },
    // 0 = braco solto, 1 = celular levantado mostrando o QR
    segurar(v) { alvoSegura = v; },
    olharCelular(v) { olhaBaixo = v; },
    // distancia andada neste quadro (0 = parado)
    atualizar(dt, andou, t) {
      segura += (alvoSegura - segura) * suaviza(8, dt);
      cel.visible = segura > .05;
      if (andou > 0) fase += andou * 9;
      else fase += (Math.round(fase / Math.PI) * Math.PI - fase) * suaviza(10, dt);   // volta a ficar em pe
      const passo = Math.sin(fase), amp = Math.min(1, andou / Math.max(dt, 1e-4) / .8);
      pernas[0].rotation.x = passo * .55 * amp; pernas[1].rotation.x = -passo * .55 * amp;
      corpo.position.y = Math.abs(Math.cos(fase)) * .022 * amp;
      bracos.forEach(({ ombro, cot, l }) => {
        const balanco = (l < 0 ? passo : -passo) * .4 * amp;
        if (l > 0) {
          ombro.rotation.x = balanco * (1 - segura) - .3 * segura;
          ombro.rotation.z = .07 * (1 - segura) + .06 * segura;
          cot.rotation.x = -.15 * (1 - segura) - 1.45 * segura;
        } else {
          ombro.rotation.x = balanco; ombro.rotation.z = -.07; cot.rotation.x = -.15;
        }
      });
      // parado: o peso muda de perna devagar
      corpo.rotation.z = (1 - amp) * Math.sin(t * .9 + g.id) * .02;
      cabeca.rotation.x += ((olhaBaixo ? .38 : 0) + segura * .12 - cabeca.rotation.x) * suaviza(6, dt);
    }
  };
  api.vestir(visual);
  return api;
}

/* ----------------------------------------------------------------- fila -- */
export function criarFila(raiz, { X, Z, catracas, aoValidar }) {
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const SLOTS = Array.from({ length: 6 }, (_, i) => V(.72 + i * .52, -2.3 + (i % 2) * .04));
  // entra: sai da frente do seguranca, vai ate o vao entre as catracas e
  // atravessa a porta (a parede esconde quem passa do plano dela)
  const ENTRA = [V(.35, -1.6), V(X, -1.42), V(X, -2.45), V(X, -3.1)];
  // barrado: volta pela frente da corda e some pela direita
  const SAI = [V(.8, -1.45), V(1.9, -1.1), V(4.8, -1.0)];
  const CHEGA = V(4.8, -2.3);

  // seguranca encostado na parede, entre a porta e a fila, virado para quem chega
  const seg = criarPessoa({ pele: 0x6b4430, cabelo: 0x0a0808, camisa: 0x0f0f14, calca: 0x0c0c10, tenis: 0x0c0c10, altura: 1.9, largura: 1.12, estilo: 'raspado' });
  seg.g.position.set(.14, 0, -2.32); seg.g.rotation.y = 1.25; raiz.add(seg.g);
  const staff = tex(128, 48, (c, w, h) => { c.fillStyle = '#fff'; c.font = '900 34px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STAFF', w / 2, h / 2); });
  const txt = new THREE.Mesh(new THREE.PlaneGeometry(.2, .075), new THREE.MeshBasicMaterial({ map: staff, transparent: true }));
  txt.position.set(0, 1.24, .125); seg.corpo.add(txt);
  const txtCostas = txt.clone(); txtCostas.position.z = -.125; txtCostas.rotation.y = Math.PI; seg.corpo.add(txtCostas);
  seg.cabeca.add(peca(new THREE.SphereGeometry(.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }), .1, -.01, 0));
  // o celular dele e o leitor: a tela e o halo piscam verde ou vermelho
  const telaSeg = new THREE.MeshBasicMaterial({ color: 0x223044, toneMapped: false });
  seg.tela.material = telaSeg;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: 0x2bff8f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(.55); seg.cel.add(halo);
  const luz = new THREE.PointLight(0x2bff8f, 0, 2.2, 1.6); seg.cel.add(luz);

  // o sinal que sobe na cabeca de quem foi lido
  const sinais = { ok: texSinal(true), nao: texSinal(false) };
  const sinal = new THREE.Sprite(new THREE.SpriteMaterial({ map: sinais.ok, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  sinal.scale.setScalar(.22); raiz.add(sinal);

  const fila = [], andando = [];
  const novo = (slot) => {
    const p = criarPessoa();
    const s = { p, caminho: [], vel: (slot ? 1.0 : .75) + Math.random() * .2, espera: 0, olhaCel: Math.random() > .6 };
    p.g.position.copy(slot ? CHEGA : SLOTS[fila.length]);
    if (slot) s.caminho.push(slot.clone());
    p.olharCelular(s.olhaCel); p.segurar(s.olhaCel ? .7 : 0);
    raiz.add(p.g);
    return s;
  };
  for (let i = 0; i < 5; i++) fila.push(novo(null));
  const reserva = [];                      // quem ja saiu de cena e volta com outra cara
  const repor = () => {
    // assim que alguem sai da fila, ja chega outro pelo fim (sem esperar o outro sumir)
    const s = reserva.pop();
    if (!s) { fila.push(novo(SLOTS[fila.length])); return; }
    s.p.vestir(); s.p.g.visible = true; s.p.g.position.copy(CHEGA); s.p.g.rotation.y = -Math.PI / 2;
    s.caminho = [SLOTS[fila.length].clone()]; s.vel = 1.0 + Math.random() * .2; s.saida = null;
    s.olhaCel = Math.random() > .6; s.p.olharCelular(s.olhaCel); s.p.segurar(s.olhaCel ? .7 : 0); s.p.cabeca.rotation.y = 0;
    fila.push(s);
  };

  // Na fila ninguem anda por cima de ninguem: so da o passo se nao tem alguem
  // logo a frente (na direcao em que vai andar). Quem sai da frente libera o
  // lugar andando, e o de tras so avanca quando o espaco abriu.
  const ESPACO = .46;
  function livre(s, dx, dz, d) {
    const pos = s.p.g.position;
    for (const o of fila.concat(andando)) {
      if (o === s || !o.p.g.visible) continue;
      const ox = o.p.g.position.x - pos.x, oz = o.p.g.position.z - pos.z;
      const dist = Math.hypot(ox, oz);
      if (dist < ESPACO && (ox * dx + oz * dz) / (d * dist || 1) > .3) return false;
    }
    return true;
  }
  function mover(s, dt, cuidado) {
    const alvo = s.caminho[0]; if (!alvo) return 0;
    const pos = s.p.g.position, dx = alvo.x - pos.x, dz = alvo.z - pos.z, d = Math.hypot(dx, dz);
    if (cuidado && d > .01 && !livre(s, dx, dz, d)) return 0;
    const v = s.vel * dt;
    if (d <= v) { pos.x = alvo.x; pos.z = alvo.z; s.caminho.shift(); } else { pos.x += dx / d * v; pos.z += dz / d * v; }
    if (d > .01) s.p.g.rotation.y = giraPara(s.p.g.rotation.y, Math.atan2(dx, dz), suaviza(9, dt));
    return Math.min(v, d);
  }

  let fase = 'espera', tf = 0, ok = true, lido = null;
  const flash = new THREE.Color();
  return {
    atualizar(dt, t) {
      dt = Math.min(dt, .05);
      tf += dt;
      const frente = fila[0];
      if (fase === 'espera' && frente && !frente.caminho.length) {
        fase = 'mostra'; tf = 0; frente.p.segurar(1); frente.p.olharCelular(false);
      } else if (fase === 'mostra' && tf > .7) {
        fase = 'le'; tf = 0; seg.segurar(1);
      } else if (fase === 'le' && tf > 1.1) {
        fase = 'resultado'; tf = 0;
        ok = Math.random() < .7;
        lido = fila.shift();
        lido.espera = .55;
        lido.caminho = (ok ? ENTRA : SAI).map((v) => v.clone());
        lido.saida = ok ? 'entra' : 'sai';
        andando.push(lido);
        sinal.material.map = ok ? sinais.ok : sinais.nao;
        if (ok) { catracas.abrir(); aoValidar?.(); }
        // a fila anda
        // a fila anda (cada um espera o da frente liberar o espaco, ver livre())
        fila.forEach((s, i) => { s.caminho = [SLOTS[i].clone()]; });
        repor();
      } else if (fase === 'resultado' && tf > 1.1) {
        fase = 'espera'; tf = 0; seg.segurar(0);
        lido?.p.segurar(0);
      }

      // tela do seguranca: azul escuro parado, varrendo enquanto le, verde ou vermelho no resultado
      let brilho = 0;
      if (fase === 'le') { flash.setHex(0x9ec9ff); brilho = .25 + .25 * Math.sin(tf * 30); }
      else if (fase === 'resultado') { flash.setHex(ok ? 0x2bff8f : 0xff3b4e); brilho = tf < .9 ? (Math.sin(tf * 22) > -.3 ? 1 : .35) : Math.max(0, 1 - (tf - .9) * 5); }
      else flash.setHex(0x223044);
      telaSeg.color.copy(flash).multiplyScalar(fase === 'espera' || fase === 'mostra' ? 1 : .4 + .6 * brilho);
      halo.material.color.copy(flash); halo.material.opacity = brilho * .9;
      luz.color.copy(flash); luz.intensity = brilho * 2.2;
      // o seguranca vira para quem esta na frente; no vermelho balanca a cabeca
      seg.g.rotation.y = giraPara(seg.g.rotation.y, frente || fase === 'resultado' ? 1.2 : 1.0, suaviza(4, dt));
      seg.cabeca.rotation.y = (fase === 'resultado' && !ok && tf < .9) ? Math.sin(tf * 16) * .35 : seg.cabeca.rotation.y * (1 - suaviza(8, dt));
      seg.atualizar(dt, 0, t);

      // sinal na cabeca de quem foi lido: sobe e some
      if (fase === 'resultado' && lido) {
        const a = Math.min(1, tf * 6) * (1 - Math.max(0, (tf - .8) / .3));
        sinal.material.opacity = a;
        sinal.position.set(lido.p.g.position.x, 2.02 * lido.p.corpo.scale.y + tf * .12, lido.p.g.position.z);
      } else sinal.material.opacity = 0;

      fila.forEach((s, i) => {
        const andou = mover(s, dt, true);
        if (!s.caminho.length) {
          // parado na fila: olha para a porta, o da frente olha para o seguranca
          const alvo = i === 0 ? Math.atan2(seg.g.position.x - s.p.g.position.x, seg.g.position.z - s.p.g.position.z) : -1.25 + Math.sin(t * .3 + i) * .25;
          s.p.g.rotation.y = giraPara(s.p.g.rotation.y, alvo, suaviza(4, dt));
          if (i === 0 && fase === 'espera') s.p.segurar(1);
          if (i > 0 && Math.random() < dt * .08) { s.olhaCel = !s.olhaCel; s.p.olharCelular(s.olhaCel); s.p.segurar(s.olhaCel ? .7 : 0); }
          s.p.cabeca.rotation.y = s.olhaCel ? 0 : Math.sin(t * .5 + i * 1.7) * .4;
        }
        s.p.atualizar(dt, andou, t);
      });
      for (let k = andando.length - 1; k >= 0; k--) {
        const s = andando[k];
        if (s.espera > 0) { s.espera -= dt; s.p.atualizar(dt, 0, t); continue; }
        if (s.saida === 'sai') { s.p.olharCelular(true); s.p.segurar(0); }
        const andou = mover(s, dt);
        s.p.atualizar(dt, andou, t);
        if (!s.caminho.length) {
          // saiu de cena: fica guardado para voltar com outra cara
          andando.splice(k, 1);
          s.p.g.visible = false;
          reserva.push(s);
        }
      }
      catracas.atualizar(dt, andando.some((s) => s.saida === 'entra' && s.p.g.position.z > -2.6 && !s.espera));
    }
  };
}
