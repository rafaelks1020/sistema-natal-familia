'use client';

import { useEffect, useRef } from 'react';
import { X, UsersRound } from 'lucide-react';

export interface FamilyMember {
  id: number | null;
  name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  participant_id: number | null;
  attendance: 'yes' | 'maybe' | 'no' | null;
  has_login: boolean;
  posts_count: number;
}
export interface Wish {
  id: number;
  item_name: string;
  item_description: string | null;
  item_url: string | null;
  purchased?: boolean;
}
export interface Profile {
  id: number;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  is_admin: boolean;
  participant_id: number | null;
  posts_count: number;
  reactions_received: number;
  comments_count: number;
  wishlist: Wish[];
}
export function Loading() {
  return <div role="status" aria-label="Preparando a página" className="space-y-5 px-5 py-8 motion-safe:animate-pulse">{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-4"><div className="h-14 w-14 rounded-full bg-carvao-3" /><div className="flex-1 space-y-3"><div className="h-3 w-2/3 rounded bg-carvao-3" /><div className="h-2 w-1/3 rounded bg-carvao-3" /></div></div>)}</div>;
}
export function Empty({ title, text }: { title: string; text: string }) {
  return <div className="fade-in px-6 py-14 text-center"><UsersRound className="mx-auto mb-5 text-champagne" size={30} strokeWidth={1.5} /><h2 className="display text-2xl">{title}</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-marfim-3">{text}</p></div>;
}
export function Sheet({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} aria-labelledby="sheet-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-[18px] border border-linha bg-carvao-2 p-0 text-marfim backdrop:bg-carvao/80"><div className="mx-auto max-w-lg px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-5"><div className="mx-auto mb-5 h-1 w-9 rounded-full bg-linha-forte" /><div className="mb-6 flex items-center justify-between gap-4"><h2 id="sheet-title" className="display text-3xl">{title}</h2><button type="button" aria-label="Fechar" disabled={busy} onClick={onClose} className="flex h-11 w-11 items-center justify-center text-marfim-2"><X size={22} strokeWidth={1.5} /></button></div>{children}</div></dialog>;
}
