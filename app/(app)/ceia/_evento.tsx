'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  camposEvento,
  diasAte,
  formatarQuando,
  isoDeBrasilia,
  textoDias,
  type CeiaEvento,
} from '@/app/api/ceia/tipos';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';

export function EventoCeia({ evento, onEvento }: { evento: CeiaEvento; onEvento: (evento: CeiaEvento) => void }) {
  const me = useMe();
  const toast = useToast();
  const quando = formatarQuando(evento.event_date);
  const inicio = camposEvento(evento.event_date);
  const [agora, setAgora] = useState<number | null>(null);
  const [data, setData] = useState(inicio.data);
  const [hora, setHora] = useState(inicio.hora);
  const [local, setLocal] = useState(evento.event_place);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tick = () => setAgora(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const campos = camposEvento(evento.event_date);
    setData(campos.data);
    setHora(campos.hora);
    setLocal(evento.event_place);
  }, [evento.event_date, evento.event_place]);

  const dias = agora === null ? null : diasAte(evento.event_date, agora);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const iso = isoDeBrasilia(data, hora);
    if (!iso) {
      toast('Informe uma data e um horário válidos. Use o horário de Brasília.', 'erro');
      return;
    }
    if (local.trim().length > 500) {
      toast('O local passou de 500 caracteres.', 'erro');
      return;
    }
    const contribution_value = Number(evento.contribution_value);
    if (!Number.isFinite(contribution_value)) {
      toast('Não deu para guardar a contribuição atual da ceia.', 'erro');
      return;
    }
    setBusy(true);
    try {
      const salvo = await api<CeiaEvento>('/api/settings', {
        method: 'PUT',
        json: {
          event_title: evento.event_title,
          event_date: iso,
          event_place: local.trim(),
          contribution_value,
        },
      });
      onEvento(salvo);
      toast('Data, hora e local da ceia foram salvos.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível salvar.', 'erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ceia-quando">
      <p className="kicker mb-2">01 / Quando e onde</p>
      <h2 id="ceia-quando" className="display text-3xl">A nossa noite</h2>
      <p className="mt-4 text-lg capitalize text-marfim">{quando.data}</p>
      {quando.hora ? <p className="mt-1 text-marfim-2">{quando.hora}, horário de Brasília</p> : null}
      <p className="mt-3 flex items-start gap-2 text-sm text-marfim-2">
        <MapPin className="mt-0.5 shrink-0 text-champagne" size={16} strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 break-words">{evento.event_place || 'O local ainda vai ser combinado.'}</span>
      </p>
      <div className="mt-6">
        {dias !== null && dias >= 0 ? <p className="numeral text-6xl leading-none">{dias}</p> : null}
        <p className="mt-2 text-sm text-marfim-2">{agora === null ? 'Contando os dias.' : textoDias(dias)}</p>
      </div>
      {me.is_admin ? (
        <form className="mt-6 space-y-4" onSubmit={(event) => { void salvar(event); }}>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 text-sm text-marfim-2">Data
              <input className="field mt-2 max-w-full" type="date" required value={data} onChange={(event) => setData(event.target.value)} />
            </label>
            <label className="min-w-0 text-sm text-marfim-2">Hora
              <input className="field mt-2 max-w-full" type="time" required value={hora} onChange={(event) => setHora(event.target.value)} />
            </label>
          </div>
          <label className="block text-sm text-marfim-2">Local
            <input className="field mt-2" maxLength={500} value={local} placeholder="Casa, endereço ou ponto de encontro" onChange={(event) => setLocal(event.target.value)} />
          </label>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Salvando...' : 'Salvar data e local'}</button>
        </form>
      ) : null}
    </section>
  );
}
