'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BellRing, ChevronRight, ShieldAlert } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { LogItem, PaginaLog, Resumo } from '@/app/lib/admin/tipos';
import { Loading, Sheet } from '../familia/_components/shared';
import { formatarData } from './_lib';

const PENDENCIAS = [
  { chave: 'denuncias', rotulo: 'Denúncias para analisar', href: '/admin/denuncias' },
  { chave: 'pedidos_convite', rotulo: 'Pedidos de convite', href: '/admin/pedidos_convite' },
  { chave: 'bingo_pendentes', rotulo: 'Bingos para confirmar', href: '/admin/bingo_pedidos' },
] as const;

export default function AdminHome() {
  const toast = useToast();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    api<Resumo>('/api/admin/resumo')
      .then((r) => { if (ativo) { setResumo(r); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    api<PaginaLog>('/api/admin/log').then((p) => { if (ativo) setLog(p.itens.slice(0, 5)); }).catch(() => {});
    return () => { ativo = false; };
  }, [toast, tentativa]);

  const totalPendente = resumo ? PENDENCIAS.reduce((soma, p) => soma + resumo.pendencias[p.chave], 0) : 0;

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="Cuidar de tudo" title="Painel admin" back="/organizar" />
      <div className="space-y-10 px-5">
        {falhou ? (
          <button className="btn btn-ghost w-full" onClick={() => { setFalhou(false); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        ) : !resumo ? <Loading /> : (
          <>
            <section aria-labelledby="pend">
              <h2 id="pend" className="kicker mb-3">Precisa da sua atenção</h2>
              {totalPendente === 0 ? (
                <p className="border-y border-linha py-5 text-sm text-marfim-2">Tudo em dia. Nada esperando por você.</p>
              ) : (
                <ul className="space-y-3">
                  {PENDENCIAS.map((p) => {
                    const n = resumo.pendencias[p.chave];
                    return (
                      <li key={p.chave}>
                        <Link href={p.href} className={`flex min-h-16 items-center gap-4 rounded-2xl border px-4 py-3 ${n > 0 ? 'border-champagne bg-carvao-2' : 'border-linha'}`}>
                          <span className={`display flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${n > 0 ? 'bg-cereja text-marfim' : 'border border-linha text-marfim-3'}`}>{n}</span>
                          <span className="flex-1 text-sm">{p.rotulo}</span>
                          <ChevronRight size={18} strokeWidth={1.5} className="text-marfim-3" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {resumo.grupos.map((g) => (
              <section key={g.titulo} aria-label={g.titulo}>
                <h2 className="kicker mb-3">{g.titulo}</h2>
                <ul className="divide-y divide-linha border-y border-linha">
                  {g.recursos.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/${r.id}`} className="flex min-h-14 items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-champagne">
                        <span className="min-w-0 flex-1 text-sm">{r.nome}</span>
                        {r.novos7d > 0 && <span className="rounded-full border border-champagne/50 px-2 py-0.5 text-xs text-champagne">+{r.novos7d} em 7 dias</span>}
                        <span className="display w-10 text-right text-xl">{r.total}</span>
                        <ChevronRight size={16} strokeWidth={1.5} className="text-marfim-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section aria-labelledby="ferr">
              <h2 id="ferr" className="kicker mb-3">Ferramentas</h2>
              <ul className="divide-y divide-linha border-y border-linha">
                {resumo.ferramentas.map((f) => (
                  <li key={f.rota_site}>
                    <Link href={f.rota_site} className="flex min-h-16 items-center gap-3 py-3">
                      <span className="min-w-0 flex-1"><span className="block text-sm">{f.titulo}</span><span className="mt-1 block text-xs text-marfim-3">{f.texto}</span></span>
                      <ArrowUpRight size={18} strokeWidth={1.5} className="text-marfim-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <Aviso />

            <section aria-labelledby="log">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="log" className="kicker">Últimas ações</h2>
                <Link href="/admin/log" className="text-xs text-champagne">Ver tudo</Link>
              </div>
              {log.length === 0 ? <p className="text-sm text-marfim-3">Nada registrado ainda.</p> : (
                <ul className="divide-y divide-linha border-y border-linha">
                  {log.map((l) => (
                    <li key={l.id} className="py-3">
                      <p className="text-sm"><span className="text-champagne">{l.quem}</span>: {l.acao} em {l.recurso}</p>
                      <p className="mt-1 text-xs text-marfim-3">{formatarData(l.quando)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Aviso() {
  const toast = useToast();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [rota, setRota] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);

  async function enviar() {
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; enviados: number }>('/api/admin/aviso', {
        method: 'POST', json: { titulo, corpo, ...(rota.trim() ? { rota: rota.trim() } : {}) },
      });
      toast(r.enviados ? `Aviso enviado para ${r.enviados} pessoa${r.enviados === 1 ? '' : 's'}.` : 'Ninguém tem o app com avisos ligados ainda.');
      setConfirmar(false);
      if (r.enviados) { setTitulo(''); setCorpo(''); setRota(''); }
    } catch (e) { toast((e as Error).message, 'erro'); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="aviso">
      <h2 id="aviso" className="kicker mb-3">Enviar aviso para a família</h2>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setConfirmar(true); }}>
        <label className="block text-sm text-marfim-2">Título
          <input className="field mt-2" required maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="block text-sm text-marfim-2">Mensagem
          <textarea className="field mt-2" rows={3} required maxLength={240} value={corpo} onChange={(e) => setCorpo(e.target.value)} />
        </label>
        <label className="block text-sm text-marfim-2">Tela que abre ao tocar (opcional)
          <input className="field mt-2" maxLength={100} placeholder="/mural" value={rota} onChange={(e) => setRota(e.target.value)} />
        </label>
        <button className="btn btn-ghost w-full" disabled={busy || !titulo.trim() || !corpo.trim()}><BellRing size={18} strokeWidth={1.5} />Revisar e enviar</button>
      </form>
      {confirmar && (
        <Sheet title="Enviar para todos?" busy={busy} onClose={() => setConfirmar(false)}>
          <p className="mb-2 flex items-start gap-2 text-sm text-marfim-2"><ShieldAlert size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-champagne" />Todo mundo que tem o app vai receber agora. Não dá para desfazer.</p>
          <div className="my-5 rounded-2xl border border-linha p-4"><p className="text-sm font-semibold">{titulo}</p><p className="mt-1 text-sm text-marfim-2">{corpo}</p></div>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => void enviar()}>{busy ? 'Enviando...' : 'Enviar aviso'}</button>
          <button className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={() => setConfirmar(false)}>Cancelar</button>
        </Sheet>
      )}
    </section>
  );
}
