import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Armas detalhadas (frente = +z, cabo na origem, como a mao direita segura):
 * corpo em blocos chanfrados com textura de paineis (linhas, parafusos,
 * gravacoes e faixas na cor da arma, gerada em canvas), metal com reflexo
 * (envMap do jogo), celula de energia que brilha e esquenta, cano com aletas,
 * mira holografica e a EMPUNHADURA DA FRENTE (userData.maoEsq: onde a mao
 * esquerda segura).
 * userData: boca (de onde sai o tiro), clarao (sprite do disparo),
 * calor(k) (0..1: a energia vai da cor da arma ao vermelho e o cano brilha).
 * Tambem: maosPrimeiraPessoa() — luvas para a visao em primeira pessoa.
 */
const COR = { blaster: 0xff4fd8, rifle: 0x4fd2ff, canhao: 0xffa040, espada: 0xff4fd8 };
const NOME = { blaster: 'BX-7 BLASTER', rifle: 'PR-90 PLASMA', canhao: 'ION-X CANNON', espada: 'EDGE-1 BLADE' };
let _env = null;
/** reflexo do metal (o jogo passa um envMap feito do RoomEnvironment) */
export function ambienteArmas(env) { _env = env; for (const m of _mats) { m.envMap = env; m.needsUpdate = true; } }
const _mats = new Set();
const guardar = (m) => { if (m.isMeshStandardMaterial) { m.envMap = _env; _mats.add(m); } return m; };

function texPainel(tipo) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const cor = '#' + COR[tipo].toString(16).padStart(6, '0');
  // base: metal escuro com ruido fino
  x.fillStyle = '#2c2a36'; x.fillRect(0, 0, 256, 256);
  const img = x.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n + 2; }
  x.putImageData(img, 0, 0);
  // paineis: linhas de junta escuras com brilho de um lado
  x.lineWidth = 2;
  for (const [a, b, w, h] of [[8, 10, 112, 70], [128, 10, 120, 40], [128, 56, 56, 90], [190, 56, 58, 90], [8, 88, 112, 74], [8, 170, 240, 78]]) {
    x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeRect(a, b, w, h);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.moveTo(a + 1, b + h); x.lineTo(a + 1, b + 1); x.lineTo(a + w, b + 1); x.stroke();
  }
  // parafusos
  x.fillStyle = 'rgba(200,200,220,.55)';
  for (const [a, b] of [[14, 16], [114, 16], [14, 74], [114, 74], [134, 16], [242, 16], [14, 176], [242, 176], [14, 242], [242, 242]]) { x.beginPath(); x.arc(a, b, 2.2, 0, 6.3); x.fill(); }
  // faixas de alerta na cor da arma
  x.save(); x.beginPath(); x.rect(128, 150, 120, 14); x.clip();
  for (let k = -20; k < 260; k += 16) { x.fillStyle = cor; x.beginPath(); x.moveTo(k, 164); x.lineTo(k + 8, 164); x.lineTo(k + 22, 150); x.lineTo(k + 14, 150); x.fill(); }
  x.restore();
  // gravacoes
  x.fillStyle = 'rgba(230,226,255,.7)'; x.font = '700 15px ui-monospace, Menlo, monospace'; x.fillText(NOME[tipo], 14, 130);
  x.fillStyle = cor; x.font = '700 11px ui-monospace, Menlo, monospace'; x.fillText('ENERGY CELL · ' + (tipo === 'canhao' ? '9.8 GJ' : '2.4 GJ'), 14, 150);
  x.fillStyle = 'rgba(230,226,255,.4)'; x.font = '600 9px ui-monospace, Menlo, monospace'; x.fillText('STACK UNIVERSE ARMORY · MK.III', 134, 40);
  // desgaste nas bordas
  x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 6, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const _tex = {};
