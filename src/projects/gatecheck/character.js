import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETA, matPele, matTecido, matGrafite } from './materials.js';
import { ALTURA_MESA } from './workstation.js';

/**
 * Personagem sentado, de costas em tres quartos: da para ver que ele esta
 * mexendo no computador sem precisar de rosto — o que evita o vale da
 * estranheza e mantem o foco na tela, que e o alvo do zoom.
 *
 * Sem esqueleto e sem animacao importada: os membros sao grupos aninhados e o
 * movimento e feito por rotacao. O objetivo e movimento sutil e crivel, nao
 * balanco exagerado.
 */

const caixa = (l, a, p, r = 0.03, s = 4) => new RoundedBoxGeometry(l, a, p, s, r);

function malha(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

const matCabelo = () => new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.85 });

/**
 * Braco em dois segmentos, com pivo no ombro e no cotovelo, para a mao
 * chegar na mesa sem o antebraco atravessar o tampo.
 */
function criarBraco(lado) {
  const ombro = new THREE.Group();

  const superior = malha(caixa(0.085, 0.26, 0.10, 0.04), matTecido());
  superior.position.y = -0.13;
  ombro.add(superior);

  const cotovelo = new THREE.Group();
  cotovelo.position.y = -0.26;
  ombro.add(cotovelo);

  const antebraco = malha(caixa(0.075, 0.25, 0.085, 0.035), matPele());
  antebraco.position.y = -0.125;
  cotovelo.add(antebraco);

  const mao = malha(caixa(0.075, 0.05, 0.11, 0.022), matPele());
  mao.position.set(0, -0.26, 0.015);
  cotovelo.add(mao);

  // pose base: ombro para frente e para baixo, cotovelo abrindo para a mesa
  ombro.rotation.set(-1.02, lado * 0.16, lado * 0.10);
  cotovelo.rotation.set(0.78, 0, 0);

  return { ombro, cotovelo, mao };
}

function criarPerna(lado) {
  const quadril = new THREE.Group();

  const coxa = malha(caixa(0.13, 0.36, 0.15, 0.05), matGrafite());
  coxa.position.y = -0.18;
  quadril.add(coxa);

  const joelho = new THREE.Group();
  joelho.position.y = -0.36;
  quadril.add(joelho);

  const canela = malha(caixa(0.11, 0.36, 0.12, 0.045), matGrafite());
  canela.position.y = -0.18;
  joelho.add(canela);

  const pe = malha(caixa(0.115, 0.06, 0.22, 0.025), matTecido());
  pe.position.set(0, -0.37, -0.05);
  joelho.add(pe);

  // sentado: coxa quase horizontal para a frente, canela para baixo
  quadril.rotation.x = -1.42;
  joelho.rotation.x = 1.36;
  quadril.rotation.z = lado * 0.06;

  return quadril;
}

