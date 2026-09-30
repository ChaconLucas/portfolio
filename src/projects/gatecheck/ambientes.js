import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { criarFila } from './fila.js';

/**
 * Ambientes da cena da estacao de trabalho (a mesma cena serve ao GateCheck e
 * ao Rare7). Antes era a mesa num vazio escuro com um painel atras.
 *
 *  - balada (GateCheck: venda de ingresso e check-in na porta de balada e
 *    evento): a mesa vira o caixa do check-in. Atras dela, a porta da balada
 *    com luz vazando e feixes, neon GATE, catracas com leitor de QR, corda de
 *    veludo com pedestais, fila com ingresso no celular e os cartazes dos
 *    eventos do proprio app;
 *  - estadio (Rare7: loja de camisa de futebol): a mesa atras do gol de um
 *    estadio a noite, com gramado, arquibancadas, refletores e as placas de
 *    LED da RARE7 (ver criarEstadioRare).
 *
 * A camera sai de (2; 1,7; 1,7) olhando para -x -z. Na parede do fundo
 * (z -2,7) o centro do quadro cai em x ~ -3 e a borda direita em x ~ 0; a
 * coluna de texto cobre x < -4,3. Por isso tudo que precisa ser visto fica
 * entre x -4,3 e 0 (medido com o angulo de cada ponto em relacao a camera).
 * Cada um devolve { raiz, atualizar(t), destruir() }.
 */

const caixa = (l, a, p, r = .015) => new RoundedBoxGeometry(l, a, p, 3, r);
function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function tex(w, h, desenhar) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const redesenhar = () => { c.clearRect(0, 0, w, h); desenhar(c, w, h); t.needsUpdate = true; };
  redesenhar();
  t.userData.redesenhar = redesenhar;
  return t;
}
function quandoFonte(fonte, t) { if (document.fonts) document.fonts.load(fonte).then(() => t.userData.redesenhar()).catch(() => {}); }
function descartar(raiz) {
  raiz.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => { m.map?.dispose(); m.dispose(); });
  });
}

/* =============================================================== BALADA == */
const EVENTOS = [
  ['BAILE DA', 'ZONA SUL', '27 AGO · RIO', ['#ff3d7f', '#5a1bd6']],
  ['SUNSET', 'ROOFTOP', '30 AGO · BH', ['#ff8a3d', '#c2185b']],
  ['NEON', 'NIGHTS', '06 SET · SP', ['#00e5ff', '#6b2fd6']],
  ['DOMINGO', 'NO PARQUE', 'GRÁTIS', ['#b6ff3d', '#11998e']]
];

function cartaz([l1, l2, data, [a, b]]) {
  return tex(360, 520, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, a); gr.addColorStop(1, b);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 9; i++) c.fillRect(0, i * 60 + 20, w, 18);
    c.fillStyle = '#fff'; c.font = '900 64px Arial, Helvetica, sans-serif'; c.textBaseline = 'top';
    c.fillText(l1, 24, 250); c.fillText(l2, 24, 314);
    c.font = '700 26px Arial, Helvetica, sans-serif'; c.fillText(data, 24, 400);
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(24, 450, 150, 36);
    c.fillStyle = '#111'; c.font = '800 20px Arial'; c.fillText('INGRESSOS', 38, 458);
  });
}

