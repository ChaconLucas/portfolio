import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Cabine da nave (primeira pessoa pilotando, tecla V). Montada no espaco da
 * camera: frente = +z, +x = esquerda da tela (quem desenha gira 180 graus em y).
 *  - console moldado (capo curvo, painel central inclinado, consoles laterais)
 *    com fileiras de botoes acesos que piscam e frisos de neon;
 *  - tres telas vivas (navegacao, radar girando, arma/empuxo/escudo);
 *  - HUD holografico no vidro: mira, horizonte que inclina com a nave, escada
 *    de arfagem, fitas de velocidade e altitude e a bussola;
 *  - vidro em arcos curvos (tubos) com reflexo nas bordas e painel de teto;
 *  - manche (direita) e acelerador (esquerda) que se mexem com os comandos.
 *    Quem segura e o proprio astronauta: as maos vao por IK ate pegaManche /
 *    pegaAcel (ver astronauta.pilotar).
 * criarCabine(cor) -> { grupo, pegaManche, pegaAcel, atualizar(dt, estado) }
 * estado: { vira, sobe, empuxo, vel, alt, arma, escudo, banco, mira, rumo }
 */
export function criarCabine(cor = 0x9f7bff) {
  const g = new THREE.Group(); g.visible = false;
  const corC = new THREE.Color(cor), css = '#' + corC.getHexString();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2e2a3a, metalness: .6, roughness: .4, emissive: 0x120d1e });
  const metal2 = new THREE.MeshStandardMaterial({ color: 0x423c52, metalness: .5, roughness: .32, emissive: 0x1a1428 });
  const claro = new THREE.MeshStandardMaterial({ color: 0xd9d5e3, metalness: .2, roughness: .35 });
  const borracha = new THREE.MeshStandardMaterial({ color: 0x121017, roughness: .85 });
  const neon = new THREE.MeshBasicMaterial({ color: cor, toneMapped: false });
  const neonFraco = new THREE.MeshBasicMaterial({ color: corC.clone().multiplyScalar(.45), toneMapped: false });
  const caixa = (w, h, d, m, r = .01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m);
  const por = (o, x, y, z, rx = 0, ry = 0, rz = 0, pai = g) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); pai.add(o); return o; };
  const tubo = (pts, r, m, seg = 40) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 8), m); g.add(t); return t; };
  // perfil de lado (pontos [z, y]) extrudado na largura (x), centrado
  const perfil = (pts, larg, m) => {
    const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const geo = new THREE.ExtrudeGeometry(s, { depth: larg, bevelEnabled: true, bevelThickness: .008, bevelSize: .006, bevelSegments: 2, curveSegments: 8 });
    geo.rotateY(-Math.PI / 2); geo.translate(larg / 2, 0, 0); const k = new THREE.Mesh(geo, m); g.add(k); return k;
  };

  /* ---- console: capo curvo na frente, painel inclinado e consoles laterais ---- */
  // capo (o "nariz" por dentro): uma lombada que esconde a base do vidro
  perfil([[.62, -.33], [.78, -.24], [.98, -.2], [1.12, -.24], [1.12, -.5], [.62, -.5]], 1.5, metal);
  por(caixa(1.5, .008, .012, neon, .003), 0, -.205, .98);                                   // friso aceso no alto do capo
  // painel central inclinado (onde ficam as telas)
  const painel = new THREE.Group(); por(painel, 0, -.31, .7, -.7);
  por(caixa(1.0, .04, .3, metal2, .02), 0, 0, 0, 0, 0, 0, painel);
  por(caixa(1.02, .01, .012, neon, .003), 0, .02, .15, 0, 0, 0, painel);
  // consoles laterais (inclinados para dentro) com fileiras de botoes
  const lados = [];
  for (const lx of [-1, 1]) {
    const c = new THREE.Group(); por(c, lx * .56, -.36, .56, -.55, lx * .5, 0);
    por(caixa(.34, .05, .34, metal2, .02), 0, 0, 0, 0, 0, 0, c);
    por(caixa(.35, .008, .01, neonFraco, .003), 0, .026, .17, 0, 0, 0, c);
    lados.push(c);
    // parede lateral e parapeito com friso
    por(caixa(.06, .32, 1.2, metal, .02), lx * .78, -.42, .4);
    por(caixa(.01, .01, 1.15, neon, .003), lx * .748, -.27, .4);
  }
  // botoes (instanciados): fileiras nos consoles laterais e embaixo das telas
  const NB = 64, botoes = new THREE.InstancedMesh(new RoundedBoxGeometry(.022, .01, .016, 1, .003), new THREE.MeshBasicMaterial({ toneMapped: false }), NB);
  const coresB = [new THREE.Color(cor), new THREE.Color(0x4fd2ff), new THREE.Color(0xffb347), new THREE.Color(0x58f0a0), new THREE.Color(0xff4f6a)];
  const baseB = [], _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  {
    let i = 0;
    for (const [k, c] of lados.entries()) {
      c.updateMatrix();
      for (let r = 0; r < 4; r++) for (let q = 0; q < 6 && i < NB; q++, i++) {
        _p.set(-.12 + q * .048, .03, -.1 + r * .05).applyMatrix4(c.matrix);
        _q.setFromRotationMatrix(c.matrix);
        _m4.compose(_p, _q, _s); botoes.setMatrixAt(i, _m4);
        baseB.push(coresB[(k * 7 + r * 3 + q) % coresB.length].clone().multiplyScalar(.35 + ((r + q) % 3) * .25));
      }
    }
    painel.updateMatrix();
    for (let q = 0; i < NB; q++, i++) {
      _p.set(-.36 + (q % 16) * .048, .028, -.11 + Math.floor(q / 16) * .035).applyMatrix4(painel.matrix);
      _q.setFromRotationMatrix(painel.matrix); _m4.compose(_p, _q, _s); botoes.setMatrixAt(i, _m4);
      baseB.push(coresB[q % coresB.length].clone().multiplyScalar(.5));
    }
    for (let k = 0; k < NB; k++) botoes.setColorAt(k, baseB[k]);
  }
  g.add(botoes);

  // telas: canvas atualizados de tempos em tempos (no painel inclinado)
  const telas = [];
  const tela = (x, ry, w, h) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const moldura = por(caixa(w + .022, .014, h + .022, borracha, .005), x, .026, .02, 0, ry, 0, painel);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; m.position.y = .008; moldura.add(m);
    telas.push({ c, x: c.getContext('2d'), tx }); return telas[telas.length - 1];
  };
  const tVel = tela(.32, .12, .2, .13), tRadar = tela(0, 0, .17, .14), tArma = tela(-.32, -.12, .2, .13);

  /* ---- vidro: arcos curvos, espinha, teto e o reflexo ---- */
  for (const lx of [-1, 1]) {
    tubo([[lx * .74, -.3, .85], [lx * .7, .1, 1.0], [lx * .55, .5, .95], [lx * .3, .72, .7], [lx * .1, .8, .35]], .025, metal);
    tubo([[lx * .72, -.28, .83], [lx * .68, .1, .98], [lx * .53, .49, .93], [lx * .29, .7, .68], [lx * .1, .78, .33]], .006, neon);
    tubo([[lx * .8, -.25, .2], [lx * .78, .15, .25], [lx * .62, .55, .2], [lx * .35, .78, .1]], .02, metal);   // arco de tras (lateral)
  }
  tubo([[-.6, .58, .9], [-.3, .72, .98], [0, .76, 1.0], [.3, .72, .98], [.6, .58, .9]], .022, metal);            // arco da frente
  tubo([[0, .76, 1.0], [0, .84, .6], [0, .86, .25]], .014, metal2);                                            // espinha
  // painel de teto (so a borda aparece) com luzinhas
  por(caixa(.5, .04, .3, metal, .015), 0, .86, .12);
  for (let k = 0; k < 6; k++) por(caixa(.018, .006, .012, k % 2 ? neon : neonFraco, .002), -.12 + k * .048, .838, .25);
  // vidro: reflexo nas bordas e faixas diagonais bem leves
  const vidro = new THREE.Mesh(new THREE.SphereGeometry(1.2, 40, 20, Math.PI * .6, Math.PI * .8, Math.PI * .16, Math.PI * .52),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, uniforms: { uCor: { value: corC } },
      vertexShader: 'varying vec3 vN, vV, vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform vec3 uCor; varying vec3 vN, vV, vP; void main(){
        float f = pow(1. - abs(dot(vN, vV)), 3.);
        float faixa = smoothstep(.06, 0., abs(fract((vP.x + vP.y) * .9) - .5) - .38) * .05;
        float a = f * .3 + faixa;
        gl_FragColor = vec4(mix(uCor, vec3(1.), .55) * a, a); }`
    }));
  vidro.position.set(0, -.1, .1); g.add(vidro);

  /* ---- HUD holografico no vidro ---- */
  const hudC = document.createElement('canvas'); hudC.width = 512; hudC.height = 320; const hx = hudC.getContext('2d');
  const hudT = new THREE.CanvasTexture(hudC);
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(.78, .49), new THREE.MeshBasicMaterial({ map: hudT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  por(hud, 0, .1, 1.05, 0, Math.PI, 0);
  function desenharHud(e) {
    const W = 512, H = 320, cx = W / 2, cy = H / 2;
    hx.clearRect(0, 0, W, H);
    hx.strokeStyle = 'rgba(140,240,255,.85)'; hx.fillStyle = 'rgba(140,240,255,.85)'; hx.lineWidth = 2; hx.font = '600 13px ui-monospace, Menlo, monospace';
    // horizonte e escada de arfagem (inclinam com a nave)
    hx.save(); hx.beginPath(); hx.rect(90, 30, W - 180, H - 60); hx.clip();
    hx.translate(cx, cy); hx.rotate(-(e.banco || 0)); hx.translate(0, (e.mira || 0) * 260);
    for (let k = -4; k <= 4; k++) {
      const y = -k * 45, larg = k === 0 ? 150 : 50;
      hx.globalAlpha = k === 0 ? .9 : .55;
      hx.beginPath(); hx.moveTo(-larg, y); hx.lineTo(-22, y); hx.moveTo(22, y); hx.lineTo(larg, y); hx.stroke();
      if (k) { hx.fillText(String(k * 10), larg + 6, y + 4); hx.fillText(String(k * 10), -larg - 24, y + 4); }
    }
    hx.restore(); hx.globalAlpha = 1;
    // mira fixa
    hx.beginPath(); hx.arc(cx, cy, 14, 0, 6.3); hx.stroke();
    hx.beginPath(); hx.moveTo(cx - 34, cy); hx.lineTo(cx - 18, cy); hx.moveTo(cx + 18, cy); hx.lineTo(cx + 34, cy); hx.moveTo(cx, cy + 18); hx.lineTo(cx, cy + 30); hx.stroke();
    // fitas: velocidade (esq) e altitude (dir)
    const fita = (x, valor, passo, rot) => {
      hx.strokeRect(x - 30, 60, 60, H - 120);
      for (let k = -4; k <= 4; k++) { const v = Math.round(valor / passo) * passo + k * passo, y = cy - (v - valor) / passo * 22; if (y < 64 || y > H - 64) continue; hx.beginPath(); hx.moveTo(x - 30, y); hx.lineTo(x - 20, y); hx.stroke(); hx.fillText(String(Math.max(0, v)), x - 16, y + 4); }
      hx.fillRect(x - 34, cy - 11, 68, 22); hx.fillStyle = '#0a0612'; hx.fillText(String(Math.round(valor)), x - 24, cy + 5); hx.fillStyle = 'rgba(140,240,255,.85)';
      hx.fillText(rot, x - 22, 52);
    };
    fita(50, (e.vel || 0) * 3.6, 50, 'km/h');
    fita(W - 50, e.alt != null ? e.alt : 0, 100, e.alt != null ? 'ALT' : '—');
    // bussola em cima
    const rumo = ((e.rumo || 0) * 180 / Math.PI % 360 + 360) % 360;
    for (let k = -3; k <= 3; k++) { const v = Math.round(rumo / 15) * 15 + k * 15, x = cx + (v - rumo) * 3.2; hx.beginPath(); hx.moveTo(x, 22); hx.lineTo(x, v % 45 ? 28 : 32); hx.stroke(); if (v % 45 === 0) hx.fillText(['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][((v / 45) % 8 + 8) % 8], x - 6, 16); }
    hudT.needsUpdate = true;
  }

  /* ---- manche (direita) e acelerador (esquerda) ---- */
  const manche = new THREE.Group(); por(manche, -.17, -.38, .55);
  por(new THREE.Mesh(new THREE.CylinderGeometry(.05, .065, .045, 18), metal2), 0, 0, 0, 0, 0, 0, manche);
  por(new THREE.Mesh(new THREE.TorusGeometry(.055, .006, 6, 24), neonFraco), 0, .024, 0, Math.PI / 2, 0, 0, manche);
  const haste = new THREE.Group(); manche.add(haste);
  por(new THREE.Mesh(new THREE.CylinderGeometry(.012, .015, .14, 12), claro), 0, .07, 0, 0, 0, 0, haste);
  por(caixa(.045, .1, .05, borracha, .015), 0, .17, 0, 0, 0, 0, haste);
  por(caixa(.012, .012, .012, neon, .004), 0, .225, .012, 0, 0, 0, haste);
  const pegaManche = new THREE.Object3D(); pegaManche.position.set(0, .17, 0); haste.add(pegaManche);   // o meio do punho fica no centro do cabo do manche

  const acel = new THREE.Group(); por(acel, .2, -.38, .5);
  por(caixa(.05, .03, .2, metal2, .01), 0, 0, 0, 0, 0, 0, acel);
  por(caixa(.008, .008, .18, neon, .003), 0, .017, 0, 0, 0, 0, acel);
  const alavanca = new THREE.Group(); acel.add(alavanca);
  por(caixa(.03, .09, .03, claro, .01), 0, .05, 0, 0, 0, 0, alavanca);
  por(caixa(.07, .04, .05, borracha, .015), 0, .1, 0, 0, 0, 0, alavanca);
  const pegaAcel = new THREE.Object3D(); pegaAcel.position.set(0, .1, 0); alavanca.add(pegaAcel);   // centro da manopla do acelerador

  /* ---- telas ---- */
  let telaT = 0, hudT0 = 0, radarA = 0, piscaT = 0;
  function fundo(x, w, h, titulo) {
    x.fillStyle = '#07060c'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(159,123,255,.18)'; x.lineWidth = 1;
    for (let i = 0; i < w; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
    for (let i = 0; i < h; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
    x.fillStyle = css; x.font = '700 14px ui-monospace, Menlo, monospace'; x.fillText(titulo, 10, 20);
  }
  function desenharTelas(e) {
    { const { c, x } = tVel; fundo(x, c.width, c.height, 'NAV');
      x.fillStyle = '#fff'; x.font = '700 40px ui-monospace, Menlo, monospace'; x.fillText(String(Math.round(e.vel * 3.6)), 12, 72);
      x.fillStyle = 'rgba(230,226,255,.6)'; x.font = '600 13px ui-monospace, Menlo, monospace'; x.fillText('km/h', 14, 92);
      x.fillText(e.alt != null ? `ALT ${Math.round(e.alt)} m` : 'ESPAÇO', 14, 140);
      x.fillStyle = css; x.fillRect(150, 150 - 110 * Math.min(1, e.vel / 300), 14, 110 * Math.min(1, e.vel / 300)); x.strokeStyle = '#fff3'; x.strokeRect(150, 40, 14, 110); }
    { const { c, x } = tRadar, w = c.width, h = c.height, cx = w / 2, cy = h / 2 + 8, r = Math.min(w, h) * .4; fundo(x, w, h, 'RADAR');
      x.strokeStyle = css; x.globalAlpha = .6; for (const k of [1, .66, .33]) { x.beginPath(); x.arc(cx, cy, r * k, 0, 6.3); x.stroke(); } x.globalAlpha = 1;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, css + 'aa'); gr.addColorStop(1, css + '00');
      x.fillStyle = gr; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, radarA - .6, radarA); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 3, 0, 6.3); x.fill(); }
    { const { c, x } = tArma; fundo(x, c.width, c.height, 'ARMA');
      x.fillStyle = '#fff'; x.font = '700 18px ui-monospace, Menlo, monospace'; x.fillText((e.arma || '').toUpperCase().slice(0, 16), 12, 52);
      x.fillStyle = 'rgba(230,226,255,.6)'; x.font = '600 13px ui-monospace, Menlo, monospace'; x.fillText('EMPUXO', 12, 92); x.fillText(e.escudo ? 'ESCUDO ATIVO' : 'ESCUDO PRONTO', 12, 150);
      x.strokeStyle = '#fff3'; x.strokeRect(12, 100, 220, 14); x.fillStyle = css; x.fillRect(12, 100, 220 * Math.min(1, e.empuxo), 14); }
    for (const t of telas) t.tx.needsUpdate = true;
  }

  let vira = 0, sobe = 0, emp = 0;
  const _cor = new THREE.Color();
  return {
    grupo: g, pegaManche, pegaAcel,
    atualizar(dt, e) {
      const k = 1 - Math.exp(-dt * 10);
      vira += ((e.vira || 0) - vira) * k; sobe += ((e.sobe || 0) - sobe) * k; emp += ((e.empuxo || 0) - emp) * k;
      // manche: inclina para o lado da curva (e para a frente/tras com a subida)
      haste.rotation.z = -vira * .45; haste.rotation.x = -sobe * .35;
      alavanca.position.z = -.07 + emp * .14; alavanca.rotation.x = -.3 + emp * .6;
      neon.color.copy(corC).multiplyScalar(.8 + emp * .5);
      radarA += dt * 3;
      // botoes: alguns piscam
      piscaT -= dt; if (piscaT <= 0) { piscaT = .18; for (let n = 0; n < 6; n++) { const i = Math.floor(Math.random() * NB); botoes.setColorAt(i, _cor.copy(baseB[i]).multiplyScalar(Math.random() < .5 ? .25 : 2.2)); } botoes.instanceColor.needsUpdate = true; }
      telaT -= dt; if (telaT <= 0) { telaT = .12; desenharTelas(e); }
      hudT0 -= dt; if (hudT0 <= 0) { hudT0 = .033; desenharHud(e); }
    }
  };
}
