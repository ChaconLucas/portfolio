import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { matBranco, matBrancoFosco, matPreto, matGrafite } from '../gatecheck/materials.js';

/**
 * Ambiente da WSL: uma TV vertical de toque presa na parede.
 *
 * Ao contrario do GateCheck, aqui nao ha mobilia — o que existe e a parede, o
 * painel e a pessoa em pe. Por isso a cena inteira depende da PAREDE ter
 * material: numa superficie chapada o painel flutuaria no vazio.
 *
 * As sete telas da WSL sao todas retrato (0,567 a 0,761), entao a TV e vertical,
 * que e o formato usado em ativacao de evento.
 */

/** Centro do painel no mundo. A camera do capitulo mira aqui. */
export const PAINEL = {
  x: 0,
  y: 1.52,
  z: 0.036,
  largura: 1.12,
  altura: 1.72
};

const caixa = (l, a, p, r = 0.012, s = 3) => new RoundedBoxGeometry(l, a, p, s, r);

function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Parede de fundo com rodape e um friso, para nao ser um plano vazio. */
function criarParede() {
  const g = new THREE.Group();
  g.name = 'parede';

  const painelParede = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1c26, roughness: 0.94, metalness: 0 })
  );
  painelParede.position.set(0, 2.0, -0.02);
  painelParede.receiveShadow = true;
  g.add(painelParede);

  // rodape e friso: dao escala a parede e ancoram a TV numa altura crivel
  g.add(peca(caixa(9, 0.11, 0.035, 0.006), matGrafite(), 0, 0.055, 0.01));
  g.add(peca(caixa(9, 0.02, 0.02, 0.004), matGrafite(), 0, 2.62, 0.008));

  // chao
  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 6),
    new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.86 })
  );
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  g.add(chao);

  return g;
}

/**
 * TV vertical de toque.
 * @returns {{grupo:THREE.Group, tela:THREE.Mesh}}
 */
export function criarTV() {
  const g = new THREE.Group();
  g.name = 'tv';

  const L = PAINEL.largura + 0.055;
  const A = PAINEL.altura + 0.055;

  // suporte de parede, atras do painel
  g.add(peca(caixa(0.30, 0.30, 0.045, 0.008), matGrafite(), 0, PAINEL.y, 0.006));

  // corpo, com a traseira em cunha e moldura fina na frente
  g.add(peca(caixa(L - 0.05, A - 0.05, 0.026, 0.010), matPreto(), 0, PAINEL.y, 0.020));
  const bw = 0.011;
  [[0, A / 2 - bw / 2, L, bw], [0, -A / 2 + bw / 2, L, bw],
   [-L / 2 + bw / 2, 0, bw, A], [L / 2 - bw / 2, 0, bw, A]].forEach(([bx, by, bl, ba]) => {
    g.add(peca(caixa(bl, ba, 0.018, 0.004, 3), matPreto(), bx, PAINEL.y + by, 0.032));
  });

  const tela = new THREE.Mesh(
    new THREE.PlaneGeometry(PAINEL.largura, PAINEL.altura),
    new THREE.MeshBasicMaterial({ color: 0x0b0d14, toneMapped: false })
  );
  tela.position.set(PAINEL.x, PAINEL.y, PAINEL.z);
  tela.name = 'telaTV';
  g.add(tela);

  // a tela e a fonte de luz do ambiente: sem isso a parede fica morta
  const luz = new THREE.RectAreaLight(0x9fb6ff, 3.4, PAINEL.largura, PAINEL.altura);
  luz.position.set(0, PAINEL.y, PAINEL.z + 0.05);
  g.add(luz);

  return { grupo: g, tela };
}

/** Faixa de identificacao acima da TV, como numa ativacao de evento. */
function criarCoroa() {
  const g = new THREE.Group();
  g.name = 'coroa';
  g.add(peca(caixa(1.30, 0.10, 0.05, 0.012), matBranco(), 0, 2.52, 0.03));
  const barra = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.014, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x1a1420, emissive: 0x38b6ff, emissiveIntensity: 1.6, roughness: 0.5 })
  );
  barra.position.set(0, 2.455, 0.052);
  g.add(barra);
  return g;
}

/** Monta o ambiente e devolve o que a cena precisa. */
export function criarAmbiente() {
  const raiz = new THREE.Group();
  raiz.name = 'ambienteWsl';

  raiz.add(criarParede());
  const { grupo: tv, tela } = criarTV();
  raiz.add(tv);
  raiz.add(criarCoroa());

  // caixa de som de cada lado: preenche a parede sem competir com a TV
  [-1, 1].forEach((lado) => {
    raiz.add(peca(caixa(0.16, 0.62, 0.14, 0.014), matBrancoFosco(), lado * 1.02, 1.30, 0.075));
  });

  return { raiz, tela };
}
