import { reaisDeCentavos } from '@/app/lib/admin/formato';
import type { PessoaRelatorio, RelatorioCeia } from '@/app/lib/admin/painel-tipos';

function contagem(pessoa: PessoaRelatorio): string {
  const partes: string[] = [];
  if (pessoa.adultos) partes.push(`${pessoa.adultos} ${pessoa.adultos === 1 ? 'adulto' : 'adultos'}`);
  if (pessoa.criancas) partes.push(`${pessoa.criancas} ${pessoa.criancas === 1 ? 'criança' : 'crianças'}`);
  return partes.join(', ');
}

function ListaPresenca({ titulo, pessoas, comContagem }: { titulo: string; pessoas: PessoaRelatorio[]; comContagem: boolean }) {
  return (
    <div className="relatorio-bloco mt-4">
      <h3 className="text-sm font-semibold">{titulo} ({pessoas.length})</h3>
      {pessoas.length === 0 ? <p className="mt-1 text-sm text-marfim-2">Ninguém nesta lista.</p> : (
        <ul className="mt-1 divide-y divide-linha border-y border-linha">
          {pessoas.map((pessoa, i) => (
            <li key={`${pessoa.nome}-${i}`} className="py-2 text-sm">
              <p>{pessoa.nome}{comContagem && contagem(pessoa) ? ` · ${contagem(pessoa)}` : ''}</p>
              {pessoa.restricao ? <p className="text-marfim-2">Restrição: {pessoa.restricao}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function saldoTexto(centavos: number): string {
  if (centavos > 0) return `Recebe ${reaisDeCentavos(centavos)}`;
  if (centavos < 0) return `Paga ${reaisDeCentavos(Math.abs(centavos))}`;
  return 'Em dia';
}

export default function Folha({ dados }: { dados: RelatorioCeia }) {
  const restricoes = [...dados.presenca.vou, ...dados.presenca.talvez].filter((p) => p.restricao);
  return (
    <article className="relatorio-folha px-5 pb-10 pt-6">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          html, body { background: #fff !important; color: #171b18 !important; color-scheme: light !important; }
          body::after { display: none !important; }
          body nav, .relatorio-ferramentas { display: none !important; }
          body main { max-width: none !important; width: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
          .relatorio-folha { padding: 0 !important; background: #fff !important; }
          .relatorio-folha, .relatorio-folha * { color: #171b18 !important; background: transparent !important; border-color: #ccc !important; box-shadow: none !important; }
          .relatorio-bloco { break-inside: avoid; }
        }
      `}</style>
      <p className="kicker mb-2">Edição {dados.ano}</p>
      <h1 className="display text-[2rem]">{dados.evento.titulo}</h1>
      <p className="mt-3 text-sm text-marfim-2">Relatório da ceia, gerado em {dados.gerado_em}.</p>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Quando e onde</h2>
        <p className="text-sm">{dados.evento.data}{dados.evento.hora ? `, ${dados.evento.hora}` : ''}</p>
        <p className="mt-1 text-sm text-marfim-2">{dados.evento.local || 'Local ainda não definido.'}</p>
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Presença</h2>
        <p className="text-sm">
          {dados.presenca.pessoas} {dados.presenca.pessoas === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}
          {dados.presenca.pessoas ? `: ${dados.presenca.adultos} ${dados.presenca.adultos === 1 ? 'adulto' : 'adultos'} e ${dados.presenca.criancas} ${dados.presenca.criancas === 1 ? 'criança' : 'crianças'}` : ''}.
        </p>
        <ListaPresenca titulo="Vou" pessoas={dados.presenca.vou} comContagem />
        <ListaPresenca titulo="Talvez" pessoas={dados.presenca.talvez} comContagem />
        <ListaPresenca titulo="Não vou" pessoas={dados.presenca.nao} comContagem />
        <div className="relatorio-bloco mt-4">
          <h3 className="text-sm font-semibold">Restrições alimentares</h3>
          {restricoes.length === 0 ? <p className="mt-1 text-sm text-marfim-2">Nenhuma restrição informada.</p> : (
            <ul className="mt-1 text-sm">
              {restricoes.map((pessoa, i) => <li key={`${pessoa.nome}-${i}`}>{pessoa.nome}: {pessoa.restricao}</li>)}
            </ul>
          )}
        </div>
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Quem leva o quê</h2>
        {dados.pratos.length === 0 ? <p className="text-sm text-marfim-2">Ninguém se ofereceu para levar nada ainda.</p> : dados.pratos.map((grupo) => (
          <div key={grupo.categoria} className="relatorio-bloco mt-4">
            <h3 className="text-sm font-semibold">{grupo.rotulo}</h3>
            <ul className="mt-1 divide-y divide-linha border-y border-linha">
              {grupo.itens.map((item, i) => (
                <li key={`${item.nome}-${item.quem}-${i}`} className="py-2 text-sm">
                  <p>{item.nome}{item.quantidade ? ` (${item.quantidade})` : ''}</p>
                  <p className="text-marfim-2">{item.quem}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Caronas e hospedagem</h2>
        {dados.deslocamento.length === 0 ? <p className="text-sm text-marfim-2">Nenhuma oferta ou pedido ativo.</p> : dados.deslocamento.map((grupo) => (
          <div key={grupo.tipo} className="relatorio-bloco mt-4">
            <h3 className="text-sm font-semibold">{grupo.rotulo}</h3>
            <ul className="mt-1 space-y-3">
              {grupo.itens.map((item, i) => (
                <li key={`${item.quem}-${i}`} className="border-y border-linha py-2 text-sm">
                  <p>{item.quem}</p>
                  <p className="text-marfim-2">{item.origem} · {item.quando} · {item.vagas} {item.vagas === 1 ? 'vaga' : 'vagas'}</p>
                  {item.observacao ? <p className="text-marfim-2">{item.observacao}</p> : null}
                  {item.telefone ? <p className="text-marfim-2">Telefone: {item.telefone}</p> : null}
                  {item.reservas.length ? (
                    <p className="text-marfim-2">Reservas: {item.reservas.map((r) => `${r.nome} (${r.quantidade})`).join(', ')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Contas da ceia</h2>
        <p className="text-sm">Despesas lançadas: {reaisDeCentavos(dados.contas.total_centavos)}.</p>
        {dados.contas.saldos.length === 0 ? <p className="mt-2 text-sm text-marfim-2">Ninguém está devendo nem recebendo.</p> : (
          <ul className="mt-2 divide-y divide-linha border-y border-linha">
            {dados.contas.saldos.map((pessoa, i) => (
              <li key={`${pessoa.nome}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{pessoa.nome}</span>
                <span>{saldoTexto(pessoa.saldo_centavos)}</span>
              </li>
            ))}
          </ul>
        )}
        {dados.contas.acertos.length ? (
          <div className="relatorio-bloco mt-4">
            <h3 className="text-sm font-semibold">Quem acerta com quem</h3>
            <ul className="mt-1 text-sm">
              {dados.contas.acertos.map((acerto, i) => (
                <li key={`${acerto.de}-${acerto.para}-${i}`}>{acerto.de} paga {reaisDeCentavos(acerto.valor_centavos)} para {acerto.para}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Vaquinha</h2>
        <p className="text-sm">Arrecadado: {reaisDeCentavos(dados.vaquinha.arrecadado_centavos)}</p>
        <p className="text-sm">Gasto: {reaisDeCentavos(dados.vaquinha.gasto_centavos)}</p>
        <p className="text-sm">Saldo: {reaisDeCentavos(dados.vaquinha.saldo_centavos)}</p>
      </section>

      <section className="relatorio-bloco mt-8">
        <h2 className="kicker mb-3">Amigo oculto</h2>
        <p className="text-sm">Tema: {dados.amigo.tema}</p>
        <p className="text-sm">{dados.amigo.participantes} {dados.amigo.participantes === 1 ? 'pessoa participa' : 'pessoas participam'}.</p>
      </section>
    </article>
  );
}
