import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Segurança infantil · Natal em Família',
  description: 'Padrões contra abuso e exploração sexual infantil do Natal em Família.',
};

// Página pública exigida pelo Google Play (Padrões de segurança infantil, apps da categoria Social).

const SECOES: { titulo: string; texto: string[] }[] = [
  {
    titulo: 'Tolerância zero',
    texto: [
      'O Natal em Família proíbe qualquer conteúdo ou comportamento de abuso e exploração sexual infantil (CSAE), incluindo material de abuso sexual infantil (CSAM), aliciamento, sexualização de menores ou qualquer contato com essa finalidade.',
      'O app é um espaço privado de uma família: só entra quem recebe convite do organizador ou o código da família. Não há busca de pessoas desconhecidas nem conversa com estranhos.',
    ],
  },
  {
    titulo: 'Como agimos',
    texto: [
      'Qualquer pessoa pode denunciar um post ou comentário pelo menu do próprio conteúdo e bloquear quem publicou.',
      'Denúncias são analisadas em até 24 horas. Conteúdo que viole estes padrões é removido imediatamente, o acesso de quem publicou é excluído e o caso é comunicado às autoridades competentes, como a SaferNet Brasil e a Polícia Federal, conforme a legislação brasileira (Estatuto da Criança e do Adolescente).',
      'Cooperamos com as autoridades e preservamos as informações necessárias para investigação quando exigido por lei.',
    ],
  },
  {
    titulo: 'Contato de segurança',
    texto: [
      'Para denunciar ou tratar de qualquer assunto de segurança infantil: pagamentos@speedupti.com.br. Responsável: Rafael Cardozo Feitosa.',
      'Em caso de risco imediato a uma criança, ligue 190 ou denuncie pelo Disque 100.',
    ],
  },
];

export default function SegurancaInfantilPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-16 pt-[calc(env(safe-area-inset-top)+28px)]">
      <p className="kicker mb-3">Natal em Família</p>
      <h1 className="display mb-2 text-[2.4rem]">Segurança infantil</h1>
      <p className="mb-10 text-sm text-marfim-3">Padrões publicados em 5 de novembro de 2026.</p>
      <div className="space-y-9">
        {SECOES.map((s) => (
          <section key={s.titulo}>
            <h2 className="display mb-3 text-2xl">{s.titulo}</h2>
            <div className="space-y-3 leading-relaxed text-marfim-2">
              {s.texto.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="rule my-10" />
      <div className="flex gap-6 text-sm">
        <Link href="/termos" className="text-champagne underline underline-offset-4">Termos de uso</Link>
        <Link href="/privacidade" className="text-champagne underline underline-offset-4">Privacidade</Link>
      </div>
    </main>
  );
}
