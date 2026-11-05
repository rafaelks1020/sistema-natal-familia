'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Gift, MapPin, Settings2, Sparkles, Users, Wine } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, brl, timeAgo } from '@/app/ui/client';
import { useMe } from '@/app/ui/user';
import { useToast } from '@/app/ui/toast';
import type { Attendance, AttendanceStatus, HomeData } from './_inicio/types';

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
      <div className="relative -mx-6 mb-8 flex h-[70svh] min-h-96 flex-col justify-end overflow-hidden px-6 pb-12">
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

function optimisticAttendance(previous: Attendance, status: AttendanceStatus, me: ReturnType<typeof useMe>): Attendance {
  if (me.participant_id === null) return previous;
  const people = previous.people.filter((person) => person.participant_id !== me.participant_id);
  people.push({ participant_id: me.participant_id, name: me.name, avatar_url: me.avatar_url, status });
  const counts = { ...previous.counts };
  if (previous.mine) counts[previous.mine]--;
  counts[status]++;
  return { mine: status, counts, people };
}

export default function InicioPage() {
  const me = useMe();
  const toast = useToast();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [now, setNow] = useState<number | null>(null);
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
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => {
      clearInterval(timer);
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
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
  const progress = vaquinha.total ? Math.min(100, Math.max(0, vaquinha.pagos / vaquinha.total * 100)) : 0;

  return (
    <div className="stagger pb-6">
      <section className="relative flex min-h-[70svh] flex-col justify-end overflow-hidden px-6 pb-14 pt-24">
        <div className="absolute inset-0">
          <LoopMedia name="mn-hero" className="h-full w-full opacity-80" fallback={<Bokeh />} />
          <div className="absolute inset-0 bg-gradient-to-b from-carvao/20 via-carvao/20 to-carvao" />
        </div>
        <Link href={`/familia/${me.id}`} aria-label="Abrir meu perfil" className="absolute right-6 top-[calc(env(safe-area-inset-top)+24px)] flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-champagne">
          <Avatar name={me.name} src={me.avatar_url} size={42} ring />
        </Link>
        <div className="stagger relative">
          <p className="kicker mb-6">{dateLabel}</p>
          <h1 className="display text-[clamp(3.8rem,16vw,5.4rem)]">Natal em<br /><span className="display-italic">Família</span></h1>
          <div className="mb-6 mt-7 h-px w-16 bg-cereja" />
          <p className="text-sm text-marfim-2">{greeting}, {me.name.trim().split(/\s+/)[0]}.</p>
          {settings.event_place && <p className="mt-3 flex items-center gap-2 text-xs leading-relaxed text-marfim-2"><MapPin size={14} strokeWidth={1.5} className="shrink-0 text-champagne" />{settings.event_place}</p>}
        </div>
      </section>

      <div className="stagger space-y-10 px-6">
        <section aria-label="Contagem regressiva para a ceia" className="relative overflow-hidden rounded-[18px] border border-linha px-5 py-6">
          <div className="absolute inset-0"><LoopMedia name="mn-countdown" className="h-full w-full opacity-20" fallback={<Bokeh dim />} /><div className="absolute inset-0 bg-carvao/60" /></div>
          <div className="relative">
            <p className="kicker mb-5 text-center">{settings.event_title}</p>
            {remaining === 0 ? <p className="display py-3 text-center text-5xl">Feliz Natal</p> : (
              <div className="grid grid-cols-3 divide-x divide-linha-forte text-center">
                {countdown.map((value, i) => <div key={i}><p className="numeral text-5xl text-marfim">{remaining === null ? '··' : String(value).padStart(2, '0')}</p><p className="mt-2 text-xs text-marfim-2">{['dias', 'horas', 'min'][i]}</p></div>)}
              </div>
            )}
          </div>
        </section>

        <div className="relative">
          <section className="relative overflow-hidden rounded-[18px]" aria-labelledby="attendance-title">
            <LoopMedia name="mn-ceia" className="absolute inset-0 h-full w-full opacity-25" fallback={<Bokeh dim />} />
            <div className="pointer-events-none absolute inset-0 bg-carvao/70" aria-hidden />
            <div className="relative">
              <div className="mb-5 flex items-center gap-3"><Users className="text-champagne" size={20} strokeWidth={1.5} /><h2 id="attendance-title" className="display text-[1.8rem]">Você vai à ceia?</h2></div>
              <div className="grid grid-cols-3 gap-2" aria-busy={busy}>
                {(['yes', 'maybe', 'no'] as const).map((status, i) => <button key={status} onClick={() => void respond(status)} disabled={busy} aria-pressed={attendance.mine === status} className={`btn px-2 ${attendance.mine === status ? 'btn-primary' : 'btn-ghost'}`}>{attendance.mine === status && <Check size={16} strokeWidth={1.5} />}{['Vou', 'Talvez', 'Não'][i]}</button>)}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
                {confirmed.length > 0 && <div className="flex -space-x-2">{confirmed.slice(0, 5).map((person) => <Avatar key={person.participant_id} name={person.name} src={person.avatar_url} size={30} className="ring-2 ring-carvao" />)}</div>}
                <p className="text-xs leading-relaxed text-marfim-2">{attendance.counts.yes === 0 ? 'A mesa está esperando pela família.' : `${attendance.counts.yes} ${attendance.counts.yes === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}${confirmed.length > 5 ? `, e mais ${confirmed.length - 5} nessa roda` : ''}`}</p>
              </div>
            </div>
          </section>
          {celebrate && <div role="status" className="rise pointer-events-none absolute -top-20 right-0 z-20 h-28 w-36 overflow-hidden rounded-2xl border border-champagne/30 bg-carvao-2"><LoopMedia name="mn-brinde" once className="h-full w-full" fallback={<div className="flex h-full flex-col items-center justify-center gap-2 text-champagne"><Wine size={32} strokeWidth={1.5} /><span className="text-xs">Vamos brindar!</span></div>} /></div>}
        </div>

        <div className="rule" />
        <Link href="/vaquinha" className="block rounded-lg focus-visible:outline-2 focus-visible:outline-champagne">
          <div className="mb-5 flex items-center justify-between"><div><p className="kicker mb-2">Cada um faz parte</p><h2 className="display text-3xl">Vaquinha da ceia</h2></div><ArrowUpRight size={21} strokeWidth={1.5} className="text-champagne" /></div>
          <dl className="grid grid-cols-3 gap-2">
            {([['Arrecadado', vaquinha.arrecadado], ['Gasto', vaquinha.gasto], ['Saldo', vaquinha.saldo]] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="mb-2 text-xs text-marfim-2">{label}</dt><dd className={`numeral break-words text-[clamp(1.1rem,4.5vw,1.5rem)] ${label === 'Saldo' && value < 0 ? 'text-cereja' : 'text-marfim'}`}>{brl(value)}</dd></div>)}
          </dl>
          <div role="progressbar" aria-label="Participantes com contribuição paga" aria-valuemin={0} aria-valuemax={vaquinha.total || 1} aria-valuenow={vaquinha.pagos} className="mt-5 h-1 overflow-hidden rounded-full bg-cereja/45"><div className="h-full rounded-full bg-salvia transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
          <p className="mt-3 text-xs text-marfim-3">{vaquinha.pagos} de {vaquinha.total} contribuições recebidas</p>
        </Link>

        {secretSanta.active && !secretSanta.revealed && <Link href="/amigo-oculto" className="group relative flex items-center gap-4 overflow-hidden rounded-[18px] border border-champagne/25 bg-carvao-2 p-6"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-champagne/60 text-champagne"><Gift size={25} strokeWidth={1.5} /></span><div><p className="kicker mb-2">Um segredo da família</p><h2 className="display text-2xl leading-tight">Seu amigo oculto está esperando</h2><p className="mt-3 flex items-center gap-2 text-xs text-champagne">Descobrir quem é <ArrowUpRight size={15} strokeWidth={1.5} /></p></div></Link>}

        <section aria-labelledby="mural-title">
          <div className="mb-2 flex items-center justify-between"><h2 id="mural-title" className="display text-3xl">No mural</h2><Link href="/mural" className="flex min-h-11 items-center gap-1 text-xs text-champagne">Ver tudo <ArrowUpRight size={16} strokeWidth={1.5} /></Link></div>
          {recentPosts.length === 0 ? <div className="py-7"><p className="display text-xl text-marfim-2">As primeiras memórias começam aqui.</p><Link href="/mural" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-champagne">Deixe um recado para a família <ArrowUpRight size={16} strokeWidth={1.5} /></Link></div> : <div className="stagger divide-y divide-linha">{recentPosts.map((post) => <Link key={post.id} href="/mural" className="flex items-start gap-3 py-5"><Avatar name={post.user_name} src={post.avatar_url} size={36} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{post.user_name}</p><p className="mt-1 text-xs text-marfim-3">{timeAgo(post.created_at)}</p><p className="mt-3 line-clamp-3 whitespace-pre-line break-words text-sm leading-relaxed text-marfim-2">{post.content}</p></div>{post.first_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.first_image} alt="Foto compartilhada no mural" loading="lazy" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" />
          )}</Link>)}</div>}
        </section>
        {me.is_admin && <div className="border-t border-linha pt-4"><Link href="/organizar" className="flex min-h-11 items-center justify-center gap-2 text-xs text-marfim-3"><Settings2 size={15} strokeWidth={1.5} />Organizar o Natal</Link></div>}
      </div>
    </div>
  );
}
