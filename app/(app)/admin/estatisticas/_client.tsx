'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/app/ui/PageHeader';
import { api } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { diaCurto, reaisDeCentavos } from '@/app/lib/admin/formato';
import type { Estatisticas } from '@/app/lib/admin/painel-tipos';
import { Loading } from '../../familia/_components/shared';
import { GraficoBarras, GraficoLinhas, Legenda } from './_graficos';

const CEREJA = '#c5292d';
const CHAMPAGNE = '#bfa577';
const SALVIA = '#607568';

function pico(pontos: { dia: string; valor: number }[]): { dia: string; valor: number } | null {
  if (!pontos.some((p) => p.valor > 0)) return null;
  return pontos.reduce((melhor, ponto) => (ponto.valor > melhor.valor ? ponto : melhor));
}

export default function EstatisticasClient() {
  const toast = useToast();
  const [dados, setDados] = useState<Estatisticas | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    api<Estatisticas>('/api/admin/estatisticas')
      .then((r) => { if (ativo) { setDados(r); setFalhou(false); } })
      .catch((e: Error) => { if (ativo) { setFalhou(true); toast(e.message, 'erro'); } });
    return () => { ativo = false; };
  }, [toast, tentativa]);

  const maiorAcesso = dados ? pico(dados.acessos.map((d) => ({ dia: d.dia, valor: d.pessoas }))) : null;
  const maiorPost = dados ? pico(dados.atividade.map((d) => ({ dia: d.dia, valor: d.posts }))) : null;
  const maiorFoto = dados ? pico(dados.atividade.map((d) => ({ dia: d.dia, valor: d.fotos }))) : null;
  const topo = dados?.ranking[0]?.pontos ?? 1;

  return (
    <main className="mx-auto max-w-xl pb-10">
      <PageHeader kicker="Os números da família" title="Gráficos" back="/admin" />
      <div className="space-y-10 px-5">
        {falhou ? (
          <button className="btn btn-ghost w-full" onClick={() => { setFalhou(false); setTentativa((v) => v + 1); }}>Tentar novamente</button>
        ) : !dados ? <Loading /> : (
          <>
            <section aria-labelledby="acessos">
              <h2 id="acessos" className="kicker mb-3">Acessos por dia</h2>
              {dados.contagem_ativa ? (
                <>
                  <GraficoLinhas
                    aria="Pessoas que entraram em cada um dos últimos 30 dias"
                    rotulos={dados.acessos.map((d) => diaCurto(d.dia))}
                    series={[{ nome: 'Pessoas', cor: CHAMPAGNE, valores: dados.acessos.map((d) => d.pessoas) }]}
                  />
                  <p className="mt-3 text-sm text-marfim-2">
                    {dados.ativos_semana} {dados.ativos_semana === 1 ? 'pessoa ativa' : 'pessoas ativas'} nos últimos 7 dias.
                    {maiorAcesso ? ` Dia mais cheio: ${diaCurto(maiorAcesso.dia)}, com ${maiorAcesso.valor}.` : ' Ninguém entrou nesses 30 dias.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-marfim-2">A contagem de acessos começa quando a atualização do banco estiver aplicada.</p>
              )}
            </section>

            <section aria-labelledby="nunca">
              <h2 id="nunca" className="kicker mb-3">Quem nunca entrou</h2>
              {!dados.contagem_ativa ? (
                <p className="text-sm text-marfim-2">Ainda não dá para saber. A contagem não começou.</p>
              ) : dados.nunca_entraram.length === 0 ? (
                <p className="text-sm text-marfim-2">Todo mundo já entrou pelo menos uma vez desde que a contagem começou.</p>
              ) : (
                <ul className="divide-y divide-linha border-y border-linha">
                  {dados.nunca_entraram.map((pessoa) => (
                    <li key={pessoa.id} className="py-3 text-sm">{pessoa.nome}</li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="presenca">
              <h2 id="presenca" className="kicker mb-3">Presença</h2>
              <p className="numeral mb-3 text-4xl">{dados.presenca.pessoas}</p>
              <p className="mb-3 text-sm text-marfim-2">
                {dados.presenca.pessoas === 1 ? 'pessoa confirmada' : 'pessoas confirmadas'}
                {dados.presenca.pessoas ? ` (${dados.presenca.adultos} ${dados.presenca.adultos === 1 ? 'adulto' : 'adultos'} e ${dados.presenca.criancas} ${dados.presenca.criancas === 1 ? 'criança' : 'crianças'})` : ''}.
              </p>
              <GraficoBarras
                aria={`Respostas de presença: ${dados.presenca.vou} vou, ${dados.presenca.talvez} talvez, ${dados.presenca.nao} não`}
                itens={[
                  { rotulo: 'Vou', valor: dados.presenca.vou, cor: SALVIA },
                  { rotulo: 'Talvez', valor: dados.presenca.talvez, cor: CHAMPAGNE },
                  { rotulo: 'Não', valor: dados.presenca.nao, cor: CEREJA },
                ]}
              />
            </section>

            <section aria-labelledby="vaquinha">
              <h2 id="vaquinha" className="kicker mb-3">Vaquinha</h2>
              <GraficoBarras
                aria={`Arrecadado ${reaisDeCentavos(dados.vaquinha.arrecadado_centavos)} e meta ${reaisDeCentavos(dados.vaquinha.meta_centavos)}`}
                itens={[
                  { rotulo: 'Arrecadado', valor: dados.vaquinha.arrecadado_centavos / 100, cor: CHAMPAGNE },
                  { rotulo: 'Meta', valor: dados.vaquinha.meta_centavos / 100, cor: SALVIA },
                ]}
              />
              <p className="mt-3 text-sm text-marfim-2">
                Arrecadado: {reaisDeCentavos(dados.vaquinha.arrecadado_centavos)}.
                {' '}{dados.vaquinha.meta_centavos ? `Meta: ${reaisDeCentavos(dados.vaquinha.meta_centavos)}.` : 'A meta ainda não foi definida.'}
                {' '}{dados.vaquinha.pagaram} de {dados.vaquinha.participantes} já {dados.vaquinha.pagaram === 1 ? 'pagou' : 'pagaram'}.
              </p>
            </section>

            <section aria-labelledby="atividade">
              <h2 id="atividade" className="kicker mb-3">Posts e fotos por dia</h2>
              <GraficoLinhas
                aria="Posts do mural e fotos do álbum nos últimos 30 dias"
                rotulos={dados.atividade.map((d) => diaCurto(d.dia))}
                series={[
                  { nome: 'Posts', cor: CHAMPAGNE, valores: dados.atividade.map((d) => d.posts) },
                  { nome: 'Fotos', cor: SALVIA, valores: dados.atividade.map((d) => d.fotos) },
                ]}
              />
              <Legenda itens={[{ nome: 'Posts no mural', cor: CHAMPAGNE }, { nome: 'Fotos no álbum', cor: SALVIA }]} />
              <p className="mt-3 text-sm text-marfim-2">
                {maiorPost ? `Mais posts em ${diaCurto(maiorPost.dia)} (${maiorPost.valor}).` : 'Nenhum post nesses 30 dias.'}
                {' '}
                {maiorFoto ? `Mais fotos em ${diaCurto(maiorFoto.dia)} (${maiorFoto.valor}).` : 'Nenhuma foto no álbum nesses 30 dias.'}
              </p>
            </section>

            <section aria-labelledby="ranking">
              <h2 id="ranking" className="kicker mb-3">Engajamento</h2>
              <p className="mb-3 text-sm text-marfim-2">Soma de posts, fotos, comentários e curtidas nesta edição.</p>
              {dados.ranking.length === 0 ? <p className="text-sm text-marfim-2">Ninguém publicou nesta edição ainda.</p> : (
                <ol className="space-y-3">
                  {dados.ranking.map((pessoa, i) => (
                    <li key={pessoa.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">{i + 1}. {pessoa.nome}</span>
                        <span className="numeral shrink-0">{pessoa.pontos}</span>
                      </div>
                      <svg viewBox="0 0 100 8" className="mt-1 h-2 w-full" aria-hidden="true">
                        <rect width="100" height="8" rx="4" fill="rgba(243,235,220,0.12)" />
                        <rect width={Math.max(2, (pessoa.pontos / topo) * 100)} height="8" rx="4" fill={CHAMPAGNE} />
                      </svg>
                      <p className="mt-1 text-xs text-marfim-3">
                        {pessoa.posts} posts, {pessoa.fotos} fotos, {pessoa.comentarios} comentários, {pessoa.curtidas} curtidas
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
