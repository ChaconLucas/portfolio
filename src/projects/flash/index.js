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
  /* Ultima pega boa, ja em coordenadas DA MAO.
     A pega e montada num eixo do CORPO, o que deixa o aparelho sempre em pe no
     mundo. Com a mao levantada isso e exatamente o que se quer. Mas mao baixa
     gira, e um celular preso ao horizonte em vez de a mao acaba de lado,
     atravessando os dedos — que e o que aparecia ao descer o braco e ao voltar
     o scroll. Guardando a pega em espaco local, ela pode ser reusada como
     transformacao rigida quando a mao sai da altura de uso. */
  const pegaFixa = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), tem: false };
  const _qLive = new THREE.Quaternion();
  const _pLive = new THREE.Vector3();
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
        /* A PRATELEIRA DOS DEDOS CURVADOS.
           Medindo o clipe: indicador 6,2 cm da base a ponta (esticado), medio
           4,5, minimo 2,9 (curvados), polegar 8,7. Isso nao e punho fechado nem
           pinca — e a mao em concha de quem segura um celular e toca com o
           indicador.
           O aparelho apoia na falange do MEIO do medio, do anelar e do minimo,
           que formam a prateleira; o polegar fica por cima e o indicador livre.
           Punho, palma, base do dedo e pinca colocavam ele dentro da carne. */
        const apoio = new THREE.Vector3();
        const tmp = new THREE.Vector3();
        let quantos = 0;
        ['Middle2', 'Ring2', 'Pinky2'].forEach((nome) => {
          const b = m.ossos['RightHand' + nome];
          if (!b) return;
          b.getWorldPosition(tmp);
          apoio.add(tmp);
          quantos++;
        });
        const alvoMundo = new THREE.Vector3();
        if (quantos) alvoMundo.copy(apoio).divideScalar(quantos);
        else alvoMundo.copy(pPunho).lerp(pDedo, 1.05);

        const eixoDedos = new THREE.Vector3();
        const atravessaPalma = new THREE.Vector3();
        const normalPalma = new THREE.Vector3();

        /* ORIENTACAO SIMPLES: em pe, retrato, tela para fora.
           Derivar do antebraco punha o aparelho deitado, porque com o braco
           dobrado na altura do peito o antebraco fica na horizontal. Mas
           ninguem segura o celular acompanhando o antebraco — segura EM PE.
           Entao o eixo longo e a vertical do mundo, e a tela olha para fora do
           corpo. A mao continua mandando em onde ele fica. */
        const paraFora = new THREE.Vector3();
        const pQuadril = new THREE.Vector3();
        (m.ossos.Hips || m.raiz).getWorldPosition(pQuadril);
        paraFora.copy(alvoMundo).sub(pQuadril);
        paraFora.y = 0;
        if (paraFora.lengthSq() < 1e-6) paraFora.set(0, 0, 1);
        paraFora.normalize();

        const cima = new THREE.Vector3(0, 1, 0);
        const lado = new THREE.Vector3().crossVectors(cima, paraFora).normalize();
        const base = new THREE.Matrix4().makeBasis(lado, cima, paraFora);
        const qMundo = new THREE.Quaternion().setFromRotationMatrix(base);

        // inclina o topo para tras, como quem le a tela
        qMundo.premultiply(new THREE.Quaternion().setFromAxisAngle(lado, -0.30));

        const qPai = new THREE.Quaternion();
        maoD.getWorldQuaternion(qPai);
        celular.quaternion.copy(qPai.clone().invert().multiply(qMundo));
        celular.position.copy(maoD.worldToLocal(alvoMundo.clone()));

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

  /* Parametros da pega. O loop recalcula posicao e rotacao a cada quadro — se o
     ajuste mexesse direto no objeto, o quadro seguinte apagaria. Entao as teclas
     mexem AQUI, e o loop le daqui.
     Declarado ANTES do bloco de ajuste: estava depois, e como `const` fica na
     zona morta temporal, o painel lancava ao inicializar. O `catch` vazio
     engolia o erro e o ajuste inteiro sumia sem aviso. */
  /* Valores encontrados na tela, com o ajuste ao vivo. Nenhum deles saiu de
     calculo meu: `gira: -3.54` e mais de meia volta e `tomba: -1.10` sao 63
     graus de inclinacao — combinacoes que so aparecem olhando. */
  /* Afastamento extra da palma quando o braco esta pendendo. */
  const FOLGA_BAIXO = 0.008;
  const PEGA = { fora: 0.006, cima: 0.022, lado: -0.048, tomba: -1.10, gira: -3.54, rola: 0 };

  try {
    const q = new URLSearchParams(location.search);
    if (q.get('dbg') === '1') {
      window.__flash = { scene, camera, celular, tela, get modelo() { return modelo; }, get prog() { return progresso; }, get progCam() { return progCamera; }, get solto() { return celularSolto; } };
    }

    /* AJUSTE AO VIVO — `?tune=1`.
       Encaixar um aparelho na mao de uma animacao pronta tem posicao e rotacao
       para acertar ao mesmo tempo, e o clipe foi feito com um prop que eu nao
       tenho. Adivinhar isso de fora custa uma ida e volta por tentativa; com o
       controle na tela converge em segundos, e o valor final e colado no
       codigo. Setas movem, WASD giram, Q/E aproximam, e o console imprime. */
    if (q.get('tune') === '1') {
      const dP = 0.004, dR = 0.06;
      addEventListener('keydown', (ev) => {
        const k = ev.key.toLowerCase();
        if (k === 'arrowleft') PEGA.lado -= dP;
        else if (k === 'arrowright') PEGA.lado += dP;
        else if (k === 'arrowup') PEGA.cima += dP;
        else if (k === 'arrowdown') PEGA.cima -= dP;
        else if (k === 'q') PEGA.fora -= dP;
        else if (k === 'e') PEGA.fora += dP;
        else if (k === 'w') PEGA.tomba -= dR;
        else if (k === 's') PEGA.tomba += dR;
        else if (k === 'a') PEGA.gira -= dR;
        else if (k === 'd') PEGA.gira += dR;
        else if (k === 'z') PEGA.rola -= dR;
        else if (k === 'x') PEGA.rola += dR;
        else return;
        ev.preventDefault();
      });

      /* Painel: sem ele nao da para saber se as teclas estao chegando. */
      const hud = document.createElement('div');
      hud.id = 'ajustePega';
      hud.style.cssText = [
        'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99999',
        'background:rgba(10,12,20,.94)', 'color:#dfe4f2', 'padding:14px 16px',
        'border:1px solid rgba(255,255,255,.16)', 'border-radius:10px',
        'font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace',
        'white-space:pre', 'pointer-events:none'
      ].join(';');
      document.body.appendChild(hud);
      const NL = String.fromCharCode(10);
      const pintar = () => {
        hud.textContent =
          'AJUSTE DA PEGA' + NL +
          'setas: lado/altura   Q/E: fundo' + NL +
          'W/S: tomba   A/D: gira   Z/X: rola' + NL + NL +
          'fora:  ' + PEGA.fora.toFixed(3) + NL +
          'cima:  ' + PEGA.cima.toFixed(3) + NL +
          'lado:  ' + PEGA.lado.toFixed(3) + NL +
          'tomba: ' + PEGA.tomba.toFixed(2) + NL +
          'gira:  ' + PEGA.gira.toFixed(2) + NL +
          'rola:  ' + PEGA.rola.toFixed(2);
      };
      pintar();
      addEventListener('keydown', pintar);
      console.info('Ajuste da pega ligado.');
    }
  } catch (e) { console.warn('ajuste/depuracao falhou', e); }

  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _aux = new THREE.Object3D();
  const _n = new THREE.Vector3();
  const _pq = new THREE.Vector3();
  const _fora = new THREE.Vector3();
  const _lado = new THREE.Vector3();
  const _cima = new THREE.Vector3(0, 1, 0);
  const _base = new THREE.Matrix4();
  const _qm = new THREE.Quaternion();
  const _tilt = new THREE.Quaternion();
  const _apoio = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const DEDOS_APOIO = ['RightHandMiddle2', 'RightHandRing2', 'RightHandPinky2'];


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
      tela.getWorldPosition(_p);
      _n.set(0, 0, 1).applyQuaternion(tela.getWorldQuaternion(_q));
      rig.mirar(_p, _n);
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

    /* ORIENTACAO A CADA QUADRO, enquanto esta na mao.
       Definir uma vez nao basta: a mao gira com a animacao e leva o aparelho
       junto, entao a pose que estava em pe vai deitando. Recalculando por
       quadro, ele fica sempre em pe e com a tela para fora — que e como se
       segura um celular. A mao continua mandando em ONDE ele esta. */
    if (!celularSolto && celularNaMao && modelo) {
      const mao = modelo.ossos.RightHand;
      celular.getWorldPosition(_p);
      /* Direcao "para fora" tirada de para onde o CORPO aponta, nao da linha
         quadril->celular. Aquela linha encurta quando a mao desce para perto do
         eixo do corpo, e uma direcao curta tem angulo instavel: a base girava
         sozinha e o aparelho dava piruetas. O corpo aponta sempre para o mesmo
         lado, entao a pega fica estavel em qualquer altura de mao. */
      _fora.set(0, 0, 1).applyQuaternion(modelo.raiz.getWorldQuaternion(_q));
      _fora.y = 0;
      if (_fora.lengthSq() < 1e-4) _fora.set(0, 0, 1);
      _fora.normalize();
      _lado.crossVectors(_cima, _fora).normalize();
      _base.makeBasis(_lado, _cima, _fora);
      _qm.setFromRotationMatrix(_base);
      _qm.premultiply(_tilt.setFromAxisAngle(_lado, PEGA.tomba));
      if (PEGA.gira) _qm.premultiply(_tilt.setFromAxisAngle(_cima, PEGA.gira));
      if (PEGA.rola) _qm.premultiply(_tilt.setFromAxisAngle(_fora, PEGA.rola));
      mao.getWorldQuaternion(_q);
      _qLive.copy(_q.invert().multiply(_qm));

      /* POSICAO tambem por quadro, afastada da palma.
         A prateleira dos dedos e onde ele APOIA, mas o corpo do aparelho tem
         8 mm e os dedos se fecham por cima — parado exatamente no apoio, ele
         atravessava a carne. Empurrando 2,6 cm para fora, os dedos ficam atras
         dele em vez de dentro. */
      _apoio.set(0, 0, 0);
      let quantos = 0;
      for (let i = 0; i < DEDOS_APOIO.length; i++) {
        const b = modelo.ossos[DEDOS_APOIO[i]];
        if (!b) continue;
        b.getWorldPosition(_t);
        _apoio.add(_t);
        quantos++;
      }
      if (quantos) {
        _apoio.divideScalar(quantos);
        // fora da palma, para os dedos ficarem atras e nao dentro
        _apoio.addScaledVector(_fora, PEGA.fora);
        /* E ACIMA da mao. Nas fotos de referencia a mao segura o TERCO DE BAIXO
           do aparelho e o resto sobe — centrando o celular no ponto de apoio,
           como eu fazia, a mao ficava no meio dele e nao lia como segurar. */
        _apoio.addScaledVector(_cima, PEGA.cima);
        if (PEGA.lado) _apoio.addScaledVector(_lado, PEGA.lado);
        _pLive.copy(mao.worldToLocal(_apoio));

        /* Peso da pega viva: 1 com a mao em uso, 0 com o braco pendendo.
           No clipe a mao em uso passa de 1,08 m e pendendo fica perto de 0,87.
           A faixa de troca e larga o bastante para nao existir salto. */
        mao.getWorldPosition(_t);
        const u = Math.max(0, Math.min(1, (_t.y - 0.98) / 0.10));
        const k = u * u * (3 - 2 * u);

        if (k > 0.995) {
          pegaFixa.pos.copy(_pLive);
          pegaFixa.quat.copy(_qLive);
          pegaFixa.tem = true;
        }

        if (k >= 0.995 || !pegaFixa.tem) {
          celular.position.copy(_pLive);
          celular.quaternion.copy(_qLive);
        } else {
          celular.position.copy(pegaFixa.pos).lerp(_pLive, k);
          celular.quaternion.copy(pegaFixa.quat).slerp(_qLive, k);
          /* Folga extra so na mao baixa. A pega guardada veio da mao aberta em
             uso; embaixo os dedos fecham mais e o aparelho encostava na carne.
             O empurrao e ao longo do proprio eixo do celular (Z local = lado da
             tela), entao ele sai da palma sem mudar de angulo. */
          celular.translateZ(FOLGA_BAIXO * (1 - k));
        }
      }
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
