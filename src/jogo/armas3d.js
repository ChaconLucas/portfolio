import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CURVA_GLSL, usarCurva } from './curva.js';

/**
 * Armas (frente = +z, mao direita na origem, +x = esquerda de quem segura).
 *
 * As armas de fogo sao feitas de PERFIS de lado extrudados com chanfro
 * (slide, receptor, coronha, cabo com janela), canos torneados, ceramica
 * clara por cima e metal escuro por baixo, frisos na cor da arma e linhas de
 * energia. A municao e uma CELULA de energia de verdade (tubo de vidro com
 * nucleo brilhando) encaixada num lugar da arma: no cabo (blaster), na frente
 * do gatilho (rifle) ou na lateral (canhao).
 *
 * Espada = sabre de luz: cabo torneado (pomo, empunhadura com aneis, botao,
 * coroa do emissor) e a lamina (nucleo branco + brilho em camadas, com a
 * borda suave). Acende sozinha quando aparece (a lamina cresce do emissor) e
 * e segurada com as DUAS maos.
 *
 * userData:
 *  - boca, clarao: de onde sai o tiro e o sprite do disparo;
 *  - maoEsq: onde a mao esquerda segura (anda sozinho durante a recarga: vai
 *    na celula, puxa, busca outra no cinto, encaixa e da um tapa);
 *  - recarga(k): 0..1 (-1 = parada) — a arma inclina, a celula velha cai
 *    girando, a nova entra e a energia volta a acender;
 *  - golpe(k): corte do sabre (prepara, corta na diagonal, volta a guarda);
 *  - lamina, ponta, baseLamina (sabre): para o rastro de luz;
 *  - fixarBase(): guarda a pose de repouso (quem prende a arma na mao chama).
 * Tambem: criarLuva() (luva do traje, usada na cabine da nave) e
 * criarRastroLamina() (a fita de luz que segue a lamina no golpe).
 */
const COR = { blaster: 0xff4fd8, rifle: 0x4fd2ff, canhao: 0xffa040, espada: 0xff4fd8 };
let _env = null;
/** reflexo do metal (o jogo passa um envMap feito do RoomEnvironment) */
export function ambienteArmas(env) { _env = env; for (const m of _mats) { m.envMap = env; m.needsUpdate = true; } }
const _mats = new Set();
const guardar = (m) => { if (m.isMeshStandardMaterial) { m.envMap = _env; _mats.add(m); } return m; };

// materiais comuns (as cores de cada arma ficam em materiais proprios)
let M = null;
function mats() {
  if (M) return M;
  M = {
    ceramica: guardar(new THREE.MeshPhysicalMaterial({ color: 0xe8e5ef, metalness: .05, roughness: .3, clearcoat: .6, clearcoatRoughness: .25, envMapIntensity: 1 })),
    metal: guardar(new THREE.MeshStandardMaterial({ color: 0x2b2934, metalness: .85, roughness: .34, envMapIntensity: 1.3 })),
    cromo: guardar(new THREE.MeshStandardMaterial({ color: 0xd6d3e2, metalness: 1, roughness: .16, envMapIntensity: 1.6 })),
    borracha: guardar(new THREE.MeshStandardMaterial({ color: 0x17151d, metalness: .1, roughness: .82 })),
    vidro: guardar(new THREE.MeshStandardMaterial({ color: 0xbfd8ff, metalness: 0, roughness: .05, transparent: true, opacity: .28, depthWrite: false, envMapIntensity: 2 })),
    gasta: new THREE.MeshStandardMaterial({ color: 0x2a2630, emissive: 0x2a2630, emissiveIntensity: .2, metalness: .3, roughness: .5 })
  };
  return M;
}

/* ---- formas ---- */
// perfil de lado (pontos [z, y]) extrudado na largura (x), centrado, com chanfro
function perfil(pts, esp, furos = [], chanfro = .0035) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const f of furos) s.holes.push(new THREE.Path(f.map(([z, y]) => new THREE.Vector2(z, y))));
  const d = Math.max(.001, esp - chanfro * 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro * .8, bevelSegments: 2, curveSegments: 6 });
  geo.rotateY(-Math.PI / 2); geo.translate(d / 2, 0, 0);
  return geo;
}
// peca torneada (pontos [raio, y]) no eixo y
const torno = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// o mesmo, deitado no eixo z (canos)
const tornoZ = (pts, seg = 24) => torno(pts, seg).rotateX(Math.PI / 2);
const caixa = (w, h, d, r = .003) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
const por = (pai, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); pai.add(m); return m; };

