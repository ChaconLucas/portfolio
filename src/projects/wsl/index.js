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
const CHAVES = [
  { p: 0.00, pos: [1.95, 1.95, 3.55], alvo: [0.05, 1.35, 0.70] },
  { p: 0.32, pos: [1.25, 1.85, 2.85], alvo: [0.02, 1.44, 0.40] },
  { p: 0.62, pos: [0.55, 1.70, 2.05], alvo: [0.00, 1.50, 0.16] },
  { p: 0.85, pos: [0.10, 1.55, 1.20], alvo: [0.00, 1.52, 0.03] },
  { p: 1.00, pos: [0.00, 1.52, 0.60], alvo: [0.00, 1.52, 0.02] }
];

const ehMobile = () => window.matchMedia('(max-width:900px)').matches;
const menosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function suportaWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

/**
 * Cinematica inversa de duas juntas (CCD), para a mao alcancar um ponto.
 *
 * A primeira versao girava um EIXO de cada vez — `rotation.z` no ombro e
 * `rotation.x` no cotovelo — por busca binaria. O problema e que o eixo de
 * flexao de cada osso do Mixamo nao coincide com nenhum eixo do mundo, entao o
 * braco chegava perto do alvo mas torcido.
 *
 * Aqui nao ha eixo escolhido: a cada passo, para cada osso, calculo a rotacao
 * que leva o vetor osso->mao ate o vetor osso->alvo e aplico ela por quaternion.
 * Funciona com qualquer convencao de esqueleto.
 */
function alcancar(ossos, ponta, alvo, iteracoes = 12) {
  const pb = new THREE.Vector3();
  const pe = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const qMundo = new THREE.Quaternion();
  const qPai = new THREE.Quaternion();

  for (let i = 0; i < iteracoes; i++) {
    // do osso mais proximo da mao para o mais distante: e a ordem do CCD
    for (let k = ossos.length - 1; k >= 0; k--) {
      const b = ossos[k];
      if (!b) continue;
      b.updateWorldMatrix(true, true);
      pb.setFromMatrixPosition(b.matrixWorld);
      pe.setFromMatrixPosition(ponta.matrixWorld);

      v1.copy(pe).sub(pb);
      v2.copy(alvo).sub(pb);
      if (v1.lengthSq() < 1e-8 || v2.lengthSq() < 1e-8) continue;
      v1.normalize(); v2.normalize();

      q.setFromUnitVectors(v1, v2);
      b.getWorldQuaternion(qMundo);
      b.parent.getWorldQuaternion(qPai);
      b.quaternion.copy(qPai.invert().multiply(q).multiply(qMundo));
      b.updateWorldMatrix(false, true);
    }
  }
}

/**
 * Poe o personagem de pe encostando a mao no painel.
 * Sem clipe de animacao o modelo fica na pose de repouso, de bracos abertos:
 * os dois descem, e o direito vai ate a tela pela IK acima.
 */
function posarEmPe(m, alvo) {
  const o = m.ossos;
  const g = (n) => o[n];

  // bracos para baixo, saindo da pose de repouso
  if (g('LeftArm')) g('LeftArm').rotation.z = 1.32;
  if (g('LeftForeArm')) g('LeftForeArm').rotation.y = -0.30;
  if (g('RightArm')) g('RightArm').rotation.z = -1.32;
  if (g('RightForeArm')) g('RightForeArm').rotation.y = 0.30;
  // leve contraposto, para nao ficar em posicao de sentido
  if (g('Spine')) g('Spine').rotation.z = 0.02;
  if (g('Hips')) g('Hips').rotation.z = -0.03;
  m.raiz.updateMatrixWorld(true);

  const cadeia = [g('RightArm'), g('RightForeArm')];
  const mao = g('RightHand') || m.maoD;
  if (!cadeia[0] || !mao) return null;

  alcancar(cadeia, mao, alvo);

  return {
    ombro: cadeia[0],
    cotovelo: cadeia[1],
    base: {
      ombro: cadeia[0].quaternion.clone(),
      cotovelo: cadeia[1] ? cadeia[1].quaternion.clone() : null
    }
  };
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
  const rig = criarRigCamera(camera, { chaves: CHAVES, tela: PAINEL });

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
    // a malha se ajusta a proporcao da imagem: as sete telas da WSL vao de
    // 0,567 a 0,761, entao um recorte fixo cortaria quase todas
    const r = proporcoes[i] || proporcaoPainel;
    if (r > proporcaoPainel) tela.scale.set(1, proporcaoPainel / r, 1);
    else tela.scale.set(r / proporcaoPainel, 1, 1);
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
    // ponto de toque: um pouco abaixo do centro da tela, na altura do ombro
    pose = posarEmPe(m, new THREE.Vector3(PAINEL.x + 0.16, PAINEL.y - 0.22, PAINEL.z + 0.05));
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
  const _giro = new THREE.Quaternion();
  const _eixoY = new THREE.Vector3(0, 1, 0);
  const _eixoX = new THREE.Vector3(1, 0, 0);

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
    if (pose && !reduzido) {
      /* Oscila em torno da pose resolvida, por quaternion — mexer num eixo solto
         desfaria a orientacao que a IK encontrou. */
      _giro.setFromAxisAngle(_eixoY, Math.sin(t * 0.5) * 0.05 * calma);
      pose.ombro.quaternion.copy(pose.base.ombro).multiply(_giro);
      if (pose.cotovelo && pose.base.cotovelo) {
        _giro.setFromAxisAngle(_eixoX, Math.sin(t * 0.7 + 1.1) * 0.07 * calma);
        pose.cotovelo.quaternion.copy(pose.base.cotovelo).multiply(_giro);
      }
      if (modelo && modelo.tronco) modelo.tronco.rotation.y = Math.sin(t * 0.33) * 0.02 * calma;
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
