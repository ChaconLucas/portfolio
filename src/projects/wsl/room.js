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

  /* Chao de evento reflete. Rugosidade baixa com um pouco de metalness faz o
     ambiente e a luz da TV aparecerem no piso — sem custo de um segundo passe
     de render, que e o que um espelho de verdade exigiria. */
  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshStandardMaterial({ color: 0x0f1117, roughness: 0.26, metalness: 0.42 })
  );
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  g.add(chao);

  // poca de luz sob a TV: amarra o painel ao chao
  const poca = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.2),
    new THREE.MeshBasicMaterial({
      color: 0xaebbd6, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  poca.rotation.x = -Math.PI / 2;
  poca.position.set(0, 0.004, 0.95);
  g.add(poca);

  return g;
}

/**
 * Profundidade atras do plano geral.
 *
 * Sem nada alem da parede, a cena inteira acontece num plano so e le como
 * maquete. Aqui entram volumes escuros e sem detalhe: eles nunca sao o assunto,
 * so dizem que existe um evento em volta. A camera termina dentro da tela,
 * entao isso aparece apenas nos primeiros 40% do capitulo — encher de objeto
 * reconhecivel seria trabalho jogado fora e concorrencia com o painel.
 */
function criarFundo() {
  const g = new THREE.Group();
  g.name = 'fundoWsl';

  const vulto = new THREE.MeshStandardMaterial({ color: 0x0d0f16, roughness: 0.9 });
  const estrutura = new THREE.MeshStandardMaterial({ color: 0x171a23, roughness: 0.6, metalness: 0.4 });

  /* Nas LATERAIS, nao atras. A camera parte de z=6,10 olhando para a parede em
     z=0 — entao o que eu tinha posto em z=5,4 a 8,4 ficava atras dela ou colado
     na lente. O evento em volta so aparece pelas bordas do quadro. */
  [[-4.3, 2.6, 1.15], [4.6, 3.4, -1.05], [-5.4, 4.6, 1.35], [5.2, 1.4, -1.2]].forEach(([x, z, rot]) => {
    const t = new THREE.Group();
    t.add(peca(caixa(0.75, 1.95, 0.14, 0.02), vulto, 0, 1.35, 0));
    t.add(peca(caixa(0.9, 0.06, 0.5, 0.01), vulto, 0, 0.03, 0));
    t.position.set(x, 0, z);
    t.rotation.y = rot;
    g.add(t);
  });

  // trelica no alto, atravessando o quadro: entra pelo topo, como num evento
  [1.9, 3.6].forEach((z) => {
    g.add(peca(caixa(15, 0.10, 0.10, 0.02), estrutura, 0, 3.62, z));
    g.add(peca(caixa(15, 0.10, 0.10, 0.02), estrutura, 0, 3.20, z));
    for (let i = -4; i <= 4; i++) {
      g.add(peca(caixa(0.06, 0.44, 0.06, 0.01), estrutura, i * 1.7, 3.41, z));
    }
  });
  // colunas de sustentacao, nas pontas
  [-6.4, 6.4].forEach((x) => {
    g.add(peca(caixa(0.16, 3.6, 0.16, 0.02), estrutura, x, 1.8, 2.7));
  });

  // balcao lateral, dentro do quadro
  g.add(peca(caixa(2.2, 1.05, 0.70, 0.03), vulto, -4.9, 0.52, 1.2));
  g.add(peca(caixa(2.2, 0.05, 0.78, 0.01), estrutura, -4.9, 1.07, 1.2));

  return g;
}

/**
 * Iluminacao de teto, sem cone visivel.
 *
 * A versao anterior tinha tres cones aditivos em azul, ciano e roxo. Funcionava
 * como efeito, mas dava leitura de balada — e o capitulo e uma ativacao de
 * marca, nao uma festa. Aqui ficam so os corpos dos refletores na treliça e uma
 * luz branca fraca vinda deles: o ambiente ganha origem para a luz sem nenhum
 * facho colorido no ar.
 */
function criarFocos() {
  const g = new THREE.Group();
  g.name = 'focos';

  const corpo = new THREE.MeshStandardMaterial({ color: 0x0d0f16, roughness: 0.7, metalness: 0.3 });

  [[-2.9, 2.2], [2.7, 3.0], [0.3, 4.1], [-1.4, 3.6], [1.5, 2.0]].forEach(([x, z]) => {
    g.add(peca(caixa(0.18, 0.22, 0.18, 0.03), corpo, x, 3.72, z));
    g.add(peca(caixa(0.05, 0.16, 0.05, 0.01), corpo, x, 3.88, z));
  });

  // duas fontes brancas fracas, so para o teto nao ser uma fonte invisivel
  [[-2.2, 2.6], [2.2, 3.2]].forEach(([x, z]) => {
    const luz = new THREE.PointLight(0xf2f4ff, 0.30, 7, 2);
    luz.position.set(x, 3.5, z);
    g.add(luz);
  });

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

  raiz.add(criarFundo());
  raiz.add(criarFocos());
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
