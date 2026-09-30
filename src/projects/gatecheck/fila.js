import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
const sorteio = (a) => a[Math.floor(Math.random() * a.length)];
const suaviza = (k, dt) => 1 - Math.exp(-k * dt);
function giraPara(atual, alvo, f) {
  let d = alvo - atual; d = Math.atan2(Math.sin(d), Math.cos(d));
  return atual + d * f;
}

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

/* Personagens da Quaternius (Ultimate Modular Men/Women, CC0), em
   public/assets/projects/gatecheck-gente. Enxutos: sem UV (o material e so
   cor), normais/pesos/ossos em 8 bits (posicao em 16 bits dava xadrez na
   roupa, entao fica em float), e so 3 animacoes (Idle_Neutral, Walk, Interact) no
   homem-casual e na mulher-casual — os outros usam os clips do mesmo esqueleto.
   Cada um que entra na fila sorteia a cor da roupa. Frente = +z local. */
const BASE = '/assets/projects/gatecheck-gente/';
const FILA_MODELOS = ['homem-casual', 'mulher-casual'];
const SEG_MODELO = 'seguranca-terno';
const ROUPAS = [0xe8e2ff, 0xff3d8b, 0x2de0c4, 0xffb02e, 0x7c4dff, 0x3dd6ff, 0xff5a3d, 0xb6ff3d, 0xf5f5f5, 0x26263a, 0x1c3a6b, 0x6b1d2e];
let _carga = null;
function carregarGente() {
  if (_carga) return _carga;
  const loader = new GLTFLoader();
  const nomes = [...FILA_MODELOS, SEG_MODELO];
  _carga = Promise.all(nomes.map((n) => loader.loadAsync(BASE + n + '.glb'))).then((gs) => {
    const modelos = {};
    nomes.forEach((n, i) => {
      const cena = gs[i].scene;
      cena.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });   // receber sombra dava acne (xadrez) na roupa
      const caixa3 = new THREE.Box3().setFromObject(cena);
      modelos[n] = { cena, altura: caixa3.max.y - caixa3.min.y };
    });
    const clips = (i) => Object.fromEntries(gs[i].animations.map((c) => [c.name.split('|').pop(), c]));
    return { modelos, homem: clips(nomes.indexOf('homem-casual')), mulher: clips(nomes.indexOf('mulher-casual')) };
  });
  return _carga;
}

