'use client';

import { useCallback, useState, type ReactNode } from 'react';
import LoopMedia from '@/app/ui/LoopMedia';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import MyWishes from './_components/MyWishes';
import Organize from './_components/Organize';
import Result from './_components/Result';
import Ticket from './_components/Ticket';
import Extras, { type ThemeData, type HintData, type HistoryData } from './_components/Extras';
import Waiting, { NotInDraw } from './_components/Waiting';
import { sortWishes, type Receiver, type SantaResponse, type WishItem, type WishResponse } from './_components/types';

export default function AmigoOcultoClient({ initialSanta, initialWishes, initialTheme, initialHints, initialHistory }: { initialSanta: SantaResponse; initialWishes: WishResponse; initialTheme: ThemeData; initialHints: HintData; initialHistory: HistoryData }) {
  const me = useMe();
  const toast = useToast();
  const [santa, setSanta] = useState<SantaResponse | null>(initialSanta);
  const [wishes, setWishes] = useState<WishResponse | null>(initialWishes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justRevealed, setJustRevealed] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [nextSanta, nextWishes] = await Promise.all([
        api<SantaResponse>('/api/secret-santa'),
        api<WishResponse>('/api/wishlist'),
      ]);
      setSanta(nextSanta);
      setWishes({ ...nextWishes, items: sortWishes(nextWishes.items) });
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast(msg, 'erro');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  function onRevealed(receiver: Receiver) {
    sessionStorage.removeItem('nf-ocultar-nome');
    setJustRevealed(true);
    setSanta((current) => {
      if (!current?.draw) return current;
      return { ...current, draw: { revealed: true, receiver } };
    });
  }

  const canWrite = Boolean(me.participant_id && wishes?.config_id);
  let blocked: string | null = null;
  if (!me.participant_id) blocked = 'Quando sua conta estiver na família, você escreve os desejos aqui.';
  else if (wishes && wishes.config_id == null) blocked = 'Quando o sorteio for criado, sua lista entra nele.';

  let main: ReactNode = null;
  if (loading) {
    main = (
      <div className="surface h-[420px] overflow-hidden" aria-busy="true" aria-label="Carregando o amigo oculto">
        <LoopMedia name="mn-loader" className="h-full w-full opacity-80" fallback={<div className="h-full w-full bg-carvao-3" />} />
      </div>
    );
  } else if (!santa || !wishes) {
    main = (
      <div className="surface px-6 py-10 text-center">
        <p className="display-italic text-[2rem]">Não deu para abrir</p>
        <p className="mt-3 text-sm text-marfim-2">{error || 'Tente de novo em instantes.'}</p>
        <button type="button" className="btn btn-ghost mt-6" onClick={() => { setLoading(true); void load(); }}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (!santa.config) {
    main = <Waiting />;
  } else if (!santa.participating || !santa.draw) {
    main = <NotInDraw linked={me.participant_id != null} />;
  } else if (!santa.draw.revealed || !santa.draw.receiver) {
    main = <Ticket key={santa.config.id} config={santa.config} canReveal={santa.can_reveal} revealOpensAt={santa.reveal_opens_at} onDone={onRevealed} />;
  } else {
    main = <Result config={santa.config} receiver={santa.draw.receiver} forceShow={justRevealed} />;
  }

  return (
    <div>
      <PageHeader kicker="Natal em família" title="Amigo oculto" back="/ceia" />
      <div className="space-y-10 px-5">
        <Extras initialTheme={initialTheme} initialHints={initialHints} initialHistory={initialHistory} canSend={!!santa?.draw?.revealed} configId={santa?.config?.id ?? null} main={main} />
        {wishes && (
          <MyWishes
            items={wishes.items}
            canWrite={canWrite}
            blockedReason={blocked}
            onChange={(items: WishItem[]) => setWishes((w) => (w ? { ...w, items } : w))}
          />
        )}
        {me.is_admin && <Organize onChanged={() => { setLoading(true); void load(); }} />}
      </div>
    </div>
  );
}
