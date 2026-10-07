import PartySocket from 'partysocket';

/**
 * Chat de voz: uma sala "voz" so (no mesmo servidor da Cloudflare) para todo
 * mundo online. O audio passa pelo servidor (nao direto entre navegadores):
 * assim funciona em qualquer rede, inclusive operadora com CGNAT, sem precisar
 * de servidor TURN.
 *
 * Envio: o microfone vira pedacinhos de ~64 ms, reamostrados para 16 kHz e
 * comprimidos em u-law (8 bits, como telefone: ~16 KB/s so enquanto fala).
 * Recebimento: cada jogador tem uma fila de reproducao e um volume.
 *
 *  - falar('perto'): so quem esta perto ouve, mais alto quanto mais perto
 *    (o jogo diz o volume de cada um em volumeDe(nome));
 *  - falar('geral'): radio, todo mundo online ouve no volume cheio;
 *  - falar(null): solta.
 * O microfone so e pedido na primeira vez que a pessoa fala; ouvir nao precisa.
 */
const TAXA = 16000;

// u-law (G.711): 16 bits -> 8 bits, e volta
function codificar(x) {
  let s = Math.max(-32635, Math.min(32635, Math.round(x * 32767)));
  const sinal = s < 0 ? 0x80 : 0; if (s < 0) s = -s;
  s += 0x84; let exp = 7; for (let m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
  return ~(sinal | (exp << 4) | ((s >> (exp + 3)) & 0x0f)) & 0xff;
}
const TABELA = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i & 0xff, sinal = u & 0x80, exp = (u >> 4) & 7, man = u & 0x0f;
  const v = (((man << 3) + 0x84) << exp) - 0x84; TABELA[i] = (sinal ? -v : v) / 32768;
}
const paraB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const deB64 = (b) => { const s = atob(b), u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; };

