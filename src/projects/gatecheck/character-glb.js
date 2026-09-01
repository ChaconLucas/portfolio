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
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true;
          // malha com esqueleto sai do frustum calculado na pose de repouso e
          // some da tela; o teste de recorte tem que ser desligado
          o.frustumCulled = false;
        }
      });

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
