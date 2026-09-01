import * as THREE from 'three';

/**
 * Paleta e materiais da cena. Ficam num lugar so para as pecas nao divergirem:
 * o branco da mesa, do braco do monitor e do gabinete tem que ser o mesmo branco,
 * senao a estacao parece montada com sobras.
 */
export const PALETA = {
  branco: 0xf2f2f4,
  brancoFrio: 0xe6e7ec,
  rosa: 0xff5fa2,
  rosaEscuro: 0xd63c7f,
  midnight: 0x1c1f2b,
  grafite: 0x23262f,
  preto: 0x14161d,
  pele: 0xd9a888,
  tecido: 0x2b2f3d,
  vidro: 0xbfd8e8
};

const cache = new Map();

/** Materiais sao compartilhados entre pecas: menos draw calls e menos memoria. */
function memo(chave, criar) {
  if (!cache.has(chave)) cache.set(chave, criar());
  return cache.get(chave);
}

export const matBranco = () => memo('branco', () => new THREE.MeshPhysicalMaterial({
  color: PALETA.branco, roughness: 0.42, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.4
}));

export const matBrancoFosco = () => memo('brancoFosco', () => new THREE.MeshStandardMaterial({
  color: PALETA.brancoFrio, roughness: 0.72, metalness: 0.03
}));

export const matRosa = () => memo('rosa', () => new THREE.MeshPhysicalMaterial({
  color: PALETA.rosa, roughness: 0.48, metalness: 0.04, clearcoat: 0.5, clearcoatRoughness: 0.35
}));

export const matRosaEscuro = () => memo('rosaEscuro', () => new THREE.MeshStandardMaterial({
  color: PALETA.rosaEscuro, roughness: 0.6, metalness: 0.05
}));

export const matGrafite = () => memo('grafite', () => new THREE.MeshStandardMaterial({
  color: PALETA.grafite, roughness: 0.55, metalness: 0.25
}));

export const matPreto = () => memo('preto', () => new THREE.MeshStandardMaterial({
  color: PALETA.preto, roughness: 0.45, metalness: 0.3
}));

export const matMidnight = () => memo('midnight', () => new THREE.MeshPhysicalMaterial({
  color: PALETA.midnight, roughness: 0.34, metalness: 0.62, clearcoat: 0.2
}));

export const matTecido = () => memo('tecido', () => new THREE.MeshStandardMaterial({
  color: PALETA.tecido, roughness: 0.92, metalness: 0
}));

export const matPele = () => memo('pele', () => new THREE.MeshStandardMaterial({
  color: PALETA.pele, roughness: 0.78, metalness: 0
}));

/** O gabinete aquario: vidro de verdade, para o interior aparecer. */
export const matVidro = () => memo('vidro', () => new THREE.MeshPhysicalMaterial({
  color: PALETA.vidro, roughness: 0.06, metalness: 0, transmission: 0.92,
  thickness: 0.02, ior: 1.45, transparent: true, opacity: 0.42, side: THREE.DoubleSide
}));

/** Libera tudo que foi memoizado. Chamado so no descarte da cena. */
export function descartarMateriais() {
  cache.forEach((m) => m.dispose());
  cache.clear();
}
