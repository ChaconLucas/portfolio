import * as THREE from 'three';

/**
 * Cidades da superficie: cada tecnologia da area vira uma CIDADE futurista
 * (grande, media ou pequena pelo nivel), com o predio da tecnologia na praca
 * do centro, ruas e avenidas em grade, faixas de neon, postes e anel viario.
 * Algumas cidades sao RUINAS (abandonadas): os mesmos predios, quebrados,
 * tortos e apagados. Rodovias ligam as cidades e a plataforma de pouso.
 *
 * planejarCidades / planejarEstradas so calculam posicoes (o relevo usa para
 * aplainar); construirCidades monta as malhas (juntadas por material: cada
 * cidade sao poucas chamadas de desenho).
 */
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const TAM = { grande: { raio: 380, quadra: 72, alt: 70 }, media: { raio: 250, quadra: 64, alt: 46 }, pequena: { raio: 190, quadra: 64, alt: 30 } };
const RUAS = { avenida: 12, rua: 8 };

/** cidades: as da stack (na ordem das techs) e algumas em ruinas */
export function planejarCidades(key, techs, periodo, embr) {
  const r = rnd(key.length * 6151 + 3), out = [];
  const dist = (a, b) => Math.hypot(embr(a.x - b.x), embr(a.z - b.z));
  const cabe = (c) => dist(c, { x: 0, z: 0 }) > c.raio + 260 && out.every((o) => dist(o, c) > o.raio + c.raio + 900);
  const tamanhoDe = (t) => (t.nivel === 'Primary' || t.nivel === 'Core' ? 'grande' : t.nivel === 'Professional' ? 'media' : 'pequena');
  const colocar = (base) => {
    for (let k = 0; k < 600; k++) {
      const c = { ...base, x: (r() - .5) * periodo, z: (r() - .5) * periodo };
      if (cabe(c)) { out.push(c); return; }
    }
    // sem lugar (muito cheio): diminui a distancia minima
    out.push({ ...base, x: (r() - .5) * periodo, z: (r() - .5) * periodo });
  };
  techs.forEach((tec, i) => { const tam = tamanhoDe(tec); colocar({ i, tec, tam, raio: TAM[tam].raio, rot: r() * Math.PI / 2, ruina: false, semente: Math.floor(r() * 1e6) }); });
  const nRuinas = 3 + (key.length % 3);
  for (let k = 0; k < nRuinas; k++) { const tam = r() < .3 ? 'media' : 'pequena'; colocar({ i: -1, tec: null, tam, raio: TAM[tam].raio, rot: r() * Math.PI / 2, ruina: true, semente: Math.floor(r() * 1e6) }); }
  return out;
}

/**
 * Rodovias: arvore ligando a plataforma (0,0) e todas as cidades (mais uma ou
 * duas ligacoes extras), pelo lado mais curto do planeta. Pontos de 20 em 20 m
 * em coordenadas continuas (podem passar da borda; o desenho repete).
 */
export function planejarEstradas(cidades, embr) {
  const nos = [{ x: 0, z: 0, raio: 60 }, ...cidades];
  const d = (a, b) => Math.hypot(embr(a.x - b.x), embr(a.z - b.z));
  const ligado = [0], arestas = [];
  while (ligado.length < nos.length) {
    let melhor = null;
    for (const i of ligado) for (let j = 0; j < nos.length; j++) { if (ligado.includes(j)) continue; const dd = d(nos[i], nos[j]); if (!melhor || dd < melhor.d) melhor = { i, j, d: dd }; }
    ligado.push(melhor.j); arestas.push(melhor);
  }
  // extras: cada cidade grande tambem liga a segunda mais perto
  nos.forEach((a, i) => {
    if (!a.tam || a.tam !== 'grande') return;
    const viz = nos.map((b, j) => ({ j, dd: d(a, b) })).filter((x) => x.j !== i).sort((x, y) => x.dd - y.dd);
    const v = viz[1]; if (v && !arestas.some((e) => (e.i === i && e.j === v.j) || (e.i === v.j && e.j === i))) arestas.push({ i, j: v.j, d: v.dd });
  });
  return arestas.map(({ i, j }) => {
    const a = nos[i], b = nos[j], dx = embr(b.x - a.x), dz = embr(b.z - a.z), L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    const ini = (a.raio || 60) - 6, fim = L - (b.raio || 60) + 6, curva = (((i * 7 + j * 13) % 9) - 4) * 35;
    const pontos = [];
    for (let s = ini; s <= fim; s += 20) {
      const u = (s - ini) / Math.max(1, fim - ini), desvio = Math.sin(u * Math.PI) * curva;
      pontos.push({ x: a.x + ux * s + nx * desvio, z: a.z + uz * s + nz * desvio });
    }
    return { pontos, largura: 16, de: i, para: j };
  });
}