export function criarPersonagem() {
  const raiz = new THREE.Group();
  raiz.name = 'personagem';

  const alturaAssento = 0.51;

  // quadril
  const pelve = malha(caixa(0.34, 0.16, 0.26, 0.06), matGrafite());
  pelve.position.y = alturaAssento + 0.06;
  raiz.add(pelve);

  // tronco com pivo no quadril, para a respiracao inclinar de baixo
  const tronco = new THREE.Group();
  tronco.position.y = alturaAssento + 0.10;
  tronco.rotation.x = -0.24; // inclinado para a mesa: tira a cabeca da linha do encosto
  raiz.add(tronco);

  const torso = malha(caixa(0.40, 0.46, 0.24, 0.07), matTecido());
  torso.position.y = 0.23;
  tronco.add(torso);

  // gola, so para quebrar o bloco unico do torso
  const gola = malha(caixa(0.20, 0.05, 0.19, 0.02), matTecido());
  gola.position.y = 0.455;
  tronco.add(gola);

  const pescoco = malha(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), matPele());
  pescoco.position.y = 0.50;
  tronco.add(pescoco);

  // cabeca com pivo proprio: o olhar acompanha a tela sem mover o tronco
  const cabeca = new THREE.Group();
  cabeca.position.y = 0.545;
  tronco.add(cabeca);

  const cranio = malha(caixa(0.185, 0.215, 0.20, 0.085, 5), matPele());
  cranio.position.y = 0.10;
  cabeca.add(cranio);

  // cabelo: casca por cima e atras, que e o que a camera ve de costas
  const cabelo = malha(caixa(0.198, 0.16, 0.212, 0.085, 5), matCabelo());
  cabelo.position.set(0, 0.145, 0.012);
  cabeca.add(cabelo);
  const nuca = malha(caixa(0.185, 0.11, 0.06, 0.03), matCabelo());
  nuca.position.set(0, 0.055, 0.082);
  cabeca.add(nuca);

  // bracos
  const bracoE = criarBraco(-1);
  bracoE.ombro.position.set(-0.215, 0.40, 0.01);
  tronco.add(bracoE.ombro);

  const bracoD = criarBraco(1);
  bracoD.ombro.position.set(0.215, 0.40, 0.01);
  tronco.add(bracoD.ombro);

  // pernas
  const pernaE = criarPerna(-1);
  pernaE.position.set(-0.11, alturaAssento + 0.02, -0.06);
  raiz.add(pernaE);
  const pernaD = criarPerna(1);
  pernaD.position.set(0.11, alturaAssento + 0.02, -0.06);
  raiz.add(pernaD);

  return {
    raiz, tronco, cabeca, bracoE, bracoD,
    /** guarda a pose de repouso para a animacao oscilar em torno dela */
    base: {
      troncoX: tronco.rotation.x,
      ombroE: bracoE.ombro.rotation.clone(),
      ombroD: bracoD.ombro.rotation.clone(),
      cotoveloE: bracoE.cotovelo.rotation.clone(),
      cotoveloD: bracoD.cotovelo.rotation.clone()
    }
  };
}

/**
 * Vida do personagem. Tudo em amplitudes pequenas e frequencias diferentes,
 * para nao virar um loop obvio nem um balanco de metronomo.
 *
 * @param {ReturnType<typeof criarPersonagem>} p
 * @param {number} t  tempo em segundos
 * @param {number} intensidade  0 = parado (usado quando a camera ja entrou na tela)
 */
export function animarPersonagem(p, t, intensidade = 1) {
  const k = intensidade;
  const { base } = p;

  // respiracao: o tronco sobe e desce de leve, com o pivo no quadril
  p.tronco.rotation.x = base.troncoX + Math.sin(t * 1.15) * 0.012 * k;
  p.tronco.position.y += 0; // posicao fica com a raiz; aqui so rotacao

  // cabeca: micro ajuste de leitura, com dois senos de periodo diferente
  p.cabeca.rotation.y = Math.sin(t * 0.43) * 0.075 * k;
  p.cabeca.rotation.x = Math.sin(t * 0.61 + 1.2) * 0.035 * k;

  // mao esquerda no teclado: digitacao curta e intermitente, nao continua
  const rajada = Math.max(0, Math.sin(t * 0.55));
  const teclar = Math.sin(t * 11.5) * rajada;
  p.bracoE.cotovelo.rotation.x = base.cotoveloE.x + teclar * 0.030 * k;
  p.bracoE.ombro.rotation.x = base.ombroE.x + teclar * 0.012 * k;

  // mao direita no mouse: deriva lenta, como quem move o cursor e para
  p.bracoD.ombro.rotation.y = base.ombroD.y + Math.sin(t * 0.37) * 0.055 * k;
  p.bracoD.ombro.rotation.x = base.ombroD.x + Math.sin(t * 0.29 + 2.1) * 0.022 * k;
  p.bracoD.cotovelo.rotation.x = base.cotoveloD.x + Math.sin(t * 0.37) * 0.030 * k;
}
