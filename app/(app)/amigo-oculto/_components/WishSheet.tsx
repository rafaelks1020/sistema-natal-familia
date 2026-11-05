'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import { api, thumb, uploadImage } from '@/app/ui/client';
import { useToast } from '@/app/ui/toast';
import Stars from './Stars';
import { externalLink, reaisToCents, type WishDetail, type WishDraft } from './WishHelpers';

const PRIORITY_LABEL = ['Seria legal', 'Quero', 'Quero muito'];

export default function WishSheet({
  draft,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: WishDraft;
  onClose: () => void;
  onSaved: (item: WishDetail) => void;
  onDeleted: (id: number) => void;
}) {
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<WishDraft>(draft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
    } catch (err) {
      setError((err as Error).message || 'Não foi possível enviar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (uploadingPhoto) return;
    setError('');
    const name = form.item_name.trim();
    if (!name) {
      setError('Escreva o nome do presente.');
      return;
    }
    const link = form.item_url.trim();
    if (link && !externalLink(link)) {
      setError('O link precisa começar com http:// ou https://');
      return;
    }
    const minCents = reaisToCents(form.price_min_reais);
    const maxCents = reaisToCents(form.price_max_reais);
    if (minCents === 'invalido' || maxCents === 'invalido') {
      setError('Informe valores válidos em reais.');
      return;
    }
    if (minCents != null && maxCents != null && minCents > maxCents) {
      setError('O valor mínimo não pode ser maior que o máximo.');
      return;
    }

    const json = {
      item_name: name,
      item_description: form.item_description.trim(),
      item_url: link,
      priority: form.priority,
      price_min_cents: minCents,
      price_max_cents: maxCents,
      image_url: form.image_url,
    };

    setBusy(true);
    try {
      const saved = form.id
        ? await api<WishDetail>(`/api/wishlist/${form.id}`, { method: 'PUT', json })
        : await api<WishDetail>('/api/wishlist', { method: 'POST', json });
      onSaved(saved);
      toast(form.id ? 'Desejo atualizado' : 'Desejo anotado');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    try {
      await api(`/api/wishlist/${form.id}`, { method: 'DELETE' });
      onDeleted(form.id);
      toast('Desejo apagado');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/65" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desejo-titulo"
        className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[18px] border border-linha bg-carvao-2 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4"
      >
        <div className="mx-auto mb-4 h-px w-10 bg-champagne/70" />
        <h3 id="desejo-titulo" className="display text-[1.7rem]">
          {form.id ? 'Editar desejo' : 'Novo desejo'}
        </h3>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Nome do presente</span>
            <input
              ref={nameRef}
              className="field"
              value={form.item_name}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, item_name: e.target.value }))}
              placeholder="Ex.: livro de receitas"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-marfim-3">De R$ (opcional)</span>
              <input
                className="field"
                inputMode="decimal"
                value={form.price_min_reais}
                maxLength={12}
                onChange={(e) => setForm((f) => ({ ...f, price_min_reais: e.target.value }))}
                placeholder="Ex.: 50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-marfim-3">Até R$ (opcional)</span>
              <input
                className="field"
                inputMode="decimal"
                value={form.price_max_reais}
                maxLength={12}
                onChange={(e) => setForm((f) => ({ ...f, price_max_reais: e.target.value }))}
                placeholder="Ex.: 120"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Link da loja (opcional)</span>
            <input
              className="field"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.item_url}
              maxLength={500}
              onChange={(e) => setForm((f) => ({ ...f, item_url: e.target.value }))}
              placeholder="https://"
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs text-marfim-3">Foto do presente (opcional)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPickPhoto(e)}
            />
            {form.image_url ? (
              <div className="flex items-center gap-3 rounded-[14px] border border-linha bg-carvao p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb(form.image_url, 256)}
                  alt="Foto do desejo"
                  className="h-16 w-16 rounded-[10px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-marfim-2">Foto anexada</p>
                  <button
                    type="button"
                    disabled={uploadingPhoto || busy}
                    onClick={() => fileRef.current?.click()}
                    className="mt-1 min-h-11 text-xs text-champagne underline"
                  >
                    Trocar foto
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Remover foto"
                  disabled={uploadingPhoto || busy}
                  onClick={() => setForm((f) => ({ ...f, image_url: null }))}
                  className="flex h-11 w-11 items-center justify-center text-marfim-3"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingPhoto || busy}
                onClick={() => fileRef.current?.click()}
                className="btn btn-ghost w-full justify-center gap-2"
              >
                <Camera size={16} strokeWidth={1.5} />
                {uploadingPhoto ? 'Enviando foto...' : 'Escolher foto'}
              </button>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs text-marfim-3">Um detalhe (opcional)</span>
            <textarea
              className="field min-h-20 resize-none"
              value={form.item_description}
              maxLength={400}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, item_description: e.target.value }))}
              placeholder="Cor, tamanho, onde encontrar"
            />
          </label>

          <fieldset>
            <legend className="mb-1.5 text-xs text-marfim-3">Quanto você quer</legend>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={form.priority === n}
                  onClick={() => setForm((f) => ({ ...f, priority: n }))}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[14px] border px-1 text-xs ${
                    form.priority === n ? 'border-champagne text-marfim' : 'border-linha text-marfim-3'
                  }`}
                >
                  <Stars n={n} />
                  {PRIORITY_LABEL[n - 1]}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-sm text-cereja">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || uploadingPhoto}>
            {busy ? 'Um instante...' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={onClose}>
            Fechar
          </button>
        </form>
        {form.id && (
          <div className="mt-2 border-t border-linha pt-3">
            {askDelete ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-marfim-2">Apagar este desejo?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy}
                    onClick={() => setAskDelete(false)}
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet text-cereja"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Apagar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-quiet text-marfim-3" onClick={() => setAskDelete(true)}>
                <Trash2 size={16} strokeWidth={1.5} /> Apagar este desejo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
