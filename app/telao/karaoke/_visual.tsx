'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { Vivo } from './_pitch';

export interface PropsFundoVivo {
  vivo: RefObject<Vivo>;
  /** Contador cumulativo. Sem ele, a voz cantada produz brilhos discretos. */
  acerto?: RefObject<number>;
  /** Ative somente quando a câmera estiver desligada. */
  ativo: boolean;
}

type Cor = readonly [number, number, number];
type Particula = { x: number; y: number; vx: number; vy: number; vida: number; duracao: number; raio: number };
const DOURADO: Cor = [191, 165, 119];
const VERMELHO: Cor = [197, 41, 45];
const VERDE: Cor = [32, 76, 57];
const limitar = (valor: number) => Math.max(0, Math.min(1, valor));
const rgba = (cor: Cor, alfa: number) => `rgba(${cor[0]}, ${cor[1]}, ${cor[2]}, ${alfa})`;

function corDaNota(midi: number): Cor {
  const altura = limitar((midi - 45) / 36) * 2;
  const inicio = altura < 1 ? VERDE : DOURADO;
  const fim = altura < 1 ? DOURADO : VERMELHO;
  const mistura = altura < 1 ? altura : altura - 1;
  return [
    inicio[0] + (fim[0] - inicio[0]) * mistura,
    inicio[1] + (fim[1] - inicio[1]) * mistura,
    inicio[2] + (fim[2] - inicio[2]) * mistura,
  ];
}

