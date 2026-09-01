import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { texturaCamisa, texturaTatuagem } from './textures.js';

/**
 * Personagem a partir de um modelo com esqueleto de verdade.
 *
 * Modelo: "Rigged Figure" — © 2017 Cesium, CC BY 4.0, via glTF-Sample-Assets.
 * O credito vive em `public/assets/models/CREDITOS.md` e a licenca exige que ele
 * seja mantido. 50 KB, entao nao pesa no carregamento.
 *
 * Devolve a MESMA forma que `criarPersonagem()` das primitivas, de proposito:
 * `pousarMaos()` e `animarPersonagem()` continuam funcionando sem saber de onde
 * veio o corpo.
 */

const OSSOS = {
  tronco: ['torso_joint_1', 'torso_joint_2', 'torso_joint_3'],
  pescoco: ['neck_joint_1', 'neck_joint_2'],
  bracoE: ['arm_joint_L_1', 'arm_joint_L_2', 'arm_joint_L_3'],
  bracoD: ['arm_joint_R_1', 'arm_joint_R_2', 'arm_joint_R_3'],
  pernaE: ['leg_joint_L_1', 'leg_joint_L_2', 'leg_joint_L_3'],
  pernaD: ['leg_joint_R_1', 'leg_joint_R_2', 'leg_joint_R_3']
};

/**
 * Separa a malha por influencia de osso: triangulo puxado pelos ossos do braco
 * vira pele tatuada, o resto vira camisa. E o unico jeito de ter dois materiais
 * num modelo que veio com uma malha so.
 */
function pintarPorOsso(malha, nomes) {
  const geo = malha.geometry;
  const skinIndex = geo.getAttribute('skinIndex');
  const skinWeight = geo.getAttribute('skinWeight');
  if (!skinIndex || !geo.index) return false;

  const ossosBraco = new Set();
  malha.skeleton.bones.forEach((b, i) => {
    if (/^arm_joint/.test(b.name)) ossosBraco.add(i);
  });

  const idx = geo.index.array;
  const camisa = [];
  const pele = [];

  const dominante = (v) => {
    let melhor = -1, peso = -1;
    for (let k = 0; k < 4; k++) {
      const w = skinWeight.getComponent(v, k);
      if (w > peso) { peso = w; melhor = skinIndex.getComponent(v, k); }
    }
    return melhor;
  };

  for (let t = 0; t < idx.length; t += 3) {
    const a = dominante(idx[t]), b = dominante(idx[t + 1]), c = dominante(idx[t + 2]);
    const braco = (ossosBraco.has(a) ? 1 : 0) + (ossosBraco.has(b) ? 1 : 0) + (ossosBraco.has(c) ? 1 : 0);
    (braco >= 2 ? pele : camisa).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  if (!pele.length) return false;

  geo.clearGroups();
  const ordem = camisa.concat(pele);
  geo.setIndex(ordem);
  geo.addGroup(0, camisa.length, 0);
  geo.addGroup(camisa.length, pele.length, 1);

  malha.material = [
    new THREE.MeshStandardMaterial({ map: texturaCamisa(), roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ map: texturaTatuagem(), roughness: 0.7 })
  ];
  return true;
}

/**
 * @param {string} url
 * @returns {Promise<object>} mesma interface do personagem de primitivas
 */
export function carregarPersonagem(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => {
      const raiz = gltf.scene;
      const ossos = {};
      raiz.traverse((o) => {
        if (o.isBone) ossos[o.name] = o;
        if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
      });

      const malha = raiz.getObjectByProperty('isSkinnedMesh', true);
      if (malha) pintarPorOsso(malha, OSSOS);

      const pegar = (n) => ossos[n] || new THREE.Object3D();

      const montarBraco = (lista) => ({
        ombro: pegar(lista[0]),
        cotovelo: pegar(lista[1]),
        mao: pegar(lista[2])
      });

      const p = {
        raiz,
        modelo: true,
        ossos,
        tronco: pegar(OSSOS.tronco[0]),
        cabeca: pegar(OSSOS.pescoco[1]),
        bracoE: montarBraco(OSSOS.bracoE),
        bracoD: montarBraco(OSSOS.bracoD)
      };

      p.base = {
        troncoX: p.tronco.rotation.x,
        ombroE: p.bracoE.ombro.rotation.clone(),
        ombroD: p.bracoD.ombro.rotation.clone(),
        cotoveloE: p.bracoE.cotovelo.rotation.clone(),
        cotoveloD: p.bracoD.cotovelo.rotation.clone()
      };

      resolve(p);
    }, undefined, reject);
  });
}
