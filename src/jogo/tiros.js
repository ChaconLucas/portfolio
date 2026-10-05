import * as THREE from 'three';

/**
 * Tiros da nave (clique / botao no toque): dois lasers saindo das asas,
 * rapidos, que somem em 1,4 s. Quem chama testa a colisao (rochas, planetas,
 * chao) e pede a explosao: faiscas e um clarao que se espalham.
 * Tudo vive num grupo que troca de cena junto com a nave.
 */
export function criarTiros() {
  const grupo = new THREE.Group();
  const N = 48;
  const geo = new THREE.CylinderGeometry(.22, .22, 16, 6, 1, true); geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false });
  const nucleoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  const lasers = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false;
    const n = new THREE.Mesh(geo, nucleoMat); n.scale.set(.4, .4, 1.05); m.add(n);
    grupo.add(m); lasers.push({ m, vel: new THREE.Vector3(), vida: 0 });
  }
  let prox = 0;

  // faiscas das explosoes
  const NF = 400, pos = new Float32Array(NF * 3), vel = new Float32Array(NF * 3), vida = new Float32Array(NF), cor = new Float32Array(NF * 3);
  const gf = new THREE.BufferGeometry();
  gf.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gf.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  // clarao (sprite) por explosao; a mesma textura redonda serve as faiscas
  const c = document.createElement('canvas'); c.width = c.height = 128;
  { const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,170,90,.8)'); g.addColorStop(1, 'rgba(255,60,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const texClarao = new THREE.CanvasTexture(c);
  const faiscas = new THREE.Points(gf, new THREE.PointsMaterial({ size: 2.5, map: texClarao, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  faiscas.frustumCulled = false; grupo.add(faiscas);
  let pf = 0;
  const claroes = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texClarao, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.visible = false; grupo.add(s); claroes.push({ s, vida: 0, tam: 1 }); }
  let pc = 0;
  const _d = new THREE.Vector3();

  return {
    grupo,
    /** origem: matrixWorld do corpo da nave; velNave: velocidade atual; escala: tamanho da nave */
    disparar(corpo, velNave, escala = 1) {
      const fwd = _d.set(0, 0, 1).transformDirection(corpo.matrixWorld);
      for (const lado of [-1, 1]) {
        const l = lasers[prox]; prox = (prox + 1) % N;
        l.m.position.set(lado * 1.25, -.1, 1.2).applyMatrix4(corpo.matrixWorld);
        l.m.quaternion.setFromRotationMatrix(corpo.matrixWorld);
        l.m.scale.setScalar(escala);
        l.vel.copy(fwd).multiplyScalar(1100).add(velNave);
        l.vida = 1.4; l.m.visible = true;
      }
    },
    explodir(p, tam = 10, corBase = [1, .6, .3]) {
      const n = Math.min(90, 20 + tam * 2);
      for (let i = 0; i < n; i++) {
        const k = pf; pf = (pf + 1) % NF;
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
        _d.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar((.3 + Math.random()) * tam * 3);
        vel[k * 3] = _d.x; vel[k * 3 + 1] = _d.y; vel[k * 3 + 2] = _d.z;
        vida[k] = .6 + Math.random() * .8;
        const q = Math.random();
        cor[k * 3] = corBase[0] * (.7 + q * .3) + q * .3; cor[k * 3 + 1] = corBase[1] * (.7 + q * .5); cor[k * 3 + 2] = corBase[2] + q * .2;
      }
      const cl = claroes[pc]; pc = (pc + 1) % claroes.length;
      cl.s.position.copy(p); cl.vida = .5; cl.tam = tam * 2.2; cl.s.visible = true;
      faiscas.material.size = Math.min(9, Math.max(1.2, tam * .09));
    },
    /** move os lasers; testar(pos) -> true se bateu (o laser some) */
    atualizar(dt, testar) {
      for (const l of lasers) {
        if (l.vida <= 0) continue;
        l.vida -= dt; l.m.position.addScaledVector(l.vel, dt);
        if (l.vida <= 0 || (testar && testar(l.m.position))) { l.vida = 0; l.m.visible = false; }
      }
      for (let k = 0; k < NF; k++) {
        if (vida[k] <= 0) { pos[k * 3 + 1] = -1e7; continue; }
        vida[k] -= dt;
        pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
        vel[k * 3] *= .985; vel[k * 3 + 1] *= .985; vel[k * 3 + 2] *= .985;
        const f = Math.max(0, vida[k]); cor[k * 3] *= .985; cor[k * 3 + 1] *= .975; cor[k * 3 + 2] *= .97;
        if (f < .05) { cor[k * 3] = cor[k * 3 + 1] = cor[k * 3 + 2] = 0; }
      }
      gf.attributes.position.needsUpdate = true; gf.attributes.color.needsUpdate = true;
      for (const cl of claroes) {
        if (cl.vida <= 0) continue;
        cl.vida -= dt; const k = Math.max(0, cl.vida / .5);
        cl.s.scale.setScalar(cl.tam * (1.6 - k)); cl.s.material.opacity = k; if (cl.vida <= 0) cl.s.visible = false;
      }
    },
    destruir() { geo.dispose(); mat.dispose(); nucleoMat.dispose(); gf.dispose(); faiscas.material.dispose(); texClarao.dispose(); claroes.forEach((x) => x.s.material.dispose()); }
  };
}