const _qr = new THREE.Quaternion(), _er = new THREE.Euler();
let _claraoTex = null;
function texClarao() {
  if (_claraoTex) return _claraoTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (_claraoTex = new THREE.CanvasTexture(c));
}
let _reticulo = null;
function texReticulo(cor) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.strokeStyle = cor; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 20, 0, 6.3); x.stroke();
  x.fillStyle = cor; x.fillRect(30, 8, 4, 12); x.fillRect(30, 44, 4, 12); x.fillRect(8, 30, 12, 4); x.fillRect(44, 30, 12, 4); x.beginPath(); x.arc(32, 32, 3, 0, 6.3); x.fill();
  return new THREE.CanvasTexture(c);
}

export function montarArma(tipo) {
  const g = new THREE.Group(), cor = new THREE.Color(COR[tipo]);
  const tex = _tex[tipo] || (_tex[tipo] = texPainel(tipo));
  const corpo = guardar(new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, metalness: .75, roughness: .38, envMapIntensity: 1.2 }));
  const claro = guardar(new THREE.MeshStandardMaterial({ color: 0xc8c4d8, metalness: .9, roughness: .22, envMapIntensity: 1.4 }));
  const borracha = guardar(new THREE.MeshStandardMaterial({ color: 0x16141c, metalness: .1, roughness: .85 }));
  const energia = new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 2.2, metalness: .2, roughness: .3 });
  const quente = new THREE.MeshStandardMaterial({ color: 0x3a3440, emissive: new THREE.Color(0xff5a1e), emissiveIntensity: 0, metalness: .8, roughness: .3 });
  const B = (w, h, d, m, x = 0, y = 0, z = 0, r = .012) => { const k = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m); k.position.set(x, y, z); g.add(k); return k; };
  const C = (r, l, m, z, y = 0, seg = 16, r2 = r) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, l, seg), m); k.rotation.x = Math.PI / 2; k.position.set(0, y, z); g.add(k); return k; };
  const aletas = (r, z0, z1, n, y, m) => { for (let i = 0; i < n; i++) C(r, .008, m, z0 + (z1 - z0) * i / (n - 1), y, 16); };
  let boca = .3; const maoEsq = new THREE.Object3D();
  if (tipo === 'blaster') {
    // pistola: corpo compacto, cano com aletas, celula de energia lateral, mira holo
    B(.056, .085, .2, corpo, 0, .03, .05, .014);
    B(.06, .03, .17, claro, 0, .085, .045, .01);
    B(.042, .11, .052, borracha, 0, -.045, -.015, .012).rotation.x = -.22;   // cabo
    B(.012, .03, .04, claro, 0, -.01, .045);                                  // guarda do gatilho
    C(.017, .1, quente, .2, .045); aletas(.024, .16, .22, 4, .045, claro); C(.021, .02, claro, .255, .045);
    const cel = C(.02, .1, energia, .04, .03); cel.rotation.z = Math.PI / 2; cel.rotation.x = Math.PI / 2; cel.position.set(.034, .03, .05);
    B(.064, .008, .12, energia, 0, .102, .05, .003);
    maoEsq.position.set(-.03, -.075, .01); boca = .27;   // por baixo do cabo (as duas maos)
  } else if (tipo === 'rifle') {
    // rifle de plasma: receptor longo, cano com protecao termica, coronha, empunhadura frontal
    B(.064, .095, .36, corpo, 0, .025, .1, .016);
    B(.07, .03, .32, claro, 0, .085, .09, .01);
    B(.045, .12, .055, borracha, 0, -.055, -.005, .012).rotation.x = -.25;
    B(.05, .075, .16, corpo, 0, .01, -.18, .016); B(.054, .1, .04, borracha, 0, -.005, -.27, .014);   // coronha
    C(.02, .26, quente, .42, .03); aletas(.03, .32, .5, 6, .03, claro); C(.026, .03, claro, .56, .03);
    for (let i = 0; i < 3; i++) B(.072, .035, .045, energia, 0, .025, .02 + i * .07, .006);           // celulas na lateral
    B(.03, .085, .035, borracha, 0, -.045, .27, .01);                                                    // empunhadura da frente
    // mira holografica: aro + reticulo brilhando
    B(.052, .012, .06, claro, 0, .108, .02, .004);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(.024, .004, 6, 20), claro); aro.position.set(0, .14, .02); g.add(aro);
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(.04, .04), new THREE.MeshBasicMaterial({ map: (_reticulo = _reticulo || texReticulo('#7ae6ff')), transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    ret.position.set(0, .14, .02); g.add(ret);
    maoEsq.position.set(-.01, -.07, .12); boca = .58;   // no guarda-mao, perto do cabo (o braco esquerdo alcanca)
  } else if (tipo === 'espada') {
    // espada de energia: cabo com guarda e uma lamina de luz (nucleo branco + brilho)
    const cab = new THREE.Group(); g.add(cab); cab.rotation.x = -Math.PI / 2 + .25;   // lamina para cima/frente
    const P = (m) => { cab.add(m); return m; };
    const cabo = P(new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .2, 14), borracha)); cabo.position.y = 0;
    for (let i = 0; i < 3; i++) { const a = P(new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .012, 14), claro)); a.position.y = -.06 + i * .05; }
    const guarda = P(new THREE.Mesh(new RoundedBoxGeometry(.13, .03, .05, 2, .01), corpo)); guarda.position.y = .11;
    const emissor = P(new THREE.Mesh(new THREE.CylinderGeometry(.03, .024, .05, 14), claro)); emissor.position.y = .14;
    const nucleo = P(new THREE.Mesh(new THREE.CylinderGeometry(.012, .016, .95, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }))); nucleo.position.y = .64;
    const halo = P(new THREE.Mesh(new THREE.CylinderGeometry(.03, .036, 1, 12), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }))); halo.position.y = .64;
    const ponta = P(new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false }))); ponta.position.y = 1.12;
    g.userData.lamina = halo;
    boca = .9;
  } else if (tipo === 'canhao') {
    // canhao de ions: tubo grosso com bobinas de energia, alca de cima
    C(.062, .34, corpo, .13, .03, 18); C(.074, .06, claro, -.03, .03, 18);
    for (let i = 0; i < 4; i++) C(.07, .03, energia, .02 + i * .075, .03, 18);
    C(.05, .08, quente, .33, .03, 18, .058); C(.068, .025, claro, .37, .03, 18);
    B(.05, .12, .06, borracha, 0, -.065, -.02, .012).rotation.x = -.2;
    B(.03, .03, .2, claro, 0, .12, .1, .01); B(.03, .07, .03, claro, 0, .09, .01, .008); B(.03, .07, .03, claro, 0, .09, .19, .008);   // alca
    maoEsq.position.set(-.02, -.075, .08); boca = .4;
  }
  maoEsq.name = 'maoEsq'; g.add(maoEsq);
  const bocaObj = new THREE.Object3D(); bocaObj.position.set(0, tipo === 'canhao' ? .03 : tipo === 'rifle' ? .03 : .045, boca); g.add(bocaObj);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: texClarao(), color: cor.clone().lerp(new THREE.Color(1, 1, 1), .35), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fl.scale.setScalar(tipo === 'canhao' ? .7 : .4); bocaObj.add(fl);
  const corBase = cor.clone(), vermelho = new THREE.Color(0xff2a10);
  const baseQ = new THREE.Quaternion(), baseP = new THREE.Vector3();
  g.userData = { ...g.userData,
    boca: bocaObj, clarao: fl, maoEsq,
    /** calor 0..1: a energia vai ficando vermelha e o cano acende */
    calor(k, t = 0) {
      energia.emissive.copy(corBase).lerp(vermelho, Math.min(1, k * 1.2)); energia.color.copy(energia.emissive);
      energia.emissiveIntensity = 2.2 + k * 2 + (k > .85 ? Math.sin(t * 30) * 1.2 : 0);
      quente.emissiveIntensity = Math.max(0, k - .2) * 3.5;
    },
    /** golpe da espada 0..1: a lamina corta em arco da direita para a esquerda */
    golpe(k) {
      if (k < 0) { g.quaternion.copy(baseQ); return; }
      const e = k < .25 ? k / .25 : 1 - (k - .25) / .75, arco = (k < .25 ? -1 + 2 * (k / .25) * .3 : -.4 + 1.6 * Math.min(1, (k - .25) / .35));
      g.quaternion.copy(baseQ).multiply(_qr.setFromEuler(_er.set(-1.1 * e, -1.4 * arco * e, .5 * e)));
      if (g.userData.lamina) g.userData.lamina.material.opacity = .55 + e * .4;
    },
    /** recarga 0..1 (ou -1 = nada): a arma inclina, a celula sai e volta e a energia enche de novo */
    recarga(k) {
      if (k < 0) { g.quaternion.copy(baseQ); g.position.copy(baseP); energia.emissiveIntensity = 2.2; return; }
      const s = Math.sin(Math.PI * Math.min(1, k * 1.15));
      g.quaternion.copy(baseQ).multiply(_qr.setFromEuler(_er.set(-.55 * s, .25 * s, .45 * s))); g.position.copy(baseP); g.position.y -= .03 * s;
      energia.emissiveIntensity = k < .55 ? 2.2 * (1 - k / .55) * .15 : 2.2 * Math.min(1, (k - .55) / .4);
    }
  };
  g.visible = false;
  // a posicao de repouso (quem monta a arma na mao mexe nela depois)
  g.userData.fixarBase = () => { baseQ.copy(g.quaternion); baseP.copy(g.position); };
  return g;
}

