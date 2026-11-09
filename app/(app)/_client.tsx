'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Check, Flame, Gift, MapPin, PartyPopper, Sparkles, Users, Wallet, Wine } from 'lucide-react';
import AtivarNotificacoes from '@/app/components/AtivarNotificacoes';
import type { PainelMissoes } from '@/app/lib/gamificacao/tipos';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, brl, timeAgo, thumb } from '@/app/ui/client';
import { useMe } from '@/app/ui/user';
import { useToast } from '@/app/ui/toast';
import CartaoGamificacao from './_inicio/CartaoGamificacao';
import type { Attendance, AttendanceStatus, HomeData } from './_inicio/types';

const RESPOSTA: Record<AttendanceStatus, string> = { yes: 'Vou', maybe: 'Talvez', no: 'Não' };

function Bokeh({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden bg-carvao ${dim ? 'opacity-30' : ''}`}>
      {[[7, 22, 150], [80, 12, 110], [64, 60, 180], [4, 76, 90], [91, 81, 110], [42, 33, 45]].map(([x, y, size], i) => (
        <span key={i} className="absolute rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, filter: 'blur(7px)', background: 'radial-gradient(circle, rgba(191,165,119,.55), rgba(191,165,119,0) 70%)' }} />
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-label="Preparando o início" className="stagger px-6 pb-8">
      <div className="relative -mx-6 mb-8 flex min-h-[42svh] flex-col justify-end overflow-hidden px-6 pb-8">
        <Bokeh dim />
        <div className="relative space-y-5 motion-safe:animate-pulse">
          <div className="h-2 w-40 rounded bg-champagne/20" />
          <div className="h-16 w-64 rounded bg-marfim/10" /><div className="h-16 w-48 rounded bg-marfim/10" />
          <div className="h-3 w-36 rounded bg-marfim/10" />
        </div>
      </div>
      {[1, 2, 3].map((key) => <div key={key} className="mb-6 h-36 rounded-[18px] border border-linha bg-carvao-2 motion-safe:animate-pulse" />)}
    </div>
  );
}

function diaEmSaoPaulo(agora: number) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(agora);
  const mes = Number(partes.find((parte) => parte.type === 'month')?.value);
  const dia = Number(partes.find((parte) => parte.type === 'day')?.value);
  return { mes, dia };
}

function CartaoAcao({
  href,
  icone: Icone,
  titulo,
  texto,
  discreto = false,
  cereja = false,
}: {
  href: string;
  icone: typeof Gift;
  titulo: string;
  texto?: string;
  discreto?: boolean;
  cereja?: boolean;
}) {
  const caixa = cereja
    ? 'border-cereja bg-cereja text-marfim'
    : discreto
      ? 'border-linha bg-carvao-2'
      : 'border-champagne/30 bg-carvao-2';
  const circulo = cereja ? 'border-marfim/40 text-marfim' : 'border-champagne/40 text-champagne';
  return (
    <Link href={href} className={`flex min-h-16 items-center gap-4 rounded-[18px] border p-5 focus-visible:outline-2 focus-visible:outline-champagne ${caixa}`}>
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${circulo}`}>
        <Icone size={24} strokeWidth={1.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block text-2xl leading-tight">{titulo}</span>
        {texto && <span className={`mt-1 block text-sm ${cereja ? 'text-marfim' : 'text-marfim-2'}`}>{texto}</span>}
      </span>
      <ArrowUpRight size={18} strokeWidth={1.5} className={`shrink-0 ${cereja ? 'text-marfim' : 'text-champagne'}`} />
    </Link>
  );
}

function optimisticAttendance(previous: Attendance, status: AttendanceStatus, me: ReturnType<typeof useMe>): Attendance {
  if (me.participant_id === null) return previous;
  const people = previous.people.filter((person) => person.participant_id !== me.participant_id);
  people.push({ participant_id: me.participant_id, name: me.name, avatar_url: me.avatar_url, status });
  const counts = { ...previous.counts };
  if (previous.mine) counts[previous.mine]--;
  counts[status]++;
  return { mine: status, counts, people };
}