export function criarBalada() {
  const raiz = new THREE.Group(); raiz.name = 'balada';
  const Z = -2.7;
  // piso escuro com brilho e a parede de concreto
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), new THREE.MeshStandardMaterial({ color: 0x0d0b12, roughness: .32, metalness: .35 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; raiz.add(chao);
  const concreto = tex(512, 256, (c, w, h) => {
    c.fillStyle = '#17131d'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${Math.random() > .5 ? '255,255,255' : '0,0,0'},${Math.random() * .06})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 0; x < w; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  });
  concreto.wrapS = concreto.wrapT = THREE.RepeatWrapping; concreto.repeat.set(6, 2);
  const parede = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshStandardMaterial({ map: concreto, roughness: .9 }));
  parede.position.set(0, 2.5, Z); parede.receiveShadow = true; raiz.add(parede);

  // --- a porta da balada, com a pista acesa la dentro -------------------
  // com o percurso aberto (ver CHAVES_BALADA) a porta fica perto do centro
  const X = -.7, LP = 1.5, AP = 2.5;
  const pista = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform float uT; varying vec2 vUv;
      void main(){
        vec3 a = vec3(.55, .2, 1.), b = vec3(1., .15, .55);
        vec3 c = mix(a, b, .5 + .5 * sin(vUv.x * 6. + uT * 1.4));
        float faixas = .5 + .5 * sin(vUv.y * 28. - uT * 6.);
        float pulso = .65 + .35 * sin(uT * 7.7);                  // o grave batendo
        c *= (.35 + .65 * faixas * pulso) * (1.2 - vUv.y * .5);
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const vao = new THREE.Mesh(new THREE.PlaneGeometry(LP, AP), pista);
  vao.position.set(X, AP / 2, Z + .01); raiz.add(vao);
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: .4, metalness: .8 });
  const led = new THREE.MeshBasicMaterial({ color: 0x9d6bff, toneMapped: false });
  [[X - LP / 2 - .06, AP / 2, .12, AP + .12], [X + LP / 2 + .06, AP / 2, .12, AP + .12]].forEach(([x, y, l, a]) => raiz.add(peca(caixa(l, a, .2), metal, x, y, Z + .08)));
  raiz.add(peca(caixa(LP + .24, .14, .2), metal, X, AP + .07, Z + .08));
  [[X - LP / 2, AP / 2, .02, AP], [X + LP / 2, AP / 2, .02, AP], [X, AP, LP, .02]].forEach(([x, y, l, a]) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(l, a, .02), led); f.position.set(x, y, Z + .19); raiz.add(f);
  });
  // feixes saindo da porta e varrendo para fora
  const gradFeixe = tex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const feixes = [];
  [[0xb46bff, -.35], [0xff3d9a, .2], [0x6be3ff, .6]].forEach(([cor, ang], i) => {
    const m = new THREE.MeshBasicMaterial({ color: cor, map: gradFeixe, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.9, 5, 24, 1, true), m);
    cone.geometry.translate(0, -2.5, 0);                         // ponta na origem
    const piv = new THREE.Group(); piv.position.set(X + (i - 1) * .4, AP - .15, Z + .2);
    piv.add(cone); piv.rotation.x = -1.25; piv.rotation.z = ang;
    raiz.add(piv); feixes.push({ piv, ang, fase: i * 2.1 });
  });
  const luzPista = new THREE.PointLight(0xc15bff, 3, 7, 1.6); luzPista.position.set(X, 1.4, Z + .6); raiz.add(luzPista);

  // --- neon GATE ✓ e ENTRADA em cima da porta ---------------------------
  const neon = tex(1024, 300, (c, w, h) => {
    c.shadowColor = '#9d6bff'; c.shadowBlur = 30;
    c.fillStyle = '#f2ebff'; c.font = '900 170px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('GATE ✓', w / 2, h * .42);
    c.shadowColor = '#ff3d9a'; c.fillStyle = '#ff7ab8'; c.font = '800 64px Arial'; c.fillText('ENTRADA', w / 2, h * .85);
  });
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(2.1, .62), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }));
  // em cima da porta: com a camera alta do comeco do percurso ele cabe
  placa.position.set(X, AP + .62, Z + .05); placa.scale.setScalar(.9); raiz.add(placa);

  // --- catracas com leitor de QR ----------------------------------------
  const leitores = [], bracosCatraca = [];
  [X - .55, X + .55].forEach((x) => {
    raiz.add(peca(caixa(.22, 1.0, .5, .03), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: .3, metalness: .85 }), x, .5, Z + .75));
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.16, .1), new THREE.MeshBasicMaterial({ color: 0x2cff8f, toneMapped: false }));
    l.position.set(x, 1.01, Z + .75); l.rotation.x = -Math.PI / 2; raiz.add(l); leitores.push(l.material);
    // o braco gira no eixo da catraca: abre para dentro quando o ingresso e valido
    const dir = x < X ? 1 : -1;
    const piv = new THREE.Group(); piv.position.set(x, .8, Z + .75); raiz.add(piv);
    const braco = peca(new THREE.CylinderGeometry(.025, .025, .42, 8), new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: .8, roughness: .3 }), dir * .22, 0, 0);
    braco.rotation.z = Math.PI / 2; piv.add(braco);
    bracosCatraca.push({ piv, dir });
  });
  let abertaAte = 0, relogio = 0;
  const catracas = {
    abrir() { abertaAte = relogio + 2.6; },
    atualizar(dt, passando) {
      relogio += dt;
      const aberta = passando || relogio < abertaAte;
      bracosCatraca.forEach(({ piv, dir }) => { piv.rotation.y += ((aberta ? dir * 1.45 : 0) - piv.rotation.y) * (1 - Math.exp(-dt * 7)); });
      leitores.forEach((m) => m.color.setHex(aberta ? 0x2cff8f : 0x0d5a33));
    }
  };

  // --- corda de veludo e pedestais, a fila e os cartazes ---------------
  const latao = new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: .25, metalness: 1 });
  const veludo = new THREE.MeshStandardMaterial({ color: 0x8e0f24, roughness: .9 });
  // a fila corre rente a parede a direita da porta (a esquerda fica atras do texto);
  // a corda comeca depois do primeiro da fila, que fica livre na frente do seguranca
  const postes = [[.98, -1.9], [1.63, -1.9], [2.28, -1.9], [2.93, -1.9]];
  postes.forEach(([x, z]) => {
    raiz.add(peca(new THREE.CylinderGeometry(.14, .16, .03, 20), latao, x, .015, z));
    raiz.add(peca(new THREE.CylinderGeometry(.025, .025, .95, 10), latao, x, .49, z));
    raiz.add(peca(new THREE.SphereGeometry(.05, 14, 10), latao, x, .98, z));
  });
  for (let i = 0; i < postes.length - 1; i++) {
    const [x1, z1] = postes[i], [x2, z2] = postes[i + 1];
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x1, .9, z1), new THREE.Vector3((x1 + x2) / 2, .62, (z1 + z2) / 2), new THREE.Vector3(x2, .9, z2));
    raiz.add(peca(new THREE.TubeGeometry(curva, 20, .022, 8), veludo));
  }
  // luz da fila: sem ela as pessoas viram vulto contra a parede
  const luzFila = new THREE.PointLight(0xff6fb5, 5, 5, 1.6); luzFila.position.set(1.5, 2.3, -1.2); raiz.add(luzFila);
  const luzFila2 = new THREE.PointLight(0x6fd8ff, 3, 4.5, 1.6); luzFila2.position.set(2.6, 1.4, -1.0); raiz.add(luzFila2);
  // cartazes em lightbox: moldura de metal, sem encostar um no outro (antes
  // se sobrepunham e as bordas brigavam)
  EVENTOS.forEach((e, i) => {
    const x = [.55, 1.33, 2.11, 2.89][i];
    raiz.add(peca(caixa(.74, 1.06, .06, .01), metal, x, 2.4, Z + .03));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.68, 1.0), new THREE.MeshBasicMaterial({ map: cartaz(e), toneMapped: false }));
    m.material.color.setScalar(.92);
    m.position.set(x, 2.4, Z + .065); raiz.add(m);
  });

  // --- marquise com lampadas sobre a porta -------------------------------
  const marquise = peca(caixa(LP + .9, .12, .5, .02), metal, X, AP + .12, Z + .3); raiz.add(marquise);
  const lampadas = [];
  const mLamp = () => new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  for (let i = 0; i < 16; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 8), mLamp());
    l.position.set(X - (LP + .8) / 2 + i * (LP + .8) / 15, AP + .12, Z + .56); raiz.add(l); lampadas.push(l.material);
  }

  // --- a pista la dentro: silhuetas dancando na frente da luz ------------
  const galera = tex(512, 256, (c, w, h) => {
    c.fillStyle = '#07030d';
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 56 + (i % 2) * 10, a = 150 + (i * 37 % 60), y = h - a;
      c.beginPath(); c.arc(x, y + 16, 17, 0, Math.PI * 2); c.fill();              // cabeca
      c.beginPath(); c.ellipse(x, y + 100, 28, 70, 0, 0, Math.PI * 2); c.fill();  // tronco
      if (i % 3 !== 1) { c.save(); c.translate(x, y + 55); c.rotate(i % 2 ? -.5 : .5); c.fillRect(-6, -80, 12, 80); c.restore(); } // braco pra cima
    }
  });
  const dancantes = [0, 1].map((k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LP, LP * .5), new THREE.MeshBasicMaterial({ map: galera, transparent: true, depthWrite: false, opacity: k ? .55 : .95 }));
    m.position.set(X + (k ? .25 : 0), LP * .25 - .02, Z + .012 + k * .002); m.scale.x = k ? -1 : 1; raiz.add(m); return m;
  });

  // --- fumaca nos feixes -------------------------------------------------
  const N = 260, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = X + (Math.random() - .5) * 4; pos[i * 3 + 1] = Math.random() * 2.8; pos[i * 3 + 2] = Z + .2 + Math.random() * 2.2; }
  const gPo = new THREE.BufferGeometry(); gPo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const poeira = new THREE.Points(gPo, new THREE.PointsMaterial({ color: 0xe6c9ff, size: .018, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  raiz.add(poeira);

  // --- fita de LED no rodape, neon no alto e o brilho da porta no chao ---
  const fita = new THREE.Mesh(new THREE.BoxGeometry(14, .025, .02), new THREE.MeshBasicMaterial({ color: 0xff3d9a, toneMapped: false }));
  fita.position.set(0, .03, Z + .02); raiz.add(fita);
  const alto = new THREE.Mesh(new THREE.BoxGeometry(14, .02, .02), new THREE.MeshBasicMaterial({ color: 0x7c4dff, toneMapped: false }));
  alto.position.set(0, 3.25, Z + .02); raiz.add(alto);
  const gradChao = tex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const poca = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshBasicMaterial({ map: gradChao, color: 0xb34dff, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  poca.rotation.x = -Math.PI / 2; poca.position.set(X, .004, Z + 1.0); raiz.add(poca);

  // --- painel de check-ins ao vivo ao lado da porta ----------------------
  let checkins = 842;
  const painelTex = tex(320, 200, (c, w, h) => {
    c.fillStyle = '#07060c'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#2bff8f'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#2bff8f'; c.font = '700 26px Arial'; c.textAlign = 'center'; c.fillText('● CHECK-INS AO VIVO', w / 2, 46);
    c.fillStyle = '#fff'; c.font = '900 84px Arial'; c.fillText(String(checkins), w / 2, 132);
    c.fillStyle = 'rgba(255,255,255,.6)'; c.font = '700 22px Arial'; c.fillText(`LOTAÇÃO ${Math.min(99, Math.round(checkins / 12))}%`, w / 2, 176);
  });
  const painel = new THREE.Mesh(new THREE.PlaneGeometry(.56, .35), new THREE.MeshBasicMaterial({ map: painelTex, toneMapped: false }));
  painel.position.set(X + LP / 2 + .5, 1.78, Z + .02); raiz.add(painel);
  const fila = criarFila(raiz, { X, Z, catracas, aoValidar: () => { checkins++; painelTex.userData.redesenhar(); } });
  let tAnterior = null;

  return {
    raiz,
    atualizar(t) {
      pista.uniforms.uT.value = t;
      feixes.forEach((f) => { f.piv.rotation.z = f.ang + Math.sin(t * .7 + f.fase) * .35; f.piv.rotation.x = -1.25 + Math.sin(t * .5 + f.fase) * .12; });
      luzPista.intensity = 2.4 + Math.sin(t * 7.7) * .8;
      // lampadas da marquise correndo, a galera pulando no grave, a fumaca subindo
      lampadas.forEach((m, i) => { const on = ((i + Math.floor(t * 6)) % 4) !== 0; m.color.setHex(on ? 0xffd9a0 : 0x3a2a18); });
      dancantes.forEach((m, k) => { m.position.y = (LP * .25 - .02) + Math.abs(Math.sin(t * 3.85 + k * 1.3)) * .05; });
      const pp = poeira.geometry.attributes.position;
      for (let i = 0; i < pp.count; i++) { let y = pp.getY(i) + .0025; if (y > 2.9) y = 0; pp.setY(i, y); }
      pp.needsUpdate = true;
      // a fila: seguranca le o QR, verde entra, vermelho vai embora
      const dt = tAnterior === null ? 0 : Math.max(0, t - tAnterior); tAnterior = t;
      fila.atualizar(dt, t);
    },
    destruir() { descartar(raiz); }
  };
}

/* ======================================================= CAMISAS (RARE7) == */
const CAMISAS = [
  { base: '#f7d117', gola: '#1a8f3c', num: '#1a8f3c', faixas: null },            // Brasil
  { base: '#c8102e', gola: '#111111', num: '#ffffff', faixas: '#111111' },       // rubro-negro
  { base: '#ffffff', gola: '#74acdf', num: '#111111', faixas: '#74acdf' },       // albiceleste
  { base: '#ffffff', gola: '#c9a45c', num: '#c9a45c', faixas: null },            // branca e dourado
  { base: '#004d98', gola: '#a50044', num: '#ffffff', faixas: '#a50044' },       // azul-grena
  { base: '#111111', gola: '#ffffff', num: '#ffffff', faixas: '#ffffff' },       // preta e branca
  { base: '#1a8f3c', gola: '#f7d117', num: '#f7d117', faixas: null }             // verde
];
function camisa({ base, gola, num, faixas }, numero) {
  return tex(256, 300, (c, w, h) => {
    const corpo = new Path2D('M78 30 L40 44 L6 96 L42 118 L58 96 L58 290 L198 290 L198 96 L214 118 L250 96 L216 44 L178 30 Q128 62 78 30 Z');
    c.save(); c.clip(corpo);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    if (faixas) { c.fillStyle = faixas; for (let x = 58; x < 200; x += 36) c.fillRect(x, 0, 17, h); }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.stroke(corpo);
    c.strokeStyle = gola; c.lineWidth = 9; c.beginPath(); c.moveTo(80, 32); c.quadraticCurveTo(128, 64, 176, 32); c.stroke();
    c.fillStyle = num; c.font = '900 92px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(numero), 128, 180);
  });
}
const RECORTE_CAMISA = (tx) => new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });

/* ============================================================ ESTADIO RARE7 == */
/**
 * Rare7 (loja de camisa de futebol): a mesa fica na beira do campo, ATRAS DO
 * GOL, num estadio a noite. O gol esta a 12 m na direcao em que a camera olha
 * (ai a trave e a rede aparecem por cima do monitor); o gramado vai ate o outro
 * lado, com arquibancadas cheias, torres de refletor e as placas de LED da
 * RARE7 atras do gol.
 *
 * O campo e montado num referencial proprio: z local 0 e a linha de fundo, -z
 * vai para o meio do campo, x e a largura. Esse referencial e girado para o
 * -z local apontar para onde a camera olha.
 */
const CAM = new THREE.Vector3(2, 0, 1.72);
const FRENTE = new THREE.Vector3(-.76, 0, -.65).normalize();

function gramado() {
  return new THREE.ShaderMaterial({
    uniforms: {}, fog: false,
    vertexShader: 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `varying vec3 vL;
      float lin(float d){ return 1. - smoothstep(.06, .12, abs(d)); }
      void main(){
        // referencial local do plano: x = largura (-34..34), y = -z do campo (0..105)
        float x = vL.x, z = vL.y;
        float faixa = step(.5, fract(z / 10.5));                           // corte do gramado
        vec3 c = mix(vec3(.10, .36, .14), vec3(.13, .44, .17), faixa);
        float dentro = step(abs(x), 34.) * step(0., z) * step(z, 105.);
        c = mix(vec3(.07, .24, .10), c, dentro);                           // fora do campo, mais escuro
        float L = 0.;
        L = max(L, lin(abs(x) - 34.) * step(0., z) * step(z, 105.));       // laterais
        L = max(L, lin(z) * step(abs(x), 34.));                            // linha de fundo (perto)
        L = max(L, lin(z - 105.) * step(abs(x), 34.));
        L = max(L, lin(z - 52.5) * step(abs(x), 34.));                     // meio-campo
        L = max(L, lin(length(vec2(x, z - 52.5)) - 9.15));                 // circulo central
        L = max(L, lin(abs(x) - 20.16) * step(z, 16.5) * step(0., z));     // grande area
        L = max(L, lin(z - 16.5) * step(abs(x), 20.16));
        L = max(L, lin(abs(x) - 9.16) * step(z, 5.5) * step(0., z));       // pequena area
        L = max(L, lin(z - 5.5) * step(abs(x), 9.16));
        L = max(L, lin(length(vec2(x, z - 11.)) - 9.15) * step(16.5, z));  // meia-lua
        L = max(L, 1. - smoothstep(.12, .2, length(vec2(x, z - 11.))));    // marca do penalti
        c = mix(c, vec3(.92, .95, .9), L);
        // luz dos refletores: mais claro no meio do campo
        c *= .75 + .45 * exp(-pow(length(vec2(x, z - 52.5)) / 60., 2.));
        gl_FragColor = vec4(c, 1.);
      }`
  });
}

function torcida() {
  const t = tex(512, 256, (c, w, h) => {
    c.fillStyle = '#1a1d2a'; c.fillRect(0, 0, w, h);
    const cores = ['#f7d117', '#1a8f3c', '#ffffff', '#c8102e', '#1d4fd6', '#111111', '#e8e8e8'];
    for (let y = 4; y < h; y += 9) for (let x = 3; x < w; x += 7) {
      if (Math.random() < .12) continue;
      c.fillStyle = cores[(Math.random() * cores.length) | 0];
      c.globalAlpha = .55 + Math.random() * .45;
      c.fillRect(x + Math.random() * 2, y + Math.random() * 2, 4, 5);
    }
    c.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function arquibancada(largura, fundo, altura, mapa) {
  // degraus: um prisma inclinado com a torcida por cima
  const g = new THREE.Group();
  const m = mapa.clone(); m.needsUpdate = true; m.repeat.set(largura / 12, altura / 4);
  const mat = new THREE.MeshStandardMaterial({ map: m, roughness: .9, emissive: 0xffffff, emissiveMap: m, emissiveIntensity: .18 });
  const plano = new THREE.Mesh(new THREE.PlaneGeometry(largura, Math.hypot(fundo, altura)), mat);
  plano.rotation.x = -Math.atan2(altura, fundo);
  plano.position.set(0, altura / 2, -fundo / 2);
  g.add(plano);
  // cobertura do anel superior
  const teto = new THREE.Mesh(new THREE.BoxGeometry(largura, .6, fundo * .55), new THREE.MeshStandardMaterial({ color: 0x20232b, roughness: .8 }));
  teto.position.set(0, altura + 4, -fundo * .7); g.add(teto);
  return g;
}

function torreRefletor(x, z, alvo) {
  const g = new THREE.Group();
  const aco = new THREE.MeshStandardMaterial({ color: 0x5a606a, roughness: .5, metalness: .7 });
  const A = 34;
  const mastro = new THREE.Mesh(new THREE.CylinderGeometry(.35, .6, A, 8), aco); mastro.position.y = A / 2; g.add(mastro);
  const painel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, .6), aco); painel.position.y = A + 1.5; g.add(painel);
  const lampadas = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.6), new THREE.MeshBasicMaterial({ color: 0xfffbe8, toneMapped: false }));
  lampadas.position.set(0, A + 1.5, .31); g.add(lampadas);
  const halo = tex(128, 128, (c, w, h) => { const r = c.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(255,250,230,.9)'); r.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
  sp.scale.set(26, 26, 1); sp.position.set(0, A + 1.5, 1); g.add(sp);
  g.position.set(x, 0, z);
  // no referencial do campo (a torre e filha dele): o painel olha para o alvo
  g.rotation.y = Math.atan2(alvo.x - x, alvo.z - z);
  return g;
}

export function criarEstadioRare() {
  const raiz = new THREE.Group(); raiz.name = 'estadioRare';
  // ceu de noite de jogo (o estadio vai alem dos 60 m da camera padrao)
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(105, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vD; void main(){ vec3 c = mix(vec3(.10,.12,.22), vec3(.01,.015,.05), smoothstep(0., .5, vD.y)); gl_FragColor = vec4(c, 1.); }'
  }));
  raiz.add(ceu);

  // referencial do campo: linha de fundo a 12 m da camera, -z local = frente
  const campo = new THREE.Group();
  const G = CAM.clone().addScaledVector(FRENTE, 12);
  campo.position.copy(G);
  campo.position.y = -.005;   // abaixo do plano de sombra da cena: sem briga de profundidade
  campo.rotation.y = Math.atan2(-FRENTE.x, -FRENTE.z);
  raiz.add(campo);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(100, 90), gramado());
  piso.rotation.x = -Math.PI / 2;
  // plano em (x, y) local; y do plano = -z do campo: desloca para cobrir de +20 (atras da mesa) a -130
  piso.geometry.translate(0, 25, 0);        // de +20 (atras da mesa) a -70
  campo.add(piso);

  // o gol, com a rede
  const trave = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: .35 });
  const R = .06;
  [[-3.66, 1.22, 0, 2.44, 'v'], [3.66, 1.22, 0, 2.44, 'v']].forEach(([x, y]) => campo.add(peca(new THREE.CylinderGeometry(R, R, 2.44, 12), trave, x, y, 0)));
  const trav = peca(new THREE.CylinderGeometry(R, R, 7.44, 12), trave, 0, 2.44, 0); trav.rotation.z = Math.PI / 2; campo.add(trav);
  const rede = tex(256, 128, (c, w, h) => { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  rede.wrapS = rede.wrapT = THREE.RepeatWrapping; rede.repeat.set(4, 2);
  const matRede = new THREE.MeshBasicMaterial({ map: rede, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: .7 });
  const fundoRede = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.6), matRede); fundoRede.position.set(0, 1.1, 2.1); fundoRede.rotation.x = -.18; campo.add(fundoRede);
  [-3.66, 3.66].forEach((x) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.44), matRede); l.rotation.y = Math.PI / 2; l.position.set(x, 1.22, 1.05); campo.add(l); });
  const tetoRede = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.1), matRede); tetoRede.rotation.x = Math.PI / 2; tetoRede.position.set(0, 2.44, 1.05); campo.add(tetoRede);

  // bola na marca do penalti e bandeirinhas de escanteio
  const bola = tex(256, 128, (c, w, h) => {
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#111';
    for (let i = 0; i < 12; i++) { c.beginPath(); const x = (i % 6) * 44 + (i > 5 ? 22 : 0), y = i > 5 ? 90 : 36; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } c.fill(); }
  });
  const bolaM = peca(new THREE.SphereGeometry(.11, 24, 16), new THREE.MeshStandardMaterial({ map: bola, roughness: .45 }), 0, .11, -11);
  campo.add(bolaM);
  [-34, 34].forEach((x) => {
    campo.add(peca(new THREE.CylinderGeometry(.02, .02, 1.5, 6), trave, x, .75, 0));
    const b = new THREE.Mesh(new THREE.PlaneGeometry(.4, .3), new THREE.MeshStandardMaterial({ color: 0xf7d117, side: THREE.DoubleSide })); b.position.set(x + .2, 1.35, 0); campo.add(b);
  });

  // placas de LED da RARE7 atras do gol, entre a mesa e a rede
  const ledTex = tex(2048, 128, (c, w, h) => {
    c.fillStyle = '#050505'; c.fillRect(0, 0, w, h);
    const frase = 'RARE7  ·  CAMISAS OFICIAIS  ·  QUALIDADE PREMIUM  ·  ';
    c.font = '700 74px Cinzel, "Times New Roman", serif'; c.textBaseline = 'middle';
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff2c4'); g.addColorStop(1, '#c89a48'); c.fillStyle = g;
    const wf = c.measureText(frase).width; for (let x = 0; x < w + wf; x += wf) c.fillText(frase, x, h / 2 + 4);
  });
  quandoFonte('700 74px Cinzel', ledTex);
  // placa baixa (80 cm) e o texto repetido 4x: em 2x cada letra dava meio metro
  ledTex.wrapS = THREE.RepeatWrapping; ledTex.repeat.set(4, 1);
  const placas = new THREE.Mesh(new THREE.PlaneGeometry(22, .8), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
  // o plano ja olha para +z local, que e o lado da camera
  placas.position.set(0, .42, 4.2); campo.add(placas);
  const suporte = new THREE.Mesh(new THREE.BoxGeometry(22.2, .9, .2), new THREE.MeshStandardMaterial({ color: 0x111111 })); suporte.position.set(0, .44, 4.1); campo.add(suporte);

  // arquibancadas: fundo do outro lado, e as laterais
  const tor = torcida();
  // arquibancadas ate ~70 m: alem disso a camera precisaria de um far maior,
  // e com far grande o monitor (pecas a milimetros) cintilava por falta de
  // precisao de profundidade. Do fundo do gol so se ve ate pouco depois do meio.
  const fundo = arquibancada(90, 20, 20, tor); fundo.position.set(0, 0, -64); campo.add(fundo);
  // o degrau sobe para -z da arquibancada: girada +90 graus ele sobe para -x (fora do campo)
  const esq = arquibancada(70, 18, 16, tor); esq.rotation.y = Math.PI / 2; esq.position.set(-40, 0, -30); campo.add(esq);
  const dir = arquibancada(70, 18, 16, tor); dir.rotation.y = -Math.PI / 2; dir.position.set(40, 0, -30); campo.add(dir);
  // flashes de camera na torcida
  const flashes = [];
  const halo = tex(64, 64, (c) => { const r = c.createRadialGradient(32, 32, 1, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, 64, 64); });
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, opacity: 0 }));
    const lado = i % 3;
    const u = Math.random(), v = .2 + Math.random() * .7;
    if (lado === 0) sp.position.set(-40 + u * 80, v * 18, -66 - v * 16);
    else sp.position.set((lado === 1 ? -1 : 1) * (42 + v * 16), v * 14, -5 - u * 55);
    sp.scale.set(2.2, 2.2, 1); campo.add(sp);
    flashes.push({ sp, fase: Math.random() * 20, ritmo: .6 + Math.random() * 1.4 });
  }

  // torres de refletor nos cantos, apontando para o meio do campo
  const meio = new THREE.Vector3(0, 0, -35);
  [[-44, 6], [44, 6], [-44, -70], [44, -70]].forEach(([x, z]) => campo.add(torreRefletor(x, z, meio)));

  // manequim com a camisa do Brasil ao lado da mesa: a loja continua ali
  const man = new THREE.Group();
  const ouro = new THREE.MeshStandardMaterial({ color: 0xc9a45c, roughness: .28, metalness: 1 });
  man.add(peca(new THREE.CylinderGeometry(.18, .15, .02, 20), ouro, 0, .01, 0));
  man.add(peca(new THREE.CylinderGeometry(.02, .02, .95, 10), ouro, 0, .48, 0));
  const tronco = peca(new THREE.CapsuleGeometry(.2, .42, 6, 14), new THREE.MeshStandardMaterial({ color: 0xe9e6e1, roughness: .4 }), 0, 1.25, 0); tronco.scale.set(1, 1, .62); man.add(tronco);
  const vestida = new THREE.Mesh(new THREE.PlaneGeometry(.66, .78), RECORTE_CAMISA(camisa(CAMISAS[0], 10)));
  vestida.position.set(0, 1.26, .14); man.add(vestida);
  man.position.set(-.2, 0, -1.85); man.rotation.y = .5; raiz.add(man);

  // luz de refletor: branca, alta, vinda do campo
  const refl = new THREE.DirectionalLight(0xf4f1e6, 1.1); refl.position.copy(G).add(new THREE.Vector3(0, 30, 0)); raiz.add(refl);
  const amb = new THREE.HemisphereLight(0x8fa6ff, 0x16361c, .55); raiz.add(amb);

  return {
    raiz,
    atualizar(t, camera) {
      if (camera) ceu.position.copy(camera.position);
      ledTex.offset.x = (t * .03) % 1;
      flashes.forEach((f) => { const k = Math.sin(t * f.ritmo + f.fase); f.sp.material.opacity = k > .985 ? 1 : 0; });
    },
    destruir() { descartar(raiz); }
  };
}
