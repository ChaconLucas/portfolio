import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * O astronauta (Quaternius, "Astronaut", CC0 — public/assets/jogo/
 * astronauta.glb, enxugado: so Idle_Neutral, Walk, Run, Wave e Interact).
 * Anda em terceira pessoa na superficie; a animacao mistura parado / andar /
 * correr pela velocidade, e Wave/Interact tocam uma vez por cima.
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
  cena.add(raiz);

  const mixer = new THREE.AnimationMixer(modelo);
  const clip = (n) => gltf.animations.find((a) => a.name === n || a.name.endsWith('|' + n));
  const acao = {};
  ['Idle_Neutral', 'Walk', 'Run'].forEach((n) => { const a = mixer.clipAction(clip(n)); a.play(); a.setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0); acao[n] = a; });
  ['Wave', 'Interact'].forEach((n) => { const a = mixer.clipAction(clip(n)); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; acao[n] = a; });
  let gesto = null, andar = 0, correr = 0;

  return {
    raiz,
    gesto(n) { const a = acao[n]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.fadeIn(.15); a.play(); gesto = a; },
    get gesticulando() { return !!(gesto && gesto.isRunning()); },
    /** vel em m/s no chao */
    atualizar(dt, vel) {
      const alvoAndar = Math.min(1, vel / 2.2), alvoCorrer = Math.max(0, Math.min(1, (vel - 3.2) / 2.5));
      andar += (alvoAndar - andar) * (1 - Math.exp(-dt * 10));
      correr += (alvoCorrer - correr) * (1 - Math.exp(-dt * 10));
      let g = 0;
      if (gesto) { if (gesto.isRunning()) g = Math.min(1, gesto.time * 6, (gesto.getClip().duration - gesto.time) * 5); else gesto = null; }
      const r = 1 - g;
      acao.Run.setEffectiveWeight(correr * r);
      acao.Walk.setEffectiveWeight(andar * (1 - correr) * r);
      acao.Idle_Neutral.setEffectiveWeight((1 - andar) * r);
      acao.Walk.timeScale = .8 + Math.min(vel, 3) * .15;
      mixer.update(dt);
    },
    destruir() { cena.remove(raiz); mixer.stopAllAction(); }
  };
}
