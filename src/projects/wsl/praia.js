import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Praia de campeonato de surf, no fim de tarde — o ambiente inteiro do
 * capitulo WSL (antes era uma sala com parede escura).
 *
 * A camera olha para -z: atras do totem da TV fica o mar ate o horizonte, com
 * ondas de verdade (a malha se deforma no vertex shader) e espuma quebrando na
 * beira; na areia, pranchas fincadas, bandeiras do WSL e o palanque dos
 * juizes. Ceu de por do sol puxando do violeta do site para o laranja.
 *
 * `atualizar(t)` anima mar e bandeiras; a cena chama no proprio laco.
 */

const BEIRA = -3.2;            // z da linha d'agua
const COR = {
  areia: 0xd7b089, areiaMolhada: 0x8f7458,
  verdeWsl: 0x1fa89e, branco: 0xf4f6f5
};

const caixa = (l, a, p, r = 0.02) => new RoundedBoxGeometry(l, a, p, 3, r);
function peca(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------- ceu --
function criarCeu() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSol: { value: new THREE.Vector3(-.35, .07, -1).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      uniform vec3 uSol; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 topo = vec3(.16, .10, .34), meio = vec3(.62, .27, .45), horiz = vec3(1., .56, .30);
        vec3 c = mix(horiz, meio, smoothstep(0., .18, h));
        c = mix(c, topo, smoothstep(.16, .6, h));
        c = mix(c, vec3(.28, .16, .22), smoothstep(0., -.05, h));        // abaixo do horizonte
        float s = max(dot(normalize(vDir), uSol), 0.);
        c += vec3(1., .72, .42) * pow(s, 24.) * .8 + vec3(1., .95, .8) * smoothstep(.9985, .9993, s);
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(58, 32, 16), mat);
  ceu.renderOrder = -20;
  return ceu;
}

// ------------------------------------------------------------------- mar --
function criarMar() {
  const geo = new THREE.PlaneGeometry(130, 62, 220, 110);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 },
      uSol: { value: new THREE.Vector3(-.35, .07, -1).normalize() },
      uBeira: { value: BEIRA }
    },
    vertexShader: `
      uniform float uT, uBeira; varying vec3 vPos; varying float vAlt; varying vec3 vN;
      // ondas vindo do horizonte (-z) para a praia (+z)
      float onda(vec2 p){
        return .22 * sin(p.y * .55 + uT * 1.2 + p.x * .05)
             + .12 * sin(p.y * 1.1 + p.x * .35 + uT * 1.9)
             + .07 * sin(p.y * 2.3 - p.x * .6 + uT * 2.6)
             + .04 * sin(p.x * 1.7 + uT * 1.4);
      }
      void main(){
        vec3 p = (modelMatrix * vec4(position, 1.)).xyz;
        // perto da beira as ondas crescem e ficam mais curtas: e ali que quebram
        float perto = smoothstep(-26., uBeira, p.z);
        float h = onda(p.xz) * (.55 + perto * 1.1);
        float e = .3;
        float hx = onda(p.xz + vec2(e, 0.)) * (.55 + perto * 1.1), hz = onda(p.xz + vec2(0., e)) * (.55 + perto * 1.1);
        vN = normalize(vec3(h - hx, e, h - hz));
        p.y += h; vAlt = h; vPos = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: `
      uniform float uT, uBeira; uniform vec3 uSol; varying vec3 vPos; varying float vAlt; varying vec3 vN;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec3 V = normalize(cameraPosition - vPos);
        vec3 N = normalize(vN);
        float fres = pow(1. - max(dot(N, V), 0.), 3.);
        vec3 fundo = vec3(.03, .20, .26), raso = vec3(.10, .52, .52);
        float dist = length(vPos.xz - cameraPosition.xz);
        vec3 c = mix(raso, fundo, smoothstep(4., 30., dist));
        // reflexo do ceu de fim de tarde e trilha de brilho do sol
        vec3 R = reflect(-V, N);
        vec3 ceu = mix(vec3(1., .56, .30), vec3(.45, .22, .42), smoothstep(0., .4, R.y));
        c = mix(c, ceu, fres * .75);
        float sol = pow(max(dot(R, uSol), 0.), 180.);
        c += vec3(1., .85, .6) * sol * 2.2;
        // espuma: nas cristas e numa faixa que avanca e recua na beira
        float crista = smoothstep(.22, .36, vAlt);
        float z = vPos.z - uBeira;
        float quebra = smoothstep(-4.5, -.2, z) * (1. - smoothstep(-.2, .15, z));
        float faixas = smoothstep(.55, .9, sin(z * 3.2 - uT * 2.4 + sin(vPos.x * .6) * .8));
        float esp = max(crista * .8, quebra * (.35 + faixas * .65));
        esp *= .6 + .4 * hash(floor(vPos.xz * 9.));
        c = mix(c, vec3(.96, .97, .95), clamp(esp, 0., 1.));
        // longe, o mar vira o horizonte
        c = mix(c, vec3(1., .62, .38), smoothstep(26., 58., dist) * .85);
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const mar = new THREE.Mesh(geo, mat);
  mar.position.set(0, .02, BEIRA - 31);
  return mar;
}

