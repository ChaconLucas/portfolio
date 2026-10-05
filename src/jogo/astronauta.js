import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * O astronauta (Quaternius, "Astronaut", CC0 — public/assets/jogo/
 * astronauta.glb, enxugado: Idle_Neutral, Idle, Walk, Run, Run_Back,
 * Run_Left, Run_Right, Roll, Wave e Interact).
 *
 * Locomocao em 8 direcoes: ele olha para onde a camera olha e as animacoes
 * se misturam pela velocidade LOCAL (frente/tras/lados): anda, corre, corre
 * de costas, de lado. No ar, vai para a pose parada com o corpo inclinado na
 * direcao do voo. O ritmo da animacao acompanha a velocidade (o pe nao
 * "patina") e os passos sao avisados (para o som e a poeira).
 *
 * Jetpack nas costas (preso no osso do tronco): dois tanques, bocais e chama
 * que cresce com o empuxo, mais um rastro de fumaca no mundo.
 * Frente = +z local.
 */
const ALTURA = 1.85;

export async function criarAstronauta(cena) {
  const gltf = await new GLTFLoader().loadAsync('/assets/jogo/astronauta.glb');
  const modelo = gltf.scene;
  modelo.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const caixa = new THREE.Box3().setFromObject(modelo);
  modelo.scale.setScalar(ALTURA / (caixa.max.y - caixa.min.y));
  const raiz = new THREE.Group(); raiz.add(modelo); raiz.visible = false;
  const corpo = modelo;   // inclinacao no ar (em volta do quadril)
  cena.add(raiz);

  const mixer = new THREE.AnimationMixer(modelo);
  const clip = (n) => gltf.animations.find((a) => a.name === n || a.name.endsWith('|' + n));
  const LOOP = ['Idle_Neutral', 'Idle', 'Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right'];
  const acao = {}, peso = {};
  LOOP.forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0); acao[n] = a; peso[n] = n === 'Idle_Neutral' ? 1 : 0; });
  ['Wave', 'Interact', 'Roll'].forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; acao[n] = a; });
  let gesto = null;

  /* ---- jetpack ---- */
  const jet = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9c4d8, metalness: .8, roughness: .3 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x24202e, metalness: .6, roughness: .4 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x9f7bff });
  const bocalGeo = new THREE.CylinderGeometry(.05, .075, .1, 12);
  const chamaGeo = new THREE.ConeGeometry(.07, .5, 12, 1, true); chamaGeo.translate(0, -.25, 0);
  const chamaMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const nucleoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const chamas = [];
  for (const x of [-.11, .11]) {
    const tanque = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .3, 6, 14), metal); tanque.position.set(x, 0, 0); jet.add(tanque);
    const faixa = new THREE.Mesh(new THREE.CylinderGeometry(.088, .088, .03, 14), neon); faixa.position.set(x, .08, 0); jet.add(faixa);
    const bocal = new THREE.Mesh(bocalGeo, escuro); bocal.position.set(x, -.27, 0); jet.add(bocal);
    const ch = new THREE.Mesh(chamaGeo, chamaMat); ch.position.set(x, -.32, 0); jet.add(ch);
    const nu = new THREE.Mesh(chamaGeo, nucleoMat); nu.scale.set(.45, .6, .45); ch.add(nu);
    chamas.push(ch);
  }
  const centro = new THREE.Mesh(new THREE.BoxGeometry(.16, .32, .1), escuro); centro.position.set(0, .02, .03); jet.add(centro);
  const luzJet = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), neon); luzJet.position.set(0, .12, -.03); jet.add(luzJet);
  // preso no tronco: monta nas costas na pose inicial e "anexa" mantendo a posicao
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
  let prox = 0, acum = 0, empuxo = 0, fase = 0, ultimoPasso = 0;
  const _b = new THREE.Vector3();

  return {
    raiz, fumaca,
    gesto(n) { const a = acao[n]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.fadeIn(.12); a.play(); gesto = a; },
    get gesticulando() { return !!(gesto && gesto.isRunning()); },
    /**
     * frente/lado: velocidade LOCAL (m/s, frente = para onde ele olha, lado
     * positivo = esquerda); noChao; jet 0..1. Devolve 'passo' quando um pe
     * toca o chao (para o som e a poeira).
     */
    atualizar(dt, { frente = 0, lado = 0, noChao = true, jet: j = 0 }) {
      const v = Math.hypot(frente, lado);
      const alvo = { Idle_Neutral: 0, Idle: 0, Walk: 0, Run: 0, Run_Back: 0, Run_Left: 0, Run_Right: 0 };
      if (!noChao) {
        alvo.Idle = 1;
      } else if (v < .3) {
        alvo.Idle_Neutral = 1;
      } else {
        const f = Math.max(0, frente) / v, b = Math.max(0, -frente) / v, l = Math.max(0, lado) / v, r = Math.max(0, -lado) / v;
        const corre = Math.min(1, Math.max(0, (v - 3.4) / 2.2));
        const anda = Math.min(1, v / 1.2);
        alvo.Walk = f * (1 - corre) * anda; alvo.Run = f * corre * anda;
        alvo.Run_Back = b * anda; alvo.Run_Left = l * anda; alvo.Run_Right = r * anda;
        alvo.Idle_Neutral = 1 - anda;
      }
      let g = 0;
      if (gesto) { if (gesto.isRunning()) g = Math.min(1, gesto.time * 8, (gesto.getClip().duration - gesto.time) * 6); else gesto = null; }
      const k = 1 - Math.exp(-dt * 10);
      for (const n in alvo) { if (!acao[n]) continue; peso[n] += (alvo[n] - peso[n]) * k; acao[n].setEffectiveWeight(peso[n] * (1 - g)); }
      // ritmo: o ciclo acompanha a velocidade (pe sem patinar)
      if (acao.Walk) acao.Walk.timeScale = Math.max(.6, v / 1.6);
      if (acao.Run) acao.Run.timeScale = Math.max(.7, v / 6);
      ['Run_Back', 'Run_Left', 'Run_Right'].forEach((n) => { if (acao[n]) acao[n].timeScale = Math.max(.6, v / 5); });
      mixer.update(dt);
      // no ar: inclina na direcao do voo
      const incF = noChao ? 0 : Math.max(-.35, Math.min(.35, frente * .05)), incL = noChao ? 0 : Math.max(-.3, Math.min(.3, -lado * .05));
      corpo.rotation.x += (incF - corpo.rotation.x) * k; corpo.rotation.z += (incL - corpo.rotation.z) * k;
      // jetpack: chama e fumaca
      empuxo += (j - empuxo) * (1 - Math.exp(-dt * 14));
      chamas.forEach((c, i) => { c.visible = empuxo > .03; const tr = 1 + Math.sin(performance.now() * .06 + i * 2) * .12; c.scale.set(.8 + empuxo * .5, (.3 + empuxo * 1.6) * tr, .8 + empuxo * .5); });
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
      // passos: dois por ciclo da animacao de andar/correr que estiver mais forte
      let evento = null;
      if (noChao && v > .6) {
        const forte = ['Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right'].reduce((a, n) => (acao[n] && peso[n] > (peso[a] || 0) ? n : a), 'Walk');
        const a = acao[forte];
        if (a) {
          const f = (a.time / a.getClip().duration) % 1, metade = f < .5 ? 0 : 1;
          if (metade !== ultimoPasso) { ultimoPasso = metade; evento = forte === 'Walk' ? 'passo' : 'corrida'; }
        }
      }
      fase += dt;
      return evento;
    },
    destruir() { cena.remove(raiz); cena.remove(fumaca); mixer.stopAllAction(); geo.dispose(); fumaca.material.dispose(); }
  };
}
