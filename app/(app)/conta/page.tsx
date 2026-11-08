import Link from 'next/link';
import AtivarNotificacoes from '@/app/components/AtivarNotificacoes';
import PageHeader from '@/app/ui/PageHeader';

export default function ContaPage() {
  return (
    <>
      <PageHeader kicker="Sua conta" title="Conta" back="/familia" />
      <section className="rise space-y-6 px-5 pb-8">
        <AtivarNotificacoes modo="fixo" />
        <Link href="/conta/excluir" className="text-xs text-marfim-3 underline underline-offset-4">Excluir minha conta</Link>
      </section>
    </>
  );
}
