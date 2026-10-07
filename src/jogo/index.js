import * as THREE from 'three';
import './jogo.css';
import { criarNave, matizDe, corCss } from './nave.js';
import { criarAstronauta } from './astronauta.js';
import { criarEspaco, criarSuperficie, LIMITE_ESPACO, R_GLOBO } from './cenas.js';
import { STACK, PROJETOS_POR_TECH, ANCORA } from './dados.js';
import { criarSom } from './som.js';
import { criarTiros } from './tiros.js';
import { desenharMapa } from './mapa.js';
import { criarInterior, RAIO_SALA } from './interior.js';
import { emblema } from './predios.js';
import { criarRoda, desenharSilhueta } from './roda.js';
import { criarRede } from './rede.js';
import { criarVoz } from './voz.js';
import { sessao, HOST_SALAS } from '../conta.js';

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
      <div class="jogo-titulo"><b>STACK UNIVERSE</b><span>pilotando</span><em class="jogo-conta"></em></div>
      <div class="jogo-botoes-topo"><button class="jogo-pvp" type="button" title="PvP (P)">⚔ PvP</button><button class="jogo-mapa-bt" type="button" title="mapa (M)">🗺</button><button class="jogo-som" type="button" title="som (N)">🔊</button><button class="jogo-sair" type="button">ESC · SAIR</button></div>
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
    <div class="jogo-comb"><small>JETPACK</small><i><em></em></i></div>
    <canvas class="jogo-mapa"></canvas>
    <div class="jogo-destino"><i></i><b></b><span></span></div>
    <div class="jogo-arma"><i></i><header><b></b></header><div class="ja-3d"></div><div class="ja-slots"></div></div>
    <div class="jogo-troca"><canvas width="360" height="140"></canvas><b></b><span></span></div>
    <div class="jogo-inventario"><h4>INVENTÁRIO · <span>TAB fecha · 1–4 ou clique</span></h4><div class="ji-slots"></div></div>
    <canvas class="jogo-roda"></canvas>
    <div class="jogo-online"></div>
    <div class="jogo-feed"></div>
    <div class="jogo-voz"></div>
    <div class="jogo-vida"><small>VIDA</small><i><em></em></i><span>100</span></div>
    <div class="jogo-placar"></div>
    <div class="jogo-tab"><h4>PLACAR · <span></span></h4><table><thead><tr><th>jogador</th><th>PvP</th><th>abates</th><th>mortes</th></tr></thead><tbody></tbody></table><p>segure TAB para ver · P liga/desliga o PvP</p></div>
    <div class="jogo-morte"><b></b><span>renascendo…</span></div>
    <div class="jogo-dano"></div>
    <div class="jogo-predio" aria-live="polite">
      <div class="jp-topo"><span class="jp-nivel"></span><span class="jp-area"></span></div>
      <h3 class="jp-nome"></h3>
      <p class="jp-desc"></p>
      <div class="jp-sec"><small>NA ÁREA</small><p class="jp-areadesc"></p></div>
      <div class="jp-sec"><small>USADO EM</small><div class="jp-proj"></div></div>
      <div class="jp-pe"><span class="jp-teclas"><kbd>E</kbd> ou <kbd>Esc</kbd> sair do prédio</span><button type="button" class="jp-fechar">✕ sair do prédio</button></div>
    </div>
    <div class="jogo-conquista"></div>
    <div class="jogo-bemvindo"><small></small><b></b><span></span></div>
    <div class="jogo-toque">
      <div class="jt-area"></div>
      <div class="jt-joy"><i></i></div>
      <div class="jt-botoes">
        <button type="button" data-b="turbo" aria-label="turbo / correr">⚡</button>
        <button type="button" data-b="sobe" aria-label="subir / pular / decolar">▲</button>
        <button type="button" data-b="acao" aria-label="interagir">E</button>
        <button type="button" data-b="desce" aria-label="descer">▼</button>
        <button type="button" data-b="tiro" aria-label="atirar">✦</button>
        <button type="button" data-b="mapa" aria-label="mapa">🗺</button>
        <button type="button" data-b="arma" aria-label="trocar arma">🔫</button>
      </div>
      <div class="jt-dica">arraste à esquerda para mover · à direita para olhar</div>
    </div>
    <div class="jogo-pausa">
      <small>PAUSADO</small>
      <button type="button" class="jp-continuar">▶ continuar</button>
      <button type="button" class="jp-sair">✕ sair do jogo</button>
      <span>o mouse fica preso ao jogo e vira a mira · <kbd>Esc</kbd> pausa · <kbd>Esc</kbd> de novo sai</span>
    </div>
    <div class="jogo-carregando">carregando a nave…</div>`;
  document.body.appendChild(raiz);
  const $ = (q) => raiz.querySelector(q);
  const canvas = $('.jogo-canvas'), acao = $('.jogo-acao'), calor = $('.jogo-calor'), nuvensUI = $('.jogo-nuvens'), dobraUI = $('.jogo-dobra'), veuUI = $('.jogo-veu');
  const elVel = $('.jogo-vel b'), elVelRot = $('.jogo-vel small'), barraVel = $('.jogo-vel em'), elAlvo = $('.jogo-alvo b'), elAlvoRot = $('.jogo-alvo small'), elDist = $('.jogo-alvo span');
  const radar = $('.jogo-radar').getContext('2d');
  const combUI = $('.jogo-comb em');
  const rotulos = $('.jogo-rotulos'), painel = $('.jogo-predio'), conquista = $('.jogo-conquista');

  const AJUDA = {
    nave: `<span><kbd>W</kbd><kbd>S</kbd> acelerar / frear</span><span><kbd>A</kbd><kbd>D</kbd> para os lados</span>
      <span><kbd>Espaço</kbd><kbd>Ctrl</kbd> subir / descer</span><span><kbd>Shift</kbd>+<kbd>W</kbd> velocidade da luz</span><span><kbd>E</kbd> interagir</span><span><kbd>Mouse</kbd> visão / direção · rodinha = zoom</span><span><kbd>Botão dir.</kbd> mirar (zoom)</span><span><kbd>T</kbd> voz perto · <kbd>Y</kbd> rádio</span>`,
    pe: `<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> andar</span><span><kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular · <kbd>C</kbd> rolar</span><span><kbd>Botão dir.</kbd> mirar</span><span><kbd>T</kbd> voz perto · <kbd>Y</kbd> rádio</span>
      <span><kbd>Espaço</kbd> no ar = jetpack · <kbd>Espaço</kbd>/<kbd>Ctrl</kbd> sobe/desce · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> voa</span>
      <span><kbd>E</kbd> entrar no prédio / embarcar</span><span><kbd>Mouse</kbd> câmera · rodinha = zoom</span>`
  };
  const ajuda = $('.jogo-ajuda'); ajuda.innerHTML = AJUDA.nave;
  // o clique em "Pilotar" ainda vale como gesto do usuario: trava o mouse ja
  let semTrava = false;
  // a trava e no documento inteiro: o botao "Pilotar" ja pediu no clique (Safari
  // so aceita no gesto); daqui em diante, cliques no jogo pedem de novo
  const preso = () => !!document.pointerLockElement;
  // pausa = mouse solto no desktop (o menu "continuar / sair" esta na tela)
  const pausado = () => !preso() && !semTrava && !painelAberto && !mapaAberto && !inventarioAberto && !!s;
  const travar = () => { if (preso() || semTrava) return; try { const r = document.documentElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* */ } };
  // estado declarado antes de carregar: o teclado ja escuta durante o carregamento
  let miraAbre = 0, roda = { aberta: false }, rede = null;   // a roda de verdade e criada depois de carregar
  let s = null, painelAberto = false, mapaAberto = false, inventarioAberto = false, tiros = null, armaIdx = 0, navArmaIdx = 0, abalo = 0;
  const som = criarSom();
  const pe = { pos: new THREE.Vector3(), rumo: 0, vel: new THREE.Vector3(), velY: 0, noChao: true, voando: false, rolando: 0 };

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
    som.destravar();
    if (e.key === 'Escape') {
      if (e.repeat) return;
      if (mapaAberto) { alternarMapa(false); if (!document.pointerLockElement) return; }
      if (inventarioAberto) { alternarInventario(false); return; }
      if (painelAberto) { fecharPainel(); return; }
      // 1o Esc: o navegador solta o mouse e o jogo pausa (menu continuar/sair).
      // Esc de novo, com o menu ja na tela, sai. Conforme o navegador, o Esc
      // que soltou o mouse chega aqui antes ou um pouco depois de soltar: esse
      // e ignorado (meio segundo de folga)
      if (document.pointerLockElement) { document.exitPointerLock(); return; }
      if (!semTrava && performance.now() - soltouEm < 500) return;
      fechar(); return;
    }
    if (!s) return;                                   // ainda carregando
    tecla.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) interagir();
    if (e.code === 'KeyM' && !e.repeat) alternarMapa();
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) mostrarTab(true); }
    if (e.code === 'KeyI') { if (!e.repeat) { if (roda.aberta) fecharRoda(true); else abrirRoda(); } }
    if (e.code === 'KeyV' && !e.repeat && s.aPe) alternarPrimeiraPessoa();
    if (/^Digit[1-4]$/.test(e.code) && !e.repeat) escolherArma(+e.code.slice(5) - 1, s.aPe);
    if (e.code === 'KeyN' && !e.repeat) alternarSom();
    if (e.code === 'KeyP' && !e.repeat) alternarPvp();
    // voz: T segurado fala para quem esta perto; Y segurado fala no radio (todos)
    if ((e.code === 'KeyT' || e.code === 'KeyY') && !e.repeat) falarVoz(e.code === 'KeyY' ? 'geral' : 'perto');
    if (e.code === 'KeyC' && !e.repeat && s.aPe && pe.noChao && !painelAberto) rolar();
    if (e.code === 'Space' && !e.repeat && s.aPe && !painelAberto) { if (pe.noChao) pular(); else ligarJetpack(); }
    if (e.code === 'Space') e.preventDefault();
  };
  const cima = (e) => {
    tecla.delete(e.code);
    // TAB segurado e solto: equipa o que esta apontado (um toque rapido deixa a roda aberta)
    if (e.code === 'Tab') mostrarTab(false);
    if ((e.code === 'KeyT' && voz?.falando === 'perto') || (e.code === 'KeyY' && voz?.falando === 'geral')) voz.falar(null);
    if (e.code === 'KeyI' && roda.aberta && performance.now() - rodaDesde > 220) fecharRoda(true);
  };
  addEventListener('keydown', baixo); addEventListener('keyup', cima);
  addEventListener('blur', () => { tecla.clear(); voz?.falar(null); });
  $('.jogo-sair').addEventListener('click', () => fechar());
  $('.jogo-som').addEventListener('click', () => alternarSom());
  $('.jogo-mapa-bt').addEventListener('click', () => alternarMapa());
  function alternarSom() { som.destravar(); const m = som.alternarMudo(); $('.jogo-som').textContent = m ? '🔇' : '🔊'; }
  if (som.mudo) $('.jogo-som').textContent = '🔇';

  /* Mouse = mira (terceira pessoa): o MOVIMENTO do mouse gira a mira e a
     camera na hora; a nave persegue a mira com inercia. Mouse parado, nada
     gira. Funciona sem travar o ponteiro; clicar trava, se o navegador
     deixar. Rodinha = zoom. */
  let mdx = 0, mdy = 0, zoom = 1, soltouEm = 0, ultX = null, ultY = null;
  // clique: com o mouse preso atira (segurar = rajada); solto, trava o mouse
  let voz = null, vozSuja = true, vozT = 0;
  let atirando = false, mirandoBt = false, mirarK = 0;   // mirarK: 0..1 suave
  // com o mouse preso o clique chega no <html> (o elemento travado), nao no
  // canvas: por isso escuta no documento
  // botao esquerdo atira; o direito (segurando) mira: a pe a camera chega no
  // ombro e fecha o angulo, na nave so da um zoom
  const aoApertar = (e) => {
    som.destravar();
    if (TOQUE || !(preso() || (semTrava && e.target === canvas)) || inventarioAberto || mapaAberto) return;
    if (e.button === 0) atirando = true; else if (e.button === 2) mirandoBt = true;
  };
  const aoSoltar = (e) => { if (e.button === 2) mirandoBt = false; else atirando = false; };
  const semMenu = (e) => { if (raiz.isConnected) e.preventDefault(); };
  document.addEventListener('contextmenu', semMenu);
  document.addEventListener('mousedown', aoApertar); addEventListener('mouseup', aoSoltar);
  canvas.addEventListener('click', travar);
  $('.jogo-pausa').addEventListener('click', (e) => { if (!e.target.closest('.jp-sair')) travar(); });
  $('.jp-sair').addEventListener('click', (e) => { e.stopPropagation(); fechar(); });
  // navegador sem trava: cai no modo solto (o movimento do mouse mira mesmo assim)
  document.addEventListener('pointerlockerror', () => { semTrava = true; raiz.classList.add('sem-trava'); });
  const aoMover = (e) => {
    let dx = e.movementX, dy = e.movementY;
    if (dx === undefined) { dx = ultX === null ? 0 : e.clientX - ultX; dy = ultY === null ? 0 : e.clientY - ultY; }
    ultX = e.clientX; ultY = e.clientY;
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
    if (roda.aberta) { if (preso()) roda.mover(dx, dy); else roda.apontar(e.clientX, e.clientY); return; }
    if (!painelAberto && !mapaAberto && !inventarioAberto && (preso() || semTrava)) { mdx += dx; mdy += dy; }
  };
  const aoTravar = () => {
    raiz.classList.toggle('mouse-preso', preso());
    if (!preso()) soltouEm = performance.now();
  };
  // rodinha: para cima aproxima a camera, para baixo afasta
  const aoRodar = (e) => { e.preventDefault(); zoom = Math.max(.6, Math.min(2.2, zoom * (1 - Math.sign(e.deltaY) * .1))); };
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
        som.destravar();
        if (k === 'acao') { if (s) interagir(); return; }
        if (k === 'mapa') { alternarMapa(); return; }
        if (k === 'arma') { if (s?.aPe) escolherArma((armaIdx + 1) % ARMAS.length, true); else escolherArma((navArmaIdx + 1) % NAVE_ARMAS.length, false); return; }
        if (k === 'tiro') { atirando = true; return; }
        tq[k] = 1;
        if (k === 'sobe' && s && s.aPe && !painelAberto) { if (pe.noChao) pular(); else ligarJetpack(); }
      });
      const fim = () => { b.classList.remove('on'); if (k === 'tiro') atirando = false; else if (k !== 'acao' && k !== 'mapa' && k !== 'arma') tq[k] = 0; };
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
  tiros = criarTiros(); cena.add(tiros.grupo);
  /* ---- online (precisa de conta): uma sala por lugar ---- */
  const sess = sessao();
  // minha nave na minha cor (a mesma que os outros veem); admin: roxa e rosa
  let souAdm = false;
  const minhaCor = () => corCss(matizDe(sess?.usuario), souAdm);
  if (sess) nave.pintar({ matiz: matizDe(sess.usuario) });
  voz = sess ? criarVoz({ token: sess.token, host: HOST_SALAS, aoMudar: () => { vozSuja = true; }, aoErro: (msg) => mostrarConquista(`<b>🎙 sem microfone</b><span>${msg}</span>`) }) : null;
  rede = sess ? criarRede({ token: sess.token, host: HOST_SALAS, modeloNave: nave.modeloBase, aoEvento: (tipo, m) => eventoRede(tipo, m) }) : null;
  const salaAtual = () => (mundo.planetas ? 'espaco' : 'planeta-' + s.planeta.key);
  queueMicrotask(() => rede?.entrar(salaAtual()));
  queueMicrotask(() => cena.add(vista1));
  let cadencia = 0, dobraAnt = 0, jetAgora = 0;

  s = {
    modo: 'espaco', pos: new THREE.Vector3(-3090, 1340, 5970), rumo: Math.atan2(3090, -5970), vel: new THREE.Vector3(),
    banco: 0, arfagem: 0, planeta: null, pousado: false, tModo: 99,   // 99: sem o plasma de quem acabou de sair de um planeta
    mira: -.15, alvoRumo: Math.atan2(3090, -5970), alvoMira: -.15, vRumo: 0,   // comeca olhando o sistema, como no site
    dobra: 0,                        // 0..1: Shift no espaco = velocidade da luz
    aPe: false, dentro: null
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
    destino = null;
    // redesenha o quadro anterior e copia a tela (no mesmo instante: o buffer da tela nao e preservado)
    const tam = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!fotoTex || fotoTex.image.width !== tam.x || fotoTex.image.height !== tam.y) { fotoTex?.dispose(); fotoTex = new THREE.FramebufferTexture(tam.x, tam.y); fotoMat.uniforms.tFoto.value = fotoTex; }
    renderer.render(cena, camera); renderer.copyFramebufferToTexture(fotoTex); dissolve = 1;
    mundo.destruir();
    cena = ent.cenaProx; mundo = ent.mundoProx; ent.cenaProx = ent.mundoProx = null;
    cena.add(nave.raiz, nave.rastro, astro.raiz, astro.fumaca, tiros.grupo, vista1);
    queueMicrotask(() => rede?.entrar(salaAtual()));   // outro lugar = outra sala
  }
  const _mb = new THREE.Matrix4();
  const quatBase = (x, y, z, q) => q.setFromRotationMatrix(_mb.makeBasis(x, y, z));
  const fx = { calor: 0, nuvem: 0, veu: 0, veuCor: '#000' };   // overlays da tela
  const vistos = {};                               // planeta -> Set de tecnologias vistas

  const FRENTE = new THREE.Vector3();
  const camPos = new THREE.Vector3(-3100, 1350, 5990), camOlha = new THREE.Vector3();
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
      if (s.dentro) {
        if (perto(s.dentro.int.terminal, 2.2)) { som.bip(); return abrirPainel(s.dentro.p); }
        if (perto(s.dentro.int.porta, 2.6)) return sairDoPredio();
        return;
      }
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
    s.pousado = true; s.vel.set(0, 0, 0); som.pouso();
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

  /* ---- interior dos predios: um salao montado la embaixo (y -3000), so
     enquanto se esta dentro. Terminal = painel com os links dos projetos. ---- */
  const BASE_INT = new THREE.Vector3(0, -3000, 0);
  const perto = (local, r) => Math.hypot(pe.pos.x - BASE_INT.x - local.x, pe.pos.z - BASE_INT.z - local.z) < r;
  function entrarNoPredio(p) {
    const area = STACK[s.planeta.key], lixoInt = [];
    const projs = PROJETOS_POR_TECH[p.tec.nome] || area.usado.split(' · ');
    const int = criarInterior(p.tec, { cor: mundo.corNeon, area, projetos: projs, emblema: emblema(p.tec.nome, mundo.corNeon, (o) => { lixoInt.push(o); return o; }) });
    int.grupo.position.copy(BASE_INT); cena.add(int.grupo);
    s.dentro = { p, int, lixo: lixoInt };
    pe.pos.copy(BASE_INT).add(int.entrada); pe.vel.set(0, 0, 0); pe.velY = 0; pe.noChao = true; pe.rumo = Math.PI;
    s.alvoRumo = Math.PI; s.alvoMira = -.2;
    camPos.copy(pe.pos).add(_v.set(0, 3, 4.2));
    fx.veu = 1; fx.veuCor = '#000'; som.porta();
    $('.jogo-titulo span').textContent = `dentro de ${p.tec.nome}`;
    if (!p.visto) {
      p.marcarVisto();
      (vistos[s.planeta.key] ||= new Set()).add(p.tec.nome);
      const n = vistos[s.planeta.key].size, tot = mundo.predios.length;
      if (n === tot) setTimeout(() => { som.conquista(); mostrarConquista(`<b>${s.planeta.nome} completo ✓</b><span>você visitou as ${tot} tecnologias desta área</span>`); }, 400);
      else som.bip(1040, .12);
    }
  }
  function sairDoPredio() {
    const { p, int, lixo } = s.dentro; int.destruir(); lixo.forEach((o) => o.dispose && o.dispose()); s.dentro = null;
    // do lado de fora, de costas para a porta
    _v.subVectors(p.porta, p.pos).setY(0).normalize();
    pe.pos.copy(p.porta).addScaledVector(_v, 1.5); pe.pos.y = mundo.alturaChao(pe.pos.x, pe.pos.z);
    pe.rumo = Math.atan2(_v.x, _v.z); pe.vel.set(0, 0, 0); s.alvoRumo = pe.rumo; s.alvoMira = -.1;
    camPos.copy(pe.pos).addScaledVector(_v, -6.5); camPos.y += 2.6;
    fx.veu = 1; fx.veuCor = '#000'; som.porta();
    $('.jogo-titulo span').textContent = `explorando ${s.planeta.nome}`;
  }
  function abrirPainel(p) {
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
  }
  // jetpack: so fica ligado ENQUANTO o Espaco estiver segurado, no ar. O pulo
  // e normal (nao sai do chao ligado): segurando, liga quando o pulo chega no
  // alto; soltando e apertando de novo no ar, liga na hora (ver andarAPe)
  function pular() { pe.velY = 6.2; pe.noChao = false; pe.subidaDoPulo = true; }
  function ligarJetpack() { pe.subidaDoPulo = false; }
  function rolar() { if (pe.rolando > 0) return; astro.gesto('Roll'); pe.rolando = .6; pe.vel.x += Math.sin(pe.rumo) * 7; pe.vel.z += Math.cos(pe.rumo) * 7; }

  /* ---- armas e inventario (TAB) ----
     A pe, o clique atira com a arma da mao, na direcao da mira (centro da
     tela). TAB abre o inventario (mouse solto para clicar); 1–4 trocam direto. */
  const ARMAS = [
    { id: null, nome: 'Mãos livres', icone: '✋', desc: 'sem arma: anda e voa leve', st: [0, 0, 0] },
    { id: 'blaster', nome: 'Blaster', icone: '🔫', desc: 'tiro a tiro, preciso', cor: 0xff4fd8, cad: .26, vel: 260, esc: .1, tom: 1, st: [.4, .4, .7] },
    { id: 'rifle', nome: 'Rifle de plasma', icone: '⚡', desc: 'rajada rápida', cor: 0x4fd2ff, cad: .085, vel: 330, esc: .07, tom: 1.35, st: [.25, .95, .8] },
    { id: 'canhao', nome: 'Canhão de íons', icone: '💥', desc: 'lento, explode na área', cor: 0xffa040, cad: .85, vel: 150, esc: .32, tom: .55, st: [1, .15, .45] }
  ];
  // arsenal da NAVE (o inventario mostra este quando se esta pilotando)
  const NAVE_ARMAS = [
    { id: 'laser', nome: 'Lasers duplos', icone: '🔴', desc: 'dois lasers rápidos, das asas', cor: 0xff4fd8, cad: .14, vel: 1100, esc: 1, dano: 1, tom: 1, st: [.4, .6, .9] },
    { id: 'plasma', nome: 'Metralhadora de plasma', icone: '🔵', desc: 'rajada alternando as asas', cor: 0x4fd2ff, cad: .05, vel: 1300, esc: .7, dano: .45, tom: 1.5, alterna: true, espalha: .025, st: [.25, 1, .9] },
    { id: 'missil', nome: 'Mísseis teleguiados', icone: '🚀', desc: 'perseguem o asteroide à frente', cor: 0xffb347, cad: .6, vel: 450, esc: 2.2, comp: .35, dano: 4, area: 90, tom: .7, guiado: true, vida: 4, st: [.7, .3, 1] },
    { id: 'ions', nome: 'Canhão de íons', icone: '💥', desc: 'bola lenta, explosão em área', cor: 0xb06bff, cad: 1.1, vel: 520, esc: 5, comp: .25, dano: 9, area: 220, tom: .45, vida: 3, unico: true, st: [1, .12, .6] }
  ];
  const slots = $('.ji-slots'), armaUI = $('.jogo-arma'), tituloInv = $('.jogo-inventario h4');
  let invAPe = null;
  // o inventario mostra o arsenal de quem esta jogando: o astronauta ou a nave
  function montarInventario() {
    const aPe = !!s?.aPe; if (invAPe === aPe) return; invAPe = aPe;
    const lista = aPe ? ARMAS : NAVE_ARMAS, atual = aPe ? armaIdx : navArmaIdx;
    tituloInv.innerHTML = `${aPe ? 'INVENTÁRIO · ASTRONAUTA' : 'ARSENAL · NAVE'} · <span>TAB fecha · 1–4 ou clique</span>`;
    slots.innerHTML = lista.map((a, i) => `<button type="button" data-i="${i}" class="${i === atual ? 'on' : ''}"><kbd>${i + 1}</kbd><i>${a.icone}</i><b>${a.nome}</b><span>${a.desc}</span></button>`).join('');
  }
  slots.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { escolherArma(+b.dataset.i, !!s?.aPe); alternarInventario(false); } });
  const hexCor = (x) => '#' + (x.cor || 0xc9bfe6).toString(16).padStart(6, '0');
  function mostrarArmaAtual() {
    const lista = s?.aPe ? ARMAS : NAVE_ARMAS, atual = s?.aPe ? armaIdx : navArmaIdx, a = lista[atual];
    armaUI.querySelector('header b').textContent = a.nome;
    armaUI.style.setProperty('--c', hexCor(a));
    // os 4 slots (1–4): numero e o desenho de cada arma; o atual aceso
    const sl = $('.ja-slots');
    sl.innerHTML = lista.map((x, i) => `<i class="${i === atual ? 'on' : ''}" style="--c:${hexCor(x)}"><b>${i + 1}</b><canvas width="64" height="32"></canvas></i>`).join('');
    sl.querySelectorAll('canvas').forEach((cv, i) => desenharSilhueta(cv.getContext('2d'), lista[i].id, 32, 16, 15, i === atual ? '#fff' : 'rgba(228,220,255,.85)', hexCor(lista[i])));
  }
  // aviso rapido no meio da tela ao trocar de arma (desenho, numero e nome)
  const trocaUI = $('.jogo-troca'); let trocaT = 0;
  function avisarTroca(lista, i) {
    const a = lista[i], cv = trocaUI.querySelector('canvas'), c = cv.getContext('2d');
    c.clearRect(0, 0, 360, 140); desenharSilhueta(c, a.id, 180, 70, 64, '#fff', hexCor(a));
    trocaUI.querySelector('b').textContent = a.nome; trocaUI.querySelector('span').textContent = `${i + 1} · ${a.desc}`;
    trocaUI.style.setProperty('--c', hexCor(a));
    trocaUI.classList.remove('on'); void trocaUI.offsetWidth; trocaUI.classList.add('on');
    clearTimeout(trocaT); trocaT = setTimeout(() => trocaUI.classList.remove('on'), 1300);
  }
  function escolherArma(i, aPe = true) {
    if (aPe) {
      armaIdx = Math.max(0, Math.min(ARMAS.length - 1, i));
      astro?.arma(ARMAS[armaIdx].id); raiz.classList.toggle('armado', !!ARMAS[armaIdx].id);
    } else navArmaIdx = Math.max(0, Math.min(NAVE_ARMAS.length - 1, i));
    invAPe = null; montarInventario(); mostrarArmaAtual();
    avisarTroca(aPe ? ARMAS : NAVE_ARMAS, aPe ? armaIdx : navArmaIdx);
    som.bip(760, .06);
  }
  montarInventario(); mostrarArmaAtual();
  let ladoTiro = 1;
  function atirarNave() {
    const a = NAVE_ARMAS[navArmaIdx];
    nave.raiz.updateMatrixWorld();
    let alvo = null;
    if (a.guiado && mundo.planetas) { camera.getWorldDirection(_v); alvo = mundo.alvoNaFrente(s.pos, _v); }
    if (a.alterna) ladoTiro = -ladoTiro;
    // o tiro vai para o centro da tela (a mira), nao para onde o nariz aponta:
    // a nave segue a mira com atraso, entao o nariz quase nunca esta nela
    const ponto = pontoDaMiraNave(_miraN, a.vel * (a.vida || 1.4) * .8);
    tiros.disparar(nave.corpo, s.vel, nave.raiz.scale.x, {
      cor: a.cor, vel: a.vel, esc: a.esc, comp: a.comp, espalha: a.espalha, vida: a.vida, ponto,
      lados: a.unico ? [0] : a.alterna ? [ladoTiro] : a.guiado ? [ladoTiro = -ladoTiro] : [-1, 1],
      dados: { arma: a.id, dano: a.dano, area: a.area || 0, alvo }
    });
    som.tiro(a.tom); if (a.area) som.explosao(.12);
    if (rede) { _v.subVectors(ponto, s.pos).normalize(); rede.tiro(s.pos, _v, a.id); }
  }
  function alternarInventario(v = !inventarioAberto) {
    if (v) montarInventario();
    inventarioAberto = v; raiz.classList.toggle('inv-on', v);
    if (v) { if (document.pointerLockElement) document.exitPointerLock(); atirando = false; } else travar();
  }
  /* roda de armas (TAB): mostra o arsenal de quem joga; enquanto aberta o
     tempo corre devagar (camera lenta) e o mouse escolhe a fatia */
  const rodaCv = $('.jogo-roda'); roda = criarRoda(rodaCv);
  let rodaDesde = 0;
  function abrirRoda() {
    if (!s || painelAberto || mapaAberto || !(s.aPe || s.modo === 'espaco' || s.modo === 'superficie')) return;
    roda.abrir(s.aPe ? ARMAS : NAVE_ARMAS, s.aPe ? armaIdx : navArmaIdx); rodaDesde = performance.now(); atirando = false;
    raiz.classList.add('roda-on'); som.bip(620, .05);
  }
  function fecharRoda(equipar) { const i = roda.fechar(); raiz.classList.remove('roda-on'); if (equipar) escolherArma(i, !!s.aPe); }
  rodaCv.addEventListener('pointermove', (e) => { if (!preso()) roda.apontar(e.clientX, e.clientY); });
  rodaCv.addEventListener('click', (e) => { roda.apontar(e.clientX, e.clientY); fecharRoda(true); });

  /* primeira pessoa (V, a pe): camera no capacete, o corpo some e a arma
     aparece na frente da tela (um modelo so para a visao) */
  const vista1 = new THREE.Group(); vista1.visible = false;
  const vmModelos = {}; let vmChute = 0;
  function alternarPrimeiraPessoa(v = !s.fp) {
    s.fp = v; raiz.classList.toggle('fp', v); som.bip(v ? 880 : 600, .05);
    camera.near = v ? .08 : .4; camera.updateProjectionMatrix();
  }
  function atualizarVista1(dt) {
    const id = ARMAS[armaIdx].id, on = !!(s.fp && s.aPe && id);
    vista1.visible = on; if (!on) return;
    if (!vmModelos[id]) { vmModelos[id] = astro.modeloArma(id); vmModelos[id].scale.setScalar(.85); vista1.add(vmModelos[id]); }
    for (const k in vmModelos) vmModelos[k].visible = k === id;
    vmChute *= Math.exp(-dt * 14);
    const bal = Math.hypot(pe.vel.x, pe.vel.z) * (pe.noChao ? 1 : 0), t = tTotal;
    _v.set(.24 + Math.sin(t * 5) * .004 * bal, -.23 + Math.abs(Math.cos(t * 5)) * .006 * bal + vmChute * .03, -.55 + vmChute * .09).applyQuaternion(camera.quaternion);
    vista1.position.copy(camera.position).add(_v);
    vista1.quaternion.copy(camera.quaternion).multiply(_qGiro);
  }
  const _qGiro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

  // a mira: o primeiro ponto (chao, predio ou parede) no raio do centro da tela
  const _mira = new THREE.Vector3(), _dirC = new THREE.Vector3(), _bc = new THREE.Vector3();
  function pontoDaMira(out) {
    camera.getWorldDirection(_dirC); out.copy(camera.position);
    for (let d = 0, passo = .5; d < 400; d += passo, passo = Math.min(3, passo * 1.04)) {
      out.addScaledVector(_dirC, passo);
      if (d < 2.5) continue;   // a camera fica atras do astronauta
      if (s.dentro) { if (Math.hypot(out.x - BASE_INT.x, out.z - BASE_INT.z) > RAIO_SALA - .3 || out.y < BASE_INT.y || out.y > BASE_INT.y + 9) return out; }
      else {
        if (out.y < mundo.alturaChao(out.x, out.z)) return out;
        for (const pr of mundo.predios) if (Math.hypot(out.x - pr.pos.x, out.z - pr.pos.z) < 6 && out.y < pr.pos.y + 14) return out;
        if (rede) { const r = rede.remotoEm(out); if (r) return out; }
      }
    }
    return out;
  }
  // mira da nave: o raio do centro da tela ate a primeira rocha (espaco) ou o
  // chao (superficie); sem nada, um ponto longe nesse raio
  const _miraN = new THREE.Vector3(), _dirN = new THREE.Vector3();
  function pontoDaMiraNave(out, alcance) {
    camera.getWorldDirection(_dirN); out.copy(camera.position);
    if (mundo.planetas) {
      const h = mundo.rochaNoRaio(camera.position, _dirN, alcance);
      return out.addScaledVector(_dirN, h ? h.t : alcance);
    }
    for (let d = 0, passo = 4; d < alcance; d += passo, passo = Math.min(40, passo * 1.15)) {
      out.addScaledVector(_dirN, passo);
      if (out.y < mundo.alturaChao(out.x, out.z)) return out;
    }
    return out;
  }
  function atirarAPe() {
    const a = ARMAS[armaIdx]; if (!a.id) return;
    if (s.fp && vmModelos[a.id]) { vista1.updateMatrixWorld(true); vmModelos[a.id].userData.boca.getWorldPosition(_bc); const fl = vmModelos[a.id].userData.clarao; fl.material.opacity = 1; setTimeout(() => { fl.material.opacity = 0; }, 50); vmChute = 1; }
    else astro.boca(_bc);
    pontoDaMira(_mira); miraAbre = Math.min(1, miraAbre + (a.id === 'rifle' ? .25 : .6));
    mdy -= a.id === 'canhao' ? 26 : a.id === 'blaster' ? 9 : 4;   // coice: a mira sobe um pouco
    const dir = _dirC.subVectors(_mira, _bc).normalize();
    tiros.dispararArma(_bc, dir, { cor: a.cor, vel: a.vel, escala: a.esc, vida: 2, dados: { arma: a.id, pe: true } });
    rede?.tiro(_bc, dir, a.id);
    astro.atirou(); som.tiro(a.tom);
    if (a.id === 'canhao') som.explosao(.15);
  }

  /* ---- chat de voz (T perto, Y radio) ---- */
  function falarVoz(modo) {
    if (!voz) { mostrarConquista('<b>🎙 voz precisa de conta</b><span>crie no terminal do site (criar-conta)</span>'); return; }
    voz.falar(modo);
  }
  // volume de quem fala "perto": cheio colado, some no limite (so na mesma sala)
  function volumeVoz(nome) {
    if (!rede) return 0;
    let r = null; for (const x of rede.remotos.values()) if (x.nome === nome) { r = x; break; }
    if (!r || !r.obj) return 0;
    const alc = s.modo === 'espaco' ? 1500 : 90, d = r.pos.distanceTo(s.aPe ? pe.pos : s.pos);
    const k = Math.max(0, 1 - d / alc); return k * k;
  }
  const vozUI = $('.jogo-voz');
  function desenharVoz() {
    const eu = voz.falando, linhas = [];
    if (eu) linhas.push(`<div class="eu ${eu}">${eu === 'geral' ? '📻 você no rádio (todos ouvem)' : '🎙 você falando (quem está perto)'}</div>`);
    for (const f of voz.falantes(volumeVoz)) linhas.push(`<div class="${f.modo}${f.ouve ? '' : ' longe'}"><i style="background:${corCss(matizDe(f.nome), f.admin)}"></i><b style="color:${corCss(matizDe(f.nome), f.admin)}">${f.admin ? '👑 ' : ''}${f.nome}</b> ${f.modo === 'geral' ? '📻' : f.ouve ? '🎙' : '🎙 longe'}</div>`);
    vozUI.innerHTML = linhas.join('');
  }

  /* ---- placar no TAB (segurar) ---- */
  const tabUI = $('.jogo-tab'), stats = new Map();   // id -> { abates, mortes }
  function mostrarTab(v) {
    raiz.classList.toggle('tab-on', v); if (!v) return;
    const linhas = [];
    const eu = rede ? rede.meuId : null, st = (id) => stats.get(id) || { abates: 0, mortes: 0 };
    linhas.push({ nome: (souAdm ? '👑 ' : '') + (sess?.usuario || 'você') + ' (você)', cor: sess ? minhaCor() : '', pvp: meuPvp, ...st(eu), eu: true });
    if (rede) for (const r of rede.remotos.values()) linhas.push({ nome: (r.admin ? '👑 ' : '') + r.nome, cor: corCss(r.matiz, r.admin), pvp: r.pvp, ...st(r.id) });
    linhas.sort((a, b) => b.abates - a.abates || a.mortes - b.mortes);
    tabUI.querySelector('h4 span').textContent = rede ? `${linhas.length} na sala ${rede.sala}` : 'offline (sem conta)';
    tabUI.querySelector('tbody').innerHTML = linhas.map((x) => `<tr class="${x.eu ? 'eu' : ''}"><td><i class="cor-j" style="background:${x.cor || '#888'}"></i>${x.nome}</td><td>${x.pvp ? '<span class="pvp">⚔ ligado</span>' : '<span class="paz">desligado</span>'}</td><td>${x.abates}</td><td>${x.mortes}</td></tr>`).join('');
  }

  /* ---- PvP e eventos do online ---- */
  let meuPvp = false, minhaVida = 100, morto = false;
  const onlineUI = $('.jogo-online'), feedUI = $('.jogo-feed'), vidaUI = $('.jogo-vida'), placarUI = $('.jogo-placar'), morteUI = $('.jogo-morte'), danoUI = $('.jogo-dano');
  if (!sessao()) onlineUI.innerHTML = '<i class="off"></i>offline';
  // quem esta logado: fixo embaixo do titulo e um aviso ao abrir
  $('.jogo-conta').innerHTML = sessao() ? `<i style="background:${corCss(matizDe(sessao().usuario))};box-shadow:0 0 8px ${corCss(matizDe(sessao().usuario))}"></i>logado como <b>${sessao().usuario}</b>` : '<i class="off"></i><b>sem conta</b> · offline';
  // aviso grande de entrada com a conta (proprio, para nao ser trocado por outros avisos)
  {
    const bv = $('.jogo-bemvindo'), eu = sessao();
    bv.querySelector('small').textContent = eu ? 'LOGADO COMO' : 'SEM CONTA';
    bv.querySelector('b').textContent = eu ? eu.usuario : 'jogando offline';
    bv.querySelector('span').textContent = eu ? 'online · P liga o PvP · TAB placar' : 'crie uma conta no terminal do site (criar-conta) para jogar online';
    bv.classList.toggle('off', !eu);
    setTimeout(() => bv.classList.add('on'), 600); setTimeout(() => bv.classList.remove('on'), 5200);
  }
  $('.jogo-pvp').addEventListener('click', () => alternarPvp());
  function alternarPvp(v = !meuPvp) {
    if (!rede) { mostrarConquista('<b>PvP precisa de conta</b><span>crie no terminal do site (criar-conta)</span>'); return; }
    meuPvp = v; rede.pvp(v); raiz.classList.toggle('pvp-on', v); som.bip(v ? 300 : 600, .12);
    mostrarConquista(v ? '<b>⚔ PvP ligado</b><span>você pode acertar e ser acertado por quem também ligou</span>' : '<b>PvP desligado</b><span>ninguém te acerta (e você não acerta ninguém)</span>');
  }
  function noFeed(html) {
    const el = document.createElement('div'); el.innerHTML = html; feedUI.prepend(el);
    while (feedUI.children.length > 5) feedUI.lastChild.remove();
    setTimeout(() => el.classList.add('some'), 6000); setTimeout(() => el.remove(), 7000);
  }
  const NOME_ARMA = { blaster: 'blaster', rifle: 'rifle', canhao: 'canhão', laser: 'lasers', plasma: 'plasma', missil: 'míssil', ions: 'íons' };
  function eventoRede(tipo, m) {
    if (tipo === 'conectado' && m.admin && !souAdm) { souAdm = true; nave.pintar({ matiz: matizDe(sess.usuario), admin: true }); $('.jogo-conta').classList.add('adm'); $('.jogo-conta').style.setProperty('--cj', minhaCor()); }
    if (tipo === 'entrou') noFeed(`<b style="color:${corCss(matizDe(m.nome), m.admin)}">${m.admin ? '👑 ' : ''}${m.nome}</b> entrou aqui`);
    else if (tipo === 'saiu') noFeed(`<b>${m.nome}</b> saiu`);
    else if (tipo === 'erro') noFeed(`<span class="ruim">${m.msg}</span>`);
    else if (tipo === 'tiro') {
      const a = ARMAS.find((x) => x.id === m.arma) || NAVE_ARMAS.find((x) => x.id === m.arma); if (!a || !m.o || !m.d) return;
      _v.fromArray(m.o); _m.fromArray(m.d).normalize();
      const nave = !ARMAS.some((x) => x.id === m.arma);
      tiros.dispararArma(_v, _m, { cor: a.cor, vel: nave ? a.vel : a.vel, escala: nave ? .9 * (a.esc || 1) : a.esc, vida: nave ? 2.5 : 2, dados: { remoto: true } });
      if (_v.distanceTo(camera.position) < 600) som.tiro((a.tom || 1) * .9);
    } else if (tipo === 'pvp' && m.eu) { meuPvp = m.on; raiz.classList.toggle('pvp-on', m.on); }
    else if (tipo === 'vida' && m.eu) {
      const tomou = m.vida < minhaVida; minhaVida = m.vida;
      if (tomou) { danoUI.classList.remove('on'); void danoUI.offsetWidth; danoUI.classList.add('on'); abalo = Math.max(abalo, .35); som.bip(180, .08); }
    } else if (tipo === 'morte') {
      noFeed(`<b>${m.porNome}</b> <span class="ruim">⚔ ${NOME_ARMA[m.arma] || ''}</span> <b>${m.nome}</b>`);
      if (m.fuiEu) { som.conquista(); mostrarConquista(`<b>⚔ você abateu ${m.nome}</b><span>+1 no placar</span>`); }
      if (m.eu) { morto = true; minhaVida = 0; morteUI.querySelector('b').textContent = `você foi abatido por ${m.porNome}`; raiz.classList.add('morto'); som.explosao(1); abalo = 1.2; }
    } else if (tipo === 'renasceu' && m.eu) {
      morto = false; minhaVida = 100; raiz.classList.remove('morto');
      // renasce num lugar seguro: a plataforma do planeta ou o ponto de partida do espaco
      if (mundo.planetas) { s.pos.set(-3090, 1340, 5970); s.vel.set(0, 0, 0); }
      else if (s.aPe) { pe.pos.set(0, mundo.alturaChao(0, 14) + .5, 14); pe.vel.set(0, 0, 0); pe.velY = 0; if (s.dentro) sairDoPredio(); }
      else { s.pos.set(0, mundo.alturaChao(0, 0) + 40, 0); s.vel.set(0, 0, 0); }
    } else if (tipo === 'placar') {
      const lista = m.lista.filter((x) => x.pvp || x.abates || x.mortes).sort((a, b) => b.abates - a.abates).slice(0, 6);
      m.lista.forEach((x) => stats.set(x.id, { abates: x.abates, mortes: x.mortes }));
      if (raiz.classList.contains('tab-on')) mostrarTab(true);
      placarUI.innerHTML = '';   // o placar fica no TAB
    }
  }

  /* ---- mapa (M) ---- */
  const mapaCv = $('.jogo-mapa'), mapaCtx = mapaCv.getContext('2d');
  /* O mapa e interativo: arrastar move, rodinha/pinca da zoom, clique num
     ponto (planeta, local, nave, plataforma) ou em qualquer lugar marca o
     DESTINO, que aparece na tela com a distancia. Com o mapa aberto o mouse
     fica solto (e o jogo nao pausa). */
  let vista = { zoom: 1, ox: 0, oz: 0 }, vistaDe = null, mapaInfo = null, destino = null;
  const toquesMapa = new Map(); let arrastoMapa = null;
  const limiteMapa = () => (mundo.planetas ? LIMITE_ESPACO : mundo.limite);
  const escMapa = () => Math.min(innerWidth, innerHeight) * .44 / limiteMapa() * vista.zoom;
  function alternarMapa(v = !mapaAberto) {
    mapaAberto = v; raiz.classList.toggle('mapa-on', v); som.bip(v ? 700 : 520, .06);
    if (v) {
      if (document.pointerLockElement) document.exitPointerLock();
      // cada mundo lembra a vista; na superficie comeca centrado em voce
      const onde = mundo.planetas ? 'espaco' : s.planeta?.key;
      if (vistaDe !== onde) {
        vistaDe = onde;
        const eu = s.aPe ? pe.pos : s.pos;
        vista = mundo.planetas ? { zoom: 1, ox: 0, oz: 0 } : { zoom: 1.3, ox: eu.x, oz: eu.z };
      }
    } else { toquesMapa.clear(); arrastoMapa = null; travar(); }
  }
  mapaCv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); try { mapaCv.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    toquesMapa.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toquesMapa.size === 1) arrastoMapa = { moveu: 0, pinca: false };
    else if (arrastoMapa) arrastoMapa.pinca = true;
  });
  mapaCv.addEventListener('pointermove', (e) => {
    const ant = toquesMapa.get(e.pointerId); if (!ant) return;
    const dx = e.clientX - ant.x, dy = e.clientY - ant.y;
    if (toquesMapa.size === 2) {
      // pinca: zoom pela mudanca de distancia entre os dois dedos
      const [a, b] = [...toquesMapa.values()], antes = Math.hypot(a.x - b.x, a.y - b.y);
      toquesMapa.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...toquesMapa.values()], depois = Math.hypot(c.x - d.x, c.y - d.y);
      if (antes > 10) vista.zoom = Math.max(.5, Math.min(14, vista.zoom * depois / antes));
      return;
    }
    toquesMapa.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const esc = escMapa(); vista.ox -= dx / esc; vista.oz -= dy / esc;
    if (arrastoMapa) arrastoMapa.moveu += Math.abs(dx) + Math.abs(dy);
  });
  const soltarMapa = (e) => {
    if (!toquesMapa.has(e.pointerId)) return;
    toquesMapa.delete(e.pointerId);
    if (toquesMapa.size === 0 && arrastoMapa && !arrastoMapa.pinca && arrastoMapa.moveu < 7) clicarMapa(e.clientX, e.clientY);
    if (toquesMapa.size === 0) arrastoMapa = null;
  };
  mapaCv.addEventListener('pointerup', soltarMapa); mapaCv.addEventListener('pointercancel', soltarMapa);
  mapaCv.addEventListener('wheel', (e) => {
    e.preventDefault(); if (!mapaInfo) return;
    // zoom em volta do cursor (o ponto embaixo dele fica parado)
    const w = mapaInfo.paraMundo(e.clientX, e.clientY);
    vista.zoom = Math.max(.5, Math.min(14, vista.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const esc = escMapa();
    vista.ox = w.x - (e.clientX - innerWidth / 2) / esc; vista.oz = w.z - (e.clientY - innerHeight / 2 - 10) / esc;
  }, { passive: false });
  function clicarMapa(sx, sy) {
    if (!mapaInfo) return;
    let melhor = null, dm = 24;
    for (const a of mapaInfo.alvos) { const d = Math.hypot(a.sx - sx, a.sy - sy) - (a.raio || 0); if (d < dm) { dm = d; melhor = a; } }
    // clicar de novo no destino atual desmarca
    if (destino && melhor && destino.nome === melhor.nome) { destino = null; som.bip(420, .08); return; }
    const sup = !mundo.planetas;
    if (melhor) {
      let pos, raioChegada = sup ? 18 : 300;
      let sup0 = 0;
      if (melhor.tipo === 'planeta') { const p = mundo.planetas.find((x) => x.key === melhor.key); pos = p.pos; raioChegada = p.raio * 2.1; sup0 = p.raio; }
      else if (melhor.tipo === 'predio') { const p = mundo.predios.find((x) => x.tec.nome === melhor.nome); pos = p.porta.clone(); pos.y += 3; raioChegada = 12; }
      else if (melhor.tipo === 'nave') { pos = s.pos; raioChegada = 7; }
      else if (melhor.tipo === 'sol') { pos = mundo.sol.pos; raioChegada = mundo.sol.raio * 1.6; }
      else if (melhor.tipo === 'buraco') { const b = mundo.buracos.find((x) => Math.hypot(x.position.x - melhor.x, x.position.z - melhor.z) < 1); pos = b.position; raioChegada = 0; }
      else { pos = new THREE.Vector3(melhor.x, sup ? mundo.alturaChao(melhor.x, melhor.z) + 3 : 0, melhor.z); raioChegada = melhor.tipo === 'campo' ? 700 : 20; }
      destino = { nome: melhor.nome, pos, raioChegada, sup0 };
    } else {
      const w = mapaInfo.paraMundo(sx, sy), L = limiteMapa();
      const x = Math.max(-L, Math.min(L, w.x)), z = Math.max(-L, Math.min(L, w.z));
      destino = { nome: 'ponto marcado', pos: new THREE.Vector3(x, sup ? mundo.alturaChao(x, z) + 3 : 0, z), raioChegada: sup ? 15 : 250 };
    }
    som.bip(980, .1);
  }
  // marcador do destino na tela (com seta na borda quando fica fora da visao)
  const destUI = $('.jogo-destino'), _dp = new THREE.Vector3();
  function atualizarDestino() {
    const mostrar = destino && !mapaAberto && !s.dentro && (s.modo === 'espaco' || s.modo === 'superficie');
    destUI.classList.toggle('on', !!mostrar); if (!mostrar) return;
    const eu = s.aPe ? pe.pos : s.pos, dist = Math.max(0, eu.distanceTo(destino.pos) - (destino.sup0 || 0));
    if (destino.raioChegada && dist + (destino.sup0 || 0) < destino.raioChegada) { mostrarConquista(`<b>◎ chegou: ${destino.nome}</b><span>destino alcançado</span>`); som.bip(1180, .15); destino = null; destUI.classList.remove('on'); return; }
    _dp.copy(destino.pos).project(camera);
    const atras = _dp.z > 1; let x = _dp.x, y = _dp.y; if (atras) { x = -x; y = -y; }
    const W = innerWidth, H = innerHeight, m = 46;
    let sx = (x * .5 + .5) * W, sy = (-y * .5 + .5) * H;
    const fora = atras || sx < m || sx > W - m || sy < m || sy > H - m;
    if (fora) {
      const dx = sx - W / 2, dy = sy - H / 2, k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m) / Math.max(1e-3, Math.abs(dy)));
      sx = W / 2 + dx * k; sy = H / 2 + dy * k;
      destUI.style.setProperty('--ang', Math.atan2(dy, dx) + 'rad');
    }
    destUI.classList.toggle('fora', fora);
    destUI.style.transform = `translate(${sx.toFixed(0)}px,${sy.toFixed(0)}px)`;
    destUI.children[1].textContent = destino.nome;
    destUI.children[2].textContent = dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m';
  }
  function desenharMapaAgora() {
    const pr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    if (mapaCv.width !== Math.round(W * pr) || mapaCv.height !== Math.round(H * pr)) { mapaCv.width = Math.round(W * pr); mapaCv.height = Math.round(H * pr); }
    mapaCtx.setTransform(pr, 0, 0, pr, 0, 0);
    if (mundo.planetas) {
      const ver = s.modo === 'espaco' ? s.pos : ent.ver;
      let completos = 0;
      const planetas = mundo.planetas.map((p) => {
        const n = vistos[p.key]?.size || 0, tot = STACK[p.key]?.techs.length || 0; if (tot && n === tot) completos++;
        return { key: p.key, x: p.orig.x, z: p.orig.z, r: p.raio, nome: p.nome, cor: p.cor, n, tot, completo: tot > 0 && n === tot, orbita: Math.hypot(p.orig.x, p.orig.z / .55) };
      });
      mapaInfo = desenharMapa(mapaCtx, W, H, {
        vista, destino: destino && { x: destino.pos.x, z: destino.pos.z, nome: destino.nome },
        modo: 'espaco', limite: LIMITE_ESPACO, planetas, sol: { r: mundo.sol.raio }, cinturao: mundo.mapaInfo.cinturao, campos: mundo.mapaInfo.campos,
        buracos: mundo.buracos.map((b) => ({ x: b.position.x, z: b.position.z })), nave: { x: ver.x, z: ver.z, rumo: s.rumo },
        titulo: 'MAPA · STACK UNIVERSE', legenda: `${completos}/9 planetas completos · aperte E perto de um planeta para entrar`
      }, tTotal);
    } else {
      const n = vistos[s.planeta.key]?.size || 0;
      mapaInfo = desenharMapa(mapaCtx, W, H, {
        vista, destino: destino && { x: destino.pos.x, z: destino.pos.z, nome: destino.nome },
        modo: 'sup', limite: mundo.limite, cor: mundo.corNeon,
        predios: mundo.predios.map((p) => ({ x: p.pos.x, z: p.pos.z, nome: p.tec.nome, visto: p.visto })),
        nave: { x: s.pos.x, z: s.pos.z, rumo: s.rumo }, pe: s.aPe && !s.dentro ? { x: pe.pos.x, z: pe.pos.z, rumo: pe.rumo } : null,
        titulo: `MAPA · ${s.planeta.nome.toUpperCase()}`, legenda: `${n}/${mundo.predios.length} tecnologias visitadas · os feixes de luz marcam cada local`
      }, tTotal);
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
    e.mundoProx = criarSuperficie(e.cenaProx, p, { qW2S: e.qW2S, rotCorpo: e.rot[p.key][0], rotNuvens: e.rot[p.key][1], astros, modeloNave: nave.modeloBase });
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
    const dt = Math.min(.05, relogio.getDelta());
    // pausado (mouse solto, menu na tela): o jogo para; so redesenha
    if (pausado()) { renderer.render(cena, camera); return; }
    passo(roda.aberta ? dt * .25 : dt);
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
    // S freia e, parado, da re; A/D sao propulsores laterais de verdade (com embalo)
    const re = naSuperficie ? 30 : 140, ladoAcel = naSuperficie ? 38 : 150;
    s.vel.addScaledVector(FRENTE, (acelera * (emDobra ? 2300 * s.dobra + 280 : turbo ? 95 : naSuperficie ? 42 : 280) - freia * (emDobra ? 600 : s.vel.dot(FRENTE) > 5 ? 160 : re)) * dt);
    s.vel.x += Math.cos(s.alvoRumo) * lado * ladoAcel * dt; s.vel.z -= Math.sin(s.alvoRumo) * lado * ladoAcel * dt;   // lados da visao
    s.vel.y += sobe * dt * (naSuperficie ? 42 : 30);
    // arrasto: a parte lateral e forte (a nave "segura" na curva); solta, para e paira
    const frontal = FRENTE.clone().multiplyScalar(s.vel.dot(FRENTE));
    const lateral = s.vel.clone().sub(frontal); if (naSuperficie) lateral.y = 0;
    // com A/D apertado o lateral nao e "freado" (desliza de lado); solto, segura a curva
    s.vel.sub(lateral.multiplyScalar(1 - Math.exp(-dt * (lado ? .15 : 2.4))));
    const solto = !acelera && !freia && !lado && !sobe;
    s.vel.multiplyScalar(Math.exp(-dt * (acelera ? (emDobra ? .05 : .35) : solto ? 1.8 : .9)));
    if (naSuperficie) s.vel.y *= Math.exp(-dt * (sobe ? .9 : 3));
    const max = naSuperficie ? (turbo ? 150 : 70) : 480 + s.dobra * 3200; if (s.vel.length() > max) s.vel.setLength(s.vel.length() + (max - s.vel.length()) * (1 - Math.exp(-dt * 3)));
    // re e lateral tem teto proprio (mais baixo que pra frente)
    { const vf = s.vel.dot(FRENTE), maxRe = naSuperficie ? 30 : 160; if (vf < -maxRe) s.vel.addScaledVector(FRENTE, -maxRe - vf); }
    { _v.copy(FRENTE).multiplyScalar(s.vel.dot(FRENTE)); _m.subVectors(s.vel, _v); const lt = Math.hypot(_m.x, _m.z), maxL = naSuperficie ? 45 : 220; if (lt > maxL) { s.vel.x -= _m.x * (1 - maxL / lt); s.vel.z -= _m.z * (1 - maxL / lt); } }
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
      if (s.dobra > .15 && dobraAnt <= .15) som.dobra();
      dobraAnt = s.dobra;
      // rocha: empurra para fora, freia e solta faisca
      { const x = mundo.rochaEm(s.pos, 3); if (x) { _v.subVectors(s.pos, x.c).normalize(); s.pos.copy(x.c).addScaledVector(_v, x.k + 3.2); const vn = s.vel.dot(_v); if (vn < 0) s.vel.addScaledVector(_v, -vn * 1.6); s.vel.multiplyScalar(.5); s.dobra = 0; tiros.explodir(s.pos, 3, [.8, .8, 1]); som.explosao(.3); } }
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
      fx.nuvem = 0; fx.veu = Math.max(0, fx.veu - dt * 2.2);
      if (!s.pousado) {
        voarNave(dt, ctl, true);
        const chao = mundo.alturaChao(s.pos.x, s.pos.z) + 1.6;
        if (s.pos.y < chao) { s.pos.y = chao; if (s.vel.y < 0) s.vel.y = 0; }
        s.pos.x = Math.max(-mundo.limite, Math.min(mundo.limite, s.pos.x)); s.pos.z = Math.max(-mundo.limite, Math.min(mundo.limite, s.pos.z));
        if (s.pos.y > 430) { s.modo = 'subindo'; s.tModo = 0; mostrarAcao(''); prepararSaida(); }
        if (s.pos.y - chao < 14 && acelera + Math.abs(sobe) > 0) mundo.levantarPoeira(s.pos.x, s.pos.z, .04);
        empuxo = Math.max(acelera * (turbo ? 1 : .75), Math.abs(sobe) * .5, Math.abs(lado) * .4, .14);
      } else {
        empuxo = 0;
        if (!s.aPe && sobe > 0) decolar();
      }
      jetAgora = s.aPe ? andarAPe(dt, ctl) : 0;
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
    if (!s.aPe) { astro.atualizar(dt, {}); jetAgora = 0; }

    // tiros (clique / botao): na nave voando, no espaco ou na superficie
    cadencia -= dt;
    const podeAtirar = !s.aPe && !painelAberto && !mapaAberto && (s.modo === 'espaco' || (s.modo === 'superficie' && !s.pousado));
    if (atirando && podeAtirar && !inventarioAberto && !morto && cadencia <= 0) { cadencia = NAVE_ARMAS[navArmaIdx].cad; atirarNave(); }
    if (invAPe !== !!s.aPe) { montarInventario(); mostrarArmaAtual(); }
    if (atirando && s.aPe && !morto && ARMAS[armaIdx].id && !painelAberto && !mapaAberto && !inventarioAberto && cadencia <= 0) { cadencia = ARMAS[armaIdx].cad; atirarAPe(); }
    raiz.classList.toggle('a-pe-ui', !!s.aPe);
    tiros.atualizar(dt, acertou);

    // mira (mouse e setas)
    const livre = s.modo === 'espaco' || s.modo === 'superficie';
    if (livre) {
      // mirando: o mouse fica mais fino (o angulo de visao fechou)
      const fino = 1 - mirarK * .55;
      s.alvoRumo -= mdx * .0024 * fino; mdy *= fino;
      const lim = s.aPe ? .9 : s.pousado ? 1.1 : (s.modo === 'superficie' ? .65 : 1.15);
      s.alvoMira = Math.max(-lim, Math.min(lim, s.alvoMira - mdy * .002));
    }
    mdx = 0; mdy = 0;

    // mirar (botao direito): suave para entrar e sair
    const podeMirar = mirandoBt && !cinema && !morto && !painelAberto && !mapaAberto && !inventarioAberto && (s.aPe || s.modo === 'espaco' || s.modo === 'superficie');
    mirarK += ((podeMirar ? 1 : 0) - mirarK) * (1 - Math.exp(-dt * 12));
    raiz.classList.toggle('mirando', mirarK > .5);
    // camera
    const veloc = s.aPe ? Math.hypot(pe.vel.x, pe.vel.z) : s.vel.length();
    const cmv = Math.cos(s.alvoMira);
    FRENTE.set(Math.sin(s.alvoRumo) * cmv, Math.sin(s.alvoMira), Math.cos(s.alvoRumo) * cmv);
    if (cinema) {
      // cinematica: orientacao e deslocamento da camera vem da entrada
      camPos.copy(ent.off).applyQuaternion(ent.qC).add(s.pos);
      camOlha.set(0, 0, -40).applyQuaternion(ent.qC).add(camPos);
      camRel.subVectors(camPos, s.pos); olhaRel.subVectors(camOlha, s.pos);
    } else if (s.aPe && s.fp) {
      // primeira pessoa: camera no capacete
      _m.copy(pe.pos); _m.y += 1.62;
      camPos.copy(_m).addScaledVector(_v.set(Math.sin(s.alvoRumo), 0, Math.cos(s.alvoRumo)), .12);
      _m.copy(camPos).add(FRENTE);
    } else if (s.aPe) {
      // terceira pessoa a pe: atras e acima do astronauta (armado: por cima do ombro direito)
      // dentro do salao a camera fica mais perto e mais alta (cabe a sala)
      const armado = !!ARMAS[armaIdx].id;
      const R = (s.dentro ? 4.6 : armado ? 4.3 : 6.5) * zoom * (1 - mirarK * .45), el = Math.max(s.dentro ? .2 : -.15, Math.min(1, (armado ? .12 : .22) - s.alvoMira));
      _m.copy(pe.pos); _m.y += armado ? 1.7 : 1.6;
      if (armado || mirarK > .01) { const om = .75 * Math.max(armado ? 1 : 0, mirarK); _m.x -= Math.cos(s.alvoRumo) * om; _m.z += Math.sin(s.alvoRumo) * om; }
      _v.set(_m.x - Math.sin(s.alvoRumo) * Math.cos(el) * R, _m.y + Math.sin(el) * R, _m.z - Math.cos(s.alvoRumo) * Math.cos(el) * R);
      if (s.dentro) {
        // dentro do salao: a camera nao atravessa parede nem teto
        const dx = _v.x - BASE_INT.x, dz = _v.z - BASE_INT.z, d = Math.hypot(dx, dz), lim = RAIO_SALA - .7;
        if (d > lim) { _v.x = BASE_INT.x + dx * lim / d; _v.z = BASE_INT.z + dz * lim / d; }
        _v.y = Math.max(BASE_INT.y + .6, Math.min(BASE_INT.y + 8.3, _v.y));
      } else { const chaoCam = mundo.alturaChao(_v.x, _v.z) + .5; if (_v.y < chaoCam) _v.y = chaoCam; }
      camPos.lerp(_v, 1 - Math.exp(-dt * 10));
      if (armado) _m.addScaledVector(FRENTE, 12); else { _m.x += Math.sin(s.alvoRumo) * 1.5; _m.z += Math.cos(s.alvoRumo) * 1.5; }
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
    abalo *= Math.exp(-dt * 3.5); tremor += abalo * 1.4;
    if (tremor) camera.position.add(_v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(tremor * .45));
    if (s.aPe && s.fp) camOlha.copy(_m);
    if (cinema) camera.quaternion.copy(ent.qC); else camera.lookAt(camOlha);
    astro.raiz.visible = !!s.aPe && !s.fp;
    if (s.aPe) atualizarVista1(dt); else vista1.visible = false;
    // mira de arma (a pe, armado): abre a cada tiro e fecha sozinha
    miraAbre *= Math.exp(-dt * 6);
    raiz.classList.toggle('mira-arma', !!(s.aPe && ARMAS[armaIdx].id)); raiz.style.setProperty('--abre', (6 + miraAbre * 14).toFixed(1) + 'px');
    let fov = s.aPe ? 60 : 62 + Math.min(1, veloc / 150) * 10 + s.dobra * 14 + (s.modo === 'entrando' ? tremor * 8 + (ent.gas || 0) * 10 : 0);
    fov *= 1 - mirarK * (s.aPe ? .32 : .45);   // mirando: a pe aproxima um pouco, na nave da o zoom
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 14)); camera.updateProjectionMatrix(); }

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
    mundo.atualizar(dt, t, camera, naSup ? { verdadeiro: verdadeiroDe(camera.position, ent.ver), W2S: ent.W2S, m: 2, efeitos: { impacto: (q) => { const d = q.distanceTo(camera.position); if (d < 1500) { som.explosao(Math.max(.1, .6 - d / 2500)); abalo = Math.max(abalo, Math.max(0, .5 - d / 2500)); } } } } : { vel: s.vel, dobra: s.dobra });
    atualizarHUD(veloc);
    som.atualizar({
      empuxo: s.aPe || s.pousado ? 0 : empuxo, vel: s.aPe ? 0 : veloc, jet: jetAgora, ligado: !s.pousado,
      ronco: Math.min(1, fx.calor * .8 + (cinema ? (ent.gas || 0) : 0) + s.dobra * .5 + tremor * .3)
    });
    raiz.classList.toggle('a-pe', !!s.aPe);
    if (rede) {
      rede.estado({ p: s.aPe ? pe.pos : s.pos, r: s.aPe ? pe.rumo : s.rumo, modo: cinema || morto ? 'cinema' : s.aPe ? 'pe' : 'nave', arma: s.aPe ? ARMAS[armaIdx].id : NAVE_ARMAS[navArmaIdx].id, esc: s.aPe ? 1 : +nave.raiz.scale.x.toFixed(2) });
      rede.atualizar(dt, cena);
      if (voz) {
        voz.atualizar(volumeVoz);
        vozT -= dt; if (vozSuja || vozT <= 0) { vozSuja = false; vozT = .3; desenharVoz(); }
      }
      const n = rede.remotos.size + 1;
      onlineUI.innerHTML = `<i></i>${n} ${n === 1 ? 'jogador' : 'jogadores'} aqui`;
    }
    raiz.classList.toggle('voando', !!(s.aPe && pe.voando));
    if (mapaAberto) desenharMapaAgora();
    if (meuPvp) { vidaUI.querySelector('em').style.transform = `scaleX(${(minhaVida / 100).toFixed(3)})`; vidaUI.querySelector('span').textContent = Math.round(minhaVida); vidaUI.classList.toggle('baixa', minhaVida <= 35); }
    if (roda.aberta) roda.desenhar(dt * 4);   // (dt ja vem em camera lenta)
    atualizarDestino();
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
    desenharArma3D(dt, cinema);
  }

  /* Arma atual em 3D no canto (girando): uma cena pequena desenhada por cima,
     num recorte da propria tela (scissor), sem outro contexto WebGL. A pe:
     o modelo da arma; na nave: o tipo de tiro (lasers, plasma, missil, ions). */
  const mini = { cena: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .05, 50), atual: null, objs: {}, el: null };
  mini.cena.add(new THREE.AmbientLight(0xb8a8ff, 1.2));
  { const l = new THREE.DirectionalLight(0xffffff, 2.4); l.position.set(2, 3, 4); mini.cena.add(l); const l2 = new THREE.DirectionalLight(0x6fc8ff, 1.2); l2.position.set(-3, -1, -2); mini.cena.add(l2); }
  mini.cam.position.set(0, .15, 1.35); mini.cam.lookAt(0, 0, 0);
  function miniObjeto(chave) {
    if (mini.objs[chave]) return mini.objs[chave];
    const g = new THREE.Group(), add = (geo, cor, x = 0, y = 0, z = 0, basico = false) => { const m = new THREE.Mesh(geo, basico ? new THREE.MeshBasicMaterial({ color: cor }) : new THREE.MeshStandardMaterial({ color: cor, metalness: .6, roughness: .35 })); m.position.set(x, y, z); g.add(m); return m; };
    if (chave.startsWith('pe:')) {
      const id = chave.slice(3);
      if (id !== 'null') { const a = astro.modeloArma(id); a.visible = true; a.scale.setScalar(id === 'rifle' ? 1.7 : id === 'canhao' ? 1.9 : 2.6); const c = new THREE.Box3().setFromObject(a).getCenter(new THREE.Vector3()); a.position.sub(c); g.add(a); }
      else { add(new THREE.SphereGeometry(.2, 20, 14), 0xd8c9b0); [-.12, -.04, .04, .12].forEach((x) => add(new THREE.CapsuleGeometry(.035, .16, 4, 8), 0xd8c9b0, x, .22, 0)); }
      g.rotation.y = Math.PI / 2;
    } else {
      const id = chave.slice(5);
      if (id === 'laser' || id === 'plasma') {
        // a propria nave, com os tiros saindo das asas
        const cor = id === 'laser' ? 0xff4fd8 : 0x4fd2ff;
        const nv = nave.modeloBase.clone(true); nv.scale.multiplyScalar(.28); g.add(nv);
        const brilho = (x, z, comp, r) => {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, comp, 10), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); b.rotation.x = Math.PI / 2; b.position.set(x, -.02, z); g.add(b);
          const n = new THREE.Mesh(new THREE.CylinderGeometry(r * .35, r * .35, comp * 1.02, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); n.rotation.x = Math.PI / 2; n.position.copy(b.position); g.add(n);
        };
        if (id === 'laser') [-.36, .36].forEach((x) => brilho(x, .62, .55, .028));
        else [-.36, .36].forEach((x, k) => [.42, .72, 1].forEach((z) => brilho(x, z + k * .14, .12, .03)));
      } else if (id === 'missil') {
        const corpo = add(new THREE.CylinderGeometry(.06, .06, .6, 14), 0xdcd6ea); corpo.rotation.x = Math.PI / 2;
        const ponta = add(new THREE.ConeGeometry(.06, .16, 14), 0xffb347, 0, 0, .38); ponta.rotation.x = Math.PI / 2;
        for (let k = 0; k < 4; k++) { const a = add(new THREE.BoxGeometry(.015, .14, .12), 0xff6a3d, 0, 0, -.24); a.rotation.z = k * Math.PI / 2; a.position.set(Math.cos(k * Math.PI / 2) * .07, Math.sin(k * Math.PI / 2) * .07, -.24); }
        add(new THREE.SphereGeometry(.05, 10, 8), 0xffd080, 0, 0, -.33, true);
      } else {
        add(new THREE.SphereGeometry(.2, 24, 18), 0xb06bff, 0, 0, 0, true);
        const anel = add(new THREE.TorusGeometry(.3, .02, 8, 40), 0xe6d0ff, 0, 0, 0, true); anel.rotation.x = 1.1;
      }
      g.rotation.y = Math.PI / 2;
    }
    g.visible = false; mini.cena.add(g); mini.objs[chave] = g;
    return g;
  }
  const _ret = new THREE.Vector4();
  function desenharArma3D(dt, cinema) {
    if (!s || cinema || mapaAberto || painelAberto || roda.aberta) return;
    mini.el ||= $('.ja-3d'); const r = mini.el.getBoundingClientRect(); if (!r.width) return;
    const chave = s.aPe ? 'pe:' + ARMAS[armaIdx].id : 'nave:' + NAVE_ARMAS[navArmaIdx].id;
    if (mini.atual !== chave) { if (mini.atual) mini.objs[mini.atual].visible = false; miniObjeto(chave).visible = true; mini.atual = chave; }
    const o = mini.objs[chave]; o.rotation.y += dt * .9; o.rotation.x = Math.sin(tTotal * .8) * .15;
    mini.cam.aspect = r.width / r.height; mini.cam.updateProjectionMatrix();
    renderer.getViewport(_ret);
    renderer.autoClear = false; renderer.setScissorTest(true);
    renderer.setScissor(r.left, innerHeight - r.bottom, r.width, r.height); renderer.setViewport(r.left, innerHeight - r.bottom, r.width, r.height);
    const corAnt = renderer.getClearColor(new THREE.Color()); renderer.setClearColor(0x0d0a1a); renderer.clear(true, true, false); renderer.setClearColor(corAnt);
    renderer.render(mini.cena, mini.cam);
    renderer.setScissorTest(false); renderer.setViewport(_ret); renderer.autoClear = true;
  }

  /* ------------------------------------------------------------------ a pe -- */
  /* A pe: anda relativo a camera e olha para onde a camera olha (as
     animacoes de lado/de costas cuidam do resto). Espaco no chao pula;
     segurando no ar liga o JETPACK (combustivel recarrega no chao). C rola.
     Devolve o empuxo do jetpack (0..1) para o som. */
  function andarAPe(dt, c) {
    const dentro = s.dentro;
    let jet = 0;
    const fx2 = Math.sin(s.alvoRumo), fz = Math.cos(s.alvoRumo);
    if (painelAberto) { pe.vel.x *= .8; pe.vel.z *= .8; }
    else {
      _v.set(fx2 * (c.acelera - c.freia) + fz * c.lado, 0, fz * (c.acelera - c.freia) - fx2 * c.lado);
      const correndo = ok('ShiftLeft', 'ShiftRight') || tq.turbo > 0;
      const sobe = ok('Space') || tq.sobe > 0, desce = ok('ControlLeft', 'ControlRight', 'KeyC', 'KeyF') || tq.desce > 0;
      // a subida do pulo acaba no alto (ou soltando o Espaco)
      if (pe.subidaDoPulo && (pe.velY < 1.2 || !sobe)) pe.subidaDoPulo = false;
      pe.voando = !pe.noChao && sobe && !pe.subidaDoPulo && pe.rolando <= 0;
      if (pe.voando) {
        // voo: empuxo nas 4 direcoes com inercia (acelera e desliza) e para cima
        const vmax = correndo ? 30 : 16, acel = correndo ? 34 : 22;
        if (_v.lengthSq() > 0) { const f = Math.min(1, _v.length()); _v.normalize().multiplyScalar(f); }
        pe.vel.addScaledVector(_v, acel * dt);
        pe.vel.multiplyScalar(Math.exp(-dt * (_v.lengthSq() > 0 ? .6 : 1.6)));
        const h = Math.hypot(pe.vel.x, pe.vel.z); if (h > vmax) { pe.vel.x *= vmax / h; pe.vel.z *= vmax / h; }
        const alvoY = desce ? 0 : (dentro ? 3 : 7);       // Espaco + Ctrl = so voa reto
        pe.velY += (alvoY - pe.velY) * (1 - Math.exp(-dt * 3));
        jet = 1;
      } else if (!pe.noChao) {
        // no ar sem jetpack: cai com gravidade e mantem o embalo do voo
        if (_v.lengthSq() > 0) { const f = Math.min(1, _v.length()); _v.normalize().multiplyScalar(f); }
        pe.vel.addScaledVector(_v, 5 * dt); pe.vel.multiplyScalar(Math.exp(-dt * .25));
      } else {
        // pra frente mais rapido; de lado e de costas um pouco mais devagar (natural)
        const fr = c.acelera - c.freia, la = c.lado;
        const vF = fr >= 0 ? (correndo ? 6.8 : 3.4) : (correndo ? 4.6 : 2.5), vL = correndo ? 5.6 : 3;
        const mag = Math.min(1, Math.hypot(fr, la)) / Math.max(1e-6, Math.hypot(fr, la));
        _v.set(fx2 * fr * vF + fz * la * vL, 0, fz * fr * vF - fx2 * la * vL).multiplyScalar(Math.hypot(fr, la) > 0 ? mag : 0);
        if (pe.rolando <= 0) pe.vel.lerp(_v, 1 - Math.exp(-dt * (pe.noChao ? 10 : 1.2)));
      }
    }
    if (pe.rolando > 0) { pe.rolando -= dt; pe.vel.multiplyScalar(Math.exp(-dt * 2)); }
    pe.pos.x += pe.vel.x * dt; pe.pos.z += pe.vel.z * dt;
    let chao, teto;
    if (dentro) {
      // salao: parede redonda, pedestal e terminal
      const dx = pe.pos.x - BASE_INT.x, dz = pe.pos.z - BASE_INT.z, d = Math.hypot(dx, dz), lim = dentro.int.raio;
      if (d > lim) { pe.pos.x = BASE_INT.x + dx * lim / d; pe.pos.z = BASE_INT.z + dz * lim / d; }
      for (const o of dentro.int.obstaculos) {
        const ox = pe.pos.x - BASE_INT.x - o.x, oz = pe.pos.z - BASE_INT.z - o.z, od = Math.hypot(ox, oz);
        if (od < o.r) { pe.pos.x = BASE_INT.x + o.x + ox * o.r / Math.max(od, .001); pe.pos.z = BASE_INT.z + o.z + oz * o.r / Math.max(od, .001); }
      }
      chao = BASE_INT.y; teto = BASE_INT.y + 6.8;
    } else {
      // colisao: predios e nave; borda do mapa
      for (const p of mundo.predios) {
        _v.set(pe.pos.x - p.pos.x, 0, pe.pos.z - p.pos.z); const d = _v.length();
        if (d < p.raio && pe.pos.y < p.pos.y + 12) { _v.multiplyScalar(p.raio / Math.max(d, .001)); pe.pos.x = p.pos.x + _v.x; pe.pos.z = p.pos.z + _v.z; }
      }
      if (mundo.estruturas) for (const c of mundo.estruturas.colisores) {
        if (pe.pos.y > c.h) continue;
        const dx = pe.pos.x - c.x, dz = pe.pos.z - c.z, d = Math.hypot(dx, dz);
        if (d < c.r) { pe.pos.x = c.x + dx * c.r / Math.max(d, .001); pe.pos.z = c.z + dz * c.r / Math.max(d, .001); }
      }
      _v.set(pe.pos.x - s.pos.x, 0, pe.pos.z - s.pos.z); { const d = _v.length(), r = 4.3; if (d < r && pe.pos.y < s.pos.y + 2) { _v.multiplyScalar(r / Math.max(d, .001)); pe.pos.x = s.pos.x + _v.x; pe.pos.z = s.pos.z + _v.z; } }
      pe.pos.x = Math.max(-mundo.limite, Math.min(mundo.limite, pe.pos.x)); pe.pos.z = Math.max(-mundo.limite, Math.min(mundo.limite, pe.pos.z));
      chao = mundo.alturaChao(pe.pos.x, pe.pos.z); teto = chao + 160;
    }
    // gravidade, pulo e pouso (no chao, acompanha a descida do morro sem "voar")
    if (pe.noChao && pe.velY <= 0 && !jet && pe.pos.y - chao < .7) { pe.pos.y = chao; pe.velY = 0; }
    else {
      if (!pe.voando) pe.velY -= 16 * dt;     // voando, quem manda na vertical e o jetpack
      pe.pos.y += pe.velY * dt; pe.noChao = false;
      if (pe.pos.y > teto) { pe.pos.y = teto; pe.velY = Math.min(0, pe.velY); }
      if (pe.pos.y <= chao) {
        if (pe.velY < -7) { som.pouso(); if (!dentro) mundo.levantarPoeira(pe.pos.x, pe.pos.z, .25); }
        pe.pos.y = chao; pe.velY = 0; pe.noChao = true; pe.voando = false;
        pe.vel.multiplyScalar(.4);             // pousa freando
      }
    }
    // olha para onde a camera olha (andando ou voando); parado, fica como esta
    const v = Math.hypot(pe.vel.x, pe.vel.z);
    if ((v > .3 || jet || ARMAS[armaIdx].id || s.fp) && pe.rolando <= 0) pe.rumo += Math.atan2(Math.sin(s.alvoRumo - pe.rumo), Math.cos(s.alvoRumo - pe.rumo)) * (1 - Math.exp(-dt * 10));
    astro.raiz.position.copy(pe.pos); astro.raiz.rotation.y = pe.rumo;
    // velocidade local para as animacoes (frente / lado esquerdo)
    const sr = Math.sin(pe.rumo), cr = Math.cos(pe.rumo);
    const ev = astro.atualizar(dt, { frente: pe.vel.x * sr + pe.vel.z * cr, lado: pe.vel.x * cr - pe.vel.z * sr, noChao: pe.noChao, jet });
    if (ev) { som.passo(ev === 'corrida'); if (!dentro && ev === 'corrida') mundo.levantarPoeira(pe.pos.x, pe.pos.z, .015); }
    return jet;
  }

  // um laser bateu em algo? (rocha quebra; planeta, sol, chao e predios soltam faisca)
  function acertou(p, dados) {
    // tiro de outro jogador: so o efeito (o dano quem decide e o servidor)
    if (dados && dados.remoto) {
      if (mundo.planetas ? !!mundo.rochaEm(p, 2) : p.y < mundo.alturaChao(p.x, p.z)) { tiros.explodir(p, 2.5, [1, .7, .5]); return true; }
      return false;
    }
    // meu tiro em outro jogador (os dois com PvP ligado)
    if (rede && meuPvp && dados) {
      const alvo = rede.remotoEm(p);
      if (alvo && alvo.pvp) { rede.acerto(alvo.id, dados.arma); tiros.explodir(p, 3, [1, .3, .3]); som.bip(1400, .04); return true; }
    }
    const canhao = dados && dados.pe && dados.arma === 'canhao';
    const bateu = (tam, cor) => { tiros.explodir(p, canhao ? 7 : tam, canhao ? [1, .6, .25] : cor); if (canhao) som.explosao(.5); return true; };
    if (s.dentro) {
      if (Math.hypot(p.x - BASE_INT.x, p.z - BASE_INT.z) > RAIO_SALA - .3 || p.y < BASE_INT.y || p.y > BASE_INT.y + 9) return bateu(1.2, [.8, .6, 1]);
      return false;
    }
    const quebrouAlgo = (tipo, pos) => { som.explosao(tipo === 'barril' ? .7 : .25); if (tipo === 'barril') abalo = Math.max(abalo, Math.max(0, .8 - pos.distanceTo(camera.position) / 60)); };
    const explodirEf = (q, tam, cor) => tiros.explodir(q, tam, cor);
    if (dados && dados.pe) {
      if (mundo.estruturas && mundo.estruturas.testarTiro(p, canhao ? 4 : dados.arma === 'rifle' ? .5 : 1, canhao ? 8 : 0, explodirEf, quebrouAlgo)) { if (canhao) bateu(7); return true; }
      if (p.y < mundo.alturaChao(p.x, p.z)) return bateu(1.5, [.9, .7, 1]);
      for (const pr of mundo.predios) if (Math.hypot(p.x - pr.pos.x, p.z - pr.pos.z) < 6 && p.y < pr.pos.y + 14) return bateu(1.5, [.6, .8, 1]);
      if (Math.hypot(p.x - s.pos.x, p.z - s.pos.z) < 3 && Math.abs(p.y - s.pos.y) < 2) return bateu(1.5, [.7, .9, 1]);
      return false;
    }
    if (mundo.planetas) {
      if (s.modo !== 'espaco') return false;
      const area = dados?.area || 0, dano = dados?.dano || 1;
      const x = mundo.rochaEm(p, 2 + (area ? 4 : 0));
      if (x) {
        // impacto: faisca no ponto do tiro, a rocha pisca e leva o tranco
        tiros.explodir(p, area ? area * .25 : 3.5, area ? [1, .55, .3] : [1, .85, .6]);
        if (area) {
          const n = mundo.danoArea(p, area, dano);
          abalo = Math.max(abalo, Math.min(1.2, .5 + n * .2)); som.explosao(.6 + Math.min(.4, n * .1));
        } else if (mundo.danificar(x, dano)) {
          // quebrou: explosao grande, destrocos e tremor (mais forte quanto maior e mais perto)
          tiros.explodir(x.c, x.k * .55);
          const perto = Math.max(.15, 1 - s.pos.distanceTo(x.c) / 1500);
          abalo = Math.max(abalo, Math.min(1, x.k / 90) * perto); som.explosao(Math.min(1, .35 + x.k / 140));
        } else som.bip(220 + Math.random() * 60, .04);
        return true;
      }
      for (const pl of mundo.planetas) if (p.distanceToSquared(pl.pos) < pl.raio * pl.raio) { tiros.explodir(p, 8, [.8, .6, 1]); return true; }
      if (p.distanceToSquared(mundo.sol.pos) < mundo.sol.raio * mundo.sol.raio) return true;
      return false;
    }
    if (mundo.estruturas && mundo.estruturas.testarTiro(p, dados?.dano || 1, dados?.area ? Math.min(40, dados.area * .25) : 0, explodirEf, quebrouAlgo)) return true;
    if (p.y < mundo.alturaChao(p.x, p.z)) { tiros.explodir(p, dados?.area ? 12 : 4, [.9, .7, 1]); if (dados?.area) { mundo.estruturas?.testarTiro(p, dados.dano, 25, explodirEf, quebrouAlgo); som.explosao(.5); } return true; }
    for (const pr of mundo.predios) if (Math.hypot(p.x - pr.pos.x, p.z - pr.pos.z) < 6 && p.y < pr.pos.y + 14) { tiros.explodir(p, 3, [.6, .8, 1]); return true; }
    return false;
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
    barraVel.style.transform = `scaleX(${Math.min(1, veloc / (s.aPe ? (pe.voando ? 30 : 7) : s.modo === 'espaco' ? 3700 : 150)).toFixed(3)})`;
    elVelRot.textContent = s.aPe ? (pe.voando ? '🚀 JETPACK' : 'A PÉ') : s.dobra > .3 ? '⚡ VELOCIDADE DA LUZ' : 'VELOCIDADE';
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
      if (s.aPe && s.dentro) {
        elAlvoRot.textContent = 'DENTRO DE'; elAlvo.textContent = s.dentro.p.tec.nome; elDist.textContent = `${n}/${mundo.predios.length} visitadas`;
        if (painelAberto) mostrarAcao('');
        else if (perto(s.dentro.int.terminal, 2.2)) mostrarAcao('<kbd>E</kbd> abrir os projetos no terminal');
        else if (perto(s.dentro.int.porta, 2.6)) mostrarAcao('<kbd>E</kbd> sair do prédio');
        else mostrarAcao('');
      } else if (s.aPe) {
        elAlvoRot.textContent = area.titulo.toUpperCase(); elAlvo.textContent = `${n}/${mundo.predios.length}`; elDist.textContent = 'tecnologias visitadas';
        let dmin = 3.4;
        for (const p of mundo.predios) { const d = Math.hypot(pe.pos.x - p.porta.x, pe.pos.z - p.porta.z); if (d < dmin) { dmin = d; predioPerto = p; } }
        navePerto = Math.hypot(pe.pos.x - s.pos.x, pe.pos.z - s.pos.z) < 7.5 && Math.abs(pe.pos.y - s.pos.y) < 5;
        if (painelAberto) mostrarAcao('');
        else if (predioPerto) mostrarAcao(`<kbd>E</kbd> entrar em <b>${predioPerto.tec.nome}</b>`);
        else if (navePerto) mostrarAcao('<kbd>E</kbd> embarcar na nave');
        else mostrarAcao('');
      } else {
        const h = Math.max(0, s.pos.y - mundo.alturaChao(s.pos.x, s.pos.z) - 1.6);
        elAlvoRot.textContent = 'ALTITUDE'; elAlvo.textContent = Math.round(h) + ' m'; elDist.textContent = `${area.titulo} · ${n}/${mundo.predios.length} visitadas`;
        if (s.pousado) mostrarAcao(`<b>Pousado em ${s.planeta.nome}</b><span><kbd>E</kbd> sair da nave e explorar · <kbd>Espaço</kbd> decolar</span>`);
        else mostrarAcao(podePousar() ? '<kbd>E</kbd> pousar' : (h > 300 ? 'subindo… <kbd>Espaço</kbd> sai do planeta' : 'siga os feixes de luz (cada um é uma tecnologia) · <kbd>M</kbd> mapa'));
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
      const esc = 140 / 1700;
      if (s.aPe) { quem = pe.pos; rumo = pe.rumo; }
      mundo.predios.forEach((p) => {
        c.fillStyle = p.visto ? '#2bff8f' : `hsl(${s.planeta.cor},85%,68%)`;
        c.fillRect(p.pos.x * esc - 5, p.pos.z * esc - 5, 10, 10);
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
  if (/debugjogo/.test(location.search)) window.__jogo = { s, pe, tecla, mouse: (x, y) => { mdx += x; mdy += y; }, passo: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) passo(dt); }, interagir, get alvo() { return alvoPerto; }, get mundo() { return mundo; }, get predioPerto() { return predioPerto; }, get mapaInfo() { return mapaInfo; }, get destino() { return destino; }, get tiros() { return tiros; }, camera, get nave() { return nave; }, get voz() { return voz; }, get rede() { return rede; } };

  function fechar() {
    rodando = false;
    removeEventListener('keydown', baixo); removeEventListener('keyup', cima); removeEventListener('resize', medir);
    removeEventListener('mousemove', aoMover); document.removeEventListener('pointerlockchange', aoTravar);
    document.removeEventListener('mousedown', aoApertar); document.removeEventListener('contextmenu', semMenu); removeEventListener('mouseup', aoSoltar);
    if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
    tecla.clear(); clearTimeout(conquistaT);
    if (s?.dentro) { s.dentro.int.destruir(); s.dentro.lixo.forEach((o) => o.dispose && o.dispose()); }
    rede?.fechar(); voz?.fechar();
    nave?.destruir(); astro?.destruir(); mundo.destruir(); ent.mundoProx?.destruir(); tiros?.destruir(); som.fechar();
    rt.dispose(); posMat.dispose(); fotoTex?.dispose(); fotoMat.dispose(); removeEventListener('resize', medirPos);
    renderer.dispose(); renderer.forceContextLoss();
    raiz.remove();
    document.documentElement.classList.remove('jogo-aberto');
    window.__jogoAberto = false;
  }
}
