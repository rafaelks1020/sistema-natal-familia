import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { carregarQuiz } from '@/app/api/festa/quiz/_data';
import QuizClient from './_client';

export default async function FestaQuizPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  const initial = await carregarQuiz(me);
  return <QuizClient initial={initial} />;
}
