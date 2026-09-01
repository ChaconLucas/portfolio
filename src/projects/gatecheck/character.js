import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETA, matPele, matTecido, matGrafite } from './materials.js';
import { texturaCamisa, texturaTatuagem, texturaBlackout } from './textures.js';
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

// camisa e pele sao instanciadas uma vez por cena e reaproveitadas nos membros
let _camisa, _tatuada;
const matCamisa = () => (_camisa || (_camisa = new THREE.MeshStandardMaterial({
  map: texturaCamisa(), roughness: 0.86, metalness: 0
})));
const matTatuada = () => (_tatuada || (_tatuada = new THREE.MeshStandardMaterial({
  map: texturaTatuagem(), roughness: 0.7, metalness: 0
})));
let _blackout;
const matBlackout = () => (_blackout || (_blackout = new THREE.MeshStandardMaterial({
  map: texturaBlackout(), roughness: 0.62, metalness: 0
})));

/**
 * Braco em dois segmentos, com pivo no ombro e no cotovelo, para a mao
 * chegar na mesa sem o antebraco atravessar o tampo.
 */
function criarBraco(lado) {
  const ombro = new THREE.Group();
  // o braco direito leva um blackout: bloco solido em vez de traco
  const pelo = lado === 1 ? matBlackout() : matTatuada();

  // capsula no lugar de caixa: braco arredondado le como membro, caixa le como bloco
  // deltoide: a bola no ombro e o que da leitura de braco forte
  const deltoide = malha(new THREE.SphereGeometry(0.068, 18, 14), pelo);
  deltoide.scale.set(1, 0.92, 1);
  ombro.add(deltoide);

  const superior = malha(new THREE.CapsuleGeometry(0.054, 0.195, 7, 16), pelo);
  superior.position.y = -0.135;
  ombro.add(superior);

  const cotovelo = new THREE.Group();
  cotovelo.position.y = -0.26;
  ombro.add(cotovelo);

  const antebraco = malha(new THREE.CapsuleGeometry(0.045, 0.185, 7, 16), pelo);
  antebraco.position.y = -0.125;
  cotovelo.add(antebraco);

  const mao = malha(new THREE.SphereGeometry(0.052, 16, 12), matPele());
  mao.scale.set(0.86, 0.58, 1.25);
  mao.position.set(0, -0.255, -0.02);
  cotovelo.add(mao);

  // POSE: o X do ombro precisa ser POSITIVO. Com valor negativo o braco girava
  // para +Z, ou seja, para tras — e o personagem parecia recostado em vez de
  // trabalhando. O +0.24 compensa a inclinacao do tronco, para o angulo no
  // mundo dar os ~45 graus que levam a mao ate o tampo.
  ombro.rotation.set(1.02, lado * -0.10, lado === 1 ? 0.24 : -0.05);
  cotovelo.rotation.set(0.62, 0, 0);

  return { ombro, cotovelo, mao };
}

