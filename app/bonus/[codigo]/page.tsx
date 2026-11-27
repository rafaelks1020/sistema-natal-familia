'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Gift, Hourglass, Lock, Sparkles, Trophy } from 'lucide-react';

// Quem toca na notificação com pontos surpresa chega aqui (rota /bonus/<codigo> dentro do push).
// Fica fora do grupo (app) de propósito: sem sessão, mostra "entre para resgatar" em vez de perder o código.

type Resultado = { ok: boolean; ganhou: boolean; ja_resgatado: boolean; pontos: number; titulo: string };
type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'ganhou'; dados: Resultado }
  | { tipo: 'ja'; dados: Resultado }
  | { tipo: 'expirou' }
  | { tipo: 'entrar' }
  | { tipo: 'nao-existe' }
  | { tipo: 'erro'; mensagem: string };

const textoPontos = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'ponto' : 'pontos'}`;

export default function BonusPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = typeof params?.codigo === 'string' ? params.codigo : '';
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const iniciou = useRef(false);

  const resgatar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const res = await fetch('/api/bonus/resgatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null) as (Resultado & { error?: string }) | null;
      if (res.status === 401) return setEstado({ tipo: 'entrar' });
      if (res.status === 404) return setEstado({ tipo: 'nao-existe' });
      if (res.status === 410) return setEstado({ tipo: 'expirou' });
      if (!res.ok || !data) return setEstado({ tipo: 'erro', mensagem: data?.error ?? 'Não deu certo. Tente de novo.' });
      setEstado(data.ja_resgatado ? { tipo: 'ja', dados: data } : { tipo: 'ganhou', dados: data });
    } catch {
      setEstado({ tipo: 'erro', mensagem: 'Não foi possível conectar. Confira a internet e tente de novo.' });
    }
  }, [codigo]);

  useEffect(() => {
    // Um resgate só por abertura da tela (o modo estrito do desenvolvimento roda o efeito duas vezes).
    if (iniciou.current) return;
    iniciou.current = true;
    void resgatar();
  }, [resgatar]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-10 text-center">
      {estado.tipo === 'carregando' && (
        <p className="text-sm text-marfim-2" role="status">Abrindo seu bônus...</p>
      )}

      {estado.tipo === 'ganhou' && (
        <section aria-live="polite" className="rise space-y-5">
          <Sparkles className="mx-auto text-champagne" size={40} strokeWidth={1.4} aria-hidden />
          <p className="kicker">{estado.dados.titulo}</p>
          <h1 className="display text-[2.4rem] text-balance">Você ganhou {textoPontos(estado.dados.pontos)}!</h1>
          <p className="text-marfim-2">Bônus surpresa da notificação. Os pontos entram no Campeão do Natal e aparecem nos seus pontos em até 5 minutos.</p>
          <Link href="/pontos" className="btn btn-primary w-full"><Trophy size={18} aria-hidden /> Ver meus pontos</Link>
        </section>
      )}

      {estado.tipo === 'ja' && (
        <section aria-live="polite" className="rise space-y-5">
          <Gift className="mx-auto text-champagne" size={40} strokeWidth={1.4} aria-hidden />
          <p className="kicker">{estado.dados.titulo}</p>
          <h1 className="display text-[2.2rem] text-balance">Você já resgatou este bônus</h1>
          <p className="text-marfim-2">Os {textoPontos(estado.dados.pontos)} já estão na sua conta. Cada pessoa resgata uma vez só.</p>
          <Link href="/pontos" className="btn btn-primary w-full"><Trophy size={18} aria-hidden /> Ver meus pontos</Link>
        </section>
      )}

      {estado.tipo === 'expirou' && (
        <section aria-live="polite" className="rise space-y-5">
          <Hourglass className="mx-auto text-marfim-2" size={40} strokeWidth={1.4} aria-hidden />
          <h1 className="display text-[2.2rem] text-balance">Esse bônus já expirou</h1>
          <p className="text-marfim-2">O prazo acabou. Fique de olho nas próximas notificações: de vez em quando tem ponto surpresa.</p>
          <Link href="/pontos" className="btn btn-primary w-full"><Trophy size={18} aria-hidden /> Ver meus pontos</Link>
        </section>
      )}

      {estado.tipo === 'nao-existe' && (
        <section aria-live="polite" className="rise space-y-5">
          <Gift className="mx-auto text-marfim-2" size={40} strokeWidth={1.4} aria-hidden />
          <h1 className="display text-[2.2rem] text-balance">Bônus não encontrado</h1>
          <p className="text-marfim-2">Esse link não vale mais. O bônus só pode ser aberto pela notificação.</p>
          <Link href="/pontos" className="btn btn-ghost w-full">Ver meus pontos</Link>
        </section>
      )}

      {estado.tipo === 'entrar' && (
        <section aria-live="polite" className="rise space-y-5">
          <Lock className="mx-auto text-champagne" size={40} strokeWidth={1.4} aria-hidden />
          <h1 className="display text-[2.2rem] text-balance">Entre para resgatar seus pontos</h1>
          <p className="text-marfim-2">Entre na sua conta e toque de novo na notificação para ganhar o bônus.</p>
          <Link href="/entrar" className="btn btn-primary w-full">Entrar</Link>
        </section>
      )}

      {estado.tipo === 'erro' && (
        <section aria-live="polite" className="rise space-y-5">
          <h1 className="display text-[2.2rem] text-balance">Não foi possível resgatar</h1>
          <p className="text-marfim-2">{estado.mensagem}</p>
          <button type="button" className="btn btn-primary w-full" onClick={() => { void resgatar(); }}>Tentar novamente</button>
        </section>
      )}
    </main>
  );
}
