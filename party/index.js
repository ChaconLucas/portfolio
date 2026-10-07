import { Server, routePartykitRequest } from 'partyserver';
import { DurableObject } from 'cloudflare:workers';

/**
 * Servidor do jogo da nave (Cloudflare Workers + Durable Objects, conta do
 * Lucas). Duas pecas:
 *
 *  - Contas (um Durable Object so, com SQLite): cadastro (email, usuario,
 *    senha), login e sessao. A senha nunca e guardada: so o hash PBKDF2
 *    (SHA-256, 100 mil voltas) com um sal aleatorio por conta. A sessao e um
 *    token aleatorio que o site guarda no navegador.
 *    Rotas: POST /api/registrar, POST /api/entrar, GET /api/eu, POST /api/sair
 *    e GET /api/admin (so para os emails do segredo ADMINS: contas, quem esta
 *    online e onde, abates/mortes). O segredo e configurado com
 *    `npx wrangler secret put ADMINS` (emails separados por virgula).
 *
 *  - Sala (PartyServer): uma por lugar ("espaco", "planeta-frontend"...). So
 *    entra quem tem sessao valida (o nome vem da conta). Repassa posicao e
 *    tiros e decide o PvP: so quem ligou o PvP acerta/e acertado; o dano vem
 *    da tabela daqui (nao do jogador), com limite de alcance e de cadencia;
 *    morte, renascer em 4 s e placar.
 *    O jogo conecta em wss://<worker>/parties/sala/<sala>?token=...
 */

const ORIGENS = [/^https:\/\/portfolio-delta-five-78\.vercel\.app$/, /^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/];
function cors(req) {
  const o = req.headers.get('Origin') || '';
  const ok = ORIGENS.some((r) => r.test(o));
  return { 'Access-Control-Allow-Origin': ok ? o : 'https://portfolio-delta-five-78.vercel.app', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Vary': 'Origin' };
}
const json = (req, dados, status = 200) => new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });
const contas = (env) => env.Contas.get(env.Contas.idFromName('contas'));

