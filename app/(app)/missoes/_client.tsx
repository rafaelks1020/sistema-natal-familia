'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Camera,
  Check,
  Clock,
  Flame,
  MessageSquare,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import Avatar from '@/app/ui/Avatar';
import { api, thumb, timeAgo, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { Loading, Sheet } from '../familia/_components/shared';
import type { Missao, PainelMissoes, RespostaMissao } from '@/app/lib/gamificacao/tipos';
import {
  ROTULOS_TIPO_MISSAO,
  calcularContagemRegressiva,
  formatarDataHoraSP,
  validarRespostaMissao,
} from '../pontos/_logica';

function ContagemMissao({
  terminaEm,
  onEncerrou,
}: {
  terminaEm: string;
  onEncerrou: () => void;
}) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const c = calcularContagemRegressiva(terminaEm, agora);

  useEffect(() => {
    if (!c.encerrado) return;
    const t = window.setTimeout(() => onEncerrou(), 1500);
    return () => window.clearTimeout(t);
  }, [c.encerrado, onEncerrou]);

  if (c.encerrado) {
    return (
      <p className="rounded-xl border border-linha bg-carvao-3 px-3 py-2 text-center text-xs text-marfim-2">
        O tempo desta missão acabou de encerrar.
      </p>
    );
  }

  const partes = [
    ['dias', String(c.dias)],
    ['horas', String(c.horas).padStart(2, '0')],
    ['min', String(c.minutos).padStart(2, '0')],
    ['seg', String(c.segundos).padStart(2, '0')],
  ] as const;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs text-champagne">
        <Clock size={13} strokeWidth={1.6} aria-hidden />
        Termina em {formatarDataHoraSP(terminaEm)}
      </p>
      <div className="grid grid-cols-4 gap-2" aria-label="Tempo restante da missão">
        {partes.map(([rotulo, valor]) => (
          <div
            key={rotulo}
            className="rounded-xl border border-linha bg-carvao-3 px-2 py-2.5 text-center"
          >
            <span className="numeral block text-xl leading-none text-marfim">{valor}</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-marfim-3">
              {rotulo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaleriaRespostas({
  respostas,
  onAbrirFoto,
}: {
  respostas: RespostaMissao[];
  onAbrirFoto: (r: RespostaMissao) => void;
}) {
  if (respostas.length === 0) {
    return (
      <p className="rounded-xl border border-linha bg-carvao-3/40 p-4 text-xs text-marfim-3">
        Ninguém da família respondeu ainda. Seja a primeira pessoa!
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
      {respostas.map((r) => (
        <li
          key={r.id}
          className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-carvao-3/60 ${
            r.minha ? 'border-champagne/50' : 'border-linha'
          }`}
        >
          {r.image_url && (
            <button
              type="button"
              onClick={() => onAbrirFoto(r)}
              className="block w-full overflow-hidden bg-carvao text-left"
              aria-label={`Ampliar foto de ${r.nome}`}
            >
              <img
                src={thumb(r.image_url, 640)}
                alt={r.texto || `Resposta de ${r.nome}`}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition duration-300 hover:scale-[1.02]"
              />
            </button>
          )}
          <div className="space-y-2 p-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={r.nome} src={r.avatar_url} size={30} ring={r.minha} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-marfim">
                  {r.nome}
                  {r.minha ? ' (você)' : ''}
                </p>
                <p className="text-[11px] text-marfim-3">{timeAgo(r.created_at)}</p>
              </div>
            </div>
            {r.texto && (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">
                {r.texto}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CartaoMissaoAtiva({
  missao,
  onRespondeu,
  onAbrirFoto,
}: {
  missao: Missao;
  onRespondeu: () => void;
  onAbrirFoto: (r: RespostaMissao) => void;
}) {
  const toast = useToast();
  const [texto, setTexto] = useState(missao.minha_resposta?.texto ?? '');
  const [imageUrl, setImageUrl] = useState(missao.minha_resposta?.image_url ?? '');
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reenviar, setReenviar] = useState(false);

  const pedeFoto = missao.tipo === 'foto' || missao.tipo === 'foto_texto';
  const pedeTexto = missao.tipo === 'texto' || missao.tipo === 'foto_texto';

  const minha = missao.minha_resposta;
  const mostrarFormulario = !minha || (minha.status === 'recusada' && reenviar);

  async function escolherArquivo(file: File | undefined) {
    if (!file) return;
    setSubindoFoto(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast('Foto pronta para enviar!');
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      setSubindoFoto(false);
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const validacao = validarRespostaMissao(missao.tipo, texto, imageUrl);
    if (!validacao.ok) {
      toast(validacao.erro ?? 'Preencha a sua resposta.', 'erro');
      return;
    }
    setEnviando(true);
    try {
      const corpo: { texto?: string; image_url?: string } = {};
      if (pedeTexto && texto.trim()) corpo.texto = texto.trim();
      if (pedeFoto && imageUrl.trim()) corpo.image_url = imageUrl.trim();
      await api(`/api/missoes/${missao.id}/responder`, {
        method: 'POST',
        json: corpo,
      });
      toast(`Missão respondida! +${missao.pontos} pontos.`);
      setReenviar(false);
      onRespondeu();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <article className="surface space-y-5 border border-champagne p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cereja/60 bg-cereja/20 px-3 py-1 text-xs font-semibold text-marfim">
          <Flame size={14} className="text-cereja" aria-hidden />
          Missão relâmpago ativa
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-linha bg-carvao-3 px-2.5 py-0.5 text-[11px] text-marfim-2">
            {ROTULOS_TIPO_MISSAO[missao.tipo]}
          </span>
          <span className="numeral rounded-full border border-champagne/60 bg-carvao-3 px-3 py-0.5 text-sm font-semibold text-champagne">
            +{missao.pontos} pts
          </span>
        </div>
      </div>

      <div>
        <h2 className="display text-3xl leading-tight text-marfim">{missao.titulo}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">
          {missao.descricao}
        </p>
      </div>

      <ContagemMissao terminaEm={missao.termina_em} onEncerrou={onRespondeu} />

      {/* Estado da minha resposta ou formulário */}
      {minha && minha.status === 'aprovada' ? (
        <div className="rounded-2xl border border-champagne/50 bg-carvao-3/80 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-champagne">
            <Check size={16} strokeWidth={2} aria-hidden />
            Você já cumpriu esta missão! (+{missao.pontos} pts)
          </p>
          {minha.image_url && (
            <img
              src={thumb(minha.image_url, 640)}
              alt="Sua foto enviada"
              className="mt-3 max-h-52 rounded-xl border border-linha object-cover"
            />
          )}
          {minha.texto && (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-marfim-2">
              {minha.texto}
            </p>
          )}
        </div>
      ) : minha && minha.status === 'recusada' && !reenviar ? (
        <div className="space-y-3 rounded-2xl border border-cereja/60 bg-carvao-3/80 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-cereja">
            <AlertCircle size={16} strokeWidth={1.8} aria-hidden />
            Sua resposta foi recusada pela organização
          </p>
          {minha.motivo_recusa && (
            <p className="text-xs leading-relaxed text-marfim-2">
              Motivo: {minha.motivo_recusa}
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost w-full text-xs"
            onClick={() => setReenviar(true)}
          >
            Enviar nova resposta
          </button>
        </div>
      ) : null}

      {mostrarFormulario && (
        <form onSubmit={(e) => void enviar(e)} className="space-y-4 border-t border-linha pt-4">
          {pedeFoto && (
            <div className="space-y-2">
              <label className="block text-sm text-marfim-2">
                <span className="inline-flex items-center gap-1.5">
                  <Camera size={16} className="text-champagne" aria-hidden />
                  Foto da missão
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={subindoFoto || enviando}
                  onChange={(e) => void escolherArquivo(e.target.files?.[0])}
                  className="field mt-2 text-sm"
                />
              </label>
              {subindoFoto && (
                <p className="text-xs text-champagne" role="status">
                  Comprimindo e enviando a foto...
                </p>
              )}
              {imageUrl && (
                <div className="relative inline-block">
                  <img
                    src={thumb(imageUrl, 640)}
                    alt="Prévia da foto da missão"
                    className="max-h-52 rounded-xl border border-champagne/40 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="btn btn-quiet mt-1 text-xs text-marfim-3"
                  >
                    Trocar foto
                  </button>
                </div>
              )}
            </div>
          )}

          {pedeTexto && (
            <label className="block text-sm text-marfim-2">
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare size={16} className="text-champagne" aria-hidden />
                {missao.tipo === 'foto_texto' ? 'Conte a história da foto' : 'Sua resposta'}
              </span>
              <textarea
                rows={3}
                maxLength={600}
                disabled={enviando}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escreva aqui para a família..."
                className="field mt-2"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={enviando || subindoFoto}
            className="btn btn-primary w-full"
          >
            <Send size={17} strokeWidth={1.6} aria-hidden />
            {enviando
              ? 'Enviando resposta...'
              : `Responder e ganhar +${missao.pontos} pts`}
          </button>
        </form>
      )}

      {/* Galeria da missão ativa */}
      <div className="space-y-3 border-t border-linha pt-4">
        <div className="flex items-center justify-between">
          <h3 className="kicker">Respostas da família</h3>
          <span className="text-xs text-marfim-3">
            {missao.total_respostas}{' '}
            {missao.total_respostas === 1 ? 'participação' : 'participações'}
          </span>
        </div>
        <GaleriaRespostas respostas={missao.respostas} onAbrirFoto={onAbrirFoto} />
      </div>
    </article>
  );
}

export default function MissoesClient() {
  const [painel, setPainel] = useState<PainelMissoes | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [fotoAberta, setFotoAberta] = useState<RespostaMissao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await api<PainelMissoes>('/api/missoes');
      setPainel(dados);
      setErro('');
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível carregar as missões.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="pb-12">
      <PageHeader
        kicker={painel ? `Edição ${painel.ano}` : 'Natal em Família'}
        title="Missões Relâmpago"
        back="/"
        action={
          <Link href="/pontos" className="btn btn-quiet text-xs">
            <Trophy size={15} className="text-champagne" aria-hidden />
            Pontos
          </Link>
        }
      />

      <div className="space-y-8 px-5">
        <p className="text-sm leading-relaxed text-marfim-2">
          Desafios surpresa que aparecem a qualquer momento. Quem responde dentro do prazo ganha pontos na hora e compartilha memórias com a família.
        </p>

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
            {/* Missões ativas em destaque */}
            <section aria-labelledby="sec-ativas" className="space-y-4">
              <h2 id="sec-ativas" className="kicker">
                Valendo agora
              </h2>
              {painel.ativas.length === 0 ? (
                <div className="surface space-y-3 p-6 text-center">
                  <Sparkles className="mx-auto text-champagne" size={28} strokeWidth={1.5} />
                  <h3 className="display text-2xl text-marfim">
                    Nenhuma missão ativa neste instante
                  </h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-marfim-3">
                    As missões relâmpago são sorteadas de surpresa ao longo do mês. Fique de olho nos avisos do app!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {painel.ativas.map((m) => (
                    <CartaoMissaoAtiva
                      key={m.id}
                      missao={m}
                      onRespondeu={() => void carregar()}
                      onAbrirFoto={setFotoAberta}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Missões passadas e galeria da família */}
            <section aria-labelledby="sec-passadas" className="space-y-4">
              <div>
                <p className="kicker">Memórias guardadas</p>
                <h2 id="sec-passadas" className="display mt-1 text-3xl">
                  Missões passadas
                </h2>
              </div>

              {painel.passadas.length === 0 ? (
                <p className="surface p-5 text-sm text-marfim-2">
                  As missões encerradas e todas as respostas da família vão ficar guardadas aqui.
                </p>
              ) : (
                <div className="space-y-5">
                  {painel.passadas.map((m) => (
                    <article key={m.id} className="surface space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-xs text-marfim-3">
                            Encerrada em {formatarDataHoraSP(m.termina_em)}
                          </span>
                          <h3 className="display mt-1 text-2xl text-marfim">{m.titulo}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.minha_resposta?.status === 'aprovada' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-champagne/50 bg-carvao-3 px-2.5 py-0.5 text-[11px] text-champagne">
                              <Check size={12} strokeWidth={2} aria-hidden />
                              Participou
                            </span>
                          )}
                          <span className="numeral rounded-full border border-linha bg-carvao-3 px-2.5 py-0.5 text-xs text-marfim-2">
                            {m.pontos} pts
                          </span>
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">
                        {m.descricao}
                      </p>

                      <div className="space-y-3 border-t border-linha pt-3">
                        <p className="text-xs text-marfim-3">
                          {m.total_respostas}{' '}
                          {m.total_respostas === 1
                            ? 'resposta da família'
                            : 'respostas da família'}
                        </p>
                        <GaleriaRespostas
                          respostas={m.respostas}
                          onAbrirFoto={setFotoAberta}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Visualizador de foto ampliada */}
      {fotoAberta && (
        <Sheet title={`Foto de ${fotoAberta.nome}`} onClose={() => setFotoAberta(null)}>
          <div className="space-y-4">
            {fotoAberta.image_url && (
              <img
                src={thumb(fotoAberta.image_url, 1280, 85)}
                alt={fotoAberta.texto || `Foto de ${fotoAberta.nome}`}
                className="mx-auto max-h-[65dvh] w-full rounded-2xl border border-linha object-contain"
              />
            )}
            <div className="flex items-center gap-3">
              <Avatar name={fotoAberta.nome} src={fotoAberta.avatar_url} size={36} />
              <div>
                <p className="text-sm font-medium text-marfim">{fotoAberta.nome}</p>
                <p className="text-xs text-marfim-3">
                  {formatarDataHoraSP(fotoAberta.created_at)}
                </p>
              </div>
            </div>
            {fotoAberta.texto && (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">
                {fotoAberta.texto}
              </p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
