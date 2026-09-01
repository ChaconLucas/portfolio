import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { criarEstacao, ALTURA_MESA } from './workstation.js';
import { criarPersonagem, animarPersonagem, pousarMaos } from './character.js';
import { carregarPersonagem } from './character-glb.js';
import { criarRigCamera } from './camera-rig.js';
import { descartarMateriais } from './materials.js';

/**
 * Cena do capitulo GateCheck.
 *
 * A API e proposital: quem chama so informa PROGRESSO DE SCROLL e QUAL TELA
 * mostrar. Toda a decisao de camera, luz e animacao vive aqui dentro, entao dá
 * para montar as cenas dos outros projetos (WSL em pe num totem, e-commerce,
 * FLASH no celular) com a mesma interface, trocando so o conteudo.
 */

const TELAS = [
  '/assets/projects/gatecheck-1.webp',
  '/assets/projects/gatecheck-2.webp',
  '/assets/projects/gatecheck-3.webp',
  '/assets/projects/gatecheck-4.webp'
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
 * @param {HTMLElement} container
 * @returns {null | {definirProgresso(p:number):void, definirTela(i:number):void, destruir():void}}
 */
export function montarCenaGatecheck(container) {
  if (!container || !suportaWebGL()) return null;

  const reduzido = menosMovimento();

  /* ------------------------------------------------------------ renderer -- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const tetoDPR = ehMobile() ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tetoDPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !ehMobile();
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = renderer.domElement;
  canvas.className = 'gate-scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  /* --------------------------------------------------------------- cena -- */
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x05060d, 6.5, 13);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
  const rig = criarRigCamera(camera);

  const estacao = criarEstacao();
  scene.add(estacao.raiz);
  let modelo = null;

  const pessoa = criarPersonagem();
  pessoa.raiz.position.set(0.02, 0, 0.68);
  scene.add(pessoa.raiz);


  // As maos mandam nos perifericos, e nao o contrario: o solver poe as maos na
  // altura do tampo e o teclado e o mousepad vao para debaixo delas. Assim a
  // mao segura o mouse de verdade, e continua segurando se as proporcoes do
  // personagem mudarem depois.
  // Materiais proprios do personagem: varios sao compartilhados com os moveis
  // (grafite esta na base da cadeira e dentro do gabinete), e sem clonar, apagar
  // o boneco apagaria pedaco da estacao junto.
  const materiaisPessoa = [];
  pessoa.raiz.traverse((m) => {
    if (!m.isMesh || !m.material) return;
    m.material = m.material.clone();
    m.material.transparent = true;
    materiaisPessoa.push(m.material);
  });

  let maos = pousarMaos(pessoa, 0.795);
  estacao.grupoTeclado.position.set(maos.esquerda.x, 0, THREE.MathUtils.clamp(maos.esquerda.z, 0.02, 0.34));
  estacao.grupoPad.position.set(maos.direita.x, 0, THREE.MathUtils.clamp(maos.direita.z, 0.02, 0.34));

  /* Personagem de verdade, com esqueleto e animacao de digitacao. Enquanto ele
     nao chega, o de primitivas segura a cena — se o carregamento falhar, a cena
     nao fica vazia. */
  carregarPersonagem('/assets/models/bryce.glb').then((m) => {
    modelo = m;
    m.raiz.position.set(0.02, 0, 0.60);
    m.raiz.rotation.y = Math.PI;  // Mixamo exporta olhando para +Z; o monitor esta em -Z
    scene.add(m.raiz);
    materiaisPessoa.length = 0;
    m.materiais().forEach((x) => materiaisPessoa.push(x));
    pessoa.raiz.visible = false;

    /* O clipe e "Typing": as DUAS maos ficam no teclado o tempo todo. Entao o
       teclado vai no meio das duas — nao debaixo de uma so, que era o motivo de
       ele digitar no ar — e o mousepad fica ao lado, parado.

       As maos se mexem durante a animacao, entao um unico quadro nao serve como
       referencia: a media ao longo do clipe e que da o centro real da digitacao. */
    if (m.maoE && m.maoD && m.clipe) {
      const somaE = new THREE.Vector3();
      const somaD = new THREE.Vector3();
      const tmp = new THREE.Vector3();
      const N = 24;
      const passo = m.clipe.duration / N;
      for (let i = 0; i < N; i++) {
        m.mixer.update(i === 0 ? 0.0001 : passo);
        m.raiz.updateMatrixWorld(true);
        somaE.add(m.maoE.getWorldPosition(tmp));
        somaD.add(m.maoD.getWorldPosition(tmp));
      }
      somaE.divideScalar(N);
      somaD.divideScalar(N);

      /* Altura: a media das duas maos ao longo do clipe tem que cair na
         superficie das teclas. Sem isso as maos ficavam 2,5 cm ABAIXO do tampo,
         atravessando a mesa — e nenhuma posicao de teclado ia salvar. */
      const SUPERFICIE = ALTURA_MESA + 0.021;
      const mediaY = (somaE.y + somaD.y) / 2;
      m.raiz.position.y += SUPERFICIE - mediaY;
      m.raiz.updateMatrixWorld(true);
      somaE.y += SUPERFICIE - mediaY;
      somaD.y += SUPERFICIE - mediaY;

      const cx = (somaE.x + somaD.x) / 2;
      const cz = THREE.MathUtils.clamp((somaE.z + somaD.z) / 2, 0.02, 0.34);
      estacao.grupoTeclado.position.set(cx, 0, cz);
      // largura util entre as maos, com folga para as bordas do teclado
      estacao.definirLarguraTeclado(Math.abs(somaD.x - somaE.x) + 0.30);
      // mousepad a direita do teclado, fora do alcance da digitacao
      estacao.grupoPad.position.set(cx + Math.abs(somaD.x - somaE.x) / 2 + 0.42, 0, cz);
    }
  }).catch((e) => console.warn('modelo nao carregou, seguindo com o boneco simples', e));

  /* ---------------------------------------------------------------- luz -- */
  scene.add(new THREE.HemisphereLight(0xbcc6ff, 0x14121c, 0.55));

  const chave = new THREE.DirectionalLight(0xfff2e6, 1.15);
  chave.position.set(2.6, 3.4, 2.2);
  if (renderer.shadowMap.enabled) {
    chave.castShadow = true;
    chave.shadow.mapSize.set(1024, 1024);
    chave.shadow.camera.near = 0.5;
    chave.shadow.camera.far = 12;
    chave.shadow.camera.left = -3; chave.shadow.camera.right = 3;
    chave.shadow.camera.top = 3; chave.shadow.camera.bottom = -3;
    chave.shadow.bias = -0.0012;
  }
  scene.add(chave);

  // contraluz roxa: liga a cena com a identidade do resto do site
  const contra = new THREE.DirectionalLight(0x8a6bff, 0.55);
  contra.position.set(-2.8, 1.6, -2.4);
  scene.add(contra);

  // chao invisivel que so recebe sombra, para a estacao ter apoio
  if (renderer.shadowMap.enabled) {
    const chao = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ opacity: 0.32 })
    );
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    scene.add(chao);
  }

  /* ------------------------------------------------- telas reais na tela -- */
  const carregador = new THREE.TextureLoader();
  const texturas = [];
  const proporcaoTela = 1.185 / 0.665; // proporcao do painel do monitor

  TELAS.forEach((src, i) => {
    carregador.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      // enquadra como `object-fit: cover`, sem distorcer a screenshot
      const r = tex.image.width / tex.image.height;
      if (r > proporcaoTela) {
        tex.repeat.set(proporcaoTela / r, 1);
        tex.offset.set((1 - proporcaoTela / r) / 2, 0);
      } else {
        tex.repeat.set(1, r / proporcaoTela);
        tex.offset.set(0, (1 - r / proporcaoTela) / 2);
      }
      texturas[i] = tex;
      if (i === telaAtual) aplicarTela(telaAtual);
    });
  });

  let telaAtual = 0;
  function aplicarTela(i) {
    telaAtual = i;
    const tex = texturas[i];
    if (!tex) return;
    estacao.tela.material.map = tex;
    estacao.tela.material.color.set(0xffffff);
    estacao.tela.material.needsUpdate = true;
  }

  // gancho de inspecao: so com ?dbg=1, para medir posicoes sem chutar
  try {
    if (new URLSearchParams(location.search).get('dbg') === '1') {
      window.__gate = { scene, camera, estacao, pessoa, get modelo() { return modelo; } };
    }
  } catch (e) {}

  /* ------------------------------------------------------- dimensionar -- */
  function dimensionar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em tela estreita o enquadramento perde as laterais: alarga o FOV o
    // suficiente para a estacao continuar inteira no quadro
    camera.fov = w / h < 1.2 ? 50 : 38;
    camera.updateProjectionMatrix();
    rig.reenquadrar();
  }
  dimensionar();
  const ro = new ResizeObserver(dimensionar);
  ro.observe(container);

  /* ------------------------------------------------------------ ponteiro -- */
  function aoMover(e) {
    const r = container.getBoundingClientRect();
    rig.apontar(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -(((e.clientY - r.top) / r.height) * 2 - 1)
    );
  }
  if (!reduzido && !ehMobile()) container.addEventListener('pointermove', aoMover, { passive: true });

  /* --------------------------------------------------------------- loop -- */
  let visivel = false;
  const io = new IntersectionObserver(
    (es) => { visivel = es[0].isIntersecting; },
    { rootMargin: '260px' }
  );
  io.observe(container);

  /* A camera chega no monitor em 55% do capitulo. Os 45% restantes servem para
     as telas do projeto passarem — com o monitor inteiro no quadro, sem entrar
     dentro da imagem. */
  const FIM_APROXIMACAO = 0.55;
  let progresso = 0;
  let progCamera = 0;
  let rodando = true;
  let ultimo = performance.now();
  const relogio = new THREE.Clock();

  function quadro() {
    if (!rodando) return;
    requestAnimationFrame(quadro);

    const agora = performance.now();
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!visivel) return;

    const t = relogio.getElapsedTime();

    // a vida do personagem some conforme a camera entra na tela: perto do
    // monitor, qualquer movimento do corpo vira tremor no quadro
    const calma = 1 - rig.proximidade(progCamera);
    if (modelo) modelo.atualizar(reduzido ? 0 : dt * calma);
    else if (!reduzido) animarPersonagem(pessoa, t, calma);

    // Chegando na tela, o personagem se dissolve: o ponto de vista passa a ser
    // o dele. Ele nao pode ficar tapando a tela que a camera veio ver.
    // So no trecho final da aproximacao. Em 0.58 ele sumia quando a camera mal
    // tinha saido do plano geral, e a estacao ficava com uma cadeira vazia.
    const s0 = Math.max(0, Math.min(1, (progCamera - 0.84) / 0.15));
    const alfa = 1 - s0 * s0 * (3 - 2 * s0);
    const vivo = alfa > 0.01;
    if (modelo) { if (modelo.raiz.visible !== vivo) modelo.raiz.visible = vivo; }
    else if (pessoa.raiz.visible !== vivo) pessoa.raiz.visible = vivo;
    for (let i = 0; i < materiaisPessoa.length; i++) materiaisPessoa[i].opacity = alfa;

    if (estacao.gabinete.userData.fans && !reduzido) {
      estacao.gabinete.userData.fans.children.forEach((f, i) => {
        f.rotation.z = t * (1.6 + i * 0.4);
      });
    }

    rig.atualizar(progCamera, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(quadro);

  /* ------------------------------------------------------------ limpeza -- */
  function destruir() {
    rodando = false;
    io.disconnect();
    ro.disconnect();
    container.removeEventListener('pointermove', aoMover);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Array.isArray(o.material) && o.material.dispose && !o.material.__memo) {
        o.material.dispose();
      }
    });
    texturas.forEach((t) => t && t.dispose());
    descartarMateriais();
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
