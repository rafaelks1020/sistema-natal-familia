'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { textoGrupo, textoTotais, type CeiaPresenca, type StatusPresenca } from '@/app/api/ceia/tipos';
import { api } from '@/app/ui/client';
import Avatar from '@/app/ui/Avatar';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

const OPCOES: { id: StatusPresenca; rotulo: string }[] = [
  { id: 'yes', rotulo: 'Vou' },
  { id: 'maybe', rotulo: 'Talvez' },
  { id: 'no', rotulo: 'Não' },
];

export function PresencaCeia({ presenca, onPresenca }: { presenca: CeiaPresenca; onPresenca: (presenca: CeiaPresenca) => void }) {
  const me = useMe();
  const toast = useToast();
  const [status, setStatus] = useState<StatusPresenca | null>(presenca.status);
  const [adultos, setAdultos] = useState(presenca.adultos);
  const [criancas, setCriancas] = useState(presenca.criancas);
  const [restricao, setRestricao] = useState(presenca.restricao ?? '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(presenca.status);
    setAdultos(presenca.adultos);
    setCriancas(presenca.criancas);
    setRestricao(presenca.restricao ?? '');
  }, [presenca.status, presenca.adultos, presenca.criancas, presenca.restricao]);

  async function salvar(proximo: StatusPresenca, adultosEnvio: number, criancasEnvio: number) {
    if (busy) return;
    if (me.participant_id === null) {
      toast('Seu acesso ainda não está ligado a uma pessoa da família.', 'erro');
      return;
    }
    setBusy(true);
    try {
      const corpo: Record<string, unknown> = { status: proximo };
      if (proximo === 'no') {
        corpo.adultos = 0;
        corpo.criancas = 0;
      } else {
        corpo.adultos = adultosEnvio;
        corpo.criancas = criancasEnvio;
        corpo.restricao = restricao;
      }
      await api('/api/attendance', { method: 'POST', json: corpo });
      const novo = await api<{ presenca: CeiaPresenca }>('/api/ceia');
      onPresenca(novo.presenca);
      toast(proximo === 'yes' ? 'Seu lugar à mesa está confirmado!' : proximo === 'maybe' ? 'Guardamos o seu talvez.' : 'Avisamos que você não vai.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível salvar.', 'erro');
    } finally {
      setBusy(false);
    }
  }

  function escolher(proximo: StatusPresenca) {
    let adultosEnvio = adultos;
    const criancasEnvio = criancas;
    if (proximo !== 'no' && adultosEnvio + criancasEnvio < 1) {
      adultosEnvio = 1;
      setAdultos(1);
    }
    setStatus(proximo);
    void salvar(proximo, adultosEnvio, criancasEnvio);
  }

  const confirmados = presenca.pessoas.filter((pessoa) => pessoa.status === 'yes');
  const talvez = presenca.pessoas.filter((pessoa) => pessoa.status === 'maybe');
  const nao = presenca.pessoas.filter((pessoa) => pessoa.status === 'no');

  return (
    <section aria-labelledby="ceia-presenca">
      <p className="kicker mb-2">02 / Quem vem</p>
      <h2 id="ceia-presenca" className="display text-3xl">Presença</h2>
      {me.participant_id === null ? (
        <p className="mt-4 text-sm leading-relaxed text-marfim-2">Seu acesso ainda não está ligado a uma pessoa da família. Peça para quem organiza. Você já pode votar e dizer o que vai levar.</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {OPCOES.map((opcao) => (
              <button key={opcao.id} type="button" disabled={busy} aria-pressed={status === opcao.id} onClick={() => escolher(opcao.id)} className={`btn px-2 ${status === opcao.id ? 'btn-primary' : 'btn-ghost'}`}>
                {status === opcao.id ? <Check size={16} strokeWidth={1.5} /> : null}
                {opcao.rotulo}
              </button>
            ))}
          </div>
          {status === 'yes' || status === 'maybe' ? (
            <div className="space-y-4">
              <Contador rotulo="Adultos" valor={adultos} menos="Menos um adulto" mais="Mais um adulto" onMudar={setAdultos} />
              <Contador rotulo="Crianças" valor={criancas} menos="Menos uma criança" mais="Mais uma criança" onMudar={setCriancas} />
              <label className="block text-sm text-marfim-2">Restrição alimentar (só quem organiza vê)
                <input className="field mt-2" maxLength={120} value={restricao} placeholder="Ex.: sem glúten, alergia a camarão" onChange={(event) => setRestricao(event.target.value)} />
              </label>
              <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => {
                const adultosEnvio = adultos + criancas < 1 ? 1 : adultos;
                if (adultosEnvio !== adultos) setAdultos(adultosEnvio);
                void salvar(status, adultosEnvio, criancas);
              }}>{busy ? 'Salvando...' : 'Guardar quantidades'}</button>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-8">
        <p className="numeral text-5xl leading-none">{presenca.totais.pessoas}</p>
        <p className="mt-2 text-sm text-marfim-2">{presenca.totais.pessoas === 1 ? 'pessoa à mesa' : 'pessoas à mesa'}</p>
        <p className="mt-1 text-sm text-marfim-3">{textoTotais(presenca.totais)}</p>
        {me.is_admin ? <p className="mt-2 text-xs text-marfim-3">As restrições alimentares só aparecem para quem organiza.</p> : null}
      </div>

      {confirmados.length ? (
        <ul className="mt-6 space-y-4">
          {confirmados.map((pessoa) => (
            <li key={pessoa.participant_id} className="flex min-w-0 items-start gap-3">
              <Avatar name={pessoa.name} src={pessoa.avatar_url} />
              <div className="min-w-0">
                <p className="break-words">{pessoa.name}</p>
                <p className="text-sm text-marfim-2">{textoGrupo(pessoa.adultos, pessoa.criancas)}</p>
                {me.is_admin && pessoa.restricao ? <p className="mt-1 break-words text-sm text-champagne">{pessoa.restricao}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-6 text-sm text-marfim-2">Ninguém confirmou ainda. Seja a primeira pessoa à mesa.</p>}

      {talvez.length ? (
        <div className="mt-6">
          <p className="kicker mb-2">Talvez</p>
          <ul className="flex flex-wrap gap-2">
            {talvez.map((pessoa) => <li key={pessoa.participant_id} className="rounded-full border border-linha px-3 py-2 text-sm text-marfim-2">{pessoa.name}</li>)}
          </ul>
        </div>
      ) : null}
      {nao.length ? (
        <div className="mt-4">
          <p className="kicker mb-2">Não vão</p>
          <ul className="flex flex-wrap gap-2">
            {nao.map((pessoa) => <li key={pessoa.participant_id} className="rounded-full border border-linha px-3 py-2 text-sm text-marfim-3">{pessoa.name}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Contador({ rotulo, valor, menos, mais, onMudar }: { rotulo: string; valor: number; menos: string; mais: string; onMudar: (valor: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-marfim-2">{rotulo}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-ghost h-12 w-12 shrink-0 px-0" aria-label={menos} onClick={() => onMudar(Math.max(0, valor - 1))}>-</button>
        <span className="numeral w-8 text-center text-2xl">{valor}</span>
        <button type="button" className="btn btn-ghost h-12 w-12 shrink-0 px-0" aria-label={mais} onClick={() => onMudar(Math.min(40, valor + 1))}>+</button>
      </div>
    </div>
  );
}