/* ------------------------------------------------------------- contas -- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashSenha(senha, salB64) {
  const sal = Uint8Array.from(atob(salB64), (c) => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 100000 }, chave, 256);
  return b64(bits);
}
// comparacao em tempo constante (nao vaza quantos caracteres batem)
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const novoToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));

export class Contas extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS usuarios (usuario TEXT PRIMARY KEY, nome TEXT, email TEXT UNIQUE, hash TEXT, sal TEXT, criado INTEGER)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessoes (token TEXT PRIMARY KEY, usuario TEXT, criado INTEGER)`);
    // colunas novas (contas antigas ganham com valor padrao)
    const cols = new Set(this.sql.exec('PRAGMA table_info(usuarios)').toArray().map((c) => c.name));
    for (const [c, tipo] of [['ultimo', 'INTEGER DEFAULT 0'], ['acessos', 'INTEGER DEFAULT 0'], ['abates', 'INTEGER DEFAULT 0'], ['mortes', 'INTEGER DEFAULT 0']]) if (!cols.has(c)) this.sql.exec(`ALTER TABLE usuarios ADD COLUMN ${c} ${tipo}`);
    // quem esta online agora (cada sala avisa quem entra e sai)
    this.sql.exec(`CREATE TABLE IF NOT EXISTS online (id TEXT PRIMARY KEY, usuario TEXT, sala TEXT, pvp INTEGER DEFAULT 0, desde INTEGER)`);
    this.tentativas = new Map();   // ip -> { n, desde } (limite de tentativas)
  }
  limitar(ip) {
    const agora = Date.now(), t = this.tentativas.get(ip) || { n: 0, desde: agora };
    if (agora - t.desde > 60000) { t.n = 0; t.desde = agora; }
    t.n++; this.tentativas.set(ip, t);
    return t.n > 20;   // mais de 20 tentativas por minuto: espera
  }
  async registrar(email, usuario, senha, ip) {
    if (this.limitar(ip)) return { erro: 'muitas tentativas, espere um minuto' };
    email = String(email || '').trim().toLowerCase(); const nome = String(usuario || '').trim(); usuario = nome.toLowerCase(); senha = String(senha || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return { erro: 'email inválido' };
    if (!/^[a-z0-9_]{3,16}$/.test(usuario)) return { erro: 'usuário: 3 a 16 letras, números ou _' };
    if (senha.length < 6 || senha.length > 128) return { erro: 'senha: mínimo de 6 caracteres' };
    if (this.sql.exec('SELECT 1 FROM usuarios WHERE usuario = ?', usuario).toArray().length) return { erro: 'esse usuário já existe' };
    if (this.sql.exec('SELECT 1 FROM usuarios WHERE email = ?', email).toArray().length) return { erro: 'esse email já tem conta — use entrar' };
    const sal = b64(crypto.getRandomValues(new Uint8Array(16)));
    this.sql.exec('INSERT INTO usuarios (usuario, nome, email, hash, sal, criado, ultimo, acessos) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', usuario, nome, email, await hashSenha(senha, sal), sal, Date.now(), Date.now());
    const token = novoToken(); this.sql.exec('INSERT INTO sessoes VALUES (?, ?, ?)', token, usuario, Date.now());
    return { token, usuario: nome };
  }
  async entrar(login, senha, ip) {
    if (this.limitar(ip)) return { erro: 'muitas tentativas, espere um minuto' };
    login = String(login || '').trim().toLowerCase();
    const u = this.sql.exec('SELECT * FROM usuarios WHERE usuario = ? OR email = ?', login, login).toArray()[0];
    // mesmo sem conta, calcula um hash (o tempo de resposta nao denuncia quem existe)
    const h = await hashSenha(String(senha || ''), u ? u.sal : 'AAAAAAAAAAAAAAAAAAAAAA==');
    if (!u || !iguais(h, u.hash)) return { erro: 'usuário ou senha incorretos' };
    const token = novoToken(); this.sql.exec('INSERT INTO sessoes VALUES (?, ?, ?)', token, u.usuario, Date.now());
    this.sql.exec('UPDATE usuarios SET ultimo = ?, acessos = acessos + 1 WHERE usuario = ?', Date.now(), u.usuario);
    return { token, usuario: u.nome };
  }
  validar(token) {
    if (!token) return null;
    const s = this.sql.exec('SELECT u.nome FROM sessoes s JOIN usuarios u ON u.usuario = s.usuario WHERE s.token = ?', String(token)).toArray()[0];
    return s ? s.nome : null;
  }
  /** dados da sessao com o email (para saber se e admin) */
  quem(token) {
    if (!token) return null;
    return this.sql.exec('SELECT u.nome, u.email FROM sessoes s JOIN usuarios u ON u.usuario = s.usuario WHERE s.token = ?', String(token)).toArray()[0] || null;
  }
  // presenca: as salas avisam quem entra/sai e quem liga o PvP
  presenca(id, nome, sala, on, pvp = false) {
    if (on) this.sql.exec('INSERT OR REPLACE INTO online (id, usuario, sala, pvp, desde) VALUES (?, ?, ?, ?, ?)', id, nome, sala, pvp ? 1 : 0, Date.now());
    else this.sql.exec('DELETE FROM online WHERE id = ?', id);
    if (on) this.sql.exec('UPDATE usuarios SET ultimo = ? WHERE lower(nome) = lower(?)', Date.now(), nome);
  }
  abate(por, morto) {
    this.sql.exec('UPDATE usuarios SET abates = abates + 1 WHERE lower(nome) = lower(?)', por);
    this.sql.exec('UPDATE usuarios SET mortes = mortes + 1 WHERE lower(nome) = lower(?)', morto);
  }
  /** painel do admin: contas e quem esta online (sem senha/hash, claro) */
  painel() {
    // limpa presencas velhas (sala que caiu sem avisar): mais de 6 h
    this.sql.exec('DELETE FROM online WHERE desde < ?', Date.now() - 6 * 3600e3);
    return {
      contas: this.sql.exec('SELECT nome, email, criado, ultimo, acessos, abates, mortes FROM usuarios ORDER BY criado DESC').toArray(),
      online: this.sql.exec('SELECT usuario, sala, pvp, desde FROM online ORDER BY sala, usuario').toArray(),
      sessoes: this.sql.exec('SELECT COUNT(*) AS n FROM sessoes').one().n
    };
  }
  sair(token) { this.sql.exec('DELETE FROM sessoes WHERE token = ?', String(token || '')); return { ok: true }; }
}

/* --------------------------------------------------------------- sala -- */
// dano por arma (o servidor decide) e alcance maximo de cada uma
const ARMAS = {
  blaster: { dano: 12, alcance: 450, cad: 200 }, rifle: { dano: 6, alcance: 500, cad: 60 }, canhao: { dano: 40, alcance: 350, cad: 700 },
  laser: { dano: 9, alcance: 2500, cad: 100 }, plasma: { dano: 4, alcance: 2500, cad: 35 }, missil: { dano: 30, alcance: 3500, cad: 450 }, ions: { dano: 55, alcance: 2500, cad: 900 }
};
export class Sala extends Server {
  jogadores = new Map();   // id -> estado publico

  async onConnect(conn, ctx) {
    const token = new URL(ctx.request.url).searchParams.get('token');
    const eu = await contas(this.env).quem(token), nome = eu && eu.nome;
    if (!nome) { conn.send(JSON.stringify({ t: 'erro', msg: 'faça login para jogar online' })); conn.close(4001, 'login'); return; }
    const j = { id: conn.id, nome, admin: ehAdmin(this.env, eu.email), p: [0, 0, 0], r: 0, modo: 'espaco', arma: null, pvp: false, vida: 100, vivo: true, abates: 0, mortes: 0, ultTiro: 0 };
    this.jogadores.set(conn.id, j);
    contas(this.env).presenca(conn.id, nome, this.name, true).catch(() => {});
    conn.send(JSON.stringify({ t: 'oi', id: conn.id, nome, admin: j.admin, jogadores: [...this.jogadores.values()].filter((x) => x.id !== conn.id).map(publico) }));
    this.broadcast(JSON.stringify({ t: 'entrou', ...publico(j) }), [conn.id]);
  }

