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

/* ======================================================= COWORKING (05) == */
/* Coworking Agents: a mesa vira um posto num coworking a noite — o mesmo
   escritorio que o projeto desenha, so que em 3D. Parede de tijolo com
   janelas para a cidade, piso de taco, neon com o nome na fonte do projeto,
   e outras mesas com agentes em pixel art (sprites, como no app) em estados
   diferentes: editando, no terminal, pensando, pedindo algo (!) e esperando
   aprovacao (?). O gato do escritorio passeia pelo chao. O monitor principal
   mostra o escritorio de verdade, ao vivo (ver telaViva em index.js). */
function texPixel(w, h, desenhar) {
  const t = tex(w, h, desenhar);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}
const AGENTES = [
  { x: .35, z: -1.05, estado: 'codigo', pele: '#e0a77f', cabelo: '#2b1a12', camisa: '#e8804a', calca: '#2c3550' },
  { x: 1.65, z: -1.05, estado: 'pergunta', pele: '#8a5a3c', cabelo: '#141018', camisa: '#4fa3d9', calca: '#3a2f45' },
  { x: .35, z: -2.05, estado: 'terminal', pele: '#f1c9a5', cabelo: '#d8a03a', camisa: '#5bbf6a', calca: '#2c3550' },
  { x: 1.65, z: -2.05, estado: 'aprovacao', pele: '#c98a62', cabelo: '#6b2f1f', camisa: '#c75fa8', calca: '#2b2b33' },
  { x: 2.95, z: -1.55, estado: 'pensando', pele: '#e8b894', cabelo: '#3a3a44', camisa: '#e8c84a', calca: '#3a2f45' }
];
// vista DE COSTAS: a pessoa olha para o monitor dela, que fica de frente
// para a camera — vemos a nuca e a tela por cima do ombro
function spritePessoa({ pele, cabelo, camisa }) {
  return texPixel(16, 20, (c) => {
    const px = (x, y, w, h, cor) => { c.fillStyle = cor; c.fillRect(x, y, w, h); };
    px(4, 1, 8, 7, cabelo); px(3, 2, 1, 5, cabelo); px(12, 2, 1, 5, cabelo);
    px(3, 4, 1, 2, pele); px(12, 4, 1, 2, pele); px(6, 8, 4, 1, pele);
    px(3, 9, 10, 8, camisa); px(2, 10, 1, 6, camisa); px(13, 10, 1, 6, camisa);
    px(5, 10, 6, 1, 'rgba(0,0,0,.18)');
    // encosto da cadeira na frente das costas
    px(4, 13, 8, 6, '#2a2630'); px(5, 14, 6, 4, '#e8804a');
  });
}
function balaoEstado(estado) {
  if (estado === 'cafe' || estado === 'sono') {
    return texPixel(16, 16, (c) => {
      const px = (x, y, w, h, cor) => { c.fillStyle = cor; c.fillRect(x, y, w, h); };
      if (estado === 'sono') {
        px(3, 3, 6, 1, '#c8d8ff'); px(7, 4, 1, 1, '#c8d8ff'); px(6, 5, 1, 1, '#c8d8ff'); px(5, 6, 1, 1, '#c8d8ff'); px(4, 7, 1, 1, '#c8d8ff'); px(3, 8, 6, 1, '#c8d8ff');
        px(10, 9, 4, 1, '#9fb4ef'); px(12, 10, 1, 1, '#9fb4ef'); px(11, 11, 1, 1, '#9fb4ef'); px(10, 12, 4, 1, '#9fb4ef');
      } else {
        px(1, 1, 14, 11, '#1a1020'); px(6, 12, 3, 2, '#1a1020'); px(2, 2, 12, 9, '#4f7fd9'); px(7, 11, 1, 2, '#4f7fd9');
        px(5, 5, 5, 4, '#fff'); px(10, 6, 1, 2, '#fff'); px(6, 3, 1, 1, '#dde'); px(8, 3, 1, 1, '#dde');
      }
    });
  }
  const cor = { pergunta: '#e84a4a', aprovacao: '#e8b44a', pensando: '#f3ece4' }[estado];
  if (!cor) return null;
  return texPixel(16, 16, (c) => {
    c.fillStyle = '#1a1020'; c.fillRect(1, 1, 14, 11); c.fillRect(6, 12, 3, 2);
    c.fillStyle = cor; c.fillRect(2, 2, 12, 9); c.fillRect(7, 11, 1, 2);
    c.fillStyle = estado === 'pensando' ? '#6a5a70' : '#fff';
    if (estado === 'pergunta') { c.fillRect(7, 3, 2, 5); c.fillRect(7, 9, 2, 1); }
    else if (estado === 'aprovacao') { c.fillRect(6, 3, 4, 1); c.fillRect(9, 4, 1, 2); c.fillRect(7, 6, 2, 1); c.fillRect(7, 7, 1, 1); c.fillRect(7, 9, 1, 1); }
    else { c.fillRect(4, 6, 2, 2); c.fillRect(7, 6, 2, 2); c.fillRect(10, 6, 2, 2); }
  });
}
// tela de cada mesa: desenhada de novo a cada passo, com o estado do agente
function telaAgente(estado) {
  let passo = 0;
  const t = texPixel(64, 40, (c, w, h) => {
    const bg = estado === 'terminal' ? '#07090a' : '#14101c';
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (estado === 'codigo') {
      const cores = ['#e8804a', '#7ec8e3', '#c79bff', '#9fd67a', '#f3ece4'];
      for (let i = 0; i < 8; i++) {
        const k = i + passo;
        c.fillStyle = cores[(k * 7) % cores.length];
        c.fillRect(3 + (k % 3) * 3, 3 + i * 4.5, 12 + ((k * 13) % 30), 2);
      }
      c.fillStyle = '#fff'; if (passo % 2) c.fillRect(3 + 30, 3 + 7 * 4.5, 2, 3);
    } else if (estado === 'terminal') {
      c.fillStyle = '#5bff8a';
      const n = 1 + (passo % 8);
      for (let i = 0; i < n; i++) c.fillRect(3, 3 + i * 4.5, 6 + ((i * 17) % 40), 2);
    } else if (estado === 'pensando') {
      c.fillStyle = '#c79bff'; for (let i = 0; i < 3; i++) if (i <= passo % 3) c.fillRect(22 + i * 8, 18, 4, 4);
    } else {
      const cor = estado === 'pergunta' ? '#e84a4a' : '#e8b44a';
      c.fillStyle = cor; c.fillRect(6, 8, 52, 24);
      c.fillStyle = '#14101c'; c.fillRect(8, 10, 48, 20);
      c.fillStyle = passo % 2 ? cor : '#f3ece4'; c.fillRect(30, 13, 4, 9); c.fillRect(30, 24, 4, 3);
    }
  });
  t.userData.passo = () => { passo++; t.userData.redesenhar(); };
  return t;
}
function ceuCidade() {
  let semente = 1;
  const t = tex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0b1e'); g.addColorStop(.7, '#2a1838'); g.addColorStop(1, '#4a2430');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.2 + rnd() * .5})`; c.fillRect(rnd() * w, rnd() * h * .5, 1, 1); }
    let x = 0;
    while (x < w) {
      const bw = 26 + rnd() * 50, bh = 60 + rnd() * 150;
      c.fillStyle = `rgb(${14 + rnd() * 12},${12 + rnd() * 10},${24 + rnd() * 16})`; c.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 6; yy < h - 4; yy += 9) for (let xx = x + 4; xx < x + bw - 5; xx += 8) {
        // `semente` muda a cada redesenho: algumas janelas acendem e apagam
        const v = (Math.sin(xx * 12.9898 + yy * 78.233 + semente * 3.1) * 43758.5453) % 1;
        if (Math.abs(v) > .62) { c.fillStyle = Math.abs(v) > .9 ? '#ffd9a0' : '#e8a060'; c.fillRect(xx, yy, 3, 4); }
      }
      x += bw + 2;
    }
  });
  t.userData.piscar = () => { semente++; t.userData.redesenhar(); };
  return t;
}