export function criarVoz({ token, host, aoMudar, aoErro }) {
  const pares = new Map();   // id -> { nome, admin, falando, ganho, prox, vol }
  let meuModo = null, mic = null, pedindoMic = null, ctx = null;
  const sock = new PartySocket({ host, party: 'sala', room: 'voz', query: { token } });
  const mandar = (m) => { if (sock.readyState === 1) sock.send(JSON.stringify(m)); };

  function contexto() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // o navegador so libera audio depois de um clique/tecla: destrava no primeiro
  const destravar = () => contexto();
  addEventListener('keydown', destravar); addEventListener('mousedown', destravar); addEventListener('touchstart', destravar);

  sock.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'voz-oi') { pares.clear(); for (const v of m.lista) novoPar(v); aoMudar(); }
    else if (m.t === 'voz-entrou') { novoPar(m); aoMudar(); }
    else if (m.t === 'voz-saiu') { const p = pares.get(m.id); if (p) { p.ganho?.disconnect(); pares.delete(m.id); aoMudar(); } }
    else if (m.t === 'falando') { const p = pares.get(m.id); if (p) { p.falando = m.modo; aoMudar(); } }
    else if (m.t === 'a') tocar(m.id, m.d);
  };
  sock.onclose = (e) => { if (e.code === 4001 || e.code === 4003) { sock.close(); pares.clear(); pararMic(); aoMudar(); } };

  function novoPar(v) { pares.set(v.id, { id: v.id, nome: v.nome, admin: !!v.admin, falando: null, ganho: null, prox: 0, vol: 0 }); }

  // recebe um pedaco e agenda logo depois do anterior (com folga contra engasgos)
  function tocar(id, b64) {
    const p = pares.get(id); if (!p || !ctx || ctx.state !== 'running') return;
    const u8 = deB64(b64), buf = ctx.createBuffer(1, u8.length, TAXA), d = buf.getChannelData(0);
    for (let i = 0; i < u8.length; i++) d[i] = TABELA[u8[i]];
    if (!p.ganho) { p.ganho = ctx.createGain(); p.ganho.gain.value = p.vol; p.ganho.connect(ctx.destination); }
    const fonte = ctx.createBufferSource(); fonte.buffer = buf; fonte.connect(p.ganho);
    const agora = ctx.currentTime;
    if (p.prox < agora + .04 || p.prox > agora + .6) p.prox = agora + .15;   // atrasou demais ou acumulou: recomeca
    fonte.start(p.prox); p.prox += buf.duration;
  }

  /* ---- microfone: captura, reamostra para 16 kHz, comprime e manda ---- */
  let proc = null, origem = null, sobra = 0, pend = [];
  async function pegarMic() {
    if (mic) return mic;
    if (!pedindoMic) pedindoMic = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        mic = s; const c = contexto();
        origem = c.createMediaStreamSource(s);
        proc = c.createScriptProcessor(2048, 1, 1);
        const passo = c.sampleRate / TAXA;
        proc.onaudioprocess = (e) => {
          if (!meuModo) { sobra = 0; pend = []; return; }
          const x = e.inputBuffer.getChannelData(0);
          // reamostra (media de cada janela) e comprime
          let t = sobra;
          for (; t < x.length; t += passo) {
            const i0 = Math.floor(t), i1 = Math.min(x.length, Math.floor(t + passo)); let soma = 0;
            for (let i = i0; i < i1; i++) soma += x[i];
            pend.push(codificar(soma / Math.max(1, i1 - i0)));
          }
          sobra = t - x.length;
          while (pend.length >= 1024) mandar({ t: 'a', d: paraB64(Uint8Array.from(pend.splice(0, 1024))) });
        };
        // o processador precisa estar ligado na saida para rodar (sai mudo)
        const mudo = c.createGain(); mudo.gain.value = 0;
        origem.connect(proc); proc.connect(mudo); mudo.connect(c.destination);
        return mic;
      })
      .catch((e) => { pedindoMic = null; aoErro(e.name === 'NotAllowedError' ? 'microfone bloqueado: libere no cadeado da barra de endereço' : 'não achei microfone'); return null; });
    return pedindoMic;
  }
  function pararMic() {
    if (proc) { proc.onaudioprocess = null; proc.disconnect(); origem?.disconnect(); }
    if (mic) mic.getTracks().forEach((t) => t.stop());
    mic = null; proc = null; pedindoMic = null;
  }

  return {
    pares,
    get falando() { return meuModo; },
    /** 'perto' | 'geral' | null */
    async falar(modo) {
      if (modo === meuModo) return;
      meuModo = modo; contexto();
      mandar({ t: 'falando', modo });
      aoMudar();
      // sem microfone (bloqueado ou nao tem): volta a ficar calado
      if (modo && !(await pegarMic()) && meuModo) { meuModo = null; mandar({ t: 'falando', modo: null }); aoMudar(); }
    },
    /** volume de cada um: radio cheio; perto pelo jogo (0 = longe ou outro lugar) */
    atualizar(volumeDe) {
      for (const p of pares.values()) {
        // calado: mantem o volume (o finzinho da fala ainda esta tocando)
        const alvo = p.falando === 'geral' ? 1 : p.falando === 'perto' ? volumeDe(p.nome) : p.vol;
        p.vol += (alvo - p.vol) * .25; if (Math.abs(p.vol - alvo) < .01) p.vol = alvo;
        if (p.ganho) p.ganho.gain.value = p.vol;
      }
    },
    /** quem esta falando agora (e se da para ouvir de onde estou) */
    falantes(volumeDe) { return [...pares.values()].filter((p) => p.falando).map((p) => ({ nome: p.nome, admin: p.admin, modo: p.falando, ouve: p.falando === 'geral' || volumeDe(p.nome) > .02 })); },
    fechar() {
      sock.onmessage = null; sock.close(); pares.clear(); pararMic(); ctx?.close().catch(() => {});
      removeEventListener('keydown', destravar); removeEventListener('mousedown', destravar); removeEventListener('touchstart', destravar);
    }
  };
}
