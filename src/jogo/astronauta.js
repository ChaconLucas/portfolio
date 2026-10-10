import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { montarArma } from './armas3d.js';

/**
 * O astronauta (Quaternius, "Astronaut", CC0 — public/assets/jogo/
 * astronauta.glb, enxugado: Idle_Neutral, Idle, Walk, Run, Run_Back,
 * Run_Left, Run_Right, Roll, Wave, Interact, Idle_Gun_Pointing,
 * Idle_Gun_Shoot, Run_Shoot, Gun_Shoot).
 *
 * Locomocao fluida: todos os ciclos (andar, correr, de costas, de lado,
 * correr armado) andam na MESMA fase (0..1), avancada pela velocidade. Assim
 * misturar andar com correr, ou frente com lado, nunca "embaralha" as
 * pernas. Pesos e inclinacoes sao suavizados.
 * No ar: pose parada, corpo inclinado para onde voa (frente/lados) e um leve
 * balanco; o jetpack tem chama e fumaca.
 * Armas: um modelo na mao direita (montado na pose de mira) e a pose armada
 * (parado mirando, correndo com a arma). Frente = +z local.
 */
const ALTURA = 1.85;
const CICLO = ['Walk', 'Run', 'Run_Back', 'Run_Left', 'Run_Right', 'Run_Shoot'];

