'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import type { DiaAdvento, JanelaGrade, TipoAdvento } from '@/app/lib/advento';
import ModerationActions from '@/app/(app)/mural/_components/ModerationActions';
import Avatar from '@/app/ui/Avatar';
import LoopMedia from '@/app/ui/LoopMedia';
import { api, thumb, timeAgo, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';

const TIPOS: TipoAdvento[] = ['foto', 'receita', 'enquete', 'desafio', 'pergunta'];
const ROTULO: Record<TipoAdvento, string> = {
  foto: 'Foto',
  receita: 'Receita',
  enquete: 'Enquete',
  desafio: 'Desafio',
  pergunta: 'Pergunta',
};
const AJUDA: Record<TipoAdvento, string> = {
  foto: 'Mande uma foto e uma frase para a família.',
  receita: 'Escreva o modo de fazer. A foto do prato é por sua conta.',
  enquete: 'Escolha uma opção. Se mudar de ideia, é só votar de novo.',
  desafio: 'Mande a foto do desafio e uma frase.',
  pergunta: 'Conte a sua resposta. A foto fica por sua conta.',
};

function CampoFoto({ url, busy, onEscolheu, onTirou, rotulo }: {
  url: string | null;
  busy: boolean;
  onEscolheu: (file: File) => void;
  onTirou: () => void;
  rotulo: string;
}) {
  return (
    <div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb(url, 640)} alt="" className="mb-3 max-h-56 w-full rounded-[14px] object-cover" />
      )}
      <div className="flex flex-wrap gap-2">
        <label className="btn btn-ghost min-h-11 cursor-pointer">
          {url ? 'Trocar foto' : rotulo}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onEscolheu(file);
            }}
          />
        </label>
        {url && (
          <button type="button" className="btn btn-quiet min-h-11" disabled={busy} onClick={onTirou}>Tirar foto</button>
        )}
      </div>
    </div>
  );
}

