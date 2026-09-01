import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { texturaMousepad } from './textures.js';
import {
  PALETA, matBranco, matBrancoFosco, matRosa, matRosaEscuro,
  matGrafite, matPreto, matMidnight, matTecido, matVidro
} from './materials.js';

/**
 * A estacao de trabalho. Tudo construido com primitivas: nenhum asset externo,
 * nenhuma licenca de terceiro, e o peso do bundle nao muda.
 *
 * Convencao de eixos: o monitor olha para +Z, a cadeira fica em +Z, e a camera
 * chega por tras do personagem. A superficie da mesa esta em y = ALTURA_MESA.
 */

export const ALTURA_MESA = 0.75;

const caixa = (l, a, p, raio = 0.012, seg = 3) => new RoundedBoxGeometry(l, a, p, seg, raio);

function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ---------------------------------------------------------------- MESA ---- */
export function criarMesa() {
  const g = new THREE.Group();
  g.name = 'mesa';

  const tampo = peca(caixa(2.40, 0.05, 0.95, 0.014), matBranco(), 0, ALTURA_MESA - 0.025, 0);
  g.add(tampo);

  // pes em painel, nao em tubo: mesa de escritorio branca costuma ser assim,
  // e o painel esconde melhor o vazio embaixo quando a camera desce
  const painel = caixa(0.05, ALTURA_MESA - 0.05, 0.80, 0.01);
  g.add(peca(painel, matBrancoFosco(), -1.12, (ALTURA_MESA - 0.05) / 2, 0));
  g.add(peca(painel, matBrancoFosco(), 1.12, (ALTURA_MESA - 0.05) / 2, 0));

  // travessa traseira, para a mesa nao parecer flutuando
  g.add(peca(caixa(2.20, 0.06, 0.03, 0.008), matBrancoFosco(), 0, ALTURA_MESA - 0.22, -0.36));

  return g;
}

/* -------------------------------------------------------------- CADEIRA ---- */
/**
 * Cadeira ergonomica. A diferenca para a versao anterior nao esta no numero de
 * pecas, e na FORMA: o encosto deixou de ser uma placa inclinada e passou a ser
 * uma pilha de almofadas seguindo uma curva com apoio lombar. Cada almofada
 * acompanha a inclinacao da curva naquele ponto, entao aparecem os vincos do
 * estofado e a silhueta em S de uma cadeira de verdade.
 */
