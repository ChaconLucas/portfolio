import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { criarAmbiente, PAINEL } from './room.js';
import { carregarPersonagem } from '../gatecheck/character-glb.js';
import { criarRigCamera } from '../gatecheck/camera-rig.js';

/**
 * Cena do capitulo WSL: TV de toque na parede, pessoa em pe mexendo nela.
 *
 * Mesma API do GateCheck de proposito — `definirProgresso`, `definirTela`,
 * `destruir`. Quem chama nao precisa saber se e uma estacao de trabalho ou uma
 * ativacao de evento.
 */

const TELAS = [
  '/assets/projects/wsl-1.webp', '/assets/projects/wsl-2.webp',
  '/assets/projects/wsl-3.webp', '/assets/projects/wsl-4.webp',
  '/assets/projects/wsl-5.webp', '/assets/projects/wsl-6.webp',
  '/assets/projects/wsl-7.webp'
];

/** Percurso proprio: aqui a camera nao chega por cima de uma mesa, e sim de tras
 *  de alguem em pe. Os dois ultimos pontos sao calculados pelo rig. */
/* Todos os pontos ficam mais longe que o final calculado (~2,90 com folga
   1,14), senao o percurso deixa de ser uma aproximacao continua. */
const CHAVES = [
  { p: 0.00, pos: [3.30, 2.35, 6.10], alvo: [0.05, 1.30, 0.70] },
  { p: 0.34, pos: [2.10, 2.10, 4.85], alvo: [0.02, 1.38, 0.45] },
  { p: 0.66, pos: [1.05, 1.85, 3.70], alvo: [0.00, 1.46, 0.20] },
  { p: 0.85, pos: [0.40, 1.65, 3.20], alvo: [0.00, 1.50, 0.05] },
  { p: 1.00, pos: [0.00, 1.52, 2.90], alvo: [0.00, 1.52, 0.02] }
];

const ehMobile = () => window.matchMedia('(max-width:900px)').matches;
const menosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function suportaWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

const _v = new THREE.Vector3();
const _S = new THREE.Vector3();
const _E = new THREE.Vector3();
const _H = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _eixo = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qW = new THREE.Quaternion();
const _qP = new THREE.Quaternion();
const trava = (v, a, b) => Math.max(a, Math.min(b, v));

/** Gira um osso para que seu filho aponte para um ponto do mundo. */
function apontar(osso, filho, alvo) {
  osso.updateWorldMatrix(true, false);
  _S.setFromMatrixPosition(osso.matrixWorld);
  _v.setFromMatrixPosition(filho.matrixWorld).sub(_S);
  _dir.copy(alvo).sub(_S);
  if (_v.lengthSq() < 1e-9 || _dir.lengthSq() < 1e-9) return;
  _q.setFromUnitVectors(_v.normalize(), _dir.normalize());
  osso.getWorldQuaternion(_qW);
  osso.parent.getWorldQuaternion(_qP);
  osso.quaternion.copy(_qP.invert().multiply(_q).multiply(_qW));
  osso.updateWorldMatrix(false, true);
}

/**
 * Cinematica inversa analitica de DUAS juntas, com direcao de flexao.
 *
 * A versao anterior usava CCD iterativo. Com dois ossos e nenhuma restricao, o
 * CCD nao define para onde o cotovelo aponta — sobra um grau de liberdade de
 * torcao que ele resolve de um jeito diferente a cada quadro. Dai o braco
 * torto e o movimento aos trancos.
 *
 * Aqui a solucao e fechada: a lei dos cossenos da o angulo do cotovelo, e o
 * vetor `polo` decide de que lado ele dobra. Mesmo alvo, mesma pose, sempre —
 * sem iteracao e sem tremor.
 */
