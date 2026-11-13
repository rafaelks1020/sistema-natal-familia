import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacidade · Natal em Família',
  description: 'Como o Natal em Família trata os dados da família.',
};

// Página pública exigida pela App Store e pelo Google Play.

const SECOES: { titulo: string; texto: string[] }[] = [
  {
    titulo: 'Quem somos',
    texto: [
      'O Natal em Família é um espaço privado para uma família organizar o Natal: mural de fotos e recados, amigo oculto, vaquinha da ceia, álbum e confirmação de presença. Só entra quem recebe convite ou o código da família.',
    ],
  },
  {
    titulo: 'O que guardamos',
    texto: [
      'Nome, usuário e senha (a senha é guardada cifrada, ninguém consegue lê-la).',
      'O que você publica: fotos, textos, comentários, curtidas, votos, lista de desejos e presença.',
      'Para pagar a vaquinha pelo Pix, o banco exige CPF e endereço de quem paga. Guardamos esses dados só para gerar os próximos pagamentos.',
      'No aplicativo, um identificador do aparelho para enviar notificações, se você permitir.',
    ],
  },
  {
    titulo: 'Para que usamos',
    texto: [
      'Só para o funcionamento do app dentro da família. Não vendemos, não alugamos e não usamos seus dados para propaganda.',
      'O pagamento é processado pelo C6 Bank, que recebe nome, CPF, endereço e valor para emitir o Pix.',
      'Fotos, vídeos e áudios ficam guardados em armazenamento da Hetzner, na Alemanha; o banco de dados fica em servidor no Brasil.',
    ],
  },
  {
    titulo: 'Quem vê',
    texto: [
      'Tudo o que você publica é visto pelas pessoas da família cadastradas no app.',
      'O nome de quem você tirou no amigo oculto só aparece para você. Nem quem organiza vê os pares.',
      'CPF e endereço não aparecem para ninguém da família.',
    ],
  },
  {
    titulo: 'Seus direitos (LGPD)',
    texto: [
      'Você pode editar seu perfil a qualquer momento e excluir sua conta em Perfil > Excluir minha conta. A exclusão apaga login, publicações, comentários, curtidas, lista de desejos, presença, identificadores de aparelhos e o CPF e endereço guardados. Após excluir a conta, solicitamos a remoção das fotos do perfil e das publicações do armazenamento. Falhas nessa remoção são registradas para correção. O registro de que uma contribuição foi paga continua na vaquinha, com o nome Ex-participante e sem seus dados pessoais.',
      'Para qualquer pedido sobre seus dados, fale com quem organiza o Natal da sua família ou escreva para pagamentos@speedupti.com.br.',
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 pb-16 pt-[calc(env(safe-area-inset-top)+28px)]">
      <p className="kicker mb-3">Natal em Família</p>
      <h1 className="display mb-2 text-[2.6rem]">Privacidade</h1>
      <p className="mb-10 text-sm text-marfim-3">Atualizada em 5 de novembro de 2026.</p>
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
      <Link href="/" className="text-sm text-champagne underline underline-offset-4">
        Voltar para o app
      </Link>
    </main>
  );
}