// vista DE FRENTE (quem anda, joga, conversa): dois quadros de perna
function spriteFrente({ pele, cabelo, camisa, calca }, quadro = 0, cracha = false) {
  return texPixel(16, 24, (c) => {
    const px = (x, y, w, h, cor) => { c.fillStyle = cor; c.fillRect(x, y, w, h); };
    px(4, 1, 8, 3, cabelo); px(3, 2, 1, 5, cabelo); px(12, 2, 1, 5, cabelo);
    px(4, 4, 8, 5, pele); px(6, 6, 1, 1, '#1a1020'); px(9, 6, 1, 1, '#1a1020'); px(7, 8, 2, 1, '#a8483a');
    px(3, 10, 10, 7, camisa); px(2, 11, 1, 5, camisa); px(13, 11, 1, 5, camisa);
    px(2, 16, 1, 1, pele); px(13, 16, 1, 1, pele); px(7, 10, 2, 1, pele);
    if (cracha) { px(9, 12, 3, 3, '#f3ece4'); px(10, 13, 1, 1, '#e8804a'); }
    if (quadro === 0) { px(4, 17, 3, 5, calca); px(9, 17, 3, 5, calca); px(4, 22, 3, 2, '#1c1820'); px(9, 22, 3, 2, '#1c1820'); }
    else { px(4, 17, 3, 4, calca); px(9, 17, 3, 5, calca); px(3, 21, 3, 2, '#1c1820'); px(10, 22, 3, 2, '#1c1820'); }
  });
}
const sprite = (map, w, h, x, y, z) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
  sp.scale.set(w, h, 1); sp.position.set(x, y, z); return sp;
};
function placaTexto(w, h, desenhar) {
  const t = tex(w, h, desenhar);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false });
}

/* Planta do coworking (metros; a mesa principal fica na origem, a camera
   chega por +z):
     pod "api"        x 1..3,4   z -0,8..-2,4   cinco mesas com agentes
     sala de reuniao  x 4,2..6,2 z -0,8..-3,2   vidro, quem delega + estagiarios
     cozinha          x 1,2..4,8 z -4,4..-5,2   bancada, cafe, geladeira, sofa
     ping-pong        x -0,6..1  z -3,9         dois agentes jogando
     soneca           x -2,4..-0,8 z -4,3       pufes, alguem dormindo (zZ)
     servidor         x 5,7      z -4,7
   Nos dutos do teto, pulsos de luz correm das mesas ate o monitor principal:
   e o "estado de todos por SSE" do projeto, visto de fora. */