export default function PainelDia({ resumo, onVoltar, onMudou }: {
  resumo: JanelaGrade;
  onVoltar: () => void;
  onMudou: (dia: DiaAdvento) => void;
}) {
  const toast = useToast();
  const [detalhe, setDetalhe] = useState<DiaAdvento | null>(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoAdvento>(resumo.tipo ?? 'pergunta');
  const [titulo, setTitulo] = useState(resumo.titulo ?? '');
  const [textoJanela, setTextoJanela] = useState(resumo.texto ?? '');
  const [opcoesTexto, setOpcoesTexto] = useState((resumo.opcoes ?? []).join('\n'));
  const [fotoJanela, setFotoJanela] = useState<string | null>(resumo.image_url);
  const mudou = useRef(onMudou);
  useEffect(() => { mudou.current = onMudou; }, [onMudou]);

  useEffect(() => {
    const dia = resumo.dia;
    let vivo = true;
    (async () => {
      try {
        const dados = await api<DiaAdvento>(`/api/advento/${dia}`);
        if (!vivo) return;
        setDetalhe(dados);
        setTipo(dados.tipo);
        setTitulo(dados.titulo);
        setTextoJanela(dados.texto);
        setOpcoesTexto((dados.opcoes ?? []).join('\n'));
        setFotoJanela(dados.image_url);
        if (!dados.abriu) {
          try {
            await api(`/api/advento/${dia}/abrir`, { method: 'POST' });
            if (!vivo) return;
            const aberto = { ...dados, abriu: true };
            setDetalhe(aberto);
            mudou.current(aberto);
          } catch {
            // A janela abre mesmo se a marca de "já abri" não gravar.
          }
        }
      } catch (error) {
        if (vivo) setErro((error as Error).message);
      }
    })();
    return () => { vivo = false; };
  }, [resumo.dia]);

  async function enviarFoto(file: File, destino: 'resposta' | 'janela') {
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (destino === 'resposta') setFoto(url);
      else setFotoJanela(url);
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function responder() {
    if (!detalhe || busy) return;
    setBusy(true);
    try {
      const dados = await api<DiaAdvento>(`/api/advento/${detalhe.dia}/resposta`, {
        method: 'POST',
        json: { texto, image_url: foto },
      });
      setDetalhe(dados);
      setTexto('');
      setFoto(null);
      onMudou(dados);
      toast('Resposta guardada.');
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function votar(opcao: string) {
    if (!detalhe || busy) return;
    setBusy(true);
    try {
      const dados = await api<DiaAdvento>(`/api/advento/${detalhe.dia}/voto`, { method: 'POST', json: { opcao } });
      setDetalhe(dados);
      onMudou(dados);
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function apagar(id: number, nome: string) {
    if (!detalhe || busy) return;
    if (!window.confirm(`Apagar a resposta de ${nome}?`)) return;
    setBusy(true);
    try {
      const dados = await api<DiaAdvento>(`/api/advento/respostas/${id}`, { method: 'DELETE' });
      setDetalhe(dados);
      onMudou(dados);
      toast('Resposta apagada.');
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function salvarJanela() {
    if (!detalhe || busy) return;
    setBusy(true);
    try {
      const dados = await api<DiaAdvento>(`/api/advento/janelas/${detalhe.dia}`, {
        method: 'PUT',
        json: {
          tipo,
          titulo,
          texto: textoJanela,
          image_url: fotoJanela,
          opcoes: tipo === 'enquete' ? opcoesTexto.split('\n') : null,
        },
      });
      setDetalhe(dados);
      setEditando(false);
      onMudou(dados);
      toast('Janela guardada.');
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  async function restaurar() {
    if (!detalhe || busy) return;
    if (!window.confirm('Voltar ao texto sugerido deste dia?')) return;
    setBusy(true);
    try {
      const dados = await api<DiaAdvento>(`/api/advento/janelas/${detalhe.dia}`, { method: 'DELETE' });
      setDetalhe(dados);
      setTipo(dados.tipo);
      setTitulo(dados.titulo);
      setTextoJanela(dados.texto);
      setOpcoesTexto((dados.opcoes ?? []).join('\n'));
      setFotoJanela(dados.image_url);
      setEditando(false);
      onMudou(dados);
      toast('Voltamos ao texto sugerido.');
    } catch (error) {
      toast((error as Error).message, 'erro');
    } finally {
      setBusy(false);
    }
  }

  if (erro) {
    return (
      <div className="surface px-5 py-10 text-center">
        <p className="display text-2xl">Essa janela não abriu</p>
        <p className="mt-2 text-sm text-marfim-3">{erro}</p>
        <button type="button" className="btn btn-ghost mt-6" onClick={onVoltar}>Voltar ao calendário</button>
      </div>
    );
  }
  if (!detalhe) {
    return (
      <div className="surface flex flex-col items-center py-16">
        <div className="mb-3 h-14 w-14">
          <LoopMedia name="mn-loader" className="h-full w-full" fallback={<span className="display text-2xl text-champagne">*</span>} />
        </div>
        <p className="kicker">Abrindo a janela {resumo.dia}</p>
      </div>
    );
  }

  const pedeFoto = detalhe.tipo === 'foto' || detalhe.tipo === 'desafio';
  const jaRespondeu = detalhe.respostas.some((item) => item.minha);

  return (
    <div>
      <button type="button" onClick={onVoltar} className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-marfim-2">
        <ChevronLeft size={18} strokeWidth={1.5} /> Voltar ao calendário
      </button>
      <p className="kicker">{ROTULO[detalhe.tipo]} · dia {detalhe.dia}</p>
      <h2 className="display mt-2 text-[2rem] text-balance text-marfim">{detalhe.titulo}</h2>
      {!detalhe.liberada && (
        <p className="mt-3 text-sm text-champagne">A família vê esta janela no dia {detalhe.dia} de dezembro. Você já pode deixar o texto e uma foto antiga.</p>
      )}
      {detalhe.texto && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-marfim-2">{detalhe.texto}</p>}
      {detalhe.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb(detalhe.image_url, 828)} alt={detalhe.titulo} className="mt-4 max-h-80 w-full rounded-[16px] object-cover" />
      )}

      {detalhe.liberada && detalhe.tipo === 'enquete' && (
        <div className="mt-6 space-y-2" role="radiogroup" aria-label={detalhe.titulo}>
          <p className="text-xs text-marfim-3">{detalhe.total_votos === 1 ? '1 voto' : `${detalhe.total_votos} votos`}</p>
          {detalhe.votos.map((item) => {
            const pct = detalhe.total_votos > 0 ? Math.round((item.total / detalhe.total_votos) * 100) : 0;
            const minha = detalhe.meu_voto === item.opcao;
            return (
              <button
                key={item.opcao}
                type="button"
                role="radio"
                aria-checked={minha}
                disabled={busy}
                onClick={() => { void votar(item.opcao); }}
                className={`min-h-11 w-full rounded-[14px] border px-3 py-2 text-left ${minha ? 'border-champagne bg-champagne/10' : 'border-linha'}`}
              >
                <span className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">{item.opcao}</span>
                  <span className="numeral shrink-0 text-champagne">{item.total}</span>
                </span>
                <span className="mt-2 block h-1 overflow-hidden rounded-full bg-carvao-3">
                  <span className="block h-full bg-champagne" style={{ width: `${pct}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {detalhe.liberada && detalhe.tipo !== 'enquete' && !jaRespondeu && (
        <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void responder(); }}>
          <p className="text-sm text-marfim-2">{AJUDA[detalhe.tipo]}</p>
          <label className="block text-sm">
            Sua resposta
            <textarea className="field mt-2 min-h-28" required maxLength={2000} value={texto} onChange={(event) => setTexto(event.target.value)} />
          </label>
          <CampoFoto
            url={foto}
            busy={busy}
            rotulo={pedeFoto ? 'Escolher foto' : 'Foto, se quiser'}
            onEscolheu={(file) => { void enviarFoto(file, 'resposta'); }}
            onTirou={() => setFoto(null)}
          />
          <button className="btn btn-primary w-full" disabled={busy || (pedeFoto && !foto)}>{busy ? 'Enviando...' : 'Enviar para a família'}</button>
        </form>
      )}

      {detalhe.liberada && detalhe.respostas.length > 0 && (
        <section className="mt-8" aria-label="Respostas da família">
          <div className="rule mb-4" />
          <p className="kicker mb-3">Respostas da família</p>
          <ul className="space-y-5">
            {detalhe.respostas.map((item) => (
              <li key={item.id} className="min-w-0">
                <div className="flex items-start gap-3">
                  <Avatar name={item.user_name} src={item.avatar_url} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-marfim">{item.user_name}</p>
                    <p className="text-xs text-marfim-3">{timeAgo(item.created_at)}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-marfim-2">{item.texto}</p>
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb(item.image_url, 828)} alt={`Foto de ${item.user_name}`} className="mt-3 max-h-80 w-full rounded-[14px] object-cover" />
                    )}
                  </div>
                </div>
                <div className="mt-2 pl-[52px]">
                  {!item.minha && (
                    <details>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm text-marfim-3">Opções</summary>
                      <ModerationActions userId={item.user_id} name={item.user_name} alvoTipo="advento" alvoId={item.id} />
                    </details>
                  )}
                  {(item.minha || detalhe.organizador) && (
                    <button type="button" className="btn btn-quiet min-h-11 px-0 text-sm" disabled={busy} onClick={() => { void apagar(item.id, item.user_name); }}>
                      <Trash2 size={15} strokeWidth={1.5} /> Apagar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detalhe.liberada && detalhe.tipo !== 'enquete' && detalhe.respostas.length === 0 && (
        <p className="mt-6 text-sm text-marfim-3">Seja a primeira pessoa da família a responder.</p>
      )}

      {detalhe.organizador && (
        <section className="mt-8">
          <div className="rule mb-4" />
          {!editando ? (
            <button type="button" className="btn btn-ghost w-full" onClick={() => setEditando(true)}>Preparar esta janela</button>
          ) : (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void salvarJanela(); }}>
              <p className="kicker">Preparar o dia {detalhe.dia}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo da janela">
                {TIPOS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="radio"
                    aria-checked={tipo === item}
                    className={`min-h-11 rounded-full border px-3 text-sm ${tipo === item ? 'border-champagne text-champagne' : 'border-linha text-marfim-2'}`}
                    onClick={() => setTipo(item)}
                  >
                    {ROTULO[item]}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                Título
                <input className="field mt-2" required maxLength={120} value={titulo} onChange={(event) => setTitulo(event.target.value)} />
              </label>
              <label className="block text-sm">
                Texto
                <textarea className="field mt-2 min-h-24" maxLength={2000} value={textoJanela} onChange={(event) => setTextoJanela(event.target.value)} />
              </label>
              {tipo === 'enquete' && (
                <label className="block text-sm">
                  Opções, uma por linha (de 2 a 6)
                  <textarea className="field mt-2 min-h-28" value={opcoesTexto} onChange={(event) => setOpcoesTexto(event.target.value)} />
                </label>
              )}
              <CampoFoto
                url={fotoJanela}
                busy={busy}
                rotulo="Foto antiga da família"
                onEscolheu={(file) => { void enviarFoto(file, 'janela'); }}
                onTirou={() => setFotoJanela(null)}
              />
              <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Guardando...' : 'Guardar janela'}</button>
              {detalhe.personalizada && (
                <button type="button" className="btn btn-quiet min-h-11 w-full" disabled={busy} onClick={() => { void restaurar(); }}>Voltar ao texto sugerido</button>
              )}
              <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={() => setEditando(false)}>Cancelar</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