// ----------------------------------------------------------------- areia --
function texturaAreia() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d');
  c.fillStyle = '#d7b089'; c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) {
    const v = Math.random();
    c.fillStyle = v > .5 ? `rgba(255,236,205,${Math.random() * .35})` : `rgba(120,86,52,${Math.random() * .3})`;
    c.fillRect(Math.random() * 512, Math.random() * 512, 1.3, 1.3);
  }
  // marcas de pegada / vento
  c.strokeStyle = 'rgba(140,100,60,.18)'; c.lineWidth = 2;
  for (let i = 0; i < 40; i++) { c.beginPath(); const y = Math.random() * 512; c.moveTo(0, y); c.bezierCurveTo(170, y + 18, 340, y - 18, 512, y + 6); c.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 5);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function criarAreia() {
  const g = new THREE.Group();
  const areia = new THREE.Mesh(new THREE.PlaneGeometry(60, 22), new THREE.MeshStandardMaterial({ map: texturaAreia(), roughness: .95 }));
  areia.rotation.x = -Math.PI / 2; areia.position.set(0, 0, BEIRA + 11);
  areia.receiveShadow = true;
  g.add(areia);
  // areia molhada na beira: mais escura e com brilho
  const molhada = new THREE.Mesh(new THREE.PlaneGeometry(60, 2.2), new THREE.MeshStandardMaterial({ color: COR.areiaMolhada, roughness: .35, metalness: .15, transparent: true, opacity: .85 }));
  molhada.rotation.x = -Math.PI / 2; molhada.position.set(0, .006, BEIRA + .9);
  g.add(molhada);
  return g;
}

// ------------------------------------------------------------- pranchas --
function criarPrancha(cor, faixa) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(.23, 1.55, 6, 18), new THREE.MeshStandardMaterial({ color: cor, roughness: .35, metalness: .05 }));
  corpo.scale.set(1, 1, .16); corpo.castShadow = true;
  g.add(corpo);
  if (faixa) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(.05, 1.9, .075), new THREE.MeshStandardMaterial({ color: faixa, roughness: .4 }));
    g.add(f);
  }
  return g;
}
function criarPranchas() {
  const g = new THREE.Group();
  [
    [-2.55, .55, .9, 0x1fa89e, 0xffffff, .12], [-2.1, .5, .35, 0xf4f6f5, 0xff6a3d, -.08],
    [-3.1, .52, .1, 0xffc93c, 0x1b2a38, .2], [3.35, .54, -.55, 0xff6a3d, 0xffffff, -.14],
    [3.85, .5, -1.05, 0x163a5c, 0x1fa89e, .1]
  ].forEach(([x, y, z, cor, faixa, inc]) => {
    const p = criarPrancha(cor, faixa);
    p.position.set(x, y + .45, z); p.rotation.set(0, Math.random() * .8 - .4, inc);
    g.add(p);
  });
  // uma deitada na areia
  const d = criarPrancha(0xffffff, 0x1fa89e);
  d.rotation.set(-Math.PI / 2, 0, 1.1); d.position.set(2.3, .04, .9);
  g.add(d);
  return g;
}

