import * as THREE from 'three';
import './jogo.css';
import { criarNave } from './nave.js';
import { criarEspaco, criarSuperficie } from './cenas.js';

/**
 * Jogo da nave — ETAPA 1: voar pelo sistema da stack, entrar num planeta,
 * pousar e decolar.
 *
 * Abre por cima do site (o botao "Pilotar" na secao Stack Universe) e so e
 * carregado quando alguem clica. Enquanto esta aberto, `window.__jogoAberto`
 * faz o universo e as estrelas do site pararem de desenhar.
 *
 * Estados:
 *   espaco      — voo livre entre os planetas; perto de um, "E" para entrar
 *   entrando    — piloto automatico mergulhando, fogo de reentrada, flash
 *   superficie  — voo baixo sobre o chao do planeta; perto do chao e devagar,
 *                 "E" pousa; pousado, "E" decola; subindo alto, volta ao espaco
 *   saindo      — flash de volta ao espaco, perto do planeta
 *
 * Controles: W/S ou setas = acelerar/frear, A/D ou setas = virar,
 * Espaco/R = subir, Ctrl/F = descer, Shift = turbo, E = interagir, Esc = sair.
 */

const tecla = new Set();
const ok = (...k) => k.some((x) => tecla.has(x));

export async function abrirJogo() {
  if (window.__jogoAberto) return;
  window.__jogoAberto = true;
  document.documentElement.classList.add('jogo-aberto');

  const raiz = document.createElement('div');
  raiz.className = 'jogo';
  raiz.innerHTML = `
    <canvas class="jogo-canvas"></canvas>
    <div class="jogo-rotulos"></div>
    <div class="jogo-flash"></div>
    <div class="jogo-topo">
      <div class="jogo-titulo"><b>STACK UNIVERSE</b><span>pilotando</span></div>
      <button class="jogo-sair" type="button">ESC · SAIR</button>
    </div>
    <div class="jogo-ajuda">
      <span><kbd>W</kbd><kbd>S</kbd> acelerar / frear</span>
      <span><kbd>A</kbd><kbd>D</kbd> deslizar · <kbd>←</kbd><kbd>→</kbd> virar</span>
      <span><kbd>Espaço</kbd><kbd>Ctrl</kbd> subir / descer</span>
      <span><kbd>Shift</kbd> turbo</span>
      <span><kbd>E</kbd> interagir</span>
      <span><kbd>Mouse</kbd> mirar · rodinha = zoom</span>
    </div>
    <div class="jogo-acao"></div>
    <div class="jogo-mira"></div>
    <div class="jogo-dica-mouse">mexa o mouse para mirar · clique para travar o mouse</div>
    <div class="jogo-painel">
      <div class="jogo-vel"><small>VELOCIDADE</small><b>0</b><i><em></em></i></div>
      <div class="jogo-alvo"><small>ALVO</small><b>—</b><span></span></div>
    </div>
    <canvas class="jogo-radar" width="300" height="300"></canvas>
    <div class="jogo-carregando">carregando a nave…</div>`;
  document.body.appendChild(raiz);
  const $ = (s) => raiz.querySelector(s);
  const canvas = $('.jogo-canvas'), flash = $('.jogo-flash'), acao = $('.jogo-acao');
  const elVel = $('.jogo-vel b'), barraVel = $('.jogo-vel em'), elAlvo = $('.jogo-alvo b'), elDist = $('.jogo-alvo span');
  const radar = $('.jogo-radar').getContext('2d');
  const rotulos = $('.jogo-rotulos');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, .1, 2400);
  function medir() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  medir(); addEventListener('resize', medir);

  // entrada
  const baixo = (e) => {
    if (e.key === 'Escape') {
      // com o mouse travado, o primeiro Esc so solta o mouse (o navegador ja faz)
      if (document.pointerLockElement || performance.now() - soltouEm < 250) return;
      fechar(); return;
    }
    tecla.add(e.code);
    if (e.code === 'KeyE' && !e.repeat) interagir();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const cima = (e) => tecla.delete(e.code);
  addEventListener('keydown', baixo); addEventListener('keyup', cima);
  addEventListener('blur', () => tecla.clear());
  $('.jogo-sair').addEventListener('click', () => fechar());

  /* Mouse = mira, como em jogo de nave em terceira pessoa: o MOVIMENTO do
     mouse (nao a posicao) gira a mira e a camera na hora; a nave persegue a
     mira com inercia. Mouse parado, nada gira. Funciona sem travar o
     ponteiro (movementX/Y existe sempre); clicar trava, se o navegador
     deixar, e ai o cursor nao esbarra na borda da tela. Rodinha = zoom. */
  let mdx = 0, mdy = 0, zoom = 1, soltouEm = 0, ultX = null, ultY = null;
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement) return;
    try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* segue sem trava */ }
  });
  const aoMover = (e) => {
    let dx = e.movementX, dy = e.movementY;
    if (dx === undefined) { dx = ultX === null ? 0 : e.clientX - ultX; dy = ultY === null ? 0 : e.clientY - ultY; }
    ultX = e.clientX; ultY = e.clientY;
    if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;   // salto de entrada/saida da janela
    mdx += dx; mdy += dy;
  };
  const aoTravar = () => {
    const preso = document.pointerLockElement === canvas;
    raiz.classList.toggle('mouse-preso', preso);
    if (!preso) soltouEm = performance.now();
  };
  const aoRodar = (e) => { e.preventDefault(); zoom = Math.max(.6, Math.min(2.2, zoom * (1 + Math.sign(e.deltaY) * .1))); };
  addEventListener('mousemove', aoMover);
  document.addEventListener('pointerlockchange', aoTravar);
  canvas.addEventListener('wheel', aoRodar, { passive: false });

  /* ---------------------------------------------------------------- mundo -- */
  let mundo = criarEspaco(cena);
  let nave;
  try { nave = await criarNave(cena); }
  catch (e) { console.warn('[jogo] nave nao carregou', e); $('.jogo-carregando').textContent = 'não deu para carregar a nave'; return; }
  $('.jogo-carregando').remove();

  // estado da nave
  const s = {
    modo: 'espaco', pos: new THREE.Vector3(0, 14, -330), rumo: 0, vel: new THREE.Vector3(),
    banco: 0, arfagem: 0, planeta: null, pousado: false, tModo: 0,
    mira: 0,                       // inclinacao do nariz (rad)
    alvoRumo: 0, alvoMira: 0,      // a MIRA (mouse): para onde a camera olha e a nave vai
    vRumo: 0                       // velocidade de giro (inercia)
  };
  const FRENTE = new THREE.Vector3();
  const camPos = new THREE.Vector3(0, 19, -343), camOlha = new THREE.Vector3();
  let rotuloEls = [];
  function montarRotulos() {
    rotulos.innerHTML = '';
    rotuloEls = (mundo.planetas || []).map((p) => {
      const el = document.createElement('div'); el.className = 'jogo-rotulo';
      el.innerHTML = `<b>${p.nome}</b><span></span>`; el.style.setProperty('--cor', `hsl(${p.cor},85%,72%)`);
      rotulos.appendChild(el); return el;
    });
  }
  montarRotulos();

  function mostrarAcao(txt) { acao.innerHTML = txt || ''; acao.classList.toggle('on', !!txt); }
  function piscar(cor, depois) {
    flash.style.background = cor; flash.classList.add('on');
    setTimeout(() => { depois(); setTimeout(() => flash.classList.remove('on'), 120); }, 520);
  }

  /* ------------------------------------------------------------ interagir -- */
  let alvoPerto = null;
  function interagir() {
    if (s.modo === 'espaco' && alvoPerto) {
      s.modo = 'entrando'; s.tModo = 0; s.planeta = alvoPerto; mostrarAcao('');
    } else if (s.modo === 'superficie') {
      if (s.pousado) { s.pousado = false; s.vel.set(0, 8, 0); mostrarAcao(''); }
      else if (podePousar()) pousar();
    }
  }
  function podePousar() {
    const h = s.pos.y - mundo.alturaChao(s.pos.x, s.pos.z);
    return h < 6 && Math.hypot(s.vel.x, s.vel.z) < 9;
  }
  function pousar() {
    s.pousado = true; s.vel.set(0, 0, 0);
    mundo.levantarPoeira(s.pos.x, s.pos.z, 1);
    const naPlataforma = Math.hypot(s.pos.x, s.pos.z) < 11;
    mostrarAcao(`<b>Pousado em ${s.planeta.nome}${naPlataforma ? ' · na plataforma' : ''}</b>
      <span>Etapa 2 vem aí: sair da nave e explorar a stack. <kbd>E</kbd> decolar</span>`);
  }
  function irParaSuperficie() {
    mundo.destruir(); mundo = criarSuperficie(cena, s.planeta);
    cena.add(nave.raiz); cena.add(nave.rastro);
    rotulos.innerHTML = ''; rotuloEls = [];
    s.modo = 'superficie'; s.pousado = false;
    s.pos.set(0, 70, -120); s.rumo = 0; s.mira = -.15; s.alvoRumo = 0; s.alvoMira = -.15; s.vRumo = 0; s.vel.set(0, -4, 22);
    camPos.set(0, 80, -150);
    $('.jogo-titulo span').textContent = `superfície de ${s.planeta.nome}`;
  }
  function voltarAoEspaco() {
    const p = s.planeta;
    mundo.destruir(); mundo = criarEspaco(cena);
    cena.add(nave.raiz); cena.add(nave.rastro);
    montarRotulos();
    const pl = mundo.planetas.find((x) => x.key === p.key);
    // sai do lado oposto ao sol, de costas para o planeta
    const fora = pl.pos.clone().normalize();
    s.pos.copy(pl.pos).addScaledVector(fora, pl.raio * 2.6);
    s.rumo = Math.atan2(fora.x, fora.z); s.mira = 0; s.alvoRumo = s.rumo; s.alvoMira = 0; s.vRumo = 0; s.vel.copy(fora).multiplyScalar(18);
    camPos.copy(s.pos).addScaledVector(fora, -20).add(new THREE.Vector3(0, 6, 0));
    s.modo = 'espaco';
    $('.jogo-titulo span').textContent = 'pilotando';
  }

  /* ----------------------------------------------------------------- loop -- */
  const relogio = new THREE.Clock();
  let rodando = true;
  const _v = new THREE.Vector3(), _m = new THREE.Vector3();
  let tTotal = 0;
  function quadro() {
    if (!rodando) return;
    requestAnimationFrame(quadro);
    passo(Math.min(.05, relogio.getDelta()));
  }
  function passo(dt) {
    tTotal += dt; const t = tTotal;
    s.tModo += dt;

    const acelera = ok('KeyW', 'ArrowUp') ? 1 : 0, freia = ok('KeyS', 'ArrowDown') ? 1 : 0;
    // setas viram (so teclado); A/D deslizam para os lados (o mouse e quem vira)
    const vira = (ok('ArrowLeft') ? 1 : 0) - (ok('ArrowRight') ? 1 : 0);
    const lado = (ok('KeyA') ? 1 : 0) - (ok('KeyD') ? 1 : 0);
    const sobe = (ok('Space', 'KeyR') ? 1 : 0) - (ok('ControlLeft', 'ControlRight', 'KeyF', 'KeyC') ? 1 : 0);
    const turbo = ok('ShiftLeft', 'ShiftRight') && acelera;

    if (s.modo === 'espaco' || (s.modo === 'superficie' && !s.pousado)) {
      const naSuperficie = s.modo === 'superficie';
      // a nave persegue a mira: giro com inercia (mola), nariz suave
      const limMira = naSuperficie ? .65 : 1.15;
      const dRumo = Math.atan2(Math.sin(s.alvoRumo - s.rumo), Math.cos(s.alvoRumo - s.rumo));
      const taxa = Math.max(-2.6, Math.min(2.6, dRumo * 4.2));
      s.vRumo += (taxa - s.vRumo) * (1 - Math.exp(-dt * 7));
      s.rumo += s.vRumo * dt;
      s.mira += (Math.max(-limMira, Math.min(limMira, s.alvoMira)) - s.mira) * (1 - Math.exp(-dt * 4.5));
      const cm = Math.cos(s.mira);
      FRENTE.set(Math.sin(s.rumo) * cm, Math.sin(s.mira), Math.cos(s.rumo) * cm);
      const forca = acelera * (turbo ? 95 : 42) - freia * 30;
      s.vel.addScaledVector(FRENTE, forca * dt);
      // deslize lateral (A/D): perpendicular ao rumo, no plano
      s.vel.x += Math.cos(s.rumo) * lado * 34 * dt; s.vel.z -= Math.sin(s.rumo) * lado * 34 * dt;
      s.vel.y += sobe * dt * (naSuperficie ? 42 : 30);
      // sem gravidade: soltando os controles a nave flutua parada (pairando);
      // descer e com Ctrl ou apontando o nariz para baixo
      // arrasto: so a parte lateral e forte (a nave "segura" na curva)
      const frontal = FRENTE.clone().multiplyScalar(s.vel.dot(FRENTE));
      // no espaco o voo e 3D (vai para onde o nariz aponta); na superficie o
      // vertical fica com Espaco/Ctrl e a gravidade
      const lateral = s.vel.clone().sub(frontal); if (naSuperficie) lateral.y = 0;
      s.vel.sub(lateral.multiplyScalar(1 - Math.exp(-dt * 2.4)));
      // solta = freia ate parar e fica pairando (como nave de jogo)
      const solto = !acelera && !freia && !lado && !sobe;
      s.vel.multiplyScalar(Math.exp(-dt * (acelera ? .35 : solto ? 1.8 : .9)));
      if (naSuperficie) s.vel.y *= Math.exp(-dt * (sobe ? .9 : 3));   // subir para sair do planeta leva ~4s; solto, para na hora
      const max = turbo ? 150 : 70; if (s.vel.length() > max) s.vel.setLength(max);
      s.pos.addScaledVector(s.vel, dt);

      if (!naSuperficie) {
        // nao atravessa planeta nem sol
        for (const p of mundo.planetas) {
          _v.subVectors(s.pos, p.pos); const d = _v.length(), lim = p.raio * 1.18 + 1.5;
          if (d < lim) { s.pos.copy(p.pos).addScaledVector(_v.normalize(), lim); s.vel.multiplyScalar(.4); }
        }
        _v.subVectors(s.pos, mundo.sol.pos); if (_v.length() < 20) { s.pos.copy(mundo.sol.pos).addScaledVector(_v.normalize(), 20); s.vel.multiplyScalar(.3); }
        if (s.pos.length() > 520) s.pos.setLength(520);
      } else {
        const chao = mundo.alturaChao(s.pos.x, s.pos.z) + 1.4;
        if (s.pos.y < chao) { s.pos.y = chao; if (s.vel.y < 0) s.vel.y = 0; }
        s.pos.x = Math.max(-640, Math.min(640, s.pos.x)); s.pos.z = Math.max(-640, Math.min(640, s.pos.z));
        if (s.pos.y > 140) { s.modo = 'saindo'; s.tModo = 0; piscar(`hsl(${s.planeta.cor},60%,80%)`, voltarAoEspaco); }
        const h = s.pos.y - chao;
        if (h < 12 && acelera + Math.abs(sobe) > 0) mundo.levantarPoeira(s.pos.x, s.pos.z, .04);
      }
      // inclina na curva conforme a velocidade de giro (e no deslize lateral)
      s.banco += (Math.max(-.9, Math.min(.9, s.vRumo * .38 + lado * .35)) - s.banco) * (1 - Math.exp(-dt * 6));
      s.arfagem += (-sobe * .18 - acelera * .05 - s.arfagem) * (1 - Math.exp(-dt * 4));
    } else if (s.modo === 'entrando') {
      // piloto automatico: mergulha no planeta, e no meio o flash troca a cena
      const p = s.planeta;
      _v.subVectors(p.pos, s.pos).normalize();
      s.vel.lerp(_v.multiplyScalar(90), 1 - Math.exp(-dt * 3));
      s.pos.addScaledVector(s.vel, dt);
      s.rumo += (Math.atan2(s.vel.x, s.vel.z) - s.rumo) * (1 - Math.exp(-dt * 4));
      s.banco *= .9; s.mira *= .9; s.vRumo = 0;
      s.alvoRumo = s.rumo; s.alvoMira = s.mira;
      if (s.tModo > 1.15 && s.modo === 'entrando') { s.modo = 'trocando'; piscar(`hsl(${p.cor},70%,75%)`, irParaSuperficie); }
    }

    // nave
    nave.raiz.position.copy(s.pos);
    nave.raiz.rotation.order = 'YXZ';
    nave.raiz.rotation.y = s.rumo; nave.raiz.rotation.x = -s.mira;
    nave.corpo.rotation.z = -s.banco; nave.corpo.rotation.x = s.arfagem;
    if (s.pousado) { nave.corpo.position.y += (-.6 - nave.corpo.position.y) * .1; } else nave.corpo.position.y += (Math.sin(t * 2) * .12 - nave.corpo.position.y) * .1;
    const reentrada = s.modo === 'entrando' ? Math.min(1, s.tModo / .8) : 0;
    nave.atualizar(dt, s.pousado ? 0 : Math.max(acelera * (turbo ? 1 : .75), s.modo === 'entrando' ? 1 : 0, Math.abs(sobe) * .5, Math.abs(lado) * .4, .12), turbo || s.modo === 'entrando', t);

    // mira (mouse e setas): gira na hora; a camera fica atras DELA, entao a
    // visao responde ao mouse sem esperar a nave virar
    if (s.modo !== 'entrando' && s.modo !== 'trocando') {
      s.alvoRumo += (vira * 1.6 * dt) - mdx * .0024;
      const lim = s.pousado ? 1.1 : (s.modo === 'superficie' ? .65 : 1.15);
      s.alvoMira = Math.max(-lim, Math.min(lim, s.alvoMira - mdy * .002));
    }
    const veloc = s.vel.length();
    const cmv = Math.cos(s.alvoMira);
    FRENTE.set(Math.sin(s.alvoRumo) * cmv, Math.sin(s.alvoMira), Math.cos(s.alvoRumo) * cmv);
    if (s.pousado) {
      // pousado: a mira gira a camera em volta da nave (mouse para cima = olhar de cima)
      const R = 17 * zoom, el = Math.max(.05, .25 - s.alvoMira);
      _v.set(s.pos.x - Math.sin(s.alvoRumo) * Math.cos(el) * R, s.pos.y + 2 + Math.sin(el) * R, s.pos.z - Math.cos(s.alvoRumo) * Math.cos(el) * R);
      camPos.lerp(_v, 1 - Math.exp(-dt * 8));
      _m.copy(s.pos); _m.y += 1;
    } else {
      const atras = (12 + veloc * .05) * zoom;
      _v.copy(s.pos).addScaledVector(FRENTE, -atras); _v.y += 4.2 * zoom;
      camPos.lerp(_v, 1 - Math.exp(-dt * 9));
      _m.copy(s.pos).addScaledVector(FRENTE, 12); _m.y += 1;
    }
    camOlha.lerp(_m, 1 - Math.exp(-dt * 14));
    camera.position.copy(camPos);
    if (reentrada) camera.position.add(_m.set((Math.random() - .5), (Math.random() - .5), 0).multiplyScalar(reentrada * .5));
    camera.lookAt(camOlha);
    mdx = 0; mdy = 0;
    const fov = 62 + Math.min(1, veloc / 150) * 16;
    if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * .1; camera.updateProjectionMatrix(); }

    mundo.atualizar(dt, t, camera);

    // HUD
    elVel.textContent = Math.round(veloc * 3.6) + ' km/h';
    barraVel.style.transform = `scaleX(${Math.min(1, veloc / 150).toFixed(3)})`;
    if (s.modo === 'espaco') {
      let melhor = null, dm = Infinity;
      mundo.planetas.forEach((p, i) => {
        const d = s.pos.distanceTo(p.pos) - p.raio;
        if (d < dm) { dm = d; melhor = p; }
        // rotulo na tela
        _v.copy(p.pos); _v.y += p.raio * 1.4; _v.project(camera);
        const el = rotuloEls[i]; const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
        el.style.opacity = vis ? '1' : '0';
        if (vis) { el.style.transform = `translate(${((_v.x + 1) / 2 * innerWidth).toFixed(0)}px,${((1 - _v.y) / 2 * innerHeight).toFixed(0)}px) translate(-50%,-100%)`; el.lastChild.textContent = Math.max(0, Math.round(d)) + ' m'; }
      });
      elAlvo.textContent = melhor ? melhor.nome : '—'; elDist.textContent = melhor ? Math.round(dm) + ' m' : '';
      alvoPerto = melhor && dm < melhor.raio * 2.2 ? melhor : null;
      mostrarAcao(alvoPerto ? `<kbd>E</kbd> entrar em <b>${alvoPerto.nome}</b>` : '');
    } else if (s.modo === 'superficie') {
      const h = Math.max(0, s.pos.y - mundo.alturaChao(s.pos.x, s.pos.z) - 1.4);
      elAlvo.textContent = 'ALTITUDE'; elDist.textContent = Math.round(h) + ' m';
      if (!s.pousado) mostrarAcao(podePousar() ? '<kbd>E</kbd> pousar' : (h > 100 ? 'saindo da atmosfera…' : `desça até o chão para pousar · <kbd>Espaço</kbd> sobe até sair`));
    }
    desenharRadar();
    renderer.render(cena, camera);
  }

  function desenharRadar() {
    const W = 300, c = radar; c.clearRect(0, 0, W, W);
    c.save(); c.translate(W / 2, W / 2);
    c.strokeStyle = 'rgba(169,139,255,.25)'; c.lineWidth = 2;
    [140, 95, 50].forEach((r) => { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); });
    if (s.modo === 'espaco' || s.modo === 'entrando') {
      const esc = 140 / 520;
      c.fillStyle = '#fff1d6'; c.beginPath(); c.arc(0, 0, 6, 0, Math.PI * 2); c.fill();
      mundo.planetas.forEach((p) => {
        c.fillStyle = `hsl(${p.cor},85%,68%)`;
        c.beginPath(); c.arc(p.pos.x * esc, p.pos.z * esc, 3 + p.tam * 3, 0, Math.PI * 2); c.fill();
      });
      c.translate(s.pos.x * esc, s.pos.z * esc);
    }
    c.rotate(-s.rumo + Math.PI);
    c.fillStyle = '#2bff8f'; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath(); c.fill();
    c.restore();
  }

  requestAnimationFrame(quadro);
  // modo de teste (?debugjogo): avanca a simulacao sem depender do rAF
  if (/debugjogo/.test(location.search)) window.__jogo = { s, tecla, mouse: (x, y) => { mdx += x; mdy += y; }, passo: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) passo(dt); }, interagir, get alvo() { return alvoPerto; }, get mundo() { return mundo; } };

  function fechar() {
    rodando = false;
    removeEventListener('keydown', baixo); removeEventListener('keyup', cima); removeEventListener('resize', medir);
    removeEventListener('mousemove', aoMover); document.removeEventListener('pointerlockchange', aoTravar);
    if (document.pointerLockElement) document.exitPointerLock();
    tecla.clear();
    nave?.destruir(); mundo.destruir();
    renderer.dispose(); renderer.forceContextLoss();
    raiz.remove();
    document.documentElement.classList.remove('jogo-aberto');
    window.__jogoAberto = false;
  }
}