const _v = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _qg = new THREE.Quaternion();
export function criarPessoa(gente, modelo) {
  const g = new THREE.Group();
  const corpo = new THREE.Group(); g.add(corpo);
  let boneco, mixer, acoes, cabeca, mao;
  // celular: fica no grupo da pessoa e segue a mao a cada quadro (assim nao
  // herda a escala 100 do esqueleto)
  const cel = new THREE.Group(); g.add(cel);
  cel.add(peca(caixa(.075, .145, .014, .01), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: .3, metalness: .6 })));
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(.066, .134), new THREE.MeshBasicMaterial({ map: texQR(), toneMapped: false }));
  tela.position.z = .0085; cel.add(tela);

  let segura = 0, alvoSegura = 0, anda = 0, olhaBaixo = 0, somaX = 0, somaY = 0, balanca = 0;
  const api = {
    g, corpo, cel, tela, olharY: 0, altura: 1.72,
    vestir(nome = sorteio(FILA_MODELOS), alt = 1.62 + Math.random() * .22) {
      if (boneco) { corpo.remove(boneco); mixer.stopAllAction(); }
      somaX = somaY = 0;
      const m = gente.modelos[nome];
      boneco = SkeletonUtils.clone(m.cena);
      // roupa sorteada: cada peca que nao e pele, olho, cabelo ou sobrancelha
      if (nome !== SEG_MODELO) {
        // cada material de roupa ganha uma cor so (a mesma em todas as pecas)
        const cores = {}, sorteadas = [sorteio(ROUPAS), sorteio(ROUPAS), sorteio(ROUPAS)];
        let k = 0;
        boneco.traverse((o) => {
          if (!o.isMesh) return;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          const novos = ms.map((mt) => {
            if (/skin|eye|hair|brow/i.test(mt.name)) return mt;
            if (!(mt.name in cores)) cores[mt.name] = new THREE.Color(sorteadas[k++ % 3]).multiplyScalar(.55);
            const c = mt.clone(); c.color.copy(cores[mt.name]); return c;
          });
          o.material = Array.isArray(o.material) ? novos : novos[0];
        });
      }
      corpo.add(boneco);
      api.altura = alt;
      corpo.scale.setScalar(alt / m.altura);
      cabeca = boneco.getObjectByName('Head');
      // o GLTFLoader tira o ponto dos nomes (Wrist.R vira WristR)
      mao = boneco.getObjectByName('WristR') || boneco.getObjectByName('Wrist.R') || cabeca;
      mixer = new THREE.AnimationMixer(boneco);
      const clips = nome.startsWith('mulher') ? gente.mulher : gente.homem;
      acoes = {};
      ['Idle_Neutral', 'Walk', 'Interact'].forEach((n) => { const a = mixer.clipAction(clips[n]); a.play(); a.setEffectiveWeight(0); acoes[n] = a; });
      mixer.update(Math.random() * 3);
    },
    segurar(v) { alvoSegura = v; },
    olharCelular(v) { olhaBaixo = v; },
    // "nao" com a cabeca (o pack nao tem esse gesto)
    negar() { balanca = 1.1; },
    // distancia andada neste quadro (0 = parado)
    atualizar(dt, andou) {
      if (!mixer || dt <= 0) return;
      const vel = andou / dt;
      anda += (Math.min(1, vel / .6) - anda) * suaviza(10, dt);
      segura += (alvoSegura - segura) * suaviza(6, dt);
      // o Interact do pack estica o braco ate a altura do rosto; pela metade,
      // misturado com o parado, ele fica na altura do peito, como quem mostra o celular
      const hold = segura * (1 - anda) * .5;
      acoes.Walk.setEffectiveWeight(anda);
      acoes.Walk.timeScale = Math.max(.6, vel / 1.1);
      acoes.Interact.setEffectiveWeight(hold);
      acoes.Idle_Neutral.setEffectiveWeight(Math.max(0, 1 - anda - hold));
      // por cima da animacao: para onde a cabeca olha. Desfaz o do quadro
      // anterior antes, para nao acumular se o clip nao mexe na cabeca.
      cabeca.rotation.y -= somaY; cabeca.rotation.x -= somaX;
      mixer.update(dt);
      balanca = Math.max(0, balanca - dt);
      const nao = balanca > 0 ? Math.sin(balanca * 18) * .4 * Math.min(1, balanca * 3) : 0;
      somaX += ((olhaBaixo ? .35 : 0) - somaX) * suaviza(6, dt);
      somaY += (api.olharY + nao - somaY) * suaviza(balanca > 0 ? 30 : 6, dt);
      cabeca.rotation.y += somaY; cabeca.rotation.x += somaX;
      // celular apoiado na palma da mao direita. No osso do pulso o Y aponta
      // para os dedos e o Z sai do dorso da mao: o aparelho vai ao longo dos
      // dedos, encostado na palma (-Z), com a tela virada para fora dela.
      cel.visible = segura > .5;
      if (cel.visible) {
        mao.updateWorldMatrix(true, false);
        const e = mao.matrixWorld.elements;
        _y.set(e[4], e[5], e[6]).normalize();
        _z.set(e[8], e[9], e[10]).normalize().negate();
        _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
        _m.makeBasis(_x, _y, _z);
        _v.setFromMatrixPosition(mao.matrixWorld).addScaledVector(_y, .075).addScaledVector(_z, .016);
        g.updateWorldMatrix(true, false);
        cel.position.copy(g.worldToLocal(_v));
        cel.quaternion.setFromRotationMatrix(_m).premultiply(_qg.copy(g.getWorldQuaternion(_qg)).invert());
      }
    }
  };
  api.vestir(modelo, modelo === SEG_MODELO ? 1.9 : undefined);
  return api;
}

/* ----------------------------------------------------------------- fila -- */
export function criarFila(raiz, opcoes) {
  // os personagens carregam em segundo plano; ate la a fila fica vazia
  let fila = null, morto = false;
  carregarGente().then((gente) => { if (!morto) fila = montarFila(raiz, gente, opcoes); })
    .catch((e) => console.warn('[gatecheck] personagens da fila nao carregaram', e));
  return {
    atualizar(dt, t) { fila?.atualizar(dt, t); },
    destruir() { morto = true; }
  };
}