// ------------------------------------------------------------- bandeiras --
function texturaBandeira(texto, fundo, cor) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1024;
  const c = cv.getContext('2d');
  c.fillStyle = fundo; c.fillRect(0, 0, 256, 1024);
  c.fillStyle = cor; c.fillRect(0, 900, 256, 124);
  c.save(); c.translate(150, 520); c.rotate(-Math.PI / 2);
  c.font = 'italic 900 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = cor; c.fillText(texto, 0, 0);
  c.restore();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (document.fonts) document.fonts.load('italic 900 150px "Barlow Condensed"').then(() => {
    c.fillStyle = fundo; c.fillRect(0, 0, 256, 900); c.save(); c.translate(150, 520); c.rotate(-Math.PI / 2);
    c.font = 'italic 900 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = cor; c.fillText(texto, 0, 0); c.restore();
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}
function criarBandeiras() {
  const g = new THREE.Group();
  const bandeiras = [];
  const mastro = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: .5, metalness: .6 });
  [
    // na faixa que a camera ve (ela vem da direita olhando para a esquerda)
    [-1.45, -2.3, 'SPORTV', '#ffffff', '#1a9e95'], [1.75, -1.7, 'WSL', '#1fa89e', '#ffffff'],
    [2.55, -2.8, 'GE', '#ffffff', '#6b2fd6'], [-2.6, -1.4, 'WSL', '#1fa89e', '#ffffff']
  ].forEach(([x, z, texto, fundo, cor]) => {
    const alt = 3.3;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, alt, 8), mastro);
    m.position.set(x, alt / 2, z); m.castShadow = true; g.add(m);
    // bandeira "pena": plano com a borda de fora curva, tremulando no vertex
    const geo = new THREE.PlaneGeometry(.62, 2.5, 8, 24);
    geo.translate(.31, 0, 0);
    const mat = new THREE.MeshStandardMaterial({ map: texturaBandeira(texto, fundo, cor), side: THREE.DoubleSide, roughness: .8 });
    const b = new THREE.Mesh(geo, mat);
    b.position.set(x + .02, alt - 1.35, z); b.castShadow = true;
    b.userData.base = geo.attributes.position.array.slice();
    b.userData.fase = Math.random() * 6;
    g.add(b); bandeiras.push(b);
  });
  return { grupo: g, bandeiras };
}
function tremular(b, t) {
  const pos = b.geometry.attributes.position, base = b.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    // a ponta de fora mexe mais que a presa no mastro
    pos.array[i * 3 + 2] = Math.sin(x * 6 + y * 1.4 - t * 3.2 + b.userData.fase) * .12 * (x / .62);
  }
  pos.needsUpdate = true;
  b.geometry.computeVertexNormals();
}