function criarPerna(lado) {
  const quadril = new THREE.Group();

  const coxa = malha(new THREE.CapsuleGeometry(0.072, 0.28, 6, 14), matGrafite());
  coxa.position.y = -0.18;
  quadril.add(coxa);

  const joelho = new THREE.Group();
  joelho.position.y = -0.36;
  quadril.add(joelho);

  const canela = malha(new THREE.CapsuleGeometry(0.058, 0.28, 6, 14), matGrafite());
  canela.position.y = -0.18;
  joelho.add(canela);

  const pe = malha(caixa(0.115, 0.06, 0.22, 0.028, 5), matTecido());
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
  const pelve = malha(caixa(0.36, 0.16, 0.27, 0.08, 7), matGrafite());
  pelve.position.y = alturaAssento + 0.06;
  raiz.add(pelve);

  // tronco com pivo no quadril, para a respiracao inclinar de baixo
  const tronco = new THREE.Group();
  tronco.position.y = alturaAssento + 0.10;
  tronco.rotation.x = -0.24; // inclinado para a mesa: tira a cabeca da linha do encosto
  raiz.add(tronco);

  // ombros arredondados: o torso em caixa dura era o que mais deixava o
  // personagem com cara de bloco. Mais largo em cima e estreito na cintura,
  // que e o que le como corpo treinado.
  const torso = malha(caixa(0.47, 0.44, 0.27, 0.115, 8), matCamisa());
  torso.position.y = 0.22;
  tronco.add(torso);
  // trapezio ligando pescoco e ombros
  const trapezio = malha(new THREE.SphereGeometry(0.155, 20, 14), matCamisa());
  trapezio.scale.set(1.42, 0.42, 0.86);
  trapezio.position.y = 0.415;
  tronco.add(trapezio);

  // gola, so para quebrar o bloco unico do torso
  const gola = malha(new THREE.CylinderGeometry(0.082, 0.096, 0.05, 18), matTecido());
  gola.position.y = 0.462;
  tronco.add(gola);

  const pescoco = malha(new THREE.CylinderGeometry(0.048, 0.056, 0.09, 16), matTatuada());
  pescoco.position.y = 0.50;
  tronco.add(pescoco);

  // cabeca com pivo proprio: o olhar acompanha a tela sem mover o tronco
  const cabeca = new THREE.Group();
  cabeca.position.y = 0.545;
  tronco.add(cabeca);

  const cranio = malha(new THREE.SphereGeometry(0.105, 22, 18), matPele());
  cranio.scale.set(0.92, 1.02, 0.98);
  cranio.position.y = 0.10;
  cabeca.add(cranio);

  // cabelo: casca por cima e atras, que e o que a camera ve de costas
  const cabelo = malha(new THREE.SphereGeometry(0.112, 22, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), matCabelo());
  cabelo.scale.set(0.94, 1.06, 1.0);
  cabelo.position.set(0, 0.115, 0.006);
  cabeca.add(cabelo);
  const nuca = malha(new THREE.SphereGeometry(0.095, 18, 14), matCabelo());
  nuca.scale.set(0.98, 0.72, 0.55);
  nuca.position.set(0, 0.075, 0.055);
  cabeca.add(nuca);

  // bracos
  const bracoE = criarBraco(-1);
  bracoE.ombro.position.set(-0.255, 0.375, 0.01);
  tronco.add(bracoE.ombro);

  const bracoD = criarBraco(1);
  bracoD.ombro.position.set(0.255, 0.375, 0.01);
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

/**
 * Poe as maos na altura do tampo por busca binaria no angulo do ombro.
 *
 * Acertar esse angulo na mao quebra toda vez que uma proporcao muda (tronco
 * mais largo, braco mais grosso, cadeira mais alta). Resolvendo por numero, a
 * pose continua certa sozinha depois de qualquer ajuste de modelagem.
 *
 * @returns {{esquerda:THREE.Vector3, direita:THREE.Vector3}} posicoes no mundo
 */
export function pousarMaos(p, alvoY) {
  const v = new THREE.Vector3();

  const resolver = (braco) => {
    let lo = 0.55, hi = 1.75;
    for (let i = 0; i < 24; i++) {
      const meio = (lo + hi) / 2;
      braco.ombro.rotation.x = meio;
      p.raiz.updateMatrixWorld(true);
      braco.mao.getWorldPosition(v);
      // angulo maior => mao mais para frente e mais alta
      if (v.y > alvoY) hi = meio; else lo = meio;
    }
    braco.ombro.rotation.x = (lo + hi) / 2;
    p.raiz.updateMatrixWorld(true);
    return braco.mao.getWorldPosition(new THREE.Vector3());
  };

  const esquerda = resolver(p.bracoE);
  const direita = resolver(p.bracoD);

  // a animacao oscila em torno da pose, entao a base tem que ser a pose resolvida
  p.base.ombroE.copy(p.bracoE.ombro.rotation);
  p.base.ombroD.copy(p.bracoD.ombro.rotation);

  return { esquerda, direita };
}
