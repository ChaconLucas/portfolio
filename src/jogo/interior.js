import * as THREE from 'three';

/**
 * Interior de um predio da stack: um salao redondo (raio 16) com chao de grade
 * de neon, paredes com "codigo" correndo, e no meio um pedestal com o emblema
 * holografico da tecnologia girando dentro de um icosaedro de arame e
 * particulas subindo. Em volta, quatro paineis holograficos:
 *   NIVEL (com barra), O QUE E, NA AREA e USADO EM (projetos).
 * Na frente do painel de projetos fica um terminal (E abre os links); a
 * porta por onde se entrou fica atras (E sai).
 * So materiais basicos/emissivos: nao acrescenta luz na cena (os shaders da
 * superficie nao precisam recompilar).
 */
export const RAIO_SALA = 16;

function quebrarTexto(c, txt, larg) {
  const palavras = String(txt || '').split(/\s+/), linhas = []; let l = '';
  for (const p of palavras) { const t = l ? l + ' ' + p : p; if (c.measureText(t).width > larg && l) { linhas.push(l); l = p; } else l = t; }
  if (l) linhas.push(l); return linhas;
}
function painel(titulo, desenhar, cor, guarda) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 460; const c = cv.getContext('2d');
  c.fillStyle = 'rgba(10,8,22,.82)'; c.fillRect(0, 0, 768, 460);
  c.strokeStyle = cor; c.lineWidth = 4; c.strokeRect(6, 6, 756, 448);
  c.globalAlpha = .35; c.lineWidth = 1; for (let y = 20; y < 460; y += 6) { c.beginPath(); c.moveTo(8, y); c.lineTo(760, y); c.stroke(); } c.globalAlpha = 1;
  c.fillStyle = cor; c.fillRect(6, 6, 756, 56);
  c.fillStyle = '#0b0714'; c.font = '900 30px ui-monospace, Menlo, monospace'; c.textBaseline = 'middle'; c.fillText(titulo, 26, 35);
  desenhar(c);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; guarda(t);
  const m = new THREE.Mesh(guarda(new THREE.PlaneGeometry(6.4, 3.83)), guarda(new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: .92, side: THREE.DoubleSide, depthWrite: false })));
  return m;
}
function texGrade(cor) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 512, 512);
  const g = c.createRadialGradient(256, 256, 0, 256, 256, 256); g.addColorStop(0, cor); g.addColorStop(.25, 'rgba(0,0,0,0)'); c.globalAlpha = .55; c.fillStyle = g; c.fillRect(0, 0, 512, 512); c.globalAlpha = 1;
  c.strokeStyle = cor; c.lineWidth = 2;
  for (let k = 0; k <= 512; k += 32) { c.globalAlpha = k % 128 === 0 ? .9 : .35; c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 512); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(512, k); c.stroke(); }
  c.globalAlpha = 1;
  for (let r = 60; r < 256; r += 64) { c.beginPath(); c.arc(256, 256, r, 0, Math.PI * 2); c.globalAlpha = .5; c.stroke(); }
  return new THREE.CanvasTexture(cv);
}
function texCodigo(cor, nome) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 512);
  c.font = '500 18px ui-monospace, Menlo, monospace'; c.fillStyle = cor;
  const linhas = ['import', 'const', 'async', 'return', 'export', 'await', '=>', '{ }', 'deploy', 'build', 'test', 'commit', nome, nome.toLowerCase(), 'function', 'class', 'type', 'query', 'render', 'fetch'];
  let s = nome.length * 13 + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 18; y < 512; y += 22) {
    let x = 10 + Math.floor(r() * 4) * 24;
    while (x < 1000) { const w = linhas[Math.floor(r() * linhas.length)]; c.globalAlpha = .25 + r() * .6; c.fillText(w, x, y); x += c.measureText(w).width + 14 + r() * 30; if (r() < .15) break; }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
}