export async function criarAstronauta(cena) {
  const gltf = await new GLTFLoader().loadAsync('/assets/jogo/astronauta.glb');
  const modelo = gltf.scene;
  modelo.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
  const caixa = new THREE.Box3().setFromObject(modelo);
  modelo.scale.setScalar(ALTURA / (caixa.max.y - caixa.min.y));
  const raiz = new THREE.Group(); raiz.add(modelo); raiz.visible = false;
  cena.add(raiz);

  const mixer = new THREE.AnimationMixer(modelo);
  const clip = (n) => gltf.animations.find((a) => a.name === n || a.name.endsWith('|' + n));
  const LOOP = ['Idle_Neutral', 'Idle', 'Idle_Gun_Pointing', ...CICLO];
  const acao = {}, peso = {};
  LOOP.forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0); acao[n] = a; peso[n] = n === 'Idle_Neutral' ? 1 : 0; });
  // armado, o corpo se divide: as PERNAS seguem os ciclos de passo (copias so
  // com os ossos de baixo) e o TRONCO (bracos, peito, cabeca) fica sempre na
  // pose de mira. Antes, de costas e de lado os bracos balancavam como se nao
  // houvesse arma (e na primeira pessoa a arma saia da tela).
  const CIMA = /^(Abdomen|Torso|Chest|Neck|Head|Shoulder|UpperArm|LowerArm|Wrist|Index|Middle|Ring|Pinky|Thumb)/;
  const soOs = (c, cima, nome) => { const k = c.clone(); k.name = nome; k.tracks = k.tracks.filter((t) => CIMA.test(t.name.split('.')[0]) === cima); return k; };
  CICLO.forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(soOs(c, false, 'P_' + n)); a.play(); a.setEffectiveWeight(0); acao['P_' + n] = a; peso['P_' + n] = 0; LOOP.push('P_' + n); });
  { const c = clip('Idle_Gun_Pointing'); if (c) { const a = mixer.clipAction(soOs(c, true, 'TRONCO')); a.play(); a.setEffectiveWeight(0); acao.TRONCO = a; peso.TRONCO = 0; LOOP.push('TRONCO'); } }
  // ciclos de passo: o tempo e controlado a mao (fase comum)
  CICLO.forEach((n) => { if (acao[n]) acao[n].timeScale = 0; if (acao['P_' + n]) acao['P_' + n].timeScale = 0; });
  ['Wave', 'Interact', 'Roll', 'Idle_Gun_Shoot', 'Gun_Shoot'].forEach((n) => { const c = clip(n); if (!c) return; const a = mixer.clipAction(c); a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; acao[n] = a; });
  let gesto = null;

  /* ---- armas na mao direita ---- */
  const mao = modelo.getObjectByName('WristR') || modelo.getObjectByName('Wrist.R');
  const armas = {};   // modelos detalhados (armas3d.js)
  const _PUNHO = new THREE.Vector3(-.015, .0, .07);   // do pulso ao meio do punho fechado (na pose de mira)
  // monta as armas na pose de mira: alinhadas com a frente do corpo, na mao
  if (mao && acao.Idle_Gun_Pointing) {
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Gun_Pointing' ? 1 : 0));
    mixer.update(0); modelo.updateMatrixWorld(true);
    const p = new THREE.Vector3(); mao.getWorldPosition(p);
    ['blaster', 'rifle', 'canhao', 'espada'].forEach((t) => {
      // o cabo vai no meio do punho fechado (medido: ~7 cm a frente do pulso), nao no pulso
      const g = montarArma(t); g.position.copy(p).add(_PUNHO); raiz.add(g); raiz.updateMatrixWorld(true); mao.attach(g); g.userData.fixarBase(); armas[t] = g;
    });
    LOOP.forEach((n) => acao[n] && acao[n].setEffectiveWeight(n === 'Idle_Neutral' ? 1 : 0));
  }
  let armaAtual = null;

  /* ---- as duas maos na arma: o braco esquerdo vai ate a empunhadura da
     frente (IK de dois ossos: ombro e cotovelo) e os dedos fecham ---- */
  const osso = (n) => modelo.getObjectByName(n);
  const braco = { clavicula: osso('ShoulderL'), ombro: osso('UpperArmL'), cotovelo: osso('LowerArmL'), pulso: osso('WristL') };
  const dedos = ['Index', 'Middle', 'Ring', 'Pinky'].flatMap((d) => ['1L', '2L', '3L', '1R', '2R', '3R'].map((n) => d + n)).map(osso).filter(Boolean);
  const bracoR = { clavicula: osso('ShoulderR'), ombro: osso('UpperArmR'), cotovelo: osso('LowerArmR'), pulso: osso('WristR') };
  const polegares = ['Thumb1L', 'Thumb2L', 'Thumb1R', 'Thumb2R'].map(osso).filter(Boolean);
  // pose de repouso dos dedos: volta a ela antes da animacao (algumas animacoes
  // nao mexem nos dedos, e a curva se acumularia quadro a quadro)
  const repouso = new Map([...dedos, ...polegares].map((o) => [o, o.quaternion.clone()]));
  const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _W = new THREE.Vector3(), _T = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _en = new THREE.Vector3();
  const _qa = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _id = new THREE.Quaternion(), _qd = new THREE.Quaternion();
  let ikPeso = 0;
  // gira um osso (no mundo) para que a direcao "de" vire "para", com peso
  // (a conta e feita no espaco do PAI do osso: o esqueleto tem reflexao, e com
  // quaternions no mundo o giro saia ao contrario)
  const _inv = new THREE.Matrix4();
  function girar(o, de, para, k) {
    _inv.copy(o.parent.matrixWorld).invert();
    de.transformDirection(_inv); para.transformDirection(_inv);
    _qw.setFromUnitVectors(de, para); _qa.copy(_id).slerp(_qw, Math.min(1, k));   // (_qw separado: usar o mesmo quaternion dos dois lados zerava o giro)
    o.quaternion.premultiply(_qa);
    o.updateWorldMatrix(false, true);
  }
  const maoEsquerdaNa = (alvo, k) => maoNa(braco, alvo, k);
  // EMPUNHAR um cabo: o meio do punho fechado (~7 cm a frente do pulso) vai ate
  // o ponto e o pulso gira para a mao envolver o cabo — a linha dos nos dos
  // dedos (indicador -> minimo) fica ao longo do eixo do cabo e a mao aponta
  // para "frente". (So mover o pulso deixava a mao virada como na pose parada.)
  const dedosE = { raiz: osso('Middle1L'), a: osso('Index2L'), b: osso('Pinky2L') }, dedosD = { raiz: osso('Middle1R'), a: osso('Index2R'), b: osso('Pinky2R') };
  const _ht = new THREE.Vector3(), _hw = new THREE.Vector3(), _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _hf = new THREE.Vector3(), _hs = new THREE.Vector3(), _he = new THREE.Vector3(), _hn = new THREE.Vector3();
  function empunhar(br, dd, alvo, eixo, frente, k) {
    if (!br.pulso || !dd.raiz || !dd.a || !dd.b || k < .01) return;
    _hn.copy(frente).addScaledVector(eixo, -frente.dot(eixo)).normalize();       // frente perpendicular ao cabo
    maoNa(br, _ht.copy(alvo).addScaledVector(_hn, -.07), k);
    modelo.updateMatrixWorld(true);
    br.pulso.getWorldPosition(_hw); dd.raiz.getWorldPosition(_h1); _hf.subVectors(_h1, _hw).normalize();
    girar(br.pulso, _hf.clone(), _hn.clone(), k);
    dd.a.getWorldPosition(_h1); dd.b.getWorldPosition(_h2); _hs.subVectors(_h1, _h2); _hs.addScaledVector(_hn, -_hs.dot(_hn));
    if (_hs.lengthSq() < 1e-8) return;
    _he.copy(eixo).addScaledVector(_hn, -eixo.dot(_hn));
    girar(br.pulso, _hs.normalize().clone(), _he.normalize().clone(), k);
  }
  // IK de dois ossos (qualquer braco): o pulso vai ate o alvo
  function maoNa(braco, alvo, k) {
    const { clavicula, ombro, cotovelo, pulso } = braco; if (!ombro || !cotovelo || !pulso || k < .01) return;
    ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W); _T.copy(alvo);
    let a = _S.distanceTo(_E), b = _E.distanceTo(_W);
    // longe demais: a clavicula leva o ombro um pouco para a frente (como quem
    // estica o braco para segurar a arma)
    if (clavicula && _S.distanceTo(_T) > (a + b) * .97) {
      clavicula.getWorldPosition(_p);
      girar(clavicula, _S.clone().sub(_p), _T.clone().sub(_p), k * .45);
      ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    }
    let d = _S.distanceTo(_T); d = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, d));
    _n.subVectors(_T, _S).normalize();
    // cotovelo dobra para o lado em que ja esta (e um pouco para baixo)
    _p.subVectors(_E, _S); _p.addScaledVector(_n, -_p.dot(_n)); _p.y -= .02;
    if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0); _p.normalize();
    const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    _en.copy(_S).addScaledVector(_n, Math.cos(A) * a).addScaledVector(_p, Math.sin(A) * a);
    girar(ombro, _E.clone().sub(_S), _en.clone().sub(_S), k);
    cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    girar(cotovelo, _W.clone().sub(_E), _T.clone().sub(_E), k);
  }
  // fecha os dedos (por cima da animacao, que os reposiciona todo quadro)
  function fecharDedos(k) {
    if (k < .01) return;
    _qd.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.5 * k);   // cada falange: punho bem fechado
    for (const o of dedos) { o.quaternion.multiply(_qd); }
    _qd.setFromAxisAngle(new THREE.Vector3(0, 0, 1), .8 * k);
    for (const o of polegares) o.quaternion.multiply(_qd);
  }
  // sabre em guarda: cotovelo direito dobrado e baixo, antebraco cruzando na
  // frente do corpo (a lamina sobe na diagonal; a esquerda segura o pomo pelo IK)
  const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _d = new THREE.Vector3();
  // aponta o braco direito: direcao do braco e do antebraco no espaco do corpo
  // ([cima, frente, esquerda]); a arma (presa no pulso) segue o antebraco
  let miraBraco = 0;
  function bracoDireito(sup, ante, k) {
    const { ombro, cotovelo, pulso } = bracoR; if (!ombro || !cotovelo || !pulso || k < .01) return;
    modelo.updateMatrixWorld(true);
    _f.set(0, 0, 1).transformDirection(raiz.matrixWorld); _l.set(1, 0, 0).transformDirection(raiz.matrixWorld);
    ombro.getWorldPosition(_S); cotovelo.getWorldPosition(_E);
    // (as direcoes giram com a mira: olhando para cima, o braco sobe junto)
    _d.set(0, sup[0], 0).addScaledVector(_f, sup[1]).addScaledVector(_l, sup[2]).normalize().applyAxisAngle(_l, -miraBraco);
    girar(ombro, _E.clone().sub(_S), _d.clone(), k);
    cotovelo.getWorldPosition(_E); pulso.getWorldPosition(_W);
    _d.set(0, ante[0], 0).addScaledVector(_f, ante[1]).addScaledVector(_l, ante[2]).normalize().applyAxisAngle(_l, -miraBraco);
    girar(cotovelo, _W.clone().sub(_E), _d.clone(), k);
  }
  const guardaSabre = (k) => bracoDireito([-.8, .45, .12], [.3, .8, .5], k);
  // correndo (Shift): pistola e sabre sobem numa mao so, perto do ombro;
  // armas grandes descem na diagonal na frente do corpo, com as duas maos
  const pequena = (t) => t === 'blaster' || t === 'espada';
  // (na primeira pessoa a pose e mais contida, para a arma continuar na tela)
  let fp = false, fpVM = true, pilotandoAte = -1;
  // primeira pessoa: o que fica numa esfera em volta do peito e dos ombros some
  // (o shader descarta), sobrando antebracos, maos e arma — sem o "toco" do
  // ombro cortado aparecendo embaixo da tela
  const corte = { uCorteC: { value: new THREE.Vector3() }, uCorteR: { value: 0 } };
  function cortarMaterial(m) {
    if (m.userData.corte) return; m.userData.corte = true;
    const antes = m.onBeforeCompile, chave = m.customProgramCacheKey;
    m.onBeforeCompile = (sh, r) => {
      antes?.call(m, sh, r);
      sh.uniforms.uCorteC = corte.uCorteC; sh.uniforms.uCorteR = corte.uCorteR;
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vCorteW;\nvoid main() {').replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvCorteW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uCorteC; uniform float uCorteR; varying vec3 vCorteW;\nvoid main() {\nif (uCorteR > 0. && distance(vCorteW, uCorteC) < uCorteR) discard;');
    };
    m.customProgramCacheKey = () => (chave ? chave.call(m) : '') + '|corte';
    m.needsUpdate = true;
  }
  const _cc = new THREE.Vector3();
  const correrPequena = (k) => (fp ? bracoDireito([-.6, .7, -.05], [.7, .65, .2], k) : bracoDireito([-.85, .2, -.18], [.92, .3, .08], k));
  // armas longas (rifle, canhao): braco direito recolhido (arma perto do peito,
  // coronha no ombro) e o pulso corrige para a arma apontar para a mira; assim
  // a mao esquerda alcanca a empunhadura da frente (esticada, faltavam ~15 cm)
  const longa = (t) => t === 'rifle' || t === 'canhao';
  const _af = new THREE.Vector3(), _ad = new THREE.Vector3();
  function apontarArma(k, mira) {
    const ar = armas[armaAtual]; if (!ar || !bracoR.pulso || k < .01) return;
    modelo.updateMatrixWorld(true);
    _af.set(0, 0, 1).transformDirection(ar.matrixWorld);
    _ad.set(0, 0, 1).transformDirection(raiz.matrixWorld).multiplyScalar(Math.cos(mira)); _ad.y += Math.sin(mira);
    girar(bracoR.pulso, _af, _ad.normalize(), k);
  }
  const segurarLonga = (k) => bracoDireito([-.7, .45, -.1], [.3, .65, .65], k);
  const correrGrande = (k) => (fp ? bracoDireito([-.7, .6, .12], [.05, .8, .5], k) : bracoDireito([-.9, .32, .12], [-.45, .72, .55], k));
  let guardaPeso = 0;
  // gira um osso em volta do "para cima" do mundo (o tronco no golpe)
  const _up = new THREE.Vector3(), _lat = new THREE.Vector3();
  function torcer(o, ang, eixo = null) {
    _inv.copy(o.parent.matrixWorld).invert(); (eixo ? _up.copy(eixo) : _up.set(0, 1, 0)).transformDirection(_inv);
    o.quaternion.premultiply(_qa.setFromAxisAngle(_up, ang)); o.updateWorldMatrix(false, true);
  }
  // arremesso: caminho da mao esquerda no espaco do corpo (x = esquerda, z = frente)
  let arremT = -1, arremSegura = false;
  const ARREM = [[0, .2, 1.05, .2], [.12, .28, .95, -.05], [.36, .34, 1.72, -.32], [.5, .18, 1.85, .38], [.72, -.02, 1.2, .5], [1, .2, 1.05, .25]];
  const granadaMao = new THREE.Mesh(new THREE.IcosahedronGeometry(.11, 1), new THREE.MeshStandardMaterial({ color: 0x2a2836, metalness: .7, roughness: .3, emissive: new THREE.Color(0xb36bff), emissiveIntensity: 1.6 }));
  const anelMao = new THREE.Mesh(new THREE.TorusGeometry(.13, .02, 6, 18), new THREE.MeshBasicMaterial({ color: 0xd9a6ff })); granadaMao.add(anelMao);
  granadaMao.visible = false; raiz.add(granadaMao);
  const _ga = new THREE.Vector3(), _ga2 = new THREE.Vector3(), _eixoA = new THREE.Vector3(), _frA = new THREE.Vector3();
  function alvoArremesso(k, out) {
    let i = 1; while (i < ARREM.length - 1 && k > ARREM[i][0]) i++;
    const [k0, x0, y0, z0] = ARREM[i - 1], [k1, x1, y1, z1] = ARREM[i], u = Math.min(1, (k - k0) / (k1 - k0)), e = u * u * (3 - 2 * u);
    return raiz.localToWorld(out.set(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, z0 + (z1 - z0) * e));
  }
  // andamento da recarga de cada arma (0..1), guardado aqui para o desenho
  const recarga = { blaster: -1, rifle: -1, canhao: -1 };   // -1 = sem recarregar; 0..1 = andamento
  let golpeT = -1;

  /* ---- jetpack ---- */
  const jet = new THREE.Group();
  const metalJ = new THREE.MeshStandardMaterial({ color: 0xc9c4d8, metalness: .8, roughness: .3 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x24202e, metalness: .6, roughness: .4 });
  const neon = new THREE.MeshBasicMaterial({ color: 0x9f7bff });
  const bocalGeo = new THREE.CylinderGeometry(.05, .075, .1, 12);
  const chamaGeo = new THREE.ConeGeometry(.07, .5, 12, 1, true); chamaGeo.translate(0, -.25, 0);
  const chamaMat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const nucleoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const chamas = [];
  for (const x of [-.11, .11]) {
    const tanque = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .3, 6, 14), metalJ); tanque.position.set(x, 0, 0); jet.add(tanque);
    const faixa = new THREE.Mesh(new THREE.CylinderGeometry(.088, .088, .03, 14), neon); faixa.position.set(x, .08, 0); jet.add(faixa);
    const bocal = new THREE.Mesh(bocalGeo, escuro); bocal.position.set(x, -.27, 0); jet.add(bocal);
    const ch = new THREE.Mesh(chamaGeo, chamaMat); ch.position.set(x, -.32, 0); jet.add(ch);
    const nu = new THREE.Mesh(chamaGeo, nucleoMat); nu.scale.set(.45, .6, .45); ch.add(nu);
    chamas.push(ch);
  }
  const centro = new THREE.Mesh(new THREE.BoxGeometry(.16, .32, .1), escuro); centro.position.set(0, .02, .03); jet.add(centro);
  const luzJet = new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), neon); luzJet.position.set(0, .12, -.03); jet.add(luzJet);
  modelo.updateMatrixWorld(true);
  jet.position.set(0, 1.22, -.24); jet.rotation.x = .08;
  raiz.add(jet); raiz.updateMatrixWorld(true);
  const tronco = modelo.getObjectByName('Torso') || modelo.getObjectByName('Chest');
  if (tronco) tronco.attach(jet);
  // o tronco gira no golpe do sabre: volta ao repouso todo quadro (nem toda animacao mexe nele)
  if (tronco) repouso.set(tronco, tronco.quaternion.clone());
  // peito: inclina com a mira (para cima/baixo), os bracos e a arma acompanham o olhar
  const peito = osso('Chest'); if (peito) repouso.set(peito, peito.quaternion.clone());
  // primeira pessoa: so a cabeca (capacete) some; o resto do corpo continua
  const cabeca = modelo.getObjectByName('SpaceSuit_Head');

  /* ---- fumaca do jetpack (no mundo) ---- */
  const N = 160, pos = new Float32Array(N * 3), vida = new Float32Array(N), vel = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('vida', new THREE.BufferAttribute(vida, 1));
  const fumaca = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float vida; varying float v; void main(){ v = vida; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = min(40., (1.4 - vida) * 160. / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float v; void main(){ if (v <= 0.) discard; float d = length(gl_PointCoord - .5) * 2.; float a = (1. - d) * v * .5; if (a <= 0.) discard; gl_FragColor = vec4(mix(vec3(.5,.45,.7), vec3(.6,.85,1.), v) * a, a); }'
  }));
  fumaca.frustumCulled = false; cena.add(fumaca);
  let prox = 0, acum = 0, empuxo = 0, fase = 0, metadeAnt = 0, tempo = 0, claraoT = 0;
  const inc = { f: 0, l: 0 };
  const _b = new THREE.Vector3();

  return {
    raiz, fumaca,
    gesto(n) { const a = acao[n]; if (!a) return; a.reset(); a.setEffectiveWeight(1); a.fadeIn(.12); a.play(); gesto = a; },
    get gesticulando() { return !!(gesto && gesto.isRunning()); },
    /** arma na mao: null, 'blaster', 'rifle' ou 'canhao' */
    arma(t) { armaAtual = t && armas[t] ? t : null; for (const k in armas) armas[k].visible = k === armaAtual && tempo >= pilotandoAte; },
    get armaAtual() { return armaAtual; },
    /** posicao da boca da arma no mundo (de onde sai o tiro) */
    boca(out) { const a = armas[armaAtual]; if (!a) return out.copy(raiz.position).setY(raiz.position.y + 1.3); raiz.updateMatrixWorld(true); return a.userData.boca.getWorldPosition(out); },
    /** coice do tiro (animacao rapida por cima) */
    /** um modelo solto da arma (para a visao em primeira pessoa) */
    modeloArma(t) { return montarArma(t); },
    /** andamento da recarga de uma arma (0..1; -1 = parada) */
    recarregar(t, k) { if (t in recarga) recarga[t] = k; },
    /** golpe da espada: o arco da lamina e o braco */
    golpear() { golpeT = 0; },
    /** arremesso da granada com a mao esquerda (pega no cinto, leva para tras
     *  do ombro, joga por cima e o braco acompanha); solta em ~0,3 s */
    arremessar() { arremT = 0; granadaMao.visible = true; },
    /** segurando o G: o braco para la atras (armado) ate soltar */
    segurarGranada(v) { arremSegura = v; },
    /** onde esta a mao esquerda agora (de onde a granada sai) */
    maoEsqPos(out) { return (braco.pulso ? braco.pulso.getWorldPosition(out) : out.copy(raiz.position).setY(raiz.position.y + 1.6)); },
    /** na cabine (chamar depois de atualizar, com raiz ja no assento): as maos
     *  seguram o acelerador (esquerda) e o manche (direita), punhos fechados */
    pilotar(esqW, dirW) {
      pilotandoAte = tempo + .15;
      for (const k in armas) armas[k].visible = false;
      raiz.updateMatrixWorld(true); fecharDedos(1); modelo.updateMatrixWorld(true);
      _eixoA.set(0, 1, 0).transformDirection(raiz.matrixWorld); _frA.set(0, 0, 1).transformDirection(raiz.matrixWorld);   // cabos em pe, maos para a frente
      empunhar(braco, dedosE, esqW, _eixoA, _frA, 1); empunhar(bracoR, dedosD, dirW, _eixoA, _frA, 1);
    },
    /** centro do peito (onde o tronco gira com a mira) */
    peitoPos(out) { return peito ? peito.getWorldPosition(out) : out.copy(raiz.position).setY(raiz.position.y + 1.3); },
    /** o modelo da arma na mao (para o rastro do sabre) */
    armaObj(t) { return armas[t] || null; },
    atirou() {
      const ar = armas[armaAtual]; if (ar) { ar.userData.clarao.material.opacity = 1; ar.userData.clarao.material.rotation = Math.random() * 6; claraoT = .06; }
      const a = acao.Idle_Gun_Shoot; if (!a || (gesto && gesto !== a && gesto.isRunning())) return; a.reset(); a.setEffectiveWeight(1); a.timeScale = 2.2; a.fadeIn(.04); a.play(); gesto = a; },
    /**
     * frente/lado: velocidade LOCAL (m/s, frente = para onde ele olha, lado
     * positivo = esquerda); noChao; jet 0..1. Devolve 'passo' ou 'corrida'
     * quando um pe toca o chao.
     */
    /** primeira pessoa: esconde a cabeca (a camera fica dentro do capacete) */
    /** primeira pessoa: esconde a cabeca e o jetpack e passa o astronauta para a
     *  camada 1 (desenhada na passada da arma, ver desenhar() no index) */
    primeiraPessoa(on, vm = true) {
      if (on) raiz.traverse((o) => { if (o.isSkinnedMesh) for (const m of [].concat(o.material)) cortarMaterial(m); });   // (a pintura do admin troca o material: confere sempre)
      if (on === fp && vm === fpVM) return; fp = on; fpVM = vm;
      if (cabeca) cabeca.visible = !on; jet.visible = !on;
      raiz.traverse((o) => {
        if (o.userData.cabecaAdm) o.visible = !on; o.layers.set(on && vm ? 1 : 0);
      });
    },
    atualizar(dt, { frente = 0, lado = 0, noChao = true, jet: j = 0, mira = 0, corrida = 0 }) {
      tempo += dt; miraBraco = mira;
      if (pilotandoAte > 0 && tempo >= pilotandoAte) { pilotandoAte = -1; for (const k in armas) armas[k].visible = k === armaAtual; }   // saiu da cabine: a arma volta
      if (claraoT > 0) { claraoT -= dt; if (claraoT <= 0) for (const k in armas) armas[k].userData.clarao.material.opacity = 0; }
      // sabre tambem usa a pose armada: as duas maos no cabo, lamina em guarda
      // correndo com arma pequena: corpo de corrida normal (braco esquerdo solto)
      const v = Math.hypot(frente, lado), soltaEsq = corrida > .5 && pequena(armaAtual), armado = !!armaAtual && !soltaEsq;
      const alvo = {}; LOOP.forEach((n) => { alvo[n] = 0; });
      if (!noChao) {
        alvo[armado ? 'Idle_Gun_Pointing' : 'Idle'] = 1;   // voando armado: continua com a arma erguida
      } else if (v < .25) {
        alvo[armado ? 'Idle_Gun_Pointing' : 'Idle_Neutral'] = 1;
      } else {
        const f = Math.max(0, frente) / v, b = Math.max(0, -frente) / v, l = Math.max(0, lado) / v, r = Math.max(0, -lado) / v;
        const corre = Math.min(1, Math.max(0, (v - 2.6) / 2.8)), anda = Math.min(1, v / 1.1);
        const pre = armado ? 'P_' : '';   // armado: so as pernas andam; o tronco segue na mira
        alvo[pre + 'Walk'] = f * (1 - corre) * anda; alvo[pre + 'Run'] = f * corre * anda;
        alvo[pre + 'Run_Back'] = b * anda; alvo[pre + 'Run_Left'] = l * anda; alvo[pre + 'Run_Right'] = r * anda;
        alvo[armado ? 'Idle_Gun_Pointing' : 'Idle_Neutral'] = 1 - anda;
        if (armado) alvo.TRONCO = anda;
      }
      let g = 0;
      if (gesto) { if (gesto.isRunning()) g = Math.min(1, gesto.time * 10, (gesto.getClip().duration - gesto.time) * 8); else gesto = null; }
      // o tiro so mexe nos bracos de verdade parado; correndo, o coice e leve
      if (gesto === acao.Idle_Gun_Shoot && v > .5) g *= .35;
      const k = 1 - Math.exp(-dt * 7);
      for (const n of LOOP) { if (!acao[n]) continue; peso[n] += (alvo[n] - peso[n]) * k; acao[n].setEffectiveWeight(peso[n] * (1 - g)); }
      // fase comum dos ciclos: andar ~1 passo duplo/s a 1,6 m/s; correr mais rapido
      // ritmo do passo pela PASSADA de cada animacao (metros por ciclo): andar
      // ~1,5 m/s e correr ~5,2 m/s na velocidade natural do clipe. De lado e de
      // costas usam clipes de corrida, entao a passada de corrida vale para eles
      if (noChao && v > .05) {
        const dW = acao.Walk ? acao.Walk.getClip().duration : 1, dR = acao.Run ? acao.Run.getClip().duration : .7;
        const passadaW = 1.5 * dW, passadaR = 5.2 * dR;
        const naoFrente = v > 0 ? (Math.max(0, -frente) + Math.abs(lado)) / (Math.abs(frente) + Math.abs(lado) + 1e-6) : 0;
        const kCorre = Math.max(naoFrente, Math.min(1, Math.max(0, (v - 2.6) / 2.8)));
        // devagar demais com passada de corrida fica "arrastado": encurta a passada
        const passada = (passadaW + (passadaR - passadaW) * kCorre) * (.55 + .45 * Math.min(1, v / 4));
        fase = (fase + dt * v / passada) % 1;
      }
      for (const n of CICLO) for (const a of [acao[n], acao['P_' + n]]) if (a) a.time = fase * a.getClip().duration;
      for (const [o, q] of repouso) o.quaternion.copy(q);
      mixer.update(dt);
      // no ar: inclina para onde voa (suave) e balanca de leve
      const solto = noChao || fp ? 0 : 1;   // primeira pessoa: o corpo nao inclina no voo (a camera e a arma ficam firmes)
      const alvoF = solto * Math.max(-.5, Math.min(.6, frente * .045)), alvoL = solto * Math.max(-.45, Math.min(.45, -lado * .045));
      const ki = 1 - Math.exp(-dt * 4);
      inc.f += (alvoF - inc.f) * ki; inc.l += (alvoL - inc.l) * ki;
      const bal = solto ? Math.sin(tempo * 2.2) * .04 : 0;
      modelo.rotation.x = inc.f + bal * .5; modelo.rotation.z = inc.l + bal;
      modelo.position.y = solto ? Math.sin(tempo * 1.7) * .05 : 0;
      // jetpack: chama e fumaca
      empuxo += (j - empuxo) * (1 - Math.exp(-dt * 12));
      chamas.forEach((c, i) => { c.visible = empuxo > .03; const tr = 1 + Math.sin(tempo * 60 + i * 2) * .12; c.scale.set(.8 + empuxo * .5, (.3 + empuxo * 1.6) * tr, .8 + empuxo * .5); });
      luzJet.material.color.setHex(empuxo > .05 ? 0x8fd8ff : 0x9f7bff);
      raiz.updateMatrixWorld();
      // armado: a mao esquerda segura a frente da arma (nao no rolamento)
      const rolando = gesto === acao.Roll && gesto?.isRunning();
      ikPeso += ((armado && !rolando && !(corrida > .3 && pequena(armaAtual)) ? 1 : 0) - ikPeso) * (1 - Math.exp(-dt * 10));
      // o peito inclina com a mira (so armado): olhar para cima levanta a arma
      if (peito && Math.abs(mira) > .01) { modelo.updateMatrixWorld(true); torcer(peito, -mira, _lat.set(1, 0, 0).transformDirection(raiz.matrixWorld)); }
      guardaPeso += ((armaAtual === 'espada' && !rolando ? 1 : 0) - guardaPeso) * (1 - Math.exp(-dt * 10));
      if (guardaPeso > .01) { modelo.updateMatrixWorld(true); guardaSabre(guardaPeso); }
      if (longa(armaAtual) && !rolando && armado) { const k = ikPeso * (1 - corrida); segurarLonga(k); apontarArma(k, mira); }
      if (corrida > .01 && armaAtual && !rolando) (pequena(armaAtual) ? correrPequena : correrGrande)(corrida);
      // golpe do sabre (a arma corta e o tronco gira junto) e recarga (a arma
      // vira e a mao esquerda faz a troca da celula) — antes do IK, que segue a mao
      if (golpeT >= 0) {
        golpeT += dt / .45;
        if (golpeT >= 1) { golpeT = -1; armas.espada?.userData.golpe(-1); }
        else {
          armas.espada?.userData.golpe(golpeT);
          const k = golpeT, giro = k < .2 ? -.5 * (k / .2) : k < .45 ? -.5 + 1.15 * ((k - .2) / .25) : .65 * (1 - (k - .45) / .55);
          if (tronco) { modelo.updateMatrixWorld(true); torcer(tronco, giro); }
        }
      }
      for (const k in recarga) armas[k]?.userData.recarga(recarga[k]);
      if (ikPeso > .01 && armas[armaAtual]) {
        fecharDedos(ikPeso); modelo.updateMatrixWorld(true);
        const ar = armas[armaAtual];
        {
          // rifle/canhao: empunhadura da frente; blaster: o cabo, por baixo da direita; sabre: o eixo da lamina
          ar.userData.maoEsq.getWorldPosition(_ga2);
          if (armaAtual === 'espada') { _eixoA.set(0, 1, 0).transformDirection(ar.userData.cabo.matrixWorld); _frA.set(0, 0, 1).transformDirection(ar.matrixWorld); }
          else { _eixoA.set(0, 1, 0).transformDirection(ar.matrixWorld); _frA.set(0, 0, 1).transformDirection(ar.matrixWorld); }
          empunhar(braco, dedosE, _ga2, _eixoA, _frA, ikPeso);
        }
      }
      // arremesso da granada: o tronco gira (carrega para tras, joga para a frente) e o braco esquerdo segue o caminho
      if (arremT >= 0) {
        arremT = arremSegura && arremT >= .36 ? .36 : Math.min(arremSegura ? .36 : 1, arremT + dt / .6);
        if (arremT >= 1) { arremT = -1; granadaMao.visible = false; }
        else {
          const k = arremT, peso = Math.min(1, k * 8, (1 - k) * 6);
          const giro = k < .36 ? .5 * (k / .36) : k < .6 ? .5 - .95 * ((k - .36) / .24) : -.45 * (1 - (k - .6) / .4);
          if (tronco) { modelo.updateMatrixWorld(true); torcer(tronco, giro * peso); }
          modelo.updateMatrixWorld(true);
          if (!armado) fecharDedos(peso);
          maoEsquerdaNa(alvoArremesso(k, _ga), peso);
          granadaMao.visible = k < .5;
          if (granadaMao.visible) { braco.pulso.getWorldPosition(_ga); raiz.worldToLocal(_ga); granadaMao.position.copy(_ga); granadaMao.position.y -= .07; anelMao.rotation.y += dt * 10; }
        }
      }
      // centro da esfera de corte: o peito, na altura dos ombros
      if (fp && fpVM && peito) { peito.getWorldPosition(_cc); corte.uCorteC.value.copy(_cc); corte.uCorteC.value.y += .1; corte.uCorteR.value = .3; } else corte.uCorteR.value = 0;
      acum += dt * empuxo * 120;
      while (acum >= 1) {
        acum -= 1; const i = prox; prox = (prox + 1) % N;
        _b.set((Math.random() < .5 ? -.11 : .11), -.4, 0); jet.localToWorld(_b);
        pos[i * 3] = _b.x; pos[i * 3 + 1] = _b.y; pos[i * 3 + 2] = _b.z;
        vel[i * 3] = (Math.random() - .5) * 1.2; vel[i * 3 + 1] = -4 - Math.random() * 3; vel[i * 3 + 2] = (Math.random() - .5) * 1.2; vida[i] = 1;
      }
      for (let i = 0; i < N; i++) {
        if (vida[i] <= 0) continue; vida[i] -= dt * 1.6;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] *= .94;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.vida.needsUpdate = true;
      // passos: dois por ciclo (fase 0 e 0,5)
      let evento = null;
      if (noChao && v > .6) { const metade = fase < .5 ? 0 : 1; if (metade !== metadeAnt) { metadeAnt = metade; evento = v > 4 ? 'corrida' : 'passo'; } }
      return evento;
    },
    destruir() { cena.remove(raiz); cena.remove(fumaca); mixer.stopAllAction(); geo.dispose(); fumaca.material.dispose(); }
  };
}
