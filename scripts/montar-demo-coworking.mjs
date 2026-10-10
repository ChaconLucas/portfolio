// Monta a demo do coworking-agents dentro do portfolio (public/demos/coworking).
//
// O coworking-agents e um servidor Node local que le as sessoes de IA da maquina
// e manda o estado por SSE para um front em pixel art. Aqui o front e copiado
// como esta e ganha um "servidor de mentira" no navegador (demo-navegador.js):
// o mesmo gerador do `--demo` do projeto (src/demo.js + src/prices.js) roda no
// navegador, e EventSource('events') e fetch('api/...') sao respondidos por ele.
// Nenhuma IA e chamada: zero tokens, zero servidor.
//
// Uso: node scripts/montar-demo-coworking.mjs <pasta do clone do coworking-agents>
import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo || !fs.existsSync(path.join(repo, 'src/demo.js'))) { console.error('uso: node scripts/montar-demo-coworking.mjs <clone do coworking-agents>'); process.exit(1); }
const destino = path.resolve('public/demos/coworking');
fs.rmSync(destino, { recursive: true, force: true });
fs.cpSync(path.join(repo, 'public'), destino, { recursive: true });

// modulos do Node que entram no navegador, embrulhados como CommonJS
const modulo = (nome) => `'${nome}': function (module, exports, require) {\n${fs.readFileSync(path.join(repo, 'src', nome.slice(2) + '.js'), 'utf8')}\n}`;
const shim = `/* Gerado por scripts/montar-demo-coworking.mjs — nao editar a mao.
   "Servidor" da demo no navegador: o gerador do --demo do coworking-agents
   (MIT, Lucas Chacon) responde ao EventSource e aos fetch da pagina. */
(function () {
  var process = window.process = window.process || { env: {} };
  process.env = process.env || {};
  process.kill = function () { throw Object.assign(new Error('demo'), { code: 'ESRCH' }); };
  var modulos = {
${['./util', './prices', './demo'].map(modulo).join(',\n')}
  };
  var falsos = {
    fs: { readFileSync: function () { throw new Error('demo'); }, existsSync: function () { return false; }, statSync: function () { throw new Error('demo'); }, readdirSync: function () { return []; } },
    path: { join: function () { return Array.prototype.join.call(arguments, '/'); }, dirname: function (p) { return p; }, basename: function (p) { return p; }, resolve: function (p) { return p; }, sep: '/' },
    os: { homedir: function () { return '/demo'; }, tmpdir: function () { return '/tmp'; }, platform: function () { return 'demo'; } },
    child_process: {}
  };
  var cache = {};
  function req(nome) {
    if (falsos[nome]) return falsos[nome];
    if (cache[nome]) return cache[nome].exports;
    var m = { exports: {} }; cache[nome] = m; modulos[nome](m, m.exports, req); return m.exports;
  }
  var demo = req('./demo');
  var progresso = {};
  function resposta(corpo) { return Promise.resolve(new Response(JSON.stringify(corpo), { headers: { 'Content-Type': 'application/json' } })); }
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, opc) {
    var u = String(url).replace(/^\\//, '');
    var metodo = (opc && opc.method) || 'GET';
    if (u.indexOf('api/') !== 0) return fetchOriginal(url, opc);
    var rota = u.split('?')[0];
    if (rota === 'api/usage') return resposta(demo.demoUsage());
    if (rota === 'api/report') return resposta(demo.demoReport());
    if (rota === 'api/state') return resposta(Object.assign(demo.demoSnapshot({ privacy: false }), { update: null }));
    if (rota === 'api/ping') return resposta({ ok: true });
    if (rota === 'api/progress') {
      if (metodo === 'POST') { try { progresso = JSON.parse(opc.body) || progresso; } catch (e) { /* */ } return resposta({ ok: true }); }
      return resposta(progresso);
    }
    return resposta({ ok: false, reason: 'demo' });   // focus, reply, answer, compact: so existem com sessoes de verdade
  };
  // o "SSE": um retrato novo por segundo, como o servidor faz
  function EventSourceDemo() {
    var es = this; es.readyState = 1; es.url = 'events';
    function manda() { var ev = { data: JSON.stringify(Object.assign(demo.demoSnapshot({ privacy: false }), { update: null })) }; if (es.onmessage) es.onmessage(ev); }
    setTimeout(manda, 30); es._iv = setInterval(manda, 1000);
  }
  EventSourceDemo.prototype.close = function () { clearInterval(this._iv); this.readyState = 2; };
  EventSourceDemo.prototype.addEventListener = function () {};
  window.EventSource = EventSourceDemo;
  // o clima pede a localizacao do navegador: numa demo embutida isso viraria um pedido de permissao para quem visita
  try { Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: function (ok, erro) { if (erro) erro({ code: 1, message: 'demo' }); }, watchPosition: function () { return 0; }, clearWatch: function () {} }, configurable: true }); } catch (e) { /* */ }
})();
`;
fs.writeFileSync(path.join(destino, 'demo-navegador.js'), shim);
// o shim entra antes de qualquer script da pagina
const html = path.join(destino, 'index.html');
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('<script src="art.js"></script>', '<script src="demo-navegador.js"></script>\n<script src="art.js"></script>'));
fs.copyFileSync(path.join(repo, 'LICENSE'), path.join(destino, 'LICENSE.txt'));
console.log('demo montada em', destino);
