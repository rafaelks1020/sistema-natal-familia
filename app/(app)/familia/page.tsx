'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Camera, ChevronRight, Flame, Hourglass, Images, Mail, MessageSquare, Mic, Music, TreePine } from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import Atalhos from '@/app/ui/Atalhos';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Empty, Loading, type FamilyMember } from './_components/shared';

const attendance = { yes: ['Vou', 'text-salvia'], maybe: ['Talvez', 'text-champagne'], no: ['Não', 'text-marfim-3'] };
const ATALHOS = [
  { href: '/mural', titulo: 'Mural', texto: 'Recados e fotos do dia a dia', icon: MessageSquare },
  { href: '/album', titulo: 'Álbum de fotos', texto: 'As fotos de todos os Natais', icon: Camera },
  { href: '/memorias', titulo: 'Memórias', texto: 'Linha do tempo e retrospectiva', icon: Images },
  { href: '/receitas', titulo: 'Receitas da família', texto: 'A receita da vó, com o segredo', icon: BookOpen },
  { href: '/historias', titulo: 'Histórias contadas', texto: 'Como era o Natal antigamente, em áudio', icon: Mic },
  { href: '/arvore', titulo: 'Árvore da família', texto: 'Quem é filho de quem, de geração em geração', icon: TreePine },
  { href: '/homenagem', titulo: 'Homenagem', texto: 'Lembrança de quem partiu', icon: Flame },
  { href: '/capsula', titulo: 'Cápsula do tempo', texto: 'Uma mensagem que só abre no próximo Natal', icon: Hourglass },
  { href: '/playlist', titulo: 'Playlist da família', texto: 'As músicas da noite no Spotify', icon: Music },
  { href: '/cartao', titulo: 'Cartão de Natal', texto: 'Sua foto num cartão para mandar no WhatsApp', icon: Mail },
];
export default function FamilyPage() {
  const toast = useToast();
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<FamilyMember[]>('/api/family').then((data) => { if (active) setMembers(data); }).catch((error: Error) => {
      if (active) { toast(error.message, 'erro'); setFailed(true); setMembers([]); }
    });
    return () => { active = false; };
  }, [toast, attempt]);
  return <main className="mx-auto max-w-xl"><PageHeader title="A família" action={members && <span className="numeral text-3xl text-champagne">{members.length}</span>} />
    <div className="px-5 pb-10"><Atalhos itens={ATALHOS} /></div>
    <h2 className="display px-5 text-3xl">Quem faz o nosso Natal</h2>
    <p className="px-5 pb-6 pt-2 text-sm text-marfim-3">Cada história tem um lugar à mesa.</p><div className="rule mx-5" />
    {!members ? <Loading /> : members.length ? <div className="stagger px-5">{members.map((member) => {
      const status = member.attendance ? attendance[member.attendance] : null;
      const content = <><Avatar name={member.name} src={member.avatar_url} size={58} ring={member.has_login} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="display text-2xl">{member.name}</h2>{member.is_admin && <span className="rounded-full border border-champagne/40 px-2 py-0.5 text-[10px] tracking-wider text-champagne">organiza</span>}</div>{member.bio && <p className="mt-1 truncate text-xs text-marfim-3">{member.bio}</p>}<div className="mt-2 flex flex-wrap gap-x-3 text-xs">{!member.has_login ? <span className="text-marfim-3">ainda sem acesso</span> : <span className="text-marfim-3">{member.posts_count} {member.posts_count === 1 ? 'post' : 'posts'}</span>}{status && <span className={status[1]}>{status[0]}</span>}</div></div>{member.has_login && <ChevronRight className="shrink-0 text-marfim-3" size={18} strokeWidth={1.5} />}</>;
      return member.id !== null ? <Link key={`u${member.id}`} href={`/familia/${member.id}`} className="flex min-h-24 items-center gap-4 border-b border-linha py-5">{content}</Link> : <div key={`p${member.participant_id}`} className="flex min-h-24 items-center gap-4 border-b border-linha py-5 opacity-50">{content}</div>;
    })}</div> : <><Empty title={failed ? 'Não foi possível reunir a família' : 'A mesa está sendo preparada'} text={failed ? 'Tente novamente para ver os perfis.' : 'Os parentes aparecerão aqui quando forem adicionados.'} />{failed && <button className="btn btn-ghost mx-auto" onClick={() => { setFailed(false); setMembers(null); setAttempt((n) => n + 1); }}>Tentar novamente</button>}</>}
  </main>;
}
