'use client';
import { useState } from 'react';
import { api } from '@/app/ui/client';
import type { PainelProva, TentativaAdminProva } from './prova-tipos';

const rotulo: Record<TentativaAdminProva['status'], string> = { cantando: 'cantando', valida: 'válida', abandonada: 'abandonada', anulada: 'anulada' };

/** Conferência da organização: notas, suspeitas do servidor, vídeo da apresentação e anulação com motivo. Só admin recebe os dados. */
export default function TentativasAdmin({ tentativas, aoMudar, classe }: { tentativas: TentativaAdminProva[]; aoMudar: (p: PainelProva) => void; classe?: string }) {
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);
  const anular = async (t: TentativaAdminProva) => {
    const motivo = window.prompt(`Anular a tentativa de ${t.nome} em "${t.musica}" (${t.nota ?? 0}/100)?\nEla deixa de contar e a pessoa poderá cantar de novo. Informe o motivo:`);
    if (motivo === null) return;
    if (motivo.trim().length < 3) { setErro('Explique o motivo da anulação.'); return; }
    setOcupado(t.id); setErro('');
    try { aoMudar(await api<PainelProva>(`/api/karaoke/prova/tentativas/${t.id}/anular`, { method: 'POST', json: { motivo: motivo.trim() } })); }
    catch (e) { setErro((e as Error).message); }
    finally { setOcupado(null); }
  };
  const suspeitas = tentativas.filter((t) => t.suspeita.length && t.status !== 'anulada').length;
  return <details className={classe} aria-label="Tentativas da Prova (organização)">
    <summary>Tentativas da Prova (organização){suspeitas ? ` · ${suspeitas} com suspeita` : ''}</summary>
    {erro ? <p role="alert">{erro}</p> : null}
    {tentativas.length ? <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '.6rem' }}>{tentativas.map((t) => <li key={t.id} style={{ opacity: t.status === 'anulada' ? 0.6 : 1 }}>
      <b>{t.nome}</b> · {t.musica} · {t.fase === 'final' ? 'final' : 'eliminatória'} · <b>{t.nota ?? 0}/100</b> · {rotulo[t.status]}
      {t.suspeita.length && t.status !== 'anulada' ? <> · <mark title={t.suspeita.join('; ')}>suspeita</mark></> : null}
      {t.video_url ? <> · <a href={t.video_url} target="_blank" rel="noreferrer">ver vídeo</a></> : null}
      {t.suspeita.length ? <ul>{t.suspeita.map((m) => <li key={m}>{m}</li>)}</ul> : null}
      {t.status === 'anulada' ? <p>Anulada: {t.motivo_anulacao ?? 'sem motivo registrado'}</p> : null}
      {t.status !== 'anulada' && t.status !== 'cantando' ? <> <button type="button" disabled={ocupado === t.id} onClick={() => void anular(t)}>Anular</button></> : null}
    </li>) }</ul> : <p>Ainda não há tentativas oficiais.</p>}
  </details>;
}
