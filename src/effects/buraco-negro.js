/**
 * Buraco negro do Contato: o fim da viagem que comeca no universo.
 *
 * Um quad em tela cheia, WebGL puro — nao vale subir uma cena Three.js para um
 * shader so. Tudo e analitico (nada de marcha de raio), entao o custo por
 * pixel e baixo e cabe em resolucao cheia:
 *
 *  - lente: cada pixel amostra o fundo desviado pela aproximacao de lente
 *    fina (beta = theta - thetaE^2/theta). E isso que dobra as estrelas em
 *    volta da sombra e cria o anel de Einstein;
 *  - disco: plano inclinado quase de perfil. A metade da frente passa na
 *    frente da sombra; a de tras aparece DOBRADA por cima e por baixo dela,
 *    que e o desenho que todo mundo reconhece;
 *  - Doppler: o lado que vem na direcao da camera brilha mais;
 *  - cor: branco quente no centro caindo para o lavanda/violeta do site, e
 *    nao o laranja de filme — a identidade e da moldura.
 *
 * Canvas com alfa: fora do buraco ele e transparente e o fundo da secao
 * aparece. So a sombra e o que brilha tem opacidade.
 */

const VERT = `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 cor;
uniform vec2 uRes;      // px do canvas
uniform vec2 uCentro;   // centro do buraco, px do canvas (origem embaixo)
uniform float uR;       // raio da sombra em px
uniform float uT;       // tempo em s
uniform float uEntrada; // 0..1 enquanto a secao entra em cena
uniform vec2 uInclina;  // leve giro vindo do ponteiro
uniform vec3 uOnda;     // onda de choque do clique: x, y (px do canvas), idade em s (<0 = nenhuma)

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){ float a = .5, s = 0.; for(int i = 0; i < 4; i++){ s += a * ruido(p); p *= 2.03; a *= .5; } return s; }

// Estrelas procedurais em celulas: uma por celula, com brilho e cor proprios.
vec3 estrelas(vec2 p){
  vec3 c = vec3(0);
  for(int k = 0; k < 2; k++){
    float esc = k == 0 ? 7.0 : 15.0;
    vec2 g = p * esc, id = floor(g), f = fract(g) - .5;
    float h = hash(id + float(k) * 17.0);
    vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - .5;
    float d = length(f - o * .7);
    float b = smoothstep(.06, 0., d) * step(.82, h) * (k == 0 ? 1. : .55);
    c += b * mix(vec3(.78, .72, 1.), vec3(1.), hash(id + 1.3));
  }
  return c;
}

// Paleta: violeta profundo -> lavanda -> branco quente
vec3 paleta(float x){
  x = clamp(x, 0., 1.);
  vec3 a = vec3(.20, .09, .46), b = vec3(.66, .52, 1.), c = vec3(1., .96, .92);
  return x < .55 ? mix(a, b, x / .55) : mix(b, c, (x - .55) / .45);
}

// Brilho do disco num raio r (em unidades de sombra) e angulo phi
float disco(float r, float phi){
  const float rin = 1.45, rout = 4.6;
  if(r < rin * .92 || r > rout) return 0.;
  float borda = smoothstep(rin * .92, rin * 1.08, r) * (1. - smoothstep(rout * .62, rout, r));
  // Kepler: o miolo gira mais rapido que a borda
  float w = uT * 1.25 * pow(r / rin, -1.5);
  vec2 q = vec2(r * 2.1, (phi + w) * 2.6);
  float faixas = fbm(q + vec2(0., uT * .05)) * .75 + .45 * fbm(q * 2.7 - 3.1);
  float queda = pow(rin / r, 1.35);
  return borda * queda * (.45 + faixas) * 1.6;
}

void main(){
  vec2 px = gl_FragCoord.xy;
  // Onda de choque: um anel que sai do clique e empurra o espaco para fora ao
  // passar. Entorta a lente, os fluxos e o disco juntos, porque mexe no pixel
  // antes de tudo.
  float onda = 0.;
  if(uOnda.z >= 0.){
    vec2 dq = px - uOnda.xy; float dO = length(dq);
    float raio = uOnda.z * uR * 5.5;
    onda = exp(-pow((dO - raio) / (uR * .22), 2.)) * exp(-uOnda.z * 1.7);
    px -= dq / max(dO, 1.) * onda * uR * .12;
  }
  vec2 uv = (px - uCentro) / uR;               // em unidades de raio da sombra
  float d = length(uv);

  // Inclinacao quase de perfil, com um tiquinho de ponteiro
  float inc = .16 + uInclina.y * .05;          // cos da inclinacao: menor = mais de perfil
  float rot = -.12 + uInclina.x * .06;         // disco levemente torto
  mat2 Rm = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
  vec2 v = Rm * uv;

  // --- fundo com lente ---
  float thetaE = 1.55;
  vec2 fonte = uv * (1. - thetaE * thetaE / max(d * d, .0001));
  vec3 fundo = estrelas(fonte * .09 + uCentro / uRes) * .9;
  float neb = fbm(fonte * .12 + 4.) ;
  fundo += vec3(.30, .20, .62) * pow(neb, 3.) * .35;
  // perto do anel de Einstein a luz se concentra
  fundo *= 1. + 1.6 * exp(-pow((d - thetaE) * 3.2, 2.));

  // --- disco da frente (plano visto quase de lado) ---
  vec2 dp = vec2(v.x, v.y / inc);
  float rF = length(dp), phiF = atan(dp.y, dp.x);
  float frente = disco(rF, phiF) * step(v.y, 0.) ;
  // metade de cima do plano fica atras da sombra
  float atras = disco(rF, phiF) * step(0., v.y) * smoothstep(.98, 1.25, d);

  // --- imagem dobrada da parte de tras: arcos colados na sombra ---
  float rL = d, phiL = atan(v.y, v.x);
  float rEq = 1.45 + (rL - 1.02) * 2.2;       // leva a faixa perto da sombra para o disco
  float arco = disco(rEq, phiL * 1.0 + 1.3) * smoothstep(1.0, 1.06, rL) * (1. - smoothstep(1.35, 2.1, rL));
  arco *= .55 + .45 * abs(sin(phiL));          // mais forte em cima e embaixo

  // anel de fotons
  float anel = exp(-pow((d - 1.035) * 42., 2.)) * .7;

  // Doppler: o lado esquerdo vem na nossa direcao
  float dop = 1. + .75 * clamp(-v.x / max(rF, .3), -1., 1.);
  float dopArco = 1. + .5 * clamp(-v.x / max(d, .3), -1., 1.);

  // --- fluxos: filamentos em espiral logaritmica caindo no buraco ---
  // fase constante ao longo da espiral; somar tempo empurra o desenho para
  // dentro. Achatados como o disco, para parecerem vir do mesmo plano.
  vec2 vf = vec2(v.x, v.y * 1.9);
  float df = length(vf), lr = log(max(df, 1e-3)), phF = atan(vf.y, vf.x);
  float fase = phF * 3. + lr * 5.5 + uT * 1.1;
  float fil = pow(.5 + .5 * sin(fase + fbm(vec2(phF * 2., lr * 3.) - uT * .2) * 3.), 7.);
  float quebra = smoothstep(.38, .78, fbm(vec2(fase * .45, lr * 4. - uT * .7)));
  float fluxo = fil * quebra * smoothstep(1.35, 2.4, df) * (1. - smoothstep(4.2, 8.5, df)) * .5;

  float luz = (frente + atras * .8) * dop + arco * dopArco + anel + fluxo;
  luz += onda * .35;
  luz *= mix(.25, 1., uEntrada);

  vec3 c = paleta(luz * .75) * (luz * 1.2 + .15 * sqrt(luz));
  // bloom barato: halo largo em volta da sombra e um brilho ao longo do plano
  float halo = exp(-max(d - 1., 0.) * .75);
  float faixaPlano = exp(-abs(v.y) * 5.) * smoothstep(5.5, 1.2, abs(v.x));
  c += vec3(.46, .30, .95) * (.09 * halo + .06 * faixaPlano) * uEntrada;
  c *= .78;

  // sombra: preto que tampa o fundo (menos o disco da frente, que passa na frente)
  float sombra = 1. - smoothstep(.985, 1.02, d);
  vec3 atrasDaSombra = fundo * (1. - sombra);
  vec3 total = atrasDaSombra * smoothstep(5.5, 1.5, d) + c;

  // alfa: sombra opaca, o resto so onde ha luz; esmaece longe do buraco
  float alfaFundo = clamp(length(atrasDaSombra) * 1.2, 0., 1.) * smoothstep(5.5, 1.5, d);
  float a = clamp(max(max(sombra, alfaFundo), dot(c, vec3(.4))), 0., 1.);
  // tonemap suave para o branco nao estourar
  total = total / (1. + total * .55);
  cor = vec4(total, a);
}`;