export function criarInterior(tec, info) {
  const lixo = []; const guarda = (o) => { lixo.push(o); return o; };
  const cor = info.cor, corC = new THREE.Color(cor);
  const g = new THREE.Group();
  const R = RAIO_SALA, ALT = 9;
  // chao
  const tg = guarda(texGrade(cor));
  const chao = new THREE.Mesh(guarda(new THREE.CircleGeometry(R, 64)), guarda(new THREE.MeshStandardMaterial({ color: 0x0b0914, roughness: .35, metalness: .7, emissive: 0xffffff, emissiveMap: tg, emissiveIntensity: .9 })));
  chao.rotation.x = -Math.PI / 2; g.add(chao);
  // paredes com codigo correndo
  const tc = guarda(texCodigo(cor, tec.nome));
  const parede = new THREE.Mesh(guarda(new THREE.CylinderGeometry(R, R, ALT, 64, 1, true)), guarda(new THREE.MeshStandardMaterial({ color: 0x0d0a18, roughness: .6, metalness: .5, side: THREE.BackSide, emissive: 0xffffff, emissiveMap: tc, emissiveIntensity: .55 })));
  parede.position.y = ALT / 2; g.add(parede);
  const neon = guarda(new THREE.MeshBasicMaterial({ color: corC }));
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < .25) continue;   // nao na porta
    const f = new THREE.Mesh(guarda(new THREE.BoxGeometry(.12, ALT - .6, .12)), neon); f.position.set(Math.cos(a) * (R - .1), ALT / 2, Math.sin(a) * (R - .1)); g.add(f);
  }
  [0.15, ALT - .15].forEach((y) => { const anel = new THREE.Mesh(guarda(new THREE.TorusGeometry(R - .15, .07, 6, 96)), neon); anel.rotation.x = Math.PI / 2; anel.position.y = y; g.add(anel); });
  // teto com anel de luz
  const teto = new THREE.Mesh(guarda(new THREE.CircleGeometry(R, 64)), guarda(new THREE.MeshStandardMaterial({ color: 0x07060d, roughness: .8, side: THREE.DoubleSide })));
  teto.rotation.x = Math.PI / 2; teto.position.y = ALT; g.add(teto);
  const anelTeto = new THREE.Mesh(guarda(new THREE.TorusGeometry(5, .2, 8, 64)), neon); anelTeto.rotation.x = Math.PI / 2; anelTeto.position.y = ALT - .3; g.add(anelTeto);

  // centro: pedestal, cone de luz, emblema e icosaedro de arame
  const ped = new THREE.Mesh(guarda(new THREE.CylinderGeometry(2.4, 2.8, .8, 40)), guarda(new THREE.MeshStandardMaterial({ color: 0x1a1626, metalness: .7, roughness: .3 })));
  ped.position.y = .4; g.add(ped);
  const anelPed = new THREE.Mesh(guarda(new THREE.TorusGeometry(2.45, .08, 6, 64)), neon); anelPed.rotation.x = Math.PI / 2; anelPed.position.y = .82; g.add(anelPed);
  const cone = new THREE.Mesh(guarda(new THREE.CylinderGeometry(2.6, 2.2, 7, 40, 1, true)), guarda(new THREE.MeshBasicMaterial({ color: corC, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  cone.position.y = 4.3; g.add(cone);
  const emb = info.emblema; emb.scale.setScalar(4.6); emb.position.y = 4.4; g.add(emb);
  const ico = new THREE.Mesh(guarda(new THREE.IcosahedronGeometry(3, 1)), guarda(new THREE.MeshBasicMaterial({ color: corC, wireframe: true, transparent: true, opacity: .55 })));
  ico.position.y = 4.4; g.add(ico);
  // particulas subindo do pedestal
  const NP = 140, pp = new Float32Array(NP * 3), vel = new Float32Array(NP);
  for (let i = 0; i < NP; i++) { const a = Math.random() * 6.28, d = Math.random() * 2.2; pp[i * 3] = Math.cos(a) * d; pp[i * 3 + 1] = Math.random() * 8; pp[i * 3 + 2] = Math.sin(a) * d; vel[i] = .6 + Math.random() * 1.4; }
  const gpp = guarda(new THREE.BufferGeometry()); gpp.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const part = new THREE.Points(gpp, guarda(new THREE.PointsMaterial({ color: corC, size: .12, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })));
  g.add(part);

  // paineis holograficos em arco, de frente para o centro
  const pct = tec.nivel === 'Primary' || tec.nivel === 'Core' ? 1 : tec.nivel === 'Professional' ? .8 : tec.nivel === 'Familiar' ? .55 : .7;
  const paineis = [
    ['NÍVEL', (c) => {
      c.fillStyle = '#fff'; c.font = '900 64px ui-monospace, Menlo, monospace'; c.fillText(tec.nome.length > 16 ? tec.nome.slice(0, 15) + '…' : tec.nome, 30, 140);
      c.fillStyle = cor; c.font = '800 40px ui-monospace, Menlo, monospace'; c.fillText(String(tec.nivel || '').toUpperCase(), 30, 220);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(30, 280, 708, 40); c.fillStyle = cor; c.fillRect(30, 280, 708 * pct, 40);
      c.fillStyle = 'rgba(228,220,255,.7)'; c.font = '500 26px ui-monospace, Menlo, monospace'; c.fillText(`domínio ${Math.round(pct * 100)}%`, 30, 370);
    }],
    ['O QUE É', (c) => {
      c.fillStyle = '#fff'; c.font = '600 32px ui-monospace, Menlo, monospace';
      quebrarTexto(c, tec.desc || `${tec.nome} na stack de ${info.area.titulo}.`, 700).slice(0, 8).forEach((l, i) => c.fillText(l, 30, 110 + i * 44));
    }],
    ['NA ÁREA · ' + String(info.area.titulo || '').toUpperCase(), (c) => {
      c.fillStyle = 'rgba(240,235,255,.92)'; c.font = '500 28px ui-monospace, Menlo, monospace';
      quebrarTexto(c, info.area.desc || '', 700).slice(0, 9).forEach((l, i) => c.fillText(l, 30, 108 + i * 38));
    }],
    ['USADO EM', (c) => {
      const ps = info.projetos.length ? info.projetos : [info.area.usado || '—'];
      ps.slice(0, 5).forEach((p, i) => { c.fillStyle = cor; c.fillRect(30, 96 + i * 62, 10, 40); c.fillStyle = '#fff'; c.font = '800 36px ui-monospace, Menlo, monospace'; c.fillText(String(p).slice(0, 30), 56, 118 + i * 62); });
      c.fillStyle = 'rgba(228,220,255,.7)'; c.font = '600 24px ui-monospace, Menlo, monospace'; c.fillText('▼ terminal: E para abrir os projetos', 30, 430);
    }]
  ];
  const ANG = [0, 1, 2, 3].map((i) => -Math.PI / 2 + (i - 1.5) * .62);   // do lado oposto a porta, olhando para o centro
  const holo = paineis.map(([tit, f], i) => {
    const m = painel(tit, f, cor, guarda); const a = ANG[i];
    m.position.set(Math.cos(a) * 11, 3.6, Math.sin(a) * 11); m.lookAt(0, 3.6, 0); g.add(m);
    return m;
  });
  // terminal na frente do painel de projetos
  const aT = ANG[3];
  const terminal = new THREE.Group(); terminal.position.set(Math.cos(aT) * 8.4, 0, Math.sin(aT) * 8.4); terminal.lookAt(0, 0, 0); g.add(terminal);
  const base = new THREE.Mesh(guarda(new THREE.BoxGeometry(1.6, 1.1, .8)), guarda(new THREE.MeshStandardMaterial({ color: 0x1a1626, metalness: .6, roughness: .35 }))); base.position.y = .55; terminal.add(base);
  const tela = new THREE.Mesh(guarda(new THREE.PlaneGeometry(1.4, .8)), guarda(new THREE.MeshBasicMaterial({ color: corC }))); tela.position.set(0, 1.35, .1); tela.rotation.x = -.5; terminal.add(tela);
  const marcaT = new THREE.Mesh(guarda(new THREE.RingGeometry(1, 1.25, 32)), neon); marcaT.rotation.x = -Math.PI / 2; marcaT.position.set(0, .03, 1.4); terminal.add(marcaT);
  // porta de saida (portal) do lado de quem entrou (+z)
  const portal = new THREE.Mesh(guarda(new THREE.PlaneGeometry(3.4, 5.2)), guarda(new THREE.MeshBasicMaterial({ color: corC, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  portal.position.set(0, 2.6, R - .3); g.add(portal);
  const moldura = new THREE.Mesh(guarda(new THREE.TorusGeometry(2.4, .12, 6, 40, Math.PI)), neon); moldura.position.set(0, 2.6 + .2, R - .32); moldura.scale.set(.75, 1.15, 1); g.add(moldura);
  const marcaP = new THREE.Mesh(guarda(new THREE.RingGeometry(1.2, 1.5, 32)), neon); marcaP.rotation.x = -Math.PI / 2; marcaP.position.set(0, .03, R - 2.4); g.add(marcaP);

  return {
    grupo: g, raio: R - 1.2, altura: ALT,
    entrada: new THREE.Vector3(0, 0, R - 3.2),           // onde o astronauta aparece (olhando para o centro, -z)
    porta: new THREE.Vector3(0, 0, R - 2.4),
    terminal: new THREE.Vector3(0, 0, 1.4).applyQuaternion(terminal.quaternion).add(terminal.position),
    obstaculos: [{ x: 0, z: 0, r: 3.1 }, { x: terminal.position.x, z: terminal.position.z, r: 1.1 }],
    atualizar(dt, t) {
      ico.rotation.y = t * .4; ico.rotation.x = t * .23; emb.position.y = 4.4 + Math.sin(t * 1.3) * .25;
      cone.material.opacity = .1 + Math.sin(t * 2) * .03; portal.material.opacity = .45 + Math.sin(t * 3) * .12;
      tc.offset.y = (t * .04) % 1; tg.rotation = t * .02; tg.center.set(.5, .5);
      holo.forEach((m, i) => { m.position.y = 3.6 + Math.sin(t * 1.1 + i) * .08; m.material.opacity = .86 + Math.sin(t * 7 + i * 3) * .04; });
      tela.material.color.setHSL(corC.getHSL({}).h, .9, .45 + Math.sin(t * 4) * .1);
      for (let i = 0; i < NP; i++) { pp[i * 3 + 1] += vel[i] * dt; if (pp[i * 3 + 1] > 8.5) pp[i * 3 + 1] = .8; }
      gpp.attributes.position.needsUpdate = true;
    },
    destruir() { g.parent?.remove(g); lixo.forEach((o) => o.dispose && o.dispose()); }
  };
}
