/**
 * Vinhetas entre os capitulos de projeto — uma com a cara de cada projeto.
 *
 * Tempo: a vinheta so comeca quando o capitulo anterior chega na ULTIMA tela
 * da demonstracao. Ela entra e cobre a tela inteira na metade; ai o capitulo
 * novo ja esta por baixo (na primeira tela dele) e a vinheta sai revelando.
 * O anterior fica parado na ultima tela durante tudo (o sticky dele ja soltou;
 * o `translate` segura ele no lugar). progressoCapitulo() desconta o trecho
 * via __portalAtraso, entao a demonstracao do novo so comeca depois.
 *
 *  - WSL:   vinheta de transmissao esportiva (SporTV) — faixas diagonais
 *           verde-agua, branca e verde-escura varrem a tela com "WSL GAMES";
 *           a principal tem borda de onda quebrando, com espuma na crista;
 *  - Rare7: portas pretas com filete dourado fecham, a marca RARE7 brilha em
 *           ouro no meio, e elas abrem;
 *  - GateCheck (primeiro capitulo, nao tem anterior para segurar): um
 *           ingresso gigante cai cobrindo a tela, o leitor verde passa no QR,
 *           carimba ACESSO LIBERADO e o ingresso rasga no picote — as duas
 *           metades saem girando e revelam a balada;
 *  - FLASH: veu vermelho que queima em ruido com borda incandescente (ref.
 *           Noise Dissolve Reveal, 21st), mostra o cachorro e "FLASH", e se
 *           desfaz queimando;
 *  - Coworking Agents: a tela se monta em pixels como o escritorio do app
 *           (parede de tijolo, piso de taco, mesas). Um terminal roda
 *           `npx coworking-agents` e lista as sessoes; enquanto isso os agentes
 *           entram andando, sentam e cada um ganha o seu estado (codigo,
 *           terminal, "!", "?"), com pulsos subindo das telas. O nome aparece
 *           e o escritorio se desfaz em pixels.
 */