export function criarCadeira() {
  const g = new THREE.Group();
  g.name = 'cadeira';

  const alturaAssento = 0.46;

  /* ---- base estrela com rodizios ---- */
  const base = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const braco = peca(caixa(0.32, 0.038, 0.07, 0.016, 4), matPreto(), 0, 0.055, 0);
    braco.position.set(Math.cos(a) * 0.16, 0.055, Math.sin(a) * 0.16);
    braco.rotation.y = -a;
    braco.rotation.z = 0.05;
    base.add(braco);

    const garfo = peca(caixa(0.03, 0.05, 0.03, 0.008), matGrafite(),
      Math.cos(a) * 0.30, 0.055, Math.sin(a) * 0.30);
    base.add(garfo);
    const roda = peca(new THREE.CylinderGeometry(0.036, 0.036, 0.024, 16), matGrafite(),
      Math.cos(a) * 0.30, 0.036, Math.sin(a) * 0.30);
    roda.rotation.z = Math.PI / 2;
    roda.rotation.y = -a;
    base.add(roda);
  }
  g.add(base);

  /* ---- coluna a gas, com capa telescopica ---- */
  g.add(peca(new THREE.CylinderGeometry(0.030, 0.030, alturaAssento - 0.12, 16), matGrafite(),
    0, (alturaAssento - 0.12) / 2 + 0.07, 0));
  g.add(peca(new THREE.CylinderGeometry(0.046, 0.052, 0.16, 16), matPreto(), 0, 0.18, 0));
  // mecanismo sob o assento
  g.add(peca(caixa(0.16, 0.05, 0.22, 0.014, 4), matPreto(), 0, alturaAssento - 0.055, 0.01));

  /* ---- assento: fatias de Z com a frente caindo (borda cascata) ---- */
  const NA = 6;
  for (let i = 0; i < NA; i++) {
    const t = i / (NA - 1);                  // 0 = frente, 1 = fundo
    const z = -0.22 + t * 0.44;
    const queda = Math.pow(1 - t, 3) * 0.055;   // so a frente desce
    const larg = 0.50 - Math.pow(1 - t, 2) * 0.05;
    const fatia = peca(caixa(larg, 0.085, 0.078, 0.030, 5), matRosa(),
      0, alturaAssento - queda, z);
    fatia.rotation.x = -Math.pow(1 - t, 2) * 0.55;
    g.add(fatia);
  }
  // bordas brancas do assento
  [-1, 1].forEach((lado) => {
    for (let i = 1; i < NA; i++) {
      const t = i / (NA - 1);
      const z = -0.22 + t * 0.44;
      const y = alturaAssento + 0.028 - Math.pow(1 - t, 3) * 0.05;
      const b = peca(caixa(0.075, 0.075, 0.082, 0.032, 5), matRosa(), lado * 0.235, y, z);
      b.rotation.z = lado * 0.30;
      g.add(b);
      const vv = peca(caixa(0.014, 0.070, 0.078, 0.006, 4), matBranco(), lado * 0.268, y - 0.012, z);
      vv.rotation.z = lado * 0.30;
      g.add(vv);
    }
  });

  /* ---- encosto: almofadas ao longo de uma curva com lombar ---- */
  const NE = 8;
  const perfilZ = (t) => 0.245 + t * 0.155 - Math.sin(t * Math.PI) * 0.075;
  const perfilY = (t) => alturaAssento + 0.045 + t * 0.60;
  for (let i = 0; i < NE; i++) {
    const t = i / (NE - 1);
    // inclinacao vem da propria curva: cada almofada acompanha a tangente
    const dz = (perfilZ(Math.min(1, t + 0.02)) - perfilZ(Math.max(0, t - 0.02)));
    const dy = (perfilY(Math.min(1, t + 0.02)) - perfilY(Math.max(0, t - 0.02)));
    const ang = Math.atan2(dz, dy);

    const larg = 0.44 - Math.pow(Math.max(0, t - 0.55) / 0.45, 2) * 0.09;
    const alm = peca(caixa(larg, 0.104, 0.11, 0.038, 6), matRosa(), 0, perfilY(t), perfilZ(t));
    alm.rotation.x = -ang;
    g.add(alm);

    // asas laterais, mais salientes na altura do tronco
    const saliencia = Math.sin(Math.min(1, t / 0.8) * Math.PI) * 0.055;
    if (t < 0.9) {
      [-1, 1].forEach((lado) => {
        const asa = peca(caixa(0.070, 0.102, 0.115 + saliencia, 0.036, 6), matRosa(),
          lado * (larg / 2 + 0.012), perfilY(t), perfilZ(t) - saliencia * 0.45);
        asa.rotation.x = -ang;
        asa.rotation.z = lado * 0.16;
        g.add(asa);
        // vivo branco: o contraste fica na quina, nao no volume inteiro
        const vivo = peca(caixa(0.016, 0.098, 0.10 + saliencia, 0.007, 4), matBranco(),
          lado * (larg / 2 + 0.046), perfilY(t), perfilZ(t) - saliencia * 0.45);
        vivo.rotation.x = -ang;
        vivo.rotation.z = lado * 0.16;
        g.add(vivo);
      });
    }
  }

  // haste e apoio de cabeca
  const topoY = perfilY(1), topoZ = perfilZ(1);
  g.add(peca(caixa(0.05, 0.09, 0.05, 0.014), matPreto(), 0, topoY + 0.055, topoZ + 0.01));
  const cabeceira = peca(caixa(0.26, 0.115, 0.10, 0.045, 5), matBranco(), 0, topoY + 0.135, topoZ - 0.005);
  cabeceira.rotation.x = -0.22;
  g.add(cabeceira);

  /* ---- apoios de braco 4D ---- */
  [-1, 1].forEach((lado) => {
    const x = lado * 0.285;
    g.add(peca(caixa(0.05, 0.19, 0.05, 0.016), matPreto(), x, alturaAssento + 0.10, 0.10));
    g.add(peca(caixa(0.075, 0.028, 0.055, 0.012), matGrafite(), x, alturaAssento + 0.205, 0.10));
    const apoio = peca(caixa(0.085, 0.038, 0.26, 0.018, 4), matPreto(), x, alturaAssento + 0.232, 0.03);
    apoio.rotation.x = -0.04;
    g.add(apoio);
  });

  return g;
}

