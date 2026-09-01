import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
export function criarCadeira() {
  const g = new THREE.Group();
  g.name = 'cadeira';

  const alturaAssento = 0.46;

  // base estrela de 5 pontas com rodizios
  const base = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const braco = peca(caixa(0.30, 0.035, 0.06, 0.014), matPreto(), 0, 0.05, 0);
    braco.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15);
    braco.rotation.y = -a;
    base.add(braco);

    const roda = peca(new THREE.CylinderGeometry(0.035, 0.035, 0.022, 14), matGrafite(),
      Math.cos(a) * 0.29, 0.035, Math.sin(a) * 0.29);
    roda.rotation.z = Math.PI / 2;
    base.add(roda);
  }
  g.add(base);

  // coluna a gas
  g.add(peca(new THREE.CylinderGeometry(0.035, 0.045, alturaAssento - 0.10, 16), matGrafite(), 0, (alturaAssento - 0.10) / 2 + 0.06, 0));

  // assento rosa com as bordas brancas (perfil gamer, rosa + branco)
  // raios grandes e mais segmentos: estofado le como estofado, nao como caixa
  const assento = peca(caixa(0.52, 0.11, 0.50, 0.055, 7), matRosa(), 0, alturaAssento, 0);
  g.add(assento);
  g.add(peca(caixa(0.11, 0.10, 0.46, 0.048, 7), matBranco(), -0.215, alturaAssento + 0.04, 0.01));
  g.add(peca(caixa(0.11, 0.10, 0.46, 0.048, 7), matBranco(), 0.215, alturaAssento + 0.04, 0.01));

  // encosto inclinado, com as "asas" laterais da cadeira gamer
  const encosto = new THREE.Group();
  encosto.position.set(0, alturaAssento + 0.05, 0.22);
  encosto.rotation.x = -0.20;
  // encosto mais baixo de proposito: com 0,72 de altura ele cobria a cabeca e os
  // ombros do personagem visto de tras, e a cena perdia quem estava trabalhando
  encosto.add(peca(caixa(0.48, 0.52, 0.11, 0.055, 7), matRosa(), 0, 0.24, 0));
  encosto.add(peca(caixa(0.09, 0.44, 0.14, 0.05, 7), matBranco(), -0.205, 0.22, -0.02));
  encosto.add(peca(caixa(0.09, 0.44, 0.14, 0.05, 7), matBranco(), 0.205, 0.22, -0.02));
  // apoio de cabeca, agora atras da nuca e nao na frente dela
  encosto.add(peca(caixa(0.26, 0.12, 0.11, 0.05, 7), matBranco(), 0, 0.56, -0.01));
  g.add(encosto);

  // apoios de braco
  [-0.32, 0.32].forEach((x) => {
    g.add(peca(caixa(0.07, 0.20, 0.07, 0.02), matPreto(), x, alturaAssento + 0.14, 0.10));
    g.add(peca(caixa(0.09, 0.05, 0.28, 0.024, 6), matPreto(), x, alturaAssento + 0.25, 0.02));
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

  const L = 1.24, A = 0.72;
  cabeca.add(peca(caixa(L, A, 0.045, 0.016), matPreto(), 0, 0, -0.012));
  // haste de tras ligando ao braco
  cabeca.add(peca(caixa(0.16, 0.16, 0.06, 0.02), matPreto(), 0, 0, -0.05));

  const tela = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.055, A - 0.055),
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

  const L = 0.30, A = 0.42, P = 0.34;
  const y = ALTURA_MESA + A / 2;

  // estrutura: so as quinas, para o vidro dominar
  const perfil = 0.016;
  const quina = caixa(perfil, A, perfil, 0.004);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    g.add(peca(quina, matBranco(), sx * (L / 2 - perfil / 2), y, sz * (P / 2 - perfil / 2)));
  });
  // topo e base solidos
  g.add(peca(caixa(L, 0.018, P, 0.005), matBranco(), 0, y + A / 2, 0));
  g.add(peca(caixa(L, 0.018, P, 0.005), matBranco(), 0, y - A / 2, 0));

  // painel de vidro frontal e lateral
  const vidroF = new THREE.Mesh(new THREE.PlaneGeometry(L - perfil, A - 0.02), matVidro());
  vidroF.position.set(0, y, P / 2);
  g.add(vidroF);
  const vidroL = new THREE.Mesh(new THREE.PlaneGeometry(P - perfil, A - 0.02), matVidro());
  vidroL.position.set(-L / 2, y, 0);
  vidroL.rotation.y = Math.PI / 2;
  g.add(vidroL);

  // INTERIOR — antes era so uma placa e o gabinete lia como caixa vazia.
  // Um aquario so funciona se tiver o que olhar dentro dele.
  const dentro = new THREE.Group();

  // placa-mae encostada na parede oposta ao vidro
  dentro.add(peca(caixa(0.010, 0.27, 0.25, 0.004), matPreto(), 0.115, y + 0.02, -0.015));

  // torre do cooler + memorias
  dentro.add(peca(caixa(0.085, 0.125, 0.10, 0.008), matGrafite(), 0.055, y + 0.115, -0.03));
  for (let i = 0; i < 4; i++) {
    dentro.add(peca(caixa(0.005, 0.085, 0.014, 0.002), matGrafite(), 0.100, y + 0.10, 0.035 + i * 0.019));
  }

  // placa de video: e a peca que ocupa o meio e mata a sensacao de vazio
  dentro.add(peca(caixa(0.095, 0.040, 0.225, 0.008), matPreto(), 0.058, y - 0.035, 0.005));
  dentro.add(peca(caixa(0.088, 0.012, 0.215, 0.004), matGrafite(), 0.058, y - 0.058, 0.005));

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
  const pa = new THREE.BoxGeometry(0.062, 0.004, 0.010);
  const luzRosa = new THREE.MeshBasicMaterial({ color: PALETA.rosa, toneMapped: false });

  [[-0.055, y + 0.115, P / 2 - 0.045, 0],
   [-0.055, y - 0.020, P / 2 - 0.045, 0],
   [0.045, y - 0.085, 0.055, Math.PI / 2]].forEach(([fx, fy, fz, rx]) => {
    const u = new THREE.Group();
    u.position.set(fx, fy, fz);
    u.rotation.x = rx;
    u.add(new THREE.Mesh(aro, luzRosa));
    for (let k = 0; k < 3; k++) {
      const p2 = new THREE.Mesh(pa, matGrafite());
      p2.rotation.z = (k / 3) * Math.PI;
      u.add(p2);
    }
    fans.add(u);
  });
  g.add(fans);

  // fita de LED no teto do gabinete
  const fita = new THREE.Mesh(new THREE.BoxGeometry(L - 0.06, 0.006, 0.012), luzRosa);
  fita.position.set(0, y + A / 2 - 0.018, P / 2 - 0.05);
  g.add(fita);

  g.userData.fans = fans;
  return g;
}

