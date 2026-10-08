import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CURVA_GLSL, usarCurva } from './curva.js';
import { construirCidades } from './cidades.js';

/**
 * O que deixa o planeta "vivo", alem dos locais da stack (espalhado pelo
 * planeta inteiro, que se repete nas bordas):
 *  - naves caidas (o mesmo modelo da nave, queimado, tombado e meio enterrado),
 *    soltando fumaca e com fogo piscando;
 *  - ruinas: torres quebradas, arcos e colunatas;
 *  - BASES com cobertura para o PvP: conteineres, muros de sacos de areia,
 *    barreiras de concreto e torre de vigia;
 *  - BUNKERS e GALPOES onde da para entrar (paredes de verdade, porta, o teto
 *    some quando voce esta dentro) com caixas, prateleiras e luzes;
 *  - CAVERNAS: cupulas de pedra com entrada, escuras por dentro, com cristais
 *    brilhando;
 *  - rios (so com atmosfera), coisas destrutiveis (barris explodem, caixas) e
 *    chuva de meteoros em alguns planetas.
 * Cada estrutura vira poucas malhas (as pecas sao juntadas por material) e o
 * que esta longe nem e desenhado.
 * Colisao: colisores (circulos) e paredes (segmentos com espessura).
 * Devolve { colisores, paredes, abrigos, destrutiveis, testarTiro, dentroDe, atualizar }.
 */
function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

/* pecas juntadas: cada estrutura acumula caixas/cilindros/pedras e no fim vira
   uma malha por material (poucas chamadas de desenho) */
function criarPecas(guarda) {
  const porMat = new Map();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); g.applyMatrix4(_m);
    if (!porMat.has(mat)) porMat.set(mat, []);
    porMat.get(mat).push(g);
  };
  const B = new THREE.BoxGeometry(1, 1, 1), C = new THREE.CylinderGeometry(.5, .5, 1, 10), P = new THREE.IcosahedronGeometry(1, 0), D = new THREE.IcosahedronGeometry(1, 1), K = new THREE.ConeGeometry(.5, 1, 10), H = new THREE.CylinderGeometry(.5, .5, 1, 6);
  return {
    caixa: (mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) => add(B, mat, x, y, z, rx, ry, rz, w, h, d),
    cilindro: (mat, rr, h, x, y, z, rx = 0, ry = 0, rz = 0) => add(C, mat, x, y, z, rx, ry, rz, rr * 2, h, rr * 2),
    cone: (mat, rr, h, x, y, z, rz = 0) => add(K, mat, x, y, z, 0, 0, rz, rr * 2, h, rr * 2),
    hexa: (mat, rr, h, x, y, z, rx = 0, ry = 0, rz = 0) => add(H, mat, x, y, z, rx, ry, rz, rr * 2, h, rr * 2),
    pedra: (mat, k, x, y, z, ry = 0, sy = 1, detalhe = false) => add(detalhe ? D : P, mat, x, y, z, 0, ry, 0, k, k * sy, k),
    geo: (geo, mat, x, y, z, ry = 0) => add(geo, mat, x, y, z, 0, ry, 0),
    montar(grupo) {
      for (const [mat, lista] of porMat) {
        const g = guarda(mergeGeometries(lista)); g.computeVertexNormals();
        lista.forEach((x) => x.dispose());
        grupo.add(new THREE.Mesh(g, mat));
      }
      porMat.clear(); B.dispose(); C.dispose(); P.dispose(); D.dispose(); K.dispose(); H.dispose();
      return grupo;
    }
  };
}