/* ---- texturas pequenas ---- */
let _claraoTex = null;
function texClarao() {
  if (_claraoTex) return _claraoTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (_claraoTex = new THREE.CanvasTexture(c));
}
// clarao do tiro: estrela com raios finos e miolo branco (nao uma bola borrada)
let _estrela = null;
function texEstrela() {
  if (_estrela) return _estrela;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + (i % 2) * .2, l = i % 2 ? 40 : 62;
    x.save(); x.translate(64, 64); x.rotate(a);
    const r = x.createLinearGradient(0, 0, l, 0); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = r; x.beginPath(); x.moveTo(0, -3.5); x.lineTo(l, 0); x.lineTo(0, 3.5); x.closePath(); x.fill(); x.restore();
  }
  return (_estrela = new THREE.CanvasTexture(c));
}
let _reticulo = null;
function texReticulo() {
  if (_reticulo) return _reticulo;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), cor = '#7ae6ff';
  x.strokeStyle = cor; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 20, 0, 6.3); x.stroke();
  x.fillStyle = cor; x.fillRect(30, 8, 4, 12); x.fillRect(30, 44, 4, 12); x.fillRect(8, 30, 12, 4); x.fillRect(44, 30, 12, 4); x.beginPath(); x.arc(32, 32, 3, 0, 6.3); x.fill();
  return (_reticulo = new THREE.CanvasTexture(c));
}

/* ---- celula de energia: tubo de vidro, nucleo brilhando, tampas de metal
   (eixo y, centrada; a tampa de baixo e a que fica para fora da arma) ---- */
function celula(r, comp, nucleo) {
  const m = mats(), c = new THREE.Group();
  por(c, new THREE.CylinderGeometry(r, r, comp * .78, 18), m.vidro);
  const n = por(c, new THREE.CylinderGeometry(r * .5, r * .5, comp * .74, 10), nucleo);
  for (let i = 0; i < 3; i++) por(c, new THREE.TorusGeometry(r * .82, r * .1, 6, 18), m.cromo, 0, (i - 1) * comp * .22).rotation.x = Math.PI / 2;
  por(c, torno([[0, 0], [r * 1.12, 0], [r * 1.2, comp * .05], [r * 1.05, comp * .11], [r * .9, comp * .11]], 18), m.metal, 0, -comp * .5);   // tampa de baixo (puxador)
  por(c, torno([[r * .9, 0], [r * 1.05, 0], [r * 1.05, comp * .08], [r * .6, comp * .11], [0, comp * .11]], 18), m.cromo, 0, comp * .39);    // tampa de cima (contato)
  c.userData.nucleo = n;
  return c;
}

/* ---- lamina do sabre: shader com o comprimento como uniforme (acende sem
   refazer nada), nucleo branco de borda colorida e camadas de brilho que
   somem nas bordas (mais forte de frente) ---- */
function materialLamina(cor, { nucleo = false, forca = 1, exp = 1.5 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: usarCurva({ uCor: { value: new THREE.Color(cor) }, uLen: { value: 1 }, uA: { value: 1 }, uT: { value: 0 }, uR: { value: 0 }, uL: { value: 1 } }),
    transparent: !nucleo, depthWrite: nucleo, blending: nucleo ? THREE.NormalBlending : THREE.AdditiveBlending, fog: false, toneMapped: false,
    vertexShader: `${CURVA_GLSL}
      uniform float uLen, uR, uL; varying vec3 vN, vV; varying float vY;
      void main(){
        vec3 p = position;
        // capsula: so o corpo estica (as pontas redondas continuam redondas)
        float corpo = clamp(p.y - uR, 0., uL); float resto = p.y - uR - corpo;
        p.y = uR + corpo * uLen + resto; vY = corpo / uL;
        vec4 w = modelMatrix * vec4(p, 1.);
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * curvar(w);
      }`,
    fragmentShader: `uniform vec3 uCor; uniform float uA, uT; varying vec3 vN, vV; varying float vY;
      void main(){
        float f = abs(dot(normalize(vN), normalize(vV)));
        float tremor = .9 + .1 * sin(uT * 47. + vY * 31.) * sin(uT * 23. - vY * 13.);
        ${nucleo
          ? 'vec3 c = mix(uCor * 1.6, vec3(1.), smoothstep(.25, .8, f)); gl_FragColor = vec4(c, 1.);'
          : `float a = pow(f, ${exp.toFixed(2)}) * ${forca.toFixed(2)} * uA * tremor; gl_FragColor = vec4((uCor + vec3(.25) * f * f) * a, a);`}
      }`
  });
}

