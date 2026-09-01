import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { criarEstacao } from './workstation.js';
import { criarPersonagem, animarPersonagem } from './character.js';
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

  const pessoa = criarPersonagem();
  pessoa.raiz.position.set(0.02, 0, 0.68);
  scene.add(pessoa.raiz);

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

  let progresso = 0;
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
    const calma = 1 - rig.proximidade(progresso);
    if (!reduzido) animarPersonagem(pessoa, t, calma);

    if (estacao.gabinete.userData.fans && !reduzido) {
      estacao.gabinete.userData.fans.children.forEach((f, i) => {
        f.rotation.z = t * (1.6 + i * 0.4);
      });
    }

    rig.atualizar(progresso, dt);
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
    definirProgresso(p) { progresso = Math.max(0, Math.min(1, p)); },
    definirTela(i) { if (i !== telaAtual) aplicarTela(Math.max(0, Math.min(TELAS.length - 1, i))); },
    destruir
  };
}
