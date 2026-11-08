'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading } from '../../familia/_components/shared';
import { formatarData } from '../_lib';

type Aparelho = { plataforma: string; last_seen_at: string };
type Pessoa = { id: number; nome: string; aparelhos: Aparelho[] };
type Diagnostico = {
  porPlataforma: { ios: number; android: number; web: number };
  semAparelho: number;
  webConfigurado: boolean;
  pessoas: Pessoa[];
};

function rotulo(plataforma: string): string {
  if (plataforma === 'ios') return 'iPhone (app)';
  if (plataforma === 'android') return 'Android (app)';
  if (plataforma === 'web') return 'Site';
  return plataforma;
}

function fraseTeste(recebidos: number, falharam: number): string {
  if (recebidos === 0 && falharam === 0) return 'Nenhum aparelho desta conta recebeu o teste.';
  if (recebidos === 0) return falharam === 1 ? '1 aparelho falhou.' : `${falharam} aparelhos falharam.`;
  const chegou = recebidos === 1 ? 'Chegou em 1 aparelho.' : `Chegou em ${recebidos} aparelhos.`;
  if (!falharam) return chegou;
  return `${chegou} ${falharam === 1 ? '1 falhou.' : `${falharam} falharam.`}`;
}

export default function NotificacoesClient() {
  const toast = useToast();
  const [dados, setDados] = useState<Diagnostico | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ativo = true;
    api<Diagnostico>('/api/admin/push')
      .then((r) => { if (ativo) { setDados(r); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  async function testar() {
    setBusy(true);
    try {
      const r = await api<{ recebidos: number; falharam: number }>('/api/admin/push', { method: 'POST' });
      toast(fraseTeste(r.recebidos, r.falharam), r.recebidos ? 'ok' : 'erro');
      setTentativa((v) => v + 1);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  const totais = dados?.porPlataforma;

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="Quem recebe avisos" title="Notificações" back="/admin" />
      <div className="space-y-10 px-5">
        {falhou ? (
          <button className="btn btn-ghost w-full" onClick={() => { setFalhou(false); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        ) : !dados || !totais ? <Loading /> : (
          <>
            <section aria-labelledby="totais">
              <h2 id="totais" className="kicker mb-3">Aparelhos ativos</h2>
              <ul className="divide-y divide-linha border-y border-linha">
                {([
                  ['iPhone (app)', totais.ios],
                  ['Android (app)', totais.android],
                  ['Site', totais.web],
                ] as const).map(([nome, total]) => (
                  <li key={nome} className="flex min-h-14 items-center justify-between py-3">
                    <span className="text-sm">{nome}</span>
                    <span className="display text-2xl">{total}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-marfim-2">
                {dados.semAparelho === 0
                  ? 'Todo mundo tem pelo menos um aparelho ativo.'
                  : dados.semAparelho === 1
                    ? '1 pessoa sem nenhum aparelho.'
                    : `${dados.semAparelho} pessoas sem nenhum aparelho.`}
              </p>
              {!dados.webConfigurado && (
                <p className="mt-2 text-sm text-marfim-2">O site ainda não tem as chaves de aviso. Sem elas, o navegador não recebe.</p>
              )}
            </section>

            <section aria-labelledby="pessoas">
              <h2 id="pessoas" className="kicker mb-3">Por pessoa</h2>
              {dados.pessoas.length === 0 ? <p className="text-sm text-marfim-2">Ninguém ativou avisos ainda.</p> : (
                <ul className="divide-y divide-linha border-y border-linha">
                  {dados.pessoas.map((pessoa) => (
                    <li key={pessoa.id} className="py-3">
                      <p className="text-sm">{pessoa.nome}</p>
                      <ul className="mt-1 space-y-1">
                        {pessoa.aparelhos.map((aparelho, i) => (
                          <li key={`${aparelho.plataforma}-${aparelho.last_seen_at}-${i}`} className="text-xs text-marfim-3">
                            {rotulo(aparelho.plataforma)} · visto em {formatarData(aparelho.last_seen_at)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="teste">
              <h2 id="teste" className="kicker mb-3">Teste</h2>
              <p className="mb-4 text-sm text-marfim-2">Manda um aviso só para você, em todos os aparelhos ativos desta conta.</p>
              <button className="btn btn-primary w-full" disabled={busy} onClick={() => { void testar(); }}>
                {busy ? 'Enviando...' : 'Mandar notificação de teste para mim'}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