/* ------------------------------------------------- MONITOR + BRACO BRANCO ---- */
/**
 * Devolve { grupo, tela } — `tela` e o mesh cuja textura recebe as screenshots
 * reais do GateCheck, e tambem o alvo do zoom da camera.
 */
export function criarMonitor() {
  const g = new THREE.Group();
  g.name = 'monitor';

  const zClamp = -0.44;

  // garra na borda traseira da mesa
  g.add(peca(caixa(0.10, 0.10, 0.09, 0.012), matBranco(), 0, ALTURA_MESA + 0.01, zClamp));
  // poste vertical
  g.add(peca(new THREE.CylinderGeometry(0.021, 0.021, 0.46, 14), matBranco(), 0, ALTURA_MESA + 0.27, zClamp));

  // braco horizontal em dois segmentos, como braco articulado de verdade
  const b1 = peca(caixa(0.30, 0.05, 0.05, 0.02), matBranco(), 0.12, ALTURA_MESA + 0.48, zClamp + 0.02);
  b1.rotation.z = -0.06;
  g.add(b1);
  const b2 = peca(caixa(0.26, 0.045, 0.045, 0.018), matBranco(), 0.24, ALTURA_MESA + 0.46, zClamp + 0.18);
  b2.rotation.y = 1.02;
  g.add(b2);
  // junta
  g.add(peca(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 14), matBranco(), 0.27, ALTURA_MESA + 0.47, zClamp + 0.03));

  // corpo do monitor
  const cabeca = new THREE.Group();
  cabeca.position.set(0, ALTURA_MESA + 0.46, zClamp + 0.32);
  cabeca.rotation.x = 0.045;

  /* Painel na proporcao do conteudo. As quatro screenshots do GateCheck vao de
     1,959 a 2,146 — sao todas ultrawide. Com o painel em 16:9 sobrava faixa
     preta em cima e embaixo; em 2,05 o encaixe fica dentro de 5% e as faixas
     somem. Monitor ultrawide tambem casa melhor com estacao de dev. */
  const L = 1.24, A = 0.605;
  /* Moldura fina: a caixa unica de 4,5 cm dava um monitor grosso, com cara de
     televisao antiga. Agora sao a traseira em cunha e uma borda de 8 mm. */
  const tras = peca(caixa(L - 0.06, A - 0.06, 0.022, 0.012, 4), matPreto(), 0, 0, -0.021);
  cabeca.add(tras);
  const moldura = new THREE.Mesh(
    new THREE.RingGeometry(0, 1, 4, 1),
    new THREE.MeshStandardMaterial({ color: 0x0d0f15, roughness: 0.5 })
  );
  moldura.visible = false;
  // borda: quatro reguas finas em volta da tela
  const bw = 0.009;
  [[0, A / 2 - bw / 2, L, bw], [0, -A / 2 + bw / 2, L, bw],
   [-L / 2 + bw / 2, 0, bw, A], [L / 2 - bw / 2, 0, bw, A]].forEach(([bx, by, bl, ba]) => {
    cabeca.add(peca(caixa(bl, ba, 0.016, 0.004, 3), matPreto(), bx, by, -0.004));
  });
  // haste de tras ligando ao braco
  cabeca.add(peca(caixa(0.13, 0.13, 0.05, 0.016), matPreto(), 0, 0, -0.045));

  const tela = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.022, A - 0.022),
    new THREE.MeshBasicMaterial({ color: 0x0b0d14, toneMapped: false })
  );
  tela.position.z = 0.014;
  tela.name = 'telaMonitor';
  cabeca.add(tela);

  // brilho suave saindo da tela, para a cena ter uma fonte de luz coerente
  const luz = new THREE.RectAreaLight(0x9fb6ff, 2.6, L, A);
  luz.position.set(0, 0, 0.08);
  cabeca.add(luz);

  g.add(cabeca);
  return { grupo: g, tela, cabeca };
}

