'use client';

import type { CSSProperties } from 'react';
import type { EstadoBatalha } from './batalha';
import styles from './karaoke.module.css';

export type BatalhaCenaProps = { batalha: EstadoBatalha; onContinuar?: () => void };
const celula: CSSProperties = { padding: '1.2vmin 2vmin', borderBottom: '1px solid rgba(191,165,119,0.25)' };
const porcentagem = (nota: number | null) => nota === null ? 'Aguardando' : `${(nota * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/**
 * Integração em finalizar() do telão, no fim natural de CADA apresentação:
 * 1. O retorno de motor.resultado() ou pontuarEstudio() já tem linhas, inclusive
 *    as linhas com nota zero. Guarde esse array antes de limpar motorRef.
 * 2. Junto de acao: 'terminar', envie notas_linhas: resultadoEstudio.linhas no
 *    PATCH /api/karaoke/fila. Use ResultadoEstudio para preservar esse tipo.
 *    Não envie eventos avulsos nem arrays cortados por encerramento antecipado.
 * 3. Depois do PATCH, GET /api/karaoke/batalha?fila_id=ID retorna EstadoBatalha.
 *    Após a primeira, siga para o próximo cantor. Após a segunda, espere
 *    resultado.completa e renderize <BatalhaCena batalha={duelo}
 *      onContinuar={sairDaNota} /> antes do avanço automático.
 * 4. Para recuperar um envio separado, PATCH /api/karaoke/batalha com
 *    { fila_id, notas_linhas: resultadoEstudio.linhas }, somente após terminar.
 * No celular: escolha um pedido individual seu em estado.fila, depois POST
 * /api/karaoke/batalha com { fila_id: pedido.id, adversario_id: pessoa.id }.
 * CamposBatalhaFila exporta os campos para estender ItemFila em tipos.ts.
 */
export default function BatalhaCena({ batalha, onContinuar }: BatalhaCenaProps) {
  const primeira = batalha.apresentacoes.find((a) => a.rodada === 1);
  const segunda = batalha.apresentacoes.find((a) => a.rodada === 2);
  const nomes = [primeira?.nome ?? 'Primeiro cantor', segunda?.nome ?? 'Segundo cantor'];
  const r = batalha.resultado;
  const mensagem = batalha.cancelada ? 'Batalha cancelada'
    : !r.completa ? 'Aguardando as duas apresentações'
      : r.vencedor === null ? 'Empate!' : `${nomes[r.vencedor - 1]} venceu!`;

  return <section className={styles.cartaz} aria-label="Resultado da batalha" style={{ gap: '1.6vmin' }}>
    <p className={styles.kicker}>Batalha da família</p>
    <h2 className={styles.titulo} style={{ fontSize: '6vmin' }}>{mensagem}</h2>
    <p className={styles.subtitulo}>{batalha.titulo}</p>
    <p style={{ fontSize: '4vmin', color: '#bfa577', fontWeight: 800 }}>
      {nomes[0]} <strong>{r.placar[0]}</strong> x <strong>{r.placar[1]}</strong> {nomes[1]}
    </p>
    {r.completa && !batalha.cancelada ? <p className={styles.latDica}>{r.empates} {r.empates === 1 ? 'trecho empatado' : 'trechos empatados'}. Cada trecho ganho vale um ponto.</p> : null}
    {!batalha.cancelada && r.trechos.length ? <div tabIndex={0} role="region" aria-label="Comparação dos trechos, role para ver todos" style={{ overflowY: 'auto', maxHeight: '40vmin', width: 'min(140vmin, 100%)', border: '1px solid #bfa577', borderRadius: '1.4vmin' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '2.2vmin' }}>
        <caption style={{ padding: '1vmin', color: '#bfa577' }}>Resultado trecho a trecho</caption>
        <thead><tr><th scope="col" style={celula}>Trecho</th><th scope="col" style={celula}>{nomes[0]}</th><th scope="col" style={celula}>{nomes[1]}</th><th scope="col" style={celula}>Venceu</th></tr></thead>
        <tbody>{r.trechos.map((trecho) => <tr key={trecho.linha}>
          <th scope="row" style={{ ...celula, fontWeight: 500 }}>{batalha.trechos[trecho.linha] ?? `Trecho ${trecho.linha + 1}`}</th>
          <td style={celula}>{porcentagem(trecho.notas[0])}</td>
          <td style={celula}>{porcentagem(trecho.notas[1])}</td>
          <td style={{ ...celula, color: trecho.vencedor === null ? '#cfc6b6' : '#bfa577', fontWeight: 800 }}>{trecho.notas.includes(null) ? 'Aguardando' : trecho.vencedor === null ? 'Empate' : nomes[trecho.vencedor - 1]}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    {onContinuar ? <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={onContinuar}>Próximo cantor</button> : null}
  </section>;
}
