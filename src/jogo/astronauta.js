import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { montarArma } from './armas3d.js';

/**
 * O astronauta (Quaternius, "Astronaut", CC0 — public/assets/jogo/
 * astronauta.glb, enxugado: Idle_Neutral, Idle, Walk, Run, Run_Back,
 * Run_Left, Run_Right, Roll, Wave, Interact, Idle_Gun_Pointing,
 * Idle_Gun_Shoot, Run_Shoot, Gun_Shoot).
 *
 * Locomocao fluida: todos os ciclos (andar, correr, de costas, de lado,
 * correr armado) andam na MESMA fase (0..1), avancada pela velocidade. Assim
 * misturar andar com correr, ou frente com lado, nunca "embaralha" as
 * pernas. Pesos e inclinacoes sao suavizados.
 * No ar: pose parada, corpo inclinado para onde voa (frente/lados) e um leve
 * balanco; o jetpack tem chama e fumaca.
 * Armas: um modelo na mao direita (montado na pose de mira) e a pose armada
 * (parado mirando, correndo com a arma). Frente = +z local.
 */
const ALTURA = 1.85;
const CICLO = ['Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Run_Shoot'];

export async function criarAstronauta(cena) {
  const gltf = await new GLTFLoader().loadAsync('/assets/jogo/astronauta.glb');
  const modelo = gltf.scene;
  modelo.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const caixa = new THREE.Box3().setFromObject(modelo);
  modelo.scale.setScalar(ALTURA / (caixa.max.y - caixa.min.y));
  const raiz = new THREE.Group(); raiz.add(modelo); raiz.visible = false;
  cena.add(raiz);

  const mixer = new THREE.AnimationMixer(modelo);
  const clip = (n) => gltf.animations.find((a) => a.name === n || a.name.endsWith('|' + n));
  const LOOP = ['Idle_Neutral', 'Idle', 'Idle_Gun_Pointing', ...CICLO];
  const acao = {}, peso = {};
  LOOP.forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0); acao[n] = a; peso[n] = n === 'Idle_Neutral' ? 1 : 0; });
  // ciclos de passo: o tempo e controlado a mao (fase comum)
  CICLO.forEach((n) => { if (acao[n]) acao[n].timeScale = 0; });
  ['Wave', 'Interact', 'Roll', 'Idle_Gun_Shoot', 'Gun_Shoot'].forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; acao[n] = a; });
  let gesto = null;

  /* ---- armas na mao direita ---- */
  const mao = modelo.getObjectByName('WristR') || modelo.getObjectByName('Wrist.R');
  const armas = {};   // modelos detalhados (armas3d.js)
  // monta as armas na pose de mira: alinhadas com a frente do corpo, na mao
  if (mao && acao.Idle_Gun_Pointing) {
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Gun_Pointing' ? 1 : 0));
    mixer.update(0); modelo.updateMatrixWorld(true);
    const p = new THREE.Vector3(); mao.getWorldPosition(p);
    ['blaster', 'rifle', 'canhao', 'espada'].forEach((t) => {
      const g = montarArma(t); g.position.copy(p); g.position.y += .02; raiz.add(g); raiz.updateMatrixWorld(true); mao.attach(g); g.userData.fixarBase(); armas[t] = g;
    });
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0));
  }
  let armaAtual = null;

  /* ---- as duas maos na arma: o braco esquerdo vai ate a empunhadura da
     frente (IK de dois ossos: ombro e cotovelo) e os dedos fecham ---- */
  const osso = (n) => modelo.getObjectByName(n);
  const braco = { clavicula: osso('ShoulderL'), ombro: osso('UpperArmL'), cotovelo: osso('LowerArmL'), pulso: osso('WristL') };
  const dedos = ['Index', 'Middle', 'Ring', 'Pinky'].flatMap((d) => ['1L', '2L', '3L', '1R', '2R', '3R'].map((n) => d + n)).map(osso).filter(Boolean);
  const bracoR = { ombro: osso('UpperArmR'), cotovelo: osso('LowerArmR'), pulso: osso('WristR') };
  const polegares = ['Thumb1L', 'Thumb2L', 'Thumb1R', 'Thumb2R'].map(osso).filter(Boolean);
  // pose de repouso dos dedos: volta a ela antes da animacao (algumas animacoes
  // nao mexem nos dedos, e a curva se acumularia quadro a quadro)
  const repouso = new Map([...dedos, ...polegares].map((o) => [o, o.quaternion.clone()]));
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _T = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _en = new THREE.Vector3();
  const _qa = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _id = new THREE.Quaternion(), _qd = new THREE.Quaternion();
  let ikPeso = 0;
  // gira um osso (no mundo) para que a direcao "de" vire "para", com peso
  // (a conta e feita no espaco do PAI do osso: o esqueleto tem reflexao, e com
  // quaternions no mundo o giro saia ao contrario)
  const _inv = new THREE.Matrix4();
  function girar(o, de, para, k) {
    _inv.copy(o.parent.matrixWorld).invert();
    de.transformDirection(_inv); para.transformDirection(_inv);
    _qw.setFromUnitVectors(de, para); _qa.copy(_id).slerp(_qw, Math.min(1, k));   // (_qw separado: usar o mesmo quaternion dos dois lados zerava o giro)
    o.quaternion.premultiply(_qa);
    o.updateWorldMatrix(false, true);
  }
  function maoEsquerdaNa(alvo, k) {
    const { clavicula, ombro, cotovelo, pulso } = braco; if (!ombro || !cotovelo || !pulso || k < .01) return;
    ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W); _T.copy(alvo);
    let a = _S.distanceTo(_E), b = _E.distanceTo(_W);
    // longe demais: a clavicula leva o ombro um pouco para a frente (como quem
    // estica o braco para segurar a arma)
    if (clavicula && _S.distanceTo(_T) > (a + b) * .97) {
      clavicula.getWorldPosition(_p);
      girar(clavicula, _S.clone().sub(_p), _T.clone().sub(_p), k * .45);
      ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    }
    let d = _S.distanceTo(_T); d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d));
    _n.subVectors(_T, _S).normalize();
    // cotovelo dobra para o lado em que ja esta (e um pouco para baixo)
    _p.subVectors(_E, _S); _p.addScaledVector(_n, -_p.dot(_n)); _p.y -= .02;
    if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0); _p.normalize();
    const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    _en.copy(_S).addScaledVector(_n, Math.cos(A) * a).addScaledVector(_p, Math.sin(A) * a);
    girar(ombro, _E.clone().sub(_S), _en.clone().sub(_S), k);
    cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    girar(cotovelo, _W.clone().sub(_E), _T.clone().sub(_E), k);
  }
  // fecha os dedos (por cima da animacao, que os reposiciona todo quadro)
  function fecharDedos(k) {
    if (k < .01) return;
    _qd.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .75 * k);
    for (const o of dedos) { o.quaternion.multiply(_qd); }
    _qd.setFromAxisAngle(new THREE.Vector3(0, 0, 1), .45 * k);
    for (const o of polegares) o.quaternion.multiply(_qd);
  }
  // sabre em guarda: cotovelo direito dobrado e baixo, antebraco cruzando na
  // frente do corpo (a lamina sobe na diagonal; a esquerda segura o pomo pelo IK)
  const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3();
  function guardaSabre(k) {
    const { ombro, cotovelo, pulso } = bracoR; if (!ombro || !cotovelo || !pulso || k < .01) return;
    _f.set(0, 0, 1).transformDirection(raiz.matrixWorld); _l.set(1, 0, 0).transformDirection(raiz.matrixWorld);
    ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E);
    _d.set(0, -.8, 0).addScaledVector(_f, .45).addScaledVector(_l, .12).normalize();
    girar(ombro, _E.clone().sub(_S), _d.clone(), k);
    cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    _d.set(0, .3, 0).addScaledVector(_f, .8).addScaledVector(_l, .5).normalize();
    girar(cotovelo, _W.clone().sub(_E), _d.clone(), k);
  }
  let guardaPeso = 0;
  // gira um osso em volta do "para cima" do mundo (o tronco no golpe)
  const _up = new THREE.Vector3();
  function torcer(o, ang) {
    _inv.copy(o.parent.matrixWorld).invert(); _up.set(0, 1, 0).transformDirection(_inv);
    o.quaternion.premultiply(_qa.setFromAxisAngle(_up, ang)); o.updateWorldMatrix(false, true);
  }
  // andamento da recarga de cada arma (0..1), guardado aqui para o desenho
  const recarga = { blaster: -1, rifle: -1, canhao: -1 };   // -1 = sem recarregar; 0..1 = andamento
  let golpeT = -1;

  /* ---- jetpack ---- */
  const jet = new THREE.Group();
  const metalJ = new THREE.MeshStandardMaterial({ color: 0xc9c4d8, metalness: .8, roughness: .3 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x24202e, metalness: .6, roughness: .4 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x9f7bff });
  const bocalGeo = new THREE.CylinderGeometry(.05, .075, .1, 12);
  const chamaGeo = new THREE.ConeGeometry(.07, .5, 12, 1, true); chamaGeo.translate(0, -.25, 0);
  const chamaMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const nucleoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const chamas = [];
  for (const x of [-.11, .11]) {
    const tanque = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .3, 6, 14), metalJ); tanque.position.set(x, 0, 0); jet.add(tanque);
    const faixa = new THREE.Mesh(new THREE.CylinderGeometry(.088, .088, .03, 14), neon); faixa.position.set(x, .08, 0); jet.add(faixa);
    const bocal = new THREE.Mesh(bocalGeo, escuro); bocal.position.set(x, -.27, 0); jet.add(bocal);
    const ch = new THREE.Mesh(chamaGeo, chamaMat); ch.position.set(x, -.32, 0); jet.add(ch);
    const nu = new THREE.Mesh(chamaGeo, nucleoMat); nu.scale.set(.45, .6, .45); ch.add(nu);
    chamas.push(ch);
  }
  const centro = new THREE.Mesh(new THREE.BoxGeometry(.16, .32, .1), escuro); centro.position.set(0, .02, .03); jet.add(centro);
  const luzJet = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), neon); luzJet.position.set(0, .12, -.03); jet.add(luzJet);
  modelo.updateMatrixWorld(true);
  jet.position.set(0, 1.22, -.24); jet.rotation.x = .08;
  raiz.add(jet); raiz.updateMatrixWorld(true);
  const tronco = modelo.getObjectByName('Torso') || modelo.getObjectByName('Chest');
  if (tronco) tronco.attach(jet);
  // o tronco gira no golpe do sabre: volta ao repouso todo quadro (nem toda animacao mexe nele)
  if (tronco) repouso.set(tronco, tronco.quaternion.clone());

  /* ---- fumaca do jetpack (no mundo) ---- */
  const N = 160, pos = new Float32Array(N * 3), vida = new Float32Array(N), vel = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('vida', new THREE.BufferAttribute(vida, 1));
  const fumaca = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float vida; varying float v; void main(){ v = vida; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = min(40., (1.4 - vida) * 160. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float v; void main(){ if (v <= 0.) discard; float d = length(gl_PointCoord - .5) * 2.; float a = (1. - d) * v * .5; if (a <= 0.) discard; gl_FragColor = vec4(mix(vec3(.5,.45,.7), vec3(.6,.85,1.), v) * a, a); }'
  }));
  fumaca.frustumCulled = false; cena.add(fumaca);
  let prox = 0, acum = 0, empuxo = 0, fase = 0, metadeAnt = 0, tempo = 0, claraoT = 0;
  const inc = { f: 0, l: 0 };
  const _b = new THREE.Vector3();

  return {
    raiz, fumaca,
    gesto(n) { const a = acao[n]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.fadeIn(.12); a.play(); gesto = a; },
    get gesticulando() { return !!(gesto && gesto.isRunning()); },
    /** arma na mao: null, 'blaster', 'rifle' ou 'canhao' */
    arma(t) { armaAtual = t && armas[t] ? t : null; for (const k in armas) armas[k].visible = k === armaAtual; },
    get armaAtual() { return armaAtual; },
    /** posicao da boca da arma no mundo (de onde sai o tiro) */
    boca(out) { const a = armas[armaAtual]; if (!a) return out.copy(raiz.position).setY(raiz.position.y + 1.3); raiz.updateMatrixWorld(true); return a.userData.boca.getWorldPosition(out); },
    /** coice do tiro (animacao rapida por cima) */
    /** um modelo solto da arma (para a visao em primeira pessoa) */
    modeloArma(t) { return montarArma(t); },
    /** andamento da recarga de uma arma (0..1; -1 = parada) */
    recarregar(t, k) { if (t in recarga) recarga[t] = k; },
    /** golpe da espada: o arco da lamina e o braco */
    golpear() { golpeT = 0; },
    /** o modelo da arma na mao (para o rastro do sabre) */
    armaObj(t) { return armas[t] || null; },
    atirou() {
      const ar = armas[armaAtual]; if (ar) { ar.userData.clarao.material.opacity = 1; ar.userData.clarao.material.rotation = Math.random() * 6; claraoT = .06; }
      const a = acao.Idle_Gun_Shoot; if (!a || (gesto && gesto !== a && gesto.isRunning())) return; a.reset(); a.setEffectiveWeight(1); a.timeScale = 2.2; a.fadeIn(.04); a.play(); gesto = a; },
    /**
     * frente/lado: velocidade LOCAL (m/s, frente = para onde ele olha, lado
     * positivo = esquerda); noChao; jet 0..1. Devolve 'passo' ou 'corrida'
     * quando um pe toca o chao.
     */
    atualizar(dt, { frente = 0, lado = 0, noChao = true, jet: j = 0 }) {
      tempo += dt;
      if (claraoT > 0) { claraoT -= dt; if (claraoT <= 0) for (const k in armas) armas[k].userData.clarao.material.opacity = 0; }
      // sabre tambem usa a pose armada: as duas maos no cabo, lamina em guarda
      const v = Math.hypot(frente, lado), armado = !!armaAtual;
      const alvo = {}; LOOP.forEach((n) => { alvo[n] = 0; });
      if (!noChao) {
        alvo.Idle = 1;
      } else if (v < .25) {
        alvo[armado ? 'Idle_Gun_Pointing' : 'Idle_Neutral'] = 1;
      } else {
        const f = Math.max(0, frente) / v, b = Math.max(0, -frente) / v, l = Math.max(0, lado) / v, r = Math.max(0, -lado) / v;
        const corre = Math.min(1, Math.max(0, (v - 2.6) / 2.8)), anda = Math.min(1, v / 1.1);
        if (armado) alvo.Run_Shoot = f * anda;
        else { alvo.Walk = f * (1 - corre) * anda; alvo.Run = f * corre * anda; }
        alvo.Run_Back = b * anda; alvo.Run_Left = l * anda; alvo.Run_Right = r * anda;
        alvo[armado ? 'Idle_Gun_Pointing' : 'Idle_Neutral'] = 1 - anda;
      }
      let g = 0;
      if (gesto) { if (gesto.isRunning()) g = Math.min(1, gesto.time * 10, (gesto.getClip().duration - gesto.time) * 8); else gesto = null; }
      // o tiro so mexe nos bracos de verdade parado; correndo, o coice e leve
      if (gesto === acao.Idle_Gun_Shoot && v > .5) g *= .35;
      const k = 1 - Math.exp(-dt * 7);
      for (const n of LOOP) { if (!acao[n]) continue; peso[n] += (alvo[n] - peso[n]) * k; acao[n].setEffectiveWeight(peso[n] * (1 - g)); }
      // fase comum dos ciclos: andar ~1 passo duplo/s a 1,6 m/s; correr mais rapido
      // ritmo do passo pela PASSADA de cada animacao (metros por ciclo): andar
      // ~1,5 m/s e correr ~5,2 m/s na velocidade natural do clipe. De lado e de
      // costas usam clipes de corrida, entao a passada de corrida vale para eles
      if (noChao && v > .05) {
        const dW = acao.Walk ? acao.Walk.getClip().duration : 1, dR = acao.Run ? acao.Run.getClip().duration : .7;
        const passadaW = 1.5 * dW, passadaR = 5.2 * dR;
        const naoFrente = v > 0 ? (Math.max(0, -frente) + Math.abs(lado)) / (Math.abs(frente) + Math.abs(lado) + 1e-6) : 0;
        const kCorre = Math.max(naoFrente, Math.min(1, Math.max(0, (v - 2.6) / 2.8)));
        // devagar demais com passada de corrida fica "arrastado": encurta a passada
        const passada = (passadaW + (passadaR - passadaW) * kCorre) * (.55 + .45 * Math.min(1, v / 4));
        fase = (fase + dt * v / passada) % 1;
      }
      for (const n of CICLO) if (acao[n]) acao[n].time = fase * acao[n].getClip().duration;
      for (const [o, q] of repouso) o.quaternion.copy(q);
      mixer.update(dt);
      // no ar: inclina para onde voa (suave) e balanca de leve
      const alvoF = noChao ? 0 : Math.max(-.5, Math.min(.6, frente * .045)), alvoL = noChao ? 0 : Math.max(-.45, Math.min(.45, -lado * .045));
      const ki = 1 - Math.exp(-dt * 4);
      inc.f += (alvoF - inc.f) * ki; inc.l += (alvoL - inc.l) * ki;
      const bal = noChao ? 0 : Math.sin(tempo * 2.2) * .04;
      modelo.rotation.x = inc.f + bal * .5; modelo.rotation.z = inc.l + bal;
      modelo.position.y = noChao ? 0 : Math.sin(tempo * 1.7) * .05;
      // jetpack: chama e fumaca
      empuxo += (j - empuxo) * (1 - Math.exp(-dt * 12));
      chamas.forEach((c, i) => { c.visible = empuxo > .03; const tr = 1 + Math.sin(tempo * 60 + i * 2) * .12; c.scale.set(.8 + empuxo * .5, (.3 + empuxo * 1.6) * tr, .8 + empuxo * .5); });
      luzJet.material.color.setHex(empuxo > .05 ? 0x8fd8ff : 0x9f7bff);
      raiz.updateMatrixWorld();
      // armado: a mao esquerda segura a frente da arma (nao no rolamento)
      const rolando = gesto === acao.Roll && gesto?.isRunning();
      ikPeso += ((armado && !rolando ? 1 : 0) - ikPeso) * (1 - Math.exp(-dt * 10));
      guardaPeso += ((armaAtual === 'espada' && !rolando ? 1 : 0) - guardaPeso) * (1 - Math.exp(-dt * 10));
      if (guardaPeso > .01) { modelo.updateMatrixWorld(true); guardaSabre(guardaPeso); }
      // golpe do sabre (a arma corta e o tronco gira junto) e recarga (a arma
      // vira e a mao esquerda faz a troca da celula) — antes do IK, que segue a mao
      if (golpeT >= 0) {
        golpeT += dt / .45;
        if (golpeT >= 1) { golpeT = -1; armas.espada?.userData.golpe(-1); }
        else {
          armas.espada?.userData.golpe(golpeT);
          const k = golpeT, giro = k < .2 ? -.5 * (k / .2) : k < .45 ? -.5 + 1.15 * ((k - .2) / .25) : .65 * (1 - (k - .45) / .55);
          if (tronco) { modelo.updateMatrixWorld(true); torcer(tronco, giro); }
        }
      }
      for (const k in recarga) armas[k]?.userData.recarga(recarga[k]);
      if (ikPeso > .01 && armas[armaAtual]) {
        fecharDedos(ikPeso); modelo.updateMatrixWorld(true);
        maoEsquerdaNa(armas[armaAtual].userData.maoEsq.getWorldPosition(_T), ikPeso);
      }
      acum += dt * empuxo * 120;
      while (acum >= 1) {
        acum -= 1; const i = prox; prox = (prox + 1) % N;
        _b.set((Math.random() < .5 ? -.11 : .11), -.4, 0); jet.localToWorld(_b);
        pos[i * 3] = _b.x; pos[i * 3 + 1] = _b.y; pos[i * 3 + 2] = _b.z;
        vel[i * 3] = (Math.random() - .5) * 1.2; vel[i * 3 + 1] = -4 - Math.random() * 3; vel[i * 3 + 2] = (Math.random() - .5) * 1.2; vida[i] = 1;
      }
      for (let i = 0; i < N; i++) {
        if (vida[i] <= 0) continue; vida[i] -= dt * 1.6;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] *= .94;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.vida.needsUpdate = true;
      // passos: dois por ciclo (fase 0 e 0,5)
      let evento = null;
      if (noChao && v > .6) { const metade = fase < .5 ? 0 : 1; if (metade !== metadeAnt) { metadeAnt = metade; evento = v > 4 ? 'corrida' : 'passo'; } }
      return evento;
    },
    destruir() { cena.remove(raiz); cena.remove(fumaca); mixer.stopAllAction(); geo.dispose(); fumaca.material.dispose(); }
  };
}
