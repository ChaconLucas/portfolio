import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Loja de material de tatuagem com entrega por motoboy — o ambiente inteiro
 * do capitulo FLASH (antes era so um chao e a nevoa).
 *
 * Parede de tijolo escuro com o letreiro neon FLASH e o cachorro em neon,
 * estantes com frascos de tinta, cartuchos e luvas, o balcao com a maquina de
 * tatuar, e a moto do motoboy estacionada com o bau vermelho da marca.
 *
 * A camera vem da direita olhando para a esquerda, e a coluna de texto cobre o
 * terco esquerdo: o que precisa ser lido (neon, estante, moto) fica a direita
 * da pessoa. `atualizar(t)` faz o neon tremular.
 */

const VERMELHO = 0xd21f2b;
const caixa = (l, a, p, r = .015) => new RoundedBoxGeometry(l, a, p, 3, r);
function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function canvasTex(w, h, desenhar) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  desenhar(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.userData.redesenhar = () => { c.clearRect(0, 0, w, h); desenhar(c, w, h); t.needsUpdate = true; };
  return t;
}

// ---------------------------------------------------------------- parede --
function texturaTijolo() {
  const t = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#1b1416'; c.fillRect(0, 0, w, h);
    const bw = 128, bh = 48;
    for (let y = 0, i = 0; y < h; y += bh, i++) {
      for (let x = (i % 2) * -bw / 2; x < w; x += bw) {
        const v = 30 + Math.random() * 22;
        c.fillStyle = `rgb(${v + 14},${v * .55},${v * .55})`;
        c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        c.fillStyle = 'rgba(0,0,0,.25)';
        c.fillRect(x + 3, y + bh - 10, bw - 6, 7);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 3);
  return t;
}
function criarParede() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshStandardMaterial({ map: texturaTijolo(), roughness: .9 }));
  m.position.set(0, 2.5, -3.2); m.receiveShadow = true;
  return m;
}

