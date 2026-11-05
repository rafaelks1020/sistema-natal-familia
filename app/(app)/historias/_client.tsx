'use client';
import BookClient from '../receitas/_components/BookClient';
import type { Entry } from '@/app/api/historias/_data';
export default function Client(props: { items: Entry[]; ano: number; detail?: boolean }) {
  return <BookClient kind="historias" {...props} />;
}