/* ------------------------------------------------ GABINETE AQUARIO BRANCO ---- */
export function criarGabinete() {
  const g = new THREE.Group();
  g.name = 'gabinete';

  const L = 0.32, A = 0.47, P = 0.43;
  const y = ALTURA_MESA + A / 2;

  // estrutura: so as quinas, para o vidro dominar
  const perfil = 0.020;
  const quina = caixa(perfil, A, perfil, 0.004);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(peca(quina, matBranco(), sx * (L / 2 - perfil / 2), y, sz * (P / 2 - perfil / 2)));
  });
  // topo e base solidos
  g.add(peca(caixa(L, 0.018, P, 0.005), matBranco(), 0, y + A / 2, 0));
  g.add(peca(caixa(L, 0.018, P, 0.005), matBranco(), 0, y - A / 2, 0));

  // painel de vidro frontal e lateral
  // frente e lateral em vidro; o resto fechado, como um aquario de verdade
  const vidroF = new THREE.Mesh(new THREE.PlaneGeometry(L - perfil, A - 0.024), matVidro());
  vidroF.position.set(0, y, P / 2 + 0.001);
  g.add(vidroF);
  const vidroL = new THREE.Mesh(new THREE.PlaneGeometry(P - perfil, A - 0.024), matVidro());
  vidroL.position.set(-L / 2 - 0.001, y, 0);
  vidroL.rotation.y = Math.PI / 2;
  g.add(vidroL);
  // painel traseiro e a lateral oposta, fechados em branco
  const tampaD = peca(caixa(0.012, A, P, 0.004), matBranco(), L / 2, y, 0);
  g.add(tampaD);
  const tampaT = peca(caixa(L, A, 0.012, 0.004), matBranco(), 0, y, -P / 2);
  g.add(tampaT);

  // INTERIOR — antes era so uma placa e o gabinete lia como caixa vazia.
  // Um aquario so funciona se tiver o que olhar dentro dele.
  const dentro = new THREE.Group();

  // placa-mae encostada na parede oposta ao vidro
  dentro.add(peca(caixa(0.010, 0.27, 0.25, 0.004), matPreto(), 0.115, y + 0.02, -0.015));

  // torre do cooler + memorias
  // torre do cooler com o topo claro: peca escura sobre placa escura sumia
  dentro.add(peca(caixa(0.095, 0.135, 0.11, 0.008), matGrafite(), 0.055, y + 0.115, -0.03));
  dentro.add(peca(caixa(0.10, 0.012, 0.115, 0.004), matGrafite(), 0.055, y + 0.188, -0.03));
  for (let i = 0; i < 4; i++) {
    dentro.add(peca(caixa(0.006, 0.088, 0.016, 0.002), matBrancoFosco(), 0.100, y + 0.10, 0.045 + i * 0.021));
  }

  // placa de video: e a peca que ocupa o meio e mata a sensacao de vazio
  dentro.add(peca(caixa(0.095, 0.040, 0.225, 0.008), matPreto(), 0.058, y - 0.035, 0.005));
  dentro.add(peca(caixa(0.092, 0.014, 0.225, 0.004), matGrafite(), 0.058, y - 0.060, 0.005));

  // tampa da fonte, embaixo
  dentro.add(peca(caixa(0.155, 0.070, 0.29, 0.008), matGrafite(), 0.035, y - 0.155, 0));

  // cabos: dois vultos escuros saindo da placa, so para quebrar a geometria limpa
  dentro.add(peca(caixa(0.012, 0.10, 0.012, 0.005), matPreto(), 0.100, y - 0.09, -0.10));
  dentro.add(peca(caixa(0.012, 0.07, 0.012, 0.005), matPreto(), 0.100, y + 0.05, -0.10));

  g.add(dentro);

  // ventoinhas: duas na frente e uma sobre a GPU, todas com anel aceso
  const fans = new THREE.Group();
  fans.name = 'ventoinhas';
  const aro = new THREE.TorusGeometry(0.042, 0.007, 8, 22);
  const pa = new THREE.BoxGeometry(0.070, 0.0035, 0.006);
  const luzRosa = new THREE.MeshBasicMaterial({ color: PALETA.rosa, toneMapped: false });

  [[-0.055, y + 0.115, P / 2 - 0.045, 0],
   [-0.055, y - 0.020, P / 2 - 0.045, 0],
   [0.045, y - 0.085, 0.055, Math.PI / 2]].forEach(([fx, fy, fz, rx]) => {
    const u = new THREE.Group();
    u.position.set(fx, fy, fz);
    u.rotation.x = rx;
    u.add(new THREE.Mesh(aro, luzRosa));
    // 7 pas finas: com 3 barras grossas a ventoinha virava um X
    for (let k = 0; k < 7; k++) {
      const p2 = new THREE.Mesh(pa, matGrafite());
      p2.rotation.z = (k / 7) * Math.PI * 2;
      u.add(p2);
    }
    u.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12), matPreto()));
    fans.add(u);
  });
  g.add(fans);

  // fita de LED no teto do gabinete
  const fita = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.006, 0.012), luzRosa);
  fita.position.set(0, y + A / 2 - 0.018, P / 2 - 0.05);
  g.add(fita);

  /* Luz DENTRO da caixa. Sem ela o vidro mostrava so preto e o gabinete lia como
     uma caixa branca com dois aneis acesos — nada do interior aparecia, que e o
     ponto inteiro de um aquario. Duas fontes: o rosa das ventoinhas e um
     preenchimento frio fraco para as pecas terem volume. */
  const brilhoRosa = new THREE.PointLight(PALETA.rosa, 1.1, 0.55, 2);
  brilhoRosa.position.set(-0.04, y + 0.02, P / 2 - 0.08);
  g.add(brilhoRosa);
  const preenche = new THREE.PointLight(0xe6eeff, 1.9, 1.0, 2);
  preenche.position.set(0.02, y + A / 2 - 0.07, 0.02);
  g.add(preenche);

  g.userData.fans = fans;
  return g;
}

