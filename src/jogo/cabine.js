import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { criarLuva } from './armas3d.js';

/**
 * Cabine da nave (primeira pessoa pilotando, tecla V na nave). Montada no
 * espaco da camera, como a arma da primeira pessoa: frente = +z, +x = esquerda
 * da tela (o grupo e girado 180 graus em y por quem desenha).
 *  - moldura do vidro (colunas, arco de cima e o friso aceso);
 *  - painel inclinado com tres telas vivas (velocidade e altitude, radar
 *    girando, arma e empuxo);
 *  - manche na direita (inclina com a curva e a subida) e acelerador na
 *    esquerda (anda com o empuxo), com as duas luvas segurando.
 * criarCabine(cor) -> { grupo, atualizar(dt, estado) }
 * estado: { vira, sobe, empuxo, vel, alt, arma, escudo, t }
 */
export function criarCabine(cor = 0x9f7bff) {
  const g = new THREE.Group(); g.visible = false;
  const metal = new THREE.MeshStandardMaterial({ color: 0x24212c, metalness: .7, roughness: .38 });
  const claro = new THREE.MeshStandardMaterial({ color: 0xd9d5e3, metalness: .2, roughness: .35 });
  const borracha = new THREE.MeshStandardMaterial({ color: 0x141218, roughness: .85 });
  const neon = new THREE.MeshBasicMaterial({ color: cor, toneMapped: false });
  const caixa = (w, h, d, m, r = .01) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m);
  const por = (o, x, y, z, rx = 0, ry = 0, rz = 0, pai = g) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); pai.add(o); return o; };

  /* ---- painel: uma lamina inclinada para quem pilota, com a borda acesa ---- */
  const painel = new THREE.Group(); por(painel, 0, -.42, .7, -.5);
  por(caixa(1.5, .05, .42, metal, .02), 0, 0, 0, 0, 0, 0, painel);
  por(caixa(1.52, .012, .02, neon, .004), 0, .025, .21, 0, 0, 0, painel);         // borda de cima, acesa
  por(caixa(1.5, .14, .05, claro, .02), 0, -.07, .2, 0, 0, 0, painel);            // capo da frente
  // telas: canvas atualizados de tempos em tempos
  const telas = [];
  const tela = (x, ry, w, h) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const moldura = por(caixa(w + .02, .012, h + .02, borracha, .004), x, .027, -.01, 0, ry, 0, painel);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI; m.position.y = .007; moldura.add(m);   // virada para cima, legivel de quem senta
    telas.push({ c, x: c.getContext('2d'), tx }); return telas[telas.length - 1];
  };
  const tVel = tela(.4, .16, .2, .13), tRadar = tela(0, 0, .16, .13), tArma = tela(-.4, -.16, .2, .13);

  /* ---- moldura do vidro ---- */
  for (const lx of [-1, 1]) {
    const col = por(caixa(.045, 1.25, .05, metal, .02), lx * .64, .1, .95, .25, 0, lx * .32);
    por(caixa(.012, 1.2, .012, neon, .004), lx * -.028, 0, -.026, 0, 0, 0, col);
    por(caixa(.08, .06, 1.1, metal, .02), lx * .74, -.32, .35, 0, 0, 0);              // parapeito lateral
    por(caixa(.012, .012, 1.05, neon, .004), lx * .71, -.285, .35, 0, 0, 0);
  }
  por(caixa(1.0, .05, .07, metal, .02), 0, .64, 1.08, .3, 0, 0);                        // arco de cima
  por(caixa(.014, .014, .5, metal, .004), 0, .6, .88, -.7, 0, 0);                    // espinha do vidro
  // vidro: so um reflexo leve nas bordas
  const vidro = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16, Math.PI * .62, Math.PI * .76, Math.PI * .18, Math.PI * .5),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, uniforms: { uCor: { value: new THREE.Color(cor) } },
      vertexShader: 'varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCor; varying vec3 vN, vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 3.); gl_FragColor = vec4(mix(uCor, vec3(1.), .5) * f * .35, f * .35); }'
    }));
  vidro.position.set(0, -.1, .1); g.add(vidro);

  /* ---- manche (direita) e acelerador (esquerda) com as luvas ---- */
  const manche = new THREE.Group(); por(manche, -.21, -.4, .6);
  por(new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, .04, 16), metal), 0, 0, 0, 0, 0, 0, manche);
  const haste = new THREE.Group(); manche.add(haste);
  por(new THREE.Mesh(new THREE.CylinderGeometry(.012, .014, .14, 10), claro), 0, .07, 0, 0, 0, 0, haste);
  por(caixa(.045, .1, .05, borracha, .015), 0, .17, 0, 0, 0, 0, haste);
  por(caixa(.012, .012, .012, neon, .004), 0, .225, .012, 0, 0, 0, haste);           // gatilho aceso
  const luvaD = criarLuva(false); luvaD.scale.setScalar(.9); por(luvaD, 0, .175, -.012, -.55, 0, 0, haste);

  const acel = new THREE.Group(); por(acel, .24, -.4, .58);
  por(caixa(.05, .03, .2, metal, .01), 0, 0, 0, 0, 0, 0, acel);
  por(caixa(.008, .008, .18, neon, .003), 0, .017, 0, 0, 0, 0, acel);
  const alavanca = new THREE.Group(); acel.add(alavanca);
  por(caixa(.03, .09, .03, claro, .01), 0, .05, 0, 0, 0, 0, alavanca);
  por(caixa(.07, .04, .05, borracha, .015), 0, .1, 0, 0, 0, 0, alavanca);
  const luvaE = criarLuva(true); luvaE.scale.setScalar(.9); por(luvaE, .0, .125, -.02, -.5, 0, .25, alavanca);

  /* ---- telas ---- */
  const css = '#' + new THREE.Color(cor).getHexString();
  let telaT = 0, radarA = 0;
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
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 3, 0, 6.3); x.fill();
      for (const p of e.pontos || []) { x.fillStyle = p.cor || '#ffd166'; x.beginPath(); x.arc(cx + p.x * r, cy + p.y * r, 3, 0, 6.3); x.fill(); } }
    { const { c, x } = tArma; fundo(x, c.width, c.height, 'ARMA');
      x.fillStyle = '#fff'; x.font = '700 18px ui-monospace, Menlo, monospace'; x.fillText((e.arma || '').toUpperCase().slice(0, 16), 12, 52);
      x.fillStyle = 'rgba(230,226,255,.6)'; x.font = '600 13px ui-monospace, Menlo, monospace'; x.fillText('EMPUXO', 12, 92); x.fillText(e.escudo ? 'ESCUDO ATIVO' : 'ESCUDO PRONTO', 12, 150);
      x.strokeStyle = '#fff3'; x.strokeRect(12, 100, 220, 14); x.fillStyle = css; x.fillRect(12, 100, 220 * Math.min(1, e.empuxo), 14); }
    for (const t of telas) t.tx.needsUpdate = true;
  }

  let vira = 0, sobe = 0, emp = 0;
  return {
    grupo: g,
    atualizar(dt, e) {
      const k = 1 - Math.exp(-dt * 10);
      vira += ((e.vira || 0) - vira) * k; sobe += ((e.sobe || 0) - sobe) * k; emp += ((e.empuxo || 0) - emp) * k;
      // manche: inclina para o lado da curva (e para a frente/tras com a subida)
      haste.rotation.z = -vira * .45; haste.rotation.x = -sobe * .35;
      alavanca.position.z = -.07 + emp * .14; alavanca.rotation.x = -.3 + emp * .6;
      neon.color.setHex(cor).multiplyScalar(.8 + emp * .5);
      radarA += dt * 3;
      telaT -= dt; if (telaT <= 0) { telaT = .12; desenharTelas(e); }
    }
  };
}