/* ------------------------------------------------------------ montagem -- */
export function construirCidades(raiz, o) {
  const { cidades, estradas, alturaChao, guarda, cor, criarPecas, colisores, longe, embr } = o;
  const neon = new THREE.Color(`hsl(${cor},95%,66%)`), neon2 = new THREE.Color(`hsl(${(cor + 160) % 360},90%,62%)`);
  const M = {
    corpo: guarda(new THREE.MeshStandardMaterial({ color: 0x232030, roughness: .45, metalness: .55, flatShading: true, emissive: new THREE.Color(`hsl(${cor},30%,10%)`), emissiveIntensity: 1 })),
    corpoClaro: guarda(new THREE.MeshStandardMaterial({ color: 0x8f8aa6, roughness: .35, metalness: .5, flatShading: true, emissive: new THREE.Color(`hsl(${cor},20%,16%)`), emissiveIntensity: 1 })),
    vidro: guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},60%,30%)`), roughness: .1, metalness: .7, emissive: new THREE.Color(`hsl(${cor},80%,32%)`), emissiveIntensity: .9, flatShading: true })),
    neon: guarda(new THREE.MeshBasicMaterial({ color: neon })),
    neon2: guarda(new THREE.MeshBasicMaterial({ color: neon2 })),
    apagado: guarda(new THREE.MeshStandardMaterial({ color: 0x1a1822, roughness: .9, metalness: .2, flatShading: true })),
    ruina: guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},10%,24%)`), roughness: .95, metalness: .2, flatShading: true })),
    via: guarda(new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: .8, metalness: .3, emissive: new THREE.Color(`hsl(${cor},30%,6%)`), emissiveIntensity: 1 })),
    faixa: guarda(new THREE.MeshBasicMaterial({ color: neon.clone().multiplyScalar(.8) }))
  };

  /* predio futurista (em coordenadas locais da cidade); ruina: quebrado e apagado */
  function predio(pc, x, z, base, alt, ruina, rr) {
    const tipo = Math.floor(rr() * 5), corpo = ruina ? M.ruina : (rr() < .25 ? M.corpoClaro : M.corpo), luz = ruina ? M.apagado : (rr() < .5 ? M.neon : M.neon2);
    const giro = rr() * Math.PI, inclina = ruina ? (rr() - .5) * .25 : 0;
    let topo = alt;
    if (ruina) topo = alt * (.25 + rr() * .5);
    if (tipo === 0) {
      // torre em degraus com faixas de neon
      let h = 0, w = base; const andares = 2 + Math.floor(rr() * 3);
      for (let a = 0; a < andares && h < topo; a++) {
        const ah = Math.min(topo - h, topo / andares * (1.2 - a * .15));
        pc.caixa(corpo, w, ah, w, x, h + ah / 2, z, giro, inclina * a, 0);
        pc.caixa(M.vidro, w * 1.01, ah * .7, w * .3, x, h + ah * .5, z, giro);
        if (!ruina) for (let f = 1; f < 4; f++) pc.caixa(luz, w + .2, .25, w + .2, x, h + ah * f / 4, z, giro);
        h += ah; w *= .72;
      }
      if (!ruina) { pc.cilindro(M.corpo, .25, alt * .25, x, h + alt * .12, z); pc.caixa(luz, .6, .6, .6, x, h + alt * .25, z); }
    } else if (tipo === 1) {
      // cupula sobre base cilindrica, anel de neon
      const r0 = base * .65, hb = Math.min(topo, alt * .35);
      pc.cilindro(corpo, r0, hb, x, hb / 2, z);
      if (!ruina) { pc.pedra(M.vidro, r0, x, hb, z, giro, .75, true); pc.cilindro(luz, r0 + .2, .3, x, hb, z); }
      else pc.pedra(M.ruina, r0 * .8, x + r0 * .3, hb * .6, z, giro, .5);
    } else if (tipo === 2) {
      // agulha: cone alto com aneis
      const h = topo, r0 = base * .45;
      pc.cone(corpo, r0, h, x, h / 2, z, inclina);
      if (!ruina) for (let f = 1; f < 5; f++) pc.cilindro(luz, r0 * (1 - f / 5) + .3, .3, x, h * f / 5, z);
    } else if (tipo === 3) {
      // bloco flutuante sobre pilar
      const hp = Math.min(topo, alt * .45);
      pc.cilindro(corpo, base * .18, hp, x, hp / 2, z);
      if (!ruina || rr() < .4) {
        const hb = alt * .22, yb = ruina ? hb / 2 : hp + hb / 2 + 1;
        pc.caixa(corpo, base * 1.1, hb, base * .8, x, yb, z, giro, ruina ? .4 : 0, ruina ? .3 : 0);
        if (!ruina) { pc.caixa(M.vidro, base * 1.12, hb * .5, base * .82, x, yb, z, giro); pc.caixa(luz, base * 1.14, .25, base * .84, x, yb - hb / 2, z, giro); }
      }
    } else {
      // par de torres finas ligadas por ponte
      const h = topo, w = base * .4, d = base * .35;
      for (const s of [-1, 1]) { const px = x + Math.cos(giro) * d * s, pz = z - Math.sin(giro) * d * s; pc.caixa(corpo, w, h * (s < 0 ? 1 : .8), w, px, h * (s < 0 ? 1 : .8) / 2, pz, giro, inclina, 0); if (!ruina) pc.caixa(luz, .2, h * .7, w + .1, px, h * .4, pz, giro); }
      if (!ruina || rr() < .3) pc.caixa(ruina ? M.ruina : M.vidro, d * 2, 2, w * .7, x, h * .6, z, giro, 0, ruina ? .3 : 0);
    }
    if (ruina) for (let k = 0; k < 3; k++) pc.caixa(M.ruina, 1 + rr() * 3, .6 + rr(), 1 + rr() * 3, x + (rr() - .5) * base * 1.6, .4, z + (rr() - .5) * base * 1.6, rr() * 3, 0, (rr() - .5) * .5);
    return Math.max(2, base * .55);
  }

  for (const c of cidades) {
    const T = TAM[c.tam], rr = rnd(c.semente), g = new THREE.Group();
    g.position.set(c.x, alturaChao(c.x, c.z), c.z); g.rotation.y = c.rot;
    const pc = criarPecas(guarda), R = c.raio, Q = T.quadra, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
    const paraMundo = (lx, lz) => [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs];
    // ruas: linhas nos meios das quadras (o centro fica numa quadra: a praca)
    const nLin = Math.floor(R / Q);
    for (let k = -nLin; k <= nLin; k++) {
      const off = (k + .5) * Q; if (Math.abs(off) > R - 10) continue;
      const L = Math.sqrt(R * R - off * off) - 6, larg = Math.abs(k + .5) < 1 ? RUAS.avenida : RUAS.rua;
      if (!c.ruina || rr() < .7) {
        pc.caixa(M.via, larg, .1, L * 2, off, .06, 0); pc.caixa(M.via, L * 2, .1, larg, 0, .06, off);
        if (!c.ruina) {
          // faixas de neon tracejadas e postes nas calcadas
          for (let s = -L + 6; s < L - 6; s += 14) { pc.caixa(M.faixa, .3, .05, 6, off, .13, s); pc.caixa(M.faixa, 6, .05, .3, s, .13, off); }
          for (let s = -L + 10; s < L - 10; s += 34) {
            for (const [px, pz] of [[off + larg / 2 + 1, s], [s, off + larg / 2 + 1]]) { pc.cilindro(M.corpo, .12, 6, px, 3, pz); pc.caixa(M.neon2, .9, .25, .9, px, 6, pz); }
          }
        }
      }
    }
    // anel viario na borda
    if (!c.ruina) { const anel = guarda(new THREE.RingGeometry(R - 9, R - 1, 72)); anel.rotateX(-Math.PI / 2); pc.geo(anel, M.via, 0, .08, 0); const fio = guarda(new THREE.RingGeometry(R - 5.2, R - 4.8, 72)); fio.rotateX(-Math.PI / 2); pc.geo(fio, M.faixa, 0, .14, 0); }
    // predios nas quadras: mais altos perto do centro; a quadra do meio e a praca
    for (let i = -nLin - 1; i <= nLin; i++) for (let j = -nLin - 1; j <= nLin; j++) {
      const cx = (i + 1) * Q, cz = (j + 1) * Q, d = Math.hypot(cx, cz);
      if (d < Q * .6 || d > R - Q * .55) continue;
      const util = Q - RUAS.avenida - 6, n = c.tam === 'pequena' ? 1 : 2;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if (rr() < (c.ruina ? .35 : .12)) continue;   // lotes vazios (pracinhas)
        const lx = cx + (n === 1 ? 0 : (a - .5) * util / 2), lz = cz + (n === 1 ? 0 : (b - .5) * util / 2);
        const base = (util / n) * (.55 + rr() * .3), alt = T.alt * (.35 + .65 * (1 - d / R)) * (.6 + rr() * .7);
        const raioCol = predio(pc, lx, lz, base, alt, c.ruina, rr);
        const [wx, wz] = paraMundo(lx, lz);
        colisores.push({ x: wx, z: wz, r: raioCol, h: g.position.y + (c.ruina ? alt * .7 : alt) });
      }
    }
    pc.montar(g); raiz.add(g);
    longe.push({ g, x: c.x, z: c.z, alcance: 2600 + R });
  }

  /* rodovias: faixa escura com bordas e centro em neon, seguindo o terreno */
  if (estradas.length) {
    const pos = [], posF = [], idx = [], idxF = [];
    const fita = (P, Q, larg, dy, arr, ids) => {
      const base = arr.length / 3;
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const y = alturaChao(P[i].x, P[i].z) + dy, ox = Q ? Q * nx : 0, oz = Q ? Q * nz : 0;
        arr.push(P[i].x + ox + nx * larg, y, P[i].z + oz + nz * larg, P[i].x + ox - nx * larg, y, P[i].z + oz - nz * larg);
        if (i > 0) { const k = base + (i - 1) * 2; ids.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
    };
    for (const e of estradas) {
      fita(e.pontos, 0, e.largura / 2, .25, pos, idx);
      fita(e.pontos, e.largura / 2 - .8, .25, .32, posF, idxF); fita(e.pontos, -(e.largura / 2 - .8), .25, .32, posF, idxF);
      fita(e.pontos.filter((_, k) => k % 2 === 0), 0, .2, .32, posF, idxF);
    }
    for (const [p, i, m] of [[pos, idx, M.via], [posF, idxF, M.faixa]]) {
      const geo = guarda(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setIndex(i); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; raiz.add(mesh);
    }
  }
  return M;
}