/* --------------------------------------------------- MACBOOK MIDNIGHT ---- */
export function criarMacbook() {
  const g = new THREE.Group();
  g.name = 'macbook';

  const L = 0.34, P = 0.235;
  g.add(peca(caixa(L, 0.014, P, 0.006), matMidnight(), 0, ALTURA_MESA + 0.007, 0));
  // pes de borracha, para nao parecer colado no tampo
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(peca(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 10), matPreto(),
      sx * (L / 2 - 0.03), ALTURA_MESA + 0.0015, sz * (P / 2 - 0.03)));
  });

  // teclado e trackpad apenas sugeridos: a esta distancia, detalhe vira ruido
  const tec = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.05, P - 0.10),
    new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.9 }));
  tec.rotation.x = -Math.PI / 2;
  tec.position.set(0, ALTURA_MESA + 0.0125, -0.03);
  g.add(tec);

  const tampa = new THREE.Group();
  tampa.position.set(0, ALTURA_MESA + 0.014, -P / 2);
  /* +0,28 abre a tampa; o -1,83 anterior girava 105 graus para a FRENTE e
     deitava a tela em cima da mesa — por isso lia como uma placa escura. */
  tampa.rotation.x = 0.28;
  tampa.add(peca(caixa(L, P, 0.008, 0.005), matMidnight(), 0, P / 2, 0));
  const telaMac = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.020, P - 0.024),
    new THREE.MeshBasicMaterial({ color: 0x223458, toneMapped: false })
  );
  telaMac.position.set(0, P / 2, 0.0055);
  tampa.add(telaMac);
  // barra de menu, so para a tela nao ser um retangulo chapado
  const barra = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.020, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x3a4e7a, toneMapped: false })
  );
  barra.position.set(0, P - 0.024, 0.006);
  tampa.add(barra);
  g.add(tampa);

  return g;
}