  onMessage(conn, msg) {
    const j = this.jogadores.get(conn.id); if (!j) return;
    let m; try { m = JSON.parse(msg); } catch { return; }
    if (m.t === 'estado') {
      if (Array.isArray(m.p) && m.p.length === 3 && m.p.every(Number.isFinite)) j.p = m.p;
      j.r = +m.r || 0; j.modo = String(m.modo || '').slice(0, 12); j.arma = m.arma ? String(m.arma).slice(0, 12) : null; j.esc = +m.esc || 1;
      this.broadcast(JSON.stringify({ t: 'estado', id: j.id, p: j.p, r: j.r, modo: j.modo, arma: j.arma, esc: j.esc }), [conn.id]);
    } else if (m.t === 'tiro') {
      this.broadcast(JSON.stringify({ t: 'tiro', id: j.id, o: m.o, d: m.d, arma: m.arma }), [conn.id]);
    } else if (m.t === 'pvp') {
      j.pvp = !!m.on; this.broadcast(JSON.stringify({ t: 'pvp', id: j.id, on: j.pvp }));
      contas(this.env).presenca(j.id, j.nome, this.name, true, j.pvp).catch(() => {});
    } else if (m.t === 'acerto') {
      // o atirador diz quem acertou; o servidor confere tudo e aplica o dano
      const alvo = this.jogadores.get(String(m.alvo)), a = ARMAS[m.arma];
      if (!alvo || !a || alvo === j || !j.pvp || !alvo.pvp || !j.vivo || !alvo.vivo) return;
      const agora = Date.now(); if (agora - j.ultTiro < a.cad * .8) return; j.ultTiro = agora;
      const d = Math.hypot(j.p[0] - alvo.p[0], j.p[1] - alvo.p[1], j.p[2] - alvo.p[2]); if (d > a.alcance) return;
      alvo.vida = Math.max(0, alvo.vida - a.dano);
      this.broadcast(JSON.stringify({ t: 'vida', id: alvo.id, vida: alvo.vida, de: j.id }));
      if (alvo.vida <= 0) {
        alvo.vivo = false; alvo.mortes++; j.abates++;
        this.broadcast(JSON.stringify({ t: 'morte', id: alvo.id, por: j.id, nome: alvo.nome, porNome: j.nome, arma: m.arma }));
        contas(this.env).abate(j.nome, alvo.nome).catch(() => {});
        this.placar();
        setTimeout(() => { if (!this.jogadores.has(alvo.id)) return; alvo.vida = 100; alvo.vivo = true; this.broadcast(JSON.stringify({ t: 'renasceu', id: alvo.id })); }, 4000);
      }
    }
  }

  placar() { this.broadcast(JSON.stringify({ t: 'placar', lista: [...this.jogadores.values()].map((x) => ({ id: x.id, nome: x.nome, abates: x.abates, mortes: x.mortes, pvp: x.pvp })) })); }

  onClose(conn) {
    if (!this.jogadores.delete(conn.id)) return;
    contas(this.env).presenca(conn.id, '', this.name, false).catch(() => {});
    this.broadcast(JSON.stringify({ t: 'saiu', id: conn.id }));
  }
}
const publico = (j) => ({ id: j.id, nome: j.nome, admin: !!j.admin, p: j.p, r: j.r, modo: j.modo, arma: j.arma, pvp: j.pvp, vida: j.vida, abates: j.abates, mortes: j.mortes, esc: j.esc || 1 });

/* --------------------------------------------------------------- rotas -- */
// admins: emails no segredo ADMINS (nao fica no codigo)
const ehAdmin = (env, email) => String(env.ADMINS || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean).includes(String(email || '').toLowerCase());
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
      const ip = req.headers.get('CF-Connecting-IP') || 'local', c = contas(env);
      const corpo = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      let r;
      if (url.pathname === '/api/registrar' && req.method === 'POST') r = await c.registrar(corpo.email, corpo.usuario, corpo.senha, ip);
      else if (url.pathname === '/api/entrar' && req.method === 'POST') r = await c.entrar(corpo.login, corpo.senha, ip);
      else if (url.pathname === '/api/eu') { const q = await c.quem(token); r = q ? { usuario: q.nome, admin: ehAdmin(env, q.email) } : { erro: 'sessão inválida' }; }
      else if (url.pathname === '/api/admin') {
        const q = await c.quem(token);
        if (!q || !ehAdmin(env, q.email)) return json(req, { erro: 'acesso negado' }, 403);
        r = await c.painel();
      }
      else if (url.pathname === '/api/sair' && req.method === 'POST') r = await c.sair(token);
      else return json(req, { erro: 'rota não encontrada' }, 404);
      return json(req, r, r.erro ? 400 : 200);
    }
    return (await routePartykitRequest(req, env)) || new Response('Stack Universe multiplayer', { status: 404, headers: cors(req) });
  }
};
