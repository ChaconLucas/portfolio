import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { criarIphone, TELA as TELA_IPHONE } from './iphone.js';
import { carregarPersonagem } from '../gatecheck/character-glb.js';
import { criarRigCamera } from '../gatecheck/camera-rig.js';

/**
 * Cena do capitulo FLASH: pessoa em pe usando o celular, e a camera termina
 * dentro da tela do aparelho.
 *
 * Capitulo proprio, nao um reaproveitamento do GateCheck: aqui nao ha mesa nem
 * monitor. O ambiente e neutro de proposito — o assunto e o aplicativo, e o
 * aparelho ja e pequeno demais para dividir atencao com mobilia.
 *
 * Mesma API dos outros: `definirProgresso`, `definirTela`, `destruir`.
 */

/** Onde o celular fica no mundo. A camera do capitulo mira aqui. */
const ALVO_TELA = {
  x: 0.05, y: 1.13, z: -0.18,
  largura: TELA_IPHONE.largura,
  altura: TELA_IPHONE.altura
};

/* A tela do celular tem 6,5 cm: enquadrar isso exige chegar MUITO perto, entao
   o percurso inteiro e mais curto que o dos outros capitulos. */
const CHAVES = [
  { p: 0.00, pos: [1.10, 1.70, 2.60], alvo: [0.05, 1.20, -0.10] },
  { p: 0.36, pos: [0.70, 1.52, 1.80], alvo: [0.05, 1.16, -0.14] },
  { p: 0.68, pos: [0.34, 1.34, 1.05], alvo: [0.05, 1.14, -0.16] },
  { p: 0.86, pos: [0.14, 1.22, 0.62], alvo: [0.05, 1.13, -0.17] },
  { p: 1.00, pos: [0.05, 1.15, 0.28], alvo: [0.05, 1.13, -0.18] }
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
 * @param {object} [opcoes]
 * @param {string[]} [opcoes.telas] capturas do app; sem elas a tela fica apagada
 */
export function montarCenaFlash(container, opcoes = {}) {
  if (!container || !suportaWebGL()) return null;

  const TELAS = opcoes.telas || [];
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
  scene.fog = new THREE.Fog(0x05060d, 6, 13);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.035);
  scene.environment = ambiente.texture;
  scene.environmentIntensity = 0.26;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 40);
  const rig = criarRigCamera(camera, { chaves: CHAVES, tela: ALVO_TELA, folga: 1.9 });

  /* Ambiente: chao com reflexo e uma poca de luz. Nada mais — qualquer objeto
     reconhecivel aqui competiria com um aparelho de 7 cm. */
  const chao = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 12),
    new THREE.MeshStandardMaterial({ color: 0x0f1117, roughness: 0.3, metalness: 0.4 })
  );
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  scene.add(chao);

  const poca = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({
      color: 0xaebbd6, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  poca.rotation.x = -Math.PI / 2;
  poca.position.y = 0.004;
  scene.add(poca);

  scene.add(new THREE.HemisphereLight(0xbcc6ff, 0x14121c, 0.30));
  const chave = new THREE.DirectionalLight(0xfff2e6, 0.9);
  chave.position.set(2.0, 3.4, 2.6);
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
  const contra = new THREE.DirectionalLight(0x8a6bff, 0.42);
  contra.position.set(-2.6, 1.8, 1.2);
  scene.add(contra);

  /* ---------------------------------------------------------- celular -- */
  const { grupo: celular, tela } = criarIphone();
  celular.position.set(ALVO_TELA.x, ALVO_TELA.y, ALVO_TELA.z);
  celular.rotation.set(-0.42, 0.16, 0.06);
  scene.add(celular);

  const carregador = new THREE.TextureLoader();
  const texturas = [];
  const proporcoes = [];
  let telaAtual = 0;

  TELAS.forEach((src, i) => {
    carregador.load(src, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      /* Preencher so quando a proporcao e parecida. A tela do aparelho e
         retrato (0,46); uma imagem em paisagem preenchida perderia 70% da
         largura, entao ela CABE inteira e a malha e que se ajusta. */
      const r = tex.image.width / tex.image.height;
      const p = ALVO_TELA.largura / ALVO_TELA.altura;
      proporcoes[i] = r;
      if (r < p * 1.6) {
        if (r > p) { tex.repeat.set(p / r, 1); tex.offset.set((1 - p / r) / 2, 0); }
        else { tex.repeat.set(1, r / p); tex.offset.set(0, (1 - r / p) / 2); }
      } else {
        tex.repeat.set(1, 1); tex.offset.set(0, 0);
      }
      texturas[i] = tex;
      if (i === telaAtual) aplicarTela(telaAtual);
    });
  });

  function aplicarTela(i) {
    telaAtual = i;
    const tex = texturas[i];
    if (!tex) return;
    const r = proporcoes[i] || 1;
    const p = ALVO_TELA.largura / ALVO_TELA.altura;
    // imagem muito mais larga que a tela: encolhe a malha em vez de cortar
    if (r >= p * 1.6) tela.scale.set(1, (p / r), 1);
    else tela.scale.set(1, 1, 1);
    tela.material.map = tex;
    tela.material.color.set(0xffffff);
    tela.material.needsUpdate = true;
  }

  /* -------------------------------------------------------- personagem -- */
  let modelo = null;
  let celularNaMao = false;
  let celularSolto = false;
  const poseNaMao = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), osso: null };
  const materiaisPessoa = [];

  carregarPersonagem('/assets/models/bryce.glb').then((m) => {
    modelo = m;
    /* De frente para a camera. Nos outros capitulos ele fica de costas porque o
       que interessa esta na parede; aqui o assunto esta na mao dele. */
    m.raiz.position.set(0.02, 0, -0.35);
    m.raiz.rotation.y = 0;
    scene.add(m.raiz);
    m.materiais().forEach((x) => materiaisPessoa.push(x));

    /* A animacao de digitar no celular vem em arquivo separado, so com ossos e
       trilhas — 84 KB, porque a malha e a mesma que ja esta carregada. */
    carregarPersonagem('/assets/models/anim-texting.glb').then((a) => {
      const clipe = a.clipe;
      if (!clipe || !m.mixer) return;
      m.mixer.stopAllAction();
      m.mixer.clipAction(clipe).play();
      m.mixer.update(0.001);
      m.raiz.updateMatrixWorld(true);

      /* O celular vai para a MAO, e nao a mao para o celular: o clipe ja poe as
         duas maos na posicao de segurar, entao basta prender o aparelho ao osso.
         Assim ele acompanha qualquer movimento sem precisar de IK. */
      /* A mao que segura e a DIREITA. Medido no clipe ao longo do tempo:
         direita em y~1,13 e a frente, esquerda caida em y~0,94. Prender na mao
         errada deixava o aparelho balancando ao lado do corpo. */
      const maoD = m.ossos.RightHand;
      const dedoD = m.ossos.RightHandMiddle1;
      if (maoD) {
        maoD.add(celular);
        m.raiz.updateMatrixWorld(true);

        /* POSICAO: ENTRE AS DUAS MAOS.
           No clipe de Texting as duas maos seguram o aparelho juntas, uma de
           cada lado. Colocando na palma de uma so, ele ficava ao lado do gesto
           em vez de dentro dele — que e o que lia como bugado.
           O ponto e a media das duas maos, empurrada na direcao dos dedos. */
        const pPunho = new THREE.Vector3();
        const pDedo = new THREE.Vector3();
        const pPonta = new THREE.Vector3();
        const pOutra = new THREE.Vector3();
        maoD.getWorldPosition(pPunho);
        if (dedoD) dedoD.getWorldPosition(pDedo); else pDedo.copy(pPunho);
        const dedoPonta = m.ossos.RightHandMiddle3;
        if (dedoPonta) dedoPonta.getWorldPosition(pPonta); else pPonta.copy(pDedo);
        /* NAO fica entre as duas maos: medindo o clipe, elas estao a 48 cm uma
           da outra — a esquerda pende ao lado do corpo e so a direita segura.
           Puxar o aparelho para o meio das duas o deixava boiando a 22 cm da
           mao que segura. Fica na palma da direita mesmo. */
        /* DENTRO DA CURVA DOS DEDOS.
           A mao do clipe fica fechada como quem segura, e o vao onde o aparelho
           encaixa nao e a palma nem a ponta: e o meio entre a base e a ponta do
           dedo medio. Punho e base davam o celular atras da mao; extrapolar
           alem da base jogava para baixo do corpo. */
        const alvoMundo = pDedo.clone().lerp(pPonta, 0.5);

        /* ORIENTACAO tirada da propria mao.
           Antes eu usava `lookAt` para um ponto fixo perto da camera. Isso
           acerta no instante em que e calculado e erra em todos os outros: a
           mao continua se mexendo com a animacao e leva o aparelho junto, entao
           ele ia ficando de lado.
           Agora o celular e alinhado a MAO — eixo longo na direcao dos dedos,
           face na direcao da palma. Fica preso como um celular fica, e o giro
           para mostrar a tela acontece so no fim, quando o corpo sai de cena. */
        const eixoDedos = new THREE.Vector3();
        const atravessaPalma = new THREE.Vector3();
        const normalPalma = new THREE.Vector3();
        const pIndic = new THREE.Vector3();
        const pMinimo = new THREE.Vector3();
        const iIndic = m.ossos.RightHandIndex1;
        const iMinimo = m.ossos.RightHandPinky1;

        /* Eixo longo do aparelho: a direcao do ANTEBRACO, nao a dos dedos.
           Nessa pose a mao esta fechada, entao punho -> ponta do dedo aponta
           para dentro da curva e o celular saia na diagonal. Quem segura um
           telefone o alinha com o antebraco; e essa a referencia estavel. */
        const pCotovelo = new THREE.Vector3();
        const cotoveloD = m.ossos.RightForeArm;
        if (cotoveloD) {
          cotoveloD.getWorldPosition(pCotovelo);
          eixoDedos.copy(pPunho).sub(pCotovelo).normalize();
        } else {
          eixoDedos.copy(pPonta).sub(pPunho).normalize();
        }
        if (iIndic && iMinimo) {
          iIndic.getWorldPosition(pIndic);
          iMinimo.getWorldPosition(pMinimo);
          atravessaPalma.copy(pMinimo).sub(pIndic).normalize();
        } else {
          atravessaPalma.set(1, 0, 0);
        }
        normalPalma.crossVectors(eixoDedos, atravessaPalma).normalize();
        atravessaPalma.crossVectors(normalPalma, eixoDedos).normalize();

        const base = new THREE.Matrix4().makeBasis(atravessaPalma, eixoDedos, normalPalma);
        const qMundo = new THREE.Quaternion().setFromRotationMatrix(base);

        const qPai = new THREE.Quaternion();
        maoD.getWorldQuaternion(qPai);
        celular.quaternion.copy(qPai.clone().invert().multiply(qMundo));

        // afasta da palma pela espessura do aparelho, para nao afundar na mao
        alvoMundo.add(normalPalma.clone().multiplyScalar(0.008));
        celular.position.copy(maoD.worldToLocal(alvoMundo));

        celularNaMao = true;
        // guarda a pose na mao: e ela que volta quando o scroll sobe
        poseNaMao.pos.copy(celular.position);
        poseNaMao.quat.copy(celular.quaternion);
        poseNaMao.osso = maoD;
      }
    }).catch(() => { /* sem o clipe, ele fica na pose de repouso */ });
  }).catch((e) => console.warn('modelo do FLASH nao carregou', e));

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

  try {
    const q = new URLSearchParams(location.search);
    if (q.get('dbg') === '1') {
      window.__flash = { scene, camera, celular, tela, get modelo() { return modelo; } };
    }

    /* AJUSTE AO VIVO — `?tune=1`.
       Encaixar um aparelho na mao de uma animacao pronta tem posicao e rotacao
       para acertar ao mesmo tempo, e o clipe foi feito com um prop que eu nao
       tenho. Adivinhar isso de fora custa uma ida e volta por tentativa; com o
       controle na tela converge em segundos, e o valor final e colado no
       codigo. Setas movem, WASD giram, Q/E aproximam, e o console imprime. */
    if (q.get('tune') === '1') {
      const passo = 0.004, giro = 0.06;
      addEventListener('keydown', (ev) => {
        const k = ev.key.toLowerCase();
        const p2 = celular.position, r2 = celular.rotation;
        if (k === 'arrowleft') p2.x -= passo;
        else if (k === 'arrowright') p2.x += passo;
        else if (k === 'arrowup') p2.y += passo;
        else if (k === 'arrowdown') p2.y -= passo;
        else if (k === 'q') p2.z -= passo;
        else if (k === 'e') p2.z += passo;
        else if (k === 'a') r2.y -= giro;
        else if (k === 'd') r2.y += giro;
        else if (k === 'w') r2.x -= giro;
        else if (k === 's') r2.x += giro;
        else if (k === 'z') r2.z -= giro;
        else if (k === 'x') r2.z += giro;
        else return;
        ev.preventDefault();
        console.log(
          'celular.position.set(' + [p2.x, p2.y, p2.z].map((v) => v.toFixed(4)).join(', ') + ');' + String.fromCharCode(10) +
          'celular.rotation.set(' + [r2.x, r2.y, r2.z].map((v) => v.toFixed(3)).join(', ') + ');'
        );
      });
      console.info('Ajuste do celular ligado: setas movem, Q/E profundidade, WASD e Z/X giram.');
    }
  } catch (e) {}

  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _aux = new THREE.Object3D();

  function quadro() {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!visivel) return;

    const calma = 1 - rig.proximidade(progCamera);
    if (modelo && modelo.mixer && !reduzido) modelo.mixer.update(dt * calma);

    /* O alvo da camera segue o aparelho, porque ele esta preso a mao e se move
       com a animacao. Sem isso a camera miraria um ponto fixo e o celular
       sairia do quadro justamente no fim do zoom. */
    if (progCamera > 0.2) {
      celular.getWorldPosition(_p);
      rig.mirar(_p);
    }

    const s0 = Math.max(0, Math.min(1, (progCamera - 0.80) / 0.14));
    const alfa = 1 - s0 * s0 * (3 - 2 * s0);

    /* O celular SAI DA MAO antes do corpo sumir.
       Visibilidade em three e herdada: preso ao osso, ele desaparecia junto com
       o personagem — e era justamente o objeto que a camera veio ver. Ao soltar,
       o aparelho passa a ser filho da cena e mantem a posicao que tinha, entao
       nao ha salto no momento da troca. */
    if (!celularSolto && celularNaMao && alfa < 0.55) {
      celular.getWorldPosition(_p);
      celular.getWorldQuaternion(_q);
      scene.add(celular);
      celular.position.copy(_p);
      celular.quaternion.copy(_q);
      celularSolto = true;
    } else if (celularSolto && alfa > 0.72 && poseNaMao.osso) {
      /* Volta para a mao ao subir o scroll.
         Antes a soltura era definitiva: quem voltava encontrava o aparelho
         parado no ar, longe do personagem. Restaurando a pose guardada, ele
         reencaixa exatamente onde estava. */
      poseNaMao.osso.add(celular);
      celular.position.copy(poseNaMao.pos);
      celular.quaternion.copy(poseNaMao.quat);
      celularSolto = false;
    }

    if (celularSolto) {
      // gira devagar ate a tela encarar a camera, e sobe para o centro do quadro
      _aux.position.copy(celular.position);
      _aux.lookAt(camera.position);
      celular.quaternion.slerp(_aux.quaternion, 1 - Math.pow(0.02, dt));
    }

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
      if (!TELAS.length) return;
      const k = (progresso - FIM_APROXIMACAO) / (1 - FIM_APROXIMACAO);
      const i = Math.floor(Math.max(0, Math.min(0.999, k)) * TELAS.length);
      if (i !== telaAtual) aplicarTela(i);
    },
    definirTela(i) { if (TELAS.length && i !== telaAtual) aplicarTela(Math.max(0, Math.min(TELAS.length - 1, i))); },
    destruir
  };
}
