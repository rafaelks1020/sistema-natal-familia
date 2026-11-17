'use client';

import { useEffect, useState } from 'react';

// Tamanho da letra do site (fica guardado no aparelho). O script do layout aplica a classe antes de pintar.
export type NivelLetra = 'normal' | 'grande' | 'maior';

const OPCOES: { nivel: NivelLetra; rotulo: string; amostra: string }[] = [
  { nivel: 'normal', rotulo: 'Normal', amostra: 'text-lg' },
  { nivel: 'grande', rotulo: 'Grande', amostra: 'text-2xl' },
  { nivel: 'maior', rotulo: 'Muito grande', amostra: 'text-3xl' },
];

export function lerLetra(): NivelLetra {
  const classes = document.documentElement.classList;
  return classes.contains('letra-maior') ? 'maior' : classes.contains('letra-grande') ? 'grande' : 'normal';
}

export function aplicarLetra(nivel: NivelLetra) {
  const classes = document.documentElement.classList;
  classes.toggle('letra-grande', nivel === 'grande');
  classes.toggle('letra-maior', nivel === 'maior');
  try {
    if (nivel === 'normal') localStorage.removeItem('nf_letra');
    else localStorage.setItem('nf_letra', nivel);
    localStorage.setItem('nf_letra_vista', '1');
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
}

/** Três botões grandes: Normal, Grande e Muito grande (aba Eu). */
export default function LetraMaior() {
  const [nivel, setNivel] = useState<NivelLetra>('normal');

  useEffect(() => {
    // Sincroniza com a classe que o script do layout já aplicou antes de pintar.
    const t = setTimeout(() => setNivel(lerLetra()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div role="group" aria-label="Tamanho da letra" className="grid grid-cols-3 gap-2">
      {OPCOES.map((opcao) => {
        const ativo = nivel === opcao.nivel;
        return (
          <button
            key={opcao.nivel}
            type="button"
            aria-pressed={ativo}
            onClick={() => {
              setNivel(opcao.nivel);
              aplicarLetra(opcao.nivel);
            }}
            className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center transition-colors ${
              ativo ? 'border-champagne bg-carvao-3 text-marfim' : 'border-linha-forte text-marfim-2'
            }`}
          >
            <span aria-hidden className={`display leading-none ${opcao.amostra}`}>Aa</span>
            <span className="text-xs font-semibold leading-tight">{opcao.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Pergunta única, na primeira visita ao início: quem quer letra maior resolve com um toque. */
export function PerguntaLetra() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setMostrar(!localStorage.getItem('nf_letra_vista') && !localStorage.getItem('nf_letra'));
      } catch {
        /* sem armazenamento: não pergunta */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (!mostrar) return null;

  function escolher(nivel: NivelLetra) {
    aplicarLetra(nivel);
    setMostrar(false);
  }

  return (
    <section aria-labelledby="pergunta-letra" className="rounded-[18px] border border-champagne/40 bg-carvao-2 p-5">
      <h3 id="pergunta-letra" className="display text-2xl leading-tight">As letras estão boas de ler?</h3>
      <p className="mt-1.5 text-sm text-marfim-2">Dá para mudar depois, na aba Eu.</p>
      <div className="mt-4 space-y-2">
        <button type="button" className="btn btn-primary w-full" onClick={() => escolher('grande')}>
          Quero letras maiores
        </button>
        <button type="button" className="btn btn-ghost w-full" onClick={() => escolher('normal')}>
          Estão boas assim
        </button>
      </div>
    </section>
  );
}
