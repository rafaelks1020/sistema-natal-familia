'use client';

import type { CSSProperties } from 'react';
import { montarPlacar, ROTULO_NIVEL, type Apresentacao, type PlacarNoite } from './premios';

export type PlacarProps = {
  /** Resposta de GET /api/karaoke/placar. Não faz consultas nem controla a troca de cenas. */
  dados: PlacarNoite;
  modo?: 'noite' | 'podio';
};

export { montarPlacar };
export type { Apresentacao, PlacarNoite };

export default function Placar({ dados, modo = 'noite' }: PlacarProps) {
  const final = modo === 'podio';
  const top = dados.ranking.slice(0, 5);
  const podio = top.slice(0, 3);
  return (
    <section className="placarNoite" aria-label={final ? 'Pódio final do karaokê' : 'Placar da noite'}>
      <header>
        <p className="edicao">Natal em Família {dados.ano} · Karaokê</p>
        <h2>{final ? 'As estrelas da nossa festa' : 'Placar da noite'}</h2>
        <p className="subtitulo">{final ? 'Uma noite para guardar na memória' : 'Cada voz tem seu momento de brilhar'}</p>
      </header>
      {!top.length ? <p className="vazio">O palco está esperando a primeira estrela da noite.</p> : (
        <div className="colunas">
          <div>
            {final && (
              <ol className="podio" aria-label="Pódio final">
                {podio.map((p, i) => (
                  <li key={p.user_id} className={`degrau lugar${i + 1}`} style={{ '--atraso': `${i * 180}ms` } as CSSProperties}>
                    <span className="posicao">{i + 1}º</span>
                    <strong className="nomePodio">{p.nome}</strong>
                    <b className="notaPodio">{p.melhor}<small> / 100</small></b>
                    {p.nivel ? <span className="nivel">{ROTULO_NIVEL[p.nivel]}</span> : null}
                    <div className="base" aria-hidden="true">{i === 0 ? '★' : i + 1}</div>
                  </li>
                ))}
              </ol>
            )}
            <h3>As cinco maiores notas</h3>
            <ol className={`ranking ${final ? 'compacto' : ''}`}>
              {top.map((p, i) => (
                <li key={p.user_id}>
                  <span className="ordem">{i + 1}º</span>
                  <div className="pessoa"><strong>{p.nome}</strong><small>{p.cantadas} {p.cantadas === 1 ? 'música' : 'músicas'}</small></div>
                  <b className="nota">{p.melhor}<small> / 100</small>{p.nivel ? <span className="nivel"> {ROTULO_NIVEL[p.nivel]}</span> : null}</b>
                </li>
              ))}
            </ol>
            {dados.facil.length > 0 && (
              <>
                <h3 className="tituloFacil">Melhores no Fácil</h3>
                <ol className="ranking compacto" aria-label="Melhores no Fácil">
                  {dados.facil.slice(0, 5).map((p) => (
                    <li key={p.user_id}>
                      <div className="pessoa"><strong>{p.nome}</strong></div>
                      <b className="nota">{p.melhor}<small> / 100</small><span className="nivel"> {ROTULO_NIVEL.facil}</span></b>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
          <aside aria-label="Prêmios da noite">
            <h3>Prêmios da noite</h3>
            <ul className="premios">
              {dados.premios.map((p, i) => (
                <li key={`${p.id}-${p.user_id}`} style={{ '--atraso': `${300 + i * 180}ms` } as CSSProperties}>
                  <span className="premioTitulo">{p.titulo}</span>
                  <strong>{p.nome}</strong>
                  <small>{p.motivo}</small>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
      <style jsx>{`
        .placarNoite { position: absolute; inset: 0; z-index: 5; overflow: auto; box-sizing: border-box; padding: 3vmin 5vmin 4vmin; color: #f3ebdc; background: radial-gradient(ellipse at top, #29302a, #14181a 72%); font-family: var(--font-manrope), 'Manrope', sans-serif; }
        header { text-align: center; margin-bottom: 3vmin; }
        .edicao, h3 { color: #bfa577; text-transform: uppercase; letter-spacing: .15em; font-size: 1.8vmin; }
        h2 { margin: .6vmin 0; font-family: var(--font-bodoni), 'Bodoni Moda', Georgia, serif; font-size: 6vmin; line-height: 1.1; }
        .subtitulo { margin: 1vmin 0; font-size: 2.2vmin; color: #cfc6b6; }
        .colunas { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 5vmin; max-width: 180vmin; margin: auto; }
        h3 { margin: 0 0 1.5vmin; }
        ol, ul { list-style: none; padding: 0; margin: 0; }
        .ranking { display: grid; gap: 1.3vmin; }
        .ranking li { display: flex; align-items: center; gap: 2vmin; padding: 2vmin; border-bottom: .15vmin solid #bfa57755; background: #f3ebdc08; border-radius: 1vmin; }
        .ordem { color: #bfa577; font-size: 3.4vmin; font-weight: 800; min-width: 4vmin; }
        .pessoa { display: flex; flex-direction: column; gap: .4vmin; flex: 1; min-width: 0; }
        strong { font-size: 2.9vmin; overflow-wrap: anywhere; }
        small { font-size: 1.7vmin; color: #cfc6b6; font-weight: 500; }
        .nota { color: #bfa577; font-size: 4vmin; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .premios { display: grid; gap: 1.2vmin; }
        .premios li { display: flex; flex-direction: column; gap: .6vmin; padding: 1.6vmin 2vmin; background: #f3ebdc08; border-left: .4vmin solid #c5292d; border-radius: 1vmin; animation: premioEntrada .65s ease both; animation-delay: var(--atraso); }
        .premioTitulo { color: #bfa577; font-size: 2vmin; font-weight: 800; }
        .podio { display: flex; align-items: flex-end; justify-content: center; gap: 1.3vmin; height: 29vmin; margin-bottom: 2vmin; }
        .degrau { display: flex; flex-direction: column; align-items: center; text-align: center; width: 31%; min-width: 0; animation: premioEntrada .8s ease both; animation-delay: var(--atraso); }
        .lugar1 { order: 2; }
        .lugar2 { order: 1; }
        .lugar3 { order: 3; }
        .posicao { font-size: 2vmin; color: #bfa577; }
        .nomePodio { font-size: 2.3vmin; }
        .notaPodio { font-size: 3.4vmin; margin: .5vmin 0 1vmin; }
        .base { display: grid; place-items: center; width: 100%; height: 12vmin; font-size: 5vmin; color: #f3ebdc; background: linear-gradient(#bfa57755, #bfa57715); border-top: .5vmin solid #bfa577; border-radius: 1vmin 1vmin 0 0; }
        .lugar2 .base { height: 8vmin; }
        .lugar3 .base { height: 5vmin; border-color: #c5292d; }
        .nivel { color: #cfc6b6; font-size: 1.7vmin; font-weight: 600; letter-spacing: .04em; }
        .tituloFacil { margin-top: 2.5vmin; }
        .compacto { gap: .5vmin; }
        .compacto li { padding: .6vmin 1vmin; }
        .compacto .pessoa small { display: none; }
        .compacto strong { font-size: 2.2vmin; }
        .compacto .nota, .compacto .ordem { font-size: 2.7vmin; }
        .vazio { text-align: center; margin-top: 16vmin; font-size: 3.5vmin; color: #bfa577; }
        @keyframes premioEntrada { from { opacity: 0; transform: translateY(3vmin); } to { opacity: 1; transform: translateY(0); } }
        @media (orientation: portrait) { .colunas { gap: 3vmin; grid-template-columns: 1fr; } .podio { height: 32vmin; } }
        @media (prefers-reduced-motion: reduce) { .premios li, .degrau { animation: none; } }
      `}</style>
    </section>
  );
}
