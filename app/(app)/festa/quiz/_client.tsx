'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Check,
  Clock,
  ImagePlus,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import Avatar from '@/app/ui/Avatar';
import PageHeader from '@/app/ui/PageHeader';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import type { QuizData, QuizQuestionItem } from '@/app/api/festa/quiz/_data';

const LETRAS = ['A', 'B', 'C', 'D'] as const;

export default function QuizClient({ initial }: { initial: QuizData }) {
  const me = useMe();
  const toast = useToast();

  const [data, setData] = useState<QuizData>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Cronometro local sincronizado com restante_ms do servidor
  const deadlineRef = useRef<number>(
    initial.state.status === 'aberta' ? Date.now() + initial.state.restante_ms : 0,
  );
  const [restanteMs, setRestanteMs] = useState<number>(initial.state.restante_ms);

  // Formulario do organizador para criar/editar pergunta
  const [editId, setEditId] = useState<number | null>(null);
  const [modelo, setModelo] = useState<string>('Quem disse isso?');
  const [pergunta, setPergunta] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<string[]>(['', '', '', '']);
  const [correta, setCorreta] = useState<number>(0);
  const [mostrarForm, setMostrarForm] = useState<boolean>(initial.perguntas.length === 0);

  const aplicarDados = useCallback((novo: QuizData) => {
    setData(novo);
    if (novo.state.status === 'aberta') {
      deadlineRef.current = Date.now() + novo.state.restante_ms;
      setRestanteMs(novo.state.restante_ms);
    } else {
      deadlineRef.current = 0;
      setRestanteMs(0);
    }
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const res = await api<QuizData>('/api/festa/quiz');
      aplicarDados(res);
    } catch {
      /* ignora falha pontual de polling */
    }
  }, [aplicarDados]);

  // Consulta a cada 2 s conforme requisito
  useEffect(() => {
    const id = window.setInterval(() => {
      void recarregar();
    }, 2000);
    return () => window.clearInterval(id);
  }, [recarregar]);

  // Atualizacao suave da barra de 20 s
  useEffect(() => {
    if (data.state.status !== 'aberta') return;
    const id = window.setInterval(() => {
      const falta = Math.max(0, deadlineRef.current - Date.now());
      setRestanteMs(falta);
    }, 150);
    return () => window.clearInterval(id);
  }, [data.state.status, data.state.question_id]);

  async function executarAcao(payload: Record<string, unknown>, msgOk?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api<QuizData>('/api/festa/quiz', {
        method: 'POST',
        json: payload,
      });
      aplicarDados(res);
      if (msgOk) toast(msgOk);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function responder(escolhaIdx: number) {
    const q = data.pergunta_atual;
    if (!q || q.minha_resposta || busy) return;
    await executarAcao(
      { acao: 'responder', question_id: q.id, escolha: escolhaIdx },
      'Resposta registrada!',
    );
  }

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast('Foto enviada.');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setUploading(false);
    }
  }

  function escolherModelo(m: string) {
    setModelo(m);
    if (!pergunta.trim()) {
      if (m === 'Quem disse isso?') setPergunta('Quem disse a frase: ""?');
      else if (m === 'Que ano foi essa foto?') setPergunta('Em que ano foi tirada esta foto da família?');
      else if (m === 'Quem é o bebê da foto?') setPergunta('Quem é este bebê fofo da foto?');
    }
  }

  function iniciarEdicao(q: QuizQuestionItem) {
    setEditId(q.id);
    setModelo(q.modelo || '');
    setPergunta(q.pergunta);
    setImageUrl(q.image_url);
    setOpcoes(q.opcoes.length >= 2 ? [...q.opcoes] : ['', '']);
    setCorreta(q.correta ?? 0);
    setMostrarForm(true);
  }

  function limparForm() {
    setEditId(null);
    setPergunta('');
    setImageUrl(null);
    setOpcoes(['', '', '', '']);
    setCorreta(0);
  }

  async function salvarPergunta(e: React.FormEvent) {
    e.preventDefault();
    const limpas = opcoes.map((o) => o.trim()).filter(Boolean);
    if (limpas.length < 2) {
      toast('Preencha pelo menos 2 alternativas.', 'erro');
      return;
    }
    const indiceCerto = Math.min(correta, limpas.length - 1);
    setBusy(true);
    try {
      const res = await api<QuizData>('/api/festa/quiz', {
        method: 'POST',
        json: {
          acao: editId ? 'editar_pergunta' : 'criar_pergunta',
          id: editId ?? undefined,
          modelo,
          pergunta,
          image_url: imageUrl,
          opcoes: limpas,
          correta: indiceCerto,
        },
      });
      aplicarDados(res);
      limparForm();
      toast(editId ? 'Pergunta atualizada!' : 'Pergunta adicionada ao quiz!');
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  const segundos = Math.ceil(restanteMs / 1000);
  const progressoTempo = Math.max(
    0,
    Math.min(100, (restanteMs / (data.duracao_segundos * 1000)) * 100),
  );
  const temProximaPendente = data.perguntas.some((q) => !q.encerrada);
  const qAtual = data.pergunta_atual;

  return (
    <div className="pb-nav">
      <PageHeader kicker="Jogos da Ceia" title="Quiz da Família" back="/festa" />

      {/* Atalhos entre os 3 jogos da ceia */}
      <nav aria-label="Jogos da ceia" className="mb-5 flex gap-2 overflow-x-auto px-5 no-scrollbar">
        <Link href="/festa/quiz" className="btn btn-primary min-h-11 shrink-0 px-4 text-xs">
          Quiz da Família
        </Link>
        <Link href="/festa/bingo" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Bingo da Ceia
        </Link>
        <Link href="/festa/enquete" className="btn btn-ghost min-h-11 shrink-0 px-4 text-xs">
          Enquete ao Vivo
        </Link>
      </nav>

      <div className="space-y-6 px-5">
        {/* PAINEL AO VIVO: PERGUNTA ABERTA OU REVELADA */}
        {(data.state.status === 'aberta' || data.state.status === 'revelada') && qAtual && (
          <section className="rise surface space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="kicker">
                  Pergunta {qAtual.numero} de {qAtual.total}
                  {qAtual.modelo ? ` : ${qAtual.modelo}` : ''}
                </p>
              </div>
              {data.state.status === 'aberta' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cereja/60 bg-cereja/15 px-3 py-1 text-xs font-semibold text-marfim">
                  <Clock size={14} className="text-champagne" />
                  <span className="numeral text-sm">{segundos}s</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/50 bg-carvao-3 px-3 py-1 text-xs font-semibold text-champagne">
                  Resposta revelada
                </span>
              )}
            </div>

            {data.state.status === 'aberta' && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-carvao-3">
                <div
                  className="h-full bg-cereja transition-all duration-150"
                  style={{ width: `${progressoTempo}%` }}
                />
              </div>
            )}

            <h2 className="display text-2xl text-marfim">{qAtual.pergunta}</h2>

            {qAtual.image_url && (
              <div className="overflow-hidden rounded-2xl border border-linha bg-carvao-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb(qAtual.image_url, 640)}
                  alt="Foto da pergunta"
                  className="max-h-72 w-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2.5 pt-1">
              {qAtual.opcoes.map((texto, idx) => {
                const escolhida = qAtual.minha_resposta?.escolha === idx;
                const revelada = data.state.status === 'revelada' && qAtual.correta !== null;
                const ehCorreta = revelada && qAtual.correta === idx;
                const erreiEsta = revelada && escolhida && qAtual.correta !== idx;

                let cls = 'border-linha-forte bg-carvao-3 text-marfim';
                if (ehCorreta) {
                  cls = 'border-champagne bg-salvia/30 text-marfim ring-1 ring-champagne';
                } else if (erreiEsta) {
                  cls = 'border-cereja bg-cereja/20 text-marfim';
                } else if (escolhida) {
                  cls = 'border-champagne bg-carvao-3 text-champagne ring-1 ring-champagne/60';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={
                      data.state.status !== 'aberta' ||
                      Boolean(qAtual.minha_resposta) ||
                      restanteMs <= 0 ||
                      busy
                    }
                    onClick={() => void responder(idx)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${cls}`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="display inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-carvao text-xs text-champagne">
                        {LETRAS[idx] ?? idx + 1}
                      </span>
                      <span>{texto}</span>
                    </span>
                    {ehCorreta && <Check size={18} className="shrink-0 text-champagne" />}
                    {!revelada && escolhida && (
                      <span className="text-xs text-champagne">Sua escolha</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status da resposta do participante */}
            {data.state.status === 'aberta' && qAtual.minha_resposta && (
              <p className="rounded-xl bg-carvao-3 px-4 py-3 text-center text-xs text-marfim-2">
                Resposta registrada! A alternativa certa e os pontos aparecem assim que a pergunta encerrar.
              </p>
            )}

            {data.state.status === 'revelada' && (
              <div className="space-y-3 rounded-2xl border border-linha bg-carvao-3 p-4">
                {qAtual.minha_resposta ? (
                  <p className="text-sm font-medium text-marfim">
                    {qAtual.minha_resposta.acertou ? (
                      <span className="text-champagne">
                        Você acertou e somou +{qAtual.minha_resposta.pontos ?? 0} pontos!
                      </span>
                    ) : (
                      <span className="text-marfim-2">
                        Quase! Você não marcou ponto nesta pergunta.
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-marfim-3">Você não respondeu a tempo nesta rodada.</p>
                )}

                {qAtual.respostas_reveladas.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="kicker">Respostas da rodada</p>
                    <ul className="divide-y divide-linha">
                      {qAtual.respostas_reveladas.map((r) => (
                        <li key={r.user_id} className="flex items-center justify-between py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Avatar name={r.name} src={r.avatar_url} size={26} />
                            <span className="text-marfim">{r.name}</span>
                            <span className="text-marfim-3">
                              ({(r.tempo_ms / 1000).toFixed(1)}s)
                            </span>
                          </div>
                          <span
                            className={
                              r.acertou ? 'font-semibold text-champagne' : 'text-marfim-3'
                            }
                          >
                            {r.acertou ? `+${r.pontos} pts` : 'Errou'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-marfim-3">
              <span>{qAtual.total_respostas} pessoa(s) já responderam</span>
              <span>Atualiza a cada 2 s</span>
            </div>

            {/* Controles ao vivo do organizador */}
            {me.is_admin && (
              <div className="space-y-2 border-t border-linha pt-3">
                <p className="kicker">Controle do organizador</p>
                <div className="flex flex-wrap gap-2">
                  {data.state.status === 'aberta' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void executarAcao(
                          { acao: 'encerrar_pergunta' },
                          'Pergunta encerrada e resposta revelada!',
                        )
                      }
                      className="btn btn-primary flex-1 text-sm"
                    >
                      Encerrar e revelar resposta
                    </button>
                  ) : (
                    <>
                      {temProximaPendente && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void executarAcao(
                              { acao: 'abrir_pergunta', notificar: false },
                              'Próxima pergunta aberta!',
                            )
                          }
                          className="btn btn-primary flex-1 text-sm"
                        >
                          <Play size={16} /> Abrir próxima pergunta
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void executarAcao({ acao: 'mostrar_podio' }, 'Pódio final aberto!')
                        }
                        className="btn btn-ghost flex-1 text-sm"
                      >
                        <Trophy size={16} /> Mostrar pódio final
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* PODIO FINAL */}
        {data.state.status === 'podio' && (
          <section className="rise surface space-y-5 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-carvao-3 text-champagne">
              <Trophy size={24} />
            </div>
            <div>
              <p className="kicker">Fim de jogo</p>
              <h2 className="display mt-1 text-3xl text-marfim">Pódio da Família</h2>
              <p className="mt-1 text-xs text-marfim-2">
                Quem conhece melhor as histórias e fotos do nosso Natal
              </p>
            </div>

            {data.placar.length === 0 ? (
              <p className="py-4 text-sm text-marfim-3">Nenhuma resposta registrada nesta rodada.</p>
            ) : (
              <div className="grid grid-cols-3 items-end gap-2 pt-2">
                {[1, 0, 2].map((posIdx) => {
                  const p = data.placar[posIdx];
                  if (!p) return <div key={posIdx} />;
                  const lugar = posIdx + 1;
                  const altura = lugar === 1 ? 'py-5' : lugar === 2 ? 'py-3.5' : 'py-2.5';
                  return (
                    <div
                      key={p.user_id}
                      className={`flex flex-col items-center rounded-2xl border ${
                        lugar === 1
                          ? 'border-champagne bg-carvao-3'
                          : 'border-linha bg-carvao-3/60'
                      } px-2 ${altura}`}
                    >
                      <span className="kicker mb-2">{lugar}º lugar</span>
                      <Avatar name={p.name} src={p.avatar_url} size={lugar === 1 ? 54 : 42} ring={lugar === 1} />
                      <p className="mt-2 line-clamp-1 text-xs font-semibold text-marfim">
                        {p.name}
                      </p>
                      <p className="numeral mt-1 text-lg text-champagne">{p.pontos}</p>
                      <p className="text-[11px] text-marfim-3">{p.acertos} acerto(s)</p>
                    </div>
                  );
                })}
              </div>
            )}

            {me.is_admin && (
              <div className="flex flex-wrap gap-2 border-t border-linha pt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void executarAcao({ acao: 'voltar_preparacao' })}
                  className="btn btn-ghost flex-1 text-xs"
                >
                  Gerenciar perguntas
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Zerar pontuações e reiniciar o quiz para jogar de novo?')) {
                      void executarAcao({ acao: 'reiniciar_quiz' }, 'Quiz reiniciado!');
                    }
                  }}
                  className="btn btn-quiet text-xs"
                >
                  <RotateCcw size={15} /> Reiniciar placar
                </button>
              </div>
            )}
          </section>
        )}

        {/* SALA DE ESPERA QUANDO EM PREPARACAO */}
        {data.state.status === 'preparando' && (
          <section className="rise surface space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="kicker">Ao vivo na ceia</p>
                <h2 className="display mt-1 text-2xl">Preparando a rodada</h2>
              </div>
              <Sparkles size={22} className="shrink-0 text-champagne" />
            </div>
            <p className="text-sm text-marfim-2">
              Quando quem organiza abrir a pergunta, ela aparece aqui automaticamente. Você terá{' '}
              <strong className="text-marfim">20 segundos</strong> para responder e ganhar pontos por acerto e rapidez!
            </p>
            <div className="flex items-center justify-between rounded-2xl bg-carvao-3 px-4 py-3 text-xs text-marfim-2">
              <span>Perguntas prontas para hoje</span>
              <span className="numeral text-base text-champagne">{data.perguntas.length}</span>
            </div>

            {me.is_admin && data.perguntas.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || !temProximaPendente}
                  onClick={() =>
                    void executarAcao(
                      { acao: 'abrir_pergunta', notificar: true },
                      'Quiz iniciado! Pergunta na tela.',
                    )
                  }
                  className="btn btn-primary w-full"
                >
                  <Play size={17} /> Abrir próxima pergunta ao vivo (avisa a família)
                </button>
                {!temProximaPendente && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void executarAcao({ acao: 'mostrar_podio' })}
                    className="btn btn-ghost w-full text-sm"
                  >
                    <Trophy size={16} /> Ver pódio final
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* PLACAR AO VIVO */}
        <section className="rise surface space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">Classificação</p>
              <h2 className="display text-xl">Placar ao vivo</h2>
            </div>
            <Award size={20} className="text-champagne" />
          </div>

          {data.placar.length === 0 ? (
            <p className="text-sm text-marfim-3">
              O placar aparece assim que a primeira pergunta for encerrada.
            </p>
          ) : (
            <ul className="divide-y divide-linha">
              {data.placar.map((item, idx) => (
                <li key={item.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="numeral w-5 text-sm text-champagne">{idx + 1}º</span>
                    <Avatar name={item.name} src={item.avatar_url} size={36} ring={idx === 0} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-marfim">{item.name}</p>
                      <p className="text-xs text-marfim-3">
                        {item.acertos} acerto(s) · média {(item.tempo_medio_ms / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="numeral text-lg text-champagne">{item.pontos}</p>
                    <p className="text-[11px] text-marfim-3">pontos</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* AREA DO ORGANIZADOR: CRIAR E EDITAR PERGUNTAS */}
        {me.is_admin && (
          <section className="rise space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">Só quem organiza</p>
                <h2 className="display text-2xl">Perguntas ({data.perguntas.length})</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (mostrarForm) limparForm();
                  setMostrarForm((v) => !v);
                }}
                className="btn btn-ghost px-4 text-xs"
              >
                {mostrarForm ? 'Fechar formulário' : 'Nova pergunta'}
              </button>
            </div>

            {mostrarForm && (
              <form onSubmit={(e) => void salvarPergunta(e)} className="surface space-y-4 p-5">
                <p className="kicker">{editId ? 'Editar pergunta' : 'Criar pergunta'}</p>

                <div className="space-y-1.5">
                  <span className="text-xs text-marfim-2">Modelos prontos</span>
                  <div className="flex flex-wrap gap-2">
                    {[...data.modelos, 'Pergunta livre'].map((m) => {
                      const val = m === 'Pergunta livre' ? '' : m;
                      const ativo = modelo === val;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => escolherModelo(val)}
                          className={`btn min-h-10 px-3 text-xs ${
                            ativo ? 'btn-primary' : 'btn-ghost'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1 text-xs text-marfim-2">
                  <span>Pergunta</span>
                  <input
                    className="field"
                    placeholder="Ex.: Quem dormiu no sofá na ceia de 2023?"
                    value={pergunta}
                    onChange={(e) => setPergunta(e.target.value)}
                    maxLength={300}
                    required
                  />
                </label>

                <div className="space-y-2">
                  <span className="block text-xs text-marfim-2">Foto opcional</span>
                  {imageUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-linha bg-carvao-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb(imageUrl, 384)}
                        alt="Preview"
                        className="max-h-48 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl(null)}
                        className="btn btn-quiet absolute right-2 top-2 rounded-full bg-carvao/80 p-2"
                        aria-label="Remover foto"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="btn btn-ghost w-full cursor-pointer text-xs">
                      <ImagePlus size={16} />
                      {uploading ? 'Enviando foto...' : 'Escolher foto da galeria'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => void handleUploadFoto(e)}
                      />
                    </label>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-marfim-2">
                      Alternativas (2 a 4) : marque a certa
                    </span>
                    {opcoes.length < 4 && (
                      <button
                        type="button"
                        onClick={() => setOpcoes((xs) => [...xs, ''])}
                        className="text-xs font-medium text-champagne"
                      >
                        + Adicionar opção
                      </button>
                    )}
                  </div>

                  {opcoes.map((op, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCorreta(idx)}
                        aria-label={`Marcar alternativa ${LETRAS[idx]} como correta`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition ${
                          correta === idx
                            ? 'border-champagne bg-cereja text-marfim'
                            : 'border-linha bg-carvao-3 text-marfim-3'
                        }`}
                      >
                        {correta === idx ? <Check size={16} /> : LETRAS[idx]}
                      </button>
                      <input
                        className="field"
                        placeholder={`Alternativa ${LETRAS[idx]}`}
                        value={op}
                        onChange={(e) =>
                          setOpcoes((xs) => xs.map((item, i) => (i === idx ? e.target.value : item)))
                        }
                        maxLength={120}
                        required={idx < 2}
                      />
                      {opcoes.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpcoes((xs) => xs.filter((_, i) => i !== idx));
                            if (correta >= idx && correta > 0) setCorreta((c) => c - 1);
                          }}
                          className="btn btn-quiet px-2"
                          aria-label="Remover alternativa"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={busy || uploading} className="btn btn-primary flex-1">
                    <Plus size={16} /> {editId ? 'Salvar alterações' : 'Adicionar pergunta'}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      onClick={limparForm}
                      className="btn btn-ghost px-4 text-xs"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            )}

            {data.perguntas.length > 0 && (
              <ul className="space-y-2.5">
                {data.perguntas.map((q, idx) => (
                  <li key={q.id} className="surface space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="kicker">
                          #{idx + 1} {q.modelo ? `· ${q.modelo}` : ''}{' '}
                          {q.encerrada ? '· Já encerrada' : '· Pendente'}
                        </p>
                        <p className="mt-1 font-medium text-marfim">{q.pergunta}</p>
                        <p className="mt-0.5 text-xs text-marfim-3">
                          {q.opcoes.length} opções · {q.total_respostas} resposta(s)
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void executarAcao(
                              { acao: 'abrir_pergunta', question_id: q.id, notificar: true },
                              `Pergunta #${idx + 1} aberta ao vivo!`,
                            )
                          }
                          className="btn btn-ghost min-h-10 px-3 text-xs"
                        >
                          <Play size={14} /> Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(q)}
                          className="btn btn-quiet min-h-10 px-2.5 text-xs"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Excluir esta pergunta do quiz?')) {
                              void executarAcao(
                                { acao: 'excluir_pergunta', id: q.id },
                                'Pergunta removida.',
                              );
                            }
                          }}
                          className="btn btn-quiet min-h-10 px-2 text-marfim-3"
                          aria-label="Excluir pergunta"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {data.perguntas.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Deseja reiniciar todas as perguntas e zerar o placar desta edição?',
                    )
                  ) {
                    void executarAcao({ acao: 'reiniciar_quiz' }, 'Rodada reiniciada!');
                  }
                }}
                className="btn btn-quiet w-full text-xs"
              >
                <RotateCcw size={15} /> Reiniciar todas as perguntas e placar
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