export function criarCoworking() {
  const raiz = new THREE.Group(); raiz.name = 'coworking';
  const Z = -5.2, XD = 6.2;   // parede do fundo e parede da direita
  const animados = [];        // (t) => void

  /* ---------------------------------------------------------- casca -- */
  const taco = tex(512, 512, (c, w, h) => {
    const cores = ['#5a3d2b', '#4b3326', '#634330', '#553a29'];
    for (let y = 0; y < h; y += 32) {
      let x = -((y / 32) % 2) * 64;
      while (x < w) {
        c.fillStyle = cores[(Math.random() * cores.length) | 0]; c.fillRect(x, y, 128, 32);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, y, 128, 2); c.fillRect(x, y, 2, 32);
        c.fillStyle = 'rgba(255,220,180,.05)'; for (let i = 0; i < 4; i++) c.fillRect(x + 6, y + 6 + i * 6, 110, 1);
        x += 128;
      }
    }
  });
  taco.wrapS = taco.wrapT = THREE.RepeatWrapping; taco.repeat.set(10, 7);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), new THREE.MeshStandardMaterial({ map: taco, roughness: .5, metalness: .05 }));
  chao.rotation.x = -Math.PI / 2; chao.position.set(1, 0, -1); chao.receiveShadow = true; raiz.add(chao);

  const tijolo = tex(512, 256, (c, w, h) => {
    c.fillStyle = '#1e1416'; c.fillRect(0, 0, w, h);
    const cores = ['#5b2e26', '#4e2a24', '#63352b', '#552d27', '#48261f'];
    for (let y = 0, l = 0; y < h; y += 32, l++) for (let x = -(l % 2) * 32; x < w; x += 64) {
      c.fillStyle = cores[(Math.random() * cores.length) | 0]; c.fillRect(x + 2, y + 2, 60, 28);
      c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(x + 2, y + 2, 60, 3);
    }
  });
  tijolo.wrapS = tijolo.wrapT = THREE.RepeatWrapping; tijolo.repeat.set(6, 3);
  const matTijolo = new THREE.MeshStandardMaterial({ map: tijolo, roughness: .92 });
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(18, 5), matTijolo);
  fundo.position.set(1, 2.5, Z); fundo.receiveShadow = true; raiz.add(fundo);
  const tijolo2 = tijolo.clone(); tijolo2.repeat.set(3, 3); tijolo2.needsUpdate = true;
  const direita = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ map: tijolo2, roughness: .92 }));
  direita.rotation.y = -Math.PI / 2; direita.position.set(XD, 2.5, -.7); direita.receiveShadow = true; raiz.add(direita);
  const madeiraEscura = new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: .6 });
  raiz.add(peca(new THREE.BoxGeometry(18, .12, .04), madeiraEscura, 1, .06, Z + .02));

  const madeira = new THREE.MeshStandardMaterial({ color: 0xb07a4e, roughness: .55 });
  const grafite = new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: .5, metalness: .4 });

  /* ------------------------------------------------ parede do fundo -- */
  const ceu = ceuCidade();
  const vidroCeu = new THREE.MeshBasicMaterial({ map: ceu, toneMapped: false, color: 0xbbbbbb });
  const caixilho = new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: .4, metalness: .6 });
  [-1.7, .9, 3.5].forEach((x) => {
    const j = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), vidroCeu); j.position.set(x, 2.05, Z + .01); raiz.add(j);
    [[0, .68, 1.62, .08], [0, -.68, 1.62, .08], [-.77, 0, .08, 1.44], [.77, 0, .08, 1.44], [0, 0, .04, 1.3], [0, .1, 1.5, .04]]
      .forEach(([dx, dy, l, a]) => raiz.add(peca(new THREE.BoxGeometry(l, a, .06), caixilho, x + dx, 2.05 + dy, Z + .04)));
  });
  const FONTE = '700 96px Silkscreen';
  const neon = tex(1024, 256, (c, w, h) => {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#ff7a3a'; c.shadowBlur = 28; c.fillStyle = '#ffe2c8';
    c.font = `${FONTE}, ui-monospace, monospace`; c.fillText('COWORKING·AGENTS', w / 2, h * .42);
    c.shadowColor = '#5bbf6a'; c.fillStyle = '#b8f5c0'; c.font = '700 34px Silkscreen, ui-monospace, monospace';
    c.fillText('● 8 TRABALHANDO   ● 2 PRECISAM DE VOCÊ', w / 2, h * .82);
  });
  quandoFonte(FONTE, neon);
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(3.4, .85), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }));
  placa.position.set(.9, 3.3, Z + .05); raiz.add(placa);
  const luzNeon = new THREE.PointLight(0xff8a4a, 2.2, 6, 1.8); luzNeon.position.set(.9, 3.1, Z + .6); raiz.add(luzNeon);
  // ON AIR: acende quando quase todo mundo esta trabalhando (como no app)
  const onAir = placaTexto(256, 96, (c, w, h) => {
    c.fillStyle = '#2a0d0d'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff4a4a'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.shadowColor = '#ff3a3a'; c.shadowBlur = 18; c.fillStyle = '#ff6a6a'; c.font = '700 54px Silkscreen, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ON AIR', w / 2, h / 2 + 2);
  });
  quandoFonte('700 54px Silkscreen', onAir.map);
  const placaAr = new THREE.Mesh(new THREE.PlaneGeometry(.8, .3), onAir); placaAr.position.set(5.2, 3.0, Z + .04); raiz.add(placaAr);
  animados.push((t) => { onAir.opacity = Math.sin(t * 1.3) > -.85 ? 1 : .4; });

  /* ---------------------------------------------- pod de mesas (api) -- */
  const tapete = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.1), new THREE.MeshStandardMaterial({ color: 0x3a3f66, roughness: .95 }));
  tapete.rotation.x = -Math.PI / 2; tapete.position.set(1.4, .003, -1.6); tapete.receiveShadow = true; raiz.add(tapete);
  const placaSala = placaTexto(256, 64, (c, w, h) => {
    c.fillStyle = '#1a1020'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0a070'; c.fillRect(0, 0, w, 4);
    c.fillStyle = '#ffe2c8'; c.font = '700 28px Silkscreen, monospace'; c.textBaseline = 'middle'; c.fillText('API', 14, h / 2 + 2);
    c.fillStyle = '#e8b44a'; c.fillText('●3', 92, h / 2 + 2); c.fillStyle = '#7ec8e3'; c.fillText('↑2', 160, h / 2 + 2);
  });
  quandoFonte('700 28px Silkscreen', placaSala.map);
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(.9, .22), placaSala); ps.rotation.x = -Math.PI / 2; ps.position.set(1.4, .006, -.45); raiz.add(ps);

  const telas = [], baloes = [], pessoas = [];
  AGENTES.forEach((a, i) => {
    const g = new THREE.Group(); g.position.set(a.x, 0, a.z); raiz.add(g);
    g.add(peca(caixa(1.1, .045, .58, .01), madeira, 0, .74, 0));
    [[-.5, -.24], [.5, -.24], [-.5, .24], [.5, .24]].forEach(([x, z]) => g.add(peca(new THREE.BoxGeometry(.04, .72, .04), grafite, x, .36, z)));
    g.add(peca(caixa(.5, .32, .03, .008), grafite, 0, 1.0, -.16));
    g.add(peca(new THREE.BoxGeometry(.04, .18, .04), grafite, 0, .84, -.18));
    const tt = telaAgente(a.estado);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(.46, .28), new THREE.MeshBasicMaterial({ map: tt, toneMapped: false }));
    tela.position.set(0, 1.0, -.144); g.add(tela); telas.push({ tex: tt, ritmo: a.estado === 'codigo' ? .18 : a.estado === 'terminal' ? .35 : .5, prox: i * .1 });
    // caneca e plantinha em algumas mesas
    if (i % 2 === 0) g.add(peca(new THREE.CylinderGeometry(.035, .03, .09, 10), new THREE.MeshStandardMaterial({ color: [0xe8804a, 0x4f7fd9, 0x5bbf6a][i % 3], roughness: .5 }), .38, .81, .1));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: spritePessoa(a), transparent: true }));
    sp.scale.set(.4, .5, 1); sp.position.set(a.x - .2, .95, a.z + .48); sp.renderOrder = 1; raiz.add(sp);
    pessoas.push({ sp, y: .95, fase: i * 1.7, estado: a.estado });
    raiz.add(peca(caixa(.42, .06, .42, .02), grafite, a.x - .2, .48, a.z + .55));
    const bt = balaoEstado(a.estado);
    if (bt) {
      const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, transparent: true, depthTest: false }));
      b.scale.set(.22, .22, 1); b.position.set(a.x - .05, 1.42, a.z + .48); b.renderOrder = 2; raiz.add(b);
      baloes.push({ b, fase: i, estado: a.estado, y: 1.42 });
    }
    if (i < 2) { const l = new THREE.PointLight(a.estado === 'pergunta' ? 0xff6a5a : 0x9fc8ff, .9, 1.6, 2); l.position.set(a.x, 1.05, a.z + .1); raiz.add(l); }
  });

  /* ------------------------------------------- sala de reuniao (vidro) -- */
  const vidro = new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, transparent: true, opacity: .14, roughness: .05, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  const perfil = new THREE.MeshStandardMaterial({ color: 0x2a2833, roughness: .35, metalness: .7 });
  const XS = 4.2, ZF = -.8, ZT = -3.2, H = 2.4;
  const painel = (l, x, z, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, H), vidro); m.position.set(x, H / 2, z); m.rotation.y = rotY; raiz.add(m);
  };
  painel(1.15, XS + .575, ZF, 0); painel(.55, XD - .275, ZF, 0);      // frente com a porta aberta no meio
  painel(ZF - ZT, XS, (ZF + ZT) / 2, Math.PI / 2);                    // lateral
  [[XS, ZF], [XS + 1.15, ZF], [XD - .55, ZF], [XS, ZT]].forEach(([x, z]) => raiz.add(peca(new THREE.BoxGeometry(.05, H, .05), perfil, x, H / 2, z)));
  raiz.add(peca(new THREE.BoxGeometry(XD - XS, .05, .05), perfil, (XS + XD) / 2, H, ZF));
  raiz.add(peca(new THREE.BoxGeometry(.05, .05, ZF - ZT), perfil, XS, H, (ZF + ZT) / 2));
  // adesivo no vidro: quantos subagentes estao trabalhando
  const adesivo = placaTexto(512, 128, (c, w, h) => {
    c.fillStyle = 'rgba(26,16,32,.85)'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8b44a'; c.fillRect(0, 0, 8, h);
    c.font = '700 44px Silkscreen, monospace'; c.textBaseline = 'middle'; c.fillStyle = '#ffd88a'; c.fillText('3 SUBAGENTES', 28, 44);
    c.font = '700 26px Silkscreen, monospace'; c.fillStyle = '#c8bcd8'; c.fillText('SALA DE REUNIÃO · PLANO', 28, 96);
  });
  quandoFonte('700 44px Silkscreen', adesivo.map);
  const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .25), adesivo); ad.position.set(XS + .58, 1.55, ZF + .01); raiz.add(ad);
  raiz.add(peca(caixa(1.3, .05, .7, .02), new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .3 }), 5.2, .74, -2.0));
  raiz.add(peca(new THREE.CylinderGeometry(.06, .2, .72, 12), grafite, 5.2, .36, -2.0));
  // TV na parede da sala com o plano da conversa
  let passoPlano = 0;
  const plano = tex(256, 144, (c, w, h) => {
    c.fillStyle = '#0d1018'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8b44a'; c.font = '700 16px Silkscreen, monospace'; c.fillText('PLANO', 12, 22);
    const itens = ['mapear chamadas', 'rodar testes', 'migrar schema', 'revisar PR'];
    itens.forEach((it, i) => {
      const feito = i < (passoPlano % 5);
      c.fillStyle = feito ? '#5bbf6a' : '#3a3f55'; c.fillRect(12, 40 + i * 24, 12, 12);
      c.fillStyle = feito ? '#9fd67a' : '#c8bcd8'; c.font = '13px ui-monospace, monospace'; c.fillText(it, 32, 51 + i * 24);
    });
  });
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .62), new THREE.MeshBasicMaterial({ map: plano, toneMapped: false }));
  tv.rotation.y = -Math.PI / 2; tv.position.set(XD - .03, 1.55, -2.0); raiz.add(tv);
  raiz.add(peca(new THREE.BoxGeometry(.04, .68, 1.16), grafite, XD - .01, 1.55, -2.0));
  let proxPlano = 0;
  animados.push((t) => { if (t >= proxPlano) { proxPlano = t + 1.4; passoPlano++; plano.userData.redesenhar(); } });
  // quem delega e os estagiarios em volta da mesa
  const chefe = sprite(spriteFrente({ pele: '#e0a77f', cabelo: '#6b2f1f', camisa: '#c75fa8', calca: '#2b2b33' }), .66, 1.0, 5.2, .5, -2.6);
  raiz.add(chefe);
  const estagiarios = [];
  [[4.65, -1.75, '#4fa3d9'], [5.2, -1.45, '#5bbf6a'], [5.75, -1.75, '#e8c84a']].forEach(([x, z, cam], k) => {
    const e = sprite(spriteFrente({ pele: ['#f1c9a5', '#8a5a3c', '#e8b894'][k], cabelo: ['#d8a03a', '#141018', '#3a3a44'][k], camisa: cam, calca: '#3a2f45' }, 0, true), .5, .75, x, .375, z);
    raiz.add(e); estagiarios.push({ e, fase: k * 1.3 });
  });
  const luzSala = new THREE.PointLight(0x9fc8ff, 1.4, 4, 1.8); luzSala.position.set(5.2, 2.1, -2.0); raiz.add(luzSala);
  animados.push((t) => {
    estagiarios.forEach(({ e, fase }) => { e.position.y = .375 + Math.abs(Math.sin(t * 2.2 + fase)) * .02; });
    chefe.position.y = .5 + Math.sin(t * 1.6) * .012;
  });

  /* ----------------------------------------------------------- cozinha -- */
  const bancada = new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .35 });
  raiz.add(peca(caixa(3.0, .86, .6, .02), new THREE.MeshStandardMaterial({ color: 0x2e4a5a, roughness: .6 }), 2.7, .43, Z + .32));
  raiz.add(peca(caixa(3.04, .05, .64, .01), bancada, 2.7, .885, Z + .32));
  // cafeteira com a luz vermelha e vapor
  raiz.add(peca(caixa(.32, .42, .3, .03), new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: .3, metalness: .6 }), 1.6, 1.12, Z + .3));
  const ledCafe = new THREE.Mesh(new THREE.SphereGeometry(.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3a3a, toneMapped: false }));
  ledCafe.position.set(1.6, 1.25, Z + .46); raiz.add(ledCafe);
  const vapor = [];
  const matVapor = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25, depthWrite: false });
  for (let k = 0; k < 4; k++) { const v = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), matVapor.clone()); raiz.add(v); vapor.push({ v, fase: k / 4 }); }
  animados.push((t) => vapor.forEach(({ v, fase }) => {
    const k = (t * .5 + fase) % 1; v.position.set(1.6 + Math.sin(k * 9 + fase * 6) * .03, 1.36 + k * .45, Z + .3); v.material.opacity = .28 * (1 - k); v.scale.setScalar(.8 + k * 1.6);
  }));
  // canecas, micro-ondas, geladeira
  [[2.1, 0xe8804a], [2.25, 0x4f7fd9], [2.4, 0xf3ece4]].forEach(([x, cor]) => raiz.add(peca(new THREE.CylinderGeometry(.04, .035, .1, 10), new THREE.MeshStandardMaterial({ color: cor, roughness: .5 }), x, .96, Z + .4)));
  raiz.add(peca(caixa(.5, .3, .36, .02), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: .4 }), 3.4, 1.06, Z + .28));
  raiz.add(peca(caixa(.7, 1.95, .66, .04), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: .3, metalness: .2 }), 4.6, .975, Z + .36));
  raiz.add(peca(new THREE.BoxGeometry(.03, .5, .03), grafite, 4.32, 1.35, Z + .7));
  // armario alto
  raiz.add(peca(caixa(3.0, .6, .36, .02), new THREE.MeshStandardMaterial({ color: 0x2e4a5a, roughness: .6 }), 2.7, 2.6, Z + .2));
  // placa da cozinha
  const placaCoz = placaTexto(256, 64, (c, w, h) => {
    c.fillStyle = '#1a1020'; c.fillRect(0, 0, w, h); c.fillStyle = '#4f7fd9'; c.fillRect(0, 0, w, 4);
    c.fillStyle = '#c8d8ff'; c.font = '700 26px Silkscreen, monospace'; c.textBaseline = 'middle'; c.fillText('COZINHA · SUA VEZ', 12, h / 2 + 2);
  });
  quandoFonte('700 26px Silkscreen', placaCoz.map);
  const pc = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .28), placaCoz); pc.position.set(2.7, 3.05, Z + .04); raiz.add(pc);
  // sofa (o turquesa do app), de costas para a bancada, com quem terminou a vez
  const tecido = new THREE.MeshStandardMaterial({ color: 0x2a7f86, roughness: .9 });
  raiz.add(peca(caixa(1.8, .42, .8, .08), tecido, 2.7, .26, -3.75));
  raiz.add(peca(caixa(1.8, .5, .2, .08), tecido, 2.7, .62, -4.1));
  [-.95, .95].forEach((dx) => raiz.add(peca(caixa(.18, .55, .8, .06), tecido, 2.7 + dx, .4, -3.75)));
  const tapeteSofa = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a3f6e, roughness: .95 }));
  tapeteSofa.rotation.x = -Math.PI / 2; tapeteSofa.position.set(2.7, .004, -3.4); raiz.add(tapeteSofa);
  const naVez = sprite(spriteFrente({ pele: '#c98a62', cabelo: '#141018', camisa: '#4f7fd9', calca: '#2c3550' }), .55, .82, 2.4, .8, -3.6);
  raiz.add(naVez);
  const balaoCafe = new THREE.Sprite(new THREE.SpriteMaterial({ map: balaoEstado('cafe'), transparent: true, depthTest: false }));
  balaoCafe.scale.set(.22, .22, 1); balaoCafe.position.set(2.62, 1.38, -3.6); balaoCafe.renderOrder = 2; raiz.add(balaoCafe);
  baloes.push({ b: balaoCafe, fase: 2, estado: 'cafe', y: 1.38 });
  const luzCoz = new THREE.PointLight(0xffc890, 1.6, 4.5, 1.8); luzCoz.position.set(2.7, 2.2, -4.2); raiz.add(luzCoz);

  /* --------------------------------------------------------- ping-pong -- */
  const mesaPP = new THREE.MeshStandardMaterial({ color: 0x1f6a46, roughness: .45 });
  raiz.add(peca(caixa(1.5, .04, .84, .01), mesaPP, .2, .76, -3.95));
  const linha = new THREE.MeshBasicMaterial({ color: 0xf3ece4 });
  [[0, .02, -3.95, 1.5, .003, .02], [0, .02, -3.95, .02, .003, .84]].forEach(([dx, dy, z, l, a, p]) => raiz.add(peca(new THREE.BoxGeometry(l, a, p), linha, .2 + dx, .76 + dy, z)));
  raiz.add(peca(new THREE.BoxGeometry(.02, .12, .88), new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .8, transparent: true, opacity: .8 }), .2, .84, -3.95));
  [[-.45, -.3], [.85, -.3], [-.45, .3], [.85, .3]].forEach(([x, z]) => raiz.add(peca(new THREE.BoxGeometry(.04, .74, .04), grafite, x, .37, -3.95 + z)));
  const jogA = sprite(spriteFrente({ pele: '#f1c9a5', cabelo: '#d8a03a', camisa: '#e8804a', calca: '#2c3550' }), .66, 1.0, -.85, .5, -3.95);
  const jogB = sprite(spriteFrente({ pele: '#8a5a3c', cabelo: '#2b1a12', camisa: '#5bbf6a', calca: '#3a2f45' }), .66, 1.0, 1.25, .5, -3.95);
  raiz.add(jogA, jogB);
  const bola = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 }));
  raiz.add(bola);
  animados.push((t) => {
    const ida = (t * .9) % 2, k = ida < 1 ? ida : 2 - ida;           // vai e volta
    bola.position.set(-.45 + k * 1.3, .8 + Math.abs(Math.sin(k * Math.PI * 2)) * .22, -3.95 + Math.sin(t * 1.7) * .2);
    jogA.position.y = .5 + (k < .15 ? .04 : 0); jogB.position.y = .5 + (k > .85 ? .04 : 0);
  });

  /* ------------------------------------------------------------ soneca -- */
  const pufe = (x, z, cor) => { const m = peca(new THREE.SphereGeometry(.38, 18, 12), new THREE.MeshStandardMaterial({ color: cor, roughness: .95 }), x, .2, z); m.scale.set(1, .52, 1); raiz.add(m); };
  pufe(-1.8, -4.3, 0x6b3fa0); pufe(-1.0, -4.5, 0xe8804a);
  const dorminhoco = sprite(spriteFrente({ pele: '#e8b894', cabelo: '#3a3a44', camisa: '#e8c84a', calca: '#3a2f45' }), .42, .63, -1.8, .5, -4.2);
  dorminhoco.material.rotation = Math.PI / 2; raiz.add(dorminhoco);
  const zz = new THREE.Sprite(new THREE.SpriteMaterial({ map: balaoEstado('sono'), transparent: true, depthTest: false }));
  zz.scale.set(.24, .24, 1); zz.renderOrder = 2; raiz.add(zz);
  animados.push((t) => { const k = (t * .35) % 1; zz.position.set(-1.65 + k * .15, .85 + k * .45, -4.2); zz.material.opacity = 1 - k; });
  const abajur = new THREE.PointLight(0x8a7bff, .8, 2.5, 2); abajur.position.set(-1.4, .9, -4.0); raiz.add(abajur);

  /* ---------------------------------------------------------- servidor -- */
  raiz.add(peca(caixa(.62, 2.0, .6, .02), new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: .35, metalness: .7 }), 5.75, 1.0, -4.75));
  const leds = [];
  for (let r = 0; r < 9; r++) for (let k = 0; k < 4; k++) {
    const m = new THREE.MeshBasicMaterial({ color: 0x5bff8a, toneMapped: false });
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.025, .015), m); l.position.set(5.55 + k * .05, .35 + r * .18, -4.44); raiz.add(l); leds.push(m);
  }
  animados.push((t) => leds.forEach((m, i) => { const v = Math.sin(t * (3 + (i % 5)) + i * 1.7); m.color.setHex(v > .6 ? 0x5bff8a : v > -.2 ? 0x1f6a46 : (i % 7 === 0 ? 0xe8b44a : 0x0d2a1a)); }));

  /* ------------------------------------------ dutos e pulsos de estado -- */
  // da sala de reuniao e do pod ate o monitor principal: cada pulso e um
  // evento de estado chegando (o SSE do projeto)
  const rotas = [
    [[5.2, 2.75, -2.0], [2.0, 2.75, -1.6], [0, 2.75, -.2], [0, 1.6, -.2]],
    [[2.7, 2.75, -4.3], [2.0, 2.75, -1.6]],
    [[.2, 2.75, -3.9], [0, 2.75, -.2]]
  ].map((pts) => pts.map((p) => new THREE.Vector3(...p)));
  const duto = new THREE.MeshStandardMaterial({ color: 0x2a2833, roughness: .5, metalness: .6 });
  rotas.forEach((pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.BoxGeometry(.08, .04, len), duto);
      m.position.copy(a).lerp(b, .5); m.lookAt(b); raiz.add(m);
    }
  });
  const coresPulso = [0x5bff8a, 0xff5a4a, 0xffc84a, 0x7ec8e3, 0xff9a5a];
  const pulsos = [];
  for (let k = 0; k < 14; k++) {
    const rota = rotas[k % rotas.length];
    const comp = []; let tot = 0;
    for (let i = 0; i < rota.length - 1; i++) { const d = rota[i].distanceTo(rota[i + 1]); comp.push(d); tot += d; }
    const m = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .14), new THREE.MeshBasicMaterial({ color: coresPulso[k % coresPulso.length], toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    raiz.add(m); pulsos.push({ m, rota, comp, tot, fase: k / 14, vel: .16 + (k % 3) * .04 });
  }
  const _p = new THREE.Vector3();
  animados.push((t) => pulsos.forEach((p) => {
    let d = ((t * p.vel + p.fase) % 1) * p.tot, i = 0;
    while (i < p.comp.length - 1 && d > p.comp[i]) { d -= p.comp[i]; i++; }
    _p.copy(p.rota[i]).lerp(p.rota[i + 1], Math.min(1, d / p.comp[i]));
    p.m.position.copy(_p); p.m.lookAt(p.rota[i + 1]);
  }));

  /* ---------------------------------------------- luminarias e plantas -- */
  const cupula = new THREE.MeshStandardMaterial({ color: 0x1e1a22, roughness: .4, metalness: .5, side: THREE.DoubleSide });
  const lampada = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  [[.35, -1.6], [1.65, -1.6], [2.95, -1.55], [2.7, -3.7], [.2, -3.95]].forEach(([x, z]) => {
    raiz.add(peca(new THREE.CylinderGeometry(.005, .005, 1.6), grafite, x, 3.2, z));
    raiz.add(peca(new THREE.ConeGeometry(.22, .2, 20, 1, true), cupula, x, 2.32, z));
    const lp = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), lampada); lp.position.set(x, 2.25, z); raiz.add(lp);
  });
  const quente = new THREE.PointLight(0xffb070, 2.2, 5.5, 1.6); quente.position.set(1.4, 2.1, -1.6); raiz.add(quente);

  const vaso = new THREE.MeshStandardMaterial({ color: 0xc75f30, roughness: .7 });
  const folha = new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: .7 });
  [[-.75, -2.35, 1], [3.8, -2.6, 1.3], [4.0, -4.6, 1], [-2.6, -4.8, 1.4], [5.9, -.4, 1.2]].forEach(([x, z, e]) => {
    raiz.add(peca(new THREE.CylinderGeometry(.16 * e, .12 * e, .34 * e, 16), vaso, x, .17 * e, z));
    for (let k = 0; k < 8; k++) {
      const f = peca(new THREE.ConeGeometry(.06 * e, (.55 + (k % 3) * .12) * e, 6), folha, x + Math.cos(k) * .07 * e, .55 * e, z + Math.sin(k) * .07 * e);
      f.rotation.set(Math.sin(k * 2.3) * .45, 0, Math.cos(k * 1.7) * .45); raiz.add(f);
    }
  });

  // quadro com o grafico de status (o do app), entre as janelas
  let qPasso = 0;
  const grafico = tex(256, 160, (c, w, h) => {
    c.fillStyle = '#f3efe8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2a2430'; c.font = '700 14px Silkscreen, monospace'; c.fillText('AGORA', 12, 22);
    const vals = [5 + (qPasso % 3), 2, 1 + ((qPasso >> 1) % 2), 1];
    ['#5bbf6a', '#e84a4a', '#4f7fd9', '#8a8494'].forEach((cor, i) => { c.fillStyle = cor; const bh = vals[i] * 14; c.fillRect(24 + i * 56, h - 18 - bh, 36, bh); });
    c.fillStyle = '#2a2430'; c.fillRect(14, h - 18, w - 28, 2);
  });
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .62), new THREE.MeshStandardMaterial({ map: grafico, roughness: .35 }));
  quadro.position.set(-.4, 1.95, Z + .03); raiz.add(quadro);
  raiz.add(peca(new THREE.BoxGeometry(1.06, .68, .02), grafite, -.4, 1.95, Z + .015));
  let proxQuadro = 0;
  animados.push((t) => { if (t >= proxQuadro) { proxQuadro = t + 3; qPasso++; grafico.userData.redesenhar(); } });

  /* ------------------------------------------------ quem anda e o gato -- */
  const cor = { pele: '#e0a77f', cabelo: '#141018', camisa: '#c75fa8', calca: '#2c3550' };
  const passos = [spriteFrente(cor, 0), spriteFrente(cor, 1)];
  const andando = sprite(passos[0], .66, 1.0, 1, .5, -2.95);
  raiz.add(andando);
  animados.push((t) => {
    const ida = (t * .07) % 2, k = ida < 1 ? ida : 2 - ida;
    andando.position.x = .6 + k * 3.2; andando.position.y = .5 + Math.abs(Math.sin(t * 8)) * .015;
    andando.material.map = passos[Math.floor(t * 4) % 2];
    andando.scale.x = ida < 1 ? .66 : -.66;
  });
  const gatoTex = texPixel(16, 10, (c) => {
    const px = (x, y, w, h, cr) => { c.fillStyle = cr; c.fillRect(x, y, w, h); };
    px(3, 3, 9, 4, '#e8954a'); px(11, 1, 4, 4, '#e8954a'); px(11, 0, 1, 1, '#e8954a'); px(14, 0, 1, 1, '#e8954a');
    px(12, 2, 1, 1, '#1a1020'); px(14, 2, 1, 1, '#1a1020'); px(0, 2, 3, 1, '#e8954a'); px(0, 1, 1, 1, '#e8954a');
    px(4, 7, 1, 2, '#c8743a'); px(10, 7, 1, 2, '#c8743a'); px(5, 4, 1, 3, '#c8743a'); px(8, 4, 1, 3, '#c8743a');
  });
  const gato = sprite(gatoTex, .32, .2, 1.5, .1, -.42); raiz.add(gato);
  animados.push((t) => {
    const ida = (t * .12) % 2, k = ida < 1 ? ida : 2 - ida;
    gato.position.x = .8 + k * 2.6; gato.position.y = .1 + Math.abs(Math.sin(t * 8)) * .01;
    gato.scale.x = ida < 1 ? .32 : -.32;
  });

  let proxCeu = 0;
  return {
    raiz,
    atualizar(t) {
      telas.forEach((s) => { if (t >= s.prox) { s.prox = t + s.ritmo; s.tex.userData.passo(); } });
      baloes.forEach(({ b, fase, estado, y }) => {
        b.position.y = y + Math.abs(Math.sin(t * 3 + fase)) * .05;
        b.material.opacity = estado === 'pergunta' ? (Math.sin(t * 6) > -.3 ? 1 : .35) : 1;
      });
      pessoas.forEach((p) => { p.sp.position.y = p.y + (p.estado === 'codigo' || p.estado === 'terminal' ? Math.abs(Math.sin(t * 9 + p.fase)) * .008 : 0); });
      animados.forEach((f) => f(t));
      if (t >= proxCeu) { proxCeu = t + 1.6; ceu.userData.piscar(); }
      luzNeon.intensity = 2.1 + (Math.sin(t * 23) > .97 ? -1 : 0);
    },
    destruir() { descartar(raiz); }
  };
}