// ------------------------------------------------------ palanque e tenda --
function criarPalanque() {
  const g = new THREE.Group();
  const tubo = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: .4, metalness: .7 });
  const L = 3.2, P = 2.2, A = 2.6;
  const cil = (a) => new THREE.CylinderGeometry(.04, .04, a, 8);
  [[-L / 2, -P / 2], [L / 2, -P / 2], [-L / 2, P / 2], [L / 2, P / 2]].forEach(([x, z]) => g.add(peca(cil(A + 1.4), tubo, x, (A + 1.4) / 2, z)));
  // diagonais de escora
  [[-L / 2, 0], [L / 2, 0]].forEach(([x]) => {
    const d = peca(cil(Math.hypot(P, A)), tubo, x, A / 2, 0); d.rotation.x = Math.atan2(P, A); g.add(d);
  });
  g.add(peca(caixa(L + .3, .12, P + .3), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: .7 }), 0, A, 0));
  // cabine dos juizes com vidro escuro e o telhado com a faixa do evento
  g.add(peca(caixa(L, 1.1, P, .03), new THREE.MeshStandardMaterial({ color: 0xf4f6f5, roughness: .6 }), 0, A + .62, 0));
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(L - .3, .6), new THREE.MeshStandardMaterial({ color: 0x18323a, roughness: .1, metalness: .8 }));
  vidro.position.set(0, A + .7, P / 2 + .01); g.add(vidro);
  const faixa = new THREE.Mesh(new THREE.BoxGeometry(L + .4, .34, .06), new THREE.MeshStandardMaterial({ color: COR.verdeWsl, emissive: COR.verdeWsl, emissiveIntensity: .25, roughness: .5 }));
  faixa.position.set(0, A + 1.35, P / 2 + .1); g.add(faixa);
  g.position.set(3.9, 0, -2.9); g.rotation.y = -.35;
  return g;
}
function criarTenda() {
  const g = new THREE.Group();
  const lona = new THREE.MeshStandardMaterial({ color: 0xf4f6f5, roughness: .8, side: THREE.DoubleSide });
  const teto = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.1, 4, 1, true), lona);
  teto.rotation.y = Math.PI / 4; teto.position.y = 2.75; teto.castShadow = true; g.add(teto);
  const saia = new THREE.Mesh(new THREE.BoxGeometry(2.95, .28, 2.95), new THREE.MeshStandardMaterial({ color: COR.verdeWsl, roughness: .7 }));
  saia.position.y = 2.1; g.add(saia);
  const perna = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: .6, roughness: .4 });
  [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => g.add(peca(new THREE.CylinderGeometry(.03, .03, 2.1, 8), perna, x, 1.05, z)));
  g.position.set(-3.9, 0, -2.4); g.rotation.y = .4;
  return g;
}

// ------------------------------------------------------- totem da TV --
/** Estrutura de pe na areia que segura a TV (antes ela ficava numa parede). */
export function criarTotem(painel) {
  const g = new THREE.Group();
  const branco = new THREE.MeshStandardMaterial({ color: COR.branco, roughness: .55 });
  const verde = new THREE.MeshStandardMaterial({ color: COR.verdeWsl, roughness: .5 });
  const L = painel.largura + .42, A = 3.05;
  g.add(peca(caixa(L, A, .26, .04), branco, 0, A / 2, -.14));
  // faixas verdes laterais e base
  [-1, 1].forEach((s) => g.add(peca(caixa(.07, A - .1, .27), verde, s * (L / 2 - .05), A / 2, -.14)));
  g.add(peca(caixa(L + .5, .16, .9, .03), verde, 0, .08, -.1));
  return g;
}

/** Monta a praia. Devolve { raiz, atualizar(t) }. */
export function criarPraia(painel) {
  const raiz = new THREE.Group();
  raiz.name = 'praiaWsl';
  const ceu = criarCeu(); raiz.add(ceu);
  const mar = criarMar(); raiz.add(mar);
  raiz.add(criarAreia());
  raiz.add(criarPranchas());
  const { grupo: gb, bandeiras } = criarBandeiras(); raiz.add(gb);
  raiz.add(criarPalanque());
  raiz.add(criarTenda());
  raiz.add(criarTotem(painel));
  let ultimoB = 0;
  return {
    raiz,
    atualizar(t, camera) {
      mar.material.uniforms.uT.value = t;
      if (camera) ceu.position.copy(camera.position);   // o ceu anda com a camera: horizonte infinito
      // bandeiras a ~30 fps bastam, e poupam recalcular normais todo quadro
      if (t - ultimoB > .033) { ultimoB = t; bandeiras.forEach((b) => tremular(b, t)); }
    },
    destruir() {
      raiz.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { o.material.map?.dispose(); o.material.dispose(); }
      });
    }
  };
}
