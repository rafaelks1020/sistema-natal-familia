'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';

// Mesma lista da rota /api/telao/ao-vivo e do CHECK da migração 033.
const EMOJIS: { emoji: string; nome: string }[] = [
  { emoji: '\u2764\uFE0F', nome: 'coração' },
  { emoji: '\u{1F602}', nome: 'risada' },
  { emoji: '\u{1F384}', nome: 'árvore de Natal' },
  { emoji: '\u{1F385}', nome: 'Papai Noel' },
  { emoji: '\u{1F44F}', nome: 'palmas' },
  { emoji: '\u{1F942}', nome: 'brinde' },
  { emoji: '\u{1F60D}', nome: 'apaixonado' },
  { emoji: '\u{1F525}', nome: 'fogo' },
];

const CSS = `
@keyframes aovivo-pulo {
  0% { transform: scale(1); }
  40% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.aovivo-pulo { display: inline-block; animation: aovivo-pulo 0.6s cubic-bezier(0.22, 1.2, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .aovivo-pulo { animation: none; }
}
`;

export default function AoVivoClient() {
  const toast = useToast();
  const ultimo = useRef(0);
  const [pulso, setPulso] = useState<{ emoji: string; n: number } | null>(null);
  const [texto, setTexto] = useState('');
  const [espera, setEspera] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  async function reagir(emoji: string) {
    const agora = Date.now();
    if (agora - ultimo.current < 1000) return;
    ultimo.current = agora;
    setPulso({ emoji, n: agora });
    try {
      await api('/api/telao/ao-vivo', { method: 'POST', json: { tipo: 'reacao', emoji } });
    } catch (err) {
      ultimo.current = 0;
      toast((err as Error).message, 'erro');
    }
  }

  async function mandarRecado(ev: React.FormEvent) {
    ev.preventDefault();
    const limpo = texto.trim().replace(/\s+/g, ' ');
    if (!limpo || busy || espera > 0) return;
    setBusy(true);
    try {
      const r = await api<{ aprovado?: boolean }>('/api/telao/ao-vivo', { method: 'POST', json: { tipo: 'recado', texto: limpo } });
      setTexto('');
      setEspera(30);
      toast(r?.aprovado ? 'Recado enviado. Já está aparecendo no telão.' : 'Recado enviado. Ele aparece no telão assim que quem organiza aprovar.');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <style>{CSS}</style>
    <PageHeader kicker="Noite de Natal" title="Telão ao vivo" back="/festa" />
    <div className="space-y-5 px-5 pb-8">
      <section aria-label="Reações">
        <p className="kicker mb-3">Reações</p>
        <div className="grid grid-cols-4 gap-3">
          {EMOJIS.map(({ emoji, nome }) => <button
            key={emoji}
            type="button"
            className="surface flex min-h-[5.25rem] items-center justify-center text-[3.15rem] leading-none"
            aria-label={`Enviar ${nome} para o telão`}
            onClick={() => void reagir(emoji)}
          >
            <span className={pulso?.emoji === emoji ? 'aovivo-pulo' : undefined} key={pulso?.emoji === emoji ? pulso.n : emoji}>{emoji}</span>
          </button>)}
        </div>
        <p className="mt-3 text-sm text-marfim-2">Toque e a reação sobe no telão na hora.</p>
      </section>

      <form className="surface p-4" onSubmit={(ev) => void mandarRecado(ev)}>
        <label className="block text-sm text-marfim-2" htmlFor="recado-telao">Mande um recado para o telão
          <textarea
            id="recado-telao"
            className="field mt-2 min-h-28"
            maxLength={140}
            value={texto}
            onChange={(ev) => setTexto(ev.target.value)}
            placeholder="Feliz Natal para todo mundo!"
          />
        </label>
        <div className="mt-1 text-right text-xs text-marfim-3">{texto.length}/140</div>
        <p className="mt-2 text-sm text-marfim-2">Passa pela aprovação de quem organiza.</p>
        <button className="btn btn-primary mt-3 w-full" disabled={busy || espera > 0 || !texto.trim()}>
          {espera > 0 ? `Pode mandar de novo em ${espera} s` : 'Mandar recado'}
        </button>
      </form>

      <Link href="/mural" className="btn btn-ghost w-full">
        <Camera size={18} /> Mandar foto para o telão
      </Link>
    </div>
  </>;
}
