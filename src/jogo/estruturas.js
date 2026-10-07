import * as THREE from 'three';

/**
 * O que deixa o planeta "vivo", alem dos locais da stack:
 *  - naves caidas (o mesmo modelo da nave, queimado, tombado e meio enterrado),
 *    soltando fumaca e com fogo piscando;
 *  - ruinas: torres quebradas, arcos e colunatas;
 *  - rios (so com atmosfera): faixa de agua correndo pelo leito cavado no
 *    terreno (o leito vem de cenas.js, criarAltura);
 *  - coisas destrutiveis: barris (explodem, e explodem os vizinhos) e caixas;
 *  - chuva de meteoros em alguns planetas (com ar queimam no ceu; sem ar,
 *    batem no chao longe, com clarao).
 * Devolve { colisores, testarTiro(p, dano, area, explodir), atualizar(dt, t, camera, efeitos) }.
 */
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

export function criarEstruturas(cena, o) {
  const { planeta, alturaChao, livre, guarda, modeloNave, rios, limite } = o;
  const ar = planeta.atmosfera !== false, cor = planeta.cor;
  const r = rnd(planeta.key.length * 4231 + 77);
  const colisores = [], destrutiveis = [], anim = [];
  // (materiais dos barris/caixas primeiro: as naves caidas ja espalham alguns)
  const matBarril = guarda(new THREE.MeshStandardMaterial({ color: 0xc8352a, roughness: .5, metalness: .5 }));
  const matFaixa = guarda(new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  const matCaixa = guarda(new THREE.MeshStandardMaterial({ color: 0x5b4a6e, roughness: .7, metalness: .3 }));
  const matCaixaNeon = guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,65%)`) }));
  const geoBarril = guarda(new THREE.CylinderGeometry(.6, .6, 1.5, 14)), geoFaixa = guarda(new THREE.CylinderGeometry(.62, .62, .18, 14)), geoCaixa = guarda(new THREE.BoxGeometry(1.6, 1.6, 1.6)), geoAresta = guarda(new THREE.BoxGeometry(1.66, .12, 1.66));
  const lugar = (folga, raioMax = limite * .92) => {
    for (let k = 0; k < 400; k++) {
      const x = (r() - .5) * 2 * raioMax, z = (r() - .5) * 2 * raioMax;
      if (livre(x, z, folga) && rios.every((rio) => rio.dist(x, z) > folga + 20)) return { x, z };
    }
    return null;
  };

  /* ---- fumaca e fogo (um sistema so para todas as fontes) ---- */
  const NF = 600, fp = new Float32Array(NF * 3), fv = new Float32Array(NF), ft = new Float32Array(NF);
  const fg = guarda(new THREE.BufferGeometry()); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('vida', new THREE.BufferAttribute(fv, 1)); fg.setAttribute('tam', new THREE.BufferAttribute(ft, 1));
  const fumaca = new THREE.Points(fg, guarda(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float vida; attribute float tam; varying float v; void main(){ v = vida; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = min(220., tam * (1.6 - vida) * 300. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float v; void main(){ if (v <= 0.) discard; float d = length(gl_PointCoord - .5) * 2.; float a = (1. - d) * min(1., v * 1.6) * .38; if (a <= 0.) discard; gl_FragColor = vec4(vec3(.16,.14,.18) + vec3(.3,.12,.02) * smoothstep(.75, 1., v), a); }'
  })));
  fumaca.frustumCulled = false; cena.add(fumaca);
  let fprox = 0;
  const fontes = [];   // { x, y, z, taxa, acum }
  const texFogo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.3, 'rgba(255,140,40,.8)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return guarda(new THREE.CanvasTexture(c)); })();

  /* ---- naves caidas ---- */
  if (modeloNave) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const L = lugar(30); if (!L) continue;
      const g = new THREE.Group(), k = 4 + r() * 4;
      const copia = modeloNave.clone(true);
      copia.traverse((m) => { if (m.isMesh) { m.material = guarda(m.material.clone()); m.material.color.multiplyScalar(.62); m.material.emissive = new THREE.Color(0x2a0c00); } });
      g.add(copia); g.scale.setScalar(k);
      const y = alturaChao(L.x, L.z);
      g.position.set(L.x, y + k * .15, L.z);
      g.rotation.set(-.12 - r() * .3, r() * 6.28, (r() - .5) * .9 + (r() < .2 ? Math.PI * .85 : 0));
      cena.add(g);
      // cratera/rastro de terra escura na frente
      const marca = new THREE.Mesh(guarda(new THREE.CircleGeometry(k * 1.7, 24)), guarda(new THREE.MeshBasicMaterial({ color: 0x0d0a10, transparent: true, opacity: .3, depthWrite: false })));
      marca.rotation.x = -Math.PI / 2; marca.position.set(L.x, y + .15, L.z); marca.scale.set(1, 1.8, 1); marca.rotation.z = g.rotation.y; cena.add(marca);
      colisores.push({ x: L.x, z: L.z, r: k * 1.4, h: y + k * 1.2 });
      fontes.push({ x: L.x + (r() - .5) * k, y: y + k * .5, z: L.z + (r() - .5) * k, taxa: 14 + r() * 10, acum: 0, tam: 1 + k * .25 });
      const fogo = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFogo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      fogo.position.set(L.x, y + k * .3, L.z); fogo.scale.setScalar(k * 1.4); cena.add(fogo);
      anim.push((t) => { const f = .65 + Math.sin(t * 11 + i) * .2 + Math.sin(t * 23 + i * 3) * .15; fogo.material.opacity = f; fogo.scale.setScalar(k * (1.2 + f * .4)); });
      // barris espalhados em volta da nave (destrutiveis)
      for (let b = 0; b < 3 + Math.floor(r() * 3); b++) {
        const a = r() * 6.28, d = k * 2 + r() * 10; criarDestrutivel(r() < .6 ? 'barril' : 'caixa', L.x + Math.cos(a) * d, L.z + Math.sin(a) * d);
      }
    }
  }

  /* ---- ruinas ---- */
  const matRuina = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},12%,30%)`), roughness: .95, flatShading: true }));
  const matRuinaNeon = guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${cor},90%,62%)`) }));
  const caixaR = (g, w, h, d, x, y, z, ry = 0, rz = 0, mat = matRuina) => { const m = new THREE.Mesh(guarda(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.rotation.set(0, ry, rz); g.add(m); return m; };
  for (let i = 0; i < 12; i++) {
    const L = lugar(40); if (!L) continue;
    const g = new THREE.Group(); const y = alturaChao(L.x, L.z); g.position.set(L.x, y, L.z); g.rotation.y = r() * 6.28;
    const tipo = i % 3;
    if (tipo === 0) {
      // torre quebrada: andares afinando, o de cima torto e partido
      let h = 0, w = 10 + r() * 6; const andares = 3 + Math.floor(r() * 3);
      for (let a = 0; a < andares; a++) {
        const ah = 6 + r() * 5, ult = a === andares - 1;
        const b = caixaR(g, w, ah, w, (r() - .5) * .6, h + ah / 2, (r() - .5) * .6, r() * .1, ult ? (r() - .5) * .5 : 0);
        if (ult) b.scale.y = .5 + r() * .4;
        if (!ult && r() < .6) caixaR(g, w + .3, .3, w + .3, 0, h + ah, 0, 0, 0, matRuinaNeon);
        h += ah; w *= .82;
      }
      colisores.push({ x: L.x, z: L.z, r: 8, h: y + h });
      for (let k = 0; k < 6; k++) caixaR(g, 1.5 + r() * 3, 1 + r() * 2, 1.5 + r() * 3, (r() - .5) * 26, .6, (r() - .5) * 26, r() * 3, (r() - .5) * .6);
    } else if (tipo === 1) {
      // arco (um portal antigo)
      caixaR(g, 3, 16, 3, -7, 8, 0); caixaR(g, 3, 13, 3, 7, 6.5, 0, 0, .08);
      caixaR(g, 18, 3, 3.4, 0, 16.5, 0, 0, -.06); caixaR(g, 14, .35, 3.6, 0, 15, 0, 0, -.06, matRuinaNeon);
      colisores.push({ x: L.x + Math.cos(g.rotation.y) * -7, z: L.z - Math.sin(g.rotation.y) * -7, r: 2.4, h: y + 18 });
      colisores.push({ x: L.x + Math.cos(g.rotation.y) * 7, z: L.z - Math.sin(g.rotation.y) * 7, r: 2.4, h: y + 18 });
    } else {
      // colunata: fileira de colunas, algumas caidas
      for (let k = 0; k < 7; k++) {
        const caiu = r() < .35, x = (k - 3) * 6;
        if (caiu) caixaR(g, 2.2, 2.2, 10, x + 2, 1.1, 4, r() * .5);
        else { caixaR(g, 2.2, 9 + r() * 4, 2.2, x, 5, 0); }
      }
      caixaR(g, 44, 1, 7, 0, .5, 0);
      colisores.push({ x: L.x, z: L.z, r: 14, h: y + 2 });
    }
    cena.add(g);
    if (r() < .5) for (let b = 0; b < 3; b++) { const a = r() * 6.28, d = 14 + r() * 8; criarDestrutivel('caixa', L.x + Math.cos(a) * d, L.z + Math.sin(a) * d); }
  }

  /* ---- destrutiveis ---- */
  function criarDestrutivel(tipo, x, z) {
    if (!livre(x, z, -10)) return;
    const g = new THREE.Group(), y = alturaChao(x, z);
    if (tipo === 'barril') { g.add(new THREE.Mesh(geoBarril, matBarril)); const f = new THREE.Mesh(geoFaixa, matFaixa); f.position.y = .3; g.add(f); g.position.set(x, y + .75, z); }
    else { g.add(new THREE.Mesh(geoCaixa, matCaixa)); [-.75, .75].forEach((yy) => { const a = new THREE.Mesh(geoAresta, matCaixaNeon); a.position.y = yy; g.add(a); }); g.position.set(x, y + .8, z); g.rotation.y = Math.random() * 3; }
    cena.add(g);
    destrutiveis.push({ tipo, g, pos: g.position, hp: tipo === 'barril' ? 1.5 : 2.5, vivo: true, flash: 0 });
  }
  // mais alguns grupos soltos pelo mapa
  for (let i = 0; i < 14; i++) { const L = lugar(15); if (!L) continue; const n = 2 + Math.floor(r() * 4); for (let k = 0; k < n; k++) criarDestrutivel(r() < .5 ? 'barril' : 'caixa', L.x + (r() - .5) * 8, L.z + (r() - .5) * 8); }

  /* ---- rios: faixa de agua sobre o leito ---- */
  const matAgua = guarda(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { tempo: { value: 0 }, cor: { value: new THREE.Color(`hsl(${(cor + 180) % 360},55%,45%)`) }, brilho: { value: new THREE.Color(`hsl(${(cor + 180) % 360},80%,80%)`) } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float tempo; uniform vec3 cor, brilho; varying vec2 vU;
      void main(){
        float b = abs(vU.x - .5) * 2.;
        float onda = sin(vU.y * .35 - tempo * 3.) * .5 + .5, onda2 = sin(vU.y * .9 + vU.x * 6. - tempo * 5.) * .5 + .5;
        vec3 c = mix(cor, brilho, smoothstep(.75, 1., onda * onda2) * .7 + smoothstep(.8, 1., b) * .4);
        gl_FragColor = vec4(c, .82 * (1. - smoothstep(.85, 1., b)));
      }`
  }));
  rios.forEach((rio) => {
    if (!ar) return;
    const pts = rio.pontos, larg = rio.largura * .8, pos = [], uv = [], idx = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i > 0) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const y = alturaChao(pts[i].x, pts[i].z) + 1.6;
      pos.push(pts[i].x + nx * larg, y, pts[i].z + nz * larg, pts[i].x - nx * larg, y, pts[i].z - nz * larg);
      uv.push(0, dist, 1, dist);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = guarda(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const agua = new THREE.Mesh(geo, matAgua); agua.renderOrder = 1; cena.add(agua);
  });
  anim.push((t) => { matAgua.uniforms.tempo.value = t; });

  /* ---- chuva de meteoros (alguns planetas) ---- */
  const temChuva = (planeta.key.length + cor) % 3 !== 0 || !ar;
  const NM = 26, meteoros = [];
  let linhas = null, lpos = null, lcor = null;
  if (temChuva) {
    lpos = new Float32Array(NM * 6); lcor = new Float32Array(NM * 6);
    const lg = guarda(new THREE.BufferGeometry()); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lcor, 3));
    linhas = new THREE.LineSegments(lg, guarda(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    linhas.frustumCulled = false; cena.add(linhas);
    for (let i = 0; i < NM; i++) meteoros.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), vida: -Math.random() * 6, cauda: 0 });
  }
  const claroes = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFogo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); s.visible = false; cena.add(s); claroes.push({ s, vida: 0 }); }
  let pcl = 0;

  return {
    colisores, destrutiveis, temChuva,
    /** um tiro em p acertou algo daqui? (dano, raio de area); explodir(p, tam, cor) faz o efeito */
    testarTiro(p, dano, area, explodir, aoQuebrar) {
      let bateu = false;
      for (const d of destrutiveis) {
        if (!d.vivo) continue;
        const dist = d.pos.distanceTo(p);
        if (dist < 1.3 || (area && dist < area)) {
          bateu = bateu || dist < 1.3;
          d.hp -= area && dist > 1.3 ? dano * (1 - dist / area) : dano; d.flash = 1;
          if (d.hp <= 0) quebrar(d, explodir, aoQuebrar);
        }
      }
      for (const c of colisores) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r && p.y < c.h) { explodir(p, 2, [.8, .7, .9]); return true; }
      return bateu;
    },
    atualizar(dt, t, camera, efeitos) {
      anim.forEach((f) => f(t));
      // fumaca
      for (const f of fontes) {
        f.acum += dt * f.taxa;
        while (f.acum >= 1) { f.acum -= 1; const i = fprox; fprox = (fprox + 1) % NF; fp[i * 3] = f.x + (Math.random() - .5) * 2; fp[i * 3 + 1] = f.y; fp[i * 3 + 2] = f.z + (Math.random() - .5) * 2; fv[i] = 1; ft[i] = f.tam * (.7 + Math.random() * .6); }
      }
      for (let i = 0; i < NF; i++) { if (fv[i] <= 0) continue; fv[i] -= dt * .22; fp[i * 3 + 1] += dt * (5 + (1 - fv[i]) * 6); fp[i * 3] += dt * 1.5; }
      fg.attributes.position.needsUpdate = true; fg.attributes.vida.needsUpdate = true; fg.attributes.tam.needsUpdate = true;
      // destrutiveis piscando
      for (const d of destrutiveis) if (d.vivo && d.flash > 0) { d.flash -= dt * 6; d.g.scale.setScalar(1 + Math.max(0, d.flash) * .08); }
      // meteoros: nascem alto, em volta da camera, e riscam o ceu
      if (temChuva) {
        const c = camera.position;
        for (let i = 0; i < NM; i++) {
          const m = meteoros[i];
          m.vida -= dt;
          if (m.vida <= 0 && m.vida > -100) {
            if (m.cauda > 0) {
              // chegou ao fim: sem ar bate no chao com clarao; com ar, queimou no ceu
              if (!ar) { const cl = claroes[pcl]; pcl = (pcl + 1) % claroes.length; cl.s.position.copy(m.p); cl.s.position.y = alturaChao(m.p.x, m.p.z) + 8; cl.vida = .7; cl.s.visible = true; efeitos?.impacto?.(cl.s.position); }
              m.cauda = 0;
            }
            m.vida = -100 - Math.random() * 5;
          }
          if (m.vida < -100) {
            m.vida += 100 + dt * 0;   // espera (contagem negativa)
            if (m.vida > -100 + 0) {}
          }
          if (m.vida <= -100) { m.vida += dt; if (m.vida > -100) { /* nasce */
            const a = Math.random() * 6.28, d = 300 + Math.random() * 1500;
            m.p.set(c.x + Math.cos(a) * d, c.y + 900 + Math.random() * 1200, c.z + Math.sin(a) * d);
            m.v.set(Math.random() - .5, -1, Math.random() - .5).normalize().multiplyScalar(300 + Math.random() * 400);
            m.vida = ar ? 1.2 + Math.random() * 1.6 : (m.p.y - alturaChao(m.p.x, m.p.z)) / -m.v.y; m.cauda = 40 + Math.random() * 60;
          } }
          const o = i * 6;
          if (m.cauda > 0 && m.vida > 0) {
            m.p.addScaledVector(m.v, dt);
            _v.copy(m.v).normalize();
            lpos[o] = m.p.x; lpos[o + 1] = m.p.y; lpos[o + 2] = m.p.z;
            lpos[o + 3] = m.p.x - _v.x * m.cauda; lpos[o + 4] = m.p.y - _v.y * m.cauda; lpos[o + 5] = m.p.z - _v.z * m.cauda;
            lcor[o] = 1; lcor[o + 1] = .85; lcor[o + 2] = .6; lcor[o + 3] = 0; lcor[o + 4] = 0; lcor[o + 5] = 0;
          } else { lcor[o] = lcor[o + 1] = lcor[o + 2] = 0; lpos[o + 1] = lpos[o + 4] = -1e6; }
        }
        linhas.geometry.attributes.position.needsUpdate = true; linhas.geometry.attributes.color.needsUpdate = true;
      }
      for (const cl of claroes) { if (cl.vida <= 0) continue; cl.vida -= dt; cl.s.material.opacity = Math.max(0, cl.vida / .7); cl.s.scale.setScalar(60 + (1 - cl.vida / .7) * 120); if (cl.vida <= 0) cl.s.visible = false; }
    }
  };

  function quebrar(d, explodir, aoQuebrar) {
    d.vivo = false; d.g.visible = false;
    if (d.tipo === 'barril') {
      explodir(d.pos, 9, [1, .55, .2]); aoQuebrar?.('barril', d.pos);
      // reacao em cadeia: barris perto tambem explodem (um pouco depois)
      setTimeout(() => { for (const e of destrutiveis) if (e.vivo && e.pos.distanceTo(d.pos) < 9) { e.hp -= 3; e.flash = 1; if (e.hp <= 0) quebrar(e, explodir, aoQuebrar); } }, 140);
    } else { explodir(d.pos, 3, [.7, .6, .9]); aoQuebrar?.('caixa', d.pos); }
  }
}
