import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Personagem com esqueleto e animacao de captura de movimento.
 *
 * Origem: Mixamo (Adobe) — personagem "Bryce" com o clipe "Typing".
 * O arquivo passou por FBX -> glTF, textura reduzida para 1024 em WebP e malha
 * em meshopt: 49,9 MB viraram 1,3 MB. Sem isso o modelo sozinho pesaria 26x o
 * site inteiro.
 *
 * Atencao ao comprimir de novo: `gltf-transform optimize` roda `join` e
 * `flatten`, que colapsam os nos usados pelo skin — o esqueleto cai de 109 para
 * 8 ossos e o boneco derrete. Use so `resize`, `webp` e `meshopt`.
 */

/** Ossos do Mixamo que a cena precisa alcancar, sem o prefixo `mixamorig:`. */
const CHAVE = {
  quadril: 'Hips',
  tronco: 'Spine1',
  cabeca: 'Head',
  maoE: 'LeftHand',
  maoD: 'RightHand'
};

/**
 * Pinta a camisa sem saber, de antemao, como o UV do modelo foi organizado.
 *
 * A ideia: os triangulos do tronco sao os que a coluna deforma. Filtrando por
 * osso dominante e juntando os UVs desses triangulos, sai o retangulo do torso
 * dentro do atlas. Aí basta repintar esse retangulo por cima da textura
 * original — branco com a faixa preta na diagonal.
 *
 * Retorna false quando a regiao encontrada e grande demais para ser so o
 * tronco: nesse caso o atlas mistura as partes e repintar estragaria o resto.
 */
function vestirCamisa(raiz) {
  let malha = null;
  raiz.traverse((o) => {
    if (malha || !o.isSkinnedMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && /body/i.test(m.name || '')) malha = o;
  });
  if (!malha) return false;

  const geo = malha.geometry;
  const uv = geo.getAttribute('uv');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  if (!uv || !si || !geo.index) return false;

  const torso = new Set();
  malha.skeleton.bones.forEach((b, i) => {
    if (/Spine\d?$/i.test(b.name.replace(/^mixamorig:?/i, ''))) torso.add(i);
  });
  if (!torso.size) return false;

  const dominante = (v) => {
    let melhor = -1, peso = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      if (w > peso) { peso = w; melhor = si.getComponent(v, k); }
    }
    return melhor;
  };

  const idx = geo.index.array;
  let u0 = 1, u1 = 0, v0 = 1, v1 = 0, achou = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const n = (torso.has(dominante(a)) ? 1 : 0) + (torso.has(dominante(b)) ? 1 : 0) + (torso.has(dominante(c)) ? 1 : 0);
    if (n < 3) continue;
    achou++;
    [a, b, c].forEach((k) => {
      const u = uv.getX(k), v = uv.getY(k);
      if (u < u0) u0 = u; if (u > u1) u1 = u;
      if (v < v0) v0 = v; if (v > v1) v1 = v;
    });
  }
  if (!achou) return false;

  const area = (u1 - u0) * (v1 - v0);
  if (area > 0.6) return false;  // o atlas mistura as partes: nao mexe

  const mat = Array.isArray(malha.material) ? malha.material[0] : malha.material;
  const img = mat.map && mat.map.image;
  if (!img || !img.width) return false;

  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // UV cresce para cima; o canvas cresce para baixo
  const x = u0 * c.width;
  const y = (1 - v1) * c.height;
  const l = (u1 - u0) * c.width;
  const a2 = (v1 - v0) * c.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, l, a2);
  ctx.clip();

  ctx.fillStyle = '#f2f2f4';
  ctx.fillRect(x, y, l, a2);

  // faixa preta na diagonal, atravessando o peito
  ctx.translate(x + l / 2, y + a2 / 2);
  ctx.rotate(-Math.PI / 4);
  const d = Math.hypot(l, a2);
  ctx.fillStyle = '#12141a';
  ctx.fillRect(-d, -a2 * 0.16, d * 2, a2 * 0.32);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = mat.map.flipY;
  tex.wrapS = mat.map.wrapS;
  tex.wrapT = mat.map.wrapT;
  tex.needsUpdate = true;
  mat.map = tex;
  mat.needsUpdate = true;
  return true;
}

export function carregarPersonagem(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    // o arquivo esta comprimido com EXT_meshopt_compression: sem o decodificador
    // o carregamento falha em silencio
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(url, (gltf) => {
      const raiz = gltf.scene;
      const ossos = {};

      raiz.traverse((o) => {
        if (o.isBone) ossos[o.name.replace(/^mixamorig:?/i, '')] = o;
        if (!o.isMesh && !o.isSkinnedMesh) return;
        o.castShadow = true;
        // malha com esqueleto sai do frustum calculado na pose de repouso e
        // some da tela; o teste de recorte tem que ser desligado
        o.frustumCulled = false;

        // O cabelo do Mixamo sao cartoes planos recortados pelo alfa da textura.
        // A conversao de FBX avisou que descartou o mapa de transparencia, entao
        // os cartoes viravam um bloco solido. Reativando o recorte pelo alfa.
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m || !/hair/i.test(m.name || '')) return;
          m.transparent = false;      // alphaTest nao precisa de ordenacao
          m.alphaTest = 0.5;
          m.side = THREE.DoubleSide;  // cartao de cabelo tem que aparecer dos dois lados
          m.depthWrite = true;
          m.needsUpdate = true;
        });
      });

      const vestiu = vestirCamisa(raiz);
      if (!vestiu) console.info('camisa: UV do tronco nao isolavel, mantendo a original');

      const mixer = new THREE.AnimationMixer(raiz);
      const clipe = gltf.animations && gltf.animations[0];
      if (clipe) mixer.clipAction(clipe).play();

      const pegar = (n) => ossos[n] || null;

      resolve({
        raiz,
        mixer,
        clipe,
        ossos,
        quadril: pegar(CHAVE.quadril),
        tronco: pegar(CHAVE.tronco),
        cabeca: pegar(CHAVE.cabeca),
        maoE: pegar(CHAVE.maoE),
        maoD: pegar(CHAVE.maoD),

        /** @param {number} dt segundos */
        atualizar(dt) { mixer.update(dt); },

        /** Materiais proprios, para o personagem sumir sem levar a estacao junto. */
        materiais() {
          const lista = [];
          raiz.traverse((o) => {
            if (!o.isMesh && !o.isSkinnedMesh) return;
            const m = Array.isArray(o.material) ? o.material : [o.material];
            o.material = Array.isArray(o.material) ? m.map(clonar) : clonar(m[0]);
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => lista.push(x));
          });
          return lista;
          function clonar(mat) {
            if (!mat) return mat;
            const c = mat.clone();
            c.transparent = true;
            return c;
          }
        }
      });
    }, undefined, reject);
  });
}