/** Fundo decorativo independente da câmera. As refs são lidas sem renderizações React. */
export function FundoVivo({ vivo, acerto, ativo }: PropsFundoVivo) {
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ativo) return;
    const canvas = tela.current;
    const contexto = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !contexto) return;
    const ctx = contexto;
    const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const particulas: Particula[] = [];
    let raf: number | null = null;
    let largura = 1;
    let altura = 1;
    let ultimo = 0;
    let tempo = 0;
    let volume = 0;
    let midi = 63;
    let brilho = 0;
    let esperaEmissao = 0;
    let ultimoAcerto = acerto?.current ?? 0;

    function luz(x: number, y: number, raio: number, cor: Cor, intensidade: number) {
      const gradiente = ctx.createRadialGradient(x, y, 0, x, y, raio);
      gradiente.addColorStop(0, rgba(cor, intensidade));
      gradiente.addColorStop(0.45, rgba(cor, intensidade * 0.35));
      gradiente.addColorStop(1, rgba(cor, 0));
      ctx.fillStyle = gradiente;
      ctx.fillRect(Math.max(0, x - raio), Math.max(0, y - raio), raio * 2, raio * 2);
    }

    function emitir(quantidade: number) {
      for (let i = 0; i < quantidade && particulas.length < 64; i++) {
        const esquerda = Math.random() < 0.5;
        const duracao = 1.4 + Math.random() * 1.6;
        particulas.push({
          x: esquerda ? 0.03 + Math.random() * 0.13 : 0.84 + Math.random() * 0.13,
          y: 0.35 + Math.random() * 0.6,
          vx: (esquerda ? 1 : -1) * (0.003 + Math.random() * 0.008),
          vy: -(0.016 + Math.random() * 0.024),
          vida: duracao, duracao, raio: 0.7 + Math.random() * 1.4,
        });
      }
    }

    function desenhar(dt: number, estatico: boolean) {
      if (!estatico) {
        const leitura = vivo.current;
        const rms = Number.isFinite(leitura.rms) ? limitar(leitura.rms) : 0;
        // Raiz realça vozes suaves sem depender da calibração do microfone.
        const alvo = Math.sqrt(rms);
        volume += (alvo - volume) * (1 - Math.exp(-dt * (alvo > volume ? 12 : 4)));
        if (leitura.midi !== null && Number.isFinite(leitura.midi)) {
          midi += (leitura.midi - midi) * (1 - Math.exp(-dt * 3));
        }
        tempo += dt;
        esperaEmissao = Math.max(0, esperaEmissao - dt);
        const contador = acerto?.current;
        const novoAcerto = contador !== undefined && Number.isFinite(contador) && contador > ultimoAcerto;
        if (contador !== undefined && Number.isFinite(contador)) ultimoAcerto = contador;
        const vozSemContador = !acerto && leitura.cantando && esperaEmissao === 0;
        if (novoAcerto || vozSemContador) {
          brilho = Math.min(1, brilho + (novoAcerto ? 0.45 : 0.18));
          emitir(novoAcerto ? 8 : 3);
          esperaEmissao = 0.8;
        }
        brilho *= Math.exp(-dt * 2.2);
      }

      ctx.fillStyle = '#101614';
      ctx.fillRect(0, 0, largura, altura);
      const energia = estatico ? 0 : volume;
      const cor = estatico ? DOURADO : corDaNota(midi);
      const deriva = estatico ? 0 : Math.sin(tempo * 0.22) * altura * 0.04;
      const raio = Math.max(largura, altura) * (0.48 + energia * 0.12);
      luz(0, altura * 0.65 + deriva, raio, cor, 0.14 + energia * 0.22);
      luz(largura, altura * 0.25 - deriva, raio * 0.85, VERDE, 0.32 + energia * 0.18);
      luz(largura * 0.85, altura * 1.08, raio * 0.65, DOURADO, 0.08 + brilho * 0.18);

      const escala = Math.max(0.7, Math.min(1.8, altura / 1080));
      for (let i = particulas.length - 1; i >= 0; i--) {
        const p = particulas[i];
        p.vida -= dt;
        if (p.vida <= 0) { particulas.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const opacidade = Math.sin(Math.PI * p.vida / p.duracao) * 0.6;
        const x = p.x * largura;
        const y = p.y * altura;
        const r = p.raio * escala;
        ctx.fillStyle = rgba(DOURADO, opacidade * 0.12);
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(DOURADO, opacidade);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }

      // A faixa central permanece escura para não disputar atenção com a letra.
      const sombra = ctx.createLinearGradient(0, 0, largura, 0);
      sombra.addColorStop(0, 'rgba(8, 12, 10, 0)');
      sombra.addColorStop(0.28, 'rgba(8, 12, 10, 0.42)');
      sombra.addColorStop(0.72, 'rgba(8, 12, 10, 0.42)');
      sombra.addColorStop(1, 'rgba(8, 12, 10, 0)');
      ctx.fillStyle = sombra;
      ctx.fillRect(0, 0, largura, altura);
    }

    function redimensionar() {
      if (!canvas || document.hidden) return;
      largura = Math.max(1, canvas.clientWidth);
      altura = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      desenhar(0, movimentoReduzido.matches);
    }

    function quadro(agora: number) {
      raf = null;
      if (document.hidden || movimentoReduzido.matches) return;
      const decorrido = agora - ultimo;
      // Evita dobrar o custo em TVs e monitores de 120 Hz ou mais.
      if (ultimo === 0 || decorrido >= 1000 / 60 - 0.5) {
        desenhar(ultimo === 0 ? 1 / 60 : Math.min(0.05, decorrido / 1000), false);
        ultimo = agora;
      }
      raf = requestAnimationFrame(quadro);
    }

    function sincronizar() {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      ultimo = 0;
      ultimoAcerto = acerto?.current ?? 0;
      particulas.length = 0;
      brilho = 0;
      volume = 0;
      if (document.hidden) return;
      redimensionar();
      if (!movimentoReduzido.matches) raf = requestAnimationFrame(quadro);
    }

    const observador = new ResizeObserver(redimensionar);
    observador.observe(canvas);
    window.addEventListener('resize', redimensionar);
    document.addEventListener('visibilitychange', sincronizar);
    movimentoReduzido.addEventListener('change', sincronizar);
    sincronizar();
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      observador.disconnect();
      window.removeEventListener('resize', redimensionar);
      document.removeEventListener('visibilitychange', sincronizar);
      movimentoReduzido.removeEventListener('change', sincronizar);
    };
  }, [ativo, vivo, acerto]);

  return (
    <canvas
      ref={tela}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', display: ativo ? 'block' : 'none', background: '#101614' }}
    />
  );
}
