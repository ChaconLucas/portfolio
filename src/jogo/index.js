import * as THREE from 'three';
import './jogo.css';
import { criarNave } from './nave.js';
import { criarAstronauta } from './astronauta.js';
import { criarEspaco, criarSuperficie, LIMITE_ESPACO, R_GLOBO } from './cenas.js';
import { STACK, PROJETOS_POR_TECH, ANCORA } from './dados.js';

/**
 * Jogo da nave pelo Stack Universe.
 *  ETAPA 1 — voar entre os 9 planetas da stack, entrar, pousar, decolar.
 *  ETAPA 2 — entrada cinematografica (reentrada com plasma e nuvens, sem
 *            corte), sair da nave e andar com o astronauta, entrar nos predios
 *            da stack (um por tecnologia) e ver nivel, descricao e projetos.
 *
 * Abre por cima do site (botao "Pilotar" na secao Stack Universe) e so e
 * carregado no clique. Enquanto aberto, `window.__jogoAberto` pausa o
 * universo e as estrelas do site.
 *
 * Modos:
 *   espaco     voo livre; perto de um planeta, E entra
 *   entrando   cinematica: o planeta cresce ate virar o globo, mergulho e nivela -> dissolve
 *   descendo   ja na superficie: sai das nuvens e desce em piloto automatico
 *   superficie voo baixo / pairando; E pousa; pousado: E sai, Espaco decola;
 *              acima de 140 m comeca a subir de volta
 *   subindo    piloto automatico ate as nuvens -> troca para o espaco
 *   (a pe)     s.aPe dentro de superficie: anda, entra nos predios, embarca
 */

const tecla = new Set();
const ok = (...k) => k.some((x) => tecla.has(x));
const suave = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const ESC_SUP = 2.6;          // a nave fica maior na superficie (escala de pessoa)