function ikBraco(ombro, cotovelo, mao, alvo, polo, repouso) {
  /* Volta a pose de referencia antes de resolver.
     Sem isso, cada quadro parte do resultado do quadro anterior — e como
     `setFromUnitVectors` devolve a rotacao MINIMA a partir da direcao atual, a
     torcao em torno do proprio osso vai se acumulando. O braco chega no alvo
     certo, mas girado, e a cada quadro mais girado. */
  if (repouso) {
    ombro.quaternion.copy(repouso.ombro);
    cotovelo.quaternion.copy(repouso.cotovelo);
  }
  ombro.updateWorldMatrix(true, true);
  _S.setFromMatrixPosition(ombro.matrixWorld);
  _E.setFromMatrixPosition(cotovelo.matrixWorld);
  _H.setFromMatrixPosition(mao.matrixWorld);

  const a = _S.distanceTo(_E);
  const b = _E.distanceTo(_H);
  if (a < 1e-6 || b < 1e-6) return;

  _dir.copy(alvo).sub(_S);
  // alvo fora de alcance encosta no limite em vez de esticar torto
  const d = trava(_dir.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  _dir.normalize();

  // plano de flexao: perpendicular a direcao do alvo e ao polo
  _eixo.crossVectors(_dir, polo);
  if (_eixo.lengthSq() < 1e-8) _eixo.set(0, 1, 0);
  _eixo.normalize();

  const cos = trava((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  _v.copy(_dir).applyAxisAngle(_eixo, Math.acos(cos)).multiplyScalar(a).add(_S);

  apontar(ombro, cotovelo, _v);
  apontar(cotovelo, mao, alvo);
}

/**
 * Poe o personagem de pe encostando a mao no painel.
 * Sem clipe de animacao o modelo fica na pose de repouso, de bracos abertos:
 * os dois descem, e o direito vai ate a tela pela IK acima.
 */
function posarEmPe(m, alvo) {
  const o = m.ossos;
  const g = (n) => o[n];

  // aproximacao inicial do braco que vai a tela; o esquerdo e tratado adiante
  if (g('RightArm')) g('RightArm').rotation.z = -1.32;
  // leve contraposto, para nao ficar em posicao de sentido
  if (g('Spine')) g('Spine').rotation.z = 0.02;
  if (g('Hips')) g('Hips').rotation.z = -0.03;
  m.raiz.updateMatrixWorld(true);

  const ombro = g('RightArm');
  const cotovelo = g('RightForeArm');
  const mao = g('RightHand') || m.maoD;
  if (!ombro || !cotovelo || !mao) return null;

  /* Polo: para onde o cotovelo aponta. Para baixo e um pouco para fora, que e
     como um braco dobra ao encostar numa tela na frente do corpo. */
  const polo = new THREE.Vector3(0.55, -1, 0.15).normalize();
  // pose de referencia: guardada ANTES de qualquer solucao
  const repouso = { ombro: ombro.quaternion.clone(), cotovelo: cotovelo.quaternion.clone() };
  ikBraco(ombro, cotovelo, mao, alvo, polo, repouso);

  /* O braco esquerdo tambem vai por IK. Girando `rotation.z` no olho ele acabou
     esticado para a FRENTE — a mao parava em z=0,080, dentro da TV, que fica em
     0,036. Com um alvo caido ao lado do corpo isso nao acontece: o alvo e um
     ponto no mundo, entao nao ha como ele terminar dentro da parede. */
  /* O braco esquerdo so PENDE, entao nao usa IK.
     Com IK a posicao saia certa mas a orientacao nao: `setFromUnitVectors`
     devolve a rotacao minima e deixa o giro em torno do proprio osso solto — o
     punho ficava torcido, com a palma para tras.
     Aqui a rotacao e aplicada no MUNDO, em torno de Z, girando o braco da
     horizontal da pose de repouso ate ficar caido. Como e um giro puro em torno
     de um eixo perpendicular ao osso, o rolamento dele nao muda, e a mao mantem
     a orientacao natural que veio do modelo. */
  const ombroE = g('LeftArm');
  const cotoveloE = g('LeftForeArm');
  if (ombroE) {
    const qW = new THREE.Quaternion();
    const qP = new THREE.Quaternion();
    const giro = new THREE.Quaternion();

    m.raiz.updateMatrixWorld(true);
    ombroE.getWorldQuaternion(qW);
    ombroE.parent.getWorldQuaternion(qP);
    giro.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.42);
    ombroE.quaternion.copy(qP.invert().multiply(giro).multiply(qW));
    ombroE.updateWorldMatrix(false, true);

    // cotovelo com uma dobra pequena: braco totalmente reto parece proteses
    if (cotoveloE) {
      cotoveloE.getWorldQuaternion(qW);
      cotoveloE.parent.getWorldQuaternion(qP);
      giro.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.24);
      cotoveloE.quaternion.copy(qP.invert().multiply(giro).multiply(qW));
      cotoveloE.updateWorldMatrix(false, true);
    }
  }

  return { ombro, cotovelo, mao, polo, repouso, alvo: alvo.clone() };
}

/**
 * Sequencia de toque.
 *
 * Em vez de procurar um clipe pronto, o que se anima aqui e o ALVO da IK: a mao
 * vai de um ponto a outro da tela, encosta, recolhe um pouco e vai para o
 * proximo. O braco inteiro acompanha sozinho, com cotovelo e ombro coerentes —
 * que e justamente o que a IK resolve.
 */
/* Pontos de toque, em metros a partir do ponto base. Mantidos na faixa do
   peito e dos ombros: alvo muito acima da cabeca deixa o braco quase reto, e e
   nessa posicao que qualquer imprecisao de torcao fica visivel. */
const PONTOS = [
  [0.14, -0.16], [-0.12, 0.06], [0.16, 0.18], [-0.02, -0.20], [0.08, 0.02]
];
const DUR = 3.6;

function alvoDoToque(t, base, saida) {
  const total = PONTOS.length * DUR;
  const fase = (t % total) / DUR;
  const i = Math.floor(fase);
  const f = fase - i;
  const a = PONTOS[i];
  const b = PONTOS[(i + 1) % PONTOS.length];

  // 60% deslizando, 40% parado. Com 45/55 o movimento parecia teleporte
  // seguido de congelamento; o olho le como falta de fluidez.
  const k = f < 0.60 ? f / 0.60 : 1;
  const suave = k * k * k * (k * (k * 6 - 15) + 10);
  const x = a[0] + (b[0] - a[0]) * suave;
  const yy = a[1] + (b[1] - a[1]) * suave;

  // a mao recua no trajeto e avanca para tocar: sem isso ela varre o vidro
  const recuo = f < 0.60 ? Math.sin(suave * Math.PI) * 0.075 : 0;
  // toque: um empurraozinho curto logo depois de chegar
  const toque = f >= 0.60 && f < 0.74 ? -Math.sin(((f - 0.60) / 0.14) * Math.PI) * 0.020 : 0;

  saida.set(base.x + x, base.y + yy, base.z + recuo + toque);
}

export function montarCenaWsl(container) {
  if (!container || !suportaWebGL()) return null;

  const reduzido = menosMovimento();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ehMobile() ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = !ehMobile();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05060d, 8, 16);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.035);
  scene.environment = ambiente.texture;
  scene.environmentIntensity = 0.26;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  const rig = criarRigCamera(camera, { chaves: CHAVES, tela: PAINEL, folga: 1.32 });   // 14% cortava a moldura; 32% deixa a TV inteira no quadro

  const { raiz: sala, tela } = criarAmbiente();
  scene.add(sala);

  scene.add(new THREE.HemisphereLight(0xbcc6ff, 0x14121c, 0.26));
  const chave = new THREE.DirectionalLight(0xfff2e6, 0.85);
  chave.position.set(2.4, 3.6, 3.0);
  if (renderer.shadowMap.enabled) {
    chave.castShadow = true;
    chave.shadow.mapSize.set(1024, 1024);
    chave.shadow.camera.near = 0.5;
    chave.shadow.camera.far = 14;
    chave.shadow.camera.left = -4; chave.shadow.camera.right = 4;
    chave.shadow.camera.top = 4; chave.shadow.camera.bottom = -4;
    chave.shadow.bias = -0.0012;
  }
  scene.add(chave);
  const contra = new THREE.DirectionalLight(0x8a6bff, 0.4);
  contra.position.set(-3.0, 2.0, 1.5);
  scene.add(contra);

  /* ------------------------------------------------------ telas na TV -- */
  const carregador = new THREE.TextureLoader();
  const texturas = [];
  const proporcoes = [];
  const proporcaoPainel = PAINEL.largura / PAINEL.altura;

  TELAS.forEach((src, i) => {
    carregador.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      texturas[i] = tex;
      proporcoes[i] = tex.image.width / tex.image.height;
      if (i === telaAtual) aplicarTela(telaAtual);
    });
  });

  let telaAtual = 0;
  function aplicarTela(i) {
    telaAtual = i;
    const tex = texturas[i];
    if (!tex) return;
    /* PREENCHE o painel. Ajustar a malha deixava faixa preta em volta e as
       telas nao pareciam estar rodando NA TV. Como as sete sao retrato e o
       painel tambem (0,651), o recorte fica entre 3% e 15% — sempre nas bordas,
       que nessas capturas sao margem. */
    tela.scale.set(1, 1, 1);
    const r = proporcoes[i] || proporcaoPainel;
    if (r > proporcaoPainel) {
      tex.repeat.set(proporcaoPainel / r, 1);
      tex.offset.set((1 - proporcaoPainel / r) / 2, 0);
    } else {
      tex.repeat.set(1, r / proporcaoPainel);
      tex.offset.set(0, (1 - r / proporcaoPainel) / 2);
    }
    tela.material.map = tex;
    tela.material.color.set(0xffffff);
    tela.material.needsUpdate = true;
  }

  /* ------------------------------------------------------- personagem -- */
  let modelo = null;
  let pose = null;
  const materiaisPessoa = [];

  carregarPersonagem('/assets/models/bryce.glb').then((m) => {
    modelo = m;
    // sem clipe: fica na pose de repouso, que e em pe
    if (m.mixer) m.mixer.stopAllAction();
    /* 0,52 e nao 0,92: o braco mede 50 cm do ombro a mao, e a 0,92 a tela
       ficava a 87 cm — fora de alcance. A IK entao esticava o braco na direcao
       certa sem chegar, e o resultado lia como braco quebrado. */
    m.raiz.position.set(0.10, 0, 0.52);
    m.raiz.rotation.y = Math.PI;   // de costas para a camera, de frente para a TV
    scene.add(m.raiz);

    m.materiais().forEach((x) => materiaisPessoa.push(x));
    /* O alvo fica 14 cm a frente do vidro, nao 5. O osso da mao para no punho e
       os dedos seguem 8 cm adiante — com folga pequena, a mao atravessava a TV. */
    /* Altura do toque na faixa do peito e do rosto (1,45 m), nao 1,28.
       Com o ponto base baixo, a mao parava em y=1,08 — altura do quadril — e o
       braco descia em vez de subir para a tela. Um painel de 1,72 m se usa na
       metade de cima. */
    pose = posarEmPe(m, new THREE.Vector3(PAINEL.x + 0.14, PAINEL.y - 0.07, PAINEL.z + 0.14));
    try { if (window.__wsl) window.__wsl.modelo = m; } catch (e) {}
  }).catch((e) => console.warn('modelo da WSL nao carregou', e));

  /* ------------------------------------------------------ dimensionar -- */
  function dimensionar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 50 : 38;
    camera.updateProjectionMatrix();
    rig.reenquadrar();
  }
  dimensionar();
  const ro = new ResizeObserver(dimensionar);
  ro.observe(container);

  function aoMover(e) {
    const r = container.getBoundingClientRect();
    rig.apontar(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  }
  if (!reduzido && !ehMobile()) container.addEventListener('pointermove', aoMover, { passive: true });

  /* ------------------------------------------------------------ loop -- */
  let visivel = false;
  const io = new IntersectionObserver((es) => { visivel = es[0].isIntersecting; }, { rootMargin: '260px' });
  io.observe(container);

  const FIM_APROXIMACAO = 0.55;
  let progresso = 0, progCamera = 0, rodando = true;
  let ultimo = performance.now();
  const relogio = new THREE.Clock();
  const _alvo = new THREE.Vector3();
  const _alvoBruto = new THREE.Vector3();
  let _alvoIniciado = false;

  try {
    if (new URLSearchParams(location.search).get('dbg') === '1') {
      window.__wsl = { scene, camera, sala, tela, get modelo() { return modelo; } };
    }
  } catch (e) {}

  function quadro() {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!visivel) return;

    const t = relogio.getElapsedTime();

    /* Vida do personagem: sem clipe, o movimento vem de dois senos lentos no
       braco que toca e um balanco minimo no tronco. Amplitude pequena de
       proposito — em pe, qualquer exagero vira dancinha. */
    const calma = 1 - rig.proximidade(progCamera);
    if (pose && !reduzido && calma > 0.01) {
      alvoDoToque(t, pose.alvo, _alvoBruto);
      /* Amortece o ALVO, nao o braco. Suavizar as juntas depois da IK desfaria a
         solucao; suavizando o ponto de destino, a IK continua exata e o
         movimento perde qualquer canto que a curva ainda tenha. */
      if (!_alvoIniciado) { _alvo.copy(_alvoBruto); _alvoIniciado = true; }
      _alvo.lerp(_alvoBruto, 1 - Math.pow(0.0025, dt));
      ikBraco(pose.ombro, pose.cotovelo, pose.mao, _alvo, pose.polo, pose.repouso);
      // peso do corpo acompanhando o braco, bem de leve
      if (modelo && modelo.ossos.Spine) {
        modelo.ossos.Spine.rotation.y = Math.sin(t * 0.42) * 0.05 * calma;
        modelo.ossos.Spine.rotation.z = 0.02 + Math.sin(t * 0.31) * 0.02 * calma;
      }
    }

    // chegando na tela o personagem se dissolve, como no GateCheck
    const s0 = Math.max(0, Math.min(1, (progCamera - 0.84) / 0.15));
    const alfa = 1 - s0 * s0 * (3 - 2 * s0);
    const vivo = alfa > 0.01;
    if (modelo && modelo.raiz.visible !== vivo) modelo.raiz.visible = vivo;
    for (let i = 0; i < materiaisPessoa.length; i++) materiaisPessoa[i].opacity = alfa;

    rig.atualizar(progCamera, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(quadro);

  function destruir() {
    rodando = false;
    io.disconnect();
    ro.disconnect();
    container.removeEventListener('pointermove', aoMover);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    texturas.forEach((t) => t && t.dispose());
    ambiente.texture.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return {
    definirProgresso(p) {
      progresso = Math.max(0, Math.min(1, p));
      progCamera = Math.min(1, progresso / FIM_APROXIMACAO);
      const k = (progresso - FIM_APROXIMACAO) / (1 - FIM_APROXIMACAO);
      const i = Math.floor(Math.max(0, Math.min(0.999, k)) * TELAS.length);
      if (i !== telaAtual) aplicarTela(i);
    },
    definirTela(i) { if (i !== telaAtual) aplicarTela(Math.max(0, Math.min(TELAS.length - 1, i))); },
    destruir
  };
}
