import Link from 'next/link';

export default function NaoEncontrada() {
  return (
    <main className="rise mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center bg-carvao px-8 text-center">
      <p className="kicker">Página não encontrada</p>
      <h1 className="display mt-3 text-3xl text-marfim">Esse caminho não existe</h1>
      <p className="mt-3 max-w-xs text-sm text-marfim-2">
        O endereço pode ter mudado ou o link está incompleto. Volte ao início para continuar.
      </p>
      <Link href="/" className="btn btn-primary mt-7 min-h-11">
        Voltar ao início
      </Link>
    </main>
  );
}
