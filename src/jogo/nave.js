import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * A nave do jogo: o modelo (Quaternius, "Spaceship", dominio publico, via
 * poly.pizza — public/assets/jogo/nave.glb) mais o propulsor.
 *
 * Propulsor em tres pecas, todas aditivas e sem sombra:
 *  - chama: dois cones (nucleo branco e envelope violeta) que esticam com o
 *    acelerador e tremem;
 *  - luz: um PointLight atras da nave, que pinta o casco e o chao no pouso;
 *  - rastro: um pool de particulas soltas no bocal, que ficam para tras no
 *    mundo (por isso vivem fora do grupo da nave).
 * Frente da nave = +z local.
 */

const COMPRIMENTO = 3.2;          // metros de ponta a ponta no jogo

function texBrilho() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export async function criarNave(cena) {
  const gltf = await new GLTFLoader().loadAsync('/assets/jogo/nave.glb');
  const modelo = gltf.scene;
  // normaliza tamanho e centro
  const caixa = new THREE.Box3().setFromObject(modelo);
  const tam = caixa.getSize(new THREE.Vector3());
  const escala = COMPRIMENTO / Math.max(tam.x, tam.y, tam.z);
  modelo.scale.setScalar(escala);
  const centro = caixa.getCenter(new THREE.Vector3()).multiplyScalar(escala);
  modelo.position.sub(centro);
  modelo.traverse((o) => { if (o.isMesh) { o.material.side = THREE.FrontSide; } });

  const raiz = new THREE.Group();        // posicao e rumo
  const corpo = new THREE.Group();       // inclinacao visual (banco, arfagem)
  raiz.add(corpo); corpo.add(modelo);
  // o modelo vem com o nariz em -z: gira para a frente ser +z
  modelo.rotation.y = Math.PI;
  cena.add(raiz);

  const brilho = texBrilho();
  const atras = -COMPRIMENTO * .5;
  // chama
  const chama = new THREE.Group(); chama.position.set(0, 0, atras); corpo.add(chama);
  // base larga no bocal (z = 0), ponta para tras (z = -1)
  const coneGeo = new THREE.ConeGeometry(.3, 1, 18, 1, true); coneGeo.translate(0, .5, 0); coneGeo.rotateX(-Math.PI / 2);
  const envelope = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const nucleo = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xe9e2ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  nucleo.scale.set(.45, .45, .6);
  chama.add(envelope, nucleo);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, color: 0xb18cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(1.6); chama.add(halo);
  const luz = new THREE.PointLight(0xa07bff, 0, 18, 1.6); luz.position.set(0, 0, atras - .6); corpo.add(luz);

  // plasma da reentrada: concha na frente do nariz + brilho, de laranja a branco
  const frente = COMPRIMENTO * .5;
  const plasma = new THREE.Group(); plasma.position.set(0, 0, frente * .55); corpo.add(plasma); plasma.visible = false;
  const conchaGeo = new THREE.SphereGeometry(1.25, 28, 18, 0, Math.PI * 2, 0, Math.PI * .5); conchaGeo.rotateX(Math.PI / 2);
  const concha = new THREE.Mesh(conchaGeo, new THREE.MeshBasicMaterial({ color: 0xff7a2e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  concha.scale.set(1, 1, 1.6); plasma.add(concha);
  const fogo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fogo.scale.setScalar(5); plasma.add(fogo);
  let reentra = 0;

  // rastro (no mundo)
  const N = 220;
  const pos = new Float32Array(N * 3), vida = new Float32Array(N), tamP = new Float32Array(N);
  const vel = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('vida', new THREE.BufferAttribute(vida, 1));
  geo.setAttribute('tam', new THREE.BufferAttribute(tamP, 1));
  const rastro = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { mapa: { value: brilho }, escala: { value: 300 }, calor: { value: 0 } },
    vertexShader: `attribute float vida; attribute float tam; varying float v; uniform float escala;
      void main(){ v = vida; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = min(48., tam * vida * escala / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D mapa; uniform float calor; varying float v;
      void main(){ if (v <= 0.) discard; vec4 t = texture2D(mapa, gl_PointCoord);
        vec3 frio = mix(vec3(.45,.3,1.), vec3(1.,.95,1.), v*v);
        vec3 quente = mix(vec3(1.,.35,.05), vec3(1.,.9,.6), v*v);
        gl_FragColor = vec4(mix(frio, quente, calor), t.a * v * .8); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  rastro.frustumCulled = false;
  cena.add(rastro);
  let proxima = 0, acumulado = 0;
  const _bocal = new THREE.Vector3(), _tras = new THREE.Vector3();

  let empuxo = 0;            // 0..1 suavizado
  return {
    raiz, corpo, modelo, rastro,
    get empuxo() { return empuxo; },
    /** 0..1: intensidade da reentrada (plasma no nariz, faiscas laranja) */
    reentrada(k) { reentra = k; },
    /**
     * @param dt segundos
     * @param alvo 0..1 (acelerador), turbo boolean
     */
    atualizar(dt, alvo, turbo, t) {
      empuxo += (alvo - empuxo) * (1 - Math.exp(-dt * 8));
      const e = empuxo * (turbo ? 1.6 : 1);
      const tremor = 1 + Math.sin(t * 61) * .08 + Math.sin(t * 37) * .06;
      chama.visible = e > .02;
      envelope.scale.set(.6 + e * .5, .6 + e * .5, (.4 + e * 2.6) * tremor);
      nucleo.scale.set(.3 + e * .25, .3 + e * .25, (.25 + e * 1.4) * tremor);
      envelope.material.color.setHex(turbo ? 0x4fd2ff : 0x8a5cff);
      halo.material.opacity = Math.min(1, .3 + e * .8);
      halo.scale.setScalar(1.2 + e * 1.6);
      luz.intensity = e * 6;
      // reentrada
      plasma.visible = reentra > .01;
      if (plasma.visible) {
        const f = 1 + Math.sin(t * 47) * .06 + Math.sin(t * 29) * .05;
        concha.material.opacity = reentra * .42;
        concha.material.color.setRGB(1, .35 + reentra * .3, .1 + reentra * .15);
        concha.scale.set(f, f, (1.2 + reentra * 1.4) * f);
        fogo.material.opacity = reentra * .75; fogo.scale.setScalar((2.6 + reentra * 3.4) * f);
      }
      rastro.material.uniforms.calor.value += (reentra - rastro.material.uniforms.calor.value) * .1;

      // particulas: soltas no bocal, no mundo
      raiz.updateMatrixWorld();
      _bocal.set(0, 0, atras - .2).applyMatrix4(corpo.matrixWorld);
      _tras.set(0, 0, -1).transformDirection(corpo.matrixWorld);
      acumulado += dt * (e > .05 ? 70 + e * 160 : 0) + dt * reentra * 260;
      while (acumulado >= 1) {
        acumulado -= 1;
        const i = proxima; proxima = (proxima + 1) % N;
        pos[i * 3] = _bocal.x + (Math.random() - .5) * .25;
        pos[i * 3 + 1] = _bocal.y + (Math.random() - .5) * .25;
        pos[i * 3 + 2] = _bocal.z + (Math.random() - .5) * .25;
        const v = 6 + e * 10;
        vel[i * 3] = _tras.x * v + (Math.random() - .5) * 1.5;
        vel[i * 3 + 1] = _tras.y * v + (Math.random() - .5) * 1.5;
        vel[i * 3 + 2] = _tras.z * v + (Math.random() - .5) * 1.5;
        vida[i] = 1; tamP[i] = .5 + Math.random() * .5 + e * .5;
      }
      for (let i = 0; i < N; i++) {
        if (vida[i] <= 0) continue;
        vida[i] -= dt * 1.9;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.vida.needsUpdate = true;
      geo.attributes.tam.needsUpdate = true;
    },
    destruir() {
      cena.remove(raiz); cena.remove(rastro);
      geo.dispose(); rastro.material.dispose(); brilho.dispose();
    }
  };
}
