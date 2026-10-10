import * as THREE from 'three';

/**
 * Texturas dos planetas — UMA fonte para o site (Stack Universe) e o jogo:
 * os dois chamam texturasPlaneta() e saem identicos.
 *
 * Gerado na placa de video (um shader de ruido 3D desenhado numa textura, uma
 * vez por planeta): o ruido e amostrado na esfera de verdade, entao nao ha
 * emenda nem polo esticado. Cada planeta tem um tipo (terrestre, gasoso,
 * arquipelago, oceanico, vulcanico, gelado, desertico, cristalino) na paleta
 * do site (o matiz de cada um).
 * Saidas: map (cor), relevo (R = altura para o bumpMap, G = aspereza para o
 * roughnessMap) e brilho (emissiveMap: lava, veios de cristal, luzes de
 * cidade e o brilho base que o site ja tinha).
 * Cache por renderer (cada canvas WebGL tem as suas texturas).
 */
export const TIPO_PLANETA = { frontend: 0, backend: 1, mobile: 2, data: 3, security: 4, infra: 5, tooling: 6, analytics: 7, ai: 8 };

const NOISE = /* glsl */`
// simplex 3D (Ashima Arts / Stefan Gustavson, MIT)
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=.5, f=0.; for(int i=0;i<6;i++){ f+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return f; }
float ridged(vec3 p){ float a=.5, f=0.; for(int i=0;i<5;i++){ float n=1.-abs(snoise(p)); f+=a*n*n; p=p*2.11+vec3(4.3,1.1,7.7); a*=.5; } return f; }
vec3 hsl(float h, float s, float l){ vec3 rgb=clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); return l+s*(rgb-.5)*(1.-abs(2.*l-1.)); }
float hash(float n){ return fract(sin(n)*43758.5453123); }
`;

