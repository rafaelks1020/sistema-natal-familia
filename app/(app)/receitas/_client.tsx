'use client';
import BookClient from './_components/BookClient';
import type { Entry } from '@/app/api/receitas/_data';
export default function Client(props: { items: Entry[]; ano: number; detail?: boolean }) {
  return <BookClient kind="receitas" {...props} />;
}
