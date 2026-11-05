'use client';

import { useEffect, useState } from 'react';
import Reports from './_components/Reports';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Copy, Gift, KeyRound, PiggyBank, ShieldCheck } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import { api } from '@/app/ui/client';
import { useMe } from '@/app/ui/user';
import { useToast } from '@/app/ui/toast';
import { Empty, Loading, Sheet, type FamilyMember } from '../familia/_components/shared';

type Settings = { event_title: string; event_date: string; event_place: string; contribution_value: number };
type SettingsForm = Omit<Settings, 'contribution_value'> & { contribution_value: number | '' };
function localDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}
export default function OrganizePage() {
  const me = useMe();
  return <main className="mx-auto max-w-xl"><PageHeader kicker="Cuidar de cada detalhe" title="Organizar" back="/" />{me.is_admin ? <Organizer /> : <><Empty title="Um espaço de quem organiza" text="Só os organizadores da família podem alterar o evento e gerenciar acessos." /><Link href="/" className="btn btn-ghost mx-5">Voltar para o início</Link></>}</main>;
}
function Organizer() {
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<FamilyMember | null>(null);
  const [temporary, setTemporary] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Record<number, string>>({});
  const [linkTarget, setLinkTarget] = useState<{ participant: FamilyMember; user: FamilyMember } | null>(null);
  const accesses = members.filter((member) => member.has_login);
  const unlinked = members.filter((member) => !member.has_login && member.participant_id !== null);
  const linkable = accesses.filter((member) => member.can_link);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api<Settings>('/api/settings'), api<FamilyMember[]>('/api/family')]).then(([event, family]) => {
      if (!active) return;
      if (event.status === 'fulfilled') setSettings({ ...event.value, event_date: localDate(event.value.event_date) });
      else toast((event.reason as Error).message, 'erro');
      if (family.status === 'fulfilled') setMembers(family.value);
      else toast((family.reason as Error).message, 'erro');
      setReady(true);
    });
    return () => { active = false; };
  }, [toast, attempt]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    try {
      await api('/api/settings', { method: 'PUT', json: { ...settings, event_date: new Date(`${settings.event_date}:00-03:00`).toISOString(), contribution_value: Number(settings.contribution_value) } });
      toast('Os detalhes da ceia foram salvos.');
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function toggle(member: FamilyMember) {
    setBusy(true);
    try {
      const result = await api<{ id: number; is_admin: boolean }>(`/api/family/${member.id}/admin`, { method: 'PUT', json: { is_admin: !member.is_admin } });
      setMembers((current) => current.map((person) => person.id === result.id ? { ...person, is_admin: result.is_admin } : person));
      toast(result.is_admin ? 'Novo organizador na família.' : 'Acesso de organizador removido.');
      if (member.id === me.id) router.refresh();
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!resetTarget) return;
    setBusy(true);
    try {
      const data = await api<{ password: string }>(`/api/family/${resetTarget.id}/reset-password`, { method: 'POST' });
      setTemporary(data.password);
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function linkAccess() {
    if (!linkTarget) return;
    setBusy(true);
    try {
      await api('/api/family/link', { method: 'POST', json: { user_id: linkTarget.user.id, participant_id: linkTarget.participant.participant_id } });
      setLinkTarget(null);
      setSelectedUsers({});
      toast('Acesso ligado ao participante.');
      setAttempt((value) => value + 1);
      router.refresh();
    } catch (error) { toast((error as Error).message, 'erro'); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(temporary); toast('Senha copiada.'); }
    catch { toast('Não foi possível copiar. Selecione a senha e copie manualmente.', 'erro'); }
  }
  if (!ready) return <Loading />;
  return <div className="px-5 pb-8"><Link href="/admin" className="mb-6 flex min-h-14 items-center gap-3 border-b border-linha py-3"><ShieldCheck size={20} strokeWidth={1.5} className="text-champagne" /><span className="flex-1 text-sm">Painel admin</span><ArrowUpRight size={18} strokeWidth={1.5} className="text-marfim-3" /></Link><Reports /><p className="mb-8 text-sm leading-relaxed text-marfim-3">Os preparativos ficam mais leves quando a família cuida junto.</p>
    <section aria-labelledby="event-heading"><p className="kicker mb-2">01 / A nossa noite</p><h2 id="event-heading" className="display mb-6 text-3xl">Detalhes da ceia</h2>{settings ? <form className="space-y-5" onSubmit={save}><label className="block text-sm text-marfim-2">Título do evento<input className="field mt-2" required maxLength={120} value={settings.event_title} onChange={(event) => setSettings({ ...settings, event_title: event.target.value })} /></label><label className="block text-sm text-marfim-2">Data e hora<input className="field mt-2 max-w-full" type="datetime-local" required value={settings.event_date} onChange={(event) => setSettings({ ...settings, event_date: event.target.value })} /><span className="mt-2 block text-xs text-marfim-3">Horário de Brasília.</span></label><label className="block text-sm text-marfim-2">Onde vamos nos encontrar<input className="field mt-2" maxLength={300} value={settings.event_place} onChange={(event) => setSettings({ ...settings, event_place: event.target.value })} placeholder="Casa, endereço ou ponto de encontro" /></label><label className="block text-sm text-marfim-2">Contribuição por pessoa (R$)<input className="field mt-2" type="number" inputMode="decimal" min="0" step="0.01" required value={settings.contribution_value} onChange={(event) => setSettings({ ...settings, contribution_value: event.target.value === '' ? '' : Number(event.target.value) })} /></label><button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Um instante…' : 'Salvar detalhes'}</button></form> : <><p className="text-sm text-marfim-3">Não foi possível buscar os detalhes do evento.</p><button className="btn btn-ghost mt-4" onClick={() => { setReady(false); setAttempt((value) => value + 1); }}>Tentar novamente</button></>}</section>
    <div className="rule my-9" /><section aria-labelledby="access-heading"><p className="kicker mb-2">02 / Quem cuida junto</p><h2 id="access-heading" className="display text-3xl">Acessos da família</h2><p className="mt-3 text-sm leading-relaxed text-marfim-3">Organizadores podem cuidar do evento e ajudar quem esqueceu a senha.</p>{accesses.length ? <div className="mt-5">{accesses.map((member) => <article key={member.id} className="border-b border-linha py-5"><div className="flex items-center gap-3"><Avatar name={member.name} src={member.avatar_url} size={44} /><div className="min-w-0 flex-1"><h3 className="break-words text-sm">{member.name}</h3><p className="mt-1 break-all text-xs text-marfim-3">@{member.username}</p></div>{member.is_admin && <ShieldCheck size={18} strokeWidth={1.5} className="shrink-0 text-champagne" aria-label="Organizador" />}</div><div className="mt-3 flex flex-wrap gap-x-3"><button className="btn btn-quiet min-h-11 text-xs" aria-pressed={member.is_admin} disabled={busy} onClick={() => toggle(member)}>{member.is_admin ? 'Remover organização' : 'Tornar organizador'}</button><button className="btn btn-quiet min-h-11 text-xs" disabled={busy} onClick={() => { setTemporary(''); setResetTarget(member); }}><KeyRound size={14} strokeWidth={1.5} />Gerar senha</button></div></article>)}</div> : <p className="py-6 text-sm text-marfim-3">Nenhum acesso disponível no momento.</p>}</section>
    <div className="rule my-9" />
    <section aria-labelledby="link-heading">
      <p className="kicker mb-2">03 / Cada pessoa no seu lugar</p>
      <h2 id="link-heading" className="display text-3xl">Ligar acesso a participante</h2>
      <p className="mt-3 text-sm leading-relaxed text-marfim-3">Escolha quem criou acesso para um participante já cadastrado. O histórico do participante escolhido será preservado. Só aparecem parentes cujo participante atual não tem pagamentos, sorteios, desejos nem presença.</p>
      {unlinked.length ? <div className="mt-5">{unlinked.map((participant) => {
        const participantId = participant.participant_id!;
        const selected = linkable.find((user) => String(user.id) === selectedUsers[participantId]);
        return <article key={participantId} className="border-b border-linha py-5">
          <h3 className="display break-words text-2xl">{participant.name}</h3>
          <label className="mt-4 block text-sm text-marfim-2" htmlFor={`link-user-${participantId}`}>Acesso do parente</label>
          <select id={`link-user-${participantId}`} className="field mt-2 min-h-11 w-full" disabled={busy || !linkable.length} value={selectedUsers[participantId] ?? ''} onChange={(event) => setSelectedUsers((current) => ({ ...current, [participantId]: event.target.value }))}>
            <option value="">Escolha um parente</option>
            {linkable.map((user) => <option key={user.id} value={String(user.id)}>{user.name} (@{user.username})</option>)}
          </select>
          <button className="btn btn-ghost mt-3 w-full" disabled={busy || !selected} onClick={() => { if (selected) setLinkTarget({ participant, user: selected }); }}>Ligar acesso</button>
        </article>;
      })}</div> : <p className="py-6 text-sm text-marfim-3">Todos os participantes já têm acesso vinculado.</p>}
      {unlinked.length > 0 && !linkable.length && <p className="mt-4 text-sm text-marfim-3">Nenhum parente pode ser vinculado no momento. O participante atual precisa estar sem histórico.</p>}
    </section>
    <div className="rule my-9" /><section aria-labelledby="prepare-heading"><p className="kicker mb-2">04 / Os preparativos</p><h2 id="prepare-heading" className="display mb-4 text-3xl">Tudo no seu lugar</h2>{[{ href: '/vaquinha', label: 'Vaquinha da ceia', Icon: PiggyBank }, { href: '/amigo-oculto', label: 'Amigo oculto', Icon: Gift }].map(({ href, label, Icon }) => <Link key={href} href={href} className="flex min-h-16 items-center gap-3 border-b border-linha py-4"><Icon size={22} strokeWidth={1.5} className="text-champagne" /><span className="flex-1 text-sm">{label}</span><ArrowUpRight size={18} strokeWidth={1.5} className="text-marfim-3" /></Link>)}</section>
    <div className="rule my-9" /><section><p className="kicker mb-3">Código da família</p><p className="text-sm leading-relaxed text-marfim-3">O código de cadastro é definido na variável <span className="text-marfim-2">FAMILY_CODE</span> do servidor.</p></section>
    {linkTarget && <Sheet title="Confirmar vínculo" busy={busy} onClose={() => setLinkTarget(null)}>
      <p className="mb-6 text-sm leading-relaxed text-marfim-2">Ligar o acesso de {linkTarget.user.name} (@{linkTarget.user.username}) ao participante {linkTarget.participant.name}? O participante vazio criado no cadastro será excluído. O participante escolhido receberá o nome {linkTarget.user.name} e manterá seu histórico.</p>
      <button className="btn btn-primary w-full" disabled={busy} onClick={linkAccess}>{busy ? 'Ligando acesso…' : 'Confirmar vínculo'}</button>
      <button className="btn btn-ghost mt-3 w-full" disabled={busy} onClick={() => setLinkTarget(null)}>Cancelar</button>
    </Sheet>}
    {resetTarget && <Sheet title={temporary ? 'Senha temporária' : 'Gerar nova senha'} busy={busy} onClose={() => { setResetTarget(null); setTemporary(''); }}>{temporary ? <><p className="text-sm leading-relaxed text-marfim-2">Compartilhe com {resetTarget.name} e peça para trocar a senha no perfil. Ela só será exibida desta vez.</p><input aria-label="Senha temporária" readOnly value={temporary} className="field my-6 text-center font-mono text-2xl tracking-[0.2em] text-champagne" onFocus={(event) => event.target.select()} /><button className="btn btn-primary w-full" onClick={copy}><Copy size={18} strokeWidth={1.5} />Copiar senha</button></> : <><p className="mb-6 text-sm leading-relaxed text-marfim-2">A senha atual de {resetTarget.name} deixará de funcionar. A nova senha será mostrada para você compartilhar com essa pessoa.</p><button className="btn btn-primary w-full" disabled={busy} onClick={reset}>{busy ? 'Gerando…' : 'Gerar senha temporária'}</button></>}</Sheet>}
  </div>;
}
