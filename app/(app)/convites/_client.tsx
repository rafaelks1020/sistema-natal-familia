'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Link2, Send, X } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import PedidosConvite from '../convidar/_client';
import type { PedidoConvite } from '@/app/lib/convites';
import { useMe } from '@/app/ui/user';

interface Convite {
  id: number;
  token: string;
  label: string;
  participant_name: string | null;
  max_uses: number | null;
  uses: number;
  days_left: number | null;
  joined: string[];
  status: 'ativo' | 'usado' | 'vencido' | 'cancelado';
}
interface Participante {
  id: number;
  name: string;
  user_id: number | null;
}

const linkDe = (token: string) => `${window.location.origin}/entrar?convite=${token}`;
const textoZap = (c: Convite) =>
  `Oi! Entra no nosso Natal em Família: mural, amigo oculto, vaquinha e as fotos da ceia. ` +
  `Cria seu usuário por este link: ${linkDe(c.token)}`;

export default function ConvitesClient({ initial, participants, pedidos }: { initial: Convite[]; participants: Participante[]; pedidos: PedidoConvite[] }) {
  const me = useMe();
  const toast = useToast();
  const [lista, setLista] = useState<Convite[] | null>(initial);
  const [semAcesso, setSemAcesso] = useState<Participante[]>(participants.filter((p) => !p.user_id));
  const [form, setForm] = useState({ tipo: 'pessoa' as 'pessoa' | 'geral', label: '', participant_id: '', days: '30' });
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, v] = await Promise.all([
        api<Convite[]>('/api/invites'),
        api<{ participants: Participante[] }>('/api/vaquinha'),
      ]);
      setLista(c);
      setSemAcesso(v.participants.filter((p) => !p.user_id));
    } catch (e) {
      toast((e as Error).message, 'erro');
    }
  }, [toast]);


  if (!me.is_admin) {
    return (
      <>
        <PageHeader kicker="Convites" title="Só para quem organiza" back="/" />
        <p className="px-5 text-marfim-2">Peça o link de convite para quem organiza o Natal.</p>
      </>
    );
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const pessoa = semAcesso.find((p) => String(p.id) === form.participant_id);
      const label = form.tipo === 'geral' ? form.label || 'Família toda' : form.label || pessoa?.name || '';
      const novo = await api<{ token: string }>('/api/invites', {
        method: 'POST',
        json: {
          label,
          participant_id: form.tipo === 'pessoa' && form.participant_id ? Number(form.participant_id) : null,
          days: Number(form.days),
        },
      });
      await navigator.clipboard?.writeText(linkDe(novo.token)).catch(() => {});
      toast('Convite criado. Link copiado.');
      setForm((f) => ({ ...f, label: '', participant_id: '' }));
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function copiar(c: Convite) {
    try {
      await navigator.clipboard.writeText(linkDe(c.token));
      setCopiado(c.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast('Não deu para copiar. Segure no link e copie.', 'erro');
    }
  }

  async function cancelar(c: Convite) {
    if (!window.confirm(`Cancelar o convite "${c.label}"? O link para de funcionar.`)) return;
    try {
      await api(`/api/invites/${c.id}`, { method: 'DELETE' });
      toast('Convite cancelado.');
      await carregar();
    } catch (e) {
      toast((e as Error).message, 'erro');
    }
  }

  return (
    <>
      <PageHeader kicker="Só quem organiza" title="Convites" back="/organizar" />

      <section className="px-5 pb-8"><PedidosConvite initial={pedidos} organizar onChanged={() => { void carregar(); }} /></section>
      <section className="rise px-5">
        <form onSubmit={criar} className="surface space-y-3 p-5">
          <p className="kicker">Novo convite</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de convite">
            {(['pessoa', 'geral'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.tipo === t}
                onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                className={`btn text-sm ${form.tipo === t ? 'btn-primary' : 'btn-ghost'}`}
              >
                {t === 'pessoa' ? 'Uma pessoa' : 'Família toda'}
              </button>
            ))}
          </div>
          <p className="text-xs text-marfim-3">
            {form.tipo === 'pessoa'
              ? 'Vale para 1 cadastro. Se a pessoa já está na vaquinha ou no sorteio, escolha ela abaixo e o acesso já entra ligado.'
              : 'Vale para quantas pessoas precisar até vencer. Bom para mandar no grupo da família.'}
          </p>

          {form.tipo === 'pessoa' && semAcesso.length > 0 && (
            <select
              className="field"
              value={form.participant_id}
              onChange={(e) => setForm((f) => ({ ...f, participant_id: e.target.value }))}
              aria-label="Participante já cadastrado"
            >
              <option value="">Pessoa nova (não está na vaquinha)</option>
              {semAcesso.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (já na vaquinha)</option>
              ))}
            </select>
          )}
          <input
            className="field"
            placeholder={form.tipo === 'pessoa' ? 'Nome no convite (ex.: Vó Maria)' : 'Nome do convite (ex.: Grupo da família)'}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            required={form.tipo === 'pessoa' && !form.participant_id}
            maxLength={60}
          />
          <label className="flex items-center justify-between gap-3 whitespace-nowrap text-sm text-marfim-2">
            Vale por
            <select
              className="field w-36"
              value={form.days}
              onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="120">120 dias</option>
            </select>
          </label>
          <button className="btn btn-primary w-full" disabled={busy}>
            <Link2 size={17} strokeWidth={1.6} /> {busy ? 'Criando…' : 'Criar e copiar link'}
          </button>
        </form>
      </section>

      <section className="mt-8 px-5">
        <h2 className="display mb-4 text-2xl">Enviados</h2>
        {!lista && <div className="h-24 animate-pulse rounded-2xl bg-carvao-2" />}
        {lista && lista.length === 0 && <p className="text-sm text-marfim-3">Nenhum convite ainda.</p>}
        <ul className="stagger divide-y divide-linha">
          {lista?.map((c) => (
            <li key={c.id} className={`py-4 ${c.status !== 'ativo' ? 'opacity-55' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.label}</p>
                  <p className="mt-0.5 text-xs text-marfim-3">
                    {c.status === 'ativo'
                      ? `${c.max_uses ? `${c.uses} de ${c.max_uses} uso` : `${c.uses} cadastro${c.uses === 1 ? '' : 's'}`}${
                          c.days_left != null ? ` · vale mais ${c.days_left} dia${c.days_left === 1 ? '' : 's'}` : ''
                        }`
                      : c.status === 'usado' ? 'Já usado' : c.status === 'vencido' ? 'Vencido' : 'Cancelado'}
                    {c.participant_name ? ` · liga a ${c.participant_name}` : ''}
                  </p>
                  {c.joined.length > 0 && <p className="mt-1 text-xs text-champagne">Entraram: {c.joined.join(', ')}</p>}
                </div>
                {c.status === 'ativo' && (
                  <button onClick={() => cancelar(c)} aria-label={`Cancelar convite ${c.label}`} className="btn btn-quiet -mr-2 px-2">
                    <X size={17} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {c.status === 'ativo' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => copiar(c)} className="btn btn-ghost text-sm">
                    {copiado === c.id ? <Check size={16} strokeWidth={1.6} /> : <Copy size={16} strokeWidth={1.6} />}
                    {copiado === c.id ? 'Copiado' : 'Copiar link'}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(textoZap(c))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost text-sm"
                  >
                    <Send size={16} strokeWidth={1.6} /> WhatsApp
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-xs text-marfim-3">
          Também dá para entrar com o código da família. <Link href="/organizar" className="underline">Organizar</Link>
        </p>
      </section>
    </>
  );
}