/* ------------------------------------------------- MOUSEPAD + MOUSE ---- */
export function criarMousepadEMouse() {
  const g = new THREE.Group();
  g.name = 'mousepad';

  // mousepad quadrado rosa
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.60),
    new THREE.MeshStandardMaterial({ map: texturaMousepad(), roughness: 0.96, metalness: 0 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0.09, ALTURA_MESA + 0.002, 0.05);
  pad.receiveShadow = true;
  g.add(pad);
  // costura da borda
  const borda = new THREE.Mesh(new THREE.RingGeometry(0.413, 0.423, 4),
    new THREE.MeshBasicMaterial({ color: PALETA.rosaEscuro }));
  borda.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  borda.position.set(0.09, ALTURA_MESA + 0.003, 0.05);
  g.add(borda);

  // MOUSE — antes era uma esfera achatada e nao lia como mouse.
  // Agora: cupula com base plana, afinando para a frente, com a divisao dos
  // dois botoes e a rodinha. Sem cabo, porque e sem fio.
  const mouse = new THREE.Group();
  mouse.name = 'mouse';

  const cupula = new THREE.SphereGeometry(1, 30, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  {
    // afina a frente: um elipsoide puro fica com cara de seixo. O fator vem do
    // Z normalizado, entao a traseira fica larga e a frente estreita.
    const pos = cupula.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);                 // -1 (frente) .. 1 (tras)
      const t = z * 0.5 + 0.5;              // 0 na frente, 1 atras
      pos.setX(i, pos.getX(i) * (0.70 + t * 0.30));
      /* Modulacao suave. Com 0,52+0,48t os aneis proximos ao polo, do lado de
         tras, ficavam mais altos que o proprio polo — e aquilo virava um bico
         apontando para cima na traseira. */
      pos.setY(i, pos.getY(i) * (0.88 + t * 0.12));
    }
    pos.needsUpdate = true;
    cupula.computeVertexNormals();
  }
  const corpo = new THREE.Mesh(cupula, matRosa());
  corpo.scale.set(0.033, 0.046, 0.057);
  corpo.position.y = ALTURA_MESA + 0.0015;
  corpo.castShadow = true;
  mouse.add(corpo);

  // base fechando a cupula por baixo
  const base = new THREE.Mesh(new THREE.CircleGeometry(1, 30), matRosaEscuro());
  base.geometry.scale(0.030, 0.054, 1);
  base.rotation.x = Math.PI / 2;
  base.position.y = ALTURA_MESA + 0.0016;
  mouse.add(base);

  // divisao dos dois botoes: um sulco escuro da frente ate o meio
  const sulco = new THREE.Mesh(
    new THREE.BoxGeometry(0.0024, 0.016, 0.042),
    new THREE.MeshStandardMaterial({ color: PALETA.rosaEscuro, roughness: 0.7 })
  );
  sulco.position.set(0, ALTURA_MESA + 0.030, -0.018);
  mouse.add(sulco);

  // rodinha entre os botoes
  const roda = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0062, 0.0062, 0.0042, 14),
    new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.55 })
  );
  roda.rotation.z = Math.PI / 2;
  roda.position.set(0, ALTURA_MESA + 0.0345, -0.006);
  mouse.add(roda);

  g.add(mouse);
  g.userData.mouse = mouse;

  return g;
}

/* ------------------------------------------------------- TECLADO ---- */
/** Espessura do teclado. Exportada porque a altura do personagem e ajustada
 *  para as pontas dos dedos cairem exatamente nesta superficie — o numero nao
 *  pode viver em dois arquivos. */
