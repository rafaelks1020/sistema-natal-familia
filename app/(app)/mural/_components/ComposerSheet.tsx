'use client';

import { useEffect, useRef, useState } from 'react';
import { BarChart3, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { api, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import type { PollItem, PostItem } from '../types';

type TabMode = 'post' | 'poll';

interface Props {
  open: boolean;
  initialMode?: TabMode;
  editingPost?: PostItem | null;
  onClose: () => void;
  onPostSaved: (post: PostItem, isEdit: boolean) => void;
  onPollCreated: (poll: PollItem) => void;
}

const MAX_PHOTOS = 6;
const MAX_OPTIONS = 5;
const MIN_OPTIONS = 2;

export default function ComposerSheet({
  open,
  initialMode = 'post',
  editingPost = null,
  onClose,
  onPostSaved,
  onPollCreated,
}: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<TabMode>(initialMode);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingInfo, setUploadingInfo] = useState<{ current: number; total: number } | null>(null);

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingPost) {
      setMode('post');
      setContent(editingPost.content);
      setImages(editingPost.images ?? []);
    } else {
      setMode(initialMode);
      setContent('');
      setImages([]);
      setQuestion('');
      setOptions(['', '']);
    }
  }, [open, initialMode, editingPost]);

  if (!open) return null;

  const isEditing = Boolean(editingPost);
  const isBusy = submitting || uploadingInfo !== null;

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) {
      toast(`Máximo de ${MAX_PHOTOS} fotos por publicação.`, 'erro');
      e.target.value = '';
      return;
    }

    const selected = Array.from(fileList).slice(0, remaining);
    if (fileList.length > remaining) {
      toast(`Só cabem mais ${remaining} foto(s).`, 'erro');
    }
    e.target.value = '';

    setUploadingInfo({ current: 1, total: selected.length });
    const uploaded: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      setUploadingInfo({ current: i + 1, total: selected.length });
      try {
        const url = await uploadImage(selected[i]);
        uploaded.push(url);
        setImages((prev) => [...prev, url]);
      } catch (err) {
        toast((err as Error).message || 'Falha ao enviar foto.', 'erro');
      }
    }

    setUploadingInfo(null);
    if (uploaded.length > 0) {
      toast(uploaded.length === 1 ? 'Foto pronta' : `${uploaded.length} fotos prontas`);
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmitPost(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;

    const trimmed = content.trim();
    if (!trimmed && images.length === 0) {
      toast('Escreva algo ou adicione uma foto.', 'erro');
      return;
    }

    setSubmitting(true);
    try {
      if (editingPost) {
        const updated = await api<PostItem>(`/api/posts/${editingPost.id}`, {
          method: 'PUT',
          json: { content: trimmed, images },
        });
        onPostSaved(
          {
            ...editingPost,
            ...updated,
            reactions: editingPost.reactions,
            my_reactions: editingPost.my_reactions,
            comments: editingPost.comments,
            comments_count: editingPost.comments_count,
          },
          true,
        );
        toast('Publicação atualizada');
      } else {
        const created = await api<PostItem>('/api/posts', {
          method: 'POST',
          json: { content: trimmed, images },
        });
        onPostSaved(created, false);
        toast('Publicado no mural');
      }
      onClose();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitPoll(e: React.FormEvent) {
    e.preventDefault();
    if (isBusy) return;

    const cleanQ = question.trim();
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!cleanQ) {
      toast('Escreva a pergunta da enquete.', 'erro');
      return;
    }
    if (cleanOpts.length < MIN_OPTIONS) {
      toast('Preencha pelo menos 2 opções.', 'erro');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api<PollItem>('/api/polls', {
        method: 'POST',
        json: { question: cleanQ, options: cleanOpts },
      });
      onPollCreated(created);
      toast('Enquete publicada');
      onClose();
    } catch (err) {
      toast((err as Error).message, 'erro');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/75 backdrop-blur-xs fade-in"
      onClick={() => !isBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar publicação' : 'Nova publicação'}
        className="rise safe-bottom max-h-[90dvh] w-full max-w-lg self-center overflow-y-auto rounded-t-[22px] border-t border-linha-forte bg-carvao-2 px-5 pb-6 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linha-forte" />

        <div className="flex items-center justify-between gap-3 pb-4">
          <div>
            <p className="kicker">{isEditing ? 'Editar' : 'Mural da família'}</p>
            <h2 className="display mt-0.5 text-2xl text-marfim">
              {isEditing
                ? 'Editar publicação'
                : mode === 'post'
                  ? 'Contar para a família'
                  : 'Nova enquete'}
            </h2>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-marfim-2 hover:text-marfim"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {!isEditing && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-full border border-linha bg-carvao p-1">
            <button
              type="button"
              onClick={() => setMode('post')}
              className={`min-h-[40px] rounded-full text-sm font-medium transition-colors ${
                mode === 'post' ? 'bg-cereja text-marfim' : 'text-marfim-2 hover:text-marfim'
              }`}
            >
              Foto ou relato
            </button>
            <button
              type="button"
              onClick={() => setMode('poll')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors ${
                mode === 'poll' ? 'bg-cereja text-marfim' : 'text-marfim-2 hover:text-marfim'
              }`}
            >
              <BarChart3 size={16} strokeWidth={1.5} />
              Enquete
            </button>
          </div>
        )}

        {mode === 'post' ? (
          <form onSubmit={handleSubmitPost} className="space-y-4">
            <textarea
              className="field min-h-[120px] resize-none leading-relaxed"
              placeholder="O que está acontecendo nos preparativos do Natal?"
              maxLength={2000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative aspect-square overflow-hidden rounded-[14px] border border-linha bg-carvao"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Foto ${idx + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      aria-label={`Remover foto ${idx + 1}`}
                      className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-carvao/85 text-marfim shadow-md backdrop-blur-xs"
                    >
                      <X size={15} strokeWidth={1.8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingInfo && (
              <div className="rounded-[14px] border border-linha bg-carvao px-4 py-3">
                <div className="flex items-center justify-between text-xs text-marfim-2">
                  <span>
                    Enviando foto {uploadingInfo.current} de {uploadingInfo.total}...
                  </span>
                  <span className="numeral text-champagne">
                    {Math.round((uploadingInfo.current / uploadingInfo.total) * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-carvao-3">
                  <div
                    className="h-full rounded-full bg-champagne transition-all duration-300"
                    style={{
                      width: `${Math.round((uploadingInfo.current / uploadingInfo.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <button
                type="button"
                disabled={isBusy || images.length >= MAX_PHOTOS}
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-ghost px-4 text-sm"
              >
                <ImagePlus size={18} strokeWidth={1.5} className="text-champagne" />
                Fotos ({images.length}/{MAX_PHOTOS})
              </button>

              <button type="submit" disabled={isBusy} className="btn btn-primary flex-1">
                {submitting ? 'Publicando...' : isEditing ? 'Salvar alterações' : 'Publicar'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitPoll} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-marfim-2">
                Pergunta para a família
              </label>
              <input
                className="field"
                placeholder="Ex.: Qual sobremesa não pode faltar na ceia?"
                maxLength={240}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-marfim-2">
                Opções ({options.length}/{MAX_OPTIONS})
              </label>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    className="field"
                    placeholder={`Opção ${idx + 1}`}
                    maxLength={120}
                    value={opt}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                    }
                    required={idx < MIN_OPTIONS}
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remover opção ${idx + 1}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha text-marfim-3 hover:text-marfim"
                    >
                      <Trash2 size={16} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {options.length < MAX_OPTIONS ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ''])}
                  className="btn btn-ghost px-4 text-sm"
                >
                  <Plus size={16} strokeWidth={1.5} className="text-champagne" />
                  Adicionar opção
                </button>
              ) : (
                <span />
              )}

              <button type="submit" disabled={isBusy} className="btn btn-primary flex-1">
                {submitting ? 'Criando...' : 'Publicar enquete'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
