"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Lock, Sparkles, Trophy, Users } from "lucide-react";
import PageHeader from "@/app/ui/PageHeader";
import Avatar from "@/app/ui/Avatar";
import { api } from "@/app/ui/client";
import { useToast } from "@/app/ui/toast";
import { Loading } from "../familia/_components/shared";
import ToastConquista, {
  IconeConquista,
} from "@/app/components/ToastConquista";
import type {
  CategoriaConquista,
  ConquistaVista,
  NivelConquista,
  PainelPontos,
  PerfilPontos,
} from "@/app/lib/gamificacao/tipos";
import {
  ESTILO_NIVEL,
  ORDEM_CATEGORIAS,
  ROTULOS_CATEGORIA,
  ROTULOS_NIVEL,
  agruparConquistasPorCategoria,
  formatarDataHoraSP,
  progressoConquistaPct,
  textoExibicaoConquista,
  textoPontos,
} from "../pontos/_logica";

const NIVEIS_ORDEM: NivelConquista[] = ["bronze", "prata", "ouro", "lendaria"];

const TOTAL_FALTA_POUCO = 5;

function textoValePontos(pontos: number): string {
  return pontos > 0 ? `Vale ${textoPontos(pontos)}` : "Lembrança, sem pontos";
}

/** Não ganhas e não secretas: as de maior progresso, completando com as de menor meta. */
function escolherFaltaPouco(conquistas: ConquistaVista[]): ConquistaVista[] {
  const candidatas = conquistas.filter((c) => !c.ganha_em && !c.secreta);
  const comProgresso = candidatas
    .filter((c) => c.progresso && c.progresso.meta > 0 && c.progresso.atual > 0)
    .sort(
      (a, b) =>
        b.progresso!.atual / b.progresso!.meta -
        a.progresso!.atual / a.progresso!.meta,
    )
    .slice(0, TOTAL_FALTA_POUCO);
  if (comProgresso.length >= TOTAL_FALTA_POUCO) return comProgresso;
  const usadas = new Set(comProgresso.map((c) => c.id));
  const completar = candidatas
    .filter((c) => !usadas.has(c.id))
    .sort(
      (a, b) =>
        (a.progresso?.meta ?? Number.POSITIVE_INFINITY) -
        (b.progresso?.meta ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, TOTAL_FALTA_POUCO - comProgresso.length);
  return [...comProgresso, ...completar];
}

function tempoGanha(c: ConquistaVista): number {
  const t = c.ganha_em ? new Date(c.ganha_em).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

function ItemConquista({ conquista: c }: { conquista: ConquistaVista }) {
  const conquistada = Boolean(c.ganha_em);
  const { nome, descricao, oculta } = textoExibicaoConquista(c);
  const estilo = ESTILO_NIVEL[c.nivel] ?? ESTILO_NIVEL.bronze;
  const pct = progressoConquistaPct(c);
  const faltam = c.progresso
    ? Math.max(0, c.progresso.meta - c.progresso.atual)
    : null;

  return (
    <li
      className={`surface flex gap-3 border p-4 ${
        conquistada
          ? `${estilo.borda} bg-carvao-2`
          : "border-linha bg-carvao-2/60"
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
          conquistada
            ? estilo.iconeFundo
            : "border-linha bg-carvao-3/80 text-marfim-2"
        }`}
        aria-hidden
      >
        <IconeConquista nome={c.icone} size={24} oculta={oculta} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="break-words font-medium leading-snug text-marfim">
            {nome}
          </h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${estilo.selo}`}
          >
            {ROTULOS_NIVEL[c.nivel]}
          </span>
        </div>
        <p className="mt-1 break-words text-sm leading-relaxed text-marfim-2">
          {descricao}
        </p>

        {!conquistada && c.progresso && pct !== null && (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium text-marfim">
              Faltam <span className="numeral">{faltam}</span>
            </p>
            <div
              role="progressbar"
              aria-label={`Progresso em ${nome}`}
              aria-valuemin={0}
              aria-valuemax={c.progresso.meta}
              aria-valuenow={Math.min(c.progresso.meta, c.progresso.atual)}
              className="h-2 overflow-hidden rounded-full bg-carvao-3"
            >
              <div
                className="h-full rounded-full bg-cereja transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="numeral mt-1 text-xs text-marfim-2">
              {c.progresso.atual} de {c.progresso.meta}
            </p>
          </div>
        )}

        <p
          className={`mt-2 text-sm ${conquistada ? "font-medium text-champagne" : "text-marfim-2"}`}
        >
          {textoValePontos(c.pontos)}
        </p>
        {c.ganha_em && (
          <p className="mt-0.5 text-xs text-champagne">
            Conquistada em {formatarDataHoraSP(c.ganha_em)}
          </p>
        )}
      </div>
    </li>
  );
}

function CartaoConquista({ conquista: c }: { conquista: ConquistaVista }) {
  const conquistada = Boolean(c.ganha_em);
  const { nome, descricao, oculta } = textoExibicaoConquista(c);
  const estilo = ESTILO_NIVEL[c.nivel] ?? ESTILO_NIVEL.bronze;
  const pct = progressoConquistaPct(c);

  return (
    <article
      className={`surface relative flex flex-col justify-between p-4 transition ${
        conquistada
          ? `border ${estilo.borda} bg-carvao-2`
          : "border border-linha bg-carvao-2/60"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2.5">
          {/* Ícone Lucide ou silhueta quando bloqueada */}
          <div className="relative">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                conquistada
                  ? estilo.iconeFundo
                  : "border-linha bg-carvao-3/80 text-marfim-3/40 brightness-50 contrast-125 grayscale"
              }`}
              aria-hidden
            >
              <IconeConquista
                nome={c.icone}
                size={24}
                oculta={oculta}
                className={conquistada ? "" : "opacity-45"}
              />
            </span>
            {conquistada ? (
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-champagne text-carvao"
                aria-label="Conquistada"
              >
                <Check size={12} strokeWidth={2.5} aria-hidden />
              </span>
            ) : (
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-linha bg-carvao-3 text-marfim-3"
                aria-label="Ainda não ganha"
              >
                <Lock size={11} strokeWidth={2} aria-hidden />
              </span>
            )}
          </div>

          {/* Nível e pontos */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {c.secreta && (
              <span className="rounded-full border border-champagne/40 bg-carvao-3 px-2 py-0.5 text-xs uppercase tracking-wider text-champagne">
                Secreta
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${estilo.selo}`}
            >
              {ROTULOS_NIVEL[c.nivel]}
            </span>
          </div>
        </div>

        <h3
          className={`mt-3 break-words font-medium leading-snug ${
            conquistada ? "text-marfim" : "text-marfim-2/80"
          }`}
        >
          {nome}
        </h3>
        <p className="mt-1 break-words text-xs leading-relaxed text-marfim-2">
          {oculta && descricao === "???"
            ? "??? · Conquista secreta: descubra participando do Natal"
            : descricao}
        </p>
      </div>

      <div className="mt-4 space-y-2.5 border-t border-linha pt-3">
        {/* Barra de progresso individual quando contável */}
        {c.progresso && pct !== null && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-marfim-2">
              <span>Progresso</span>
              <span className="numeral">
                {c.progresso.atual} de {c.progresso.meta}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`Progresso em ${nome}`}
              aria-valuemin={0}
              aria-valuemax={c.progresso.meta}
              aria-valuenow={Math.min(c.progresso.meta, c.progresso.atual)}
              className="h-1.5 overflow-hidden rounded-full bg-carvao-3"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  conquistada ? "bg-champagne" : "bg-cereja"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={
              conquistada ? "font-medium text-champagne" : "text-marfim-2"
            }
          >
            {textoValePontos(c.pontos)}
          </span>
          <span className="inline-flex items-center gap-1 text-marfim-2">
            <Users size={12} strokeWidth={1.6} aria-hidden />
            {c.quantos_ganharam === 0
              ? "Ninguém ganhou ainda"
              : c.quantos_ganharam === 1
                ? "1 pessoa da família ganhou"
                : `${c.quantos_ganharam} da família ganharam`}
          </span>
        </div>

        {c.ganha_em && (
          <p className="text-xs text-champagne">
            Conquistada em {formatarDataHoraSP(c.ganha_em)}
          </p>
        )}
      </div>
    </article>
  );
}

export default function ConquistasClient() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");

  const [painel, setPainel] = useState<PainelPontos | null>(null);
  const [perfilOutro, setPerfilOutro] = useState<PerfilPontos | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [carregandoOutro, setCarregandoOutro] = useState(false);

  const [categoria, setCategoria] = useState<CategoriaConquista | "todas">(
    "todas",
  );
  const [estado, setEstado] = useState<"todas" | "ganhas" | "faltam">("todas");
  const [verTodas, setVerTodas] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await api<PainelPontos>("/api/pontos");
      setPainel(dados);
      setErro("");
      if (
        userParam &&
        Number(userParam) > 0 &&
        Number(userParam) !== dados.user_id
      ) {
        setCarregandoOutro(true);
        try {
          const outro = await api<PerfilPontos>(
            `/api/pontos/${Number(userParam)}`,
          );
          setPerfilOutro(outro);
        } catch (e) {
          toast((e as Error).message, "erro");
        } finally {
          setCarregandoOutro(false);
        }
      } else {
        setPerfilOutro(null);
      }
    } catch (e) {
      setErro(
        (e as Error).message || "Não foi possível carregar as conquistas.",
      );
    } finally {
      setCarregando(false);
    }
  }, [toast, userParam]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function escolherPessoa(valor: string) {
    if (!painel) return;
    const id = Number(valor);
    if (!id || id === painel.user_id) {
      setPerfilOutro(null);
      return;
    }
    setCarregandoOutro(true);
    try {
      const outro = await api<PerfilPontos>(`/api/pontos/${id}`);
      setPerfilOutro(outro);
    } catch (e) {
      toast((e as Error).message, "erro");
    } finally {
      setCarregandoOutro(false);
    }
  }

  const conquistasAtivas = perfilOutro
    ? perfilOutro.conquistas
    : (painel?.conquistas ?? []);
  const totalConquistas =
    conquistasAtivas.length || (painel?.conquistas_total ?? 0);
  const ganhasConquistas = conquistasAtivas.filter((c) =>
    Boolean(c.ganha_em),
  ).length;
  const pctTotal =
    totalConquistas > 0
      ? Math.min(100, Math.round((ganhasConquistas / totalConquistas) * 100))
      : 0;

  const grupos = agruparConquistasPorCategoria(
    conquistasAtivas,
    categoria,
    estado,
  );

  const faltaPouco = perfilOutro ? [] : escolherFaltaPouco(conquistasAtivas);
  const jaConquistadas = conquistasAtivas
    .filter((c) => c.ganha_em)
    .sort((x, y) => tempoGanha(y) - tempoGanha(x));

  return (
    <div className="pb-12">
      {painel && !perfilOutro && (
        <ToastConquista
          conquistas={painel.conquistas}
          ano={painel.ano}
          userId={painel.user_id}
        />
      )}
      <PageHeader
        kicker={painel ? `Natal de ${painel.ano}` : "Natal em Família"}
        title="Conquistas"
        back="/pontos"
        action={
          <Link href="/pontos" className="btn btn-quiet min-h-12 text-xs">
            <Trophy size={15} className="text-champagne" aria-hidden />
            Pontos
          </Link>
        }
      />

      <div className="space-y-7 px-5">
        {erro ? (
          <div role="alert" className="surface space-y-3 p-5">
            <p className="text-sm text-marfim-2">{erro}</p>
            <button
              type="button"
              className="btn btn-ghost w-full"
              onClick={() => void carregar()}
            >
              Tentar novamente
            </button>
          </div>
        ) : carregando || !painel ? (
          <Loading />
        ) : (
          <>
            {/* Resumo X de Y com barra de progresso e níveis */}
            <section
              aria-label="Progresso das conquistas"
              className="surface space-y-4 border border-champagne/40 p-5"
            >
              {perfilOutro ? (
                <div className="flex items-center justify-between gap-3 border-b border-linha pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={perfilOutro.nome}
                      src={perfilOutro.avatar_url}
                      size={42}
                      ring
                    />
                    <div className="min-w-0">
                      <p className="kicker">Vendo as conquistas de</p>
                      <p className="display break-words text-xl text-marfim">
                        {perfilOutro.nome}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-quiet min-h-12 shrink-0 text-xs text-champagne"
                    onClick={() => setPerfilOutro(null)}
                  >
                    Voltar ao meu
                  </button>
                </div>
              ) : null}

              <div className="flex items-end justify-between gap-3">
                <p className="display text-2xl leading-snug text-marfim">
                  {perfilOutro ? `${perfilOutro.nome} tem` : "Você tem"}{" "}
                  <span className="numeral text-champagne">
                    {ganhasConquistas}
                  </span>{" "}
                  de <span className="numeral">{totalConquistas}</span>{" "}
                  conquistas
                </p>
                <span className="numeral text-lg text-champagne">
                  {pctTotal}%
                </span>
              </div>

              <div
                role="progressbar"
                aria-label="Conquistas ganhas"
                aria-valuemin={0}
                aria-valuemax={totalConquistas || 1}
                aria-valuenow={ganhasConquistas}
                className="h-2.5 overflow-hidden rounded-full bg-carvao-3"
              >
                <div
                  className="h-full rounded-full bg-champagne transition-[width] duration-700"
                  style={{ width: `${pctTotal}%` }}
                />
              </div>

              <p className="text-sm leading-relaxed text-marfim-2">
                Conquistas são prêmios por participar. Cada uma vale pontos:
                Bronze 20, Prata 50, Ouro 100 e Lendária 250.
              </p>

              {/* Contagem por nível (bronze, prata, ouro, lendária) */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {NIVEIS_ORDEM.map((nivel) => {
                  const doNivel = conquistasAtivas.filter(
                    (c) => c.nivel === nivel,
                  );
                  const ganhasNivel = doNivel.filter((c) =>
                    Boolean(c.ganha_em),
                  ).length;
                  const est = ESTILO_NIVEL[nivel];
                  return (
                    <div
                      key={nivel}
                      className={`rounded-xl border px-1 py-2 text-center ${est.borda} bg-carvao-3/50`}
                    >
                      <span
                        className={`block text-xs font-semibold uppercase ${est.texto}`}
                      >
                        {ROTULOS_NIVEL[nivel]}
                      </span>
                      <span className="numeral mt-0.5 block text-sm text-marfim">
                        {ganhasNivel}/{doNivel.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Falta pouco: só nas próprias conquistas */}
            {!perfilOutro && faltaPouco.length > 0 && (
              <section aria-labelledby="falta-pouco" className="space-y-3">
                <h2 id="falta-pouco" className="display text-2xl text-marfim">
                  Falta pouco
                </h2>
                <ul className="space-y-3">
                  {faltaPouco.map((c) => (
                    <ItemConquista key={c.id} conquista={c} />
                  ))}
                </ul>
              </section>
            )}

            {/* Já conquistadas, da mais recente para a mais antiga */}
            <section aria-labelledby="ja-conquistadas" className="space-y-3">
              <h2 id="ja-conquistadas" className="display text-2xl text-marfim">
                Já conquistadas ({jaConquistadas.length})
              </h2>
              {carregandoOutro ? (
                <Loading />
              ) : jaConquistadas.length === 0 ? (
                <div className="surface space-y-2 p-5">
                  {perfilOutro ? (
                    <p className="text-sm text-marfim-2">
                      {perfilOutro.nome} ainda não ganhou nenhuma conquista.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-marfim-2">
                        Sua primeira conquista está perto: mande um recado no
                        mural ou uma foto para o álbum.
                      </p>
                      <Link
                        href="/mural"
                        className="inline-flex min-h-12 items-center text-sm font-medium text-champagne underline underline-offset-4"
                      >
                        Ir para o mural
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <ul className="space-y-3">
                  {jaConquistadas.map((c) => (
                    <ItemConquista key={c.id} conquista={c} />
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              className="btn btn-ghost w-full"
              aria-expanded={verTodas}
              aria-controls="lista-completa"
              onClick={() => setVerTodas((v) => !v)}
            >
              {verTodas
                ? "Mostrar menos"
                : `Ver todas as ${totalConquistas} conquistas`}
            </button>

            {verTodas && (
              <div id="lista-completa" className="space-y-7">
                {/* Filtros de estado e categoria */}
                <div className="space-y-3">
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Filtrar por estado da conquista"
                  >
                    {(
                      [
                        ["todas", "Todas"],
                        ["ganhas", `Conquistadas (${ganhasConquistas})`],
                        [
                          "faltam",
                          `Ainda não ganhei (${Math.max(0, totalConquistas - ganhasConquistas)})`,
                        ],
                      ] as const
                    ).map(([chave, rotulo]) => (
                      <button
                        key={chave}
                        type="button"
                        aria-pressed={estado === chave}
                        onClick={() => setEstado(chave)}
                        className={`btn min-h-12 px-3.5 text-xs ${
                          estado === chave ? "btn-primary" : "btn-ghost"
                        }`}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>

                  <div
                    className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
                    role="group"
                    aria-label="Filtrar por categoria"
                  >
                    <button
                      type="button"
                      aria-pressed={categoria === "todas"}
                      onClick={() => setCategoria("todas")}
                      className={`btn min-h-12 shrink-0 px-3.5 text-xs ${
                        categoria === "todas" ? "btn-primary" : "btn-ghost"
                      }`}
                    >
                      Todas as categorias
                    </button>
                    {ORDEM_CATEGORIAS.map((cat) => {
                      const totalCat = conquistasAtivas.filter(
                        (c) => c.categoria === cat,
                      ).length;
                      if (totalCat === 0) return null;
                      return (
                        <button
                          key={cat}
                          type="button"
                          aria-pressed={categoria === cat}
                          onClick={() => setCategoria(cat)}
                          className={`btn min-h-12 shrink-0 px-3.5 text-xs ${
                            categoria === cat ? "btn-primary" : "btn-ghost"
                          }`}
                        >
                          {ROTULOS_CATEGORIA[cat]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lista agrupada por categoria */}
                {carregandoOutro ? (
                  <Loading />
                ) : grupos.length === 0 ? (
                  <div className="surface p-6 text-center">
                    <Sparkles
                      className="mx-auto mb-3 text-champagne"
                      size={26}
                      strokeWidth={1.5}
                    />
                    <p className="text-sm text-marfim-2">
                      Nenhuma conquista encontrada neste filtro.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {grupos.map((grupo) => (
                      <section
                        key={grupo.categoria}
                        aria-labelledby={`cat-${grupo.categoria}`}
                        className="space-y-3"
                      >
                        <div className="flex items-end justify-between border-b border-linha pb-2">
                          <div>
                            <p className="kicker">Categoria</p>
                            <h2
                              id={`cat-${grupo.categoria}`}
                              className="display text-2xl text-marfim"
                            >
                              {grupo.titulo}
                            </h2>
                          </div>
                          <span className="numeral text-sm text-champagne">
                            {grupo.ganhas} de {grupo.total}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                          {grupo.itens.map((c) => (
                            <CartaoConquista key={c.id} conquista={c} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Seletor para ver as conquistas de outra pessoa da família */}
            {painel.ranking && painel.ranking.length > 1 && (
              <label className="surface block p-4 text-sm text-marfim-2">
                Ver conquistas de alguém da família
                <select
                  className="field mt-1.5 min-h-12 py-2 text-base"
                  disabled={carregandoOutro}
                  value={
                    perfilOutro
                      ? String(perfilOutro.user_id)
                      : String(painel.user_id)
                  }
                  onChange={(e) => void escolherPessoa(e.target.value)}
                >
                  <option value={String(painel.user_id)}>
                    Minhas conquistas
                  </option>
                  {painel.ranking
                    .filter((r) => r.user_id !== painel.user_id)
                    .map((r) => (
                      <option key={r.user_id} value={String(r.user_id)}>
                        {r.nome} ({r.conquistas}{" "}
                        {r.conquistas === 1 ? "conquista" : "conquistas"})
                      </option>
                    ))}
                </select>
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}
