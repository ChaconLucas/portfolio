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
  // copia sem pintura: base para as naves dos outros jogadores
  const modeloBase = modelo.clone(true);

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
  // riscos de luz passando em volta da nave (subindo e saindo do planeta):
  // traços que vem da frente e correm para tras, mais claros na ponta
  const NR = 70, rp = new Float32Array(NR * 6), rc = new Float32Array(NR * 6), rInfo = [];
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rGeo.setAttribute('color', new THREE.BufferAttribute(rc, 3));
  const riscosM = new THREE.LineSegments(rGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  riscosM.frustumCulled = false; riscosM.visible = false; raiz.add(riscosM);
  const novoRisco = (i, z) => { const a = Math.random() * Math.PI * 2, r = 1.6 + Math.random() * 6; rInfo[i] = { x: Math.cos(a) * r, y: Math.sin(a) * r * .8, z, l: 3 + Math.random() * 7, v: .7 + Math.random() * .6, c: Math.random() }; };
  for (let i = 0; i < NR; i++) novoRisco(i, -40 + Math.random() * 80);
  let riscosK = 0;
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
  // fogo da reentrada: chamas (ruido) correndo da ponta para tras em volta do
  // nariz — branco-amarelo na frente, laranja e rosa na cauda (antes: um cone liso)
  const fogoU = { uT: { value: 0 }, uK: { value: 0 } };
  const concha = new THREE.Mesh(conchaGeo, new THREE.ShaderMaterial({
    uniforms: fogoU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: 'varying vec3 vP, vN, vV; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uT, uK; varying vec3 vP, vN, vV;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float r(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * r(p); p = p * 2.1 + 1.7; a *= .5; } return s / .9375; }
      void main(){
        float ang = atan(vP.y, vP.x), k = clamp(vP.z / 1.25, 0., 1.);
        float n = fbm(vec2(ang * 2.2 + 3., k * 5. + uT * 7.));
        float chama = smoothstep(.3, .8, n + k * .55);
        float borda = 1. - abs(dot(normalize(vN), normalize(vV)));
        float a = uK * chama * (.2 + k * .9) * (.45 + borda * .9);
        vec3 c = mix(vec3(1., .3, .65), vec3(1., .72, .32), smoothstep(.1, .7, k));
        c = mix(c, vec3(1.), pow(k, 5.) * .8);
        gl_FragColor = vec4(c * a, a);
      }`
  }));
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
  let corChama = 0x8a5cff, extras = null;
  return {
    raiz, corpo, modelo, modeloBase, rastro,
    /** pinta a nave do jogador (cor do nome; admin: roxa e rosa com enfeites) */
    pintar(o) {
      pintarNave(modelo, o);
      corChama = o.admin ? 0xff4fd8 : new THREE.Color().setHSL(o.matiz / 360, .85, .6).getHex();
      halo.material.color.setHex(corChama); luz.color.setHex(corChama);
      if (extras) { corpo.remove(extras); extras = null; }
      if (o.admin) { extras = enfeitesAdmin(brilho); corpo.add(extras); }
    },
    get empuxo() { return empuxo; },
    /** 0..1: intensidade da reentrada (plasma no nariz, faiscas laranja) */
    reentrada(k) { reentra = k; },
    /** 0..1: riscos de luz passando em volta (velocidade) */
    riscos(k) { riscosK = k; },
    /** vista da cabine: o brilho do plasma (que fica em volta da camera) some; a concha de fogo continua na frente */
    vistaCabine(on) { fogo.visible = !on; halo.visible = !on; },
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
      envelope.material.color.setHex(turbo ? 0x4fd2ff : corChama);
      halo.material.opacity = Math.min(.75, .25 + e * .45);
      halo.scale.setScalar(1 + e * .9);   // (menor: vista de tras virava uma bola branca em cima da nave)
      luz.intensity = e * 6;
      // reentrada
      plasma.visible = reentra > .01;
      if (plasma.visible) {
        const f = 1 + Math.sin(t * 47) * .06 + Math.sin(t * 29) * .05;
        fogoU.uK.value = reentra * 1.1; fogoU.uT.value = t;
        concha.scale.set(f, f, (1.3 + reentra * 1.6) * f);
        fogo.material.opacity = reentra * .5; fogo.scale.setScalar((1.6 + reentra * 1.8) * f);   // brilho do plasma (antes cobria a nave de branco)
      }
      rastro.material.uniforms.calor.value += (reentra - rastro.material.uniforms.calor.value) * .1;
      riscosM.visible = riscosK > .01;
      if (riscosM.visible) {
        for (let i = 0; i < NR; i++) {
          const q = rInfo[i]; q.z -= dt * 140 * q.v * (.4 + riscosK); if (q.z < -45) novoRisco(i, 40 + Math.random() * 10);
          const o = i * 6, br = Math.min(1, (45 + q.z) / 20) * Math.min(1, (45 - q.z) / 15) * riscosK;
          rp[o] = q.x; rp[o + 1] = q.y; rp[o + 2] = q.z; rp[o + 3] = q.x; rp[o + 4] = q.y; rp[o + 5] = q.z - q.l * (.5 + riscosK);
          const cr = .75 + q.c * .25, cg = .8 + q.c * .1;
          rc[o] = cr * br; rc[o + 1] = cg * br; rc[o + 2] = br; rc[o + 3] = 0; rc[o + 4] = 0; rc[o + 5] = 0;   // ponta clara, cauda some
        }
        rGeo.attributes.position.needsUpdate = true; rGeo.attributes.color.needsUpdate = true;
      }

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

/* cor de cada jogador: vive em conta.js (o site tambem usa) */
export { matizDe, corCss } from '../conta.js';

/**
 * Pinta um modelo da nave sem perder os detalhes da textura: no shader a cor
 * vira a do jogador mantendo o claro/escuro da textura (a textura e quase toda
 * cinza, entao girar o matiz nao bastava). Admin: ouro, mais metalico.
 * Os materiais sao clonados, o modelo de origem nao muda. Pode ser chamado de
 * novo para trocar a cor.
 */
export function pintarNave(modelo, { matiz = 270, admin = false, filtro = null } = {}) {
  const cor = admin ? new THREE.Color(.45, .18, 1) : new THREE.Color().setHSL(matiz / 360, 1, .5);
  const cor2 = admin ? new THREE.Color(1, .3, .82) : cor;
  modelo.traverse((o) => {
    if (!o.isMesh || (filtro && !filtro(o))) return;
    let u = o.material.userData.pintura;
    if (!u) {
      o.material = o.material.clone();
      u = o.material.userData.pintura = { uCor: { value: new THREE.Color() }, uCor2: { value: new THREE.Color() }, uForca: { value: 0 } };
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.uCor = u.uCor; sh.uniforms.uCor2 = u.uCor2; sh.uniforms.uForca = u.uForca;
        sh.fragmentShader = sh.fragmentShader
          .replace('void main() {', 'uniform vec3 uCor; uniform vec3 uCor2; uniform float uForca;\nvoid main() {')
          .replace('#include <map_fragment>', `#include <map_fragment>
            float lumN = dot(diffuseColor.rgb, vec3(.299, .587, .114));
            vec3 corN = mix(uCor, uCor2, smoothstep(.35, .7, lumN));   // escuro numa cor, claro na outra
            diffuseColor.rgb = mix(diffuseColor.rgb, corN * (.18 + lumN * 1.25), uForca);`);
      };
      o.material.customProgramCacheKey = () => 'nave-pintada';
      u.metal = o.material.metalness; u.rug = o.material.roughness;
    }
    u.uCor.value.copy(cor); u.uCor2.value.copy(cor2); u.uForca.value = admin ? .92 : .88;
    o.material.metalness = admin ? Math.max(u.metal, .8) : u.metal; o.material.roughness = admin ? Math.min(u.rug, .28) : u.rug;
  });
  return modelo;
}

/** enfeites da nave do admin: anel rosa girando, luzes nas pontas das asas e aura */
export function enfeitesAdmin(brilho) {
  const g = new THREE.Group();
  const ouro = new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false });
  const anel = new THREE.Mesh(new THREE.TorusGeometry(2.1, .035, 6, 64), ouro);
  anel.rotation.x = Math.PI / 2; g.add(anel);
  const anel2 = new THREE.Mesh(new THREE.TorusGeometry(2.25, .02, 6, 64), ouro.clone()); anel2.material.color.setHex(0x8f5cff); anel2.rotation.x = Math.PI / 2; g.add(anel2);
  let t = 0;
  anel.onBeforeRender = () => { t += .016; anel.rotation.y = Math.sin(t * .9) * .35; anel2.rotation.y = -Math.sin(t * .9) * .35; anel2.material.opacity = .5 + Math.cos(t * 3) * .25; ouro.opacity = .6 + Math.sin(t * 3) * .25; };
  for (const lado of [-1, 1]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, color: lado < 0 ? 0x9a6bff : 0xff6bd6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(lado * 1.35, 0, -.4); s.scale.setScalar(.9); g.add(s);
  }
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, color: 0xc06bff, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.setScalar(4); g.add(aura);
  return g;
}

/** traje do astronauta do admin: roxo e rosa (so o corpo; as armas nao) */
export const pintarAstronautaAdmin = (modelo) => pintarNave(modelo, { admin: true, filtro: (o) => o.isSkinnedMesh });

/** aureola do admin: anel de neon rosa girando acima da cabeca, com brilho */
export function aureolaAdmin() {
  const g = new THREE.Group(); g.position.y = 2.2;
  const anel = new THREE.Mesh(new THREE.TorusGeometry(.34, .035, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false }));
  anel.rotation.x = Math.PI / 2; g.add(anel);
  const anel2 = new THREE.Mesh(new THREE.TorusGeometry(.42, .018, 6, 32), new THREE.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  anel2.rotation.x = Math.PI / 2; g.add(anel2);
  let t = 0;
  anel.onBeforeRender = () => { t += .016; g.position.y = 2.2 + Math.sin(t * 2) * .04; anel.rotation.z = t * 1.5; anel2.rotation.z = -t; anel2.rotation.x = Math.PI / 2 + Math.sin(t) * .2; };
  return g;
}