export function criarEstruturas(raiz, o) {
  const { planeta, alturaChao, livre, guarda, modeloNave, rios, limite, sitios = [], ceu } = o;
  const PER = limite * 2, embr = (a) => a - PER * Math.round(a / PER);
  const ar = planeta.atmosfera !== false, cor = planeta.cor;
  const r = rnd(planeta.key.length * 4231 + 77);
  const colisores = [], paredes = [], abrigos = [], destrutiveis = [], anim = [], longe = [];   // longe: { g, x, z, alcance } (some de longe)
  const cnNeon = new THREE.Color(`hsl(${cor},90%,62%)`);
  // (materiais dos barris/caixas primeiro: as naves caidas ja espalham alguns)
  // (nada da Terra: o "barril" e uma celula de energia, que explode igual)
  const matBarril = guarda(new THREE.MeshStandardMaterial({ color: 0x2a2836, roughness: .4, metalness: .7 }));
  const matFaixa = guarda(new THREE.MeshBasicMaterial({ color: 0xff7a2e }));
  const matCaixa = guarda(new THREE.MeshStandardMaterial({ color: 0x5b4a6e, roughness: .7, metalness: .3 }));
  const matCaixaNeon = guarda(new THREE.MeshBasicMaterial({ color: cnNeon }));
  const geoBarril = guarda(new THREE.CylinderGeometry(.6, .6, 1.5, 14)), geoFaixa = guarda(new THREE.CylinderGeometry(.64, .64, .7, 14)), geoCaixa = guarda(new THREE.BoxGeometry(1.6, 1.6, 1.6)), geoAresta = guarda(new THREE.BoxGeometry(1.66, .12, 1.66));
  const lugar = (folga, raioMax = limite * .98) => {
    for (let k = 0; k < 400; k++) {
      const x = (r() - .5) * 2 * raioMax, z = (r() - .5) * 2 * raioMax;
      if (livre(x, z, folga) && rios.every((rio) => rio.dist(x, z) > folga + 20)) return { x, z };
    }
    return null;
  };
  // parede (segmento) em coordenadas locais de um grupo (posicao + giro)
  const parede = (g, ax, az, bx, bz, esp, h) => {
    const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
    const P = (x, z) => [g.position.x + x * c + z * s, g.position.z - x * s + z * c];
    const [x1, z1] = P(ax, az), [x2, z2] = P(bx, bz);
    paredes.push({ ax: x1, az: z1, bx: x2, bz: z2, esp, h: g.position.y + h });
  };

  /* ---- fumaca e fogo (um sistema so para todas as fontes) ---- */
  const NF = 700, fp = new Float32Array(NF * 3), fv = new Float32Array(NF), ft = new Float32Array(NF);
  const fg = guarda(new THREE.BufferGeometry()); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('vida', new THREE.BufferAttribute(fv, 1)); fg.setAttribute('tam', new THREE.BufferAttribute(ft, 1));
  const fumaca = new THREE.Points(fg, guarda(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: usarCurva({}),
    vertexShader: CURVA_GLSL + 'attribute float vida; attribute float tam; varying float v; void main(){ v = vida; vec4 mv = viewMatrix * curvar(modelMatrix * vec4(position,1.)); gl_PointSize = min(220., tam * (1.6 - vida) * 300. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float v; void main(){ if (v <= 0.) discard; float d = length(gl_PointCoord - .5) * 2.; float a = (1. - d) * min(1., v * 1.6) * .38; if (a <= 0.) discard; gl_FragColor = vec4(vec3(.16,.14,.18) + vec3(.3,.12,.02) * smoothstep(.75, 1., v), a); }'
  })));
  fumaca.frustumCulled = false; raiz.add(fumaca);
  let fprox = 0;
  const fontes = [];   // { x, y, z, taxa, acum }
  const texFogo = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.3, 'rgba(255,140,40,.8)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return guarda(new THREE.CanvasTexture(c)); })();

  /* ---- naves caidas ---- */
  if (modeloNave) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const L = lugar(30); if (!L) continue;
      const g = new THREE.Group(), k = 4 + r() * 4;
      const copia = modeloNave.clone(true);
      copia.traverse((m) => { if (m.isMesh) { m.material = guarda(m.material.clone()); m.material.color.multiplyScalar(.62); m.material.emissive = new THREE.Color(0x2a0c00); } });
      g.add(copia); g.scale.setScalar(k);
      const y = alturaChao(L.x, L.z);
      g.position.set(L.x, y + k * .15, L.z);
      g.rotation.set(-.12 - r() * .3, r() * 6.28, (r() - .5) * .9 + (r() < .2 ? Math.PI * .85 : 0));
      const bloco = new THREE.Group(); bloco.add(g); raiz.add(bloco);
      // cratera/rastro de terra escura na frente
      const marca = new THREE.Mesh(guarda(new THREE.CircleGeometry(k * 1.7, 24)), guarda(new THREE.MeshBasicMaterial({ color: 0x0d0a10, transparent: true, opacity: .3, depthWrite: false })));
      marca.rotation.x = -Math.PI / 2; marca.position.set(L.x, y + .15, L.z); marca.scale.set(1, 1.8, 1); marca.rotation.z = g.rotation.y; bloco.add(marca);
      colisores.push({ x: L.x, z: L.z, r: k * 1.4, h: y + k * 1.2 });
      fontes.push({ x: L.x + (r() - .5) * k, y: y + k * .5, z: L.z + (r() - .5) * k, taxa: 14 + r() * 10, acum: 0, tam: 1 + k * .25 });
      const fogo = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFogo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      fogo.position.set(L.x, y + k * .3, L.z); fogo.scale.setScalar(k * 1.4); bloco.add(fogo);
      anim.push((t) => { const f = .65 + Math.sin(t * 11 + i) * .2 + Math.sin(t * 23 + i * 3) * .15; fogo.material.opacity = f; fogo.scale.setScalar(k * (1.2 + f * .4)); });
      longe.push({ g: bloco, x: L.x, z: L.z, alcance: 1600 });
      // barris espalhados em volta da nave (destrutiveis)
      for (let b = 0; b < 3 + Math.floor(r() * 3); b++) {
        const a = r() * 6.28, d = k * 2 + r() * 10; criarDestrutivel(r() < .6 ? 'barril' : 'caixa', L.x + Math.cos(a) * d, L.z + Math.sin(a) * d);
      }
    }
  }

  /* ---- ruinas ---- */
  const matRuina = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},12%,30%)`), roughness: .95, flatShading: true }));
  const matRuinaNeon = guarda(new THREE.MeshBasicMaterial({ color: cnNeon }));
  for (let i = 0; i < 28; i++) {
    const L = lugar(40); if (!L) continue;
    const g = new THREE.Group(); const y = alturaChao(L.x, L.z); g.position.set(L.x, y, L.z); g.rotation.y = r() * 6.28;
    const pc = criarPecas(guarda);
    const tipo = i % 3;
    if (tipo === 0) {
      // torre quebrada: andares afinando, o de cima torto e partido
      let h = 0, w = 10 + r() * 6; const andares = 3 + Math.floor(r() * 3);
      for (let a = 0; a < andares; a++) {
        const ah = 6 + r() * 5, ult = a === andares - 1;
        pc.caixa(matRuina, w, ult ? ah * (.5 + r() * .4) : ah, w, (r() - .5) * .6, h + ah / 2, (r() - .5) * .6, r() * .1, 0, ult ? (r() - .5) * .5 : 0);
        if (!ult && r() < .6) pc.caixa(matRuinaNeon, w + .3, .3, w + .3, 0, h + ah, 0);
        h += ah; w *= .82;
      }
      colisores.push({ x: L.x, z: L.z, r: 8, h: y + h });
      for (let k = 0; k < 6; k++) pc.caixa(matRuina, 1.5 + r() * 3, 1 + r() * 2, 1.5 + r() * 3, (r() - .5) * 26, .6, (r() - .5) * 26, r() * 3, 0, (r() - .5) * .6);
    } else if (tipo === 1) {
      // portal antigo: anel de blocos em pe, com pedacos faltando
      const Rp = 9, n = 14;
      for (let k = 0; k < n; k++) {
        if (r() < .22) continue;
        const a = k / n * Math.PI * 2, x = Math.cos(a) * Rp, y = Rp + 1 + Math.sin(a) * Rp;
        pc.caixa(matRuina, 2.6, 4.2, 2.4, x, y, 0, 0, 0, a + Math.PI / 2);
        if (k % 2 === 0) pc.caixa(matRuinaNeon, .3, 3.6, 2.5, x * .86, Rp + 1 + Math.sin(a) * Rp * .86, 0, 0, 0, a + Math.PI / 2);
      }
      pc.caixa(matRuina, 6, 1.2, 4, 0, .6, 0);
      parede(g, -Rp, 0, -Rp, 0, 2, 4); parede(g, Rp, 0, Rp, 0, 2, 4);
    } else {
      // colunata: fileira de colunas, algumas caidas
      for (let k = 0; k < 7; k++) {
        const caiu = r() < .35, x = (k - 3) * 6;
        // pilones hexagonais (alguns tombados) com anel de neon apagando
        if (caiu) pc.hexa(matRuina, 1.2, 10, x + 2, 1.1, 4, Math.PI / 2, r() * .5);
        else { const h = 9 + r() * 4; pc.hexa(matRuina, 1.2, h, x, h / 2, 0); if (r() < .6) pc.hexa(matRuinaNeon, 1.3, .3, x, h * .7, 0); parede(g, x, 0, x, 0, 1.4, h); }
      }
      pc.caixa(matRuina, 44, 1, 7, 0, .5, 0);
    }
    pc.montar(g); raiz.add(g); longe.push({ g, x: L.x, z: L.z, alcance: 1900 });
    if (r() < .5) for (let b = 0; b < 3; b++) { const a = r() * 6.28, d = 14 + r() * 8; criarDestrutivel('caixa', L.x + Math.cos(a) * d, L.z + Math.sin(a) * d); }
  }

  /* ---- sitios: bases (cobertura), bunkers, galpoes e cavernas ---- */
  // (luz propria fraca: por dentro dos predios e cavernas nao ha lampada de
  // verdade — cada PointLight a mais pesaria em todos os materiais do planeta)
  const brilhoInt = new THREE.Color(`hsl(${cor},22%,22%)`);
  const matConcreto = guarda(new THREE.MeshStandardMaterial({ color: 0xb9b6c8, roughness: .35, metalness: .4, flatShading: true, emissive: brilhoInt, emissiveIntensity: .9 }));   // painel claro
  const matConcretoEsc = guarda(new THREE.MeshStandardMaterial({ color: 0x3a3644, roughness: .9, flatShading: true, emissive: brilhoInt, emissiveIntensity: .6 }));
  const matEscudo = guarda(new THREE.MeshBasicMaterial({ color: new THREE.Color(`hsl(${(cor + 180) % 360},90%,62%)`), transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }));
  const matMetal = guarda(new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: .6, metalness: .25, flatShading: true, emissive: brilhoInt, emissiveIntensity: .9 }));
  const matPedra = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${cor},10%,26%)`), roughness: 1, flatShading: true, side: THREE.DoubleSide, emissive: new THREE.Color(`hsl(${(cor + 40) % 360},40%,10%)`), emissiveIntensity: .8 }));
  const matCristal = guarda(new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${(cor + 40) % 360},90%,70%)`), emissive: new THREE.Color(`hsl(${(cor + 40) % 360},90%,45%)`), emissiveIntensity: 1.4, flatShading: true }));
  const matLuzInt = guarda(new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
  const matTela = guarda(new THREE.MeshBasicMaterial({ color: cnNeon }));
  const geoCristal = guarda(new THREE.OctahedronGeometry(1, 0)); geoCristal.scale(.5, 1.6, .5);

  // muro de energia: trilho de metal com um painel de luz (cobertura de meia altura)
  function escudo(pc, g, x, z, ry, comp) {
    const c = Math.cos(ry), s = Math.sin(ry);
    pc.caixa(matMetal, comp, .35, .7, x, .18, z, ry); pc.caixa(matCaixaNeon, comp, .08, .74, x, .38, z, ry);
    pc.caixa(matEscudo, comp, 1.9, .08, x, 1.35, z, ry);
    for (const u of [-comp / 2, comp / 2]) pc.hexa(matMetal, .22, 2.4, x + c * u, 1.2, z - s * u);
    parede(g, x - c * comp / 2, z + s * comp / 2, x + c * comp / 2, z - s * comp / 2, .5, 1.6);
  }
  // caixa flutuante (carga): bloco com arestas de neon pairando sobre um disco de luz
  function caixaFlutuante(pc, g, x, z, ry, k = 1) {
    pc.caixa(matMetal, 2.4 * k, 1.6 * k, 2.4 * k, x, .9 + .8 * k, z, ry);
    pc.caixa(matCaixaNeon, 2.46 * k, .12, 2.46 * k, x, .9 + 1.6 * k, z, ry); pc.caixa(matCaixaNeon, 2.46 * k, .12, 2.46 * k, x, .9, z, ry);
    pc.cilindro(matEscudo, 1.1 * k, .05, x, .25, z);
    parede(g, x, z, x, z, 1.5 * k, 1 + 1.6 * k);
  }
  // pilone alienigena: prisma hexagonal afinando com um cristal no topo
  function pilone(pc, g, x, z, h) {
    pc.hexa(matConcretoEsc, 1.1, h * .5, x, h * .25, z); pc.hexa(matMetal, .7, h * .4, x, h * .7, z);
    pc.geo(geoCristal, matCristal, x, h + 1.2, z, r() * 3);
    pc.hexa(matCaixaNeon, .75, .25, x, h * .5, z);
    parede(g, x, z, x, z, 1.2, h);
  }
  // predio com interior (bunker/galpao): 4 paredes com porta, teto que some por dentro
  function predioOco(s, W, D, H, estilo) {
    const g = new THREE.Group(); g.position.set(s.x, alturaChao(s.x, s.z), s.z); g.rotation.y = s.rot;
    const pc = criarPecas(guarda), mp = estilo === 'bunker' ? matConcreto : matMetal, esp = .5, porta = estilo === 'bunker' ? 2.6 : 5;
    // paredes (frente com a abertura da porta, em +z)
    pc.caixa(mp, W, H, esp, 0, H / 2, -D / 2); parede(g, -W / 2, -D / 2, W / 2, -D / 2, esp, H);
    pc.caixa(mp, esp, H, D, -W / 2, H / 2, 0); parede(g, -W / 2, -D / 2, -W / 2, D / 2, esp, H);
    pc.caixa(mp, esp, H, D, W / 2, H / 2, 0); parede(g, W / 2, -D / 2, W / 2, D / 2, esp, H);
    const lado = (W - porta) / 2;
    pc.caixa(mp, lado, H, esp, -W / 2 + lado / 2, H / 2, D / 2); parede(g, -W / 2, D / 2, -porta / 2, D / 2, esp, H);
    pc.caixa(mp, lado, H, esp, W / 2 - lado / 2, H / 2, D / 2); parede(g, porta / 2, D / 2, W / 2, D / 2, esp, H);
    pc.caixa(mp, porta, H - (estilo === 'bunker' ? 3 : 5.5), esp, 0, H - (H - (estilo === 'bunker' ? 3 : 5.5)) / 2, D / 2);   // verga
    pc.caixa(matCaixaNeon, porta + .4, .18, .6, 0, estilo === 'bunker' ? 3.1 : 5.6, D / 2 + .1);
    for (const [w, d, x, z] of [[W + .1, .1, 0, D / 2 + .3], [W + .1, .1, 0, -D / 2 - .3], [.1, D + .1, W / 2 + .3, 0], [.1, D + .1, -W / 2 - .3, 0]]) pc.caixa(matCaixaNeon, w, .15, d, x, H * .82, z);
    // piso
    pc.caixa(matConcretoEsc, W - .2, .2, D - .2, 0, .1, 0);
    // por dentro: luzes no teto, caixas/prateleiras (cobertura) e uma tela
    for (let k = -1; k <= 1; k += 2) pc.caixa(matLuzInt, 1.6, .12, .4, k * W / 5, H - .3, 0);
    if (estilo === 'galpao') {
      for (let k = -1; k <= 1; k += 2) { for (let a = 0; a < 3; a++) pc.caixa(matMetal, 1, .12, D * .6, k * (W / 2 - 1.6), .8 + a * 1.4, -D * .1); pc.caixa(matMetal, .12, 4.4, .12, k * (W / 2 - 1.1), 2.2, -D * .4); pc.caixa(matMetal, .12, 4.4, .12, k * (W / 2 - 1.1), 2.2, D * .2); }
      // passarela no alto
      pc.caixa(matMetal, W - 1, .2, 2, 0, 4.2, -D / 2 + 1.3);
    }
    pc.caixa(matTela, 2.6, 1.4, .1, 0, 2.1, -D / 2 + .32);
    pc.caixa(matMetal, 3, .9, 1.1, 0, .45, -D / 2 + 1.2);
    // teto (some quando quem joga esta dentro)
    const tetoG = new THREE.Group(); g.add(tetoG);
    const pt = criarPecas(guarda);
    if (estilo === 'bunker') {
      // modulo habitacional: teto em cupula achatada com antena
      pt.caixa(matConcreto, W + .8, .4, D + .8, 0, H + .2, 0);
      pt.pedra(matConcreto, Math.min(W, D) * .55, 0, H + .4, 0, 0, .35, true);
      pt.cilindro(matMetal, .1, 3, W / 4, H + 2.5, -D / 4); pt.caixa(matCaixaNeon, .4, .4, .4, W / 4, H + 4, -D / 4);
    } else {
      // hangar: teto em arco (meio cilindro deitado) com nervuras de neon
      pt.cilindro(matMetal, W / 2 + .4, D + .8, 0, H, 0, Math.PI / 2, 0, 0);
      for (let k = -2; k <= 2; k++) pt.cilindro(matCaixaNeon, W / 2 + .55, .25, 0, H, k * D / 5, Math.PI / 2, 0, 0);
    }
    pt.montar(tetoG);
    pc.montar(g);
    // caixas soltas dentro (cobertura, destrutiveis)
    for (let k = 0; k < (estilo === 'galpao' ? 5 : 2); k++) {
      const lx = (r() - .5) * (W - 6), lz = (r() - .5) * (D - 6), c = Math.cos(s.rot), sn = Math.sin(s.rot);
      criarDestrutivel('caixa', s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, true);
    }
    raiz.add(g); longe.push({ g, x: s.x, z: s.z, alcance: 2000 });
    abrigos.push({ x: s.x, z: s.z, rot: s.rot, w: W, d: D, h: H, teto: tetoG, tipo: estilo });
  }
  // caverna: cupula de pedra com entrada (em +z), cristais e luz por dentro
  function caverna(s) {
    const g = new THREE.Group(); g.position.set(s.x, alturaChao(s.x, s.z), s.z); g.rotation.y = s.rot;
    const R = 15 + r() * 4, H = 10 + r() * 3, pc = criarPecas(guarda);
    // casca: aneis de pedras em volta, deixando a boca aberta
    const nA = 22, boca = .5;   // boca: meia-largura (radianos) da entrada
    for (let anel = 0; anel < 4; anel++) {
      const fr = anel / 4, rr = R * Math.cos(fr * Math.PI / 2 * .95), yy = H * Math.sin(fr * Math.PI / 2) + 1;
      for (let k = 0; k < nA; k++) {
        const a = k / nA * Math.PI * 2, rel = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
        if (Math.abs(rel) < boca && yy < H * .55) continue;   // entrada (vira para +z)
        const k2 = 4.2 + r() * 2 - anel * .5;
        pc.pedra(matPedra, k2, Math.cos(a) * rr, yy, Math.sin(a) * rr, r() * 6, 1.1, true);
      }
    }
    pc.pedra(matPedra, R * .55, 0, H + 1.5, 0, r() * 6, .45, true);   // topo
    // colisao: paredes em volta (menos a boca)
    for (let k = 0; k < nA; k++) {
      const a1 = k / nA * Math.PI * 2, a2 = (k + 1) / nA * Math.PI * 2, mid = (a1 + a2) / 2;
      if (Math.abs(Math.atan2(Math.sin(mid - Math.PI / 2), Math.cos(mid - Math.PI / 2))) < boca) continue;
      parede(g, Math.cos(a1) * (R - 1.5), Math.sin(a1) * (R - 1.5), Math.cos(a2) * (R - 1.5), Math.sin(a2) * (R - 1.5), 1.5, H);
    }
    // por dentro: cristais grandes e pequenos, poça de luz
    for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = 4 + r() * (R - 7); pc.geo(geoCristal, matCristal, Math.cos(a) * d, .8, Math.sin(a) * d, r() * 6); }
    pc.montar(g);
    raiz.add(g); longe.push({ g, x: s.x, z: s.z, alcance: 2000 });
    abrigos.push({ x: s.x, z: s.z, rot: s.rot, raio: R - 2, h: H, teto: null, tipo: 'caverna' });
  }
  // posto avancado: muros de energia, caixas flutuantes, pilones e torre de sensor
  function base(s) {
    const g = new THREE.Group(); g.position.set(s.x, alturaChao(s.x, s.z), s.z); g.rotation.y = s.rot;
    const pc = criarPecas(guarda);
    for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = 7 + r() * 16; escudo(pc, g, Math.cos(a) * d, Math.sin(a) * d, a + Math.PI / 2, 3.5 + r() * 4); }
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.28 + r() * .5, d = 9 + r() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d;
      caixaFlutuante(pc, g, x, z, r() * 3); if (r() < .3) caixaFlutuante(pc, g, x + 3, z, r() * 3, .7);
    }
    for (let k = 0; k < 3; k++) { const a = r() * 6.28, d = 14 + r() * 10; pilone(pc, g, Math.cos(a) * d, Math.sin(a) * d, 6 + r() * 5); }
    // torre de sensor: tripe com um anel girando no alto
    if (r() < .7) {
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28; pc.caixa(matMetal, .3, 9, .3, Math.cos(a) * 1.4, 4.3, Math.sin(a) * 1.4, 0, Math.sin(a) * .15, -Math.cos(a) * .15); }
      pc.cilindro(matMetal, 1.2, .6, 0, 9, 0);
      colisores.push({ x: s.x, z: s.z, r: 2.2, h: g.position.y + 10 });
    }
    pc.montar(g); raiz.add(g); longe.push({ g, x: s.x, z: s.z, alcance: 1700 });
    if (r() < .7) {
      const anel = new THREE.Mesh(guarda(new THREE.TorusGeometry(2.2, .12, 6, 28)), matCaixaNeon); anel.position.y = 10; anel.rotation.x = Math.PI / 2; g.add(anel);
      anim.push((t2) => { anel.rotation.z = t2 * .8; anel.rotation.x = Math.PI / 2 + Math.sin(t2 * .5) * .3; });
    }
    for (let k = 0; k < 4; k++) { const a = r() * 6.28, d = 5 + r() * 14; criarDestrutivel(r() < .5 ? 'barril' : 'caixa', s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, true); }
  }
  for (const s of sitios) {
    if (s.tipo === 'caverna') caverna(s);
    else if (s.tipo === 'bunker') predioOco(s, 12, 10, 4, 'bunker');
    else if (s.tipo === 'galpao') predioOco(s, 18, 14, 7.5, 'galpao');
    else base(s);
  }

  /* ---- cidades (uma por tecnologia, algumas em ruinas) e rodovias ---- */
  if (o.cidades) construirCidades(raiz, { cidades: o.cidades, estradas: o.estradas || [], alturaChao, guarda, cor, criarPecas, colisores, longe, embr });

  /* ---- destrutiveis ---- */
  function criarDestrutivel(tipo, x, z, dentro = false) {
    if (!dentro && !livre(x, z, -10)) return;
    const g = new THREE.Group(), y = alturaChao(x, z);
    if (tipo === 'barril') { g.add(new THREE.Mesh(geoBarril, matBarril)); const f = new THREE.Mesh(geoFaixa, matFaixa); g.add(f); g.position.set(x, y + .75, z); }
    else { g.add(new THREE.Mesh(geoCaixa, matCaixa)); [-.75, .75].forEach((yy) => { const a = new THREE.Mesh(geoAresta, matCaixaNeon); a.position.y = yy; g.add(a); }); g.position.set(x, y + .8, z); g.rotation.y = Math.random() * 3; }
    raiz.add(g);
    const d = { tipo, g, pos: g.position, hp: tipo === 'barril' ? 1.5 : 2.5, vivo: true, flash: 0 };
    destrutiveis.push(d); longe.push({ g, x, z, alcance: 800, d });
  }
  // mais alguns grupos soltos pelo mapa
  for (let i = 0; i < 34; i++) { const L = lugar(15); if (!L) continue; const n = 2 + Math.floor(r() * 4); for (let k = 0; k < n; k++) criarDestrutivel(r() < .5 ? 'barril' : 'caixa', L.x + (r() - .5) * 8, L.z + (r() - .5) * 8); }

  /* ---- rios: faixa de agua sobre o leito ---- */
  const matAgua = guarda(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: usarCurva({ tempo: { value: 0 }, cor: { value: new THREE.Color(`hsl(${(cor + 180) % 360},55%,45%)`) }, brilho: { value: new THREE.Color(`hsl(${(cor + 180) % 360},80%,80%)`) } }),
    vertexShader: CURVA_GLSL + 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * viewMatrix * curvar(modelMatrix * vec4(position,1.)); }',
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
    // linha central continua: soma as diferencas "pelo lado curto" (o rio da a
    // volta no mapa sem o salto da borda)
    const P0 = rio.pontos, larg = rio.largura * .8, cx = [P0[0].x], cz = [P0[0].z];
    for (let i = 1; i < P0.length; i++) { cx.push(cx[i - 1] + embr(P0[i].x - P0[i - 1].x)); cz.push(cz[i - 1] + embr(P0[i].z - P0[i - 1].z)); }
    const pos = [], uv = [], idx = [];
    let dist = 0;
    for (let i = 0; i < cx.length; i++) {
      const a = Math.max(0, i - 1), b = Math.min(cx.length - 1, i + 1);
      const dx = cx[b] - cx[a], dz = cz[b] - cz[a], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      if (i > 0) dist += Math.hypot(cx[i] - cx[i - 1], cz[i] - cz[i - 1]);
      const y = alturaChao(cx[i], cz[i]) + 1.6;
      pos.push(cx[i] + nx * larg, y, cz[i] + nz * larg, cx[i] - nx * larg, y, cz[i] - nz * larg);
      uv.push(0, dist, 1, dist);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = guarda(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const agua = new THREE.Mesh(geo, matAgua); agua.renderOrder = 1; agua.frustumCulled = false; raiz.add(agua);
  });
  anim.push((t) => { matAgua.uniforms.tempo.value = t; });

  /* ---- chuva de meteoros (alguns planetas): em volta da camera, no ceu ---- */
  const temChuva = (planeta.key.length + cor) % 3 !== 0 || !ar;
  const NM = 26, meteoros = [];
  let linhas = null, lpos = null, lcor = null;
  if (temChuva) {
    lpos = new Float32Array(NM * 6); lcor = new Float32Array(NM * 6);
    const lg = guarda(new THREE.BufferGeometry()); lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(lcor, 3));
    linhas = new THREE.LineSegments(lg, guarda(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    linhas.frustumCulled = false; (ceu || raiz).add(linhas);
    for (let i = 0; i < NM; i++) meteoros.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), vida: -Math.random() * 6, cauda: 0 });
  }
  const claroes = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(guarda(new THREE.SpriteMaterial({ map: texFogo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))); s.visible = false; (ceu || raiz).add(s); claroes.push({ s, vida: 0 }); }
  let pcl = 0, tLonge = 0;

  // distancia de um ponto a uma parede (segmento), dando a volta no mapa
  const distParede = (px, pz, w) => {
    const ax = w.ax + embr(px - w.ax) - (px - w.ax), az = w.az + embr(pz - w.az) - (pz - w.az);   // a copia da parede mais perto
    const bx = ax + (w.bx - w.ax), bz = az + (w.bz - w.az), vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const u = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2));
    return { d: Math.hypot(px - ax - vx * u, pz - az - vz * u), qx: ax + vx * u, qz: az + vz * u };
  };

  return {
    colisores, paredes, abrigos, destrutiveis, temChuva, distParede,
    /** um tiro em p acertou algo daqui? (dano, raio de area); explodir(p, tam, cor) faz o efeito */
    testarTiro(p, dano, area, explodir, aoQuebrar) {
      let bateu = false;
      for (const d of destrutiveis) {
        if (!d.vivo) continue;
        const dist = Math.hypot(embr(d.pos.x - p.x), d.pos.y - p.y, embr(d.pos.z - p.z));
        if (dist < 1.3 || (area && dist < area)) {
          bateu = bateu || dist < 1.3;
          d.hp -= area && dist > 1.3 ? dano * (1 - dist / area) : dano; d.flash = 1;
          if (d.hp <= 0) quebrar(d, explodir, aoQuebrar);
        }
      }
      for (const c of colisores) if (Math.hypot(embr(p.x - c.x), embr(p.z - c.z)) < c.r && p.y < c.h) { explodir(p, 2, [.8, .7, .9]); return true; }
      for (const w of paredes) { if (p.y > w.h) continue; if (distParede(p.x, p.z, w).d < w.esp) { explodir(p, 1.6, [.8, .75, .7]); return true; } }
      for (const a of abrigos) if (a.teto && p.y > a.h && p.y < a.h + 1.4 && dentroRet(a, p.x, p.z, 0)) { explodir(p, 1.6, [.8, .75, .7]); return true; }
      return bateu;
    },
    /** abrigo (bunker, galpao, caverna) em que o ponto esta, ou null */
    dentroDe(x, z) {
      for (const a of abrigos) {
        if (a.tipo === 'caverna') { if (Math.hypot(embr(x - a.x), embr(z - a.z)) < a.raio) return a; }
        else if (dentroRet(a, x, z, .3)) return a;
      }
      return null;
    },
    atualizar(dt, t, camera, efeitos, quem) {
      anim.forEach((f) => f(t));
      // o que esta longe nao e desenhado (conta a copia mais perto do mapa)
      tLonge -= dt;
      if (tLonge <= 0) {
        tLonge = .4;
        const c = camera.position, alto = Math.max(0, c.y - 60);
        for (const L of longe) { const d = Math.hypot(embr(L.x - c.x), embr(L.z - c.z)); L.g.visible = (!L.d || L.d.vivo) && d < L.alcance + alto * 2.5; }
      }
      // teto some quando quem joga esta dentro
      for (const a of abrigos) if (a.teto) a.teto.visible = !(quem && quem.y < a.h + 2 && dentroRet(a, quem.x, quem.z, -.2));
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

  // ponto dentro do retangulo de um bunker/galpao (com folga)
  function dentroRet(a, x, z, folga) {
    const dx = embr(x - a.x), dz = embr(z - a.z), c = Math.cos(a.rot), s = Math.sin(a.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < a.w / 2 - folga && Math.abs(lz) < a.d / 2 - folga;
  }
  function quebrar(d, explodir, aoQuebrar) {
    d.vivo = false; d.g.visible = false;
    if (d.tipo === 'barril') {
      explodir(d.pos, 9, [1, .55, .2]); aoQuebrar?.('barril', d.pos);
      // reacao em cadeia: barris perto tambem explodem (um pouco depois)
      setTimeout(() => { for (const e of destrutiveis) if (e.vivo && e.pos.distanceTo(d.pos) < 9) { e.hp -= 3; e.flash = 1; if (e.hp <= 0) quebrar(e, explodir, aoQuebrar); } }, 140);
    } else { explodir(d.pos, 3, [.7, .6, .9]); aoQuebrar?.('caixa', d.pos); }
  }
}
