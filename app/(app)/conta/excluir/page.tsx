'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';

// Excluir a própria conta (exigência da App Store e do Google Play).
export default function ExcluirContaPage() {
  const toast = useToast();
  const [senha, setSenha] = useState('');
  const [certeza, setCerteza] = useState(false);
  const [busy, setBusy] = useState(false);

  async function excluir(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/me', { method: 'DELETE', json: { password: senha } });
      window.location.href = '/entrar';
    } catch (err) {
      toast((err as Error).message, 'erro');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Sua conta" title="Excluir conta" back="/familia" />
      <section className="rise space-y-5 px-5">
        <div className="surface space-y-3 p-5 text-sm leading-relaxed text-marfim-2">
          <p>Ao excluir, apagamos para sempre:</p>
          <ul className="list-inside list-disc space-y-1 text-marfim">
            <li>seu login e perfil</li>
            <li>suas fotos, recados, comentários, curtidas e votos</li>
            <li>CPF e endereço guardados para o Pix</li>
          </ul>
          <p>
            O registro de que você contribuiu continua na vaquinha da família, sem seus dados pessoais.
            Detalhes na <Link href="/privacidade" className="text-champagne underline underline-offset-4">política de privacidade</Link>.
          </p>
        </div>
        <form onSubmit={excluir} className="space-y-4">
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            placeholder="Sua senha, para confirmar"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          <label className="flex items-start gap-3 text-sm text-marfim-2">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 accent-[#c5292d]"
              checked={certeza}
              onChange={(e) => setCerteza(e.target.checked)}
            />
            Entendo que isso não pode ser desfeito.
          </label>
          <button type="submit" disabled={busy || !certeza || !senha} className="btn btn-primary w-full">
            {busy ? 'Excluindo…' : 'Excluir minha conta'}
          </button>
          <Link href="/familia" className="btn btn-quiet w-full">Cancelar</Link>
        </form>
      </section>
    </>
  );
}