// ----------------------------------------------------------------- neon --
function criarNeon() {
  const g = new THREE.Group();
  const cachorro = new Image(); cachorro.src = '/assets/projects/flash-cachorro.png';
  const desenhar = (brilho) => (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.shadowColor = '#ff2438'; c.shadowBlur = brilho;
    c.strokeStyle = '#ffd6d9'; c.lineWidth = 7; c.lineJoin = 'round';
    c.font = '400 150px "Rubik Dirt", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ff3346'; c.fillText('FLASH', w * .36, h / 2);
    c.strokeText('FLASH', w * .36, h / 2);
    if (cachorro.complete && cachorro.naturalWidth) {
      const cw = 240, ch = cw * cachorro.naturalHeight / cachorro.naturalWidth;
      c.drawImage(cachorro, w * .78 - cw / 2, h / 2 - ch / 2, cw, ch);
    }
  };
  const letreiro = canvasTex(1024, 320, desenhar(26));
  const halo = canvasTex(512, 160, (c, w, h) => {
    const r = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,40,60,.55)'); r.addColorStop(1, 'rgba(255,40,60,0)');
    c.fillStyle = r; c.fillRect(0, 0, w, h);
  });
  cachorro.onload = () => letreiro.userData.redesenhar();
  if (document.fonts) document.fonts.load('400 150px "Rubik Dirt"').then(() => letreiro.userData.redesenhar()).catch(() => {});
  const matL = new THREE.MeshBasicMaterial({ map: letreiro, transparent: true, toneMapped: false, depthWrite: false });
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .75), matL);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.4), new THREE.MeshBasicMaterial({ map: halo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.z = -.01;
  g.add(glow, placa);
  const luz = new THREE.PointLight(0xff2a3a, 2.2, 5, 1.6);
  luz.position.set(0, 0, .5);
  g.add(luz);
  // acima da cabeca da pessoa, a esquerda da estante: a pessoa fica
  // embaixo do letreiro, que e onde a camera enquadra
  g.position.set(-.35, 2.0, -3.15);
  g.scale.setScalar(.72);
  return { grupo: g, placa: matL, luz };
}

// ------------------------------------------------------------ estantes --
function criarEstante() {
  const g = new THREE.Group();
  const madeira = new THREE.MeshStandardMaterial({ color: 0x241a17, roughness: .75 });
  const L = 2.3;
  [.7, 1.22, 1.74].forEach((y) => g.add(peca(caixa(L, .04, .34, .006), madeira, 0, y, 0)));
  [-L / 2, L / 2].forEach((x) => g.add(peca(caixa(.05, 1.9, .34, .006), madeira, x, 1.0, 0)));

  // frascos de tinta: instanciados, cada um com a sua cor de tampa e rotulo
  const cores = [0x111111, VERMELHO, 0x1d4fd6, 0x1fa84f, 0xf2c230, 0x7b2fd6, 0xf07a1c, 0xe8e8e8];
  const corpo = new THREE.CylinderGeometry(.038, .038, .13, 12);
  const tampa = new THREE.CylinderGeometry(.018, .026, .05, 10);
  const matCorpo = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .25, metalness: .05 });
  const matTampa = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: .4 });
  const N = 60;
  const iCorpo = new THREE.InstancedMesh(corpo, matCorpo, N), iTampa = new THREE.InstancedMesh(tampa, matTampa, N);
  const m4 = new THREE.Matrix4(), cor = new THREE.Color();
  let k = 0;
  [[.7, 22], [1.22, 20], [1.74, 18]].forEach(([y, n]) => {
    for (let i = 0; i < n && k < N; i++, k++) {
      const x = -L / 2 + .12 + i * ((L - .24) / (n - 1));
      m4.makeTranslation(x, y + .085, (i % 2) * .08 - .04);
      iCorpo.setMatrixAt(k, m4);
      m4.makeTranslation(x, y + .175, (i % 2) * .08 - .04);
      iTampa.setMatrixAt(k, m4);
      iCorpo.setColorAt(k, cor.setHex(cores[(i + Math.floor(y * 10)) % cores.length]));
    }
  });
  iCorpo.count = iTampa.count = k;
  iCorpo.castShadow = true;
  g.add(iCorpo, iTampa);
  // prateleira de baixo: caixas de cartucho (vermelho/preto) e de luvas (azul)
  const matCart = new THREE.MeshStandardMaterial({ color: VERMELHO, roughness: .6 });
  const matPreta = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .6 });
  const matLuva = new THREE.MeshStandardMaterial({ color: 0x2d6fd6, roughness: .6 });
  for (let i = 0; i < 7; i++) {
    const mat = i % 3 === 2 ? matLuva : i % 2 ? matPreta : matCart;
    const w = i % 3 === 2 ? .3 : .2;
    g.add(peca(caixa(w, .16, .24, .01), mat, -L / 2 + .2 + i * .31, .1 + .08, 0));
  }
  g.add(peca(caixa(L, .04, .34, .006), madeira, 0, .02, 0));
  g.position.set(1.35, 0, -2.95);
  return g;
}

// -------------------------------------------------------------- balcao --
function criarBalcao() {
  const g = new THREE.Group();
  g.add(peca(caixa(1.8, .95, .6, .02), new THREE.MeshStandardMaterial({ color: 0x141012, roughness: .6 }), 0, .475, 0));
  g.add(peca(caixa(1.9, .05, .66, .01), new THREE.MeshStandardMaterial({ color: 0x2b2224, roughness: .3, metalness: .3 }), 0, .975, 0));
  const fita = new THREE.Mesh(new THREE.BoxGeometry(1.76, .02, .01), new THREE.MeshBasicMaterial({ color: 0xff2a3a, toneMapped: false }));
  fita.position.set(0, .86, .305); g.add(fita);
  // maquina de tatuar (tipo caneta) e cartuchos em cima
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: .25, metalness: .9 });
  const maq = new THREE.Group();
  maq.add(peca(new THREE.CylinderGeometry(.022, .022, .16, 16), new THREE.MeshStandardMaterial({ color: VERMELHO, roughness: .3, metalness: .5 }), 0, .06, 0));
  maq.add(peca(new THREE.CylinderGeometry(.016, .02, .08, 16), metal, 0, -.06, 0));
  maq.add(peca(new THREE.CylinderGeometry(.004, .004, .04, 6), metal, 0, -.12, 0));
  maq.rotation.set(0, 0, 1.2); maq.position.set(.35, 1.03, .05);
  g.add(maq);
  for (let i = 0; i < 4; i++) g.add(peca(caixa(.12, .08, .16, .008), i % 2 ? new THREE.MeshStandardMaterial({ color: 0x151515 }) : new THREE.MeshStandardMaterial({ color: VERMELHO }), -.5 + i * .14, 1.04, -.08));
  g.position.set(-1.5, 0, -2.4); g.rotation.y = .25;
  return g;
}