function montarFila(raiz, gente, { X, Z, catracas, aoValidar }) {
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const SLOTS = Array.from({ length: 6 }, (_, i) => V(.72 + i * .52, -2.3 + (i % 2) * .04));
  // entra: sai da frente do seguranca, vai ate o vao entre as catracas e
  // atravessa a porta (a parede esconde quem passa do plano dela)
  const ENTRA = [V(.35, -1.6), V(X, -1.42), V(X, -2.45), V(X, -3.1)];
  // barrado: volta pela frente da corda e some pela direita
  const SAI = [V(.8, -1.45), V(1.9, -1.1), V(4.8, -1.0)];
  const CHEGA = V(4.8, -2.3);

  // seguranca encostado na parede, entre a porta e a fila, virado para quem chega
  const seg = criarPessoa(gente, SEG_MODELO);
  seg.g.position.set(-.02, 0, -2.34); seg.g.rotation.y = 1.25; raiz.add(seg.g);
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
    const p = criarPessoa(gente);
    const s = { p, caminho: [], vel: (slot ? 1.0 : .75) + Math.random() * .2, espera: 0, olhaCel: Math.random() > .6 };
    p.g.position.copy(slot ? CHEGA : SLOTS[fila.length]);
    if (slot) s.caminho.push(slot.clone());
    p.olharCelular(s.olhaCel);
    raiz.add(p.g);
    return s;
  };
  for (let i = 0; i < 5; i++) fila.push(novo(null));
  const reserva = [];                      // quem ja saiu de cena e volta com outra cara
  const repor = () => {
    // assim que alguem sai da fila, ja chega outro pelo fim (sem esperar o outro sumir)
    const s = reserva.pop();
    if (!s) { fila.push(novo(SLOTS[fila.length])); return; }
    s.p.vestir(); s.p.g.visible = true; s.p.olharY = 0; s.p.g.position.copy(CHEGA); s.p.g.rotation.y = -Math.PI / 2;
    s.caminho = [SLOTS[fila.length].clone()]; s.vel = 1.0 + Math.random() * .2; s.saida = null;
    s.olhaCel = Math.random() > .6; s.p.olharCelular(s.olhaCel); s.p.segurar(0); s.p.olharY = 0;
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
        if (ok) { catracas.abrir(); aoValidar?.(); } else seg.negar();
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
      seg.atualizar(dt, 0);

      // sinal na cabeca de quem foi lido: sobe e some
      if (fase === 'resultado' && lido) {
        const a = Math.min(1, tf * 6) * (1 - Math.max(0, (tf - .8) / .3));
        sinal.material.opacity = a;
        sinal.position.set(lido.p.g.position.x, lido.p.altura + .25 + tf * .12, lido.p.g.position.z);
      } else sinal.material.opacity = 0;

      fila.forEach((s, i) => {
        const andou = mover(s, dt, true);
        if (!s.caminho.length) {
          // parado na fila: olha para a porta, o da frente olha para o seguranca
          const alvo = i === 0 ? Math.atan2(seg.g.position.x - s.p.g.position.x, seg.g.position.z - s.p.g.position.z) : -1.25 + Math.sin(t * .3 + i) * .25;
          s.p.g.rotation.y = giraPara(s.p.g.rotation.y, alvo, suaviza(4, dt));
          if (i === 0 && fase === 'espera') s.p.segurar(1);
          if (i > 0 && Math.random() < dt * .08) { s.olhaCel = !s.olhaCel; s.p.olharCelular(s.olhaCel); }
          s.p.olharY = s.olhaCel ? 0 : Math.sin(t * .5 + i * 1.7) * .4;
        }
        s.p.atualizar(dt, andou);
      });
      for (let k = andando.length - 1; k >= 0; k--) {
        const s = andando[k];
        if (s.espera > 0) { s.espera -= dt; s.p.atualizar(dt, 0); continue; }
        if (s.saida === 'sai') { s.p.olharCelular(true); s.p.segurar(0); }
        if (s.saida === 'entra') s.p.segurar(0);
        const andou = mover(s, dt);
        s.p.atualizar(dt, andou);
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
