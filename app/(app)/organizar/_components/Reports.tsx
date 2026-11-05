'use client';
import { useEffect, useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Empty, Loading } from '../../familia/_components/shared';
type Report = { id: number; post_id: number | null; comment_id: number | null; tipo_rotulo?: string; author_name: string; reporter_name: string; content: string; images: string[]; motivo: string };
export default function Reports() {
  const toast = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api<Report[]>('/api/reports').then((data) => { if (active) { setReports(data); setFailed(false); } }).catch((error: Error) => { if (active) { setFailed(true); toast(error.message, 'erro'); } });
    return () => { active = false; };
  }, [toast, attempt]);
  async function resolve(id: number, acao: 'apagar' | 'manter') {
    if (acao === 'apagar' && !window.confirm('Apagar o conteúdo denunciado?')) return;
    setBusy(true);
    try { await api(`/api/reports/${id}/resolve`, { method: 'POST', json: { acao } }); setAttempt((value) => value + 1); toast('Denúncia resolvida.'); }
    catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  return <section className="border-t border-linha py-8"><p className="kicker mb-2">Cuidar da família</p><h2 className="display text-3xl">Denúncias</h2><p className="my-4 text-sm text-marfim-3">Analise e resolva cada denúncia em até 24 horas.</p>
    {failed ? <button className="btn btn-ghost" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button> : reports === null ? <Loading /> : !reports.length ? <Empty title="Tudo em ordem" text="Nenhuma denúncia pendente." /> : reports.map((report) => <article key={report.id} className="border-b border-linha py-5 space-y-3"><p className="text-sm">{report.tipo_rotulo ?? (report.comment_id ? 'Comentário' : 'Publicação')} de {report.author_name}</p><p className="whitespace-pre-wrap break-words text-marfim-2">{report.content}</p>{report.images.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Ver foto {index + 1}</a>)}<p className="text-sm text-marfim-3">Denunciado por {report.reporter_name}: {report.motivo}</p><div className="flex gap-3"><button disabled={busy} className="btn btn-primary" onClick={() => void resolve(report.id, 'apagar')}>Apagar conteúdo</button><button disabled={busy} className="btn btn-ghost" onClick={() => void resolve(report.id, 'manter')}>Manter</button></div></article>)}
  </section>;
}