export async function abrirJogo() {
  if (window.__jogoAberto) return;
  window.__jogoAberto = true;
  document.documentElement.classList.add('jogo-aberto');
  // celular/tablet: controles de toque (etapa 4). ?debugtoque forca no desktop
  const TOQUE = /debugtoque/.test(location.search) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer:coarse)').matches);

  const raiz = document.createElement('div');
  raiz.className = 'jogo carregando';
  raiz.innerHTML = `
    <canvas class="jogo-canvas"></canvas>
    <div class="jogo-rotulos"></div>
    <div class="jogo-calor"></div>
    <div class="jogo-veu"></div>
    <div class="jogo-dobra"></div>
    <div class="jogo-nuvens"><i></i><i></i><i></i><i></i></div>
    <div class="jogo-topo">
      <div class="jogo-titulo"><b>STACK UNIVERSE</b><span>pilotando</span></div>
      <button class="jogo-sair" type="button">ESC · SAIR</button>
    </div>
    <div class="jogo-ajuda"></div>
    <div class="jogo-acao"></div>
    <div class="jogo-mira"></div>
    <div class="jogo-dica-mouse">mexa o mouse para mirar · clique para travar o mouse</div>
    <div class="jogo-painel">
      <div class="jogo-vel"><small>VELOCIDADE</small><b>0</b><i><em></em></i></div>
      <div class="jogo-alvo"><small>ALVO</small><b>—</b><span></span></div>
    </div>
    <canvas class="jogo-radar" width="300" height="300"></canvas>
    <div class="jogo-predio" aria-live="polite">
      <div class="jp-topo"><span class="jp-nivel"></span><span class="jp-area"></span></div>
      <h3 class="jp-nome"></h3>
      <p class="jp-desc"></p>
      <div class="jp-sec"><small>NA ÁREA</small><p class="jp-areadesc"></p></div>
      <div class="jp-sec"><small>USADO EM</small><div class="jp-proj"></div></div>
      <div class="jp-pe"><span class="jp-teclas"><kbd>E</kbd> ou <kbd>Esc</kbd> sair do prédio</span><button type="button" class="jp-fechar">✕ sair do prédio</button></div>
    </div>
    <div class="jogo-conquista"></div>
    <div class="jogo-toque">
      <div class="jt-area"></div>
      <div class="jt-joy"><i></i></div>
      <div class="jt-botoes">
        <button type="button" data-b="turbo" aria-label="turbo / correr">⚡</button>
        <button type="button" data-b="sobe" aria-label="subir / pular / decolar">▲</button>
        <button type="button" data-b="acao" aria-label="interagir">E</button>
        <button type="button" data-b="desce" aria-label="descer">▼</button>
      </div>
      <div class="jt-dica">arraste à esquerda para mover · à direita para olhar</div>
    </div>
    <div class="jogo-pausa"><b>▶ clique para pilotar</b><span>o mouse fica preso ao jogo e vira a mira · <kbd>Esc</kbd> solta o mouse · <kbd>Esc</kbd> de novo sai</span></div>
    <div class="jogo-carregando">carregando a nave…</div>`;
  document.body.appendChild(raiz);
  const $ = (q) => raiz.querySelector(q);
  const canvas = $('.jogo-canvas'), acao = $('.jogo-acao'), calor = $('.jogo-calor'), nuvensUI = $('.jogo-nuvens'), dobraUI = $('.jogo-dobra'), veuUI = $('.jogo-veu');
  const elVel = $('.jogo-vel b'), elVelRot = $('.jogo-vel small'), barraVel = $('.jogo-vel em'), elAlvo = $('.jogo-alvo b'), elAlvoRot = $('.jogo-alvo small'), elDist = $('.jogo-alvo span');
  const radar = $('.jogo-radar').getContext('2d');
  const rotulos = $('.jogo-rotulos'), painel = $('.jogo-predio'), conquista = $('.jogo-conquista');

  const AJUDA = {
    nave: `<span><kbd>W</kbd><kbd>S</kbd> acelerar / frear</span><span><kbd>A</kbd><kbd>D</kbd> para os lados</span>
      <span><kbd>Espaço</kbd><kbd>Ctrl</kbd> subir / descer</span><span><kbd>Shift</kbd>+<kbd>W</kbd> velocidade da luz</span><span><kbd>E</kbd> interagir</span><span><kbd>Mouse</kbd> visão / direção · rodinha = zoom</span>`,
    pe: `<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar</span><span><kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular</span>
      <span><kbd>E</kbd> entrar no prédio / embarcar</span><span><kbd>Mouse</kbd> câmera · rodinha = zoom</span>`
  };
  const ajuda = $('.jogo-ajuda'); ajuda.innerHTML = AJUDA.nave;
  // o clique em "Pilotar" ainda vale como gesto do usuario: trava o mouse ja
  let semTrava = false;
  // a trava e no documento inteiro: o botao "Pilotar" ja pediu no clique (Safari
  // so aceita no gesto); daqui em diante, cliques no jogo pedem de novo
  const preso = () => !!document.pointerLockElement;
  const travar = () => { if (preso() || semTrava) return; try { const r = document.documentElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* */ } };
  // estado declarado antes de carregar: o teclado ja escuta durante o carregamento
  let s = null, painelAberto = false;
  const pe = { pos: new THREE.Vector3(), rumo: 0, vel: new THREE.Vector3(), velY: 0, noChao: true };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOQUE ? 1.25 : 1.5));   // celular: menos pixels, mais quadros
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  let cena = new THREE.Scene();          // troca na entrada/saida (a proxima cena e montada antes)
  const camera = new THREE.PerspectiveCamera(62, 1, .4, 45000);
  function medir() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  medir(); addEventListener('resize', medir);

  /* Pos-processamento da velocidade da luz: a cena vai para uma textura e um
     quad de tela inteira distorce SO EM VOLTA (o centro, onde esta a nave,
     fica nitido): desfoque radial puxando para o centro, lente curvando as
     bordas e aberracao cromatica. Fora da dobra nem roda. */
  const rt = new THREE.WebGLRenderTarget(2, 2, { samples: 4 });
  const posCena = new THREE.Scene(), posCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const posMat = new THREE.ShaderMaterial({
    uniforms: { tCena: { value: rt.texture }, forca: { value: 0 }, aspecto: { value: 1 }, tempo: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D tCena; uniform float forca, aspecto, tempo; varying vec2 vUv;
      void main(){
        vec2 d = vUv - .5; vec2 da = d; da.x *= aspecto;
        float r = length(da);
        float borda = smoothstep(.16, .62, r) * forca;          // centro limpo, distorce em volta
        // lente: as bordas curvam para fora
        vec2 uv = .5 + d * (1. - borda * .10 + borda * r * .18);
        // desfoque radial: amostras puxadas em direcao ao centro
        vec3 cor = vec3(0.);
        for (int i = 0; i < 14; i++) {
          float k = 1. - borda * .16 * (float(i) / 13.);
          vec2 p = .5 + (uv - .5) * k;
          cor += texture2D(tCena, p).rgb;
        }
        cor /= 14.;
        // aberracao cromatica: vermelho e azul se separam nas bordas
        float ca = borda * .018;
        cor.r = mix(cor.r, texture2D(tCena, .5 + (uv - .5) * (1. + ca)).r, .65);
        cor.b = mix(cor.b, texture2D(tCena, .5 + (uv - .5) * (1. - ca)).b, .65);
        // brilho azulado nas bordas
        cor += vec3(.12, .2, .45) * borda * .16;
        gl_FragColor = vec4(cor, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false
  });
  posCena.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), posMat));
  /* Troca de cena: a ultima imagem (copiada da tela, ja com cor final) se
     dissolve por cima da cena nova, que ja comeca no mesmo ponto de vista. */
  let fotoTex = null;
  const fotoCena = new THREE.Scene();
  const fotoMat = new THREE.ShaderMaterial({
    uniforms: { tFoto: { value: null }, alfa: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D tFoto; uniform float alfa; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tFoto, vUv).rgb, alfa); }',
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false
  });
  fotoCena.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fotoMat));
  let dissolve = 0;
  function medirPos() {
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.round(innerWidth * pr), Math.round(innerHeight * pr));
    posMat.uniforms.aspecto.value = innerWidth / innerHeight;
  }
  medirPos(); addEventListener('resize', medirPos);

  // teclado
  const baixo = (e) => {
    if (e.key === 'Escape') {
      if (painelAberto) { fecharPainel(); return; }
      // com o mouse travado, o primeiro Esc so solta o mouse (o navegador ja faz)
      if (document.pointerLockElement || performance.now() - soltouEm < 250) return;
      fechar(); return;
    }
    if (!s) return;                                   // ainda carregando
    tecla.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) interagir();
    if (e.code === 'Space' && !e.repeat && s.aPe && pe.noChao && !painelAberto) { pe.velY = 6.2; pe.noChao = false; }
    if (e.code === 'Space') e.preventDefault();
  };
  const cima = (e) => tecla.delete(e.code);
  addEventListener('keydown', baixo); addEventListener('keyup', cima);
  addEventListener('blur', () => tecla.clear());
  $('.jogo-sair').addEventListener('click', () => fechar());

  /* Mouse = mira (terceira pessoa): o MOVIMENTO do mouse gira a mira e a
     camera na hora; a nave persegue a mira com inercia. Mouse parado, nada
     gira. Funciona sem travar o ponteiro; clicar trava, se o navegador
     deixar. Rodinha = zoom. */
  let mdx = 0, mdy = 0, zoom = 1, soltouEm = 0, ultX = null, ultY = null;
  canvas.addEventListener('click', travar);
  $('.jogo-pausa').addEventListener('click', travar);
  // navegador sem trava: cai no modo solto (o movimento do mouse mira mesmo assim)
  document.addEventListener('pointerlockerror', () => { semTrava = true; raiz.classList.add('sem-trava'); });
  const aoMover = (e) => {
    let dx = e.movementX, dy = e.movementY;
    if (dx === undefined) { dx = ultX === null ? 0 : e.clientX - ultX; dy = ultY === null ? 0 : e.clientY - ultY; }
    ultX = e.clientX; ultY = e.clientY;
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
    if (!painelAberto && (preso() || semTrava)) { mdx += dx; mdy += dy; }
  };
  const aoTravar = () => {
    raiz.classList.toggle('mouse-preso', preso());
    if (!preso()) soltouEm = performance.now();
  };
  const aoRodar = (e) => { e.preventDefault(); zoom = Math.max(.6, Math.min(2.2, zoom * (1 + Math.sign(e.deltaY) * .1))); };
  addEventListener('mousemove', aoMover);
  document.addEventListener('pointerlockchange', aoTravar);
  aoTravar();   // a trava pode ter vindo do clique em "Pilotar", antes do jogo existir

  /* Toque (etapa 4): metade esquerda = joystick (aparece onde o dedo
     encosta), metade direita = arrastar para olhar; botoes a direita:
     turbo, subir/pular, acao (E) e descer. */
  const tq = { x: 0, y: 0, sobe: 0, desce: 0, turbo: 0 };
  if (TOQUE) {
    semTrava = true; raiz.classList.add('toque', 'sem-trava');
    ajuda.innerHTML = '';
    const joy = $('.jt-joy'), bola = $('.jt-joy i'), area = $('.jt-area');
    let joyId = null, olharId = null, jx = 0, jy = 0, ox = 0, oy = 0;
    const R = 56;
    const repousoJoy = () => { joy.style.left = '96px'; joy.style.top = (innerHeight - 110) + 'px'; bola.style.transform = ''; joy.classList.remove('on'); };
    repousoJoy();
    area.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.clientX < innerWidth * .45 && joyId === null) {
        joyId = e.pointerId; jx = e.clientX; jy = e.clientY;
        joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; joy.classList.add('on');
      } else if (olharId === null) { olharId = e.pointerId; ox = e.clientX; oy = e.clientY; }
      try { area.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) {
        let dx = e.clientX - jx, dy = e.clientY - jy; const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        bola.style.transform = `translate(${dx}px,${dy}px)`;
        tq.x = dx / R; tq.y = -dy / R;
      } else if (e.pointerId === olharId && !painelAberto) {
        mdx += (e.clientX - ox) * 1.5; mdy += (e.clientY - oy) * 1.5; ox = e.clientX; oy = e.clientY;
      }
    });
    const soltar = (e) => {
      if (e.pointerId === joyId) { joyId = null; tq.x = tq.y = 0; repousoJoy(); }
      if (e.pointerId === olharId) olharId = null;
    };
    area.addEventListener('pointerup', soltar); area.addEventListener('pointercancel', soltar);
    raiz.querySelectorAll('.jt-botoes button').forEach((b) => {
      const k = b.dataset.b;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); b.classList.add('on');
        if (k === 'acao') { if (s) interagir(); return; }
        tq[k] = 1;
        if (k === 'sobe' && s && s.aPe && pe.noChao && !painelAberto) { pe.velY = 6.2; pe.noChao = false; }
      });
      const fim = () => { b.classList.remove('on'); if (k !== 'acao') tq[k] = 0; };
      b.addEventListener('pointerup', fim); b.addEventListener('pointercancel', fim); b.addEventListener('pointerleave', fim);
    });
    // tocar no aviso de acao tambem interage
    acao.addEventListener('pointerdown', (e) => { e.preventDefault(); if (s) interagir(); });
    addEventListener('resize', repousoJoy);
    setTimeout(() => raiz.querySelector('.jt-dica')?.classList.add('some'), 6000);
  }
  $('.jp-fechar').addEventListener('click', () => fecharPainel());
  canvas.addEventListener('wheel', aoRodar, { passive: false });

  /* ---------------------------------------------------------------- mundo -- */
  let mundo = criarEspaco(cena);
  let nave, astro;
  try { [nave, astro] = await Promise.all([criarNave(cena), criarAstronauta(cena)]); }
  catch (e) { console.warn('[jogo] modelos nao carregaram', e); $('.jogo-carregando').textContent = 'não deu para carregar o jogo'; return; }
  $('.jogo-carregando').remove(); raiz.classList.remove('carregando');

  s = {
    modo: 'espaco', pos: new THREE.Vector3(-1500, 650, 2900), rumo: Math.atan2(1500, -2900), vel: new THREE.Vector3(),
    banco: 0, arfagem: 0, planeta: null, pousado: false, tModo: 99,   // 99: sem o plasma de quem acabou de sair de um planeta
    mira: -.15, alvoRumo: Math.atan2(1500, -2900), alvoMira: -.15, vRumo: 0,   // comeca olhando o sistema, como no site
    dobra: 0,                        // 0..1: Shift no espaco = velocidade da luz
    aPe: false
  };
  /* Entrada no planeta: o planeta cresce em volta do ponto embaixo da nave ate
     virar o globo da superficie (R_GLOBO), enquanto a nave mergulha e depois
     nivela sobre ele. No fim, o espaco e a superficie estao no MESMO ponto de
     vista (a base ex/n/f do planeta vira x/y/z da superficie) e so se dissolvem. */
  const ENT_T = 5.2, ENT_T_AR = 7;                          // segundos (com ar atravessa a camada de gas)
  const P_SUP = new THREE.Vector3(0, 1500, -1750), C_SUP = new THREE.Vector3(0, -R_GLOBO - 22, 0);
  const NAVE_MIRA_FIM = .5, CAM_MIRA_FIM = .4, FRENTE_FIM = .275;   // inclinacoes ao chegar (rad)
  const V3 = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const ent = {
    n: V3(), f: V3(), ex: V3(), luz: V3(), ver: V3(), nX: V3(), qS2W: Q(), qW2S: Q(),
    hS: 0, altS: 0, qS: 1, rot: {}, cenaProx: null, mundoProx: null, c0: V3(), centro: V3(), raio0: 1, q0: 1, hE: 1, alt: 0,
    S2W: new THREE.Matrix4(), W2S: new THREE.Matrix4(),
    qN0: Q(), qND: Q(), qNE: Q(), qN: Q(), qC0: Q(), qCD: Q(), qCE: Q(), qC: Q(),
    off0: V3(), offD: V3(), offE: V3(), off: V3(), offF: V3(), qNF: Q(), qCF: Q()
  };
  const SAI_T = 4.6, Q_FORA = .9;            // saida: segundos e altitude relativa final (h/R)
  // onde a camera estaria no sistema de verdade, estando em P na superficie
  const verdadeiroDe = (P, out) => out.subVectors(P, C_SUP).applyMatrix4(ent.S2W).multiplyScalar(ent.raio0 / R_GLOBO).add(ent.c0);
  /* A proxima cena (superficie na entrada, espaco na saida) e montada e
     compilada ANTES da troca, numa Scene separada: na troca e so trocar a
     referencia (sem engasgo no meio da dissolucao). Uma luz pontual de mentira
     faz o papel da luz do propulsor, para os shaders ja saírem com o mesmo
     numero de luzes. */
  function prepararCena(sc) {
    const falsa = new THREE.PointLight(0, 0); sc.add(falsa);
    try { renderer.compile(sc, camera); } catch (e) { /* so otimizacao */ }
    sc.traverse((o) => { const m = o.material; if (m && m.map) renderer.initTexture(m.map); });
    sc.remove(falsa);
  }
  function trocarCena() {
    // redesenha o quadro anterior e copia a tela (no mesmo instante: o buffer da tela nao e preservado)
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!fotoTex || fotoTex.image.width !== tam.x || fotoTex.image.height !== tam.y) { fotoTex?.dispose(); fotoTex = new THREE.FramebufferTexture(tam.x, tam.y); fotoMat.uniforms.tFoto.value = fotoTex; }
    renderer.render(cena, camera); renderer.copyFramebufferToTexture(fotoTex); dissolve = 1;
    mundo.destruir();
    cena = ent.cenaProx; mundo = ent.mundoProx; ent.cenaProx = ent.mundoProx = null;
    cena.add(nave.raiz, nave.rastro, astro.raiz);
  }
  const _mb = new THREE.Matrix4();
  const quatBase = (x, y, z, q) => q.setFromRotationMatrix(_mb.makeBasis(x, y, z));
  const fx = { calor: 0, nuvem: 0, veu: 0, veuCor: '#000' };   // overlays da tela
  const vistos = {};                               // planeta -> Set de tecnologias vistas

  const FRENTE = new THREE.Vector3();
  const camPos = new THREE.Vector3(-1510, 660, 2920), camOlha = new THREE.Vector3();
  // em voo a camera segue a nave pela posicao RELATIVA a ela: suavizar a
  // posicao absoluta deixava a camera ~90 m para tras na velocidade da luz
  const camRel = new THREE.Vector3(0, 8, -25), olhaRel = new THREE.Vector3(0, 1, 16);
  let rotuloEls = [];
  function montarRotulos() {
    rotulos.innerHTML = '';
    rotuloEls = (mundo.planetas || []).map((p) => {
      const el = document.createElement('div'); el.className = 'jogo-rotulo';
      const n = vistos[p.key]?.size || 0, tot = STACK[p.key]?.techs.length || 0;
      el.innerHTML = `<b>${p.nome}${n && n === tot ? ' ✓' : ''}</b><span></span>`; el.style.setProperty('--cor', `hsl(${p.cor},85%,72%)`);
      rotulos.appendChild(el); return el;
    });
  }
  montarRotulos();

  function mostrarAcao(txt) {
    if (acao.dataset.txt === (txt || '')) return; acao.dataset.txt = txt || '';
    // no toque, as teclas viram os botoes da tela
    acao.innerHTML = TOQUE && txt ? txt.replace(/<kbd>Espaço<\/kbd>/g, '<kbd>▲</kbd>') : (txt || '');
    acao.classList.toggle('on', !!txt); raiz.classList.toggle('tem-acao', !!txt && /<kbd>E<\/kbd>/.test(txt));
  }
  let conquistaT = 0;
  function mostrarConquista(txt) { conquista.innerHTML = txt; conquista.classList.add('on'); clearTimeout(conquistaT); conquistaT = setTimeout(() => conquista.classList.remove('on'), 3600); }

  /* ------------------------------------------------------------ interagir -- */
  let alvoPerto = null, predioPerto = null, navePerto = false;
  function interagir() {
    if (painelAberto) { fecharPainel(); return; }
    if (s.modo === 'espaco' && alvoPerto) return comecarEntrada(alvoPerto);
    if (s.modo !== 'superficie') return;
    if (s.aPe) {
      if (predioPerto) return entrarNoPredio(predioPerto);
      if (navePerto) return embarcar();
      return;
    }
    if (s.pousado) return sairDaNave();
    if (podePousar()) pousar();
  }
  function podePousar() {
    const h = s.pos.y - mundo.alturaChao(s.pos.x, s.pos.z);
    return h < 7 && Math.hypot(s.vel.x, s.vel.z) < 9;
  }
  function pousar() {
    s.pousado = true; s.vel.set(0, 0, 0);
    mundo.levantarPoeira(s.pos.x, s.pos.z, 1);
  }
  function decolar() { s.pousado = false; s.vel.set(0, 10, 0); camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos); }

  function sairDaNave() {
    s.aPe = true; ajuda.innerHTML = AJUDA.pe;
    // desce pelo lado direito da nave, de costas para ela
    const lado = new THREE.Vector3(-Math.cos(s.rumo), 0, Math.sin(s.rumo));
    pe.pos.copy(s.pos).addScaledVector(lado, 5.2); pe.pos.y = mundo.alturaChao(pe.pos.x, pe.pos.z);
    pe.rumo = Math.atan2(lado.x, lado.z); pe.vel.set(0, 0, 0); pe.velY = 0; pe.noChao = true;
    astro.raiz.visible = true; astro.gesto('Wave');
    s.alvoRumo = pe.rumo + Math.PI * .85; s.alvoMira = -.05;    // camera vira para ver o rosto
    $('.jogo-titulo span').textContent = `explorando ${s.planeta.nome}`;
  }
  function embarcar() {
    s.aPe = false; astro.raiz.visible = false; ajuda.innerHTML = AJUDA.nave;
    camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos);
    s.alvoRumo = s.rumo; s.alvoMira = .1;
    $('.jogo-titulo span').textContent = `superfície de ${s.planeta.nome}`;
  }

  function entrarNoPredio(p) {
    astro.gesto('Interact');
    const area = STACK[s.planeta.key];
    painel.style.setProperty('--cor', `hsl(${s.planeta.cor},90%,70%)`);
    $('.jp-nivel').textContent = p.tec.nivel;
    $('.jp-area').textContent = `${area.titulo} · planeta ${s.planeta.nome}`;
    $('.jp-nome').textContent = p.tec.nome;
    $('.jp-desc').textContent = p.tec.desc;
    $('.jp-areadesc').textContent = area.desc;
    const projs = PROJETOS_POR_TECH[p.tec.nome] || area.usado.split(' · ');
    $('.jp-proj').innerHTML = projs.map((n) => ANCORA[n]
      ? `<a href="${ANCORA[n]}" data-ir="${ANCORA[n]}">${n} <span>ver no site →</span></a>`
      : `<span class="jp-semlink">${n}</span>`).join('');
    painelAberto = true; painel.classList.add('on'); raiz.classList.add('painel-on'); tecla.clear();
    // solta o mouse para dar para clicar nos links dos projetos
    if (document.pointerLockElement) document.exitPointerLock();
    if (!p.visto) {
      p.marcarVisto();
      (vistos[s.planeta.key] ||= new Set()).add(p.tec.nome);
      const n = vistos[s.planeta.key].size, tot = mundo.predios.length;
      if (n === tot) setTimeout(() => mostrarConquista(`<b>${s.planeta.nome} completo ✓</b><span>você visitou as ${tot} tecnologias desta área</span>`), 400);
    }
  }
  function fecharPainel() { painelAberto = false; painel.classList.remove('on'); raiz.classList.remove('painel-on'); travar(); }
  painel.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ir]'); if (!a) return;
    e.preventDefault(); const alvo = a.dataset.ir; fechar();
    setTimeout(() => document.querySelector(alvo)?.scrollIntoView({ behavior: 'smooth' }), 60);
  });

  /* ------------------------------------------------- entrar / sair planeta -- */
  function comecarEntrada(p) {
    s.modo = 'entrando'; s.tModo = 0; s.planeta = p; s.dobra = 0; mostrarAcao('');
    rotulos.innerHTML = ''; rotuloEls = [];
    const e = ent;
    e.c0.copy(p.pos); e.raio0 = p.raio;
    // base do planeta no ponto embaixo da nave: n = para fora, f = "frente"
    // (o que estava para cima na tela), ex = n x f
    e.n.subVectors(s.pos, p.pos); const d = e.n.length(); e.n.divideScalar(d);
    e.q0 = Math.max(.2, (d - p.raio) / p.raio);
    e.f.set(0, 1, 0).addScaledVector(e.n, -e.n.y);
    if (e.f.lengthSq() < .09) e.f.set(1, 0, 0).addScaledVector(e.n, -e.n.x);
    e.f.normalize(); e.ex.crossVectors(e.n, e.f);
    // a mesma base na superficie: o ponto de chegada (P_SUP) visto do centro do globo
    const a = V3().subVectors(P_SUP, C_SUP); e.hE = a.length() - R_GLOBO; a.normalize();
    const Ms = new THREE.Matrix4().makeBasis(V3().set(1, 0, 0), a, V3().set(0, -a.z, a.y));
    e.S2W.multiplyMatrices(new THREE.Matrix4().makeBasis(e.ex, e.n, e.f), Ms.transpose());
    e.W2S.copy(e.S2W).transpose();                       // so rotacao: transposta = inversa
    e.qS2W.setFromRotationMatrix(e.S2W); e.qW2S.copy(e.qS2W).invert();
    const S = (x, y, z) => V3().set(x, y, z).applyMatrix4(e.S2W);
    e.luz.copy(S(200, 300, 120).normalize());           // o sol da superficie, visto daqui
    const contra = e.n.clone().negate();
    // nave: como estava -> mergulho no centro -> nivelando sobre o globo
    e.qN0.copy(nave.raiz.quaternion);
    quatBase(e.ex, e.f, contra, e.qND);
    { const c = Math.cos(NAVE_MIRA_FIM), sn = Math.sin(NAVE_MIRA_FIM); quatBase(S(1, 0, 0), S(0, c, sn), S(0, -sn, c), e.qNE); }
    // camera (olha para -z local): idem, terminando onde a camera da descida comeca
    e.qC0.copy(camera.quaternion);
    quatBase(e.ex.clone().negate(), e.f, e.n, e.qCD);
    { const c = Math.cos(CAM_MIRA_FIM), sn = Math.sin(CAM_MIRA_FIM); quatBase(S(-1, 0, 0), S(0, c, sn), S(0, sn, -c), e.qCE); }
    e.off0.subVectors(camera.position, s.pos).applyQuaternion(e.qC0.clone().invert());
    e.offD.set(0, 3.5, 21);
    { const esc = ESC_SUP * .75 * zoom, c = Math.cos(FRENTE_FIM), sn = Math.sin(FRENTE_FIM);
      e.offE.set(0, -sn, c).multiplyScalar(-16.5 * esc); e.offE.y += 4.2 * esc;
      e.offE.applyMatrix4(e.S2W).applyQuaternion(e.qCE.clone().invert()); }
    // para tudo de girar (o globo e o ceu da superficie saem iguais) e monta a superficie ja
    mundo.focar(p);
    e.rot = {}; mundo.planetas.forEach((x) => { e.rot[x.key] = [x.corpo.rotation.y, x.nuvens ? x.nuvens.rotation.y : 0]; });
    const astros = mundo.planetas.filter((x) => x !== p).map((x) => ({ d: x, i: x.i, orig: x.orig.clone(), rotCorpo: e.rot[x.key][0], rotNuvens: e.rot[x.key][1] }));
    e.cenaProx = new THREE.Scene();
    e.mundoProx = criarSuperficie(e.cenaProx, p, { qW2S: e.qW2S, rotCorpo: e.rot[p.key][0], rotNuvens: e.rot[p.key][1], astros });
    if (vistos[p.key]) e.mundoProx.predios.forEach((pr) => { if (vistos[p.key].has(pr.tec.nome)) pr.marcarVisto(); });
    prepararCena(e.cenaProx);
  }
  function irParaSuperficie() {
    // leva o ponto de vista para a superficie: mesma posicao relativa, girada pela base
    const posW = s.pos.clone(), paraSup = (w) => w.sub(posW).applyMatrix4(ent.W2S).add(P_SUP);
    paraSup(camPos); paraSup(camOlha);
    FRENTE.set(0, 0, 1).applyQuaternion(ent.qN).applyMatrix4(ent.W2S);
    const v = s.vel.length();
    // a ultima imagem do espaco (camera e planeta do quadro anterior) se dissolve por cima
    trocarCena();
    rotulos.innerHTML = ''; rotuloEls = [];
    nave.raiz.scale.setScalar(ESC_SUP);
    // continua descendo em direcao a praca
    s.modo = 'descendo'; s.tModo = 0; s.pousado = false; s.aPe = false;
    s.pos.copy(P_SUP); s.rumo = Math.atan2(FRENTE.x, FRENTE.z); s.mira = Math.asin(Math.max(-1, Math.min(1, FRENTE.y))); s.vRumo = 0;
    s.vel.copy(FRENTE).multiplyScalar(v);
    s.alvoRumo = s.rumo; s.alvoMira = s.mira * .55;
    camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos);
    $('.jogo-titulo span').textContent = `superfície de ${s.planeta.nome}`;
  }
  /* Saida: o caminho inverso. Ao comecar a subir, o espaco ja e montado (com
     o planeta em escala de globo) e, la em cima, a cena troca no mesmo ponto
     de vista; o planeta encolhe ate o tamanho de verdade enquanto a nave se
     afasta, e no fim tudo volta ao lugar real. */
  function prepararSaida() {
    const p0 = s.planeta;
    ent.cenaProx = new THREE.Scene(); ent.mundoProx = criarEspaco(ent.cenaProx);
    const m = ent.mundoProx, p = m.planetas.find((x) => x.key === p0.key);
    m.planetas.forEach((x) => { const r = ent.rot[x.key]; if (r) { x.corpo.rotation.y = r[0]; if (x.nuvens) x.nuvens.rotation.y = r[1]; } });
    m.focar(p);
    prepararCena(ent.cenaProx);
  }
  function comecarSaida() {
    const e = ent;
    if (!e.mundoProx) prepararSaida();
    const p = e.mundoProx.planetas.find((x) => x.key === s.planeta.key);
    // a direcao "para fora" no mundo, embaixo de onde a nave esta agora
    _v.subVectors(s.pos, C_SUP); e.hS = _v.length() - R_GLOBO; e.altS = s.pos.y;
    e.nX.copy(_v.normalize()).applyMatrix4(e.S2W);
    e.qS = e.hS / R_GLOBO;
    const posS = s.pos.clone(), w = verdadeiroDe(posS, V3());
    // ponto de vista: mesma posicao relativa, girado para o mundo
    const paraMundo = (x) => x.sub(posS).applyMatrix4(e.S2W).add(w);
    paraMundo(camPos); paraMundo(camOlha);
    e.qN0.copy(e.qS2W).multiply(nave.raiz.quaternion);
    e.qC0.copy(e.qS2W).multiply(camera.quaternion);
    const v = s.vel.length(); s.vel.applyMatrix4(e.S2W).setLength(v);
    s.pos.copy(w);
    e.off0.subVectors(camPos, s.pos).applyQuaternion(e.qC0.clone().invert());
    // final: nariz para fora do planeta, puxado para o lado do sol (sai
    // olhando o sistema, nao o vazio), e camera atras (como a do voo)
    const fora = V3().subVectors(e.c0.clone().negate(), e.c0).normalize();      // do planeta para o sol
    fora.addScaledVector(e.nX, -fora.dot(e.nX));
    const dirF = e.nX.clone().addScaledVector(fora.lengthSq() > .01 ? fora.normalize() : fora, .85).normalize();
    const f = V3().set(0, 1, 0).addScaledVector(dirF, -dirF.y);
    if (f.lengthSq() < .09) f.set(1, 0, 0).addScaledVector(dirF, -dirF.x);
    f.normalize();
    quatBase(V3().crossVectors(f, dirF), f, dirF, e.qNF);
    quatBase(V3().crossVectors(dirF, f), f, dirF.clone().negate(), e.qCF);
    e.offF.set(0, 4.2 * 1.35 * zoom, 16.5 * 1.35 * zoom);
    trocarCena();
    s.modo = 'saindo'; s.tModo = 0; s.aPe = false; s.pousado = false;
    $('.jogo-titulo span').textContent = 'saindo para o espaço';
    aplicarSaida(0, 0);
  }
  function aplicarSaida(u, dt) {
    const e = ent, p = mundo.planetas.find((x) => x.key === s.planeta.key), ar = p.atmosfera !== false;
    const kR = suave(u / .85);
    const R = R_GLOBO * Math.pow(e.raio0 / R_GLOBO, kR);
    const q = e.qS * Math.pow(Q_FORA / e.qS, suave(u));
    const kV = suave(u / .6);
    e.qN.slerpQuaternions(e.qN0, e.qNF, suave(u / .55));
    e.qC.slerpQuaternions(e.qC0, e.qCF, kV);
    e.off.lerpVectors(e.off0, e.offF, kV);
    FRENTE.set(0, 0, 1).applyQuaternion(e.qN);
    s.vel.lerp(_v.copy(FRENTE).multiplyScalar(260 - 100 * u), 1 - Math.exp(-dt * 3));
    s.pos.addScaledVector(s.vel, dt);
    e.ver.copy(e.c0).addScaledVector(e.nX, e.raio0 * (1 + q));
    e.centro.copy(s.pos).addScaledVector(e.nX, -R * (1 + q));
    e.alt = q * R_GLOBO - (e.hS - e.altS);
    mundo.aproximar(p, { R, centro: e.centro, olho: s.pos, verdadeiro: e.ver, k: 1 - kR, m: 2 - kR,
      kCeu: ar ? 1 - suave((u - .24) / .14) : 0, kLuz: 1 - suave(u / .7), kFora: 1 - suave((u - .5) / .5), qS2W: e.qS2W, hNeb: Math.max(0, e.alt),
      halo: ar ? suave((u - .38) / .2) * (1 - suave((u - .75) / .25)) : 0, nuv: ar ? 1 - suave((u - .55) / .4) : 0, gas: ar ? suave((u - .06) / .1) * (1 - suave((u - .3) / .14)) : 0, velGas: 600 });
    nave.raiz.scale.setScalar(ESC_SUP + (1 - ESC_SUP) * kV);
    e.kLuz = 1 - suave(u / .7);
    return ar;
  }
  function terminarSaida() {
    // tudo volta ao lugar de verdade: desloca nave e camera junto (nada muda na tela)
    const d = V3().subVectors(ent.ver, s.pos);
    s.pos.add(d); camPos.add(d); camOlha.add(d);
    mundo.restaurar();
    nave.raiz.scale.setScalar(1);
    FRENTE.set(0, 0, 1).applyQuaternion(ent.qN);
    s.rumo = Math.atan2(FRENTE.x, FRENTE.z); s.mira = Math.asin(Math.max(-1, Math.min(1, FRENTE.y)));
    s.alvoRumo = s.rumo; s.alvoMira = s.mira; s.vRumo = 0; s.dobra = 0; s.banco = 0;
    camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos);
    s.modo = 'espaco'; s.tModo = 0;
    montarRotulos();
    $('.jogo-titulo span').textContent = 'pilotando';
  }

  /* ----------------------------------------------------------------- loop -- */
  const relogio = new THREE.Clock();
  let rodando = true, tTotal = 0;
  const _v = new THREE.Vector3(), _m = new THREE.Vector3();
  function quadro() {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    passo(Math.min(.05, relogio.getDelta()));
  }

  function voarNave(dt, c, naSuperficie) {
    const { acelera, freia, lado, sobe, turbo } = c;
    const limMira = naSuperficie ? .65 : 1.15;
    const dRumo = Math.atan2(Math.sin(s.alvoRumo - s.rumo), Math.cos(s.alvoRumo - s.rumo));
    s.vRumo += (Math.max(-2.6, Math.min(2.6, dRumo * 4.2)) - s.vRumo) * (1 - Math.exp(-dt * 7));
    s.rumo += s.vRumo * dt;
    s.mira += (Math.max(-limMira, Math.min(limMira, s.alvoMira)) - s.mira) * (1 - Math.exp(-dt * 4.5));
    const cm = Math.cos(s.mira);
    FRENTE.set(Math.sin(s.rumo) * cm, Math.sin(s.mira), Math.cos(s.rumo) * cm);
    const emDobra = !naSuperficie && s.dobra > .05;
    s.vel.addScaledVector(FRENTE, (acelera * (emDobra ? 1400 * s.dobra + 190 : turbo ? 95 : naSuperficie ? 42 : 190) - freia * (emDobra ? 400 : 70)) * dt);
    s.vel.x += Math.cos(s.alvoRumo) * lado * 34 * dt; s.vel.z -= Math.sin(s.alvoRumo) * lado * 34 * dt;   // lados da visao
    s.vel.y += sobe * dt * (naSuperficie ? 42 : 30);
    // arrasto: a parte lateral e forte (a nave "segura" na curva); solta, para e paira
    const frontal = FRENTE.clone().multiplyScalar(s.vel.dot(FRENTE));
    const lateral = s.vel.clone().sub(frontal); if (naSuperficie) lateral.y = 0;
    s.vel.sub(lateral.multiplyScalar(1 - Math.exp(-dt * 2.4)));
    const solto = !acelera && !freia && !lado && !sobe;
    s.vel.multiplyScalar(Math.exp(-dt * (acelera ? (emDobra ? .05 : .35) : solto ? 1.8 : .9)));
    if (naSuperficie) s.vel.y *= Math.exp(-dt * (sobe ? .9 : 3));
    const max = naSuperficie ? (turbo ? 150 : 70) : 320 + s.dobra * 1900; if (s.vel.length() > max) s.vel.setLength(s.vel.length() + (max - s.vel.length()) * (1 - Math.exp(-dt * 3)));
    s.pos.addScaledVector(s.vel, dt);
    s.banco += (Math.max(-.9, Math.min(.9, s.vRumo * .38 + lado * .35)) - s.banco) * (1 - Math.exp(-dt * 6));
    s.arfagem += (-sobe * .18 - acelera * .05 - s.arfagem) * (1 - Math.exp(-dt * 4));
  }

  function passo(dt) {
    tTotal += dt; const t = tTotal;
    s.tModo += dt;
    const T = s.tModo;
    // sem setas: quem vira e o mouse (a visao); W/A/S/D so movem, relativo a ela
    // teclado ou toque (joystick analogico)
    const acelera = Math.max(ok('KeyW') ? 1 : 0, tq.y > .15 ? tq.y : 0), freia = Math.max(ok('KeyS') ? 1 : 0, tq.y < -.15 ? -tq.y : 0);
    const lado = Math.max(-1, Math.min(1, (ok('KeyA') ? 1 : 0) - (ok('KeyD') ? 1 : 0) - (Math.abs(tq.x) > .15 ? tq.x : 0)));
    const sobe = Math.max(-1, Math.min(1, (ok('Space', 'KeyR') ? 1 : 0) - (ok('ControlLeft', 'ControlRight', 'KeyF', 'KeyC') ? 1 : 0) + tq.sobe - tq.desce));
    const turbo = (ok('ShiftLeft', 'ShiftRight') || tq.turbo > 0) && acelera > 0;
    const ctl = { acelera, freia, lado, sobe, turbo };
    let empuxo = .12, reentra = 0, tremor = 0;

    if (s.modo === 'espaco') {
      // Shift + W: entra em dobra (velocidade da luz); soltando, sai devagar
      s.dobra += ((turbo ? 1 : 0) - s.dobra) * (1 - Math.exp(-dt * (turbo ? 1.6 : 2.4)));
      voarNave(dt, ctl, false);
      for (const p of mundo.planetas) {
        _v.subVectors(s.pos, p.pos); const d = _v.length(), lim = p.raio * 1.15 + 2;
        if (d < lim) { s.pos.copy(p.pos).addScaledVector(_v.normalize(), lim); s.vel.multiplyScalar(.4); s.dobra = 0; }
      }
      { const rs = mundo.sol.raio * 1.3; _v.subVectors(s.pos, mundo.sol.pos); if (_v.length() < rs) { s.pos.copy(mundo.sol.pos).addScaledVector(_v.normalize(), rs); s.vel.multiplyScalar(.3); s.dobra = 0; } }
      // borda do sistema: so tira a parte da velocidade que vai para fora (desliza na borda)
      if (s.pos.length() > LIMITE_ESPACO) { s.pos.setLength(LIMITE_ESPACO); _v.copy(s.pos).normalize(); const fora = s.vel.dot(_v); if (fora > 0) s.vel.addScaledVector(_v, -fora); }
      empuxo = Math.max(acelera * (turbo ? 1 : .75), Math.abs(sobe) * .5, Math.abs(lado) * .4, .12, s.dobra);
      tremor = s.dobra * .12;
      fx.nuvem = Math.max(0, fx.nuvem - dt * 1.4);
      fx.veu = Math.max(0, fx.veu - dt * 1.6);
    } else if (s.modo === 'entrando' && T >= (s.planeta.atmosfera !== false ? ENT_T_AR : ENT_T)) {
      irParaSuperficie();
    } else if (s.modo === 'entrando') {
      // o planeta cresce (em escala log) ate o raio do globo da superficie e a
      // altitude relativa (h/R) cai ate a de chegada: a nave mergulha no centro,
      // entra na atmosfera (fogo, ceu ganhando cor, estrelas apagando) e nivela
      // vendo o horizonte curvo. Sem atmosfera (lua): so o chao crescendo.
      const e = ent, p = s.planeta, ar = p.atmosfera !== false;
      const u = Math.min(1, T / (ar ? ENT_T_AR : ENT_T));
      const kR = suave((u - .1) / .85);
      const R = e.raio0 * Math.pow(R_GLOBO / e.raio0, kR);
      const q = e.q0 * Math.pow(e.hE / R_GLOBO / e.q0, suave(u / .9));
      // com ar: mergulha, atravessa a camada de gas (u ~ .3-.7) e so depois nivela
      const kMerg = suave(u / .2), kPlan = ar ? suave((u - .6) / .36) : suave((u - .38) / .52);
      const gas = ar ? suave((u - .26) / .12) * (1 - suave((u - .6) / .16)) : 0;
      e.qN.slerpQuaternions(e.qN0, e.qND, kMerg).slerp(e.qNE, kPlan);
      e.qC.slerpQuaternions(e.qC0, e.qCD, kMerg).slerp(e.qCE, kPlan);
      e.off.lerpVectors(e.off0, e.offD, kMerg).lerp(e.offE, kPlan);
      FRENTE.set(0, 0, 1).applyQuaternion(e.qN);
      s.vel.copy(FRENTE).multiplyScalar(140 + 120 * kMerg + 520 * gas);
      s.pos.addScaledVector(s.vel, dt);
      e.centro.copy(s.pos).addScaledVector(e.n, -R * (1 + q));
      e.ver.copy(e.c0).addScaledVector(e.n, e.raio0 * (1 + q));
      e.alt = q * R_GLOBO - (e.hE - P_SUP.y);
      mundo.aproximar(p, { R, centro: e.centro, olho: s.pos, verdadeiro: e.ver, k: kR, m: 1 + kR,
        kCeu: ar ? suave((u - .36) / .2) : 0, kLuz: suave((u - .04) / .5), kFora: suave(u / .3), qS2W: e.qS2W, hNeb: e.alt + 20,
        halo: ar ? suave(u / .1) * (1 - suave((u - .22) / .1)) : 0, nuv: ar ? suave((u - .04) / .2) : 0, gas, velGas: 420 + 380 * gas });
      e.kLuz = suave((u - .04) / .5);
      nave.raiz.scale.setScalar(1 + (ESC_SUP - 1) * kPlan);
      s.banco *= .93; s.vRumo = 0;
      empuxo = 1;
      if (ar) { reentra = suave((u - .2) / .12) * (1 - .55 * suave((u - .65) / .3)); tremor = reentra * .3 + gas * .55; e.gas = gas; }
      else tremor = .08 * kMerg * (1 - kPlan);
    } else if (s.modo === 'descendo') {
      // do alto: o horizonte curvo do globo; desce (atravessando as nuvens, com
      // atmosfera) ate a altura de voo perto da praca
      _v.set(0, 85, -120).sub(s.pos);
      const dist = _v.length();
      const alvoVel = _v.clone().normalize().multiplyScalar(Math.min(380, 30 + dist * .55));
      s.vel.lerp(alvoVel, 1 - Math.exp(-dt * 1.3));
      s.pos.addScaledVector(s.vel, dt);
      const h = Math.hypot(s.vel.x, s.vel.z);
      s.rumo += (Math.atan2(s.vel.x, s.vel.z) - s.rumo) * (1 - Math.exp(-dt * 3));
      s.mira += (Math.atan2(s.vel.y, Math.max(1, h)) * .8 - s.mira) * (1 - Math.exp(-dt * 3));
      s.alvoRumo = s.rumo; s.alvoMira = s.mira * .55;
      empuxo = .85;
      if (mundo.atmosfera) {
        reentra = .45 * Math.max(0, 1 - T / 2.2); tremor = reentra * .5;
        fx.nuvem = Math.max(0, 1 - Math.abs(s.pos.y - 600) / 200) * .95;    // atravessando a camada de nuvens
      }
      fx.veu = 0;
      if (dist < 12 || T > 11) { s.modo = 'superficie'; s.tModo = 0; s.vel.multiplyScalar(.3); }
    } else if (s.modo === 'subindo') {
      // sobe acelerando, atravessa as nuvens e sai pelo escuro do espaco
      FRENTE.set(Math.sin(s.rumo), 0, Math.cos(s.rumo));
      _v.copy(FRENTE).multiplyScalar(80); _v.y = 360;
      s.vel.lerp(_v, 1 - Math.exp(-dt * 1.2));
      s.pos.addScaledVector(s.vel, dt);
      s.mira += (.8 - s.mira) * (1 - Math.exp(-dt * 3));
      s.alvoRumo = s.rumo; s.alvoMira = s.mira * .55;
      empuxo = 1;
      if (mundo.atmosfera) { reentra = suave((T - .6) / 1.2) * .7; tremor = reentra * .4; fx.nuvem = Math.max(0, 1 - Math.abs(s.pos.y - 600) / 200) * .95; }
      if (s.pos.y > 1500) comecarSaida();
    } else if (s.modo === 'saindo' && T >= SAI_T) {
      terminarSaida();
    } else if (s.modo === 'saindo') {
      const u = T / SAI_T;
      const ar = aplicarSaida(u, dt);
      empuxo = 1; s.banco *= .93;
      if (ar) { reentra = .7 * (1 - suave(u / .45)); tremor = reentra * .4; }
    } else if (s.modo === 'superficie') {
      fx.nuvem = 0; fx.veu = 0;
      if (!s.pousado) {
        voarNave(dt, ctl, true);
        const chao = mundo.alturaChao(s.pos.x, s.pos.z) + 1.6;
        if (s.pos.y < chao) { s.pos.y = chao; if (s.vel.y < 0) s.vel.y = 0; }
        s.pos.x = Math.max(-1300, Math.min(1300, s.pos.x)); s.pos.z = Math.max(-1300, Math.min(1300, s.pos.z));
        if (s.pos.y > 220) { s.modo = 'subindo'; s.tModo = 0; mostrarAcao(''); prepararSaida(); }
        if (s.pos.y - chao < 14 && acelera + Math.abs(sobe) > 0) mundo.levantarPoeira(s.pos.x, s.pos.z, .04);
        empuxo = Math.max(acelera * (turbo ? 1 : .75), Math.abs(sobe) * .5, Math.abs(lado) * .4, .14);
      } else {
        empuxo = 0;
        if (!s.aPe && sobe > 0) decolar();
      }
      if (s.aPe) andarAPe(dt, ctl);
    }

    // nave
    nave.raiz.position.copy(s.pos);
    nave.raiz.rotation.order = 'YXZ';
    const cinema = s.modo === 'entrando' || s.modo === 'saindo';
    if (cinema) nave.raiz.quaternion.copy(ent.qN);
    else { nave.raiz.rotation.y = s.rumo; nave.raiz.rotation.x = -s.mira; nave.raiz.rotation.z = 0; }
    nave.corpo.rotation.z = -s.banco; nave.corpo.rotation.x = s.arfagem;
    nave.corpo.position.y += ((s.pousado ? -.25 : Math.sin(t * 2) * .12) - nave.corpo.position.y) * .1;
    nave.reentrada(reentra);
    nave.atualizar(dt, empuxo, turbo || cinema || s.modo === 'subindo', t);
    astro.atualizar(dt, s.aPe ? Math.hypot(pe.vel.x, pe.vel.z) : 0);

    // mira (mouse e setas)
    const livre = s.modo === 'espaco' || s.modo === 'superficie';
    if (livre) {
      s.alvoRumo -= mdx * .0024;
      const lim = s.aPe ? .9 : s.pousado ? 1.1 : (s.modo === 'superficie' ? .65 : 1.15);
      s.alvoMira = Math.max(-lim, Math.min(lim, s.alvoMira - mdy * .002));
    }
    mdx = 0; mdy = 0;

    // camera
    const veloc = s.aPe ? Math.hypot(pe.vel.x, pe.vel.z) : s.vel.length();
    const cmv = Math.cos(s.alvoMira);
    FRENTE.set(Math.sin(s.alvoRumo) * cmv, Math.sin(s.alvoMira), Math.cos(s.alvoRumo) * cmv);
    if (cinema) {
      // cinematica: orientacao e deslocamento da camera vem da entrada
      camPos.copy(ent.off).applyQuaternion(ent.qC).add(s.pos);
      camOlha.set(0, 0, -40).applyQuaternion(ent.qC).add(camPos);
      camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos);
    } else if (s.aPe) {
      // terceira pessoa a pe: atras e acima do astronauta
      const R = 6.5 * zoom, el = Math.max(-.15, Math.min(1, .22 - s.alvoMira));
      _m.copy(pe.pos); _m.y += 1.6;
      _v.set(_m.x - Math.sin(s.alvoRumo) * Math.cos(el) * R, _m.y + Math.sin(el) * R, _m.z - Math.cos(s.alvoRumo) * Math.cos(el) * R);
      const chaoCam = mundo.alturaChao(_v.x, _v.z) + .5; if (_v.y < chaoCam) _v.y = chaoCam;
      camPos.lerp(_v, 1 - Math.exp(-dt * 10));
      _m.x += Math.sin(s.alvoRumo) * 1.5; _m.z += Math.cos(s.alvoRumo) * 1.5;
    } else if (s.pousado) {
      const R = 22 * zoom, el = Math.max(.05, .25 - s.alvoMira);
      _v.set(s.pos.x - Math.sin(s.alvoRumo) * Math.cos(el) * R, s.pos.y + 3 + Math.sin(el) * R, s.pos.z - Math.cos(s.alvoRumo) * Math.cos(el) * R);
      camPos.lerp(_v, 1 - Math.exp(-dt * 8));
      _m.copy(s.pos); _m.y += 2;
    } else {
      const escala = s.modo === 'espaco' ? 1.35 : ESC_SUP * .75;
      // em dobra a camera chega um pouco mais perto: o efeito fica em volta, a nave perto
      const atras = (12 + Math.min(veloc, 150) * .03) * (1 - s.dobra * .22) * zoom * escala;
      _v.copy(s.pos).addScaledVector(FRENTE, -atras); _v.y += 4.2 * (1 - s.dobra * .2) * zoom * escala;
      // suaviza o deslocamento em relacao a nave, nao a posicao no mundo
      _v.sub(s.pos); camRel.lerp(_v, 1 - Math.exp(-dt * 9));
      camPos.copy(s.pos).add(camRel);
      _m.copy(s.pos).addScaledVector(FRENTE, 12 * escala); _m.y += 1;
      _m.sub(s.pos); olhaRel.lerp(_m, 1 - Math.exp(-dt * 14)); _m.copy(s.pos).add(olhaRel);
    }
    if (cinema) { /* ja posicionada */ }
    else if (s.aPe || s.pousado) camOlha.lerp(_m, 1 - Math.exp(-dt * 14)); else camOlha.copy(_m);   // em voo ja vem suavizado (relativo)
    camera.position.copy(camPos);
    if (tremor) camera.position.add(_v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(tremor * .45));
    if (cinema) camera.quaternion.copy(ent.qC); else camera.lookAt(camOlha);
    const fov = s.aPe ? 60 : 62 + Math.min(1, veloc / 150) * 10 + s.dobra * 14 + (s.modo === 'entrando' ? tremor * 8 + (ent.gas || 0) * 10 : 0);
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * .1; camera.updateProjectionMatrix(); }

    // overlays da tela
    fx.calor += (reentra - fx.calor) * .15;
    calor.style.opacity = fx.calor.toFixed(3);
    dobraUI.style.opacity = s.dobra.toFixed(3);
    if (s.dobra > .01) dobraUI.style.setProperty('--giro', ((t * 40) % 360).toFixed(1) + 'deg');
    nuvensUI.style.opacity = fx.nuvem.toFixed(3);
    veuUI.style.opacity = fx.veu.toFixed(3); if (fx.veu > .001) veuUI.style.background = fx.veuCor;
    if (fx.nuvem > .01) nuvensUI.style.setProperty('--z', (1 + (t * .9) % 1).toFixed(3));

    // superficie: ceu/neblina pela camera, e os outros planetas onde estao de verdade
    const naSup = !mundo.planetas;
    mundo.atualizar(dt, t, camera, naSup ? { verdadeiro: verdadeiroDe(camera.position, ent.ver), W2S: ent.W2S, m: 2 } : { vel: s.vel, dobra: s.dobra });
    atualizarHUD(veloc);
    desenharRadar();
    // exposicao: a do site no espaco (1.24), a normal na superficie
    const expo = mundo.planetas ? (cinema ? 1.24 - .24 * (ent.kLuz || 0) : 1.24) : 1;
    if (renderer.toneMappingExposure !== expo) renderer.toneMappingExposure = expo;
    if (s.dobra > .02) {
      // dobra: cena na textura, depois a distorcao em volta
      renderer.setRenderTarget(rt); renderer.render(cena, camera); renderer.setRenderTarget(null);
      posMat.uniforms.forca.value = s.dobra; posMat.uniforms.tempo.value = t;
      renderer.render(posCena, posCam);
    } else renderer.render(cena, camera);
    if (dissolve > 0) {
      fotoMat.uniforms.alfa.value = suave(dissolve);
      renderer.autoClear = false; renderer.render(fotoCena, posCam); renderer.autoClear = true;
      dissolve = Math.max(0, dissolve - dt / .9);
    }
  }

  /* ------------------------------------------------------------------ a pe -- */
  function andarAPe(dt, c) {
    if (painelAberto) { pe.vel.set(0, 0, 0); }
    else {
      const fx2 = Math.sin(s.alvoRumo), fz = Math.cos(s.alvoRumo);
      _v.set(fx2 * (c.acelera - c.freia) + fz * c.lado, 0, fz * (c.acelera - c.freia) - fx2 * c.lado);
      const correndo = ok('ShiftLeft', 'ShiftRight') || tq.turbo > 0;
      // analogico: joystick pela metade anda mais devagar
      if (_v.lengthSq() > 0) { const f = Math.min(1, _v.length()); _v.normalize().multiplyScalar((correndo ? 6.8 : 3.4) * f); }
      pe.vel.lerp(_v, 1 - Math.exp(-dt * (pe.noChao ? 10 : 2)));
    }
    pe.pos.addScaledVector(pe.vel, dt);
    // colisao: predios e nave
    for (const p of mundo.predios) {
      _v.set(pe.pos.x - p.pos.x, 0, pe.pos.z - p.pos.z); const d = _v.length();
      if (d < p.raio) { _v.multiplyScalar(p.raio / Math.max(d, .001)); pe.pos.x = p.pos.x + _v.x; pe.pos.z = p.pos.z + _v.z; }
    }
    _v.set(pe.pos.x - s.pos.x, 0, pe.pos.z - s.pos.z); { const d = _v.length(), r = 4.3; if (d < r) { _v.multiplyScalar(r / Math.max(d, .001)); pe.pos.x = s.pos.x + _v.x; pe.pos.z = s.pos.z + _v.z; } }
    pe.pos.x = Math.max(-600, Math.min(600, pe.pos.x)); pe.pos.z = Math.max(-600, Math.min(600, pe.pos.z));
    // pulo e chao
    const chao = mundo.alturaChao(pe.pos.x, pe.pos.z);
    pe.velY -= 16 * dt; pe.pos.y += pe.velY * dt;
    if (pe.pos.y <= chao) { pe.pos.y = chao; pe.velY = 0; pe.noChao = true; }
    // vira para onde anda
    const v = Math.hypot(pe.vel.x, pe.vel.z);
    if (v > .3) { const alvo = Math.atan2(pe.vel.x, pe.vel.z); pe.rumo += Math.atan2(Math.sin(alvo - pe.rumo), Math.cos(alvo - pe.rumo)) * (1 - Math.exp(-dt * 12)); }
    astro.raiz.position.copy(pe.pos); astro.raiz.rotation.y = pe.rumo;
  }

  /* ------------------------------------------------------------------- HUD -- */
  // o planeta p esta atras de outro (ou do sol), visto da camera?
  const _r = new THREE.Vector3(), _o = new THREE.Vector3();
  function escondido(p) {
    _r.subVectors(p.pos, camera.position); const dist = _r.length(); _r.divideScalar(dist);
    const tapa = (c, raio) => { _o.subVectors(c, camera.position); const t = _o.dot(_r); return t > 0 && t < dist && _o.addScaledVector(_r, -t).length() < raio; };
    if (tapa(mundo.sol.pos, mundo.sol.raio)) return true;
    return mundo.planetas.some((x) => x !== p && tapa(x.pos, x.raio));
  }
  function atualizarHUD(veloc) {
    elVel.textContent = Math.round(veloc * 3.6) + ' km/h';
    barraVel.style.transform = `scaleX(${Math.min(1, veloc / (s.aPe ? 7 : s.modo === 'espaco' ? 2200 : 150)).toFixed(3)})`;
    elVelRot.textContent = s.aPe ? 'A PÉ' : s.dobra > .3 ? '⚡ VELOCIDADE DA LUZ' : 'VELOCIDADE';
    predioPerto = null; navePerto = false;
    if (s.modo === 'espaco') {
      let melhor = null, dm = Infinity;
      mundo.planetas.forEach((p, i) => {
        const d = s.pos.distanceTo(p.pos) - p.raio;
        if (d < dm) { dm = d; melhor = p; }
        _v.copy(p.pos); _v.y += p.raio * 1.4; _v.project(camera);
        const el = rotuloEls[i]; const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1 && !escondido(p);
        el.style.opacity = vis ? '1' : '0';
        if (vis) { el.style.transform = `translate(${((_v.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - _v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-100%)`; el.lastChild.textContent = Math.max(0, Math.round(d)) + ' m'; }
      });
      elAlvoRot.textContent = 'ALVO'; elAlvo.textContent = melhor ? melhor.nome : '—'; elDist.textContent = melhor ? Math.round(dm) + ' m' : '';
      alvoPerto = melhor && dm < melhor.raio * 1.9 ? melhor : null;
      mostrarAcao(alvoPerto ? `<kbd>E</kbd> entrar em <b>${alvoPerto.nome}</b>` : '');
    } else if (s.modo === 'superficie') {
      const area = STACK[s.planeta.key];
      const n = vistos[s.planeta.key]?.size || 0;
      if (s.aPe) {
        elAlvoRot.textContent = area.titulo.toUpperCase(); elAlvo.textContent = `${n}/${mundo.predios.length}`; elDist.textContent = 'tecnologias visitadas';
        let dmin = 3.4;
        for (const p of mundo.predios) { const d = Math.hypot(pe.pos.x - p.porta.x, pe.pos.z - p.porta.z); if (d < dmin) { dmin = d; predioPerto = p; } }
        navePerto = Math.hypot(pe.pos.x - s.pos.x, pe.pos.z - s.pos.z) < 7.5;
        if (painelAberto) mostrarAcao('');
        else if (predioPerto) mostrarAcao(`<kbd>E</kbd> entrar em <b>${predioPerto.tec.nome}</b>`);
        else if (navePerto) mostrarAcao('<kbd>E</kbd> embarcar na nave');
        else mostrarAcao('');
      } else {
        const h = Math.max(0, s.pos.y - mundo.alturaChao(s.pos.x, s.pos.z) - 1.6);
        elAlvoRot.textContent = 'ALTITUDE'; elAlvo.textContent = Math.round(h) + ' m'; elDist.textContent = `${area.titulo} · ${n}/${mundo.predios.length} visitadas`;
        if (s.pousado) mostrarAcao(`<b>Pousado em ${s.planeta.nome}</b><span><kbd>E</kbd> sair da nave e explorar · <kbd>Espaço</kbd> decolar</span>`);
        else mostrarAcao(podePousar() ? '<kbd>E</kbd> pousar' : (h > 160 ? 'subindo… <kbd>Espaço</kbd> sai do planeta' : 'desça até o chão para pousar · os prédios da stack ficam em volta da plataforma'));
      }
    } else {
      if (s.modo === 'entrando' || s.modo === 'saindo') { elAlvoRot.textContent = 'ALTITUDE'; elAlvo.textContent = Math.round(Math.max(0, ent.alt)).toLocaleString('pt-BR') + ' m'; elDist.textContent = `${s.modo === 'saindo' ? 'saindo de' : 'entrando em'} ${s.planeta.nome}`; }
      if (s.modo === 'descendo' || s.modo === 'subindo') { elAlvoRot.textContent = 'ALTITUDE'; elAlvo.textContent = Math.round(Math.max(0, s.pos.y)) + ' m'; elDist.textContent = s.planeta ? s.planeta.nome : ''; }
      mostrarAcao('');
    }
  }

  function desenharRadar() {
    const W = 300, c = radar; c.clearRect(0, 0, W, W);
    c.save(); c.translate(W / 2, W / 2);
    c.strokeStyle = 'rgba(169,139,255,.25)'; c.lineWidth = 2;
    [140, 95, 50].forEach((r) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); });
    let quem = s.pos, rumo = s.rumo;
    if (mundo.planetas) {
      const esc = 140 / LIMITE_ESPACO;
      if (s.modo !== 'espaco') quem = ent.ver;   // na entrada/saida a nave "de verdade" esta ali
      c.fillStyle = '#fff1d6'; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
      mundo.planetas.forEach((p) => {
        const pp = p.orig;              // na entrada/saida os planetas sao reposicionados no ceu
        c.fillStyle = `hsl(${p.cor},85%,68%)`;
        c.beginPath(); c.arc(pp.x * esc, pp.z * esc, 3 + p.tam * 4, 0, Math.PI * 2); c.fill();
      });
      c.translate(quem.x * esc, quem.z * esc);
    } else if (mundo.predios) {
      // superficie: a praca (predios em anel) e a nave
      const esc = 140 / 80;
      if (s.aPe) { quem = pe.pos; rumo = pe.rumo; }
      mundo.predios.forEach((p) => {
        c.fillStyle = p.visto ? '#2bff8f' : `hsl(${s.planeta.cor},85%,68%)`;
        c.fillRect(p.pos.x * esc - 6, p.pos.z * esc - 6, 12, 12);
      });
      if (s.aPe) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s.pos.x * esc, s.pos.z * esc, 7, 0, Math.PI * 2); c.fill(); }
      c.translate(Math.max(-140, Math.min(140, quem.x * esc)), Math.max(-140, Math.min(140, quem.z * esc)));
    }
    c.rotate(-rumo + Math.PI);
    c.fillStyle = '#2bff8f'; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath(); c.fill();
    c.restore();
  }

  requestAnimationFrame(quadro);
  // modo de teste (?debugjogo): avanca a simulacao sem depender do rAF
  if (/debugjogo/.test(location.search)) { semTrava = true; raiz.classList.add('sem-trava'); }   // teste: sem convite de clique
  if (/debugjogo/.test(location.search)) window.__jogo = { s, pe, tecla, mouse: (x, y) => { mdx += x; mdy += y; }, passo: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) passo(dt); }, interagir, get alvo() { return alvoPerto; }, get mundo() { return mundo; }, get predioPerto() { return predioPerto; } };

  function fechar() {
    rodando = false;
    removeEventListener('keydown', baixo); removeEventListener('keyup', cima); removeEventListener('resize', medir);
    removeEventListener('mousemove', aoMover); document.removeEventListener('pointerlockchange', aoTravar);
    if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
    tecla.clear(); clearTimeout(conquistaT);
    nave?.destruir(); astro?.destruir(); mundo.destruir(); ent.mundoProx?.destruir();
    rt.dispose(); posMat.dispose(); fotoTex?.dispose(); fotoMat.dispose(); removeEventListener('resize', medirPos);
    renderer.dispose(); renderer.forceContextLoss();
    raiz.remove();
    document.documentElement.classList.remove('jogo-aberto');
    window.__jogoAberto = false;
  }
}
