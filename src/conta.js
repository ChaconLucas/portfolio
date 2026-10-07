/**
 * Conta do jogador (site e jogo): cadastro, login e a sessao guardada no
 * navegador. O servidor e o Worker da Cloudflare (party/index.js); a senha
 * vai so para ele (por HTTPS) e la vira hash — aqui nunca e guardada.
 * ?servidor=local usa o servidor rodando na maquina (npx wrangler dev).
 */
const PRODUCAO = 'https://stack-universe.chaconlucas.workers.dev';
export const SERVIDOR = (() => {
  try { if (new URLSearchParams(location.search).get('servidor') === 'local') return 'http://127.0.0.1:8787'; } catch (e) { /* */ }
  return PRODUCAO;
})();
/** host para o PartySocket (sem protocolo; localhost/127.* vira ws://) */
export const HOST_SALAS = SERVIDOR.replace(/^https?:\/\//, '');
const CHAVE = 'su-sessao';

export function sessao() {
  try { const s = JSON.parse(localStorage.getItem(CHAVE)); return s && s.token ? s : null; } catch (e) { return null; }
}
function guardar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) { /* sem armazenamento: vale so nesta aba */ } window.__sessao = s; }
function limpar() { try { localStorage.removeItem(CHAVE); } catch (e) { /* */ } window.__sessao = null; }

async function chamar(rota, corpo, token) {
  try {
    const r = await fetch(SERVIDOR + rota, {
      method: corpo ? 'POST' : 'GET',
      headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    return await r.json();
  } catch (e) { return { erro: 'sem conexão com o servidor' }; }
}

export async function registrar(email, usuario, senha) {
  const r = await chamar('/api/registrar', { email, usuario, senha });
  if (r.token) guardar({ token: r.token, usuario: r.usuario });
  return r;
}
export async function entrar(login, senha) {
  const r = await chamar('/api/entrar', { login, senha });
  if (r.token) guardar({ token: r.token, usuario: r.usuario });
  return r;
}
/** confere no servidor se a sessao guardada ainda vale (se nao, apaga) */
export async function conferir() {
  const s = sessao(); if (!s) return null;
  const r = await chamar('/api/eu', null, s.token);
  if (r.usuario) return s;
  if (r.erro === 'sessão inválida') limpar();
  return r.erro === 'sessão inválida' ? null : s;   // sem conexao: segue com a sessao local
}
export async function sair() {
  const s = sessao(); if (s) await chamar('/api/sair', {}, s.token);
  limpar();
}

/** a conta logada e admin? (o servidor decide pelo email) */
export async function souAdmin() {
  const s = sessao(); if (!s) return false;
  const r = await chamar('/api/eu', null, s.token);
  return !!r.admin;
}
