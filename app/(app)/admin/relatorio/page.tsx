import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/app/lib/session';
import { montarRelatorio } from '@/app/lib/admin/relatorio';
import BotaoImprimir from './_imprimir';
import Folha from './_folha';

export default async function RelatorioPage() {
  const me = await getSessionUser();
  if (!me) redirect('/entrar');
  if (!me.is_admin) redirect('/');
  const dados = await montarRelatorio();
  return (
    <main className="mx-auto max-w-xl pb-8">
      <div className="relatorio-ferramentas space-y-3 px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
        <Link href="/admin" className="inline-flex min-h-11 items-center text-sm text-marfim-2">Voltar ao painel</Link>
        <BotaoImprimir />
        <p className="text-xs text-marfim-3">Papel A4. Na janela de impressão dá para salvar em PDF.</p>
      </div>
      <Folha dados={dados} />
    </main>
  );
}
