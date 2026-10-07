import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  const armas = {}, metal = new THREE.MeshStandardMaterial({ color: 0x2a2635, metalness: .7, roughness: .35 });
  const brilho = (cor) => new THREE.MeshBasicMaterial({ color: cor });
  function montarArma(tipo) {
    const g = new THREE.Group(), b = (w, h, d, m, x = 0, y = 0, z = 0) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); g.add(k); return k; };
    const cil = (r, l, m, z, y = 0) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), m); k.rotation.x = Math.PI / 2; k.position.set(0, y, z); g.add(k); return k; };
    let boca = .3;
    if (tipo === 'blaster') {
      b(.06, .1, .22, metal, 0, .02, .04); b(.045, .1, .05, metal, 0, -.06, -.02); cil(.022, .16, metal, .2, .04); b(.065, .02, .14, brilho(0xff4fd8), 0, .075, .05); boca = .29;
    } else if (tipo === 'rifle') {
      b(.07, .1, .42, metal, 0, .02, .1); b(.05, .12, .06, metal, 0, -.07, 0); cil(.025, .3, metal, .45, .03); b(.075, .025, .3, brilho(0x4fd2ff), 0, .08, .1); b(.05, .07, .14, metal, 0, .0, -.17); boca = .61;
    } else if (tipo === 'canhao') {
      cil(.07, .38, metal, .14, .03); cil(.085, .06, brilho(0xffa040), .33, .03); b(.06, .12, .08, metal, 0, -.07, -.02); b(.1, .06, .12, metal, 0, .1, .06); boca = .38;
    }
    const bocaObj = new THREE.Object3D(); bocaObj.position.set(0, .03, boca); g.add(bocaObj);
    // clarao do cano (aparece um instante a cada tiro)
    const cor = { blaster: 0xff7ae0, rifle: 0x7ae6ff, canhao: 0xffb060 }[tipo];
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: texClarao(), color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.scale.setScalar(tipo === 'canhao' ? .7 : .4); bocaObj.add(fl);
    g.userData.boca = bocaObj; g.userData.clarao = fl; g.visible = false;
    return g;
  }
  let _tex = null;
  function texClarao() {
    if (_tex) return _tex;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (_tex = new THREE.CanvasTexture(c));
  }
  // monta as armas na pose de mira: alinhadas com a frente do corpo, na mao
  if (mao && acao.Idle_Gun_Pointing) {
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Gun_Pointing' ? 1 : 0));
    mixer.update(0); modelo.updateMatrixWorld(true);
    const p = new THREE.Vector3(); mao.getWorldPosition(p);
    ['blaster', 'rifle', 'canhao'].forEach((t) => {
      const g = montarArma(t); g.position.copy(p); g.position.y += .02; raiz.add(g); raiz.updateMatrixWorld(true); mao.attach(g); armas[t] = g;
    });
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0));
  }
  let armaAtual = null;

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
      if (noChao) fase = (fase + dt * (v < 2.6 ? .55 + v * .3 : .9 + v * .1)) % 1;
      for (const n of CICLO) if (acao[n]) acao[n].time = fase * acao[n].getClip().duration;
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
