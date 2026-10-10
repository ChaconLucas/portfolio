import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/**
 * Bracos da primeira pessoa: "fps arms" de para (OpenGameArt, CC0 —
 * public/assets/jogo/bracos.fbx + bracos.jpg). Um par de bracos com ossos em
 * todos os dedos, no lugar dos bracos low-poly do astronauta (que de perto
 * pareciam garras).
 *  - a pele vira luva do traje: a textura e passada para tons de cinza (os
 *    vincos e as dobras ficam) e tingida de branco-lilas, com um punho escuro;
 *  - os ombros ficam presos a camera da arma; cada mao vai por IK (ombro e
 *    cotovelo) ate o cabo e o pulso gira para a mao envolver o cabo (a linha
 *    indicador -> minimo ao longo do cabo, a mao apontando para "frente");
 *  - os dedos fecham em volta (cada falange) e o polegar cruza por cima.
 * O rig vem em metros, com os bracos para -z e a mao direita em +x: o mesmo
 * referencial da camera.
 * criarBracos() -> Promise<{ grupo, posar(camera, alvos) }>
 * alvos: { dir: { pos, eixo, frente } | null, esq: { ... } | null }
 */
export async function criarBracos() {
  const fbx = await new FBXLoader().loadAsync('/assets/jogo/bracos.fbx');
  const tex = await new THREE.TextureLoader().loadAsync('/assets/jogo/bracos.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xe4def0, roughness: .62, metalness: .08 });
  // pele -> luva: tons de cinza da textura, tingidos; perto do punho (antebraco) escurece em faixa
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float lumL = dot(diffuseColor.rgb, vec3(.299, .587, .114));
      diffuseColor.rgb = vec3(.35 + lumL * .75) * vec3(.9, .88, .97);`);
  };
  fbx.traverse((o) => {
    if (o.isMesh) { o.material = mat; o.frustumCulled = false; }
    o.layers.set(1);   // desenhado na passada da arma (ver desenhar no index)
  });
  const B = {}; fbx.traverse((o) => { if (o.isBone) B[o.name] = o; });
  const repouso = new Map(); for (const k in B) repouso.set(B[k], B[k].quaternion.clone());
  const repousoPos = new Map(); for (const k of ['handRcontrol', 'handLcontrol']) if (B[k]) repousoPos.set(B[k], B[k].position.clone());
  const grupo = new THREE.Group(); grupo.add(fbx); grupo.visible = false;

  const lados = { R: lado('R'), L: lado('L') };
  function lado(L) {
    const dedos = ['index', 'middle', 'ring', 'pinky'].map((d) => [1, 2, 3].map((i) => B[`f_${d}0${i}${L}`]).filter(Boolean));
    return {
      ombro: B['upper_arm' + L], cotovelo: B['forearm' + L], ponta: B[`forearm${L}_end`], ctrl: B[`hand${L}control`], mao: B['hand' + L],
      raizDedo: B['palm_middle' + L], a: B['palm_index' + L], b: B['palm_pinky' + L], dedos, polegar: [1, 2, 3].map((i) => B[`thumb0${i}${L}`]).filter(Boolean)
    };
  }

  /* ---- giro no espaco do pai (como no astronauta) ---- */
  const _inv = new THREE.Matrix4(), _qw = new THREE.Quaternion(), _id = new THREE.Quaternion();
  function girar(o, de, para, k = 1) {
    _inv.copy(o.parent.matrixWorld).invert();
    de.transformDirection(_inv); para.transformDirection(_inv);
    _qw.setFromUnitVectors(de, para); if (k < 1) _qw.slerp(_id, 1 - k);
    o.quaternion.premultiply(_qw); o.updateWorldMatrix(false, true);
  }
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _T = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _en = new THREE.Vector3();
  function ik(l, alvo) {
    const { ombro, cotovelo, ponta } = l;
    ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E); ponta.getWorldPosition(_W); _T.copy(alvo);
    const a = _S.distanceTo(_E), b = _E.distanceTo(_W);
    let d = _S.distanceTo(_T); d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d));
    _n.subVectors(_T, _S).normalize();
    // o cotovelo dobra para baixo e para fora (natural segurando arma)
    _p.subVectors(_E, _S); _p.addScaledVector(_n, -_p.dot(_n)); _p.addScaledVector(_cima, -.15);
    if (_p.lengthSq() < 1e-8) _p.copy(_cima).negate(); _p.normalize();
    const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    _en.copy(_S).addScaledVector(_n, Math.cos(A) * a).addScaledVector(_p, Math.sin(A) * a);
    girar(ombro, _E.clone().sub(_S), _en.clone().sub(_S));
    cotovelo.getWorldPosition(_E); ponta.getWorldPosition(_W);
    girar(cotovelo, _W.clone().sub(_E), _T.clone().sub(_E));
  }
  const _f = new THREE.Vector3(), _s = new THREE.Vector3(), _h = new THREE.Vector3(), _a1 = new THREE.Vector3(), _b1 = new THREE.Vector3(), _e = new THREE.Vector3(), _cima = new THREE.Vector3(), _q = new THREE.Quaternion();
  const PALMA = .085;   // do pulso ao meio da mao fechada
  let LADO_PALMA = -.035, LADO_PALMA_E = .035; const _pn = new THREE.Vector3();
  function empunhar(l, alvo) {
    // frente perpendicular ao cabo; o pulso fica PALMA atras do ponto do cabo
    _f.copy(alvo.frente).addScaledVector(alvo.eixo, -alvo.frente.dot(alvo.eixo)).normalize();
    // e um pouco para o lado da palma: o cabo fica DENTRO do punho fechado
    // (a palma olha para o cabo: normal = eixo x frente, com o sinal da mao)
    _pn.crossVectors(alvo.eixo, _f).normalize().multiplyScalar(l === lados.R ? LADO_PALMA : LADO_PALMA_E);
    _T.copy(alvo.pos).addScaledVector(_f, -PALMA).add(_pn);
    ik(l, _T.clone());
    // a mao (presa num controle a parte) vai para a ponta do antebraco
    l.ponta.getWorldPosition(_h); l.ctrl.parent.worldToLocal(_h); l.ctrl.position.copy(_h); l.ctrl.updateWorldMatrix(false, true);
    // orienta: a mao aponta para a frente e a linha dos nos fica ao longo do cabo
    l.mao.getWorldPosition(_h); l.raizDedo.getWorldPosition(_a1); girar(l.mao, _a1.sub(_h).normalize().clone(), _f.clone());
    l.a.getWorldPosition(_a1); l.b.getWorldPosition(_b1); _s.subVectors(_a1, _b1); _s.addScaledVector(_f, -_s.dot(_f));
    _e.copy(alvo.eixo).addScaledVector(_f, -alvo.eixo.dot(_f));
    if (_s.lengthSq() > 1e-8 && _e.lengthSq() > 1e-8) girar(l.mao, _s.normalize().clone(), _e.normalize().clone());
  }
  // fecha os dedos: cada falange gira em volta do eixo da linha dos nos (indicador -> minimo)
  const _ax = new THREE.Vector3();
  function fechar(l, k, sinal) {
    l.a.getWorldPosition(_a1); l.b.getWorldPosition(_b1); _ax.subVectors(_a1, _b1).normalize();
    for (const dedo of l.dedos) for (const [i, o] of dedo.entries()) {
      _inv.copy(o.parent.matrixWorld).invert(); const eixo = _ax.clone().transformDirection(_inv);
      o.quaternion.premultiply(_q.setFromAxisAngle(eixo, sinal * k * (i === 0 ? 1.15 : 1.25))); o.updateWorldMatrix(false, true);
    }
    for (const [i, o] of l.polegar.entries()) {
      _inv.copy(o.parent.matrixWorld).invert(); const eixo = _ax.clone().transformDirection(_inv);
      o.quaternion.premultiply(_q.setFromAxisAngle(eixo, sinal * k * (i === 0 ? .2 : .55))); o.updateWorldMatrix(false, true);
    }
  }

  const OMBROS = new THREE.Vector3(0, -.27, -.02);   // a raiz do rig (entre os ombros) no espaco da camera da arma
  const sinalDedos = { R: -1, L: -1 }; let camadaAtual = 1;
  return {
    grupo,
    /** camada de desenho: 1 = passada da arma (a pe), 0 = cena normal (cabine) */
    camada(n) { if (n === camadaAtual) return; camadaAtual = n; grupo.traverse((o) => o.layers.set(n)); },
    /** inverte o sentido do fechar dos dedos (ajuste) */
    set sinal(v) { sinalDedos.R = v; },
    set sinalEsq(v) { sinalDedos.L = v; },
    set ladoPalma(v) { LADO_PALMA = v; },
    set ladoPalmaEsq(v) { LADO_PALMA_E = v; },
    posar(camera, alvos) {
      if (!grupo.visible) return;
      grupo.position.copy(OMBROS).applyQuaternion(camera.quaternion).add(camera.position);
      grupo.quaternion.copy(camera.quaternion);
      for (const [o, q] of repouso) o.quaternion.copy(q);
      for (const [o, p] of repousoPos) o.position.copy(p);
      grupo.updateMatrixWorld(true);
      _cima.set(0, 1, 0).applyQuaternion(camera.quaternion);
      for (const [L, alvo] of [['R', alvos.dir], ['L', alvos.esq]]) {
        const l = lados[L];
        if (!alvo) continue;
        empunhar(l, alvo);
        fechar(l, alvo.fecha ?? 1, sinalDedos[L]);
      }
    }
  };
}
