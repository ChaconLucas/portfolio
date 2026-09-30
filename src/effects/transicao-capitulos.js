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
 *           desfaz queimando.
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
    </div>`;
  document.body.appendChild(raiz);
  const V = {
    gatecheck: raiz.querySelector('.v-gate'),
    wsl: raiz.querySelector('.v-wsl'),
    rare7: raiz.querySelector('.v-rare'),
    flash: raiz.querySelector('.v-flash')
  };
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
