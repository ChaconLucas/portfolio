/**
 * Avatar em ASCII do Lucas no header (no lugar do planeta).
 *
 * A foto vira uma grade de luminancia (public/assets/lucas-ascii.png, 160x192
 * em tons de cinza, ja recortada e com o fundo apagado) e cada celula vira um
 * caractere pela claridade. Dois desenhos:
 *  - mini, no botao da marca: redondo, redesenha a ~12 fps (e barato) com
 *    alguns caracteres trocando;
 *  - terminal, passando o mouse na marca com a pagina no topo (no toque:
 *    tocando; rolada, a marca so volta ao topo) ou apertando ~: um terminal de verdade, que digita
 *    `whoami` sozinho e mostra o retrato "decodificando" (cada celula
 *    embaralha ate cair no caractere certo, scanner descendo, o mouse acende
 *    os caracteres). Da para digitar: help, stack [area], projetos, contato,
 *    sobre, cv, clear, exit — com historico (setas) e Tab completando.
 * Com menos movimento: desenha uma vez, sem embaralhar.
 *
 * Conta do jogo (src/conta.js): criar-conta pergunta email, usuario e senha
 * (a senha nao aparece), entrar faz login, conta mostra quem esta logado,
 * sair desloga, pilotar abre o jogo. Clicar em "Pilotar" sem conta sobe ate
 * aqui e ja comeca o cadastro (evento 'pedir-conta').
 */
import { sessao, registrar, entrar, sair, souAdmin } from '../conta.js';

// rampa curta: com a longa o rosto virava sopa de letras; esta le como ASCII classico
const RAMPA = ' .:-=+*#%@';
const RUIDO = '01<>/\\{}[]$&?';
const FONTE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const ASPECTO = .6;            // largura do caractere / altura

function carregarLuz(url) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const luz = new Float32Array(c.width * c.height);
      for (let i = 0; i < luz.length; i++) luz[i] = d[i * 4] / 255;
      ok({ luz, w: c.width, h: c.height });
    };
    img.onerror = erro;
    img.src = url;
  });
}

// media da luminancia na area de cada celula
function grade(fonte, cols, lins) {
  const g = new Float32Array(cols * lins);
  const sx = fonte.w / cols, sy = fonte.h / lins;
  for (let r = 0; r < lins; r++) for (let c = 0; c < cols; c++) {
    let s = 0, n = 0;
    for (let y = Math.floor(r * sy); y < Math.floor((r + 1) * sy); y++)
      for (let x = Math.floor(c * sx); x < Math.floor((c + 1) * sx); x++) { s += fonte.luz[y * fonte.w + x]; n++; }
    g[r * cols + c] = n ? s / n : 0;
  }
  return g;
}