export const ESPESSURA_TECLADO = 0.034;
export const TOPO_MOUSE = ALTURA_MESA + 0.0015 + 0.046;
export const SUPERFICIE_TECLAS = ALTURA_MESA + ESPESSURA_TECLADO + 0.002;
/** Topo das teclas: e nele que a ponta do dedo tem que parar, nao no fundo. */
export const TOPO_TECLAS = SUPERFICIE_TECLAS + 0.0025 + 0.0045;

export function criarTeclado() {
  const g = new THREE.Group();
  g.name = 'teclado';
  // mais fundo e mais alto: o formato anterior era uma regua fina
  g.add(peca(caixa(0.44, ESPESSURA_TECLADO, 0.21, 0.010, 5), matRosa(),
    0, ALTURA_MESA + ESPESSURA_TECLADO / 2, 0));
  // fundo escuro entre as teclas
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.175),
    new THREE.MeshStandardMaterial({ color: 0x8c2a58, roughness: 0.9 }));
  fundo.rotation.x = -Math.PI / 2;
  fundo.position.set(0, SUPERFICIE_TECLAS - 0.004, 0);
  g.add(fundo);

  // teclas de verdade: uma placa lisa nao le como teclado a essa distancia.
  // InstancedMesh porque sao 70 pecas iguais e nao vale 70 draw calls.
  const COLS = 14, LINHAS = 5, PX = 0.0278, PZ = 0.0335;
  const tecla = new THREE.Mesh(
    caixa(0.0235, 0.009, 0.0255, 0.004, 3),
    new THREE.MeshStandardMaterial({ color: 0xf6dbe6, roughness: 0.62 })
  );
  const teclas = new THREE.InstancedMesh(tecla.geometry, tecla.material, COLS * LINHAS);
  teclas.castShadow = true;
  const _m = new THREE.Matrix4();
  let n = 0;
  for (let l = 0; l < LINHAS; l++) {
    for (let c = 0; c < COLS; c++) {
      // a barra de espaco ocupa o meio da ultima linha: sem ela nao le como teclado
      const barra = l === LINHAS - 1 && c > 3 && c < 10;
      if (barra && c !== 4) continue;
      const larg = barra ? 6 : 1;
      _m.makeScale(larg, 1, 1);
      _m.setPosition(
        (c - (COLS - 1) / 2 + (barra ? 2.5 : 0)) * PX,
        SUPERFICIE_TECLAS + 0.0025,
        (l - (LINHAS - 1) / 2) * PZ
      );
      teclas.setMatrixAt(n++, _m);
    }
  }
  teclas.count = n;
  teclas.instanceMatrix.needsUpdate = true;
  g.add(teclas);
  return g;
}

/** Monta a estacao inteira e devolve as referencias que a cena precisa animar. */
export function criarEstacao() {
  const raiz = new THREE.Group();
  raiz.name = 'estacao';

  raiz.add(criarMesa());

  const cadeira = criarCadeira();
  // o encosto ja fica em +Z no espaco local, entao sem rotacao a cadeira
  // olha para -Z, que e onde esta o monitor
  cadeira.position.set(0.02, 0, 0.72);
  raiz.add(cadeira);

  const { grupo: monitor, tela, cabeca } = criarMonitor();
  raiz.add(monitor);

  const gabinete = criarGabinete();
  gabinete.position.set(-0.86, 0, -0.14);
  gabinete.rotation.y = 0.34;
  raiz.add(gabinete);

  const macbook = criarMacbook();
  macbook.position.set(0.80, 0, 0.06);
  macbook.rotation.y = -0.62;
  raiz.add(macbook);

  const teclado = criarTeclado();
  teclado.position.set(-0.06, 0, 0.24);
  raiz.add(teclado);

  const pad = criarMousepadEMouse();
  pad.position.set(0.40, 0, 0.24);
  raiz.add(pad);

  return {
    raiz, cadeira, monitor, tela, cabecaMonitor: cabeca,
    mouse: pad.userData.mouse, gabinete, macbook,
    grupoPad: pad, grupoTeclado: teclado,
    /** o teclado nasce com 0,44; a distancia entre as maos do modelo manda */
    definirLarguraTeclado(l) { teclado.scale.x = Math.max(0.8, l / 0.44); }
  };
}