const FRAG = /* glsl */`
precision highp float;
uniform float uHue, uSeed; uniform int uTipo, uSaida;
varying vec2 vUv;
${NOISE}
void main(){
  // ponto da esfera (mesmo mapeamento UV da SphereGeometry do three)
  float phi = vUv.x * 6.2831853, theta = (1. - vUv.y) * 3.14159265;
  vec3 d = vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
  vec3 p = d * 1.7 + vec3(uSeed * .731, uSeed * .317, uSeed * .913);
  float H = uHue / 360., lat = d.y;
  vec3 col; float h = .5, rug = .8; vec3 emi = vec3(0.);

  // dobra o espaco (deixa as formas organicas, sem cara de ruido)
  vec3 q = p + .55 * vec3(fbm(p + 1.7), fbm(p + 5.2), fbm(p + 9.1));

  if (uTipo == 0 || uTipo == 2 || uTipo == 3) {
    // terrestre / arquipelago / oceanico: continentes, mares, montanhas, gelo nos polos
    float n = fbm(q * 1.15) + .18 * ridged(q * 3.);
    float mar = uTipo == 0 ? -.02 : uTipo == 2 ? .16 : .3;
    float e = n - mar;
    if (e < 0.) {
      float fundo = clamp(-e * 2.2, 0., 1.);
      col = mix(hsl(H + .03, .55, .40), hsl(H + .05, .62, .13), fundo);
      col += hsl(H + .1, .5, .55) * .25 * smoothstep(-.05, 0., e);   // aguas rasas na costa
      h = .35 - fundo * .1; rug = .22;
    } else {
      float alto = smoothstep(0., .55, e);
      col = mix(hsl(H - .04, .32, .36), hsl(H + .01, .22, .58), alto);
      col = mix(col, hsl(H + .06, .4, .28), .45 * smoothstep(.2, .7, fbm(q * 4.)));   // manchas de vegetacao
      col = mix(col, hsl(H + .02, .3, .72), smoothstep(.42, .62, e + .1 * snoise(p * 9.)));   // picos com neve
      h = .45 + e * .9; rug = .82;
      // luzes de cidade perto da costa
      float cidade = smoothstep(.6, .9, snoise(p * 38.)) * smoothstep(0., .04, e) * (1. - smoothstep(.12, .3, e));
      emi += hsl(H + .1, .95, .72) * cidade * .9;
    }
    float polo = smoothstep(.78, .9, abs(lat) + .06 * snoise(p * 6.));
    col = mix(col, hsl(H + .02, .3, .74), polo); rug = mix(rug, .4, polo);
  } else if (uTipo == 1 || uTipo == 6) {
    // gasoso: faixas turbulentas e uma grande tempestade
    float turb = fbm(p * vec3(1., 3.5, 1.) * .9) * 1.3;
    float y = lat * (uTipo == 1 ? 7. : 9.) + turb;
    float faixa = sin(y * 3.1 + fbm(p * 2.2) * 2.) * .5 + .5;
    float fina = sin(y * 13. + snoise(p * 7.) * 1.5) * .5 + .5;
    col = mix(hsl(H - .03, .42, .26), hsl(H + .05, .52, .64), faixa);
    col = mix(col, hsl(H + .1, .45, .5), fina * .25);
    vec3 c0 = normalize(vec3(cos(uSeed), uTipo == 1 ? -.35 : .25, sin(uSeed)));
    float giro = length((d - c0) * vec3(1., 2.4, 1.));
    float tempestade = smoothstep(.32, .05, giro);
    col = mix(col, hsl(H + .13, .65, .7), tempestade * (.6 + .4 * sin(giro * 40.)));
    h = .5 + faixa * .12; rug = .6;
  } else if (uTipo == 4) {
    // vulcanico: rocha escura, rachaduras de lava (magenta, na paleta) brilhando
    float n = fbm(q * 1.8);
    float rach = ridged(q * 2.6);
    float lava = smoothstep(.62, .78, rach) * (.6 + .4 * snoise(p * 12.));
    col = mix(hsl(H, .18, .1), hsl(H - .02, .12, .3), n * .5 + .5);
    vec3 corLava = mix(vec3(1., .3, .55), vec3(1., .65, .3), smoothstep(.75, .95, rach));
    col = mix(col, corLava, lava);
    emi += corLava * lava * 1.6;
    h = .5 + n * .35 - lava * .25; rug = .92;
  } else if (uTipo == 5) {
    // gelado: placas de gelo com fendas
    float n = fbm(q * 2.2);
    col = mix(hsl(H + .02, .42, .6), hsl(H - .01, .55, .36), n * .5 + .5);
    float fenda = smoothstep(.93, .99, 1. - abs(snoise(q * 5.5)));
    col = mix(col, hsl(H + .03, .7, .28), fenda * .8);
    emi += hsl(H + .05, .9, .6) * fenda * .25;
    h = .55 + n * .25 - fenda * .3; rug = .32;
  } else if (uTipo == 7) {
    // desertico: dunas em ondas e planaltos
    float n = fbm(q * 1.4);
    float duna = sin(dot(p, vec3(18., 4., 11.)) + fbm(p * 3.) * 6.) * .5 + .5;
    col = mix(hsl(H - .06, .34, .3), hsl(H - .02, .4, .5), n * .5 + .5);
    col = mix(col, hsl(H - .05, .36, .58), duna * .25);
    h = .45 + n * .4 + duna * .05; rug = .95;
  } else {
    // cristalino: rocha escura com veios de cristal brilhando
    float n = fbm(q * 2.);
    float veio = ridged(q * 2.4);
    float cristal = smoothstep(.7, .86, veio);
    col = mix(hsl(H, .25, .14), hsl(H + .02, .2, .32), n * .5 + .5);
    col = mix(col, hsl(H + .06, .85, .68), cristal);
    emi += hsl(H + .06, .95, .62) * cristal * 1.3;
    h = .5 + n * .3 + cristal * .25; rug = mix(.85, .2, cristal);
  }

  // crateras (nos planetas sem ar e nos secos)
  if (uTipo == 4 || uTipo == 5 || uTipo == 7 || uTipo == 8) {
    for (int i = 0; i < 18; i++) {
      float fi = float(i) + uSeed * 3.1;
      vec3 c = normalize(vec3(hash(fi * 1.7) - .5, hash(fi * 2.3) - .5, hash(fi * 3.9) - .5));
      float r = .04 + hash(fi * 5.1) * .11, a = acos(clamp(dot(d, c), -1., 1.));
      float buraco = smoothstep(r, r * .75, a), borda = smoothstep(r * 1.35, r, a) - buraco;
      h += borda * .14 - buraco * .12;
      col *= 1. - buraco * .22; col += borda * .06;
    }
  }

  // tom geral: mais escuro e saturado, na cara roxa do site
  col = mix(col, col * hsl(H, .7, .55) * 1.6, .35) * .62;

  // o brilho base que o site sempre teve (emissive hsl(hue,78%,10%) x .42)
  emi += hsl(H, .78, .1) * .42;
  // as cores sao pensadas em sRGB (como um canvas); a textura e linear: converte
  // uma vez aqui (gravar num alvo sRGB convertia de novo e o planeta saia lavado)
  if (uSaida == 0) gl_FragColor = vec4(pow(clamp(col, 0., 1.), vec3(2.2)), 1.);
  else if (uSaida == 1) gl_FragColor = vec4(clamp(h, 0., 1.), rug, 0., 1.);
  else gl_FragColor = vec4(pow(clamp(emi, 0., 1.), vec3(2.2)), 1.);
}`;