const charDe = (v) => RAMPA[Math.min(RAMPA.length - 1, Math.floor(v * RAMPA.length))];
const ruido = () => RUIDO[(Math.random() * RUIDO.length) | 0];
// roxo escuro -> lilas -> quase branco, com um toque de rosa nos mais claros
function corDe(v, extra = 0) {
  const t = Math.min(1, v + extra);
  const r = Math.round(70 + t * 170 + (t > .82 ? (t - .82) * 180 : 0));
  const g = Math.round(40 + t * 175);
  const b = Math.round(150 + t * 105);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${b})`;
}

function criarDesenho(canvas, fonte, { alturaChar, dpr }) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lins = Math.max(4, Math.round(H / alturaChar));
  const ch = H / lins, cw = ch * ASPECTO;
  const cols = Math.max(4, Math.round(W / cw));
  const g = grade(fonte, cols, lins);
  ctx.font = `600 ${ch * 1.02}px ${FONTE}`;
  ctx.textBaseline = 'top';
  return { ctx, W, H, cols, lins, ch, cw: W / cols, g };
}

/* ------------------------------------------------ conteudo do terminal -- */
// a stack e a mesma da secao Stack do site (stackData no index.html)
const STACK = {
  frontend: ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Tailwind CSS', 'Bootstrap'],
  backend: ['Python', 'FastAPI', 'PHP', 'Node.js', 'Express', 'Pydantic', 'JWT', 'bcrypt'],
  mobile: ['React Native', 'Expo', 'Expo Router', 'Redux Toolkit', 'SQLite', 'Drizzle ORM', 'AsyncStorage'],
  data: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL', 'SQLAlchemy', 'Alembic', 'Drizzle ORM'],
  security: ['JWT', 'bcrypt', 'RBAC', 'Audit Logs', 'Validation', 'Kali Linux', 'Pentest', 'Secure Dev'],
  infra: ['Git', 'GitHub', 'GitHub Actions', 'Vercel', 'Render', 'Env Vars', 'REST APIs', 'Webhooks'],
  tooling: ['VS Code', 'Terminal', 'PyCharm', 'MySQL Workbench', 'Postman', 'Insomnia', 'npm', 'pnpm'],
  analytics: ['Pandas', 'Power BI', 'CSV', 'Data Cleaning', 'Excel', 'KPIs', 'Dashboards'],
  ai: ['Claude Code', 'OpenAI Codex', 'GitHub Copilot', 'Prompting', 'Code Review', 'Human-in-the-loop']
};
const PROJETOS = [
  ['gatecheck', 'GateCheck', 'ingressos, QR Code e check-in em tempo real', '#project-gatecheck'],
  ['wsl', 'WSL Games', 'experiência interativa do campeonato de surf', '#project-wsl'],
  ['rare7', 'Rare7', 'loja de moda esportiva premium', '#project-rare7'],
  ['flash', 'FLASH', 'delivery de materiais de tatuagem', '#project-flash'],
  ['coworking', 'Coworking Agents', 'escritório em pixel art para agentes de IA', '#project-coworking']
];
const CONTATO = [
  ['email', 'lucaschacon79@gmail.com', 'mailto:lucaschacon79@gmail.com'],
  ['github', 'github.com/ChaconLucas', 'https://github.com/ChaconLucas'],
  ['linkedin', 'in/lucas-chacon', 'https://www.linkedin.com/in/lucas-chacon-129414a7/']
];
const COMANDOS = ['help', 'whoami', 'stack', 'projetos', 'contato', 'sobre', 'cv', 'criar-conta', 'entrar', 'conta', 'sair', 'pilotar', 'clear', 'exit'];

export function montarAvatarAscii() {
  const botao = document.getElementById('brandHome');
  if (!botao) return;
  const menos = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(2, devicePixelRatio || 1);

  // mini no lugar do planeta
  const antigo = botao.querySelector('.brand-ico');
  const mini = document.createElement('span');
  mini.className = 'brand-ascii';
  mini.setAttribute('aria-hidden', 'true');
  mini.innerHTML = '<canvas></canvas>';
  if (antigo) antigo.replaceWith(mini); else botao.prepend(mini);
  const cMini = mini.querySelector('canvas');
  // conta: bolinha no avatar (verde logado, vermelha sem conta) e coroa se admin
  const badge = document.createElement('i'); badge.className = 'conta-badge';
  const coroa = document.createElement('em'); coroa.className = 'conta-coroa'; coroa.textContent = '👑'; coroa.hidden = true;
  // por fora do circulo do avatar (ele corta o que passa da borda)
  const moldura = document.createElement('span'); moldura.className = 'brand-ascii-moldura';
  mini.replaceWith(moldura); moldura.append(mini, badge, coroa);
  let admin = false; try { admin = sessionStorage.getItem('su-admin') === '1'; } catch (e) { /* */ }

  // terminal
  const term = document.createElement('div');
  term.className = 'ascii-term';
  term.setAttribute('role', 'dialog');
  term.setAttribute('aria-label', 'Terminal do Lucas');
  term.innerHTML = `
    <div class="at-barra"><button class="at-fechar" aria-label="Fechar terminal"></button><i></i><i></i><span>lucas@portfolio: ~</span><b class="at-conta"></b></div>
    <div class="at-saida" aria-live="polite"></div>
    <label class="at-linha"><span class="at-prompt">lucas@portfolio:~$</span><input class="at-input" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Comando"></label>`;
  document.body.appendChild(term);
  const saida = term.querySelector('.at-saida');
  const input = term.querySelector('.at-input');

  carregarLuz('/assets/lucas-ascii.png').then((fonte) => {
    /* ------------------------------------------------------------ mini -- */
    let dMini = criarDesenho(cMini, fonte, { alturaChar: 2.6, dpr });
    const trocaMini = new Map();
    function desenharMini() {
      const { ctx, W, H, cols, lins, ch, cw, g } = dMini;
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < lins; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, v = g[i];
        if (v < .06) continue;
        ctx.fillStyle = corDe(v, .08);
        ctx.fillText(trocaMini.get(i) || charDe(v), c * cw, r * ch);
      }
    }
    desenharMini();
    if (!menos) {
      let ultimo = 0;
      const passoMini = (t) => {
        requestAnimationFrame(passoMini);
        if (document.hidden || t - ultimo < 83) return;      // ~12 fps
        ultimo = t;
        trocaMini.clear();
        const n = (dMini.cols * dMini.lins * .03) | 0;
        for (let k = 0; k < n; k++) trocaMini.set((Math.random() * dMini.g.length) | 0, ruido());
        desenharMini();
      };
      requestAnimationFrame(passoMini);
    }

    /* ------------------------------------------- retrato dentro do terminal -- */
    // so o retrato mais recente anima; os antigos ficam parados no historico
    let retrato = null, raf = 0;
    function novoRetrato() {
      if (retrato) retrato.parado = true;
      const cv = document.createElement('canvas');
      cv.className = 'at-rosto';
      saida.appendChild(cv);
      const d = criarDesenho(cv, fonte, { alturaChar: 5, dpr });
      const revela = new Float32Array(d.g.length);
      for (let i = 0; i < revela.length; i++) revela[i] = (Math.floor(i / d.cols) / d.lins) * 420 + Math.random() * 480;
      const r = { cv, d, revela, desde: performance.now(), mouse: { x: -1e3, y: -1e3 }, parado: false };
      cv.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); r.mouse.x = e.clientX - b.left; r.mouse.y = e.clientY - b.top; });
      cv.addEventListener('pointerleave', () => { r.mouse.x = r.mouse.y = -1e3; });
      // clique no rosto: embaralha e decodifica de novo
      cv.addEventListener('click', () => { r.desde = performance.now(); });
      retrato = r;
      animar();
      return r;
    }
    function desenharRetrato(r, t) {
      const { ctx, W, H, cols, lins, ch, cw, g } = r.d;
      ctx.clearRect(0, 0, W, H);
      const dec = menos ? 1e9 : t - r.desde;
      const faixa = ((t / 2600) % 1) * (H + 60) - 30;
      for (let l = 0; l < lins; l++) {
        const y = l * ch, naFaixa = r.parado ? 0 : Math.max(0, 1 - Math.abs(y - faixa) / 24);
        for (let c = 0; c < cols; c++) {
          const i = l * cols + c, v = g[i], x = c * cw;
          const perto = Math.max(0, 1 - Math.hypot(x - r.mouse.x, y - r.mouse.y) / 44);
          if (v < .05 && perto < .2) continue;
          let letra;
          if (dec < r.revela[i]) letra = Math.random() < .5 ? ruido() : ' ';
          else if (perto > .35 && Math.random() < perto * .5) letra = ruido();
          else letra = charDe(v);
          if (letra === ' ') continue;
          ctx.fillStyle = corDe(v, naFaixa * .35 + perto * .45);
          ctx.fillText(letra, x, y);
        }
      }
    }
    function animar() {
      cancelAnimationFrame(raf);
      const passo = (t) => {
        if (!aberto || !retrato) return;
        desenharRetrato(retrato, t);
        if (!menos) raf = requestAnimationFrame(passo);
      };
      raf = requestAnimationFrame(passo);
    }

    /* ----------------------------------------------------------- saida -- */
    const rolar = () => { saida.scrollTop = saida.scrollHeight; };
    function linha(html, cls = '') {
      const el = document.createElement('div');
      el.className = 'at-l ' + cls;
      el.innerHTML = html;
      saida.appendChild(el); rolar();
      return el;
    }
    // escreve varias linhas com um pequeno atraso entre elas (efeito de saida)
    let fila = Promise.resolve();
    function escrever(linhas, atraso = menos ? 0 : 28) {
      fila = fila.then(() => new Promise((ok) => {
        let k = 0;
        const um = () => {
          if (k >= linhas.length) return ok();
          const [html, cls] = Array.isArray(linhas[k]) ? linhas[k] : [linhas[k], ''];
          linha(html, cls); k++;
          atraso ? setTimeout(um, atraso) : um();
        };
        um();
      }));
      return fila;
    }
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const cmd = (c) => `<button class="at-cmd" data-cmd="${esc(c)}">${esc(c)}</button>`;

    /* ---- conta: bolinha no avatar, status na barra e linha ao abrir ---- */
    const barraConta = term.querySelector('.at-conta');
    function marcarConta() {
      const s = sessao();
      badge.classList.toggle('on', !!s); coroa.hidden = !(s && admin);
      botao.title = s ? `logado como ${s.usuario}${admin ? ' (admin)' : ''}` : 'sem conta: passe o mouse e digite entrar';
      barraConta.className = 'at-conta' + (s ? ' on' : '');
      barraConta.innerHTML = s ? `<em></em>${admin ? '👑 ' : ''}${esc(s.usuario)}` : '<em></em>sem conta';
    }
    function linhaConta() {
      const s = sessao();
      linha(s ? `<span class="at-dim">conta:</span> <b class="at-forte">${esc(s.usuario)}</b>${admin ? ' 👑' : ''} <span class="at-dim">·</span> ${cmd('pilotar')} ${admin ? cmd('admin') + ' ' : ''}${cmd('sair')}`
        : `<span class="at-dim">sem conta ·</span> ${cmd('criar-conta')} <span class="at-dim">ou</span> ${cmd('entrar')} <span class="at-dim">para jogar online</span>`);
    }
    // o servidor diz se e admin (guardado na aba)
    async function conferirAdmin() {
      const a = sessao() ? await souAdmin() : false;
      if (a !== admin) { admin = a; try { sessionStorage.setItem('su-admin', a ? '1' : '0'); } catch (e) { /* */ } marcarConta(); }
    }
    addEventListener('conta-mudou', () => { admin = false; marcarConta(); conferirAdmin(); });
    marcarConta(); conferirAdmin();

    function executar(bruto) {
      const texto = bruto.trim();
      linha(`<span class="at-prompt">lucas@portfolio:~$</span> ${esc(texto)}`, 'at-eco');
      if (!texto) return;
      const [c, ...args] = texto.toLowerCase().split(/\s+/);
      const arg = args.join(' ');
      switch (c) {
        case 'help': case 'ajuda': case '?':
          escrever([
            ['comandos disponíveis:', 'at-dim'],
            `  ${cmd('whoami')}      quem é o Lucas`,
            `  ${cmd('stack')}       tecnologias (ex: stack backend)`,
            `  ${cmd('projetos')}    produtos no ar`,
            `  ${cmd('contato')}     email, github, linkedin`,
            `  ${cmd('sobre')}       resumo rápido`,
            `  ${cmd('cv')}          abre o currículo`,
            ['jogo da nave:', 'at-dim'],
            `  ${cmd('criar-conta')} cria sua conta (email, usuário, senha)`,
            `  ${cmd('entrar')}      entra numa conta que já existe`,
            `  ${cmd('conta')}       quem está logado`,
            `  ${cmd('pilotar')}     abre o jogo`,
            `  ${cmd('sair')}        sai da conta`,
            ...(admin ? [`  ${cmd('admin')}       painel de admin (só você vê este)`] : []),
            `  ${cmd('clear')}       limpa a tela`,
            `  ${cmd('exit')}        fecha o terminal`
          ]);
          break;
        case 'whoami':
          fila = fila.then(() => { novoRetrato(); });
          escrever([
            ['<b class="at-forte">Lucas Chacon</b> — Full Stack Developer', ''],
            ['Web · APIs · Mobile · Segurança · IA · Rio de Janeiro', 'at-dim'],
            [`digite ${cmd('help')} ou tente ${cmd('stack')}`, 'at-dica']
          ]);
          break;
        case 'stack': case 'ls': {
          const area = Object.keys(STACK).find((k) => k.startsWith(arg.replace(/^~?\/?stack\/?/, '')) && arg);
          if (arg && !area) { escrever([[`stack: área não encontrada: ${esc(arg)}`, 'at-erro'], ['áreas: ' + Object.keys(STACK).map(cmd.bind(null)).join(' '), 'at-dim']]); break; }
          const areas = area ? [area] : Object.keys(STACK);
          const ls = [['~/stack', 'at-dim']];
          areas.forEach((k, n) => {
            const ramo = n === areas.length - 1 ? '└─' : '├─';
            ls.push(`<span class="at-dim">${ramo}</span> <button class="at-area" data-cmd="stack ${k}">${k.padEnd(10)}</button> ${STACK[k].map((t) => `<span class="at-tec">${esc(t)}</span>`).join(' ')}`);
          });
          if (!area) ls.push([`clique numa área ou digite ${cmd('stack security')}`, 'at-dica']);
          escrever(ls);
          break;
        }
        case 'projetos': case 'projects':
          escrever([['~/projetos', 'at-dim'], ...PROJETOS.map(([, nome, desc, alvo], n) =>
            `<span class="at-dim">${n === PROJETOS.length - 1 ? '└─' : '├─'}</span> <a class="at-link" href="${alvo}" data-ir="${alvo}">${esc(nome)}</a> <span class="at-dim">— ${esc(desc)}</span>`),
            ['clique num projeto para ir até ele', 'at-dica']]);
          break;
        case 'contato': case 'contact':
          escrever(CONTATO.map(([k, txt, href]) => `<span class="at-dim">${k.padEnd(9)}</span><a class="at-link" href="${href}" target="_blank" rel="noopener">${esc(txt)}</a>`));
          break;
        case 'sobre': case 'about':
          escrever([
            'Desenvolvedor full stack: da interface ao backend, banco,',
            'autenticação e segurança. Produtos em produção.',
            ['3 cargos · 2 empresas · full stack · Rio de Janeiro', 'at-dim']
          ]);
          break;
        case 'cv': case 'curriculo': case 'currículo':
          escrever([['abrindo o currículo…', 'at-dim']]).then(() => window.open('/curriculo.html', '_blank', 'noopener'));
          break;
        case 'clear': case 'cls':
          fila = fila.then(() => { saida.innerHTML = ''; retrato = null; });
          break;
        case 'exit': case 'quit':
          fechar();
          break;
        case 'criar-conta': case 'registrar': case 'cadastro': case 'signup':
          iniciarFluxo('registrar'); break;
        case 'entrar': case 'login':
          iniciarFluxo('entrar'); break;
        case 'conta': case 'account': {
          const s = sessao();
          escrever(s ? [[`logado como <b class="at-forte">${esc(s.usuario)}</b>${admin ? ' 👑 admin' : ''}`, ''], [`${cmd('pilotar')} · ${admin ? cmd('admin') + ' · ' : ''}${cmd('sair')}`, 'at-dica']] : [['nenhuma conta logada', 'at-dim'], [`${cmd('criar-conta')} ou ${cmd('entrar')}`, 'at-dica']]);
          break;
        }
        case 'sair': case 'logout':
          if (!sessao()) { escrever([['nenhuma conta logada', 'at-dim']]); break; }
          sair().then(() => escrever([['você saiu da conta', 'at-dim']]));
          break;
        case 'admin': case 'adm': {
          // comando escondido: para quem nao e admin, responde como se nao existisse
          const naoExiste = () => escrever([[`comando não encontrado: ${esc(c)} — tente ${cmd('help')}`, 'at-erro']]);
          if (!sessao()) { naoExiste(); break; }
          souAdmin().then((ok) => {
            if (!ok) { naoExiste(); return; }
            // mesma aba (abrir aba nova depois da resposta do servidor o navegador bloqueia)
            escrever([['🔐 acesso de admin liberado — abrindo o painel…', 'at-dim']]); setTimeout(() => location.assign('/admin.html'), 600);
          });
          break;
        }
        case 'pilotar': case 'jogar': case 'play':
          if (!sessao()) { escrever([['para pilotar, crie uma conta primeiro', 'at-erro']]); iniciarFluxo('registrar'); break; }
          escrever([['🚀 abrindo a nave…', 'at-dim']]); fechar(); document.getElementById('botaoPilotar')?.click();
          break;
        case 'sudo':
          escrever([['lucas não está no arquivo sudoers. este incidente será reportado.', 'at-erro']]);
          break;
        default:
          escrever([[`comando não encontrado: ${esc(c)} — tente ${cmd('help')}`, 'at-erro']]);
      }
    }

    /* ---- cadastro / login: perguntas em sequencia (a senha nao aparece) ---- */
    const promptEl = term.querySelector('.at-linha .at-prompt');
    const PROMPT = 'lucas@portfolio:~$';
    let fluxo = null;
    const ETAPAS = {
      registrar: [['email', 'email:', 'text'], ['usuario', 'usuário (3-16, letras/números/_):', 'text'], ['senha', 'senha (mín. 6):', 'password'], ['senha2', 'repita a senha:', 'password']],
      entrar: [['login', 'email ou usuário:', 'text'], ['senha', 'senha:', 'password']]
    };
    function perguntar() {
      const [, rotulo, tipo] = ETAPAS[fluxo.tipo][fluxo.etapa];
      promptEl.textContent = rotulo; input.type = tipo; input.value = '';
      input.setAttribute('autocomplete', tipo === 'password' ? (fluxo.tipo === 'registrar' ? 'new-password' : 'current-password') : fluxo.etapa === 0 && fluxo.tipo === 'registrar' ? 'email' : 'username');
      if (matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
    }
    function encerrarFluxo() { fluxo = null; promptEl.textContent = PROMPT; input.type = 'text'; input.setAttribute('autocomplete', 'off'); }
    function iniciarFluxo(tipo) {
      if (sessao() && tipo === 'registrar') { escrever([[`você já está logado como <b class="at-forte">${esc(sessao().usuario)}</b>`, ''], [`${cmd('pilotar')} · ${cmd('sair')}`, 'at-dica']]); return; }
      fluxo = { tipo, etapa: 0, dados: {} };
      escrever([[tipo === 'registrar' ? 'criando sua conta do jogo · <span class="at-dim">Esc cancela · já tem conta? digite</span> ' + cmd('entrar') : 'entrar na sua conta · <span class="at-dim">Esc cancela</span>', 'at-dim']]).then(perguntar);
    }
    async function responderFluxo(v) {
      const [campo, rotulo, tipo] = ETAPAS[fluxo.tipo][fluxo.etapa];
      linha(`<span class="at-prompt">${esc(rotulo)}</span> ${tipo === 'password' ? '•'.repeat(Math.min(12, v.length)) : esc(v)}`, 'at-eco');
      // atalho: no meio do cadastro, "entrar" troca para o login
      if (fluxo.tipo === 'registrar' && fluxo.etapa === 0 && /^(entrar|login)$/i.test(v.trim())) { encerrarFluxo(); iniciarFluxo('entrar'); return; }
      if (campo === 'senha2' && v !== fluxo.dados.senha) { escrever([['as senhas não batem, digite de novo', 'at-erro']]); fluxo.etapa = 2; perguntar(); return; }
      fluxo.dados[campo] = campo === 'senha' || campo === 'senha2' ? v : v.trim();
      fluxo.etapa++;
      if (fluxo.etapa < ETAPAS[fluxo.tipo].length) { perguntar(); return; }
      const f = fluxo; encerrarFluxo(); input.disabled = true;
      linha(f.tipo === 'registrar' ? 'criando conta…' : 'entrando…', 'at-dim');
      const r = f.tipo === 'registrar' ? await registrar(f.dados.email, f.dados.usuario, f.dados.senha) : await entrar(f.dados.login, f.dados.senha);
      input.disabled = false;
      if (r.erro) { escrever([[esc(r.erro), 'at-erro'], [`tente ${cmd(f.tipo === 'registrar' ? 'criar-conta' : 'entrar')} de novo`, 'at-dica']]); return; }
      escrever([[`${f.tipo === 'registrar' ? 'conta criada ✓' : 'bem-vindo de volta ✓'} — logado como <b class="at-forte">${esc(r.usuario)}</b>`, ''], [`${cmd('pilotar')} para entrar no jogo`, 'at-dica']]);
      input.focus({ preventScroll: true });
    }
    // "Pilotar" sem conta: sobe ate o topo, abre o terminal e comeca o cadastro
    // pedir-conta: { modo: 'entrar' } vem do botao Entrar do topo; sem modo, do Pilotar sem conta
    addEventListener('pedir-conta', (e) => {
      const modo = e.detail?.modo === 'entrar' ? 'entrar' : 'registrar';
      scrollTo({ top: 0, behavior: menos ? 'auto' : 'smooth' });
      const espera = () => { if (scrollY > 5) return setTimeout(espera, 80); jaAbriu = true; abrir(); if (modo === 'registrar') linha('<span class="at-dim">🚀 para pilotar a nave e jogar online, crie uma conta grátis</span>'); iniciarFluxo(modo); };
      setTimeout(espera, 120);
    });

    // clicar num comando da saida roda ele; clicar num projeto rola ate la
    saida.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) { e.preventDefault(); executar(b.dataset.cmd); input.focus({ preventScroll: true }); return; }
      const a = e.target.closest('[data-ir]');
      if (a) { e.preventDefault(); fechar(); document.querySelector(a.dataset.ir)?.scrollIntoView({ behavior: 'smooth' }); }
    });

    /* ---------------------------------------------------------- entrada -- */
    const historico = []; let pos = 0;
    input.addEventListener('keydown', (e) => {
      if (fluxo && e.key === 'Escape') { e.preventDefault(); linha('cancelado', 'at-dim'); encerrarFluxo(); return; }
      if (fluxo && e.key === 'Enter') { e.preventDefault(); const v = input.value; input.value = ''; responderFluxo(v); return; }
      if (fluxo) return;
      if (e.key === 'Enter') {
        const v = input.value; input.value = '';
        if (v.trim()) { historico.push(v); pos = historico.length; }
        executar(v);
      } else if (e.key === 'ArrowUp') {
        if (pos > 0) { pos--; input.value = historico[pos]; } e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (pos < historico.length) { pos++; input.value = historico[pos] || ''; } e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.toLowerCase();
        const [c, a] = v.split(/\s+/);
        if (a !== undefined && c === 'stack') {
          const k = Object.keys(STACK).find((x) => x.startsWith(a)); if (k) input.value = 'stack ' + k;
        } else {
          const k = COMANDOS.find((x) => x.startsWith(v)); if (k) input.value = k;
        }
      } else if (e.key === 'Escape') fechar();
      else if (e.key.toLowerCase() === 'l' && e.ctrlKey) { e.preventDefault(); executar('clear'); }
    });
    term.addEventListener('click', (e) => { if (!e.target.closest('a,button,canvas')) input.focus({ preventScroll: true }); });

    /* ------------------------------------------------------ abrir/fechar -- */
    let aberto = false, jaAbriu = false;
    function posicionar() {
      const r = botao.getBoundingClientRect();
      term.style.left = Math.max(12, Math.min(r.left, innerWidth - term.offsetWidth - 12)) + 'px';
      term.style.top = (r.bottom + 12) + 'px';
    }
    // digita um comando letra por letra antes de rodar
    function digitar(c) {
      if (menos) { executar(c); return Promise.resolve(); }
      return new Promise((ok) => {
        let k = 0;
        const t = setInterval(() => {
          input.value = c.slice(0, ++k);
          if (k >= c.length) { clearInterval(t); setTimeout(() => { input.value = ''; executar(c); ok(); }, 180); }
        }, 70);
      });
    }
    function abrir() {
      if (aberto) return;
      aberto = true;
      term.classList.add('aberto');
      posicionar();
      if (retrato) animar();
      if (!jaAbriu) {
        jaAbriu = true;
        linha('<span class="at-dim">Last login: agora, no portfólio · digite help</span>');
        linhaConta();
        setTimeout(() => digitar('whoami'), 350);
      }
      if (matchMedia('(hover: hover)').matches) setTimeout(() => input.focus({ preventScroll: true }), 50);
    }
    function fechar() {
      aberto = false;
      term.classList.remove('aberto');
      cancelAnimationFrame(raf);
      input.blur();
    }
    // Abre passando o mouse na marca (o clique continua voltando ao topo).
    // Fecha quando o mouse sai da marca E do terminal, com uma folga; se a
    // pessoa digitou ha pouco, espera mais para nao fechar no meio do comando.
    // Sem hover (toque): o toque na marca abre e fecha.
    const temHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let fechando = 0, digitouEm = 0;
    input.addEventListener('input', () => { digitouEm = performance.now(); });
    // so no topo da pagina; rolada, a marca e so o botao de voltar ao topo
    const noTopo = () => scrollY < 120;
    const entra = () => { clearTimeout(fechando); if (noTopo()) abrir(); };
    const sai = () => {
      clearTimeout(fechando);
      const folga = performance.now() - digitouEm < 3000 ? 2500 : 450;
      if (fluxo) return;   // no meio do cadastro nao fecha sozinho
      fechando = setTimeout(fechar, folga);
    };
    if (temHover) {
      botao.addEventListener('pointerenter', entra);
      botao.addEventListener('pointerleave', sai);
      term.addEventListener('pointerenter', () => clearTimeout(fechando));
      term.addEventListener('pointerleave', sai);
    } else {
      // no topo o toque abre; rolado, o toque segue voltando ao topo (onclick do botao)
      botao.addEventListener('click', (e) => { if (!noTopo() && !aberto) return; e.preventDefault(); e.stopImmediatePropagation(); aberto ? fechar() : abrir(); }, true);
    }
    term.querySelector('.at-fechar').addEventListener('click', fechar);
    document.addEventListener('pointerdown', (e) => {
      if (aberto && !term.contains(e.target) && !botao.contains(e.target)) fechar();
    });
    addEventListener('keydown', (e) => {
      const digitando = /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      if ((e.key === '~' || e.key === '`') && !digitando) { e.preventDefault(); aberto ? fechar() : abrir(); }
    });
    addEventListener('scroll', () => { if (!aberto) return; if (scrollY >= 120) fechar(); else posicionar(); }, { passive: true });
    addEventListener('resize', () => {
      dMini = criarDesenho(cMini, fonte, { alturaChar: 2.6, dpr }); desenharMini();
      if (aberto) posicionar();
    }, { passive: true });
  }).catch((e) => console.warn('[avatar-ascii] foto nao carregou', e));
}