/* --------------------------------------------------- MACBOOK MIDNIGHT ---- */
export function criarMacbook() {
  const g = new THREE.Group();
  g.name = 'macbook';

  const L = 0.33, P = 0.23;
  g.add(peca(caixa(L, 0.012, P, 0.006), matMidnight(), 0, ALTURA_MESA + 0.006, 0));

  // teclado e trackpad apenas sugeridos: a esta distancia, detalhe vira ruido
  const tec = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.05, P - 0.10),
    new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.9 }));
  tec.rotation.x = -Math.PI / 2;
  tec.position.set(0, ALTURA_MESA + 0.0125, -0.03);
  g.add(tec);

  const tampa = new THREE.Group();
  tampa.position.set(0, ALTURA_MESA + 0.012, -P / 2);
  tampa.rotation.x = -1.83; // ~105 graus aberto
  tampa.add(peca(caixa(L, P, 0.008, 0.005), matMidnight(), 0, P / 2, 0));
  const telaMac = new THREE.Mesh(
    new THREE.PlaneGeometry(L - 0.022, P - 0.022),
    new THREE.MeshBasicMaterial({ color: 0x1a2440, toneMapped: false })
  );
  telaMac.position.set(0, P / 2, 0.005);
  tampa.add(telaMac);
  g.add(tampa);

  return g;
}

/* ------------------------------------------------- MOUSEPAD + MOUSE ---- */
export function criarMousepadEMouse() {
  const g = new THREE.Group();
  g.name = 'mousepad';

  // mousepad quadrado rosa
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46),
    new THREE.MeshStandardMaterial({ color: PALETA.rosa, roughness: 0.95, metalness: 0 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, ALTURA_MESA + 0.002, 0);
  pad.receiveShadow = true;
  g.add(pad);
  // costura da borda
  const borda = new THREE.Mesh(new THREE.RingGeometry(0.316, 0.324, 4),
    new THREE.MeshBasicMaterial({ color: PALETA.rosaEscuro }));
  borda.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  borda.position.set(0, ALTURA_MESA + 0.003, 0);
  g.add(borda);

  // mouse sem fio: corpo baixo, sem cabo saindo
  const mouse = new THREE.Group();
  mouse.name = 'mouse';
  const corpo = peca(new THREE.SphereGeometry(0.038, 20, 14), matRosa(), 0, ALTURA_MESA + 0.016, 0);
  corpo.scale.set(1, 0.62, 1.45);
  mouse.add(corpo);
  const risco = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.05),
    new THREE.MeshBasicMaterial({ color: PALETA.rosaEscuro }));
  risco.rotation.x = -Math.PI / 2;
  risco.position.set(0, ALTURA_MESA + 0.045, 0.012);
  mouse.add(risco);
  g.add(mouse);
  g.userData.mouse = mouse;

  return g;
}

/* ------------------------------------------------------- TECLADO ---- */
/** Espessura do teclado. Exportada porque a altura do personagem e ajustada
 *  para as pontas dos dedos cairem exatamente nesta superficie — o numero nao
 *  pode viver em dois arquivos. */
export const ESPESSURA_TECLADO = 0.034;
export const SUPERFICIE_TECLAS = ALTURA_MESA + ESPESSURA_TECLADO + 0.002;

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
  gabinete.position.set(0.92, 0, -0.16);
  gabinete.rotation.y = -0.28;
  raiz.add(gabinete);

  const macbook = criarMacbook();
  macbook.position.set(-0.90, 0, 0.02);
  macbook.rotation.y = 0.78;
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
