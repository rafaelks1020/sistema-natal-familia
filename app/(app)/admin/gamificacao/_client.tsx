'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Eye,
  Flame,
  PlusCircle,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import { api, thumb } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading, Sheet } from '../../familia/_components/shared';
import type {
  Missao,
  PainelAdminGamificacao,
  PainelPontos,
  RespostaMissao,
  TipoMissao,
} from '@/app/lib/gamificacao/tipos';
import {
  ORDEM_ORIGENS,
  ROTULOS_ORIGEM,
  ROTULOS_TIPO_MISSAO,
  datetimeLocalSPParaIso,
  formatarDataHoraSP,
  formatarDiaExtrato,
  formatarHoraSP,
  isoParaDatetimeLocalSP,
  ordenarMissoesAdmin,
} from '../../pontos/_logica';

function horarioMaisHorasSP(horas: number): { inicia: string; termina: string } {
  const agora = new Date();
  const fim = new Date(agora.getTime() + horas * 3600_000);
  return {
    inicia: isoParaDatetimeLocalSP(agora.toISOString()),
    termina: isoParaDatetimeLocalSP(fim.toISOString()),
  };
}

export default function AdminGamificacaoClient() {
  const toast = useToast();
  const [painel, setPainel] = useState<PainelAdminGamificacao | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);

  // Estado do formulário de configuração (datas + chave de missões surpresa + pessoas fora da competição)
  const [encerraEm, setEncerraEm] = useState('');
  const [ocultoEm, setOcultoEm] = useState('');
  const [missoesSurpresa, setMissoesSurpresa] = useState(true);
  const [excluidos, setExcluidos] = useState<number[]>([]);
  const [ocupadoExcluidoId, setOcupadoExcluidoId] = useState<number | null>(null);
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  // Confirmação de revelar no telão
  const [confirmarRevelar, setConfirmarRevelar] = useState(false);
  const [revelando, setRevelando] = useState(false);

  // Extrato detalhado de uma pessoa (GET /api/admin/gamificacao?user=ID)
  const [extratoUsuario, setExtratoUsuario] = useState<{
    nome: string;
    dados: PainelPontos;
  } | null>(null);
  const [carregandoExtratoId, setCarregandoExtratoId] = useState<number | null>(null);

  // Anular lançamento direto do extrato da pessoa
  const [anulandoLancamento, setAnulandoLancamento] = useState<{
    userId: number;
    nome: string;
    regra: string;
    ref: string;
    descricao: string;
    pontos: number;
  } | null>(null);
  const [motivoAnulacao, setMotivoAnulacao] = useState('');
  const [salvandoAnulacao, setSalvandoAnulacao] = useState(false);

  // Formulário de ajuste manual
  const [ajusteUserId, setAjusteUserId] = useState('');
  const [ajustePontos, setAjustePontos] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [ajusteAnulaRef, setAjusteAnulaRef] = useState('');
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);

  // Formulário de criar/agendar missão
  const [modeloEscolhido, setModeloEscolhido] = useState('');
  const [missaoTitulo, setMissaoTitulo] = useState('');
  const [missaoDescricao, setMissaoDescricao] = useState('');
  const [missaoTipo, setMissaoTipo] = useState<TipoMissao>('foto');
  const [missaoPontos, setMissaoPontos] = useState('30');
  const [missaoInicia, setMissaoInicia] = useState('');
  const [missaoTermina, setMissaoTermina] = useState('');
  const [salvandoMissao, setSalvandoMissao] = useState(false);

  // Modal de recusar resposta com motivo
  const [recusandoResposta, setRecusandoResposta] = useState<RespostaMissao | null>(null);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [ocupadoRespostaId, setOcupadoRespostaId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await api<PainelAdminGamificacao>('/api/admin/gamificacao');
      setPainel(dados);
      setEncerraEm(isoParaDatetimeLocalSP(dados.config.encerra_em));
      setOcultoEm(isoParaDatetimeLocalSP(dados.config.ranking_oculto_em));
      setMissoesSurpresa(dados.config.missoes_surpresa);
      setExcluidos(dados.config.excluidos ?? []);
      setErro('');
      if (!missaoInicia || !missaoTermina) {
        const padrao = horarioMaisHorasSP(6);
        setMissaoInicia(padrao.inicia);
        setMissaoTermina(padrao.termina);
      }
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível carregar o painel de gamificação.');
    } finally {
      setCarregando(false);
    }
  }, [missaoInicia, missaoTermina]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarConfig(e: FormEvent) {
    e.preventDefault();
    setSalvandoConfig(true);
    try {
      await api('/api/admin/gamificacao', {
        method: 'PATCH',
        json: {
          encerra_em: datetimeLocalSPParaIso(encerraEm),
          ranking_oculto_em: datetimeLocalSPParaIso(ocultoEm),
          missoes_surpresa: missoesSurpresa,
          excluidos,
        },
      });
      toast('Configurações da gamificação salvas.');
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function alternarParticipaCompeticao(userId: number, participa: boolean) {
    const proximo = participa
      ? excluidos.filter((id) => id !== userId)
      : [...new Set([...excluidos, userId])];
    setExcluidos(proximo);
    setOcupadoExcluidoId(userId);
    try {
      await api('/api/admin/gamificacao', {
        method: 'PATCH',
        json: { excluidos: proximo },
      });
      toast(
        participa
          ? 'Pessoa incluída novamente na competição.'
          : 'Pessoa marcada como fora da competição.',
      );
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
      await carregar();
    } finally {
      setOcupadoExcluidoId(null);
    }
  }

  async function confirmarAnulacaoLancamento(e: FormEvent) {
    e.preventDefault();
    if (!anulandoLancamento) return;
    if (!motivoAnulacao.trim()) {
      toast('Informe o motivo da anulação.', 'erro');
      return;
    }
    setSalvandoAnulacao(true);
    try {
      await api('/api/admin/gamificacao/ajustes', {
        method: 'POST',
        json: {
          user_id: anulandoLancamento.userId,
          pontos: 0,
          anula_ref: `${anulandoLancamento.regra}|${anulandoLancamento.ref}`,
          motivo: motivoAnulacao.trim(),
        },
      });
      toast('Lançamento anulado com sucesso.');
      const alvo = { id: anulandoLancamento.userId, nome: anulandoLancamento.nome };
      setAnulandoLancamento(null);
      setMotivoAnulacao('');
      await carregar();
      await verExtratoPessoa(alvo.id, alvo.nome);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSalvandoAnulacao(false);
    }
  }

  async function revelarResultado() {
    setRevelando(true);
    try {
      await api('/api/admin/gamificacao/revelar', { method: 'POST', json: {} });
      toast('Resultado revelado! O telão já pode exibir os vencedores.');
      setConfirmarRevelar(false);
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setRevelando(false);
    }
  }

  async function verExtratoPessoa(userId: number, nome: string) {
    setCarregandoExtratoId(userId);
    try {
      const dados = await api<PainelPontos>(
        `/api/admin/gamificacao?user=${encodeURIComponent(String(userId))}`,
      );
      setExtratoUsuario({ nome, dados });
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setCarregandoExtratoId(null);
    }
  }

  async function criarAjuste(e: FormEvent) {
    e.preventDefault();
    const uid = Number(ajusteUserId);
    const temAnula = Boolean(ajusteAnulaRef.trim());
    const pts = temAnula && (!ajustePontos.trim() || Number(ajustePontos) === 0)
      ? 0
      : Number(ajustePontos);
    if (!uid || !Number.isInteger(pts) || (!temAnula && pts === 0)) {
      toast('Escolha uma pessoa e informe um valor inteiro válido.', 'erro');
      return;
    }
    if (temAnula && pts !== 0) {
      toast('Ao anular um lançamento, os pontos do ajuste devem ser 0.', 'erro');
      return;
    }
    if (!ajusteMotivo.trim()) {
      toast('Informe o motivo do ajuste (aparece no extrato).', 'erro');
      return;
    }
    setSalvandoAjuste(true);
    try {
      await api('/api/admin/gamificacao/ajustes', {
        method: 'POST',
        json: {
          user_id: uid,
          pontos: pts,
          motivo: ajusteMotivo.trim(),
          ...(temAnula ? { anula_ref: ajusteAnulaRef.trim() } : {}),
        },
      });
      toast('Ajuste aplicado no extrato.');
      setAjustePontos('');
      setAjusteMotivo('');
      setAjusteAnulaRef('');
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSalvandoAjuste(false);
    }
  }

  function selecionarModelo(idModelo: string) {
    setModeloEscolhido(idModelo);
    if (!idModelo || !painel) return;
    const m = painel.modelos.find((item) => item.id === idModelo);
    if (!m) return;
    setMissaoTitulo(m.titulo);
    setMissaoDescricao(m.descricao);
    setMissaoTipo(m.tipo);
    setMissaoPontos(String(m.pontos));
  }

  async function agendarMissao(e: FormEvent) {
    e.preventDefault();
    const pts = Number(missaoPontos);
    if (!Number.isInteger(pts) || pts < 5 || pts > 200) {
      toast('Os pontos da missão devem ficar entre 5 e 200.', 'erro');
      return;
    }
    if (!missaoTitulo.trim() || !missaoDescricao.trim()) {
      toast('Preencha o título e a descrição da missão.', 'erro');
      return;
    }
    if (!missaoInicia || !missaoTermina) {
      toast('Defina o início e o término da missão.', 'erro');
      return;
    }
    setSalvandoMissao(true);
    try {
      await api('/api/admin/gamificacao/missoes', {
        method: 'POST',
        json: {
          ...(modeloEscolhido ? { modelo: modeloEscolhido } : {}),
          titulo: missaoTitulo.trim(),
          descricao: missaoDescricao.trim(),
          tipo: missaoTipo,
          pontos: pts,
          inicia_em: datetimeLocalSPParaIso(missaoInicia),
          termina_em: datetimeLocalSPParaIso(missaoTermina),
        },
      });
      toast('Missão agendada com sucesso!');
      setModeloEscolhido('');
      setMissaoTitulo('');
      setMissaoDescricao('');
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSalvandoMissao(false);
    }
  }

  async function confirmarRecusaResposta(e: FormEvent) {
    e.preventDefault();
    if (!recusandoResposta) return;
    if (!motivoRecusa.trim()) {
      toast('Informe o motivo da recusa.', 'erro');
      return;
    }
    setOcupadoRespostaId(recusandoResposta.id);
    try {
      await api(`/api/admin/gamificacao/missoes/respostas/${recusandoResposta.id}`, {
        method: 'PATCH',
        json: {
          status: 'recusada',
          motivo_recusa: motivoRecusa.trim(),
        },
      });
      toast('Resposta recusada.');
      setRecusandoResposta(null);
      setMotivoRecusa('');
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setOcupadoRespostaId(null);
    }
  }

  async function reaprovarResposta(resposta: RespostaMissao) {
    setOcupadoRespostaId(resposta.id);
    try {
      await api(`/api/admin/gamificacao/missoes/respostas/${resposta.id}`, {
        method: 'PATCH',
        json: { status: 'aprovada' },
      });
      toast('Resposta reaprovada!');
      await carregar();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setOcupadoRespostaId(null);
    }
  }

  const missoesOrdenadas: Missao[] = painel ? ordenarMissoesAdmin(painel.missoes) : [];

  return (
    <main className="mx-auto max-w-xl pb-12">
      <PageHeader
        kicker={painel ? `Edição ${painel.config.ano}` : 'Cuidar de tudo'}
        title="Gamificação"
        back="/admin"
      />

      <div className="space-y-10 px-5">
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
            {/* 1. Datas, missões surpresa e botão Revelar */}
            <section aria-labelledby="sec-config" className="surface space-y-5 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="kicker">Regras do calendário</p>
                  <h2 id="sec-config" className="display mt-1 text-2xl">
                    Datas e suspense
                  </h2>
                </div>
                <Settings2 size={20} className="text-champagne" strokeWidth={1.5} aria-hidden />
              </div>

              <form onSubmit={(e) => void salvarConfig(e)} className="space-y-4">
                <label className="block text-sm text-marfim-2">
                  Ocultar ranking em (suspense)
                  <input
                    type="datetime-local"
                    required
                    disabled={salvandoConfig}
                    value={ocultoEm}
                    onChange={(e) => setOcultoEm(e.target.value)}
                    className="field mt-2"
                  />
                  <span className="mt-1 block text-xs text-marfim-3">
                    Horário de São Paulo. Padrão: 48 horas antes do encerramento.
                  </span>
                </label>

                <label className="block text-sm text-marfim-2">
                  Encerrar pontuação em
                  <input
                    type="datetime-local"
                    required
                    disabled={salvandoConfig}
                    value={encerraEm}
                    onChange={(e) => setEncerraEm(e.target.value)}
                    className="field mt-2"
                  />
                  <span className="mt-1 block text-xs text-marfim-3">
                    Depois desse horário nada mais soma pontos na edição.
                  </span>
                </label>

                <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-linha bg-carvao-3/60 px-4 py-3 text-sm text-marfim">
                  <input
                    type="checkbox"
                    checked={missoesSurpresa}
                    disabled={salvandoConfig}
                    onChange={(e) => setMissoesSurpresa(e.target.checked)}
                  />
                  <span>
                    Sortear missões surpresa automaticamente (até 1 por dia em dezembro)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={salvandoConfig}
                  className="btn btn-primary w-full"
                >
                  {salvandoConfig ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </form>

              <div className="space-y-3 border-t border-linha pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-marfim">Revelação no telão da festa</p>
                    <p className="text-xs text-marfim-3">
                      {painel.config.revelado_em
                        ? `Revelado em ${formatarDataHoraSP(painel.config.revelado_em)}`
                        : 'Ainda em segredo para a família'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmarRevelar(true)}
                    className="btn btn-ghost min-h-11 px-4 text-xs text-champagne"
                  >
                    <Sparkles size={15} strokeWidth={1.6} aria-hidden />
                    {painel.config.revelado_em ? 'Revelar novamente' : 'Revelar resultado'}
                  </button>
                </div>
              </div>

              {(painel.pessoas ?? []).length > 0 && (
                <div className="space-y-3 border-t border-linha pt-4">
                  <div>
                    <p className="text-sm font-medium text-marfim">Participação na competição</p>
                    <p className="text-xs text-marfim-3">
                      Quem estiver desmarcado fica fora do ranking, da revelação no telão e dos alertas de missão, mas continua vendo as próprias conquistas.
                    </p>
                  </div>
                  <ul className="divide-y divide-linha rounded-2xl border border-linha bg-carvao-3/40 px-3">
                    {(painel.pessoas ?? []).map((pessoa) => {
                      const participa = !excluidos.includes(pessoa.id);
                      return (
                        <li
                          key={pessoa.id}
                          className="flex min-h-12 items-center justify-between gap-3 py-2.5 text-xs"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={pessoa.nome} src={pessoa.avatar_url} size={28} />
                            <span className="truncate font-medium text-marfim">{pessoa.nome}</span>
                          </div>
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-marfim-2">
                            <input
                              type="checkbox"
                              checked={participa}
                              disabled={ocupadoExcluidoId === pessoa.id || salvandoConfig}
                              onChange={(e) =>
                                void alternarParticipaCompeticao(pessoa.id, e.target.checked)
                              }
                            />
                            <span>Participa da competição</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* 2. Ranking completo e ver extrato de qualquer pessoa */}
            <section aria-labelledby="sec-ranking-admin" className="space-y-4">
              <div>
                <p className="kicker">Visão do organizador (sempre visível)</p>
                <h2 id="sec-ranking-admin" className="display mt-1 text-3xl">
                  Ranking completo
                </h2>
                <p className="mt-1 text-xs text-marfim-3">
                  Atualizado em {formatarDataHoraSP(painel.atualizado_em)}. Toque em &quot;Extrato&quot; para inspecionar cada ponto da pessoa.
                </p>
              </div>

              {painel.ranking.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">
                  Nenhuma pessoa pontuou ainda nesta edição.
                </p>
              ) : (
                <ol className="surface divide-y divide-linha px-4">
                  {painel.ranking.map((linha) => (
                    <li
                      key={linha.user_id}
                      className="flex min-h-16 items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="numeral w-7 shrink-0 text-base text-champagne">
                          {linha.posicao}º
                        </span>
                        <Avatar name={linha.nome} src={linha.avatar_url} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-marfim">{linha.nome}</p>
                          <p className="text-xs text-marfim-3">
                            {linha.total.toLocaleString('pt-BR')} pts · {linha.conquistas}{' '}
                            {linha.conquistas === 1 ? 'conquista' : 'conquistas'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={carregandoExtratoId === linha.user_id}
                        onClick={() => void verExtratoPessoa(linha.user_id, linha.nome)}
                        className="btn btn-ghost min-h-10 shrink-0 px-3 text-xs"
                      >
                        <Eye size={14} strokeWidth={1.6} aria-hidden />
                        {carregandoExtratoId === linha.user_id ? 'Abrindo...' : 'Extrato'}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* 3. Ajustes manuais com motivo */}
            <section aria-labelledby="sec-ajustes" className="space-y-4">
              <div>
                <p className="kicker">Correção justa e transparente</p>
                <h2 id="sec-ajustes" className="display mt-1 text-3xl">
                  Ajustes de pontos
                </h2>
                <p className="mt-1 text-xs text-marfim-3">
                  Todo ajuste fica visível no extrato da pessoa com o motivo informado.
                </p>
              </div>

              <form
                onSubmit={(e) => void criarAjuste(e)}
                className="surface space-y-4 p-5"
              >
                <label className="block text-sm text-marfim-2">
                  Pessoa da família
                  <select
                    required
                    disabled={salvandoAjuste}
                    value={ajusteUserId}
                    onChange={(e) => setAjusteUserId(e.target.value)}
                    className="field mt-2"
                  >
                    <option value="">Escolha alguém</option>
                    {painel.ranking.map((r) => (
                      <option key={r.user_id} value={String(r.user_id)}>
                        {r.nome} ({r.total} pts)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-marfim-2">
                  Pontos (use positivo para bônus ou negativo para descontar)
                  <input
                    type="number"
                    required
                    disabled={salvandoAjuste}
                    placeholder="Ex.: 20 ou -10"
                    value={ajustePontos}
                    onChange={(e) => setAjustePontos(e.target.value)}
                    className="field mt-2"
                  />
                </label>

                <label className="block text-sm text-marfim-2">
                  Motivo do ajuste
                  <input
                    type="text"
                    required
                    maxLength={200}
                    disabled={salvandoAjuste}
                    placeholder="Ex.: Bônus por ajudar na arrumação da mesa"
                    value={ajusteMotivo}
                    onChange={(e) => setAjusteMotivo(e.target.value)}
                    className="field mt-2"
                  />
                </label>

                <label className="block text-sm text-marfim-2">
                  Referência a anular (opcional, formato regra|ref)
                  <input
                    type="text"
                    maxLength={120}
                    disabled={salvandoAjuste}
                    placeholder="Ex.: foto_album|album:123"
                    value={ajusteAnulaRef}
                    onChange={(e) => setAjusteAnulaRef(e.target.value)}
                    className="field mt-2"
                  />
                </label>

                <button
                  type="submit"
                  disabled={salvandoAjuste}
                  className="btn btn-primary w-full"
                >
                  <PlusCircle size={17} strokeWidth={1.6} aria-hidden />
                  {salvandoAjuste ? 'Aplicando ajuste...' : 'Registrar ajuste'}
                </button>
              </form>

              {painel.ajustes.length > 0 && (
                <div className="surface divide-y divide-linha px-4">
                  {painel.ajustes.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-marfim">
                          {a.nome}: <span className="text-marfim-2">{a.motivo}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-marfim-3">
                          Por {a.criado_por_nome} em {formatarDataHoraSP(a.created_at)}
                          {a.anula_ref ? ` · Anula ${a.anula_ref}` : ''}
                        </p>
                      </div>
                      <span
                        className={`numeral shrink-0 text-base ${
                          a.pontos >= 0 ? 'text-champagne' : 'text-cereja'
                        }`}
                      >
                        {a.pontos >= 0 ? `+${a.pontos}` : a.pontos}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Agendar missão a partir dos modelos ou criar */}
            <section aria-labelledby="sec-criar-missao" className="space-y-4">
              <div>
                <p className="kicker">Eventos aleatórios</p>
                <h2 id="sec-criar-missao" className="display mt-1 text-3xl">
                  Agendar ou criar missão
                </h2>
              </div>

              <form
                onSubmit={(e) => void agendarMissao(e)}
                className="surface space-y-4 p-5"
              >
                {painel.modelos.length > 0 && (
                  <label className="block text-sm text-marfim-2">
                    Modelo pronto (opcional)
                    <select
                      disabled={salvandoMissao}
                      value={modeloEscolhido}
                      onChange={(e) => selecionarModelo(e.target.value)}
                      className="field mt-2"
                    >
                      <option value="">Criar missão personalizada</option>
                      {painel.modelos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titulo} (+{m.pontos} pts · {ROTULOS_TIPO_MISSAO[m.tipo]})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block text-sm text-marfim-2">
                  Título da missão
                  <input
                    type="text"
                    required
                    maxLength={120}
                    disabled={salvandoMissao}
                    placeholder="Ex.: Foto sua quando criança"
                    value={missaoTitulo}
                    onChange={(e) => setMissaoTitulo(e.target.value)}
                    className="field mt-2"
                  />
                </label>

                <label className="block text-sm text-marfim-2">
                  Descrição e instruções
                  <textarea
                    rows={3}
                    required
                    maxLength={500}
                    disabled={salvandoMissao}
                    placeholder="Ex.: Poste uma foto de quando você era criança e conte de que ano é!"
                    value={missaoDescricao}
                    onChange={(e) => setMissaoDescricao(e.target.value)}
                    className="field mt-2"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm text-marfim-2">
                    Tipo de resposta
                    <select
                      disabled={salvandoMissao}
                      value={missaoTipo}
                      onChange={(e) => setMissaoTipo(e.target.value as TipoMissao)}
                      className="field mt-2"
                    >
                      <option value="foto">Só foto</option>
                      <option value="texto">Só texto</option>
                      <option value="foto_texto">Foto e texto</option>
                    </select>
                  </label>

                  <label className="block text-sm text-marfim-2">
                    Pontos (5 a 200)
                    <input
                      type="number"
                      min={5}
                      max={200}
                      required
                      disabled={salvandoMissao}
                      value={missaoPontos}
                      onChange={(e) => setMissaoPontos(e.target.value)}
                      className="field mt-2"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    [4, 'Agora · dura 4h'],
                    [8, 'Agora · dura 8h'],
                    [24, 'Agora · dura 24h'],
                  ].map(([horas, rotulo]) => (
                    <button
                      key={horas}
                      type="button"
                      onClick={() => {
                        const p = horarioMaisHorasSP(Number(horas));
                        setMissaoInicia(p.inicia);
                        setMissaoTermina(p.termina);
                      }}
                      className="btn btn-ghost min-h-9 px-3 text-xs"
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-sm text-marfim-2">
                    Início (SP)
                    <input
                      type="datetime-local"
                      required
                      disabled={salvandoMissao}
                      value={missaoInicia}
                      onChange={(e) => setMissaoInicia(e.target.value)}
                      className="field mt-2"
                    />
                  </label>

                  <label className="block text-sm text-marfim-2">
                    Término (SP)
                    <input
                      type="datetime-local"
                      required
                      disabled={salvandoMissao}
                      value={missaoTermina}
                      onChange={(e) => setMissaoTermina(e.target.value)}
                      className="field mt-2"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={salvandoMissao}
                  className="btn btn-primary w-full"
                >
                  <Flame size={17} strokeWidth={1.6} aria-hidden />
                  {salvandoMissao ? 'Agendando...' : 'Agendar missão relâmpago'}
                </button>
              </form>
            </section>

            {/* 5. Missões do ano e moderação de respostas (recusar/reaprovar) */}
            <section aria-labelledby="sec-missoes-admin" className="space-y-4">
              <div>
                <p className="kicker">Acompanhamento e moderação</p>
                <h2 id="sec-missoes-admin" className="display mt-1 text-3xl">
                  Missões e respostas ({missoesOrdenadas.length})
                </h2>
              </div>

              {missoesOrdenadas.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">
                  Nenhuma missão cadastrada nesta edição ainda.
                </p>
              ) : (
                <div className="space-y-5">
                  {missoesOrdenadas.map((m) => (
                    <article key={m.id} className="surface space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              m.estado === 'ativa'
                                ? 'border-cereja/60 bg-cereja/20 text-marfim'
                                : m.estado === 'agendada'
                                  ? 'border-champagne/60 bg-carvao-3 text-champagne'
                                  : 'border-linha bg-carvao-3 text-marfim-3'
                            }`}
                          >
                            {m.estado === 'ativa'
                              ? 'Ativa'
                              : m.estado === 'agendada'
                                ? 'Agendada'
                                : 'Encerrada'}
                          </span>
                          <h3 className="display mt-1.5 text-2xl text-marfim">{m.titulo}</h3>
                          <p className="mt-0.5 text-xs text-marfim-3">
                            {formatarDataHoraSP(m.inicia_em)} até {formatarDataHoraSP(m.termina_em)}{' '}
                            · {ROTULOS_TIPO_MISSAO[m.tipo]} · +{m.pontos} pts
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-marfim-2">{m.descricao}</p>

                      <div className="space-y-3 border-t border-linha pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-champagne">
                          Respostas ({m.respostas.length})
                        </p>
                        {m.respostas.length === 0 ? (
                          <p className="text-xs text-marfim-3">Nenhuma resposta enviada.</p>
                        ) : (
                          <ul className="divide-y divide-linha">
                            {m.respostas.map((r) => (
                              <li key={r.id} className="space-y-2 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <Avatar name={r.nome} src={r.avatar_url} size={32} />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-marfim">
                                        {r.nome}
                                      </p>
                                      <p className="text-xs text-marfim-3">
                                        {formatarDataHoraSP(r.created_at)}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                                      r.status === 'aprovada'
                                        ? 'border-champagne/50 text-champagne'
                                        : 'border-cereja/60 text-cereja'
                                    }`}
                                  >
                                    {r.status === 'aprovada' ? 'Aprovada' : 'Recusada'}
                                  </span>
                                </div>

                                {r.image_url && (
                                  <a
                                    href={r.image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block"
                                  >
                                    <img
                                      src={thumb(r.image_url, 384)}
                                      alt={`Foto de ${r.nome}`}
                                      loading="lazy"
                                      className="max-h-40 rounded-xl border border-linha object-cover"
                                    />
                                  </a>
                                )}

                                {r.texto && (
                                  <p className="whitespace-pre-wrap break-words text-sm text-marfim-2">
                                    {r.texto}
                                  </p>
                                )}

                                {r.status === 'recusada' && r.motivo_recusa && (
                                  <p className="text-xs text-cereja">
                                    Motivo da recusa: {r.motivo_recusa}
                                  </p>
                                )}

                                <div className="flex flex-wrap gap-2 pt-1">
                                  {r.status === 'aprovada' ? (
                                    <button
                                      type="button"
                                      disabled={ocupadoRespostaId === r.id}
                                      onClick={() => {
                                        setRecusandoResposta(r);
                                        setMotivoRecusa('');
                                      }}
                                      className="btn btn-quiet min-h-9 px-3 text-xs text-cereja"
                                    >
                                      <XCircle size={14} strokeWidth={1.6} aria-hidden />
                                      Recusar com motivo
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={ocupadoRespostaId === r.id}
                                      onClick={() => void reaprovarResposta(r)}
                                      className="btn btn-quiet min-h-9 px-3 text-xs text-champagne"
                                    >
                                      <RotateCcw size={14} strokeWidth={1.6} aria-hidden />
                                      {ocupadoRespostaId === r.id
                                        ? 'Reaprovando...'
                                        : 'Reaprovar resposta'}
                                    </button>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Sheet de confirmação para revelar resultado no telão */}
      {confirmarRevelar && (
        <Sheet
          title="Revelar resultado no telão?"
          busy={revelando}
          onClose={() => setConfirmarRevelar(false)}
        >
          <div className="space-y-4">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-marfim-2">
              <ShieldAlert
                size={18}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0 text-champagne"
                aria-hidden
              />
              Ao confirmar, o resultado oficial do Campeão do Natal e da Voz do Natal será liberado para a cena de revelação no telão da festa e para a família.
            </p>
            <button
              type="button"
              disabled={revelando}
              onClick={() => void revelarResultado()}
              className="btn btn-primary w-full"
            >
              <Trophy size={17} strokeWidth={1.6} aria-hidden />
              {revelando ? 'Revelando...' : 'Confirmar e revelar agora'}
            </button>
            <button
              type="button"
              disabled={revelando}
              onClick={() => setConfirmarRevelar(false)}
              className="btn btn-ghost w-full"
            >
              Cancelar
            </button>
          </div>
        </Sheet>
      )}

      {/* Sheet de recusar resposta com motivo */}
      {recusandoResposta && (
        <Sheet
          title={`Recusar resposta de ${recusandoResposta.nome}`}
          busy={ocupadoRespostaId === recusandoResposta.id}
          onClose={() => setRecusandoResposta(null)}
        >
          <form onSubmit={(e) => void confirmarRecusaResposta(e)} className="space-y-4">
            <p className="text-sm text-marfim-2">
              A pessoa verá o motivo da recusa e os pontos desta missão deixarão de contar para ela.
            </p>
            <label className="block text-sm text-marfim-2">
              Motivo da recusa
              <textarea
                rows={3}
                required
                maxLength={240}
                value={motivoRecusa}
                onChange={(e) => setMotivoRecusa(e.target.value)}
                placeholder="Ex.: A foto enviada não corresponde ao tema da missão."
                className="field mt-2"
              />
            </label>
            <button
              type="submit"
              disabled={ocupadoRespostaId === recusandoResposta.id || !motivoRecusa.trim()}
              className="btn btn-primary w-full"
            >
              {ocupadoRespostaId === recusandoResposta.id
                ? 'Recusando...'
                : 'Confirmar recusa'}
            </button>
            <button
              type="button"
              onClick={() => setRecusandoResposta(null)}
              className="btn btn-ghost w-full"
            >
              Cancelar
            </button>
          </form>
        </Sheet>
      )}

      {/* Sheet do extrato de qualquer pessoa (GET /api/admin/gamificacao?user=ID) */}
      {extratoUsuario && (
        <Sheet
          title={`Extrato de ${extratoUsuario.nome}`}
          onClose={() => setExtratoUsuario(null)}
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-linha pb-3">
              <div>
                <p className="text-xs text-marfim-3">Total acumulado</p>
                <p className="numeral text-3xl text-champagne">
                  {extratoUsuario.dados.total.toLocaleString('pt-BR')} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAjusteUserId(String(extratoUsuario.dados.user_id));
                  setExtratoUsuario(null);
                }}
                className="btn btn-ghost min-h-10 px-3 text-xs"
              >
                Fazer ajuste para {extratoUsuario.nome.trim().split(/\s+/)[0]}
              </button>
            </div>

            <dl className="grid grid-cols-3 gap-2">
              {ORDEM_ORIGENS.map((origem) => (
                <div
                  key={origem}
                  className="rounded-xl border border-linha bg-carvao-3/60 px-2.5 py-2"
                >
                  <dt className="truncate text-[10px] text-marfim-3">
                    {ROTULOS_ORIGEM[origem]}
                  </dt>
                  <dd className="numeral text-sm text-marfim">
                    {extratoUsuario.dados.por_origem?.[origem] ?? 0}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3">
              <h3 className="kicker">Lançamentos por dia</h3>
              {extratoUsuario.dados.extrato.length === 0 ? (
                <p className="text-sm text-marfim-3">Nenhum lançamento registrado.</p>
              ) : (
                extratoUsuario.dados.extrato.map((dia) => (
                  <div key={dia.dia} className="rounded-2xl border border-linha bg-carvao-3/40 p-3.5">
                    <div className="mb-2 flex items-center justify-between border-b border-linha pb-1.5 text-xs">
                      <span className="font-semibold text-champagne">
                        {formatarDiaExtrato(dia.dia)}
                      </span>
                      <span className="numeral text-marfim">
                        {dia.total >= 0 ? `+${dia.total}` : dia.total} pts
                      </span>
                    </div>
                    <ul className="divide-y divide-linha">
                      {dia.lancamentos.map((l, i) => {
                        const podeAnular = l.origem !== 'ajuste' && Boolean(l.ref);
                        const estaAnulando =
                          anulandoLancamento?.regra === l.regra && anulandoLancamento?.ref === l.ref;
                        return (
                          <li
                            key={`${l.regra}-${l.ref ?? ''}-${l.ocorreu_em}-${i}`}
                            className="space-y-2 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="break-words text-marfim">{l.descricao}</p>
                                <p className="text-[11px] text-marfim-3">
                                  {l.regra}
                                  {l.ref ? ` · ${l.ref}` : ''} · {formatarHoraSP(l.ocorreu_em)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span
                                  className={`numeral font-semibold ${
                                    l.pontos >= 0 ? 'text-champagne' : 'text-cereja'
                                  }`}
                                >
                                  {l.pontos >= 0 ? `+${l.pontos}` : l.pontos}
                                </span>
                                {podeAnular && l.ref && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAnulandoLancamento({
                                        userId: extratoUsuario.dados.user_id,
                                        nome: extratoUsuario.nome,
                                        regra: l.regra,
                                        ref: l.ref!,
                                        descricao: l.descricao,
                                        pontos: l.pontos,
                                      });
                                      setMotivoAnulacao('');
                                    }}
                                    className="btn btn-ghost min-h-8 px-2.5 py-1 text-[11px] text-cereja"
                                  >
                                    Anular
                                  </button>
                                )}
                              </div>
                            </div>

                            {estaAnulando && (
                              <form
                                onSubmit={(e) => void confirmarAnulacaoLancamento(e)}
                                className="space-y-2 rounded-xl border border-linha bg-carvao-2 p-3"
                              >
                                <label className="block text-[11px] text-marfim-2">
                                  Motivo obrigatório para anular &quot;{l.regra}|{l.ref}&quot;
                                  <input
                                    type="text"
                                    required
                                    maxLength={240}
                                    disabled={salvandoAnulacao}
                                    value={motivoAnulacao}
                                    onChange={(e) => setMotivoAnulacao(e.target.value)}
                                    placeholder="Ex.: Publicação duplicada por engano"
                                    className="field mt-1 text-xs"
                                  />
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="submit"
                                    disabled={salvandoAnulacao || !motivoAnulacao.trim()}
                                    className="btn btn-primary min-h-9 px-3 text-xs"
                                  >
                                    {salvandoAnulacao ? 'Anulando...' : 'Confirmar anulação'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoAnulacao}
                                    onClick={() => {
                                      setAnulandoLancamento(null);
                                      setMotivoAnulacao('');
                                    }}
                                    className="btn btn-ghost min-h-9 px-3 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </form>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </Sheet>
      )}
    </main>
  );
}