export function montarBuracoNegro(secao) {
  const canvas = document.createElement('canvas');
  canvas.className = 'buraco-negro';
  canvas.setAttribute('aria-hidden', 'true');
  secao.prepend(canvas);

  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false, alpha: true });
  if (!gl) { canvas.remove(); return null; }

  const compila = (tipo, src) => {
    const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  try {
    gl.attachShader(prog, compila(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('[buraco-negro]', e.message);
    canvas.remove();
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uCentro', 'uR', 'uT', 'uEntrada', 'uInclina', 'uOnda']) U[n] = gl.getUniformLocation(prog, n);

  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, rodando = false, raf = 0;
  const centroCss = { x: 0, y: 0, r: 0 };
  let onda = null, ultimo = 0, entrada = 0, alvoX = 0, alvoY = 0, incX = 0, incY = 0;
  const t0 = performance.now();

  function medir() {
    const r = secao.getBoundingClientRect();
    const celular = innerWidth <= 900;
    // No celular resolucao menor: o disco e macio. Abaixo de ~.85 a borda da
    // sombra comeca a serrilhar (visto em 375px).
    dpr = Math.min(devicePixelRatio || 1, 1.5) * (celular ? .85 : 1);
    W = Math.round(r.width * dpr); H = Math.round(r.height * dpr);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
  }

  function geometria() {
    const celular = innerWidth <= 900;
    // Desktop: o lado direito, que o titulo deixa livre. Celular: no alto, atras do titulo.
    // 901-1200px: o titulo ocupa mais da largura, o buraco vai mais para a borda
    const cx = (celular ? .66 : innerWidth < 1200 ? .82 : .76) * W, cyTopo = (celular ? .18 : .40) * H;
    const R = Math.min(W, H) * (celular ? .12 : .10) * (.72 + .28 * entrada);
    return { cx, cy: H - cyTopo, R };
  }

  function progressoEntrada() {
    const r = secao.getBoundingClientRect();
    // 0 quando o topo da secao aparece no pe da tela, 1 quando ela assenta
    return Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * .9)));
  }

  function quadro(agora) {
    const alvo = progressoEntrada();
    // passos por tempo: iguais em qualquer taxa de quadros
    const dt = ultimo ? Math.min(30, (agora - ultimo) / 16.667) : 1;
    ultimo = agora;
    const passo = (k) => 1 - Math.pow(1 - k, dt);
    entrada += (alvo - entrada) * (reduz ? 1 : passo(.08));
    incX += (alvoX - incX) * passo(.05); incY += (alvoY - incY) * passo(.05);
    const { cx, cy, R } = geometria();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, W, H);
    const ux = cx + incX * R * .25, uy = cy - incY * R * .15;
    gl.uniform2f(U.uCentro, ux, uy);
    // em px CSS e com y de cima para baixo, para quem desenha por cima (orbita)
    centroCss.x = ux / dpr; centroCss.y = (H - uy) / dpr; centroCss.r = R / dpr;
    gl.uniform1f(U.uR, R);
    gl.uniform1f(U.uT, reduz ? 12 : (agora - t0) / 1000);
    gl.uniform1f(U.uEntrada, entrada);
    gl.uniform2f(U.uInclina, incX, incY);
    const idade = onda ? (agora - onda.t0) / 1000 : -1;
    if (onda && idade > 2.6) onda = null;
    gl.uniform3f(U.uOnda, onda ? onda.x : 0, onda ? onda.y : 0, onda ? idade : -1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (rodando && !reduz) raf = requestAnimationFrame(quadro);
  }

  const ligar = () => { if (rodando) return; rodando = true; raf = requestAnimationFrame(quadro); };
  const desligar = () => { rodando = false; cancelAnimationFrame(raf); ultimo = 0; };

  // So gasta GPU com a secao na tela
  const io = new IntersectionObserver((es) => (es[es.length - 1].isIntersecting ? ligar() : desligar()), { rootMargin: '120px' });
  io.observe(secao);

  const aoMover = (e) => {
    alvoX = (e.clientX / innerWidth) * 2 - 1;
    alvoY = (e.clientY / innerHeight) * 2 - 1;
  };
  const aoRolar = () => { if (reduz) quadro(performance.now()); };
  // Clique no espaco vazio do Contato solta uma onda. Links e botoes ficam de fora.
  const aoClicar = (e) => {
    if (reduz || e.target.closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    onda = { x: (e.clientX - r.left) * dpr, y: H - (e.clientY - r.top) * dpr, t0: performance.now() };
  };
  secao.addEventListener('pointerdown', aoClicar);
  const aoRedimensionar = () => { medir(); quadro(performance.now()); };
  addEventListener('pointermove', aoMover, { passive: true });
  addEventListener('scroll', aoRolar, { passive: true });
  addEventListener('resize', aoRedimensionar, { passive: true });
  // a secao muda de altura sem a janela mudar (o rodape entra depois, fontes
  // carregam): sem isto o canvas ficava esticado
  const ro = new ResizeObserver(aoRedimensionar);
  ro.observe(secao);

  medir();
  quadro(performance.now());

  return {
    centro: () => centroCss,
    destruir() {
      desligar(); io.disconnect(); ro.disconnect();
      removeEventListener('pointermove', aoMover);
      removeEventListener('scroll', aoRolar);
      removeEventListener('resize', aoRedimensionar);
      secao.removeEventListener('pointerdown', aoClicar);
      canvas.remove();
    }
  };
}