export function montarTransicaoCapitulos() {
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const capitulos = [...document.querySelectorAll('.project-chapter')];
  if (reduz || !capitulos.length) return;
  document.documentElement.classList.add('capitulos-portal');

  const pares = capitulos.slice(1).map((ch) => {
    const ant = ch.previousElementSibling;
    return {
      ch,
      sticky: ch.querySelector('.project-chapter-sticky'),
      antSticky: ant?.classList.contains('project-chapter') ? ant.querySelector('.project-chapter-sticky') : null,
      tipo: ch.dataset.project
    };
  }).filter((p) => p.sticky && p.antSticky);

  const primeiro = capitulos[0].dataset.project === 'gatecheck' ? capitulos[0] : null;
  const primeiroSticky = primeiro?.querySelector('.project-chapter-sticky');
  const raiz = document.createElement('div');
  raiz.className = 'vinhetas';
  raiz.setAttribute('aria-hidden', 'true');
  raiz.innerHTML = `
    <div class="vinheta v-gate">
      <div class="g-metade g-corpo">
        <span class="g-selo">GATECHECK · INGRESSO DIGITAL</span>
        <strong class="g-evento">NOITE<br>DE ABERTURA</strong>
        <span class="g-info"><b>PISTA</b><b>LOTE 1</b><b>SAB · 23H</b></span>
        <span class="g-carimbo">✓ ACESSO LIBERADO</span>
      </div>
      <div class="g-metade g-canhoto">
        <canvas class="g-qr" width="29" height="29"></canvas>
        <i class="g-laser"></i>
        <span class="g-cod">#GC-0001</span>
      </div>
    </div>
    <div class="vinheta v-wsl">
      <i class="v-faixa f1"></i><i class="v-faixa f2"></i>
      <i class="v-faixa f3"><span class="v-wsl-titulo">WSL GAMES</span><span class="v-wsl-sub">DROP SUA ONDA · #OMARTEMHISTÓRIA</span></i>
      <svg class="v-faixa v-faixa-espuma" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path class="v-espuma"/></svg>
    </div>
    <div class="vinheta v-rare">
      <i class="v-porta esq"></i><i class="v-porta dir"></i>
      <span class="v-rare-marca">RARE7</span><span class="v-rare-sub">QUALIDADE PREMIUM</span>
    </div>
    <div class="vinheta v-flash">
      <canvas class="v-flash-veu"></canvas>
      <img class="v-flash-cachorro" src="/assets/projects/flash-cachorro.png" alt="">
      <span class="v-flash-nome">FLASH</span>
    </div>
    <div class="vinheta v-cw">
      <canvas class="v-cw-pix"></canvas>
      <div class="v-cw-term">
        <div class="v-cw-barra"><i></i><i></i><i></i><span>~ — zsh</span></div>
        <p><span><b class="c-cmd">$</b> npx coworking-agents</span></p>
        <p><span><b class="c-dim">▸</b> lendo ~/.claude e ~/.codex…</span></p>
        <p><span><b class="c-ok">●</b> ada&nbsp;&nbsp;&nbsp;&nbsp;api&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;editando</span></p>
        <p><span><b class="c-ok">●</b> linus&nbsp;&nbsp;api&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;terminal</span></p>
        <p><span><b class="c-err">!</b> dennis&nbsp;web-app&nbsp;precisa de você</span></p>
        <p><span><b class="c-warn">?</b> grace&nbsp;&nbsp;mobile&nbsp;&nbsp;aguardando aprovação</span></p>
        <p><span><b class="c-ok">✓</b> 6 agentes no escritório · 127.0.0.1:4777</span></p>
      </div>
      <span class="v-cw-nome">COWORKING<br>AGENTS</span>
      <span class="v-cw-sub">CADA SESSÃO DE IA, UMA PESSOA NUMA MESA</span>
    </div>`;
  document.body.appendChild(raiz);
  const V = {
    gatecheck: raiz.querySelector('.v-gate'),
    wsl: raiz.querySelector('.v-wsl'),
    rare7: raiz.querySelector('.v-rare'),
    flash: raiz.querySelector('.v-flash'),
    coworking: raiz.querySelector('.v-cw')
  };
  const pix = criarEscritorioPixel(raiz.querySelector('.v-cw-pix'));
  const linhasTerm = [...raiz.querySelectorAll('.v-cw-term p span')].map((el) => ({ el, n: el.textContent.length }));
  const veu = criarVeu(raiz.querySelector('.v-flash-veu'));

  const clamp = (v) => Math.max(0, Math.min(1, v));
  const suave = (t) => t * t * (3 - 2 * t);
  // fase de entrada (0..1 ate cobrir) e de saida (0..1 depois de cobrir)
  const fases = (q) => ({ ent: suave(clamp(q / .5)), sai: suave(clamp((q - .5) / .5)) });

  // QR do canhoto (so desenho, sem conteudo)
  {
    const c = raiz.querySelector('.g-qr').getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, 29, 29); c.fillStyle = '#0b0714';
    for (let y = 1; y < 28; y++) for (let x = 1; x < 28; x++) if (Math.random() > .5) c.fillRect(x, y, 1, 1);
    [[1, 1], [21, 1], [1, 21]].forEach(([x, y]) => { c.fillRect(x, y, 7, 7); c.fillStyle = '#fff'; c.fillRect(x + 1, y + 1, 5, 5); c.fillStyle = '#0b0714'; c.fillRect(x + 2, y + 2, 3, 3); });
  }

  const DESENHO = {
    gatecheck(el, q) {
      const { ent, sai } = fases(q);
      // entra caindo de cima com um leve giro; sai rasgando no picote
      const a = el.querySelector('.g-corpo'), b = el.querySelector('.g-canhoto');
      const cai = (1 - ent) * -110, gira = (1 - ent) * -6;
      const r = suave(clamp((sai - .12) / .88));
      a.style.transform = `translate(${-r * 70}vw, ${cai + r * -18}vh) rotate(${gira - r * 14}deg)`;
      b.style.transform = `translate(${r * 60}vw, ${cai + r * 40}vh) rotate(${gira + r * 22}deg)`;
      // o leitor passa no QR e o carimbo aparece quando le
      const le = clamp((q - .3) / .18);
      el.querySelector('.g-laser').style.top = `${(8 + 84 * (.5 - .5 * Math.cos(le * Math.PI * 2))).toFixed(1)}%`;
      el.querySelector('.g-laser').style.opacity = (le > 0 && le < 1) ? '1' : '0';
      const ok = clamp((q - .46) / .05);
      const c = el.querySelector('.g-carimbo');
      c.style.opacity = ok.toFixed(3);
      c.style.transform = `rotate(-8deg) scale(${(1.6 - ok * .6).toFixed(3)})`;
      el.classList.toggle('lido', ok > 0);
    },
    wsl(el, q) {
      const { ent, sai } = fases(q);
      // cada faixa atravessa da direita para a esquerda; cobertura total no meio
      el.querySelectorAll('.v-faixa').forEach((f, n) => {
        const i = Math.min(n, 2);                  // a espuma (4a) anda com a f3
        const atraso = i * .12;
        const e = suave(clamp((ent - atraso) / (1 - atraso)));
        const s = suave(clamp((sai - (.24 - atraso)) / (1 - (.24 - atraso))));
        f.style.transform = `translateX(${(1 - e) * 135 - s * 135}vw) skewX(-18deg)`;
      });
      // a faixa principal tem a borda de uma onda quebrando, e a crista ganha
      // espuma: o recorte e a espuma usam a mesma curva
      const f3 = el.querySelector('.f3'), esp = el.querySelector('.v-espuma');
      const fase = q * 14;
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const y = i / 48 * 100;
        const x = 7 + 4.2 * Math.sin(i * .31 + fase) + 2 * Math.sin(i * .85 - fase * 1.3);
        pts.push([x, y]);
      }
      f3.style.clipPath = `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(',')},100% 100%,100% 0%)`;
      esp.setAttribute('d', 'M' + pts.map(([x, y]) => `${(x * 10).toFixed(1)} ${(y * 10).toFixed(1)}`).join(' L'));
      const t = el.querySelector('.v-wsl-titulo'), sub = el.querySelector('.v-wsl-sub');
      t.style.transform = `translateX(${(1 - ent) * 40 - sai * 40}vw) skewX(18deg)`;
      sub.style.transform = `translateX(${(1 - ent) * 70 - sai * 70}vw) skewX(18deg)`;
    },
    rare7(el, q) {
      const { ent, sai } = fases(q);
      const fecha = suave(clamp(ent / .9)), abre = suave(clamp((sai - .15) / .85));
      el.querySelector('.esq').style.transform = `translateX(${(-1 + fecha - abre) * 100}%)`;
      el.querySelector('.dir').style.transform = `translateX(${(1 - fecha + abre) * 100}%)`;
      const m = el.querySelector('.v-rare-marca'), sub = el.querySelector('.v-rare-sub');
      const aparece = clamp((q - .3) / .15) * (1 - clamp((q - .62) / .12));
      m.style.opacity = sub.style.opacity = aparece.toFixed(3);
      m.style.transform = `translate(-50%,-50%) scale(${.9 + q * .18})`;
      // brilho dourado atravessando a marca
      m.style.backgroundPosition = `${(1 - clamp((q - .3) / .35)) * 100}% 50%`;
    },
    flash(el, q) {
      const { ent, sai } = fases(q);
      veu.desenhar(q < .5 ? ent : 1 - sai, q < .5);
      const meio = clamp((q - .3) / .12) * (1 - clamp((q - .64) / .1));
      el.querySelector('.v-flash-cachorro').style.opacity = meio.toFixed(3);
      el.querySelector('.v-flash-cachorro').style.transform = `translate(-50%,-58%) translateX(${(q - .5) * 30}vw)`;
      const n = el.querySelector('.v-flash-nome');
      n.style.opacity = meio.toFixed(3);
      n.style.transform = `translate(-50%,0) scale(${.94 + q * .12})`;
    },
    coworking(el, q) {
      const { ent, sai } = fases(q);
      pix.desenhar(q, q < .5 ? ent : 1 - sai, q < .5);
      // o terminal digita linha a linha (largura em ch: a fonte e mono)
      const term = el.querySelector('.v-cw-term');
      linhasTerm.forEach(({ el: l, n }, i) => {
        const t0 = .14 + i * .04, dur = i === 0 ? .06 : .03;
        l.style.maxWidth = `${Math.round(clamp((q - t0) / dur) * n)}ch`;
        l.parentElement.style.opacity = q >= t0 ? '1' : '0';
      });
      const vt = clamp((q - .1) / .04) * (1 - clamp((q - .47) / .05));
      term.style.opacity = vt.toFixed(3);
      term.style.transform = `translate(-50%,0) translateY(${((1 - clamp((q - .1) / .06)) * 16).toFixed(1)}px)`;
      // e da lugar ao nome, que sai junto com os pixels
      const meio = clamp((q - .47) / .06) * (1 - clamp((q - .64) / .08));
      const n = el.querySelector('.v-cw-nome'), sub = el.querySelector('.v-cw-sub');
      n.style.opacity = sub.style.opacity = meio.toFixed(3);
      n.style.transform = `translate(-50%,-50%) scale(${(Math.round((.92 + q * .16) * 40) / 40).toFixed(3)})`;
    }
  };

  const esconder = (el, sim) => {
    el.style.opacity = sim ? '0' : '';
    el.style.pointerEvents = sim ? 'none' : '';
  };
  let pendente = false;
  function atualizar() {
    pendente = false;
    const H = innerHeight;
    const R = H * (innerWidth <= 900 ? .6 : 1);      // igual ao --revelacao do CSS
    let ativo = null, qAtivo = 0;
    for (const p of pares) {
      p.ch.__portalAtraso = R;
      const top = p.ch.getBoundingClientRect().top;
      const q = clamp(-top / R);
      // Esconder com OPACITY, e nao clip-path: o IntersectionObserver de cada
      // cena 3D leva clip-path dos ancestrais em conta, marcava a cena como
      // invisivel enquanto o capitulo chegava escondido, e o Chrome nao avisava
      // de novo quando o recorte saia — a cena ficava parada, sem desenhar.
      if (top > 0 || q >= 1) {
        // ainda chegando (fica escondido) ou ja passou
        esconder(p.sticky, top > 0);
        p.antSticky.style.translate = '';
        continue;
      }
      p.antSticky.style.translate = `0 ${(q * R).toFixed(1)}px`;
      // o novo so aparece depois que a vinheta cobriu a tela
      esconder(p.sticky, q < .5);
      ativo = p.tipo; qAtivo = q;
    }
    // GateCheck, o primeiro: cobre enquanto o capitulo sobe a ultima tela
    // e revela ja parado no topo. __portalAtraso segura a demonstracao ate o
    // fim da revelacao (o CSS da essa altura a mais para ele).
    if (primeiro && primeiroSticky && !ativo) {
      const Rg = H * (innerWidth <= 900 ? .3 : .5);
      primeiro.__portalAtraso = Rg;
      const top = primeiro.getBoundingClientRect().top;
      const q = top > 0 ? .5 * (1 - top / H) : .5 + .5 * (-top / Rg);
      if (q > 0 && q < 1) { ativo = primeiro.dataset.project; qAtivo = q; }
      // a cena so aparece depois que o ingresso cobriu a tela
      esconder(primeiroSticky, q > 0 && q < .5);
    }
    for (const [tipo, el] of Object.entries(V)) {
      const liga = tipo === ativo;
      el.classList.toggle('ativa', liga);
      if (liga) DESENHO[tipo](el, qAtivo);
    }
    if (ativo !== 'flash') veu.esconder();
  }
  const agendar = () => { if (!pendente) { pendente = true; requestAnimationFrame(atualizar); } };
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', () => { veu.medir(); agendar(); }, { passive: true });
  atualizar();
}

