'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { api } from '@/app/ui/client';
import type { Conquistas } from '@/app/lib/conquistas';

export default function SelosPerfil({ id }: { id: string }) {
  const [dados, setDados] = useState<Conquistas | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let ativo = true;
    api<Conquistas>(`/api/conquistas?user_id=${encodeURIComponent(id)}`)
      .then((d) => { if (ativo) { setDados(d); setErro(false); } })
      .catch(() => { if (ativo) setErro(true); });
    return () => { ativo = false; };
  }, [id]);
  if (erro) return <p className="mt-4 text-xs text-marfim-3">Não foi possível carregar os selos.</p>;
  if (!dados || String(dados.user_id) !== id) return null;
  const selos = dados.selos.filter((s) => s.conquistado);
  return <div className="my-5"><p className="kicker">Selos de {dados.ano}</p><div className="mt-3 flex flex-wrap justify-center gap-2">{selos.map((s) => <span key={s.id} title={s.descricao} className="inline-flex items-center gap-1 rounded-full border border-champagne/30 px-3 py-2 text-xs text-champagne"><Award size={14} aria-hidden />{s.nome}</span>)}</div>{!selos.length && <p className="mt-2 text-xs text-marfim-3">As conquistas estão por chegar.</p>}<Link className="btn btn-quiet mt-2 text-xs" href="/conquistas">Conhecer todos os selos</Link></div>;
}
