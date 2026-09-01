import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { criarEstacao, TOPO_TECLAS, TOPO_MOUSE, ALTURA_MESA as ALTURA_TAMPO } from './workstation.js';
import { criarPersonagem, animarPersonagem, pousarMaos } from './character.js';
import { carregarPersonagem } from './character-glb.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
  let cadeiraPronta = null;

  /* O assento tem que ficar sob o quadril, nao num Z fixo: com a cadeira
     centrada em 0,76 e o quadril em 0,59, o personagem sentava na ponta.
     Chamado quando qualquer um dos dois chega, porque a ordem de carregamento
     entre cadeira e personagem nao e garantida. */
  function encaixarCadeira() {
    if (!cadeiraPronta || !modelo || !modelo.quadril) return;
    const q = new THREE.Vector3();
    modelo.quadril.getWorldPosition(q);
    cadeiraPronta.updateMatrixWorld(true);
    const cb = new THREE.Box3().setFromObject(cadeiraPronta);
    // encosto atras do quadril: alinha o centro do assento com ele, com um
    // pequeno recuo para o corpo nao atravessar o estofado
    cadeiraPronta.position.z += (q.z + 0.015) - (cb.min.z + cb.max.z) / 2;
    cadeiraPronta.position.x += q.x - (cb.min.x + cb.max.x) / 2;
  }

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
  // Cadeira pronta (CC-BY, credito em CREDITOS.md): 2.222 triangulos, 64 KB,
  // sem textura. Substitui a de primitivas, que nunca passou de caixas.
  new GLTFLoader().load('/assets/models/cadeira.glb', (gl) => {
    const c = gl.scene;
    c.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    // escala pela altura total: cadeira de escritorio tem ~1,12 m
    const cx = new THREE.Box3().setFromObject(c);
    const alt = cx.max.y - cx.min.y;
    if (alt > 0.001) c.scale.setScalar(1.12 / alt);

    /* Reposicionar pela ORIGEM nao funciona: o modelo tem transformacoes nos nos
       internos e a geometria fica longe do ponto (0,0,0) dele — a cadeira caiu em
       x=8,05 / z=-4,76. Entao a correcao vem da caixa envolvente. */
    c.rotation.y = Math.PI;               // encosto para +Z, de frente para o monitor
    c.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(c);
    c.position.x += 0.02 - (b.min.x + b.max.x) / 2;
    c.position.z += 0.76 - (b.min.z + b.max.z) / 2;
    c.position.y += -b.min.y;
    cadeiraPronta = c;
    encaixarCadeira();

    // rosa com branco, como o resto da estacao
    c.traverse((x) => {
      if (!x.isMesh) return;
      const mats = Array.isArray(x.material) ? x.material : [x.material];
      mats.forEach((mm) => {
        if (!mm || !mm.color) return;
        /* Quem e o que, medido no proprio modelo (triangulos x faixa de altura):
             Executive__1  1539 tris, y 0..26   -> base e assento
             Executive__2   556 tris, y 15..45  -> encosto
             Executive       114 tris, y 2..15  -> detalhe da base
           So o encosto vai de rosa. Pintar `__1` tambem deixava a cadeira
           inteira rosa, porque ele cobre da roda ate o assento. */
        const encosto = /__2$/.test(mm.name || '');
        mm.color.set(encosto ? 0xff5fa2 : 0xf0f0f3);
        mm.roughness = encosto ? 0.66 : 0.38;
        mm.metalness = 0.02;
      });
    });
    scene.add(c);
    estacao.cadeira.visible = false;
    try { if (window.__gate) window.__gate.cadeiraPronta = c; } catch (e) {}
  }, undefined, (e) => console.warn('cadeira nao carregou, mantendo a de primitivas', e));

  /* Gabinete pronto: 2.592 triangulos, 170 KB. O de primitivas nunca passou de
     uma caixa de vidro com blocos dentro. */
  new GLTFLoader().load('/assets/models/gabinete.glb', (gl) => {
    const gb = gl.scene;
    gb.traverse((x) => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
    const b0 = new THREE.Box3().setFromObject(gb);
    const alt = b0.max.y - b0.min.y;
    if (alt > 0.001) gb.scale.setScalar(0.44 / alt);
    gb.rotation.y = -0.30;
    gb.updateMatrixWorld(true);
    // mesma licao da cadeira: posicionar pela origem nao serve, o volume manda
    const b = new THREE.Box3().setFromObject(gb);
    gb.position.x += 0.92 - (b.min.x + b.max.x) / 2;
    gb.position.z += -0.14 - (b.min.z + b.max.z) / 2;
    gb.position.y += ALTURA_TAMPO - b.min.y;
    scene.add(gb);
    estacao.gabinete.visible = false;
  }, undefined, (e) => console.warn('gabinete nao carregou, mantendo o de primitivas', e));

  carregarPersonagem('/assets/models/bryce.glb').then((m) => {
    modelo = m;
    m.raiz.position.set(0.02, 0, 0.60);
    m.raiz.rotation.y = Math.PI;  // Mixamo exporta olhando para +Z; o monitor esta em -Z
    scene.add(m.raiz);
    materiaisPessoa.length = 0;
    m.materiais().forEach((x) => materiaisPessoa.push(x));
    pessoa.raiz.visible = false;
    encaixarCadeira();

    /* Onde ficam teclado e mouse sai da propria animacao, nao de chute.
       Medindo a ponta do dedo medio ao longo dos 16,5 s do clipe:

         mao esquerda   percorre  2,7 cm  -> fica no teclado o tempo todo
         mao direita    percorre 37,6 cm  -> tem DOIS pontos de permanencia:
                                             52% junto da esquerda (digitando)
                                             30% a 32 cm a direita (no mouse)

       Ou seja, o gesto de ir ao mouse ja existe no clipe. Separando os dois
       agrupamentos, o teclado vai no primeiro e o mouse no segundo — e a mao
       encontra os dois sozinha. */
    if (m.dedoE && m.dedoD && m.clipe) {
      const N = 120;
      const passo = m.clipe.duration / N;
      const tmp = new THREE.Vector3();
      const esq = [];
      const dir = [];
      for (let i = 0; i < N; i++) {
        m.mixer.update(i === 0 ? 0.0001 : passo);
        m.raiz.updateMatrixWorld(true);
        esq.push(m.dedoE.getWorldPosition(tmp).clone());
        dir.push(m.dedoD.getWorldPosition(tmp).clone());
      }

      const media = (a, eixo) => a.reduce((s2, v) => s2 + v[eixo], 0) / a.length;

      // corte entre os dois agrupamentos: meio do percurso da mao direita
      const xs = dir.map((v) => v.x);
      const corte = (Math.min(...xs) + Math.max(...xs)) / 2;
      const digitando = dir.filter((v) => v.x < corte);
      const noMouse = dir.filter((v) => v.x >= corte);

      /* Altura pelo ponto MAIS BAIXO da digitacao, nao pela media: a tecla e
         pressionada no fundo do movimento, e era ali que o dedo entrava dentro
         do teclado. Encostando o minimo no topo da tecla, o resto do curso fica
         por cima. */
      const digit = digitando.length ? digitando : dir;
      const minY = Math.min(
        Math.min(...esq.map((v) => v.y)),
        Math.min(...digit.map((v) => v.y))
      );
      const ajuste = (TOPO_TECLAS + 0.002) - minY;
      m.raiz.position.y += ajuste;
      m.raiz.updateMatrixWorld(true);

      const ex = media(esq, 'x'), ez = media(esq, 'z');
      const dx = media(digitando.length ? digitando : dir, 'x');
      const dz = media(digitando.length ? digitando : dir, 'z');

      estacao.grupoTeclado.position.set((ex + dx) / 2, 0, (ez + dz) / 2);
      estacao.definirLarguraTeclado(Math.abs(dx - ex) + 0.16);

      // guarda o limiar entre os dois agrupamentos: e ele que diz, a cada
      // quadro, se a mao esta digitando ou no mouse
      mouseZona.limiar = corte;
      mouseZona.ativo = noMouse.length > N * 0.08;

      /* O antebraco do clipe fica no ar nesse trecho, entao seguir so o XZ
         deixa um vao visivel entre a mao e o mouse. A correcao e no BRACO, nao
         no objeto: um mouse subindo ate a mao ficaria voando.
         Aqui eu descubro, por busca, quanto girar o antebraco para a ponta do
         dedo encostar no topo do mouse — e o valor e aplicado depois, por
         quadro, proporcional a quanto a mao esta na zona do mouse. */
      const antebraco = m.ossos.RightForeArm || m.ossos.RightArm;
      if (antebraco && noMouse.length) {
        const alvo = TOPO_MOUSE;
        const orig = antebraco.rotation.x;
        const medir = (d) => {
          antebraco.rotation.x = orig + d;
          antebraco.updateWorldMatrix(true, true);
          return m.dedoD.getWorldPosition(new THREE.Vector3()).y;
        };
        // leva o mixer ate um quadro representativo do trecho do mouse
        m.mixer.setTime(0);
        for (let i = 0; i < N; i++) {
          m.mixer.update(m.clipe.duration / N);
          m.raiz.updateMatrixWorld(true);
          if (m.dedoD.getWorldPosition(new THREE.Vector3()).x >= corte) break;
        }
        const y0 = medir(0);
        const sobe = medir(0.25) > y0;      // descobre o sinal do eixo
        let lo = 0, hi = sobe ? -1.4 : 1.4;
        for (let i = 0; i < 22; i++) {
          const meio = (lo + hi) / 2;
          if (medir(meio) > alvo) lo = meio; else hi = meio;
        }
        antebraco.rotation.x = orig;
        mouseZona.osso = antebraco;
        mouseZona.giro = (lo + hi) / 2;
        try { window.__giro = mouseZona.giro.toFixed(3); } catch (e) {}
      }

      /* O mouse NAO vai debaixo do segundo agrupamento da mao direita.
         Medindo a altura naquele trecho: dedo 0,841 / punho 0,840 / cotovelo
         0,902 — o antebraco inteiro esta no ar, 7 a 9 cm acima do tampo. Aquele
         gesto nao e pegar o mouse, e a mao subindo para o lado. Qualquer mouse
         ali ficaria 5 cm abaixo da mao.
         Entao ele fica onde um mouse fica numa mesa: a direita do teclado. */
      // o pad cobre do repouso ate onde a mao chega, para o mouse deslizar
      // dentro dele o percurso inteiro
      const xMouse = noMouse.length ? media(noMouse, 'x') : (ex + dx) / 2 + 0.46;
      const zMouse = noMouse.length ? media(noMouse, 'z') : (ez + dz) / 2;
      estacao.grupoPad.position.set((xMouse + (ex + dx) / 2 + 0.42) / 2, 0, (zMouse + (ez + dz) / 2) / 2);
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
      /* Sem recorte. Antes eu enquadrava como `object-fit: cover` e a
         screenshot era cortada — justamente onde o zoom termina, que e onde ela
         precisa aparecer inteira. Agora a MALHA da tela e que se ajusta a
         proporcao da imagem, dentro da moldura. Nada e cortado e nada distorce;
         sobra moldura em cima e embaixo, como um video widescreen num monitor. */
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
      texturas[i] = tex;
      proporcoes[i] = tex.image.width / tex.image.height;
      if (i === telaAtual) aplicarTela(telaAtual);
    });
  });

  const proporcoes = [];
  let telaAtual = 0;
  function aplicarTela(i) {
    telaAtual = i;
    const tex = texturas[i];
    if (!tex) return;
    // ajusta a malha a proporcao da imagem, sem passar da moldura
    const r = proporcoes[i] || proporcaoTela;
    if (r > proporcaoTela) estacao.tela.scale.set(1, proporcaoTela / r, 1);
    else estacao.tela.scale.set(r / proporcaoTela, 1, 1);
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
  /* Estado da mao direita: o clipe alterna entre digitar e ir para a zona do
     mouse. O mouse acompanha a mao no segundo trecho e e largado no primeiro. */
  const mouseZona = { limiar: 0, ativo: false, k: 0, segura: 0, pego: false, folgaX: 0, folgaZ: 0, osso: null, giro: 0 };
  const _dedo = new THREE.Vector3();


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
    if (modelo) {
      modelo.atualizar(reduzido ? 0 : dt * calma);
      // desce o antebraco proporcional a presenca na zona do mouse
      if (mouseZona.osso && mouseZona.k > 0.001) {
        mouseZona.osso.rotation.x += mouseZona.giro * mouseZona.k;
        mouseZona.osso.updateWorldMatrix(true, true);
      }
    }
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

    /* Mouse preso a mao: quando a ponta do dedo direito passa do limiar entre
       os dois agrupamentos, o mouse desliza junto; quando ela volta para o
       teclado, ele fica onde parou e depois volta ao repouso.
       So o XZ acompanha — o Y fica no tampo, porque naquele trecho o antebraco
       do clipe esta 8 cm no ar e um mouse subindo junto ficaria voando. */
    if (modelo && modelo.dedoD && estacao.mouse && mouseZona.ativo) {
      modelo.dedoD.getWorldPosition(_dedo);
      /* Dois sinais separados, de proposito:
         `k`      — presenca na zona do mouse, banda larga. Manda no braco, que
                    precisa descer e subir suave.
         `segura` — a mao esta EM CIMA do mouse, banda estreita e deslocada para
                    dentro da zona. Manda no arrasto: assim o mouse para assim
                    que ele tira a mao, e nao la na frente quando ela chega no
                    teclado. */
      const bruto = THREE.MathUtils.smoothstep(_dedo.x, mouseZona.limiar - 0.06, mouseZona.limiar + 0.06);
      mouseZona.k += (bruto - mouseZona.k) * (1 - Math.pow(0.02, dt));
      mouseZona.segura = THREE.MathUtils.smoothstep(_dedo.x, mouseZona.limiar + 0.04, mouseZona.limiar + 0.11);

      // altura no mundo, guardada antes da conversao: e ela que diz se a mao
      // ainda esta pousada no mouse
      const alturaDedo = _dedo.y;
      estacao.grupoPad.worldToLocal(_dedo);
      const px = THREE.MathUtils.clamp(_dedo.x, -0.24, 0.24);
      const pz = THREE.MathUtils.clamp(_dedo.z + 0.03, -0.24, 0.24);

      /* Solto e solto: abaixo do limiar o mouse FICA onde parou, em vez de
         voltar para o repouso acompanhando a mao na volta — que era o "o mouse
         vem junto na hora de soltar". */
      /* Pegar e largar viram um estado binario, com histerese.
         Interpolar por peso era o que causava as duas queixas ao mesmo tempo:
         na aproximacao o mouse ja andava um pouco na direcao da mao (efeito ima)
         e na saida ele ainda vinha atras por alguns quadros.
         Agora ele so se move quando a mao esta REALMENTE em cima dele — que e
         como um mouse funciona: voce pega ele onde ele esta. */
      const dist = Math.hypot(px - estacao.mouse.position.x, pz - estacao.mouse.position.z);
      if (!mouseZona.pego) {
        /* Raio de pegada generoso, porque o mouse fica onde foi largado — uns
           centimetros a esquerda de onde a mao volta no ciclo seguinte. Com raio
           apertado essa diferenca se acumulava a cada volta ate a mao nunca mais
           alcancar. */
        /* Pega no instante do CONTATO. Medido no clipe: com a mao pousada o
           dedo fica em 0,803-0,805, e o topo do mouse esta em 0,7975 — ou seja,
           menos de 8 mm acima. Aproximando, ele vem de 0,829. */
        if (mouseZona.segura > 0.50 && dist < 0.13 && alturaDedo < TOPO_MOUSE + 0.0095) {
          mouseZona.pego = true;
          /* Guarda a folga do momento da pegada, limitada a 1 cm: o mouse anda
             RIGIDO com a mao a partir daqui, sem pulo no instante em que pega e
             sem se arrastar antes dela chegar. */
          mouseZona.folgaX = THREE.MathUtils.clamp(estacao.mouse.position.x - px, -0.010, 0.010);
          mouseZona.folgaZ = THREE.MathUtils.clamp(estacao.mouse.position.z - pz, -0.010, 0.010);
        }
      } else if (
        /* Solta no instante em que a mao SOBE. No clipe ela passa de 0,803 para
           0,810 ao sair; 1 cm acima do topo do mouse ja e mao no ar. O X vira
           so guarda de zona, com folga grande, porque enquanto o dedo estiver
           pousado ele ainda esta empurrando o mouse — e correto arrastar. */
        alturaDedo > TOPO_MOUSE + 0.010 ||
        mouseZona.segura < 0.12 ||
        dist > 0.17
      ) {
        mouseZona.pego = false;
      }

      if (mouseZona.pego) {
        estacao.mouse.position.x = px + mouseZona.folgaX;
        estacao.mouse.position.z = pz + mouseZona.folgaZ;
      }
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
