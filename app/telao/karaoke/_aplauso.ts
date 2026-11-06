// Aplauso curto gerado no WebAudio: rajadas de ruído filtrado, sem arquivo de som.

let ctx: AudioContext | null = null;
let ruido: AudioBuffer | null = null;

/** Toca ~1,2 s de palmas. Silencioso se o navegador não deixar criar o áudio. */
export function tocarAplauso(volume = 0.22): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume().catch(() => undefined);
    if (!ruido) {
      ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const base = ctx.currentTime + 0.02;
    const palmas = 26;
    for (let k = 0; k < palmas; k++) {
      // Mais palmas no meio do trecho, menos no começo e no fim.
      const quando = base + (Math.random() + Math.random()) * 0.55;
      const fonte = ctx.createBufferSource();
      fonte.buffer = ruido;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = 1400 + Math.random() * 2600;
      filtro.Q.value = 0.8 + Math.random() * 1.2;
      const ganho = ctx.createGain();
      const pico = volume * (0.35 + Math.random() * 0.65);
      ganho.gain.setValueAtTime(0.0001, quando);
      ganho.gain.exponentialRampToValueAtTime(pico, quando + 0.004);
      ganho.gain.exponentialRampToValueAtTime(0.0001, quando + 0.05 + Math.random() * 0.07);
      fonte.connect(filtro);
      filtro.connect(ganho);
      ganho.connect(ctx.destination);
      fonte.start(quando, Math.random() * 0.2, 0.2);
    }
  } catch { /* sem áudio: segue sem aplauso */ }
}