// ---------------------------------------------------------------- moto --
function criarMoto() {
  const g = new THREE.Group();
  const pneu = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: .9 });
  const aro = new THREE.MeshStandardMaterial({ color: 0xb7bcc2, roughness: .3, metalness: .9 });
  const pintura = new THREE.MeshStandardMaterial({ color: VERMELHO, roughness: .3, metalness: .35 });
  const preto = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .5 });
  [-.62, .62].forEach((x) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.27, .075, 12, 32), pneu); r.position.set(x, .34, 0); r.castShadow = true; g.add(r);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .05, 20), aro); a.rotation.x = Math.PI / 2; a.position.set(x, .34, 0); g.add(a);
  });
  // quadro, tanque, banco, farol, guidao e escape
  g.add(peca(caixa(1.0, .22, .2, .05), pintura, .02, .64, 0));
  g.add(peca(caixa(.42, .2, .28, .08), pintura, .28, .8, 0));
  g.add(peca(caixa(.62, .09, .26, .04), preto, -.24, .86, 0));
  const garfo = peca(new THREE.CylinderGeometry(.025, .025, .62, 8), aro, .55, .62, 0); garfo.rotation.z = .35; g.add(garfo);
  const guidao = peca(new THREE.CylinderGeometry(.018, .018, .6, 8), preto, .64, 1.0, 0); guidao.rotation.x = Math.PI / 2; g.add(guidao);
  const farol = peca(new THREE.CylinderGeometry(.08, .08, .07, 16), aro, .7, .88, 0); farol.rotation.z = Math.PI / 2; g.add(farol);
  const lente = new THREE.Mesh(new THREE.CircleGeometry(.07, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false }));
  lente.position.set(.74, .88, 0); lente.rotation.y = Math.PI / 2; g.add(lente);
  const escape = peca(new THREE.CylinderGeometry(.04, .05, .6, 12), aro, -.35, .42, .14); escape.rotation.z = Math.PI / 2 - .12; g.add(escape);
  // bau vermelho com FLASH e o cachorro: e isso que diz "entrega rapida"
  const cao = new Image(); cao.src = '/assets/projects/flash-cachorro.png';
  const lado = canvasTex(512, 384, (c, w, h) => {
    c.fillStyle = '#d21f2b'; c.fillRect(0, 0, w, h);
    if (cao.complete && cao.naturalWidth) {
      const cw = 250, ch = cw * cao.naturalHeight / cao.naturalWidth;
      c.drawImage(cao, w / 2 - cw / 2, h * .31 - ch / 2, cw, ch);
    }
    c.fillStyle = '#fff'; c.font = '400 118px "Rubik Dirt", Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('FLASH', w / 2, h * .76);
  });
  cao.onload = () => lado.userData.redesenhar();
  if (document.fonts) document.fonts.load('400 118px "Rubik Dirt"').then(() => lado.userData.redesenhar()).catch(() => {});
  const matLado = new THREE.MeshStandardMaterial({ map: lado, roughness: .45 });
  const bau = new THREE.Mesh(caixa(.5, .44, .46, .04), [pintura, pintura, pintura, pintura, matLado, matLado]);
  bau.position.set(-.5, 1.14, 0); bau.castShadow = true;
  g.add(bau);
  // de lado para a camera, um pouco de frente
  g.position.set(1.25, 0, -2.2); g.rotation.y = -.22;
  return g;
}

/** Monta a loja. Devolve { raiz, atualizar(t), destruir() }. */
export function criarLoja() {
  const raiz = new THREE.Group();
  raiz.name = 'lojaFlash';
  raiz.add(criarParede());
  const neon = criarNeon(); raiz.add(neon.grupo);
  raiz.add(criarEstante());
  raiz.add(criarBalcao());
  raiz.add(criarMoto());
  return {
    raiz,
    atualizar(t) {
      // tremida de neon de verdade: quase sempre aceso, com falhas curtas
      const falha = Math.sin(t * 13.1) * Math.sin(t * 7.3) > .93 ? .35 : 1;
      neon.placa.opacity = falha;
      neon.luz.intensity = 2.2 * falha;
    },
    destruir() {
      raiz.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
    }
  };
}
