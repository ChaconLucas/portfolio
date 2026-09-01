import * as THREE from 'three';
import { texturaGrao } from './textures.js';

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
  color: PALETA.branco, roughness: 0.46, metalness: 0.02,
  clearcoat: 0.3, clearcoatRoughness: 0.45,
  roughnessMap: texturaGrao()
}));

export const matBrancoFosco = () => memo('brancoFosco', () => new THREE.MeshStandardMaterial({
  color: PALETA.brancoFrio, roughness: 0.74, metalness: 0.03, roughnessMap: texturaGrao()
}));

export const matRosa = () => memo('rosa', () => new THREE.MeshPhysicalMaterial({
  color: PALETA.rosa, roughness: 0.48, metalness: 0.04, clearcoat: 0.5, clearcoatRoughness: 0.35
}));

export const matRosaEscuro = () => memo('rosaEscuro', () => new THREE.MeshStandardMaterial({
  color: PALETA.rosaEscuro, roughness: 0.6, metalness: 0.05
}));

export const matGrafite = () => memo('grafite', () => new THREE.MeshStandardMaterial({
  color: PALETA.grafite, roughness: 0.58, metalness: 0.25, roughnessMap: texturaGrao()
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

/**
 * Vidro do gabinete.
 *
 * SEM `transmission`: transmissao precisa de mapa de ambiente para refratar
 * alguma coisa, e nesta cena nao ha nenhum — o painel renderizava o fundo
 * escuro e o gabinete lia como uma caixa branca fechada. Um transparente
 * simples com verniz deixa o interior aparecer e ainda custa menos.
 */
export const matVidro = () => memo('vidro', () => new THREE.MeshPhysicalMaterial({
  color: 0xe8f4ff, roughness: 0.04, metalness: 0,
  transparent: true, opacity: 0.10,
  clearcoat: 1, clearcoatRoughness: 0.03,
  side: THREE.DoubleSide, depthWrite: false
}));

/** Libera tudo que foi memoizado. Chamado so no descarte da cena. */
export function descartarMateriais() {
  cache.forEach((m) => m.dispose());
  cache.clear();
}