const caches = new WeakMap();
let quad = null, cam = null, mat = null;

/** { map, relevo, brilho } do planeta (cache por renderer) */
export function texturasPlaneta(renderer, { key, hue, seed, tam = 1024 }) {
  let cache = caches.get(renderer); if (!cache) caches.set(renderer, cache = new Map());
  const chave = `${key}|${hue}|${seed}|${tam}`;
  if (cache.has(chave)) return cache.get(chave);
  if (!quad) {
    mat = new THREE.ShaderMaterial({
      uniforms: { uHue: { value: 0 }, uSeed: { value: 0 }, uTipo: { value: 0 }, uSaida: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false
    });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    cam = new THREE.Camera();
  }
  mat.uniforms.uHue.value = hue; mat.uniforms.uSeed.value = (seed % 97) * .37; mat.uniforms.uTipo.value = TIPO_PLANETA[key] ?? 0;
  const alvo = (w, h, srgb) => {
    const rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.ClampToEdgeWrapping });
    if (srgb) rt.texture.colorSpace = THREE.SRGBColorSpace;
    rt.texture.anisotropy = 4;
    return rt;
  };
  const rts = [alvo(tam, tam / 2, false), alvo(tam, tam / 2, false), alvo(tam / 2, tam / 4, false)];
  const antes = renderer.getRenderTarget(), autoClear = renderer.autoClear, xr = renderer.xr.enabled;
  renderer.xr.enabled = false; renderer.autoClear = true;
  rts.forEach((rt, saida) => { mat.uniforms.uSaida.value = saida; renderer.setRenderTarget(rt); renderer.render(quad, cam); });
  renderer.setRenderTarget(antes); renderer.autoClear = autoClear; renderer.xr.enabled = xr;
  const r = { map: rts[0].texture, relevo: rts[1].texture, brilho: rts[2].texture, alvos: rts };
  cache.set(chave, r);
  return r;
}

/** libera as texturas de um renderer (o jogo chama ao fechar) */
export function liberarTexturasPlaneta(renderer) {
  const cache = caches.get(renderer); if (!cache) return;
  for (const r of cache.values()) r.alvos.forEach((rt) => rt.dispose());
  caches.delete(renderer);
}

/** o material do planeta (o mesmo no site e no jogo) */
export function materialPlaneta(THREEref, t, hue, extra = {}) {
  return new THREEref.MeshPhysicalMaterial({
    map: t.map, bumpMap: t.relevo, bumpScale: 2.2, roughnessMap: t.relevo, emissiveMap: t.brilho,
    color: new THREEref.Color(`hsl(${hue},52%,72%)`), roughness: 1, metalness: .03,
    clearcoat: .12, clearcoatRoughness: .68, sheen: .25, sheenColor: new THREEref.Color(`hsl(${hue + 6},38%,74%)`),
    emissive: new THREEref.Color(0xffffff), emissiveIntensity: 1, ...extra
  });
}

/** os pixels da cor do planeta (lidos da placa de video uma vez): o chao da
 *  superficie no jogo usa as mesmas cores. Linhas de cima para baixo. */
export function pixelsPlaneta(renderer, opc) {
  const t = texturasPlaneta(renderer, opc);
  if (t.pixels) return t.pixels;
  const rt = t.alvos[0], w = rt.width, h = rt.height, cru = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, w, h, cru);
  // a placa de video guarda de baixo para cima: vira para ficar como um canvas
  // ...e a cor esta em linear: volta para sRGB (o chao trata como um canvas)
  const srgb = new Uint8Array(256); for (let i = 0; i < 256; i++) srgb[i] = Math.round(Math.pow(i / 255, 1 / 2.2) * 255);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const de = (h - 1 - y) * w * 4, para = y * w * 4;
    for (let k = 0; k < w * 4; k++) data[para + k] = (k & 3) === 3 ? cru[de + k] : srgb[cru[de + k]];
  }
  return (t.pixels = { width: w, height: h, data });
}
