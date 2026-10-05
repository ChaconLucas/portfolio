import * as THREE from 'three';

/**
 * As duas cenas do jogo:
 *  - espaco: o mesmo sistema do site (9 planetas, um por area da stack) em
 *    escala de jogo, com sol, estrelas, poeira que da sensacao de velocidade
 *    e um cinturao de asteroides;
 *  - superficie: o chao de um planeta (morros low-poly na cor dele), ceu em
 *    degrade, cristais e a plataforma de pouso no centro.
 * Cada criador devolve { atualizar(dt, t, alvo), destruir() } e o que o loop
 * precisa (lista de planetas, altura do chao).
 */

// as mesmas areas da secao "Stack Universe" do site; cor por bioma no jogo
export const PLANETAS = [
  { key: 'frontend', nome: 'Frontend', orbita: 4.15, ang: .25, tam: 1.02, cor: 275 },
  { key: 'backend', nome: 'Backend', orbita: 7.25, ang: 1.15, tam: .88, cor: 212 },
  { key: 'mobile', nome: 'Mobile', orbita: 6.15, ang: 2.35, tam: .76, cor: 322 },
  { key: 'data', nome: 'Data', orbita: 5.25, ang: 3.12, tam: .72, cor: 186 },
  { key: 'security', nome: 'Security', orbita: 6.9, ang: 3.82, tam: .82, cor: 352 },
  { key: 'infra', nome: 'Infra', orbita: 4.95, ang: 4.55, tam: .64, cor: 28 },
  { key: 'tooling', nome: 'Tooling', orbita: 7.75, ang: 5.0, tam: .91, cor: 252 },
  { key: 'analytics', nome: 'Analytics', orbita: 8.6, ang: 5.75, tam: .72, cor: 142 },
  { key: 'ai', nome: 'AI Workflow', orbita: 5.95, ang: 6.2, tam: .79, cor: 46 }
];
const ESC_ORBITA = 26, ESC_TAM = 7;

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function texturaPlaneta(cor, seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d'); const r = rnd(seed);
  const base = `hsl(${cor},45%,42%)`;
  x.fillStyle = base; x.fillRect(0, 0, 512, 256);
  // faixas e manchas
  for (let i = 0; i < 26; i++) {
    const y = r() * 256, h = 6 + r() * 30;
    x.fillStyle = `hsla(${cor + (r() - .5) * 30},${40 + r() * 30}%,${30 + r() * 40}%,${.25 + r() * .35})`;
    x.fillRect(0, y, 512, h);
  }
  for (let i = 0; i < 160; i++) {
    x.fillStyle = `hsla(${cor + (r() - .5) * 40},50%,${20 + r() * 55}%,${.15 + r() * .3})`;
    x.beginPath(); x.ellipse(r() * 512, r() * 256, 6 + r() * 40, 3 + r() * 14, 0, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
function texRadial(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, cor]) => g.addColorStop(o, cor)); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ================================================================ espaco == */
export function criarEspaco(cena) {
  const lixo = [];
  const guarda = (o) => { lixo.push(o); return o; };
  cena.background = new THREE.Color(0x05040b);
  cena.fog = null;

  // estrelas (acompanham a camera: sao o "ceu")
  const ceu = new THREE.Group(); cena.add(ceu);
  {
    const n = 3500, p = new Float32Array(n * 3), cor = new Float32Array(n * 3); const r = rnd(9);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), R = 900;
      p[i * 3] = s * Math.cos(a) * R; p[i * 3 + 1] = u * R; p[i * 3 + 2] = s * Math.sin(a) * R;
      const k = .55 + r() * .45, roxo = r() < .2;
      cor[i * 3] = k * (roxo ? .8 : 1); cor[i * 3 + 1] = k * (roxo ? .7 : .97); cor[i * 3 + 2] = k;
    }
    const g = guarda(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    ceu.add(new THREE.Points(g, guarda(new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false }))));
    // nebulosas
    const neb = guarda(texRadial([[0, 'rgba(140,90,255,.35)'], [1, 'rgba(140,90,255,0)']]));
    [[-1, .2, -.4, 0x7c4dff], [.6, -.1, .8, 0xff3d9a], [.2, .5, -1, 0x3d7bff]].forEach(([x, y, z, c]) => {
      const s = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: neb, color: c, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })));
      s.position.set(x, y, z).normalize().multiplyScalar(800); s.scale.setScalar(700); ceu.add(s);
    });
  }

  // sol
  const sol = new THREE.Mesh(guarda(new THREE.SphereGeometry(14, 48, 32)), guarda(new THREE.MeshBasicMaterial({ color: 0xfff1d6 })));
  cena.add(sol);
  const coroa = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: guarda(texRadial([[0, 'rgba(255,240,210,1)'], [.25, 'rgba(255,190,120,.5)'], [1, 'rgba(180,100,255,0)']])), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  coroa.scale.setScalar(110); cena.add(coroa);
  cena.add(new THREE.PointLight(0xfff0dd, 3, 0, 0));
  // o lado de tras dos planetas ficava preto chapado; um pouco de luz ambiente e
  // uma luz fria do lado oposto ao sol deixam o volume legivel
  cena.add(new THREE.AmbientLight(0x7a68c0, .7));
  { const contra = new THREE.DirectionalLight(0x6f8cff, .5); contra.position.set(0, 80, -400); cena.add(contra); }

  // planetas
  const planetas = PLANETAS.map((d, i) => {
    const raio = d.tam * ESC_TAM;
    const tex = guarda(texturaPlaneta(d.cor, 31 + i * 17));
    const g = new THREE.Group();
    const R = d.orbita * ESC_ORBITA;
    g.position.set(Math.cos(d.ang) * R, (i % 3 - 1) * 6, Math.sin(d.ang) * R);
    const corpo = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio, 48, 32)), guarda(new THREE.MeshStandardMaterial({ map: tex, roughness: .9, metalness: 0 })));
    g.add(corpo);
    const atm = new THREE.Mesh(guarda(new THREE.SphereGeometry(raio * 1.12, 32, 24)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${d.cor},80%,65%)`), transparent: true, opacity: .14, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    g.add(atm);
    if (d.key === 'tooling') {
      const anel = new THREE.Mesh(guarda(new THREE.RingGeometry(raio * 1.4, raio * 2.1, 80)), guarda(new THREE.MeshBasicMaterial({ color: 0x9a78ff, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })));
      anel.rotation.x = Math.PI / 2.3; g.add(anel);
    }
    cena.add(g);
    // orbita desenhada
    const pts = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, g.position.y, Math.sin(a) * R)); }
    cena.add(new THREE.Line(guarda(new THREE.BufferGeometry().setFromPoints(pts)), guarda(new THREE.LineBasicMaterial({ color: 0x6d4fd0, transparent: true, opacity: .18 }))));
    return { ...d, raio, grupo: g, corpo, pos: g.position };
  });

  // cinturao de asteroides entre Analytics e o resto
  {
    const n = 420, geo = guarda(new THREE.IcosahedronGeometry(1, 0));
    const mat = guarda(new THREE.MeshStandardMaterial({ color: 0x6e6385, roughness: 1, flatShading: true }));
    const inst = new THREE.InstancedMesh(geo, mat, n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const r = rnd(77);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, R = 245 + (r() - .5) * 26;
      p.set(Math.cos(a) * R, (r() - .5) * 10, Math.sin(a) * R);
      q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); const k = .6 + r() * 2.2; s.set(k, k * (.6 + r() * .6), k);
      inst.setMatrixAt(i, m.compose(p, q, s));
    }
    cena.add(inst); var cinturao = inst;
  }

  // poeira perto da camera: e ela que mostra velocidade (o ceu esta longe demais)
  const NP = 500, BOX = 90;
  const pp = new Float32Array(NP * 3); { const r = rnd(5); for (let i = 0; i < NP * 3; i++) pp[i] = (r() - .5) * BOX; }
  const gp = guarda(new THREE.BufferGeometry()); gp.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const poeira = new THREE.Points(gp, guarda(new THREE.PointsMaterial({ color: 0xcbbcff, size: .18, transparent: true, opacity: .55, depthWrite: false })));
  poeira.frustumCulled = false; cena.add(poeira);

  return {
    planetas,
    sol: { pos: sol.position, raio: 14 },
    atualizar(dt, t, camera) {
      ceu.position.copy(camera.position);
      planetas.forEach((p, i) => { p.corpo.rotation.y += dt * (.05 + i * .006); });
      cinturao.rotation.y += dt * .004;
      // poeira em volta da camera, com "wrap"
      const c = camera.position, a = gp.attributes.position.array;
      for (let i = 0; i < NP; i++) for (let k = 0; k < 3; k++) {
        const j = i * 3 + k, cc = k === 0 ? c.x : k === 1 ? c.y : c.z;
        let d = a[j] - cc; if (d > BOX / 2) a[j] -= BOX; else if (d < -BOX / 2) a[j] += BOX;
      }
      gp.attributes.position.needsUpdate = true;
    },
    destruir() {
      lixo.forEach((o) => o.dispose && o.dispose());
      cena.clear();
    }
  };
}

/* ============================================================ superficie == */
// altura do terreno: morros suaves e a plataforma (raio 14) achatada
export function alturaChao(x, z) {
  const h = Math.sin(x * .021) * Math.cos(z * .017) * 9 + Math.sin(x * .053 + z * .031) * 3.5 + Math.cos(z * .071 - x * .013) * 2;
  const d = Math.hypot(x, z);
  const plano = Math.min(1, Math.max(0, (d - 14) / 26));
  return h * plano * plano * (3 - 2 * plano);
}

export function criarSuperficie(cena, planeta) {
  const lixo = []; const guarda = (o) => { lixo.push(o); return o; };
  const cor = planeta.cor;
  const ceuCor = new THREE.Color(`hsl(${cor},45%,18%)`);
  cena.background = ceuCor;
  cena.fog = new THREE.Fog(ceuCor, 120, 520);

  // ceu em degrade (cupula)
  const ceu = new THREE.Mesh(guarda(new THREE.SphereGeometry(900, 32, 16)), guarda(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { baixo: { value: new THREE.Color(`hsl(${cor},55%,32%)`) }, alto: { value: new THREE.Color(`hsl(${(cor + 30) % 360},60%,6%)`) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 baixo; uniform vec3 alto; varying float h; void main(){ gl_FragColor = vec4(mix(baixo, alto, smoothstep(-.05,.6,h)), 1.); }'
  })));
  cena.add(ceu);
  // planeta-mae / lua no ceu
  const lua = new THREE.Mesh(guarda(new THREE.SphereGeometry(60, 32, 16)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${(cor + 180) % 360},40%,70%)`), fog: false })));
  lua.position.set(-380, 260, -600); cena.add(lua);

  // terreno low-poly
  const TAM = 1400, SEG = 140;
  const geo = guarda(new THREE.PlaneGeometry(TAM, TAM, SEG, SEG)); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, alturaChao(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const chao = new THREE.Mesh(geo, guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},35%,34%)`), roughness: 1, flatShading: true })));
  cena.add(chao);

  // cristais espalhados (instanciados)
  {
    const n = 160, cg = guarda(new THREE.OctahedronGeometry(1, 0)); cg.scale(.6, 1.8, .6);
    const inst = new THREE.InstancedMesh(cg, guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${(cor + 20) % 360},80%,62%)`), emissive: new THREE.Color(`hsl(${cor},80%,30%)`), roughness: .3, flatShading: true })), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(); const r = rnd(planeta.key.length * 101);
    for (let i = 0; i < n; i++) {
      let x, z; do { x = (r() - .5) * 600; z = (r() - .5) * 600; } while (Math.hypot(x, z) < 40);
      const k = 1 + r() * 3.5;
      v.set(x, alturaChao(x, z) + k * .8, z); q.setFromAxisAngle(new THREE.Vector3(r() - .5, 1, r() - .5).normalize(), r() * .6); s.setScalar(k);
      inst.setMatrixAt(i, m.compose(v, q, s));
    }
    cena.add(inst);
  }

  // plataforma de pouso
  const pad = new THREE.Group(); cena.add(pad);
  pad.add(new THREE.Mesh(guarda(new THREE.CylinderGeometry(11, 12, .6, 48)), guarda(new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: .6, metalness: .4 }))));
  const anel = new THREE.Mesh(guarda(new THREE.RingGeometry(8.6, 9.2, 64)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,70%)`) })));
  anel.rotation.x = -Math.PI / 2; anel.position.y = .32; pad.add(anel);
  const hMat = guarda(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  [[0, 0, 1.2, 6], [-2.2, 0, 1, 6], [2.2, 0, 1, 6]].forEach(([x, , w, h], k) => {
    const b = new THREE.Mesh(guarda(new THREE.PlaneGeometry(k ? w : 4.4, k ? h : 1)), hMat);
    b.rotation.x = -Math.PI / 2; b.position.set(x, .33, 0); pad.add(b);
  });
  const luzes = [];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2;
    const l = new THREE.Mesh(guarda(new THREE.SphereGeometry(.22, 8, 6)), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    l.position.set(Math.cos(a) * 10.4, .5, Math.sin(a) * 10.4); pad.add(l); luzes.push(l.material); lixo.push(l.material);
  }
  // farol: um feixe vertical para achar a plataforma do alto
  const farol = new THREE.Mesh(guarda(new THREE.CylinderGeometry(.6, 3, 160, 16, 1, true)), guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,70%)`), transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  farol.position.y = 80; cena.add(farol);

  const sol = new THREE.DirectionalLight(0xfff1e0, 2.2); sol.position.set(200, 300, 120); cena.add(sol);
  cena.add(new THREE.HemisphereLight(new THREE.Color(`hsl(${cor},60%,70%)`), new THREE.Color(`hsl(${cor},40%,12%)`), .9));

  // poeira levantada no pouso
  const NP = 90, pp = new Float32Array(NP * 3), vp = new Float32Array(NP * 3), vidaP = new Float32Array(NP);
  const gp = guarda(new THREE.BufferGeometry()); gp.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const poeira = new THREE.Points(gp, guarda(new THREE.PointsMaterial({ color: new THREE.Color(`hsl(${cor},30%,70%)`), size: .7, transparent: true, opacity: .6, depthWrite: false })));
  poeira.frustumCulled = false; cena.add(poeira);

  return {
    alturaChao,
    levantarPoeira(x, z, forca) {
      for (let i = 0; i < NP; i++) {
        if (vidaP[i] > 0 && Math.random() > forca) continue;
        const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 10;
        pp[i * 3] = x; pp[i * 3 + 1] = alturaChao(x, z) + .3; pp[i * 3 + 2] = z;
        vp[i * 3] = Math.cos(a) * v; vp[i * 3 + 1] = 1 + Math.random() * 3; vp[i * 3 + 2] = Math.sin(a) * v; vidaP[i] = 1;
      }
    },
    atualizar(dt, t) {
      luzes.forEach((m, k) => m.color.setHex(((k + Math.floor(t * 8)) % 12) < 3 ? 0xffffff : 0xffb13b));
      farol.material.opacity = .08 + Math.sin(t * 2) * .04;
      for (let i = 0; i < NP; i++) {
        if (vidaP[i] <= 0) { pp[i * 3 + 1] = -999; continue; }
        vidaP[i] -= dt * .9;
        pp[i * 3] += vp[i * 3] * dt; pp[i * 3 + 1] += vp[i * 3 + 1] * dt; pp[i * 3 + 2] += vp[i * 3 + 2] * dt;
        vp[i * 3] *= .96; vp[i * 3 + 2] *= .96;
      }
      gp.attributes.position.needsUpdate = true;
      poeira.material.opacity = .6;
    },
    destruir() { lixo.forEach((o) => o.dispose && o.dispose()); cena.clear(); }
  };
}