export default function InicioClient({ initial }: { initial: HomeData }) {
  const me = useMe();
  const toast = useToast();
  const [data, setData] = useState<HomeData | null>(initial);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [missoes, setMissoes] = useState<PainelMissoes | null>(null);
  const saving = useRef(false);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setFailed(false);
    try {
      const home = await api<HomeData>('/api/home', { signal });
      if (!signal?.aborted) setData(home);
    } catch (error) {
      if (signal?.aborted) return;
      setFailed(true);
      toast(error instanceof Error ? error.message : 'Não foi possível abrir o início.', 'erro');
    }
  }, [toast]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => {
      clearInterval(timer);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    api<PainelMissoes>('/api/missoes', { signal: ctrl.signal })
      .then((painel) => {
        if (!ctrl.signal.aborted) setMissoes(painel);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  async function respond(status: AttendanceStatus) {
    if (!data || saving.current || data.attendance.mine === status) return;
    saving.current = true;
    setBusy(true);
    const previous = data.attendance;
    setData({ ...data, attendance: optimisticAttendance(previous, status, me) });
    try {
      const attendance = await api<Attendance>('/api/attendance', { method: 'POST', json: { status } });
      setData((current) => current ? { ...current, attendance } : current);
      if (status === 'yes') {
        setCelebrate(true);
        if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
        celebrationTimer.current = setTimeout(() => setCelebrate(false), 2500);
        toast('Seu lugar à mesa está confirmado!');
      } else toast('Sua resposta foi salva.');
    } catch (error) {
      setData((current) => current ? { ...current, attendance: previous } : current);
      toast(error instanceof Error ? error.message : 'Não foi possível salvar sua resposta.', 'erro');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (failed && !data) return (
    <div className="rise flex min-h-[75svh] flex-col items-center justify-center px-8 text-center">
      <Sparkles className="mb-6 text-champagne" size={32} strokeWidth={1.5} />
      <h1 className="display text-4xl">Vamos tentar de novo?</h1>
      <p className="mt-4 text-sm leading-relaxed text-marfim-2">Não conseguimos trazer as novidades da família agora.</p>
      <button className="btn btn-primary mt-7" onClick={() => void load()}>Tentar novamente</button>
    </div>
  );
  if (!data) return <Skeleton />;

  const { settings, attendance, vaquinha, recentPosts, secretSanta } = data;
  const date = new Date(settings.event_date);
  const dateLabel = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const hour = now === null ? null : Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(now));
  const greeting = hour === null ? 'Olá' : hour < 5 ? 'Boa noite' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const remaining = now === null ? null : Math.max(0, date.getTime() - now);
  const minutes = Math.floor((remaining ?? 0) / 60_000);
  const countdown = [Math.floor(minutes / 1440), Math.floor(minutes / 60) % 24, minutes % 60];
  const confirmed = attendance.people.filter((person) => person.status === 'yes');
  const faltaMs = now === null ? null : date.getTime() - now;
  const festaAgora = faltaMs !== null && faltaMs < 6 * 60 * 60 * 1000 && faltaMs >= -12 * 60 * 60 * 1000;
  const adventoHoje = now !== null && (() => {
    const { mes, dia } = diaEmSaoPaulo(now);
    return mes === 12 && dia >= 1 && dia <= 24;
  })();
  const missoesAbertas = missoes?.ativas.filter((missao) => !missao.minha_resposta) ?? [];
  const posts = recentPosts.slice(0, 2);

  return (
    <div className="stagger pb-6">
      <section className="relative flex min-h-[42svh] flex-col justify-end overflow-hidden px-6 pb-8 pt-20">
        <div className="absolute inset-0">
          <LoopMedia name="mn-hero" className="h-full w-full opacity-80" fallback={<Bokeh />} />
          <div className="absolute inset-0 bg-gradient-to-b from-carvao/20 via-carvao/20 to-carvao" />
        </div>
        <Link href="/conta" aria-label="Abrir minha área" className="absolute right-6 top-[calc(env(safe-area-inset-top)+16px)] flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-champagne">
          <Avatar name={me.name} src={me.avatar_url} size={48} ring />
        </Link>
        <div className="stagger relative">
          <p className="kicker mb-3">{dateLabel}</p>
          <h1 className="display text-[clamp(2.8rem,12vw,4rem)]">Natal em<br /><span className="display-italic">Família</span></h1>
          <div className="mb-4 mt-4 h-px w-16 bg-cereja" />
          <p className="text-base text-marfim-2">{greeting}, {me.name.trim().split(/\s+/)[0]}.</p>
          {settings.event_place && <p className="mt-2 flex items-center gap-2 text-sm leading-relaxed text-marfim-2"><MapPin size={16} strokeWidth={1.5} className="shrink-0 text-champagne" />{settings.event_place}</p>}
        </div>
      </section>

      <div className="stagger space-y-8 pt-2">
        <section aria-label="Contagem regressiva para a ceia" className="relative mx-6 overflow-hidden rounded-[18px] border border-linha px-4 py-4">
          <div className="absolute inset-0"><LoopMedia name="mn-countdown" className="h-full w-full opacity-20" fallback={<Bokeh dim />} /><div className="absolute inset-0 bg-carvao/60" /></div>
          <div className="relative">
            <p className="kicker mb-3 text-center">{settings.event_title}</p>
            {remaining === 0 ? <p className="display py-2 text-center text-4xl">Feliz Natal</p> : (
              <div className="grid grid-cols-3 divide-x divide-linha-forte text-center">
                {countdown.map((value, i) => <div key={i}><p className="numeral text-4xl text-marfim">{remaining === null ? '··' : String(value).padStart(2, '0')}</p><p className="mt-1 text-sm text-marfim-2">{['dias', 'horas', 'min'][i]}</p></div>)}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="agora-titulo" className="space-y-4">
          <h2 id="agora-titulo" className="display px-6 text-3xl">Para fazer agora</h2>
          {festaAgora && (
            <div className="px-6">
              <CartaoAcao href="/festa" icone={PartyPopper} titulo="A festa começou!" texto="Entrar" cereja />
            </div>
          )}
          <AtivarNotificacoes modo="banner" />
          <div className="relative space-y-3 px-6">
            {attendance.mine === null ? (
              <section className="relative overflow-hidden rounded-[18px]" aria-labelledby="attendance-title">
                <LoopMedia name="mn-ceia" className="absolute inset-0 h-full w-full opacity-25" fallback={<Bokeh dim />} />
                <div className="pointer-events-none absolute inset-0 bg-carvao/70" aria-hidden />
                <div className="relative p-5">
                  <div className="mb-5 flex items-center gap-3"><Users className="text-champagne" size={20} strokeWidth={1.5} /><h3 id="attendance-title" className="display text-[1.8rem]">Você vai à ceia?</h3></div>
                  <div className="grid grid-cols-3 gap-2" aria-busy={busy}>
                    {(['yes', 'maybe', 'no'] as const).map((status, i) => <button key={status} onClick={() => void respond(status)} disabled={busy} aria-pressed={attendance.mine === status} className={`btn px-2 ${attendance.mine === status ? 'btn-primary' : 'btn-ghost'}`}>{attendance.mine === status && <Check size={16} strokeWidth={1.5} />}{['Vou', 'Talvez', 'Não'][i]}</button>)}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
                    {confirmed.length > 0 && <div className="flex -space-x-2">{confirmed.slice(0, 5).map((person) => <Avatar key={person.participant_id} name={person.name} src={person.avatar_url} size={30} className="ring-2 ring-carvao" />)}</div>}
                    <p className="text-sm leading-relaxed text-marfim-2">{attendance.counts.yes === 0 ? 'A mesa está esperando pela família.' : `${attendance.counts.yes} ${attendance.counts.yes === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}${confirmed.length > 5 ? `, e mais ${confirmed.length - 5} nessa roda` : ''}`}</p>
                  </div>
                </div>
              </section>
            ) : (
              <Link href="/ceia" className="flex min-h-12 items-center text-sm text-marfim-2">
                Você respondeu: {RESPOSTA[attendance.mine]}. <span className="ml-2 font-semibold text-champagne">Mudar</span>
              </Link>
            )}
            {celebrate && <div role="status" className="rise pointer-events-none absolute -top-20 right-6 z-20 h-28 w-36 overflow-hidden rounded-2xl border border-champagne/30 bg-carvao-2"><LoopMedia name="mn-brinde" once className="h-full w-full" fallback={<div className="flex h-full flex-col items-center justify-center gap-2 text-champagne"><Wine size={32} strokeWidth={1.5} /><span className="text-sm">Vamos brindar!</span></div>} /></div>}

            {secretSanta.active && !secretSanta.revealed && (
              <CartaoAcao href="/amigo-oculto" icone={Gift} titulo="Veja quem você tirou no amigo oculto" texto="O nome fica só com você" />
            )}
            {adventoHoje && (
              <CartaoAcao href="/advento" icone={CalendarDays} titulo="Abra a janelinha de hoje do Advento" texto="A surpresa deste dia" />
            )}
            {missoesAbertas.map((missao) => (
              <CartaoAcao key={missao.id} href="/missoes" icone={Flame} titulo={`Missão relâmpago: ${missao.titulo}`} texto={`+${missao.pontos} pontos`} />
            ))}
            {vaquinha.total > 0 && (
              <CartaoAcao
                href="/vaquinha"
                icone={Wallet}
                titulo="Dinheiro da ceia"
                texto={`${brl(vaquinha.saldo)} de saldo. ${vaquinha.pagos} de ${vaquinha.total} já pagaram`}
                discreto
              />
            )}
          </div>
        </section>

        <div className="space-y-8 px-6">
          <CartaoGamificacao />

          <section aria-labelledby="mural-title">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="mural-title" className="display text-3xl">No mural</h2>
              <Link href="/mural" className="flex min-h-12 items-center gap-1 text-sm text-champagne">Ver tudo <ArrowUpRight size={16} strokeWidth={1.5} /></Link>
            </div>
            {posts.length === 0 ? <div className="py-7"><p className="display text-xl text-marfim-2">As primeiras memórias começam aqui.</p><Link href="/mural" className="mt-3 inline-flex min-h-12 items-center gap-2 text-sm text-champagne">Deixe um recado para a família <ArrowUpRight size={16} strokeWidth={1.5} /></Link></div> : <div className="stagger divide-y divide-linha">{posts.map((post) => <Link key={post.id} href="/mural" className="flex items-start gap-3 py-5"><Avatar name={post.user_name} src={post.avatar_url} size={36} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{post.user_name}</p><p className="mt-1 text-sm text-marfim-3">{timeAgo(post.created_at)}</p><p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-marfim-2">{post.content}</p></div>{post.first_image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb(post.first_image, 160)} alt="Foto compartilhada no mural" loading="lazy" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" />
            )}</Link>)}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
