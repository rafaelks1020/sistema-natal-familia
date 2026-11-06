'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading } from '../../familia/_components/shared';

type Pessoa = { id: number; nome: string };
type Ficha = { sem_presenca: Pessoa[]; sem_pagamento: Pessoa[] };
type Resposta = { enviados: number; elegiveis: number; ja_avisados: number };

const LISTAS = [
  { motivo: 'presenca' as const, titulo: 'Sem presença', texto: 'Ainda não disseram se vêm.', chave: 'sem_presenca' as const },
  { motivo: 'vaquinha' as const, titulo: 'Sem pagamento', texto: 'Ainda não pagaram a vaquinha.', chave: 'sem_pagamento' as const },
];

export default function LembretesClient() {
  const toast = useToast();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api<Ficha>('/api/lembretes')
      .then((r) => { if (ativo) { setFicha(r); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  async function lembrar(motivo: 'presenca' | 'vaquinha', pessoa?: Pessoa) {
    const frase = pessoa
      ? `Enviar lembrete para ${pessoa.nome}?`
      : 'Enviar lembrete para todas as pessoas desta lista?';
    if (!window.confirm(frase)) return;
    const chave = pessoa ? `${motivo}-${pessoa.id}` : `${motivo}-todos`;
    setBusy(chave);
    try {
      const r = await api<Resposta>('/api/lembretes/enviar', {
        method: 'POST',
        json: { motivo, ...(pessoa ? { user_ids: [pessoa.id] } : {}) },
      });
      if (r.enviados > 0) toast(r.enviados === 1 ? 'Lembrete enviado.' : `Lembrete enviado para ${r.enviados} pessoas.`);
      else if (r.ja_avisados > 0) toast(pessoa ? 'Essa pessoa já foi avisada hoje.' : 'Essas pessoas já foram avisadas hoje.');
      else toast('Ninguém para avisar.');
      setTentativa((v) => v + 1);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="Um toque, sem repetir no mesmo dia" title="Lembretes" back="/admin" />
      <div className="space-y-10 px-5">
        {falhou ? (
          <button className="btn btn-ghost w-full" onClick={() => { setFalhou(false); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        ) : !ficha ? <Loading /> : LISTAS.map((lista) => {
          const pessoas = ficha[lista.chave];
          return (
            <section key={lista.motivo} aria-labelledby={lista.motivo}>
              <h2 id={lista.motivo} className="kicker mb-1">{lista.titulo}</h2>
              <p className="mb-3 text-sm text-marfim-2">{lista.texto}</p>
              {pessoas.length === 0 ? <p className="text-sm text-marfim-2">Ninguém nesta lista.</p> : (
                <>
                  <button className="btn btn-primary mb-4 w-full" disabled={busy !== null} onClick={() => { void lembrar(lista.motivo); }}>
                    {busy === `${lista.motivo}-todos` ? 'Enviando...' : 'Lembrar todos'}
                  </button>
                  <ul className="divide-y divide-linha border-y border-linha">
                    {pessoas.map((pessoa) => (
                      <li key={pessoa.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate text-sm">{pessoa.nome}</span>
                        <button
                          className="btn btn-quiet min-h-11 shrink-0"
                          disabled={busy !== null}
                          onClick={() => { void lembrar(lista.motivo, pessoa); }}
                        >
                          {busy === `${lista.motivo}-${pessoa.id}` ? 'Enviando...' : 'Lembrar'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
