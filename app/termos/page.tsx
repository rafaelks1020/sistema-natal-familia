import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Termos de uso · Natal em Família' };
export default function TermosPage() {
  return <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-16 pt-[calc(env(safe-area-inset-top)+28px)]">
    <p className="kicker mb-3">Natal em Família</p><h1 className="display mb-2 text-[2.6rem]">Termos de uso</h1>
    <p className="mb-10 text-sm text-marfim-3">Atualizados em 5 de novembro de 2026.</p>
    <div className="space-y-9">{[["Um espaço da família", "O Natal em Família é um espaço privado da família. O acesso é permitido apenas por convite ou código da família."], ["Respeito em cada publicação", "É proibido publicar conteúdo ofensivo, ilegal ou abusivo, inclusive em fotos, textos e comentários. Ao usar este espaço, você concorda em respeitar todas as pessoas da família."], ["Moderação e denúncias", "Você pode denunciar publicações e comentários e bloquear pessoas. Quem organiza pode remover conteúdo e acessos que violem estes termos. As denúncias são analisadas em até 24 horas."], ["Contato", "Para dúvidas ou pedidos, fale com quem organiza ou escreva para pagamentos@speedupti.com.br."]].map(([titulo, texto]) => <section key={titulo}><h2 className="display mb-3 text-2xl">{titulo}</h2><p className="leading-relaxed text-marfim-2">{texto}</p></section>)}</div>
    <div className="rule my-10" /><Link href="/entrar" className="btn btn-ghost">Voltar</Link>
  </main>;
}
