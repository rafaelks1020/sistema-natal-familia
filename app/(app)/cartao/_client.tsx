'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, ImagePlus, Loader2, Send, Share2 } from 'lucide-react';
import PageHeader from '@/app/ui/PageHeader';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { ehArquivoNosso } from '@/app/lib/hosts-arquivos';
import { useToast } from '@/app/ui/toast';
import { useMe } from '@/app/ui/user';
import { FRASES, MAX_ASSINATURA, MAX_TEXTO, MODELOS, queryCartao, type ModeloId } from '@/app/api/cartao/_modelo';

const ehBlob = (u: string | null | undefined): u is string => ehArquivoNosso(u);

export default function CartaoClient() {
  const me = useMe();
  const toast = useToast();
  const router = useRouter();
  const [fotos, setFotos] = useState<string[]>([]);
  const [foto, setFoto] = useState<string | null>(ehBlob(me.avatar_url) ? me.avatar_url : null);
  const [modelo, setModelo] = useState<ModeloId>('meia-noite');
  const [frase, setFrase] = useState<string>(FRASES[0]);
  const [propria, setPropria] = useState(false);
  const [assinatura, setAssinatura] = useState(me.name.slice(0, MAX_ASSINATURA));
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<'baixar' | 'compartilhar' | 'mural' | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ avatar: string | null; fotos: string[] }>('/api/cartao/fotos')
      .then((r) => {
        setFotos(r.fotos);
        setFoto((atual) => atual ?? r.fotos[0] ?? null);
      })
      .catch(() => {});
  }, []);

  // A prévia espera a pessoa parar de digitar para não gerar uma imagem a cada letra.
  const [pronto, setPronto] = useState({ foto, modelo, frase, assinatura });
  useEffect(() => {
    const t = setTimeout(() => setPronto({ foto, modelo, frase, assinatura }), 500);
    return () => clearTimeout(t);
  }, [foto, modelo, frase, assinatura]);

  const urlImagem = useMemo(
    () => (pronto.foto ? `/api/cartao/imagem?${queryCartao({ foto: pronto.foto, modelo: pronto.modelo, texto: pronto.frase, assinatura: pronto.assinatura })}` : null),
    [pronto],
  );
  useEffect(() => {
    setCarregando(!!urlImagem);
    setFalhou(false);
  }, [urlImagem]);

  const miniaturas = useMemo(() => {
    const lista = [...fotos];
    if (ehBlob(me.avatar_url) && !lista.includes(me.avatar_url)) lista.unshift(me.avatar_url);
    return lista;
  }, [fotos, me.avatar_url]);

  async function enviarNova(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setEnviando(true);
    try {
      const url = await uploadImage(f);
      setFotos((xs) => [url, ...xs]);
      setFoto(url);
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  const buscarPng = useCallback(async (): Promise<Blob> => {
    if (!foto) throw new Error('Escolha uma foto primeiro.');
    const res = await fetch(`/api/cartao/imagem?${queryCartao({ foto, modelo, texto: frase, assinatura })}`, { cache: 'no-store' });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error(d?.error || 'Não deu para montar o cartão. Tente de novo.');
    }
    return res.blob();
  }, [foto, modelo, frase, assinatura]);

  function salvarArquivo(blob: Blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cartao-de-natal.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function baixar() {
    setOcupado('baixar');
    try {
      salvarArquivo(await buscarPng());
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      setOcupado(null);
    }
  }

  async function compartilhar() {
    setOcupado('compartilhar');
    try {
      const blob = await buscarPng();
      const file = new File([blob], 'cartao-de-natal.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cartão de Natal', text: 'Feliz Natal!' });
      } else {
        salvarArquivo(blob);
        toast('Imagem baixada. Envie pelo seu aplicativo de mensagens.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast((e as Error).message, 'erro');
    } finally {
      setOcupado(null);
    }
  }

  async function postar() {
    setOcupado('mural');
    try {
      const blob = await buscarPng();
      const form = new FormData();
      form.append('file', new File([blob], 'cartao-de-natal.png', { type: 'image/png' }));
      const { url } = await api<{ url: string }>('/api/upload', { method: 'POST', body: form, timeoutMs: 60_000 });
      await api('/api/posts', { method: 'POST', json: { content: 'Meu cartão de Natal.', images: [url] } });
      toast('Cartão postado no mural.');
      router.push('/mural');
    } catch (e) {
      toast((e as Error).message, 'erro');
      setOcupado(null);
    }
  }

  const semFoto = !foto;
  const desabilitado = semFoto || ocupado !== null;

  return (
    <>
      <PageHeader kicker="Para mandar a quem você ama" title="Cartão de Natal" back="/familia" />

      <section className="rise px-5">
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[18px] border border-linha bg-carvao-2" style={{ aspectRatio: '1080 / 1350' }}>
          {urlImagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={urlImagem}
              src={urlImagem}
              alt="Prévia do seu cartão de Natal"
              className="h-full w-full object-cover"
              onLoad={() => setCarregando(false)}
              onError={() => {
                setCarregando(false);
                setFalhou(true);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-marfim-2">Escolha uma foto para ver o cartão.</div>
          )}
          {carregando && (
            <div className="absolute inset-0 flex items-center justify-center bg-carvao/60" role="status" aria-label="Montando o cartão">
              <Loader2 className="animate-spin text-champagne" size={28} strokeWidth={1.5} />
            </div>
          )}
          {falhou && <div className="absolute inset-x-0 bottom-0 bg-carvao/90 p-3 text-center text-sm text-marfim-2">Não deu para montar a prévia. Tente outra foto.</div>}
        </div>

        <div className="mx-auto mt-4 grid max-w-sm grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary" disabled={desabilitado} onClick={compartilhar}>
            {ocupado === 'compartilhar' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} strokeWidth={1.5} />} Compartilhar
          </button>
          <button type="button" className="btn btn-ghost" disabled={desabilitado} onClick={baixar}>
            {ocupado === 'baixar' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} strokeWidth={1.5} />} Baixar
          </button>
          <button type="button" className="btn btn-ghost col-span-2" disabled={desabilitado} onClick={postar}>
            {ocupado === 'mural' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={1.5} />} Postar no mural
          </button>
        </div>
      </section>

      <section className="rise mx-auto mt-8 max-w-sm space-y-6 px-5 pb-8">
        <div>
          <p className="kicker mb-3">1. Foto</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-linha-forte text-xs text-marfim-2"
              onClick={() => arquivo.current?.click()}
              disabled={enviando}
              aria-label="Enviar uma foto nova"
            >
              {enviando ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} strokeWidth={1.5} />}
              Nova
            </button>
            {miniaturas.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setFoto(u)}
                aria-label="Usar esta foto"
                aria-pressed={foto === u}
                className={`h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border-2 ${foto === u ? 'border-champagne' : 'border-transparent'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(u, 160)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={enviarNova} />
        </div>

        <div>
          <p className="kicker mb-3">2. Modelo</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modelo do cartão">
            {MODELOS.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={modelo === m.id}
                onClick={() => setModelo(m.id)}
                className={`btn text-sm ${modelo === m.id ? 'btn-primary' : 'btn-ghost'}`}
              >
                {m.nome}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="kicker mb-3">3. Frase</p>
          <div className="space-y-2">
            {FRASES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFrase(f);
                  setPropria(false);
                }}
                aria-pressed={!propria && frase === f}
                className={`block min-h-11 w-full rounded-[14px] border px-4 py-2 text-left text-sm ${!propria && frase === f ? 'border-champagne text-marfim' : 'border-linha text-marfim-2'}`}
              >
                {f}
              </button>
            ))}
            <textarea
              className="field"
              rows={3}
              maxLength={MAX_TEXTO}
              placeholder="Ou escreva a sua frase"
              value={propria ? frase : ''}
              onChange={(e) => {
                setPropria(true);
                setFrase(e.target.value);
              }}
              aria-label="Sua própria frase"
            />
            <p className="text-right text-xs text-marfim-3">{propria ? frase.length : 0}/{MAX_TEXTO}</p>
          </div>
        </div>

        <div>
          <p className="kicker mb-3">4. Assinatura</p>
          <input className="field" maxLength={MAX_ASSINATURA} value={assinatura} onChange={(e) => setAssinatura(e.target.value)} aria-label="Assinatura" />
          <p className="mt-2 text-xs text-marfim-3">O cartão também leva “Natal em Família” com o ano da ceia.</p>
        </div>
      </section>
    </>
  );
}
