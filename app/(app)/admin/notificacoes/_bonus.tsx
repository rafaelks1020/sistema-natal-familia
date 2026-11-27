'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, ErroApi } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { formatarData } from '../_lib';

type Bonus = {
  id: number;
  titulo: string | null;
  corpo: string | null;
  pontos: number;
  enviado_em: string | null;
  expira_em: string | null;
  expirado: boolean;
  resgates: number;
};

const quantos = (n: number) => `${n} ${n === 1 ? 'resgate' : 'resgates'}`;

/** Notificação com pontos surpresa: quem tocar no aviso ganha pontos no Campeão do Natal (uma vez por pessoa, dentro da validade). */
export default function BonusNotificacao() {
  const toast = useToast();
  const [lista, setLista] = useState<Bonus[] | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busy, setBusy] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [pontos, setPontos] = useState('20');
  const [horas, setHoras] = useState('24');

  useEffect(() => {
    let ativo = true;
    api<{ bonus: Bonus[] }>('/api/admin/bonus-notificacao')
      .then((r) => { if (ativo) { setLista(r.bonus); setIndisponivel(false); } })
      .catch((e: Error) => {
        if (!ativo) return;
        setLista([]);
        if (e instanceof ErroApi && e.status === 503) setIndisponivel(true);
        else toast(e.message, 'erro');
      });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const p = Number(pontos);
    const h = Number(horas);
    if (!Number.isInteger(p) || p < 1 || p > 1000) return toast('Os pontos precisam ser de 1 a 1000.', 'erro');
    if (!Number.isInteger(h) || h < 1 || h > 168) return toast('A validade precisa ser de 1 a 168 horas.', 'erro');
    if (!window.confirm(`Enviar agora para TODA a família? Quem tocar na notificação ganha ${p} ${p === 1 ? 'ponto' : 'pontos'}, uma vez só, por ${h} ${h === 1 ? 'hora' : 'horas'}. Não dá para desfazer.`)) return;
    setBusy(true);
    try {
      const r = await api<{ enviados: number }>('/api/admin/bonus-notificacao', {
        method: 'POST',
        json: { titulo, corpo, pontos: p, validade_horas: h },
      });
      toast(r.enviados === 1 ? 'Enviado para 1 pessoa com aparelho ativo.' : `Enviado para ${r.enviados} pessoas com aparelho ativo.`);
      setTitulo('');
      setCorpo('');
      setTentativa((v) => v + 1);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  const desligado = busy || indisponivel;

  return (
    <section aria-labelledby="bonus">
      <h2 id="bonus" className="kicker mb-3">Notificação com pontos surpresa</h2>
      <p className="mb-4 text-sm text-marfim-2">
        Sai agora para todo mundo com aparelho ativo. Quem tocar na notificação ganha os pontos no Campeão do Natal, uma vez por pessoa e só dentro da validade.
      </p>
      {indisponivel && (
        <p className="mb-4 text-sm text-marfim-2">A notificação com pontos surpresa ainda não está ativa. Falta aplicar a atualização do banco.</p>
      )}
      <form className="space-y-4" onSubmit={(e) => { void enviar(e); }}>
        <label className="block text-sm text-marfim-2">Título
          <input className="field mt-2" required maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={desligado} />
        </label>
        <label className="block text-sm text-marfim-2">Mensagem
          <textarea className="field mt-2" rows={3} required maxLength={240} value={corpo} onChange={(e) => setCorpo(e.target.value)} disabled={desligado} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm text-marfim-2">Pontos (1 a 1000)
            <input className="field mt-2" type="number" inputMode="numeric" min={1} max={1000} step={1} required value={pontos} onChange={(e) => setPontos(e.target.value)} disabled={desligado} />
          </label>
          <label className="block text-sm text-marfim-2">Validade em horas (1 a 168)
            <input className="field mt-2" type="number" inputMode="numeric" min={1} max={168} step={1} required value={horas} onChange={(e) => setHoras(e.target.value)} disabled={desligado} />
          </label>
        </div>
        <button className="btn btn-primary w-full" disabled={desligado}>{busy ? 'Enviando...' : 'Enviar notificação com pontos'}</button>
      </form>

      <h3 className="kicker mb-3 mt-8">Já enviadas</h3>
      {!lista ? <p className="text-sm text-marfim-2">Carregando...</p> : lista.length === 0 ? (
        <p className="text-sm text-marfim-2">Nenhuma enviada ainda.</p>
      ) : (
        <ul className="divide-y divide-linha border-y border-linha">
          {lista.map((b) => (
            <li key={b.id} className="py-3">
              <p className="text-sm">{b.titulo || 'Bônus surpresa'} · {b.pontos} {b.pontos === 1 ? 'ponto' : 'pontos'}</p>
              <p className="mt-1 text-xs text-marfim-3">
                {formatarData(b.enviado_em)} · {b.expirado ? 'expirado' : `vale até ${formatarData(b.expira_em)}`} · {quantos(b.resgates)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