/**
 * Luvas para a primeira pessoa (no espaco da arma): mao direita no cabo e a
 * esquerda na empunhadura da frente, dedos fechados. Traje branco/cinza.
 */
export function maosPrimeiraPessoa(tipo, arma) {
  const g = new THREE.Group();
  const luva = guardar(new THREE.MeshStandardMaterial({ color: 0xdedbe8, metalness: .15, roughness: .55 }));
  const escura = guardar(new THREE.MeshStandardMaterial({ color: 0x3a3646, metalness: .4, roughness: .5 }));
  const neon = new THREE.MeshBasicMaterial({ color: 0x9f7bff });
  const mao = (x, y, z, rx, ry, rz, esq) => {
    const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.set(rx, ry, rz);
    const p = new THREE.Mesh(new RoundedBoxGeometry(.06, .075, .085, 2, .02), luva); h.add(p);
    // dedos fechados em volta (quatro gomos curvados) e o polegar por cima
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new RoundedBoxGeometry(.018, .026, .05, 2, .008), luva);
      f.position.set((esq ? 1 : -1) * .036, .028 - i * .021, .025); f.rotation.set(0, (esq ? -1 : 1) * .9, 0); h.add(f);
      const ponta = new THREE.Mesh(new RoundedBoxGeometry(.018, .022, .032, 2, .008), luva); ponta.position.set((esq ? 1 : -1) * .05, .028 - i * .021, -.008); ponta.rotation.y = (esq ? -1 : 1) * 1.9; h.add(ponta);
    }
    const pol = new THREE.Mesh(new RoundedBoxGeometry(.02, .02, .055, 2, .008), luva); pol.position.set((esq ? -1 : 1) * .02, .045, .03); pol.rotation.set(-.3, 0, 0); h.add(pol);
    // punho do traje com friso de neon e antebraco saindo para tras
    const punho = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .07, 14), escura); punho.rotation.x = Math.PI / 2; punho.position.z = -.07; h.add(punho);
    const friso = new THREE.Mesh(new THREE.CylinderGeometry(.051, .051, .012, 14), neon); friso.rotation.x = Math.PI / 2; friso.position.z = -.045; h.add(friso);
    const braco = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .4, 14), luva); braco.rotation.x = Math.PI / 2; braco.position.z = -.29; h.add(braco);
    g.add(h); return h;
  };
  // direita no cabo
  mao(.0, -.035, -.02, -.25, 0, 0, false);
  if (tipo === 'espada') return g;   // espada: uma mao so
  // esquerda na frente (onde a arma marca), vinda de baixo/esquerda
  const e = arma.userData.maoEsq.position;
  if (tipo === 'canhao') mao(e.x - .01, e.y - .01, e.z, -.1, .5, Math.PI * .9, true);
  else if (tipo === 'blaster') mao(e.x - .01, e.y + .01, e.z - .01, -.35, .35, .25, true);
  else mao(e.x - .02, e.y + .015, e.z - .02, -.2, .55, .2, true);
  return g;
}