export function montarArma(tipo) {
  const m = mats();
  const g = new THREE.Group(), cor = new THREE.Color(COR[tipo]);
  const friso = guardar(new THREE.MeshStandardMaterial({ color: cor, metalness: .5, roughness: .32, envMapIntensity: 1.2 }));
  const energia = new THREE.MeshStandardMaterial({ color: cor, emissive: cor, emissiveIntensity: 2.4, metalness: 0, roughness: .4, toneMapped: false });
  const nucleoCel = new THREE.MeshBasicMaterial({ color: cor.clone().lerp(new THREE.Color(1, 1, 1), .35), toneMapped: false });
  let boca = new THREE.Vector3(0, .06, .3);
  const maoEsq = new THREE.Object3D(); maoEsq.name = 'maoEsq';
  let cel = null, casa = null, saida = new THREE.Vector3(0, -1, 0);   // celula, onde ela mora e para onde sai

  const gatilho = (z, y) => {
    por(g, perfil([[z, y], [z + .06, y], [z + .062, y - .02], [z + .046, y - .036], [z + .004, y - .036]], .012, [[[z + .008, y - .006], [z + .052, y - .006], [z + .042, y - .028], [z + .01, y - .029]]], .002), m.metal);
    por(g, caixa(.007, .024, .008, .003), friso, 0, y - .014, z + .026).rotation.x = .35;
  };
  const cabo = (z = 0) => por(g, perfil([[z - .05, .015], [z + .014, .015], [z + .002, -.04], [z - .01, -.098], [z - .048, -.106], [z - .066, -.092], [z - .062, -.03]], .042,
    [[[z - .04, -.012], [z - .013, -.012], [z - .02, -.072], [z - .044, -.074]]]), m.borracha);

  if (tipo === 'blaster') {
    // pistola: slide de ceramica, armacao escura, cano torneado com emissor,
    // respiros acesos e a celula dentro do cabo (aparece pela janela)
    por(g, perfil([[-.07, .046], [-.073, .076], [-.06, .099], [.11, .099], [.152, .089], [.176, .068], [.176, .05], [.09, .046]], .05), m.ceramica);
    por(g, perfil([[-.066, .05], [.172, .05], [.172, .031], [.12, .022], [.05, .013], [-.04, .013], [-.066, .026]], .044), m.metal);
    cabo(0); gatilho(.0, .016);
    por(g, tornoZ([[0, 0], [.015, 0], [.015, .05], [.019, .055], [.019, .074], [.022, .079], [.022, .09], [.012, .093], [0, .093]]), m.metal, 0, .068, .1);
    por(g, new THREE.TorusGeometry(.016, .0035, 8, 24), energia, 0, .068, .19);
    for (let i = 0; i < 4; i++) for (const lx of [-1, 1]) por(g, caixa(.002, .012, .016, .001), energia, lx * .0285, .072, .015 + i * .024);
    por(g, caixa(.012, .007, .13, .002), m.metal, 0, .102, .04);                                   // trilho
    por(g, caixa(.004, .004, .1, .001), energia, 0, .1065, .04);                                  // linha de energia
    por(g, caixa(.03, .012, .012, .003), m.metal, 0, .107, -.05);                                 // massa de mira
    por(g, caixa(.006, .012, .01, .002), friso, 0, .107, .15);
    por(g, caixa(.057, .02, .014, .003), friso, 0, .07, .132);                                   // anel colorido
    cel = celula(.012, .1, nucleoCel); cel.position.set(0, -.048, -.031); cel.rotation.x = .1; g.add(cel);
    saida.set(0, -Math.cos(.1), -Math.sin(.1));
    maoEsq.position.set(-.03, -.075, .01); boca.set(0, .068, .2);
  } else if (tipo === 'rifle') {
    // rifle de plasma: receptor de ceramica, guarda-mao com respiros, cano com
    // freio de boca, coronha vazada, mira holografica e a celula na frente do gatilho
    por(g, perfil([[-.15, .062], [-.14, .096], [-.05, .106], [-.005, .121], [.22, .121], [.27, .1], [.27, .062]], .056), m.ceramica);
    por(g, perfil([[-.15, .064], [.27, .064], [.27, .026], [.2, .012], [.12, .006], [.04, .008], [-.06, .008], [-.15, .03]], .05), m.metal);
    por(g, perfil([[.26, .112], [.47, .104], [.49, .085], [.49, .036], [.47, .022], [.26, .02]], .052), m.metal);
    for (let i = 0; i < 5; i++) for (const lx of [-1, 1]) por(g, caixa(.002, .028, .014, .001), energia, lx * .0285, .066, .3 + i * .034);
    por(g, caixa(.006, .004, .2, .001), energia, 0, .108, .37);
    por(g, tornoZ([[0, 0], [.016, 0], [.016, .1], [.022, .105], [.022, .135], [.018, .138], [.022, .142], [.022, .17], [.024, .175], [.024, .19], [.012, .193], [0, .193]]), m.metal, 0, .062, .47);
    for (let i = 0; i < 3; i++) for (const lx of [-1, 1]) por(g, caixa(.004, .006, .007, .001), energia, lx * .023, .062, .618 + i * .012);
    por(g, new THREE.TorusGeometry(.018, .0035, 8, 24), energia, 0, .062, .664);
    por(g, perfil([[-.14, .1], [-.3, .088], [-.36, .085], [-.376, .06], [-.376, -.03], [-.36, -.062], [-.33, -.062], [-.25, -.01], [-.14, .022]], .044,
      [[[-.3, .062], [-.22, .066], [-.215, .034], [-.29, .002], [-.33, .002], [-.336, .04]]]), m.ceramica);
    por(g, caixa(.05, .155, .02, .006), m.borracha, 0, .012, -.384);
    por(g, caixa(.062, .008, .16, .002), friso, 0, .084, .1);
    cabo(0); gatilho(.0, .012);
    por(g, perfil([[.044, .012], [.118, .012], [.118, -.012], [.044, -.012]], .05), m.metal);  // poco da celula
    por(g, perfil([[.215, .022], [.258, .022], [.25, -.07], [.226, -.076], [.214, -.062]], .034), m.borracha);   // empunhadura da frente
    // mira holografica: base, moldura (vista de tras) e o reticulo no vidro
    por(g, caixa(.03, .012, .07, .003), m.metal, 0, .128, .08);
    const mold = new THREE.Shape(); mold.moveTo(-.024, 0); mold.lineTo(.024, 0); mold.lineTo(.024, .036); mold.lineTo(.016, .044); mold.lineTo(-.016, .044); mold.lineTo(-.024, .036);
    const fura = new THREE.Path(); fura.moveTo(-.018, .006); fura.lineTo(.018, .006); fura.lineTo(.018, .033); fura.lineTo(.013, .038); fura.lineTo(-.013, .038); fura.lineTo(-.018, .033); mold.holes.push(fura);
    por(g, new THREE.ExtrudeGeometry(mold, { depth: .008, bevelEnabled: true, bevelSize: .0015, bevelThickness: .0015, bevelSegments: 1 }), m.metal, 0, .132, .1);
    por(g, new THREE.PlaneGeometry(.036, .032), new THREE.MeshBasicMaterial({ map: texReticulo(), transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), 0, .153, .104);
    cel = celula(.019, .13, nucleoCel); cel.position.set(0, -.05, .081); cel.rotation.x = -.18; g.add(cel);
    saida.set(0, -Math.cos(.18), Math.sin(.18));
    maoEsq.position.set(-.008, -.04, .236); boca.set(0, .062, .665);
  } else if (tipo === 'canhao') {
    // canhao de ions: tubo grosso com bobinas acesas, capo de ceramica, boca
    // larga e a celula grande encaixada na lateral esquerda
    por(g, tornoZ([[0, 0], [.05, 0], [.06, .02], [.06, .48], [.07, .5], [.078, .54], [.06, .55], [.045, .54], [0, .54]], 28), m.metal, 0, .05, -.18);
    for (let i = 0; i < 4; i++) por(g, new THREE.TorusGeometry(.061, .008, 8, 28), energia, 0, .05, .02 + i * .06);
    por(g, new THREE.TorusGeometry(.068, .005, 8, 28), energia, 0, .05, .345);
    por(g, perfil([[-.17, .09], [-.1, .136], [.26, .136], [.31, .11], [.31, .085], [-.17, .085]], .1), m.ceramica);
    por(g, perfil([[-.17, .02], [.05, .02], [.05, -.0], [-.17, -.005]], .08), m.metal);
    por(g, caixa(.104, .012, .2, .003), friso, 0, .12, .07);
    por(g, caixa(.016, .005, .3, .002), energia, 0, .139, .07);
    for (const lx of [-1, 1]) por(g, caixa(.003, .003, .36, .001), m.metal, lx * .03, .1375, .06);   // juntas do capo
    // placas laterais de ceramica (cobrem a traseira do tubo) com respiros acesos
    for (const lx of [-1, 1]) {
      por(g, perfil([[-.17, -.005], [-.02, -.005], [.04, .03], [.04, .09], [-.17, .09]], .012), m.ceramica, lx * .062, 0, 0);
      for (let i = 0; i < 3; i++) por(g, caixa(.004, .03, .008, .001), energia, lx * .069, .045, -.14 + i * .022);
    }
    por(g, torno([[0, 0], [.064, 0], [.068, .012], [.05, .02], [.03, .02], [0, .022]], 28).rotateX(-Math.PI / 2), m.cromo, 0, .05, -.18);   // tampa de tras
    por(g, new THREE.CircleGeometry(.044, 24), new THREE.MeshBasicMaterial({ color: cor, toneMapped: false }), 0, .05, .355);         // fundo da boca aceso
    cabo(0); gatilho(.0, .016);
    por(g, perfil([[.17, .0], [.215, .0], [.21, -.08], [.185, -.088], [.17, -.072]], .036), m.borracha);   // alca da frente
    for (const x of [.085, .175]) por(g, new THREE.TorusGeometry(.034, .006, 8, 20), m.metal, x, .05, -.06).rotation.y = Math.PI / 2;   // bracadeiras da celula
    cel = celula(.028, .16, nucleoCel); cel.position.set(.13, .05, -.06); cel.rotation.z = -Math.PI / 2; g.add(cel);
    saida.set(1, 0, 0);
    maoEsq.position.set(-.004, -.04, .19); boca.set(0, .05, .37);
  } else if (tipo === 'espada') {
    // sabre de luz: cabo de cromo torneado, empunhadura de borracha com aneis,
    // botao aceso, coroa do emissor e a lamina em tres camadas
    const cab = new THREE.Group(); g.add(cab);
    cab.rotation.x = .95; cab.position.set(0, .01, 0);   // a empunhadura (y ~ 0) no meio do punho   // lamina para a frente e para cima (guarda)
    por(cab, torno([[0, -.178], [.017, -.178], [.022, -.173], [.024, -.163], [.021, -.152], [.019, -.146], [.019, .02], [.022, .025], [.022, .07],
      [.025, .074], [.029, .118], [.026, .124], [.017, .124], [.017, .114], [0, .114]], 32), m.cromo);
    por(cab, new THREE.CylinderGeometry(.0205, .0205, .15, 24), m.borracha, 0, -.065);
    for (let i = 0; i < 8; i++) por(cab, new THREE.TorusGeometry(.0207, .0022, 6, 24), m.cromo, 0, -.13 + i * .019).rotation.x = Math.PI / 2;
    por(cab, new THREE.TorusGeometry(.0225, .003, 8, 24), energia, 0, .03).rotation.x = Math.PI / 2;
    por(cab, new THREE.TorusGeometry(.022, .0025, 8, 24), energia, 0, -.156).rotation.x = Math.PI / 2;
    por(cab, caixa(.012, .028, .012, .003), m.metal, 0, .05, .023);
    por(cab, caixa(.007, .012, .006, .002), energia, 0, .052, .029);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; por(cab, caixa(.008, .022, .008, .002), m.cromo, Math.cos(a) * .028, .12, Math.sin(a) * .028).rotation.y = -a; }
    por(cab, new THREE.CircleGeometry(.016, 20), new THREE.MeshBasicMaterial({ color: cor.clone().lerp(new THREE.Color(1, 1, 1), .5), toneMapped: false }), 0, .118).rotation.x = -Math.PI / 2;
    // a lamina (capsulas: raio r, corpo L; o shader estica so o corpo)
    const L = 1, base = .118;
    const camada = (r, mat) => { const geo = new THREE.CapsuleGeometry(r, L, 6, 16); geo.translate(0, L / 2 + r, 0); mat.uniforms.uR.value = r; mat.uniforms.uL.value = L; const k = por(cab, geo, mat, 0, base - r); k.frustumCulled = false; k.renderOrder = 6; return k; };
    const nucleo = camada(.0105, materialLamina(cor, { nucleo: true }));
    const brilho = camada(.026, materialLamina(cor, { forca: .95, exp: 1.6 }));
    const aura = camada(.065, materialLamina(cor, { forca: .42, exp: 2.4 }));
    const lam = [nucleo, brilho, aura];
    const ponta = new THREE.Object3D(); ponta.position.y = base + L; cab.add(ponta);
    const baseLamina = new THREE.Object3D(); baseLamina.position.y = base + .12; cab.add(baseLamina);
    // brilho na boca do emissor
    const fulgor = new THREE.Sprite(new THREE.SpriteMaterial({ map: texClarao(), color: cor, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    fulgor.scale.setScalar(.16); fulgor.position.y = base + .02; cab.add(fulgor);
    // a mao esquerda vai no pomo; o objeto tem a mesma orientacao da arma
    maoEsq.position.set(0, -.112, 0); maoEsq.quaternion.copy(cab.quaternion).invert(); cab.add(maoEsq);
    // acende quando aparece: o comprimento vai de 0 a 1 (com um tranco no fim)
    let ultimo = 0, aceso = 0, forcaGolpe = 0;
    nucleo.onBeforeRender = () => {
      const agora = performance.now() / 1000, dt = Math.min(.1, agora - ultimo);
      if (agora - ultimo > .35) aceso = 0;
      ultimo = agora; aceso = Math.min(1, aceso + dt / .26);
      const e = 1 - Math.pow(1 - aceso, 3), comp = aceso < 1 ? e * 1.03 : 1;
      for (const k of lam) { const u = k.material.uniforms; u.uLen.value = Math.max(.001, comp); u.uT.value = agora; u.uA.value = Math.min(1, aceso * 4) * (1 + forcaGolpe * .45); }
      ponta.position.y = base + L * comp;
      fulgor.material.opacity = .7 + forcaGolpe * .3;
    };
    g.userData.lamina = brilho; g.userData.ponta = ponta; g.userData.baseLamina = baseLamina; g.userData.cabo = cab;
    g.userData.brilhoGolpe = (k) => { forcaGolpe = k; };
    boca.set(0, .5, .5);
  }
  if (!maoEsq.parent) g.add(maoEsq);
  const repousoMao = maoEsq.position.clone();

  const bocaObj = new THREE.Object3D(); bocaObj.position.copy(boca); g.add(bocaObj);
  const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: texEstrela(), color: cor.clone().lerp(new THREE.Color(1, 1, 1), .45), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  fl.scale.setScalar(tipo === 'canhao' ? .38 : tipo === 'rifle' ? .24 : .2); fl.position.z = .02; bocaObj.add(fl);

  /* ---- recarga: caminho da mao esquerda e da celula ---- */
  let velha = null, casaQ = null, compCel = 0;
  const bolso = new THREE.Vector3(.15, -.33, -.2);   // o cinto, a esquerda e para baixo
  if (cel) {
    casa = cel.position.clone(); casaQ = cel.quaternion.clone();
    compCel = new THREE.Box3().setFromObject(cel).getSize(new THREE.Vector3()).length() * .55;
    velha = cel.clone(true); velha.traverse((o) => { if (o.isMesh && o.material === nucleoCel) o.material = m.gasta; }); velha.visible = false; g.add(velha);
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _w = new THREE.Vector3(), _v = new THREE.Vector3();
  const pega = () => _b.copy(casa).addScaledVector(saida, compCel * .5);   // onde a mao pega (a tampa de fora)
  // quadros-chave da mao (k, ponto) — entre eles, suave
  const chaves = () => {
    const P = pega().clone(), fora = P.clone().addScaledVector(saida, compCel * 1.1);
    return [[0, repousoMao], [.14, P], [.26, fora], [.44, bolso], [.6, fora], [.72, P], [.77, P.clone().addScaledVector(saida, -.012)], [.84, P], [1, repousoMao]];
  };
  let _chaves = null;
  const suave = (x) => x * x * (3 - 2 * x);
  function maoEm(k, out) {
    const ch = _chaves || (_chaves = chaves());
    for (let i = 1; i < ch.length; i++) if (k <= ch[i][0]) { const [k0, a] = ch[i - 1], [k1, b] = ch[i]; return out.lerpVectors(a, b, suave((k - k0) / (k1 - k0))); }
    return out.copy(repousoMao);
  }
  let solta = -1;   // quando a celula velha foi solta (s)
  const vel0 = new THREE.Vector3(), p0 = new THREE.Vector3();
  const corBase = cor.clone(), vermelho = new THREE.Color(0xff2a10);
  const baseQ = new THREE.Quaternion(), baseP = new THREE.Vector3();
  const _qr = new THREE.Quaternion(), _er = new THREE.Euler();

  g.userData = { ...g.userData,
    boca: bocaObj, clarao: fl, maoEsq, celula: cel,
    /** calor 0..1 (sobrou do superaquecimento; deixa a energia vermelha) */
    calor(k) { energia.emissive.copy(corBase).lerp(vermelho, Math.min(1, k)); },
    /** corte do sabre 0..1 (-1 = guarda): prepara por cima do ombro direito,
     *  corta na diagonal ate embaixo a esquerda e volta */
    golpe(k) {
      if (k < 0) { g.quaternion.copy(baseQ); g.userData.brilhoGolpe?.(0); return; }
      const ch = [[0, 0, 0, 0], [.2, -1, -.7, -.4], [.42, 1.65, .9, .5], [.62, 1.45, .8, .4], [1, 0, 0, 0]];
      let i = 1; while (i < ch.length - 1 && k > ch[i][0]) i++;
      const [k0, x0, y0, z0] = ch[i - 1], [k1, x1, y1, z1] = ch[i], u = suave(Math.min(1, (k - k0) / (k1 - k0)));
      g.quaternion.copy(baseQ).multiply(_qr.setFromEuler(_er.set(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u)));
      g.userData.brilhoGolpe?.(k > .18 && k < .5 ? 1 : 0);
    },
    /** recarga 0..1 (-1 = parada) */
    recarga(k) {
      if (!cel) return;
      if (k < 0) {
        g.quaternion.copy(baseQ); g.position.copy(baseP); maoEsq.position.copy(repousoMao);
        cel.position.copy(casa); cel.visible = true; velha.visible = false; solta = -1; energia.emissiveIntensity = 2.4; return;
      }
      // a arma vira o lado da celula para a mao
      const s = Math.sin(Math.PI * Math.min(1, k / .92)), e = s * s * (3 - 2 * s);
      const giro = tipo === 'canhao' ? [-.25, .35, -.5] : tipo === 'rifle' ? [-.3, .15, .55] : [-.35, .1, .5];
      g.quaternion.copy(baseQ).multiply(_qr.setFromEuler(_er.set(giro[0] * e, giro[1] * e, giro[2] * e)));
      // desce um pouco (no espaco da propria arma: o pulso do modelo tem outra escala)
      g.position.copy(baseP).add(_v.set(0, -.025 * e, 0).applyQuaternion(baseQ).multiply(g.scale));
      maoEm(k, maoEsq.position);
      // a celula: presa ate a mao chegar, sai com a mao, cai girando; a nova vem na mao e encaixa
      _a.subVectors(maoEsq.position, pega());
      if (k < .14) { cel.visible = true; cel.position.copy(casa); }
      else if (k < .26) { cel.visible = true; cel.position.copy(casa).add(_a); }
      else if (k < .44) { cel.visible = false; }
      else if (k < .72) { cel.visible = true; cel.position.copy(casa).add(_a); }
      else { cel.visible = true; cel.position.copy(casa); }
      cel.quaternion.copy(casaQ);
      // a velha: solta em .26, cai com gravidade (no mundo) e some
      if (k >= .26 && k < .7) {
        g.updateWorldMatrix(true, false);
        const agora = performance.now() / 1000;
        if (solta < 0) {
          solta = agora; velha.visible = true; velha.position.copy(casa).add(_a); velha.quaternion.copy(casaQ);
          velha.getWorldPosition(p0); _w.copy(saida).transformDirection(g.matrixWorld); vel0.copy(_w).multiplyScalar(.9); vel0.y += .6;
        }
        const t = agora - solta;
        _v.copy(p0).addScaledVector(vel0, t); _v.y -= 4.9 * t * t;
        velha.position.copy(g.worldToLocal(_v));
        velha.rotation.set(t * 9, t * 4, t * 7); velha.quaternion.premultiply(casaQ);
        velha.visible = t < .55;
      } else { velha.visible = false; if (k < .26) solta = -1; }
      // energia: apaga quando a celula sai, volta piscando quando encaixa
      energia.emissiveIntensity = k < .14 ? 2.4 : k < .26 ? 2.4 * (1 - (k - .14) / .12) * .9 + .1 : k < .72 ? .1 : .1 + 2.3 * Math.min(1, (k - .72) / .2) * (.75 + .25 * Math.sin(k * 90));
    }
  };
  g.visible = false;
  // a posicao de repouso (quem monta a arma na mao mexe nela depois)
  g.userData.fixarBase = () => { baseQ.copy(g.quaternion); baseP.copy(g.position); };
  return g;
}

/**
 * Rastro de luz da lamina: uma fita entre a base e a ponta dos ultimos
 * quadros, que some do fim para o comeco. atualizar(base, ponta, ativo, dt)
 * com posicoes no mundo.
 */
export function criarRastroLamina(cor = 0xff4fd8, n = 22) {
  const pos = new Float32Array(n * 6), alfa = new Float32Array(n * 2), lado = new Float32Array(n * 2), idx = [];
  for (let i = 0; i < n; i++) { lado[i * 2] = 0; lado[i * 2 + 1] = 1; }
  for (let i = 0; i < n - 1; i++) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const geo = new THREE.BufferGeometry(); geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aA', new THREE.BufferAttribute(alfa, 1)); geo.setAttribute('aL', new THREE.BufferAttribute(lado, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: usarCurva({ uCor: { value: new THREE.Color(cor) } }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
    vertexShader: `${CURVA_GLSL} attribute float aA, aL; varying float vA, vL; void main(){ vA = aA; vL = aL; gl_Position = projectionMatrix * viewMatrix * curvar(modelMatrix * vec4(position, 1.)); }`,
    fragmentShader: 'uniform vec3 uCor; varying float vA, vL; void main(){ float a = vA * (.25 + .75 * vL * vL); gl_FragColor = vec4(mix(uCor, vec3(1.), vL * vL * vA * .7) * a, a); }'
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 7; mesh.visible = false;
  let usados = 0, op = 0;
  return {
    mesh,
    atualizar(base, ponta, ativo, dt) {
      if (ativo) {
        op = 1;
        pos.copyWithin(6, 0, (n - 1) * 6);
        pos[0] = base.x; pos[1] = base.y; pos[2] = base.z; pos[3] = ponta.x; pos[4] = ponta.y; pos[5] = ponta.z;
        if (usados === 0) for (let i = 1; i < n; i++) pos.copyWithin(i * 6, 0, 6);
        usados = Math.min(n, usados + 1);
      } else { op = Math.max(0, op - dt * 7); if (op <= 0) usados = 0; }
      for (let i = 0; i < n; i++) { const a = i < usados ? Math.pow(1 - i / (n - 1), 1.4) * op : 0; alfa[i * 2] = alfa[i * 2 + 1] = a; }
      geo.attributes.position.needsUpdate = true; geo.attributes.aA.needsUpdate = true;
      mesh.visible = op > 0 && usados > 1;
    }
  };
}

/** uma luva do traje (primeira pessoa): punho fechado, polegar por cima e o
 *  antebraco saindo para tras (-z). esq = mao esquerda */
export function criarLuva(esq) {
  const luva = guardar(new THREE.MeshStandardMaterial({ color: 0xdedbe8, metalness: .15, roughness: .55 }));
  const escura = guardar(new THREE.MeshStandardMaterial({ color: 0x3a3646, metalness: .4, roughness: .5 }));
  const neon = new THREE.MeshBasicMaterial({ color: 0x9f7bff });
  const h = new THREE.Group();
  const p = new THREE.Mesh(new RoundedBoxGeometry(.06, .075, .085, 2, .02), luva); h.add(p);
  // dedos fechados em volta (quatro gomos curvados) e o polegar por cima
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(.018, .026, .05, 2, .008), luva);
    f.position.set((esq ? 1 : -1) * .036, .028 - i * .021, .025); f.rotation.set(0, (esq ? -1 : 1) * .9, 0); h.add(f);
    const ponta = new THREE.Mesh(new RoundedBoxGeometry(.018, .022, .032, 2, .008), luva); ponta.position.set((esq ? 1 : -1) * .05, .028 - i * .021, -.008); ponta.rotation.y = (esq ? -1 : 1) * 1.9; h.add(ponta);
  }
  const pol = new THREE.Mesh(new RoundedBoxGeometry(.02, .02, .055, 2, .008), luva); pol.position.set((esq ? -1 : 1) * .02, .045, .03); pol.rotation.set(-.3, 0, 0); h.add(pol);
  // punho do traje com friso de neon e antebraco saindo para tras
  const punho = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .07, 14), escura); punho.rotation.x = Math.PI / 2; punho.position.z = -.07; h.add(punho);
  const friso = new THREE.Mesh(new THREE.CylinderGeometry(.051, .051, .012, 14), neon); friso.rotation.x = Math.PI / 2; friso.position.z = -.045; h.add(friso);
  const braco = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .4, 14), luva); braco.rotation.x = Math.PI / 2; braco.position.z = -.29; h.add(braco);
  return h;
}
