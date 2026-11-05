'use client';

import { useState } from 'react';
import {
  isoDeBrasilia,
  percentual,
  rotuloTipo,
  situacaoVotos,
  textoOpcao,
  TIPOS_VOTACAO,
  type CeiaEvento,
  type CeiaVotacao,
  type TipoVotacao,
} from '@/app/api/ceia/tipos';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

type Rascunho = { texto: string; data: string; hora: string };
const vazio = (): Rascunho => ({ texto: '', data: '', hora: '' });

export function VotacaoCeia({
  votacoes, onVotacoes, onEvento,
}: {
  votacoes: CeiaVotacao[];
  onVotacoes: (votacoes: CeiaVotacao[]) => void;
  onEvento: (evento: CeiaEvento) => void;
}) {
  const me = useMe();
  const toast = useToast();
  const [aberta, setAberta] = useState(false);
  const [pergunta, setPergunta] = useState('');
  const [tipo, setTipo] = useState<TipoVotacao>('local');
  const [opcoes, setOpcoes] = useState<Rascunho[]>([vazio(), vazio()]);
  const [busy, setBusy] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const abertas = votacoes.filter((votacao) => votacao.aberta);
  const encerradas = votacoes.filter((votacao) => !votacao.aberta);

  function mudarTipo(proximo: TipoVotacao) {
    setTipo(proximo);
    setOpcoes((atual) => atual.map(() => vazio()));
  }

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const textos: string[] = [];
    for (let i = 0; i < opcoes.length; i += 1) {
      const opcao = opcoes[i];
      if (!opcao) continue;
      if (tipo === 'data') {
        const iso = isoDeBrasilia(opcao.data, opcao.hora);
        if (!iso) {
          toast(`A opção ${i + 1} precisa de uma data e um horário válidos.`, 'erro');
          return;
        }
        textos.push(iso);
      } else if (!opcao.texto.trim()) {
        toast('Preencha todas as opções.', 'erro');
        return;
      } else {
        textos.push(opcao.texto.trim());
      }
    }
    setBusy(true);
    try {
      const criada = await api<CeiaVotacao>('/api/ceia/votacoes', {
        method: 'POST',
        json: { pergunta: pergunta.trim(), tipo, opcoes: textos },
      });
      onVotacoes([criada, ...votacoes]);
      setPergunta('');
      setOpcoes([vazio(), vazio()]);
      setAberta(false);
      toast('A família já pode votar.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível abrir a votação.', 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function votar(votacao: CeiaVotacao, opcaoId: number) {
    if (ocupado || votacao.meu_voto === opcaoId) return;
    if (!votacao.aberta) {
      toast('Essa votação já encerrou.', 'erro');
      return;
    }
    setOcupado(votacao.id);
    try {
      const atualizada = await api<CeiaVotacao>(`/api/ceia/votacoes/${votacao.id}/voto`, { method: 'POST', json: { opcao_id: opcaoId } });
      onVotacoes(votacoes.map((item) => item.id === atualizada.id ? atualizada : item));
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível votar.', 'erro');
    } finally {
      setOcupado(null);
    }
  }

  async function organizar(votacao: CeiaVotacao, acao: 'encerrar' | 'aplicar' | 'apagar') {
    if (ocupado) return;
    if (acao === 'apagar' && !window.confirm('Apagar esta votação?')) return;
    if (acao === 'encerrar' && !window.confirm('Encerrar esta votação? Ninguém mais muda o voto.')) return;
    if (acao === 'aplicar') {
      const maximo = Math.max(...votacao.opcoes.map((opcao) => opcao.votos));
      const vencedor = votacao.opcoes.find((opcao) => opcao.votos === maximo);
      const texto = vencedor ? textoOpcao(votacao.tipo, vencedor.texto) : 'a vencedora';
      const frase = votacao.tipo === 'data' ? `Usar ${texto} como data da ceia?` : `Usar "${texto}" como local da ceia?`;
      if (!window.confirm(frase)) return;
    }
    setOcupado(votacao.id);
    try {
      if (acao === 'apagar') {
        await api(`/api/ceia/votacoes/${votacao.id}`, { method: 'DELETE' });
        onVotacoes(votacoes.filter((item) => item.id !== votacao.id));
        toast('Votação apagada.');
      } else {
        const resp = await api<{ votacao: CeiaVotacao; evento?: CeiaEvento; aplicado?: string }>(`/api/ceia/votacoes/${votacao.id}`, {
          method: 'POST',
          json: { acao },
        });
        onVotacoes(votacoes.map((item) => item.id === resp.votacao.id ? resp.votacao : item));
        if (resp.evento) onEvento(resp.evento);
        toast(resp.aplicado ? `A ceia agora usa: ${resp.aplicado}.` : 'Votação encerrada.');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível atualizar a votação.', 'erro');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section aria-labelledby="ceia-votacao">
      <p className="kicker mb-2">04 / A família decide</p>
      <h2 id="ceia-votacao" className="display text-3xl">Votação</h2>
      <p className="mt-3 text-sm leading-relaxed text-marfim-2">Um voto por pessoa. Dá para mudar enquanto estiver aberta.</p>

      {me.is_admin ? (
        <div className="mt-5">
          {aberta ? (
            <form className="space-y-3" onSubmit={(event) => { void criar(event); }}>
              <label className="block text-sm text-marfim-2">Pergunta
                <input className="field mt-2" required maxLength={200} value={pergunta} placeholder="Ex.: Onde fazemos a ceia?" onChange={(event) => setPergunta(event.target.value)} />
              </label>
              <label className="block text-sm text-marfim-2">Tipo
                <select className="field mt-2" value={tipo} onChange={(event) => mudarTipo(event.target.value as TipoVotacao)}>
                  {TIPOS_VOTACAO.map((item) => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
                </select>
              </label>
              <div className="space-y-3">
                {opcoes.map((opcao, indice) => (
                  <div key={indice} className="min-w-0">
                    {tipo === 'data' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <label className="min-w-0 text-sm text-marfim-2">Data {indice + 1}
                          <input className="field mt-2 max-w-full" type="date" required value={opcao.data} onChange={(event) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, data: event.target.value } : item))} />
                        </label>
                        <label className="min-w-0 text-sm text-marfim-2">Hora
                          <input className="field mt-2 max-w-full" type="time" required value={opcao.hora} onChange={(event) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, hora: event.target.value } : item))} />
                        </label>
                      </div>
                    ) : (
                      <label className="block text-sm text-marfim-2">Opção {indice + 1}
                        <input className="field mt-2" required maxLength={tipo === 'local' ? 500 : 160} value={opcao.texto} onChange={(event) => setOpcoes((atual) => atual.map((item, i) => i === indice ? { ...item, texto: event.target.value } : item))} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {opcoes.length < 6 ? <button type="button" className="btn btn-quiet" onClick={() => setOpcoes((atual) => [...atual, vazio()])}>Mais uma opção</button> : null}
                {opcoes.length > 2 ? <button type="button" className="btn btn-quiet" onClick={() => setOpcoes((atual) => atual.slice(0, -1))}>Tirar a última</button> : null}
              </div>
              <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Abrindo...' : 'Abrir votação'}</button>
              <button type="button" className="btn btn-ghost w-full" onClick={() => setAberta(false)}>Cancelar</button>
            </form>
          ) : <button type="button" className="btn btn-primary w-full" onClick={() => setAberta(true)}>Nova votação</button>}
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {votacoes.length ? (
          <>
            <Lista titulo="Abertas" itens={abertas} vazio="Nenhuma votação aberta." ocupado={ocupado} admin={me.is_admin} onVotar={(votacao, opcaoId) => { void votar(votacao, opcaoId); }} onOrganizar={(votacao, acao) => { void organizar(votacao, acao); }} />
            {encerradas.length ? <Lista titulo="Encerradas" itens={encerradas} vazio="" ocupado={ocupado} admin={me.is_admin} onVotar={(votacao, opcaoId) => { void votar(votacao, opcaoId); }} onOrganizar={(votacao, acao) => { void organizar(votacao, acao); }} /> : null}
          </>
        ) : <p className="text-sm text-marfim-2">Nenhuma pergunta ainda. Quem organiza pode consultar a família.</p>}
      </div>
    </section>
  );
}

function Lista({
  titulo, itens, vazio, ocupado, admin, onVotar, onOrganizar,
}: {
  titulo: string;
  itens: CeiaVotacao[];
  vazio: string;
  ocupado: number | null;
  admin: boolean;
  onVotar: (votacao: CeiaVotacao, opcaoId: number) => void;
  onOrganizar: (votacao: CeiaVotacao, acao: 'encerrar' | 'aplicar' | 'apagar') => void;
}) {
  return (
    <div>
      <h3 className="kicker mb-3">{titulo}</h3>
      {itens.length ? <ul className="space-y-4">{itens.map((votacao) => {
        const situacao = situacaoVotos(votacao.opcoes);
        const maximo = votacao.opcoes.reduce((maior, opcao) => Math.max(maior, opcao.votos), 0);
        return (
          <li key={votacao.id} className="surface min-w-0 px-4 py-4">
            <p className="kicker mb-2">{rotuloTipo(votacao.tipo)}{votacao.aberta ? '' : ' (encerrada)'}</p>
            <p className="break-words text-lg text-marfim">{votacao.pergunta}</p>
            <div className="mt-4 space-y-2">
              {votacao.opcoes.map((opcao) => {
                const texto = textoOpcao(votacao.tipo, opcao.texto);
                const minha = votacao.meu_voto === opcao.id;
                return (
                  <button key={opcao.id} type="button" aria-pressed={minha} onClick={() => onVotar(votacao, opcao.id)} className={`w-full min-w-0 rounded-[14px] border px-3 py-3 text-left ${minha ? 'border-champagne' : 'border-linha'}`}>
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words">{texto}{situacao === 'lider' && opcao.votos === maximo ? <span className="ml-2 text-xs text-champagne">Na frente</span> : null}</span>
                      <span className="numeral shrink-0 text-sm">{opcao.votos}</span>
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-carvao-3" role="progressbar" aria-valuemin={0} aria-valuemax={votacao.total || 1} aria-valuenow={opcao.votos} aria-label={`${texto}, ${opcao.votos} ${opcao.votos === 1 ? 'voto' : 'votos'}`}>
                      <span className="block h-full bg-salvia" style={{ width: `${percentual(opcao.votos, votacao.total)}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-marfim-3">
              {votacao.total} {votacao.total === 1 ? 'voto' : 'votos'}
              {situacao === 'empate' ? '. Empate.' : ''}
              {!votacao.aberta ? ' Encerrada: o voto não muda mais.' : ''}
            </p>
            {admin ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {votacao.aberta ? <button type="button" className="btn btn-ghost px-4" disabled={ocupado === votacao.id} onClick={() => onOrganizar(votacao, 'encerrar')}>Encerrar</button> : null}
                {(votacao.tipo === 'local' || votacao.tipo === 'data') && situacao === 'lider' ? (
                  <button type="button" className="btn btn-primary px-4" disabled={ocupado === votacao.id} onClick={() => onOrganizar(votacao, 'aplicar')}>{votacao.tipo === 'data' ? 'Usar como data' : 'Usar como local'}</button>
                ) : null}
                <button type="button" className="btn btn-quiet px-4" disabled={ocupado === votacao.id} onClick={() => onOrganizar(votacao, 'apagar')}>Apagar</button>
              </div>
            ) : null}
          </li>
        );
      })}</ul> : vazio ? <p className="text-sm text-marfim-2">{vazio}</p> : null}
    </div>
  );
}
