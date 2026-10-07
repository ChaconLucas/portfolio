import PartySocket from 'partysocket';

/**
 * Chat de voz: uma sala "voz" so (no mesmo servidor da Cloudflare) para todo
 * mundo online. O servidor so apresenta os jogadores (oferta/resposta/candidatos
 * do WebRTC) e avisa quem esta falando; o audio vai direto entre os navegadores.
 *
 *  - falar('perto'): so quem esta perto ouve, mais alto quanto mais perto
 *    (o jogo diz o volume de cada um em volumeDe(nome));
 *  - falar('geral'): radio, todo mundo online ouve no volume cheio;
 *  - falar(null): solta (o microfone fica mudo).
 * O microfone so e pedido na primeira vez que a pessoa fala; ouvir nao precisa.
 * aoMudar() avisa quando alguem comeca/para de falar (para o HUD).
 */
const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];

export function criarVoz({ token, host, aoMudar, aoErro }) {
  const pares = new Map();   // id -> { nome, admin, pc, audio, falando, fila }
  let meuId = null, mic = null, pedindoMic = null, meuModo = null;
  const sock = new PartySocket({ host, party: 'sala', room: 'voz', query: { token } });
  const mandar = (m) => sock.send(JSON.stringify(m));
  sock.onclose = (e) => { if (e.code === 4001 || e.code === 4003) { sock.close(); for (const id of [...pares.keys()]) fecharPar(id); if (mic) mic.stop(); aoMudar(); } };

  sock.onmessage = async (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'voz-oi') {
      meuId = m.id;
      // quem chega liga para todos que ja estavam
      for (const v of m.lista) { const p = novoPar(v); await oferecer(p); }
      aoMudar();
    } else if (m.t === 'voz-entrou') { novoPar(m); aoMudar(); }
    else if (m.t === 'voz-saiu') { fecharPar(m.id); aoMudar(); }
    else if (m.t === 'falando') { const p = pares.get(m.id); if (p) { p.falando = m.modo; aoMudar(); } }
    else if (m.t === 'rtc') receberRtc(m.de, m.d).catch((e) => console.warn('[voz]', e));
  };

  function novoPar(v) {
    fecharPar(v.id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const audio = new Audio(); audio.autoplay = true; audio.volume = 0;
    const p = { id: v.id, nome: v.nome, admin: !!v.admin, pc, audio, falando: null, fila: [] };
    pc.onicecandidate = (e) => { if (e.candidate) mandar({ t: 'rtc', para: v.id, d: { c: e.candidate } }); };
    pc.ontrack = (e) => { audio.srcObject = e.streams[0] || new MediaStream([e.track]); audio.play().catch(() => {}); };
    pares.set(v.id, p);
    return p;
  }
  function fecharPar(id) {
    const p = pares.get(id); if (!p) return;
    p.pc.close(); p.audio.srcObject = null; pares.delete(id);
  }
  // o audio vai num transceptor de ida e volta desde o comeco: quando o mic
  // chegar, so troca a faixa (sem renegociar)
  async function oferecer(p) {
    const tr = p.pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (mic) await tr.sender.replaceTrack(mic);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    mandar({ t: 'rtc', para: p.id, d: { sdp: p.pc.localDescription } });
  }
  async function receberRtc(de, d) {
    const p = pares.get(de); if (!p || !d) return;
    if (d.sdp) {
      await p.pc.setRemoteDescription(d.sdp);
      if (d.sdp.type === 'offer') {
        for (const tr of p.pc.getTransceivers()) { tr.direction = 'sendrecv'; if (mic) await tr.sender.replaceTrack(mic); }
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        mandar({ t: 'rtc', para: de, d: { sdp: p.pc.localDescription } });
      }
      for (const c of p.fila) await p.pc.addIceCandidate(c).catch(() => {});
      p.fila = [];
    } else if (d.c) {
      if (p.pc.remoteDescription) await p.pc.addIceCandidate(d.c).catch(() => {}); else p.fila.push(d.c);
    }
  }

  async function pegarMic() {
    if (mic) return mic;
    if (!pedindoMic) pedindoMic = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        mic = s.getAudioTracks()[0]; mic.enabled = !!meuModo;
        for (const p of pares.values()) for (const tr of p.pc.getTransceivers()) tr.sender.replaceTrack(mic).catch(() => {});
        return mic;
      })
      .catch((e) => { pedindoMic = null; aoErro(e.name === 'NotAllowedError' ? 'microfone bloqueado: libere no cadeado da barra de endereço' : 'não achei microfone'); return null; });
    return pedindoMic;
  }

  return {
    pares,
    get falando() { return meuModo; },
    /** 'perto' | 'geral' | null */
    async falar(modo) {
      if (modo === meuModo) return;
      meuModo = modo;
      if (mic) mic.enabled = !!modo;
      mandar({ t: 'falando', modo });
      aoMudar();
      // sem microfone (bloqueado ou nao tem): volta a ficar calado
      if (modo && !(await pegarMic()) && meuModo) { meuModo = null; mandar({ t: 'falando', modo: null }); aoMudar(); }
    },
    /** volume de cada um: radio cheio; perto pelo jogo (0 = longe ou outro lugar) */
    atualizar(volumeDe) {
      for (const p of pares.values()) {
        const alvo = p.falando === 'geral' ? 1 : p.falando === 'perto' ? volumeDe(p.nome) : 0;
        p.audio.volume += (alvo - p.audio.volume) * .25;
        if (Math.abs(p.audio.volume - alvo) < .01) p.audio.volume = alvo;
      }
    },
    /** quem esta falando agora (e se da para ouvir de onde estou) */
    falantes(volumeDe) { return [...pares.values()].filter((p) => p.falando).map((p) => ({ nome: p.nome, admin: p.admin, modo: p.falando, ouve: p.falando === 'geral' || volumeDe(p.nome) > .02 })); },
    fechar() { sock.onmessage = null; sock.close(); for (const id of [...pares.keys()]) fecharPar(id); if (mic) mic.stop(); }
  };
}