/* Veu vermelho que queima em ruido (FLASH). WebGL so e criado na primeira vez
   que a vinheta aparece; fora dela o canvas fica vazio. */
function criarVeu(canvas) {
  let gl = null, U = null, W = 0, H = 0;
  const FRAG = `precision mediump float;
    uniform vec2 uRes; uniform float uLimiar, uEntrando;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for(int i = 0; i < 5; i++){ s += a * ruido(p); p = p * 2.03 + 1.7; a *= .5; } return s; }
    void main(){
      vec2 uv = gl_FragCoord.xy / uRes; vec2 p = uv * vec2(uRes.x / uRes.y, 1.) * 3.2;
      // entrando: comeca pelas bordas; saindo: queima a partir do centro
      float bias = length(uv - .5) * (uEntrando > .5 ? -.55 : .55);
      float n = fbm(p) * .8 + .2 + bias * .6;
      float lim = uLimiar * 1.25 - .1;
      float cobre = step(n, lim);
      float borda = smoothstep(.05, 0., abs(n - lim));
      vec3 veu = mix(vec3(.55, .02, .05), vec3(.95, .10, .14), fbm(p * 1.7 + 9.));
      vec3 brasa = mix(vec3(1., .45, .1), vec3(1., .95, .8), borda);
      vec3 c = veu * cobre + brasa * borda * (1. - cobre * .4);
      gl_FragColor = vec4(c, max(cobre, borda));
    }`;
  function iniciar() {
    gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    U = { res: gl.getUniformLocation(pr, 'uRes'), lim: gl.getUniformLocation(pr, 'uLimiar'), ent: gl.getUniformLocation(pr, 'uEntrando') };
    medir();
    return true;
  }
  function medir() {
    if (!gl) return;
    // meia resolucao: o veu e macio, e isto roda so durante a vinheta
    const d = Math.min(devicePixelRatio || 1, 2) * .5;
    W = canvas.width = Math.round(innerWidth * d); H = canvas.height = Math.round(innerHeight * d);
    gl.viewport(0, 0, W, H);
  }
  return {
    medir,
    desenhar(limiar, entrando) {
      if (!gl && !iniciar()) return;
      canvas.style.opacity = '1';
      gl.uniform2f(U.res, W, H); gl.uniform1f(U.lim, limiar); gl.uniform1f(U.ent, entrando ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    esconder() { canvas.style.opacity = '0'; }
  };
}

/* Escritorio em pixel art da vinheta do Coworking Agents. Um canvas pequeno
   (1 px logico = 4 px de tela) esticado com image-rendering: pixelated.
   A cena inteira e desenhada a cada quadro e depois as celulas ainda nao
   reveladas sao apagadas: entra e sai em blocos, com os agentes junto. */
function criarEscritorioPixel(canvas) {
  const ESC = 4, CEL = 11;
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, cols = 0, lins = 0, ordemE = null, ordemS = null, tijolos = null, tacos = null;
  const AG = [
    { pele: '#e0a77f', cabelo: '#2b1a12', camisa: '#e8804a', estado: 'codigo' },
    { pele: '#8a5a3c', cabelo: '#141018', camisa: '#4fa3d9', estado: 'terminal' },
    { pele: '#f1c9a5', cabelo: '#d8a03a', camisa: '#5bbf6a', estado: 'pergunta' },
    { pele: '#c98a62', cabelo: '#6b2f1f', camisa: '#c75fa8', estado: 'aprovacao' },
    { pele: '#e8b894', cabelo: '#3a3a44', camisa: '#e8c84a', estado: 'pensando' },
    { pele: '#e0a77f', cabelo: '#141018', camisa: '#7ec8e3', estado: 'codigo' },
    { pele: '#8a5a3c', cabelo: '#d8a03a', camisa: '#e84a4a', estado: 'terminal' }
  ];
  const sorte = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function medir() {
    const w = Math.ceil(innerWidth / ESC), h = Math.ceil(innerHeight / ESC);
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = W; canvas.height = H;
    cols = Math.ceil(W / CEL); lins = Math.ceil(H / CEL);
    const n = cols * lins;
    ordemE = new Float32Array(n); ordemS = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = (i / cols) | 0;
      ordemE[i] = Math.min(.999, (1 - y / lins) * .5 + sorte(i) * .5);   // sobe do chao
      ordemS[i] = sorte(i + 999);
    }
    tijolos = []; for (let k = 0; k < 400; k++) tijolos.push(sorte(k + 50));
    tacos = []; for (let k = 0; k < 400; k++) tacos.push(sorte(k + 500));
  }
  const px = (x, y, w, h, cor) => { ctx.fillStyle = cor; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function pessoa(x, y, a, sentado, passo) {
    // 16 x 24, x/y = canto de cima
    px(x + 4, y + 1, 8, 3, a.cabelo); px(x + 3, y + 2, 1, 5, a.cabelo); px(x + 12, y + 2, 1, 5, a.cabelo);
    px(x + 4, y + 4, 8, 5, a.pele); px(x + 6, y + 6, 1, 1, '#1a1020'); px(x + 9, y + 6, 1, 1, '#1a1020');
    px(x + 3, y + 10, 10, 7, a.camisa); px(x + 2, y + 11, 1, 5, a.camisa); px(x + 13, y + 11, 1, 5, a.camisa);
    if (sentado) return;
    const p = passo ? 1 : 0;
    px(x + 4, y + 17, 3, 4 + p, '#2c3550'); px(x + 9, y + 17, 3, 5 - p, '#2c3550');
    px(x + 4 - p, y + 21 + p, 3, 2, '#1c1820'); px(x + 9 + p, y + 22 - p, 3, 2, '#1c1820');
  }
  function tela(x, y, estado, f) {
    px(x - 1, y - 1, 20, 14, '#1c1a22');
    px(x, y, 18, 12, estado === 'terminal' ? '#07090a' : '#14101c');
    if (estado === 'codigo') { const cs = ['#e8804a', '#7ec8e3', '#c79bff', '#9fd67a']; for (let i = 0; i < 4; i++) px(x + 2 + ((i + f) % 3), y + 2 + i * 2.5, 4 + ((i * 7 + f * 3) % 10), 1, cs[(i + f) % 4]); }
    else if (estado === 'terminal') { for (let i = 0; i <= (f % 4); i++) px(x + 2, y + 2 + i * 2.5, 4 + ((i * 5) % 9), 1, '#5bff8a'); }
    else if (estado === 'pensando') { for (let i = 0; i <= f % 3; i++) px(x + 4 + i * 4, y + 5, 2, 2, '#c79bff'); }
    else { const c = estado === 'pergunta' ? '#e84a4a' : '#e8b44a'; px(x + 2, y + 2, 14, 8, c); px(x + 3, y + 3, 12, 6, '#14101c'); px(x + 8, y + 4, 2, 3, f % 2 ? c : '#fff'); px(x + 8, y + 8, 2, 1, f % 2 ? c : '#fff'); }
  }
  function balao(x, y, estado, f) {
    const c = { pergunta: '#e84a4a', aprovacao: '#e8b44a', pensando: '#f3ece4' }[estado];
    if (!c) return;
    if (estado === 'pergunta' && f % 2) return;   // pisca
    px(x, y, 10, 8, '#1a1020'); px(x + 1, y + 1, 8, 6, c); px(x + 4, y + 8, 2, 2, '#1a1020');
    const b = estado === 'pensando' ? '#6a5a70' : '#fff';
    if (estado === 'pensando') { px(x + 2, y + 3, 1, 1, b); px(x + 4, y + 3, 1, 1, b); px(x + 6, y + 3, 1, 1, b); }
    else { px(x + 4, y + 2, 2, 3, b); px(x + 4, y + 6, 2, 1, b); }
  }
  function cena(q) {
    const chaoY = Math.round(H * .58);
    // parede de tijolo
    px(0, 0, W, chaoY, '#1e1416');
    const cores = ['#5b2e26', '#4e2a24', '#63352b', '#552d27', '#48261f'];
    let k = 0;
    for (let y = 0, l = 0; y < chaoY; y += 6, l++) for (let x = -(l % 2) * 6; x < W; x += 12) px(x + 1, y + 1, 11, 5, cores[(tijolos[k++ % 400] * 5) | 0]);
    // janelas com a cidade
    const nj = Math.max(1, Math.floor(W / 120));
    for (let j = 0; j < nj; j++) {
      const jx = Math.round((j + .5) * W / nj) - 20, jy = Math.round(chaoY * .2);
      px(jx - 2, jy - 2, 44, 34, '#15121a'); px(jx, jy, 40, 30, '#14122a');
      for (let b = 0; b < 6; b++) { const bh = 8 + ((tacos[b + j * 7] * 18) | 0); px(jx + b * 7, jy + 30 - bh, 6, bh, '#0f0d1c'); if ((b + j + Math.floor(q * 30)) % 3) px(jx + b * 7 + 2, jy + 32 - bh, 1, 1, '#ffd9a0'); }
      px(jx + 19, jy, 2, 30, '#15121a');
    }
    // piso de taco
    for (let y = chaoY, l = 0; y < H; y += 5, l++) for (let x = -(l % 3) * 8; x < W; x += 24) px(x, y, 23, 4, ['#8a5a3a', '#7a4e32', '#94633f', '#835536'][(tacos[(l * 7 + x) & 255] * 4) | 0]);
    px(0, chaoY, W, 2, '#2a1c18');
    // tapete da sala, na cor do repositorio (como no app)
    const altTapete = Math.min(H * .2, 44);
    px(W * .04, H * .72 - 10, W * .92, altTapete, '#3a3f66'); px(W * .04, H * .72 - 10, W * .92, 1, '#5a5f8a');
    // mesas: os agentes entram andando e sentam
    const n = Math.max(3, Math.min(AG.length, Math.floor(W / 46)));
    const mesaY = Math.round(H * .72), f = Math.floor(q * 40);
    const passo = Math.floor(q * 160) % 2;
    for (let i = 0; i < n; i++) {
      const a = AG[i];
      const mx = Math.round((i + .5) * W / n);
      const t0 = .08 + i * .035, t1 = t0 + .2;
      const k2 = Math.max(0, Math.min(1, (q - t0) / (t1 - t0)));
      const sentou = q >= t1 && q < 1.5;
      if (sentou) {
        pessoa(mx - 8, mesaY - 22, a, true, 0);
        // pulso de estado subindo da tela (o SSE)
        const sobe = ((q * 3 + i * .37) % 1);
        px(mx - 1, mesaY - 16 - sobe * mesaY * .6, 2, 3, ['#5bff8a', '#7ec8e3', '#ff5a4a', '#ffc84a', '#c79bff'][i % 5]);
      }
      tela(mx - 9, mesaY - 13, sentou ? a.estado : 'pensando', f + i);
      px(mx - 20, mesaY, 40, 3, '#b07a4e'); px(mx - 20, mesaY + 3, 40, 1, '#7a5236');
      px(mx - 18, mesaY + 4, 2, 14, '#1c1a22'); px(mx + 16, mesaY + 4, 2, 14, '#1c1a22');
      px(mx - 2, mesaY - 1, 4, 1, '#1c1a22');
      if (sentou) balao(mx + 6, mesaY - 34, a.estado, f + i);
      else if (q >= t0) {
        // anda pela frente das mesas, vindo de fora da tela
        const de = i % 2 ? W + 20 : -36;
        const x = de + (mx - 8 - de) * (1 - (1 - k2) * (1 - k2));
        pessoa(x, mesaY + 22, a, false, passo);
      }
    }
    // o gato
    const gx = ((q * 1.6) % 1) * (W + 40) - 20, gy = H - 8;
    px(gx + 3, gy + 2, 9, 4, '#e8954a'); px(gx + 11, gy, 4, 4, '#e8954a'); px(gx, gy + 1, 3, 1, '#e8954a');
    px(gx + 4, gy + 6, 1, 2, '#c8743a'); px(gx + 10, gy + 6, 1, 2, '#c8743a');
  }
  return {
    desenhar(q, cobre, entrando) {
      medir();
      ctx.clearRect(0, 0, W, H);
      cena(q);
      const ordem = entrando ? ordemE : ordemS;
      for (let i = 0; i < ordem.length; i++) if (ordem[i] >= cobre) ctx.clearRect((i % cols) * CEL, ((i / cols) | 0) * CEL, CEL, CEL);
    }
  };
}
