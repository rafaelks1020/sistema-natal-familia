'use client';
import { useState } from 'react';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Sheet } from '../../familia/_components/shared';

// alvoTipo/alvoId: conteúdos novos (receita, dica, carona...), tipos em app/lib/denuncias.ts.
export default function ModerationActions({ userId, name, postId, commentId, alvoTipo, alvoId }: { userId: number; name: string; postId?: number; commentId?: number; alvoTipo?: string; alvoId?: number }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<'report' | 'block' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      if (sheet === 'report') {
        await api('/api/reports', { method: 'POST', json: alvoTipo ? { alvo_tipo: alvoTipo, alvo_id: alvoId, motivo } : { post_id: postId, comment_id: commentId, motivo } });
        toast('Denúncia enviada. Analisaremos em até 24 horas.');
        setSheet(null);
      } else {
        await api('/api/blocks', { method: 'POST', json: { user_id: userId } });
        window.location.reload();
      }
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="btn btn-quiet min-h-11 w-full justify-start px-4 text-sm" onClick={() => setSheet('report')}>Denunciar</button>
    <button type="button" className="btn btn-quiet min-h-11 w-full justify-start px-4 text-sm" onClick={() => setSheet('block')}>Bloquear {name}</button>
    {sheet && <Sheet title={sheet === 'report' ? 'Denunciar conteúdo' : `Bloquear ${name}?`} busy={busy} onClose={() => setSheet(null)}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {sheet === 'report' ? <><p className="text-sm text-marfim-2">Quem organiza analisará a denúncia em até 24 horas.</p><label className="block text-sm">Motivo<textarea className="field mt-2" required maxLength={1000} value={motivo} onChange={(event) => setMotivo(event.target.value)} /></label></> : <p className="text-sm text-marfim-2">As publicações, fotos e comentários dessa pessoa deixarão de aparecer para você. Você pode desbloquear no seu perfil.</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Enviando...' : sheet === 'report' ? 'Enviar denúncia' : 'Confirmar bloqueio'}</button>
      </form>
    </Sheet>}
  </>;
}
